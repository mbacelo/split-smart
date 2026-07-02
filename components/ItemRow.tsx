import React from 'react';
import { Person, UnitWeightState } from '../types';
import { ItemAdjustment } from '../state/stats';
import { formatCurrency } from '../utils/currency';
import { getColorClasses } from './personColors';
import { PersonAvatar } from './PersonAvatar';
import { UnitAllocationPanel } from './UnitAllocationPanel';
import { Check, Scale, Users } from 'lucide-react';

// One assignable receipt line in the splitting list: tap anywhere to toggle the
// active person on/off the item, plus the "By unit" and "All" shortcuts.
//
// Accessibility shape: the row container is a plain clickable div (a large
// pointer target only), while the checkbox is a real <button> carrying the
// toggle semantics — keeping interactive controls out of each other so keyboard
// and screen-reader users get three separate, properly-labeled buttons.
export const ItemRow: React.FC<{
  item: ItemAdjustment;
  people: Person[];
  assignedPersonIds: string[];
  activePerson: Person | undefined;
  adjustmentFactor: number;
  unitWeights: UnitWeightState;
  isUnitExpanded: boolean;
  onToggleAssignment: (itemId: string) => void;
  onToggleAllAssignment: (itemId: string) => void;
  onToggleUnitPanel: (itemId: string) => void;
  onSetUnitWeight: (itemId: string, personId: string, weight: number) => void;
  onClearUnitWeights: (itemId: string) => void;
}> = ({
  item,
  people,
  assignedPersonIds,
  activePerson,
  adjustmentFactor,
  unitWeights,
  isUnitExpanded,
  onToggleAssignment,
  onToggleAllAssignment,
  onToggleUnitPanel,
  onSetUnitWeight,
  onClearUnitWeights,
}) => {
  const isAssignedToActive = !!activePerson && assignedPersonIds.includes(activePerson.id);
  const allAssigned = people.length > 0 && people.every((p) => assignedPersonIds.includes(p.id));
  // Flag rows nobody is on yet: their cost scales onto everyone else silently,
  // so surface them with a left accent + label.
  const isUnassigned = assignedPersonIds.length === 0;
  const ac = activePerson ? getColorClasses(activePerson.color) : null;
  const bgClass = isAssignedToActive && ac ? ac.bgSubtle : 'hover:bg-slate-50';
  // Per-unit weighting only makes sense for multi-quantity lines.
  const canWeightByUnit = item.quantity > 1;
  const itemWeights = unitWeights[item.id];
  const hasWeights = !!itemWeights && Object.keys(itemWeights).length > 0;

  const personColorClass = (personId: string) => {
    const person = people.find((p) => p.id === personId);
    return person ? getColorClasses(person.color).bgSolid : 'bg-slate-400';
  };

  return (
    <div className={isUnitExpanded ? 'bg-slate-50/60' : ''}>
      <div
        onClick={() => onToggleAssignment(item.id)}
        className={`group flex items-center justify-between p-4 cursor-pointer transition-colors duration-200 ${bgClass} ${isUnassigned ? 'border-l-4 border-l-amber-300' : 'border-l-4 border-l-transparent'}`}
      >
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center space-x-3">
            {/* The real toggle control — keyboard/AT users operate this. */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleAssignment(item.id); }}
              aria-pressed={isAssignedToActive}
              aria-label={activePerson ? `Assign ${item.name || 'item'} to ${activePerson.name}` : `Assign ${item.name || 'item'}`}
              className={`w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all duration-200 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 outline-none
                  ${isAssignedToActive && ac
                    ? `${ac.bgSolid} ${ac.borderSelected} text-white scale-110`
                    : 'border-slate-200 text-transparent bg-white'
                  }
              `}
            >
              <Check className="w-4 h-4" />
            </button>
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
              const p = people.find((person) => person.id === pid);
              if (!p) return null;
              return (
                <PersonAvatar
                  key={pid}
                  photo={p.photo}
                  className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[9px] text-white font-bold uppercase shadow-sm ${personColorClass(pid)}`}
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
                onClick={(e) => { e.stopPropagation(); onToggleUnitPanel(item.id); }}
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
          people={people}
          assignedPersonIds={assignedPersonIds}
          itemWeights={itemWeights}
          hasWeights={hasWeights}
          onSetUnitWeight={onSetUnitWeight}
          onClearUnitWeights={onClearUnitWeights}
        />
      )}
    </div>
  );
};
