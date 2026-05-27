import { serve } from 'jsr:std/server';
import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const stripe = new Stripe(STRIPE_SECRET_KEY || '');
const supabaseAdmin = createClient(SUPABASE_URL || '', SUPABASE_SERVICE_KEY || '');

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig || '', STRIPE_WEBHOOK_SECRET || '');
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const product = session.metadata?.product;
      const userEmail = session.metadata?.user_email;
      if (product && userEmail) {
        const { data: profiles } = await supabaseAdmin.from('user_profiles').select('*');
        const profile = profiles.find((p: any) => p.created_by === userEmail || p.email === userEmail);
        if (profile) {
          await supabaseAdmin.from('user_profiles').update({ is_premium: true, premium_type: product, premium_since: new Date().toISOString() }).eq('id', profile.id);
        }
      }
    }
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any;
      const email = subscription.metadata?.user_email;
      if (email) {
        const { data: profiles } = await supabaseAdmin.from('user_profiles').select('*');
        const profile = profiles.find((p: any) => p.created_by === email || p.email === email);
        if (profile && profile.premium_type === 'annual') {
          await supabaseAdmin.from('user_profiles').update({ is_premium: false }).eq('id', profile.id);
        }
      }
    }
  } catch (err) {
    console.error('Error processing webhook', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }));
});
