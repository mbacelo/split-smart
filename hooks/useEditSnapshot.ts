import { useRef } from 'react';

// The app's edit-mode pattern: edits apply live to state, so entering an edit
// mode snapshots the affected slice and Cancel restores it (commit just
// discards it). Used by both the item-edit and people-edit modes.
export function useEditSnapshot<T>() {
  const ref = useRef<T | null>(null);
  return {
    /** Capture the slice to restore if the user cancels. */
    take: (snapshot: T) => { ref.current = snapshot; },
    /** Return and clear the snapshot (null if none was taken). */
    restore: (): T | null => {
      const snapshot = ref.current;
      ref.current = null;
      return snapshot;
    },
    /** Drop the snapshot on commit. */
    discard: () => { ref.current = null; },
  };
}
