-- Conversational capture, family plans, and Stripe pricing release.

create extension if not exists pgcrypto;

alter table public.user_profiles
  add column if not exists subscription_plan text default 'free' check (subscription_plan in ('free', 'individual', 'family')),
  add column if not exists billing_interval text check (billing_interval in ('monthly', 'annual')),
  add column if not exists subscription_status text,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists family_id uuid,
  add column if not exists capture_allowance_used integer not null default 0 check (capture_allowance_used >= 0),
  add column if not exists capture_allowance_reset_month text,
  add column if not exists lifetime_capture_uses integer not null default 0 check (lifetime_capture_uses >= 0),
  add column if not exists app_tour_status text default 'not_offered' check (app_tour_status in ('not_offered', 'offered', 'maybe_later', 'dismissed', 'completed')),
  add column if not exists first_capture_completed_at timestamptz;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_email text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  capture_allowance_reset_month text,
  capture_allowance_used integer not null default 0 check (capture_allowance_used >= 0),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  role text not null default 'adult' check (role in ('owner', 'adult')),
  invitation_state text not null default 'accepted' check (invitation_state in ('invited', 'accepted', 'removed')),
  invited_by text,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, email)
);

create table if not exists public.family_managed_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null,
  relationship text,
  birth_year integer,
  birthday_month integer,
  birthday_day integer,
  notes text,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.capture_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  family_id uuid references public.families(id) on delete set null,
  usage_scope text not null check (usage_scope in ('free_lifetime', 'individual_monthly', 'family_monthly')),
  usage_month text,
  idempotency_key text not null,
  status text not null default 'committed' check (status in ('committed', 'failed')),
  people_count integer not null default 0,
  occasion_count integer not null default 0,
  action_count integer not null default 0,
  audio_used boolean not null default false,
  model text,
  transcript_sha256 text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.plan_actions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  recipient_id uuid references public.recipients(id) on delete set null,
  title text not null,
  due_date date,
  completed boolean not null default false,
  source text not null default 'capture',
  created_by text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.stripe_processed_events (
  event_id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.events
  add column if not exists family_id uuid references public.families(id) on delete set null,
  add column if not exists visibility text not null default 'private' check (visibility in ('private', 'family')),
  add column if not exists capture_usage_id uuid references public.capture_usage(id) on delete set null;

alter table public.gifts
  add column if not exists visibility text not null default 'private' check (visibility in ('private', 'family')),
  add column if not exists hidden_from_emails text[] not null default '{}';

alter table public.saved_ideas
  add column if not exists recipient_id uuid references public.recipients(id) on delete set null,
  add column if not exists family_id uuid references public.families(id) on delete set null,
  add column if not exists source text not null default 'manual' check (source in ('manual', 'capture', 'ai_starter', 'ai_generation'));

create index if not exists idx_events_family_visible on public.events(family_id, visibility, event_date);
create index if not exists idx_plan_actions_created_by on public.plan_actions(created_by, completed, due_date);
create index if not exists idx_capture_usage_user_created on public.capture_usage(user_id, created_at);
create index if not exists idx_family_members_email on public.family_members(lower(email));

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_managed_profiles enable row level security;
alter table public.capture_usage enable row level security;
alter table public.plan_actions enable row level security;
alter table public.stripe_processed_events enable row level security;

grant select, insert, update, delete on public.families, public.family_members, public.family_managed_profiles, public.plan_actions to authenticated;
grant select on public.capture_usage to authenticated;
grant select, insert, update, delete on public.capture_usage, public.stripe_processed_events to service_role;

drop policy if exists "Family members can read families" on public.families;
create policy "Family members can read families" on public.families
  for select to authenticated
  using (exists (
    select 1 from public.family_members fm
    where fm.family_id = families.id
      and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
      and fm.invitation_state = 'accepted'
  ));

drop policy if exists "Owners create families" on public.families;
create policy "Owners create families" on public.families
  for insert to authenticated
  with check (lower(created_by) = lower((select auth.jwt() ->> 'email')) and lower(owner_email) = lower((select auth.jwt() ->> 'email')));

drop policy if exists "Owners update families" on public.families;
create policy "Owners update families" on public.families
  for update to authenticated
  using (lower(owner_email) = lower((select auth.jwt() ->> 'email')))
  with check (lower(owner_email) = lower((select auth.jwt() ->> 'email')));

drop policy if exists "Family members can read membership" on public.family_members;
create policy "Family members can read membership" on public.family_members
  for select to authenticated
  using (
    lower(email) = lower((select auth.jwt() ->> 'email'))
    or exists (
      select 1 from public.families f
      where f.id = family_members.family_id
        and lower(f.owner_email) = lower((select auth.jwt() ->> 'email'))
    )
  );

drop policy if exists "Family owners manage membership" on public.family_members;
create policy "Family owners manage membership" on public.family_members
  for all to authenticated
  using (exists (
    select 1 from public.families f
    where f.id = family_members.family_id
      and lower(f.owner_email) = lower((select auth.jwt() ->> 'email'))
  ))
  with check (exists (
    select 1 from public.families f
    where f.id = family_members.family_id
      and lower(f.owner_email) = lower((select auth.jwt() ->> 'email'))
  ));

drop policy if exists "Family members manage kid profiles" on public.family_managed_profiles;
create policy "Family members manage kid profiles" on public.family_managed_profiles
  for all to authenticated
  using (exists (
    select 1 from public.family_members fm
    where fm.family_id = family_managed_profiles.family_id
      and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
      and fm.invitation_state = 'accepted'
  ))
  with check (exists (
    select 1 from public.family_members fm
    where fm.family_id = family_managed_profiles.family_id
      and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
      and fm.invitation_state = 'accepted'
  ));

drop policy if exists "Users read their capture usage" on public.capture_usage;
create policy "Users read their capture usage" on public.capture_usage
  for select to authenticated
  using (lower(user_email) = lower((select auth.jwt() ->> 'email')));

drop policy if exists "Users manage their plan actions" on public.plan_actions;
create policy "Users manage their plan actions" on public.plan_actions
  for all to authenticated
  using (lower(created_by) = lower((select auth.jwt() ->> 'email')))
  with check (lower(created_by) = lower((select auth.jwt() ->> 'email')));

drop policy if exists "No direct Stripe event access" on public.stripe_processed_events;
create policy "No direct Stripe event access" on public.stripe_processed_events
  for all to authenticated
  using (false)
  with check (false);

drop policy if exists "Family members read family events" on public.events;
create policy "Family members read family events" on public.events
  for select to authenticated
  using (
    visibility = 'family'
    and family_id is not null
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = events.family_id
        and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
        and fm.invitation_state = 'accepted'
    )
  );

drop policy if exists "Family members update family events" on public.events;
create policy "Family members update family events" on public.events
  for update to authenticated
  using (
    visibility = 'family'
    and family_id is not null
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = events.family_id
        and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
        and fm.invitation_state = 'accepted'
    )
  )
  with check (
    visibility in ('private', 'family')
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = events.family_id
        and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
        and fm.invitation_state = 'accepted'
    )
  );

drop policy if exists "Family members read visible gifts" on public.gifts;
create policy "Family members read visible gifts" on public.gifts
  for select to authenticated
  using (
    not exists (
      select 1 from unnest(hidden_from_emails) as hidden(email)
      where lower(hidden.email) = lower((select auth.jwt() ->> 'email'))
    )
    and exists (
      select 1 from public.events e
      join public.family_members fm on fm.family_id = e.family_id
      where e.id = gifts.event_id
        and e.visibility = 'family'
        and fm.invitation_state = 'accepted'
        and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
    )
  );

drop policy if exists "Family members read family saved ideas" on public.saved_ideas;
create policy "Family members read family saved ideas" on public.saved_ideas
  for select to authenticated
  using (
    family_id is not null
    and exists (
      select 1 from public.family_members fm
      where fm.family_id = saved_ideas.family_id
        and lower(fm.email) = lower((select auth.jwt() ->> 'email'))
        and fm.invitation_state = 'accepted'
    )
  );

create or replace function public.protect_user_profile_server_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.created_by is distinct from old.created_by
    or new.email is distinct from old.email
    or new.is_premium is distinct from old.is_premium
    or new.premium_type is distinct from old.premium_type
    or new.premium_since is distinct from old.premium_since
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_plan is distinct from old.subscription_plan
    or new.billing_interval is distinct from old.billing_interval
    or new.subscription_status is distinct from old.subscription_status
    or new.subscription_current_period_end is distinct from old.subscription_current_period_end
    or new.family_id is distinct from old.family_id
    or new.capture_allowance_used is distinct from old.capture_allowance_used
    or new.capture_allowance_reset_month is distinct from old.capture_allowance_reset_month
    or new.lifetime_capture_uses is distinct from old.lifetime_capture_uses
    or new.first_capture_completed_at is distinct from old.first_capture_completed_at
    or new.ai_credits is distinct from old.ai_credits
    or new.monthly_ai_uses is distinct from old.monthly_ai_uses
    or new.monthly_ai_reset_month is distinct from old.monthly_ai_reset_month
  ) then
    raise exception 'server-owned profile fields cannot be changed by clients'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.get_capture_allowance(
  p_user_id uuid,
  p_user_email text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile public.user_profiles%rowtype;
  family public.families%rowtype;
  current_month text := to_char(timezone('UTC', clock_timestamp()), 'YYYY-MM');
  limit_count integer;
  used_count integer;
  scope_name text;
begin
  select * into profile
  from public.user_profiles
  where lower(created_by) = lower(p_user_email) or lower(email) = lower(p_user_email)
  order by created_at
  limit 1;

  if profile.id is null then
    return jsonb_build_object('scope', 'free_lifetime', 'limit', 3, 'used', 0, 'remaining', 3);
  end if;

  if profile.subscription_plan = 'family' and profile.family_id is not null then
    select * into family from public.families where id = profile.family_id limit 1;
    scope_name := 'family_monthly';
    limit_count := 60;
    used_count := case when family.capture_allowance_reset_month = current_month then coalesce(family.capture_allowance_used, 0) else 0 end;
  elsif profile.subscription_plan = 'individual' or coalesce(profile.is_premium, false) then
    scope_name := 'individual_monthly';
    limit_count := 30;
    used_count := case when profile.capture_allowance_reset_month = current_month then coalesce(profile.capture_allowance_used, 0) else 0 end;
  else
    scope_name := 'free_lifetime';
    limit_count := 3;
    used_count := coalesce(profile.lifetime_capture_uses, 0);
  end if;

  return jsonb_build_object(
    'scope', scope_name,
    'month', case when scope_name = 'free_lifetime' then null else current_month end,
    'limit', limit_count,
    'used', used_count,
    'remaining', greatest(limit_count - used_count, 0)
  );
end;
$$;

create or replace function public.commit_capture_plan(
  p_user_id uuid,
  p_user_email text,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile public.user_profiles%rowtype;
  family_id uuid;
  allowance jsonb;
  scope_name text;
  current_month text := to_char(timezone('UTC', clock_timestamp()), 'YYYY-MM');
  usage_id uuid;
  person jsonb;
  occasion jsonb;
  action_item jsonb;
  recipient_id uuid;
  event_id uuid;
  created_recipients uuid[] := '{}';
  created_events uuid[] := '{}';
  created_actions uuid[] := '{}';
  recipient_name text;
  occasion_date date;
  event_budget numeric;
  created_people_count integer := 0;
  created_occasion_count integer := 0;
  created_action_count integer := 0;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then
    raise exception 'idempotency key is required' using errcode = '22023';
  end if;

  select id into usage_id
  from public.capture_usage
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if usage_id is not null then
    return jsonb_build_object(
      'capture_usage_id', usage_id,
      'already_committed', true,
      'recipient_ids', created_recipients,
      'event_ids', created_events,
      'action_ids', created_actions
    );
  end if;

  select * into profile
  from public.user_profiles
  where lower(created_by) = lower(p_user_email) or lower(email) = lower(p_user_email)
  order by created_at
  limit 1
  for update;

  if profile.id is null then
    insert into public.user_profiles (created_by, email, full_name)
    values (p_user_email, p_user_email, '')
    returning * into profile;
  end if;

  allowance := public.get_capture_allowance(p_user_id, p_user_email);
  if coalesce((allowance ->> 'remaining')::integer, 0) <= 0 then
    raise exception 'capture allowance exceeded' using errcode = 'P0001';
  end if;

  scope_name := allowance ->> 'scope';
  family_id := case when scope_name = 'family_monthly' then profile.family_id else null end;

  if scope_name = 'family_monthly' and family_id is not null then
    update public.families
    set capture_allowance_used = case when capture_allowance_reset_month = current_month then capture_allowance_used + 1 else 1 end,
        capture_allowance_reset_month = current_month,
        updated_at = clock_timestamp()
    where id = family_id;
  elsif scope_name = 'individual_monthly' then
    update public.user_profiles
    set capture_allowance_used = case when capture_allowance_reset_month = current_month then capture_allowance_used + 1 else 1 end,
        capture_allowance_reset_month = current_month,
        updated_at = clock_timestamp()
    where id = profile.id;
  else
    update public.user_profiles
    set lifetime_capture_uses = lifetime_capture_uses + 1,
        updated_at = clock_timestamp()
    where id = profile.id;
  end if;

  insert into public.capture_usage (
    user_id, user_email, family_id, usage_scope, usage_month, idempotency_key,
    people_count, occasion_count, action_count, audio_used, model, transcript_sha256
  ) values (
    p_user_id,
    p_user_email,
    family_id,
    scope_name,
    case when scope_name = 'free_lifetime' then null else current_month end,
    p_idempotency_key,
    jsonb_array_length(coalesce(p_payload -> 'people', '[]'::jsonb)),
    jsonb_array_length(coalesce(p_payload -> 'occasions', '[]'::jsonb)),
    jsonb_array_length(coalesce(p_payload -> 'actions', '[]'::jsonb)),
    coalesce((p_payload ->> 'audio_used')::boolean, false),
    p_payload ->> 'model',
    p_payload ->> 'transcript_sha256'
  )
  returning id into usage_id;

  for person in select * from jsonb_array_elements(coalesce(p_payload -> 'people', '[]'::jsonb))
  loop
    recipient_name := nullif(trim(person ->> 'name'), '');
    if recipient_name is null then
      continue;
    end if;

    select r.id into recipient_id
    from public.recipients r
    where lower(r.created_by) = lower(p_user_email)
      and lower(trim(r.name)) = lower(recipient_name)
    order by r.created_at
    limit 1;

    if recipient_id is null then
      insert into public.recipients (
        name, relationship, age, birth_year, birthday_month, birthday_day,
        interests, notes, gift_likes, gift_avoidances, created_by
      ) values (
        recipient_name,
        nullif(person ->> 'relationship', ''),
        nullif(person ->> 'age', '')::integer,
        nullif(person ->> 'birth_year', '')::integer,
        nullif(person ->> 'birthday_month', '')::integer,
        nullif(person ->> 'birthday_day', '')::integer,
        coalesce(array(select jsonb_array_elements_text(person -> 'interests')), '{}'),
        nullif(person ->> 'notes', ''),
        nullif(person ->> 'gift_likes', ''),
        nullif(person ->> 'gift_avoidances', ''),
        p_user_email
      )
      returning id into recipient_id;
      created_people_count := created_people_count + 1;
    else
      update public.recipients
      set relationship = coalesce(nullif(person ->> 'relationship', ''), relationship),
          age = coalesce(nullif(person ->> 'age', '')::integer, age),
          birth_year = coalesce(nullif(person ->> 'birth_year', '')::integer, birth_year),
          birthday_month = coalesce(nullif(person ->> 'birthday_month', '')::integer, birthday_month),
          birthday_day = coalesce(nullif(person ->> 'birthday_day', '')::integer, birthday_day),
          interests = case
            when jsonb_typeof(person -> 'interests') = 'array' and jsonb_array_length(person -> 'interests') > 0
              then array(select jsonb_array_elements_text(person -> 'interests'))
            else interests
          end,
          gift_likes = coalesce(nullif(person ->> 'gift_likes', ''), gift_likes),
          gift_avoidances = coalesce(nullif(person ->> 'gift_avoidances', ''), gift_avoidances),
          notes = concat_ws(E'\n', nullif(notes, ''), nullif(person ->> 'notes', ''))
      where id = recipient_id;
    end if;

    created_recipients := array_append(created_recipients, recipient_id);
  end loop;

  for occasion in select * from jsonb_array_elements(coalesce(p_payload -> 'occasions', '[]'::jsonb))
  loop
    recipient_name := nullif(trim(occasion ->> 'recipient_name'), '');
    if recipient_name is null or nullif(occasion ->> 'event_date', '') is null then
      continue;
    end if;

    select r.id into recipient_id
    from public.recipients r
    where lower(r.created_by) = lower(p_user_email)
      and lower(trim(r.name)) = lower(recipient_name)
    order by r.created_at
    limit 1;

    if recipient_id is null then
      insert into public.recipients (name, created_by)
      values (recipient_name, p_user_email)
      returning id into recipient_id;
      created_recipients := array_append(created_recipients, recipient_id);
    end if;

    occasion_date := (occasion ->> 'event_date')::date;
    event_budget := nullif(occasion ->> 'budget', '')::numeric;

    insert into public.events (
      recipient_name, recipient_id, occasion, event_date, year, budget, priority,
      recurring, notes, age_or_years, created_by, family_id, visibility, capture_usage_id
    ) values (
      recipient_name,
      recipient_id,
      coalesce(nullif(occasion ->> 'occasion', ''), 'special_occasion'),
      occasion_date,
      extract(year from occasion_date)::integer,
      coalesce(event_budget, 0),
      coalesce(nullif(occasion ->> 'priority', ''), 'medium'),
      coalesce((occasion ->> 'recurring')::boolean, false),
      nullif(occasion ->> 'notes', ''),
      nullif(occasion ->> 'age_turning', '')::integer,
      p_user_email,
      family_id,
      coalesce(nullif(occasion ->> 'visibility', ''), 'private'),
      usage_id
    )
    returning id into event_id;

    created_events := array_append(created_events, event_id);
    created_occasion_count := created_occasion_count + 1;

    if nullif(occasion ->> 'starter_idea', '') is not null then
      insert into public.saved_ideas (
        name, description, recipient_name, recipient_id, event_id, family_id, source, created_by
      ) values (
        occasion ->> 'starter_idea',
        'Starter idea from your capture',
        recipient_name,
        recipient_id,
        event_id,
        family_id,
        'ai_starter',
        p_user_email
      );
    end if;
  end loop;

  if created_occasion_count = 0 then
    raise exception 'at least one complete occasion is required' using errcode = 'P0001';
  end if;

  for action_item in select * from jsonb_array_elements(coalesce(p_payload -> 'actions', '[]'::jsonb))
  loop
    if nullif(trim(action_item ->> 'title'), '') is null then
      continue;
    end if;

    insert into public.plan_actions (
      event_id, recipient_id, title, due_date, source, created_by
    ) values (
      nullif(action_item ->> 'event_id', '')::uuid,
      nullif(action_item ->> 'recipient_id', '')::uuid,
      trim(action_item ->> 'title'),
      nullif(action_item ->> 'due_date', '')::date,
      'capture',
      p_user_email
    )
    returning id into event_id;

    created_actions := array_append(created_actions, event_id);
    created_action_count := created_action_count + 1;
  end loop;

  update public.capture_usage
  set people_count = created_people_count,
      occasion_count = created_occasion_count,
      action_count = created_action_count
  where id = usage_id;

  update public.user_profiles
  set first_capture_completed_at = coalesce(first_capture_completed_at, clock_timestamp()),
      app_tour_status = case when app_tour_status = 'not_offered' then 'offered' else app_tour_status end,
      updated_at = clock_timestamp()
  where id = profile.id;

  return jsonb_build_object(
    'capture_usage_id', usage_id,
    'already_committed', false,
    'recipient_ids', created_recipients,
    'event_ids', created_events,
    'action_ids', created_actions,
    'allowance', public.get_capture_allowance(p_user_id, p_user_email)
  );
end;
$$;

revoke all on function public.get_capture_allowance(uuid, text) from public, anon, authenticated;
revoke all on function public.commit_capture_plan(uuid, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.get_capture_allowance(uuid, text) to service_role;
grant execute on function public.commit_capture_plan(uuid, text, jsonb, text) to service_role;
