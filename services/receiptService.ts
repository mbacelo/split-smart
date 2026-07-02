import { ProcessedReceipt } from "../types";
import { getIdToken } from "./auth";

/**
 * Sends the receipt image to our serverless endpoint, which holds the AI key
 * and runs the analysis. The browser never talks to an AI provider directly.
 * Signature kept identical to the old client-side analyzeReceipt so callers
 * are unchanged.
 */
// Hard client-side ceiling so the analyzing spinner can never hang forever;
// the serverless function itself is killed at 30s, so anything past this is dead.
const ANALYZE_TIMEOUT_MS = 45_000;

export const analyzeReceipt = async (imageBase64: string, signal?: AbortSignal): Promise<ProcessedReceipt> => {
  const token = getIdToken();
  if (!token) throw new Error("Please sign in to analyze receipts.");

  const timeoutSignal = AbortSignal.timeout(ANALYZE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch("/api/analyze-receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageBase64 }),
      // Lets the caller cancel a slow analysis (rejects with an AbortError).
      signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    });
  } catch (err) {
    // Distinguish our timeout from a user-initiated cancel (plain AbortError).
    if (timeoutSignal.aborted && !signal?.aborted) {
      throw new Error("The analysis took too long. Please try again.");
    }
    throw err;
  }

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
