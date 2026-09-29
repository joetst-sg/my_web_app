-- Extensions and enum types used across the schema.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_cron;

-- Roles a user can hold. Every signed-up user gets 'user'; creating a seller
-- profile grants 'seller'; 'editor' and 'admin' are granted by an admin.
create type public.app_role as enum ('user', 'seller', 'editor', 'admin');

-- Public lifecycle of a product. Availability (coming soon, sold out, ...)
-- is a separate column so a published product can also be sold out.
create type public.product_status as enum (
  'draft', 'pending_review', 'changes_requested', 'approved',
  'scheduled', 'published', 'rejected', 'archived'
);

create type public.product_availability as enum (
  'available', 'coming_soon', 'preorder', 'crowdfunding', 'sold_out', 'discontinued'
);

-- Editorial workflow state of a submission (one submission per product).
create type public.submission_status as enum (
  'draft', 'submitted', 'under_review', 'changes_requested', 'approved',
  'scheduled', 'published', 'rejected', 'archived'
);

create type public.review_action as enum (
  'submit', 'withdraw', 'start_review', 'request_changes', 'approve',
  'reject', 'schedule', 'publish', 'archive'
);

create type public.visibility as enum ('public', 'private');

create type public.reminder_type as enum ('launch', 'sale', 'custom');
create type public.reminder_status as enum ('pending', 'sent', 'cancelled');

create type public.article_type as enum (
  'review', 'hands_on', 'buying_guide', 'news', 'roundup', 'how_to', 'interview'
);
create type public.article_status as enum ('draft', 'review', 'scheduled', 'published', 'archived');

create type public.notification_type as enum (
  'product_approved', 'product_rejected', 'changes_requested', 'product_published',
  'product_price_changed', 'product_sale', 'reminder', 'new_follower',
  'collection_activity', 'submission_received', 'system'
);

create type public.feature_placement as enum (
  'hero', 'featured_today', 'featured_this_week', 'trending', 'editors_pick',
  'new', 'coming_soon', 'deal'
);

create type public.report_reason as enum (
  'broken_link', 'incorrect_information', 'offensive_content',
  'misleading_information', 'copyright_concern', 'scam_suspicious', 'other'
);
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create type public.homepage_section_type as enum (
  'hero', 'trending_products', 'featured_categories', 'new_products',
  'featured_collections', 'magazine', 'product_list', 'deals', 'editors_picks'
);
