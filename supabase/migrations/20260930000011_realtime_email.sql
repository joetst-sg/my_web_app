-- Near-real-time email: when emails are queued, call the app's email sender
-- (/api/cron/email-outbox) via pg_net right after the transaction commits.
-- A pg_cron job every 5 minutes retries anything still pending.
--
-- Configuration lives outside this file (never commit secrets):
--   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'email_sender_secret');
--   insert into public.site_settings (key, value)
--     values ('email.sender_url', '"https://your-domain/api/cron/email-outbox"');
-- If either is missing, nothing is called and the daily Vercel cron still works.

create extension if not exists pg_net;

create or replace function public.kick_email_sender()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  _url text;
  _secret text;
begin
  select value #>> '{}' into _url from public.site_settings where key = 'email.sender_url';
  select decrypted_secret into _secret from vault.decrypted_secrets where name = 'email_sender_secret' limit 1;
  if _url is null or _url !~ '^https://' or _secret is null then
    return;
  end if;
  -- pg_net queues the request; it is sent after this transaction commits.
  perform net.http_get(
    url := _url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || _secret),
    timeout_milliseconds := 20000
  );
end;
$$;

-- Only real recipients trigger a send (demo/reserved addresses are skipped
-- by the sender anyway).
create or replace function public.handle_email_queued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from new_rows
    where status = 'pending'
      and to_email !~* '@((.+\.)?(example|test|invalid|localhost)|loupe\.example)$'
  ) then
    perform public.kick_email_sender();
  end if;
  return null;
end;
$$;

drop trigger if exists on_email_queued on public.email_outbox;
create trigger on_email_queued
  after insert on public.email_outbox
  referencing new table as new_rows
  for each statement execute function public.handle_email_queued();

-- Retry sweep: every 5 minutes, only when something real is waiting.
create or replace function public.retry_pending_emails()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.email_outbox
    where status = 'pending'
      and to_email !~* '@((.+\.)?(example|test|invalid|localhost)|loupe\.example)$'
  ) then
    perform public.kick_email_sender();
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'loupe-email-retry') then
    perform cron.unschedule('loupe-email-retry');
  end if;
end;
$$;
select cron.schedule('loupe-email-retry', '*/5 * * * *', $$select public.retry_pending_emails()$$);

revoke execute on function
  public.kick_email_sender(),
  public.handle_email_queued(),
  public.retry_pending_emails()
from public, anon, authenticated;
