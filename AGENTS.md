# AGENTS.md

ShadowReader / Teacher Reader: bilingual EN→PT-BR reading + shadowing app. React 19 SPA, Express backend, no monorepo. All user-facing copy is Brazilian Portuguese (pt-BR); keep new UI strings and errors in pt-BR.

## Commands

- Install: `npm install --legacy-peer-deps`. Plain `npm install` fails because `esbuild@^0.25` conflicts with Vite 8's peer range. `bun install` also works; `bun.lock` is the lockfile in the repo.
- Dev: `npm run dev` → Express + Vite middleware on http://localhost:3000 (not Vite's 5173).
- Typecheck: `npm run lint` (it is only `tsc --noEmit`; no ESLint/Prettier configured).
- Build: `npm run build` builds the client only into `dist/`. With `NODE_ENV=production`, `npm start` serves `dist/`. `start` runs `node server.ts` directly, so it needs a recent Node with native TS stripping; otherwise run `npx tsx server.ts`.
- Tests: `npx tsx --test "src/utils/*.test.ts"` (`node:test` + `node:assert/strict`). Single file: `npx tsx --test src/utils/shadowing.test.ts`. There is no `npm test` script.
- Ignore `npm run clean`: it uses Unix `rm -rf` and removes a `server.js` that is never built.

## Architecture

- `server.ts` is the entire backend and the entrypoint. In dev it mounts Vite as middleware; in production it serves `dist/`. Endpoints: `/api/voice-hub/status`, `/api/voice-hub/tts`, `/api/voice-hub/stt`.
- Server boots without `GEMINI_API_KEY`; AI endpoints then return 503 or fall back. `dotenv/config` loads `.env` — the README's `.env.local` instruction is wrong.
- TTS fallback order (don't reorder casually): Gemini TTS → TikTok neural-cloud worker → Google Translate GTX. If any chunk fails, the whole response is rejected so audio is never partially spoken. A Gemini 429 sets a 90-second process-wide cooldown.
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
