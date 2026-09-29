-- Core tables. auth.users is the "users" table; everything here hangs off it.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users, roles, settings
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext unique check (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  website text check (website is null or website ~* '^https://'),
  social_links jsonb not null default '{}'::jsonb,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private per-user settings, kept apart from the public profile row.
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notification_prefs jsonb not null default '{"email": true, "in_app": true, "product_updates": true, "deals": true}'::jsonb,
  onboarded_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id public.app_role primary key,
  description text not null
);

insert into public.roles (id, description) values
  ('user', 'Registered user: save products, collections, reminders, follows'),
  ('seller', 'Product owner: submit and manage their own products'),
  ('editor', 'Editorial staff: review submissions, edit and publish content'),
  ('admin', 'Administrator: full access');

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null references public.roles (id),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.seller_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_name text not null check (char_length(company_name) between 2 and 120),
  website text check (website is null or website ~* '^https://'),
  contact_email text check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  logo_url text,
  bio text check (char_length(bio) <= 1000),
  social_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  tagline text check (char_length(tagline) <= 160),
  description text check (char_length(description) <= 4000),
  logo_url text,
  cover_url text,
  website_url text check (website_url is null or website_url ~* '^https://'),
  social_links jsonb not null default '{}'::jsonb,
  owner_id uuid references auth.users (id) on delete set null,
  is_published boolean not null default false,
  is_verified boolean not null default false,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 60),
  description text,
  parent_id uuid references public.categories (id) on delete set null,
  icon text,
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  hero_image_url text,
  seo_title text,
  seo_description text,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  tagline text check (char_length(tagline) <= 200),
  description text check (char_length(description) <= 20000),
  key_features text[] not null default '{}',
  benefits text[] not null default '{}',
  brand_id uuid references public.brands (id) on delete set null,
  seller_id uuid references auth.users (id) on delete set null default auth.uid(),
  external_url text check (external_url is null or external_url ~* '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?(/[^\s]*)?$'),
  sku text check (char_length(sku) <= 80),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  price numeric(12, 2) check (price >= 0),
  original_price numeric(12, 2) check (original_price >= 0),
  sale_starts_at timestamptz,
  sale_ends_at timestamptz,
  discount_percent integer generated always as (
    case
      when original_price > 0 and price is not null and price < original_price
        then round((1 - price / original_price) * 100)::integer
      else 0
    end
  ) stored,
  status public.product_status not null default 'draft',
  availability public.product_availability not null default 'available',
  published_at timestamptz,
  scheduled_for timestamptz,
  view_count integer not null default 0,
  save_count integer not null default 0,
  click_count integer not null default 0,
  share_count integer not null default 0,
  collection_count integer not null default 0,
  popularity_score double precision not null default 0,
  trending_rank integer,
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(sku, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(tagline, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sale_window check (sale_ends_at is null or sale_starts_at is null or sale_ends_at > sale_starts_at)
);

create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (product_id, category_id)
);
create unique index product_categories_one_primary on public.product_categories (product_id) where is_primary;

create table public.product_tags (
  product_id uuid not null references public.products (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (product_id, tag_id)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null unique,
  alt text check (char_length(alt) <= 200),
  width integer check (width > 0),
  height integer check (height > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_videos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null check (url ~* '^https://'),
  provider text not null default 'other' check (provider in ('youtube', 'vimeo', 'other')),
  title text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  value text not null check (char_length(value) between 1 and 300),
  position integer not null default 0
);

-- Editorial score. Only editors/admins can write it (see RLS).
create table public.product_scores (
  product_id uuid primary key references public.products (id) on delete cascade,
  overall numeric(3, 1) not null check (overall between 0 and 10),
  design numeric(3, 1) check (design between 0 and 10),
  innovation numeric(3, 1) check (innovation between 0 and 10),
  usability numeric(3, 1) check (usability between 0 and 10),
  value numeric(3, 1) check (value between 0 and 10),
  features numeric(3, 1) check (features between 0 and 10),
  verdict text check (char_length(verdict) <= 600),
  reviewed_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  title text check (char_length(title) <= 120),
  deal_price numeric(12, 2) not null check (deal_price >= 0),
  original_price numeric(12, 2) check (original_price >= 0),
  coupon_code text check (char_length(coupon_code) <= 40),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint deal_window check (ends_at is null or ends_at > starts_at)
);

create table public.featured_products (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  placement public.feature_placement not null,
  position integer not null default 0,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (product_id, placement)
);

-- ---------------------------------------------------------------------------
-- Engagement
-- ---------------------------------------------------------------------------

create table public.product_views (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  viewer_id uuid references auth.users (id) on delete set null,
  anon_id text,
  created_at timestamptz not null default now()
);

create table public.product_saves (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.brand_followers (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, brand_id)
);

create table public.category_followers (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  owner_id uuid references auth.users (id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 2 and 80),
  description text check (char_length(description) <= 600),
  cover_image_url text,
  visibility public.visibility not null default 'private',
  is_editorial boolean not null default false,
  is_featured boolean not null default false,
  product_count integer not null default 0,
  follower_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collection_products (
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null default 0,
  note text check (char_length(note) <= 280),
  added_at timestamptz not null default now(),
  primary key (collection_id, product_id)
);

create table public.collection_followers (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  product_id uuid not null references public.products (id) on delete cascade,
  type public.reminder_type not null,
  remind_at timestamptz,
  note text check (char_length(note) <= 200),
  status public.reminder_status not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint custom_needs_date check (type <> 'custom' or remind_at is not null)
);
create unique index reminders_one_pending on public.reminders (user_id, product_id, type) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Submissions and editorial workflow
-- ---------------------------------------------------------------------------

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  seller_id uuid references auth.users (id) on delete set null,
  status public.submission_status not null default 'draft',
  reviewer_id uuid references auth.users (id) on delete set null,
  submitted_at timestamptz,
  scheduled_for timestamptz,
  last_action_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Review history: one row per workflow action.
create table public.submission_reviews (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action public.review_action not null,
  from_status public.submission_status not null,
  to_status public.submission_status not null,
  message text check (char_length(message) <= 4000),
  created_at timestamptz not null default now()
);

-- Conversation between the seller and editors.
create table public.submission_messages (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Editorial content
-- ---------------------------------------------------------------------------

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  excerpt text check (char_length(excerpt) <= 400),
  content text not null default '',
  featured_image_url text,
  author_id uuid references auth.users (id) on delete set null default auth.uid(),
  type public.article_type not null default 'news',
  status public.article_status not null default 'draft',
  seo_title text check (char_length(seo_title) <= 70),
  seo_description text check (char_length(seo_description) <= 170),
  reading_minutes integer not null default 1,
  published_at timestamptz,
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_categories (
  article_id uuid not null references public.articles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (article_id, category_id)
);

create table public.article_tags (
  article_id uuid not null references public.articles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (article_id, tag_id)
);

create table public.article_products (
  article_id uuid not null references public.articles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  position integer not null default 0,
  primary key (article_id, product_id)
);

create table public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  type public.homepage_section_type not null,
  title text check (char_length(title) <= 80),
  subtitle text check (char_length(subtitle) <= 200),
  -- product_ids, collection_ids, category_ids, article_ids, limit
  config jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  is_enabled boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_.]+$'),
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications, analytics, moderation, audit
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  title text not null check (char_length(title) <= 160),
  body text check (char_length(body) <= 1000),
  link text check (link is null or link ~ '^/'),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- No IP addresses or user agents are stored. anon_id is a random ID kept in
-- a first-party cookie so anonymous views can be de-duplicated.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    'page_view', 'product_view', 'product_save', 'product_unsave', 'collection_add',
    'collection_remove', 'buy_click', 'search', 'brand_follow', 'category_follow',
    'product_share', 'reminder_created', 'submission_created', 'submission_submitted',
    'submission_approved', 'submission_rejected', 'submission_published'
  )),
  user_id uuid references auth.users (id) on delete set null,
  anon_id text check (anon_id is null or anon_id ~ '^[A-Za-z0-9-]{8,64}$'),
  product_id uuid references public.products (id) on delete cascade,
  brand_id uuid references public.brands (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete cascade,
  article_id uuid references public.articles (id) on delete cascade,
  query text check (char_length(query) <= 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users (id) on delete set null default auth.uid(),
  product_id uuid not null references public.products (id) on delete cascade,
  reason public.report_reason not null,
  details text check (char_length(details) <= 2000),
  status public.report_status not null default 'open',
  resolved_by uuid references auth.users (id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Emails are queued here (in the same transaction as the event that causes
-- them) and sent by the /api/cron/email-outbox route.
create table public.email_outbox (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  to_email text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.rate_limit_hits (
  key text not null,
  hit_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'seller_profiles', 'brands', 'categories', 'products',
    'collections', 'submissions', 'articles', 'reports'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index products_published_idx on public.products (published_at desc) where status = 'published';
create index products_popularity_idx on public.products (popularity_score desc) where status = 'published';
create index products_status_idx on public.products (status);
create index products_brand_idx on public.products (brand_id);
create index products_seller_idx on public.products (seller_id);
create index products_search_idx on public.products using gin (search_vector);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_external_url_idx on public.products (lower(external_url));
create index brands_name_trgm_idx on public.brands using gin (name extensions.gin_trgm_ops);
create index brands_owner_idx on public.brands (owner_id);
create index categories_parent_idx on public.categories (parent_id);
create index product_categories_category_idx on public.product_categories (category_id);
create index product_tags_tag_idx on public.product_tags (tag_id);
create index product_images_product_idx on public.product_images (product_id, position);
create index product_videos_product_idx on public.product_videos (product_id, position);
create index product_specs_product_idx on public.product_specifications (product_id, position);
create index deals_product_idx on public.deals (product_id, starts_at, ends_at);
create index featured_products_placement_idx on public.featured_products (placement, position);
create index product_views_dedupe_idx on public.product_views (product_id, created_at desc);
create index product_saves_product_idx on public.product_saves (product_id);
create index brand_followers_brand_idx on public.brand_followers (brand_id);
create index category_followers_category_idx on public.category_followers (category_id);
create index collections_owner_idx on public.collections (owner_id);
create index collections_public_idx on public.collections (updated_at desc) where visibility = 'public';
create index collection_products_product_idx on public.collection_products (product_id);
create index collection_products_order_idx on public.collection_products (collection_id, position);
create index reminders_due_idx on public.reminders (status, type, remind_at);
create index reminders_product_idx on public.reminders (product_id) where status = 'pending';
create index submissions_status_idx on public.submissions (status, last_action_at desc);
create index submissions_seller_idx on public.submissions (seller_id);
create index submission_reviews_submission_idx on public.submission_reviews (submission_id, created_at);
create index submission_messages_submission_idx on public.submission_messages (submission_id, created_at);
create index articles_published_idx on public.articles (published_at desc) where status = 'published';
create index article_products_product_idx on public.article_products (product_id);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index analytics_type_time_idx on public.analytics_events (event_type, created_at desc);
create index analytics_product_time_idx on public.analytics_events (product_id, created_at desc) where product_id is not null;
create index reports_status_idx on public.reports (status, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_time_idx on public.audit_logs (created_at desc);
create index email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';
create index rate_limit_hits_idx on public.rate_limit_hits (key, hit_at desc);
create index homepage_sections_position_idx on public.homepage_sections (position);
