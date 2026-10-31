#!/usr/bin/env bash
# Testa as migrações e as permissões (RLS) num Postgres local.
# Uso: PGHOST=... PGPORT=... PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="trainer_test_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT

run() { psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }

run supabase/tests/supabase_shim.sql
for migration in supabase/migrations/*.sql; do
  run "$migration"
done
run supabase/tests/rls_test.sql
