import React, { useRef } from 'react';
import { ReceiptItem } from '../types';
import { Trash2 } from 'lucide-react';

export type ItemPatch = Partial<Pick<ReceiptItem, 'name' | 'quantity' | 'originalPrice'>>;

// A single editable item row: quantity, name, price, delete. Edits are applied
// live via onUpdate; there is no per-row apply/cancel.
export const ItemEditRow: React.FC<{
  item: ReceiptItem;
  onUpdate: (id: string, patch: ItemPatch) => void;
  onDelete: (id: string) => void;
  nameInputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  // Enter in the price field commits the row and starts a fresh one — the fast
  // path for typing in a list of items by hand.
  onAddRow: () => void;
}> = ({ item, onUpdate, onDelete, nameInputRefs, onAddRow }) => {
  const isNameEmpty = item.name.trim().length === 0;
  const priceInputRef = useRef<HTMLInputElement>(null);
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  return (
    <div className="flex items-center gap-2 group">
      {/* Quantity */}
      <input
        type="number"
        inputMode="numeric"
        min="1"
        step="1"
        aria-label="Quantity"
        value={item.quantity || ''}
        onChange={(e) => onUpdate(item.id, { quantity: parseInt(e.target.value, 10) || 1 })}
        onKeyDown={blurOnEnter}
        className="w-12 shrink-0 text-center bg-slate-50 border border-slate-300 rounded-lg py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-slate-700 shadow-sm"
      />
      {/* Name — Enter hops to the price field so a row can be filled in without
          reaching for the mouse. */}
      <input
        ref={(el) => {
          if (el) nameInputRefs.current.set(item.id, el);
          else nameInputRefs.current.delete(item.id);
        }}
        type="text"
        aria-label="Item name"
        value={item.name}
        onChange={(e) => onUpdate(item.id, { name: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); priceInputRef.current?.focus(); }
        }}
        placeholder="Item name"
        className={`flex-1 min-w-0 bg-slate-50 border rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 font-medium transition-all
          ${isNameEmpty ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 shadow-sm'}`}
      />
      {/* Price — Enter commits and opens the next row. */}
      <div className="relative w-24 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
        <input
          ref={priceInputRef}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          aria-label="Price"
          placeholder="0.00"
          value={item.originalPrice || ''}
          onChange={(e) => onUpdate(item.id, { originalPrice: parseFloat(e.target.value) || 0 })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); onAddRow(); }
          }}
          className="w-full pl-5 pr-2 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-slate-900 shadow-sm"
        />
      </div>
      {/* Delete */}
      <button
        onClick={() => onDelete(item.id)}
        className="p-2 shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shadow-sm bg-white border border-slate-100"
        title="Remove item"
        aria-label="Remove item"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
};
