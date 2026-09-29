import { describe, it, expect } from 'vitest';
import { toProcessedReceipt } from './postProcess.js';
import { ReceiptAnalysis } from './types.js';

const analysis = (
  items: ReceiptAnalysis['items'],
  total = 100,
  charges: ReceiptAnalysis['charges'] = [],
): ReceiptAnalysis => ({
  items,
  charges,
  total,
});

describe('toProcessedReceipt', () => {
  it('filters out tax/tip/total/payment noise lines', () => {
    const result = toProcessedReceipt(
      analysis([
        { name: 'Burger', quantity: 1, price: 12 },
        { name: 'Sales Tax', quantity: 1, price: 1.2 },
        { name: 'Tip', quantity: 1, price: 2 },
        { name: 'Subtotal', quantity: 1, price: 12 },
        { name: 'VISA ****1234', quantity: 1, price: 15.2 },
        { name: 'Service Charge', quantity: 1, price: 1 },
      ]),
    );
    expect(result.items.map((i) => i.name)).toEqual(['Burger']);
  });

  it('keeps tax/tip/fee lines found among the items as charges, dropping subtotal and payment lines', () => {
    const result = toProcessedReceipt(
      analysis([
        { name: 'Burger', quantity: 1, price: 12 },
        { name: 'Sales Tax', quantity: 1, price: 1.2 },
        { name: 'Service Charge', quantity: 1, price: 1 },
        { name: 'Card surcharge', quantity: 1, price: 0.5 },
        { name: 'Discount', quantity: 1, price: 2 },
        { name: 'Subtotal', quantity: 1, price: 12 },
        { name: 'VISA ****1234', quantity: 1, price: 12.7 },
      ]),
    );
    expect(result.charges).toEqual([
      { name: 'Sales Tax', kind: 'tax', amount: 1.2 },
      { name: 'Service Charge', kind: 'tip', amount: 1 },
      { name: 'Card surcharge', kind: 'fee', amount: 0.5 },
      { name: 'Discount', kind: 'discount', amount: -2 },
    ]);
  });

  it('passes through model charges, signing discounts negative and dropping invalid ones', () => {
    const result = toProcessedReceipt(
      analysis([], 20, [
        { name: 'VAT 22%', kind: 'tax', amount: 3.3 },
        { name: 'Happy hour', kind: 'discount', amount: 4 },
        { name: 'Mystery', kind: 'other', amount: 1 },
        { name: 'Zero tip', kind: 'tip', amount: 0 },
        { name: '', kind: 'fee', amount: 1 },
      ]),
    );
    expect(result.charges).toEqual([
      { name: 'VAT 22%', kind: 'tax', amount: 3.3 },
      { name: 'Happy hour', kind: 'discount', amount: -4 },
    ]);
  });

  it('does not double-count a charge the model listed both as an item and a charge', () => {
    const result = toProcessedReceipt(
      analysis([{ name: 'Tax', quantity: 1, price: 1.5 }], 20, [{ name: 'Sales tax', kind: 'tax', amount: 1.5 }]),
    );
    expect(result.charges).toEqual([{ name: 'Sales tax', kind: 'tax', amount: 1.5 }]);
  });

  it('tolerates a missing charges array', () => {
    expect(
      toProcessedReceipt({ items: [], total: 10 } as unknown as ReceiptAnalysis).charges,
    ).toEqual([]);
  });

  it('matches noise keywords as whole words only, keeping items that merely contain them', () => {
    const result = toProcessedReceipt(
      analysis([
        { name: 'Cashew chicken', quantity: 1, price: 14 }, // contains "cash"
        { name: 'Multipack soda', quantity: 1, price: 6 }, // contains "tip"
        { name: 'Cash', quantity: 1, price: 20 }, // exact word → noise
      ]),
    );
    expect(result.items.map((i) => i.name)).toEqual(['Cashew chicken', 'Multipack soda']);
  });

  it('drops items with a missing name or non-numeric price', () => {
    const result = toProcessedReceipt(
      analysis([
        { name: '', quantity: 1, price: 5 },
        { name: 'Fries', quantity: 1, price: 'oops' as unknown as number },
        { name: 'Cola', quantity: 1, price: 3 },
      ]),
    );
    expect(result.items.map((i) => i.name)).toEqual(['Cola']);
  });

  it('normalizes quantity: rounds fractions, defaults invalid values to 1', () => {
    const result = toProcessedReceipt(
      analysis([
        { name: 'Beers', quantity: 2.6, price: 15 },
        { name: 'Wings', quantity: 0, price: 9 },
        { name: 'Nachos', quantity: -3, price: 8 },
      ]),
    );
    expect(result.items.map((i) => i.quantity)).toEqual([3, 1, 1]);
  });

  it('stamps every item with a unique id', () => {
    const result = toProcessedReceipt(
      analysis([
        { name: 'A', quantity: 1, price: 1 },
        { name: 'B', quantity: 1, price: 2 },
      ]),
    );
    const ids = result.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toBeTruthy());
  });

  it('coerces the total to a number, falling back to 0', () => {
    expect(toProcessedReceipt(analysis([], 42.5)).total).toBe(42.5);
    expect(toProcessedReceipt({ items: [], charges: [], total: NaN }).total).toBe(0);
  });

  it('tolerates a missing items array', () => {
    expect(
      toProcessedReceipt({ items: undefined as unknown as ReceiptAnalysis['items'], charges: [], total: 10 }).items,
    ).toEqual([]);
  });
});
