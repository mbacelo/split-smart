// Thin wrapper around Google Identity Services (loaded via a script tag in
// index.html). Holds the current Google ID token in memory and notifies React
// when sign-in state changes. No secret is involved — the client id is public.

export interface AuthUser {
  email: string;
  name: string;
  picture?: string;
}

const STORAGE_KEY = "splitSmart_idToken";

let idToken: string | null = null;
let user: AuthUser | null = null;
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
    sessionStorage.setItem(STORAGE_KEY, token);
  } else {
    clearToken();
    return;
  }
  listeners.forEach((l) => l());
}

function clearToken() {
  idToken = null;
  user = null;
  sessionStorage.removeItem(STORAGE_KEY);
  listeners.forEach((l) => l());
}

// Restore a token from this session (survives reloads until it expires).
const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
if (stored) setToken(stored);

export const getIdToken = (): string | null => {
  // Drop an expired token lazily.
  if (idToken) {
    const decoded = decode(idToken);
    if (!decoded || decoded.exp * 1000 < Date.now()) clearToken();
  }
  return idToken;
};

export const getUser = (): AuthUser | null => user;

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const signOut = () => clearToken();

/**
 * Initialize Google Identity Services and render a Sign In button into `target`.
 * Called once the GIS script and the DOM node are ready.
 */
export const initGoogleSignIn = (clientId: string, target: HTMLElement) => {
  const google = (window as any).google;
  if (!google?.accounts?.id) return;

  google.accounts.id.initialize({
    client_id: clientId,
    callback: (response: { credential: string }) => setToken(response.credential),
  });
  google.accounts.id.renderButton(target, {
    theme: "filled_blue",
    size: "large",
    shape: "pill",
    text: "signin_with",
  });
};
