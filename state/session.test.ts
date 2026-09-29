import { describe, it, expect, beforeEach } from 'vitest';
import { loadSession, saveSession, SESSION_VERSION } from './session';
import { AppState } from '../types';

const SESSION_KEY = 'splitSmart_session';
const IMAGE_KEY = 'splitSmart_sessionImage';

// Vitest runs in a Node environment; give the module the same localStorage
// surface the browser provides.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;
});

const makeState = (overrides: Partial<AppState> = {}): AppState => ({
  step: 'splitting',
  receiptImage: null,
  items: [{ id: 'i1', name: 'Pizza', quantity: 1, originalPrice: 12 }],
  total: 12,
  charges: [],
  discount: 0,
  tip: 0,
  tipMode: 'percent',
  assignments: { i1: ['a'] },
  unitWeights: {},
  people: [{ id: 'a', name: 'Ana', color: 'blue' }],
  error: null,
  manualEntry: false,
  manualTotalOverride: null,
  ...overrides,
});

describe('saveSession / loadSession', () => {
  it('round-trips a mid-split session', () => {
    saveSession(makeState());
    const session = loadSession();
    expect(session).not.toBeNull();
    expect(session!.v).toBe(SESSION_VERSION);
    expect(session!.items).toEqual([{ id: 'i1', name: 'Pizza', quantity: 1, originalPrice: 12 }]);
    expect(session!.assignments).toEqual({ i1: ['a'] });
    expect(session!.total).toBe(12);
  });

  it('clears the session (and image) when the step is not splitting', () => {
    saveSession(makeState());
    store.set(IMAGE_KEY, 'data:image/jpeg;base64,x');
    saveSession(makeState({ step: 'upload' }));
    expect(store.has(SESSION_KEY)).toBe(false);
    expect(store.has(IMAGE_KEY)).toBe(false);
    expect(loadSession()).toBeNull();
  });

  it('rejects a payload from a different SESSION_VERSION', () => {
    saveSession(makeState());
    const stale = JSON.parse(store.get(SESSION_KEY)!);
    stale.v = SESSION_VERSION - 1;
    store.set(SESSION_KEY, JSON.stringify(stale));
    expect(loadSession()).toBeNull();
  });

  it('never restores an analyzing-step session (the in-flight request is gone)', () => {
    const payload = { v: SESSION_VERSION, step: 'analyzing', items: [], total: 0, discount: 0, assignments: {} };
    store.set(SESSION_KEY, JSON.stringify(payload));
    expect(loadSession()).toBeNull();
  });

  it('rejects corrupt JSON', () => {
    store.set(SESSION_KEY, '{not json');
    expect(loadSession()).toBeNull();
  });

  it('rejects a payload whose items is not an array', () => {
    saveSession(makeState());
    const corrupt = JSON.parse(store.get(SESSION_KEY)!);
    corrupt.items = { i1: 'oops' };
    store.set(SESSION_KEY, JSON.stringify(corrupt));
    expect(loadSession()).toBeNull();
  });

  it('returns null when nothing is persisted', () => {
    expect(loadSession()).toBeNull();
  });
});
