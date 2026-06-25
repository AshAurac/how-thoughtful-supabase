import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { authenticateRequest, consumeRateLimit, corsHeaders, createAdminClient, errorResponse, json, readBoundedJson } from '../_shared/security.ts';
import { extractCapture, validateCaptureDraft } from '../_shared/capture.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    const ok = await consumeRateLimit(admin, `continue-capture:${user.id}`, 40, 60 * 60);
    if (!ok) return json({ error: 'Too many capture attempts. Please try again soon.' }, 429);

    const body = await readBoundedJson(req);
    const answer = String(body.answer || '').trim();
    if (!answer) return json({ error: 'Add a short answer first.' }, 400);

    const existingDraft = validateCaptureDraft(body.draft);
    const draft = await extractCapture('', existingDraft, answer);
    return json({ draft });
  } catch (error) {
    return errorResponse(error);
  }
});
