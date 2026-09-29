import React, { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { blurOnWheel } from '../utils/input';

// Shared inline editor for a single money/percent figure with Apply/Cancel and
// an optional Reset. Used by the total editors (mobile + desktop) and the
// discount editor so their input behavior can't drift apart. The typed value is
// kept as a raw string locally — coercing per keystroke would snap a cleared
// field to 0 mid-edit — and only parsed on Apply.
export const InlineAmountEditor: React.FC<{
  initialValue: number;
  onApply: (value: number) => void;
  onCancel: () => void;
  // When provided, shows a RotateCcw button (e.g. "back to items total").
  onReset?: () => void;
  resetTitle?: string;
  label?: string;
  prefix?: string; // e.g. '$'
  suffix?: string; // e.g. '%'
  step?: string;
  min?: number;
  max?: number;
  placeholder?: string;
  // Width of the input itself, e.g. 'w-24' or 'flex-1'.
  widthClass?: string;
  // Tighter paddings + right-aligned text for the mobile info bar.
  dense?: boolean;
}> = ({
  initialValue,
  onApply,
  onCancel,
  onReset,
  resetTitle,
  label,
  prefix,
  suffix,
  step = '0.01',
  min,
  max,
  placeholder = '0.00',
  widthClass = 'w-28',
  dense = false,
}) => {
  const [raw, setRaw] = useState(initialValue ? String(initialValue) : '');
  const apply = () => onApply(parseFloat(raw) || 0);
  // Square buttons at the medium control size (dense: a notch smaller, for the
  // mobile info bar), icons centered.
  const btnPad = `${dense ? 'w-9 h-9' : 'w-10 h-10'} shrink-0 flex items-center justify-center`;

  return (
    <div className={`flex items-center ${dense ? 'gap-1' : 'gap-1.5'} animate-fade-in`}>
      {label && <span className="text-sm text-slate-500 shrink-0">{label}</span>}
      <div className={`relative ${widthClass}`}>
        {prefix && (
          <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold ${dense ? 'text-xs' : 'text-sm'}`}>
            {prefix}
          </span>
        )}
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          step={step}
          min={min}
          max={max}
          placeholder={placeholder}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onWheel={blurOnWheel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); apply(); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
          }}
          className={`w-full ${prefix ? (dense ? 'pl-5' : 'pl-6') : 'pl-3'} ${suffix ? 'pr-6' : 'pr-2'} ${dense ? 'h-9 text-base text-right' : 'h-10 text-sm'} bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold`}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
            {suffix}
          </span>
        )}
      </div>
      {onReset && (
        <button onClick={onReset} title={resetTitle} className={`${btnPad} rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors active:scale-90`}>
          <RotateCcw className="w-4 h-4" />
        </button>
      )}
      <button onClick={apply} title="Apply" className={`${btnPad} rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90`}>
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} title="Cancel" className={`${btnPad} rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90`}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
