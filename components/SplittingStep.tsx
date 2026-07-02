import React, { useEffect, useRef, useState } from 'react';
import { AppState, Person, ReceiptItem, UnitWeightState } from '../types';
import { SplitStats } from '../state/stats';
import { formatCurrency } from '../utils/currency';
import { getColorClasses, defaultPersonName } from './personColors';
import { PersonCard } from './PersonCard';
import { PersonAvatar } from './PersonAvatar';
import { ConfirmDialog } from './ConfirmDialog';
import { ReceiptPreview } from './ReceiptPreview';
import { TipControl, TipEditState } from './TipControl';
import { UnitAllocationPanel } from './UnitAllocationPanel';
import { PersonEditRow } from './PersonEditRow';
import { ItemEditRow, ItemPatch } from './ItemEditRow';
import { EditToggle, CancelEditButton } from './EditControls';
import { Check, Plus, X, Pencil, Share, Users, Receipt, RotateCcw, Scale, Contact } from 'lucide-react';
import { contactsPickerSupported } from '../utils/contacts';

interface EditState { active: boolean; value: number; }

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
  // Per-unit consumption weights (multi-quantity items only). See UnitWeightState.
  unitWeights: UnitWeightState;
  onSetUnitWeight: (itemId: string, personId: string, weight: number) => void;
  onClearUnitWeights: (itemId: string) => void;
  onSelectPerson: (personId: string) => void;
  onAddPerson: () => void;
  onAddPeopleFromContacts: () => void;
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
  // Total / discount / tip mutations. The transient editor state (which figure
  // is open, the value being typed) lives locally in this component — App only
  // receives the final applied values.
  onSetTotal: (value: number) => void;
  onClearTotalOverride: () => void;
  onSetDiscount: (value: number) => void;
  onSetTip: (value: number, mode: AppState['tipMode']) => void;
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
  unitWeights,
  onSetUnitWeight,
  onClearUnitWeights,
  onSelectPerson,
  onAddPerson,
  onAddPeopleFromContacts,
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
  onSetTotal,
  onClearTotalOverride,
  onSetDiscount,
  onSetTip,
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

  // Local editor state for the total/discount/tip figures: which editor is open
  // and the value being typed. Apply hands the final value up via the
  // onSet*/onClear* props; Cancel just closes. This state is transient UI —
  // it resets naturally when the splitting step unmounts.
  const [editingTotal, setEditingTotal] = useState<EditState>({ active: false, value: 0 });
  const [editingDiscount, setEditingDiscount] = useState<EditState>({ active: false, value: 0 });
  const [editingTip, setEditingTip] = useState<TipEditState>({ active: false, value: 0, mode: 'percent' });

  // In manual entry the editable figure is the override (prefilled from the
  // current items sum when none is set yet); for a scanned receipt it's the
  // scanned total.
  const openTotalEdit = () => setEditingTotal({
    active: true,
    value: manualEntry ? (state.manualTotalOverride ?? itemsTotalSum) : state.total,
  });
  const changeTotalEdit = (value: number) => setEditingTotal((prev) => ({ ...prev, value }));
  const applyTotalEdit = () => {
    onSetTotal(editingTotal.value);
    setEditingTotal({ active: false, value: 0 });
  };
  const cancelTotalEdit = () => setEditingTotal({ active: false, value: 0 });
  // Manual entry only: drop the pinned total and go back to tracking the items
  // sum automatically.
  const clearTotalOverride = () => {
    onClearTotalOverride();
    setEditingTotal({ active: false, value: 0 });
  };

  const openDiscountEdit = () => setEditingDiscount({ active: true, value: state.discount });
  const changeDiscountEdit = (value: number) => setEditingDiscount((prev) => ({ ...prev, value }));
  const applyDiscountEdit = () => {
    onSetDiscount(editingDiscount.value);
    setEditingDiscount({ active: false, value: 0 });
  };
  const cancelDiscountEdit = () => setEditingDiscount({ active: false, value: 0 });

  // Tip editing carries the input mode too (percent vs flat amount) so the user
  // can switch units while the editor is open before applying.
  const openTipEdit = () => setEditingTip({ active: true, value: state.tip, mode: state.tipMode });
  const applyTipEdit = () => {
    onSetTip(editingTip.value, editingTip.mode);
    setEditingTip({ active: false, value: 0, mode: 'percent' });
  };
  const cancelTipEdit = () => setEditingTip({ active: false, value: 0, mode: 'percent' });
  // Clear the tip entirely (back to no tip), collapsing the editor.
  const clearTip = () => {
    onClearTip();
    setEditingTip({ active: false, value: 0, mode: 'percent' });
  };

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

  // Which item (if any) has its per-unit allocation panel expanded. Single-open:
  // opening one collapses the others so the item list stays compact.
  const [expandedUnitItemId, setExpandedUnitItemId] = useState<string | null>(null);

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

  // Only shown on browsers with the OS contact picker (Android Chrome/Edge).
  const canPickContacts = contactsPickerSupported();

  // Like handleAddPerson, but the names come from the picker so there's no field
  // to focus. Still snapshot into edit mode first so Cancel can undo the adds.
  const handleAddFromContacts = () => {
    if (!isEditingPeople) onStartEditPeople();
    setIsEditingPeople(true);
    onAddPeopleFromContacts();
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
                <button onClick={clearTotalOverride} title="Back to items total" className="p-1 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors active:scale-90">
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <div className="relative w-24">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  autoFocus
                  step="0.01"
                  placeholder="0.00"
                  value={editingTotal.value || ''}
                  onChange={(e) => changeTotalEdit(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); applyTotalEdit(); }
                    else if (e.key === 'Escape') { e.preventDefault(); cancelTotalEdit(); }
                  }}
                  className="w-full pl-5 pr-1 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-base text-right"
                />
              </div>
              <button onClick={applyTotalEdit} title="Apply" className="p-1 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors active:scale-90">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={cancelTotalEdit} title="Cancel" className="p-1 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={openTotalEdit}
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
                        inputMode="decimal"
                        autoFocus
                        step="0.01"
                        placeholder="0.00"
                        value={editingTotal.value || ''}
                        onChange={(e) => changeTotalEdit(parseFloat(e.target.value) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); applyTotalEdit(); }
                          else if (e.key === 'Escape') { e.preventDefault(); cancelTotalEdit(); }
                        }}
                        className="w-full pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                      />
                    </div>
                    {totalOverridden && (
                      <button onClick={clearTotalOverride} title="Back to items total" className="p-1.5 rounded-lg text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors active:scale-90">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={applyTotalEdit} title="Apply" className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelTotalEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={openTotalEdit}
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
                  // Per-unit weighting only makes sense for multi-quantity lines.
                  const canWeightByUnit = item.quantity > 1;
                  const itemWeights = unitWeights[item.id];
                  const hasWeights = !!itemWeights && Object.keys(itemWeights).length > 0;
                  const isUnitExpanded = expandedUnitItemId === item.id;

                  return (
                    <div key={item.id} className={`${isUnitExpanded ? 'bg-slate-50/60' : ''}`}>
                    <div
                      onClick={() => onToggleAssignment(item.id)}
                      // Assigning is the app's core interaction — make the row a
                      // real keyboard target (Tab + Enter/Space), not click-only.
                      role="button"
                      tabIndex={0}
                      aria-pressed={!!isAssignedToActive}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleAssignment(item.id); }
                      }}
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
                              <PersonAvatar
                                key={pid}
                                photo={p.photo}
                                className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[9px] text-white font-bold uppercase shadow-sm ${getPersonColorClass(pid)}`}
                                title={p.name}
                              >
                                {p.name.charAt(0)}
                              </PersonAvatar>
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
                        <div className="flex items-center gap-1.5">
                          {canWeightByUnit && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setExpandedUnitItemId((cur) => (cur === item.id ? null : item.id)); }}
                              title="Split by units consumed"
                              aria-pressed={hasWeights || isUnitExpanded}
                              className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 transition-colors active:scale-95
                                ${hasWeights || isUnitExpanded
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600'}`}
                            >
                              <Scale className="w-3 h-3" />
                              By unit
                            </button>
                          )}
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
                    </div>

                    {isUnitExpanded && canWeightByUnit && (
                      <UnitAllocationPanel
                        item={item}
                        people={state.people}
                        assignedPersonIds={assignedPersonIds}
                        itemWeights={itemWeights}
                        hasWeights={hasWeights}
                        onSetUnitWeight={onSetUnitWeight}
                        onClearUnitWeights={onClearUnitWeights}
                      />
                    )}
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
                  onClick={openDiscountEdit}
                  className="w-full h-full p-4 flex items-center justify-center gap-2 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Discount</span>
                </button>
              ) : !editingDiscount.active && state.discount > 0 ? (
                <button
                  onClick={openDiscountEdit}
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
                      inputMode="decimal"
                      autoFocus
                      placeholder="0"
                      min="0"
                      max="100"
                      value={editingDiscount.value || ''}
                      onChange={(e) => changeDiscountEdit(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); applyDiscountEdit(); }
                        else if (e.key === 'Escape') { e.preventDefault(); cancelDiscountEdit(); }
                      }}
                      className="w-full pl-3 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-base"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={applyDiscountEdit} title="Apply" className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={cancelDiscountEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
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
              onOpen={openTipEdit}
              onChangeValue={(value) => setEditingTip((prev) => ({ ...prev, value }))}
              onChangeMode={(mode) => setEditingTip((prev) => ({ ...prev, mode }))}
              onApply={applyTipEdit}
              onCancel={cancelTipEdit}
              onClear={clearTip}
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
                    const itemCount = Object.values(state.assignments).filter((ids) => ids.includes(person.id)).length;
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
              {canPickContacts && (
                <button
                  onClick={handleAddFromContacts}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
                >
                  <Contact className="w-4 h-4" />
                  <span>Pick from contacts</span>
                </button>
              )}
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
            {canPickContacts && (
              <button
                onClick={handleAddFromContacts}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
              >
                <Contact className="w-4 h-4" />
                <span>Pick from contacts</span>
              </button>
            )}
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
                <div className="relative mb-1">
                  <PersonAvatar
                    photo={person.photo}
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 transition-colors
                      ${isActive ? `${pc.borderStrong} ${pc.bgSolid} shadow-md` : `border-transparent ${pc.bgSolidMuted}`}`}
                  >
                    {person.name.charAt(0)}
                  </PersonAvatar>
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
          {canPickContacts && (
            <button
              onClick={handleAddFromContacts}
              title="Pick from contacts"
              aria-label="Pick from contacts"
              className="flex flex-col items-center flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              style={{ minWidth: '70px' }}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-1 border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                <Contact className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold text-slate-500">Contacts</span>
            </button>
          )}
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
