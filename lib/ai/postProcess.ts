import { ChargeKind, ProcessedReceipt, ReceiptCharge } from "../../types.js";
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

// A noise line that slipped into `items` is still worth keeping as a charge
// when it's a real one (tax, tip, fee, discount), so the breakdown can explain
// it. Subtotal/total/payment lines match none of these and are just dropped.
// Checked in order: "service charge" is a tip, not a fee.
const chargeKindPatterns: [ChargeKind, RegExp][] = [
  ['tip', /\b(tip|gratuity|service charge|service fee)\b/i],
  ['tax', /\b(tax|pst|gst|hst|vat)\b/i],
  ['discount', /\bdiscount\b/i],
  ['fee', /\bsurcharge\b/i],
];

const CHARGE_KINDS: ChargeKind[] = ['tax', 'tip', 'fee', 'discount'];

const classifyCharge = (name: string): ChargeKind | null =>
  chargeKindPatterns.find(([, pattern]) => pattern.test(name))?.[0] ?? null;

// Discounts are stored negative so a breakdown can simply sum the amounts.
const signedAmount = (kind: ChargeKind, amount: number): number =>
  kind === 'discount' ? -Math.abs(amount) : Math.abs(amount);

/**
 * Turns a provider's raw analysis into the app's ProcessedReceipt shape:
 * filters out noise lines, stamps each item with a stable id, and collects the
 * receipt's charges. Shared by every provider so cleanup is consistent.
 */
export const toProcessedReceipt = (data: ReceiptAnalysis): ProcessedReceipt => {
  const validLines = (data.items || []).filter(
    (item) => item.name && typeof item.price === 'number',
  );

  const filteredItems = validLines
    .filter((item) => !noisePattern.test(item.name))
    .map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      quantity: typeof item.quantity === 'number' && item.quantity > 0 ? Math.round(item.quantity) : 1,
      originalPrice: item.price,
    }));

  const charges: ReceiptCharge[] = (data.charges || [])
    .filter((c) => c && c.name && Number.isFinite(c.amount) && c.amount !== 0
      && CHARGE_KINDS.includes(c.kind as ChargeKind))
    .map((c) => ({ name: c.name, kind: c.kind as ChargeKind, amount: signedAmount(c.kind as ChargeKind, c.amount) }));

  // Recover charges the model put in `items` anyway, unless it also listed the
  // same one under `charges` (same kind and amount) — don't count it twice.
  const seen = new Set(charges.map((c) => `${c.kind}:${Math.round(c.amount * 100)}`));
  validLines.forEach((line) => {
    if (!noisePattern.test(line.name) || !Number.isFinite(line.price) || line.price === 0) return;
    const kind = classifyCharge(line.name);
    if (!kind) return;
    const amount = signedAmount(kind, line.price);
    const key = `${kind}:${Math.round(amount * 100)}`;
    if (seen.has(key)) return;
    seen.add(key);
    charges.push({ name: line.name, kind, amount });
  });

  return {
    items: filteredItems,
    total: Number(data.total) || 0,
    charges,
  };
};
