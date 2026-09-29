import { describe, it, expect } from 'vitest';
import { computeStats, splitCentsWeighted } from './stats';
import { AppState, ReceiptItem } from '../types';

// Minimal state factory: two people, no receipt image, everything else
// overridable per test.
const makeState = (overrides: Partial<AppState> = {}): AppState => ({
  step: 'splitting',
  receiptImage: null,
  items: [],
  total: 0,
  charges: [],
  discount: 0,
  tip: 0,
  tipMode: 'percent',
  assignments: {},
  unitWeights: {},
  people: [
    { id: 'a', name: 'Ana', color: 'blue' },
    { id: 'b', name: 'Ben', color: 'green' },
  ],
  error: null,
  manualEntry: false,
  manualTotalOverride: null,
  ...overrides,
});

const item = (id: string, price: number, quantity = 1): ReceiptItem => ({
  id,
  name: `Item ${id}`,
  quantity,
  originalPrice: price,
});

describe('splitCentsWeighted', () => {
  it('splits proportionally and sums back exactly', () => {
    expect(splitCentsWeighted(500, [3, 2])).toEqual([300, 200]);
  });

  it('hands leftover pennies to the largest fractional remainders', () => {
    const shares = splitCentsWeighted(100, [1, 1, 1]);
    expect(shares.reduce((a, s) => a + s, 0)).toBe(100);
    expect(shares.filter((s) => s === 34)).toHaveLength(1);
    expect(shares.filter((s) => s === 33)).toHaveLength(2);
  });

  it('returns all zeros when total weight is zero', () => {
    expect(splitCentsWeighted(500, [0, 0])).toEqual([0, 0]);
  });

  it('always sums back to the input cents (drift check)', () => {
    for (const [cents, weights] of [
      [1001, [3, 2, 2]],
      [7, [5, 1, 1, 1]],
      [999, [1, 2]],
    ] as [number, number[]][]) {
      const shares = splitCentsWeighted(cents, weights);
      expect(shares.reduce((a, s) => a + s, 0)).toBe(cents);
    }
  });
});

describe('computeStats — scanned receipt', () => {
  it('scales items so shares absorb tax/tip and sum to the receipt total', () => {
    // Items sum to 90, receipt total is 100 → factor 100/90.
    const state = makeState({
      items: [item('i1', 60), item('i2', 30)],
      total: 100,
      assignments: { i1: ['a'], i2: ['b'] },
    });
    const stats = computeStats(state);
    expect(stats.adjustmentFactor).toBeCloseTo(100 / 90);
    expect(stats.effectiveTotal).toBe(100);
    // Everything assigned → per-person totals sum to the receipt total (±1¢
    // from rounding each line to cents).
    const sum = stats.personTotals.a + stats.personTotals.b;
    expect(sum).toBeCloseTo(100, 1);
    expect(stats.unassignedTotal).toBeCloseTo(100 - sum, 10);
  });

  it('splits an odd-cent line without losing or minting a penny', () => {
    const state = makeState({
      items: [item('i1', 10.01)],
      total: 10.01,
      assignments: { i1: ['a', 'b'] },
    });
    const { personTotals } = computeStats(state);
    expect(personTotals.a + personTotals.b).toBeCloseTo(10.01);
    expect([personTotals.a, personTotals.b].sort()).toEqual([5.0, 5.01]);
  });

  it('rotates the leftover penny across items so one person is not always overcharged', () => {
    // Two identical odd-cent items split by the same pair: the extra penny
    // must land on a different person per item (rotation by item index).
    const state = makeState({
      items: [item('i1', 10.01), item('i2', 10.01)],
      total: 20.02,
      assignments: { i1: ['a', 'b'], i2: ['a', 'b'] },
    });
    const { personTotals } = computeStats(state);
    expect(personTotals.a).toBeCloseTo(10.01);
    expect(personTotals.b).toBeCloseTo(10.01);
  });

  it('counts unassigned items and money', () => {
    const state = makeState({
      items: [item('i1', 40), item('i2', 60)],
      total: 100,
      assignments: { i1: ['a'] },
    });
    const stats = computeStats(state);
    expect(stats.unassignedItemCount).toBe(1);
    expect(stats.unassignedTotal).toBeCloseTo(60);
  });

  it('ignores assignments to people who no longer exist', () => {
    const state = makeState({
      items: [item('i1', 10)],
      total: 10,
      assignments: { i1: ['ghost'] },
    });
    const stats = computeStats(state);
    expect(stats.unassignedItemCount).toBe(1);
    expect(stats.unassignedTotal).toBeCloseTo(10);
  });
});

describe('computeStats — discount and tip', () => {
  it('applies a percent discount then a percent tip on the discounted subtotal', () => {
    // 100 − 10% = 90; +10% tip of 90 = 9 → 99.
    const state = makeState({
      items: [item('i1', 100)],
      total: 100,
      discount: 10,
      tip: 10,
      tipMode: 'percent',
      assignments: { i1: ['a'] },
    });
    const stats = computeStats(state);
    expect(stats.discountAmount).toBeCloseTo(10);
    expect(stats.tipAmount).toBeCloseTo(9);
    expect(stats.effectiveTotal).toBeCloseTo(99);
    expect(stats.personTotals.a).toBeCloseTo(99);
  });

  it('adds a flat tip as-is', () => {
    const state = makeState({
      items: [item('i1', 100)],
      total: 100,
      tip: 5,
      tipMode: 'amount',
      assignments: { i1: ['a'] },
    });
    expect(computeStats(state).effectiveTotal).toBeCloseTo(105);
  });

  it('clamps a negative flat tip to zero', () => {
    const state = makeState({ items: [item('i1', 100)], total: 100, tip: -5, tipMode: 'amount' });
    const stats = computeStats(state);
    expect(stats.tipAmount).toBe(0);
    expect(stats.effectiveTotal).toBeCloseTo(100);
  });
});

describe('computeStats — manual entry', () => {
  it('tracks the items sum when no override is pinned', () => {
    const state = makeState({
      manualEntry: true,
      items: [item('i1', 12.5), item('i2', 7.5)],
      total: 0, // ignored in manual mode
    });
    const stats = computeStats(state);
    expect(stats.effectiveTotal).toBeCloseTo(20);
    expect(stats.adjustmentFactor).toBe(1);
  });

  it('scales items to a pinned override like a scanned total', () => {
    const state = makeState({
      manualEntry: true,
      manualTotalOverride: 22,
      items: [item('i1', 10), item('i2', 10)],
      assignments: { i1: ['a'], i2: ['b'] },
    });
    const stats = computeStats(state);
    expect(stats.adjustmentFactor).toBeCloseTo(1.1);
    expect(stats.personTotals.a).toBeCloseTo(11);
    expect(stats.personTotals.b).toBeCloseTo(11);
  });

  it('ignores the override when manualEntry is false', () => {
    const state = makeState({
      manualEntry: false,
      manualTotalOverride: 999,
      items: [item('i1', 10)],
      total: 10,
    });
    expect(computeStats(state).effectiveTotal).toBeCloseTo(10);
  });
});

describe('computeStats — per-unit weights', () => {
  it('splits a line in proportion to explicit weights', () => {
    // 5 beers for $10: A drank 3, B drank 2 → $6 / $4.
    const state = makeState({
      items: [item('i1', 10, 5)],
      total: 10,
      assignments: { i1: ['a', 'b'] },
      unitWeights: { i1: { a: 3, b: 2 } },
    });
    const { personTotals } = computeStats(state);
    expect(personTotals.a).toBeCloseTo(6);
    expect(personTotals.b).toBeCloseTo(4);
  });

  it('gives assigned people without an explicit weight an implicit weight of 1', () => {
    const state = makeState({
      items: [item('i1', 9, 3)],
      total: 9,
      assignments: { i1: ['a', 'b'] },
      unitWeights: { i1: { a: 2 } }, // b implicitly 1 → 2:1 split
    });
    const { personTotals } = computeStats(state);
    expect(personTotals.a).toBeCloseTo(6);
    expect(personTotals.b).toBeCloseTo(3);
  });

  it('treats uniform weights identically to a plain equal split', () => {
    const base = makeState({
      items: [item('i1', 10.01, 2)],
      total: 10.01,
      assignments: { i1: ['a', 'b'] },
    });
    const weighted = { ...base, unitWeights: { i1: { a: 1, b: 1 } } };
    expect(computeStats(weighted).personTotals).toEqual(computeStats(base).personTotals);
  });
});

describe('computeStats receipt breakdown', () => {
  it('explains the gap between items and a scanned total with its charges', () => {
    const stats = computeStats(makeState({
      items: [item('x', 30), item('y', 20)],
      total: 61.5,
      charges: [
        { name: 'Tax', kind: 'tax', amount: 4.5 },
        { name: 'Service', kind: 'tip', amount: 7 },
      ],
    }));
    expect(stats.chargesTotal).toBe(11.5);
    expect(stats.unexplainedDifference).toBe(0);
    expect(stats.receiptTipTotal).toBe(7);
  });

  it('reports the part of the gap no charge covers, negative when items exceed the total', () => {
    const over = computeStats(makeState({ items: [item('x', 30)], total: 25, charges: [] }));
    expect(over.unexplainedDifference).toBe(-5);
    const under = computeStats(makeState({
      items: [item('x', 30)],
      total: 36.1,
      charges: [{ name: 'VAT', kind: 'tax', amount: 3.3 }],
    }));
    // Cents math: no float noise in the leftover.
    expect(under.unexplainedDifference).toBe(2.8);
  });

  it('nets a discount charge against the other charges', () => {
    const stats = computeStats(makeState({
      items: [item('x', 40)],
      total: 38,
      charges: [{ name: 'Tax', kind: 'tax', amount: 2 }, { name: 'Promo', kind: 'discount', amount: -4 }],
    }));
    expect(stats.chargesTotal).toBe(-2);
    expect(stats.unexplainedDifference).toBe(0);
    expect(stats.receiptTipTotal).toBe(0);
  });

  it('ignores charges in manual entry, where the gap is the pinned-total adjustment', () => {
    const stats = computeStats(makeState({
      manualEntry: true,
      manualTotalOverride: 55,
      items: [item('x', 50)],
      charges: [{ name: 'Service', kind: 'tip', amount: 5 }],
    }));
    expect(stats.chargesTotal).toBe(0);
    expect(stats.unexplainedDifference).toBe(5);
    expect(stats.receiptTipTotal).toBe(0);
  });
});
