import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import Stripe from 'npm:stripe@18';
import { authenticateRequest, corsHeaders, createAdminClient, errorResponse, json, readBoundedJson } from '../_shared/security.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2026-02-25.clover' as any,
});

const priceFor = (key: string) => {
  const prices: Record<string, { env: string; plan: 'individual' | 'family'; interval: 'monthly' | 'annual' }> = {
    individual_monthly: { env: 'STRIPE_PRICE_INDIVIDUAL_MONTHLY', plan: 'individual', interval: 'monthly' },
    individual_annual: { env: 'STRIPE_PRICE_INDIVIDUAL_ANNUAL', plan: 'individual', interval: 'annual' },
    family_monthly: { env: 'STRIPE_PRICE_FAMILY_MONTHLY', plan: 'family', interval: 'monthly' },
    family_annual: { env: 'STRIPE_PRICE_FAMILY_ANNUAL', plan: 'family', interval: 'annual' },
  };
  const mapping = prices[key];
  if (!mapping) return null;
  const priceId = Deno.env.get(mapping.env);
  return priceId ? { ...mapping, priceId } : null;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (!Deno.env.get('STRIPE_SECRET_KEY')) {
      return json({ error: 'STRIPE_SECRET_KEY is not configured in Supabase secrets' }, 500);
    }

    const admin = createAdminClient();
    const user = await authenticateRequest(req, admin);
    const body = await readBoundedJson(req);
    const product = String(body.product || '');
    const mapping = priceFor(product);
    if (!mapping) return json({ error: 'This plan is not available yet.' }, 400);

    const origin = String(req.headers.get('origin') || '').replace(/\/$/, '');
    const successUrl = String(body.success_url || `${origin}/upgrade?success=true&product=${product}`);
    const cancelUrl = String(body.cancel_url || `${origin}/upgrade`);

    const { data: profiles, error } = await admin
      .from('user_profiles')
      .select('stripe_customer_id')
      .or(`created_by.eq.${user.email},email.eq.${user.email}`)
      .limit(1);
    if (error) throw error;

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: mapping.priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        plan: mapping.plan,
        billing_interval: mapping.interval,
        price_id: mapping.priceId,
        user_email: user.email || '',
      },
      subscription_data: {
        metadata: {
          plan: mapping.plan,
          billing_interval: mapping.interval,
          price_id: mapping.priceId,
          user_email: user.email || '',
        },
      },
    };

    if (profiles?.[0]?.stripe_customer_id) {
      params.customer = profiles[0].stripe_customer_id;
    } else {
      params.customer_email = user.email || undefined;
    }

    const session = await stripe.checkout.sessions.create(params);
    return json({ url: session.url, session_id: session.id });
  } catch (error) {
    return errorResponse(error);
  }
});
