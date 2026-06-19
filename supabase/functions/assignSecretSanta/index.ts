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
const APP_URL = (Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL') || 'https://howthoughtful.app').replace(/\/$/, '');
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'How Thoughtful <hello@send.howthoughtful.app>';
const REPLY_TO_EMAIL = Deno.env.get('REPLY_TO_EMAIL') || 'hello@howthoughtful.app';

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    if (!await consumeRateLimit(admin, `secret-santa:${user.id}`, 3, 86_400)) {
      return json({ error: 'Secret Santa rate limit exceeded.' }, 429);
    }

    const { listId } = await readBoundedJson(req, 2_048);
    if (typeof listId !== 'string' || !/^[0-9a-f-]{36}$/i.test(listId)) {
      return json({ error: 'A valid listId is required.' }, 400);
    }

    const userClient = createUserClient(req);
    const { data: list, error: listError } = await userClient
      .from('shared_lists')
      .select('id,title,members,santa_assigned,created_by')
      .eq('id', listId)
      .eq('created_by', user.email)
      .maybeSingle();
    if (listError) throw listError;
    if (!list) return json({ error: 'List not found or access denied' }, 404);
    if (list.santa_assigned) return json({ error: 'Secret Santa has already been assigned.' }, 409);

    const members = list.members || [];
    if (!Array.isArray(members) || members.length < 2 || members.length > 50) {
      return json({ error: 'Secret Santa requires between 2 and 50 participants.' }, 400);
    }
    const normalizedMembers = members.map((member: any) => ({
      name: typeof member?.name === 'string' ? member.name.trim().slice(0, 100) : '',
      email: typeof member?.email === 'string' ? member.email.trim().toLowerCase() : '',
    }));
    const emails = normalizedMembers.map(member => member.email);
    if (normalizedMembers.some(member => !member.name || !isValidEmail(member.email))
      || new Set(emails).size !== emails.length) {
      return json({ error: 'Participants must have unique, valid names and email addresses.' }, 400);
    }

    // Claim the one-time transition before sending. Owners must explicitly reset to redraw.
    const { data: locked, error: lockError } = await admin
      .from('shared_lists')
      .update({ santa_assigned: true })
      .eq('id', listId)
      .eq('created_by', user.email)
      .eq('santa_assigned', false)
      .select('id')
      .maybeSingle();
    if (lockError) throw lockError;
    if (!locked) return json({ error: 'Secret Santa has already been assigned.' }, 409);

    const givers = [...normalizedMembers];
    for (let i = givers.length - 1; i > 0; i--) {
      const random = crypto.getRandomValues(new Uint32Array(1))[0];
      const j = random % (i + 1);
      [givers[i], givers[j]] = [givers[j], givers[i]];
    }
    const receivers = [...givers.slice(1), givers[0]];

    // Email each giver their match
    const promises = givers.map((giver, i) => {
      const receiver = receivers[i];
      const subject = `🎅 Your Secret Santa match for ${list.title}`;
      const body = `Hi ${giver.name},\n\nYou are buying a gift for: ${receiver.name}\n\nOpen How Thoughtful:\n${APP_URL}\n\n- How Thoughtful`;
      return sendEmail(giver.email, subject, body);
    });
    await Promise.all(promises);

    return json({ success: true, count: givers.length });
  } catch (err) {
    return errorResponse(err);
  }
});
