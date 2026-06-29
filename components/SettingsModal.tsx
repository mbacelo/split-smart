
import React, { useState, useEffect, useRef } from 'react';
import { Person } from '../types';
import { XIcon, RotateCcwIcon, PlusIcon, TrashIcon } from './Icons';
import { getColorClasses, createPerson } from './personColors';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  initialPeople: Person[];
  onSave: (people: Person[]) => void;
  onReset: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, people, initialPeople, onSave, onReset }) => {
  const [editedPeople, setEditedPeople] = useState<Person[]>(people);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    setEditedPeople(people);
    setShowResetConfirm(false);
  }, [people, isOpen]);

  if (!isOpen) return null;

  const handleNameChange = (id: string, name: string) => {
    setEditedPeople(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const handleAddPerson = () => {
    // Empty name here: in the modal the user types the name themselves (unlike
    // the splitting view's quick-add, which auto-names for speed).
    const newPerson = createPerson(editedPeople, '');
    setEditedPeople(prev => [...prev, newPerson]);

    // Use a short timeout to ensure the element is rendered before focusing
    setTimeout(() => {
      inputRefs.current.get(newPerson.id)?.focus();
    }, 0);
  };

  const handleRemovePerson = (id: string) => {
    if (editedPeople.length <= 1) return; // Must have at least one person
    setEditedPeople(prev => prev.filter(p => p.id !== id));
    inputRefs.current.delete(id);
  };

  const handleClearName = (id: string) => {
    handleNameChange(id, '');
    inputRefs.current.get(id)?.focus();
  };

  const isValid = editedPeople.length > 0 && editedPeople.every(p => p.name.trim().length > 0);

  const handleSave = () => {
    if (!isValid) return;
    // Trim names before saving
    const cleanedPeople = editedPeople.map(p => ({...p, name: p.name.trim()}));
    onSave(cleanedPeople);
    onClose();
  };

  const confirmReset = () => {
    onReset();
    setShowResetConfirm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
            {showResetConfirm ? 'Reset Defaults' : 'Manage People'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        
        {showResetConfirm ? (
          <div className="p-6 animate-fade-in overflow-y-auto">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 flex items-start gap-4">
                <div className="p-2 bg-white rounded-full border border-slate-200 text-slate-500 shrink-0 shadow-sm">
                    <RotateCcwIcon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-semibold text-slate-900 text-sm">Restore default names?</h3>
                    <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                        This will replace your current list with the original two people (Person #1 and #2). Current changes will be discarded.
                    </p>
                </div>
            </div>
            
            <div className="flex gap-3 justify-end">
               <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors"
               >
                  Cancel
               </button>
               <button 
                  onClick={confirmReset}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
               >
                  Reset Names
               </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4 overflow-y-auto flex-1 animate-fade-in no-scrollbar">
              {editedPeople.map((person, index) => {
                const isNameEmpty = person.name.trim().length === 0;
                const c = getColorClasses(person.color);
                return (
                  <div key={person.id} className="flex items-center space-x-3 group">
                    <div className={`w-10 h-10 shrink-0 rounded-full ${c.bgSoft} flex items-center justify-center ${c.text} font-bold text-sm border ${c.borderSoft} shadow-sm transition-transform group-focus-within:scale-110`}>
                      {person.name.trim().charAt(0) || '?'}
                    </div>
                    <div className="relative flex-1">
                      <input 
                        ref={(el) => {
                          if (el) inputRefs.current.set(person.id, el);
                          else inputRefs.current.delete(person.id);
                        }}
                        type="text" 
                        value={person.name}
                        onChange={(e) => handleNameChange(person.id, e.target.value)}
                        className={`w-full bg-slate-50 border rounded-lg pl-3 pr-10 py-2.5 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-slate-900 placeholder-slate-400 transition-all font-medium
                          ${isNameEmpty ? 'border-red-300 focus:ring-red-200' : 'border-slate-300 shadow-sm'}`}
                        placeholder="Enter name"
                      />
                      {person.name.length > 0 && (
                        <button
                          onClick={() => handleClearName(person.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
                          tabIndex={-1}
                          aria-label="Clear name"
                        >
                          <XIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {editedPeople.length > 1 && (
                      <button 
                        onClick={() => handleRemovePerson(person.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shadow-sm bg-white border border-slate-100"
                        title="Remove member"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button 
                onClick={handleAddPerson}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-medium flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200 mt-2"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add Member</span>
              </button>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                <button 
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center space-x-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-white"
                >
                    <RotateCcwIcon className="w-4 h-4" />
                    <span>Restore Default</span>
                </button>
                <button 
                    onClick={handleSave}
                    disabled={!isValid}
                    className={`px-6 py-2 rounded-lg font-medium transition-all shadow-sm 
                        ${isValid 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow active:scale-95' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                >
                    Save Changes
                </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
