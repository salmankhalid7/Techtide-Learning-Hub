/**
 * @file llm.service.js
 * @description Lightweight, provider-agnostic LLM client for AI task
 * evaluation.
 *
 * Implements the OpenAI-compatible Chat Completions protocol, which is
 * supported by OpenAI, OpenRouter, Together, Groq, Mistral, and local servers
 * (Ollama, LM Studio, vLLM) via a custom `baseUrl`. When no API key is set,
 * or a request fails, callers should fall back to the deterministic heuristic
 * (see taskAiEvaluation.helper.js).
 *
 * No external SDK is required — this uses the project's existing `node-fetch`.
 */

import { config } from "../config/index.js";
import logger from "../config/logger.js";

/**
 * Whether AI evaluation is enabled AND minimally configured.
 *
 * @returns {boolean}
 */
export const isAiEnabled = () => {
    const ai = config.ai;
    return Boolean(ai && ai.enabled && ai.apiKey && ai.baseUrl);
};

/**
 * POST a Chat Completions request to the configured OpenAI-compatible
 * endpoint and return the assistant text content.
 *
 * @param {Object}   options
 * @param {string}   options.systemPrompt - system-level instructions
 * @param {string}   options.userPrompt   - the user/task payload
 * @returns {Promise<string>} raw assistant text
 */
export const chatComplete = async ({ systemPrompt, userPrompt }) => {
    const ai = config.ai;

    if (!isAiEnabled()) {
        throw new Error("AI evaluation is not configured.");
    }

    const { apiKey, baseUrl, model, temperature, maxTokens, timeoutMs } = ai;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
        response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                temperature,
                max_tokens: maxTokens,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
            }),
            signal: controller.signal,
        });
    } catch (err) {
        clearTimeout(timer);
        const aborted = err.name === "AbortError";
        throw new Error(
            aborted
                ? `AI evaluation timed out after ${timeoutMs}ms.`
                : `AI evaluation request failed: ${err.message}`
        );
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new Error(
            `AI evaluation responded ${response.status}: ${
                bodyText.slice(0, 300) || response.statusText
            }`
        );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
        throw new Error("AI evaluation returned an unexpected response shape.");
    }

    return content.trim();
};
