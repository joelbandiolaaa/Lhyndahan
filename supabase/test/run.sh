#!/usr/bin/env bash
# Applies the migrations to a throwaway local Postgres DB and runs assertions.
# Usage: supabase/test/run.sh   (needs a local Postgres you can reach with psql)
set -euo pipefail
cd "$(dirname "$0")/.."
DB=hopia_test
PSQL=(psql -X -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
for r in anon authenticated service_role; do
  "${PSQL[@]}" -d postgres -c "do \$\$ begin if not exists (select from pg_roles where rolname='$r') then execute 'create role $r nologin'; end if; end \$\$" >/dev/null
done
"${PSQL[@]}" -d $DB -f test/supabase_stub.sql
for f in migrations/*.sql; do "${PSQL[@]}" -d $DB -f "$f"; done
for t in test/test_*.sql; do "${PSQL[@]}" -d $DB -f "$t"; done
