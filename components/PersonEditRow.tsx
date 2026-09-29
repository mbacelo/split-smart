import React from 'react';
import { Person } from '../types';
import { getColorClasses, personInitial } from './personColors';
import { PersonAvatar } from './PersonAvatar';
import { Trash2 } from 'lucide-react';

// A single editable person row used in both the desktop column and the mobile
// bar's edit mode: colored avatar initial, a live name field, and a remove
// button (hidden when only one person remains).
export const PersonEditRow: React.FC<{
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
      <PersonAvatar
        photo={person.photo}
        className={`w-10 h-10 shrink-0 rounded-full ${c.bgSoft} flex items-center justify-center ${c.text} font-bold text-sm border ${c.borderSoft} shadow-sm`}
      >
        {personInitial(person.name)}
      </PersonAvatar>
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
