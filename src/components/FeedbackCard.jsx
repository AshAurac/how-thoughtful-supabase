import { useState } from 'react';
import { Heart, X, Star, Lightbulb, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function FeedbackCard({ user }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('feedback_dismissed') === 'true');
  const [mode, setMode] = useState(null); // null | 'review' | 'suggestion'
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [sending, setSending] = useState(false);

  const resetForm = () => {
    setMode(null);
    setText('');
    setRating(0);
    setHovered(0);
  };

  const collapse = () => {
    localStorage.removeItem('feedback_dismissed');
    resetForm();
    setCollapsed(true);
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const subject = mode === 'review'
      ? `⭐ App Review (${rating}/5 stars) — ${user?.full_name || 'User'}`
      : `💡 Feature Suggestion — ${user?.full_name || 'User'}`;
    const body = mode === 'review'
      ? `Rating: ${rating}/5\nFrom: ${user?.full_name} (${user?.email})\n\n${text}`
      : `From: ${user?.full_name} (${user?.email})\n\n${text}`;
    try {
      await base44.integrations.Core.SendEmail({
        to: 'hello@howthoughtful.app',
        subject,
        body,
        reply_to: user?.email,
      });
      toast.success(mode === 'review' ? 'Thank you so much! 💛' : 'Idea sent! We love hearing from you 💛');
      resetForm();
      setCollapsed(true);
    } catch (err) {
      toast.error(err?.message || 'Could not send that just now.');
    } finally {
      setSending(false);
    }
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="w-full bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 text-left hover:border-terracotta/40 hover:bg-terracotta/5 transition-all"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-terracotta/10 flex items-center justify-center flex-shrink-0">
            <Heart className="w-4 h-4 text-terracotta" />
          </div>
          <div>
            <p className="font-heading font-semibold text-foreground text-sm">We'd love your thoughts</p>
            <p className="text-xs text-muted-foreground">Leave a review or share an idea</p>
          </div>
        </div>
        <span className="text-xs font-heading font-semibold text-terracotta flex-shrink-0">Open</span>
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-terracotta/10 flex items-center justify-center flex-shrink-0">
            <Heart className="w-4 h-4 text-terracotta" />
          </div>
          <div>
            <p className="font-heading font-semibold text-foreground text-sm">We'd love your thoughts</p>
            <p className="text-xs text-muted-foreground">Your feedback genuinely helps us improve</p>
          </div>
        </div>
        <button
          onClick={collapse}
          className="p-1.5 rounded-full hover:bg-muted transition-all text-muted-foreground hover:text-foreground flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {mode === null ? (
        <>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You're one of the people who makes How Thoughtful better. Whether it's a kind word or a brilliant idea — we're genuinely all ears. 🙏
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('review')}
              className="flex flex-col items-center gap-2 p-4 border border-border rounded-2xl hover:border-terracotta/40 hover:bg-terracotta/5 transition-all group"
            >
              <Star className="w-5 h-5 text-butter group-hover:text-terracotta transition-colors" />
              <span className="text-xs font-heading font-semibold text-foreground">Leave a review</span>
              <span className="text-xs text-muted-foreground text-center">Tell us what you think</span>
            </button>
            <button
              onClick={() => setMode('suggestion')}
              className="flex flex-col items-center gap-2 p-4 border border-border rounded-2xl hover:border-moss/40 hover:bg-moss/5 transition-all group"
            >
              <Lightbulb className="w-5 h-5 text-butter group-hover:text-moss transition-colors" />
              <span className="text-xs font-heading font-semibold text-foreground">Share an idea</span>
              <span className="text-xs text-muted-foreground text-center">Features or improvements</span>
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <button
            onClick={resetForm}
            className="text-xs text-muted-foreground hover:text-foreground transition-all"
          >
            ← Back
          </button>

          {mode === 'review' && (
            <div>
              <p className="text-sm font-heading font-semibold text-foreground mb-2">How would you rate How Thoughtful?</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        n <= (hovered || rating) ? 'fill-butter text-butter' : 'text-border'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-heading font-semibold text-foreground mb-1.5">
              {mode === 'review' ? 'What did you love (or what could be better)?' : 'What would make How Thoughtful even better for you?'}
            </p>
            <textarea
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={mode === 'review'
                ? "I really love how... / I'd love to see..."
                : "It would be amazing if... / I wish the app could..."}
              className="w-full border border-border rounded-2xl px-4 py-3 text-sm text-foreground bg-muted focus:outline-none focus:ring-2 focus:ring-terracotta/40 font-body resize-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !text.trim() || (mode === 'review' && rating === 0)}
            className="w-full flex items-center justify-center gap-2 bg-terracotta text-white py-3 rounded-full font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}
    </div>
  );
}
