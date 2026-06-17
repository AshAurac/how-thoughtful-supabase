import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'How Thoughtful <hello@send.howthoughtful.app>';
const CONTACT_TO = Deno.env.get('CONTACT_TO_EMAIL') || Deno.env.get('REPLY_TO_EMAIL') || 'hello@howthoughtful.app';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY not configured' }, 500);
    }

    const payload = await req.json();
    const subject = String(payload.subject || '').trim().slice(0, 180);
    const body = String(payload.body || '').trim().slice(0, 5000);
    const replyTo = String(payload.reply_to || payload.replyTo || '').trim();

    if (!subject || !body) {
      return json({ error: 'Missing subject or body' }, 400);
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
    console.error('sendContactEmail error', err);
    return json({ error: err.message }, 500);
  }
});
