const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const EXTRACT_MODEL = Deno.env.get('OPENAI_CAPTURE_MODEL') || 'gpt-5.4-nano';
const FALLBACK_MODEL = Deno.env.get('OPENAI_CAPTURE_FALLBACK_MODEL') || 'gpt-5.4-mini';
const TRANSCRIBE_MODEL = Deno.env.get('OPENAI_TRANSCRIBE_MODEL') || 'gpt-4o-mini-transcribe';
const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') || '').toLowerCase();
const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY') || '';
const NVIDIA_BASE_URL = Deno.env.get('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
const NVIDIA_CAPTURE_MODEL = Deno.env.get('NVIDIA_CAPTURE_MODEL') || Deno.env.get('NVIDIA_MODEL') || 'meta/llama-3.1-70b-instruct';
const NVIDIA_CAPTURE_FALLBACK_MODEL = Deno.env.get('NVIDIA_CAPTURE_FALLBACK_MODEL') || NVIDIA_CAPTURE_MODEL;

export type CaptureDraft = {
  people: Array<Record<string, unknown>>;
  occasions: Array<Record<string, unknown>>;
  ideas: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  missing: string[];
  follow_up_question: string | null;
  confidence: 'low' | 'medium' | 'high';
};

export async function transcriptHash(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateCaptureDraft(value: unknown): CaptureDraft {
  const draft = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  const people = Array.isArray(draft.people) ? draft.people : [];
  const occasions = Array.isArray(draft.occasions) ? draft.occasions : [];
  const ideas = Array.isArray(draft.ideas) ? draft.ideas : [];
  const actions = Array.isArray(draft.actions) ? draft.actions : [];
  const aiMissing = Array.isArray(draft.missing)
    ? draft.missing.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim())
    : [];
  const missing = [...new Set([...deterministicMissing({ people, occasions }), ...aiMissing])];
  const question = typeof draft.follow_up_question === 'string' && draft.follow_up_question.trim()
    ? draft.follow_up_question.trim()
    : phraseFallbackQuestion(missing);

  return {
    people,
    occasions,
    ideas,
    actions,
    missing,
    follow_up_question: missing.length > 0 ? question : null,
    confidence: draft.confidence === 'high' || draft.confidence === 'low' ? draft.confidence : 'medium',
  };
}

function deterministicMissing(draft: Pick<CaptureDraft, 'people' | 'occasions'>) {
  const missing = new Set<string>();
  if (draft.people.length === 0) missing.add('at least one person');
  if (draft.occasions.length === 0) missing.add('at least one occasion');

  draft.occasions.forEach((occasion, index) => {
    if (!text(occasion.recipient_name)) missing.add(`recipient for occasion ${index + 1}`);
    if (!text(occasion.occasion)) missing.add(`occasion type for occasion ${index + 1}`);
    if (!text(occasion.event_date)) missing.add(`date for occasion ${index + 1}`);
  });

  return [...missing];
}

function phraseFallbackQuestion(missing: string[]) {
  if (missing.length === 0) return null;
  if (missing.some(item => item.includes('date'))) return 'What date is this occasion happening?';
  if (missing.some(item => item.includes('recipient'))) return 'Who is this occasion for?';
  if (missing.some(item => item.includes('occasion'))) return 'What kind of occasion is it?';
  return `Could you add ${missing[0]}?`;
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

export async function transcribeAudio(audioBase64: string, mimeType = 'audio/webm') {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const binary = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
  if (binary.byteLength > 26 * 1024 * 1024) {
    throw new Response(JSON.stringify({ error: 'Recording is too large. Please keep it under five minutes.' }), { status: 413 });
  }

  const form = new FormData();
  form.append('model', TRANSCRIBE_MODEL);
  form.append('file', new Blob([binary], { type: mimeType }), 'capture.webm');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!response.ok) throw new Error(`Transcription failed: ${await response.text()}`);
  const result = await response.json();
  return String(result.text || '').trim();
}

export async function extractCapture(textInput: string, existingDraft?: CaptureDraft, answer?: string) {
  const provider = resolveCaptureProvider();
  const primaryModel = provider === 'nvidia' ? NVIDIA_CAPTURE_MODEL : EXTRACT_MODEL;
  const fallbackModel = provider === 'nvidia' ? NVIDIA_CAPTURE_FALLBACK_MODEL : FALLBACK_MODEL;

  const prompt = [
    'You extract gifting plans for How Thoughtful. Return valid JSON only.',
    'Never guess essential details. If a recipient, occasion type, or date is missing, leave it blank and add it to missing.',
    'If a pronoun, relationship, budget, gift idea, age, birthday, or preference could belong to more than one person, do not assign it. Add the ambiguity to missing and ask one clarification question.',
    'If the input is a basic but clear occasion, capture the basics and do not ask for optional details. Users can update details later.',
    'Use ISO YYYY-MM-DD dates only when the user gave enough information. Relative dates may be resolved only if unambiguous from current date.',
    'People fields: name, relationship, age, birth_year, birthday_month, birthday_day, interests, notes, gift_likes, gift_avoidances.',
    'Occasion fields: recipient_name, occasion, event_date, budget, priority, recurring, visibility, notes, age_turning, starter_idea.',
    'Actions fields: title, due_date. Ideas fields: recipient_name, name, description.',
    'Ask at most one minimal follow_up_question.',
    `Current date: ${new Date().toISOString().slice(0, 10)}.`,
    existingDraft ? `Existing draft JSON: ${JSON.stringify(existingDraft)}` : '',
    answer ? `User follow-up answer: ${answer}` : '',
    `User text: ${textInput}`,
  ].filter(Boolean).join('\n');

  const first = await callCaptureModel(provider, primaryModel, prompt);
  const parsed = parseJson(first);
  if (parsed) return validateCaptureDraft(parsed);

  const fallback = await callCaptureModel(provider, fallbackModel, `${prompt}\nYour previous response failed JSON validation. Return strict JSON only.`);
  const fallbackParsed = parseJson(fallback);
  if (!fallbackParsed) throw new Error('Capture analysis failed validation');
  return validateCaptureDraft(fallbackParsed);
}

function resolveCaptureProvider() {
  if (AI_PROVIDER === 'nvidia' || AI_PROVIDER === 'openai') return AI_PROVIDER;
  if (NVIDIA_API_KEY) return 'nvidia';
  return 'openai';
}

async function callCaptureModel(provider: 'nvidia' | 'openai', model: string, input: string) {
  if (provider === 'nvidia') return callNvidia(model, input);
  return callOpenAI(model, input);
}

async function callNvidia(model: string, input: string) {
  if (!NVIDIA_API_KEY) throw new Error('NVIDIA_API_KEY is not configured');

  const payload = {
    model,
    messages: [
      { role: 'system', content: 'Return valid JSON only. Do not include markdown fences or commentary.' },
      { role: 'user', content: input },
    ],
    temperature: 0.1,
    max_tokens: 1800,
  };

  const response = await fetch(`${NVIDIA_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  let result: Record<string, unknown> = {};
  try {
    result = await response.json();
  } catch {
    // Fall through to the response status check below.
  }

  if (!response.ok) {
    const message = typeof result?.error === 'object' && result.error && 'message' in result.error
      ? String((result.error as { message?: unknown }).message)
      : `NVIDIA request failed with status ${response.status}`;
    throw new Error(message);
  }

  const choices = Array.isArray(result.choices) ? result.choices : [];
  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  return typeof message?.content === 'string' ? message.content : '';
}

async function callOpenAI(model: string, input: string) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input,
      text: { format: { type: 'json_object' } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${await response.text()}`);
  const result = await response.json();
  return result.output_text
    || result.output?.flatMap((item: Record<string, unknown>) => Array.isArray(item.content) ? item.content : [])
      .map((part: Record<string, unknown>) => part.text || '')
      .join('')
    || '';
}

function parseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

export const modelName = resolveCaptureProvider() === 'nvidia' ? NVIDIA_CAPTURE_MODEL : EXTRACT_MODEL;
