# Hackathon-Error-404
# MoriSafe

Community incident reporting and public alerts for Mauritius. Citizens report hazards (fire, accident,
flooding, falling debris, other) with a photo and location from their phone; administrators review each
report; approved reports appear in the public Alerts list and Map for 20 hours.

MoriSafe is not an emergency dispatch service. In immediate danger, call 999 (Police), 114 (SAMU) or 115 (Fire).

```
 Android / web app (app/)          Admin dashboard (admin/)
 Vite + Leaflet + Capacitor        React + Vite + Tailwind
            │  HTTPS                         │  HTTPS, admin session token
            └───────────────┬────────────────┘
                            ▼
               MoriSafe API (server/)  FastAPI
     validation · photo checks · sessions · roles · audit · rate limits
                            │  service-role key (server only)
                            ▼
                     Supabase project
   Postgres (reports, photos, audit, accounts) · Auth (admins) · private Storage bucket (photos)
```

## Project structure

| Folder | What it is |
|---|---|
| `app/` | Public app: web and Android (Capacitor). `src/main.js` is the whole UI |
| `admin/` | Admin dashboard (React) |
| `server/` | API server (`server.py` → `app/`), database migrations, tests and a local test stack |
| `Dockerfile`, `render.yaml` | One-service deployment: app at `/`, dashboard at `/admin`, API at `/api` |
| `start-all.ps1` | Windows: runs API, dashboard and app locally in one go |
| `start-phone.ps1` | Windows: runs everything behind a public HTTPS Cloudflare link for phones |

## Requirements

- Python 3.12, Node.js 20 or newer, Git
- A free [Supabase](https://supabase.com) project (database, auth and photo storage)
- For the Android app only: Android Studio, or Java 21 + the Android SDK

## Quick start (Windows)

1. Set up the database once (step 1 below).
2. `copy server\.env.example server\.env` and fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `APP_SECRET`.
3. `powershell -ExecutionPolicy Bypass -File start-all.ps1`

It creates the Python environment and installs packages on first run, then opens:
API http://localhost:8000/api/health · Dashboard http://localhost:5175/admin · App http://localhost:5174

To open it on phones over HTTPS instead: `powershell -ExecutionPolicy Bypass -File start-phone.ps1`
(prints a public `trycloudflare.com` link; it changes each run).

## Step by step

### 1. Update the database (Supabase SQL editor)

1. Back up first: Table Editor → `reports` → export to CSV.
2. Open SQL Editor, paste `server/migrations/001_api_gateway.sql`, run it, then do the same with
   `server/migrations/002_accounts_and_review.sql` (citizen accounts, police reports, duplicate merging,
   "still there?" answers, translation cache). Both are safe to re-run and never delete reports.
   (`000_existing_schema.sql` is your existing `supabase.sql`, already applied.)
3. Check you are an administrator: `select * from public.admins;` must list your Supabase user.
   Roles: `admin` (everything, the default), `moderator` (approve, reject, edit, but not delete), `viewer` (read only).

After this, the old HTML prototypes can no longer read or write reports, and old public photo links stop working.
That is intentional: anyone holding the anon key could previously read every photo, including pending ones.

### 2. Run the API server

```bash
cd server
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                               # then fill in the three required values
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are the values already in your old `SafetyServer/.env`.
`APP_SECRET` is new: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
Open http://localhost:8000/api/health: it should say `{"status":"ok","database":"ok"}`. Interactive API docs: `/docs`.

**Deploy it** so phones can reach it over HTTPS (a phone cannot use `localhost` or your laptop's
`192.168.56.1` address). One service serves everything from one address: the public app at `/`, the admin
dashboard at `/admin` and the API at `/api` (built by the root `Dockerfile`). On Render: New → Blueprint →
pick this repo (it reads the root `render.yaml`) → enter `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` →
Apply. The first build takes about 5 minutes. The free tier sleeps after 15 minutes idle, so open
`/api/health` a minute before you present.

**Windows, all three locally in one go:** `powershell -ExecutionPolicy Bypass -File start-all.ps1`
(API :8000, app :5174, dashboard :5175/admin).

### 3. Run the admin dashboard

```bash
cd admin
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000, or your deployed API URL
npm run dev                 # http://localhost:5173/admin
```

To host it: `npm run build` and publish `dist/` (Netlify, Vercel or a Render static site) with a rewrite of
`/*` to `/index.html`. Add the site's address to the server's `ALLOWED_ORIGINS`.

### 4. Run the public app

In a browser (quickest way for judges to try it on their own phones):

```bash
cd app
npm install
cp .env.example .env        # VITE_API_URL = your deployed HTTPS API
npm run dev                 # http://localhost:5174
```

Publish `npm run build` → `dist/` the same way as the dashboard, and add its address to `ALLOWED_ORIGINS`.

As an Android app (needs Android Studio):

```bash
cd app
npm run android             # builds, copies into android/, opens Android Studio
```

Then Run ▶ on a phone or emulator, or Build → Build APK(s).

**Without Android Studio (what was used for the demo APK):** Java 21 is in
`%LOCALAPPDATA%\Programs\MicrosoftJDK`, the Android SDK in `%LOCALAPPDATA%\Android\Sdk`. Put the API address in
`app/.env.android` (`VITE_API_URL=https://...`), then in `app/`: `npx vite build --mode android && npx cap sync android`,
and in `app/android/`: `gradlew.bat assembleRelease` (with `JAVA_HOME` set). The APK is
`app/android/app/build/outputs/apk/release/app-release.apk`, signed with `app/android/morisafe-release.jks`
(passwords in `app/android/keystore.properties`; both are git-ignored). Keep that key: Android only accepts an
update signed with the same key. The `android/` project is already generated with
location and notification permissions. Rebuild (`npm run android`) whenever you change `VITE_API_URL`.
The app must use an HTTPS API address: Android blocks plain `http://` from the app.
iOS: `npx cap add ios` on a Mac, then open in Xcode; the code is platform-neutral.

## Demo script (about 3 minutes)

1. Phone: first launch asks you to create an account (NID such as `A0101901234567`, name, password).
   Pick Français or Kreol on that screen: the whole app switches, including report descriptions.
2. Report → Flooding → location fills from GPS → Take photo (full-screen camera) → Send for review.
   It says "Report received", and Alerts does **not** show it yet.
3. Send the same incident again from another account: it is merged, not duplicated.
4. Laptop: dashboard → sign in → one incident "+1 merged", with both photos. Approve opens the review
   checklist; all six points must be ticked. The history shows who approved it and when.
5. Phone: Alerts → the incident appears with its photo and type symbol; filter Citizens / Police;
   Map shows type symbols plus police stations, hospitals and fire stations. Walk within 250 m of it and
   the app asks "Is it still there?"; the dashboard shows the answers.
6. Dashboard → Mark resolved: the incident and its photos are deleted.

## API

All responses are JSON. Errors always look like `{"error": {"code": "...", "message": "...", "details": ...}}`.

| Method & path | Who | What |
|---|---|---|
| `GET /api/health` | anyone | Server and database status |
| `GET /api/reports` | anyone | Approved reports published in the last 20 h. Filters: `category`, `town`, `near_lat`+`near_lng`+`radius_km`. Includes `server_time`, `older` (over 12 h) and a signed `photo_url` (valid 1 h) |
| `GET /api/reports/{id}` | anyone | One public report; 404 if pending, rejected, resolved, archived or expired |
| `POST /api/reports` | signed-in citizen | Multipart: `category`, `custom_category` (Other), `location_name`, `latitude`, `longitude`, `observed_time` (HH:MM), `description`, `photo`, `client_ref`, `confirm_distinct`, `merge_into`. Needs `X-Human-Proof`. Saved as **pending**. Same type within 500 m: merged into a pending incident, or 409 `possible_duplicate` for a published one |
| `POST /api/reports/{id}/feedback` | anyone | `{"still_there": true/false}` from someone passing near a published incident |
| `GET /api/auth/challenge?purpose=` | anyone | Single-use proof-of-work challenge (`register`, `login`, `report`) |
| `POST /api/auth/register` / `login` | anyone | NID + password (+ name, optional phone). Needs `X-Human-Proof`. Returns a 30-day token. 5 wrong passwords lock the account for 15 min |
| `GET /api/auth/me` | signed-in citizen | The account |
| `GET /api/reports/mine` | signed-in citizen | Status of the account's reports |
| `PUT` / `DELETE /api/devices` | the phone | Save or forget notification choices and push token |
| `POST /api/admin/login` | admins | Email + password checked by Supabase Auth, then `public.admins`. Returns an 8-hour session token |
| `POST /api/admin/logout` | admins | Revokes the token |
| `GET /api/admin/me` | admins | Current admin and permissions |
| `GET /api/admin/reports` | read | One item per incident (merged duplicates nested in `duplicates`), signed photo URLs (15 min), "still there?" counts |
| `GET /api/admin/reports/{id}` | read | One incident plus its audit history |
| `PATCH /api/admin/reports/{id}` | edit | Change type, description, location, town, coordinates, time observed |
| `PATCH /api/admin/reports/{id}/status` | review | `pending`, `approved` (all six `checklist` items must be true), `rejected` (reason required), `archived`, `resolved` (**deletes** the incident, its merged reports and photos) |
| `POST /api/admin/reports/{id}/merge` / `unmerge` | edit | Merge a report into another incident, or split it back out |
| `DELETE /api/admin/reports/{id}` | delete | Removes the photos from storage, then the incident and its merged reports. The audit entry stays |
| `GET /api/admin/users`, `PATCH /api/admin/users/{id}` | read / admin | Citizen accounts; `PATCH` only sets `disabled` (the role cannot be changed from the dashboard) |

Phones send `X-Device-Id`: a random UUID the app generates (only an HMAC of it is stored; used for rate
limits and notification choices). Accounts: the NID is stored only as an HMAC (for sign-in) plus a masked
copy (`A*********4567`); passwords as salted scrypt hashes. Changing `APP_SECRET` makes existing accounts
unable to sign in, so keep it fixed once people have accounts.

Spam protection: every sign-up, sign-in and report needs a single-use proof-of-work (`X-Human-Proof`), on top
of per-IP and per-account rate limits and the account requirement. AWS WAF CAPTCHA was considered, but it only
works when the server is hosted behind AWS (CloudFront, an ALB or API Gateway); add it there if you move to AWS.

Translation: `GET /api/reports?lang=en|fr|mfe` translates descriptions with Google Cloud Translation when
`GOOGLE_TRANSLATE_API_KEY` is set, otherwise the free MyMemory service (Kreol falls back to French). Only
published text is sent, and results are cached in `public.translations`.

## What the migration changes

`reports` gains `custom_category`, `severity` (urgent/warning/info, from the type; editable), `town`,
`observed_at`, `reviewed_by`, `reviewed_at`, `updated_at`, `reporter_hash`, `client_ref`, and the statuses
`resolved` and `archived`. New tables: `report_photos` (storage path, MIME type, size, dimensions, SHA-256),
`report_audit` (who did what, old and new status, changed fields), `devices` (notification choices; location
rounded to about 1 km, stored only if "notify me within 10 km" is on). Existing rows are backfilled: "Other"
text moved into `custom_category`, photo URLs turned into storage paths, missing `approved_at` filled.

## Security

- The service-role key exists only in the server's environment. The app and dashboard contain no keys.
- Admin access is enforced by the server on every request: the token is verified, and `public.admins` is
  re-read each time, so removing someone takes effect immediately. The acting admin's identity always comes
  from the token, never from the request.
- Photos: the real file contents are decoded (the name and declared type are ignored). Only JPEG, PNG, WebP
  and HEIC are accepted, 10 MB maximum, 50 megapixels maximum. Every photo is re-encoded as a new JPEG,
  which removes GPS and other metadata and anything hidden in the file. Files get server-generated names in a
  private bucket. Public phones only ever get short-lived links to photos of approved, current reports.
- Validation on the server: Mauritius bounds, type, lengths, time format. Text is stored as plain text and
  HTML-escaped wherever it is displayed. Database access is parameterised through PostgREST.
- Rate limits: 6 reports per 10 minutes per phone and 30 per hour per IP address; 8 sign-in attempts per
  15 minutes per email address.
- CORS allows only the origins in `ALLOWED_ORIGINS`. Responses carry `nosniff`, `no-referrer`, `DENY` framing.
- The prototype said reports were "encrypted (AES-256-GCM) before they are sent"; that encryption happened and
  was undone inside the same page. The app now says what is true: reports travel over HTTPS. The profile is
  still stored on the phone encrypted with AES-256-GCM, as before.

## Notifications

- **In-app alerts work now.** The app checks for newly approved reports every minute and when reopened,
  and shows a notification matching the Urgent / Warning / Information and "within 10 km" choices in Profile.
  On a phone this only happens while the app is open or recently backgrounded.
- **Background push needs Firebase** (cannot be configured without your account):
  1. Firebase console → add an Android app with package `mu.morisafe.app` → download `google-services.json`
     into `app/android/app/`.
  2. Project settings → Service accounts → Generate new private key. Put the file's path (or its JSON) in the
     server's `FIREBASE_SERVICE_ACCOUNT`.
  3. Build the app with `VITE_PUSH_ENABLED=true`. (Leave it `false` until step 1 is done: registering for push
     without `google-services.json` crashes the Android app on start.)
  On each approval the server then sends push messages to phones whose choices match. This code path is written
  but untested, because it needs a real Firebase project.

## Testing

### Results (14 November 2026)

**API: 16/16 tests pass** (`server/tests/test_api.py`), including the six required scenarios:

| Brief test | Result |
|---|---|
| 1 Submit a report | Saved as pending with photo metadata; stored photo is a re-encoded JPEG with orientation applied and no EXIF; not in the public list; public lookup returns 404 |
| 2 Administrator review | Admin signs in, sees the report with coordinates and a working photo link; approval updates status, reviewer and time; audit entry written |
| 3 Public visibility | Approved report appears with correct coordinates, severity and a working photo link |
| 4 Rejection | Rejection needs a reason; rejected (and later resolved) reports never appear publicly |
| 5 Persistence | A brand-new server process still returns the report and its photo |
| 6 Security | Missing, invalid, forged and expired tokens refused; public cannot approve; non-admin Supabase account refused; viewer role cannot approve or delete; removing an admin revokes access at once; logout revokes; text, PHP and GIF files posing as photos refused; 11 MB photo refused; outside-Mauritius, NaN and malformed fields refused; SQL-like and HTML text stored literally |

Also covered: the migration's backfills, idempotency (applied twice) and lock-down of direct anon-key access;
duplicate within 500 m asks for confirmation instead of rejecting; retrying with the same `client_ref` never
creates a second report; admin edits are validated and audited; deleting removes the photo file; HEIC and
transparent PNG are converted; the 20-hour window and 12-hour "older" flag; rate limits; "Your reports";

Browser end-to-end tests were also run during development (not included here).

### How these were tested, and what was not

The test environment could not reach your Supabase project, so tests ran against a local copy of it: real
PostgreSQL 16 with your `supabase.sql` applied, real PostgREST 12.2 (the software behind Supabase's database
API), and small stand-ins for Supabase Auth and Storage (`server/devstack/`). The server itself is unchanged
between this and production. What still needs checking on the real project: the migration, sign-in through
Supabase Auth, and photo upload and signed links in Supabase Storage. Run the demo script once after step 1.

The Android project is generated but no APK was built here (Google's Android download servers were not
reachable). Build it in Android Studio as above. Push notifications are untested (see above).

### Running the tests yourself (Linux or WSL)

Needs PostgreSQL 16, the `postgrest` binary and `pip install -r server/requirements-dev.txt`.

```bash
cd server
devstack/reset_db.sh            # fresh database: your schema + prototype-style rows + 001 applied twice
```


## Limits worth knowing

- Rate limits and logout revocation are held in memory: fine for one server instance; they reset on restart.
- Street names come from OpenStreetMap's free Nominatim service (about one lookup per second is allowed).
- Translations are the prototype's demo strings; most secondary text is still English.
