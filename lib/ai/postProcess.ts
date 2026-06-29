import { ProcessedReceipt } from "../../types.js";
import { ReceiptAnalysis } from "./types.js";

// Keywords used to filter out non-consumable lines (tax, tips, fees, payment
// lines, etc.) in case the model includes them despite the prompt. Kept
// verbatim from the original Gemini service so behavior is unchanged.
const noiseKeywords = [
  'tax', 'tip', 'gratuity', 'service charge', 'service fee',
  'surcharge', 'discount', 'subtotal', 'total', 'amount',
  'visa', 'mastercard', 'cash', 'change', 'balance', 'pst', 'gst', 'hst', 'vat'
];

// Match keywords as whole words rather than substrings, so legitimate items
// like "Cashew chicken" (contains "cash") or "Multipack" (contains "tip") are
// not silently dropped — which would scale their cost onto the other items.
const noisePattern = new RegExp(`\\b(${noiseKeywords.join('|')})\\b`, 'i');

/**
 * Turns a provider's raw analysis into the app's ProcessedReceipt shape:
 * filters out noise lines and stamps each item with a stable id.
 * Shared by every provider so cleanup is consistent.
 */
export const toProcessedReceipt = (data: ReceiptAnalysis): ProcessedReceipt => {
  const filteredItems = (data.items || [])
    .filter((item) => {
      if (!item.name || typeof item.price !== 'number') return false;
      return !noisePattern.test(item.name);
    })
    .map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? Math.round(item.quantity) : 1,
      originalPrice: item.price,
    }));

  return {
    items: filteredItems,
    total: Number(data.total) || 0,
  };
};
