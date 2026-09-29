import { useEffect } from 'react';
import { AppState } from '../types';
import { saveSession, saveSessionImage } from '../state/session';

// Persist the in-progress split session so a refresh doesn't lose work (and
// force another paid AI call). Cleared automatically when not splitting.
export function useSessionPersistence(state: AppState): void {
  // The receiptImage is deliberately NOT in the deps: it can be several MB and
  // changes only once per receipt, so it's written by its own effect below
  // rather than re-serialized to localStorage on every assignment tap/keystroke.
  useEffect(() => {
    saveSession(state);
  }, [state.step, state.items, state.total, state.charges, state.discount, state.tip, state.tipMode, state.assignments, state.unitWeights, state.manualTotalOverride]);

  // Persist the receipt image separately, only when it actually changes.
  useEffect(() => {
    saveSessionImage(state.receiptImage);
  }, [state.receiptImage]);
}
