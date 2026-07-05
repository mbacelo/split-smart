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

export type WaitlistResult = "joined" | "already_waitlisted" | "already_allowed";

/** Record a waitlist request. Idempotent per email: re-joining reports the
 * existing status instead of duplicating or downgrading an approved account.
 * Throws on DB errors (the endpoint maps that to a friendly 5xx). */
export async function upsertWaitlistRequest(email: string, name: string | null): Promise<WaitlistResult> {
  const db = sql();
  // Lazy safety net so the endpoint works even if db/schema.sql was never run.
  await db`
    CREATE TABLE IF NOT EXISTS access_requests (
      email        text PRIMARY KEY,
      name         text,
      status       text NOT NULL DEFAULT 'waitlisted',
      requested_at timestamptz NOT NULL DEFAULT now(),
      approved_at  timestamptz
    )
  `;
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
