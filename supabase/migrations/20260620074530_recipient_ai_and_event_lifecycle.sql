-- Recipient-scoped AI usage, synchronized age data, and persistent occasion lifecycle.

alter table public.recipients
  add column if not exists birth_year integer;

alter table public.events
  add column if not exists checklist_completed text[] not null default '{}',
  add column if not exists journey_completed text[] not null default '{}',
  add column if not exists given_at timestamptz,
  add column if not exists background_until date,
  add column if not exists source_event_id uuid references public.events(id) on delete set null;

create unique index if not exists events_source_event_id_unique
  on public.events(source_event_id)
  where source_event_id is not null;

alter table public.gift_history
  add column if not exists recipient_id uuid references public.recipients(id) on delete set null,
  add column if not exists next_time_notes text,
  add column if not exists next_event_id uuid references public.events(id) on delete set null;

create unique index if not exists gift_history_event_id_unique
  on public.gift_history(event_id)
  where event_id is not null;

-- Existing ages with a complete birthday can be converted without guessing.
update public.recipients
set birth_year = extract(year from current_date)::integer
  - age
  - case
      when (birthday_month, birthday_day) >
        (extract(month from current_date)::integer, extract(day from current_date)::integer)
        then 1
      else 0
    end
where birth_year is null
  and age between 0 and 130
  and birthday_month between 1 and 12
  and birthday_day between 1 and 31;

create table if not exists public.recipient_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references public.recipients(id) on delete cascade,
  usage_month text not null check (usage_month ~ '^[0-9]{4}-[0-9]{2}$'),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, recipient_id, usage_month)
);

alter table public.recipient_ai_usage enable row level security;
revoke all on public.recipient_ai_usage from public, anon, authenticated;
grant select, insert, update, delete on public.recipient_ai_usage to service_role;

-- History is readable by its owner but can only be created by the completion RPC.
drop policy if exists "Users manage their own gift history" on public.gift_history;
drop policy if exists "Users read their own gift history" on public.gift_history;
create policy "Users read their own gift history" on public.gift_history
  for select to authenticated
  using (created_by = (select auth.jwt() ->> 'email'));

-- Best-effort archive of existing completed occasions. This never creates future events.
insert into public.gift_history (
  event_id, recipient_id, recipient_name, occasion, event_date, year, budget,
  notes, reflection, giver_name, love_language, total_spent, gifts_given, created_by
)
select
  e.id,
  e.recipient_id,
  e.recipient_name,
  e.occasion,
  e.event_date,
  extract(year from e.event_date)::integer,
  coalesce(e.budget, 0),
  e.notes,
  e.reflection,
  e.giver_name,
  e.love_language,
  coalesce(g.total_spent, 0),
  coalesce(g.gifts_given, '[]'::jsonb),
  e.created_by
from public.events e
left join lateral (
  select
    sum(coalesce(gift.price, 0)) as total_spent,
    jsonb_agg(jsonb_build_object(
      'name', gift.name,
      'price', coalesce(gift.price, 0),
      'description', coalesce(gift.description, ''),
      'given', coalesce(gift.given, false) or coalesce(gift.sent, false) or coalesce(gift.bought, false)
    ) order by gift.created_at) filter (where gift.id is not null) as gifts_given
  from public.gifts gift
  where gift.event_id = e.id
) g on true
where e.completed = true
  and not exists (select 1 from public.gift_history h where h.event_id = e.id)
on conflict (event_id) where event_id is not null do nothing;

drop function if exists public.consume_ai_quota(text);
drop function if exists public.refund_ai_quota(text);

create or replace function public.get_ai_allowance(
  p_user_id uuid,
  p_user_email text,
  p_recipient_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile public.user_profiles%rowtype;
  current_month text;
  used integer := 0;
  quota integer;
  quota_scope text;
begin
  if not exists (
    select 1 from public.recipients r
    where r.id = p_recipient_id and lower(r.created_by) = lower(p_user_email)
  ) then
    raise exception 'recipient not found or access denied' using errcode = '42501';
  end if;

  select * into profile
  from public.user_profiles
  where lower(created_by) = lower(p_user_email) or lower(email) = lower(p_user_email)
  order by created_at
  limit 1;

  if profile.id is null then
    raise exception 'user profile is required before using AI' using errcode = 'P0002';
  end if;

  current_month := to_char(timezone(coalesce(nullif(profile.timezone, ''), 'UTC'), clock_timestamp()), 'YYYY-MM');

  if coalesce(profile.is_premium, false) then
    quota := 30;
    quota_scope := 'account';
    used := case
      when profile.monthly_ai_reset_month = current_month then coalesce(profile.monthly_ai_uses, 0)
      else 0
    end;
  else
    quota := 3;
    quota_scope := 'recipient';
    select coalesce(u.uses, 0) into used
    from public.recipient_ai_usage u
    where u.user_id = p_user_id
      and u.recipient_id = p_recipient_id
      and u.usage_month = current_month;
    used := coalesce(used, 0);
  end if;

  return jsonb_build_object(
    'scope', quota_scope,
    'month', current_month,
    'used', used,
    'limit', quota,
    'remaining', greatest(quota - used, 0)
  );
end;
$$;

create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_user_email text,
  p_recipient_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile public.user_profiles%rowtype;
  current_month text;
  used integer;
  quota integer;
  quota_scope text;
begin
  if not exists (
    select 1 from public.recipients r
    where r.id = p_recipient_id and lower(r.created_by) = lower(p_user_email)
  ) then
    raise exception 'recipient not found or access denied' using errcode = '42501';
  end if;

  select * into profile
  from public.user_profiles
  where lower(created_by) = lower(p_user_email) or lower(email) = lower(p_user_email)
  order by created_at
  limit 1
  for update;

  if profile.id is null then
    raise exception 'user profile is required before using AI' using errcode = 'P0002';
  end if;

  current_month := to_char(timezone(coalesce(nullif(profile.timezone, ''), 'UTC'), clock_timestamp()), 'YYYY-MM');

  if coalesce(profile.is_premium, false) then
    quota := 30;
    quota_scope := 'account';
    used := case
      when profile.monthly_ai_reset_month = current_month then coalesce(profile.monthly_ai_uses, 0)
      else 0
    end;
    if used >= quota then
      raise exception 'monthly AI quota exceeded' using errcode = 'P0001';
    end if;
    used := used + 1;
    update public.user_profiles
    set monthly_ai_uses = used,
        monthly_ai_reset_month = current_month,
        updated_at = clock_timestamp()
    where id = profile.id;
  else
    quota := 3;
    quota_scope := 'recipient';
    insert into public.recipient_ai_usage as usage (
      user_id, recipient_id, usage_month, uses
    ) values (
      p_user_id, p_recipient_id, current_month, 1
    )
    on conflict (user_id, recipient_id, usage_month) do update
      set uses = usage.uses + 1,
          updated_at = clock_timestamp()
      where usage.uses < quota
    returning uses into used;

    if used is null then
      raise exception 'monthly AI quota exceeded for this recipient' using errcode = 'P0001';
    end if;
  end if;

  return jsonb_build_object(
    'scope', quota_scope,
    'month', current_month,
    'used', used,
    'limit', quota,
    'remaining', quota - used
  );
end;
$$;

create or replace function public.refund_ai_quota(
  p_user_id uuid,
  p_user_email text,
  p_recipient_id uuid,
  p_scope text,
  p_month text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_scope = 'account' then
    update public.user_profiles
    set monthly_ai_uses = greatest(coalesce(monthly_ai_uses, 0) - 1, 0),
        updated_at = clock_timestamp()
    where (lower(created_by) = lower(p_user_email) or lower(email) = lower(p_user_email))
      and monthly_ai_reset_month = p_month;
  elsif p_scope = 'recipient' then
    update public.recipient_ai_usage
    set uses = greatest(uses - 1, 0),
        updated_at = clock_timestamp()
    where user_id = p_user_id
      and recipient_id = p_recipient_id
      and usage_month = p_month;
  end if;
end;
$$;

create or replace function public.complete_event_and_prepare_next(
  p_user_email text,
  p_event_id uuid,
  p_next_time_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_event public.events%rowtype;
  history_id uuid;
  next_id uuid;
  next_date date;
  next_notes text;
  gift_ideas text;
  gift_snapshot jsonb := '[]'::jsonb;
  total_spent numeric := 0;
  repeatable boolean;
begin
  select * into source_event
  from public.events
  where id = p_event_id and lower(created_by) = lower(p_user_email)
  for update;

  if source_event.id is null then
    raise exception 'event not found or access denied' using errcode = '42501';
  end if;

  select h.id, h.next_event_id into history_id, next_id
  from public.gift_history h
  where h.event_id = source_event.id;

  if history_id is not null then
    return jsonb_build_object('event_id', source_event.id, 'history_id', history_id, 'next_event_id', next_id, 'already_completed', true);
  end if;

  update public.gifts
  set given = true, sent = true
  where event_id = source_event.id;

  select
    coalesce(sum(coalesce(g.price, 0)), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'name', g.name,
      'price', coalesce(g.price, 0),
      'description', coalesce(g.description, ''),
      'given', true
    ) order by g.created_at) filter (where g.id is not null), '[]'::jsonb),
    string_agg('• ' || g.name || case when nullif(trim(coalesce(g.description, '')), '') is not null then ' — ' || trim(g.description) else '' end, E'\n' order by g.created_at)
  into total_spent, gift_snapshot, gift_ideas
  from public.gifts g
  where g.event_id = source_event.id;

  repeatable := coalesce(source_event.recurring, false)
    or source_event.occasion in ('birthday', 'anniversary', 'holiday');

  if repeatable and source_event.event_date is not null then
    next_date := (source_event.event_date + interval '1 year')::date;
    next_notes := concat_ws(E'\n\n',
      nullif(trim(coalesce(source_event.notes, '')), ''),
      case when gift_ideas is not null then 'Ideas from ' || extract(year from source_event.event_date)::integer || E':\n' || gift_ideas end,
      case when nullif(trim(coalesce(p_next_time_notes, '')), '') is not null then 'Notes for next time:' || E'\n' || trim(p_next_time_notes) end
    );

    insert into public.events (
      recipient_name, recipient_id, occasion, event_date, year, budget, priority,
      recurring, notes, reflection, giver_name, love_language, age_or_years,
      style_preferences, gift_likes, gift_avoidances, wishlist_notes,
      buy_online_by, buy_local_by, wrap_by, reminders_sent,
      collaborator_emails, invite_token, created_by, completed,
      checklist_completed, journey_completed, given_at, background_until, source_event_id
    ) values (
      source_event.recipient_name, source_event.recipient_id, source_event.occasion,
      next_date, extract(year from next_date)::integer, source_event.budget, 'low',
      true, next_notes, null, source_event.giver_name, source_event.love_language,
      case when source_event.occasion = 'birthday' and source_event.age_or_years is not null then source_event.age_or_years + 1 else source_event.age_or_years end,
      source_event.style_preferences, source_event.gift_likes,
      source_event.gift_avoidances, source_event.wishlist_notes,
      next_date - 30, next_date - 14, next_date - 3, '[]'::jsonb,
      '{}', null, source_event.created_by, false,
      '{}', '{}', null, next_date - 60, source_event.id
    )
    on conflict (source_event_id) where source_event_id is not null do nothing
    returning id into next_id;

    if next_id is null then
      select id into next_id from public.events where source_event_id = source_event.id;
    end if;
  end if;

  insert into public.gift_history (
    event_id, recipient_id, recipient_name, occasion, event_date, year, budget,
    notes, reflection, giver_name, love_language, total_spent, gifts_given,
    next_time_notes, next_event_id, created_by
  ) values (
    source_event.id, source_event.recipient_id, source_event.recipient_name,
    source_event.occasion, source_event.event_date,
    extract(year from source_event.event_date)::integer, coalesce(source_event.budget, 0),
    source_event.notes, source_event.reflection, source_event.giver_name,
    source_event.love_language, total_spent, gift_snapshot,
    nullif(trim(coalesce(p_next_time_notes, '')), ''), next_id, source_event.created_by
  )
  returning id into history_id;

  update public.events
  set completed = true,
      given_at = coalesce(given_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where id = source_event.id;

  return jsonb_build_object('event_id', source_event.id, 'history_id', history_id, 'next_event_id', next_id, 'already_completed', false);
end;
$$;

revoke all on function public.get_ai_allowance(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.consume_ai_quota(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.complete_event_and_prepare_next(text, uuid, text) from public, anon, authenticated;
grant execute on function public.get_ai_allowance(uuid, text, uuid) to service_role;
grant execute on function public.consume_ai_quota(uuid, text, uuid) to service_role;
grant execute on function public.refund_ai_quota(uuid, text, uuid, text, text) to service_role;
grant execute on function public.complete_event_and_prepare_next(text, uuid, text) to service_role;
