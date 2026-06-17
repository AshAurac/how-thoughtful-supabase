-- Run this in Supabase SQL Editor if gift checklist buttons do not stay selected.
-- It adds the gift lifecycle fields used by the app.

alter table gifts add column if not exists shipping_cost numeric default 0;
alter table gifts add column if not exists bought boolean default false;
alter table gifts add column if not exists wrapped boolean default false;
alter table gifts add column if not exists card_written boolean default false;
alter table gifts add column if not exists order_number text;
alter table gifts add column if not exists tracking_url text;
alter table gifts add column if not exists expected_arrival date;
alter table gifts add column if not exists delivery_status text default 'none';
