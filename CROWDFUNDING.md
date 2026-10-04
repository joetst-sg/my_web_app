# Crowdfunding imports (GREEN FUNDING + Indiegogo)

Campaigns from each enabled source are imported, written up, translated and
published with no manual approval step. Admins can still edit, disable, re-run
or delete any import from `/admin/greenfunding`. GREEN FUNDING details:
[GREENFUNDING.md](GREENFUNDING.md).

```
pg_cron (every 5 min) ─► /api/cron/greenfunding (Bearer CRON_SECRET)
  for each enabled source whose interval has passed:
    list new campaigns ─► validate + normalise URL ─► UNIQUE(source, id) skip
    ─► create hidden product (source, source_url, source_name, raw data)
  content queue:
    AI (Gemini): English summary (60–150 or 200–300 words, retried with feedback)
                 + concise title, SEO, 3–8 tags, category from the site list,
                 tech-product check (Indiegogo) ─► Traditional Chinese translation
                 (rejected and retried if Simplified characters appear)
    ─► images (allowed CDN only, type/size checked, ≥1 required)
    ─► duplicate check (same URL / similar name) ─► held as "duplicate"
    ─► publish (HTTPS source URL on allowed domain, EN+ZH titles, image, not ended)
Visitor ─► Buy now ─► /go/product/<id> ─► 302 to the stored campaign URL
```

| Source | How | Text | Notes |
| --- | --- | --- | --- |
| GREEN FUNDING | public pages (`sources/html.ts`) | Japanese | on unless `GREEN_FUNDING_ENABLED=false` |
| Indiegogo | official public API (`sources/indiegogo.ts`): `/api/public/projects/getActiveCrowdfundingProjects`, `/getCrowdfundingProject?urlName=` | English (short) | off until `INDIEGOGO_ENABLED=true`; needs the AI; tech/innovation only |

Indiegogo's public API gives only a title, a short description (usually under
100 words), one image and the funding numbers. So Indiegogo summaries are
60–150 words. Nothing is invented to pad them out. 200–300 words are used when
the source has enough detail (Japanese ≥600 characters, or English ≥120 words).

## Code

| Piece | Where |
| --- | --- |
| Sources | `lib/greenfunding/sources/registry.ts` (settings), `html.ts`, `indiegogo.ts` |
| URLs | `lib/greenfunding/url.ts` (`normalizeCampaignUrl`, `validateSourceUrl`) |
| Sync | `lib/greenfunding/sync.ts` (`runSync`, `runSourceSync`, `resyncOne`) |
| AI | `lib/ai/` (`AIProvider` interface, `gemini.ts`, `prompts.ts`, `pipeline.ts`) |
| Publishing | `lib/greenfunding/publish.ts` |
| Database | migration `20261006000018_multi_source.sql` (statuses, source names, duplicates, `import_logs`) |
| Tests | `tests/unit/multi-source.test.ts`, `tests/unit/greenfunding.test.ts` |

To add a source: implement `CampaignSource` (list + fetch, returning
`SourceCampaign`), add a URL pattern to `CAMPAIGN_PATHS` and an entry in
`sourceDefinitions()`.

To add an AI provider: implement `AIProvider` and add it to
`createAIProvider()`.

## Setup (Vercel → Settings → Environment Variables, then redeploy)

1. `AI_PROVIDER=gemini`, `AI_API_KEY=<key from aistudio.google.com/apikey>`
   (mark it Sensitive), optional `AI_MODEL`.
2. Redeploy, open `/admin/greenfunding` and click **Check AI**. Turn on
   Indiegogo only after it says the key works.
3. `INDIEGOGO_ENABLED=true`, then redeploy.

Statuses: imported → translating → published. Other statuses:
- `not_eligible`: not a tech product, or excluded.
- `duplicate`: held, use **Republish** if it's really a different campaign.
- `failed`: AI, image or validation error after the retries. The reason is in the logs.
- `archived`: deleted or disabled. Never re-imported.

After 5 or more errors in a run, admins get a notification (at most once every
6 hours).
