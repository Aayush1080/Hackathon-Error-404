# Hackathon-Error-404
# MoriSafe

Hazard reporting and public alerts for Mauritius. People report a hazard with a photo and location, administrators review it, and approved reports appear in the app's Alerts and Map for 20 hours.

```
 Phone app (app/)          Admin dashboard (admin/)
          └──────── HTTPS ────────┘
                      ▼
            API server (server/, FastAPI)
                      ▼  service-role key (server only)
     Supabase: Postgres + private photo bucket
```

Only the server talks to Supabase. The app and the dashboard hold no keys.

## Folders

| Folder | What it is |
|--------|------------|
| `server/` | FastAPI API, SQL migrations, local test stack (`devstack/`), tests |
| `app/` | Public app (Vite web build + Android/iOS via Capacitor) |
| `admin/` | Admin dashboard (React + Vite + Tailwind) |
| `e2e/` | Playwright test of the full workflow, with screenshots |
| `legacy/` | The original prototypes, kept for reference and not used |

## Quick start

1. **Database.** In the Supabase SQL editor, run `server/migrations/001_api_gateway.sql`, then `002_accounts_and_review.sql`. Back up `reports` first. Both are safe to re-run. After this, the old prototypes stop working, and that is intended.
2. **Server.**
   ```bash
   cd server && pip install -r requirements.txt && cp .env.example .env
   uvicorn server:app --reload --port 8000     # check http://localhost:8000/api/health
   ```
   `.env` needs three values:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_SECRET`: keep it fixed once accounts exist, or they can no longer sign in.
3. **App and dashboard.** In each of `app/` and `admin/`, set `VITE_API_URL` in `.env`, then run `npm install && npm run dev`.

**Windows shortcuts:**

- `start-all.ps1`: runs the API (:8000), the app (:5174) and the dashboard (:5175/admin) locally.
- `start-phone.ps1`: builds everything and serves it over a temporary Cloudflare HTTPS link, so phones can reach it.

## Deploy

`render.yaml` with the `Dockerfile` builds a single service that serves the app at `/`, the dashboard at `/admin` and the API at `/api`. On Render, go to New → Blueprint and enter the two Supabase values. The free tier goes to sleep when idle, so open `/api/health` before a demo.

**Android:**

```bash
cd app && npm run android
```

The app needs an HTTPS API address. The signing key (`app/android/*.jks`) and its passwords are git-ignored. Keep the key, because updates must be signed with it.

## Tests

On Linux or WSL:

```bash
cd server
devstack/reset_db.sh && devstack/serve.sh &
python -m pytest -q
```

`devstack/` is a local stand-in for Supabase (PostgreSQL, PostgREST, fake auth and storage). It is for testing only.

For the browser test, run the API, app and dashboard locally, then run `python e2e/e2e_test.py`.

## Known limits

- Rate limits and logouts are held in memory. They reset when the server restarts.
- Background push notifications need a Firebase project and are untested.
- The migrations, Supabase sign-in and photo storage were tested only against the local stand-in, not the live project.
