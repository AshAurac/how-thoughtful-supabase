import { Link } from 'react-router-dom';
import { PiggyBank, Package, Bookmark, Star, User, Heart, X, Gift, Sparkles, CreditCard, Users } from 'lucide-react';

const ITEMS = [
  { path: '/ideas', icon: Sparkles, label: 'Generate ideas', color: 'text-terracotta', hint: 'When you want inspiration' },
  { path: '/budget', icon: PiggyBank, label: 'Budget', color: 'text-butter-dark', hint: 'Shows up naturally after budgets' },
  { path: '/deliveries', icon: Package, label: 'Deliveries', color: 'text-terracotta', hint: 'Track orders and arrivals' },
  { path: '/saved', icon: Bookmark, label: 'Saved ideas', color: 'text-terracotta', hint: 'Ideas live with people too' },
  { path: '/group-lists', icon: Gift, label: 'Group gifting', color: 'text-moss', hint: 'For collaborators' },
  { path: '/family', icon: Users, label: 'Family', color: 'text-moss', hint: 'Members and kid profiles' },
  { path: '/wishlist', icon: Heart, label: 'Wishlist', color: 'text-moss', hint: 'Capture things you want' },
  { path: '/year-in-giving', icon: Star, label: 'Year in Giving', color: 'text-terracotta', hint: 'After gifts are given' },
  { path: '/upgrade', icon: CreditCard, label: 'Plans', color: 'text-ink-soft', hint: 'Individual and Family' },
  { path: '/profile', icon: User, label: 'Profile', color: 'text-muted-foreground', hint: 'Settings and preferences' },
];

export default function MoreSheet({ open, onClose }) {
  if (!open) return null;

  const restartTour = () => {
    localStorage.removeItem('howThoughtfulTourDismissed');
    localStorage.removeItem('howThoughtfulTourCompleted');
    window.dispatchEvent(new Event('how-thoughtful-tour-restart'));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end select-none" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full bg-card rounded-t-3xl shadow-2xl"
        style={{ paddingBottom: 'var(--safe-bottom)', paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-heading font-bold text-foreground text-lg">More</h3>
              <p className="text-xs text-muted-foreground">No blocked maze — just tools when you need them.</p>
            </div>
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-all"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {ITEMS.map(({ path, icon: Icon, label, color, hint }) => (
              <Link
                key={path}
                to={path}
                onClick={onClose}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-muted transition-all min-h-[96px] justify-center text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <span className="text-xs text-foreground font-heading font-semibold leading-tight">{label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{hint}</span>
              </Link>
            ))}
          </div>

          <button
            onClick={restartTour}
            className="mt-5 w-full rounded-2xl border border-border py-3 text-sm font-heading font-semibold text-foreground hover:bg-muted"
          >
            Show me around again
          </button>
        </div>
      </div>
    </div>
  );
}
