import React from 'react';
import { Person } from '../types';
import { ItemAdjustment, splitCentsWeighted, toCents, fromCents } from '../state/stats';
import { blurOnWheel } from '../utils/input';
import { formatCurrency } from '../utils/currency';
import { getColorClasses } from './personColors';
import { PersonAvatar } from './PersonAvatar';
import { Minus, Plus, RotateCcw, Scale } from 'lucide-react';

// Inline per-unit allocation panel for a multi-quantity item. Lists each person
// with a small stepper for how many units they consumed, and a live preview of
// the resulting share. Weights are relative — the line total divides in
// proportion — so they need not sum to the quantity. A person left at 0 is
// simply not on the item. "Reset to equal" drops all weights back to a plain
// even split. Preview uses the same splitCentsWeighted as computeStats so the
// numbers shown match the totals exactly.
export const UnitAllocationPanel: React.FC<{
  item: ItemAdjustment;
  people: Person[];
  assignedPersonIds: string[];
  itemWeights: { [personId: string]: number } | undefined;
  hasWeights: boolean;
  onSetUnitWeight: (itemId: string, personId: string, weight: number) => void;
  onClearUnitWeights: (itemId: string) => void;
}> = ({ item, people, assignedPersonIds, itemWeights, hasWeights, onSetUnitWeight, onClearUnitWeights }) => {
  // Effective weight shown per person: explicit weight if set, else 1 for an
  // assigned person (their equal share), else 0 (not on the item).
  const assigned = new Set(assignedPersonIds);
  const weightFor = (pid: string) => itemWeights?.[pid] ?? (assigned.has(pid) ? 1 : 0);

  // Live preview: split the item's adjusted cents by the current weights across
  // the people who have a positive weight, mirroring computeStats.
  const participants = people.filter((p) => weightFor(p.id) > 0);
  const cents = toCents(item.adjustedPrice);
  const shareCents = splitCentsWeighted(cents, participants.map((p) => weightFor(p.id)));
  const shareByPid: Record<string, number> = {};
  participants.forEach((p, i) => { shareByPid[p.id] = shareCents[i]; });

  return (
    <div className="px-4 pb-4 pt-1 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 uppercase tracking-wide">
            <Scale className="w-3.5 h-3.5" />
            Units consumed
          </div>
          {hasWeights && (
            <button
              onClick={() => onClearUnitWeights(item.id)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors"
              title="Split this item equally again"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to equal
            </button>
          )}
        </div>
        <div className="space-y-2">
          {people.map((person) => {
            const c = getColorClasses(person.color);
            const w = weightFor(person.id);
            const share = shareByPid[person.id] ?? 0;
            return (
              <div key={person.id} className="flex items-center gap-2">
                <PersonAvatar
                  photo={person.photo}
                  className={`w-6 h-6 shrink-0 rounded-full ${c.bgSoft} flex items-center justify-center ${c.text} font-bold text-[11px] border ${c.borderSoft}`}
                >
                  {person.name.trim().charAt(0).toUpperCase() || '?'}
                </PersonAvatar>
                <span className="flex-1 min-w-0 truncate text-sm font-medium text-slate-700">{person.name}</span>
                <span className={`text-xs font-semibold w-16 text-right ${w > 0 ? 'text-slate-500' : 'text-slate-300'}`}>
                  {w > 0 ? formatCurrency(fromCents(share)) : '—'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onSetUnitWeight(item.id, person.id, w - 1)}
                    disabled={w <= 0}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-90"
                    aria-label={`Fewer units for ${person.name}`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={w || ''}
                    placeholder="0"
                    onChange={(e) => onSetUnitWeight(item.id, person.id, parseInt(e.target.value, 10) || 0)}
                    onWheel={blurOnWheel}
                    aria-label={`Units for ${person.name}`}
                    className="w-10 text-center bg-white border border-slate-200 rounded-lg py-1 font-bold text-slate-700 text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                  />
                  <button
                    onClick={() => onSetUnitWeight(item.id, person.id, w + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors active:scale-90"
                    aria-label={`More units for ${person.name}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-400 leading-snug">
          Units split this {item.quantity}× item proportionally. They don't have to add up to {item.quantity}.
        </p>
      </div>
    </div>
  );
};
