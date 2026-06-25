import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { authenticateRequest, consumeRateLimit, corsHeaders, createAdminClient, errorResponse, json, readBoundedJson } from '../_shared/security.ts';
import { extractCapture, modelName, transcribeAudio, transcriptHash } from '../_shared/capture.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    const ok = await consumeRateLimit(admin, `capture:${user.id}`, 20, 60 * 60);
    if (!ok) return json({ error: 'Too many capture attempts. Please try again soon.' }, 429);

    const body = await readBoundedJson(req, 28 * 1024 * 1024);
    const inputType = body.input_type === 'audio' ? 'audio' : 'text';
    let text = String(body.text || '').trim();
    let audioUsed = false;

    if (inputType === 'audio') {
      text = await transcribeAudio(String(body.audio_base64 || ''), String(body.audio_mime || 'audio/webm'));
      audioUsed = true;
    }

    if (!text) return json({ error: 'Tell me a little about what is coming up first.' }, 400);

    const draft = await extractCapture(text);
    const { data: allowance, error } = await admin.rpc('get_capture_allowance', {
      p_user_id: user.id,
      p_user_email: user.email,
    });
    if (error) throw error;

    return json({
      draft,
      allowance,
      audio_used: audioUsed,
      model: modelName,
      transcript_sha256: await transcriptHash(text),
    });
  } catch (error) {
    return errorResponse(error);
  }
});
