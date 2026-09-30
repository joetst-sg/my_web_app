# Deployment

Production runs on **Vercel** (app) + **Supabase** (database, auth, storage). Pushing to `main` deploys automatically.

## 1. Supabase project

1. Create a project at supabase.com. Pick a region close to your users; set the Vercel region to match (step 3).
2. **Apply migrations** (see [DATABASE.md](DATABASE.md#running-migrations)): `npx supabase link --project-ref <ref> && npx supabase db push`, or paste `supabase/migrations/*.sql` into the SQL editor in order.
3. **Authentication → URL configuration**
   - Site URL: `https://your-domain`
   - Redirect URLs: `https://your-domain/**`, `http://localhost:3000/**`, and your Vercel preview pattern (e.g. `https://*-your-team.vercel.app/**`).
4. **Authentication → Emails**: the default Supabase mailer is heavily rate-limited and, on the free plan, only delivers to your team's addresses. For real users, configure custom SMTP (e.g. Resend). Once SMTP is set, you can paste the branded templates from `supabase/templates/` (confirmation, recovery, email change). The app works with Supabase's default templates too.
5. Optional: **Authentication → Bot protection** (CAPTCHA).
6. Optional demo content: `npm run db:seed` (see DATABASE.md).

## 2. Vercel project

1. Import the GitHub repository in Vercel (framework preset: Next.js — also pinned in `vercel.json`).
2. **Settings → Environment Variables** (Production and Preview):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain` |
| `SUPABASE_SERVICE_ROLE_KEY` | *(optional, for email sending)* secret key |
| `EMAIL_PROVIDER_API_KEY` | *(optional)* Resend API key |
| `EMAIL_FROM` | *(optional)* `Loupe <notifications@your-domain>` |
| `CRON_SECRET` | *(optional, needed for email cron)* random string |

3. Redeploy after changing variables (Deployments → ⋯ → Redeploy).

## 3. Region

`vercel.json` sets `"regions": ["syd1"]` to run functions next to the Supabase project in `ap-southeast-2`. If your Supabase project is elsewhere, change it (e.g. `iad1` for us-east-1, `fra1` for eu-central-1). Pages make several sequential database queries, so co-location has a large effect on speed.

## 4. Scheduled work

- **Database jobs** (publishing, reminders, trending, cleanup) run inside Supabase with pg_cron — nothing to configure on Vercel.
- **Email sending** is near-real-time: when an email is queued, a database trigger (`pg_net`) calls `/api/cron/email-outbox` within seconds, and the `loupe-email-retry` pg_cron job retries anything pending every 5 minutes. Vercel Cron also runs it daily as a backup. This needs two values in the database (never in git):

  ```sql
  -- must equal CRON_SECRET in Vercel
  select vault.create_secret('<secret>', 'email_sender_secret');
  -- or to rotate: select vault.update_secret((select id from vault.secrets where name = 'email_sender_secret'), '<new secret>');
  insert into public.site_settings (key, value) values ('email.sender_url', '"https://your-domain/api/cron/email-outbox"')
    on conflict (key) do update set value = excluded.value;
  ```

  When you change `CRON_SECRET` in Vercel, update the Vault secret to the same value (and redeploy). Check delivery with `select * from net._http_response order by created desc limit 5;` and `select status, last_error from public.email_outbox order by created_at desc limit 10;`.

## 5. First admin

Sign up on the live site, confirm your email, then in the Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@your-domain';
```

## 6. Checklist

- [ ] Migrations applied; `select count(*) from cron.job` returns 4
- [ ] Environment variables set in Vercel; latest deployment redeployed
- [ ] Auth Site URL and redirect URLs set
- [ ] Custom SMTP configured (for real users)
- [ ] Admin account created
- [ ] Demo data removed or clearly marked before public launch (`npm run db:seed -- --reset` only wipes; delete demo accounts `@loupe.example` in Auth)
- [ ] Legal pages reviewed by a lawyer
- [ ] Supabase access tokens used during setup revoked
