import { ProcessedReceipt } from "../../types";
import { ReceiptAnalysis } from "./types";

// Keywords used to filter out non-consumable lines (tax, tips, fees, payment
// lines, etc.) in case the model includes them despite the prompt. Kept
// verbatim from the original Gemini service so behavior is unchanged.
const noiseKeywords = [
  'tax', 'tip', 'gratuity', 'service charge', 'service fee',
  'surcharge', 'discount', 'subtotal', 'total', 'amount',
  'visa', 'mastercard', 'cash', 'change', 'balance', 'pst', 'gst', 'hst', 'vat'
];

/**
 * Turns a provider's raw analysis into the app's ProcessedReceipt shape:
 * filters out noise lines and stamps each item with a stable id.
 * Shared by every provider so cleanup is consistent.
 */
export const toProcessedReceipt = (data: ReceiptAnalysis): ProcessedReceipt => {
  const filteredItems = (data.items || [])
    .filter((item) => {
      if (!item.name || typeof item.price !== 'number') return false;
      const lowName = item.name.toLowerCase();
      return !noiseKeywords.some(keyword => lowName.includes(keyword));
    })
    .map((item, index) => ({
      id: `item-${index}-${Date.now()}`,
      name: item.name,
      originalPrice: item.price,
    }));

  return {
    items: filteredItems,
    total: Number(data.total) || 0,
  };
};
