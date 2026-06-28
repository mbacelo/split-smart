# SplitSmart — AI Expense Splitter

Upload a photo of a receipt; AI extracts the line items and total, and you split
the cost among people. React + TypeScript + Vite PWA, deployed on Vercel.

## Architecture

The browser **never** talks to an AI provider and never holds the API key.

```
Browser (React PWA)
  → Google Sign-In (gets an ID token)
  → POST /api/analyze-receipt  { imageBase64 }   Authorization: Bearer <id_token>
       ↓  Vercel serverless function (holds OPENAI_API_KEY)
       •  verifies the Google ID token + checks the email allowlist
       •  calls the active AI provider (chosen by AI_PROVIDER)
       ↓
     OpenAI   (key stays server-side)
```

### Swapping AI providers

Providers live behind a small abstraction in [`lib/ai/`](lib/ai). Only **OpenAI**
is implemented today. To add Gemini or Anthropic later:

1. Add `lib/ai/providers/<name>.ts` implementing the `AIProvider` interface.
2. Add a `case` for it in [`lib/ai/index.ts`](lib/ai/index.ts).
3. Set `AI_PROVIDER=<name>` (and that provider's API key) in the environment.

Nothing else in the app changes.

## Environment variables

Copy [`.env.local.example`](.env.local.example) to `.env.local` and fill it in.
On Vercel, set the same variables in **Project Settings → Environment Variables**.

| Variable | Where | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | server | Active provider (`openai`). |
| `OPENAI_API_KEY` | server | OpenAI key. **Secret.** |
| `OPENAI_MODEL` | server | Vision model, e.g. `gpt-4o-mini`. |
| `GOOGLE_CLIENT_ID` | server | Verifies the ID token audience. |
| `ALLOWED_EMAILS` | server | Comma-separated allowlist of emails. |
| `VITE_GOOGLE_CLIENT_ID` | client | Same client ID, exposed to the browser for the Sign-In button (client IDs are public). |

### Adding someone to the allowlist

Append their email to `ALLOWED_EMAILS` (comma-separated) and redeploy. No code change.

## Google Sign-In setup (one time)

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create an **OAuth 2.0 Client ID** of type **Web application**.
2. Add your origins to **Authorized JavaScript origins**
   (e.g. `http://localhost:3000` and your Vercel URL).
3. Copy the client ID into both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`.

## Run locally

**Prerequisites:** Node.js, and the Vercel CLI (`npm i -g vercel`).

```bash
npm install
# Fill in .env.local (see above)
vercel dev      # serves the frontend AND /api together on one port
```

> `npm run dev` (plain Vite) runs the UI but **not** the `/api` function, so
> receipt analysis won't work. Use `vercel dev` for full local testing.

## Deploy

```bash
vercel            # preview deploy
vercel --prod     # production deploy
```

Set all environment variables in the Vercel dashboard before deploying.
