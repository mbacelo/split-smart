
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Person, AssignmentState } from './types';
import { analyzeReceipt } from './services/receiptService';
import { getUser, isAuthResolving, subscribe, initGoogleSignIn, signOut, AuthUser } from './services/auth';
import { ReceiptIcon, CheckIcon, SettingsIcon } from './components/Icons';
import { formatCurrency } from './utils/currency';
import { SettingsModal } from './components/SettingsModal';
import { UploadStep } from './components/UploadStep';
import { AnalyzingStep } from './components/AnalyzingStep';
import { SplittingStep } from './components/SplittingStep';
import { computeStats } from './state/stats';
import { getInitialPeople, makeInitialState, savePeople, clearPeople, saveSession } from './state/session';

export default function App() {
  const [state, setState] = useState<AppState>(makeInitialState);

  const [activePersonId, setActivePersonId] = useState<string | null>(state.people[0]?.id || null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Auth: subscribe to sign-in state from the Google Identity wrapper.
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const [resolvingAuth, setResolvingAuth] = useState<boolean>(() => isAuthResolving());
  const signInButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribe(() => {
    setUser(getUser());
    setResolvingAuth(isAuthResolving());
  }), []);

  // Initialize GIS whenever we're signed out (this also fires the silent
  // re-auth prompt for remembered users) and render the fallback Sign-In
  // button. Poll briefly in case the script loads after mount.
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

  // Persist the in-progress split session so a refresh doesn't lose work
  // (and force another paid AI call). Cleared automatically when not splitting.
  useEffect(() => {
    saveSession(state);
  }, [state.step, state.items, state.total, state.discount, state.assignments]);

  // Toast timeout
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // Calculate stats derived from state
  const stats = useMemo(() => computeStats(state), [state.items, state.total, state.discount, state.assignments, state.people]);
  const { personTotals, effectiveTotal, unassignedTotal } = stats;

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
      const newAssignments = currentAssignments.includes(activePersonId)
        ? currentAssignments.filter(id => id !== activePersonId)
        : [...currentAssignments, activePersonId];

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

    setState(prev => ({ ...prev, people: newPeople, assignments: newAssignments }));
    savePeople(newPeople);
  };

  const handleResetPeople = () => {
    const defaultPeople = getInitialPeople();
    setState(prev => ({ ...prev, people: defaultPeople, assignments: {} }));
    clearPeople();
  };

  // Total / discount editing handlers
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

        const assignedItems = state.items.filter(item => (state.assignments[item.id] || []).includes(person.id));

        assignedItems.forEach(item => {
          const shareCount = (state.assignments[item.id] || []).length;
          const qtyStr = item.quantity > 1 ? `${item.quantity}× ` : ``;
          const priceStr = shareCount > 1 ? ` (split ${shareCount} ways)` : ``;
          text += ` • ${qtyStr}${item.name}${priceStr}\n`;
        });
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
        await navigator.share({ title: 'SplitSmart Receipt Summary', text: summary });
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
        {resolvingAuth && (
          <div className="flex items-center gap-3 text-slate-500" role="status" aria-live="polite">
            <svg className="animate-spin w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-sm font-medium">Signing you in…</span>
          </div>
        )}
        {/* Kept mounted (hidden while resolving) so GIS can initialize and run
            the silent re-auth prompt; revealed if the silent attempt fails. */}
        <div ref={signInButtonRef} className={resolvingAuth ? 'hidden' : ''} />
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
            <button onClick={() => setState(s => ({ ...s, error: null }))} className="text-sm underline font-semibold">Dismiss</button>
          </div>
        )}

        {state.step === 'upload' && <UploadStep onImageSelected={handleImageSelected} />}

        {state.step === 'analyzing' && <AnalyzingStep />}

        {state.step === 'splitting' && (
          <SplittingStep
            state={state}
            stats={stats}
            activePersonId={activePersonId}
            activePerson={activePerson}
            onToggleAssignment={toggleAssignment}
            onSelectPerson={setActivePersonId}
            onShare={handleShare}
            editingTotal={editingTotal}
            onOpenTotalEdit={openTotalEdit}
            onChangeTotalEdit={(value) => setEditingTotal(prev => ({ ...prev, value }))}
            onApplyTotalEdit={applyTotalEdit}
            onCancelTotalEdit={cancelTotalEdit}
            editingDiscount={editingDiscount}
            onOpenDiscountEdit={openDiscountEdit}
            onChangeDiscountEdit={(value) => setEditingDiscount(prev => ({ ...prev, value }))}
            onApplyDiscountEdit={applyDiscountEdit}
            onCancelDiscountEdit={cancelDiscountEdit}
          />
        )}
      </main>
    </div>
  );
}
