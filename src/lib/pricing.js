export const BILLING_INTERVALS = {
  monthly: 'monthly',
  annual: 'annual',
};

export const PRICING = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Start with one useful plan.',
    monthly: { price: 'A$0', period: 'forever', note: 'No credit card needed.' },
    annual: { price: 'A$0', period: 'forever', note: 'No credit card needed.' },
    features: [
      '3 successful conversational captures total',
      '3 monthly AI gift ideas per recipient',
      'Manual occasions, people, checklists, and reminders',
      'Personal wishlist with a shareable link',
    ],
  },
  individual: {
    id: 'individual',
    name: 'Individual',
    tagline: 'For one thoughtful human with a busy brain.',
    monthly: { price: 'A$6.99', period: '/ month', note: 'Cancel any time.', savings: null },
    annual: { price: 'A$59.99', period: '/ year', note: 'A$5.00/month equivalent', savings: 'Save about 28% ✓' },
    features: [
      '30 conversational captures each month',
      '30 personalised AI gift-generation actions each month',
      'Unlimited occasions, people, budget, and delivery tracking',
      'Year in Giving and saved reflections',
      'Contextual feature tour when you want it',
    ],
    badge: 'Most Popular',
  },
  family: {
    id: 'family',
    name: 'Family',
    tagline: 'Shared planning without spoiling surprises.',
    monthly: { price: 'A$9.99', period: '/ month', note: 'Cancel any time.', savings: null },
    annual: { price: 'A$89.99', period: '/ year', note: 'A$7.50/month equivalent', savings: 'Save about 25% ✓' },
    features: [
      '60 shared conversational captures each month',
      'Owner plus five adult member accounts',
      'Four managed kid profiles',
      'Family/private occasion visibility',
      'Surprise Protection for attached gifts',
    ],
    badge: 'Best for Families',
  },
};

export const PLAN_ORDER = ['free', 'individual', 'family'];

export const planCheckoutKey = (plan, billing) => `${plan}_${billing}`;
