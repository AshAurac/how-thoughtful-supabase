import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-sand-50 text-ink dark:bg-background dark:text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink-soft hover:text-ink dark:text-muted-foreground dark:hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-terracotta shadow-sm ring-1 ring-sand-200 dark:bg-card dark:ring-border">
            <FileText className="h-3.5 w-3.5" />
            Terms of Service
          </span>
        </header>

        <main className="rounded-3xl border border-sand-200 bg-white p-6 shadow-sm dark:border-border dark:bg-card sm:p-8 lg:p-10">
          <p className="text-sm uppercase tracking-[0.2em] text-terracotta">How Thoughtful</p>
          <h1 className="mt-3 text-3xl font-heading font-bold text-ink dark:text-foreground sm:text-4xl">Terms of Service</h1>
          <p className="mt-3 text-sm text-ink-soft dark:text-muted-foreground">Last updated: 28 May 2026</p>

          <section className="mt-8 space-y-6 text-sm leading-7 text-ink-soft dark:text-muted-foreground">
            <p>
              By accessing or using How Thoughtful, you agree to be bound by these Terms of Service. If you do not agree,
              please do not use the Service.
            </p>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">1. Use of the Service</h2>
              <p className="mt-2">
                You may use the Service for lawful personal or business purposes. You agree not to misuse the Service, attempt to
                bypass security, interfere with other users, or upload harmful or illegal content.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">2. Accounts and authentication</h2>
              <p className="mt-2">
                You are responsible for maintaining the confidentiality of your account credentials. If you sign in using Google
                OAuth or Supabase Auth, you agree to comply with the applicable provider terms and our privacy practices.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">3. Your content</h2>
              <p className="mt-2">
                You retain ownership of the content you submit, but you grant us a license to store, process, display, and improve
                the Service using that content as needed to operate the app.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">4. Payments and subscriptions</h2>
              <p className="mt-2">
                Any paid plans or upgrades are subject to the pricing and billing terms shown in the Service. You agree to pay all
                applicable fees and charges. We may suspend or terminate access for non-payment or violation of these terms.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">5. Intellectual property</h2>
              <p className="mt-2">
                The Service, its design, text, graphics, and software are owned by How Thoughtful or its licensors. You may not
                copy, reverse engineer, or redistribute the Service except as expressly permitted.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">6. Limitation of liability</h2>
              <p className="mt-2">
                To the maximum extent permitted by law, How Thoughtful is not liable for indirect, incidental, special, or
                consequential damages arising from your use of the Service.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">7. Termination</h2>
              <p className="mt-2">
                We may suspend or terminate your access to the Service at any time for conduct we believe violates these Terms or
                harms the Service or other users.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">8. Changes to these terms</h2>
              <p className="mt-2">
                We may update these Terms of Service from time to time. Continued use of the Service after changes are posted
                means you accept the updated terms.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-heading font-semibold text-ink dark:text-foreground">9. Contact us</h2>
              <p className="mt-2">
                For questions about these Terms, contact us at
                <a className="font-semibold text-terracotta hover:underline" href="mailto:chriscollins98@gmail.com"> chriscollins98@gmail.com</a>.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
