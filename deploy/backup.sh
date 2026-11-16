#!/bin/sh
# Run from deploy directory; stop the only writer for a DB/files consistency window.
set -eu
umask 077
out=${1:?absolute new backup directory required}
case "$out" in /*) ;; *) echo 'absolute path required' >&2; exit 1;; esac
[ ! -e "$out" ] || { echo 'backup target exists' >&2; exit 1; }
mkdir -p "$out"
# Trusted deployment environment, never enable shell tracing.
set -a
. ./.env
set +a
docker compose stop api
trap 'docker compose start api >/dev/null' EXIT HUP INT TERM
docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot --single-transaction --routines --triggers --events --no-tablespaces --set-gtid-purged=OFF "$MYSQL_DATABASE"' > "$out/database.sql"
tar -C "$DATA_ROOT/assets" -czf "$out/assets.tar.gz" .
cp compose.yaml "$out/compose.yaml"
printf 'release=%s\ncreated_utc=%s\n' "$RELEASE" "$(date -u +%FT%TZ)" > "$out/manifest.txt"
(cd "$out" && sha256sum database.sql assets.tar.gz compose.yaml manifest.txt > SHA256SUMS)
printf 'Complete: %s\n' "$out"
