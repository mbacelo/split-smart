
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState, Person, AssignmentState, UnitWeightState, ReceiptItem } from './types';
import { analyzeReceipt, ApiError } from './services/receiptService';
import { getUser, getUserFirstName, getSignInMethod, signOut } from './services/auth';
import { trackEvent, identifyUser } from './services/analytics';
import { useAuth } from './hooks/useAuth';
import { useAdmin } from './hooks/useAdmin';
import { useSessionPersistence } from './hooks/useSessionPersistence';
import { useEditSnapshot } from './hooks/useEditSnapshot';
import { Receipt, Check, RotateCcw, AlertCircle, LogOut, LogIn, ShieldCheck } from 'lucide-react';
import { formatCurrency } from './utils/currency';
import { makeId } from './utils/id';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SignInGate } from './components/SignInGate';
import { WaitlistPrompt } from './components/WaitlistPrompt';
import { AccessManager } from './components/AccessManager';
import { UploadStep } from './components/UploadStep';
import { AnalyzingStep } from './components/AnalyzingStep';
import { SplittingStep } from './components/SplittingStep';
import { computeStats } from './state/stats';
import { createPerson } from './components/personColors';
import { pickContacts } from './utils/contacts';
import { getInitialPeople, makeInitialState, savePeople, clearPeople, hasSavedPeople } from './state/session';

export default function App() {
  const [state, setState] = useState<AppState>(makeInitialState);

  const [activePersonId, setActivePersonId] = useState<string | null>(state.people[0]?.id || null);
  // Gates the Share action when money is still unassigned (see handleShare).
  const [showUnassignedShareConfirm, setShowUnassignedShareConfirm] = useState(false);
  // Lightweight toast: a message plus a variant that picks the icon/accent.
  // Replaces browser alert()s for transient feedback (copy confirmations, image
  // errors) so notices stay in-app and on-brand. An optional action (Undo) lets
  // a destructive tap apply immediately instead of behind a confirm dialog.
  type ToastAction = { label: string; onClick: () => void };
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error'; action?: ToastAction } | null>(null);
  const notify = (message: string, variant: 'success' | 'error' = 'success', action?: ToastAction) =>
    setToast({ message, variant, action });
  // Transient UI flag (not persisted): flips the item list between assign mode
  // and edit mode where rows become editable name/qty/price fields.
  const [isEditingItems, setIsEditingItems] = useState(false);
  // Edits apply live, so entering an edit mode snapshots the affected slice and
  // Cancel restores it — one snapshot for the items list, one for People.
  const itemsSnapshot = useEditSnapshot<Pick<AppState, 'items' | 'assignments' | 'unitWeights'>>();
  const peopleSnapshot = useEditSnapshot<Pick<AppState, 'people' | 'assignments' | 'unitWeights'>>();

  // Sign-in is only required for the AI scan, so the app renders for everyone
  // and this gate opens on demand (scan attempt while signed out, or the
  // header's Sign in button).
  const [signInGateOpen, setSignInGateOpen] = useState(false);
  // Offered when the server rejects a scan with 403 not_allowlisted.
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  // Image picked while signed out, waiting for sign-in to complete so the scan
  // can resume without the user re-picking the photo.
  const pendingImageRef = useRef<string | null>(null);

  // Google Sign-In: signed-in user, launch spinner, GIS button container, and
  // the account dropdown. All auth plumbing lives in the hook. GIS initializes
  // at mount (silent re-auth for remembered users); the Sign In button renders
  // only while the gate is open.
  const {
    user,
    resolvingAuth,
    signInError,
    signInButtonRef,
    accountMenuOpen,
    setAccountMenuOpen,
    accountMenuRef,
  } = useAuth(signInGateOpen);

  // Admins (ADMIN_EMAILS, server-side) get a Manage access entry in the account
  // menu for approving waitlist requests. Regular users see nothing new — the
  // probe fails silently for them.
  const admin = useAdmin(user);
  const [accessManagerOpen, setAccessManagerOpen] = useState(false);

  // First-time visitors sign in after mount, when the people list is still the
  // untouched default. Seed Person #1 with their first name (and Google photo,
  // if any) once we know it. Only touches a still-pristine p1 (never a
  // customized/saved list) and isn't persisted here — it saves later if the user
  // edits anything, like other defaults.
  useEffect(() => {
    const first = getUserFirstName();
    if (!first || hasSavedPeople()) return;
    const picture = getUser()?.picture;
    setState(prev => {
      const p1 = prev.people[0];
      if (!p1 || p1.id !== 'p1' || p1.name !== 'Person #1') return prev;
      return { ...prev, people: prev.people.map(p => p.id === 'p1' ? { ...p, name: first, ...(picture ? { photo: picture } : {}) } : p) };
    });
  }, [user]);

  // Analytics: once a user is signed in, tie events to them and fire signed-in
  // exactly once per account (a ref guards against re-fires on re-render within
  // the same page load). The ref resets on reload, so the event still fires per
  // page load — `method` is what distinguishes a real sign-in ('interactive')
  // from a silent auto-select or restored session in dashboards.
  const identifiedEmailRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || identifiedEmailRef.current === user.email) return;
    identifiedEmailRef.current = user.email;
    identifyUser(user.email);
    trackEvent('signed-in', { method: getSignInMethod() ?? 'unknown' });
  }, [user]);

  // Sync activePersonId if current people list changes
  useEffect(() => {
    if (!activePersonId && state.people.length > 0) {
      setActivePersonId(state.people[0].id);
    } else if (activePersonId && !state.people.some(p => p.id === activePersonId)) {
      setActivePersonId(state.people.length > 0 ? state.people[0].id : null);
    }
  }, [state.people, activePersonId]);

  // Persist the in-progress split (and its receipt image, on a separate key).
  useSessionPersistence(state);

  // Toast timeout — longer when it offers an action, so there's time to hit Undo.
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), toast.action ? 6000 : 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Calculate stats derived from state. `state` is a single immutable object,
  // so depending on it directly can never miss a field that affects the math.
  const stats = useMemo(() => computeStats(state), [state]);
  const { personTotals, effectiveTotal, unassignedTotal } = stats;

  // Lets the user abort an in-flight receipt analysis (see AnalyzingStep's
  // Cancel button) instead of waiting out a slow/hung AI call.
  const analyzeAbortRef = useRef<AbortController | null>(null);

  const handleImageSelected = async (base64: string) => {
    // The AI scan is the only paid/authenticated feature: if the user isn't
    // signed in yet, hold the image and open the sign-in gate. The effect
    // below resumes the scan automatically once sign-in completes.
    if (!user) {
      pendingImageRef.current = base64;
      trackEvent('scan-sign-in-prompted');
      setSignInGateOpen(true);
      return;
    }
    trackEvent('receipt-upload-started');
    setState(prev => ({ ...prev, step: 'analyzing', receiptImage: base64, error: null }));
    const controller = new AbortController();
    analyzeAbortRef.current = controller;

    try {
      const result = await analyzeReceipt(base64, controller.signal);
      // If the user cancelled while the response was landing, stay cancelled.
      if (controller.signal.aborted) return;
      trackEvent('receipt-scan-succeeded', { itemCount: result.items.length });
      setState(prev => ({
        ...prev,
        step: 'splitting',
        items: result.items,
        total: result.total,
        // Older servers didn't send charges; the breakdown just shows the gap.
        charges: result.charges ?? [],
        discount: 0,
        tip: 0,
        tipMode: 'percent',
        assignments: {}, // Reset assignments
        unitWeights: {},
        manualEntry: false,
        manualTotalOverride: null,
      }));
    } catch (err: any) {
      // A user-initiated cancel already reset the state — don't surface it.
      if (err?.name === 'AbortError') return;
      // Not on the allowlist: offer the waitlist instead of a generic error.
      // Keep the image so an approved user can retry without re-shooting.
      if (err instanceof ApiError && err.code === 'not_allowlisted') {
        trackEvent('waitlist-prompted');
        setState(prev => ({ ...prev, step: 'upload', error: null }));
        setWaitlistOpen(true);
        return;
      }
      trackEvent('receipt-scan-failed', { reason: err?.message || 'unknown' });
      // Keep receiptImage so the error banner can offer "Try again" without
      // making the user re-shoot the photo for a transient failure.
      setState(prev => ({
        ...prev,
        step: 'upload',
        error: err.message || "Something went wrong"
      }));
    } finally {
      if (analyzeAbortRef.current === controller) analyzeAbortRef.current = null;
    }
  };

  // Resume a scan that was interrupted by the sign-in gate: as soon as sign-in
  // completes with a photo still pending, close the gate and analyze it so the
  // user doesn't have to re-pick the image.
  useEffect(() => {
    if (!user || !pendingImageRef.current) return;
    const pending = pendingImageRef.current;
    pendingImageRef.current = null;
    setSignInGateOpen(false);
    void handleImageSelected(pending);
  }, [user]);

  // Dismissing the gate abandons the pending scan (the user chose not to sign
  // in); manual entry and the rest of the app stay fully usable.
  const closeSignInGate = () => {
    pendingImageRef.current = null;
    setSignInGateOpen(false);
  };

  // Abort the in-flight analysis and return to the upload step.
  const cancelAnalyze = () => {
    trackEvent('receipt-scan-cancelled');
    analyzeAbortRef.current?.abort();
    analyzeAbortRef.current = null;
    setState(prev => ({ ...prev, step: 'upload', receiptImage: null, error: null }));
  };

  // Skip the photo + AI step and start a blank split the user fills in by hand.
  // Lands directly in edit mode with one empty row ready to type into, and flags
  // manualEntry so the total tracks the sum of items instead of a scanned total.
  const startManualEntry = () => {
    trackEvent('enter-items-manually');
    setState(prev => ({
      ...prev,
      step: 'splitting',
      receiptImage: null,
      items: [{ id: makeId(), name: '', quantity: 1, originalPrice: 0 }],
      total: 0,
      charges: [],
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

  // True while the current split has nothing assigned yet (cleared items leave
  // empty arrays behind, so check lengths, not keys). Used to emit the
  // first-item-assigned funnel milestone exactly once per split.
  const hasNoAssignments = Object.values(state.assignments).every(ids => ids.length === 0);

  const toggleAssignment = (itemId: string) => {
    if (!activePersonId) return;
    const alreadyAssigned = (state.assignments[itemId] || []).includes(activePersonId);
    if (hasNoAssignments && !alreadyAssigned) trackEvent('first-item-assigned');

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
    // With nothing assigned yet, "everyone has it" can't be true, so this
    // tap necessarily assigns.
    if (hasNoAssignments && state.people.length > 0) trackEvent('first-item-assigned');
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
    // A positive weight implies an assignment (see below).
    if (hasNoAssignments && w > 0) trackEvent('first-item-assigned');
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
      itemsSnapshot.discard();
      setIsEditingItems(false);
    } else {
      itemsSnapshot.take({ items: state.items, assignments: state.assignments, unitWeights: state.unitWeights });
      setIsEditingItems(true);
    }
  };

  // Abandon edits: restore the snapshot taken when edit mode opened, then leave.
  const cancelEditItems = () => {
    const snap = itemsSnapshot.restore();
    if (snap) {
      setState(prev => ({ ...prev, items: snap.items, assignments: snap.assignments, unitWeights: snap.unitWeights }));
    }
    setIsEditingItems(false);
  };

  // Snapshot the people list when inline edit mode opens, so a later Cancel can
  // revert. Renames/removes/adds save live, so we capture assignments too (a
  // removal prunes them).
  const startEditPeople = () => {
    peopleSnapshot.take({ people: state.people, assignments: state.assignments, unitWeights: state.unitWeights });
  };

  // Abandon people edits: restore the snapshot to state and re-persist it,
  // undoing any live saves made while editing.
  const cancelEditPeople = () => {
    const snap = peopleSnapshot.restore();
    if (snap) {
      setState(prev => ({ ...prev, people: snap.people, assignments: snap.assignments, unitWeights: snap.unitWeights }));
      savePeople(snap.people);
    }
  };

  // Start over applies immediately and offers Undo in a toast, rather than a
  // confirm dialog — faster, and a mis-tap on the header button is recoverable.
  const handleReset = () => {
    trackEvent('receipt-reset');
    // People are kept by reset, so the undo restores everything but them.
    const { people: _people, ...before } = state;
    const wasEditingItems = isEditingItems;
    notify('Receipt cleared', 'success', {
      label: 'Undo',
      onClick: () => {
        trackEvent('receipt-reset-undone');
        // Only while still on the upload screen: if a new scan or manual
        // split has started since, restoring would clobber it.
        setState(prev => (prev.step === 'upload' ? { ...prev, ...before } : prev));
        setIsEditingItems(wasEditingItems);
      },
    });
    setState(prev => ({
      ...prev,
      step: 'upload',
      receiptImage: null,
      items: [],
      total: 0,
      charges: [],
      discount: 0,
      tip: 0,
      tipMode: 'percent',
      assignments: {},
      unitWeights: {},
      error: null,
      manualEntry: false,
      manualTotalOverride: null,
    }));
    setIsEditingItems(false);
  };

  // Quick-add a participant from the splitting view (no modal): append an
  // auto-named, auto-colored person, persist, and select them so the next item
  // tap assigns to them immediately.
  const handleAddPerson = () => {
    const newPerson = createPerson(state.people);
    const newPeople = [...state.people, newPerson];
    trackEvent('person-added', { peopleCount: newPeople.length });
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
    // when picking the next color / default name.
    const added: typeof state.people = [];
    contacts.forEach(({ name, photo }) => {
      const person = createPerson([...state.people, ...added], name || undefined);
      added.push({ ...person, ...(photo ? { photo } : {}) });
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

  // Restore default people also applies immediately with an Undo toast.
  const handleResetPeople = () => {
    const before = { people: state.people, assignments: state.assignments, unitWeights: state.unitWeights };
    const hadSavedPeople = hasSavedPeople();
    const defaultPeople = getInitialPeople(getUserFirstName() ?? undefined, getUser()?.picture ?? undefined);
    setState(prev => ({ ...prev, people: defaultPeople, assignments: {}, unitWeights: {} }));
    clearPeople();
    notify('People restored to default', 'success', {
      label: 'Undo',
      onClick: () => {
        setState(prev => ({ ...prev, ...before }));
        if (hadSavedPeople) savePeople(before.people);
      },
    });
  };

  // Total / discount / tip mutations. The transient editor UI (which figure is
  // open, the value being typed) lives inside SplittingStep; these receive the
  // final applied values and clamp them into their valid ranges.
  // In manual entry the edited figure is the pinned override; for a scanned
  // receipt it's the scanned total.
  const setTotal = (value: number) => {
    setState(prev => prev.manualEntry
      ? { ...prev, manualTotalOverride: Math.max(0, value) }
      : { ...prev, total: Math.max(0, value) });
  };

  // Manual entry only: drop the pinned total and go back to tracking the items
  // sum automatically.
  const clearTotalOverride = () => {
    setState(prev => ({ ...prev, manualTotalOverride: null }));
  };

  const setDiscount = (value: number) => {
    // Track only the no-discount → discount transition, not every adjustment.
    if (state.discount === 0 && value > 0) trackEvent('discount-set');
    setState(prev => ({ ...prev, discount: Math.min(100, Math.max(0, value)) }));
  };

  // Tip applies the value in whichever unit was entered. A percentage is capped
  // at 100% (matching discount); a flat amount is only floored at 0.
  const setTip = (value: number, mode: AppState['tipMode']) => {
    // Track only the no-tip → tip transition, not every adjustment.
    if (state.tip === 0 && value > 0) trackEvent('tip-set', { mode });
    setState(prev => ({
      ...prev,
      tipMode: mode,
      tip: mode === 'percent' ? Math.min(100, Math.max(0, value)) : Math.max(0, value),
    }));
  };

  // Clear the tip entirely (back to no tip).
  const clearTip = () => {
    setState(prev => ({ ...prev, tip: 0 }));
  };

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
    // Tracked only once the share/copy actually happens, so a dismissed share
    // sheet or a failed clipboard write doesn't count as a share.
    const shareProps = {
      peopleCount: state.people.filter(p => (personTotals[p.id] || 0) > 0.01).length,
      hasUnassigned: unassignedTotal > 0.05,
    };
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
        trackEvent('summary-shared', { ...shareProps, method: 'native' });
      } catch (err: any) {
        // Dismissing the native share sheet rejects with AbortError — that's a
        // normal user action, not a failure, so don't surface it.
        if (err?.name === 'AbortError') {
          trackEvent('summary-share-cancelled');
        } else {
          trackEvent('summary-share-failed', { method: 'native', reason: err?.message || 'unknown' });
          console.error('Error sharing:', err);
          notify("Sharing failed. Please try again.", 'error');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(summary);
        trackEvent('summary-shared', { ...shareProps, method: 'clipboard' });
        notify("Detailed summary copied!");
      } catch (err: any) {
        trackEvent('summary-share-failed', { method: 'clipboard', reason: err?.message || 'unknown' });
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-0 lg:pb-20">
      {/* Sign-in gate: opens on demand (scan attempt while signed out, or the
          header button). The rest of the app works without an account. */}
      <SignInGate
        isOpen={signInGateOpen && !user}
        resolvingAuth={resolvingAuth}
        signInError={signInError}
        signInButtonRef={signInButtonRef}
        onClose={closeSignInGate}
      />

      <WaitlistPrompt isOpen={waitlistOpen} onClose={() => setWaitlistOpen(false)} />

      {/* Admin-only; the menu item that opens it is hidden for everyone else. */}
      <AccessManager
        isOpen={accessManagerOpen && admin.isAdmin}
        onClose={() => setAccessManagerOpen(false)}
        requests={admin.requests}
        loading={admin.loading}
        error={admin.error}
        onRefresh={() => void admin.refresh()}
        onApplyLocal={admin.applyLocal}
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
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] animate-slide-down w-max max-w-[calc(100vw-2rem)]" role="status" aria-live="polite">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-semibold border border-white/10">
            {toast.variant === 'error'
              ? <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              : <Check className="w-4 h-4 text-green-400 shrink-0" />}
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => { toast.action!.onClick(); setToast(null); }}
                className="ml-2 -mr-2 px-3 py-1 rounded-full text-indigo-300 font-bold hover:bg-white/10 transition-colors"
              >
                {toast.action.label}
              </button>
            )}
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

            {/* Account menu (signed in) or a Sign in entry point (signed out).
                Signing in is optional — it's only needed for the AI scan. */}
            {!user ? (
              <button
                onClick={() => setSignInGateOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Sign in to scan receipts with AI"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign in</span>
              </button>
            ) : (
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
                  {admin.isAdmin && (
                    <button
                      role="menuitem"
                      onClick={() => { setAccountMenuOpen(false); setAccessManagerOpen(true); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Manage access
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => { trackEvent('signed-out'); setAccountMenuOpen(false); signOut(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-0 lg:px-4 py-0 lg:py-8">

        {/* Error State */}
        {state.error && (
          <div className="m-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center justify-between gap-3">
            <span>{state.error}</span>
            <div className="flex items-center gap-4 shrink-0">
              {/* Retry with the retained photo so a transient failure doesn't
                  force the user to re-shoot the receipt. */}
              {state.step === 'upload' && state.receiptImage && (
                <button
                  onClick={() => void handleImageSelected(state.receiptImage!)}
                  className="flex items-center gap-1.5 text-sm font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Try again
                </button>
              )}
              <button onClick={() => setState(s => ({ ...s, error: null }))} className="text-sm underline font-semibold">Dismiss</button>
            </div>
          </div>
        )}

        {state.step === 'upload' && <UploadStep onImageSelected={handleImageSelected} onManualEntry={startManualEntry} onError={(msg) => notify(msg, 'error')} signedIn={!!user} />}

        {state.step === 'analyzing' && <AnalyzingStep onCancel={cancelAnalyze} />}

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
            onSetTotal={setTotal}
            onClearTotalOverride={clearTotalOverride}
            onSetDiscount={setDiscount}
            onSetTip={setTip}
            onClearTip={clearTip}
          />
        )}
      </main>
    </div>
  );
}
