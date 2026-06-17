# How Thoughtful — Design Document

> "Remember the little things that matter most."
> "Because caring shouldn't rely on memory alone."

---

## Product Purpose

How Thoughtful is a personal gifting companion that helps people show up for the people they love — consistently and with intention. It is not a shopping app. It is a memory and care system.

The core promise: you care deeply about people, but life is busy and memory is fallible. How Thoughtful holds the details — dates, preferences, budgets, love languages, gift history — so when an occasion arrives, you're ready, not scrambling.

The app is designed to reduce mental load while increasing the quality of care expressed. It targets people who already want to be thoughtful, but need a gentle system to make it reliable.

---

## Taglines & Copy (from source)

- **Hero**: "Remember the little things that matter most"
- **Sub-hero**: "Because caring shouldn't rely on memory alone"
- **Pain point framing**: "You're a caring person. You just need a gentle system to hold it all."
- **CTA**: "Start being more thoughtful"
- **Free tier promise**: "Free forever. No credit card needed."
- **Value frame**: "Less mental load. More genuine connection."
- **Tone**: calm, warm, grateful, slightly poetic

---

## Visual Identity

### Color Palette

All colors are defined as CSS custom properties in `index.css` and mapped in `tailwind.config.js`.

| Token | Hex / HSL | Use |
|---|---|---|
| `terracotta` | `#E07A5F` | Primary actions, urgency, active nav, CTA buttons |
| `terracotta-dark` | `#C96B52` | Hover state for terracotta |
| `moss` | `#81B29A` | Success states, AI/curated features, secondary actions |
| `moss-dark` | `#6B9C84` | Hover for moss |
| `butter` | `#F2CC8F` | Star ratings, highlights, accent warmth |
| `butter-dark` | `#D9B26B` | Hover for butter |
| `ink` | `#3D405B` | Primary text on light backgrounds |
| `ink-soft` | `#6B6E85` | Secondary / muted text |
| `sand-50` | `#FBF8F1` | Page background (landing, public pages) |
| `sand-100` | `#F4EFE3` | Section backgrounds, CTA blocks |
| `sand-200` | `#EAE3D2` | Borders, dividers |
| `sand-300` | `#EAE7DF` | Card borders on landing |
| `background` | `hsl(40 33% 97%)` light / `hsl(235 21% 10%)` dark | App shell background |
| `card` | `hsl(0 0% 100%)` light / `hsl(235 21% 15%)` dark | Card surfaces |
| `muted` | `hsl(38 35% 93%)` light | Muted backgrounds, toggles |
| `border` | `hsl(38 22% 85%)` light | Borders inside the app |

**Urgency color logic** (from `lib/dateUtils.js`):
- ≤ 3 days: `text-terracotta font-semibold`
- ≤ 7 days: `text-terracotta`
- ≤ 14 days: `text-butter-dark`
- > 14 days: `text-ink-soft`

### Typography

Defined in `index.css` via Google Fonts, mapped in `tailwind.config.js`:

| Class | Font | Use |
|---|---|---|
| `font-heading` | Manrope (400/600/700/800) | All headings, labels, buttons, nav items |
| `font-body` | Figtree (400/500/600) | Body copy, form inputs, paragraphs |
| `font-accent` | Caveat (400/600) | Decorative labels, "our story", "about you", section intros |

**Type scale patterns:**
- Page titles: `font-heading font-bold text-2xl` (in-app) / `text-5xl md:text-6xl` (landing)
- Section labels: `font-accent text-xl text-ink-soft` or `text-muted-foreground`
- Card titles: `font-heading font-semibold text-sm` or `text-lg`
- Body text: `font-body text-sm` (standard), `text-xs` (secondary/meta)

### Border Radius

Set by `--radius: 1rem`. Scales:
- `rounded-full` — pill buttons, nav items, avatar circles, tags
- `rounded-3xl` — modals, landing cards, large panels
- `rounded-2xl` — in-app cards, input fields, form sections
- `rounded-xl` — small chips, inner cards
- `rounded-lg` / `rounded-md` — minor elements

### Spacing & Layout

- Max content width: `max-w-3xl` (in-app), `max-w-5xl` (landing)
- Standard page padding: `px-4 py-6 md:py-10`
- Card padding: `p-5` (compact), `p-6`–`p-8` (standard)
- Section spacing in forms: `space-y-5` or `space-y-6`
- Safe area variables: `--safe-top`, `--safe-bottom`, `--safe-left`, `--safe-right` (for mobile)

### Animations

Defined in `index.css`:
- `animate-float-up` — confetti/celebration floating
- `animate-shimmer` — loading placeholder pulse
- `animate-fade-up` — page section entrance
- `framer-motion` — used for page transitions, modal entrances, confetti

---

## App Architecture

### Routing (App.jsx)

The app has two modes:
1. **Public / unauthenticated** — `/welcome`, `/about`, `/contact`, `/w/:token` (public wishlist), `/group/:token`, `/join-event/:token`
2. **Authenticated app** — wrapped in `<AppShell>`, requires login via `<RequireAuth>`

The home route `/` renders `<LandingPage>` for unauthenticated users and `<Dashboard>` for authenticated users.

### Shell (AppShell)

- Sticky top bar with logo + greeting + upgrade CTA
- Floating bottom pill nav: **Home / Calendar / Ideas / More**
- `More` drawer exposes: People, Budget, Deliveries, Saved, Groups, Restock, Wishlist, Year in Giving, Profile
- Tab history is preserved in a `useRef` so switching tabs restores last visited path
- Dark mode is synced from `localStorage` or system preference

### Primary Navigation Paths

| Route | Page | Label |
|---|---|---|
| `/` | Dashboard | Home |
| `/calendar` | CalendarPage | Calendar |
| `/ideas` | IdeasPage | Ideas |
| `/events` | EventsList | Occasions |
| `/events/:id` | EventDetail | Occasion |
| `/recipients` | RecipientsPage | People |
| `/recipients/:id` | RecipientDetail | Person |
| `/budget` | BudgetPage | Budget |
| `/deliveries` | DeliveriesPage | Deliveries |
| `/saved` | SavedIdeasPage | Saved Ideas |
| `/group-lists` | SharedListsPage | Groups |
| `/wishlist` | WishlistPage | My Wishlist |
| `/year-in-giving` | YearInGiving | Year in Giving |
| `/profile` | ProfilePage | Profile |
| `/upgrade` | UpgradePage | Upgrade |
| `/season` | SeasonPage | Season |

---

## Data Model (Entities)

### Event
The core record. Represents one gifting occasion.

Key fields: `recipient_name`, `recipient_id`, `occasion`, `event_date`, `budget`, `priority` (free/low/medium/high), `recurring`, `completed`, `love_language`, `age_or_years`, `giver_name`, `notes`, `reflection`, `collaborator_emails`, `invite_token`

Occasion types: `birthday`, `anniversary`, `holiday`, `graduation`, `baby_shower`, `wedding`, `housewarming`, `thank_you`, `just_because`, `other`

Priority colors (from `PriorityBadge`): free → muted, low → blue-ish, medium → butter, high → terracotta

### Recipient
A person being gifted to. Key fields: `name`, `relationship`, `age`, `interests[]`, `notes`, `love_language`, `avatar_url`

### Gift
A specific gift item attached to an Event. Tracks full lifecycle: `bought`, `wrapped`, `card_written`, `given`, `delivery_status` (none/ordered/shipped/delivered), `tracking_url`, `expected_arrival`, `order_number`

### GiftHistory
Archived record after an event is completed. Preserves `gifts_given[]`, `total_spent`, `reflection`.

### UserProfile
The giver's profile — informs AI suggestions. Key fields: `skills[]`, `love_languages_give[]`, `love_languages_receive[]`, `work`, `personality`, `free_text`, `intention`, `intention_year`, `timezone`, `is_premium`, `premium_type`, `monthly_ai_uses`, `monthly_ai_reset_month`, feature flags.

### Feature Flags (on UserProfile)
`feature_budget`, `feature_deliveries`, `feature_saved`, `feature_group_lists`, `feature_restock`, `feature_wishlist`, `feature_year_in_giving`

These are user-toggled in Profile → Features panel. The idea is progressive disclosure — features unlock as you use the app, or can be manually enabled.

### Wishlist
Shareable wishlist. Fields: `title`, `items[]` (name/description/link/price/priority), `share_token`, `is_public`

### SharedList
Group gifting or Secret Santa list. Fields: `title`, `recipient_name`, `list_type` (group_gift/secret_santa), `members[]`, `share_token`, `santa_assigned`

### SharedListItem
Items on a SharedList with claiming: `is_claimed`, `claimed_by_name`, `claimed_by_email`

### SavedIdea
Pinned gift ideas from the Ideas page: `name`, `description`, `estimated_price`, `why_it_works`, `recipient_name`, `event_id`, `link`

---

## Core Logic

### Date & Urgency System (`lib/dateUtils.js`)

Buy timeline computed automatically from `event_date`:
- **Order online by**: event − 28 days
- **Buy locally by**: event − 14 days
- **Wrap by**: event − 3 days

Urgency thresholds drive color coding throughout the app (see Visual Identity → urgency color logic above).

### Gift Ideas System (`lib/catalogs.js`)

Two modes:

1. **Curated / Free** — `getCuratedIdeas(skills, loveLanguage, recipientInterests, occasion)` — no API call. Matches giver skills to recipient interests, then fills with universal free ideas, prioritised by love language.

2. **AI-generated** — LLM call via `base44.integrations.Core.InvokeLLM`. Gated by subscription tier:
   - Free: 3 uses/month (tracked in `localStorage` with key `ai_uses_YYYY-MM`)
   - Individual: 30 uses/month (tracked on `UserProfile.monthly_ai_uses`)
   - Family: 30 uses/month

**Thoughtfulness Boosters**: Suggestions for elevating any gift based on the recipient's love language (from `THOUGHTFULNESS_BOOSTERS` in catalogs).

### Feature Flags (`hooks/useFeatureFlags.js`)

Reads from `UserProfile`, exposes `isUnlocked(key)`, `unlock(key)`, `toggle(key, value)`. Used to progressively reveal app sections.

### Free AI Counter

`getFreeUsesRemaining()` in AppShell reads from `localStorage` key `ai_uses_YYYY-MM` and returns `Math.max(0, 3 - used)`. Shown in Ideas page and used to gate AI generation.

---

## Subscription / Monetisation

### Plans

| Plan | Price (AUD) | AI Ideas/mo | Occasions | Collaborators |
|---|---|---|---|---|
| Free | $0 | 3 | 6 | — |
| Individual | $3.99/mo or $24.99/yr | 30 | Unlimited | 1 per occasion |
| Family | $5.99/mo or $49.99/yr | 30 | Unlimited | 6 per occasion, 6 accounts |

Annual savings: Individual saves 48%, Family saves 30%.

### Stripe

- Backend function: `createCheckout` — creates Stripe Checkout session
- Backend function: `stripeWebhook` — handles `checkout.session.completed`, updates `UserProfile.is_premium`, `premium_type`
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` stored as secrets
- Checkout blocked in iframes (alert shown)

---

## Backend Functions

| Function | Purpose |
|---|---|
| `createCheckout` | Creates Stripe Checkout session for Individual/Family plans |
| `stripeWebhook` | Handles Stripe payment webhooks, upgrades user profile |
| `sendEventReminders` | Sends email reminders at 30/14/3 days before occasions |
| `sendEventInvite` | Sends collaborator invite email with invite token |
| `acceptEventInvite` | Validates token, adds collaborator to event |
| `assignSecretSanta` | Randomly assigns Secret Santa pairings for SharedList |

---

## Key Components

| Component | Purpose |
|---|---|
| `AppShell` | Layout wrapper — header, bottom nav, More drawer |
| `MoreSheet` | Bottom sheet with secondary nav items |
| `NativePicker` | Mobile-native bottom sheet picker (replaces `<select>`) |
| `BulkImportEvents` | CSV import modal for occasions |
| `BulkImportRecipients` | CSV import modal for people |
| `ActionQueue` | Dashboard priority queue — events within 90 days |
| `GiftTimeline` | Buy-by milestone tracker per event |
| `EventChecklist` | Occasion-specific task checklists |
| `ShareEventButton` | Invite collaborators by email |
| `PaywallModal` | Upgrade prompt when AI limit hit |
| `FeedbackCard` | Review / suggestion form on profile page |
| `PriorityBadge` | Colored badge for free/low/medium/high priority |
| `PageTransition` | Framer Motion page fade |
| `GiftWrapAnimation` | Celebratory gift-wrapping animation on completion |

---

## Public Pages (No Auth)

| Route | Page | Notes |
|---|---|---|
| `/welcome` | LandingPage | Full marketing page with pricing |
| `/about` | AboutPage | Brand story |
| `/contact` | ContactPage | Contact form + Instagram + Facebook |
| `/w/:token` | PublicWishlist | Shareable wishlist view |
| `/group/:token` | PublicGroupList | Shareable group gift list |
| `/join-event/:token` | JoinEventPage | Accept event collaboration invite |

All public pages share the same nav pattern: logo image + nav links + "Log in" button.

Logo URL: `https://media.base44.com/images/public/6a1188b0e669a81e5b3530ea/5247e49c3_RealLogo.png`

Social links: `instagram.com/howthoughtfulapp`, `facebook.com/howthoughtfulapp`
Contact email: `hello@howthoughtful.app`

---

## Design Goals & Principles

1. **Calm over busy** — The app should feel like a relief to open, not a task. Whitespace, rounded forms, warm palette.
2. **Warm over clinical** — Everything should feel human. `font-accent` (Caveat) for section intros. Terracotta > blue. Sentences that sound like a caring friend.
3. **Progressive disclosure** — Features unlock gradually. Don't overwhelm new users. The `MoreSheet` hides advanced features until they're relevant.
4. **Mobile-first, always** — Safe area insets respected everywhere. Min touch target `min-h-[44px]`. Bottom sheet pickers instead of native `<select>`. Pull-to-refresh on list pages.
5. **Data informs AI, AI elevates data** — The more a user fills in about recipients (love language, interests, relationship), the better the AI suggestions. The app communicates this value explicitly.
6. **Gifting as an expression of love, not a chore** — Copy, features, and tone should always reinforce that being thoughtful is a practice anyone can build — not a personality trait you either have or don't.

---

## Terminology (use consistently)

| Term | Not | Context |
|---|---|---|
| Occasion | Event, appointment | The gifting moment being tracked |
| Person / People | Contact, recipient list | In nav and empty states |
| Recipient | N/A | On individual event/gift forms |
| Ideas | Suggestions, recommendations | Ideas page, nav |
| Curated ideas | Free ideas, built-in | Non-AI gift suggestions |
| AI ideas | Personalised ideas | LLM-generated suggestions |
| Thoughtfulness booster | Tips | Ways to elevate any gift |
| Upgrade | Premium, Pro | Subscription CTA |
| Year in Giving | Annual review | End-of-year gifting summary |
| Restock | Supply tracker | Go-to gifts to keep in stock |
| Groups | Group gifting | SharedList feature |
