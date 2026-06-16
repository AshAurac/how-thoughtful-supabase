-- Run this in Supabase SQL Editor if your recipients table already exists.
alter table recipients add column if not exists birthday_month int;
alter table recipients add column if not exists birthday_day int;
