import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import {
  authenticateRequest,
  consumeRateLimit,
  corsHeaders,
  createAdminClient,
  createUserClient,
  errorResponse,
  isValidEmail,
  json,
  readBoundedJson,
} from '../_shared/security.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL') || 'https://your-app-url.com';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'How Thoughtful <hello@send.howthoughtful.app>';
const REPLY_TO_EMAIL = Deno.env.get('REPLY_TO_EMAIL') || 'hello@howthoughtful.app';

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    if (!await consumeRateLimit(admin, `event-invite:${user.id}`, 10, 3600)) {
      return json({ error: 'Invite rate limit exceeded.' }, 429);
    }

    const { event_id, invite_email } = await readBoundedJson(req, 4_096);
    if (typeof event_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(event_id) || !isValidEmail(invite_email)) {
      return json({ error: 'A valid event_id and invite_email are required.' }, 400);
    }

    // Query through the caller's JWT and require owner identity before using service role.
    const userClient = createUserClient(req);
    const { data: event, error: eventError } = await userClient
      .from('events')
      .select('id,recipient_name,occasion,invite_token,created_by')
      .eq('id', event_id)
      .eq('created_by', user.email)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return json({ error: 'Event not found or access denied' }, 404);

    // Ensure invite token
    let token = event.invite_token;
    if (!token) {
      token = crypto.randomUUID();
      const { error } = await admin
        .from('events')
        .update({ invite_token: token })
        .eq('id', event_id)
        .eq('created_by', user.email);
      if (error) throw error;
    }

    const inviteUrl = `${APP_URL.replace(/\/$/, '')}/join-event/${token}`;

    const subject = `You're invited to collaborate on an occasion`;
    const body = `Hi there,\n\nYou've been invited to collaborate on "${event.recipient_name}'s ${event.occasion}".\n\nAccept the invite: ${inviteUrl}\n\n— How Thoughtful`;

    await sendEmail(invite_email, subject, body);

    return json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
});
