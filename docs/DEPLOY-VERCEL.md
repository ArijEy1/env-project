# Deploying to Vercel (Web + API + Neon Postgres)

This project is a monorepo:

- `apps/web` — Next.js frontend → **Vercel** (native fit)
- `apps/api` — NestJS API → **Vercel serverless function** (wrapped in `apps/api/api/index.ts`)
- Database → **Neon** (serverless Postgres)
- Hourly draft-maintenance job → **Vercel Cron** (the in-app `@Cron` can't run serverless)

You create **two Vercel projects from the same GitHub repo** — one for the web, one for the API — by giving each a different **Root Directory**.

---

## 1. Database — Neon

1. Create a project at [neon.tech]; create a database (e.g. `env_project`).
2. Copy the **pooled** connection string (host contains `-pooler`), e.g.
   `postgres://user:pass@ep-xxx-pooler.eu-central-1.aws.neon.tech/env_project?sslmode=require`
3. Load the schema + official v0.4 content **from your machine** (Vercel has no release step):

   ```bash
   cd apps/api
   export DATABASE_URL="postgres://…-pooler…/env_project?sslmode=require"
   export POSTGRES_SSL=true
   export NODE_ENV=production
   npm run build
   npm run migrate:prod        # creates all tables (idempotent)
   npm run import:sems:prod     # loads the 168 v0.4 questions + reference data
   # optional: seed a platform superadmin
   node dist/admin/seed-admin.js --email admin@yourdomain.sa --password 'Strong1Pass'
   ```

   Re-run `migrate:prod` / `import:sems:prod` any time the schema or question bank changes.

---

## 2. API project (Vercel)

**New Project → import the repo → Root Directory = `apps/api`.**

Vercel picks up `apps/api/vercel.json` automatically:
- `buildCommand: npm run build` compiles NestJS to `dist/` (so decorator metadata is emitted by `tsc`, not esbuild).
- the catch-all rewrite sends every request to `api/index.ts`, which boots Nest once per warm container.
- the `crons` entry calls `/api/cron/maintenance` hourly.

### Environment variables (API project → Settings → Environment Variables)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon **pooled** connection string |
| `POSTGRES_SSL` | `true` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGIN` | your web URL, e.g. `https://your-app.vercel.app` |
| `APP_WEB_URL` | same web URL (used in password-reset links) |
| `TRUST_PROXY` | `1` |
| `CRON_SECRET` | `openssl rand -hex 32` (Vercel sends it to the cron route) |
| `SMTP_HOST` | your mail host (required in production) |
| `SMTP_PORT` | e.g. `587` |
| `SMTP_SECURE` | `false` (or `true` for 465) |
| `SMTP_USER` / `SMTP_PASSWORD` | mail credentials |
| `SMTP_FROM` | `no-reply@yourdomain.sa` |

> `FORCE_HTTPS` is unnecessary — Vercel always serves HTTPS.

Deploy. Health check: `https://<api-project>.vercel.app/api/health` → `{"status":"ok","db":"up"}`.

---

## 3. Web project (Vercel)

**New Project → same repo → Root Directory = `apps/web`.** Vercel auto-detects Next.js.

### Environment variable

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<api-project>.vercel.app/api` |

Deploy, then open the web URL and register / log in.

> After the API domain is known, make sure the **API** project's `CORS_ORIGIN` and `APP_WEB_URL` point at this web domain, and redeploy the API.

---

## 4. Verify

- `GET /api/health` on the API domain returns `db: up`.
- Register a user on the web app. **Email must work** in production (SMTP), or the OTP can't be delivered — there is no console fallback when `NODE_ENV=production`.
- Cron: check the API project → **Cron Jobs** tab shows `/api/cron/maintenance` running hourly (200).

---

## Gotchas & notes

- **Decorators:** the function imports the pre-built `dist/` on purpose. Do **not** change it to import from `src/` — Vercel's esbuild won't emit the `emitDecoratorMetadata` NestJS needs, and DI will fail at runtime.
- **Migrations are manual** (step 1). Vercel has no post-deploy release phase, so schema changes must be pushed from your machine (or a CI job) against Neon before the new code goes live.
- **Connection pooling:** always use Neon's **pooled** endpoint. Each cold-started function opens its own pool; the pooler multiplexes them so you don't exhaust Postgres connections.
- **Cold starts:** the first request after idle boots NestJS (~1–3 s). `maxDuration` is set to 30 s to absorb it.
- **Persistent host alternative:** if serverless friction becomes annoying, the same repo runs unchanged on Railway/Render — set the same env vars (minus `CRON_SECRET`, since the in-app `@Cron` runs there) and use `npm run start:prod` equivalent (`node dist/main.js`).
