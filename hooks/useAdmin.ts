import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthUser } from '../services/auth';
import { ApiError } from '../services/receiptService';
import { listAccessRequests, AccessRequest } from '../services/adminAccess';

// Is the signed-in user an admin, and if so, what's on the allowlist?
//
// The admin list lives in a server-only env var, so the client can't know the
// answer on its own — it asks. A 200 from the list endpoint means admin (and
// we already have the list); anything else means not, silently. That "silently"
// matters: a 403 is the *normal* outcome for every regular user, so it must
// never surface as an error in the UI.

export function useAdmin(user: AuthUser | null) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  // Only ever set for failures an admin should see (a refresh that broke).
  // The initial probe stays quiet.
  const [error, setError] = useState<string | null>(null);

  const email = user?.email ?? null;
  // Guards against a slow response for a previous account landing after a
  // switch and granting/denying admin based on the wrong user.
  const currentEmail = useRef<string | null>(email);
  currentEmail.current = email;

  const load = useCallback(async (probing: boolean) => {
    if (!email) return;
    const requestedFor = email;
    setLoading(true);
    try {
      const list = await listAccessRequests();
      if (currentEmail.current !== requestedFor) return;
      setRequests(list);
      setIsAdmin(true);
      setError(null);
    } catch (err) {
      if (currentEmail.current !== requestedFor) return;
      // 403 is the expected answer for a normal user; treat any probe failure
      // (network, 502, 503) the same way — just don't offer the admin UI.
      if (probing) {
        setIsAdmin(false);
        setRequests([]);
        setError(null);
      } else {
        setError(err instanceof ApiError || err instanceof Error
          ? err.message
          : "Couldn't load access requests.");
      }
    } finally {
      if (currentEmail.current === requestedFor) setLoading(false);
    }
  }, [email]);

  // Probe once per signed-in account; reset completely on sign-out.
  useEffect(() => {
    if (!email) {
      setIsAdmin(false);
      setRequests([]);
      setError(null);
      setLoading(false);
      return;
    }
    void load(true);
  }, [email, load]);

  /** Re-fetch the list (admin-initiated, so failures are surfaced). */
  const refresh = useCallback(() => load(false), [load]);

  /** Swap one row in place after a mutation, so the modal updates instantly
   * without a round trip for the whole list. */
  const applyLocal = useCallback((updated: AccessRequest) => {
    setRequests(prev => {
      const idx = prev.findIndex(r => r.email === updated.email);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }, []);

  return { isAdmin, requests, loading, error, refresh, applyLocal };
}
