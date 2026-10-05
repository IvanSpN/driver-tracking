#!/usr/bin/env bash
# Деплой на сервере. Запускает GitHub Actions по ssh ключом, который в
# ~/.ssh/authorized_keys ограничен одной командой:
#
#   restrict,command="cd ~/apps/driver-tracking && git fetch -q --prune origin main && git reset -q --hard origin/main && exec bash deploy/deploy.sh" ssh-ed25519 AAAA... github-actions-driver-tracking
#
# Вручную на сервере: bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="$HOME/backups/driver-tracking"
KEEP_BACKUPS=14

echo "==> $(git log -1 --format='%h %s')"

# Бэкап до перезапуска: новые миграции применятся при старте backend
if [ -n "$(docker compose ps -q --status running db)" ]; then
  mkdir -p "$BACKUP_DIR"
  file="$BACKUP_DIR/$(date +%Y%m%d-%H%M%S).sql.gz"
  echo "==> Бэкап базы: $file"
  if ! docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$file"; then
    rm -f "$file"
    echo "Бэкап не удался — деплой остановлен" >&2
    exit 1
  fi
  ls -1t "$BACKUP_DIR"/*.sql.gz | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm --
else
  echo "==> db не запущена — бэкап пропущен"
fi

echo "==> Сборка образов"
docker compose build --progress=plain

echo "==> Перезапуск контейнеров"
docker compose up -d --remove-orphans

# Любой ответ меньше 500 — приложение поднялось (без токена /api отдаёт 401)
echo "==> Проверка backend"
for _ in $(seq 45); do
  if docker compose exec -T backend node -e \
    "fetch('http://localhost:3000/api').then(r => process.exit(r.status < 500 ? 0 : 1), () => process.exit(1))" \
    >/dev/null 2>&1; then
    docker image prune -f >/dev/null
    docker compose ps
    echo "==> Готово"
    exit 0
  fi
  sleep 2
done

echo "backend не ответил за 90 с" >&2
docker compose ps
docker compose logs --tail=80 backend
exit 1
