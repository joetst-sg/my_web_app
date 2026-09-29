-- Role helpers, new-user bootstrap, column protection triggers, grants and
-- Row Level Security policies.
--
-- Convention: user-facing errors are raised as 'LOUPE:<CODE>' with a safe,
-- human-readable DETAIL. The app shows the detail; anything else is replaced
-- by a generic message so raw database errors never reach users.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return value::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = _role
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('editor', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('admin');
$$;

-- False for signed-out and suspended users.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and not exists (
    select 1 from public.user_settings
    where user_id = (select auth.uid()) and suspended_at is not null
  );
$$;

create or replace function public.product_visible(_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    where p.id = _product_id
      and (p.status = 'published' or p.seller_id = (select auth.uid()) or public.is_staff())
  );
$$;

-- Sellers may edit their own products only while they are drafts or have
-- changes requested. Staff may always edit.
create or replace function public.can_edit_product(_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    public.is_staff() or exists (
      select 1 from public.products p
      where p.id = _product_id
        and p.seller_id = (select auth.uid())
        and p.status in ('draft', 'changes_requested')
    )
  );
$$;

create or replace function public.collection_visible(_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.collections c
    where c.id = _collection_id
      and (c.visibility = 'public' or c.owner_id = (select auth.uid()) or public.is_staff())
  );
$$;

create or replace function public.can_edit_collection(_collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and exists (
    select 1 from public.collections c
    where c.id = _collection_id
      and (c.owner_id = (select auth.uid()) or public.is_staff())
  );
$$;

create or replace function public.can_edit_brand(_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_user() and (
    public.is_staff() or exists (
      select 1 from public.brands b where b.id = _brand_id and b.owner_id = (select auth.uid())
    )
  );
$$;

create or replace function public.submission_visible(_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.submissions s
    where s.id = _submission_id
      and (s.seller_id = (select auth.uid()) or public.is_staff())
  );
$$;

create or replace function public.article_visible(_article_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.articles a
    where a.id = _article_id and (a.status = 'published' or public.is_staff())
  );
$$;

-- True when running inside a SECURITY DEFINER function (as the owner) rather
-- than directly as an API role. Protection triggers let definer functions
-- through because those functions do their own permission checks.
create or replace function public.is_api_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;

-- ---------------------------------------------------------------------------
-- Internal: audit, notifications, email queue, rate limits
-- ---------------------------------------------------------------------------

create or replace function public.write_audit(
  _action text, _entity_type text, _entity_id text, _metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), _action, _entity_type, _entity_id, coalesce(_metadata, '{}'::jsonb));
$$;

create or replace function public.create_notification(
  _user_id uuid, _type public.notification_type, _title text, _body text,
  _link text default null, _data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if _user_id is null then
    return;
  end if;
  if exists (
    select 1 from public.user_settings
    where user_id = _user_id and (notification_prefs ->> 'in_app')::boolean is false
  ) and _type not in ('product_approved', 'product_rejected', 'changes_requested', 'product_published') then
    return;
  end if;
  insert into public.notifications (user_id, type, title, body, link, data)
  values (_user_id, _type, left(_title, 160), left(_body, 1000), _link, coalesce(_data, '{}'::jsonb));
end;
$$;

-- Queues an email. Workflow emails (approved, rejected, changes requested,
-- published, submission received) are always sent; marketing-style emails
-- respect the user's email preference.
create or replace function public.enqueue_email(_user_id uuid, _template text, _payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _email text;
begin
  select email into _email from auth.users where id = _user_id;
  if _email is null then
    return;
  end if;
  if _template in ('price_drop', 'reminder') and exists (
    select 1 from public.user_settings
    where user_id = _user_id and (notification_prefs ->> 'email')::boolean is false
  ) then
    return;
  end if;
  insert into public.email_outbox (user_id, to_email, template, payload)
  values (_user_id, _email, _template, coalesce(_payload, '{}'::jsonb));
end;
$$;

-- Records a hit and returns false once _max hits occurred within the window.
create or replace function public.rate_limit_hit(_key text, _max integer, _window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  _count integer;
begin
  select count(*) into _count
  from public.rate_limit_hits
  where key = _key and hit_at > now() - make_interval(secs => _window_seconds);
  if _count >= _max then
    return false;
  end if;
  insert into public.rate_limit_hits (key) values (_key);
  return true;
end;
$$;

create or replace function public.raise_if_rate_limited(_key text, _max integer, _window_seconds integer, _message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.rate_limit_hit(_key, _max, _window_seconds) then
    raise exception 'LOUPE:RATE_LIMITED' using detail = _message;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- New user bootstrap
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _username text := new.raw_user_meta_data ->> 'username';
begin
  if _username is not null and (
    _username !~ '^[a-zA-Z0-9_]{3,30}$'
    or exists (select 1 from public.profiles where username = _username::extensions.citext)
  ) then
    _username := null;
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, _username, left(coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)), 80));

  insert into public.user_settings (user_id) values (new.id);
  insert into public.user_roles (user_id, role) values (new.id, 'user');

  insert into public.email_outbox (user_id, to_email, template, payload)
  values (new.id, new.email, 'welcome', jsonb_build_object('display_name', coalesce(new.raw_user_meta_data ->> 'display_name', '')));

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Creating a seller profile makes the user a seller.
create or replace function public.handle_new_seller()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_roles (user_id, role) values (new.user_id, 'seller')
  on conflict do nothing;
  perform public.write_audit('seller.created', 'seller_profile', new.user_id::text, jsonb_build_object('company', new.company_name));
  return new;
end;
$$;

create trigger on_seller_profile_created
  after insert on public.seller_profiles
  for each row execute function public.handle_new_seller();

-- Every product gets exactly one submission that carries its workflow.
create or replace function public.handle_new_product()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _submission_id uuid;
begin
  insert into public.submissions (product_id, seller_id, status)
  values (new.id, new.seller_id, 'draft')
  returning id into _submission_id;

  insert into public.analytics_events (event_type, user_id, product_id)
  values ('submission_created', new.seller_id, new.id);

  perform public.write_audit('product.created', 'product', new.id::text, jsonb_build_object('name', new.name, 'submission_id', _submission_id));
  return new;
end;
$$;

create trigger on_product_created
  after insert on public.products
  for each row execute function public.handle_new_product();

-- ---------------------------------------------------------------------------
-- Column protection: API roles cannot change workflow status, counters or
-- editorial flags directly. Those change only through SECURITY DEFINER
-- functions, which run as the table owner and so skip these checks.
-- ---------------------------------------------------------------------------

create or replace function public.protect_products()
returns trigger
language plpgsql
set search_path = ''
as $$
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
    new.collection_count := 0;
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
  new.collection_count := old.collection_count;
  new.popularity_score := old.popularity_score;
  new.trending_rank := old.trending_rank;
  return new;
end;
$$;

create trigger protect_products
  before insert or update on public.products
  for each row execute function public.protect_products();

create or replace function public.protect_brands()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_api_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.follower_count := 0;
    if not public.is_staff() then
      new.owner_id := (select auth.uid());
      new.is_published := false;
      new.is_verified := false;
    end if;
    return new;
  end if;
  new.follower_count := old.follower_count;
  if not public.is_staff() then
    new.owner_id := old.owner_id;
    new.is_published := old.is_published;
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

create trigger protect_brands
  before insert or update on public.brands
  for each row execute function public.protect_brands();

create or replace function public.protect_collections()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_api_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.product_count := 0;
    new.follower_count := 0;
    if not public.is_staff() then
      new.owner_id := (select auth.uid());
      new.is_editorial := false;
      new.is_featured := false;
    end if;
    return new;
  end if;
  new.product_count := old.product_count;
  new.follower_count := old.follower_count;
  new.owner_id := old.owner_id;
  if not public.is_staff() then
    new.is_editorial := old.is_editorial;
    new.is_featured := old.is_featured;
  end if;
  return new;
end;
$$;

create trigger protect_collections
  before insert or update on public.collections
  for each row execute function public.protect_collections();

create or replace function public.protect_categories()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_api_role() then
    new.follower_count := case when tg_op = 'INSERT' then 0 else old.follower_count end;
  end if;
  return new;
end;
$$;

create trigger protect_categories
  before insert or update on public.categories
  for each row execute function public.protect_categories();

create or replace function public.protect_user_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_api_role() and not public.is_admin() then
    new.suspended_at := old.suspended_at;
    new.suspended_reason := old.suspended_reason;
  end if;
  return new;
end;
$$;

create trigger protect_user_settings
  before update on public.user_settings
  for each row execute function public.protect_user_settings();

create or replace function public.protect_reminders()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_api_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.user_id := (select auth.uid());
    new.status := 'pending';
    new.sent_at := null;
    return new;
  end if;
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'LOUPE:FORBIDDEN' using detail = 'Reminders can only be cancelled.';
  end if;
  new.user_id := old.user_id;
  new.product_id := old.product_id;
  new.sent_at := old.sent_at;
  return new;
end;
$$;

create trigger protect_reminders
  before insert or update on public.reminders
  for each row execute function public.protect_reminders();

create or replace function public.protect_reports()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_api_role() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.reporter_id := (select auth.uid());
    new.status := 'open';
    new.resolved_by := null;
    new.resolution_note := null;
    perform public.raise_if_rate_limited('report:' || (select auth.uid()), 10, 3600,
      'You have sent a lot of reports recently. Please try again later.');
  else
    new.resolved_by := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger protect_reports
  before insert or update on public.reports
  for each row execute function public.protect_reports();

create or replace function public.protect_profiles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_api_role() then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger protect_profiles
  before update on public.profiles
  for each row execute function public.protect_profiles();

-- Collections: rate-limit creation to stop spam.
create or replace function public.limit_collection_creation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_api_role() then
    perform public.raise_if_rate_limited('collection:' || (select auth.uid()), 30, 3600,
      'You have created a lot of collections recently. Please try again later.');
  end if;
  return new;
end;
$$;

create trigger limit_collection_creation
  before insert on public.collections
  for each row execute function public.limit_collection_creation();

-- Submission messages: notify the other side of the conversation.
create or replace function public.handle_submission_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _s public.submissions;
  _product_name text;
begin
  select * into _s from public.submissions where id = new.submission_id;
  select name into _product_name from public.products where id = _s.product_id;
  if new.author_id = _s.seller_id then
    if _s.reviewer_id is not null then
      perform public.create_notification(_s.reviewer_id, 'system', 'New message from seller',
        'The seller replied about "' || _product_name || '".', '/admin/submissions/' || _s.id);
    end if;
  elsif _s.seller_id is not null then
    perform public.create_notification(_s.seller_id, 'system', 'New message from the editors',
      'An editor sent a message about "' || _product_name || '".', '/seller/submissions/' || _s.id);
  end if;
  return new;
end;
$$;

create trigger on_submission_message
  after insert on public.submission_messages
  for each row execute function public.handle_submission_message();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- Tables that are written only by SECURITY DEFINER functions.
revoke insert, update, delete on
  public.roles, public.user_roles, public.submissions, public.submission_reviews,
  public.analytics_events, public.audit_logs, public.product_views
from authenticated;

revoke all on public.email_outbox, public.rate_limit_hits from anon, authenticated;
revoke select on public.product_views, public.audit_logs, public.analytics_events from anon;

-- Notifications: users may only mark them read.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke insert on public.notifications from authenticated;

-- Internal functions are not callable through the API.
revoke execute on function
  public.write_audit(text, text, text, jsonb),
  public.create_notification(uuid, public.notification_type, text, text, text, jsonb),
  public.enqueue_email(uuid, text, jsonb),
  public.rate_limit_hit(text, integer, integer),
  public.raise_if_rate_limited(text, integer, integer, text)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- profiles
create policy "profiles: public or own or staff" on public.profiles
  for select using (is_public or id = (select auth.uid()) or public.is_staff());
create policy "profiles: update own" on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- user_settings
create policy "user_settings: own or admin" on public.user_settings
  for select using (user_id = (select auth.uid()) or public.is_admin());
create policy "user_settings: update own or admin" on public.user_settings
  for update using (user_id = (select auth.uid()) or public.is_admin());

-- roles / user_roles
create policy "roles: readable" on public.roles for select using (true);
create policy "user_roles: own or admin" on public.user_roles
  for select using (user_id = (select auth.uid()) or public.is_staff());

-- seller_profiles
create policy "seller_profiles: own or staff" on public.seller_profiles
  for select using (user_id = (select auth.uid()) or public.is_staff());
create policy "seller_profiles: create own" on public.seller_profiles
  for insert with check (user_id = (select auth.uid()) and public.is_active_user());
create policy "seller_profiles: update own or staff" on public.seller_profiles
  for update using (user_id = (select auth.uid()) or public.is_admin());

-- brands
create policy "brands: published or own or staff" on public.brands
  for select using (is_published or owner_id = (select auth.uid()) or public.is_staff());
create policy "brands: sellers and staff create" on public.brands
  for insert with check (public.is_active_user() and (public.has_role('seller') or public.is_staff()));
create policy "brands: owner or staff update" on public.brands
  for update using (public.can_edit_brand(id));
create policy "brands: admin delete" on public.brands
  for delete using (public.is_admin());

-- categories / tags
create policy "categories: readable" on public.categories for select using (true);
create policy "categories: staff write" on public.categories for insert with check (public.is_staff());
create policy "categories: staff update" on public.categories for update using (public.is_staff());
create policy "categories: admin delete" on public.categories for delete using (public.is_admin());

create policy "tags: readable" on public.tags for select using (true);
create policy "tags: sellers and staff create" on public.tags
  for insert with check (public.is_active_user() and (public.has_role('seller') or public.is_staff()));
create policy "tags: staff update" on public.tags for update using (public.is_staff());
create policy "tags: staff delete" on public.tags for delete using (public.is_staff());

-- products
create policy "products: published or own or staff" on public.products
  for select using (status = 'published' or seller_id = (select auth.uid()) or public.is_staff());
create policy "products: sellers and staff create" on public.products
  for insert with check (public.is_active_user() and (public.has_role('seller') or public.is_staff()));
create policy "products: editable by owner (draft) or staff" on public.products
  for update using (public.can_edit_product(id)) with check (public.can_edit_product(id));
create policy "products: owner deletes drafts, admin deletes any" on public.products
  for delete using (
    (seller_id = (select auth.uid()) and status = 'draft') or public.is_admin()
  );

-- product child tables share the same rules
do $$
declare t text;
begin
  foreach t in array array['product_categories', 'product_tags', 'product_images', 'product_videos', 'product_specifications'] loop
    execute format('create policy "%1$s: visible with product" on public.%1$I for select using (public.product_visible(product_id))', t);
    execute format('create policy "%1$s: editors of product insert" on public.%1$I for insert with check (public.can_edit_product(product_id))', t);
    execute format('create policy "%1$s: editors of product update" on public.%1$I for update using (public.can_edit_product(product_id))', t);
    execute format('create policy "%1$s: editors of product delete" on public.%1$I for delete using (public.can_edit_product(product_id))', t);
  end loop;
end;
$$;

-- editorial scores: staff only
create policy "product_scores: visible with product" on public.product_scores
  for select using (public.product_visible(product_id));
create policy "product_scores: staff insert" on public.product_scores for insert with check (public.is_staff());
create policy "product_scores: staff update" on public.product_scores for update using (public.is_staff());
create policy "product_scores: staff delete" on public.product_scores for delete using (public.is_staff());

-- deals / featured: staff write
create policy "deals: visible with product" on public.deals for select using (public.product_visible(product_id));
create policy "deals: staff insert" on public.deals for insert with check (public.is_staff());
create policy "deals: staff update" on public.deals for update using (public.is_staff());
create policy "deals: staff delete" on public.deals for delete using (public.is_staff());

create policy "featured: readable" on public.featured_products for select using (public.product_visible(product_id));
create policy "featured: staff insert" on public.featured_products for insert with check (public.is_staff());
create policy "featured: staff update" on public.featured_products for update using (public.is_staff());
create policy "featured: staff delete" on public.featured_products for delete using (public.is_staff());

-- engagement: own rows only
create policy "product_views: staff read" on public.product_views for select using (public.is_staff());

create policy "product_saves: own" on public.product_saves
  for select using (user_id = (select auth.uid()));
create policy "product_saves: create own" on public.product_saves
  for insert with check (user_id = (select auth.uid()) and public.is_active_user() and public.product_visible(product_id));
create policy "product_saves: delete own" on public.product_saves
  for delete using (user_id = (select auth.uid()));

create policy "brand_followers: own" on public.brand_followers
  for select using (user_id = (select auth.uid()));
create policy "brand_followers: create own" on public.brand_followers
  for insert with check (user_id = (select auth.uid()) and public.is_active_user());
create policy "brand_followers: delete own" on public.brand_followers
  for delete using (user_id = (select auth.uid()));

create policy "category_followers: own" on public.category_followers
  for select using (user_id = (select auth.uid()));
create policy "category_followers: create own" on public.category_followers
  for insert with check (user_id = (select auth.uid()) and public.is_active_user());
create policy "category_followers: delete own" on public.category_followers
  for delete using (user_id = (select auth.uid()));

create policy "collection_followers: own" on public.collection_followers
  for select using (user_id = (select auth.uid()));
create policy "collection_followers: create own" on public.collection_followers
  for insert with check (user_id = (select auth.uid()) and public.is_active_user() and public.collection_visible(collection_id));
create policy "collection_followers: delete own" on public.collection_followers
  for delete using (user_id = (select auth.uid()));

-- collections
create policy "collections: public or own or staff" on public.collections
  for select using (visibility = 'public' or owner_id = (select auth.uid()) or public.is_staff());
create policy "collections: create own" on public.collections
  for insert with check (public.is_active_user());
create policy "collections: owner or staff update" on public.collections
  for update using (public.can_edit_collection(id));
create policy "collections: owner or admin delete" on public.collections
  for delete using (owner_id = (select auth.uid()) or public.is_admin());

create policy "collection_products: visible with collection" on public.collection_products
  for select using (public.collection_visible(collection_id));
create policy "collection_products: collection editors insert" on public.collection_products
  for insert with check (public.can_edit_collection(collection_id) and public.product_visible(product_id));
create policy "collection_products: collection editors update" on public.collection_products
  for update using (public.can_edit_collection(collection_id));
create policy "collection_products: collection editors delete" on public.collection_products
  for delete using (public.can_edit_collection(collection_id));

-- reminders
create policy "reminders: own" on public.reminders for select using (user_id = (select auth.uid()));
create policy "reminders: create own" on public.reminders
  for insert with check (public.is_active_user() and public.product_visible(product_id));
create policy "reminders: update own" on public.reminders for update using (user_id = (select auth.uid()));
create policy "reminders: delete own" on public.reminders for delete using (user_id = (select auth.uid()));

-- submissions (writes only through transition_submission)
create policy "submissions: seller or staff" on public.submissions
  for select using (seller_id = (select auth.uid()) or public.is_staff());
create policy "submission_reviews: seller or staff" on public.submission_reviews
  for select using (public.submission_visible(submission_id));
create policy "submission_messages: seller or staff" on public.submission_messages
  for select using (public.submission_visible(submission_id));
create policy "submission_messages: participants write" on public.submission_messages
  for insert with check (
    author_id = (select auth.uid()) and public.is_active_user() and public.submission_visible(submission_id)
  );

-- articles
create policy "articles: published or staff" on public.articles
  for select using (status = 'published' or public.is_staff());
create policy "articles: staff insert" on public.articles for insert with check (public.is_staff());
create policy "articles: staff update" on public.articles for update using (public.is_staff());
create policy "articles: admin delete" on public.articles for delete using (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['article_categories', 'article_tags', 'article_products'] loop
    execute format('create policy "%1$s: visible with article" on public.%1$I for select using (public.article_visible(article_id))', t);
    execute format('create policy "%1$s: staff insert" on public.%1$I for insert with check (public.is_staff())', t);
    execute format('create policy "%1$s: staff update" on public.%1$I for update using (public.is_staff())', t);
    execute format('create policy "%1$s: staff delete" on public.%1$I for delete using (public.is_staff())', t);
  end loop;
end;
$$;

-- homepage / settings
create policy "homepage_sections: enabled or staff" on public.homepage_sections
  for select using (is_enabled or public.is_staff());
create policy "homepage_sections: staff insert" on public.homepage_sections for insert with check (public.is_staff());
create policy "homepage_sections: staff update" on public.homepage_sections for update using (public.is_staff());
create policy "homepage_sections: staff delete" on public.homepage_sections for delete using (public.is_staff());

create policy "site_settings: readable" on public.site_settings for select using (true);
create policy "site_settings: admin insert" on public.site_settings for insert with check (public.is_admin());
create policy "site_settings: admin update" on public.site_settings for update using (public.is_admin());

-- notifications
create policy "notifications: own" on public.notifications for select using (user_id = (select auth.uid()));
create policy "notifications: mark own read" on public.notifications
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: delete own" on public.notifications for delete using (user_id = (select auth.uid()));

-- analytics / audit / moderation
create policy "analytics: staff read" on public.analytics_events for select using (public.is_staff());
create policy "audit_logs: staff read" on public.audit_logs for select using (public.is_staff());

create policy "reports: own or staff" on public.reports
  for select using (reporter_id = (select auth.uid()) or public.is_staff());
create policy "reports: signed-in users create" on public.reports
  for insert with check (public.is_active_user() and public.product_visible(product_id));
create policy "reports: staff update" on public.reports for update using (public.is_staff());
