import OpenAI from "openai";
import { AIProvider, ReceiptAnalysis, RECEIPT_PROMPT } from "../types.js";

// JSON schema forcing the model to return exactly { items: [{name, price}], total }.
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          price: { type: "number" },
        },
        required: ["name", "quantity", "price"],
      },
    },
    total: { type: "number" },
  },
  required: ["items", "total"],
} as const;

/**
 * OpenAI implementation of AIProvider. Reads its config from env at call time
 * so the key is only ever read server-side.
 */
export const openAIProvider: AIProvider = {
  async analyzeReceipt(cleanBase64: string, mimeType: string): Promise<ReceiptAnalysis> {
    // Fail fast on misconfiguration: a fallback model string would surface as an
    // opaque provider error instead of pointing at the missing env var.
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set.");
    const model = process.env.OPENAI_MODEL;
    if (!model) throw new Error("OPENAI_MODEL is not set.");

    // Timeout stays under Vercel's 30s maxDuration so a hung provider call
    // returns a controlled error instead of the platform killing the function.
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 25_000,
      maxRetries: 1,
    });
    // GPT-5.x reasoning effort: none|minimal|low|medium|high|xhigh. Unset = model default.
    const reasoningEffort = process.env.OPENAI_REASONING_EFFORT as
      | OpenAI.ReasoningEffort
      | undefined;

    const response = await client.chat.completions.create({
      model,
      ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
      // Cost ceiling per request. Receipt JSON is small (~500 tokens even for a
      // long receipt); the headroom is for reasoning tokens, which count here.
      max_completion_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_PROMPT },
            {
              type: "image_url",
              // "auto" detail: receipts need legible text, so we let the API pick
              // the tiling. Image tokens dominate cost — if bills ever get cheap
              // extraction wrong, try "high"; if cost matters more, try "low".
              image_url: { url: `data:${mimeType};base64,${cleanBase64}`, detail: "auto" },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "receipt_analysis",
          strict: true,
          schema: RECEIPT_SCHEMA,
        },
      },
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error("No response from AI.");

    // Strict json_schema makes malformed output unlikely, not impossible
    // (refusals, truncation at the token cap, model swaps). Guard so those
    // surface as a controlled error rather than a crash downstream.
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`AI returned non-JSON output (finish_reason: ${response.choices[0]?.finish_reason}).`);
    }
    const analysis = parsed as ReceiptAnalysis;
    if (!analysis || !Array.isArray(analysis.items) || typeof analysis.total !== "number") {
      throw new Error("AI returned JSON that doesn't match the receipt schema.");
    }
    return analysis;
  },
};
