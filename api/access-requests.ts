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

const STATUSES: AccessStatus[] = ["waitlisted", "allowed", "rejected"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320; // RFC 5321 practical maximum

/** Normalized email, or null when it isn't plausibly one. */
function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) return null;
  return email;
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== "GET" && req.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    // One 403 for "no token", "bad token" and "not an admin" alike — the client
    // only needs to know it isn't getting in.
    const admin = await verifyAdmin(req.headers.get("authorization"));
    if (!admin) {
      return Response.json({ error: "Not authorized." }, { status: 403 });
    }
    if (rateLimited(admin.email)) {
      return Response.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    if (!isDbConfigured()) {
      console.error("access-requests called but DATABASE_URL is not set.");
      return Response.json({ error: "Access management isn't available right now. Please try again later." }, { status: 503 });
    }

    try {
      if (req.method === "GET") {
        return Response.json({ requests: await listAccessRequests() });
      }

      // Malformed JSON falls through to "Unknown action." like a missing body.
      const body = await req.json().catch(() => null);
      const action = body?.action;

      if (action === "grant") {
        const email = cleanEmail(body?.email);
        if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
        // No name: the admin only typed an email. If this person later signs in
        // via the waitlist their real name fills in (grantAccess keeps whichever
        // name is already on file).
        return Response.json({ request: await grantAccess(email, null) });
      }

      if (action === "set-status") {
        const email = cleanEmail(body?.email);
        if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

        const status = body?.status;
        if (!STATUSES.includes(status)) {
          return Response.json({ error: "Unknown status." }, { status: 400 });
        }
        // Admin access comes from ADMIN_EMAILS, so downgrading yourself wouldn't
        // actually lock you out — it would just look like the click did nothing.
        if (email === admin.email && status !== "allowed") {
          return Response.json({ error: "You can't remove your own access." }, { status: 400 });
        }

        const request = await setAccessStatus(email, status);
        if (!request) return Response.json({ error: "No access request for that email." }, { status: 404 });
        return Response.json({ request });
      }

      return Response.json({ error: "Unknown action." }, { status: 400 });
    } catch (err) {
      // Never leak DB errors/connection strings to the client.
      console.error("Access management error:", err);
      return Response.json({ error: "Couldn't update access. Please try again later." }, { status: 502 });
    }
  },
};
