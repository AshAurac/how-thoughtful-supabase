import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Send } from 'lucide-react';
import { Facebook } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await base44.integrations.Core.SendEmail({
        to: 'hello@howthoughtful.app',
        subject: `Contact form: ${form.name}`,
        body: `From: ${form.name} <${form.email}>\n\n${form.message}`,
        reply_to: form.email,
      });
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Could not send your message. Please email hello@howthoughtful.app instead.');
    } finally {
      setSending(false);
    }
  };

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
            <Link to="/about" className="text-xs sm:text-sm font-heading font-semibold text-ink-soft hover:text-ink transition-all">About</Link>
            <Link to="/contact" className="text-xs sm:text-sm font-heading font-semibold text-ink">Contact</Link>
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
        <p className="font-accent text-xl text-ink-soft mb-3">we'd love to hear from you</p>
        <h1 className="font-heading font-bold text-5xl text-ink leading-tight mb-6">
          Get in <span className="text-terracotta">Touch</span>
        </h1>
        <p className="text-xl text-ink-soft leading-relaxed max-w-xl mx-auto">
          Have a question, a suggestion, or just want to say hi? We read every message.
        </p>
      </section>

      <section className="px-6 pb-20 max-w-2xl mx-auto space-y-6">

        {/* Contact form */}
        <div className="bg-white border border-sand-300 rounded-3xl p-8">
          <h2 className="font-heading font-semibold text-ink text-lg mb-6">Send us a message</h2>
          {sent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-moss/15 flex items-center justify-center mx-auto mb-4">
                <Send className="w-5 h-5 text-moss-dark" />
              </div>
              <p className="font-heading font-semibold text-ink mb-1">Message sent!</p>
              <p className="text-ink-soft text-sm">We'll get back to you as soon as we can.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-heading font-semibold text-ink mb-1.5">Your name</label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full border border-sand-300 rounded-2xl px-4 py-3 text-sm text-ink bg-sand-50 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                />
              </div>
              <div>
                <label className="block text-sm font-heading font-semibold text-ink mb-1.5">Email address</label>
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="jane@example.com"
                  className="w-full border border-sand-300 rounded-2xl px-4 py-3 text-sm text-ink bg-sand-50 focus:outline-none focus:ring-2 focus:ring-terracotta/40"
                />
              </div>
              <div>
                <label className="block text-sm font-heading font-semibold text-ink mb-1.5">Message</label>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us what's on your mind..."
                  className="w-full border border-sand-300 rounded-2xl px-4 py-3 text-sm text-ink bg-sand-50 focus:outline-none focus:ring-2 focus:ring-terracotta/40 resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full bg-terracotta text-white py-3 rounded-full font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all hover:-translate-y-0.5 disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Send message'}
              </button>
              {error && <p className="text-sm text-terracotta text-center">{error}</p>}
            </form>
          )}
        </div>

        {/* Social links */}
        <div className="bg-white border border-sand-300 rounded-3xl p-8">
          <h2 className="font-heading font-semibold text-ink text-lg mb-4">Follow along</h2>
          <div className="flex gap-4">
            <a
              href="https://instagram.com/howthoughtfulapp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 border border-sand-300 rounded-full text-sm font-heading font-semibold text-ink-soft hover:text-ink hover:border-ink transition-all"
            >
              <Instagram className="w-4 h-4" /> Instagram
            </a>
            <a
              href="https://facebook.com/howthoughtfulapp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 border border-sand-300 rounded-full text-sm font-heading font-semibold text-ink-soft hover:text-ink hover:border-ink transition-all"
            >
              <Facebook className="w-4 h-4" /> Facebook
            </a>
          </div>
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
