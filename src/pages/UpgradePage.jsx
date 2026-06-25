import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Check, Home, Star } from 'lucide-react';
import { toast } from 'sonner';
import { isEmailVerified } from '@/lib/authStatus';
import { PLAN_ORDER, PRICING, planCheckoutKey } from '@/lib/pricing';

function CheckoutButton({ product, billing, label, className, user, onBlocked }) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleClick = async () => {
    setErrorMessage('');
    const isIframe = window.self !== window.top;
    if (isIframe) {
      alert('Checkout only works from the published app — please open it directly in your browser.');
      return;
    }

    if (!isEmailVerified(user)) {
      try {
        await base44.auth.resendVerificationEmail(user.email);
        onBlocked?.();
      } catch (error) {
        const message = error?.message || 'Could not send verification email.';
        setErrorMessage(message);
        toast.error(message);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('createCheckout', {
        product: planCheckoutKey(product, billing),
        user_email: user?.email || '',
        success_url: `${window.location.origin}/upgrade?success=true&product=${product}`,
        cancel_url: `${window.location.origin}/upgrade`,
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        const message = 'Could not start checkout. Please try again.';
        setErrorMessage(message);
        toast.error(message);
      }
    } catch (error) {
      const message = error?.message || 'Something went wrong. Please try again.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={handleClick} disabled={loading} className={className}>
        {loading ? 'Loading...' : label}
      </button>
      {errorMessage && (
        <p className="text-center text-xs font-medium text-terracotta">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default function UpgradePage({ user }) {
  const [billing, setBilling] = useState('annual');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const urlParams = new URLSearchParams(window.location.search);
  const successProduct = urlParams.get('success') === 'true' ? urlParams.get('product') : null;

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      return profiles[0] || null;
    },
    enabled: !!user,
  });

  const isPremium = profile?.is_premium;
  const premiumType = profile?.premium_type;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">

      {successProduct && (
        <div className="bg-moss/20 border border-moss rounded-2xl p-4 text-center">
          <p className="font-heading font-semibold text-foreground">🎉 Payment successful! Your account has been upgraded.</p>
          <p className="text-sm text-muted-foreground mt-1">It may take a moment to reflect — refresh if needed.</p>
        </div>
      )}

      <div className="text-center">
        <p className="font-accent text-2xl text-ink-soft mb-1">upgrade</p>
        <h1 className="font-heading font-bold text-3xl text-foreground">Be more thoughtful</h1>
        <p className="text-muted-foreground mt-2 mb-6">Simple AUD pricing for thoughtful planning. Cancel any time.</p>

        {/* Billing toggle */}
        <div className="inline-flex bg-muted rounded-full p-1">
          <button
            onClick={() => setBilling('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-heading font-semibold transition-all ${billing === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('annual')}
            className={`px-5 py-2 rounded-full text-sm font-heading font-semibold transition-all ${billing === 'annual' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Annual <span className="text-moss font-bold ml-1">Save up to 28%</span>
          </button>
        </div>
      </div>

      {isPremium && (
        <div className="bg-sand-100 dark:bg-muted border border-sand-300 dark:border-border rounded-2xl p-4 text-center">
          <p className="font-heading font-semibold text-foreground">
            ✨ You have {premiumType?.includes('annual') ? 'an Annual' : 'a Monthly'} subscription
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="space-y-4">
        {PLAN_ORDER.map(planId => {
          const plan = PRICING[planId];
          const price = plan[billing];
          const isFree = plan.id === 'free';
          const highlight = plan.id === 'individual';
          const isActive = isPremium && (premiumType === plan.id || premiumType?.startsWith(plan.id));
          return (
            <div
              key={plan.id}
              className={`rounded-3xl p-6 relative mt-3 bg-white dark:bg-card ${
                highlight
                  ? 'border-2 border-terracotta'
                  : 'border-2 border-sand-300 dark:border-border'
              }`}
            >
              {plan.badge && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-heading font-bold px-3 py-1 rounded-full whitespace-nowrap flex items-center gap-1 ${highlight ? 'bg-terracotta' : 'bg-ink'}`}>
                  <Star className="w-3 h-3" /> {plan.badge}
                </div>
              )}

              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="font-heading font-bold text-lg text-ink dark:text-foreground">{plan.name}</p>
                  <p className="text-xs text-ink-soft dark:text-muted-foreground">{plan.tagline}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="flex items-baseline gap-1 justify-end">
                    <span className="font-heading font-bold text-2xl text-ink dark:text-foreground">{price.price}</span>
                    <span className="text-ink-soft dark:text-muted-foreground text-xs">{price.period}</span>
                  </div>
                  {price.savings && <p className="text-xs text-moss font-semibold">{price.savings}</p>}
                  {price.note && <p className="text-xs text-terracotta font-medium">{price.note}</p>}
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {plan.features.map(perk => (
                  <li key={perk} className="flex items-center gap-2 text-sm text-ink dark:text-foreground">
                    <Check className="w-4 h-4 flex-shrink-0 text-moss" />
                    {perk}
                  </li>
                ))}
              </ul>

              {isFree ? (
                <div className="w-full text-center py-3 rounded-full text-sm font-medium bg-sand-100 dark:bg-muted text-ink-soft dark:text-muted-foreground">
                  {isActive || !isPremium ? 'Your current plan' : 'Downgrade'}
                </div>
              ) : isActive ? (
                <div className="w-full text-center py-3 rounded-full text-sm font-medium bg-sand-100 dark:bg-muted text-ink-soft dark:text-muted-foreground">
                  Active ✓
                </div>
              ) : (
                <CheckoutButton
                  product={plan.id}
                  billing={billing}
                  user={user}
                  onBlocked={() => setShowVerificationModal(true)}
                  label={`Get ${plan.name} — ${billing === 'annual' ? 'best value' : 'monthly'}`}
                  className={`w-full py-3.5 rounded-full font-heading font-semibold transition-all hover:-translate-y-0.5 text-sm ${
                    highlight
                      ? 'bg-terracotta text-white hover:bg-terracotta-dark'
                      : plan.id === 'family'
                        ? 'bg-ink text-white hover:bg-ink/90'
                        : 'border-2 border-border text-foreground hover:bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-sm text-muted-foreground pb-2">
        Free tier never goes away — curated ideas are always free.
      </div>

      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowVerificationModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold text-terracotta">Verify your email first</p>
            <h3 className="mt-2 font-heading text-xl font-bold text-foreground">You must verify your email before completing your purchase.</h3>
            <p className="mt-3 text-sm text-muted-foreground">We just sent a fresh verification link to your inbox. Please confirm it, then try your upgrade again.</p>
            <button
              onClick={() => setShowVerificationModal(false)}
              className="mt-5 w-full rounded-full bg-terracotta px-4 py-3 text-sm font-semibold text-white hover:bg-terracotta-dark transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <Link
        to="/"
        className="flex items-center justify-center gap-2 w-full border border-border text-foreground py-3.5 rounded-full font-heading font-semibold hover:bg-muted transition-all"
      >
        <Home className="w-4 h-4" />
        Back to Home
      </Link>
    </div>
  );
}
