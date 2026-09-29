import React from 'react';
import { Plus } from 'lucide-react';

// Collapsed state of the optional discount / tip controls. They're used once
// per bill at most, so they sit side by side at the medium control size rather
// than as full-width cards. Unset: "+ Add tip". Set: the value, with the money
// it adds or removes underneath (e.g. "Tip 10%" / "+$5.00"). Tapping opens the
// editor, which then spans the whole row.
export const AdjustmentButton: React.FC<{
  label: string;
  detail?: string;
  isSet: boolean;
  tone: 'indigo' | 'emerald';
  onClick: () => void;
}> = ({ label, detail, isSet, tone, onClick }) => {
  const text = tone === 'indigo' ? 'text-indigo-600' : 'text-emerald-600';
  const hover = tone === 'indigo' ? 'hover:border-indigo-300 hover:bg-indigo-50' : 'hover:border-emerald-300 hover:bg-emerald-50';
  return (
    <button
      onClick={onClick}
      className={`w-full min-h-11 px-3 py-1.5 flex flex-col items-center justify-center rounded-xl border bg-white text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500
        ${isSet ? `border-slate-300 ${text}` : `border-slate-200 border-dashed ${text}`} ${hover}`}
    >
      <span className="flex items-center gap-1.5 leading-tight">
        {!isSet && <Plus className="w-4 h-4 shrink-0" />}
        {label}
      </span>
      {detail && <span className="text-xs font-medium text-slate-500 leading-tight tabular-nums">{detail}</span>}
    </button>
  );
};
