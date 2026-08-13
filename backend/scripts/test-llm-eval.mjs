/**
 * @file test-llm-eval.mjs
 * @description Standalone test for the hosted-LLM evaluation path (and the
 * heuristic fallback) in taskAiEvaluation.helper.js.
 *
 * We spin up a tiny local OpenAI-compatible mock server, point AI_EVAL_BASE_URL
 * at it, enable AI evaluation, and assert that:
 *   1. The LLM path is taken (result.model === configured model).
 *   2. Out-of-range LLM scores are clamped to the rubric maxPoints.
 *   3. Unknown rubric criteria are dropped; known ones are normalised.
 *   4. With AI disabled, the deterministic heuristic path is used.
 *
 * Run from backend folder:
 *   node scripts/test-llm-eval.mjs
 */

// Must set env BEFORE importing the helper (config reads env at module init).
process.env.AI_EVAL_ENABLED = "true";
process.env.AI_EVAL_PROVIDER = "openai";
process.env.AI_EVAL_API_KEY = "test-key";
process.env.AI_EVAL_MODEL = "test-model";
process.env.AI_EVAL_TEMPERATURE = "0.1";
process.env.AI_EVAL_MAX_TOKENS = "2000";
process.env.AI_EVAL_TIMEOUT_MS = "5000";

import http from "node:http";

let pass = 0;
let fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra !== undefined ? ` — ${JSON.stringify(extra)}` : ""}`); }
};

/** Start a mock OpenAI-compatible server that returns a canned response. */
function startMockServer(payload) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(payload) } }],
          })
        );
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      process.env.AI_EVAL_BASE_URL = `http://127.0.0.1:${port}/v1`;
      resolve(server);
    });
  });
}

async function main() {
  const task = {
    title: "Explain SOLID",
    taskType: "WRITTEN",
    instructions: "Explain SOLID with examples.",
    maxScore: 50,
    rubric: [
      { criterion: "Coverage", description: "cover principles", maxPoints: 30, order: 1 },
      { criterion: "Examples", description: "give examples", maxPoints: 20, order: 2 },
    ],
  };
  const content = { textContent: "SOLID explained with examples." };

  // ── LLM path with clamping + unknown-criterion filtering ──
  const mock = await startMockServer({
    rubricResults: [
      // "Coverage" max 30 → model says 99, must clamp to 30.
      { criterion: "Coverage", maxPoints: 30, awardedPoints: 99, comment: "great" },
      // "Examples" max 20 → valid value.
      { criterion: "Examples", maxPoints: 20, awardedPoints: 12, comment: "ok" },
      // Unknown criterion → should be dropped.
      { criterion: "Extraneous", maxPoints: 10, awardedPoints: 10, comment: "n/a" },
    ],
    feedback: "Solid work overall.",
    strengths: ["Coverage"],
    improvements: ["Examples"],
    confidence: 2.5, // out of range -> clamp to 1
  });

  const { evaluateTaskSubmission } = await import("../src/helpers/taskAiEvaluation.helper.js");

  const llmResult = await evaluateTaskSubmission({ task, submissionContent: content });
  mock.close();

  ok(llmResult.model === "test-model", "LLM path used (model = test-model)", llmResult.model);
  ok(llmResult.maxScore === 50, "maxScore preserved", llmResult.maxScore);
  ok(llmResult.percentage >= 0 && llmResult.percentage <= 100, "percentage in 0..100", llmResult.percentage);
  ok(llmResult.confidence <= 1, "confidence clamped to <= 1", llmResult.confidence);

  // Clamping: "Coverage" awardedPoints must be 30 (not 99).
  const coverage = llmResult.rubricResults.find((r) => r.criterion === "Coverage");
  ok(coverage && coverage.awardedPoints === 30, "awardedPoints clamped to maxPoints", coverage);

  // Unknown criterion dropped → exactly 2 criteria.
  ok(llmResult.rubricResults.length === 2, "unknown criterion filtered out", llmResult.rubricResults.map((r) => r.criterion));

  // Score = 30 + 12 = 42.
  ok(llmResult.score === 42, "score sums clamped rubric results", llmResult.score);

  // ── Heuristic fallback with AI disabled ──
  process.env.AI_EVAL_ENABLED = "false";
  await import("../src/helpers/taskAiEvaluation.helper.js").then((m) => (m.__reload = 1)).catch(() => {});
  // config is module-singleton, so re-evaluating with ENABLED=false in the same
  // process won't reflect — reload in a fresh process via child.
  const { execFileSync } = await import("node:child_process");
  try {
    const out = execFileSync(
      process.execPath,
      ["-e", `
        process.env.AI_EVAL_ENABLED='false';
        const { evaluateTaskSubmission } = await import('./src/helpers/taskAiEvaluation.helper.js');
        const r = await evaluateTaskSubmission({ task: ${JSON.stringify(task)}, submissionContent: { textContent: 'SOLID explained with examples.' } });
        console.log(JSON.stringify({ model: r.model, hasRubric: r.rubricResults.length, feedback: !!r.feedback }));
      `],
      { encoding: "utf8" }
    );
    const parsed = JSON.parse(out.trim().split("\n").pop());
    ok(parsed.model === "heuristic-rules-v1", "heuristic fallback used when AI disabled", parsed.model);
    ok(parsed.hasRubric === 2, "heuristic produced rubric results", parsed.hasRubric);
    ok(parsed.feedback === true, "heuristic produced feedback");
  } catch (err) {
    fail++;
    console.log("  ❌ heuristic fallback check errored:", err.message);
  }

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error("Test error:", err.message);
  process.exit(1);
});
