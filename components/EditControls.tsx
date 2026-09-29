import React from 'react';
import { Check, Pencil, X } from 'lucide-react';

// Edit-mode toggle shown above the item list. Because edits apply live, this is
// a mode switch, not a commit action — so both states share one pill shape/size
// and differ only by fill + weight (ghost when off, filled indigo when on),
// rather than morphing into a different-looking "confirm" button.
//
// Sized as the app's medium control (40px tall, 14px text): Done is the only
// way out of edit mode, so it needs a comfortable thumb target.
export const EditToggle: React.FC<{ active: boolean; onClick: () => void; idleLabel?: string }> = ({ active, onClick, idleLabel = 'Edit items' }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`flex items-center gap-1.5 min-h-10 text-sm font-semibold rounded-full px-3.5 transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500
      ${active
        ? 'text-white bg-indigo-600 hover:bg-indigo-700'
        : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
  >
    {active ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
    <span>{active ? 'Done' : idleLabel}</span>
  </button>
);

// Discards in-progress edits and leaves edit mode. Styled as a ghost pill that
// mirrors EditToggle's size so the two sit together cleanly.
export const CancelEditButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 min-h-10 text-sm font-semibold rounded-full px-3.5 text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
  >
    <X className="w-4 h-4" />
    <span>Cancel</span>
  </button>
);
