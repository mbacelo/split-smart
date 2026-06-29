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
  unassignedTotal: number;
  unassignedItemCount: number;
  itemsTotalSum: number;
  adjustmentFactor: number;
}

const toCents = (amount: number): number => Math.round(amount * 100);

// Split `cents` evenly across `n` people, handing the leftover pennies to the
// first recipients so the parts sum back to `cents` exactly.
const splitCents = (cents: number, n: number): number[] => {
  if (n <= 0) return [];
  const base = Math.floor(cents / n);
  let remainder = cents - base * n;
  return Array.from({ length: n }, () => {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    return base + extra;
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
  const effectiveTotal = Math.max(0, baseTotal - discountAmount);
  const adjustmentFactor = itemsSum > 0 ? effectiveTotal / itemsSum : 1;

  const totalCents: Record<string, number> = {};
  state.people.forEach((p) => { totalCents[p.id] = 0; });

  let assignedCents = 0;
  let unassignedItemCount = 0;

  const itemAdjustments: ItemAdjustment[] = state.items.map((item) => {
    const adjustedPrice = item.originalPrice * adjustmentFactor;
    const validPersonIds = (state.assignments[item.id] || []).filter(
      (pid) => totalCents[pid] !== undefined,
    );

    if (validPersonIds.length > 0) {
      const cents = toCents(adjustedPrice);
      const shares = splitCents(cents, validPersonIds.length);
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
    unassignedTotal: effectiveTotal - assignedCents / 100,
    unassignedItemCount,
    itemsTotalSum: itemsSum,
    adjustmentFactor,
  };
};
