-- Campaign images that can't be imported (too large, not an image…). They are
-- remembered so re-syncs don't retry them or report them as new every time.
alter table public.product_source_metadata
  add column if not exists skipped_image_urls text[] not null default '{}';
