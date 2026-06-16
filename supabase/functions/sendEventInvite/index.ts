import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL') || 'https://your-app-url.com';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'How Thoughtful <hello@send.howthoughtful.app>';
const REPLY_TO_EMAIL = Deno.env.get('REPLY_TO_EMAIL') || 'hello@howthoughtful.app';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase env vars');
}

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

async function sendEmail(to: string, subject: string, body: string) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      reply_to: REPLY_TO_EMAIL,
      subject,
      text: body
    })
  });
  if (!res.ok) throw new Error(`Resend failed with ${res.status}: ${await res.text()}`);
  return res.json();
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
