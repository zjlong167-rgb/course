#!/bin/sh
# Run in a separate deploy directory with separate .env and fresh DATA_ROOT.
set -eu
backup=${1:?backup directory required}
set -a
. ./.env
set +a
[ "$COMPOSE_PROJECT_NAME" != course-prod ] || { echo 'independent project required' >&2; exit 1; }
[ "$HTTP_PORT" != 80 ] || { echo 'independent port required' >&2; exit 1; }
[ ! -e "$DATA_ROOT" ] || { echo 'fresh data directory required' >&2; exit 1; }
(cd "$backup" && sha256sum -c SHA256SUMS)
mkdir -p "$DATA_ROOT/assets"
tar -C "$DATA_ROOT/assets" -xzf "$backup/assets.tar.gz"
chown -R 10001:10001 "$DATA_ROOT/assets"
docker compose up -d --wait mysql
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"' < "$backup/database.sql"
docker compose up -d --wait api web
printf 'Restored; verify login, public versions, historical assets and playback before acceptance.\n'
