# CLAUDE.md

Run `npm run typecheck` and `npm test` after changes (no linter). `npm run dev` serves the UI and `/api` together.

Flow is `AppState.step`: `upload` → `analyzing` → `splitting`, orchestrated in `App.tsx`.

## Rules

**Security boundary.** The browser never talks to an AI provider or holds the key; scans go through `api/analyze-receipt.ts`. Handlers log errors server-side and return generic messages — never leak provider/internal errors.

**New handler or server env var** → add it to both `API_ENDPOINTS` and `SERVER_ENV_KEYS` in `vite.config.ts`, or it 404s / misses env under `npm run dev` while working on Vercel.

**Handler shape.** `api/*.ts` exports `default { fetch(req: Request): Promise<Response> }` and replies with `Response.json(...)`. Don't use `res.status().json()` — Vercel's newer runtime doesn't provide it, though the old types claimed it did.

**Server imports** (`api/`, `lib/`) use explicit `.js` specifiers (`./types.js`) for Vercel's Node ESM. Frontend imports are extensionless.

**Access control.**
- Admin is `ADMIN_EMAILS` only — never add it to the DB (no `role` column); the admin UI writes `access_requests` and must not be able to grant admin.
- `upsertWaitlistRequest` must stay `ON CONFLICT DO NOTHING`, so a rejected user can't reset to pending by re-joining.
- `hooks/useAdmin.ts`: a 403 from the probe is the normal non-admin path — never surface it as an error.

**Money.** All derived figures come from `computeStats()` in `state/stats.ts` — never recompute totals ad hoc. Integer cents, largest-remainder split. Manual entry uses the items sum unless `manualTotalOverride` is set; scanned receipts always use `state.total`.

**Receipt extraction.** An item's `price` is the line total (qty × unit). The noise filter in `lib/ai/postProcess.ts` is whole-word on purpose ("Cashew chicken" must survive).

**Persistence.** Bump `SESSION_VERSION` in `state/session.ts` whenever the persisted shape changes.

**Person colors.** Tailwind classes in `components/personColors.ts` are written out in full (interpolation gets purged). A new color also goes in the `@source inline(...)` safelist in `index.css`.

**Edit/cancel pattern.** UI edits apply live to `state`; Cancel restores a `useRef` snapshot taken when the edit mode opened. Follow this for new edit modes.
