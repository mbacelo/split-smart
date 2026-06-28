import { ProcessedReceipt } from "../types";
import { getIdToken } from "./auth";

/**
 * Sends the receipt image to our serverless endpoint, which holds the AI key
 * and runs the analysis. The browser never talks to an AI provider directly.
 * Signature kept identical to the old client-side analyzeReceipt so callers
 * are unchanged.
 */
export const analyzeReceipt = async (imageBase64: string): Promise<ProcessedReceipt> => {
  const token = getIdToken();
  if (!token) throw new Error("Please sign in to analyze receipts.");

  const res = await fetch("/api/analyze-receipt", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageBase64 }),
  });

  if (!res.ok) {
    let message = "Failed to analyze receipt. Try a clearer photo.";
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(message);
  }

  return (await res.json()) as ProcessedReceipt;
};
