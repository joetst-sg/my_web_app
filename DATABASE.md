# Database

PostgreSQL 17 on Supabase. All schema changes are SQL migrations in `supabase/migrations/`, applied in filename order.

## Migrations

| File | Contents |
|---|---|
| `…0001_extensions_types.sql` | `pg_trgm`, `unaccent`, `citext`, `pg_cron`; enums (roles, statuses, types) |
| `…0002_tables.sql` | All tables, `updated_at` triggers, indexes |
| `…0003_auth_rls.sql` | Role helpers, new-user bootstrap, column-protection triggers, grants, RLS policies |
| `…0004_workflow.sql` | Submission state machine, scheduled publishing, reminders, price-drop alerts, admin role/suspension functions |
| `…0005_engagement_search.sql` | Counters, analytics tracking, outbound clicks, trending score, `product_cards`/`deal_cards` views, search, feed, related, duplicates, analytics summaries |
| `…0006_storage.sql` | Storage buckets and policies |
| `…0007_cron.sql` | pg_cron jobs |
| `…0008_lock_down_functions.sql` | Revokes API access to trigger/internal functions |
| `…0009_submissions_switch.sql` | Admin switch to pause new submissions |

### Running migrations

**Supabase CLI (recommended):**

```bash
npx supabase login
npx supabase link --project-ref <your-ref>
npx supabase db push
```

**Without the CLI:** paste each file, in order, into the Supabase dashboard SQL editor.

The files were applied to this project through the Management API and recorded in `supabase_migrations.schema_migrations`, so `supabase db push` treats them as applied.

## Tables

`auth.users` is the users table; everything else is in `public`.

| Area | Tables |
|---|---|
| Users | `profiles` (public profile), `user_settings` (private prefs, onboarding, suspension), `roles`, `user_roles`, `seller_profiles` |
| Catalogue | `brands`, `categories` (with `parent_id` subcategories), `tags`, `products`, `product_categories`, `product_tags`, `product_images`, `product_videos`, `product_specifications`, `product_scores`, `deals`, `featured_products` |
| Engagement | `product_views`, `product_saves`, `brand_followers`, `category_followers`, `collections`, `collection_products`, `collection_followers`, `reminders` |
| Workflow | `submissions`, `submission_reviews` (history), `submission_messages` |
| Content | `articles`, `article_categories`, `article_tags`, `article_products`, `homepage_sections`, `site_settings` |
| Operations | `notifications`, `analytics_events`, `reports`, `audit_logs`, `email_outbox`, `rate_limit_hits` |

Key relationships: product → brand, categories, images, videos, specs, tags, deals, score, one submission; submission → reviews, messages; collection → owner, products; seller → brands (`brands.owner_id`) and products (`products.seller_id`).

Counters (`save_count`, `view_count`, `click_count`, `follower_count`, `product_count`, …) are maintained by triggers and SECURITY DEFINER functions; clients cannot write them.

## Views

- `product_cards` — one row per product for listings: effective price (active deal), compare-at price, discount %, brand, primary category, first image, score, flags. `security_invoker`, so RLS applies.
- `deal_cards` — deals with computed `active` / `upcoming` / `expired` status.

## Functions callable from the app

| Function | Who | Purpose |
|---|---|---|
| `transition_submission(submission_id, action, message?, scheduled_for?)` | seller (submit/withdraw), staff (rest) | Workflow |
| `track_event(event_type, …)` | anyone | Views, shares, searches |
| `record_outbound_click(product_id, anon_id)` | anyone | Validates + records Buy Now, returns URL |
| `search_products(q)`, `search_suggest(q)`, `popular_searches()` | anyone | Search |
| `related_products(product_id)` | anyone | Recommendations |
| `personal_feed()` | signed in | Feed |
| `find_duplicate_products(product_id)` | seller (own, published matches only), staff | Duplicate detection |
| `seller_product_stats(days)` | seller | Seller analytics |
| `analytics_summary(days)`, `submission_seller_contact(id)` | staff | Admin |
| `admin_list_users()`, `set_user_role()`, `set_user_suspended()` | admin | User management |

Errors meant for users are raised as `LOUPE:<CODE>` with a human-readable `DETAIL`; `lib/errors.ts` shows the detail and hides anything else.

## Scheduled jobs (pg_cron)

| Job | Schedule | Function |
|---|---|---|
| `loupe-publish-due` | every minute | `publish_due()` — scheduled products and articles |
| `loupe-reminders` | every minute | `process_due_reminders()` — custom-date, launch and sale reminders |
| `loupe-popularity` | every 10 minutes | `refresh_popularity_scores()` |
| `loupe-cleanup` | daily 03:17 UTC | `cleanup_old_data()` |

Inspect with `select * from cron.job;` and `select * from cron.job_run_details order by start_time desc limit 20;`.

## Seeding

```bash
npm run db:seed            # refuses if products already exist
npm run db:seed -- --reset # wipes catalogue content and @loupe.example accounts first (dev only!)
```

Needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and a Supabase access token (`SUPABASE_ACCESS_TOKEN` or `~/.supabase/access-token`). It creates 22 categories, 23 brands, 59 products (53 published + 6 in different workflow states), generated WebP illustrations uploaded through Storage as the demo editor, 7 deals, 13 collections, 12 articles, homepage sections, demo user activity and synthetic analytics events (marked `metadata.seed = true`).

## Types

`npm run db:types` regenerates `lib/supabase/database.types.ts` after schema changes.
