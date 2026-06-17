-- Run this in Supabase SQL Editor to rename the final gift step from "sent" to "given".
-- The old "sent" column stays in place for compatibility, and existing sent gifts are copied across.

alter table gifts add column if not exists given boolean default false;

update gifts
set given = true
where sent = true and coalesce(given, false) = false;
