import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

const PRICE_IDS: Record<string, string> = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY') || 'price_monthly_placeholder',
  annual: Deno.env.get('STRIPE_PRICE_ANNUAL') || 'price_annual_placeholder',
  individual_monthly: Deno.env.get('STRIPE_PRICE_INDIVIDUAL_MONTHLY') || Deno.env.get('STRIPE_PRICE_MONTHLY') || 'price_individual_monthly_placeholder',
  individual_annual: Deno.env.get('STRIPE_PRICE_INDIVIDUAL_ANNUAL') || Deno.env.get('STRIPE_PRICE_ANNUAL') || 'price_individual_annual_placeholder',
  family_monthly: Deno.env.get('STRIPE_PRICE_FAMILY_MONTHLY') || 'price_family_monthly_placeholder',
  family_annual: Deno.env.get('STRIPE_PRICE_FAMILY_ANNUAL') || 'price_family_annual_placeholder'
};

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');
const stripe = new Stripe(STRIPE_SECRET_KEY || '');

serve(async (req) => {
  try {
    const { product, user_email, success_url, cancel_url } = await req.json();
    if (!product || !PRICE_IDS[product]) return new Response(JSON.stringify({ error: 'Invalid product' }), { status: 400 });

    const priceId = PRICE_IDS[product];
    if (priceId.includes('placeholder')) {
      return new Response(JSON.stringify({ error: `Stripe price for ${product} is not configured` }), { status: 500 });
    }

    const [plan, billing] = product.includes('_') ? product.split('_') : ['individual', product];

    const sessionParams: any = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: success_url || `${req.headers.get('origin')}/upgrade?success=true&product=${product}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/upgrade`,
      metadata: { product, plan, billing, user_email: user_email || '' },
      subscription_data: {
        metadata: { product, plan, billing, user_email: user_email || '' }
      }
    };
    if (user_email) sessionParams.customer_email = user_email;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return new Response(JSON.stringify({ url: session.url, session_id: session.id }));
  } catch (err) {
    console.error('createCheckout error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
