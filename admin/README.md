# MoriSafe Admin

1. `npm install`
2. Copy `.env.example` to `.env` and set `VITE_API_URL` to the MoriSafe API (e.g. http://localhost:8000).
3. `npm run dev` → http://localhost:5173/admin and sign in with a Supabase account listed in `public.admins`.

The dashboard holds no database keys. Every action goes through the API, which checks the session and role.
See the top-level README for setup, deployment and roles.
