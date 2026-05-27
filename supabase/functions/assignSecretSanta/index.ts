import { serve } from 'std/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

async function sendEmail(to: string, subject: string, body: string) {
  if (!SENDGRID_API_KEY) return { ok: false, message: 'SendGrid not configured' };
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: 'hello@howthoughtful.app' }, subject, content: [{ type: 'text/plain', value: body }] })
  });
  return { ok: true };
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
      const body = `Hi ${giver.name},\n\nYou are buying a gift for: ${receiver.name}\n\nView the list: (open the app)\n\n— How Thoughtful`;
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
