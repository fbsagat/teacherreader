# AGENTS.md

ShadowReader / Teacher Reader: bilingual EN→PT-BR reading + shadowing app. React 19 SPA, Express backend, no monorepo. All user-facing copy is Brazilian Portuguese (pt-BR); keep new UI strings and errors in pt-BR. The English page title/OG tags are an intentional exception.

## Commands

- Node **22.18+** (Vite 8 needs ≥22.12; `npm start` = `node server.ts` needs native type stripping). `engines` in `package.json` reflects this.
- Install: `npm install`. `.npmrc` sets `legacy-peer-deps=true` because `esbuild@^0.25` conflicts with Vite 8's peer range; do not remove it. `package-lock.json` is the only lockfile (npm is used by CI, Docker and Vercel).
- Dev: `npm run dev` → Express + Vite middleware on http://localhost:3000 (not Vite's 5173). Windows shortcut: double-click `iniciar-servidor.bat` (checks Node ≥ 22, installs deps if needed, boots the dev server and opens the browser).
- API diagnostics: `node scripts/check-apis.mjs` (add `--with-tts` / `--stt-file=fala.webm` to spend Gemini quota, `--base-url=...` for local/prod).
- Typecheck: `npm run lint` (it is only `tsc --noEmit`; no ESLint/Prettier configured).
- Build: `npm run build` builds the client only into `dist/`. With `NODE_ENV=production`, `npm start` serves `dist/`. `start` runs `node server.ts` directly.
- Tests: `npm test` (`tsx --test "src/utils/*.test.ts"`, `node:test` + `node:assert/strict`). Single file: `npx tsx --test src/utils/shadowing.test.ts`.
- Clean: `npm run clean` is cross-platform (Node `fs.rmSync`, removes `dist/`).
- CI: `.github/workflows/ci.yml` runs `npm ci`, `npm run lint`, `npm test` and `npm run build` on push to `main`, PRs and `workflow_dispatch`. It is **not** a deploy gate: the Vercel Git integration and the VPS timer publish `main` regardless. There are no pre-commit hooks.

## Architecture

- `server.ts` is the entire backend and the entrypoint. In dev it mounts Vite as middleware; in production it serves `dist/`. With `API_ONLY=true` it skips Vite/static entirely. Endpoints: `/api/voice-hub/status`, `/api/voice-hub/tts`, `/api/voice-hub/stt`.
- Production hosting is split: frontend on Vercel, API in Docker on the VPS. Always build API URLs through `apiUrl()` in `src/utils/apiBase.ts` (reads `VITE_API_BASE_URL`); never hardcode `fetch('/api/...')`, or the Vercel build will call its own domain.
- The API is public, so TTS/STT have per-IP rate limits (30/min and 20/min, IPv6 grouped by `/64`) mounted **before** the body parser: TTS body 64 kB, STT body 9 MB (6 MB of decoded audio), other routes 1 MB. CORS is restricted by `CORS_ORIGINS` (supports `*` per origin; scope previews to `teacherreader-*-fbsagats-projects.vercel.app` so a lookalike domain can't spend the Gemini quota). Keep both when changing deployment.
- Server boots without `GEMINI_API_KEY`; AI endpoints then return 503 or fall back. `dotenv/config` loads `.env`. `.env.local` exists only for the Vercel CLI (`VERCEL_OIDC_TOKEN`), is gitignored and must never be committed or copied to the VPS.
- Every TTS/STT request creates an `AbortController` tied to `res.on('close')` plus a server budget (TTS 13 s, STT 12 s) and passes `abortSignal` to Gemini, so a client that gave up stops burning quota. The client aborts TTS/STT at 13 s, i.e. after the server, so the JSON error usually wins. Errors are translated per scope (`ROUTE_ERROR_MESSAGES`, `tts` vs `stt`). The Gemini gate semaphore has a queue cap (503 when full).
- TTS fallback order (don't reorder casually): `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` → TikTok neural-cloud worker → Google Translate GTX. If any chunk fails, the whole response is rejected so audio is never partially spoken. A 429 cools down only that model (delay parsed from the API message, capped at 24h); when every model is cooling, the whole Gemini path pauses for 90s. Three consecutive failures in 60 s open a 90 s circuit breaker. The project is on the Gemini free tier, where TTS allows ~10 requests/day, so the TikTok fallback is the normal path until billing is enabled.
- `providerUsed` formats: `gemini_tts`, `neural_cloud:<voiceId>` (e.g. `neural_cloud:br_001`), `google_gtx:pt-BR`. The client only special-cases `gemini_tts`.
- STT uses `gemini-3.5-transcribe` for plain transcripts (its text arrives in a non-text `audioTranscription` part, extracted by `extractTranscriptionText` — reading only `response.text` yields "") and `gemini-3.8-flash` with a JSON schema for pronunciation scores (`STT_COACH_MODEL`; `gemini-4-hydrogen` takes >25 s and blows the deadline). An empty transcript is a `502`, never a `200` with `transcript: ""`. Incoming audio is validated: `data:` prefix stripped, base64 charset checked, magic bytes sniffed (wav/ogg/mp3/mp4/webm/aac/flac), 6 MB limit, and the sniffed container decides the mime passed to Gemini.
- Translation/dictionary calls happen in the browser directly (`translate.googleapis.com`, `api.mymemory.translated.net`, `api.dictionaryapi.dev`) with in-memory caches; only TTS/STT go through the server.
- `src/App.tsx` (~6.6k lines) owns the shadowing-engine FSM and nearly all state. Flow/scoring rules belong in the pure helpers under `src/utils/` (`shadowing.ts`, `challengeFlow.ts`, `studyFlowLifecycle.ts`, `ttsPlayback.ts`, …) where the `*.test.ts` specs live; extend those instead of growing `App.tsx`. Keep new logic DOM-free so it runs under `node:test`.
- Big modals are `React.lazy` + mounted only while open, and `firebase/auth` is imported dynamically inside `googleDriveSyncService`; keep them out of the initial bundle.
- Persistence boundary is `src/services/storageService.ts`: books in IndexedDB `ShadowReaderDB` v1 (`books`, `meta`), settings/vocab/stats under `shadowreader_*` localStorage keys, bookmarks `sr_bookmark_*`, active book `sr_active_book_id`. Bump `DB_VERSION` for schema changes.
- Google Drive backup uses Firebase Auth + Drive `appDataFolder`, filename `teacher-reader-sync-v1.json`; merge/conflict rules are in `src/utils/driveSync.ts` (deterministic `updatedAt`, key-order-insensitive fingerprint, documented max-wins stats merge). The OAuth token is deliberately memory-only — never persist it.
- PDF import loads PDF.js on demand from a CDN (`loadPdfjs()` in `src/utils/fileParsers.ts`, pinned version + SRI) and the worker also comes from the CDN; there is no npm package. `src/utils/fileParsers.ts` supports PDF/EPUB/DOCX/TXT/MD/.markdown/SRT/VTT/HTML/.htm/CSV/TSV/JSON/RTF and rejects binary formats it cannot parse.
- `firebase-applet-config.json` is intentionally kept in the repo (public Firebase web config).

## Where things live / gotchas

- UI strings are inline in `App.tsx` and `components/`; there is no i18n layer — edit the string where it renders.
- API contract lives in `server.ts` and the client wrappers in `src/services/audioAndTranslationService.ts`. Keep request/response fields in sync (e.g. `audioChunks[]`, `mimeType`, `providerUsed`).
- `src/data/` holds `SAMPLE_BOOKS` and the local dictionary. `SAMPLE_BOOKS[0]` is imported by tests too, so changing them can break the suite.
- `dist/`, `.vercel/` and `.aistudio/` are generated/untracked; never edit them.
- Client-only libraries (`react`, `firebase`, `qrcode`, `vite`, …) stay in `devDependencies` on purpose: the API Docker image runs `npm ci --omit=dev` and must not install them.

## Adding a card/step to the study flow

1. Add the card id to `StudyStepCardType` in `src/types/shadowreader.ts`.
2. Register label/behavior in `STEP_CARD_META` (`src/utils/cardSequencePresets.ts`).
3. Include it in `buildEffectiveCardSequence` (pure helper) and its tests.
4. Migrate old saved settings in `normalizeSettings` (`src/utils/settingsNormalizer.ts`) if the new card changes `cardSequence` defaults.
5. Render the stage in `App.tsx` (engine FSM) and in the Settings preset UI.

## Conventions / quirks

- `@/*` maps to the repo root, not `src/`; most imports are relative.
- `vite.config.ts` disables HMR and file watching when `DISABLE_HMR=true` (AI Studio). Leave it: it prevents reload flicker during agent edits. `build.target` is explicit (`es2020`/`safari14`) — do not reintroduce regex lookbehind; Safari < 16.4 fails at parse time.
- `SAMPLE_BOOKS[0]` is the default book, so the app works without an upload; tests also rely on `SAMPLE_BOOKS` and `DEFAULT_SETTINGS`.
- `tsconfig.json` has no `strict` mode and uses `noEmit` + `allowImportingTsExtensions`; run `npm run lint` before finishing, but don't assume strict null checks.
- Anti-bug rules learned in review: never write storage/DOM inside a `setState` updater (compute outside, persist after); never use `toISOString().slice(0,10)` for the user's "day" (use `localDayKey` in `src/utils/localTime.ts`); never put `select-none` on `<body>` (breaks text selection; scope it to chrome/overlays); validate external data at the boundary (`normalizeSettings`, `parseDriveBackupSnapshot`, file parsers).

## Production deployment

- Frontend: Vercel project `fbsagats-projects/teacherreader` → https://teacherreader.vercel.app. `VITE_API_BASE_URL` is a build-time env var; changing it requires a redeploy **and** updating the `connect-src` host in the `vercel.json` CSP.
- `vercel.json` has no `/api/*` rewrite: without `VITE_API_BASE_URL` the browser calls the Vercel domain and gets a 404. `vercel.json` also proxies `/__/auth/*` and `/__/firebase/*` to Firebase for the first-party login.
- Backend: VPS `memetrigger-vps` (Tailscale), `/opt/teacherreader`, container `teacherreader-api`, loopback `127.0.0.1:3110`, public via Tailscale Funnel `https://instance-20260808-1016.tail4096b.ts.net`.
- The VPS is shared with MemeTrigger. Never touch `/opt/MemeTrigger`, its nginx, ports 80/443, or its containers. This deployment must stay isolated in `/opt/teacherreader` using Funnel.
- Backend secrets live in `/opt/teacherreader/.env` (mode `600`): `GEMINI_API_KEY`, `CORS_ORIGINS`, `API_ONLY=true`. Do not set `PORT` there (compose fixes 3000) and do not add localhost to production `CORS_ORIGINS`.
- Deploys are automatic on push to `main`: Vercel builds the frontend from Git, and the VPS runs `teacherreader-deploy.timer` (60 s) → `/usr/local/bin/teacherreader-deploy` → `scripts/vps-deploy.sh`, which fetches `origin/main`, rebuilds and rolls back if the healthcheck fails. `/opt/teacherreader` is a git checkout; `.env` stays untracked because it is gitignored.
- The Dockerfile runs `tsc --noEmit` and `npm test` in the build stage, so a broken commit never produces an image. Never add `--no-verify`-style escapes there: the VPS relies on that gate.
- Manual backend update is contingency only (see "Atualizar o backend manualmente" in `DEPLOY.md`); frontend can still be forced with `npx vercel deploy --prod --yes`.
- Full runbook, variables, verification and rollback: `DEPLOY.md`.
- Firebase Auth authorized domains must include `teacherreader.vercel.app` for the optional Google Drive login. Activation checklist (authorized domain, Google provider, Drive API, OAuth consent screen, redirect URI) is in `DEPLOY.md`.
- Drive auth/API failures are translated to actionable pt-BR in `src/utils/driveApiErrors.ts` (pure, tested). Extend that instead of surfacing raw `Firebase: Error (auth/...)` text.
- Firebase Auth uses a first-party `authDomain`: `vercel.json` proxies `/__/auth/*` (and `/__/firebase/*`) to `<project>.firebaseapp.com`, and `googleDriveSyncService` sets `authDomain = window.location.hostname` outside localhost. Keep both. Without the proxy, browsers that block third-party cookies silently lose the redirect result (popup-blocked → redirect → app returns "Desconectado" with no error). Localhost keeps `firebaseapp.com`.
- Restrict the public Firebase web API key by HTTP referrer in Google Cloud (only the Teacher Reader domains); the config file is public by design.
