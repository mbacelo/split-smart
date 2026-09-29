// Shared contract for AI providers. The app talks to providers only through
// AIProvider, so swapping OpenAI for Gemini/Anthropic later means adding one
// file under providers/ and one case in index.ts — nothing else changes.

/** Raw result an AI provider must return: line items, the non-item charges
 * (tax/tip/fees/discounts, amounts as printed — always positive), and the
 * final total. */
export interface ReceiptAnalysis {
  items: { name: string; quantity: number; price: number }[];
  charges: { name: string; kind: string; amount: number }[];
  total: number;
}

export interface AIProvider {
  /**
   * Analyze a receipt image and return its line items and final total.
   * @param cleanBase64 base64 image data WITHOUT the `data:...;base64,` prefix
   * @param mimeType    e.g. "image/jpeg"
   */
  analyzeReceipt(cleanBase64: string, mimeType: string): Promise<ReceiptAnalysis>;
}

// The prompt is shared across providers so they all extract items identically.
export const RECEIPT_PROMPT = `Analyze this receipt.
1. Extract all line items representing actual products, food, or drinks into the "items" array.
2. STRICT RULE: DO NOT include Tax, Tip, Gratuity, Service Charges, Surcharges, or Discounts in the "items" list. Put each of those lines in the "charges" array instead, with "kind" set to "tax" (sales tax, VAT, GST...), "tip" (tip, gratuity, service charge), "fee" (other surcharges or fees), or "discount", and "amount" as a positive number. Do not put subtotals, totals, or payment lines (card, cash, change) in either array.
3. Extract the absolute final total amount paid as "total". This must include everything (tax, tip, fees).
4. Ensure prices are numbers without currency symbols.
5. For each item set "quantity" to the number of units on that line (default 1 if not shown). Keep the "name" clean, WITHOUT any quantity prefix (e.g. "Burger", not "2x Burger"). The "price" must be the total price for that line (quantity × unit price), exactly as it appears on the receipt.`;
