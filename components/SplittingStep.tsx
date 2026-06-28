import React from 'react';
import { AppState, Person } from '../types';
import { SplitStats } from '../state/stats';
import { formatCurrency } from '../utils/currency';
import { getColorClasses } from './personColors';
import { PersonCard } from './PersonCard';
import { CheckIcon, PlusIcon, XIcon, SettingsIcon as EditIcon, ShareIcon } from './Icons';

interface EditState { active: boolean; value: number; }

interface SplittingStepProps {
  state: AppState;
  stats: SplitStats;
  activePersonId: string | null;
  activePerson: Person | undefined;
  onToggleAssignment: (itemId: string) => void;
  onSelectPerson: (personId: string) => void;
  onShare: () => void;
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
  activePersonId,
  activePerson,
  onToggleAssignment,
  onSelectPerson,
  onShare,
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
    unassignedItemCount,
    itemsTotalSum,
    adjustmentFactor,
  } = stats;

  const getPersonColorClass = (personId: string) => {
    const person = state.people.find((p) => p.id === personId);
    return person ? getColorClasses(person.color).bgSolid : 'bg-slate-400';
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
          <div className="flex items-center gap-1.5">
            {state.discount > 0 && (
              <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded font-bold">-{state.discount}%</span>
            )}
            <span className="font-bold text-lg text-slate-900 leading-none">{formatCurrency(effectiveTotal)}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-0 lg:px-0">

        {/* Left Column: Items List */}
        <div className="lg:col-span-7 space-y-6 pb-40 lg:pb-0">

          <div className="bg-white lg:rounded-2xl shadow-sm border-y lg:border border-slate-200 overflow-hidden">
            <div className="hidden lg:flex px-6 py-4 border-b border-slate-100 bg-slate-50 justify-between items-center">
              <h3 className="font-semibold text-slate-700">Receipt Items</h3>
              <div className="flex flex-col items-end">
                <div className="text-sm text-slate-500 flex items-center gap-2">
                  Subtotal: <span className="font-bold text-slate-900">{formatCurrency(state.total)}</span>
                </div>
                {state.discount > 0 && (
                  <div className="text-xs text-red-500 font-medium">
                    Discount: -{state.discount}% ({formatCurrency(discountAmount)})
                  </div>
                )}
              </div>
            </div>

            {state.items.length === 0 ? (
              <div className="p-8 text-center text-slate-500">No items found.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {itemAdjustments.map((item) => {
                  const assignedPersonIds = (state.assignments[item.id] || []).filter((pid) => state.people.some((p) => p.id === pid));
                  const isAssignedToActive = activePersonId && assignedPersonIds.includes(activePersonId);
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

                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{formatCurrency(item.adjustedPrice)}</p>
                        {(itemsTotalSum !== state.total || state.discount > 0) && (
                          <p className="text-xs text-slate-400 line-through">{formatCurrency(item.originalPrice)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unassigned items nudge */}
          {unassignedItemCount > 0 && (
            <div className="mx-4 lg:mx-0 bg-amber-50 text-amber-800 text-sm p-3 rounded-lg border border-amber-200 flex items-center gap-2">
              <span className="font-bold shrink-0">
                {unassignedItemCount} {unassignedItemCount === 1 ? 'item' : 'items'} unassigned
              </span>
              <span className="text-amber-700">— {formatCurrency(Math.max(0, unassignedTotal))} not yet split. Tap an item to assign it.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 lg:px-0">
            {/* Total Adjustment Section */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[64px] justify-center">
              {!editingTotal.active ? (
                <button
                  onClick={onOpenTotalEdit}
                  className="w-full h-full p-4 flex items-center justify-center gap-2 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                >
                  <EditIcon className="w-4 h-4" />
                  <span>Correct Total</span>
                </button>
              ) : (
                <div className="p-3 animate-fade-in flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
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
                      className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-base"
                    />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={onApplyTotalEdit} title="Apply" className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90">
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button onClick={onCancelTotalEdit} title="Cancel" className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

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
              <div className="flex justify-between items-center text-sm text-slate-500">
                <span>Receipt Total</span>
                <span>{formatCurrency(state.total)}</span>
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
    </>
  );
};
