-- SplitSmart access control: one table backs both the waitlist and the
-- DB-managed allowlist. Run once in the Neon SQL editor (the join-waitlist
-- endpoint also creates it lazily as a safety net).
--
-- Day to day, approvals happen in the app: sign in as an admin (ADMIN_EMAILS)
-- and use "Manage access" in the account menu. The SQL below is the equivalent,
-- kept for break-glass use. Either way it takes effect immediately, no redeploy.
--
-- Review pending requests:
--   SELECT * FROM access_requests WHERE status = 'waitlisted' ORDER BY requested_at;
-- Approve someone:
--   UPDATE access_requests SET status = 'allowed', approved_at = now() WHERE email = 'person@example.com';

CREATE TABLE IF NOT EXISTS access_requests (
  email        text PRIMARY KEY,
  name         text,
  status       text NOT NULL DEFAULT 'waitlisted',  -- 'waitlisted' | 'allowed'
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at  timestamptz
);
