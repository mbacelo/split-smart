import { useEffect, useRef, useState } from 'react';
import { getUser, isAuthResolving, subscribe, initAuth, renderSignInButton, AuthUser } from '../services/auth';

// Everything Google Sign-In related that App renders from: the signed-in user,
// the launch spinner state, the GIS button container, the account dropdown, and
// why sign-in can't be shown when it can't. Kept out of App so the bill-split
// logic isn't interleaved with auth plumbing.
//
// GIS is initialized at mount (so remembered users are silently re-authed at
// launch even though the app no longer starts on a sign-in wall); the actual
// Sign In button renders only while `signInOpen` — the sign-in gate — is shown.
export function useAuth(signInOpen: boolean) {
  const [user, setUser] = useState<AuthUser | null>(() => getUser());
  const [resolvingAuth, setResolvingAuth] = useState<boolean>(() => isAuthResolving());
  const signInButtonRef = useRef<HTMLDivElement>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  // Flipped once the GIS script has loaded and initAuth ran — the button can
  // only render after that.
  const [gisReady, setGisReady] = useState(false);
  // Why the sign-in button can't be shown, if it can't: 'config' when the app
  // is missing its Google client id (a deploy misconfiguration), 'unavailable'
  // when the Google Identity script never loaded (blocked/offline). Either way
  // we surface a message so the sign-in gate is never just a dead logo.
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

  // Initialize GIS once at mount (this also fires the silent re-auth prompt
  // for remembered users). Poll briefly in case the script loads after mount.
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      // No client id configured — GIS can't be initialized at all. Stop the
      // launch spinner and explain, rather than leaving an empty container.
      setSignInError('config');
      setResolvingAuth(false);
      return;
    }
    let cancelled = false;
    // Poll for the GIS script for a bounded number of attempts (~6s). If it
    // never appears (blocked, offline, CSP), give up and show a retry message
    // instead of polling forever.
    let attempts = 0;
    const MAX_ATTEMPTS = 30;
    const tryInit = () => {
      if (cancelled) return;
      if ((window as any).google?.accounts?.id) {
        initAuth(clientId);
        setGisReady(true);
      } else if (attempts++ < MAX_ATTEMPTS) {
        setTimeout(tryInit, 200);
      } else {
        setSignInError('unavailable');
        setResolvingAuth(false);
      }
    };
    tryInit();
    return () => { cancelled = true; };
  }, []);

  // Render the Sign In button whenever the gate is open (and GIS is ready).
  // The container only exists while the gate is mounted, so this re-runs on
  // every open rather than once.
  useEffect(() => {
    if (!signInOpen || user || !gisReady || !signInButtonRef.current) return;
    renderSignInButton(signInButtonRef.current);
  }, [signInOpen, user, gisReady]);

  return {
    user,
    resolvingAuth,
    signInError,
    signInButtonRef,
    accountMenuOpen,
    setAccountMenuOpen,
    accountMenuRef,
  };
}
