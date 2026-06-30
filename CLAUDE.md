# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev      # Vite on :3000 — serves the UI AND /api together (see below). Use this for normal dev.
npm start        # vercel dev — alternative full-stack local run via the Vercel CLI
npm run build    # vite build → dist/
npm run preview  # serve the production build (UI only, no /api)
```

There is no test runner, linter, or typecheck script configured. `tsconfig.json` is `noEmit` (type info only; Vite does the transpiling).

`npm run dev` runs the real serverless handler in-process via a dev-only Vite plugin ([vite.config.ts](vite.config.ts) `devApiPlugin`), so `/api/analyze-receipt` works locally without the Vercel CLI. Plain Vite *without* this plugin would not serve `/api` — the plugin is what makes `npm run dev` sufficient. It reads server env from `.env.local` (all keys, unfiltered) and exposes only `VITE_`-prefixed vars to the browser.

To run anything, copy [.env.local.example](.env.local.example) → `.env.local` and fill it in (see README for the variable table and Google Sign-In setup).

## Architecture

A React 19 + TypeScript + Vite PWA that splits receipts. Three-step flow driven by `AppState.step`: `upload` → `analyzing` → `splitting` (all in [App.tsx](App.tsx); each step is a component in [components/](components/)).

### The security boundary (do not break this)

**The browser never talks to an AI provider and never holds the AI key.** The image goes to a Vercel serverless function which holds `OPENAI_API_KEY`:

```
Browser → POST /api/analyze-receipt { imageBase64 }  Authorization: Bearer <google_id_token>
        → api/analyze-receipt.ts  (verifies token, checks email allowlist, rate-limits)
        → lib/ai provider (OpenAI)  ← key stays server-side
```

[api/analyze-receipt.ts](api/analyze-receipt.ts) is the only server entry point. It: verifies the Google ID token (`google-auth-library`), enforces `ALLOWED_EMAILS`, applies a naive in-memory per-email rate limit (resets on cold start), validates MIME type + decoded image size, then calls the provider and never leaks provider errors to the client. When adding server logic, keep secrets out of any code path that reaches the bundle, and keep `vite.config.ts`'s `SERVER_ENV_KEYS` in sync with the env the handler reads.

### AI provider abstraction

Providers live behind the `AIProvider` interface in [lib/ai/](lib/ai). Only OpenAI is implemented. `getProvider()` in [lib/ai/index.ts](lib/ai/index.ts) is the single switch point, keyed off `AI_PROVIDER`. To add Gemini/Anthropic: add `lib/ai/providers/<name>.ts` implementing `AIProvider`, add a `case` in `index.ts`, set the env var. Nothing else changes.

- The extraction prompt (`RECEIPT_PROMPT`) and `ReceiptAnalysis` shape are shared across providers in [lib/ai/types.ts](lib/ai/types.ts), so all providers extract identically. Key prompt rule: a line item's `price` is the **line total** (qty × unit price), and quantity prefixes are stripped from names.
- [lib/ai/postProcess.ts](lib/ai/postProcess.ts) (`toProcessedReceipt`) runs for every provider: filters noise lines (tax/tip/totals/payment lines) via a **whole-word** regex — note this is deliberately not substring matching, so items like "Cashew chicken" survive — and stamps each item with a `crypto.randomUUID()` id.
- Files under `api/` and `lib/ai/` import with explicit `.js` ESM specifiers (e.g. `./types.js`) even though the sources are `.ts` — required for Vercel's Node ESM resolution. Match this in new server-side files. Frontend files use extensionless imports.

### State and the splitting math

`AppState` (in [types.ts](types.ts)) is the single source of truth, held in `App.tsx`'s `useState`. All derived money figures come from `computeStats()` in [state/stats.ts](state/stats.ts) — **never recompute totals ad hoc; go through `computeStats`.**

The math is the heart of the app:
- Items are scaled by `adjustmentFactor = effectiveTotal / itemsSum` so the per-item shares absorb tax/tip/discount and sum back to the receipt total.
- All money is computed in **integer cents** with a largest-remainder split (`splitCents`) so per-person shares always sum exactly to each line total — no floating-point drift.
- **Manual entry mode** (`manualEntry: true`): no scanned receipt, so the base total is the items sum, unless the user pins `manualTotalOverride`. Scanned receipts always use `state.total`. This distinction is load-bearing in `computeStats`.

### Persistence ([state/session.ts](state/session.ts))

localStorage, three separate keys:
- `splitSmart_people` — the people list, kept across sessions/resets.
- `splitSmart_session` — the in-progress split (items/total/assignments). Versioned by `SESSION_VERSION`; **bump it when you change the persisted shape** so stale data is discarded, not rehydrated. Only restored when `step === 'splitting'` (never `analyzing`). The point is that a mobile page-refresh mid-split doesn't wipe work and force another paid AI call.
- `splitSmart_sessionImage` — the (downscaled) receipt image, on its own key because it's multi-MB and changes once per receipt; written by a dedicated effect so it isn't re-serialized on every assignment tap.

### Auth ([services/auth.ts](services/auth.ts))

Thin wrapper over Google Identity Services (script tag in [index.html](index.html)). Holds the ID token in memory + localStorage, decodes the JWT client-side (display only — real verification is server-side), schedules a silent refresh before the ~1h token expiry, and supports silent re-auth for "remembered" users. The whole app is gated behind sign-in in `App.tsx`. The signed-in user's first name seeds "Person #1" on first use only (when the people list is still pristine).

### Person colors ([components/personColors.ts](components/personColors.ts))

Person colors are stored as strings (e.g. `"blue"`). Tailwind class strings are written out **in full** here (not interpolated) because `bg-${color}-100` would be purged at build time. If you add a palette color, add its full class set here **and** to the `@source inline(...)` safelist in [index.css](index.css).

## Conventions

- Path alias `@/*` → repo root (both `tsconfig.json` and `vite.config.ts`).
- Icons: `lucide-react`.
- Edits in the UI apply **live** to `state`, with Apply/Cancel implemented by snapshotting state into a `useRef` when an edit mode opens and restoring it on cancel (see the item-edit and people-edit handlers in `App.tsx`).
