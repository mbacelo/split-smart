// Server-side Google ID token verification, shared by every /api endpoint.
// The client id is public; verification here is what actually authenticates
// the caller (the browser's own JWT decode is display-only).

import { OAuth2Client } from "google-auth-library";

export interface VerifiedUser {
  email: string;
  name: string | null;
}

const googleClient = new OAuth2Client();

/** Verifies the Google ID token from an Authorization header and returns the
 * verified email (+ display name when present), or null. */
export async function verifyUser(authHeader: string | null): Promise<VerifiedUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  // Fail closed on a missing client id. google-auth-library skips the `aud`
  // check entirely when `audience` is undefined, so an unset GOOGLE_CLIENT_ID
  // would still verify the signature and issuer while accepting tokens minted
  // for *any* Google OAuth client. A config gap must never widen who can sign in.
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    console.error("GOOGLE_CLIENT_ID is not set; refusing to verify tokens.");
    return null;
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) return null;
    return { email: payload.email.toLowerCase(), name: payload.name ?? null };
  } catch {
    return null;
  }
}

// Naive in-memory per-email throttle. Resets on cold start — good enough for
// low-traffic authenticated endpoints; not a substitute for a real limiter at
// scale. Each endpoint gets its own limiter so windows don't interfere.
export function makeRateLimiter(maxHits: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return function rateLimited(email: string): boolean {
    const now = Date.now();
    const recent = (hits.get(email) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(email, recent);
    return recent.length > maxHits;
  };
}
