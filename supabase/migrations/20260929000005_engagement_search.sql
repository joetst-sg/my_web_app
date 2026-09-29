-- Engagement counters, analytics tracking, outbound clicks, trending score,
-- search, personalised feed, related products and duplicate detection.

-- ---------------------------------------------------------------------------
-- Counters maintained by triggers (clients cannot write counters)
-- ---------------------------------------------------------------------------

create or replace function public.handle_product_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.products set save_count = save_count + 1 where id = new.product_id;
    insert into public.analytics_events (event_type, user_id, product_id) values ('product_save', new.user_id, new.product_id);
    return new;
  end if;
  update public.products set save_count = greatest(save_count - 1, 0) where id = old.product_id;
  insert into public.analytics_events (event_type, user_id, product_id) values ('product_unsave', old.user_id, old.product_id);
  return old;
end;
$$;

create trigger on_product_save
  after insert or delete on public.product_saves
  for each row execute function public.handle_product_save();

create or replace function public.handle_collection_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _owner uuid;
  _title text;
  _visibility public.visibility;
begin
  if tg_op = 'INSERT' then
    update public.collections set product_count = product_count + 1, updated_at = now()
      where id = new.collection_id returning owner_id, title, visibility into _owner, _title, _visibility;
    update public.products set collection_count = collection_count + 1 where id = new.product_id;
    insert into public.analytics_events (event_type, user_id, product_id, collection_id)
      values ('collection_add', (select auth.uid()), new.product_id, new.collection_id);
    -- Followers of a public collection hear about new additions.
    if _visibility = 'public' then
      perform public.create_notification(f.user_id, 'collection_activity', 'New in "' || _title || '"',
        'A product was added to a collection you follow.', '/collections/' || (select slug from public.collections where id = new.collection_id))
      from public.collection_followers f where f.collection_id = new.collection_id and f.user_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid);
    end if;
    return new;
  end if;
  update public.collections set product_count = greatest(product_count - 1, 0), updated_at = now() where id = old.collection_id;
  update public.products set collection_count = greatest(collection_count - 1, 0) where id = old.product_id;
  insert into public.analytics_events (event_type, user_id, product_id, collection_id)
    values ('collection_remove', (select auth.uid()), old.product_id, old.collection_id);
  return old;
end;
$$;

create trigger on_collection_product
  after insert or delete on public.collection_products
  for each row execute function public.handle_collection_product();

create or replace function public.handle_brand_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.brands set follower_count = follower_count + 1 where id = new.brand_id;
    insert into public.analytics_events (event_type, user_id, brand_id) values ('brand_follow', new.user_id, new.brand_id);
    perform public.create_notification(b.owner_id, 'new_follower', 'New follower',
      'Someone started following ' || b.name || '.', '/brands/' || b.slug)
    from public.brands b where b.id = new.brand_id and b.owner_id is not null;
    return new;
  end if;
  update public.brands set follower_count = greatest(follower_count - 1, 0) where id = old.brand_id;
  return old;
end;
$$;

create trigger on_brand_follow
  after insert or delete on public.brand_followers
  for each row execute function public.handle_brand_follow();

create or replace function public.handle_category_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.categories set follower_count = follower_count + 1 where id = new.category_id;
    insert into public.analytics_events (event_type, user_id, category_id) values ('category_follow', new.user_id, new.category_id);
    return new;
  end if;
  update public.categories set follower_count = greatest(follower_count - 1, 0) where id = old.category_id;
  return old;
end;
$$;

create trigger on_category_follow
  after insert or delete on public.category_followers
  for each row execute function public.handle_category_follow();

create or replace function public.handle_collection_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.collections set follower_count = follower_count + 1 where id = new.collection_id;
    perform public.create_notification(c.owner_id, 'new_follower', 'New follower',
      'Someone saved your collection "' || c.title || '".', '/collections/' || c.slug)
    from public.collections c where c.id = new.collection_id and c.owner_id <> new.user_id;
    return new;
  end if;
  update public.collections set follower_count = greatest(follower_count - 1, 0) where id = old.collection_id;
  return old;
end;
$$;

create trigger on_collection_follow
  after insert or delete on public.collection_followers
  for each row execute function public.handle_collection_follow();

create or replace function public.handle_reminder_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.analytics_events (event_type, user_id, product_id) values ('reminder_created', new.user_id, new.product_id);
  return new;
end;
$$;

create trigger on_reminder_created
  after insert on public.reminders
  for each row execute function public.handle_reminder_created();

-- ---------------------------------------------------------------------------
-- Client analytics
-- ---------------------------------------------------------------------------

-- Records page views, product views, shares and searches. Other events are
-- recorded by triggers so clients cannot fake them.
create or replace function public.track_event(
  event_type text,
  anon_id text default null,
  product_id uuid default null,
  category_id uuid default null,
  brand_id uuid default null,
  collection_id uuid default null,
  article_id uuid default null,
  query text default null,
  channel text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _who text;
begin
  if event_type not in ('page_view', 'product_view', 'product_share', 'search') then
    raise exception 'LOUPE:INVALID_INPUT' using detail = 'Unknown event.';
  end if;
  if anon_id is not null and anon_id !~ '^[A-Za-z0-9-]{8,64}$' then
    anon_id := null;
  end if;
  _who := coalesce(_uid::text, anon_id);
  if _who is null then
    return;
  end if;
  -- Silently drop floods rather than erroring.
  if not public.rate_limit_hit('event:' || _who, 240, 600) then
    return;
  end if;
  if product_id is not null and not exists (
    select 1 from public.products p where p.id = track_event.product_id and p.status = 'published'
  ) then
    return;
  end if;

  if event_type = 'product_view' then
    if product_id is null then
      return;
    end if;
    -- One counted view per person per product per 30 minutes.
    if exists (
      select 1 from public.product_views v
      where v.product_id = track_event.product_id
        and v.created_at > now() - interval '30 minutes'
        and (v.viewer_id = _uid or (v.viewer_id is null and v.anon_id = track_event.anon_id))
    ) then
      return;
    end if;
    insert into public.product_views (product_id, viewer_id, anon_id) values (product_id, _uid, case when _uid is null then anon_id end);
    update public.products p set view_count = p.view_count + 1 where p.id = track_event.product_id;
  elsif event_type = 'product_share' then
    if product_id is null then
      return;
    end if;
    update public.products p set share_count = p.share_count + 1 where p.id = track_event.product_id;
  elsif event_type = 'search' then
    query := left(lower(trim(query)), 100);
    if query is null or query = '' then
      return;
    end if;
  end if;

  insert into public.analytics_events (event_type, user_id, anon_id, product_id, category_id, brand_id, collection_id, article_id, query, metadata)
  values (
    event_type, _uid, case when _uid is null then anon_id end, product_id, category_id, brand_id, collection_id, article_id,
    case when event_type = 'search' then query end,
    case when channel ~ '^[a-z_]{1,20}$' then jsonb_build_object('channel', channel) else '{}'::jsonb end
  );
end;
$$;

-- Validates a product, records the outbound click and returns the URL to
-- redirect to. Returns null if the product is not published or its URL is
-- not a plain https URL.
create or replace function public.record_outbound_click(product_id uuid, anon_id text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  _url text;
  _uid uuid := (select auth.uid());
  _who text;
begin
  select p.external_url into _url
  from public.products p
  where p.id = record_outbound_click.product_id and p.status = 'published';

  if _url is null or _url !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?(/[^\s]*)?$' then
    return null;
  end if;

  if anon_id is not null and anon_id !~ '^[A-Za-z0-9-]{8,64}$' then
    anon_id := null;
  end if;
  _who := coalesce(_uid::text, anon_id, 'anonymous');

  -- Always redirect, but only count clicks at a sane rate.
  if public.rate_limit_hit('click:' || _who || ':' || product_id, 5, 600) then
    update public.products p set click_count = p.click_count + 1 where p.id = record_outbound_click.product_id;
    insert into public.analytics_events (event_type, user_id, anon_id, product_id)
    values ('buy_click', _uid, case when _uid is null then anon_id end, product_id);
  end if;

  return _url;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trending score
-- ---------------------------------------------------------------------------

-- Weighted engagement with a 3-day half-life, plus a freshness boost for
-- new products and a small all-time popularity base. Runs every 10 minutes.
create or replace function public.refresh_popularity_scores()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with events as (
    select e.product_id,
      sum(
        case e.event_type
          when 'product_view' then 1.0
          when 'product_save' then 5.0
          when 'collection_add' then 4.0
          when 'buy_click' then 3.0
          when 'product_share' then 4.0
          when 'reminder_created' then 3.0
          when 'product_unsave' then -4.0
          else 0
        end * power(0.5, extract(epoch from (now() - e.created_at)) / (3 * 86400))
      ) as engagement
    from public.analytics_events e
    where e.product_id is not null and e.created_at > now() - interval '30 days'
    group by e.product_id
  ),
  scored as (
    select p.id,
      greatest(coalesce(ev.engagement, 0), 0)
        + 15 * power(0.5, extract(epoch from (now() - coalesce(p.published_at, now()))) / (7 * 86400))
        + 2 * ln(1 + p.save_count + p.collection_count)
        + ln(1 + p.view_count) * 0.5 as score
    from public.products p
    left join events ev on ev.product_id = p.id
    where p.status = 'published'
  ),
  ranked as (
    select id, score, row_number() over (order by score desc) as rnk from scored
  )
  update public.products p
    set popularity_score = round(r.score::numeric, 4)::double precision,
        trending_rank = case when r.rnk <= 20 then r.rnk::integer else null end
  from ranked r
  where r.id = p.id
    and (p.popularity_score is distinct from round(r.score::numeric, 4)::double precision
      or p.trending_rank is distinct from (case when r.rnk <= 20 then r.rnk::integer else null end));

  update public.products set trending_rank = null, popularity_score = 0
  where status <> 'published' and (trending_rank is not null or popularity_score <> 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Product cards view (security invoker: callers only see what RLS allows)
-- ---------------------------------------------------------------------------

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
  (p.trending_rank is not null) as is_trending
from public.products p
left join public.brands b on b.id = p.brand_id
left join lateral (
  select c.id, c.slug, c.name
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

-- Deals with computed status for the /deals page.
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
  pc.category_id, pc.category_name, pc.category_slug, pc.image_path, pc.image_alt, pc.score
from public.deals d
join public.product_cards pc on pc.id = d.product_id
join public.products p on p.id = d.product_id
where pc.status = 'published';

grant select on public.deal_cards to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Search
-- ---------------------------------------------------------------------------

create or replace function public.escape_like(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(value, '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- Ranked product IDs for a query: full text over name/sku/tagline/
-- description, plus fuzzy name matching and brand, tag and category names.
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
      where pc.product_id = p.id and c.name ilike _like
    )
  )
  order by rank desc
  limit least(result_limit, 200);
end;
$$;

-- Autocomplete: a few products, brands and categories for a prefix.
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
        select c.slug, c.name from public.categories c
        where c.name ilike _like or c.name % _q
        order by similarity(c.name, _q) desc
        limit 4
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- Most frequent searches over the last 30 days (for suggestions).
create or replace function public.popular_searches(result_limit integer default 8)
returns table (query text, searches bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.query, count(*) as searches
  from public.analytics_events e
  where e.event_type = 'search' and e.created_at > now() - interval '30 days' and e.query is not null
  group by e.query
  having count(*) >= 2
  order by searches desc
  limit least(result_limit, 20);
$$;

-- ---------------------------------------------------------------------------
-- Recommendations
-- ---------------------------------------------------------------------------

create or replace function public.related_products(_product_id uuid, result_limit integer default 8)
returns table (product_id uuid, score double precision)
language sql
stable
security invoker
set search_path = ''
as $$
  with src as (
    select p.id, p.brand_id, p.price,
      array(select category_id from public.product_categories where product_id = p.id) as cats,
      array(select tag_id from public.product_tags where product_id = p.id) as tags
    from public.products p where p.id = _product_id
  )
  select p.id,
    (select count(*) from public.product_categories pc where pc.product_id = p.id and pc.category_id = any(src.cats)) * 3.0
    + (select count(*) from public.product_tags pt where pt.product_id = p.id and pt.tag_id = any(src.tags)) * 2.0
    + case when p.brand_id = src.brand_id then 2.0 else 0 end
    + case when src.price > 0 and p.price between src.price * 0.6 and src.price * 1.4 then 1.0 else 0 end
    + p.popularity_score / 100 as score
  from public.products p, src
  where p.status = 'published' and p.id <> src.id
    and (
      p.brand_id = src.brand_id
      or exists (select 1 from public.product_categories pc where pc.product_id = p.id and pc.category_id = any(src.cats))
      or exists (select 1 from public.product_tags pt where pt.product_id = p.id and pt.tag_id = any(src.tags))
    )
  order by score desc
  limit least(result_limit, 24);
$$;

-- Personalised feed for the signed-in user, from followed categories and
-- brands, saved products, collection activity and recent views. Falls back
-- to trending when the user has no signals yet.
create or replace function public.personal_feed(result_limit integer default 24, result_offset integer default 0)
returns table (product_id uuid, score double precision, reason text)
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid),
  followed_cats as (
    select category_id from public.category_followers, me where user_id = me.uid
  ),
  followed_brands as (
    select brand_id from public.brand_followers, me where user_id = me.uid
  ),
  engaged as (
    select s.product_id from public.product_saves s, me where s.user_id = me.uid
    union
    select cp.product_id from public.collection_products cp join public.collections c on c.id = cp.collection_id, me where c.owner_id = me.uid
    union
    select v.product_id from public.product_views v, me where v.viewer_id = me.uid and v.created_at > now() - interval '30 days'
  ),
  engaged_cats as (
    select distinct pc.category_id from public.product_categories pc where pc.product_id in (select product_id from engaged)
  ),
  engaged_brands as (
    select distinct p.brand_id from public.products p where p.id in (select product_id from engaged) and p.brand_id is not null
  ),
  scored as (
    select p.id,
      case when p.brand_id in (select brand_id from followed_brands) then 5 else 0 end
      + (select count(*) from public.product_categories pc where pc.product_id = p.id and pc.category_id in (select category_id from followed_cats)) * 4
      + case when p.brand_id in (select brand_id from engaged_brands) then 2 else 0 end
      + (select count(*) from public.product_categories pc where pc.product_id = p.id and pc.category_id in (select category_id from engaged_cats)) * 2
      + p.popularity_score / 50
      + 3 * power(0.5, extract(epoch from (now() - coalesce(p.published_at, now()))) / (7 * 86400)) as score,
      case
        when p.brand_id in (select brand_id from followed_brands) then 'From a brand you follow'
        when exists (select 1 from public.product_categories pc where pc.product_id = p.id and pc.category_id in (select category_id from followed_cats)) then 'In a category you follow'
        when p.brand_id in (select brand_id from engaged_brands)
          or exists (select 1 from public.product_categories pc where pc.product_id = p.id and pc.category_id in (select category_id from engaged_cats)) then 'Similar to products you saved'
        else 'Trending now'
      end as reason
    from public.products p
    where p.status = 'published'
      and p.id not in (select product_id from public.product_saves, me where user_id = me.uid)
  )
  select id, score, reason from scored
  order by score desc
  limit least(result_limit, 60) offset greatest(result_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Duplicate detection
-- ---------------------------------------------------------------------------

create or replace function public.normalize_url(url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(lower(coalesce(url, '')), '^https?://(www\.)?', ''),
    '[?#].*$|/+$', '', 'g');
$$;

-- Possible duplicates of a product. Editors see every match; the product's
-- seller only sees published matches (enough for a "similar product already
-- exists" warning without exposing other sellers' drafts).
create or replace function public.find_duplicate_products(_product_id uuid)
returns table (product_id uuid, name text, slug text, status public.product_status, brand_name text, similarity real, reasons text[])
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  _p public.products;
  _staff boolean := public.is_staff();
begin
  select * into _p from public.products where id = _product_id;
  if not found or not (_staff or _p.seller_id = (select auth.uid())) then
    return;
  end if;

  return query
  select o.id, o.name, o.slug, o.status, b.name,
    similarity(o.name, _p.name),
    array_remove(array[
      case when _p.external_url is not null and public.normalize_url(o.external_url) = public.normalize_url(_p.external_url) then 'Same product URL' end,
      case when _p.sku is not null and lower(o.sku) = lower(_p.sku) then 'Same SKU/model' end,
      case when similarity(o.name, _p.name) >= 0.5 then 'Similar name' end,
      case when o.brand_id = _p.brand_id and similarity(o.name, _p.name) >= 0.35 then 'Same brand, similar name' end
    ], null)
  from public.products o
  left join public.brands b on b.id = o.brand_id
  where o.id <> _p.id
    and (_staff or o.status = 'published')
    and o.status not in ('rejected')
    and (
      (_p.external_url is not null and public.normalize_url(o.external_url) = public.normalize_url(_p.external_url))
      or (_p.sku is not null and lower(o.sku) = lower(_p.sku))
      or similarity(o.name, _p.name) >= 0.5
      or (o.brand_id = _p.brand_id and similarity(o.name, _p.name) >= 0.35)
    )
  order by similarity(o.name, _p.name) desc
  limit 10;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin analytics
-- ---------------------------------------------------------------------------

create or replace function public.analytics_summary(days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  _since timestamptz := now() - make_interval(days => least(greatest(days, 1), 365));
begin
  if not public.is_staff() then
    raise exception 'LOUPE:FORBIDDEN' using detail = 'Only staff can view analytics.';
  end if;
  return jsonb_build_object(
    'totals', (
      select jsonb_object_agg(event_type, n) from (
        select event_type, count(*) as n from public.analytics_events where created_at >= _since group by event_type
      ) t
    ),
    'daily', (
      select coalesce(jsonb_agg(x order by day), '[]'::jsonb) from (
        select date_trunc('day', created_at)::date as day,
          count(*) filter (where event_type = 'product_view') as views,
          count(*) filter (where event_type = 'buy_click') as clicks,
          count(*) filter (where event_type = 'product_save') as saves
        from public.analytics_events where created_at >= _since group by 1
      ) x
    ),
    'top_products', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select p.id, p.name, p.slug,
          count(*) filter (where e.event_type = 'product_view') as views,
          count(*) filter (where e.event_type = 'buy_click') as clicks,
          count(*) filter (where e.event_type = 'product_save') as saves,
          count(*) filter (where e.event_type = 'product_share') as shares
        from public.analytics_events e join public.products p on p.id = e.product_id
        where e.created_at >= _since
        group by p.id order by views desc, clicks desc limit 10
      ) x
    ),
    'top_categories', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select c.name, c.slug, count(*) as events
        from public.analytics_events e
        join public.product_categories pc on pc.product_id = e.product_id and pc.is_primary
        join public.categories c on c.id = pc.category_id
        where e.created_at >= _since and e.event_type in ('product_view', 'buy_click', 'product_save')
        group by c.id order by events desc limit 8
      ) x
    ),
    'top_brands', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select b.name, b.slug, count(*) as events
        from public.analytics_events e
        join public.products p on p.id = e.product_id
        join public.brands b on b.id = p.brand_id
        where e.created_at >= _since and e.event_type in ('product_view', 'buy_click', 'product_save')
        group by b.id order by events desc limit 8
      ) x
    ),
    'top_searches', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select query, count(*) as searches from public.analytics_events
        where event_type = 'search' and created_at >= _since and query is not null
        group by query order by searches desc limit 10
      ) x
    )
  );
end;
$$;

-- Per-product stats for the seller dashboard.
create or replace function public.seller_product_stats(days integer default 30)
returns table (product_id uuid, views bigint, clicks bigint, saves bigint, day date)
language sql
stable
security definer
set search_path = ''
as $$
  select e.product_id,
    count(*) filter (where e.event_type = 'product_view'),
    count(*) filter (where e.event_type = 'buy_click'),
    count(*) filter (where e.event_type = 'product_save'),
    date_trunc('day', e.created_at)::date
  from public.analytics_events e
  join public.products p on p.id = e.product_id
  where p.seller_id = (select auth.uid())
    and e.created_at >= now() - make_interval(days => least(greatest(days, 1), 365))
  group by e.product_id, date_trunc('day', e.created_at)::date;
$$;

-- Cleanup of short-lived data.
create or replace function public.cleanup_old_data()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limit_hits where hit_at < now() - interval '2 days';
  delete from public.product_views where created_at < now() - interval '60 days';
  delete from public.email_outbox where status in ('sent', 'skipped') and created_at < now() - interval '30 days';
$$;

revoke execute on function
  public.refresh_popularity_scores(),
  public.cleanup_old_data()
from public, anon, authenticated;

revoke execute on function
  public.analytics_summary(integer),
  public.seller_product_stats(integer),
  public.personal_feed(integer, integer),
  public.find_duplicate_products(uuid)
from public, anon;
