import React from 'react';
import { AppState } from '../types';
import { SplitStats } from '../state/stats';
import { formatCurrency } from '../utils/currency';
import { AlertCircle, Pencil, Receipt } from 'lucide-react';

// Below this, a gap is receipt rounding rather than a misread line.
const WARN_THRESHOLD = 0.05;

const signed = (amount: number) => `${amount < 0 ? '−' : '+'}${formatCurrency(Math.abs(amount))}`;

const Row: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = 'text-slate-600' }) => (
  <div className={`flex justify-between gap-3 ${className}`}>
    <span className="min-w-0 truncate">{label}</span>
    <span className="shrink-0 tabular-nums">{value}</span>
  </div>
);

// Explains why item prices are adjusted: how the items' sum becomes the final
// total, line by line (receipt charges, any gap nothing explains, discount,
// tip). Every figure comes from computeStats; this only lays them out. A gap
// that looks like a misread — items over the receipt total, or money no item
// or charge accounts for — gets a warning with a shortcut to check the photo.
export const TotalBreakdown: React.FC<{
  state: AppState;
  stats: SplitStats;
  onCheckReceipt?: () => void;
  onEditItems: () => void;
}> = ({ state, stats, onCheckReceipt, onEditItems }) => {
  const { itemsTotalSum, unexplainedDifference: gap, discountAmount, tipAmount, effectiveTotal } = stats;
  const charges = state.manualEntry ? [] : state.charges;
  const hasGap = Math.abs(gap) >= 0.01;

  // With no charges found, a positive gap is almost always tax/fees the
  // receipt doesn't itemize. Alongside found charges, it's unaccounted for.
  const gapLabel = state.manualEntry
    ? 'Adjustment to your total'
    : gap < 0
      ? 'Difference'
      : charges.length > 0 ? 'Not matched to any line' : 'Tax & fees (not itemized)';

  const warning = state.manualEntry ? null
    : gap <= -WARN_THRESHOLD
      ? `Items add up to ${formatCurrency(-gap)} more than the receipt total. A price may have been misread.`
      : gap >= WARN_THRESHOLD && charges.length > 0
        ? `${formatCurrency(gap)} on the receipt isn't matched to any item or charge. An item may be missing.`
        : null;

  return (
    <div className="mx-4 lg:mx-0 bg-white border border-slate-200 rounded-xl shadow-sm p-4 text-sm space-y-1.5">
      <h4 className="font-semibold text-slate-700 mb-2">How the total adds up</h4>
      <Row label="Items" value={formatCurrency(itemsTotalSum)} />
      {charges.map((c, i) => (
        <Row key={i} label={c.name} value={signed(c.amount)} />
      ))}
      {hasGap && (
        <Row label={gapLabel} value={signed(gap)} className={warning ? 'text-amber-700 font-medium' : 'text-slate-600'} />
      )}
      {discountAmount > 0 && (
        <Row label={`Discount (${state.discount}%)`} value={signed(-discountAmount)} className="text-red-500" />
      )}
      {tipAmount > 0 && (
        <Row label={`Tip${state.tipMode === 'percent' ? ` (${state.tip}%)` : ''}`} value={signed(tipAmount)} className="text-emerald-600" />
      )}
      <Row label="Final total" value={formatCurrency(effectiveTotal)} className="text-slate-900 font-bold border-t border-slate-100 pt-2 mt-1" />
      <p className="text-xs text-slate-400 pt-1">
        {effectiveTotal >= itemsTotalSum
          ? 'Extras are shared in proportion to each item’s price.'
          : 'The difference comes off each item in proportion to its price.'}
      </p>

      {warning && (
        <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800">
          <div className="flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs leading-snug">{warning}</p>
          </div>
          <div className="flex gap-2 mt-2 ml-6">
            {onCheckReceipt && (
              <button
                onClick={onCheckReceipt}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                Check receipt
              </button>
            )}
            <button
              onClick={onEditItems}
              className="inline-flex items-center gap-1.5 text-xs font-bold bg-white border border-amber-200 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit items
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
