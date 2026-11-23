/**
 * ============================================================
 * geminiService.js — the actual call to Google Gemini
 * ============================================================
 * Author: Atiyah Khan
 *
 * In simple words: this is the only place that talks to Google's
 * AI API. It sends the system prompt + the user's message and
 * returns the model's reply as plain text.
 * ============================================================
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GOOGLE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Calls a single Gemini model. Throws on any error so the caller
 * (gatewayService) can decide whether to fall back to the next model.
 */
async function callModel(modelName, systemPrompt, userMessage) {
  if (!genAI) {
    throw new Error('GOOGLE_AI_API_KEY is not set — add it to backend/.env');
  }

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt
  });

  const result = await model.generateContent(userMessage);
  const text = result.response.text();

  if (!text || !text.trim()) {
    throw new Error(`Model ${modelName} returned an empty response`);
  }
  return text;
}

module.exports = { callModel };
