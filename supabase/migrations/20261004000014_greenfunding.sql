-- GREEN FUNDING import: campaign registry, translation history and queue,
-- sync logs, category/tag mappings, image storage and the scheduler tick.
--
-- Imported campaigns become ordinary rows in public.products (so the product
-- page, cards, search, analytics and Buy Now all keep working). Everything
-- about the source lives here, keyed by UNIQUE (source, source_campaign_id),
-- which is what prevents duplicate imports however often the sync runs.
--
-- Where the languages live:
--   ja (source, read-only)  -> product_source_metadata.ja_*
--   en (published text)     -> products.name / tagline / description / seo_*
--   zh-HK (published text)  -> products.translations -> 'zh-HK'
--   every generated/edited version -> product_translation_versions
--
-- All tables are readable by staff only. Writes happen server-side with the
-- service role (sync job) or in staff-checked server actions.
--
-- Scheduler configuration (not committed; same secret as the email sender):
--   insert into public.site_settings (key, value)
--     values ('greenfunding.sync_url', '"https://your-domain/api/cron/greenfunding"');

-- ---------------------------------------------------------------------------
-- Campaign registry (one row per GREEN FUNDING campaign ever seen)
-- ---------------------------------------------------------------------------

create table public.product_source_metadata (
  id uuid primary key default gen_random_uuid(),
  -- Null for campaigns that were seen but not imported (not eligible, or the
  -- product was later deleted by an admin — the row stays so it isn't re-imported).
  product_id uuid unique references public.products (id) on delete set null,
  source text not null default 'greenfunding' check (source ~ '^[a-z0-9_]{2,40}$'),
  source_url text not null check (source_url ~* '^https://[a-z0-9.-]+\.[a-z]{2,}(/[^\s]*)?$'),
  source_campaign_id text not null check (length(source_campaign_id) between 1 and 100),
  source_status text not null default 'unknown'
    check (source_status in ('active', 'succeeded', 'ended', 'cancelled', 'upcoming', 'unknown')),
  pipeline_status text not null default 'imported'
    check (pipeline_status in ('imported', 'translating', 'draft', 'pending_review', 'approved', 'published',
                               'rejected', 'archived', 'sync_error', 'not_eligible')),
  import_mode text not null default 'test' check (import_mode in ('test', 'production')),
  -- Original Japanese content (never overwritten by translations).
  ja_title text,
  ja_short_description text,
  ja_description text,
  owner_name text,
  source_categories text[] not null default '{}',
  source_tags text[] not null default '{}',
  -- Campaign figures exactly as shown on the source (null when not shown).
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  price numeric(12, 2) check (price is null or price >= 0),
  goal_amount numeric(14, 2) check (goal_amount is null or goal_amount >= 0),
  raised_amount numeric(14, 2) check (raised_amount is null or raised_amount >= 0),
  backer_count integer check (backer_count is null or backer_count >= 0),
  days_remaining integer check (days_remaining is null or days_remaining >= 0),
  campaign_starts_at timestamptz,
  campaign_ends_at timestamptz,
  -- True when campaign_ends_at was derived from "days remaining" (the source
  -- page shows no exact date).
  campaign_ends_at_estimated boolean not null default false,
  -- Change detection and translation cost control.
  source_content_hash text,
  translated_content_hash text,
  update_available boolean not null default false,
  changed_fields text[] not null default '{}',
  needs_category_review boolean not null default false,
  raw_metadata jsonb not null default '{}' check (jsonb_typeof(raw_metadata) = 'object'),
  last_error text,
  last_synced_at timestamptz,
  source_last_updated_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_campaign_id),
  unique (source, source_url)
);
create index product_source_metadata_pipeline_idx on public.product_source_metadata (pipeline_status, updated_at desc);
create index product_source_metadata_source_status_idx on public.product_source_metadata (source, source_status);
create trigger product_source_metadata_updated_at before update on public.product_source_metadata
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Imported images: remember the original URL so re-syncs never upload twice;
-- alt text per language lives in translations ({"zh-HK": {"alt": …}}).
-- ---------------------------------------------------------------------------

alter table public.product_images
  add column if not exists original_url text,
  add column if not exists translations jsonb not null default '{}'::jsonb;
create unique index if not exists product_images_original_url_key
  on public.product_images (product_id, original_url) where original_url is not null;

-- ---------------------------------------------------------------------------
-- Translation history (every AI generation and every admin edit is a version)
-- ---------------------------------------------------------------------------

create table public.product_translation_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  language text not null check (language in ('en', 'zh-HK')),
  version integer not null check (version > 0),
  title text,
  short_description text,
  description text,
  seo_title text,
  seo_description text,
  image_alts jsonb not null default '[]' check (jsonb_typeof(image_alts) = 'array'),
  source_content_hash text,
  origin text not null check (origin in ('ai', 'admin')),
  translation_provider text,
  translation_model text,
  created_by uuid references auth.users (id) on delete set null,
  translated_at timestamptz not null default now(),
  unique (product_id, language, version)
);
create index product_translation_versions_product_idx on public.product_translation_versions (product_id, language, version desc);

-- ---------------------------------------------------------------------------
-- Translation queue: one job per (product, source content hash), so unchanged
-- content is never sent to the AI twice.
-- ---------------------------------------------------------------------------

create table public.translation_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  source_content_hash text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  last_error text,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, source_content_hash)
);
create index translation_jobs_queue_idx on public.translation_jobs (status, run_after);
create trigger translation_jobs_updated_at before update on public.translation_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sync runs and logs
-- ---------------------------------------------------------------------------

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'greenfunding',
  trigger text not null check (trigger in ('cron', 'manual')),
  mode text not null check (mode in ('test', 'production')),
  status text not null default 'running' check (status in ('running', 'success', 'warning', 'error')),
  discovered integer not null default 0,
  new_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_count integer not null default 0,
  translated_count integer not null default 0,
  requests integer not null default 0,
  message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index sync_runs_started_idx on public.sync_runs (source, started_at desc);

create table public.sync_logs (
  id bigint generated always as identity primary key,
  run_id uuid references public.sync_runs (id) on delete set null,
  source text not null default 'greenfunding',
  operation text not null check (operation in (
    'discover', 'import', 'update', 'status_change', 'image_import', 'translation',
    'publish', 'reject', 'archive', 'edit', 'not_eligible', 'sync')),
  status text not null check (status in ('success', 'warning', 'error')),
  campaign_id text,
  campaign_url text,
  product_id uuid references public.products (id) on delete set null,
  message text,
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index sync_logs_created_idx on public.sync_logs (created_at desc);
create index sync_logs_status_idx on public.sync_logs (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Category and tag mappings (source label -> our taxonomy). A row with a null
-- target means "seen, not mapped yet": imports with it need category review.
-- ---------------------------------------------------------------------------

create table public.category_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'greenfunding',
  source_category text not null check (length(source_category) between 1 and 80),
  category_id uuid references public.categories (id) on delete set null,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_category)
);
create trigger category_mappings_updated_at before update on public.category_mappings
  for each row execute function public.set_updated_at();

create table public.tag_mappings (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'greenfunding',
  source_tag text not null check (length(source_tag) between 1 and 80),
  tag_id uuid references public.tags (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (source, source_tag)
);

-- Initial mappings for GREEN FUNDING's categories. Lower priority wins when a
-- campaign is in several categories. Unlisted categories are added (unmapped)
-- the first time they are seen and can be mapped in the admin.
insert into public.category_mappings (source, source_category, category_id, priority)
select 'greenfunding', m.label, c.id, m.priority
from (values
  ('オーディオ', 'audio', 10),
  ('アウトドア', 'outdoor', 20),
  ('車/バイク', 'automotive', 20),
  ('写真', 'photography', 20),
  ('スポーツ', 'fitness', 30),
  ('ガジェット', null, 90),
  ('テクノロジー/IoT', null, 90),
  ('雑貨', null, 95),
  ('ファッション', null, 95),
  ('フード', null, 95)
) as m(label, slug, priority)
left join public.categories c on c.slug = m.slug
on conflict (source, source_category) do nothing;

-- ---------------------------------------------------------------------------
-- Row level security: staff can read everything; nobody writes through the API
-- (the service role used by the sync job and server actions bypasses RLS).
-- ---------------------------------------------------------------------------

alter table public.product_source_metadata enable row level security;
alter table public.product_translation_versions enable row level security;
alter table public.translation_jobs enable row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_logs enable row level security;
alter table public.category_mappings enable row level security;
alter table public.tag_mappings enable row level security;

create policy "staff read source metadata" on public.product_source_metadata for select to authenticated using ((select public.is_staff()));
create policy "staff read translation versions" on public.product_translation_versions for select to authenticated using ((select public.is_staff()));
create policy "staff read translation jobs" on public.translation_jobs for select to authenticated using ((select public.is_staff()));
create policy "staff read sync runs" on public.sync_runs for select to authenticated using ((select public.is_staff()));
create policy "staff read sync logs" on public.sync_logs for select to authenticated using ((select public.is_staff()));
create policy "staff read category mappings" on public.category_mappings for select to authenticated using ((select public.is_staff()));
create policy "staff read tag mappings" on public.tag_mappings for select to authenticated using ((select public.is_staff()));

revoke all on public.product_source_metadata, public.product_translation_versions, public.translation_jobs,
  public.sync_runs, public.sync_logs, public.category_mappings, public.tag_mappings from anon;
grant select on public.product_source_metadata, public.product_translation_versions, public.translation_jobs,
  public.sync_runs, public.sync_logs, public.category_mappings, public.tag_mappings to authenticated;

-- ---------------------------------------------------------------------------
-- Analytics: GREEN FUNDING redirects are logged next to the usual buy_click.
-- ---------------------------------------------------------------------------

do $$
declare _name text;
begin
  select conname into _name from pg_constraint
  where conrelid = 'public.analytics_events'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%event_type%';
  if _name is not null then
    execute format('alter table public.analytics_events drop constraint %I', _name);
  end if;
end $$;
alter table public.analytics_events add constraint analytics_events_event_type_check check (event_type in (
  'page_view', 'product_view', 'product_save', 'product_unsave', 'collection_add',
  'collection_remove', 'buy_click', 'search', 'brand_follow', 'category_follow',
  'product_share', 'reminder_created', 'submission_created', 'submission_submitted',
  'submission_approved', 'submission_rejected', 'submission_published', 'greenfunding_redirect'
));

-- Buy Now for imported products: the destination is the campaign URL stored
-- in product_source_metadata (the exact URL that was imported). If the
-- product's external_url doesn't match it, nothing is returned.
create or replace function public.record_outbound_click(product_id uuid, anon_id text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _url text;
  _source_url text;
  _campaign text;
  _has_source boolean;
  _uid uuid := (select auth.uid());
  _who text;
begin
  select p.external_url into _url
  from public.products p
  where p.id = record_outbound_click.product_id and p.status = 'published';

  select true, m.source_url, m.source_campaign_id into _has_source, _source_url, _campaign
  from public.product_source_metadata m
  where m.product_id = record_outbound_click.product_id and m.source = 'greenfunding';

  if _has_source then
    if _source_url is null or _url is distinct from _source_url then
      return null;
    end if;
  end if;

  if _url is null or _url !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?([/?#][^\s]*)?$' then
    return null;
  end if;

  if anon_id is not null and anon_id !~ '^[A-Za-z0-9-]{8,64}$' then
    anon_id := null;
  end if;
  _who := coalesce(_uid::text, anon_id, 'anonymous');

  if public.rate_limit_hit('click:' || _who || ':' || product_id, 5, 600) then
    update public.products p set click_count = p.click_count + 1 where p.id = record_outbound_click.product_id;
    insert into public.analytics_events (event_type, user_id, anon_id, product_id)
    values ('buy_click', _uid, case when _uid is null then anon_id end, product_id);
    if _has_source then
      insert into public.analytics_events (event_type, user_id, anon_id, product_id, metadata)
      values ('greenfunding_redirect', _uid, case when _uid is null then anon_id end, product_id,
              jsonb_build_object('campaign_id', _campaign));
    end if;
  end if;

  return _url;
end;
$$;

-- ---------------------------------------------------------------------------
-- Image bucket (public read; uploads only by the server with the service role)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('greenfunding-products', 'greenfunding-products', true, 20971520,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Scheduler: pg_cron ticks every 5 minutes and calls the app. The app decides
-- whether a sync is due (GREEN_FUNDING_SYNC_INTERVAL_MINUTES) and processes a
-- few queued translations on every tick.
-- ---------------------------------------------------------------------------

create or replace function public.greenfunding_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _url text;
  _secret text;
begin
  select value #>> '{}' into _url from public.site_settings where key = 'greenfunding.sync_url';
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'email_sender_secret' limit 1;
  if _url is null or _url !~ '^https://' or _secret is null then
    return;
  end if;
  perform net.http_get(
    url := _url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || _secret),
    timeout_milliseconds := 290000
  );
end;
$$;
revoke all on function public.greenfunding_tick() from public, anon, authenticated;

select cron.schedule('loupe-greenfunding-tick', '*/5 * * * *', $$select public.greenfunding_tick()$$);
