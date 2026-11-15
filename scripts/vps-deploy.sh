#!/usr/bin/env bash
# =============================================================================
# scripts/vps-deploy.sh — aplica o commit que já está em /opt/teacherreader.
#
# Chamado por /usr/local/bin/teacherreader-deploy (systemd timer), sempre depois
# do repositório ser sincronizado com origin/main. Reconstrói a imagem, troca o
# container e só retorna sucesso se a API responder ao healthcheck; caso
# contrário sai != 0 e o wrapper volta para o commit anterior.
#
# O `--build` roda typecheck e testes dentro do Dockerfile: imagem quebrada nem
# chega a ser gerada.
# =============================================================================
set -euo pipefail

REPO="${REPO:-/opt/teacherreader}"
SERVICE="${SERVICE:-teacherreader-api}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3110/api/voice-hub/status}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-60}"

cd "$REPO"

echo "[deploy] construindo $(git rev-parse --short HEAD) ($(git log -1 --format=%s))"
sudo docker compose -f docker-compose.vps.yml up -d --build

for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
  if curl -fsS -m 3 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "[deploy] API saudável — $(git rev-parse --short HEAD) no ar"
    exit 0
  fi
  sleep 1
done

echo "[deploy] healthcheck falhou após ${HEALTH_ATTEMPTS}s. Últimos logs:"
sudo docker logs --tail 40 "$SERVICE" 2>&1 || true
exit 1
