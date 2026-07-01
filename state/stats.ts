// Derived totals for the split flow.
//
// Money is computed in integer cents and each split is distributed with a
// largest-remainder pass so per-person shares always sum back to the line
// total exactly — no floating-point drift where everyone's shares fail to add
// up to the receipt total by a cent.

import { AppState, ReceiptItem } from '../types';

export interface ItemAdjustment extends ReceiptItem {
  adjustedPrice: number;
}

export interface SplitStats {
  personTotals: Record<string, number>;
  itemAdjustments: ItemAdjustment[];
  effectiveTotal: number;
  discountAmount: number;
  // The tip money added on top of the post-discount subtotal (0 when no tip).
  tipAmount: number;
  unassignedTotal: number;
  unassignedItemCount: number;
  itemsTotalSum: number;
  adjustmentFactor: number;
}

const toCents = (amount: number): number => Math.round(amount * 100);

// Split `cents` evenly across `n` people, handing the leftover pennies out one
// each so the parts sum back to `cents` exactly. `offset` rotates which
// recipient gets the first leftover penny: without it the leftovers always land
// on the people at the front of the list, so the same person systematically
// overpays by a cent across many odd-split items. Rotating by the item's index
// spreads that bias evenly while staying deterministic (no flicker on re-render).
const splitCents = (cents: number, n: number, offset = 0): number[] => {
  if (n <= 0) return [];
  const base = Math.floor(cents / n);
  const remainder = cents - base * n;
  const start = ((offset % n) + n) % n;
  return Array.from({ length: n }, (_, i) => {
    // The `remainder` people starting at `start` (wrapping) each get one extra.
    const pos = (i - start + n) % n;
    return base + (pos < remainder ? 1 : 0);
  });
};

// Split `cents` across people in proportion to `weights`, handing leftover
// pennies to the largest fractional remainders (tie-broken by index) so the
// parts sum back to `cents` exactly — the weighted analogue of splitCents.
// Used for per-unit consumption (e.g. 3 of 5 beers → a 3:2 split of the line).
export const splitCentsWeighted = (cents: number, weights: number[]): number[] => {
  const totalWeight = weights.reduce((a, w) => a + w, 0);
  if (totalWeight <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (cents * w) / totalWeight);
  const floors = exact.map(Math.floor);
  const leftover = cents - floors.reduce((a, f) => a + f, 0);
  // Hand the leftover pennies to the largest fractional parts, tie-broken by index.
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const shares = [...floors];
  for (let k = 0; k < leftover; k++) shares[order[k].i]++;
  return shares;
};

export const computeStats = (state: AppState): SplitStats => {
  const itemsSum = state.items.reduce((sum, item) => sum + item.originalPrice, 0);
  // In manual entry there is no scanned receipt total, so the base total tracks
  // the sum of the items the user typed — unless they pinned an explicit
  // override (manualTotalOverride), in which case items scale to that figure
  // exactly as they do for a scanned receipt total. Scanned receipts always use
  // their own total so items can be scaled to absorb tax/tip.
  const baseTotal = state.manualEntry
    ? (state.manualTotalOverride ?? itemsSum)
    : state.total;
  const discountAmount = (baseTotal * state.discount) / 100;
  const postDiscount = Math.max(0, baseTotal - discountAmount);
  // Tip is added on top of the post-discount subtotal. A percentage tip is taken
  // of that subtotal; a flat tip is the amount as-is. Either way it's clamped
  // non-negative so a stray negative value can't shrink the total.
  const tipAmount = Math.max(
    0,
    state.tipMode === 'amount' ? state.tip : (postDiscount * state.tip) / 100,
  );
  const effectiveTotal = postDiscount + tipAmount;
  const adjustmentFactor = itemsSum > 0 ? effectiveTotal / itemsSum : 1;

  const totalCents: Record<string, number> = {};
  state.people.forEach((p) => { totalCents[p.id] = 0; });

  let assignedCents = 0;
  let unassignedItemCount = 0;

  const itemAdjustments: ItemAdjustment[] = state.items.map((item, index) => {
    const adjustedPrice = item.originalPrice * adjustmentFactor;
    const validPersonIds = (state.assignments[item.id] || []).filter(
      (pid) => totalCents[pid] !== undefined,
    );

    if (validPersonIds.length > 0) {
      const cents = toCents(adjustedPrice);
      // Per-unit weights (e.g. 3 of 5 beers). Absent people get an implicit
      // weight of 1 (equal share), so an item with no weights — or uniform
      // weights — is identical to a plain equal split.
      const itemWeights = state.unitWeights[item.id];
      const weights = validPersonIds.map((pid) => itemWeights?.[pid] ?? 1);
      const allEqual = weights.every((w) => w === weights[0]);
      // Common case (equal weights): keep the index-rotated even split so the
      // leftover-penny bias stays spread and behavior is byte-identical to before.
      const shares = allEqual
        ? splitCents(cents, validPersonIds.length, index)
        : splitCentsWeighted(cents, weights);
      validPersonIds.forEach((pid, i) => { totalCents[pid] += shares[i]; });
      assignedCents += cents;
    } else {
      unassignedItemCount += 1;
    }

    return { ...item, adjustedPrice };
  });

  const personTotals: Record<string, number> = {};
  Object.entries(totalCents).forEach(([pid, cents]) => { personTotals[pid] = cents / 100; });

  return {
    personTotals,
    itemAdjustments,
    effectiveTotal,
    discountAmount,
    tipAmount,
    unassignedTotal: effectiveTotal - assignedCents / 100,
    unassignedItemCount,
    itemsTotalSum: itemsSum,
    adjustmentFactor,
  };
};
