-- Adds optional profile and occasion context fields for better gift suggestions.

alter table public.recipients add column if not exists style_preferences text;
alter table public.recipients add column if not exists gift_likes text;
alter table public.recipients add column if not exists gift_avoidances text;
alter table public.recipients add column if not exists wishlist_notes text;

alter table public.events add column if not exists style_preferences text;
alter table public.events add column if not exists gift_likes text;
alter table public.events add column if not exists gift_avoidances text;
alter table public.events add column if not exists wishlist_notes text;
