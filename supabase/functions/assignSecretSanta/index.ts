import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const APP_URL = (Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL') || 'https://howthoughtful.app').replace(/\/$/, '');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'How Thoughtful <hello@send.howthoughtful.app>';
const REPLY_TO_EMAIL = Deno.env.get('REPLY_TO_EMAIL') || 'hello@howthoughtful.app';

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

async function sendEmail(to: string, subject: string, body: string) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
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
    const { listId } = await req.json();
    if (!listId) return new Response(JSON.stringify({ error: 'listId required' }), { status: 400 });

    const { data: lists } = await supabaseAdmin.from('shared_lists').select('*').eq('id', listId).limit(1);
    const list = lists?.[0];
    if (!list) return new Response(JSON.stringify({ error: 'List not found' }), { status: 404 });

    const members = list.members || [];
    if (members.length < 2) return new Response(JSON.stringify({ error: 'Need at least 2 participants' }), { status: 400 });

    // Shuffle
    let givers = [...members];
    let receivers = [...members];
    for (let i = receivers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
    }
    let attempts = 0;
    while (givers.some((g, i) => g.email === receivers[i].email) && attempts < 10) {
      for (let i = receivers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
      }
      attempts++;
    }

    // Email each giver their match
    const promises = givers.map((giver, i) => {
      const receiver = receivers[i];
      const subject = `🎅 Your Secret Santa match for ${list.title}`;
      const body = `Hi ${giver.name},\n\nYou are buying a gift for: ${receiver.name}\n\nOpen How Thoughtful:\n${APP_URL}\n\n- How Thoughtful`;
      return sendEmail(giver.email, subject, body);
    });
    await Promise.all(promises);

    // mark assigned
    await supabaseAdmin.from('shared_lists').update({ santa_assigned: true }).eq('id', listId);

    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    console.error('assignSecretSanta error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
