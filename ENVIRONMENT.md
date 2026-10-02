# Environment variables

Copy `.env.example` to `.env.local` for development. `.env.local` is git-ignored — never commit it.

| Variable | Required | Exposed to browser | Used by |
|---|:-:|:-:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Everything (Supabase project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Everything. The **publishable** key; safe in the browser because RLS protects the data. |
| `NEXT_PUBLIC_SITE_URL` | recommended | yes | Canonical URLs, sitemap, RSS, OG images, links in emails. Defaults to `http://localhost:3000`. |
| `SUPABASE_SERVICE_ROLE_KEY` | for email | **no** | Only `/api/cron/email-outbox` (reads the email queue, bypasses RLS). Keep secret. |
| `EMAIL_PROVIDER_API_KEY` | for email | no | Resend API key. |
| `EMAIL_PROVIDER` | no | no | `resend` or `console`. Default: `resend` if a key is set, `console` in development, none in production. |
| `EMAIL_FROM` | no | no | Sender, e.g. `Loupe <notifications@your-domain>` (domain must be verified with the provider). |
| `CRON_SECRET` | for email | no | Required `Authorization: Bearer …` value for the cron route. Vercel sends it automatically for Vercel Cron. |
| `ANALYTICS_KEY` | no | no | Reserved for an external analytics provider. First-party analytics don't need it. |
| `SUPABASE_ACCESS_TOKEN` | scripts only | no | Personal access token for `db:seed` and `db:types` (or `~/.supabase/access-token`). **Never set in Vercel.** |
| `TEST_<ROLE>_EMAIL` / `TEST_<ROLE>_PASSWORD` | tests only | no | Integration test accounts (`ADMIN`, `EDITOR`, `SELLER1`, `SELLER2`, `USER1`, `USER2`). Defaults to `DEMO_ACCOUNTS.local.md`. |

## Rules

- Anything prefixed `NEXT_PUBLIC_` is bundled into browser JavaScript. Never put secrets there.
- The legacy `anon` JWT key also works as `NEXT_PUBLIC_SUPABASE_ANON_KEY`; new projects use `sb_publishable_…` keys.
- Use the new `sb_secret_…` key (or the legacy service role key) for `SUPABASE_SERVICE_ROLE_KEY`.
- After changing Vercel variables, redeploy.
- GREEN FUNDING import and AI translation variables (`GREEN_FUNDING_*`, `TRANSLATION_*`) are listed with defaults in `.env.example` and explained in [GREENFUNDING.md](GREENFUNDING.md). All are server-only.
