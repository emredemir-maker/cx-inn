import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "GEMINI_API_KEY must be set.",
  );
}

export const ai = new GoogleGenAI({ apiKey });
