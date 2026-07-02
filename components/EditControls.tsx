import React from 'react';
import { Check, Pencil, X } from 'lucide-react';

// Edit-mode toggle shown above the item list. Because edits apply live, this is
// a mode switch, not a commit action — so both states share one pill shape/size
// and differ only by fill + weight (ghost when off, filled indigo when on),
// rather than morphing into a different-looking "confirm" button.
export const EditToggle: React.FC<{ active: boolean; onClick: () => void; idleLabel?: string }> = ({ active, onClick, idleLabel = 'Edit items' }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 transition-colors active:scale-95
      ${active
        ? 'text-white bg-indigo-600 hover:bg-indigo-700'
        : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
  >
    {active ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
    <span>{active ? 'Done' : idleLabel}</span>
  </button>
);

// Discards in-progress edits and leaves edit mode. Styled as a ghost pill that
// mirrors EditToggle's size so the two sit together cleanly.
export const CancelEditButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95"
  >
    <X className="w-3.5 h-3.5" />
    <span>Cancel</span>
  </button>
);
