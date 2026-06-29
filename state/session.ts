// Session persistence + initial-state construction for the split flow.
//
// `people` and the in-progress receipt session (items/total/discount/
// assignments) are both persisted to localStorage so a mid-split page refresh
// — easy to trigger on mobile — doesn't wipe work and force another paid AI
// call. People live under their own key so resetting a session keeps them.

import { AppState, Person, AssignmentState, ReceiptItem } from '../types';

const PEOPLE_KEY = 'splitSmart_people';
const SESSION_KEY = 'splitSmart_session';
// The receipt image lives under its own key so the frequently-rewritten session
// payload (items/assignments) stays small and fast to serialize. It can be a
// few MB, and only changes once per receipt.
const IMAGE_KEY = 'splitSmart_sessionImage';

// Bump when the persisted session shape changes so stale data is discarded
// rather than rehydrated into an incompatible state.
const SESSION_VERSION = 4;

interface PersistedSession {
  v: number;
  step: AppState['step'];
  items: ReceiptItem[];
  total: number;
  discount: number;
  assignments: AssignmentState;
  manualEntry?: boolean;
  manualTotalOverride?: number | null;
}

// Two people is the minimum needed to split; users add more as needed via the
// quick-add control in the splitting view or the settings modal.
export const getInitialPeople = (): Person[] => [
  { id: 'p1', name: 'Person #1', color: 'blue' },
  { id: 'p2', name: 'Person #2', color: 'green' },
];

const loadPeople = (): Person[] => {
  try {
    const saved = localStorage.getItem(PEOPLE_KEY);
    const parsed = saved ? (JSON.parse(saved) as Person[]) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialPeople();
  } catch {
    return getInitialPeople();
  }
};

// Returns a persisted session if one exists and is still mid-split. We never
// restore the 'analyzing' step (a refresh during analysis lost the in-flight
// request) — fall back to 'upload' so the user can retry.
const loadSession = (): PersistedSession | null => {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as PersistedSession;
    if (parsed?.v !== SESSION_VERSION || parsed.step !== 'splitting') return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
};

/** Build the app's initial state, rehydrating people and any saved session. */
export const makeInitialState = (): AppState => {
  const people = loadPeople();
  const session = loadSession();
  // Only restore the image when we actually have a session to attach it to,
  // otherwise a stale image could outlive its cleared session.
  return {
    step: session?.step ?? 'upload',
    receiptImage: session ? loadSessionImage() : null,
    items: session?.items ?? [],
    total: session?.total ?? 0,
    discount: session?.discount ?? 0,
    assignments: session?.assignments ?? {},
    people,
    error: null,
    manualEntry: session?.manualEntry ?? false,
    manualTotalOverride: session?.manualTotalOverride ?? null,
  };
};

export const savePeople = (people: Person[]): void => {
  try {
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
  } catch { /* storage full / unavailable — non-fatal */ }
};

export const clearPeople = (): void => {
  try {
    localStorage.removeItem(PEOPLE_KEY);
  } catch { /* non-fatal */ }
};

/** Persist (or clear) the in-progress split session (everything but the image). */
export const saveSession = (state: AppState): void => {
  try {
    if (state.step !== 'splitting') {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(IMAGE_KEY);
      return;
    }
    const payload: PersistedSession = {
      v: SESSION_VERSION,
      step: state.step,
      items: state.items,
      total: state.total,
      discount: state.discount,
      assignments: state.assignments,
      manualEntry: state.manualEntry,
      manualTotalOverride: state.manualTotalOverride,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch { /* non-fatal */ }
};

// Downscaled JPEG data URL so a mid-split refresh can still show the receipt
// for cross-checking. Best-effort: dropped silently if storage is full, since
// the split work itself is persisted separately by saveSession.
const loadSessionImage = (): string | null => {
  try {
    return localStorage.getItem(IMAGE_KEY);
  } catch {
    return null;
  }
};

/** Persist (or clear) just the receipt image, on its own key. */
export const saveSessionImage = (image: string | null): void => {
  try {
    if (image) localStorage.setItem(IMAGE_KEY, image);
    else localStorage.removeItem(IMAGE_KEY);
  } catch { /* storage full — image is non-essential, drop it */ }
};
