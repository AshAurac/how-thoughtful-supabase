Supabase integration notes — required env vars and deployment steps

Required environment variables (for Edge Functions / server-side):
- `VITE_SUPABASE_URL` — your Supabase project URL (used by the frontend)
- `VITE_SUPABASE_ANON_KEY` — anon public key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` — service role key (secret, used by Edge Functions)
- `VITE_APP_URL` — public URL of the deployed app (used in invite links)

Optional / provider keys:
- `SENDGRID_API_KEY` — for sending emails (SendGrid used in templates). You can swap for Mailgun or SMTP.
- `OPENAI_API_KEY` — for AI generation (InvokeLLM). Alternatives: Anthropic, local LLM.
- `STRIPE_SECRET_KEY` — for checkout sessions
- `STRIPE_WEBHOOK_SECRET` — to validate Stripe webhooks
- `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` — price IDs for your Stripe products

Quick setup
1. Run the SQL in `db/supabase_schema.sql` in the Supabase SQL editor to create tables.
2. Deploy Edge Functions in `supabase/functions/*` (templates included). Edit them to match your provider (SendGrid keys, price IDs, etc.).
3. Set the environment variables in Supabase (Project Settings → Environment Variables) and for local dev use `.env.local`.
4. If using Stripe, create a webhook pointing to the deployed `stripeWebhook` endpoint and set `STRIPE_WEBHOOK_SECRET`.

Notes on low-cost hosting
- Supabase free tier supports hosting Postgres and Edge Functions with modest usage. Use SendGrid free tier and OpenAI pay-as-you-go carefully to minimize cost.
- For email you can also configure your own SMTP or use Supabase's SMTP integration through third-party providers.
