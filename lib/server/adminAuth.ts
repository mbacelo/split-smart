// Who counts as an admin, in one place. Admin is deliberately env-only
// (ADMIN_EMAILS) and never stored in the database: the admin UI writes to
// access_requests, so keeping the role out of that table means the UI can't
// grant admin to anyone — including itself — and a DB compromise doesn't hand
// over the allowlist controls.

import { verifyUser, type VerifiedUser } from "./googleAuth.js";

// Owner account, used when ADMIN_EMAILS isn't configured (local dev, or a
// deploy where the var was forgotten) so there is always exactly one admin.
const DEFAULT_ADMINS = ["bacelomarcos@gmail.com"];

/** True when `email` (already lowercased by verifyUser) is an admin. */
export function isAdminEmail(email: string): boolean {
  const configured = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const admins = configured.length > 0 ? configured : DEFAULT_ADMINS;
  return admins.includes(email.trim().toLowerCase());
}

/** The verified caller when they're an admin, otherwise null — covers a missing
 * header, an invalid token, and a valid token for a non-admin alike, so callers
 * answer all three with the same 403 and leak nothing about who is an admin. */
export async function verifyAdmin(authHeader: string | undefined): Promise<VerifiedUser | null> {
  const user = await verifyUser(authHeader);
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
