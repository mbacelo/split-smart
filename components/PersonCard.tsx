import React from 'react';
import { Person } from '../types';
import { UserIcon } from './Icons';
import { formatCurrency } from '../utils/currency';

interface PersonCardProps {
  person: Person;
  isSelected: boolean;
  total: number;
  onClick: () => void;
  itemCount: number;
}

export const PersonCard: React.FC<PersonCardProps> = ({ 
  person, 
  isSelected, 
  total, 
  onClick,
  itemCount
}) => {
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left transition-all duration-200 rounded-xl border p-3 sm:p-4 flex flex-col justify-between h-28 sm:h-32 shadow-sm
        ${isSelected 
          ? `ring-2 ring-offset-2 ring-${person.color}-500 border-${person.color}-500 bg-${person.color}-50` 
          : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-md'
        }`}
    >
      <div className="flex justify-between items-start w-full">
        <div className={`p-1.5 rounded-full bg-${person.color}-100 text-${person.color}-600`}>
          <UserIcon className="w-5 h-5" />
        </div>
        {isSelected && (
          <span className={`text-[10px] font-bold uppercase tracking-wider text-${person.color}-600 bg-white px-2 py-0.5 rounded-full shadow-sm`}>
            Active
          </span>
        )}
      </div>
      
      <div>
        <h4 className="font-semibold text-slate-800 text-sm sm:text-base truncate">{person.name}</h4>
        <div className="flex justify-between items-end mt-1">
          <span className="text-xs text-slate-500">{itemCount} items</span>
          <span className="font-bold text-slate-900">{formatCurrency(total)}</span>
        </div>
      </div>
    </button>
  );
};
