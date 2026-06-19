import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
};

export const createAdminClient = () =>
  createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const createUserClient = (req: Request) =>
  createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('authorization') || '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

export async function authenticateRequest(req: Request, admin: SupabaseClient): Promise<User> {
  const authorization = req.headers.get('authorization') || '';
  const accessToken = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!accessToken) throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return data.user;
}

export async function consumeRateLimit(
  admin: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await admin.rpc('consume_edge_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw error;
  return data === true;
}

export async function readBoundedJson(req: Request, maxBytes = 16_384) {
  const contentLength = Number(req.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Response(JSON.stringify({ error: 'Request too large' }), { status: 413 });
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) {
    throw new Response(JSON.stringify({ error: 'Request too large' }), { status: 413 });
  }
  return raw.trim() ? JSON.parse(raw) : {};
}

export const isValidEmail = (value: unknown): value is string =>
  typeof value === 'string'
  && value.length <= 254
  && /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value);

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function errorResponse(error: unknown) {
  if (error instanceof Response) {
    return new Response(error.body, {
      status: error.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  console.error(error);
  return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
}
