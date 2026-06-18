-- Lock down server-owned profile fields, collaborator-only event updates,
-- and anonymous token-based sharing. Generic anonymous table access is denied;
-- public access is available only through narrow token-validated RPCs.

alter table public.user_profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

alter table public.shared_list_items
  add column if not exists claim_token_hash text;

drop policy if exists "Users manage their own profiles" on user_profiles;
drop policy if exists "Users read their own profiles" on user_profiles;
drop policy if exists "Users create their own profiles" on user_profiles;
drop policy if exists "Users update their own profiles" on user_profiles;
drop policy if exists "Users delete their own profiles" on user_profiles;

create policy "Users read their own profiles" on user_profiles
  for select to authenticated
  using (created_by = (select auth.jwt() ->> 'email') or email = (select auth.jwt() ->> 'email'));

create policy "Users create their own profiles" on user_profiles
  for insert to authenticated
  with check (
    created_by = (select auth.jwt() ->> 'email')
    and email = (select auth.jwt() ->> 'email')
    and coalesce(is_premium, false) = false
    and premium_type is null
    and premium_since is null
    and stripe_customer_id is null
    and stripe_subscription_id is null
    and coalesce(ai_credits, 0) = 0
    and coalesce(monthly_ai_uses, 0) = 0
    and monthly_ai_reset_month is null
  );

create policy "Users update their own profiles" on user_profiles
  for update to authenticated
  using (created_by = (select auth.jwt() ->> 'email') and email = (select auth.jwt() ->> 'email'))
  with check (created_by = (select auth.jwt() ->> 'email') and email = (select auth.jwt() ->> 'email'));

create policy "Users delete their own profiles" on user_profiles
  for delete to authenticated
  using (created_by = (select auth.jwt() ->> 'email') and email = (select auth.jwt() ->> 'email'));

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

drop trigger if exists protect_user_profile_server_fields on user_profiles;
create trigger protect_user_profile_server_fields
  before update on user_profiles
  for each row execute function public.protect_user_profile_server_fields();
drop policy if exists "Users manage their own and shared events" on events;
drop policy if exists "Owners manage their events" on events;
drop policy if exists "Collaborators read shared events" on events;
drop policy if exists "Collaborators update shared events" on events;

create policy "Owners manage their events" on events
  for all to authenticated
  using (created_by = (select auth.jwt() ->> 'email'))
  with check (created_by = (select auth.jwt() ->> 'email'));

create policy "Collaborators read shared events" on events
  for select to authenticated
  using ((select auth.jwt() ->> 'email') = any(collaborator_emails));

create policy "Collaborators update shared events" on events
  for update to authenticated
  using ((select auth.jwt() ->> 'email') = any(collaborator_emails))
  with check ((select auth.jwt() ->> 'email') = any(collaborator_emails));

create or replace function public.protect_event_owner_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  caller_email text := (select auth.jwt() ->> 'email');
begin
  if current_user = 'authenticated'
    and old.created_by is distinct from caller_email
    and (
      new.created_by is distinct from old.created_by
      or new.invite_token is distinct from old.invite_token
      or new.collaborator_emails is distinct from old.collaborator_emails
    )
  then
    raise exception 'only the event owner can change ownership, invite tokens, or collaborators'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_event_owner_fields on events;
create trigger protect_event_owner_fields
  before update on events
  for each row execute function public.protect_event_owner_fields();

/*
 * Public share access is provided only through token-validated RPCs below.
 * Generic anonymous table SELECT/UPDATE is intentionally revoked.
 * Regression invariant: under `set local role anon`, direct SELECT from each
 * share table and direct UPDATE of shared_list_items must fail with permission
 * denied; invalid-token RPC calls must return no rows/update nothing.
 */
revoke select on shared_lists, shared_list_items, wishlists from anon;
revoke update on shared_list_items from anon;

drop policy if exists "Public can read shared lists by token" on shared_lists;
drop policy if exists "Public can read shared list items" on shared_list_items;
drop policy if exists "Public can claim shared list items" on shared_list_items;
drop policy if exists "Public can read public wishlists" on wishlists;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create or replace function private.get_public_shared_list(p_token text)
returns table (
  id uuid,
  title text,
  recipient_name text,
  occasion text,
  list_type text,
  santa_assigned boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select sl.id, sl.title, sl.recipient_name, sl.occasion, sl.list_type, sl.santa_assigned, sl.created_at
  from public.shared_lists sl
  where sl.share_token = p_token
  limit 1;
$$;

create or replace function public.get_public_shared_list(p_token text)
returns table (
  id uuid,
  title text,
  recipient_name text,
  occasion text,
  list_type text,
  santa_assigned boolean,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
stable
as $$ select * from private.get_public_shared_list(p_token); $$;

create or replace function private.get_public_shared_list_items(p_token text)
returns table (
  id uuid,
  name text,
  description text,
  link text,
  estimated_price text,
  is_claimed boolean,
  claimed_by_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select sli.id, sli.name, sli.description, sli.link, sli.estimated_price,
         sli.is_claimed, sli.claimed_by_name, sli.created_at
  from public.shared_list_items sli
  join public.shared_lists sl on sl.id = sli.list_id
  where sl.share_token = p_token
  order by sli.created_at;
$$;

create or replace function public.get_public_shared_list_items(p_token text)
returns table (
  id uuid,
  name text,
  description text,
  link text,
  estimated_price text,
  is_claimed boolean,
  claimed_by_name text,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
stable
as $$ select * from private.get_public_shared_list_items(p_token); $$;

create or replace function private.claim_public_shared_list_item(
  p_token text,
  p_item_id uuid,
  p_name text,
  p_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim_secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if length(trim(p_name)) not between 1 and 100
    or p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  then
    raise exception 'invalid claim details' using errcode = '22023';
  end if;

  update public.shared_list_items sli
  set is_claimed = true,
      claimed_by_name = trim(p_name),
      claimed_by_email = lower(trim(p_email)),
      claim_token_hash = encode(extensions.digest(claim_secret, 'sha256'), 'hex')
  from public.shared_lists sl
  where sli.id = p_item_id
    and sl.id = sli.list_id
    and sl.share_token = p_token
    and coalesce(sli.is_claimed, false) = false;

  if not found then
    raise exception 'item not found or already claimed' using errcode = 'P0002';
  end if;
  return claim_secret;
end;
$$;

create or replace function public.claim_public_shared_list_item(
  p_token text,
  p_item_id uuid,
  p_name text,
  p_email text
)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.claim_public_shared_list_item(p_token, p_item_id, p_name, p_email); $$;

create or replace function private.unclaim_public_shared_list_item(
  p_token text,
  p_item_id uuid,
  p_claim_secret text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shared_list_items sli
  set is_claimed = false,
      claimed_by_name = null,
      claimed_by_email = null,
      claim_token_hash = null
  from public.shared_lists sl
  where sli.id = p_item_id
    and sl.id = sli.list_id
    and sl.share_token = p_token
    and sli.claim_token_hash = encode(extensions.digest(p_claim_secret, 'sha256'), 'hex');
  return found;
end;
$$;

create or replace function public.unclaim_public_shared_list_item(
  p_token text,
  p_item_id uuid,
  p_claim_secret text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.unclaim_public_shared_list_item(p_token, p_item_id, p_claim_secret); $$;

create or replace function private.get_public_wishlist(p_token text)
returns table (id uuid, title text, items jsonb, created_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select w.id, w.title, w.items, w.created_at
  from public.wishlists w
  where w.share_token = p_token and w.is_public = true
  limit 1;
$$;

create or replace function public.get_public_wishlist(p_token text)
returns table (id uuid, title text, items jsonb, created_at timestamptz)
language sql
security invoker
set search_path = ''
stable
as $$ select * from private.get_public_wishlist(p_token); $$;

revoke all on function public.get_public_shared_list(text) from public;
revoke all on function public.get_public_shared_list_items(text) from public;
revoke all on function public.claim_public_shared_list_item(text, uuid, text, text) from public;
revoke all on function public.unclaim_public_shared_list_item(text, uuid, text) from public;
revoke all on function public.get_public_wishlist(text) from public;
revoke all on function private.get_public_shared_list(text) from public;
revoke all on function private.get_public_shared_list_items(text) from public;
revoke all on function private.claim_public_shared_list_item(text, uuid, text, text) from public;
revoke all on function private.unclaim_public_shared_list_item(text, uuid, text) from public;
revoke all on function private.get_public_wishlist(text) from public;
grant execute on function private.get_public_shared_list(text) to anon, authenticated;
grant execute on function private.get_public_shared_list_items(text) to anon, authenticated;
grant execute on function private.claim_public_shared_list_item(text, uuid, text, text) to anon, authenticated;
grant execute on function private.unclaim_public_shared_list_item(text, uuid, text) to anon, authenticated;
grant execute on function private.get_public_wishlist(text) to anon, authenticated;
grant execute on function public.get_public_shared_list(text) to anon, authenticated;
grant execute on function public.get_public_shared_list_items(text) to anon, authenticated;
grant execute on function public.claim_public_shared_list_item(text, uuid, text, text) to anon, authenticated;
grant execute on function public.unclaim_public_shared_list_item(text, uuid, text) to anon, authenticated;
grant execute on function public.get_public_wishlist(text) to anon, authenticated;

-- Service-role-only atomic abuse controls for Edge Functions.
create table if not exists public.edge_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);
alter table public.edge_rate_limits enable row level security;
revoke all on public.edge_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.edge_rate_limits to service_role;

create or replace function public.consume_edge_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if p_key is null or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate-limit arguments' using errcode = '22023';
  end if;
  insert into public.edge_rate_limits as limits (rate_key, window_started_at, request_count)
  values (p_key, clock_timestamp(), 1)
  on conflict (rate_key) do update
  set window_started_at = case
        when limits.window_started_at <= clock_timestamp() - make_interval(secs => p_window_seconds)
          then clock_timestamp()
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at <= clock_timestamp() - make_interval(secs => p_window_seconds)
          then 1
        else limits.request_count + 1
      end
  returning request_count <= p_limit into allowed;
  return allowed;
end;
$$;

create or replace function public.consume_ai_quota(p_user_email text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  profile public.user_profiles%rowtype;
  current_month text := to_char(timezone('UTC', clock_timestamp()), 'YYYY-MM');
  used integer;
  quota integer;
begin
  select * into profile
  from public.user_profiles
  where lower(created_by) = lower(p_user_email) or lower(email) = lower(p_user_email)
  order by created_at
  limit 1
  for update;

  if profile.id is null then
    raise exception 'user profile is required before using AI' using errcode = 'P0002';
  end if;

  quota := case when coalesce(profile.is_premium, false) then 30 else 3 end;
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

  return jsonb_build_object('used', used, 'limit', quota, 'remaining', quota - used);
end;
$$;

create or replace function public.refund_ai_quota(p_user_email text)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.user_profiles
  set monthly_ai_uses = greatest(coalesce(monthly_ai_uses, 0) - 1, 0),
      updated_at = clock_timestamp()
  where id = (
    select id
    from public.user_profiles
    where lower(created_by) = lower(p_user_email) or lower(email) = lower(p_user_email)
    order by created_at
    limit 1
  )
  and monthly_ai_reset_month = to_char(timezone('UTC', clock_timestamp()), 'YYYY-MM');
$$;

revoke all on function public.consume_edge_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_ai_quota(text) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(text) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, integer, integer) to service_role;
grant execute on function public.consume_ai_quota(text) to service_role;
grant execute on function public.refund_ai_quota(text) to service_role;
