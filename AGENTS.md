# AGENTS.md

ShadowReader / Teacher Reader: bilingual EN→PT-BR reading + shadowing app. React 19 SPA, Express backend, no monorepo. All user-facing copy is Brazilian Portuguese (pt-BR); keep new UI strings and errors in pt-BR.

## Commands

- Install: `npm install`. `.npmrc` sets `legacy-peer-deps=true` because `esbuild@^0.25` conflicts with Vite 8's peer range; do not remove it. `bun install` also works (`bun.lock`).
- Dev: `npm run dev` → Express + Vite middleware on http://localhost:3000 (not Vite's 5173).
- Typecheck: `npm run lint` (it is only `tsc --noEmit`; no ESLint/Prettier configured).
- Build: `npm run build` builds the client only into `dist/`. With `NODE_ENV=production`, `npm start` serves `dist/`. `start` runs `node server.ts` directly, so it needs a recent Node with native TS stripping; otherwise run `npx tsx server.ts`.
- Tests: `npx tsx --test "src/utils/*.test.ts"` (`node:test` + `node:assert/strict`). Single file: `npx tsx --test src/utils/shadowing.test.ts`. There is no `npm test` script.
- Ignore `npm run clean`: it uses Unix `rm -rf` and removes a `server.js` that is never built.

## Architecture

- `server.ts` is the entire backend and the entrypoint. In dev it mounts Vite as middleware; in production it serves `dist/`. With `API_ONLY=true` it skips Vite/static entirely. Endpoints: `/api/voice-hub/status`, `/api/voice-hub/tts`, `/api/voice-hub/stt`.
- Production hosting is split: frontend on Vercel, API in Docker on the VPS. Always build API URLs through `apiUrl()` in `src/utils/apiBase.ts` (reads `VITE_API_BASE_URL`); never hardcode `fetch('/api/...')`, or the Vercel build will call its own domain.
- The API is public, so TTS/STT have per-IP rate limits and CORS is restricted by `CORS_ORIGINS` (supports `*` per origin; scope previews to `teacherreader-*-fbsagats-projects.vercel.app` so a lookalike domain can't spend the Gemini quota). Keep both when changing deployment.
- Server boots without `GEMINI_API_KEY`; AI endpoints then return 503 or fall back. `dotenv/config` loads `.env` — the README's old `.env.local` instruction was wrong.
- TTS fallback order (don't reorder casually): `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` → TikTok neural-cloud worker → Google Translate GTX. If any chunk fails, the whole response is rejected so audio is never partially spoken. A 429 cools down only that model (delay parsed from the API message, capped at 24h); when every model is cooling, the whole Gemini path pauses for 90s. The project is on the Gemini free tier, where TTS allows ~10 requests/day, so the TikTok fallback is the normal path until billing is enabled.
- STT uses `gemini-3.5-transcribe` for plain transcripts and `gemini-4-hydrogen` with a JSON schema for pronunciation scores; model IDs are hardcoded in `server.ts`.
- Translation/dictionary calls happen in the browser directly (`translate.googleapis.com`, `api.mymemory.translated.net`, `api.dictionaryapi.dev`) with in-memory caches; only TTS/STT go through the server.
- `src/App.tsx` (~6.5k lines) owns the shadowing-engine FSM and nearly all state. Flow/scoring rules belong in the pure helpers under `src/utils/` (`shadowing.ts`, `challengeFlow.ts`, `studyFlowLifecycle.ts`, `ttsPlayback.ts`, …) where the `*.test.ts` specs live; extend those instead of growing `App.tsx`. Keep new logic DOM-free so it runs under `node:test`.
- Persistence boundary is `src/services/storageService.ts`: books in IndexedDB `ShadowReaderDB` v1 (`books`, `meta`), settings/vocab/stats under `shadowreader_*` localStorage keys, bookmarks `sr_bookmark_*`, active book `sr_active_book_id`. Bump `DB_VERSION` for schema changes.
- Google Drive backup uses Firebase Auth + Drive `appDataFolder`, filename `teacher-reader-sync-v1.json`; merge/conflict rules are in `src/utils/driveSync.ts`. The OAuth token is deliberately memory-only — never persist it.
- PDF import relies on global `pdfjsLib` loaded from a CDN in `index.html` (worker also from CDN), not an npm package. `src/utils/fileParsers.ts` supports PDF/EPUB/DOCX/TXT/MD/SRT/VTT/HTML/CSV/TSV/JSON/RTF.
- `firebase-applet-config.json` is intentionally kept in the repo (public Firebase web config).

## Conventions / quirks

- `@/*` maps to the repo root, not `src/`; most imports are relative.
- `vite.config.ts` disables HMR and file watching when `DISABLE_HMR=true` (AI Studio). Leave it: it prevents reload flicker during agent edits.
- `SAMPLE_BOOKS[0]` is the default book, so the app works without an upload; tests also rely on `SAMPLE_BOOKS` and `DEFAULT_SETTINGS`.
- `tsconfig.json` has no `strict` mode and uses `noEmit` + `allowImportingTsExtensions`; run `npm run lint` before finishing, but don't assume strict null checks.
- No CI or pre-commit hooks: verification is typecheck + the tsx test command.

## Production deployment

- Frontend: Vercel project `fbsagats-projects/teacherreader` → https://teacherreader.vercel.app. `VITE_API_BASE_URL` is a build-time env var; changing it requires a redeploy.
- Backend: VPS `memetrigger-vps` (Tailscale), `/opt/teacherreader`, container `teacherreader-api`, loopback `127.0.0.1:3110`, public via Tailscale Funnel `https://instance-20260808-1016.tail4096b.ts.net`.
- The VPS is shared with MemeTrigger. Never touch `/opt/MemeTrigger`, its nginx, ports 80/443, or its containers. This deployment must stay isolated in `/opt/teacherreader` using Funnel.
- Backend secrets live in `/opt/teacherreader/.env` (mode `600`): `GEMINI_API_KEY`, `CORS_ORIGINS`, `API_ONLY=true`.
- Update backend: tar the source (exclude `node_modules`, `dist`, `.env`, `.aistudio`), scp to the VPS, extract into `/opt/teacherreader`, then `sudo docker compose -f docker-compose.vps.yml up -d --build`.
- Update frontend: `npx vercel deploy --prod --yes`.
- Full runbook, verification and rollback: `DEPLOY.md`.
- Firebase Auth authorized domains must include `teacherreader.vercel.app` for the optional Google Drive login. Activation checklist (authorized domain, Google provider, Drive API, OAuth consent screen) is in `DEPLOY.md`.
- Drive auth/API failures are translated to actionable pt-BR in `src/utils/driveApiErrors.ts` (pure, tested). Extend that instead of surfacing raw `Firebase: Error (auth/...)` text.
- Firebase Auth uses a first-party `authDomain`: `vercel.json` proxies `/__/auth/*` (and `/__/firebase/*`) to `<project>.firebaseapp.com`, and `googleDriveSyncService` sets `authDomain = window.location.hostname` outside localhost. Keep both. Without the proxy, browsers that block third-party cookies silently lose the redirect result (popup-blocked → redirect → app returns "Desconectado" with no error). Localhost keeps `firebaseapp.com`.
