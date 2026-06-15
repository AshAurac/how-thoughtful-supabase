import { serve } from 'jsr:std/server';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  try {
    const payload = await req.json();
    if (!OPENAI_API_KEY) return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500 });

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: payload.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: payload.prompt }],
        response_format: { type: 'json_object' },
        max_tokens: payload.max_tokens || 800,
        temperature: payload.temperature ?? 0.8
      })
    });
    const data = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: data?.error?.message || 'OpenAI request failed' }), { status: resp.status });
    }

    const content = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = { ideas: [] };
    }

    return new Response(JSON.stringify(parsed), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('InvokeLLM error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
