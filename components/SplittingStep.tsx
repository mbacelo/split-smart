import React, { useEffect, useRef, useState } from 'react';
import { AppState, Person, ReceiptItem } from '../types';
import { SplitStats } from '../state/stats';
import { formatCurrency } from '../utils/currency';
import { getColorClasses, defaultPersonName } from './personColors';
import { PersonCard } from './PersonCard';
import { ConfirmDialog } from './ConfirmDialog';
import { Check, Plus, X, Trash2, Pencil, Share, Users, Receipt, RotateCcw } from 'lucide-react';

interface EditState { active: boolean; value: number; }
// Tip editing also tracks the unit (percent vs flat amount) being entered.
interface TipEditState { active: boolean; value: number; mode: AppState['tipMode']; }

type ItemPatch = Partial<Pick<ReceiptItem, 'name' | 'quantity' | 'originalPrice'>>;

interface SplittingStepProps {
  state: AppState;
  stats: SplitStats;
  // Manual entry: the total tracks the items' sum by default, but can be pinned
  // to an explicit override (state.manualTotalOverride) — see the edit-total
  // affordances below, which gain a "back to auto" reset in this mode.
  manualEntry: boolean;
  receiptImage: string | null;
  activePersonId: string | null;
  activePerson: Person | undefined;
  onToggleAssignment: (itemId: string) => void;
  onToggleAllAssignment: (itemId: string) => void;
  onSelectPerson: (personId: string) => void;
  onAddPerson: () => void;
  onRenamePerson: (personId: string, name: string) => void;
  onRemovePerson: (personId: string) => void;
  onStartEditPeople: () => void;
  onCancelEditPeople: () => void;
  onResetPeople: () => void;
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
  onClearTotalOverride: () => void;
  // Discount editing
  editingDiscount: EditState;
  onOpenDiscountEdit: () => void;
  onChangeDiscountEdit: (value: number) => void;
  onApplyDiscountEdit: () => void;
  onCancelDiscountEdit: () => void;
  // Tip editing
  editingTip: TipEditState;
  onOpenTipEdit: () => void;
  onChangeTipEdit: (value: number) => void;
  onChangeTipMode: (mode: AppState['tipMode']) => void;
  onApplyTipEdit: () => void;
  onCancelTipEdit: () => void;
  onClearTip: () => void;
}

export const SplittingStep: React.FC<SplittingStepProps> = ({
  state,
  stats,
  manualEntry,
  receiptImage,
  activePersonId,
  activePerson,
  onToggleAssignment,
  onToggleAllAssignment,
  onSelectPerson,
  onAddPerson,
  onRenamePerson,
  onRemovePerson,
  onStartEditPeople,
  onCancelEditPeople,
  onResetPeople,
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
  onClearTotalOverride,
  editingDiscount,
  onOpenDiscountEdit,
  onChangeDiscountEdit,
  onApplyDiscountEdit,
  onCancelDiscountEdit,
  editingTip,
  onOpenTipEdit,
  onChangeTipEdit,
  onChangeTipMode,
  onApplyTipEdit,
  onCancelTipEdit,
  onClearTip,
}) => {
  const {
    personTotals,
    itemAdjustments,
    effectiveTotal,
    discountAmount,
    tipAmount,
    unassignedTotal,
    itemsTotalSum,
    adjustmentFactor,
  } = stats;

  // Human-readable tip label, e.g. "18%" or "$5.00", for the collapsed pill.
  const tipLabel = state.tipMode === 'percent' ? `${state.tip}%` : formatCurrency(state.tip);

  // The editable pre-discount base total and its label differ by mode:
  // scanned → the scanned receipt total; manual → the items sum, or the pinned
  // override when the user has set one.
  const totalOverridden = manualEntry && state.manualTotalOverride != null;
  const baseTotal = manualEntry ? (state.manualTotalOverride ?? itemsTotalSum) : state.total;
  const baseTotalLabel = manualEntry ? (totalOverridden ? 'Total' : 'Items Total') : 'Receipt Total';

  const getPersonColorClass = (personId: string) => {
    const person = state.people.find((p) => p.id === personId);
    return person ? getColorClasses(person.color).bgSolid : 'bg-slate-400';
  };

  // Full-screen receipt preview, for cross-checking the AI's reading.
  const [isReceiptZoomed, setIsReceiptZoomed] = useState(false);

  // Toggles the People list between "tap to select for assigning" and an inline
  // edit mode where each person becomes a name field with a remove button —
  // putting rename/remove in reach right where the people are shown.
  const [isEditingPeople, setIsEditingPeople] = useState(false);

  // Confirm gate for restoring the default people list — a destructive action
  // (clears the list and assignments), so it asks before wiping.
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  // Enter edit mode (snapshotting people so Cancel can revert) or commit and
  // leave. Mirrors the items list's Edit/Done + Cancel affordance.
  const toggleEditPeople = () => {
    if (isEditingPeople) {
      setIsEditingPeople(false);
    } else {
      onStartEditPeople();
      setIsEditingPeople(true);
    }
  };

  // Abandon people edits: revert to the snapshot taken when edit mode opened.
  const cancelEditPeople = () => {
    onCancelEditPeople();
    setIsEditingPeople(false);
  };

  // When a name is left blank, backfill a default on blur so we never persist an
  // empty participant (matches the non-empty rule applied elsewhere).
  const handleNameBlur = (personId: string, name: string) => {
    if (name.trim() === '') onRenamePerson(personId, defaultPersonName(state.people));
  };

  // Track the name input of each edit row so a freshly-added item can autofocus.
  const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Track each person's edit-row name input so a freshly-added person can grab
  // focus with its default "Person #n" pre-selected for instant overwrite.
  const personNameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Adding a person only helps if you can name it: drop into edit mode, append,
  // then focus the new row's field and select its default text so the user can
  // type a name immediately without clearing it first.
  const handleAddPerson = () => {
    const idsBefore = new Set(state.people.map((p) => p.id));
    // Snapshot before the first edit so Cancel can also undo a just-added person.
    if (!isEditingPeople) onStartEditPeople();
    setIsEditingPeople(true);
    onAddPerson();
    setTimeout(() => {
      for (const [id, el] of personNameInputRefs.current) {
        if (!idsBefore.has(id)) { el.focus(); el.select(); break; }
      }
    }, 0);
  };

  // Manual entry lands directly in edit mode — put the cursor in the first
  // item's name field so the user can start typing without a click/tap.
  useEffect(() => {
    if (manualEntry && isEditingItems) {
      const firstId = state.items[0]?.id;
      if (firstId) nameInputRefs.current.get(firstId)?.focus();
    }
    // Mount-only: this is the initial focus when the splitting screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
              {totalOverridden && (
                <button onClick={onClearTotalOverride} title="Back to items total" className="p-1 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors active:scale-90">
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
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
                <Check className="w-4 h-4" />
              </button>
              <button onClick={onCancelTotalEdit} title="Cancel" className="p-1 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenTotalEdit}
              className="flex items-center gap-1.5"
              title={manualEntry ? 'Tap to override the total' : 'Tap to correct the total'}
            >
              {state.discount > 0 && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold">-{state.discount}%</span>
              )}
              {tipAmount > 0 && (
                <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1 rounded font-bold">+tip</span>
              )}
              <span className="font-bold text-lg text-slate-900 leading-none">{formatCurrency(effectiveTotal)}</span>
              <Pencil className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
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
              <Receipt className="w-4 h-4 text-slate-300 ml-auto mr-1 shrink-0" />
            </button>
          )}

          <div className="bg-white lg:rounded-2xl shadow-sm border-y lg:border border-slate-200 overflow-hidden">
            {/* Desktop header: title + subtotal + edit toggle */}
            <div className="hidden lg:flex px-6 py-4 border-b border-slate-100 bg-slate-50 justify-between items-center">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-700">{manualEntry ? 'Items' : 'Receipt Items'}</h3>
                <EditToggle active={isEditingItems} onClick={onToggleEditItems} />
                {isEditingItems && <CancelEditButton onClick={onCancelEditItems} />}
              </div>
              <div className="flex flex-col items-end">
                {editingTotal.active ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-slate-500">{baseTotalLabel}:</span>
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
                    {totalOverridden && (
                      <button onClick={onClearTotalOverride} title="Back to items total" className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors active:scale-90">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={onApplyTotalEdit} title="Apply" className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={onCancelTotalEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={onOpenTotalEdit}
                      className="text-sm text-slate-500 flex items-center gap-2 hover:text-indigo-600 transition-colors group"
                      title={manualEntry ? 'Tap to override the total' : 'Tap to correct the total'}
                    >
                      {baseTotalLabel}: <span className="font-bold text-slate-900">{formatCurrency(baseTotal)}</span>
                      <Pencil className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    {manualEntry && !totalOverridden && (
                      <div className="text-[11px] text-slate-400">Auto from items — tap to override</div>
                    )}
                    {totalOverridden && (
                      <div className="text-[11px] text-indigo-500 font-medium">Items sum: {formatCurrency(itemsTotalSum)}</div>
                    )}
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
              <h3 className="font-semibold text-slate-700 text-sm">{manualEntry ? 'Items' : 'Receipt Items'}</h3>
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
                    onAddRow={handleAddItem}
                  />
                ))}
                <button
                  onClick={handleAddItem}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add item</span>
                </button>
              </div>
            ) : state.items.length === 0 ? (
              // A scan can come back with no items (blurry photo, unusual
              // receipt). Rather than dead-end on a bare message, drop the user
              // straight into edit mode — which renders one empty row and the
              // "Add item" button — so a bad read is recoverable in place.
              <div className="p-8 text-center flex flex-col items-center gap-4 animate-fade-in">
                <div className="p-3 bg-slate-100 text-slate-400 rounded-2xl">
                  <Receipt className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">No items to split yet</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {manualEntry
                      ? 'Add the items you want to split.'
                      : "We couldn't read any items from this receipt. Add them by hand, or start over with a clearer photo."}
                  </p>
                </div>
                <button
                  onClick={onToggleEditItems}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add items</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {itemAdjustments.map((item) => {
                  const assignedPersonIds = (state.assignments[item.id] || []).filter((pid) => state.people.some((p) => p.id === pid));
                  const isAssignedToActive = activePersonId && assignedPersonIds.includes(activePersonId);
                  const allAssigned = state.people.length > 0 && state.people.every((p) => assignedPersonIds.includes(p.id));
                  // Flag rows nobody is on yet: their cost scales onto everyone
                  // else silently, so surface them with a left accent + label.
                  const isUnassigned = assignedPersonIds.length === 0;
                  const activeColor = activePerson?.color;
                  const ac = activeColor ? getColorClasses(activeColor) : null;
                  const bgClass = isAssignedToActive && ac ? ac.bgSubtle : 'hover:bg-slate-50';

                  return (
                    <div
                      key={item.id}
                      onClick={() => onToggleAssignment(item.id)}
                      className={`group flex items-center justify-between p-4 cursor-pointer transition-colors duration-200 ${bgClass} ${isUnassigned ? 'border-l-4 border-l-amber-300' : 'border-l-4 border-l-transparent'}`}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200
                              ${isAssignedToActive && ac
                                ? `${ac.bgSolid} ${ac.borderSelected} text-white scale-110`
                                : 'border-slate-200 text-transparent bg-white'
                              }
                          `}>
                            <Check className="w-4 h-4" />
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
                        <div className="flex items-center -space-x-1.5 mt-2 ml-9 min-h-[20px]">
                          {isUnassigned ? (
                            <span className="ml-0 text-[10px] font-bold text-amber-600 uppercase tracking-wide">Unassigned</span>
                          ) : assignedPersonIds.map((pid) => {
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
                          {adjustmentFactor !== 1 && (
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
                          <Users className="w-3 h-3" />
                          All
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 lg:px-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Discount Section */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[64px] justify-center">
              {!editingDiscount.active && state.discount === 0 ? (
                <button
                  onClick={onOpenDiscountEdit}
                  className="w-full h-full p-4 flex items-center justify-center gap-2 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Discount</span>
                </button>
              ) : !editingDiscount.active && state.discount > 0 ? (
                <button
                  onClick={onOpenDiscountEdit}
                  className="w-full h-full p-4 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm">
                    <Plus className="w-3.5 h-3.5" />
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
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={onCancelDiscountEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tip Section — mirrors the discount control but adds a %/$ unit
                toggle, since tips are commonly entered either way. */}
            <TipControl
              tip={state.tip}
              tipLabel={tipLabel}
              editing={editingTip}
              onOpen={onOpenTipEdit}
              onChangeValue={onChangeTipEdit}
              onChangeMode={onChangeTipMode}
              onApply={onApplyTipEdit}
              onCancel={onCancelTipEdit}
              onClear={onClearTip}
            />
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
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-slate-700">People</h3>
                <EditToggle active={isEditingPeople} onClick={toggleEditPeople} idleLabel="Edit" />
                {isEditingPeople && <CancelEditButton onClick={cancelEditPeople} />}
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                Remaining: <span className={unassignedTotal > 0.01 ? 'text-red-500' : 'text-green-600'}>
                  {formatCurrency(Math.max(0, unassignedTotal))}
                </span>
              </span>
            </div>

            <div className="space-y-3">
              {isEditingPeople
                ? state.people.map((person) => (
                    <PersonEditRow
                      key={person.id}
                      person={person}
                      canRemove={state.people.length > 1}
                      onRename={onRenamePerson}
                      onBlurName={handleNameBlur}
                      onRemove={onRemovePerson}
                      inputRefs={personNameInputRefs}
                    />
                  ))
                : state.people.map((person) => {
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
              <button
                onClick={handleAddPerson}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                <span>Add person</span>
              </button>
              {isEditingPeople && (
                <button
                  onClick={() => setShowRestoreConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg py-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Restore default</span>
                </button>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 space-y-2">
              <div className="w-full flex justify-between items-center text-sm text-slate-500">
                <span>{baseTotalLabel}</span>
                <span className="font-medium">{formatCurrency(baseTotal)}</span>
              </div>
              {state.discount > 0 && (
                <div className="flex justify-between items-center text-sm text-red-500 font-medium">
                  <span>Extra Discount ({state.discount}%)</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between items-center text-sm text-emerald-600 font-medium">
                  <span>Tip{state.tipMode === 'percent' ? ` (${state.tip}%)` : ''}</span>
                  <span>+{formatCurrency(tipAmount)}</span>
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
                <Share className="w-5 h-5" />
                <span>Share Summary</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Mobile Bottom People Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.1)] z-40 pb-safe animate-slide-up">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {isEditingPeople ? 'Edit people' : 'Select to assign'}
            </span>
            <EditToggle active={isEditingPeople} onClick={toggleEditPeople} idleLabel="Edit" />
            {isEditingPeople && <CancelEditButton onClick={cancelEditPeople} />}
          </div>
          <button onClick={onShare} className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs">
            <Share className="w-3.5 h-3.5" />
            Share Split
          </button>
        </div>
        {isEditingPeople ? (
          <div className="px-4 py-3 space-y-2 max-h-[45vh] overflow-y-auto">
            {state.people.map((person) => (
              <PersonEditRow
                key={person.id}
                person={person}
                canRemove={state.people.length > 1}
                onRename={onRenamePerson}
                onBlurName={handleNameBlur}
                onRemove={onRemovePerson}
                inputRefs={personNameInputRefs}
              />
            ))}
            <button
              onClick={handleAddPerson}
              className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              <span>Add person</span>
            </button>
            <button
              onClick={() => setShowRestoreConfirm(true)}
              className="w-full flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg py-2 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore default</span>
            </button>
          </div>
        ) : (
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
                      <Check className="w-2.5 h-2.5 text-white" />
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
          <button
            onClick={handleAddPerson}
            title="Add person"
            aria-label="Add person"
            className="flex flex-col items-center flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            style={{ minWidth: '70px' }}
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mb-1 border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold text-slate-500">Add</span>
          </button>
        </div>
        )}
      </div>

      {/* Restore-default-people confirmation (covers both desktop & mobile triggers) */}
      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Restore default people?"
        message="This replaces your current people with the original two (Person #1 and #2) and clears their item assignments."
        confirmLabel="Restore"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { onResetPeople(); setShowRestoreConfirm(false); }}
        onCancel={() => setShowRestoreConfirm(false)}
      />

      {/* Full-screen receipt preview */}
      {isReceiptZoomed && receiptImage && (
        <ReceiptPreview image={receiptImage} onClose={() => setIsReceiptZoomed(false)} />
      )}
    </>
  );
};

// Full-screen receipt preview for cross-checking the AI's reading against the
// photo. The app's viewport disables native pinch-zoom (user-scalable=no), so
// this implements its own gesture-based zoom on the image: pinch (two-finger) or
// mouse wheel to scale 1×–6×, drag to pan when zoomed, double-tap/double-click to
// toggle 1×↔2.5×. Tapping the (un-zoomed) backdrop closes it. The transform is
// applied imperatively to avoid re-rendering on every gesture frame.
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const ReceiptPreview: React.FC<{ image: string; onClose: () => void }> = ({ image, onClose }) => {
  const imgRef = useRef<HTMLImageElement>(null);
  // Live gesture state held in a ref so pointer/touch handlers mutate it without
  // triggering React re-renders; `zoomed` is React state only so the cursor and
  // close-on-backdrop behavior can react to whether we're currently magnified.
  const [zoomed, setZoomed] = useState(false);
  const t = useRef({ scale: 1, x: 0, y: 0 });
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const lastTap = useRef(0);

  // Close on Escape, like the other overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const apply = () => {
    const el = imgRef.current;
    if (el) el.style.transform = `translate(${t.current.x}px, ${t.current.y}px) scale(${t.current.scale})`;
  };

  const setScale = (next: number) => {
    const s = clamp(next, MIN_SCALE, MAX_SCALE);
    t.current.scale = s;
    if (s === 1) { t.current.x = 0; t.current.y = 0; }
    apply();
    setZoomed((z) => (s > 1) !== z ? s > 1 : z);
  };

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      pinchStart.current = { dist: dist(pts[0], pts[1]), scale: t.current.scale };
      panStart.current = null;
    } else if (pts.length === 1 && t.current.scale > 1) {
      panStart.current = { x: e.clientX, y: e.clientY, tx: t.current.x, ty: t.current.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && pinchStart.current) {
      const ratio = dist(pts[0], pts[1]) / (pinchStart.current.dist || 1);
      setScale(pinchStart.current.scale * ratio);
    } else if (pts.length === 1 && panStart.current) {
      t.current.x = panStart.current.tx + (e.clientX - panStart.current.x);
      t.current.y = panStart.current.ty + (e.clientY - panStart.current.y);
      apply();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  // Double-tap / double-click toggles between fit and 2.5×.
  const onTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = e.timeStamp;
    if (now - lastTap.current < 300) {
      setScale(t.current.scale > 1 ? 1 : 2.5);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(t.current.scale * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  };

  return (
    <div
      onClick={() => { if (!zoomed) onClose(); }}
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm overflow-hidden animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt photo"
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        title="Close"
        aria-label="Close receipt preview"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="w-full h-full flex items-center justify-center p-4 touch-none select-none overflow-hidden">
        <img
          ref={imgRef}
          src={image}
          alt="Receipt"
          draggable={false}
          onClick={onTap}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          title={zoomed ? 'Double-tap to fit' : 'Pinch or double-tap to zoom'}
          style={{ touchAction: 'none', transformOrigin: 'center center' }}
          className={`max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl will-change-transform ${
            zoomed ? 'cursor-grab' : 'cursor-zoom-in'
          }`}
        />
      </div>
    </div>
  );
};

// Tip affordance: collapsed it's an "Add Tip" prompt (or a "Tip: 18% / $5.00"
// pill once set); expanded it's a value field with a %/$ unit toggle, plus
// Apply/Cancel and a Clear (only when a tip is already set). Mirrors the
// discount control's shape so the two sit side by side, but adds the unit
// switch since tips are entered either way. The applied value is interpreted by
// computeStats per state.tipMode.
const TipControl: React.FC<{
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

// Edit-mode toggle shown above the item list. Because edits apply live, this is
// a mode switch, not a commit action — so both states share one pill shape/size
// and differ only by fill + weight (ghost when off, filled indigo when on),
// rather than morphing into a different-looking "confirm" button.
const EditToggle: React.FC<{ active: boolean; onClick: () => void; idleLabel?: string }> = ({ active, onClick, idleLabel = 'Edit items' }) => (
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

// A single editable person row used in both the desktop column and the mobile
// bar's edit mode: colored avatar initial, a live name field, and a remove
// button (hidden when only one person remains).
const PersonEditRow: React.FC<{
  person: Person;
  canRemove: boolean;
  onRename: (id: string, name: string) => void;
  onBlurName: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  inputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
}> = ({ person, canRemove, onRename, onBlurName, onRemove, inputRefs }) => {
  const c = getColorClasses(person.color);
  const isNameEmpty = person.name.trim().length === 0;
  return (
    <div className="flex items-center gap-3 group">
      <div className={`w-10 h-10 shrink-0 rounded-full ${c.bgSoft} flex items-center justify-center ${c.text} font-bold text-sm border ${c.borderSoft} shadow-sm`}>
        {person.name.trim().charAt(0).toUpperCase() || '?'}
      </div>
      <input
        type="text"
        aria-label="Person name"
        ref={(el) => {
          if (el) inputRefs.current.set(person.id, el);
          else inputRefs.current.delete(person.id);
        }}
        value={person.name}
        onChange={(e) => onRename(person.id, e.target.value)}
        onBlur={(e) => onBlurName(person.id, e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="Enter name"
        className={`flex-1 min-w-0 bg-slate-50 border rounded-lg px-3 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 font-medium transition-all
          ${isNameEmpty ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 shadow-sm'}`}
      />
      {canRemove && (
        <button
          onClick={() => onRemove(person.id)}
          className="p-2 shrink-0 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shadow-sm bg-white border border-slate-100"
          title="Remove person"
          aria-label="Remove person"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

// Discards in-progress edits and leaves edit mode. Styled as a ghost pill that
// mirrors EditToggle's size so the two sit together cleanly.
const CancelEditButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 text-xs font-bold rounded-full px-2.5 py-1 text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95"
  >
    <X className="w-3.5 h-3.5" />
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
