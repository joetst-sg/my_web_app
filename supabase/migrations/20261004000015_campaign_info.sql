-- Public, read-only campaign facts for the product page of an imported
-- product. Only published products, and only these fields: the rest of
-- product_source_metadata stays staff-only.
create or replace function public.campaign_info(p_product_id uuid)
returns table (
  source text,
  source_url text,
  source_status text,
  currency text,
  goal_amount numeric,
  raised_amount numeric,
  backer_count integer,
  days_remaining integer,
  campaign_ends_at timestamptz,
  campaign_ends_at_estimated boolean,
  last_synced_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.source, m.source_url, m.source_status, m.currency, m.goal_amount, m.raised_amount, m.backer_count,
         m.days_remaining, m.campaign_ends_at, m.campaign_ends_at_estimated, m.last_synced_at
  from public.product_source_metadata m
  join public.products p on p.id = m.product_id
  where m.product_id = p_product_id
    and (p.status = 'published' or public.is_staff());
$$;
revoke all on function public.campaign_info(uuid) from public;
grant execute on function public.campaign_info(uuid) to anon, authenticated;
