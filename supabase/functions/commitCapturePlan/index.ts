import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { authenticateRequest, corsHeaders, createAdminClient, errorResponse, json, readBoundedJson } from '../_shared/security.ts';
import { validateCaptureDraft } from '../_shared/capture.ts';

const safeUuid = () => crypto.randomUUID();

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    const body = await readBoundedJson(req);
    const draft = validateCaptureDraft(body.draft);

    if (draft.missing.length > 0) {
      return json({ error: 'Please answer the missing details before making the plan.', missing: draft.missing }, 400);
    }

    const payload = {
      ...draft,
      audio_used: Boolean(body.audio_used),
      model: typeof body.model === 'string' ? body.model : null,
      transcript_sha256: typeof body.transcript_sha256 === 'string' ? body.transcript_sha256 : null,
    };

    const { data, error } = await admin.rpc('commit_capture_plan', {
      p_user_id: user.id,
      p_user_email: user.email,
      p_payload: payload,
      p_idempotency_key: String(body.idempotency_key || safeUuid()),
    });
    if (error) throw error;

    return json({ result: data });
  } catch (error) {
    return errorResponse(error);
  }
});
