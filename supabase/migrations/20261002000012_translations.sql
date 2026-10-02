-- Translations for editorial content that lives in the database.
-- Shape: {"zh-HK": {"name": "...", "description": "...", "seo_title": "...", "seo_description": "..."}}
-- (homepage_sections use "title" and "subtitle"). English stays in the
-- existing columns; any missing translation falls back to English.
-- Product, brand and article content is written by sellers/editors and is
-- shown in the language it was written in.

alter table public.categories add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.homepage_sections add column if not exists translations jsonb not null default '{}'::jsonb;

-- Expose category translations to listings (columns appended at the end).
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
  c.translations as category_translations
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

create or replace view public.deal_cards
with (security_invoker = true)
as
select d.id as deal_id, d.title, d.deal_price, coalesce(d.original_price, p.price, p.original_price) as original_price,
  d.coupon_code, d.starts_at, d.ends_at,
  case
    when d.starts_at > now() then 'upcoming'
    when d.ends_at is not null and d.ends_at <= now() then 'expired'
    else 'active'
  end as deal_status,
  case when coalesce(d.original_price, p.price, p.original_price) > d.deal_price
    then round((1 - d.deal_price / coalesce(d.original_price, p.price, p.original_price)) * 100)::integer else 0 end as discount_percent,
  pc.id as product_id, pc.slug, pc.name, pc.tagline, pc.currency, pc.brand_name, pc.brand_slug,
  pc.category_id, pc.category_name, pc.category_slug, pc.image_path, pc.image_alt, pc.score, pc.category_translations
from public.deals d
join public.product_cards pc on pc.id = d.product_id
join public.products p on p.id = d.product_id
where pc.status = 'published';

grant select on public.deal_cards to anon, authenticated;

-- Search also matches translated category names (e.g. 耳機).
create or replace function public.search_products(q text, result_limit integer default 60)
returns table (product_id uuid, rank real)
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  _q text := left(trim(coalesce(q, '')), 100);
  _like text;
  _ts tsquery;
begin
  if char_length(_q) < 2 then
    return;
  end if;
  _like := '%' || public.escape_like(_q) || '%';
  _ts := websearch_to_tsquery('english', _q);

  return query
  select p.id,
    (
      ts_rank(p.search_vector, _ts) * 4
      + similarity(p.name, _q) * 2
      + coalesce(similarity(b.name, _q), 0)
      + case when p.name ilike _like then 1 else 0 end
      + case when lower(p.sku) = lower(_q) then 3 else 0 end
      + p.popularity_score / 1000
    )::real as rank
  from public.products p
  left join public.brands b on b.id = p.brand_id
  where p.status = 'published' and (
    p.search_vector @@ _ts
    or p.name % _q
    or p.name ilike _like
    or b.name ilike _like
    or lower(p.sku) = lower(_q)
    or exists (
      select 1 from public.product_tags pt join public.tags t on t.id = pt.tag_id
      where pt.product_id = p.id and t.name ilike _like
    )
    or exists (
      select 1 from public.product_categories pc join public.categories c on c.id = pc.category_id
      where pc.product_id = p.id and (c.name ilike _like or c.translations::text ilike _like)
    )
  )
  order by rank desc
  limit least(result_limit, 200);
end;
$$;


create or replace function public.search_suggest(q text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions
as $$
declare
  _q text := left(trim(coalesce(q, '')), 60);
  _like text;
begin
  if char_length(_q) < 2 then
    return jsonb_build_object('products', '[]'::jsonb, 'brands', '[]'::jsonb, 'categories', '[]'::jsonb);
  end if;
  _like := '%' || public.escape_like(_q) || '%';
  return jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(x) from (
        select pc.slug, pc.name, pc.brand_name, pc.image_path
        from public.search_products(_q, 6) s
        join public.product_cards pc on pc.id = s.product_id
        order by s.rank desc
        limit 6
      ) x
    ), '[]'::jsonb),
    'brands', coalesce((
      select jsonb_agg(x) from (
        select b.slug, b.name, b.logo_url from public.brands b
        where b.is_published and (b.name ilike _like or b.name % _q)
        order by similarity(b.name, _q) desc, b.follower_count desc
        limit 4
      ) x
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(x) from (
        select c.slug, c.name, c.translations from public.categories c
        where c.name ilike _like or c.name % _q or c.translations::text ilike _like
        order by similarity(c.name, _q) desc
        limit 4
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

