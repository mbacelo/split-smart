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
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
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

    return JSON.parse(text) as ReceiptAnalysis;
  },
};
