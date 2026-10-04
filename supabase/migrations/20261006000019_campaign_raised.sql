-- Crowdfunding products show the amount raised instead of a price.
-- Public, like the campaign box on the product page: only for published
-- products (or staff); the rest of the registry stays private.

create or replace function public.product_campaign_funding(_product_id uuid)
returns table (raised_amount numeric, currency text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.raised_amount, m.currency from public.product_source_metadata m
  join public.products p on p.id = m.product_id
  where m.product_id = _product_id and (p.status = 'published' or public.is_staff())
  limit 1;
$$;
revoke all on function public.product_campaign_funding(uuid) from public;
grant execute on function public.product_campaign_funding(uuid) to anon, authenticated;

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
  public.product_source_name(p.id) as source_name,
  cf.raised_amount as campaign_raised,
  cf.currency as campaign_currency
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
left join public.product_scores sc on sc.product_id = p.id
left join lateral public.product_campaign_funding(p.id) cf on true;

grant select on public.product_cards to anon, authenticated;
