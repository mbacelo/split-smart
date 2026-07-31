// Thin Neon Postgres helper for the /api endpoints. One table backs both the
// waitlist and the DB-managed allowlist (see db/schema.sql):
//
//   access_requests(email PK, name, status 'waitlisted'|'allowed', requested_at, approved_at)
//
// The DB is optional: when DATABASE_URL is unset or Neon is unreachable, the
// allowlist check degrades to the ALLOWED_EMAILS env var (handled by callers),
// so the app never hard-breaks on a DB outage.

import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;

let client: Sql | null = null;

export const isDbConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

function sql(): Sql {
  if (!client) client = neon(process.env.DATABASE_URL!);
  return client;
}

/** True when the DB says this email is approved. Returns false (never throws)
 * when the DB is unconfigured or unreachable — callers fall back to the env
 * allowlist. */
export async function isEmailAllowed(email: string): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const rows = (await sql()`
      SELECT 1 FROM access_requests WHERE email = ${email} AND status = 'allowed'
    `) as Record<string, unknown>[];
    return rows.length > 0;
  } catch (err) {
    console.error("DB allowlist check failed:", err);
    return false;
  }
}

export type AccessStatus = "waitlisted" | "allowed";

export interface AccessRequest {
  email: string;
  name: string | null;
  status: AccessStatus;
  requestedAt: string;
  approvedAt: string | null;
}

// Lazy safety net so the endpoints work even if db/schema.sql was never run.
async function ensureTable(db: Sql): Promise<void> {
  await db`
    CREATE TABLE IF NOT EXISTS access_requests (
      email        text PRIMARY KEY,
      name         text,
      status       text NOT NULL DEFAULT 'waitlisted',
      requested_at timestamptz NOT NULL DEFAULT now(),
      approved_at  timestamptz
    )
  `;
}

// snake_case columns → camelCase, so nothing above this file sees DB naming.
type Row = {
  email: string;
  name: string | null;
  status: string;
  requested_at: string | Date;
  approved_at: string | Date | null;
};

const toAccessRequest = (row: Row): AccessRequest => ({
  email: row.email,
  name: row.name,
  status: row.status === "allowed" ? "allowed" : "waitlisted",
  requestedAt: new Date(row.requested_at).toISOString(),
  approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
});

export type WaitlistResult = "joined" | "already_waitlisted" | "already_allowed";

/** Record a waitlist request. Idempotent per email: re-joining reports the
 * existing status instead of duplicating or downgrading an approved account.
 * Throws on DB errors (the endpoint maps that to a friendly 5xx). */
export async function upsertWaitlistRequest(email: string, name: string | null): Promise<WaitlistResult> {
  const db = sql();
  await ensureTable(db);
  const inserted = (await db`
    INSERT INTO access_requests (email, name)
    VALUES (${email}, ${name})
    ON CONFLICT (email) DO NOTHING
    RETURNING email
  `) as Record<string, unknown>[];
  if (inserted.length > 0) return "joined";
  const existing = (await db`SELECT status FROM access_requests WHERE email = ${email}`) as { status: string }[];
  return existing[0]?.status === "allowed" ? "already_allowed" : "already_waitlisted";
}

// --- Admin operations (see api/access-requests.ts) -------------------------
// These throw on DB errors; the endpoint maps that to a friendly 502. Callers
// must be admin-authenticated — there's no authorization check down here.

/** Every access request, pending ones first so the admin's work is at the top. */
export async function listAccessRequests(): Promise<AccessRequest[]> {
  const db = sql();
  await ensureTable(db);
  const rows = (await db`
    SELECT email, name, status, requested_at, approved_at
    FROM access_requests
    ORDER BY (status = 'allowed'), requested_at DESC
  `) as Row[];
  return rows.map(toAccessRequest);
}

/** Approve or revoke an existing request. Returns null when there's no such
 * row, so the endpoint can answer 404 instead of silently doing nothing. */
export async function setAccessStatus(email: string, status: AccessStatus): Promise<AccessRequest | null> {
  const db = sql();
  await ensureTable(db);
  const rows = (await db`
    UPDATE access_requests
    SET status = ${status},
        approved_at = CASE WHEN ${status} = 'allowed' THEN now() ELSE NULL END
    WHERE email = ${email}
    RETURNING email, name, status, requested_at, approved_at
  `) as Row[];
  return rows[0] ? toAccessRequest(rows[0]) : null;
}

/** Grant access to an email directly, whether or not they ever joined the
 * waitlist. Idempotent; keeps any name already on file (a self-reported name
 * from sign-in beats the nothing an admin types into the email box). */
export async function grantAccess(email: string, name: string | null): Promise<AccessRequest> {
  const db = sql();
  await ensureTable(db);
  const rows = (await db`
    INSERT INTO access_requests (email, name, status, approved_at)
    VALUES (${email}, ${name}, 'allowed', now())
    ON CONFLICT (email) DO UPDATE
      SET status = 'allowed',
          approved_at = now(),
          name = COALESCE(access_requests.name, EXCLUDED.name)
    RETURNING email, name, status, requested_at, approved_at
  `) as Row[];
  return toAccessRequest(rows[0]);
}
