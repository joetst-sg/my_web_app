-- Japanese summary of each imported campaign. Only the title, short
-- description and this summary are sent for translation (not the full
-- campaign page), which keeps machine-translation usage small. Support plans,
-- rewards and prices are never included.
alter table public.product_source_metadata
  add column if not exists ja_summary text check (ja_summary is null or char_length(ja_summary) <= 5000),
  -- True once an administrator has edited the summary: re-syncs then keep it.
  add column if not exists ja_summary_edited boolean not null default false;
