Railway deployment notes — API server
=================================

Quick steps
1. Create a Railway project and connect your GitHub repo (this repo).
2. In Railway, add a service that uses Docker (Railway will detect the root `Dockerfile`).
3. In Railway → Variables, add the variables listed below.
4. Deploy. The service runs the API server at the port defined by `PORT` (default 8080).

Required environment variables (Railway Variables)
- `DATABASE_URL` — Supabase Postgres connection string (postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require)
- `DATABASE_SSL` — `true` (optional, lib/db auto-detects Supabase hosts)
- `SUPABASE_URL` — https://<project>.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (secret — server only)
- `SUPABASE_ANON_KEY` (optional) — publishable key
- `SESSION_SECRET` — random string for sessions
- `PORT` — e.g. `8080`
- `ALLOWED_ORIGIN` — set to your frontend origin (e.g. https://your-vercel-app.vercel.app)

Notes
- The repo is a pnpm workspace. The root `Dockerfile` builds the workspace then runs the `@workspace/api-server` start script.
- `DATABASE_URL` is also used by the `@workspace/db` package (Drizzle). The server will refuse to start without it.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend. Put only `NEXT_PUBLIC_SUPABASE_URL` and the publishable key into your frontend environment.

Frontend env mapping (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` = same as `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` = `SUPABASE_ANON_KEY` (publishable)

Local testing
1. Copy `artifacts/api-server/.env.example` to `artifacts/api-server/.env` and fill values.
2. From repo root run:

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm --filter @workspace/api-server run dev
```

If you'd like, I can also generate a Railway `variables.json` you can import, or configure a simple GitHub Action to auto-deploy. Tell me which you'd prefer.
