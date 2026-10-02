-- Traditional Chinese (and future languages) copy for products, stored as
-- {"zh-HK": {"name": …, "tagline": …, "description": …, "seo_title": …, "seo_description": …}}.
-- The English columns stay the source of truth; empty fields fall back to them.

alter table public.products add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.products add constraint products_translations_object check (jsonb_typeof(translations) = 'object');

-- Card views expose it (appended, so existing columns keep their positions).
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
  p.translations as product_translations
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
  pc.category_id, pc.category_name, pc.category_slug, pc.image_path, pc.image_alt, pc.score, pc.category_translations, pc.product_translations
from public.deals d
join public.product_cards pc on pc.id = d.product_id
join public.products p on p.id = d.product_id
where pc.status = 'published';

grant select on public.deal_cards to anon, authenticated;
