import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import {
  authenticateRequest,
  consumeRateLimit,
  corsHeaders,
  createAdminClient,
  errorResponse,
  json,
  readBoundedJson,
} from '../_shared/security.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    if (!await consumeRateLimit(admin, `complete-event:${user.id}`, 10, 300)) {
      return json({ error: 'Too many completion requests. Please try again shortly.' }, 429);
    }

    const payload = await readBoundedJson(req, 8_192);
    const eventId = typeof payload.event_id === 'string' ? payload.event_id : '';
    const nextTimeNotes = typeof payload.next_time_notes === 'string'
      ? payload.next_time_notes.trim().slice(0, 2_000)
      : '';

    if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
      return json({ error: 'A valid event_id is required.' }, 400);
    }

    const { data, error } = await admin.rpc('complete_event_and_prepare_next', {
      p_user_email: user.email,
      p_event_id: eventId,
      p_next_time_notes: nextTimeNotes || null,
    });
    if (error) {
      return json({ error: error.message }, error.code === '42501' ? 403 : 400);
    }

    return json(data);
  } catch (error) {
    return errorResponse(error);
  }
});
