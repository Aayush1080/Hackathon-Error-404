#!/usr/bin/env bash
# LOCAL TEST STACK ONLY. Runs PostgREST (:3000) and the fake Supabase gateway
# (:54321) in the foreground until stopped. Run devstack/reset_db.sh first.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
set -a; . "$HERE/.env.devstack"; set +a
postgrest "$HERE/postgrest.conf" >/tmp/postgrest.log 2>&1 &
PGRST=$!
trap 'kill $PGRST 2>/dev/null' EXIT
cd "$HERE" && python3 -m uvicorn fake_supabase:app --host 127.0.0.1 --port 54321 --log-level warning
