-- Submission workflow. The only way to change a product's status.
--
--   draft ──submit──▶ submitted ──start_review──▶ under_review
--     ▲                  │  │                        │
--     └──withdraw────────┘  ├── request_changes ◀────┤──▶ changes_requested ──submit──▶ submitted
--                           ├── reject ◀─────────────┤──▶ rejected
--                           └── approve ◀────────────┘──▶ approved ──schedule──▶ scheduled
--                                                            │                      │
--                                                            └──publish──▶ published ◀── (cron at scheduled_for)
--                                                                            │
--                                                                            └──archive──▶ archived

create or replace function public.product_status_for(_s public.submission_status)
returns public.product_status
language sql
immutable
set search_path = ''
as $$
  select case _s
    when 'draft' then 'draft'
    when 'submitted' then 'pending_review'
    when 'under_review' then 'pending_review'
    when 'changes_requested' then 'changes_requested'
    when 'approved' then 'approved'
    when 'scheduled' then 'scheduled'
    when 'published' then 'published'
    when 'rejected' then 'rejected'
    when 'archived' then 'archived'
  end::public.product_status;
$$;

-- Allowed transitions: (action, from) -> to
create or replace function public.next_submission_status(_action public.review_action, _from public.submission_status)
returns public.submission_status
language sql
immutable
set search_path = ''
as $$
  select case
    when _action = 'submit' and _from in ('draft', 'changes_requested') then 'submitted'
    when _action = 'withdraw' and _from = 'submitted' then 'draft'
    when _action = 'start_review' and _from = 'submitted' then 'under_review'
    when _action = 'request_changes' and _from in ('submitted', 'under_review', 'approved', 'scheduled') then 'changes_requested'
    when _action = 'reject' and _from in ('submitted', 'under_review', 'changes_requested', 'approved', 'scheduled') then 'rejected'
    when _action = 'approve' and _from in ('submitted', 'under_review') then 'approved'
    when _action = 'schedule' and _from in ('approved', 'scheduled') then 'scheduled'
    when _action = 'publish' and _from in ('submitted', 'under_review', 'approved', 'scheduled') then 'published'
    when _action = 'archive' and _from = 'published' then 'archived'
    else null
  end::public.submission_status;
$$;

-- Lists what a product still needs before it can be submitted.
create or replace function public.submission_missing_fields(_product_id uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when coalesce(char_length(p.tagline), 0) < 10 then 'a short description (at least 10 characters)' end,
    case when coalesce(char_length(p.description), 0) < 80 then 'a full description (at least 80 characters)' end,
    case when p.external_url is null then 'a product URL (https://…)' end,
    case when p.brand_id is null then 'a brand' end,
    case when p.price is null then 'a price' end,
    case when not exists (select 1 from public.product_categories pc where pc.product_id = p.id) then 'a category' end,
    case when not exists (select 1 from public.product_images pi where pi.product_id = p.id) then 'at least one image' end
  ], null)
  from public.products p
  where p.id = _product_id;
$$;

-- Applies a transition. Internal: callers must have checked permissions.
create or replace function public.apply_submission_transition(
  _submission_id uuid,
  _action public.review_action,
  _actor uuid,
  _message text default null,
  _scheduled_for timestamptz default null
)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  _s public.submissions;
  _p public.products;
  _from public.submission_status;
  _to public.submission_status;
  _link text;
begin
  select * into _s from public.submissions where id = _submission_id for update;
  if not found then
    raise exception 'LOUPE:NOT_FOUND' using detail = 'This submission no longer exists.';
  end if;

  _from := _s.status;
  _to := public.next_submission_status(_action, _from);
  if _to is null then
    raise exception 'LOUPE:INVALID_TRANSITION'
      using detail = format('A submission that is %s cannot be %s.', replace(_s.status::text, '_', ' '),
        case _action
          when 'submit' then 'submitted' when 'withdraw' then 'withdrawn' when 'start_review' then 'moved into review'
          when 'request_changes' then 'sent back for changes' when 'reject' then 'rejected' when 'approve' then 'approved'
          when 'schedule' then 'scheduled' when 'publish' then 'published' when 'archive' then 'archived'
        end);
  end if;

  if _action = 'schedule' and (_scheduled_for is null or _scheduled_for <= now()) then
    raise exception 'LOUPE:INVALID_INPUT' using detail = 'Choose a publish time in the future.';
  end if;

  select * into _p from public.products where id = _s.product_id;

  update public.submissions set
    status = _to,
    reviewer_id = case when _action in ('start_review', 'request_changes', 'reject', 'approve', 'schedule', 'publish') then coalesce(_actor, reviewer_id) else reviewer_id end,
    submitted_at = case when _action = 'submit' then now() else submitted_at end,
    scheduled_for = case when _to = 'scheduled' then _scheduled_for when _to = 'published' then scheduled_for else null end,
    last_action_at = now()
  where id = _s.id
  returning * into _s;

  update public.products set
    status = public.product_status_for(_to),
    scheduled_for = case when _to = 'scheduled' then _scheduled_for else null end,
    published_at = case when _to = 'published' then coalesce(published_at, now()) else published_at end
  where id = _s.product_id;

  if _to = 'published' and _p.brand_id is not null then
    update public.brands set is_published = true where id = _p.brand_id and not is_published;
  end if;

  insert into public.submission_reviews (submission_id, actor_id, action, from_status, to_status, message)
  values (_s.id, _actor, _action, _from, _to, nullif(trim(_message), ''));

  if _message is not null and trim(_message) <> '' and _action in ('request_changes', 'reject') then
    insert into public.submission_messages (submission_id, author_id, body) values (_s.id, _actor, trim(_message));
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (_actor, 'submission.' || _action, 'submission', _s.id::text,
    jsonb_build_object('product_id', _s.product_id, 'product_name', _p.name, 'to', _to, 'message', _message, 'scheduled_for', _scheduled_for));

  _link := '/seller/submissions/' || _s.id;

  case _action
    when 'submit' then
      insert into public.analytics_events (event_type, user_id, product_id) values ('submission_submitted', _actor, _s.product_id);
      perform public.enqueue_email(_s.seller_id, 'submission_received', jsonb_build_object('product_name', _p.name, 'link', _link));
      perform public.create_notification(ur.user_id, 'submission_received', 'New product submission',
        '"' || _p.name || '" is waiting for review.', '/admin/submissions/' || _s.id)
      from public.user_roles ur where ur.role = 'editor';
    when 'request_changes' then
      perform public.create_notification(_s.seller_id, 'changes_requested', 'Changes requested',
        'An editor asked for changes to "' || _p.name || '".', _link, jsonb_build_object('message', _message));
      perform public.enqueue_email(_s.seller_id, 'changes_requested', jsonb_build_object('product_name', _p.name, 'message', _message, 'link', _link));
    when 'reject' then
      insert into public.analytics_events (event_type, user_id, product_id) values ('submission_rejected', _actor, _s.product_id);
      perform public.create_notification(_s.seller_id, 'product_rejected', 'Submission not accepted',
        '"' || _p.name || '" was not accepted.', _link, jsonb_build_object('message', _message));
      perform public.enqueue_email(_s.seller_id, 'product_rejected', jsonb_build_object('product_name', _p.name, 'message', _message, 'link', _link));
    when 'approve' then
      insert into public.analytics_events (event_type, user_id, product_id) values ('submission_approved', _actor, _s.product_id);
      perform public.create_notification(_s.seller_id, 'product_approved', 'Product approved',
        '"' || _p.name || '" was approved and will be published soon.', _link);
      perform public.enqueue_email(_s.seller_id, 'product_approved', jsonb_build_object('product_name', _p.name, 'link', _link));
    when 'schedule' then
      perform public.create_notification(_s.seller_id, 'product_approved', 'Publication scheduled',
        '"' || _p.name || '" will go live on ' || to_char(_scheduled_for at time zone 'UTC', 'DD Mon YYYY HH24:MI') || ' UTC.', _link);
    when 'publish' then
      insert into public.analytics_events (event_type, user_id, product_id) values ('submission_published', _actor, _s.product_id);
      perform public.create_notification(_s.seller_id, 'product_published', 'Your product is live',
        '"' || _p.name || '" is now published.', '/products/' || _p.slug);
      perform public.enqueue_email(_s.seller_id, 'product_published', jsonb_build_object('product_name', _p.name, 'link', '/products/' || _p.slug));
    else
      null;
  end case;

  return _s;
end;
$$;

-- Public entry point. Sellers can submit and withdraw their own
-- submissions; everything else needs an editor or admin.
create or replace function public.transition_submission(
  submission_id uuid,
  action public.review_action,
  message text default null,
  scheduled_for timestamptz default null
)
returns public.submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  _uid uuid := (select auth.uid());
  _s public.submissions;
  _missing text[];
  _is_staff boolean := public.is_staff();
begin
  if _uid is null then
    raise exception 'LOUPE:UNAUTHENTICATED' using detail = 'Please log in to continue.';
  end if;
  if not public.is_active_user() then
    raise exception 'LOUPE:FORBIDDEN' using detail = 'Your account is suspended.';
  end if;

  select * into _s from public.submissions s where s.id = transition_submission.submission_id;
  if not found or not (_s.seller_id = _uid or _is_staff) then
    raise exception 'LOUPE:NOT_FOUND' using detail = 'This submission does not exist or you cannot access it.';
  end if;

  if action in ('submit', 'withdraw') then
    if _s.seller_id <> _uid and not _is_staff then
      raise exception 'LOUPE:FORBIDDEN' using detail = 'You don''t have permission to perform this action.';
    end if;
  elsif not _is_staff then
    raise exception 'LOUPE:FORBIDDEN' using detail = 'You don''t have permission to perform this action.';
  end if;

  if action = 'submit' then
    _missing := public.submission_missing_fields(_s.product_id);
    if cardinality(_missing) > 0 then
      raise exception 'LOUPE:INCOMPLETE' using detail = 'Before submitting, add ' || array_to_string(_missing, ', ') || '.';
    end if;
    if not _is_staff then
      perform public.raise_if_rate_limited('submit:' || _uid, 10, 86400,
        'You can submit up to 10 products a day. Please try again tomorrow.');
    end if;
  end if;

  if action in ('request_changes', 'reject') and coalesce(char_length(trim(message)), 0) < 5 then
    raise exception 'LOUPE:INVALID_INPUT' using detail = 'Please include a message for the seller explaining why.';
  end if;

  return public.apply_submission_transition(_s.id, action, _uid, message, scheduled_for);
end;
$$;

-- Called every minute by pg_cron: publishes due products and articles.
create or replace function public.publish_due()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
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

  update public.articles
    set status = 'published', published_at = coalesce(published_at, now())
  where status = 'scheduled' and scheduled_for <= now();

  return _n;
end;
$$;

-- Called every minute by pg_cron: sends due reminders.
create or replace function public.process_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  _r record;
  _n integer := 0;
begin
  for _r in
    select r.id, r.user_id, r.type, p.name, p.slug
    from public.reminders r
    join public.products p on p.id = r.product_id
    left join lateral (
      select 1 as active from public.deals d
      where d.product_id = p.id and d.starts_at <= now() and (d.ends_at is null or d.ends_at > now())
      limit 1
    ) deal on true
    where r.status = 'pending' and (
      (r.type = 'custom' and r.remind_at <= now())
      or (r.type = 'launch' and p.status = 'published' and p.availability not in ('coming_soon', 'crowdfunding'))
      or (r.type = 'sale' and p.status = 'published' and (deal.active = 1 or p.discount_percent > 0))
    )
    limit 500
    for update of r skip locked
  loop
    perform public.create_notification(_r.user_id,
      case when _r.type = 'sale' then 'product_sale' else 'reminder' end::public.notification_type,
      case _r.type
        when 'launch' then '"' || _r.name || '" is available now'
        when 'sale' then '"' || _r.name || '" is on sale'
        else 'Reminder: ' || _r.name
      end,
      case _r.type
        when 'launch' then 'The product you were waiting for has launched.'
        when 'sale' then 'A product you set a sale reminder for has a lower price.'
        else 'You asked us to remind you about this product.'
      end,
      '/products/' || _r.slug);
    perform public.enqueue_email(_r.user_id, 'reminder',
      jsonb_build_object('product_name', _r.name, 'type', _r.type, 'link', '/products/' || _r.slug));
    update public.reminders set status = 'sent', sent_at = now() where id = _r.id;
    _n := _n + 1;
  end loop;
  return _n;
end;
$$;

-- Price drop on a published product: tell everyone who saved it.
create or replace function public.handle_price_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.price is not null and new.price is not null and new.price < old.price then
    perform public.create_notification(s.user_id, 'product_price_changed', 'Price drop: ' || new.name,
      'Now ' || new.currency || ' ' || new.price || ' (was ' || old.price || ').', '/products/' || new.slug)
    from public.product_saves s where s.product_id = new.id;
    perform public.enqueue_email(s.user_id, 'price_drop',
      jsonb_build_object('product_name', new.name, 'old_price', old.price, 'new_price', new.price, 'currency', new.currency, 'link', '/products/' || new.slug))
    from public.product_saves s where s.product_id = new.id;
  end if;
  if new.price is distinct from old.price or new.name is distinct from old.name then
    perform public.write_audit('product.updated', 'product', new.id::text,
      jsonb_build_object('name', new.name, 'old_price', old.price, 'new_price', new.price));
  end if;
  return new;
end;
$$;

create trigger on_product_price_change
  after update of price, name on public.products
  for each row execute function public.handle_price_change();

-- ---------------------------------------------------------------------------
-- Admin: roles and suspension
-- ---------------------------------------------------------------------------

create or replace function public.set_user_role(target_user uuid, role public.app_role, enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'LOUPE:FORBIDDEN' using detail = 'Only administrators can change roles.';
  end if;
  if target_user = (select auth.uid()) and role = 'admin' and not enabled then
    raise exception 'LOUPE:INVALID_INPUT' using detail = 'You cannot remove your own admin role.';
  end if;
  if role = 'user' and not enabled then
    raise exception 'LOUPE:INVALID_INPUT' using detail = 'Every account keeps the user role. Suspend the account instead.';
  end if;
  if enabled then
    insert into public.user_roles (user_id, role, granted_by) values (target_user, role, (select auth.uid()))
    on conflict do nothing;
  else
    delete from public.user_roles ur where ur.user_id = target_user and ur.role = set_user_role.role;
  end if;
  perform public.write_audit(case when enabled then 'role.granted' else 'role.revoked' end, 'user', target_user::text,
    jsonb_build_object('role', role));
end;
$$;

create or replace function public.set_user_suspended(target_user uuid, suspended boolean, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'LOUPE:FORBIDDEN' using detail = 'Only administrators can suspend accounts.';
  end if;
  if target_user = (select auth.uid()) then
    raise exception 'LOUPE:INVALID_INPUT' using detail = 'You cannot suspend your own account.';
  end if;
  update public.user_settings
    set suspended_at = case when suspended then now() else null end,
        suspended_reason = case when suspended then reason else null end
  where user_id = target_user;
  perform public.write_audit(case when suspended then 'user.suspended' else 'user.unsuspended' end, 'user', target_user::text,
    jsonb_build_object('reason', reason));
end;
$$;

-- Admin user list with emails (emails live in auth.users, which the API
-- cannot read directly).
create or replace function public.admin_list_users(search text default null, page_limit integer default 50, page_offset integer default 0)
returns table (
  id uuid, email text, username text, display_name text, avatar_url text, roles public.app_role[],
  suspended_at timestamptz, created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'LOUPE:FORBIDDEN' using detail = 'Only administrators can list users.';
  end if;
  return query
  select u.id, u.email::text, p.username::text, p.display_name, p.avatar_url,
    coalesce((select array_agg(ur.role order by ur.role) from public.user_roles ur where ur.user_id = u.id), '{}'),
    us.suspended_at, u.created_at, u.last_sign_in_at, u.email_confirmed_at,
    count(*) over ()
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_settings us on us.user_id = u.id
  where search is null or search = ''
     or u.email ilike '%' || search || '%'
     or p.username::text ilike '%' || search || '%'
     or p.display_name ilike '%' || search || '%'
  order by u.created_at desc
  limit least(page_limit, 200) offset greatest(page_offset, 0);
end;
$$;

-- Seller contact info for editors reviewing a submission.
create or replace function public.submission_seller_contact(_submission_id uuid)
returns table (email text, company_name text, website text, contact_email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'LOUPE:FORBIDDEN' using detail = 'Only editors can view seller contact details.';
  end if;
  return query
  select u.email::text, sp.company_name, sp.website, sp.contact_email
  from public.submissions s
  left join auth.users u on u.id = s.seller_id
  left join public.seller_profiles sp on sp.user_id = s.seller_id
  where s.id = _submission_id;
end;
$$;

revoke execute on function
  public.apply_submission_transition(uuid, public.review_action, uuid, text, timestamptz),
  public.publish_due(),
  public.process_due_reminders()
from public, anon, authenticated;

revoke execute on function
  public.transition_submission(uuid, public.review_action, text, timestamptz),
  public.set_user_role(uuid, public.app_role, boolean),
  public.set_user_suspended(uuid, boolean, text),
  public.admin_list_users(text, integer, integer),
  public.submission_seller_contact(uuid),
  public.submission_missing_fields(uuid)
from public, anon;
