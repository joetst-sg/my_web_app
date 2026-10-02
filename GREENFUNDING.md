# GREEN FUNDING import

Imports authorized GREEN FUNDING campaigns as hidden product drafts, translates
them from Japanese into English and Traditional Chinese, and publishes them
only after an administrator approves. Buy Now always opens the exact campaign
URL that was imported.

## How it works

```
pg_cron (every 5 min) ──► GET /api/cron/greenfunding (Bearer CRON_SECRET)
                             │
                             ├─ sync, if GREEN_FUNDING_SYNC_INTERVAL_MINUTES has passed
                             │    1. read the newest-campaigns listing (GREEN_FUNDING_DISCOVERY_PAGES)
                             │    2. new campaign → import: product draft + images + videos
                             │       (UNIQUE(source, source_campaign_id) prevents duplicates)
                             │    3. re-check a few imported campaigns for changes
                             │    4. write sync_runs / sync_logs
                             │
                             └─ translation queue (TRANSLATION_JOBS_PER_RUN jobs per tick)
                                  Japanese → English → Traditional Chinese (+ SEO, alt text)
                                  → product status pending_review
Admin ──► /admin/greenfunding ──► Review ──► Approve & Publish ──► public in /… and /zh/…
Visitor ──► Buy now ──► /go/product/<id> ──► 302 to the stored GREEN FUNDING URL
```

| Piece | Where |
| --- | --- |
| Settings | `lib/greenfunding/config.ts` (environment variables) |
| Data source (swappable) | `lib/greenfunding/sources/` — `html` today; add an `api` source for an official API/feed |
| Page parser | `lib/greenfunding/parse.ts` (Open Graph, schema.org JSON-LD, campaign dashboard) |
| Sync service | `lib/greenfunding/sync.ts` |
| Images | `lib/greenfunding/images.ts` → bucket `greenfunding-products/campaign-<id>/` |
| Translation | `lib/translation/` — provider interface, Anthropic provider, queue |
| Admin | `/admin/greenfunding`, `/admin/greenfunding/<product id>`, `/admin/greenfunding/logs` |
| Database | migrations `20261004000014_greenfunding.sql`, `20261004000015_campaign_info.sql` |

### Where each language lives

| Language | Stored in | Notes |
| --- | --- | --- |
| Japanese (source) | `product_source_metadata.ja_*` | Never overwritten by translations; read-only in the review screen |
| English | `products.name/tagline/description/seo_*` | What `/products/<slug>` shows |
| Traditional Chinese | `products.translations->'zh-HK'` | What `/zh/products/<slug>` shows |
| Every version | `product_translation_versions` | AI or admin, with provider, model, version, timestamp |

This reuses the site's existing language system (English unprefixed, Chinese
under `/zh`). `/en/…` and `/zh-tw/…` addresses redirect there permanently.

### Status workflow

The import record (`product_source_metadata.pipeline_status`) goes
`imported → translating → pending_review → published`, or `rejected`,
`archived`, `sync_error`, `not_eligible`. The product itself stays
`draft`/`pending_review` (invisible to the public through row-level security)
until an admin clicks **Approve & Publish**.

### Safety rules built in

- Test mode (`GREEN_FUNDING_IMPORT_MODE=test`, the default) can never publish.
- Publishing requires: valid HTTPS URL on an allowed domain, Buy Now URL equal
  to the imported campaign URL, English and Chinese titles, a category, and a
  campaign that hasn't ended.
- The database refuses a Buy Now redirect for an imported product if its URL
  differs from the stored campaign URL.
- Source changes never overwrite published or admin-edited text: they create a
  new AI version and show **Update available**.
- Unchanged Japanese text is never sent to the AI again (content hash).
- One request at a time, configurable delay, timeout and per-run budget; a
  403/429/503 from GREEN FUNDING stops the run. No logins, cookies or retries
  against blocks.
- All keys are server-side only; admin actions check the administrator role on
  the server.

## Setup

1. **Migrations** — already applied to the live project. For another project,
   run `supabase/migrations/20261004000014_greenfunding.sql` and
   `20261004000015_campaign_info.sql` in order.
2. **Vercel environment variables** (Production): see `.env.example`. At minimum:
   - `TRANSLATION_API_KEY` — an Anthropic API key (console.anthropic.com).
   - `GREEN_FUNDING_IMPORT_MODE=test` until the review flow is confirmed.
   - `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` already exist.
3. **Point the scheduler at the site** (SQL editor, once):
   ```sql
   insert into public.site_settings (key, value)
   values ('greenfunding.sync_url', '"https://www.joetangtst.com/api/cron/greenfunding"')
   on conflict (key) do update set value = excluded.value;
   ```
   It uses the same Vault secret as the email sender (`email_sender_secret`
   = `CRON_SECRET`). To stop automatic syncing, delete that row.

## First test import

1. Keep `GREEN_FUNDING_IMPORT_MODE=test`, deploy.
2. Open **/admin/greenfunding** → **Sync now**. New campaigns appear as
   *Translating*. Click **Translate now** (or wait up to 5 minutes).
3. Open **Review / Edit**: compare Japanese, English and Traditional Chinese,
   check images, choose a category if *Uncategorized*, check the campaign URL.
4. Check **Sync log** for warnings or errors.
5. When satisfied, set `GREEN_FUNDING_IMPORT_MODE=production`, redeploy, and
   use **Approve & Publish**. Check the product at `/products/<slug>` and
   `/zh/products/<slug>`, then click Buy now — it must open the campaign.

## Switching to an official API later

Implement `CampaignSource` (`lib/greenfunding/types.ts`) in
`lib/greenfunding/sources/api.ts`, register it in `sources/index.ts`, and set
`GREEN_FUNDING_SOURCE=api` (plus `GREEN_FUNDING_API_KEY`). Nothing else changes.
