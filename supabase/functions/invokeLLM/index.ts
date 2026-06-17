import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';

const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') || '').toLowerCase();
const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY');
const NVIDIA_BASE_URL = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = Deno.env.get('NVIDIA_MODEL') || 'meta/llama-3.1-70b-instruct';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

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
  try {
    const payload = await req.json();
    const provider = resolveProvider();
    const isNvidia = provider === 'nvidia';
    const apiKey = isNvidia ? NVIDIA_API_KEY : OPENAI_API_KEY;
    const model = payload.model || (isNvidia ? NVIDIA_MODEL : OPENAI_MODEL);
    const baseUrl = isNvidia ? NVIDIA_BASE_URL : 'https://api.openai.com/v1';

    if (!apiKey) {
      const secretName = isNvidia ? 'NVIDIA_API_KEY' : 'OPENAI_API_KEY';
      return json({ error: `${secretName} not configured` }, 500);
    }

    const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: payload.prompt }],
        ...(isNvidia ? {} : { response_format: { type: 'json_object' } }),
        max_tokens: payload.max_tokens || 800,
        temperature: payload.temperature ?? 0.8
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      return json({
        error: data?.error?.message || `${isNvidia ? 'NVIDIA' : 'OpenAI'} request failed`
      }, resp.status);
    }

    const content = data?.choices?.[0]?.message?.content || '{}';
    return json(parseJsonContent(content));
  } catch (err) {
    console.error('InvokeLLM error', err);
    return json({ error: err.message }, 500);
  }
});
