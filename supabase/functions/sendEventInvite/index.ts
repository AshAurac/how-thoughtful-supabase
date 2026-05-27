import { serve } from 'std/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const APP_URL = Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL') || 'https://your-app-url.com';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase env vars');
}

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

async function sendEmail(to: string, subject: string, body: string) {
  if (!SENDGRID_API_KEY) {
    console.warn('SENDGRID_API_KEY not set — skipping actual email send');
    return { ok: false, message: 'SendGrid not configured' };
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: 'hello@howthoughtful.app', name: 'How Thoughtful' },
      subject,
      content: [{ type: 'text/plain', value: body }]
    })
  });
  return res.ok ? { ok: true } : { ok: false, status: res.status };
}

serve(async (req) => {
  try {
    const { event_id, invite_email } = await req.json();
    if (!event_id || !invite_email) return new Response(JSON.stringify({ error: 'Missing event_id or invite_email' }), { status: 400 });

    // Find the event
    const { data: events } = await supabaseAdmin.from('events').select('*').eq('id', event_id).limit(1);
    const event = events?.[0];
    if (!event) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404 });

    // Ensure invite token
    let token = event.invite_token;
    if (!token) {
      token = crypto.randomUUID();
      await supabaseAdmin.from('events').update({ invite_token: token }).eq('id', event_id);
    }

    const inviteUrl = `${APP_URL.replace(/\/$/, '')}/join-event/${token}`;

    const subject = `You're invited to collaborate on an occasion`;
    const body = `Hi there,\n\nYou've been invited to collaborate on "${event.recipient_name}'s ${event.occasion}".\n\nAccept the invite: ${inviteUrl}\n\n— How Thoughtful`;

    await sendEmail(invite_email, subject, body);

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('sendEventInvite error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
