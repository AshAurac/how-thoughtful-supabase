import { Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-sand-50 text-ink dark:bg-background dark:text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink dark:text-muted-foreground dark:hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-terracotta shadow-sm ring-1 ring-sand-200 dark:bg-card dark:ring-border">
            <Shield className="h-3.5 w-3.5" />
            Privacy Policy
          </span>
        </header>

        <main className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card sm:p-8 lg:p-10">
          <p className="text-sm uppercase tracking-[0.2em] text-terracotta">How Thoughtful</p>
          <h1 className="mt-3 text-3xl font-heading font-bold text-ink dark:text-foreground sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-ink-soft dark:text-muted-foreground">Last updated: 28 May 2026</p>

          <section className="mt-8 space-y-6 text-sm leading-7 text-ink-soft dark:text-muted-foreground">
            <p>
              This Privacy Policy explains how How Thoughtful (“we”, “our”, or “us”) collects, uses, stores, and protects
              your personal information when you use our website, mobile application, and related services (the “Service”).
            </p>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">1. Information we collect</h2>
              <p className="mt-2">
                We may collect information you provide directly, including your email address, profile details, gift lists,
                event information, and any content you submit through the Service. We also collect account and authentication
                information when you sign in using Google OAuth or email/password login through Supabase Auth.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">2. How we use your information</h2>
              <p className="mt-2">
                We use your information to provide, maintain, personalize, secure, and improve the Service; manage your account;
                send service-related communications; process payments or upgrade requests; and support customer care.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">3. Google OAuth and Supabase</h2>
              <p className="mt-2">
                When you use Google Sign-In, Google shares limited profile information with our app as permitted by your consent,
                and Supabase Auth manages your session and authentication state. We do not sell your personal data.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">4. Data storage and security</h2>
              <p className="mt-2">
                We store data in secure cloud infrastructure managed by Supabase and Vercel. We use reasonable administrative,
                technical, and physical safeguards to protect your information, but no method of transmission or electronic storage
                is 100% secure.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">5. Sharing your information</h2>
              <p className="mt-2">
                We may share information with service providers that help us operate the Service (such as hosting, analytics,
                authentication, or payment processing providers), as required by law, or to protect our rights, safety, or property.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">6. Your rights</h2>
              <p className="mt-2">
                Depending on your location, you may have rights to access, correct, delete, or restrict the processing of your
                personal information. To exercise those rights, contact us at chriscollins98@gmail.com.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">7. Cookies and tracking</h2>
              <p className="mt-2">
                We may use cookies or similar technologies to remember your preferences, keep you signed in, and improve your
                experience. You can manage cookies through your browser settings.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">8. Children’s privacy</h2>
              <p className="mt-2">
                The Service is not intended for children under 13, and we do not knowingly collect personal information from
                children without appropriate parental consent.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">9. Changes to this policy</h2>
              <p className="mt-2">
                We may update this Privacy Policy from time to time. We will post the updated version on this page with a revised
                “Last updated” date.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">10. Contact us</h2>
              <p className="mt-2">
                If you have questions about this Privacy Policy or how we handle your data, please contact us at
                <a className="font-semibold text-terracotta hover:underline" href="mailto:chriscollins98@gmail.com"> chriscollins98@gmail.com</a>.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
