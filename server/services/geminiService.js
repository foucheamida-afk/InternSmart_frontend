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

export async function generateGeminiResponse(prompt, options = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured in the server environment (.env).");
  }

  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  // Ensure prompt isn't excessively huge to avoid socket drops/payload overflow
  const maxCharLimit = options.maxCharLimit || 120000;
  let finalPrompt = prompt;
  if (typeof prompt === "string" && prompt.length > maxCharLimit) {
    console.warn(`[GeminiService] Prompt length (${prompt.length}) exceeded limit. Truncating to ${maxCharLimit} characters.`);
    finalPrompt = prompt.slice(0, maxCharLimit) + "\n\n[Content truncated for analysis]";
  }

  const maxRetries = options.maxRetries || 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Primary approach: Interactions API
      const primaryModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";
      const interaction = await ai.interactions.create({
        model: primaryModel,
        input: finalPrompt,
        store: false,
      });

      if (interaction.output_text) return interaction.output_text;

      const textOutput = interaction.outputs?.find((output) => output.type === "text");
      if (textOutput?.text) return textOutput.text;

      throw new Error("Gemini returned an empty response.");
    } catch (error) {
      lastError = error;
      const errorMsg = extractErrorMessage(error);
      console.error(`[GeminiService] Attempt ${attempt}/${maxRetries} failed:`, errorMsg);

      // Attempt fallback using models.generateContent if interactions.create failed
      try {
        const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
        const contentRes = await ai.models.generateContent({
          model: fallbackModel,
          contents: finalPrompt,
        });

        if (contentRes.text) {
          console.log("[GeminiService] Fallback generateContent succeeded!");
          return contentRes.text;
        }
      } catch (fallbackErr) {
        // Fallback error, continue to retry loop if attempts remain
      }

      if (attempt < maxRetries) {
        const backoffMs = attempt * 1500;
        console.log(`[GeminiService] Retrying in ${backoffMs}ms...`);
        await delay(backoffMs);
      }
    }
  }

  const finalCause = extractErrorMessage(lastError);
  throw new Error(`Failed to communicate with Gemini: ${finalCause}`);
}