# SplitSmart — AI Expense Splitter

Upload a photo of a receipt; AI extracts the line items and total, and you split
the cost among people. React + TypeScript + Vite PWA, deployed on Vercel.

## How it works

Manual entry, assigning, and the splitting math work signed out. **Signing in is
required only for the AI receipt scan**, which is limited to approved accounts;
everyone else can join a waitlist.

The browser never talks to an AI provider and never holds the API key:

```
Browser (React PWA)
  → POST /api/analyze-receipt  { imageBase64 }   Authorization: Bearer <google_id_token>
       ↓  Vercel function: verifies the token, checks the allowlist, calls OpenAI
  → POST /api/join-waitlist     records the email in Neon (status 'waitlisted')
  → GET|POST /api/access-requests   admins only: list, approve/reject/revoke, grant
```

## Environment variables

Copy [`.env.local.example`](.env.local.example) to `.env.local`. On Vercel, set
the same variables in **Project Settings → Environment Variables**.

| Variable | Where | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | server | Active provider (`openai`). |
| `OPENAI_API_KEY` | server | OpenAI key. **Secret.** |
| `OPENAI_MODEL` | server | Vision model, e.g. `gpt-5.4-mini`. |
| `OPENAI_REASONING_EFFORT` | server | Optional: `none`\|`minimal`\|`low`\|`medium`\|`high`\|`xhigh`. |
| `GOOGLE_CLIENT_ID` | server | Verifies the ID token audience. |
| `ALLOWED_EMAILS` | server | Comma-separated bootstrap allowlist; also the fallback when the DB is unreachable. |
| `ADMIN_EMAILS` | server | Comma-separated admins. Defaults to the owner account. |
| `DATABASE_URL` | server | Neon Postgres. Backs the waitlist and allowlist. Optional locally. |
| `VITE_GOOGLE_CLIENT_ID` | client | Same client ID, for the Sign-In button. |
| `VITE_AMPLITUDE_API_KEY` | client | Optional analytics. |

## Setup (one time)

**Google Sign-In:** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
create an OAuth 2.0 Client ID (Web application), add your origins
(`http://localhost:3000`, your Vercel URL), and put the ID in both
`GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`.

**Database:** in Vercel, **Storage → Create Database → Neon** (injects
`DATABASE_URL`), then run [`db/schema.sql`](db/schema.sql) once in the Neon SQL editor.

## Managing access

Admins (`ADMIN_EMAILS`) get **Manage access** in the account menu to approve,
reject, revoke, or grant access by email. Changes apply on the person's next
scan — no redeploy. A rejected user can't re-queue themselves by re-joining, and
any decision can be reversed.

Admin is env-only by design: the admin UI writes to `access_requests`, so it can
never grant admin to anyone, including itself.

Break-glass SQL:

```sql
SELECT * FROM access_requests WHERE status = 'waitlisted' ORDER BY requested_at;
UPDATE access_requests SET status = 'allowed', approved_at = now() WHERE email = 'person@example.com';
```

## Run & deploy

```bash
npm install
npm run dev       # UI + /api on http://localhost:3000
vercel --prod     # deploy (set env vars in Vercel first)
```

`npm run preview` serves the build **without** `/api`, so scanning won't work under it.
