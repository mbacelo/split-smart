// Thin wrapper around Google Identity Services (loaded via a script tag in
// index.html). Holds the current Google ID token in memory and notifies React
// when sign-in state changes. No secret is involved — the client id is public.

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
}

const STORAGE_KEY = "splitSmart_idToken";
// Persistent flag: "this user chose to be remembered". Survives the token's
// short (~1h) lifetime so we know to silently re-authenticate on next launch.
const REMEMBER_KEY = "splitSmart_remembered";

let idToken: string | null = null;
let user: AuthUser | null = null;
let initializedClientId: string | null = null;
// True while a silent re-authentication is expected/in flight on launch, so the
// UI can show a loading state instead of flashing the sign-in screen.
let authResolving = false;
const listeners = new Set<() => void>();

/** Decode a JWT payload without verifying (verification happens server-side). */
function decode(token: string): (AuthUser & { exp: number }) | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  if (token) {
    const decoded = decode(token);
    // Reject already-expired tokens.
    if (!decoded || decoded.exp * 1000 < Date.now()) {
      clearToken();
      return;
    }
    idToken = token;
    user = { email: decoded.email, name: decoded.name, picture: decoded.picture };
    authResolving = false;
    localStorage.setItem(STORAGE_KEY, token);
    // Mark this user as remembered so we can silently refresh after the token
    // expires (Google ID tokens live only ~1h).
    localStorage.setItem(REMEMBER_KEY, "1");
  } else {
    clearToken();
    return;
  }
  listeners.forEach((l) => l());
}

// Drop only the short-lived token (e.g. it expired) while keeping the
// "remembered" flag, so the next launch can silently re-authenticate.
function dropToken() {
  idToken = null;
  user = null;
  if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l());
}

function clearToken() {
  dropToken();
  if (typeof localStorage !== "undefined") localStorage.removeItem(REMEMBER_KEY);
}

const isRemembered = (): boolean =>
  typeof localStorage !== "undefined" && localStorage.getItem(REMEMBER_KEY) === "1";

// Restore a token from a previous launch (persists until it expires).
const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
if (stored) setToken(stored);

// If the user is remembered but we have no valid token yet, we expect to
// silently re-authenticate once GIS loads. Start in a "resolving" state so the
// UI shows a spinner rather than the sign-in button.
authResolving = isRemembered() && !user;

export const getIdToken = (): string | null => {
  // Drop an expired token lazily.
  if (idToken) {
    const decoded = decode(idToken);
    // Drop only the token (keep the remember flag) so a silent refresh can run.
    if (!decoded || decoded.exp * 1000 < Date.now()) dropToken();
  }
  return idToken;
};

export const getUser = (): AuthUser | null => user;

/** True while a silent re-auth is expected on launch (show a loading state). */
export const isAuthResolving = (): boolean => authResolving;

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const signOut = () => {
  authResolving = false;
  // Disable auto-select so the next sign-in is an explicit user choice.
  (window as any).google?.accounts?.id?.disableAutoSelect?.();
  clearToken();
};

/** Stop showing the loading state and notify subscribers (silent re-auth failed). */
function finishResolving() {
  if (!authResolving) return;
  authResolving = false;
  listeners.forEach((l) => l());
}

/**
 * Initialize Google Identity Services and render a Sign In button into `target`.
 * Called once the GIS script and the DOM node are ready.
 */
export const initGoogleSignIn = (clientId: string, target: HTMLElement) => {
  const google = (window as any).google;
  if (!google?.accounts?.id) return;

  if (initializedClientId !== clientId) {
    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential: string }) => setToken(response.credential),
      // Let GIS silently re-select the previously remembered account so a
      // returning user doesn't have to click again.
      auto_select: true,
    });
    initializedClientId = clientId;
  }

  // If this user asked to be remembered but we have no valid token (expired or
  // a fresh launch), try to obtain a new ID token silently — no UI, no click.
  // The notification callback tells us when the silent attempt can't proceed
  // (e.g. no Google session) so we can drop the loading state and show the button.
  if (isRemembered() && !getIdToken()) {
    authResolving = true;
    google.accounts.id.prompt((notification: any) => {
      if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
        finishResolving();
      }
    });
  } else {
    finishResolving();
  }

  google.accounts.id.renderButton(target, {
    theme: "filled_blue",
    size: "large",
    shape: "pill",
    text: "signin_with",
  });
};
