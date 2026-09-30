-- Allow product URLs with a query string or fragment right after the host
-- (e.g. https://shop.example.com?item=5), matching the app's URL validation.

alter table public.products drop constraint if exists products_external_url_check;
alter table public.products add constraint products_external_url_check
  check (external_url is null or external_url ~* '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?([/?#][^\s]*)?$');

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

  if _url is null or _url !~* '^https://[a-z0-9.-]+\.[a-z]{2,}(:[0-9]+)?([/?#][^\s]*)?$' then
    return null;
  end if;

  if anon_id is not null and anon_id !~ '^[A-Za-z0-9-]{8,64}$' then
    anon_id := null;
  end if;
  _who := coalesce(_uid::text, anon_id, 'anonymous');

  if public.rate_limit_hit('click:' || _who || ':' || product_id, 5, 600) then
    update public.products p set click_count = p.click_count + 1 where p.id = record_outbound_click.product_id;
    insert into public.analytics_events (event_type, user_id, anon_id, product_id)
    values ('buy_click', _uid, case when _uid is null then anon_id end, product_id);
  end if;

  return _url;
end;
$$;
