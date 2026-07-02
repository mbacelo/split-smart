import { useEffect, useRef, useState } from 'react';
import { getUser, isAuthResolving, subscribe, initGoogleSignIn, AuthUser } from '../services/auth';

// Everything Google Sign-In related that App renders from: the signed-in user,
// the launch spinner state, the GIS button container, the account dropdown, and
// why sign-in can't be shown when it can't. Kept out of App so the bill-split
// logic isn't interleaved with auth plumbing.
export function useAuth() {
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
