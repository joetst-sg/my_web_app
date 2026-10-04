-- Multiple crowdfunding sources (GREEN FUNDING, Indiegogo, more later).
-- product_source_metadata is the shared registry: UNIQUE (source,
-- source_campaign_id) already prevents duplicates per source.

alter table public.product_source_metadata
  add column if not exists source_name text,
  add column if not exists source_language text not null default 'ja' check (source_language ~ '^[a-z]{2}(-[A-Za-z]{2,4})?$'),
  -- Word count of the AI-written English summary (for monitoring the 200–300 rule).
  add column if not exists summary_word_count integer check (summary_word_count is null or summary_word_count >= 0);

update public.product_source_metadata set source_name = 'GREEN FUNDING' where source = 'greenfunding' and source_name is null;

-- More pipeline states: failed (validation/AI/images), duplicate (held by
-- the fuzzy duplicate check — never published automatically).
alter table public.product_source_metadata drop constraint if exists product_source_metadata_pipeline_status_check;
alter table public.product_source_metadata add constraint product_source_metadata_pipeline_status_check
  check (pipeline_status in ('imported', 'translating', 'draft', 'pending_review', 'approved', 'published',
                             'rejected', 'archived', 'sync_error', 'not_eligible', 'failed', 'duplicate'));

-- Source URLs must be HTTPS (any allowed domain is checked in the app).
alter table public.product_source_metadata drop constraint if exists product_source_metadata_source_url_check;
alter table public.product_source_metadata add constraint product_source_metadata_source_url_check
  check (source_url ~* '^https://[a-z0-9.-]+\.[a-z]{2,}(/[^\s?#]*)?$');

-- ---------------------------------------------------------------------------
-- Cards show where a campaign comes from ("GREEN FUNDING", "Indiegogo").
-- The registry stays staff-only; this returns just the display name, and
-- only for published products.
-- ---------------------------------------------------------------------------
create or replace function public.product_source_name(_product_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.source_name from public.product_source_metadata m
  join public.products p on p.id = m.product_id
  where m.product_id = _product_id and (p.status = 'published' or public.is_staff())
  limit 1;
$$;
revoke all on function public.product_source_name(uuid) from public;
grant execute on function public.product_source_name(uuid) to anon, authenticated;

create or replace view public.product_cards
with (security_invoker = true)
as
select
  p.id, p.slug, p.name, p.tagline, p.currency, p.status, p.availability,
  p.published_at, p.created_at, p.updated_at, p.seller_id,
  p.popularity_score, p.trending_rank, p.save_count, p.view_count, p.click_count, p.share_count,
  p.price as list_price,
  coalesce(d.deal_price, p.price) as price,
  case
    when d.id is not null then coalesce(d.original_price, p.original_price, p.price)
    else p.original_price
  end as compare_at_price,
  case
    when coalesce(case when d.id is not null then coalesce(d.original_price, p.original_price, p.price) else p.original_price end, 0) > coalesce(d.deal_price, p.price, 0)
      and coalesce(d.deal_price, p.price) is not null
    then round((1 - coalesce(d.deal_price, p.price)
      / (case when d.id is not null then coalesce(d.original_price, p.original_price, p.price) else p.original_price end)) * 100)::integer
    else 0
  end as discount_percent,
  b.id as brand_id, b.slug as brand_slug, b.name as brand_name,
  c.id as category_id, c.slug as category_slug, c.name as category_name,
  coalesce((select array_agg(pc.category_id) from public.product_categories pc where pc.product_id = p.id), '{}') as category_ids,
  img.storage_path as image_path, img.alt as image_alt,
  sc.overall as score,
  d.id as deal_id, d.ends_at as deal_ends_at,
  exists (
    select 1 from public.featured_products f
    where f.product_id = p.id and f.placement in ('hero', 'featured_today', 'featured_this_week', 'editors_pick')
      and f.starts_at <= now() and (f.ends_at is null or f.ends_at > now())
  ) as is_featured,
  coalesce(p.published_at > now() - interval '14 days', false) as is_new,
  (p.trending_rank is not null) as is_trending,
  c.translations as category_translations,
  p.translations as product_translations,
  -- Public, non-sensitive: only the source's display name.
  public.product_source_name(p.id) as source_name
from public.products p
left join public.brands b on b.id = p.brand_id
left join lateral (
  select c.id, c.slug, c.name, c.translations
  from public.product_categories pc
  join public.categories c on c.id = pc.category_id
  where pc.product_id = p.id
  order by pc.is_primary desc, c.sort_order
  limit 1
) c on true
left join lateral (
  select pi.storage_path, pi.alt from public.product_images pi
  where pi.product_id = p.id order by pi.position, pi.created_at limit 1
) img on true
left join lateral (
  select d.id, d.deal_price, d.original_price, d.ends_at from public.deals d
  where d.product_id = p.id and d.starts_at <= now() and (d.ends_at is null or d.ends_at > now())
  order by d.deal_price limit 1
) d on true
left join public.product_scores sc on sc.product_id = p.id;

grant select on public.product_cards to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Buy Now for any imported campaign: exact stored URL, logged per source.
-- ---------------------------------------------------------------------------
do $$
declare _name text;
begin
  select conname into _name from pg_constraint
  where conrelid = 'public.analytics_events'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%event_type%';
  if _name is not null then execute format('alter table public.analytics_events drop constraint %I', _name); end if;
end $$;
alter table public.analytics_events add constraint analytics_events_event_type_check check (event_type in (
  'page_view', 'product_view', 'product_save', 'product_unsave', 'collection_add',
  'collection_remove', 'buy_click', 'search', 'brand_follow', 'category_follow',
  'product_share', 'reminder_created', 'submission_created', 'submission_submitted',
  'submission_approved', 'submission_rejected', 'submission_published',
  'greenfunding_redirect', 'indiegogo_redirect', 'crowdfunding_redirect'
));

create or replace function public.record_outbound_click(product_id uuid, anon_id text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _url text;
  _source_url text;
  _source text;
  _campaign text;
  _has_source boolean;
  _uid uuid := (select auth.uid());
  _who text;
begin
  select p.external_url into _url
  from public.products p
  where p.id = record_outbound_click.product_id and p.status = 'published';

  select true, m.source_url, m.source, m.source_campaign_id into _has_source, _source_url, _source, _campaign
  from public.product_source_metadata m
  where m.product_id = record_outbound_click.product_id;

  -- Imported campaigns: only the exact stored campaign URL.
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
      values (case _source when 'greenfunding' then 'greenfunding_redirect' when 'indiegogo' then 'indiegogo_redirect' else 'crowdfunding_redirect' end,
              _uid, case when _uid is null then anon_id end, product_id,
              jsonb_build_object('source', _source, 'campaign_id', _campaign));
    end if;
  end if;

  return _url;
end;
$$;

-- Campaign facts for product pages now include the source.
drop function if exists public.campaign_info(uuid);
create function public.campaign_info(p_product_id uuid)
returns table (
  source text, source_name text, source_url text, source_status text, currency text,
  goal_amount numeric, raised_amount numeric, backer_count integer, days_remaining integer,
  campaign_ends_at timestamptz, campaign_ends_at_estimated boolean, last_synced_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.source, m.source_name, m.source_url, m.source_status, m.currency, m.goal_amount, m.raised_amount, m.backer_count,
         m.days_remaining, m.campaign_ends_at, m.campaign_ends_at_estimated, m.last_synced_at
  from public.product_source_metadata m
  join public.products p on p.id = m.product_id
  where m.product_id = p_product_id
    and (p.status = 'published' or public.is_staff());
$$;
revoke all on function public.campaign_info(uuid) from public;
grant execute on function public.campaign_info(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Conservative cross-source duplicate check (server only): published
-- products with the same normalised URL, or a very similar name.
-- ---------------------------------------------------------------------------
create or replace function public.crowdfunding_duplicate_candidates(_product_id uuid)
returns table (product_id uuid, name text, slug text, similarity real, reason text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with me as (select p.id, p.name, p.external_url, p.brand_id from public.products p where p.id = _product_id)
  select o.id, o.name, o.slug, similarity(o.name, me.name),
    case
      when me.external_url is not null and public.normalize_url(o.external_url) = public.normalize_url(me.external_url) then 'Same campaign URL'
      when o.brand_id = me.brand_id and similarity(o.name, me.name) >= 0.45 then 'Same brand, similar name'
      else 'Very similar name'
    end
  from public.products o, me
  where o.id <> me.id
    and o.status = 'published'
    and (
      (me.external_url is not null and public.normalize_url(o.external_url) = public.normalize_url(me.external_url))
      or similarity(o.name, me.name) >= 0.6
      or (o.brand_id = me.brand_id and similarity(o.name, me.name) >= 0.45)
    )
  order by similarity(o.name, me.name) desc
  limit 5;
$$;
revoke all on function public.crowdfunding_duplicate_candidates(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- import_logs: one row per source per run (a view over sync_runs).
-- ---------------------------------------------------------------------------
create or replace view public.import_logs
with (security_invoker = true)
as
select r.id, r.source, r.trigger, r.mode, r.started_at, r.finished_at as completed_at, r.status,
  r.discovered as items_found, r.new_count as items_new, r.updated_count as items_updated,
  r.skipped_count as items_skipped, r.error_count as items_failed,
  case when r.finished_at is not null then extract(epoch from r.finished_at - r.started_at)::integer end as execution_seconds,
  r.message as error_message,
  jsonb_build_object('requests', r.requests, 'translated', r.translated_count) as metadata
from public.sync_runs r;
grant select on public.import_logs to authenticated;
