import React from 'react';
import { AppState } from '../types';
import { Check, Plus, Trash2, X } from 'lucide-react';

// Tip editing also tracks the unit (percent vs flat amount) being entered.
export interface TipEditState { active: boolean; value: number; mode: AppState['tipMode']; }

// Tip affordance: collapsed it's an "Add Tip" prompt (or a "Tip: 18% / $5.00"
// pill once set); expanded it's a value field with a %/$ unit toggle, plus
// Apply/Cancel and a Clear (only when a tip is already set). Mirrors the
// discount control's shape so the two sit side by side, but adds the unit
// switch since tips are entered either way. The applied value is interpreted by
// computeStats per state.tipMode.
export const TipControl: React.FC<{
  tip: number;
  tipLabel: string;
  editing: TipEditState;
  onOpen: () => void;
  onChangeValue: (value: number) => void;
  onChangeMode: (mode: AppState['tipMode']) => void;
  onApply: () => void;
  onCancel: () => void;
  onClear: () => void;
}> = ({ tip, tipLabel, editing, onOpen, onChangeValue, onChangeMode, onApply, onCancel, onClear }) => {
  const isPercent = editing.mode === 'percent';
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[64px] justify-center">
      {!editing.active && tip === 0 ? (
        <button
          onClick={onOpen}
          className="w-full h-full p-4 flex items-center justify-center gap-2 text-emerald-600 font-semibold hover:bg-emerald-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Tip</span>
        </button>
      ) : !editing.active && tip > 0 ? (
        <button
          onClick={onOpen}
          className="w-full h-full p-4 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
            <Plus className="w-3.5 h-3.5" />
            <span>Tip: {tipLabel}</span>
          </div>
          <span className="text-[10px] text-slate-400">Tap to edit</span>
        </button>
      ) : (
        <div className="p-3 animate-fade-in flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              {/* Prefix $ for amount mode; suffix % for percent mode. */}
              {!isPercent && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>}
              <input
                type="number"
                inputMode="decimal"
                autoFocus
                placeholder="0"
                min="0"
                max={isPercent ? '100' : undefined}
                step={isPercent ? '1' : '0.01'}
                value={editing.value || ''}
                onChange={(e) => onChangeValue(parseFloat(e.target.value) || 0)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onApply(); }
                  else if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                }}
                className={`w-full ${isPercent ? 'pl-3 pr-6' : 'pl-6 pr-3'} py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-bold text-base`}
              />
              {isPercent && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>}
            </div>
            {/* %/$ unit toggle */}
            <div className="flex rounded-lg bg-slate-100 p-0.5 shrink-0" role="group" aria-label="Tip unit">
              <button
                onClick={() => onChangeMode('percent')}
                aria-pressed={isPercent}
                className={`px-2.5 py-1 rounded-md text-sm font-bold transition-colors ${isPercent ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                %
              </button>
              <button
                onClick={() => onChangeMode('amount')}
                aria-pressed={!isPercent}
                className={`px-2.5 py-1 rounded-md text-sm font-bold transition-colors ${!isPercent ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                $
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 justify-end">
            {tip > 0 && (
              <button onClick={onClear} title="Remove tip" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:text-red-500 hover:bg-red-50 transition-colors active:scale-90 mr-auto">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onApply} title="Apply" className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={onCancel} title="Cancel" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
