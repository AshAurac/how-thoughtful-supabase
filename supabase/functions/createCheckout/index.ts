import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

const firstSecret = (...names: string[]) => {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  return '';
};

const PRICE_IDS: Record<string, string> = {
  monthly: firstSecret('STRIPE_PRICE_MONTHLY', 'STRIPE_MONTHLY_PRICE_ID'),
  annual: firstSecret('STRIPE_PRICE_ANNUAL', 'STRIPE_PRICE_YEARLY', 'STRIPE_ANNUAL_PRICE_ID', 'STRIPE_YEARLY_PRICE_ID'),
  individual_monthly: firstSecret('STRIPE_PRICE_INDIVIDUAL_MONTHLY', 'STRIPE_INDIVIDUAL_MONTHLY_PRICE_ID', 'STRIPE_PRICE_MONTHLY'),
  individual_annual: firstSecret('STRIPE_PRICE_INDIVIDUAL_ANNUAL', 'STRIPE_PRICE_INDIVIDUAL_YEARLY', 'STRIPE_INDIVIDUAL_ANNUAL_PRICE_ID', 'STRIPE_INDIVIDUAL_YEARLY_PRICE_ID', 'STRIPE_PRICE_ANNUAL', 'STRIPE_PRICE_YEARLY'),
  family_monthly: firstSecret('STRIPE_PRICE_FAMILY_MONTHLY', 'STRIPE_FAMILY_MONTHLY_PRICE_ID'),
  family_annual: firstSecret('STRIPE_PRICE_FAMILY_ANNUAL', 'STRIPE_PRICE_FAMILY_YEARLY', 'STRIPE_FAMILY_ANNUAL_PRICE_ID', 'STRIPE_FAMILY_YEARLY_PRICE_ID')
};

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');
const stripe = new Stripe(STRIPE_SECRET_KEY || '');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!STRIPE_SECRET_KEY) {
      return json({ error: 'STRIPE_SECRET_KEY is not configured in Supabase secrets' }, 500);
    }

    const authHeader = req.headers.get('authorization') || '';
    const accessToken = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7)
      : '';

    const { data: userResult, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    const user = userResult?.user;
    if (userError || !user?.email) {
      return json({ error: 'Please log in again before upgrading.' }, 401);
    }

    const { product, user_email, success_url, cancel_url } = await req.json();
    if (!product || !PRICE_IDS[product]) return json({ error: 'Invalid product' }, 400);

    const priceId = PRICE_IDS[product];
    if (!priceId || priceId.includes('placeholder')) {
      return json({ error: `Stripe price for ${product} is not configured` }, 500);
    }

    const [plan, billing] = product.includes('_') ? product.split('_') : ['individual', product];
    const customerEmail = user.email || user_email || '';

    const sessionParams: any = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: success_url || `${req.headers.get('origin')}/upgrade?success=true&product=${product}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/upgrade`,
      metadata: { product, plan, billing, user_email: customerEmail },
      subscription_data: {
        metadata: { product, plan, billing, user_email: customerEmail }
      }
    };
    if (customerEmail) sessionParams.customer_email = customerEmail;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('createCheckout error', err);
    return json({ error: err.message }, 500);
  }
});
