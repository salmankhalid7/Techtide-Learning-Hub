/**
 * @file taskAiEvaluation.helper.js
 * @description AI evaluation engine for LearnX AI task submissions.
 *
 * Given a published Task (with its rubric + instructions) and a student's
 * submission, produces a structured evaluation: per-criterion rubric scores,
 * an overall AI score/percentage, and written feedback.
 *
 * DESIGN NOTES
 * ------------
 * Two evaluation paths:
 *
 *   1. LLM path (preferred, when configured): sends the task rubric +
 *      instructions + submission to a configured OpenAI-compatible model via
 *      `llm.service.js` and parses its structured JSON. The response is
 *      validated & clamped so it can never produce invalid scores.
 *
 *   2. Heuristic fallback (deterministic): scores each rubric criterion from
 *      0..maxPoints based on keyword/description coverage + length. Used
 *      automatically when AI is disabled, unconfigured, or the LLM call
 *      fails — so evaluation always completes.
 *
 * The output shape is identical for both paths, so no call-site changes are
 * required regardless of which path runs.
 */

import { config } from "../config/index.js";
import { chatComplete, isAiEnabled } from "../services/llm.service.js";
import logger from "../config/logger.js";

/**
 * Plain-words tokenizer for the heuristic evaluator.
 *
 * @param {string} text
 * @returns {string[]} lowercase, de-duplicated content words
 */
const _tokens = (text = "") =>
    [
        ...new Set(
            String(text)
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, " ")
                .split(/\s+/)
                .filter(Boolean)
                .filter((w) => w.length > 2)
        ),
    ];

/**
 * Fraction of a space-separated list of words that appear in the content.
 *
 * @param {string} content
 * @param {string} wordList - space or comma separated terms
 * @returns {number} 0..1
 */
const _coverage = (content, wordList = "") => {
    const terms = String(wordList)
        .split(/[\s,]+/)
        .map((t) => t.toLowerCase().trim())
        .filter(Boolean);

    if (!terms.length) return 1;

    const haystack = String(content).toLowerCase();
    const hits = terms.filter((t) => haystack.includes(t)).length;

    return hits / terms.length;
};

/**
 * Heuristic core that scores a single rubric criterion against the
 * submission content.
 *
 * @param {Object} criterion - { criterion, description, maxPoints }
 * @param {string} content   - combined submission text/code/url label
 * @returns {Object} { awardedPoints, comment }
 */
const _scoreCriterion = (criterion, content) => {
    const maxPoints = Number(criterion.maxPoints) || 1;
    const description = criterion.description || criterion.criterion || "";

    // A criterion with no description is graded on general substance.
    const coverage = description
        ? _coverage(content, description)
        : Math.min(1, content.length / 200);

    // Bump base coverage with demonstrated length/effort (capped at 1).
    const lengthBonus = Math.min(0.15, content.length / 4000);
    const raw = Math.min(1, coverage + lengthBonus);

    // Quantise to nearest 0.25 point step for stable, explainable scores.
    const awarded = Math.min(
        maxPoints,
        Math.max(0, Math.round((raw * maxPoints) / 0.25) * 0.25)
    );

    let comment = "";
    const ratio = awarded / maxPoints;
    if (ratio >= 0.9) comment = "Exceeds expectations — criterion fully addressed.";
    else if (ratio >= 0.7) comment = "Meets expectations — solid coverage of the criterion.";
    else if (ratio >= 0.4) comment = "Partially meets expectations — some key aspects missing.";
    else comment = "Does not yet meet expectations — revisit the criterion.";

    return {
        criterion: criterion.criterion,
        maxPoints,
        awardedPoints: awarded,
        comment,
    };
};

/**
 * Build the contextual prompt (user turn) sent to the LLM.
 *
 * @param {Object} ctx
 * @returns {string}
 */
const buildPrompt = ({ task, submissionContent }) =>
    [
        `You are an expert evaluator for the LearnX AI LMS.`,
        ``,
        `Task title: ${task.title || ""}`,
        `Task type: ${task.taskType || ""}`,
        `Instructions:`,
        task.instructions || task.description || "(none)",
        ``,
        `Maximum score: ${task.maxScore}`,
        `Rubric (score each criterion from 0..maxPoints):`,
        (task.rubric || [])
            .map(
                (r) =>
                    `- ${r.criterion} (${r.maxPoints} pts${
                        r.description ? `): ${r.description}` : ")"
                    }`
            )
            .join("\n"),
        ``,
        `Student submission:`,
        submissionContent.textContent ||
            submissionContent.codeContent ||
            submissionContent.url ||
            "(file submission)",
        ``,
        `Respond ONLY with a single valid JSON object (no markdown fences, no extra text) shaped exactly like:`,
        `{"rubricResults":[{"criterion":"<criterion name>","maxPoints":<number>,"awardedPoints":<number 0..maxPoints>,"comment":"<short comment>"}],"feedback":"<overall feedback>","strengths":["..."],"improvements":["..."],"confidence":<0..1>}`,
        `Ensure awardedPoints stays within 0..maxPoints for every rubric criterion and that the rubricResults array covers all criteria listed above.`,
    ].join("\n");

/**
 * Extract the first JSON object from a model reply, tolerating markdown
 * code fences or surrounding prose.
 *
 * @param {string} text
 * @returns {Object|null}
 */
const _parseJsonFromText = (text) => {
    if (!text) return null;

    // Strip markdown code fences if present.
    let cleaned = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*$/g, "")
        .trim();

    // Find the outermost JSON object.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    const candidate = cleaned.slice(start, end + 1);
    try {
        return JSON.parse(candidate);
    } catch {
        return null;
    }
};

/**
 * Validate and clamp the LLM's raw JSON into a safe, model-compliant shape.
 * Guarantees: no score exceeds maxPoints, rubricResults only contain known
 * criteria with numeric points, feedback is a string, and confidence in 0..1.
 *
 * @param {Object} raw
 * @param {Object} task
 * @returns {Object|null} sanitized result, or null if unusable
 */
const _sanitizeLlmResult = (raw, task) => {
    if (!raw || typeof raw !== "object") return null;

    const maxScore = Number(task.maxScore) || 0;
    const rubric = Array.isArray(task.rubric) ? task.rubric : [];
    const rubricTotal = rubric.reduce(
        (sum, r) => sum + (Number(r.maxPoints) || 0),
        0
    );

    // Normalise rubricResults against the task's rubric (only known criteria).
    const byCriterion = new Map(
        rubric.map((r) => [r.criterion, Number(r.maxPoints) || 0])
    );

    const results = [];
    const rawResults = Array.isArray(raw.rubricResults) ? raw.rubricResults : [];

    for (const item of rawResults) {
        const criterion = typeof item?.criterion === "string" ? item.criterion.trim() : "";
        if (!byCriterion.has(criterion)) continue; // ignore unknown criteria

        const maxPoints = byCriterion.get(criterion);
        const awarded = Number.isFinite(Number(item?.awardedPoints))
            ? Number(item.awardedPoints)
            : 0;

        results.push({
            criterion,
            maxPoints,
            awardedPoints: Number(Math.min(maxPoints, Math.max(0, awarded)).toFixed(2)),
            comment: typeof item?.comment === "string" ? item.comment.slice(0, 1000) : "",
        });
    }

    if (results.length === 0) return null; // unusable — fall back

    const effectiveMax = rubricTotal > 0 ? rubricTotal : maxScore;

    const score = Number(
        results.reduce((sum, r) => sum + r.awardedPoints, 0).toFixed(2)
    );
    const effectiveScore = rubricTotal > 0 ? score : Math.min(maxScore, score);

    const percentage = effectiveMax > 0
        ? Number(((effectiveScore / effectiveMax) * 100).toFixed(2))
        : 0;

    const str = (v) => (typeof v === "string" ? v.trim() : "");
    const arr = (v) =>
        Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 10) : [];

    const confidence = Number.isFinite(Number(raw.confidence))
        ? Number(Math.min(1, Math.max(0, Number(raw.confidence))).toFixed(2))
        : 0.5;

    return {
        rubricResults: results,
        score: effectiveScore,
        maxScore,
        percentage,
        feedback: str(raw.feedback) || "No feedback provided.",
        strengths: arr(raw.strengths),
        improvements: arr(raw.improvements),
        confidence,
    };
};

/**
 * The single integration seam for a real hosted LLM.
 *
 * Calls the configured OpenAI-compatible endpoint and parses its structured
 * JSON. Returns a sanitized result, or `null` so the caller falls back to the
 * deterministic heuristic (disabled, unconfigured, or any failure).
 *
 * @param {Object}   ctx - { task, submissionContent }
 * @returns {Promise<Object|null>}
 */
const _callLLM = async ({ task, submissionContent }) => {
    if (!isAiEnabled() || !config.ai.enabled) return null;

    try {
        const systemPrompt =
            "You are an expert evaluator for the LearnX AI LMS. Return ONLY a valid JSON object and nothing else.";

        const rawText = await chatComplete({
            systemPrompt,
            userPrompt: buildPrompt({ task, submissionContent }),
        });

        const parsed = _parseJsonFromText(rawText);
        if (!parsed) {
            logger.warn("AI evaluation returned unparseable JSON.", {
                snippet: String(rawText).slice(0, 200),
            });
            return null;
        }

        const sanitized = _sanitizeLlmResult(parsed, task);
        if (!sanitized) {
            logger.warn("AI evaluation result was rejected by validation.");
            return null;
        }

        return sanitized;
    } catch (err) {
        logger.warn("AI evaluation failed; falling back to heuristic.", {
            error: err.message,
        });
        return null;
    }
};

/**
 * Evaluate a task submission.
 *
 * @param {Object}   params
 * @param {Object}   params.task             - the published Task document
 * @param {Object}   params.submissionContent - submissionContent sub-doc
 * @param {string}   [params.model]           - model label for provenance
 * @returns {Promise<{
 *   rubricResults: Array,
 *   score: number,
 *   maxScore: number,
 *   percentage: number,
 *   feedback: string,
 *   strengths: string[],
 *   improvements: string[],
 *   confidence: number,
 *   model: string,
 * }>}
 */
export const evaluateTaskSubmission = async ({
    task,
    submissionContent = {},
    model = "heuristic-rules-v1",
}) => {
    const maxScore = Number(task.maxScore) || 0;

    // ── Preferred path: hosted LLM (only when configured & enabled) ──
    const llmResult = await _callLLM({ task, submissionContent });

    if (llmResult) {
        const providerModel = config.ai?.enabled ? config.ai.model : model;
        return { ...llmResult, model: providerModel || model };
    }

    // ── Fallback path: deterministic heuristic ──
    const rubric = Array.isArray(task.rubric) ? task.rubric : [];

    const content = [
        submissionContent.textContent,
        submissionContent.codeContent,
        submissionContent.url,
    ]
        .filter(Boolean)
        .join(" \n ");

    const rubricResults = rubric.map((r) =>
        _scoreCriterion(r, content)
    );

    const score = Number(
        rubricResults
            .reduce((sum, r) => sum + r.awardedPoints, 0)
            .toFixed(2)
    );

    const rubricTotal = rubric.reduce(
        (sum, r) => sum + (Number(r.maxPoints) || 0),
        0
    );

    // If a rubric exists, it is the source of truth. Otherwise fall back to a
    // proportional heuristic over maxScore.
    const effectiveMax = rubricTotal > 0 ? rubricTotal : maxScore;
    const effectiveScore =
        rubricTotal > 0
            ? score
            : Math.min(
                  maxScore,
                  Number((content.length / 600) * maxScore).toFixed(2)
              );

    const percentage = effectiveMax > 0
        ? Number(((effectiveScore / effectiveMax) * 100).toFixed(2))
        : 0;

    const strengths = rubricResults
        .filter((r) => r.awardedPoints / r.maxPoints >= 0.7)
        .map((r) => `Strong on: ${r.criterion}`);

    const improvements = rubricResults
        .filter((r) => r.awardedPoints / r.maxPoints < 0.7)
        .map((r) => `Improve: ${r.criterion}`);

    const feedback =
        strengths.length === 0 && improvements.length === 0
            ? "Submission received. Please review the rubric for guidance."
            : [
                  strengths.length ? `Strengths: ${strengths.join("; ")}.` : "",
                  improvements.length
                      ? `Areas to improve: ${improvements.join("; ")}.`
                      : "",
              ]
                  .filter(Boolean)
                  .join(" ");

    // Confidence reflects how much rubric signal aided grading (deterministic).
    const confidence = Number(
        Math.min(1, 0.5 + (rubric.length ? 0.1 : 0) + content.length / 5000).toFixed(2)
    );

    const fallbackModel = config.ai?.enabled ? model : "heuristic-rules-v1";

    return {
        rubricResults,
        score: Number(effectiveScore.toFixed(2)),
        maxScore,
        percentage,
        feedback,
        strengths,
        improvements,
        confidence,
        model: fallbackModel,
    };
};
