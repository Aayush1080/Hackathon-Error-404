#!/usr/bin/env bash
# LOCAL TEST STACK ONLY. Recreates the "morisafe" database the way the live
# Supabase project looks today (000 + rows shaped like the prototype's), then
# applies 001 twice to prove it is idempotent. Then start devstack/serve.sh.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SERVER="$(dirname "$HERE")"
PGBIN=/usr/lib/postgresql/16/bin
PGDATA=${PGDATA:-/tmp/pgdata}
FILES=${DEVSTACK_FILES:-/tmp/devstack-storage}
PSQL="psql -h 127.0.0.1 -U postgres -v ON_ERROR_STOP=1 -q -X"
export DEVSTACK_JWT_SECRET="local-devstack-secret-that-is-at-least-32-chars"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  mkdir -p "$PGDATA" && chown postgres:postgres "$PGDATA"
  su postgres -c "$PGBIN/initdb -D $PGDATA -A trust -U postgres" >/dev/null
fi
if ! su postgres -c "$PGBIN/pg_ctl -D $PGDATA status" >/dev/null 2>&1; then
  su postgres -c "$PGBIN/pg_ctl -D $PGDATA -o '-p 5432 -k /tmp -c listen_addresses=127.0.0.1' -l /tmp/pg.log start" >/dev/null
  sleep 2
fi
$PSQL -d postgres -c "drop database if exists morisafe with (force)" -c "create database morisafe" </dev/null

$PSQL -d morisafe -f "$HERE/bootstrap.sql" </dev/null
$PSQL -d morisafe -f "$SERVER/migrations/000_existing_schema.sql" </dev/null

# Rows shaped exactly like the ones the prototype inserted with the anon key.
$PSQL -d morisafe </dev/null <<'SQL'
insert into auth.users (id, email, encrypted_password) values
  ('11111111-1111-4111-8111-111111111111', 'admin@morisafe.test',   crypt('Admin-Pass-123',   gen_salt('bf'))),
  ('22222222-2222-4222-8222-222222222222', 'citizen@morisafe.test', crypt('Citizen-Pass-123', gen_salt('bf'))),
  ('33333333-3333-4333-8333-333333333333', 'viewer@morisafe.test',  crypt('Viewer-Pass-123',  gen_salt('bf')));
insert into public.admins (user_id, full_name, email, role) values
  ('11111111-1111-4111-8111-111111111111', 'Test Admin',  'admin@morisafe.test',  'admin'),
  ('33333333-3333-4333-8333-333333333333', 'Test Viewer', 'viewer@morisafe.test', 'viewer');
insert into public.reports
  (id, title, category, description, latitude, longitude, location_name, image_url, status, created_at, approved_at, observed_time)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Fallen tree on road - Curepipe', 'Fallen tree on road',
   'Legacy row: custom category and public photo URL', -20.3181, 57.5237, 'Royal Road, Curepipe',
   'https://example.supabase.co/storage/v1/object/public/report-photos/legacy-1.jpg', 'approved',
   now() - interval '2 hours', null, '09:15'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Flooding - Port Louis', 'Flooding', '', -20.1609, 57.5012,
   'Port Louis', null, 'pending', '2026-11-13 20:30:00+00', null, '23:59'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Fire - Triolet', 'Fire', 'Smoke seen', -20.0572, 57.5486,
   'Triolet', null, 'rejected', now() - interval '3 hours', null, 'not a time');
insert into storage.objects (bucket_id, name) values ('report-photos', 'legacy-1.jpg');
SQL

rm -rf "$FILES" && mkdir -p "$FILES/report-photos"
python3 - "$FILES" <<'PY'
import sys, json
from PIL import Image
p = f"{sys.argv[1]}/report-photos/legacy-1.jpg"
Image.new("RGB", (64, 48), (200, 80, 40)).save(p, "JPEG")
open(p + ".meta", "w").write(json.dumps({"content_type": "image/jpeg"}))
PY

# The migration under test, twice.
$PSQL -d morisafe -f "$SERVER/migrations/001_api_gateway.sql" </dev/null
$PSQL -d morisafe -f "$SERVER/migrations/001_api_gateway.sql" </dev/null
echo "001 applied twice without error"

read -r SERVICE_KEY ANON_KEY < <(python3 - <<'PY'
import jwt, os, time
s = os.environ["DEVSTACK_JWT_SECRET"]; now = int(time.time())
mk = lambda role: jwt.encode({"iss": "supabase", "ref": "localdev", "role": role, "iat": now, "exp": now + 10 * 365 * 86400}, s, algorithm="HS256")
print(mk("service_role"), mk("anon"))
PY
)
cat > "$HERE/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:authenticator-local-only@127.0.0.1:5432/morisafe"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$DEVSTACK_JWT_SECRET"
server-port = 3000
EOF
cat > "$HERE/.env.devstack" <<EOF
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
DEVSTACK_ANON_KEY=$ANON_KEY
DEVSTACK_JWT_SECRET=$DEVSTACK_JWT_SECRET
DEVSTACK_FILES=$FILES
APP_SECRET=devstack-app-secret-not-for-production-0123456789
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174
EOF
echo "database ready; now run devstack/serve.sh"
