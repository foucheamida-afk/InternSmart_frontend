import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;

let ai;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorMessage(error) {
  let details = error?.message || String(error);
  if (error?.cause) {
    const causeMsg = error.cause.message || error.cause.code || String(error.cause);
    details += ` (Cause: ${causeMsg})`;
  }
  return details;
}

/**
 * generateGeminiResponse
 *
 * options:
 *   thinking    {boolean}  – true  → let model use full thinking budget (deep analysis)
 *                          – false → thinkingBudget=0, fastest possible response (chat/assistant)
 *                          Defaults to false.
 *   maxCharLimit {number}  – truncate prompt at this many chars (default 120 000)
 *   maxRetries   {number}  – retry attempts (default 3)
 */
export async function generateGeminiResponse(prompt, options = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in the server environment (.env).");
  }

  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // Truncate oversized prompts to avoid socket drop / payload overflow
  const maxCharLimit = options.maxCharLimit || 120000;
  let finalPrompt = prompt;
  if (typeof prompt === "string" && prompt.length > maxCharLimit) {
    console.warn(
      `[GeminiService] Prompt length (${prompt.length}) exceeded limit. Truncating to ${maxCharLimit} chars.`
    );
    finalPrompt = prompt.slice(0, maxCharLimit) + "\n\n[Content truncated for analysis]";
  }

  // Thinking mode:
  //   options.thinking = true  → deep report analysis, let the model think freely
  //   options.thinking = false → writing assistant chat, disable thinking for speed
  const thinkingConfig = options.thinking === true
    ? {}                      // unrestricted thinking (analysis tasks)
    : { thinkingBudget: 0 };  // no thinking (fast chat responses)

  const maxRetries = options.maxRetries || 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Primary: Interactions API
      const primaryModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const interaction = await ai.interactions.create({
        model: primaryModel,
        input: finalPrompt,
        store: false,
        config: { thinkingConfig },
      });

      if (interaction.output_text) return interaction.output_text;

      const textOutput = interaction.outputs?.find((o) => o.type === "text");
      if (textOutput?.text) return textOutput.text;

      throw new Error("Gemini returned an empty response.");
    } catch (error) {
      lastError = error;
      console.error(
        `[GeminiService] Attempt ${attempt}/${maxRetries} failed:`,
        extractErrorMessage(error)
      );

      // Fallback: models.generateContent
      try {
        const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
        const contentRes = await ai.models.generateContent({
          model: fallbackModel,
          contents: finalPrompt,
          config: { thinkingConfig },
        });

        if (contentRes.text) {
          console.log("[GeminiService] Fallback generateContent succeeded!");
          return contentRes.text;
        }
      } catch {
        // Continue to retry loop
      }

      if (attempt < maxRetries) {
        const backoffMs = attempt * 1500;
        console.log(`[GeminiService] Retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
      }
    }
  }

  throw new Error(
    `Failed to communicate with Gemini: ${extractErrorMessage(lastError)}`
  );
}