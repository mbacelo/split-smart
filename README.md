# SplitSmart — AI Expense Splitter

Upload a photo of a receipt; AI extracts the line items and total, and you split
the cost among people. React + TypeScript + Vite PWA, deployed on Vercel.

## How it works

The app is free to use without an account — manual entry, assigning, and the
splitting math all work signed out. **Signing in is required only for the AI
receipt scan** (the one feature that costs money), and scanning itself is
limited to approved accounts. Non-approved users can join a waitlist stored in
the database.

The browser **never** talks to an AI provider and never holds the API key. The
image is sent to a Vercel serverless function that holds `OPENAI_API_KEY`,
verifies your Google sign-in, and calls the AI provider server-side.

```
Browser (React PWA)
  → Google Sign-In (gets an ID token; only prompted when scanning)
  → POST /api/analyze-receipt  { imageBase64 }   Authorization: Bearer <id_token>
       ↓  Vercel serverless function (holds OPENAI_API_KEY)
       •  verifies the Google ID token + checks the allowlist
          (ALLOWED_EMAILS env var OR access_requests table in Neon)
       •  calls the active AI provider (chosen by AI_PROVIDER)
       ↓
     OpenAI   (key stays server-side)

  → POST /api/join-waitlist   Authorization: Bearer <id_token>
       ↓  records the verified email in Neon (access_requests, status 'waitlisted')
```

> For the internals — the splitting math, state/persistence, the provider
> abstraction, and conventions for working in the code — see
> [CLAUDE.md](CLAUDE.md).

## Environment variables

Copy [`.env.local.example`](.env.local.example) to `.env.local` and fill it in.
On Vercel, set the same variables in **Project Settings → Environment Variables**.

| Variable | Where | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | server | Active provider (`openai`). |
| `OPENAI_API_KEY` | server | OpenAI key. **Secret.** |
| `OPENAI_MODEL` | server | Vision model, e.g. `gpt-5.4-mini`. |
| `OPENAI_REASONING_EFFORT` | server | Optional. GPT-5.x reasoning effort: `none`\|`minimal`\|`low`\|`medium`\|`high`\|`xhigh`. Omit for model default. |
| `GOOGLE_CLIENT_ID` | server | Verifies the ID token audience. |
| `ALLOWED_EMAILS` | server | Comma-separated bootstrap allowlist (owner override + fallback when the DB is unreachable). |
| `DATABASE_URL` | server | Neon Postgres connection string. Backs the waitlist and the DB-managed allowlist. Optional locally. |
| `VITE_GOOGLE_CLIENT_ID` | client | Same client ID, exposed to the browser for the Sign-In button (client IDs are public). |

## Waitlist & allowlist (Neon Postgres)

One-time setup:

1. In the Vercel dashboard, go to **Storage → Create Database → Neon** (Marketplace
   integration). Connecting it to the project injects `DATABASE_URL` into the
   project's environment variables; copy it into `.env.local` for local dev.
2. Run [`db/schema.sql`](db/schema.sql) once in the Neon SQL editor. (The
   waitlist endpoint also creates the table lazily as a safety net.)

Day to day:

- **Review requests:**
  `SELECT * FROM access_requests WHERE status = 'waitlisted' ORDER BY requested_at;`
- **Approve someone** (takes effect immediately, no redeploy):
  `UPDATE access_requests SET status = 'allowed', approved_at = now() WHERE email = 'person@example.com';`
- `ALLOWED_EMAILS` still works as before (append + redeploy) and doubles as the
  fallback if the database is ever unreachable — scanning never hard-breaks on
  a DB outage.

Neon's free tier auto-suspends when idle and **auto-wakes on the next query**
(~0.5–2 s cold start), so the app never needs a manual restore.

## Google Sign-In setup (one time)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth 2.0 Client ID** of type **Web application**.
2. Add your origins to **Authorized JavaScript origins**
   (e.g. `http://localhost:3000` and your Vercel URL).
3. Copy the client ID into both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`.

## Run locally

**Prerequisites:** Node.js.

```bash
npm install
# Fill in .env.local (see above)
npm run dev      # serves the frontend AND /api together on http://localhost:3000
```

`npm run dev` runs the real serverless handler in-process via a dev-only Vite
plugin, so receipt analysis works without the Vercel CLI. If you'd rather run
the full stack through the Vercel CLI instead (`npm i -g vercel`), use
`npm start` (`vercel dev`).

> `npm run preview` serves the production build but **not** `/api`, so receipt
> analysis won't work under it.

## Deploy

```bash
vercel            # preview deploy
vercel --prod     # production deploy
```

Set all environment variables in the Vercel dashboard before deploying.
