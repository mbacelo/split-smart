
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Person, ReceiptItem, AssignmentState } from './types';
import { analyzeReceipt } from './services/receiptService';
import { getUser, subscribe, initGoogleSignIn, signOut, AuthUser } from './services/auth';
import { ImageUploader } from './components/ImageUploader';
import { ReceiptIcon, CheckIcon, UserIcon, SettingsIcon, PlusIcon, XIcon, SettingsIcon as EditIcon, ShareIcon } from './components/Icons';
import { formatCurrency } from './utils/currency';
import { PersonCard } from './components/PersonCard';
import { SettingsModal } from './components/SettingsModal';

// Initial People Data Generator
const getInitialPeople = (): Person[] => [
  { id: 'p1', name: 'Person #1', color: 'blue' },
  { id: 'p2', name: 'Person #2', color: 'green' },
  { id: 'p3', name: 'Person #3', color: 'purple' },
  { id: 'p4', name: 'Person #4', color: 'orange' },
  { id: 'p5', name: 'Person #5', color: 'pink' },
];

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    // Load people from localStorage on init
    try {
        const savedPeople = localStorage.getItem('splitSmart_people');
        return {
            step: 'upload',
            receiptImage: null,
            items: [],
            total: 0,
            discount: 0,
            assignments: {},
            people: savedPeople ? JSON.parse(savedPeople) : getInitialPeople(),
            error: null,
        }
    } catch (e) {
        return {
            step: 'upload',
            receiptImage: null,
            items: [],
            total: 0,
            discount: 0,
            assignments: {},
            people: getInitialPeople(),
            error: null,
        }
    }
  });

  const [activePersonId, setActivePersonId] = useState<string | null>(state.people[0]?.id || null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Auth: subscribe to sign-in state from the Google Identity wrapper.
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const signInButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribe(() => setUser(getUser())), []);

  // Render the Google Sign-In button whenever we're signed out and the GIS
  // script is available. Poll briefly in case the script loads after mount.
  useEffect(() => {
    if (user || !signInButtonRef.current) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) return;
    let cancelled = false;
    const tryRender = () => {
      if (cancelled || !signInButtonRef.current) return;
      if ((window as any).google?.accounts?.id) {
        initGoogleSignIn(clientId, signInButtonRef.current);
      } else {
        setTimeout(tryRender, 200);
      }
    };
    tryRender();
    return () => { cancelled = true; };
  }, [user]);
  
  // Local state for editing to allow Apply/Cancel workflow
  const [editingTotal, setEditingTotal] = useState<{ active: boolean; value: number }>({ active: false, value: 0 });
  const [editingDiscount, setEditingDiscount] = useState<{ active: boolean; value: number }>({ active: false, value: 0 });

  // Sync activePersonId if current people list changes
  useEffect(() => {
    if (!activePersonId && state.people.length > 0) {
      setActivePersonId(state.people[0].id);
    } else if (activePersonId && !state.people.some(p => p.id === activePersonId)) {
      setActivePersonId(state.people.length > 0 ? state.people[0].id : null);
    }
  }, [state.people, activePersonId]);

  // Toast timeout
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Calculate stats derived from state
  const stats = useMemo(() => {
    const itemsSum = state.items.reduce((sum, item) => sum + item.originalPrice, 0);
    const discountAmount = (state.total * state.discount) / 100;
    const effectiveTotal = Math.max(0, state.total - discountAmount);
    const adjustmentFactor = itemsSum > 0 ? effectiveTotal / itemsSum : 1;
    
    const totals: Record<string, number> = {};
    state.people.forEach(p => totals[p.id] = 0);

    let assignedSum = 0;

    state.items.forEach(item => {
      // Only count assignments for people that still exist in the state
      const validPersonIds = (state.assignments[item.id] || []).filter(pid => totals[pid] !== undefined);
      const adjustedPrice = item.originalPrice * adjustmentFactor;
      
      if (validPersonIds.length > 0) {
        const costPerPerson = adjustedPrice / validPersonIds.length;
        validPersonIds.forEach(pid => {
          totals[pid] += costPerPerson;
        });
        assignedSum += adjustedPrice;
      }
    });

    // Calculate adjustments for display
    const adjustments = state.items.map(item => ({
      ...item,
      adjustedPrice: item.originalPrice * adjustmentFactor
    }));

    return {
      personTotals: totals,
      itemAdjustments: adjustments,
      effectiveTotal,
      discountAmount,
      unassignedTotal: effectiveTotal - assignedSum,
      itemsTotalSum: itemsSum,
      adjustmentFactor
    };
  }, [state.items, state.total, state.discount, state.assignments, state.people]);

  const { personTotals, itemAdjustments, effectiveTotal, discountAmount, unassignedTotal, itemsTotalSum, adjustmentFactor } = stats;

  const handleImageSelected = async (base64: string) => {
    setState(prev => ({ ...prev, step: 'analyzing', receiptImage: base64, error: null }));
    
    try {
      const result = await analyzeReceipt(base64);
      setState(prev => ({
        ...prev,
        step: 'splitting',
        items: result.items,
        total: result.total,
        discount: 0,
        assignments: {}, // Reset assignments
      }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        step: 'upload', 
        error: err.message || "Something went wrong" 
      }));
    }
  };

  const toggleAssignment = (itemId: string) => {
    if (!activePersonId) return;

    setState(prev => {
      const currentAssignments = prev.assignments[itemId] || [];
      let newAssignments;

      if (currentAssignments.includes(activePersonId)) {
        newAssignments = currentAssignments.filter(id => id !== activePersonId);
      } else {
        newAssignments = [...currentAssignments, activePersonId];
      }

      return {
        ...prev,
        assignments: {
          ...prev.assignments,
          [itemId]: newAssignments
        }
      };
    });
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to start over?")) {
        setState(prev => ({
            ...prev,
            step: 'upload',
            receiptImage: null,
            items: [],
            total: 0,
            discount: 0,
            assignments: {},
            error: null,
        }));
        setEditingTotal({ active: false, value: 0 });
        setEditingDiscount({ active: false, value: 0 });
    }
  };

  const handleSavePeople = (newPeople: Person[]) => {
      // Clean up assignments for removed people
      const newPersonIds = new Set(newPeople.map(p => p.id));
      const newAssignments: AssignmentState = {};
      
      Object.entries(state.assignments).forEach(([itemId, personIds]) => {
          const filteredIds = (personIds as string[]).filter(pid => newPersonIds.has(pid));
          if (filteredIds.length > 0) {
              newAssignments[itemId] = filteredIds;
          }
      });

      setState(prev => ({ 
        ...prev, 
        people: newPeople,
        assignments: newAssignments
      }));
      localStorage.setItem('splitSmart_people', JSON.stringify(newPeople));
  };

  const handleResetPeople = () => {
      const defaultPeople = getInitialPeople();
      setState(prev => ({ 
        ...prev, 
        people: defaultPeople,
        assignments: {}
      }));
      localStorage.removeItem('splitSmart_people');
  };

  // Confirmation handlers
  const openTotalEdit = () => setEditingTotal({ active: true, value: state.total });
  const openDiscountEdit = () => setEditingDiscount({ active: true, value: state.discount });

  const applyTotalEdit = () => {
    setState(prev => ({ ...prev, total: Math.max(0, editingTotal.value) }));
    setEditingTotal({ active: false, value: 0 });
  };

  const applyDiscountEdit = () => {
    setState(prev => ({ ...prev, discount: Math.min(100, Math.max(0, editingDiscount.value)) }));
    setEditingDiscount({ active: false, value: 0 });
  };

  const cancelTotalEdit = () => setEditingTotal({ active: false, value: 0 });
  const cancelDiscountEdit = () => setEditingDiscount({ active: false, value: 0 });

  const generateSummaryText = () => {
      let text = `🧾 SplitSmart: Receipt Summary\n`;
      text += `Total Amount: ${formatCurrency(effectiveTotal)}\n`;
      text += `--------------------------\n`;
      
      state.people.forEach(person => {
          const total = personTotals[person.id] || 0;
          if (total > 0.01) {
              text += `${person.name.toUpperCase()}: ${formatCurrency(total)}\n`;
              
              // Find items assigned to this person
              const assignedItems = state.items.filter(item => {
                  const ids = state.assignments[item.id] || [];
                  return ids.includes(person.id);
              });

              if (assignedItems.length > 0) {
                  assignedItems.forEach(item => {
                      const shareCount = (state.assignments[item.id] || []).length;
                      const priceStr = shareCount > 1 
                        ? `(split ${shareCount} ways)` 
                        : ``;
                      text += ` • ${item.name} ${priceStr}\n`;
                  });
              }
              text += `\n`;
          }
      });
      
      if (unassignedTotal > 0.05) {
          text += `⚠️ UNASSIGNED: ${formatCurrency(unassignedTotal)}\n\n`;
      }
      
      text += `--------------------------\n`;
      text += `Shared via SplitSmart AI`;
      return text;
  };

  const handleShare = async () => {
    const summary = generateSummaryText();
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'SplitSmart Receipt Summary',
                text: summary,
            });
        } catch (err) {
            console.error('Error sharing:', err);
        }
    } else {
        try {
            await navigator.clipboard.writeText(summary);
            setShowToast("Detailed summary copied!");
        } catch (err) {
            console.error('Failed to copy:', err);
            setShowToast("Could not copy to clipboard.");
        }
    }
  };

  const getPersonColorClass = (personId: string) => {
    const person = state.people.find(p => p.id === personId);
    return person ? `bg-${person.color}-500` : 'bg-slate-400';
  };
  
  const activePerson = state.people.find(p => p.id === activePersonId);

  // Gate the whole app behind Google Sign-In.
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center px-6 animate-fade-in">
        <div className="bg-indigo-600 p-3 rounded-2xl text-white mb-6">
          <ReceiptIcon className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 mb-2">
          SplitSmart
        </h1>
        <p className="text-slate-600 text-center max-w-sm mb-8">
          Sign in to split bills with AI. Access is currently limited to approved accounts.
        </p>
        <div ref={signInButtonRef} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-0 lg:pb-20">
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        people={state.people}
        initialPeople={getInitialPeople()}
        onSave={handleSavePeople}
        onReset={handleResetPeople}
      />

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] animate-slide-down">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-semibold border border-white/10">
            <CheckIcon className="w-4 h-4 text-green-400" />
            {showToast}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <ReceiptIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              SplitSmart
            </h1>
          </div>
          <div className="flex items-center space-x-3">
            {state.step === 'splitting' && (
                <button 
                    onClick={handleReset}
                    className="text-sm font-medium text-slate-500 hover:text-red-500 transition-colors mr-2 hidden sm:block"
                >
                    New Receipt
                </button>
            )}
            <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
                title="Settings"
            >
                <SettingsIcon className="w-5 h-5" />
            </button>
            <button
                onClick={signOut}
                className="text-sm font-medium text-slate-500 hover:text-red-500 transition-colors"
                title={`Sign out (${user.email})`}
            >
                Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-0 lg:px-4 py-0 lg:py-8">
        
        {/* Error State */}
        {state.error && (
          <div className="m-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between">
            <span>{state.error}</span>
            <button onClick={() => setState(s => ({...s, error: null}))} className="text-sm underline font-semibold">Dismiss</button>
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {state.step === 'upload' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in p-4">
            <div className="text-center mb-10 max-w-lg">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Split bills in seconds</h2>
              <p className="text-slate-600 text-lg">
                Upload a photo of your receipt. Our AI will extract the items and help you split the costs with your friends.
              </p>
            </div>
            <ImageUploader onImageSelected={handleImageSelected} />
          </div>
        )}

        {/* STEP 2: ANALYZING */}
        {state.step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-pulse p-4">
            <div className="relative w-24 h-24">
               <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
               <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                 <ReceiptIcon className="w-8 h-8" />
               </div>
            </div>
            <div className="text-center">
                <h3 className="text-xl font-semibold text-slate-800">Analyzing Receipt...</h3>
                <p className="text-slate-500 mt-2">Identifying items, prices, and totals.</p>
            </div>
          </div>
        )}

        {/* STEP 3: SPLITTING */}
        {state.step === 'splitting' && (
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
                          const assignedPersonIds = (state.assignments[item.id] || []).filter(pid => state.people.some(p => p.id === pid));
                          const isAssignedToActive = activePersonId && assignedPersonIds.includes(activePersonId);
                          const activeColor = activePerson?.color;
                          const bgClass = isAssignedToActive && activeColor 
                            ? `bg-${activeColor}-50` 
                            : 'hover:bg-slate-50';

                          return (
                            <div 
                              key={item.id}
                              onClick={() => toggleAssignment(item.id)}
                              className={`group flex items-center justify-between p-4 cursor-pointer transition-colors duration-200 ${bgClass}`}
                            >
                              <div className="flex-1 min-w-0 pr-4">
                                  <div className="flex items-center space-x-3">
                                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200
                                          ${isAssignedToActive && activeColor 
                                            ? `bg-${activeColor}-500 border-${activeColor}-500 text-white scale-110` 
                                            : 'border-slate-200 text-transparent bg-white'
                                          }
                                      `}>
                                          <CheckIcon className="w-4 h-4" />
                                      </div>
                                      <p className={`text-sm sm:text-base font-medium truncate ${isAssignedToActive && activeColor ? `text-${activeColor}-900` : 'text-slate-700'}`}>
                                          {item.name}
                                      </p>
                                  </div>
                                  <div className="flex -space-x-1.5 mt-2 ml-9 min-h-[20px]">
                                      {assignedPersonIds.map(pid => {
                                          const p = state.people.find(person => person.id === pid);
                                          if (!p) return null;
                                          return (
                                            <div key={pid} 
                                                className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[9px] text-white font-bold uppercase shadow-sm
                                                ${getPersonColorClass(pid)}`}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 lg:px-0">
                    {/* Total Adjustment Section - Compact Single Line */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[64px] justify-center">
                        {!editingTotal.active ? (
                            <button 
                                onClick={openTotalEdit}
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
                                        onChange={(e) => setEditingTotal(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                                        className="w-full pl-6 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-base"
                                    />
                                </div>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={applyTotalEdit}
                                    title="Apply"
                                    className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90"
                                  >
                                    <CheckIcon className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={cancelTotalEdit}
                                    title="Cancel"
                                    className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90"
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Discount Section - Compact Single Line */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[64px] justify-center">
                        {!editingDiscount.active && state.discount === 0 ? (
                            <button 
                                onClick={openDiscountEdit}
                                className="w-full h-full p-4 flex items-center justify-center gap-2 text-indigo-600 font-semibold hover:bg-indigo-50 transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" />
                                <span>Add Discount</span>
                            </button>
                        ) : !editingDiscount.active && state.discount > 0 ? (
                          <button 
                              onClick={openDiscountEdit}
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
                                        onChange={(e) => setEditingDiscount(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                                        className="w-full pl-3 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-base"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">%</span>
                                </div>
                                <div className="flex gap-1">
                                  <button 
                                    onClick={applyDiscountEdit}
                                    title="Apply"
                                    className="p-1.5 rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors shadow-sm active:scale-90"
                                  >
                                    <CheckIcon className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={cancelDiscountEdit}
                                    title="Cancel"
                                    className="p-1.5 rounded-lg text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90"
                                  >
                                    <XIcon className="w-4 h-4" />
                                  </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary of logic */}
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
                          {state.people.map(person => {
                              const itemCount = Object.values(state.assignments).filter((ids) => (ids as string[]).includes(person.id)).length;
                              return (
                                  <PersonCard 
                                      key={person.id}
                                      person={person}
                                      isSelected={activePersonId === person.id}
                                      total={personTotals[person.id] || 0}
                                      onClick={() => setActivePersonId(person.id)}
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
                            onClick={handleShare}
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
                <button 
                  onClick={handleShare}
                  className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs"
                >
                  <ShareIcon className="w-3.5 h-3.5" />
                  Share Split
                </button>
              </div>
              <div className="flex overflow-x-auto px-4 py-3 gap-3 no-scrollbar items-center">
                {state.people.map(person => {
                   const isActive = person.id === activePersonId;
                   const total = personTotals[person.id] || 0;
                   
                   return (
                     <button
                       key={person.id}
                       onClick={() => setActivePersonId(person.id)}
                       className={`flex flex-col items-center flex-shrink-0 transition-all duration-200 ${isActive ? 'opacity-100 transform -translate-y-1' : 'opacity-60'}`}
                       style={{ minWidth: '70px' }}
                     >
                       <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm mb-1 border-2 transition-colors
                          ${isActive ? `border-${person.color}-600 bg-${person.color}-500 shadow-md` : `border-transparent bg-${person.color}-400`}`}>
                          {person.name.charAt(0)}
                          {isActive && (
                            <div className={`absolute -top-1 -right-1 w-4 h-4 bg-${person.color}-600 rounded-full border-2 border-white flex items-center justify-center`}>
                              <CheckIcon className="w-2.5 h-2.5 text-white" />
                            </div>
                          )}
                       </div>
                       <span className={`text-[11px] font-bold truncate max-w-[64px] ${isActive ? 'text-slate-800' : 'text-slate-500'}`}>
                          {person.name.split(' ')[0]}
                       </span>
                       <span className={`text-[10px] font-semibold ${isActive ? `text-${person.color}-600` : 'text-slate-400'}`}>
                          {formatCurrency(total)}
                       </span>
                     </button>
                   )
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
