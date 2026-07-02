import React from 'react';
import { Person } from '../types';
import { PersonEditRow } from './PersonEditRow';
import { Contact, Plus, RotateCcw } from 'lucide-react';

// The dashed "Add person" / "Pick from contacts" buttons, shared between the
// desktop people column and the mobile edit sheet so the two can't drift.
export const AddPeopleButtons: React.FC<{
  onAddPerson: () => void;
  canPickContacts: boolean;
  onAddFromContacts: () => void;
}> = ({ onAddPerson, canPickContacts, onAddFromContacts }) => (
  <>
    <button
      onClick={onAddPerson}
      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
    >
      <Plus className="w-4 h-4" />
      <span>Add person</span>
    </button>
    {canPickContacts && (
      <button
        onClick={onAddFromContacts}
        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200"
      >
        <Contact className="w-4 h-4" />
        <span>Pick from contacts</span>
      </button>
    )}
  </>
);

// Edit-mode people list: an editable row per person plus add / pick-from-
// contacts / restore-default actions. Rendered by both the desktop people
// column and the mobile bottom sheet (only the surrounding container differs).
export const PeopleEditor: React.FC<{
  people: Person[];
  onRename: (personId: string, name: string) => void;
  onBlurName: (personId: string, name: string) => void;
  onRemove: (personId: string) => void;
  inputRefs: React.MutableRefObject<Map<string, HTMLInputElement>>;
  onAddPerson: () => void;
  canPickContacts: boolean;
  onAddFromContacts: () => void;
  onRestoreDefault: () => void;
}> = ({
  people,
  onRename,
  onBlurName,
  onRemove,
  inputRefs,
  onAddPerson,
  canPickContacts,
  onAddFromContacts,
  onRestoreDefault,
}) => (
  <>
    {people.map((person) => (
      <PersonEditRow
        key={person.id}
        person={person}
        canRemove={people.length > 1}
        onRename={onRename}
        onBlurName={onBlurName}
        onRemove={onRemove}
        inputRefs={inputRefs}
      />
    ))}
    <AddPeopleButtons
      onAddPerson={onAddPerson}
      canPickContacts={canPickContacts}
      onAddFromContacts={onAddFromContacts}
    />
    <button
      onClick={onRestoreDefault}
      className="w-full flex items-center justify-center gap-2 text-sm font-medium text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg py-2 transition-colors"
    >
      <RotateCcw className="w-4 h-4" />
      <span>Restore default</span>
    </button>
  </>
);
