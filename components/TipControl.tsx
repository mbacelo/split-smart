import React, { useEffect, useRef, useState } from 'react';
import { AppState } from '../types';
import { Check, Trash2, X } from 'lucide-react';
import { AdjustmentButton } from './AdjustmentButton';
import { blurOnWheel } from '../utils/input';

// Tip editing tracks whether the editor is open and the unit (percent vs flat
// amount) being entered; the typed value itself lives inside TipControl.
export interface TipEditState { active: boolean; mode: AppState['tipMode']; }

// Tip affordance: collapsed it's an AdjustmentButton ("+ Add tip", or the set
// value like "Tip 10%" / "+$5.00"); expanded it's a value field with a %/$
// unit toggle, plus Apply/Cancel and a Clear (only when a tip is already set).
// Mirrors the discount control so the two sit side by side, but adds the unit
// switch since tips are entered either way. The applied value is interpreted
// by computeStats per state.tipMode. The caller widens the editor to the full
// row while it's open.
//
// With no tip set, the editor opens prefilled with `defaultPercent` (a
// suggestion, not applied until the user confirms). The caller omits it when
// the receipt already charges a tip/service, so a second tip is never one tap
// away.
export const TipControl: React.FC<{
  tip: number;
  tipLabel: string;
  // Signed money the tip adds, e.g. "+$5.00" — shown under a percent tip.
  tipAmountLabel?: string;
  initialValue: number;
  editing: TipEditState;
  onOpen: () => void;
  onChangeMode: (mode: AppState['tipMode']) => void;
  onApply: (value: number) => void;
  onCancel: () => void;
  onClear: () => void;
  defaultPercent?: number;
}> = ({ tip, tipLabel, tipAmountLabel, initialValue, editing, onOpen, onChangeMode, onApply, onCancel, onClear, defaultPercent }) => {
  if (!editing.active) {
    return (
      <AdjustmentButton
        isSet={tip > 0}
        label={tip > 0 ? `Tip ${tipLabel}` : 'Add tip'}
        detail={tip > 0 ? tipAmountLabel : undefined}
        tone="emerald"
        onClick={onOpen}
      />
    );
  }
  return (
    <div className="bg-white border border-slate-300 rounded-xl p-2.5">
      <TipEditor
        tip={tip}
        initialValue={initialValue}
        defaultPercent={defaultPercent}
        isPercent={editing.mode === 'percent'}
        onChangeMode={onChangeMode}
        onApply={onApply}
        onCancel={onCancel}
        onClear={onClear}
      />
    </div>
  );
};

// The expanded editor. A separate component so its raw-string input state is
// created fresh each time the editor opens — typing keeps the raw string
// (coercing per keystroke would snap a cleared field to 0) and only Apply
// parses it.
const TipEditor: React.FC<{
  tip: number;
  initialValue: number;
  defaultPercent?: number;
  isPercent: boolean;
  onChangeMode: (mode: AppState['tipMode']) => void;
  onApply: (value: number) => void;
  onCancel: () => void;
  onClear: () => void;
}> = ({ tip, initialValue, defaultPercent, isPercent, onChangeMode, onApply, onCancel, onClear }) => {
  // The default is a percentage, so it only fills the % unit.
  const suggestion = (percent: boolean) => (!initialValue && percent && defaultPercent ? String(defaultPercent) : '');
  const [raw, setRaw] = useState(initialValue ? String(initialValue) : suggestion(isPercent));
  // Until the user types, switching units swaps the suggestion in and out
  // rather than turning "10%" into "$10".
  const typed = useRef(false);
  useEffect(() => {
    if (!typed.current && !initialValue) setRaw(suggestion(isPercent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPercent]);
  const apply = () => onApply(parseFloat(raw) || 0);

  return (
    // One row at the medium control size: value, unit, then remove/apply/cancel.
    <div className="animate-fade-in flex items-center gap-1.5">
      <div className="relative flex-1 min-w-0">
        {/* Prefix $ for amount mode; suffix % for percent mode. */}
        {!isPercent && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>}
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          aria-label={isPercent ? 'Tip percentage' : 'Tip amount'}
          placeholder="0"
          min="0"
          max={isPercent ? '100' : undefined}
          step={isPercent ? '1' : '0.01'}
          value={raw}
          onChange={(e) => { typed.current = true; setRaw(e.target.value); }}
          // Select the prefilled value so typing replaces it.
          onFocus={(e) => e.target.select()}
          onWheel={blurOnWheel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); apply(); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          }}
          className={`w-full h-10 ${isPercent ? 'pl-3 pr-6' : 'pl-6 pr-3'} bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-base`}
        />
        {isPercent && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>}
      </div>
      {/* %/$ unit toggle */}
      <div className="flex h-10 rounded-lg bg-slate-100 p-0.5 shrink-0" role="group" aria-label="Tip unit">
        <button
          onClick={() => onChangeMode('percent')}
          aria-pressed={isPercent}
          className={`w-9 rounded-md text-sm font-bold transition-colors ${isPercent ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          %
        </button>
        <button
          onClick={() => onChangeMode('amount')}
          aria-pressed={!isPercent}
          className={`w-9 rounded-md text-sm font-bold transition-colors ${!isPercent ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          $
        </button>
      </div>
      {tip > 0 && (
        <button onClick={onClear} title="Remove tip" aria-label="Remove tip" className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-slate-400 bg-slate-100 hover:text-red-500 hover:bg-red-50 transition-colors active:scale-90">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      <button onClick={apply} title="Apply" aria-label="Apply tip" className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} title="Cancel" aria-label="Cancel" className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
