-- Run this in the Supabase SQL Editor after deploying the sendEventReminders Edge Function.
-- Replace YOUR_REMINDER_CRON_SECRET before running.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-event-reminders-daily')
where exists (
  select 1
  from cron.job
  where jobname = 'send-event-reminders-daily'
);

select cron.schedule(
  'send-event-reminders-daily',
  '0 22 * * *',
  $$
  select net.http_post(
    url := 'https://unzxklbbjarukodndxes.functions.supabase.co/sendEventReminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuenhrbGJiamFydWtvZG5keGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTYyOTcsImV4cCI6MjA5NTQzMjI5N30.XjT8zjqqKOftGG2tU0S51NBFQNJMRnTfCkBK7zSXn7U',
      'x-cron-secret', 'YOUR_REMINDER_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
