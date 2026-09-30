# Contributing

## Setup

```bash
npm install
cp .env.example .env.local   # Supabase URL + publishable key
npm run dev
```

Use a separate Supabase project for development if you plan to run `db:seed -- --reset` or the integration tests — they create and delete data.

## Before opening a pull request

```bash
npm run typecheck
npm test                  # unit tests
npm run test:integration  # needs a seeded Supabase project
npm run build
```

## Conventions

- **Next.js 16**: this version differs from older docs. `middleware.ts` is `proxy.ts`; `params`, `searchParams` and `cookies()` are async; `revalidateTag` takes a cache profile. Read `node_modules/next/dist/docs/` when unsure.
- **Server first**: pages are Server Components. Add `'use client'` only for interactive pieces and keep them small.
- **Mutations** go in `lib/actions/*` as Server Actions: validate with zod, get the user, call Supabase, map errors with `friendlyError`, return `ActionResult`. Signed-out users get `LOGIN_REQUIRED`, which buttons turn into a login prompt.
- **Reads** go in `lib/db/*`. Avoid N+1 queries: fetch related rows with one `in(...)` query, run independent queries with `Promise.all`, stream slow sections with `<Suspense>`.
- **Permissions** belong in the database. Add RLS policies or a SECURITY DEFINER function with explicit checks; never rely on hiding UI. Raise user-facing errors as `raise exception 'LOUPE:CODE' using detail = '…'`.
- **Schema changes**: add a new numbered file in `supabase/migrations/` (never edit applied ones), apply it, run `npm run db:types`, and add a test if it touches permissions.
- **UI**: shadcn/ui primitives in `components/ui`, design tokens in `app/globals.css`. Every control needs a label, visible focus and keyboard support. Use `EmptyState`, skeletons and friendly error text rather than blank screens.
- **Copy**: plain, specific language. Errors say what happened and what to do.
- **Commits**: small and logical, imperative subject line.
