# Architecture

## Overview

```
Browser ──► Vercel (Next.js 16, region syd1) ──► Supabase (Postgres + Auth + Storage, ap-southeast-2)
   │                                               ▲
   └──── direct uploads to Supabase Storage ───────┘   (checked by storage RLS policies)
```

- **Server Components** render almost everything and query Supabase as the signed-in user, so **Row Level Security decides what each request can see**.
- **Client Components** are used only for interaction: save/follow/remind buttons, filters, search autocomplete, the submission wizard, the media manager and admin forms.
- **Server Actions** (`lib/actions/*`) handle every mutation. Each validates input with zod, re-checks the user, and calls the database, where RLS and SECURITY DEFINER functions enforce the rules again.
- The Vercel functions run in `syd1` (see `vercel.json`) to sit next to the database; a page makes several sequential queries, so co-location matters.

## Folder structure

```
app/
  (site)/            public site, account, seller area (shared header/footer)
    page.tsx         homepage (sections from homepage_sections)
    products/ categories/ brands/ collections/ magazine/ deals/ trending/ new/ discover/ search/
    account/         signed-in user area (feed, saved, collections, reminders, …)
    seller/          seller landing + (app)/ dashboard, wizard, submissions, analytics
    onboarding/ submit/ about/ contact/ privacy/ terms/ cookies/ forbidden/
  (auth)/            login, signup, forgot/reset password, verify email
  admin/             editorial & admin area (staff only)
  auth/confirm/      handles Supabase email links
  go/product/[id]/   outbound click tracking + redirect
  api/search/suggest autocomplete endpoint (public, cached)
  api/cron/email-outbox  sends queued emails (secret-protected)
  sitemap.ts robots.ts feed.xml/ opengraph-image.tsx
components/
  ui/                shadcn/ui primitives
  site/ product/ common/ seller/ admin/ home/ brand/
lib/
  supabase/          server/browser/proxy clients, generated types
  actions/           server actions (engagement, account, seller, admin, auth)
  db/                read queries (products, content, seller, submissions)
  email/             templates + provider abstraction
  auth.ts            viewer, role guards
  filters.ts validation.ts format.ts images.ts upload.ts errors.ts site.ts
proxy.ts             session refresh + protected-route redirects (Next 16 "proxy")
supabase/migrations/ numbered SQL migrations
supabase/templates/  branded auth email templates
scripts/seed/        demo data + generated product illustrations
tests/unit/ tests/integration/
```

## Authentication

- Supabase Auth with email + password; sessions live in secure, httpOnly cookies managed by `@supabase/ssr`.
- `proxy.ts` refreshes the session on every request and redirects signed-out visitors away from `/account`, `/seller`, `/admin` and `/onboarding`.
- Server Components get the user from `getAuthUser()` (`supabase.auth.getClaims()`), which verifies the JWT signature locally with the project's ES256 keys. Server Actions use `getUser()`, which asks the Auth server.
- Email links go to `/auth/confirm`, which supports both `token_hash` links (our templates) and PKCE `code` links (Supabase defaults).
- After sign-up, `/onboarding` collects a username and interests (stored as category follows).

## Roles and permissions

`user_roles` holds any of `user`, `seller`, `editor`, `admin`. Everyone gets `user`; creating a seller profile grants `seller`; admins grant `editor`/`admin`. See [SECURITY.md](SECURITY.md) for the matrix.

Checks happen at three layers: route guards in layouts (`requireStaff`, `requireAdmin`), server actions (`staff()`), and — the one that matters — the database (RLS policies and function checks). The UI hiding a button is never the only protection.

## Product submission workflow

One `submissions` row per product carries the workflow; `products.status` mirrors it for public visibility.

```
draft ─submit─► submitted ─start_review─► under_review
  ▲               │                          │
  └──withdraw─────┤ request_changes ◄────────┤──► changes_requested ─submit─► submitted
                  │ reject ◄─────────────────┤──► rejected
                  └ approve ◄────────────────┘──► approved ─schedule─► scheduled ─(pg_cron)─► published
                                                     └────publish now──────────────────────► published ─archive─► archived
```

- The only way to change status is `transition_submission()` (SECURITY DEFINER). It checks the actor's role, the allowed transition, that the product is complete (images, category, price, URL…), rate limits sellers (10/day), requires a message for rejections and change requests, records `submission_reviews`, writes the audit log, notifies the seller and queues an email.
- `publish_due()` runs every minute (pg_cron) and publishes scheduled products and articles.
- Sellers edit only while `draft` or `changes_requested`; editors can edit anytime.

## Images

- Buckets: `avatars`, `product-images`, `brand-images`, `collection-images`, `article-images` (public) and `uploads` (private). Paths: `products/{product_id}/{uuid}.webp`, `avatars/{user_id}/{uuid}.webp`, `brands/{brand_id}/{uuid}.webp`.
- The browser validates each file (declared type, magic bytes, size, minimum dimensions), decodes it, resizes it and re-encodes it as WebP — which also strips EXIF/GPS metadata — then uploads directly to Storage with progress.
- Buckets enforce MIME types and size limits; storage RLS only allows writing to paths the user may edit (e.g. `can_edit_product(product_id)`).
- `next/image` serves responsive AVIF/WebP variants.
- Draft images live in a public bucket under unguessable UUID paths; their `product_images` rows are hidden by RLS until publication, so they aren't discoverable. (A stricter setup would copy files from a private bucket on publish — a documented trade-off to keep image delivery cacheable.)

## Discovery, search and ranking

- `product_cards` is a security-invoker view that joins brand, primary category, first image, active deal, score and flags. Listings query it with filters that live in the URL (`lib/filters.ts`).
- `search_products()` combines full-text search (`tsvector`), trigram name similarity, and brand/tag/category name matches. `search_suggest()` powers autocomplete (debounced, cached, cancellable requests).
- `refresh_popularity_scores()` (every 10 min) weights views ×1, saves ×5, collection adds ×4, shares ×4, buy clicks ×3, reminders ×3 with a 3-day half-life, plus a freshness boost and a small all-time base; the top 20 get `trending_rank`.
- `personal_feed()` scores products by followed brands/categories, saved/collected/viewed products' brands and categories, popularity and freshness.
- `related_products()` uses shared categories, tags, brand and price range.

## Analytics

`analytics_events` stores first-party events without IPs or user agents. Clients can only send `page_view`, `product_view`, `product_share` and `search` through `track_event()` (validated, rate-limited, views de-duplicated per 30 minutes); saves, follows, collection changes, reminders, clicks and workflow events are written by database triggers so they can't be faked.

## Notifications and email

- In-app notifications are written by database functions (workflow changes, reminders, price drops, new followers, collection activity).
- Emails are inserted into `email_outbox` in the same transaction and sent by `/api/cron/email-outbox` through `lib/email/provider.ts` (Resend or console). Auth emails (confirm, reset, email change) are sent by Supabase Auth.

## Decisions and trade-offs

- **Brand name**: "Loupe", set in `lib/site.ts`.
- **Status vs availability**: coming-soon/sold-out/pre-order/crowdfunding are `availability`, separate from workflow `status`, so a published product can be sold out.
- **No checkout**: the platform links out; `/go/product/[id]` only redirects to `https://` URLs of published products.
- **Homepage**: fully database-driven (`homepage_sections`), editable in `/admin/content`.
- **Emails on Vercel Hobby**: Vercel Cron runs daily on Hobby; for near-real-time email use a paid plan or call the route more often from any scheduler.
