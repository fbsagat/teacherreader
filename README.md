# Teacher Reader / ShadowReader

Plataforma de leitura bilíngue EN→PT-BR com treino de pronúncia (shadowing), tradução interlinear, dicionário e desafios por frase.

## Rodar localmente

```bash
npm install
cp .env.example .env   # preencha GEMINI_API_KEY
npm run dev
```

O app fica em http://localhost:3000 (Express + Vite no mesmo processo). Sem `GEMINI_API_KEY`, o app funciona com as vozes/fallbacks alternativos.

## Verificar

```bash
npm run lint
npx tsx --test "src/utils/*.test.ts"
npm run build
```

## Produção

| Parte | Onde | URL |
|---|---|---|
| Frontend | Vercel | https://teacherreader.vercel.app |
| API | VPS + Docker + Tailscale Funnel | https://instance-20260808-1016.tail4096b.ts.net |

O frontend usa `VITE_API_BASE_URL` em tempo de build. O backend é `API_ONLY=true`, com CORS restrito e rate limit por IP.

Runbook completo: [DEPLOY.md](DEPLOY.md).

## Estrutura

- `server.ts` — API Express (`/api/voice-hub/*`), TTS/STT e fallbacks.
- `src/App.tsx` — motor de shadowing e estado da UI.
- `src/utils/` — regras puras e testes (`node:test`).
- `src/services/storageService.ts` — IndexedDB/localStorage.
- `src/services/googleDriveSyncService.ts` — backup opcional no Google Drive.
