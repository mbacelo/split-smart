import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdmin } from "../lib/server/adminAuth.js";
import { makeRateLimiter } from "../lib/server/googleAuth.js";
import {
  isDbConfigured,
  listAccessRequests,
  setAccessStatus,
  grantAccess,
  type AccessStatus,
} from "../lib/server/db.js";

// Admin-only management of the AI-scan allowlist — the in-app replacement for
// hand-running UPDATEs against access_requests.
//
//   GET                                        -> { requests }
//   POST { action: 'set-status', email, status } -> { request }
//   POST { action: 'grant', email }              -> { request }
//
// GET doubles as the client's admin probe: 200 means "you're an admin" and the
// UI shows the Manage access menu item, anything else hides it. That's a UI
// affordance only — every action re-checks admin server-side, so a client that
// lies to itself gains nothing.

const rateLimited = makeRateLimiter(30, 60_000);

const STATUSES: AccessStatus[] = ["waitlisted", "allowed"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320; // RFC 5321 practical maximum

/** Normalized email, or null when it isn't plausibly one. */
function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return null;
  return email;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  // One 403 for "no token", "bad token" and "not an admin" alike — the client
  // only needs to know it isn't getting in.
  const admin = await verifyAdmin(req.headers.authorization);
  if (!admin) {
    return res.status(403).json({ error: "Not authorized." });
  }
  if (rateLimited(admin.email)) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  if (!isDbConfigured()) {
    console.error("access-requests called but DATABASE_URL is not set.");
    return res.status(503).json({ error: "Access management isn't available right now. Please try again later." });
  }

  try {
    if (req.method === "GET") {
      return res.status(200).json({ requests: await listAccessRequests() });
    }

    const action = req.body?.action;

    if (action === "grant") {
      const email = cleanEmail(req.body?.email);
      if (!email) return res.status(400).json({ error: "Enter a valid email address." });
      // No name: the admin only typed an email. If this person later signs in
      // via the waitlist their real name fills in (grantAccess keeps whichever
      // name is already on file).
      return res.status(200).json({ request: await grantAccess(email, null) });
    }

    if (action === "set-status") {
      const email = cleanEmail(req.body?.email);
      if (!email) return res.status(400).json({ error: "Enter a valid email address." });

      const status = req.body?.status;
      if (!STATUSES.includes(status)) {
        return res.status(400).json({ error: "Unknown status." });
      }
      // Admin access comes from ADMIN_EMAILS, so self-revoking wouldn't
      // actually lock them out — it would just look like the click did nothing.
      if (email === admin.email && status === "waitlisted") {
        return res.status(400).json({ error: "You can't revoke your own access." });
      }

      const request = await setAccessStatus(email, status);
      if (!request) return res.status(404).json({ error: "No access request for that email." });
      return res.status(200).json({ request });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    // Never leak DB errors/connection strings to the client.
    console.error("Access management error:", err);
    return res.status(502).json({ error: "Couldn't update access. Please try again later." });
  }
}
