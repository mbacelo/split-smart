# SplitSmart — AI Expense Splitter

Upload a photo of a receipt; AI extracts the line items and total, and you split
the cost among people. React + TypeScript + Vite PWA, deployed on Vercel.

## How it works

The browser **never** talks to an AI provider and never holds the API key. The
image is sent to a Vercel serverless function that holds `OPENAI_API_KEY`,
verifies your Google sign-in, and calls the AI provider server-side.

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
