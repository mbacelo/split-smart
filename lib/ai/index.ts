import { AIProvider } from "./types";
import { openAIProvider } from "./providers/openai";

export type { AIProvider, ReceiptAnalysis } from "./types";
export { toProcessedReceipt } from "./postProcess";

/**
 * Returns the active AI provider based on the AI_PROVIDER env var (default "openai").
 *
 * This is the single switch point for AI providers. To add Gemini/Anthropic
 * later: create lib/ai/providers/<name>.ts implementing AIProvider, then add a
 * case below. Nothing else in the app needs to change.
 */
export const getProvider = (): AIProvider => {
  const name = (process.env.AI_PROVIDER || "openai").toLowerCase();
  switch (name) {
    case "openai":
      return openAIProvider;
    default:
      throw new Error(`AI provider "${name}" is not implemented.`);
  }
};
