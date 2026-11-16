#!/usr/bin/env bash
# =============================================================================
# scripts/install-vps-auto-deploy.sh — instala o deploy automático na VPS.
#
# Idempotente: pode rodar de novo após qualquer mudança. Faz:
#   1. chave SSH read-only (deploy key) para o repo privado
#   2. /opt/teacherreader como clone de origin/main (o .env é ignorado e fica)
#   3. /usr/local/bin/teacherreader-deploy (fetch + deploy + rollback)
#   4. systemd timer que verifica origin/main a cada minuto
#
# Uso, na VPS, como ubuntu:
#   bash /opt/teacherreader/scripts/install-vps-auto-deploy.sh
#
# Primeira vez: o script gera a chave e para, mostrando o que colar no GitHub
# (Settings → Deploy keys, sem write access). Rode outra vez depois de add.
# =============================================================================
set -euo pipefail

REPO="${REPO:-/opt/teacherreader}"
REMOTE="${REMOTE:-git@github-teacherreader:fbsagat/teacherreader.git}"
BRANCH="${BRANCH:-main}"
KEY="$HOME/.ssh/teacherreader_deploy"
SSH_HOST_ALIAS="github-teacherreader"
WRAPPER="/usr/local/bin/teacherreader-deploy"

log() { echo "[setup] $*"; }
fail() { echo "[setup] ERRO: $*" >&2; exit 1; }

[ -f "$REPO/.env" ] || fail "$REPO/.env não existe. Crie o .env antes de instalar."
[ -f "$REPO/docker-compose.vps.yml" ] || fail "$REPO/docker-compose.vps.yml não existe."

# 1. Chave de deploy -----------------------------------------------------------
if [ ! -f "$KEY" ]; then
  log "gerando chave de deploy em $KEY"
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  ssh-keygen -t ed25519 -N '' -C 'teacherreader-deploy@vps' -f "$KEY" >/dev/null
fi
chmod 600 "$KEY"

if ! grep -q "Host $SSH_HOST_ALIAS" "$HOME/.ssh/config" 2>/dev/null; then
  log "adicionando alias $SSH_HOST_ALIAS ao ~/.ssh/config"
  cat >> "$HOME/.ssh/config" <<EOF

Host $SSH_HOST_ALIAS
  HostName github.com
  User git
  IdentityFile $KEY
  IdentitiesOnly yes
EOF
  chmod 600 "$HOME/.ssh/config"
fi

touch "$HOME/.ssh/known_hosts"
if ! ssh-keygen -F github.com >/dev/null 2>&1; then
  log "adicionando github.com ao known_hosts"
  ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
fi

# 2. Clone / sincronização -----------------------------------------------------
if [ ! -d "$REPO/.git" ]; then
  log "inicializando repositório em $REPO"
  git -C "$REPO" init -q -b "$BRANCH"
  git -C "$REPO" remote add origin "$REMOTE"
else
  git -C "$REPO" remote set-url origin "$REMOTE"
fi

if ! git -C "$REPO" fetch --quiet origin "$BRANCH"; then
  echo
  echo "A chave de deploy ainda não tem acesso ao repositório. Adicione esta"
  echo "chave pública em https://github.com/fbsagat/teacherreader/settings/keys"
  echo "(Deploy key, SEM 'Allow write access') e rode este script de novo:"
  echo
  cat "$KEY.pub"
  exit 2
fi

git -C "$REPO" checkout --quiet --force -B "$BRANCH" "origin/$BRANCH"
log "repositório em $(git -C "$REPO" rev-parse --short HEAD)"

# 3. Wrapper -------------------------------------------------------------------
log "instalando $WRAPPER"
sudo tee "$WRAPPER" >/dev/null <<'EOF'
#!/usr/bin/env bash
# Sincroniza /opt/teacherreader com origin/main e, se houver commit novo, aplica
# o deploy com rollback automático. Roda a cada minuto por teacherreader-deploy.timer.
set -uo pipefail

REPO=/opt/teacherreader
BRANCH=main
LOCK=/run/lock/teacherreader-deploy.lock
SCRIPT="$REPO/scripts/vps-deploy.sh"

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[auto-deploy] já existe um deploy em andamento; ignorando este ciclo"
  exit 0
fi

cd "$REPO" || exit 1

if ! git fetch --quiet origin "$BRANCH"; then
  echo "[auto-deploy] git fetch falhou (rede ou chave); tentando de novo no próximo ciclo"
  exit 0
fi

LOCAL=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "origin/$BRANCH")
if [ "$LOCAL" = "$REMOTE_SHA" ]; then
  exit 0
fi

echo "[auto-deploy] $(date -Iseconds) ${LOCAL:0:7} -> ${REMOTE_SHA:0:7}"
# .env e .env.bak.* são ignorados pelo git, então reset --hard preserva as
# credenciais da VPS.
git checkout --quiet --force -B "$BRANCH" "$REMOTE_SHA" || exit 1

# Mudança só de docs/frontend não justifica reconstruir a API.
CHANGED=$(git diff --name-only "$LOCAL" "$REMOTE_SHA")
if ! printf '%s\n' "$CHANGED" | grep -qE '^(server\.ts|src/|scripts/|Dockerfile|docker-compose\.vps\.yml|package\.json|package-lock\.json|tsconfig\.json|\.npmrc|firebase-applet-config\.json)'; then
  echo "[auto-deploy] sem mudança de backend; nada a reconstruir (HEAD em $(git rev-parse --short HEAD))"
  exit 0
fi

if bash "$SCRIPT"; then
  echo "[auto-deploy] ok — $(git rev-parse --short HEAD) no ar"
  exit 0
fi

echo "[auto-deploy] deploy falhou; revertendo para ${LOCAL:0:7}"
git checkout --quiet --force -B "$BRANCH" "$LOCAL"
if bash "$SCRIPT"; then
  echo "[auto-deploy] rollback ok — ${LOCAL:0:7} de volta no ar"
else
  echo "[auto-deploy] ATENÇÃO: rollback também falhou; intervenção manual necessária"
fi
exit 1
EOF
sudo chmod 755 "$WRAPPER"
sudo chown root:root "$WRAPPER"

# 4. systemd -------------------------------------------------------------------
log "instalando teacherreader-deploy.service/.timer"
sudo tee /etc/systemd/system/teacherreader-deploy.service >/dev/null <<'EOF'
[Unit]
Description=Teacher Reader — deploy automático a partir de origin/main
Documentation=file:/opt/teacherreader/DEPLOY.md
Wants=network-online.target docker.service
After=network-online.target docker.service

[Service]
Type=oneshot
User=ubuntu
WorkingDirectory=/opt/teacherreader
ExecStart=/usr/local/bin/teacherreader-deploy
TimeoutStartSec=15min
Nice=10
EOF

sudo tee /etc/systemd/system/teacherreader-deploy.timer >/dev/null <<'EOF'
[Unit]
Description=Verifica origin/main a cada minuto e aplica deploy se mudou

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=5s
Unit=teacherreader-deploy.service

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now teacherreader-deploy.timer >/dev/null

log "timer ativo:"
systemctl list-timers teacherreader-deploy.timer --no-pager | sed -n '1,2p'
echo
log "pronto. Acompanhe com: journalctl -u teacherreader-deploy -f"
echo "[setup] chave de deploy (já cadastrada no GitHub se o fetch funcionou):"
echo "        $(cat "$KEY.pub")"
