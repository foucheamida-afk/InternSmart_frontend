import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateGeminiResponse(prompt) {
  try {
    const interaction = await ai.interactions.create({
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      input: prompt,
      store: false,
    });

    if (interaction.output_text) return interaction.output_text;

    const textOutput = interaction.outputs?.find((output) => output.type === "text");
    if (textOutput?.text) return textOutput.text;

    throw new Error("Gemini returned an empty response.");
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(`Failed to communicate with Gemini: ${error.message}`);
  }
}