#!/usr/bin/env bash
# Runs all migrations and pgTAP tests against a throwaway local PostgreSQL
# cluster (needs PostgreSQL 15+ with PostGIS and pgTAP installed).
# With Docker available, prefer: npx supabase start && npx supabase test db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${PGTEST_PORT:-54329}"
export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres

cleanup() { "$PG_BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

run_as_postgres() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$WORK"
run_as_postgres "'$PG_BIN/initdb' -D '$WORK/data' -U postgres -A trust >/dev/null"
run_as_postgres "'$PG_BIN/pg_ctl' -D '$WORK/data' -o \"-p $PORT -k $WORK -c listen_addresses=''\" -l '$WORK/log' -w start >/dev/null"

psql -q -v ON_ERROR_STOP=1 -f "$ROOT/scripts/db-test-shim.sql"
psql -q -v ON_ERROR_STOP=1 -c "create extension if not exists pgtap with schema extensions;"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  # pg_net / pg_cron are provided by the shim schemas above.
  sed -E '/create extension if not exists (pg_net|pg_cron)/d' "$f" \
    | PGOPTIONS='-c search_path=public,extensions' psql -q -v ON_ERROR_STOP=1 -f -
done

status=0
for t in "$ROOT"/supabase/tests/database/*.sql; do
  echo "test: $(basename "$t")"
  out="$(PGOPTIONS='-c search_path=public,extensions' psql -X -q -v ON_ERROR_STOP=1 -t -A -f "$t" 2>&1)" || status=1
  echo "$out" | grep -vE '^\s*$' | sed 's/^/  /'
  echo "$out" | grep -qE '^not ok|ERROR|Looks like you failed' && status=1
done

if [ -f "$ROOT/scripts/test-db-concurrency.sh" ]; then
  echo "test: concurrency (last seat)"
  bash "$ROOT/scripts/test-db-concurrency.sh" || status=1
fi
exit $status
