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
  description text,
  link text,
  is_claimed boolean default false,
  claimed_by_name text,
  sent boolean default false,
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
