-- Supabase schema for How Thoughtful (migrated from Base44)
-- Run this in Supabase SQL editor or via psql against your database

-- Extensions
create extension if not exists pgcrypto;

-- User profiles
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  created_by text,
  full_name text,
  email text,
  skills text[],
  love_languages_give text[],
  love_languages_receive text[],
  personality text,
  work text,
  free_text text,
  intention text,
  intention_year int,
  timezone text,
  is_premium boolean default false,
  premium_type text,
  premium_since timestamptz,
  monthly_ai_uses int default 0,
  monthly_ai_reset_month text,
  ai_credits int default 0,
  profile_completed boolean default false,
  -- feature flags
  feature_budget boolean default false,
  feature_deliveries boolean default false,
  feature_saved boolean default false,
  feature_group_lists boolean default false,
  feature_restock boolean default false,
  feature_wishlist boolean default false,
  feature_year_in_giving boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Recipients
create table if not exists recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  relationship text,
  age int,
  birthday_month int,
  birthday_day int,
  interests text[],
  notes text,
  love_language text,
  avatar_url text,
  created_by text,
  created_at timestamptz default now()
);

-- Events (occasions)
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  recipient_name text,
  recipient_id uuid,
  occasion text,
  event_date date,
  year int,
  budget numeric default 0,
  priority text default 'medium',
  recurring boolean default false,
  notes text,
  reflection text,
  giver_name text,
  love_language text,
  age_or_years int,
  buy_online_by date,
  buy_local_by date,
  wrap_by date,
  reminders_sent jsonb default '[]',
  collaborator_emails text[] default '{}',
  invite_token text,
  created_by text,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Gifts
create table if not exists gifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  name text,
  price numeric,
  shipping_cost numeric default 0,
  description text,
  link text,
  bought boolean default false,
  wrapped boolean default false,
  card_written boolean default false,
  is_claimed boolean default false,
  claimed_by_name text,
  given boolean default false,
  sent boolean default false,
  order_number text,
  tracking_url text,
  expected_arrival date,
  delivery_status text default 'none',
  created_by text,
  created_at timestamptz default now()
);

-- Gift history (archived occasions)
create table if not exists gift_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  recipient_name text,
  occasion text,
  event_date date,
  year int,
  budget numeric,
  notes text,
  reflection text,
  giver_name text,
  love_language text,
  total_spent numeric default 0,
  gifts_given jsonb default '[]',
  created_by text,
  created_at timestamptz default now()
);

-- Saved ideas
create table if not exists saved_ideas (
  id uuid primary key default gen_random_uuid(),
  name text,
  description text,
  estimated_price text,
  why_it_works text,
  recipient_name text,
  event_id uuid,
  created_by text,
  created_at timestamptz default now()
);

-- Shared lists (group gifting / secret santa)
create table if not exists shared_lists (
  id uuid primary key default gen_random_uuid(),
  title text,
  recipient_name text,
  recipient_email text,
  occasion text,
  list_type text default 'group_gift',
  members jsonb default '[]',
  share_token text unique,
  santa_assigned boolean default false,
  created_by text,
  created_at timestamptz default now()
);

-- Shared list items
create table if not exists shared_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid references shared_lists(id) on delete cascade,
  name text,
  description text,
  link text,
  estimated_price text,
  is_claimed boolean default false,
  claimed_by_name text,
  claimed_by_email text,
  created_by text,
  created_at timestamptz default now()
);

-- Wishlists
create table if not exists wishlists (
  id uuid primary key default gen_random_uuid(),
  title text,
  items jsonb default '[]',
  share_token text unique,
  is_public boolean default false,
  created_by text,
  created_at timestamptz default now()
);

-- Indexes for common queries
create index if not exists idx_events_created_by on events(created_by);
create index if not exists idx_shared_lists_share_token on shared_lists(share_token);
create index if not exists idx_wishlists_share_token on wishlists(share_token);

-- Keep the browser API usable while preventing users from reading each other's private data.
alter table user_profiles enable row level security;
alter table recipients enable row level security;
alter table events enable row level security;
alter table gifts enable row level security;
alter table gift_history enable row level security;
alter table saved_ideas enable row level security;
alter table shared_lists enable row level security;
alter table shared_list_items enable row level security;
alter table wishlists enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  user_profiles,
  recipients,
  events,
  gifts,
  gift_history,
  saved_ideas,
  shared_lists,
  shared_list_items,
  wishlists
to authenticated;
grant select on shared_lists, shared_list_items, wishlists to anon;
grant update on shared_list_items to anon;

drop policy if exists "Users manage their own profiles" on user_profiles;
create policy "Users manage their own profiles" on user_profiles
  for all to authenticated
  using (created_by = (auth.jwt() ->> 'email') or email = (auth.jwt() ->> 'email'))
  with check (created_by = (auth.jwt() ->> 'email') or email = (auth.jwt() ->> 'email'));

drop policy if exists "Users manage their own recipients" on recipients;
create policy "Users manage their own recipients" on recipients
  for all to authenticated
  using (created_by = (auth.jwt() ->> 'email'))
  with check (created_by = (auth.jwt() ->> 'email'));

drop policy if exists "Users manage their own and shared events" on events;
create policy "Users manage their own and shared events" on events
  for all to authenticated
  using (
    created_by = (auth.jwt() ->> 'email')
    or (auth.jwt() ->> 'email') = any(collaborator_emails)
  )
  with check (
    created_by = (auth.jwt() ->> 'email')
    or (auth.jwt() ->> 'email') = any(collaborator_emails)
  );

drop policy if exists "Users manage accessible gifts" on gifts;
create policy "Users manage accessible gifts" on gifts
  for all to authenticated
  using (
    created_by = (auth.jwt() ->> 'email')
    or exists (
      select 1 from events
      where events.id = gifts.event_id
      and (
        events.created_by = (auth.jwt() ->> 'email')
        or (auth.jwt() ->> 'email') = any(events.collaborator_emails)
      )
    )
  )
  with check (
    created_by = (auth.jwt() ->> 'email')
    and exists (
      select 1 from events
      where events.id = gifts.event_id
      and (
        events.created_by = (auth.jwt() ->> 'email')
        or (auth.jwt() ->> 'email') = any(events.collaborator_emails)
      )
    )
  );

drop policy if exists "Users manage their own gift history" on gift_history;
create policy "Users manage their own gift history" on gift_history
  for all to authenticated
  using (created_by = (auth.jwt() ->> 'email'))
  with check (created_by = (auth.jwt() ->> 'email'));

drop policy if exists "Users manage their own saved ideas" on saved_ideas;
create policy "Users manage their own saved ideas" on saved_ideas
  for all to authenticated
  using (created_by = (auth.jwt() ->> 'email'))
  with check (created_by = (auth.jwt() ->> 'email'));

drop policy if exists "Users manage their own shared lists" on shared_lists;
create policy "Users manage their own shared lists" on shared_lists
  for all to authenticated
  using (created_by = (auth.jwt() ->> 'email'))
  with check (created_by = (auth.jwt() ->> 'email'));

drop policy if exists "Public can read shared lists by token" on shared_lists;
create policy "Public can read shared lists by token" on shared_lists
  for select to anon, authenticated
  using (share_token is not null);

drop policy if exists "Users manage items on their shared lists" on shared_list_items;
create policy "Users manage items on their shared lists" on shared_list_items
  for all to authenticated
  using (
    created_by = (auth.jwt() ->> 'email')
    or exists (
      select 1 from shared_lists
      where shared_lists.id = shared_list_items.list_id
      and shared_lists.created_by = (auth.jwt() ->> 'email')
    )
  )
  with check (
    created_by = (auth.jwt() ->> 'email')
    or exists (
      select 1 from shared_lists
      where shared_lists.id = shared_list_items.list_id
      and shared_lists.created_by = (auth.jwt() ->> 'email')
    )
  );

drop policy if exists "Public can read shared list items" on shared_list_items;
create policy "Public can read shared list items" on shared_list_items
  for select to anon, authenticated
  using (
    exists (
      select 1 from shared_lists
      where shared_lists.id = shared_list_items.list_id
      and shared_lists.share_token is not null
    )
  );

drop policy if exists "Public can claim shared list items" on shared_list_items;
create policy "Public can claim shared list items" on shared_list_items
  for update to anon, authenticated
  using (
    exists (
      select 1 from shared_lists
      where shared_lists.id = shared_list_items.list_id
      and shared_lists.share_token is not null
    )
  )
  with check (
    exists (
      select 1 from shared_lists
      where shared_lists.id = shared_list_items.list_id
      and shared_lists.share_token is not null
    )
  );

drop policy if exists "Users manage their own wishlists" on wishlists;
create policy "Users manage their own wishlists" on wishlists
  for all to authenticated
  using (created_by = (auth.jwt() ->> 'email'))
  with check (created_by = (auth.jwt() ->> 'email'));

drop policy if exists "Public can read public wishlists" on wishlists;
create policy "Public can read public wishlists" on wishlists
  for select to anon, authenticated
  using (is_public = true and share_token is not null);
