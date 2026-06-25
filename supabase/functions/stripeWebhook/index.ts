import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import Stripe from 'npm:stripe@18';
import { createClient } from 'npm:@supabase/supabase-js';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover' as any,
});
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const priceEntitlements = () => {
  const entries: Array<[string | undefined, { plan: 'individual' | 'family'; interval: 'monthly' | 'annual'; premiumType: string }]> = [
    [Deno.env.get('STRIPE_PRICE_INDIVIDUAL_MONTHLY'), { plan: 'individual', interval: 'monthly', premiumType: 'individual_monthly' }],
    [Deno.env.get('STRIPE_PRICE_INDIVIDUAL_ANNUAL'), { plan: 'individual', interval: 'annual', premiumType: 'individual_annual' }],
    [Deno.env.get('STRIPE_PRICE_FAMILY_MONTHLY'), { plan: 'family', interval: 'monthly', premiumType: 'family_monthly' }],
    [Deno.env.get('STRIPE_PRICE_FAMILY_ANNUAL'), { plan: 'family', interval: 'annual', premiumType: 'family_annual' }],
  ];
  return new Map(entries.filter(([id]) => Boolean(id)) as Array<[string, { plan: 'individual' | 'family'; interval: 'monthly' | 'annual'; premiumType: string }]>);
};

async function markProcessed(event: Stripe.Event) {
  const { error } = await supabaseAdmin
    .from('stripe_processed_events')
    .insert({ event_id: event.id, event_type: event.type });
  if (!error) return true;
  if (String(error.message || '').toLowerCase().includes('duplicate')) return false;
  throw error;
}

async function findProfileByEmailOrCustomer(email?: string | null, customer?: string | null) {
  if (customer) {
    const { data, error } = await supabaseAdmin.from('user_profiles').select('*').eq('stripe_customer_id', customer).limit(1);
    if (error) throw error;
    if (data?.[0]) return data[0];
  }
  if (email) {
    const { data, error } = await supabaseAdmin.from('user_profiles').select('*').or(`created_by.eq.${email},email.eq.${email}`).limit(1);
    if (error) throw error;
    return data?.[0] || null;
  }
  return null;
}

async function ensureFamilyForOwner(profile: Record<string, unknown>, email: string, customer: string | null, subscriptionId: string | null) {
  if (profile.family_id) return profile.family_id as string;

  const familyName = profile.full_name ? `${profile.full_name}'s family` : 'My family';
  const { data: family, error: familyError } = await supabaseAdmin
    .from('families')
    .insert({
      name: familyName,
      owner_email: email,
      created_by: email,
      stripe_customer_id: customer,
      stripe_subscription_id: subscriptionId,
      subscription_status: 'active',
    })
    .select()
    .single();
  if (familyError) throw familyError;

  const { error: memberError } = await supabaseAdmin.from('family_members').upsert({
    family_id: family.id,
    email,
    role: 'owner',
    invitation_state: 'accepted',
    accepted_at: new Date().toISOString(),
  }, { onConflict: 'family_id,email' });
  if (memberError) throw memberError;

  return family.id as string;
}

async function applySubscription(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price?.id;
  const entitlement = priceEntitlements().get(priceId || '');
  if (!entitlement) return;

  const email = subscription.metadata?.user_email
    || (typeof subscription.customer === 'string' ? null : subscription.customer?.email)
    || null;
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null;
  const profile = await findProfileByEmailOrCustomer(email, customer);
  if (!profile) return;

  const userEmail = String(profile.email || profile.created_by || email || '').toLowerCase();
  let familyId = entitlement.plan === 'family'
    ? await ensureFamilyForOwner(profile, userEmail, customer, subscription.id)
    : null;

  if (entitlement.plan !== 'family' && profile.family_id) {
    familyId = null;
  }

  await supabaseAdmin.from('user_profiles').update({
    is_premium: subscription.status === 'active' || subscription.status === 'trialing',
    premium_type: entitlement.premiumType,
    premium_since: new Date(subscription.created * 1000).toISOString(),
    stripe_customer_id: customer,
    stripe_subscription_id: subscription.id,
    subscription_plan: entitlement.plan,
    billing_interval: entitlement.interval,
    subscription_status: subscription.status,
    subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    family_id: familyId,
  }).eq('id', profile.id);

  if (entitlement.plan === 'family' && familyId) {
    await supabaseAdmin.from('families').update({
      stripe_customer_id: customer,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    }).eq('id', familyId);
  }
}

async function clearSubscription(subscription: Stripe.Subscription) {
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null;
  const email = subscription.metadata?.user_email || null;
  const profile = await findProfileByEmailOrCustomer(email, customer);
  if (!profile) return;

  await supabaseAdmin.from('user_profiles').update({
    is_premium: false,
    premium_type: null,
    subscription_plan: 'free',
    billing_interval: null,
    subscription_status: subscription.status,
    subscription_current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
  }).eq('id', profile.id);

  if (profile.family_id) {
    await supabaseAdmin.from('families').update({
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    }).eq('id', profile.family_id);
  }
}

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig || '', STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err instanceof Error ? err.message : err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    const shouldProcess = await markProcessed(event);
    if (!shouldProcess) return new Response(JSON.stringify({ received: true, duplicate: true }));

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription), {
          expand: ['customer', 'items.data.price'],
        });
        await applySubscription(subscription);
      }
    }

    if (event.type === 'customer.subscription.updated') {
      await applySubscription(event.data.object as Stripe.Subscription);
    }

    if (event.type === 'customer.subscription.deleted') {
      await clearSubscription(event.data.object as Stripe.Subscription);
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(invoice.subscription), {
          expand: ['customer', 'items.data.price'],
        });
        await applySubscription(subscription);
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(invoice.subscription), {
          expand: ['customer', 'items.data.price'],
        });
        await applySubscription(subscription);
      }
    }
  } catch (err) {
    console.error('Error processing webhook', err instanceof Error ? err.message : err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Webhook processing failed' }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
