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

const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') || '').toLowerCase();
const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY');
const NVIDIA_BASE_URL = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = Deno.env.get('NVIDIA_MODEL') || 'meta/llama-3.1-70b-instruct';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

const allowedModels = new Set(
  [NVIDIA_MODEL, OPENAI_MODEL, ...(Deno.env.get('AI_ALLOWED_MODELS') || '').split(',')]
    .map(model => model.trim())
    .filter(Boolean)
);

const parseJsonContent = (content: string) => {
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { ideas: [] };
    try {
      return JSON.parse(match[0]);
    } catch {
      return { ideas: [] };
    }
  }
};

const resolveProvider = () => {
  if (AI_PROVIDER === 'nvidia' || AI_PROVIDER === 'openai') return AI_PROVIDER;
  if (NVIDIA_API_KEY) return 'nvidia';
  return 'openai';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let admin;
  let userEmail = '';
  let quotaReserved = false;
  try {
    admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    userEmail = user.email || '';
    if (!await consumeRateLimit(admin, `ai:${user.id}`, 10, 60)) {
      return json({ error: 'Too many AI requests. Please try again shortly.' }, 429);
    }

    const payload = await readBoundedJson(req);
    const prompt = typeof payload.prompt === 'string' ? payload.prompt.trim() : '';
    if (!prompt || prompt.length > 4_000) {
      return json({ error: 'Prompt must be between 1 and 4000 characters.' }, 400);
    }

    const provider = resolveProvider();
    const isNvidia = provider === 'nvidia';
    const apiKey = isNvidia ? NVIDIA_API_KEY : OPENAI_API_KEY;
    const model = payload.model || (isNvidia ? NVIDIA_MODEL : OPENAI_MODEL);
    const baseUrl = isNvidia ? NVIDIA_BASE_URL : 'https://api.openai.com/v1';
    const maxTokens = payload.max_tokens === undefined ? 800 : Number(payload.max_tokens);
    const temperature = payload.temperature === undefined ? 0.8 : Number(payload.temperature);

    if (!allowedModels.has(model)) return json({ error: 'Model is not allowed.' }, 400);
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 800) {
      return json({ error: 'max_tokens must be an integer between 1 and 800.' }, 400);
    }
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1.5) {
      return json({ error: 'temperature must be between 0 and 1.5.' }, 400);
    }

    if (!apiKey) {
      const secretName = isNvidia ? 'NVIDIA_API_KEY' : 'OPENAI_API_KEY';
      return json({ error: `${secretName} not configured` }, 500);
    }

    const { data: usage, error: quotaError } = await admin.rpc('consume_ai_quota', {
      p_user_email: userEmail,
    });
    if (quotaError) {
      const status = quotaError.code === 'P0001' ? 429 : 400;
      return json({ error: quotaError.message }, status);
    }
    quotaReserved = true;

    const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        ...(isNvidia ? {} : { response_format: { type: 'json_object' } }),
        max_tokens: maxTokens,
        temperature,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await resp.json();
    if (!resp.ok) {
      await admin.rpc('refund_ai_quota', { p_user_email: userEmail });
      quotaReserved = false;
      return json({
        error: data?.error?.message || `${isNvidia ? 'NVIDIA' : 'OpenAI'} request failed`
      }, resp.status);
    }

    const content = data?.choices?.[0]?.message?.content || '{}';
    return json({ ...parseJsonContent(content), usage });
  } catch (err) {
    if (quotaReserved && admin && userEmail) {
      await admin.rpc('refund_ai_quota', { p_user_email: userEmail });
    }
    return errorResponse(err);
  }
});
