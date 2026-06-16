import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

const REMINDER_DAYS = [30, 14, 3];

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = (Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL') || 'https://howthoughtful.app').replace(/\/$/, '');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'How Thoughtful <hello@send.howthoughtful.app>';
const REPLY_TO_EMAIL = Deno.env.get('REPLY_TO_EMAIL') || 'hello@howthoughtful.app';
const REMINDER_CRON_SECRET = Deno.env.get('REMINDER_CRON_SECRET');

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

const REMINDER_TEMPLATES: Record<number, {
  subject: (name: string, occasion: string) => string;
  body: (name: string, occasion: string, date: string, budget?: number) => string;
}> = {
  30: {
    subject: (name, occasion) => `30 days until ${name}'s ${occasion} - time to buy online`,
    body: (name, occasion, date, budget) => `Hey,

Just a heads-up: ${name}'s ${occasion} is in 30 days (${date}).

This is the perfect time to order online so gifts arrive with time to spare.

${budget ? `Budget: $${budget}` : ''}

Open How Thoughtful to plan your gift:
${APP_URL}

- How Thoughtful`,
  },
  14: {
    subject: (name, occasion) => `14 days until ${name}'s ${occasion} - last chance for in-store`,
    body: (name, occasion, date, budget) => `Hey,

${name}'s ${occasion} is in 14 days (${date}).

If you haven't ordered online yet, now's a great time to pick something up in store.

${budget ? `Budget: $${budget}` : ''}

Open How Thoughtful to check your gift plan:
${APP_URL}

- How Thoughtful`,
  },
  3: {
    subject: (name, occasion) => `3 days until ${name}'s ${occasion} - time to wrap and prepare`,
    body: (name, occasion, date) => `Hey,

${name}'s ${occasion} is in just 3 days (${date}).

Time to wrap gifts, write the card, and get everything ready.

Open How Thoughtful to check off your prep list:
${APP_URL}

- How Thoughtful`,
  },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function daysUntilEvent(eventDate: string, timeZone: string) {
  const today = localDateParts(new Date(), timeZone);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const eventUtc = Date.parse(`${eventDate}T00:00:00Z`);
  return Math.round((eventUtc - todayUtc) / (1000 * 60 * 60 * 24));
}

function formatEventDate(eventDate: string) {
  return new Date(`${eventDate}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      reply_to: REPLY_TO_EMAIL,
      subject,
      text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend failed with ${response.status}: ${detail}`);
  }

  return response.json();
}

serve(async (req) => {
  try {
    if (REMINDER_CRON_SECRET && req.headers.get('x-cron-secret') !== REMINDER_CRON_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return json({ error: 'Supabase service configuration is missing' }, 500);
    }

    const { data: events = [], error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('completed', false)
      .not('event_date', 'is', null);

    if (eventsError) throw eventsError;

    const { data: profiles = [], error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('created_by,email,timezone');

    if (profilesError) throw profilesError;

    const timezoneByEmail = new Map<string, string>();
    profiles.forEach((profile: any) => {
      const email = profile.created_by || profile.email;
      if (email) timezoneByEmail.set(email, profile.timezone || 'UTC');
    });

    let sent = 0;
    let skipped = 0;
    const failures: Array<{ event_id: string; error: string }> = [];

    for (const event of events as any[]) {
      if (!event.created_by || !event.event_date) {
        skipped++;
        continue;
      }

      const timeZone = timezoneByEmail.get(event.created_by) || 'UTC';
      const days = daysUntilEvent(event.event_date, timeZone);
      if (!REMINDER_DAYS.includes(days)) {
        skipped++;
        continue;
      }

      const reminderKey = `${days}d`;
      if ((event.reminders_sent || []).includes(reminderKey)) {
        skipped++;
        continue;
      }

      const occasion = (event.occasion || 'occasion').replace(/_/g, ' ');
      const template = REMINDER_TEMPLATES[days];

      try {
        await sendEmail(
          event.created_by,
          template.subject(event.recipient_name || 'Someone', occasion),
          template.body(
            event.recipient_name || 'Someone',
            occasion,
            formatEventDate(event.event_date),
            event.budget
          )
        );

        await supabaseAdmin
          .from('events')
          .update({ reminders_sent: [...(event.reminders_sent || []), reminderKey] })
          .eq('id', event.id);

        sent++;
      } catch (error) {
        failures.push({ event_id: event.id, error: error.message });
      }
    }

    return json({ success: true, sent, skipped, failures });
  } catch (error) {
    console.error('sendEventReminders error:', error);
    return json({ error: error.message }, 500);
  }
});
