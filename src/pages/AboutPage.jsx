import { Link } from 'react-router-dom';
import { Sparkles, Bell, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-sand-50 font-body">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-sand-50/90 backdrop-blur-xl border-b border-sand-300 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/welcome" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src="https://media.base44.com/images/public/6a1188b0e669a81e5b3530ea/5247e49c3_RealLogo.png" alt="How Thoughtful" className="w-8 h-8" />
            <span className="font-heading font-bold text-ink">How Thoughtful</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/about" className="text-xs sm:text-sm font-heading font-semibold text-ink">About</Link>
            <Link to="/contact" className="text-xs sm:text-sm font-heading font-semibold text-ink-soft hover:text-ink transition-all">Contact</Link>
            <button
              onClick={() => base44.auth.redirectToLogin(window.location.origin)}
              className="bg-terracotta text-white px-3 sm:px-5 py-2 rounded-full font-heading font-semibold text-xs sm:text-sm hover:bg-terracotta-dark transition-all hover:-translate-y-0.5"
            >
              Log in
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-12 text-center max-w-3xl mx-auto">
        <p className="font-accent text-xl text-ink-soft mb-3">our story</p>
        <h1 className="font-heading font-bold text-5xl text-ink leading-tight mb-6">
          About <span className="text-terracotta">How Thoughtful</span>
        </h1>
        <p className="text-xl text-ink-soft leading-relaxed max-w-xl mx-auto">
          A calm, personal tool built for people who care — but can't always keep up.
        </p>
      </section>

      {/* Main content */}
      <section className="px-6 pb-20 max-w-2xl mx-auto">
        <div className="bg-white border border-sand-300 rounded-3xl p-8 md:p-12 space-y-6 text-ink leading-relaxed">
          <p>
            How Thoughtful was born from a simple frustration: caring deeply about the people in your life, but struggling to show it consistently. Birthdays crept up unannounced. Anniversaries passed with last-minute scrambles. Meaningful gifts were replaced by generic ones — not because of a lack of love, but because life is busy and memory is fallible.
          </p>
          <p>
            We built How Thoughtful to be the gentle system that holds those details for you. It remembers the occasions, tracks the people, stores gift ideas, and sends you a nudge well before you need to act — so when the moment arrives, you're ready, not rushing.
          </p>
          <p>
            The app is designed for anyone who wants to be more intentional about the relationships that matter. Whether you're keeping track of a small circle of close friends or managing birthdays and anniversaries across a big family, How Thoughtful fits around your life without adding noise.
          </p>
          <p>
            We believe that thoughtfulness is a practice, not just a personality trait. With the right tools and gentle reminders, anyone can show up with warmth, intention, and real care — consistently.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            {[
              { icon: Bell, title: 'Smart reminders', desc: 'Never scramble at the last minute again.' },
              { icon: Sparkles, title: 'Meaningful ideas', desc: 'Gift inspiration personalised to who they are.' },
              { icon: Users, title: 'Built for real life', desc: 'Simple, calm, and designed to reduce mental load.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-sand-50 border border-sand-300 rounded-2xl p-5 text-center">
                <div className="w-9 h-9 rounded-xl bg-terracotta/10 flex items-center justify-center mx-auto mb-3">
                  <Icon className="w-4 h-4 text-terracotta" />
                </div>
                <h3 className="font-heading font-semibold text-ink text-sm mb-1">{title}</h3>
                <p className="text-xs text-ink-soft">{desc}</p>
              </div>
            ))}
          </div>

          <p className="text-ink-soft italic font-accent text-lg text-center pt-2">
            Made with care, for people who care.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 bg-ink text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <img src="https://media.base44.com/images/public/6a1188b0e669a81e5b3530ea/5247e49c3_RealLogo.png" alt="How Thoughtful" className="w-6 h-6" />
          <span className="font-heading font-bold text-white text-sm">How Thoughtful</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 mb-3">
          <Link to="/welcome" className="text-white/60 text-xs hover:text-white transition-all">Home</Link>
          <Link to="/about" className="text-white/60 text-xs hover:text-white transition-all">About</Link>
          <Link to="/contact" className="text-white/60 text-xs hover:text-white transition-all">Contact</Link>
          <Link to="/privacy" className="text-white/60 text-xs hover:text-white transition-all">Privacy Policy</Link>
          <Link to="/terms" className="text-white/60 text-xs hover:text-white transition-all">Terms of Service</Link>
        </div>
        <p className="text-white/40 text-xs">Made for people who care about the people they love.</p>
      </footer>
    </div>
  );
}