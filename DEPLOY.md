# Deployment Guide

## Services

| What | Where | Free tier |
|------|-------|-----------|
| Next.js frontend | Vercel | ✅ unlimited |
| NestJS API + Slither + Mythril | Railway | ✅ $5/month credit |
| PostgreSQL | Supabase | ✅ 500MB |
| Redis | Upstash | ✅ 10k req/day |

---

## Step 1 — Supabase (PostgreSQL)

1. Create account at https://supabase.com
2. New project → note the password
3. Settings → Database → Connection string → **URI mode**
4. Copy the URL → use as `DATABASE_URL`

---

## Step 2 — Upstash (Redis)

1. Create account at https://upstash.com
2. New database → region closest to your Railway region
3. Copy **REDIS_URL** from console

---

## Step 3 — Railway (Backend API)

1. Create account at https://railway.app
2. New Project → Deploy from GitHub repo
3. Add service → select your repo
4. Set **Root Directory** to `apps/api`
5. Railway auto-detects `railway.toml` and uses the Dockerfile
6. Add environment variables (from `apps/api/.env.production.example`):
   - `DATABASE_URL` — from Supabase
   - `REDIS_URL` — from Upstash
   - `JWT_SECRET` — run `openssl rand -hex 32` to generate
   - `OPENROUTER_API_KEY` — your key from openrouter.ai
   - `OPENROUTER_MODEL` — `openai/gpt-4.1`
   - `UPLOAD_DIR` — `/app/uploads`
   - `REPORT_DIR` — `/app/reports`
7. Deploy → wait for build (~5–10 min, Slither+Mythril are large)
8. Settings → Domains → copy your Railway URL

> **Note:** First deploy runs `prisma migrate deploy` automatically before starting.

---

## Step 4 — Vercel (Frontend)

1. Create account at https://vercel.com
2. New Project → Import GitHub repo
3. Set **Root Directory** to `apps/web`
4. Add environment variables (from `apps/web/.env.production.example`):
   - `NEXT_PUBLIC_API_URL` — your Railway URL (https://...)
   - `NEXT_PUBLIC_WS_URL` — same host, `wss://` protocol
5. Deploy

---

## Troubleshooting

**API build times out** — Slither+Mythril install is slow (~8–12 min). Railway default timeout is 20 min, should be fine.

**WebSocket disconnects** — Vercel does not proxy WebSockets. The frontend connects directly to Railway URL, which is correct.

**Prisma migration fails** — Check `DATABASE_URL` is correct and Supabase project is active (free tier pauses after 1 week of inactivity).

**Free tier limits** — Railway $5 credit covers ~500 compute hours/month. Upstash 10k req/day resets daily. Supabase pauses inactive projects after 7 days — visit the dashboard to unpause.
