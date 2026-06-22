const MILESTONES = [
  { id: 'plan', days: 30, label: 'Plan', emoji: '📋' },
  { id: 'order_online', days: 20, label: 'Order online', emoji: '🛒' },
  { id: 'buy_local', days: 7,  label: 'Buy in store', emoji: '🏪' },
  { id: 'wrap_card', days: 3,  label: 'Wrap & card', emoji: '🎁' },
  { id: 'final_touch', days: 1,  label: 'Final touch', emoji: '✨' },
  { id: 'give', days: 0,  label: 'Give!', emoji: '🎉' },
];

function getAutoStep(daysLeft) {
  if (daysLeft <= 0) return 5;
  if (daysLeft <= 1) return 4;
  if (daysLeft <= 3) return 3;
  if (daysLeft <= 7) return 2;
  if (daysLeft <= 20) return 1;
  if (daysLeft <= 30) return 0;
  return -1;
}

export default function GiftTimeline({ daysLeft, completed = [], onChange, onAllDone }) {
  const autoStep = getAutoStep(daysLeft);
  const ticked = new Set(completed);

  const toggleTick = (milestone) => {
    const next = new Set(ticked);
    if (next.has(milestone.id)) next.delete(milestone.id);
    else next.add(milestone.id);
    const values = [...next];
    onChange?.(values);
    if (values.length === MILESTONES.length) onAllDone?.();
  };

  // Highest contiguous completed step for progress bar
  const highestDone = MILESTONES.reduce((acc, milestone, i) => ticked.has(milestone.id) ? i : acc, -1);
  const progressPct = highestDone < 0 ? 0 : ((highestDone + 1) / MILESTONES.length) * 100;
  const allDone = ticked.size === MILESTONES.length;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-heading font-semibold text-sm text-foreground">Gift journey</p>
        <span className="text-xs text-muted-foreground">
          {daysLeft <= 0 ? "Today's the day! 🎉" : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} to go`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative mb-4">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-moss to-terracotta"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Milestone dots — tappable */}
      <div className="flex items-start justify-between">
        {MILESTONES.map((m, i) => {
          const done = ticked.has(m.id);
          const isActive = !done && i === autoStep;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleTick(m)}
              className="flex flex-col items-center gap-1 focus:outline-none"
              style={{ flex: 1 }}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all active:scale-90 ${
                done
                  ? 'bg-moss text-white'
                  : isActive
                    ? 'bg-terracotta text-white ring-2 ring-terracotta/30'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {done ? '✓' : m.emoji}
              </div>
              <span className={`text-center leading-tight font-body ${done ? 'text-moss font-semibold' : isActive ? 'text-terracotta font-semibold' : 'text-muted-foreground'}`}
                style={{ fontSize: '9px' }}>
                {m.label}
              </span>
              <span className="text-muted-foreground" style={{ fontSize: '8px' }}>
                {m.days === 0 ? 'Day' : `${m.days}d`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contextual tip */}
      {autoStep === 4 && !allDone && (
        <div className="mt-3 bg-terracotta/10 rounded-xl px-3 py-2">
          <p className="text-xs text-terracotta font-heading font-semibold">Pause and enjoy giving 🎁</p>
          <p className="text-xs text-muted-foreground mt-0.5">The thoughtfulness is already there. Tomorrow, just be present and grateful. This moment builds memories for next year's celebration too.</p>
        </div>
      )}
      {autoStep === 5 && (
        <div className="mt-3 bg-moss/10 rounded-xl px-3 py-2">
          <p className="text-xs text-moss font-heading font-semibold">🎉 It's the big day!</p>
          <p className="text-xs text-muted-foreground mt-0.5">Be fully present. Put your phone away. They'll remember how you made them feel.</p>
        </div>
      )}
    </div>
  );
}
