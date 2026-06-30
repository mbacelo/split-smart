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
      // Rotate leftover-penny recipients by item index so no single person
      // consistently absorbs the rounding across many odd splits.
      const shares = splitCents(cents, validPersonIds.length, index);
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
