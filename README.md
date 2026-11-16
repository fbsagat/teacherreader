# Teacher Reader / ShadowReader

Plataforma de leitura bilíngue EN→PT-BR com treino de pronúncia (shadowing), tradução interlinear, dicionário e desafios por frase.

## Pré-requisitos

- Node.js **22.18+** (o `npm start` roda `node server.ts` com type stripping nativo).
- npm (o `package-lock.json` é o lockfile oficial; o CI, o Docker e a Vercel usam `npm ci`).

## Rodar localmente

```bash
npm install
cp -n .env.example .env   # -n não sobrescreve um .env existente; preencha GEMINI_API_KEY
npm run dev
```

O app fica em http://localhost:3000 (Express + Vite no mesmo processo, não na 5173).

Sem `GEMINI_API_KEY` o app **abre e funciona**: o TTS cai nos fallbacks (neural/TikTok/GTX) e a avaliação de pronúncia por IA responde `503` — o app segue com o motor local. Para liberar a voz neural e a avaliação multimodal, preencha `GEMINI_API_KEY`.

## Verificar

```bash
npm run lint                              # tsc --noEmit
npm test                                  # node:test em src/utils/*.test.ts
npm run build                             # build do frontend em dist/
```

Um teste só:

```bash
npx tsx --test src/utils/shadowing.test.ts
```

Os testes são `node:test` puros (sem Jest/Vitest) e rodam direto no Node via `tsx`.

## Estrutura

- `server.ts` — API Express (`/api/voice-hub/*`), TTS/STT, fallbacks, rate limit e deadlines.
- `src/App.tsx` — motor de shadowing e estado da UI.
- `src/utils/` — regras puras e testes (`node:test`).
- `src/components/` — modais e barras (carregados sob demanda).
- `src/data/` — `SAMPLE_BOOKS`/dicionário local (o primeiro livro é usado sem upload e pelos testes).
- `src/services/storageService.ts` — IndexedDB/localStorage.
- `src/services/googleDriveSyncService.ts` — backup opcional no Google Drive.
- `scripts/` — deploy automático da VPS.
- `Dockerfile` + `docker-compose.vps.yml` — imagem da API.
- `.github/workflows/ci.yml` — lint, testes e build (não bloqueia deploy).

## Produção

Frontend na Vercel e API em Docker na VPS (Tailscale Funnel). O frontend usa `VITE_API_BASE_URL` em tempo de build; o backend roda com `API_ONLY=true`, CORS restrito e rate limit por IP.

Runbook completo, variáveis, rollback e ativação do Google Drive: [DEPLOY.md](DEPLOY.md).

## Problemas comuns no dev

| Sintoma | Correção |
|---|---|
| `EADDRINUSE` na porta 3000 | outro processo usando a porta: `npx kill-port 3000` ou `PORT=3001 npm run dev` |
| TTS sempre em voz robótica | sem `GEMINI_API_KEY` (ou cota free tier esgotada) é o fallback esperado |
| Pronúncia retorna `503` | configure `GEMINI_API_KEY` no `.env` |
| `npm start` responde 404 na raiz | rode `npm run build` antes (produção serve `dist/`) |
