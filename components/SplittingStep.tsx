import React, { useRef, useState } from 'react';
import { AppState, Person, ReceiptItem } from '../types';
import { SplitStats } from '../state/stats';
import { formatCurrency } from '../utils/currency';
import { getColorClasses } from './personColors';
import { PersonCard } from './PersonCard';
import { CheckIcon, PlusIcon, XIcon, TrashIcon, SettingsIcon as EditIcon, ShareIcon, UsersIcon, ReceiptIcon } from './Icons';

interface EditState { active: boolean; value: number; }

type ItemPatch = Partial<Pick<ReceiptItem, 'name' | 'quantity' | 'originalPrice'>>;

interface SplittingStepProps {
  state: AppState;
  stats: SplitStats;
  receiptImage: string | null;
  activePersonId: string | null;
  activePerson: Person | undefined;
  onToggleAssignment: (itemId: string) => void;
  onToggleAllAssignment: (itemId: string) => void;
  onSelectPerson: (personId: string) => void;
  onShare: () => void;
  // Item editing
  isEditingItems: boolean;
  onToggleEditItems: () => void;
  onCancelEditItems: () => void;
  onUpdateItem: (id: string, patch: ItemPatch) => void;
  onAddItem: () => void;
  onDeleteItem: (id: string) => void;
  // Total editing
  editingTotal: EditState;
  onOpenTotalEdit: () => void;
  onChangeTotalEdit: (value: number) => void;
  onApplyTotalEdit: () => void;
  onCancelTotalEdit: () => void;
  // Discount editing
  editingDiscount: EditState;
  onOpenDiscountEdit: () => void;
  onChangeDiscountEdit: (value: number) => void;
  onApplyDiscountEdit: () => void;
  onCancelDiscountEdit: () => void;
}

export const SplittingStep: React.FC<SplittingStepProps> = ({
  state,
  stats,
  receiptImage,
  activePersonId,
  activePerson,
  onToggleAssignment,
  onToggleAllAssignment,
  onSelectPerson,
  onShare,
  isEditingItems,
  onToggleEditItems,
  onCancelEditItems,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  editingTotal,
  onOpenTotalEdit,
  onChangeTotalEdit,
  onApplyTotalEdit,
  onCancelTotalEdit,
  editingDiscount,
  onOpenDiscountEdit,
  onChangeDiscountEdit,
  onApplyDiscountEdit,
  onCancelDiscountEdit,
}) => {
  const {
    personTotals,
    itemAdjustments,
    effectiveTotal,
    discountAmount,
    unassignedTotal,
    itemsTotalSum,
    adjustmentFactor,
  } = stats;

  const getPersonColorClass = (personId: string) => {
    const person = state.people.find((p) => p.id === personId);
    return person ? getColorClasses(person.color).bgSolid : 'bg-slate-400';
  };

  // Full-screen receipt preview, for cross-checking the AI's reading.
  const [isReceiptZoomed, setIsReceiptZoomed] = useState(false);

  // Track the name input of each edit row so a freshly-added item can autofocus.
  const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const handleAddItem = () => {
    const idsBefore = new Set(state.items.map((i) => i.id));
    onAddItem();
    // The new row renders on the next tick; focus the input we haven't seen yet.
    setTimeout(() => {
      for (const [id, el] of nameInputRefs.current) {
        if (!idsBefore.has(id)) { el.focus(); break; }
      }
    }, 0);
  };

  return (
    <>
      {/* Mobile Sticky Info Bar */}
      <div className="lg:hidden sticky top-16 z-20 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex justify-between items-center shadow-sm animate-slide-down">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Remaining</span>
          <span className={`font-bold text-lg leading-none ${unassignedTotal > 0.05 ? 'text-indigo-600' : 'text-green-600'}`}>
            {formatCurrency(Math.max(0, unassignedTotal))}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Final Total</span>
          {editingTotal.active ? (
            <div className="flex items-center gap-1 mt-0.5">
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                <input
                  type="number"
                  autoFocus
                  step="0.01"
                  placeholder="0.00"
                  value={editingTotal.value || ''}
                  onChange={(e) => onChangeTotalEdit(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); onApplyTotalEdit(); }
                    else if (e.key === 'Escape') { e.preventDefault(); onCancelTotalEdit(); }
                  }}
                  className="w-full pl-5 pr-1 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base text-right"
                />
              </div>
              <button onClick={onApplyTotalEdit} title="Apply" className="p-1 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors active:scale-90">
                <CheckIcon className="w-4 h-4" />
              </button>
              <button onClick={onCancelTotalEdit} title="Cancel" className="p-1 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenTotalEdit}
              className="flex items-center gap-1.5"
              title="Tap to correct the total"
            >
              {state.discount > 0 && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold">-{state.discount}%</span>
              )}
              <span className="font-bold text-lg text-slate-900 leading-none">{formatCurrency(effectiveTotal)}</span>
              <EditIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-0 lg:px-0">

        {/* Left Column: Items List */}
        <div className="lg:col-span-7 space-y-6 pb-40 lg:pb-0">

          {/* Receipt photo — tap to zoom and verify the AI's reading */}
          {receiptImage && (
            <button
              onClick={() => setIsReceiptZoomed(true)}
              className="mx-4 lg:mx-0 flex items-center gap-3 w-[calc(100%-2rem)] lg:w-full bg-white border border-slate-200 rounded-xl p-2.5 shadow-sm hover:border-indigo-300 hover:shadow transition-all text-left group"
              title="View the receipt photo"
            >
              <img
                src={receiptImage}
                alt="Receipt"
                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">View receipt</p>
                <p className="text-xs text-slate-400">Tap to check items &amp; prices</p>
              </div>
              <ReceiptIcon className="w-4 h-4 text-slate-300 ml-auto mr-1 shrink-0" />
            </button>
          )}

          <div className="bg-white lg:rounded-2xl shadow-sm border-y lg:border border-slate-200 overflow-hidden">
            {/* Desktop header: title + subtotal + edit toggle */}
            <div className="hidden lg:flex px-6 py-4 border-b border-slate-100 bg-slate-50 justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-700">Receipt Items</h3>
                <EditToggle active={isEditingItems} onClick={onToggleEditItems} />
                {isEditingItems && <CancelEditButton onClick={onCancelEditItems} />}
              </div>
              <div className="flex flex-col items-end">
                {editingTotal.active ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-500">Receipt Total:</span>
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                      <input
                        type="number"
                        autoFocus
                        step="0.01"
                        placeholder="0.00"
                        value={editingTotal.value || ''}
                        onChange={(e) => onChangeTotalEdit(parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); onApplyTotalEdit(); }
                          else if (e.key === 'Escape') { e.preventDefault(); onCancelTotalEdit(); }
                        }}
                        className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                      />
                    </div>
                    <button onClick={onApplyTotalEdit} title="Apply" className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90">
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button onClick={onCancelTotalEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={onOpenTotalEdit}
                      className="text-sm text-slate-500 flex items-center gap-2 hover:text-indigo-600 transition-colors group"
                      title="Tap to correct the total"
                    >
                      Receipt Total: <span className="font-bold text-slate-900">{formatCurrency(state.total)}</span>
                      <EditIcon className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    {state.discount > 0 && (
                      <div className="text-xs text-red-500 font-medium">
                        Discount: -{state.discount}% ({formatCurrency(discountAmount)})
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Mobile header: title + edit toggle (the desktop one is hidden) */}
            <div className="lg:hidden flex px-4 py-3 border-b border-slate-100 bg-slate-50 justify-between items-center">
              <h3 className="font-semibold text-slate-700 text-sm">Receipt Items</h3>
              <div className="flex items-center gap-2">
                {isEditingItems && <CancelEditButton onClick={onCancelEditItems} />}
                <EditToggle active={isEditingItems} onClick={onToggleEditItems} />
              </div>
            </div>

            {isEditingItems ? (
              <div className="p-3 sm:p-4 space-y-3 animate-fade-in">
                {state.items.map((item) => (
                  <ItemEditRow
                    key={item.id}
                    item={item}
                    onUpdate={onUpdateItem}
                    onDelete={onDeleteItem}
                    nameInputRefs={nameInputRefs}
                  />
                ))}
                <button
                  onClick={handleAddItem}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add item</span>
                </button>
              </div>
            ) : state.items.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No items found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {itemAdjustments.map((item) => {
                  const assignedPersonIds = (state.assignments[item.id] || []).filter((pid) => state.people.some((p) => p.id === pid));
                  const isAssignedToActive = activePersonId && assignedPersonIds.includes(activePersonId);
                  const allAssigned = state.people.length > 0 && state.people.every((p) => assignedPersonIds.includes(p.id));
                  const activeColor = activePerson?.color;
                  const ac = activeColor ? getColorClasses(activeColor) : null;
                  const bgClass = isAssignedToActive && ac ? ac.bgSubtle : 'hover:bg-slate-50';

                  return (
                    <div
                      key={item.id}
                      onClick={() => onToggleAssignment(item.id)}
                      className={`group flex items-center justify-between p-4 cursor-pointer transition-colors duration-200 ${bgClass}`}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200
                              ${isAssignedToActive && ac
                                ? `${ac.bgSolid} ${ac.borderSelected} text-white scale-110`
                                : 'border-slate-200 text-transparent bg-white'
                              }
                          `}>
                            <CheckIcon className="w-4 h-4" />
                          </div>
                          {item.quantity > 1 && (
                            <span className="shrink-0 text-xs font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                              {item.quantity}×
                            </span>
                          )}
                          <p className={`text-sm sm:text-base font-medium truncate ${isAssignedToActive && ac ? ac.textStrong : 'text-slate-700'}`}>
                            {item.name}
                          </p>
                        </div>
                        <div className="flex -space-x-1.5 mt-2 ml-9 min-h-[20px]">
                          {assignedPersonIds.map((pid) => {
                            const p = state.people.find((person) => person.id === pid);
                            if (!p) return null;
                            return (
                              <div
                                key={pid}
                                className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[9px] text-white font-bold uppercase shadow-sm ${getPersonColorClass(pid)}`}
                                title={p.name}
                              >
                                {p.name.charAt(0)}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1.5">
                        <div>
                          <p className="font-semibold text-slate-900">{formatCurrency(item.adjustedPrice)}</p>
                          {(itemsTotalSum !== state.total || state.discount > 0) && (
                            <p className="text-xs text-slate-400 line-through">{formatCurrency(item.originalPrice)}</p>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleAllAssignment(item.id); }}
                          title={allAssigned ? 'Remove everyone from this item' : 'Split this item across everyone'}
                          aria-pressed={allAssigned}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 transition-colors active:scale-95
                            ${allAssigned
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                        >
                          <UsersIcon className="w-3 h-3" />
                          All
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 lg:px-0">
            {/* Discount Section */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[64px] justify-center">
              {!editingDiscount.active && state.discount === 0 ? (
                <button
                  onClick={onOpenDiscountEdit}
                  className="w-full h-full p-4 flex items-center justify-center gap-2 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Discount</span>
                </button>
              ) : !editingDiscount.active && state.discount > 0 ? (
                <button
                  onClick={onOpenDiscountEdit}
                  className="w-full h-full p-4 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm">
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Discount: {state.discount}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Tap to edit</span>
                </button>
              ) : (
                <div className="p-3 animate-fade-in flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      autoFocus
                      placeholder="0"
                      min="0"
                      max="100"
                      value={editingDiscount.value || ''}
                      onChange={(e) => onChangeDiscountEdit(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); onApplyDiscountEdit(); }
                        else if (e.key === 'Escape') { e.preventDefault(); onCancelDiscountEdit(); }
                      }}
                      className="w-full pl-3 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-base"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={onApplyDiscountEdit} title="Apply" className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90">
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button onClick={onCancelDiscountEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Scaling logic summary */}
          {adjustmentFactor !== 1 && (
            <div className="mx-4 lg:mx-0 bg-yellow-50 text-yellow-800 text-xs p-3 rounded-lg border border-yellow-200 flex gap-2">
              <span className="font-bold shrink-0">Scaling Logic:</span>
              <p>
                Base items sum to {formatCurrency(itemsTotalSum)}. Final total is {formatCurrency(effectiveTotal)}.
                Prices adjusted by {adjustmentFactor >= 1 ? '+' : ''}{((adjustmentFactor - 1) * 100).toFixed(1)}% to cover fees/tips.
              </p>
            </div>
          )}

        </div>

        {/* Right Column: People Selectors (DESKTOP) */}
        <div className="hidden lg:block lg:col-span-5 relative">
          <div className="sticky top-24 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-slate-700">People</h3>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                Remaining: <span className={unassignedTotal > 0.01 ? 'text-red-500' : 'text-green-600'}>
                  {formatCurrency(Math.max(0, unassignedTotal))}
                </span>
              </span>
            </div>

            <div className="space-y-3">
              {state.people.map((person) => {
                const itemCount = Object.values(state.assignments).filter((ids) => (ids as string[]).includes(person.id)).length;
                return (
                  <PersonCard
                    key={person.id}
                    person={person}
                    isSelected={activePersonId === person.id}
                    total={personTotals[person.id] || 0}
                    onClick={() => onSelectPerson(person.id)}
                    itemCount={itemCount}
                  />
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 space-y-2">
              <div className="w-full flex justify-between items-center text-sm text-slate-500">
                <span>Receipt Total</span>
                <span className="font-medium">{formatCurrency(state.total)}</span>
              </div>
              {state.discount > 0 && (
                <div className="flex justify-between items-center text-sm text-red-500 font-medium">
                  <span>Extra Discount ({state.discount}%)</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xl font-bold text-slate-900 border-t border-slate-100 pt-2">
                <span>Final Total</span>
                <span>{formatCurrency(effectiveTotal)}</span>
              </div>
              <button
                onClick={onShare}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                <ShareIcon className="w-5 h-5" />
                <span>Share Summary</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Mobile Bottom People Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] z-40 pb-safe animate-slide-up">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select to assign</span>
          <button onClick={onShare} className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs">
            <ShareIcon className="w-3.5 h-3.5" />
            Share Split
          </button>
        </div>
        <div className="flex overflow-x-auto px-4 py-3 gap-3 no-scrollbar items-center">
          {state.people.map((person) => {
            const isActive = person.id === activePersonId;
            const total = personTotals[person.id] || 0;
            const pc = getColorClasses(person.color);

            return (
              <button
                key={person.id}
                onClick={() => onSelectPerson(person.id)}
                className={`flex flex-col items-center flex-shrink-0 transition-all duration-200 ${isActive ? 'opacity-100 transform -translate-y-1' : 'opacity-60'}`}
                style={{ minWidth: '70px' }}
              >
                <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm mb-1 border-2 transition-colors
                    ${isActive ? `${pc.borderStrong} ${pc.bgSolid} shadow-md` : `border-transparent ${pc.bgSolidMuted}`}`}>
                  {person.name.charAt(0)}
                  {isActive && (
                    <div className={`absolute -top-1 -right-1 w-4 h-4 ${pc.bgSolidStrong} rounded-full border-2 border-white flex items-center justify-center`}>
                      <CheckIcon className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-bold truncate max-w-[64px] ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                  {person.name.split(' ')[0]}
                </span>
                <span className={`text-[10px] font-semibold ${isActive ? pc.text : 'text-slate-400'}`}>
                  {formatCurrency(total)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Full-screen receipt preview */}
      {isReceiptZoomed && receiptImage && (
        <div
          onClick={() => setIsReceiptZoomed(false)}
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Receipt photo"
        >
          <button
            onClick={() => setIsReceiptZoomed(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            title="Close"
            aria-label="Close receipt preview"
          >
            <XIcon className="w-6 h-6" />
          </button>
          <img
            src={receiptImage}
            alt="Receipt"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
};

// Edit-mode toggle shown above the item list. Because edits apply live, this is
// a mode switch, not a commit action — so both states share one pill shape/size
// and differ only by fill + weight (ghost when off, filled indigo when on),
// rather than morphing into a different-looking "confirm" button.
const EditToggle: React.FC<{ active: boolean; onClick: () => void }> = ({ active, onClick }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 transition-colors active:scale-95
      ${active
        ? 'text-white bg-indigo-600 hover:bg-indigo-700'
        : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
  >
    {active ? <CheckIcon className="w-3.5 h-3.5" /> : <EditIcon className="w-3.5 h-3.5" />}
    <span>{active ? 'Done' : 'Edit items'}</span>
  </button>
);

// Discards in-progress edits and leaves edit mode. Styled as a ghost pill that
// mirrors EditToggle's size so the two sit together cleanly.
const CancelEditButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95"
  >
    <XIcon className="w-3.5 h-3.5" />
    <span>Cancel</span>
  </button>
);

// A single editable item row: quantity, name, price, delete. Edits are applied
// live via onUpdate; there is no per-row apply/cancel.
const ItemEditRow: React.FC<{
  item: ReceiptItem;
  onUpdate: (id: string, patch: ItemPatch) => void;
  onDelete: (id: string) => void;
  nameInputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
}> = ({ item, onUpdate, onDelete, nameInputRefs }) => {
  const isNameEmpty = item.name.trim().length === 0;
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  return (
    <div className="flex items-center gap-2 group">
      {/* Quantity */}
      <input
        type="number"
        min="1"
        step="1"
        aria-label="Quantity"
        value={item.quantity || ''}
        onChange={(e) => onUpdate(item.id, { quantity: parseInt(e.target.value, 10) || 1 })}
        onKeyDown={blurOnEnter}
        className="w-12 shrink-0 text-center bg-slate-50 border border-slate-300 rounded-lg py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-bold text-slate-700 shadow-sm"
      />
      {/* Name */}
      <input
        ref={(el) => {
          if (el) nameInputRefs.current.set(item.id, el);
          else nameInputRefs.current.delete(item.id);
        }}
        type="text"
        aria-label="Item name"
        value={item.name}
        onChange={(e) => onUpdate(item.id, { name: e.target.value })}
        onKeyDown={blurOnEnter}
        placeholder="Item name"
        className={`flex-1 min-w-0 bg-slate-50 border rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 font-medium transition-all
          ${isNameEmpty ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 shadow-sm'}`}
      />
      {/* Price */}
      <div className="relative w-24 shrink-0">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          aria-label="Price"
          placeholder="0.00"
          value={item.originalPrice || ''}
          onChange={(e) => onUpdate(item.id, { originalPrice: parseFloat(e.target.value) || 0 })}
          onKeyDown={blurOnEnter}
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
        <TrashIcon className="w-5 h-5" />
      </button>
    </div>
  );
};
