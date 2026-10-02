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
| Translation | `lib/translation/` — provider interface; Google, Azure (shared `machine.ts`) and Anthropic providers; queue |
| Admin | `/admin/greenfunding`, `/admin/greenfunding/<product id>`, `/admin/greenfunding/logs` |
| Database | migrations `20261004000014_greenfunding.sql`, `20261004000015_campaign_info.sql` |

### What gets translated

Not the full campaign page. Each import gets an automatic **Japanese summary**
(`lib/greenfunding/summary.ts`, about `GREEN_FUNDING_SUMMARY_CHARS` = 400
characters): the introduction plus a "主な特徴" (key features) list built from
section headings and spec lines. Support plans/rewards, prices, crowdfunding
figures, shipping/payment details, FAQs, schedules and video/SNS filler are
left out. Only the title, the cleaned short description and this summary are
sent for translation (~1,200–1,400 characters per campaign for both languages,
instead of ~14,000 for the whole page). The full Japanese text is kept for
reference. In the review screen you can edit the summary and click
**Save & translate**; an edited summary is never overwritten by a re-sync.

### Where each language lives

| Language | Stored in | Notes |
| --- | --- | --- |
| Japanese (source) | `product_source_metadata.ja_*` | Never overwritten by translations; read-only in the review screen |
| Japanese summary | `product_source_metadata.ja_summary` | What is translated; editable in the review screen |
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
   - Google (free 500k characters/month): `TRANSLATION_PROVIDER=google`,
     `TRANSLATION_API_KEY` = an API key restricted to the Cloud Translation API.
   - Or Azure (free tier): `TRANSLATION_PROVIDER=azure`, `TRANSLATION_API_KEY` = the
     Translator resource's KEY 1, `AZURE_TRANSLATOR_REGION` = its Location/Region.
   - Or Anthropic: `TRANSLATION_PROVIDER=anthropic`, `TRANSLATION_API_KEY` = an `sk-ant-…` key.
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

## Translation providers

| | Google Cloud Translation (`google`) | Azure AI Translator (`azure`) | Anthropic Claude (`anthropic`) |
| --- | --- | --- | --- |
| Cost | First 500k characters/month free (≈35–120 campaigns), then billed per character — set a quota cap | Free F0 tier ≈ 2M characters/month; stops at the limit, no charge | ≈ US$0.05–0.15 per campaign |
| Style | Faithful machine translation | Faithful machine translation | Rewritten for shoppers; drops Japan-only logistics |
| SEO title/description, alt text | Derived from the translated title and short description | Same | Written by the model |
| Structure | Sent as HTML; headings, bold and bullets preserved | Same | Preserved by instruction |
| Brand / model names | Marked `translate="no"` / `notranslate` | Marked `notranslate` | Kept by instruction |

Characters are counted once per target language (English + Chinese ≈ 2× the
Japanese text). Quota/rate-limit errors are retried; when a free allowance is
used up, re-queue with **Re-translate** after the monthly reset. Switching provider
only changes new translations; existing versions record which provider made them.

## Switching to an official API later

Implement `CampaignSource` (`lib/greenfunding/types.ts`) in
`lib/greenfunding/sources/api.ts`, register it in `sources/index.ts`, and set
`GREEN_FUNDING_SOURCE=api` (plus `GREEN_FUNDING_API_KEY`). Nothing else changes.
