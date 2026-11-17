# Deploy — Vercel (frontend) + VPS (backend)

Topologia em produção:

| Parte | Onde | URL |
|---|---|---|
| Frontend React/Vite | Vercel, projeto `fbsagats-projects/teacherreader` | https://teacherreader.vercel.app |
| API Express | VPS, container Docker `teacherreader-api` | https://instance-20260808-1016.tail4096b.ts.net |
| Dados do usuário | Navegador (IndexedDB/localStorage) + Google Drive opcional | — |

O backend roda isolado em `/opt/teacherreader`, escutando apenas em `127.0.0.1:3110`. A exposição pública é feita por **Tailscale Funnel**, sem usar as portas 80/443, o nginx ou os containers do MemeTrigger.

## Variáveis

| Variável | Onde é lida | Para que serve |
|---|---|---|
| `GEMINI_API_KEY` | Servidor (dotenv) | TTS/STT e avaliação de pronúncia |
| `CORS_ORIGINS` | Servidor (dotenv) | Origens do navegador autorizadas (aceita `*` por origem) |
| `API_ONLY` | Servidor (dotenv) | `true` = só API (sem Vite/`dist/`) |
| `PORT` | Servidor (dotenv) | Porta local; na VPS o compose fixa 3000 (publicado em `127.0.0.1:3110`) |
| `VITE_API_BASE_URL` | Build da Vite | URL pública da API usada pelo frontend (exige redeploy) |
| `DISABLE_HMR` | Dev (Vite) | `true` desliga HMR/file watching (AI Studio) |
| `REPO` / `SERVICE` / `HEALTH_URL` / `HEALTH_ATTEMPTS` / `BRANCH` | Scripts de deploy | Sobrescrevem os padrões de `scripts/vps-deploy.sh` |

Backend em `/opt/teacherreader/.env` (permissão `600`):

```dotenv
GEMINI_API_KEY=...
CORS_ORIGINS=https://teacherreader.vercel.app,https://teacherreader-*-fbsagats-projects.vercel.app
API_ONLY=true
```

- `API_ONLY=true` impede o servidor de tentar montar o Vite/servir `dist/`; o frontend é da Vercel.
- **Não defina `PORT` no `.env` da VPS**: o `docker-compose.vps.yml` fixa `PORT=3000` no container e publica em `127.0.0.1:3110`. Um `PORT` no `.env` só confunde.
- **Não inclua `http://localhost:3000` no `CORS_ORIGINS` de produção**; localhost já funciona sem CORS no dev (mesma origem).
- `CORS_ORIGINS` aceita `*` por origem. Restrinja os previews ao time (`teacherreader-*-fbsagats-projects.vercel.app`): `teacherreader-*.vercel.app` também casaria com um domínio de terceiro chamado `teacherreader-qualquercoisa.vercel.app`, que poderia gastar sua cota do Gemini.
- A chave Gemini nunca vai para a Vercel nem para o bundle do frontend.

Frontend na Vercel (Production e Preview):

```dotenv
VITE_API_BASE_URL=https://instance-20260808-1016.tail4096b.ts.net
```

É uma variável de **build**: depois de alterá-la, é preciso fazer um novo deploy. O `connect-src` do CSP em `vercel.json` fixa esse mesmo host; trocar a URL exige editar o CSP e redeployar.

## Deploy automático

Depois do que está abaixo configurado, **um `git push` na `main` publica as duas pontas**:

| O que muda | Quem publica | Tempo típico |
|---|---|---|
| Frontend (Vercel) | Integração Git da Vercel (`vercel git connect`) | 1–2 min |
| Backend (VPS) | Timer do systemd puxa `origin/main` a cada 60 s | 1–3 min |

### Backend na VPS

```text
teacherreader-deploy.timer (60 s)
  └─ teacherreader-deploy.service (User=ubuntu)
       └─ /usr/local/bin/teacherreader-deploy
            ├─ git fetch origin main  (deploy key read-only)
            ├─ sem commit novo? sai em silêncio
            ├─ git checkout -f -B main "$REMOTE_SHA"
            ├─ bash scripts/vps-deploy.sh
            │    ├─ docker compose up -d --build
            │    │    └─ Dockerfile roda tsc --noEmit + testes (porteiro)
            │    └─ healthcheck em /api/voice-hub/status (60 s)
            └─ falhou? volta para o commit anterior e reconstrói
```

- O `.env` é ignorado pelo git, então `checkout -f` preserva as credenciais.
- Código que não passa no typecheck ou nos testes **não gera imagem**: o deploy falha e o rollback devolve o commit anterior ao ar.
- Logs: `journalctl -u teacherreader-deploy -f`.
- Rodar agora, sem esperar o timer: `sudo systemctl start teacherreader-deploy`.
- Pausar o deploy automático: `sudo systemctl disable --now teacherreader-deploy.timer`.
- Rollback manual: `sudo systemctl stop teacherreader-deploy.timer`, `git -C /opt/teacherreader reset --hard <sha>`, `bash /opt/teacherreader/scripts/vps-deploy.sh`, e reative o timer.

Primeira instalação (uma vez, na VPS, **sem** `sudo` — o script usa `sudo` internamente):

```bash
# 0. Clone e .env ANTES de rodar o instalador (ele aborta sem /opt/teacherreader/.env)
sudo mkdir -p /opt/teacherreader
sudo chown ubuntu:ubuntu /opt/teacherreader
git clone git@github.com:fbsagat/teacherreader.git /opt/teacherreader
sudo install -m 600 -o ubuntu -g ubuntu /dev/null /opt/teacherreader/.env
sudo nano /opt/teacherreader/.env   # GEMINI_API_KEY, CORS_ORIGINS, API_ONLY=true

# 1. Instalador (chave de deploy, wrapper e systemd timer)
bash /opt/teacherreader/scripts/install-vps-auto-deploy.sh
```

- O usuário `ubuntu` precisa rodar `sudo docker ...` sem senha (o service roda como `ubuntu`, sem `root`).
- O script gera a chave `~/.ssh/teacherreader_deploy` e, se o `fetch` falhar, imprime a chave pública para cadastrar em **GitHub → repo → Settings → Deploy keys** (sem write access). Rodar de novo depois disso conclui a instalação.

O CI (`.github/workflows/ci.yml`) roda lint, testes e build em push na `main`, em PRs e via `workflow_dispatch`. Ele **não** bloqueia o deploy: a VPS publica o que está na `main`. Se o CI ficar vermelho, corrija ou reverta — o rollback automático só cobre falha de build/healthcheck.

### Problemas comuns no deploy automático

| Sintoma no `journalctl -u teacherreader-deploy` | Causa / correção |
|---|---|
| `git fetch falhou` repetido | deploy key removida do GitHub ou rede fora; recadastre com `bash scripts/install-vps-auto-deploy.sh` |
| `Permission denied (publickey)` | idem: a chave `~/.ssh/teacherreader_deploy` do usuário `ubuntu` não está nas Deploy keys |
| `did not complete successfully: exit code: 1` no `npx tsc --noEmit` | o commit tem erro de tipo; corrija e faça push. A API segue no commit anterior |
| `healthcheck falhou após 60s` | container subiu mas não responde; veja `docker logs teacherreader-api` (o rollback já tentou reverter) |
| `sem mudança de backend` | esperado: só docs/frontend mudaram, a API não é reconstruída |
| nada aparece | timer parado: `systemctl status teacherreader-deploy.timer` |

### Frontend na Vercel

A Vercel já está conectada ao repositório: push na `main` gera deploy de produção; outras branches geram preview. `VITE_API_BASE_URL` é build-time e já está configurada em Production e Preview.

## Atualizar o backend manualmente (contingência)

Se o timer estiver parado ou o GitHub fora do ar. Antes de copiar arquivos à mão, pare o timer — senão o próximo ciclo faz `checkout -f` e desfaz sua cópia:

```bash
sudo systemctl stop teacherreader-deploy.timer
# ... fluxo manual abaixo ...
sudo systemctl start teacherreader-deploy.timer
```

Da raiz do projeto, no Windows:

```powershell
tar -czf "$env:TEMP\teacherreader-src.tgz" `
  --exclude=node_modules --exclude=dist --exclude=.git --exclude=.vercel `
  --exclude=.aistudio --exclude='.env*' --exclude='tmp_probe*.ts' `
  --exclude='*.log' .

scp "$env:TEMP\teacherreader-src.tgz" memetrigger-vps:/tmp/teacherreader-src.tgz

ssh memetrigger-vps "sudo tar -xzf /tmp/teacherreader-src.tgz -C /opt/teacherreader && sudo chown -R ubuntu:ubuntu /opt/teacherreader && sudo chmod 600 /opt/teacherreader/.env && rm -f /tmp/teacherreader-src.tgz && cd /opt/teacherreader && sudo docker compose -f docker-compose.vps.yml up -d --build"
```

O `tar` exclui `.env`, `.env.local`, `.vercel` e probes temporários, então as credenciais da VPS não são sobrescritas nem vazam para o arquivo. O build usa `Dockerfile` + esbuild; a imagem final contém `server.js` e apenas dependências de produção.

Para mudar apenas o `.env`:

```bash
ssh memetrigger-vps
sudo nano /opt/teacherreader/.env
cd /opt/teacherreader
sudo docker compose -f docker-compose.vps.yml up -d --force-recreate teacherreader-api
```

## Verificar

```bash
curl -s https://instance-20260808-1016.tail4096b.ts.net/api/voice-hub/status
# {"providers":{"gemini":true,"googleStream":true}}

ssh memetrigger-vps "sudo docker ps --filter name=teacherreader-api"
ssh memetrigger-vps "sudo docker logs --tail 50 teacherreader-api"
ssh memetrigger-vps "sudo tailscale funnel status"
```

Teste de CORS (deve devolver `204` e `Access-Control-Allow-Origin`):

```bash
curl -i -X OPTIONS \
  -H "Origin: https://teacherreader.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  https://instance-20260808-1016.tail4096b.ts.net/api/voice-hub/tts
```

### Diagnóstico automatizado (`scripts/check-apis.mjs`)

Confere API, CORS, Google Translate GTX, MyMemory, dictionaryapi e o proxy
`/__/auth/iframe` em uma execução, com `PASS`/`WARN`/`FAIL` e código de saída 1
quando algo essencial quebra (bom para rodar antes/depois de um deploy).

```bash
node scripts/check-apis.mjs                 # só checks gratuitos
node scripts/check-apis.mjs --with-tts      # + TTS (gasta cota do Gemini/TikTok)
node scripts/check-apis.mjs --stt-file=fala.webm   # + STT real (grave 2–3 s)

# apontando para o servidor local
node scripts/check-apis.mjs --base-url=http://localhost:3000 --site=http://localhost:3000
```

Flags: `--base-url`, `--site`, `--origin`, `--with-tts`, `--stt-file`,
`--timeout`. O check de STT real valida o parâmetro novo do servidor: transcrição
vazia agora responde `502` (antes vinha `200` com `transcript: ""`).

## Atualizar o frontend

```powershell
npx vercel link          # uma vez: .vercel/ não é versionado
npx vercel deploy --prod --yes
```

O projeto fica vinculado em `.vercel/project.json` (pasta **não versionada**; rode `npx vercel link` de novo em outra máquina). Variáveis de ambiente ficam no dashboard da Vercel; para alterar:

```powershell
npx vercel env add VITE_API_BASE_URL production
npx vercel deploy --prod --yes
```

A Vercel **não** tem rewrite para `/api/*`: sem `VITE_API_BASE_URL` o frontend chama `https://teacherreader.vercel.app/api/...` e recebe 404 do próprio domínio. O frontend sempre monta URLs via `apiUrl()`.

## Tailscale Funnel

```bash
ssh memetrigger-vps "sudo tailscale funnel --bg 3110"
ssh memetrigger-vps "sudo tailscale funnel status"
```

O Funnel persiste após reboot. Para desligar:

```bash
ssh memetrigger-vps "sudo tailscale funnel --https=443 off"
```

## Rollback

- Backend (rollback real): volte para o commit anterior e reconstrua, como o wrapper faz automaticamente:
  ```bash
  sudo systemctl stop teacherreader-deploy.timer
  git -C /opt/teacherreader reset --hard <sha-anterior>
  bash /opt/teacherreader/scripts/vps-deploy.sh
  sudo systemctl start teacherreader-deploy.timer
  ```
  `docker compose ... down` **não é rollback**: derruba a API e o Funnel passa a devolver erro.
- Frontend: `npx vercel rollback` ou redeploy de uma versão anterior no dashboard.
- Rollback completo: reverta o commit no GitHub; o timer republica a `main` anterior.

## Testar a imagem Docker localmente

Antes de push (o build da imagem roda typecheck + testes):

```bash
docker build -t teacherreader-api:local .
docker run --rm -p 3110:3000 --env-file .env -e API_ONLY=true teacherreader-api:local
curl -s http://127.0.0.1:3110/api/voice-hub/status
```

## Cota do Gemini (voz neural)

O projeto está no **free tier** do Gemini API: os modelos TTS aceitam ~10 requisições por dia (o 429 traz `generate_content_free_tier_requests, limit: 10`; valor externo, verificado em 16/11/2026). Cada frase tocada consome 1 requisição por bloco de 240 caracteres — ou seja, o free tier não sustenta uso real de voz neural.

Cadeia de fallback do TTS (não reordene sem motivo):

1. `gemini-3.8-flash-tts` (principal) → `providerUsed: "gemini_tts"`
2. `gemini-3.8-flash-lite-tts` (reserva quando o principal esgota) → `providerUsed: "gemini_tts"`
3. Worker neural do TikTok → `providerUsed: "neural_cloud:<voiceId>"` (ex.: `neural_cloud:br_001`)
4. Google Translate GTX → `providerUsed: "google_gtx:pt-BR"` (ou `en-US`)

`provider: "online"` no request pede o caminho leve: tenta GTX e, se falhar, a voz neural — sem repetir o GTX que acabou de falhar.

Quando um modelo responde 429, só ele entra em cooldown (o valor vem do `retry in ...` da própria mensagem, limitado a 24h) e o próximo da lista assume; o log mostra `[tts] <modelo> sem cota`. Três falhas seguidas em 60 s abrem um circuit breaker de 90 s. Se todos esgotarem, a API cai no worker do TikTok e o áudio continua funcionando em MP3.

Para usar a voz neural do Gemini em produção, ative o faturamento do projeto no AI Studio (isso leva a conta ao Tier 1). Sem faturamento, o esperado é o fallback — não é falha de deploy.

## Segurança e limites

- Rate limit por IP: TTS 30/min, STT 20/min. Roda **antes** do body parser. IPv6 é agregado por `/64`.
- `trust proxy` = **exatamente 1 hop** (só o Tailscale Funnel fica na frente). Não confie em `X-Forwarded-For` de forma genérica: qualquer hop extra permitiria burlar o limite.
- Body: TTS 64 kB, STT 9 MB (áudio decodificado limitado a 6 MB), demais rotas 1 MB. O limite de 4,5 MB da Vercel não se aplica: o áudio vai do navegador direto para o Funnel.
- Timeouts: TTS aborta em 13 s, STT em 7 s, e a conexão é abortada se o cliente desistir — o servidor não continua queimando cota.
- Erros: cota esgotada → `429` + `Retry-After`; upstream indisponível/fila cheia → `503`; bug real → `500`. O corpo é sempre JSON em pt-BR.
- O endpoint é público e não tem autenticação. O rate limit protege a cota do Gemini, mas não substitui autenticação se o uso crescer.
- O container roda como usuário `node`, sem portas públicas no host (só `127.0.0.1:3110`), com `read_only`, `cap_drop: ALL` e log rotacionado (10 MB × 3).

## Ativar o Google Drive (backup opcional)

O backup usa Firebase Auth + `drive.appdata` no projeto `gen-lang-client-0186216759`. Toda a configuração abaixo é manual, no console — o app não tem como alterá-la via API sem credenciais de dono do projeto.

1. **Firebase Console → Authentication → Sign-in method → Google**: precisa estar **ativado**, com e-mail de suporte.
2. **Firebase Console → Authentication → Settings → Authorized domains**: adicionar `teacherreader.vercel.app` (sem `https://`). Sem isso o login falha com `auth/unauthorized-domain`.
3. **Google Cloud Console → APIs e Serviços → Biblioteca → Google Drive API**: ativar. Sem isso o backup falha com 403 mesmo após o login.
4. **Google Cloud Console → APIs e Serviços → Tela de consentimento OAuth**:
   - Escopo `.../auth/drive.appdata` presente.
   - Se o status for **Testing**, adicionar sua conta em *Usuários de teste* (limite de 100) — sem isso o Google mostra `Erro 403: access_denied`.
   - Para uso por terceiros, publicar o app; escopos sensíveis podem exigir verificação do Google.
5. Testar em https://teacherreader.vercel.app → engrenagem → Backup no Google Drive → **Entrar com Google**.

### authDomain de primeira parte (não remover)

O login não usa `gen-lang-client-0186216759.firebaseapp.com` como `authDomain` em produção. `vercel.json` faz proxy de `/__/auth/*` para esse domínio do Firebase e `src/services/googleDriveSyncService.ts` define `authDomain = window.location.hostname`. Isso é obrigatório em navegadores que bloqueiam cookies de terceiros: sem o proxy, o retorno do redirecionamento chega vazio e o modal fica em "Desconectado" sem mensagem de erro.

Consequências:

- `teacherreader.vercel.app` precisa estar em *Authorized domains* (já coberto no passo 2).
- O cliente OAuth do Firebase precisa ter `https://teacherreader.vercel.app/__/auth/handler` em **Authorized redirect URIs** (Google Cloud Console → APIs e Serviços → Credenciais → o cliente "Web client (auto created by Google Service)", id `781206693622-88l264tnost8a1pinqmdnrc3n3rvrh4u`). Sem isso o Google mostra "Acesso bloqueado: a solicitação desse app é inválida" (`Error 400: redirect_uri_mismatch`) e o login nunca conclui — a mensagem aparece antes de o app receber qualquer resposta, então não é falha de código. Depois de salvar, aguarde alguns minutos: o Google demora para propagar a alteração.
- **Não remova** `https://gen-lang-client-0186216759.firebaseapp.com/__/auth/handler` da mesma lista. Ele é o redirect padrão do Firebase e é o único usado em `npm run dev` (localhost/dev mantêm `authDomain = firebaseapp.com`) e por qualquer build antigo em cache. Ao adicionar o URI do Vercel, o padrão deve ser mantido em paralelo — trocar um pelo outro quebra o ambiente local.
- Deploys de **preview** usam o próprio domínio como `authDomain`; cada preview novo precisa ser autorizado no Firebase **e** ter o `redirect_uri` correspondente para o Drive funcionar ali.
- Em `localhost` o `authDomain` continua sendo `firebaseapp.com`, então o `npm run dev` não depende do proxy.
- O token do Drive fica **só na memória** (decisão de segurança): recarregar a página, abrir outra aba ou passar ~1h exige reconectar — isso é esperado, não é bug. Se a *Tela de consentimento OAuth* estiver em **Testing**, até o refresh token expira a cada 7 dias; nesse caso publicar o app (Publishing status → In production) evita a reconexão semanal.

Erros comuns já traduzidos no app (ver `src/utils/driveApiErrors.ts`):

| Situação | Mensagem |
|---|---|
| Domínio fora da lista do Firebase | "o domínio X não está autorizado no Firebase" |
| `redirect_uri` ausente no cliente OAuth | "Acesso bloqueado: a solicitação desse app é inválida" → cadastrar `https://<domínio-do-site>/__/auth/handler` em Authorized redirect URIs |
| Google Drive API desativada | "A Google Drive API não está ativada no projeto do Google Cloud" |
| Consent screen em teste | "Erro 403: access_denied" → adicionar usuário de teste |
| Escopo insuficiente | "autorizou permissões insuficientes" |

## Pendências / manutenção

- **Rotação da chave Gemini:** se a chave for exposta, gere outra e atualize `/opt/teacherreader/.env`, depois recrie o container.
- **Domínio próprio:** o Funnel usa `*.ts.net`. Para usar um domínio bonito, é preciso configurar DNS/Cloudflare ou um reverse proxy; não faça isso no nginx do MemeTrigger sem planejamento.
- O backup do Google Drive continua sendo opcional; o app funciona sem ele.

