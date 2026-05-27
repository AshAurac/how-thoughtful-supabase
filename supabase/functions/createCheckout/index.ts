import { serve } from 'std/server';
import Stripe from 'npm:stripe@14';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');

const PRICE_IDS: Record<string, string> = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY') || 'price_monthly_placeholder',
  annual: Deno.env.get('STRIPE_PRICE_ANNUAL') || 'price_annual_placeholder'
};

const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');
const stripe = new Stripe(STRIPE_SECRET_KEY || '');

serve(async (req) => {
  try {
    const { product, user_email, success_url, cancel_url } = await req.json();
    if (!product || !PRICE_IDS[product]) return new Response(JSON.stringify({ error: 'Invalid product' }), { status: 400 });

    const priceId = PRICE_IDS[product];
    const isSubscription = product === 'annual' || product === 'monthly';

    const sessionParams: any = {
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: success_url || `${req.headers.get('origin')}/upgrade?success=true&product=${product}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/upgrade`,
      metadata: { product, user_email: user_email || '' }
    };
    if (user_email) sessionParams.customer_email = user_email;

    const session = await stripe.checkout.sessions.create(sessionParams);
    return new Response(JSON.stringify({ url: session.url, session_id: session.id }));
  } catch (err) {
    console.error('createCheckout error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
