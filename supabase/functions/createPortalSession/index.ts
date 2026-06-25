import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import Stripe from 'npm:stripe@18';
import { authenticateRequest, corsHeaders, createAdminClient, errorResponse, json, readBoundedJson } from '../_shared/security.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2026-02-25.clover' as any,
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    const body = await readBoundedJson(req);
    const returnUrl = String(body.return_url || req.headers.get('origin') || '').replace(/\/$/, '') || undefined;

    const { data: profiles, error } = await admin
      .from('user_profiles')
      .select('stripe_customer_id')
      .or(`created_by.eq.${user.email},email.eq.${user.email}`)
      .limit(1);
    if (error) throw error;

    const customer = profiles?.[0]?.stripe_customer_id;
    if (!customer) return json({ error: 'No Stripe customer found for this account yet.' }, 404);

    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: returnUrl ? `${returnUrl}/upgrade` : undefined,
    });

    return json({ url: session.url });
  } catch (error) {
    return errorResponse(error);
  }
});
