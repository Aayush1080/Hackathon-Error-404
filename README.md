# Hackathon-Error-404
# MoriSafe server: migrations and local test stack

- `migrations/`: SQL for the Supabase database.
- `devstack/`: a local copy of the Supabase pieces MoriSafe uses, for testing.

> ⚠️ `devstack/` is for local testing only. Never run any of it against the real Supabase project.

## Migrations

Run them in order in the Supabase SQL editor. Each one is safe to re-run and never deletes reports.

| File | What it does |
|------|--------------|
| `000_existing_schema.sql` | The original prototype schema, already live. Used as the starting point. |
| `001_api_gateway.sql` | Moves all access behind the API server and adds report photos, an audit log and notification devices. The photo bucket becomes private. **Breaking:** the old prototypes can no longer read, insert or upload anonymously. |
| `002_accounts_and_review.sql` | Adds citizen/police accounts (NID sign-in), merging of duplicate reports, "is it still there?" feedback and a translation cache. |

## Local test stack

**Needs:**

- root access
- PostgreSQL 16
- `postgrest` on your `PATH`
- these Python packages:
  ```
  pip install fastapi uvicorn httpx "psycopg[binary]" pyjwt pillow python-multipart
  ```

```bash
sudo ./devstack/reset_db.sh   # rebuild the DB, seed it, apply 001 twice
./devstack/serve.sh           # PostgREST on :3000, fake Supabase on :54321
```

Then load `devstack/.env.devstack` into the API server's environment. Keep that file and `devstack/postgrest.conf` out of git, since they hold the local keys.

**Test accounts:**

| Email | Password |
|-------|----------|
| `admin@morisafe.test` | `Admin-Pass-123` |
| `viewer@morisafe.test` | `Viewer-Pass-123` |
| `citizen@morisafe.test` | `Citizen-Pass-123` |

**Notes:**

- `reset_db.sh` wipes the local database every time it runs.
- `reset_db.sh` does not apply `002` yet.
- The fake auth and storage services are approximations. They are not a security boundary.
