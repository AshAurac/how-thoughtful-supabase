import { Link } from 'react-router-dom';
import { daysUntil, formatEventDate, relativeDayLabel } from '@/lib/dateUtils';
import { isEventVisible } from '@/lib/eventVisibility';

// Priority weights: higher = more urgent to act on
const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1, free: 0 };

const PRIORITY_LABEL_COLOR = {
  high: 'text-terracotta',
  medium: 'text-butter-dark',
  low: 'text-moss',
  free: 'text-ink-soft',
};

// Returns next action label based on days until event
function getNextAction(days, gifts = []) {
  const allBought = gifts.length > 0 && gifts.every(g => g.bought);
  const allGiven = gifts.length > 0 && gifts.every(g => g.given || g.sent);

  if (days <= 0) return { label: 'Today!', urgent: true };
  if (allGiven) return { label: 'All done ✓', urgent: false };
  if (allBought && days <= 7) return { label: 'Wrap & give', urgent: days <= 3 };
  if (days <= 7) return { label: 'Buy now', urgent: true };
  if (days <= 14) return { label: 'Buy gift now', urgent: true };
  if (days <= 28) return { label: 'Plan gift', urgent: false };
  return { label: 'On horizon', urgent: false };
}

// Score: lower = needs attention sooner
function computeScore(event) {
  const days = daysUntil(event.event_date);
  if (days === null || days < 0) return 9999;
  const weight = PRIORITY_WEIGHT[event.priority] || 2;
  // Urgency amplified by priority weight
  return days / (weight + 0.5);
}


export default function ActionQueue({ events, gifts }) {
  // Show the next future events, even when nothing is urgent yet.
  const active = events
    .filter(e => {
      if (e.completed || !isEventVisible(e)) return false;
      const d = daysUntil(e.event_date);
      return d !== null && d >= 0 && d <= 365 * 3;
    })
    .sort((a, b) => computeScore(a) - computeScore(b))
    .slice(0, 6);

  if (active.length === 0) return null;

  const giftsByEvent = gifts.reduce((acc, g) => {
    if (!acc[g.event_id]) acc[g.event_id] = [];
    acc[g.event_id].push(g);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-semibold text-lg text-foreground">What to do next</h2>
        <span className="text-xs text-muted-foreground font-body">sorted by priority</span>
      </div>

      <div className="space-y-2">
        {active.map((event, idx) => {
          const days = daysUntil(event.event_date);
          const evtGifts = giftsByEvent[event.id] || [];
          const action = getNextAction(days, evtGifts);
          const priority = event.priority || 'medium';
          const labelColor = PRIORITY_LABEL_COLOR[priority];
          const isTop = idx === 0;

          return (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className={`block rounded-2xl border transition-all hover:-translate-y-0.5 ${
                isTop
                  ? 'bg-ink text-white border-ink hover:border-ink/80'
                  : 'bg-card border-border hover:border-terracotta/40'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isTop && (
                        <span className="text-xs bg-terracotta text-white px-2 py-0.5 rounded-full font-heading font-semibold">
                          Most urgent
                        </span>
                      )}
                      <span className={`font-heading font-semibold truncate ${isTop ? 'text-white' : 'text-foreground'}`}>
                        {event.recipient_name}
                      </span>
                      <span className={`text-xs font-medium capitalize ${isTop ? 'text-white/90' : labelColor}`}>
                        {priority === 'free' ? 'Free' : priority}
                      </span>
                    </div>
                    <p className={`text-sm mt-0.5 capitalize ${isTop ? 'text-white/85' : 'text-muted-foreground'}`}>
                      {event.occasion?.replace(/_/g, ' ')} · {formatEventDate(event.event_date)}
                    </p>
                  </div>
                  <div className="text-right flex-none">
                    <span className={`text-xs font-heading font-semibold px-2 py-1 rounded-full ${
                      action.urgent
                        ? isTop ? 'bg-terracotta text-white' : 'bg-terracotta/10 text-terracotta'
                        : isTop ? 'bg-white/25 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {action.label}
                    </span>
                    <p className={`text-xs mt-1 ${isTop ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {relativeDayLabel(days)}
                    </p>
                  </div>
                </div>


              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
