# Loupe

Loupe is an editor-curated product discovery platform: people browse, search, save and collect products; makers submit products; editors review, score, schedule and publish them; "Buy now" sends visitors to the maker's own store.

Built with **Next.js 16** (App Router, React 19, TypeScript), **Tailwind CSS 4** with **shadcn/ui**, and **Supabase** (Postgres, Auth, Row Level Security, Storage, pg_cron). Deployed on **Vercel**.

> All brands, products and people in the seed data are fictional demo content.

## What works

- **Visitors**: homepage (CMS-driven sections), discover, product listings with shareable URL filters and sorting, full-text search with autocomplete, product pages (gallery with zoom/fullscreen/swipe, specs, editorial score, related products, JSON-LD), categories, brands, trending, new, deals.
- **Users**: sign up, email confirmation, login, password reset, onboarding with interests, personal feed, saved products (sort/filter), follow brands/categories, reminders (launch, sale, custom date), notifications, profile with avatar upload, preferences.
- **Sellers**: seller profile, 6-step submission wizard with drag-and-drop image upload (validated, converted to WebP), drafts saved at every step, duplicate warnings, preview, submit, messages with editors, resubmission after changes, dashboard and analytics.
- **Editors/admins**: review queue, side-by-side review with live preview, approve / reject / request changes / schedule / publish, product table and editor, editorial scores, featured placements, deals, homepage sections, brands, categories, reports, users and roles, settings, audit log, analytics.
- **Platform**: scheduled publishing and reminders (pg_cron), trending score, outbound click tracking (`/go/product/[id]`), sitemap, robots.txt, RSS, OG images, security headers, rate limiting, audit logging.

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in your Supabase URL and publishable key
npm run dev                       # http://localhost:3000
```

To set up a fresh Supabase project (schema, seed data, demo accounts) see [DEPLOYMENT.md](DEPLOYMENT.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (no network) |
| `npm run test:integration` | Workflow and RLS tests against Supabase using the demo accounts |
| `npm run db:seed` | Seed demo data and demo accounts (`-- --reset` wipes catalogue data first) |
| `npm run db:types` | Regenerate `lib/supabase/database.types.ts` from the database |

## Demo accounts

`npm run db:seed` creates `admin`, `editor`, `seller`, `seller2`, `seller3`, `user` and `user2` accounts at `@loupe.example` with **random passwords** written to `DEMO_ACCOUNTS.local.md` (git-ignored). Passwords are never committed, and the reserved `.example` domain can't receive mail.

To make your own account an admin, sign up normally, then in the Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@yourdomain.com';
```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — structure, data flow, auth, images, workflow
- [DATABASE.md](DATABASE.md) — schema, migrations, functions, jobs, seeding
- [SECURITY.md](SECURITY.md) — RLS, roles, validation, uploads, secrets
- [DEPLOYMENT.md](DEPLOYMENT.md) — Supabase + Vercel setup
- [GREENFUNDING.md](GREENFUNDING.md) — GREEN FUNDING import, translation and review workflow
- [ENVIRONMENT.md](ENVIRONMENT.md) — every environment variable
- [CONTRIBUTING.md](CONTRIBUTING.md) — conventions and workflow
