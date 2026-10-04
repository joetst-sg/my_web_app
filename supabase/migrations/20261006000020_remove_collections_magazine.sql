-- Collections and the magazine (articles) are removed from the site:
-- their tables, functions, triggers, storage buckets and every reference
-- in shared functions, analytics and the homepage.
-- (Enum values featured_collections / magazine / collection_activity stay:
-- Postgres can't drop enum values in place, and nothing uses them any more.)

delete from public.homepage_sections where type in ('featured_collections', 'magazine');

-- Shared functions without their collection/article parts.
CREATE OR REPLACE FUNCTION public.publish_due()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  _s record;
  _n integer := 0;
begin
  for _s in
    select id from public.submissions
    where status = 'scheduled' and scheduled_for <= now()
    order by scheduled_for
    for update skip locked
  loop
    perform public.apply_submission_transition(_s.id, 'publish', null, 'Published automatically at the scheduled time.');
    _n := _n + 1;
  end loop;

  return _n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.personal_feed(result_limit integer DEFAULT 24, result_offset integer DEFAULT 0)
 RETURNS TABLE(product_id uuid, score double precision, reason text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.refresh_popularity_scores()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  with events as (
    select e.product_id,
      sum(
        case e.event_type
          when 'product_view' then 1.0
          when 'product_save' then 5.0
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
        + 2 * ln(1 + p.save_count)
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
$function$;

CREATE OR REPLACE FUNCTION public.protect_products()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if not public.is_api_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.seller_id := (select auth.uid());
    new.status := 'draft';
    new.published_at := null;
    new.scheduled_for := null;
    new.view_count := 0;
    new.save_count := 0;
    new.click_count := 0;
    new.share_count := 0;
    new.popularity_score := 0;
    new.trending_rank := null;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.published_at is distinct from old.published_at
     or new.scheduled_for is distinct from old.scheduled_for then
    raise exception 'LOUPE:FORBIDDEN'
      using detail = 'Product status can only be changed through the review workflow.';
  end if;

  new.seller_id := old.seller_id;
  new.view_count := old.view_count;
  new.save_count := old.save_count;
  new.click_count := old.click_count;
  new.share_count := old.share_count;
  new.popularity_score := old.popularity_score;
  new.trending_rank := old.trending_rank;
  return new;
end;
$function$;

drop function if exists public.track_event(text, text, uuid, uuid, uuid, uuid, uuid, text, text);
CREATE FUNCTION public.track_event(event_type text, anon_id text DEFAULT NULL::text, product_id uuid DEFAULT NULL::uuid, category_id uuid DEFAULT NULL::uuid, brand_id uuid DEFAULT NULL::uuid, query text DEFAULT NULL::text, channel text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  insert into public.analytics_events (event_type, user_id, anon_id, product_id, category_id, brand_id, query, metadata)
  values (
    event_type, _uid, case when _uid is null then anon_id end, product_id, category_id, brand_id,
    case when event_type = 'search' then query end,
    case when channel ~ '^[a-z_]{1,20}$' then jsonb_build_object('channel', channel) else '{}'::jsonb end
  );
end;
$function$;
revoke all on function public.track_event(text, text, uuid, uuid, uuid, text, text) from public;
grant execute on function public.track_event(text, text, uuid, uuid, uuid, text, text) to anon, authenticated, service_role;

-- Tables (their triggers, policies and foreign keys go with them).
drop table if exists public.collection_followers, public.collection_products, public.collections,
  public.article_products, public.article_categories, public.article_tags, public.articles cascade;

drop function if exists public.collection_visible(uuid);
drop function if exists public.can_edit_collection(uuid);
drop function if exists public.article_visible(uuid);
drop function if exists public.protect_collections();
drop function if exists public.limit_collection_creation();
drop function if exists public.handle_collection_follow();
drop function if exists public.handle_collection_product();

-- Analytics and product counters.
alter table public.analytics_events drop column if exists collection_id, drop column if exists article_id;
delete from public.analytics_events where event_type in ('collection_add', 'collection_remove');
alter table public.analytics_events drop constraint if exists analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check check (event_type in ('page_view', 'product_view', 'product_save', 'product_unsave', 'buy_click', 'search', 'brand_follow', 'category_follow', 'product_share', 'reminder_created', 'submission_created', 'submission_submitted', 'submission_approved', 'submission_rejected', 'submission_published', 'greenfunding_redirect', 'indiegogo_redirect', 'crowdfunding_redirect'));
alter table public.products drop column if exists collection_count;

-- Storage access rules. The two (empty) buckets themselves are deleted
-- through the Storage API (deleting storage rows in SQL is not allowed).
drop policy if exists "collection-images: owner read" on storage.objects;
drop policy if exists "collection-images: owner insert" on storage.objects;
drop policy if exists "collection-images: owner update" on storage.objects;
drop policy if exists "collection-images: owner delete" on storage.objects;
drop policy if exists "article-images: staff read" on storage.objects;
drop policy if exists "article-images: staff insert" on storage.objects;
drop policy if exists "article-images: staff update" on storage.objects;
drop policy if exists "article-images: staff delete" on storage.objects;
