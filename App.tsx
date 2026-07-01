
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Person, AssignmentState, UnitWeightState, ReceiptItem } from './types';
import { analyzeReceipt } from './services/receiptService';
import { getUser, getUserFirstName, isAuthResolving, subscribe, initGoogleSignIn, signOut, AuthUser } from './services/auth';
import { Receipt, Check, RotateCcw, AlertCircle, LogOut } from 'lucide-react';
import { formatCurrency } from './utils/currency';
import { makeId } from './utils/id';
import { ConfirmDialog } from './components/ConfirmDialog';
import { UploadStep } from './components/UploadStep';
import { AnalyzingStep } from './components/AnalyzingStep';
import { SplittingStep } from './components/SplittingStep';
import { computeStats } from './state/stats';
import { createPerson } from './components/personColors';
import { pickContacts } from './utils/contacts';
import { getInitialPeople, makeInitialState, savePeople, clearPeople, saveSession, saveSessionImage, hasSavedPeople } from './state/session';

export default function App() {
  const [state, setState] = useState<AppState>(makeInitialState);

  const [activePersonId, setActivePersonId] = useState<string | null>(state.people[0]?.id || null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  // Gates the Share action when money is still unassigned (see handleShare).
  const [showUnassignedShareConfirm, setShowUnassignedShareConfirm] = useState(false);
  // Lightweight toast: a message plus a variant that picks the icon/accent.
  // Replaces browser alert()s for transient feedback (copy confirmations, image
  // errors) so notices stay in-app and on-brand.
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);
  const notify = (message: string, variant: 'success' | 'error' = 'success') => setToast({ message, variant });
  // Transient UI flag (not persisted): flips the item list between assign mode
  // and edit mode where rows become editable name/qty/price fields.
  const [isEditingItems, setIsEditingItems] = useState(false);
  // Snapshot of items/assignments taken when edit mode opens. Edits apply live,
  // so Cancel restores this snapshot; Done (commit) just discards it.
  const editSnapshot = useRef<Pick<AppState, 'items' | 'assignments' | 'unitWeights'> | null>(null);
  // Same idea for the People list: snapshot people + assignments when inline
  // people-edit mode opens, so Cancel can revert renames/removes/adds (which
  // otherwise persist live).
  const peopleSnapshot = useRef<Pick<AppState, 'people' | 'assignments' | 'unitWeights'> | null>(null);

  // Auth: subscribe to sign-in state from the Google Identity wrapper.
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const [resolvingAuth, setResolvingAuth] = useState<boolean>(() => isAuthResolving());
  const signInButtonRef = useRef<HTMLDivElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  // Why the sign-in button can't be shown, if it can't: 'config' when the app
  // is missing its Google client id (a deploy misconfiguration), 'unavailable'
  // when the Google Identity script never loaded (blocked/offline). Either way
  // we surface a message so the sign-in screen is never just a dead logo.
  const [signInError, setSignInError] = useState<'config' | 'unavailable' | null>(null);

  useEffect(() => subscribe(() => {
    setUser(getUser());
    setResolvingAuth(isAuthResolving());
  }), []);

  // Close the account dropdown on outside click or Escape.
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen]);

  // First-time visitors sign in after mount, when the people list is still the
  // untouched default. Seed Person #1 with their first name once we know it.
  // Only touches a still-pristine p1 (never a customized/saved list) and isn't
  // persisted here — it saves later if the user edits anything, like other defaults.
  useEffect(() => {
    const first = getUserFirstName();
    if (!first || hasSavedPeople()) return;
    setState(prev => {
      const p1 = prev.people[0];
      if (!p1 || p1.id !== 'p1' || p1.name !== 'Person #1') return prev;
      return { ...prev, people: prev.people.map(p => p.id === 'p1' ? { ...p, name: first } : p) };
    });
  }, [user]);

  // Initialize GIS whenever we're signed out (this also fires the silent
  // re-auth prompt for remembered users) and render the fallback Sign-In
  // button. Poll briefly in case the script loads after mount.
  useEffect(() => {
    if (user || !signInButtonRef.current) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      // No client id configured — GIS can't be initialized at all. Stop the
      // launch spinner and explain, rather than leaving an empty container.
      setSignInError('config');
      setResolvingAuth(false);
      return;
    }
    setSignInError(null);
    let cancelled = false;
    // Poll for the GIS script for a bounded number of attempts (~6s). If it
    // never appears (blocked, offline, CSP), give up and show a retry message
    // instead of polling forever behind a hidden container.
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    const tryRender = () => {
      if (cancelled || !signInButtonRef.current) return;
      if ((window as any).google?.accounts?.id) {
        initGoogleSignIn(clientId, signInButtonRef.current);
      } else if (attempts++ < MAX_ATTEMPTS) {
        setTimeout(tryRender, 200);
      } else {
        setSignInError('unavailable');
        setResolvingAuth(false);
      }
    };
    tryRender();
    return () => { cancelled = true; };
  }, [user]);

  // Local state for editing to allow Apply/Cancel workflow
  const [editingTotal, setEditingTotal] = useState<{ active: boolean; value: number }>({ active: false, value: 0 });
  const [editingDiscount, setEditingDiscount] = useState<{ active: boolean; value: number }>({ active: false, value: 0 });
  // Tip editing carries the input mode too (percent vs flat amount) so the user
  // can switch units while the editor is open before applying.
  const [editingTip, setEditingTip] = useState<{ active: boolean; value: number; mode: AppState['tipMode'] }>({ active: false, value: 0, mode: 'percent' });

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
  // The receiptImage is deliberately NOT in the deps: it can be several MB and
  // changes only once per receipt, so it's written by its own effect below
  // rather than re-serialized to localStorage on every assignment tap/keystroke.
  useEffect(() => {
    saveSession(state);
  }, [state.step, state.items, state.total, state.discount, state.tip, state.tipMode, state.assignments, state.unitWeights, state.manualTotalOverride]);

  // Persist the receipt image separately, only when it actually changes.
  useEffect(() => {
    saveSessionImage(state.receiptImage);
  }, [state.receiptImage]);

  // Toast timeout
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Calculate stats derived from state
  const stats = useMemo(() => computeStats(state), [state.items, state.total, state.discount, state.tip, state.tipMode, state.assignments, state.unitWeights, state.people, state.manualEntry, state.manualTotalOverride]);
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
        tip: 0,
        tipMode: 'percent',
        assignments: {}, // Reset assignments
        unitWeights: {},
        manualEntry: false,
        manualTotalOverride: null,
      }));
    } catch (err: any) {
      setState(prev => ({
        ...prev,
        step: 'upload',
        error: err.message || "Something went wrong"
      }));
    }
  };

  // Skip the photo + AI step and start a blank split the user fills in by hand.
  // Lands directly in edit mode with one empty row ready to type into, and flags
  // manualEntry so the total tracks the sum of items instead of a scanned total.
  const startManualEntry = () => {
    setState(prev => ({
      ...prev,
      step: 'splitting',
      receiptImage: null,
      items: [{ id: makeId(), name: '', quantity: 1, originalPrice: 0 }],
      total: 0,
      discount: 0,
      tip: 0,
      tipMode: 'percent',
      assignments: {},
      unitWeights: {},
      error: null,
      manualEntry: true,
      manualTotalOverride: null,
    }));
    setIsEditingItems(true);
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

  // Assign an item to everyone at once (or clear it if everyone already has it)
  // — a shortcut for shared items like a table appetizer.
  const toggleAllAssignment = (itemId: string) => {
    setState(prev => {
      const allPersonIds = prev.people.map(p => p.id);
      const current = prev.assignments[itemId] || [];
      const everyoneHasIt = allPersonIds.length > 0 && allPersonIds.every(id => current.includes(id));
      return {
        ...prev,
        assignments: {
          ...prev.assignments,
          [itemId]: everyoneHasIt ? [] : allPersonIds,
        },
      };
    });
  };

  // Set one person's per-unit consumption weight on an item (e.g. 3 of 5 beers).
  // Weights are relative — they divide the line total proportionally rather than
  // needing to sum to the quantity. Setting a weight implies the person is on the
  // item, so we also ensure they're assigned. A weight of 0 means "consumed none"
  // → drop them from both the weights and the assignment. Empty weight entries are
  // pruned so an item with no explicit weights falls back to a plain equal split.
  const setUnitWeight = (itemId: string, personId: string, weight: number) => {
    const w = Math.max(0, Math.round(weight || 0));
    setState(prev => {
      const currentAssigned = prev.assignments[itemId] || [];
      const itemWeights = { ...(prev.unitWeights[itemId] || {}) };
      let assignedForItem: string[];

      if (w === 0) {
        delete itemWeights[personId];
        assignedForItem = currentAssigned.filter(id => id !== personId);
      } else {
        itemWeights[personId] = w;
        assignedForItem = currentAssigned.includes(personId)
          ? currentAssigned
          : [...currentAssigned, personId];
      }

      const nextUnitWeights = { ...prev.unitWeights };
      if (Object.keys(itemWeights).length > 0) nextUnitWeights[itemId] = itemWeights;
      else delete nextUnitWeights[itemId];

      return {
        ...prev,
        assignments: { ...prev.assignments, [itemId]: assignedForItem },
        unitWeights: nextUnitWeights,
      };
    });
  };

  // Drop an item's per-unit weights, returning it to a plain equal split across
  // whoever is assigned (the assignment itself is left untouched).
  const clearUnitWeights = (itemId: string) => {
    setState(prev => {
      if (!prev.unitWeights[itemId]) return prev;
      const { [itemId]: _removed, ...rest } = prev.unitWeights;
      return { ...prev, unitWeights: rest };
    });
  };

  // Item editing. Edits are applied live to state.items, so they recompute
  // totals (computeStats useMemo) and persist (saveSession) automatically.
  // Note: quantity is display/summary only — originalPrice is already the line
  // total per the AI prompt, so changing quantity does NOT change the price.
  const updateItem = (id: string, patch: Partial<Pick<ReceiptItem, 'name' | 'quantity' | 'originalPrice'>>) => {
    setState(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        // Normalize: quantity is a positive integer, price is non-negative.
        if (patch.quantity !== undefined) next.quantity = Math.max(1, Math.round(patch.quantity || 1));
        if (patch.originalPrice !== undefined) next.originalPrice = Math.max(0, patch.originalPrice || 0);
        return next;
      }),
    }));
  };

  const addItem = () => {
    setState(prev => ({
      ...prev,
      items: [...prev.items, { id: makeId(), name: '', quantity: 1, originalPrice: 0 }],
    }));
  };

  const deleteItem = (id: string) => {
    setState(prev => {
      // Drop the item and any assignments/weights referencing it so no orphan keys linger.
      const { [id]: _removed, ...remainingAssignments } = prev.assignments;
      const { [id]: _removedWeights, ...remainingWeights } = prev.unitWeights;
      return {
        ...prev,
        items: prev.items.filter(item => item.id !== id),
        assignments: remainingAssignments,
        unitWeights: remainingWeights,
      };
    });
  };

  // Enter edit mode (snapshotting current items/assignments so Cancel can revert)
  // or commit and leave (discarding the snapshot).
  const toggleEditItems = () => {
    if (isEditingItems) {
      // Committing: drop rows the user added but left fully empty (no name and
      // no price) — these are abandoned blanks, not real items — and clean up
      // any assignments that referenced them. A row with just a name or just a
      // price is kept, since that's a partially-entered item.
      setState(prev => {
        const kept = prev.items.filter(it => it.name.trim() !== '' || it.originalPrice > 0);
        if (kept.length === prev.items.length) return prev;
        const keptIds = new Set(kept.map(i => i.id));
        const assignments: AssignmentState = {};
        Object.entries(prev.assignments).forEach(([itemId, ids]) => {
          if (keptIds.has(itemId)) assignments[itemId] = ids as string[];
        });
        const unitWeights: UnitWeightState = {};
        Object.entries(prev.unitWeights).forEach(([itemId, weights]) => {
          if (keptIds.has(itemId)) unitWeights[itemId] = weights as { [personId: string]: number };
        });
        return { ...prev, items: kept, assignments, unitWeights };
      });
      editSnapshot.current = null;
      setIsEditingItems(false);
    } else {
      editSnapshot.current = { items: state.items, assignments: state.assignments, unitWeights: state.unitWeights };
      setIsEditingItems(true);
    }
  };

  // Abandon edits: restore the snapshot taken when edit mode opened, then leave.
  const cancelEditItems = () => {
    if (editSnapshot.current) {
      const snap = editSnapshot.current;
      setState(prev => ({ ...prev, items: snap.items, assignments: snap.assignments, unitWeights: snap.unitWeights }));
      editSnapshot.current = null;
    }
    setIsEditingItems(false);
  };

  // Snapshot the people list when inline edit mode opens, so a later Cancel can
  // revert. Renames/removes/adds save live, so we capture assignments too (a
  // removal prunes them).
  const startEditPeople = () => {
    peopleSnapshot.current = { people: state.people, assignments: state.assignments, unitWeights: state.unitWeights };
  };

  // Abandon people edits: restore the snapshot to state and re-persist it,
  // undoing any live saves made while editing.
  const cancelEditPeople = () => {
    const snap = peopleSnapshot.current;
    if (snap) {
      setState(prev => ({ ...prev, people: snap.people, assignments: snap.assignments, unitWeights: snap.unitWeights }));
      savePeople(snap.people);
      peopleSnapshot.current = null;
    }
  };

  const handleReset = () => setShowResetConfirm(true);

  const performReset = () => {
    setState(prev => ({
      ...prev,
      step: 'upload',
      receiptImage: null,
      items: [],
      total: 0,
      discount: 0,
      tip: 0,
      tipMode: 'percent',
      assignments: {},
      unitWeights: {},
      error: null,
      manualEntry: false,
      manualTotalOverride: null,
    }));
    setEditingTotal({ active: false, value: 0 });
    setEditingDiscount({ active: false, value: 0 });
    setEditingTip({ active: false, value: 0, mode: 'percent' });
    setIsEditingItems(false);
    setShowResetConfirm(false);
  };

  // Quick-add a participant from the splitting view (no modal): append an
  // auto-named, auto-colored person, persist, and select them so the next item
  // tap assigns to them immediately.
  const handleAddPerson = () => {
    const newPerson = createPerson(state.people);
    const newPeople = [...state.people, newPerson];
    setState(prev => ({ ...prev, people: newPeople }));
    savePeople(newPeople);
    setActivePersonId(newPerson.id);
  };

  // Add one person per contact picked from the OS contact picker (Android
  // Chrome/Edge only; the button that calls this is hidden elsewhere). Builds all
  // new people in a single state update so colors/default numbers don't collide.
  const handleAddPeopleFromContacts = async () => {
    const contacts = await pickContacts();
    if (contacts.length === 0) return;
    // Accumulate against a growing list so createPerson sees each prior addition
    // when picking the next color / default name. Suffix the id with the index
    // because createPerson's `p${Date.now()}` id collides within a single tick.
    const added: typeof state.people = [];
    contacts.forEach(({ name, photo }, i) => {
      const person = createPerson([...state.people, ...added], name || undefined);
      added.push({ ...person, id: `${person.id}-${i}`, ...(photo ? { photo } : {}) });
    });
    const newPeople = [...state.people, ...added];
    setState(prev => ({ ...prev, people: newPeople }));
    savePeople(newPeople);
    setActivePersonId(added[added.length - 1].id);
  };

  // Inline rename from the splitting view's "Edit" mode. Live as the user types;
  // ids are unchanged so assignments are untouched.
  const renamePerson = (id: string, name: string) => {
    const people = state.people.map(p => (p.id === id ? { ...p, name } : p));
    setState(prev => ({ ...prev, people }));
    savePeople(people);
  };

  // Inline remove from the splitting view. Drops the person and prunes their
  // item assignments so no orphan ids linger. Always keep at least one person.
  const removePerson = (id: string) => {
    if (state.people.length <= 1) return;
    const newPeople = state.people.filter(p => p.id !== id);
    const remainingIds = new Set(newPeople.map(p => p.id));
    const newAssignments: AssignmentState = {};
    Object.entries(state.assignments).forEach(([itemId, personIds]) => {
      const filteredIds = (personIds as string[]).filter(pid => remainingIds.has(pid));
      if (filteredIds.length > 0) newAssignments[itemId] = filteredIds;
    });
    // Prune the removed person from any per-item weights too, dropping now-empty entries.
    const newUnitWeights: UnitWeightState = {};
    Object.entries(state.unitWeights).forEach(([itemId, weights]) => {
      const kept: { [personId: string]: number } = {};
      Object.entries(weights as { [personId: string]: number }).forEach(([pid, w]) => { if (remainingIds.has(pid)) kept[pid] = w; });
      if (Object.keys(kept).length > 0) newUnitWeights[itemId] = kept;
    });
    setState(prev => ({ ...prev, people: newPeople, assignments: newAssignments, unitWeights: newUnitWeights }));
    savePeople(newPeople);
  };

  const handleResetPeople = () => {
    const defaultPeople = getInitialPeople(getUserFirstName() ?? undefined);
    setState(prev => ({ ...prev, people: defaultPeople, assignments: {}, unitWeights: {} }));
    clearPeople();
  };

  // Total / discount editing handlers. In manual entry the editable figure is
  // the override (prefilled from the current items sum when none is set yet);
  // for a scanned receipt it's the scanned total.
  const openTotalEdit = () => setEditingTotal({
    active: true,
    value: state.manualEntry ? (state.manualTotalOverride ?? stats.itemsTotalSum) : state.total,
  });
  const openDiscountEdit = () => setEditingDiscount({ active: true, value: state.discount });
  const openTipEdit = () => setEditingTip({ active: true, value: state.tip, mode: state.tipMode });

  const applyTotalEdit = () => {
    setState(prev => prev.manualEntry
      ? { ...prev, manualTotalOverride: Math.max(0, editingTotal.value) }
      : { ...prev, total: Math.max(0, editingTotal.value) });
    setEditingTotal({ active: false, value: 0 });
  };

  // Manual entry only: drop the pinned total and go back to tracking the items
  // sum automatically.
  const clearTotalOverride = () => {
    setState(prev => ({ ...prev, manualTotalOverride: null }));
    setEditingTotal({ active: false, value: 0 });
  };

  const applyDiscountEdit = () => {
    setState(prev => ({ ...prev, discount: Math.min(100, Math.max(0, editingDiscount.value)) }));
    setEditingDiscount({ active: false, value: 0 });
  };

  // Tip applies the value in whichever unit the editor is in. A percentage is
  // capped at 100% (matching discount); a flat amount is only floored at 0.
  const applyTipEdit = () => {
    setState(prev => ({
      ...prev,
      tipMode: editingTip.mode,
      tip: editingTip.mode === 'percent'
        ? Math.min(100, Math.max(0, editingTip.value))
        : Math.max(0, editingTip.value),
    }));
    setEditingTip({ active: false, value: 0, mode: 'percent' });
  };

  // Clear the tip entirely (back to no tip), collapsing the editor.
  const clearTip = () => {
    setState(prev => ({ ...prev, tip: 0 }));
    setEditingTip({ active: false, value: 0, mode: 'percent' });
  };

  const cancelTotalEdit = () => setEditingTotal({ active: false, value: 0 });
  const cancelDiscountEdit = () => setEditingDiscount({ active: false, value: 0 });
  const cancelTipEdit = () => setEditingTip({ active: false, value: 0, mode: 'percent' });

  const generateSummaryText = () => {
    let text = `🧾 SplitSmart: Receipt Summary\n`;
    text += `Total Amount: ${formatCurrency(effectiveTotal)}\n`;
    if (stats.tipAmount > 0) {
      const tipNote = state.tipMode === 'percent' ? ` (${state.tip}%)` : '';
      text += `(incl. ${formatCurrency(stats.tipAmount)} tip${tipNote})\n`;
    }
    text += `---------------------------------\n`;

    state.people.forEach(person => {
      const total = personTotals[person.id] || 0;
      if (total > 0.01) {
        text += `${person.name.toUpperCase()}: ${formatCurrency(total)}\n`;

        const assignedItems = state.items.filter(item => (state.assignments[item.id] || []).includes(person.id));

        assignedItems.forEach(item => {
          const shareCount = (state.assignments[item.id] || []).length;
          const qtyStr = item.quantity > 1 ? `${item.quantity}× ` : ``;
          const weight = state.unitWeights[item.id]?.[person.id];
          // Weighted line: show this person's units out of the quantity, e.g.
          // "(3 of 5)". Otherwise fall back to the plain "split N ways" note.
          const priceStr = weight !== undefined
            ? ` (${weight} of ${item.quantity})`
            : shareCount > 1 ? ` (split ${shareCount} ways)` : ``;
          text += ` • ${qtyStr}${item.name}${priceStr}\n`;
        });
        text += `\n`;
      }
    });

    if (unassignedTotal > 0.05) {
      text += `⚠️ UNASSIGNED: ${formatCurrency(unassignedTotal)}\n\n`;
    }

    return text;
  };

  // Turn the stored receipt data URL into a File so it can ride along in the
  // native share sheet (e.g. attach the photo to a WhatsApp message). Returns
  // null if there's no image (manual entry) or the data URL can't be parsed.
  const receiptImageToFile = async (): Promise<File | null> => {
    const dataUrl = state.receiptImage;
    if (!dataUrl || !dataUrl.startsWith('data:')) return null;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      return new File([blob], `receipt.${ext}`, { type: blob.type || 'image/jpeg' });
    } catch {
      return null;
    }
  };

  // Share is gated when money is still unassigned: the summary would go out
  // with a "⚠️ UNASSIGNED" line and the per-person amounts wouldn't add up to
  // the total. Ask first so the sender notices before it reaches the group.
  const performShare = async () => {
    const summary = generateSummaryText();

    if (navigator.share) {
      try {
        // Attach the receipt photo when the platform supports file sharing,
        // so the recipient gets the image alongside the breakdown.
        const file = await receiptImageToFile();
        const withFiles = file ? { files: [file] } : null;
        if (withFiles && navigator.canShare?.(withFiles)) {
          await navigator.share({ title: 'SplitSmart Receipt Summary', text: summary, ...withFiles });
        } else {
          await navigator.share({ title: 'SplitSmart Receipt Summary', text: summary });
        }
      } catch (err: any) {
        // Dismissing the native share sheet rejects with AbortError — that's a
        // normal user action, not a failure, so don't surface it.
        if (err?.name !== 'AbortError') console.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(summary);
        notify("Detailed summary copied!");
      } catch (err) {
        console.error('Failed to copy:', err);
        notify("Could not copy to clipboard.", 'error');
      }
    }
  };

  // Entry point for the Share buttons: if there's meaningfully unassigned money
  // (same threshold the summary uses to print its UNASSIGNED warning), confirm
  // first; otherwise share straight away.
  const handleShare = () => {
    if (unassignedTotal > 0.05) {
      setShowUnassignedShareConfirm(true);
      return;
    }
    void performShare();
  };

  const activePerson = state.people.find(p => p.id === activePersonId);

  // Gate the whole app behind Google Sign-In.
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center px-6 animate-fade-in">
        <div className="bg-indigo-600 p-3 rounded-2xl text-white mb-6">
          <Receipt className="w-8 h-8" />
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
        {/* Kept mounted (hidden while resolving or errored) so GIS can still
            initialize and run the silent re-auth prompt; revealed if the silent
            attempt fails. Hidden when we know no button can render. */}
        <div ref={signInButtonRef} className={resolvingAuth || signInError ? 'hidden' : ''} />

        {/* Fallback so the screen is never a dead logo when sign-in can't load. */}
        {signInError && !resolvingAuth && (
          <div className="mt-2 max-w-sm w-full text-center" role="alert">
            <div className="flex items-start gap-3 text-left bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                {signInError === 'config' ? (
                  <p>Sign-in isn't configured for this deployment. Please contact the app owner.</p>
                ) : (
                  <p>Couldn't reach Google Sign-In. Check your connection and try again.</p>
                )}
              </div>
            </div>
            {signInError === 'unavailable' && (
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center gap-2 bg-indigo-600 text-white font-semibold py-2.5 px-5 rounded-xl hover:bg-indigo-700 transition-all shadow-sm active:scale-95"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try again</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-0 lg:pb-20">
      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Start over?"
        message="This clears the current receipt, items, and assignments so you can scan a new one. Your saved people are kept."
        confirmLabel="Start Over"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={performReset}
        onCancel={() => setShowResetConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showUnassignedShareConfirm}
        title="Some items aren't assigned"
        message={`${formatCurrency(unassignedTotal)} isn't assigned to anyone yet, so the shares won't add up to the total. Share the summary anyway?`}
        confirmLabel="Share Anyway"
        cancelLabel="Keep Assigning"
        icon={<AlertCircle className="w-5 h-5" />}
        onConfirm={() => { setShowUnassignedShareConfirm(false); void performShare(); }}
        onCancel={() => setShowUnassignedShareConfirm(false)}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] animate-slide-down max-w-[calc(100vw-2rem)]" role="status" aria-live="polite">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-semibold border border-white/10">
            {toast.variant === 'error'
              ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              : <Check className="w-4 h-4 text-green-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              SplitSmart
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {state.step === 'splitting' && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors"
                title="Start over with a new receipt"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">New Receipt</span>
              </button>
            )}

            {/* Account menu */}
            <div className="relative" ref={accountMenuRef}>
              <button
                onClick={() => setAccountMenuOpen((o) => !o)}
                className="flex items-center justify-center w-9 h-9 rounded-full overflow-hidden ring-2 ring-transparent hover:ring-indigo-200 focus:ring-indigo-300 focus:outline-none transition-shadow"
                title={user.email}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label="Account menu"
              >
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-semibold">
                    {(user.name || user.email).trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 origin-top-right rounded-xl bg-white shadow-lg ring-1 ring-slate-200 py-1 z-40"
                >
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => { setAccountMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
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

        {state.step === 'upload' && <UploadStep onImageSelected={handleImageSelected} onManualEntry={startManualEntry} onError={(msg) => notify(msg, 'error')} />}

        {state.step === 'analyzing' && <AnalyzingStep />}

        {state.step === 'splitting' && (
          <SplittingStep
            state={state}
            stats={stats}
            manualEntry={state.manualEntry}
            receiptImage={state.receiptImage}
            activePersonId={activePersonId}
            activePerson={activePerson}
            onToggleAssignment={toggleAssignment}
            onToggleAllAssignment={toggleAllAssignment}
            unitWeights={state.unitWeights}
            onSetUnitWeight={setUnitWeight}
            onClearUnitWeights={clearUnitWeights}
            onSelectPerson={setActivePersonId}
            onAddPerson={handleAddPerson}
            onAddPeopleFromContacts={handleAddPeopleFromContacts}
            onRenamePerson={renamePerson}
            onRemovePerson={removePerson}
            onStartEditPeople={startEditPeople}
            onCancelEditPeople={cancelEditPeople}
            onResetPeople={handleResetPeople}
            onShare={handleShare}
            isEditingItems={isEditingItems}
            onToggleEditItems={toggleEditItems}
            onCancelEditItems={cancelEditItems}
            onUpdateItem={updateItem}
            onAddItem={addItem}
            onDeleteItem={deleteItem}
            editingTotal={editingTotal}
            onOpenTotalEdit={openTotalEdit}
            onChangeTotalEdit={(value) => setEditingTotal(prev => ({ ...prev, value }))}
            onApplyTotalEdit={applyTotalEdit}
            onCancelTotalEdit={cancelTotalEdit}
            onClearTotalOverride={clearTotalOverride}
            editingDiscount={editingDiscount}
            onOpenDiscountEdit={openDiscountEdit}
            onChangeDiscountEdit={(value) => setEditingDiscount(prev => ({ ...prev, value }))}
            onApplyDiscountEdit={applyDiscountEdit}
            onCancelDiscountEdit={cancelDiscountEdit}
            editingTip={editingTip}
            onOpenTipEdit={openTipEdit}
            onChangeTipEdit={(value) => setEditingTip(prev => ({ ...prev, value }))}
            onChangeTipMode={(mode) => setEditingTip(prev => ({ ...prev, mode }))}
            onApplyTipEdit={applyTipEdit}
            onCancelTipEdit={cancelTipEdit}
            onClearTip={clearTip}
          />
        )}
      </main>
    </div>
  );
}
