import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import {
  consumeRateLimit,
  corsHeaders,
  createAdminClient,
  errorResponse,
  isValidEmail,
  json,
  readBoundedJson,
  sha256,
} from '../_shared/security.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'How Thoughtful <hello@send.howthoughtful.app>';
const CONTACT_TO = Deno.env.get('CONTACT_TO_EMAIL') || Deno.env.get('REPLY_TO_EMAIL') || 'hello@howthoughtful.app';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY not configured' }, 500);
    }

    const payload = await readBoundedJson(req, 8_192);
    const subject = String(payload.subject || '').trim().slice(0, 180);
    const body = String(payload.body || '').trim().slice(0, 5000);
    const replyTo = String(payload.reply_to || payload.replyTo || '').trim();

    if (!subject || !body) {
      return json({ error: 'Missing subject or body' }, 400);
    }
    if (replyTo && !isValidEmail(replyTo)) {
      return json({ error: 'Invalid reply-to email address' }, 400);
    }

    const forwardedFor = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || 'unknown';
    const fingerprint = await sha256(`${forwardedFor}:${req.headers.get('user-agent') || ''}`);
    const admin = createAdminClient();
    if (!await consumeRateLimit(admin, `contact-ip:${fingerprint}`, 5, 900)) {
      return json({ error: 'Too many messages. Please try again later.' }, 429);
    }
    if (replyTo) {
      const emailKey = await sha256(replyTo.toLowerCase());
      if (!await consumeRateLimit(admin, `contact-email:${emailKey}`, 3, 3600)) {
        return json({ error: 'Too many messages from this email address.' }, 429);
      }
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [CONTACT_TO],
        reply_to: replyTo || CONTACT_TO,
        subject,
        text: body
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return json({ error: data?.message || 'Email failed to send' }, response.status);
    }

    return json({ success: true, id: data?.id });
  } catch (err) {
    return errorResponse(err);
  }
});
