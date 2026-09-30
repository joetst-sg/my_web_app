-- Honour the admin "Accept new product submissions" switch
-- (site_settings 'submissions.open'). Staff can always submit.

create or replace function public.submissions_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value from public.site_settings where key = 'submissions.open') <> 'false'::jsonb, true);
$$;

create or replace function public.enforce_submissions_open()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted'
     and not public.submissions_open()
     and not exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role in ('editor', 'admin')) then
    raise exception 'LOUPE:CLOSED' using detail = 'New submissions are paused right now. Your draft is saved — please try again later.';
  end if;
  return new;
end;
$$;

create trigger enforce_submissions_open
  before update of status on public.submissions
  for each row execute function public.enforce_submissions_open();

delete from public.site_settings where key = 'submissions.daily_limit';

revoke execute on function public.enforce_submissions_open() from public, anon, authenticated;
