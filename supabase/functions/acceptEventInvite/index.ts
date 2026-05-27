import { serve } from 'std/server';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

serve(async (req) => {
  try {
    const { token } = await req.json();
    if (!token) return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400 });

    // Find event by invite_token
    const { data: events } = await supabaseAdmin.from('events').select('*').eq('invite_token', token).limit(1);
    const event = events?.[0];
    if (!event) return new Response(JSON.stringify({ error: 'Invalid or expired invite link' }), { status: 404 });

    // Expect Authorization: Bearer <access_token>
    const authHeader = req.headers.get('authorization') || '';
    const tokenParts = authHeader.split(' ');
    const accessToken = tokenParts[1];
    if (!accessToken) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const { data: userRes, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !userRes?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    const userEmail = userRes.user.email;

    if (event.created_by === userEmail) return new Response(JSON.stringify({ event_id: event.id, already_owner: true }));

    const existing = event.collaborator_emails || [];
    if (!existing.includes(userEmail)) {
      await supabaseAdmin.from('events').update({ collaborator_emails: [...existing, userEmail] }).eq('id', event.id);
    }

    return new Response(JSON.stringify({ event_id: event.id, success: true }));
  } catch (err) {
    console.error('acceptEventInvite error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
