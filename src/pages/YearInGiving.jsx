import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, parseISO, isValid, getMonth } from 'date-fns';
import { ChevronDown } from 'lucide-react';

const HEARTS = Array.from({ length: 16 });
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function FloatingHeart({ style }) {
  return (
    <div
      className="absolute text-terracotta/20 text-2xl select-none pointer-events-none animate-float-up"
      style={style}
    >
      ♥
    </div>
  );
}

function StatCard({ eyebrow, value, label, delay }) {
  return (
    <div
      className="bg-card border border-border rounded-2xl p-5 animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="font-accent text-muted-foreground text-base mb-1">{eyebrow}</p>
      <p className="font-heading font-bold text-3xl text-foreground">{value}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function PersonHistoryCard({ name, entries }) {
  const [open, setOpen] = useState(false);
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="w-9 h-9 rounded-full bg-terracotta/10 text-terracotta font-heading font-bold text-sm flex items-center justify-center flex-shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{entries.length} gift{entries.length !== 1 ? 's' : ''} given</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {entries.map((entry, i) => (
            <div key={i} className="bg-muted rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-heading font-semibold text-sm text-foreground capitalize">
                  {entry.occasion?.replace(/_/g, ' ')}
                </span>
                <span className="text-xs text-muted-foreground">
                  {entry.event_date ? format(parseISO(entry.event_date), 'MMM d, yyyy') : entry.year}
                </span>
              </div>

              {entry.gifts_given?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Gifts given:</p>
                  <div className="flex flex-wrap gap-1">
                    {entry.gifts_given.map((g, gi) => (
                      <span key={gi} className="text-xs bg-card border border-border rounded-full px-2 py-0.5 text-foreground">
                        {g.name}{g.price ? ` · $${g.price}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {entry.total_spent > 0 && (
                <p className="text-xs text-muted-foreground">Total spent: <span className="text-foreground font-medium">${entry.total_spent}</span></p>
              )}

              {entry.reflection && (
                <p className="text-xs text-moss-dark italic">"{entry.reflection}"</p>
              )}

              {entry.notes && (
                <p className="text-xs text-muted-foreground">Notes: {entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function YearInGiving({ user }) {
  const year = new Date().getFullYear();

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ['gifts'],
    queryFn: () => base44.entities.Gift.list(),
  });

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      return profiles[0] || null;
    },
    enabled: !!user,
  });

  // Compute stats
  const yearEvents = events.filter(e => {
    const d = parseISO(e.event_date);
    return isValid(d) && d.getFullYear() === year;
  });

  const totalSpent = gifts.reduce((s, g) => s + (g.price || 0), 0);
  const freeGifts = gifts.filter(g => !g.price || g.price === 0).length;
  const givenGifts = gifts.filter(g => g.given || g.sent).length;

  // Top person
  const recipientCount = {};
  yearEvents.forEach(e => {
    recipientCount[e.recipient_name] = (recipientCount[e.recipient_name] || 0) + 1;
  });
  const topPerson = Object.entries(recipientCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  // Busiest month
  const monthCount = Array(12).fill(0);
  yearEvents.forEach(e => {
    const d = parseISO(e.event_date);
    if (isValid(d)) monthCount[getMonth(d)]++;
  });
  const busiestMonthIdx = monthCount.indexOf(Math.max(...monthCount));
  const busiestMonth = monthCount[busiestMonthIdx] > 0 ? MONTHS[busiestMonthIdx] : '—';

  const firstName = user?.full_name?.split(' ')[0] || 'you';

  const { data: giftHistory = [] } = useQuery({
    queryKey: ['giftHistory', user?.email],
    queryFn: () => base44.entities.GiftHistory.filter({ created_by: user?.email }, '-created_date'),
    enabled: !!user?.email,
  });

  // Group history by recipient
  const historyByRecipient = giftHistory.reduce((acc, h) => {
    const key = h.recipient_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(h);
    return acc;
  }, {});

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Floating hearts background */}
      {HEARTS.map((_, i) => (
        <FloatingHeart
          key={i}
          style={{
            left: `${(i * 6.25) % 100}%`,
            bottom: '-20px',
            animationDuration: `${6 + (i % 5) * 2}s`,
            animationDelay: `${(i * 0.8) % 8}s`,
            fontSize: `${16 + (i % 3) * 8}px`,
          }}
        />
      ))}

      <div className="relative z-10 space-y-6">
        <div className="text-center pt-4">
          <p className="font-accent text-2xl text-terracotta mb-2">your {year}</p>
          <h1 className="font-heading font-bold text-4xl text-foreground">Year in Giving</h1>
          <p className="text-muted-foreground mt-2">
            {firstName}, here's how you showed up for the people you love.
          </p>
        </div>

        {/* 2×2 stat grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard eyebrow="occasions" value={yearEvents.length} label="people celebrated" delay={500} />
          <StatCard eyebrow="gifts" value={givenGifts} label="given with intention" delay={700} />
          <StatCard eyebrow="spent" value={`$${Math.round(totalSpent)}`} label="on those you love" delay={900} />
          <StatCard eyebrow="free gifts" value={freeGifts} label="gifts of time & skill" delay={1100} />
        </div>

        {/* Top person */}
        <div
          className="bg-muted border border-border rounded-2xl p-5 animate-fade-up"
          style={{ animationDelay: '1300ms' }}
        >
          <p className="font-accent text-muted-foreground text-base mb-1">most celebrated</p>
          <p className="font-heading font-bold text-2xl text-foreground">{topPerson}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{recipientCount[topPerson] || 0} occasion{(recipientCount[topPerson] || 0) !== 1 ? 's' : ''} this year</p>
        </div>

        {/* Busiest month */}
        <div
          className="bg-muted border border-border rounded-2xl p-5 animate-fade-up"
          style={{ animationDelay: '1500ms' }}
        >
          <p className="font-accent text-muted-foreground text-base mb-1">busiest month</p>
          <p className="font-heading font-bold text-2xl text-foreground">{busiestMonth}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{monthCount[busiestMonthIdx] || 0} occasions</p>
        </div>

        {/* Intention */}
        {profile?.intention && (
          <div
            className="bg-gradient-to-br from-terracotta/10 to-moss/10 border border-border rounded-2xl p-5 animate-fade-up"
            style={{ animationDelay: '1700ms' }}
          >
            <p className="font-accent text-terracotta text-base mb-1">your intention this year</p>
            <p className="font-heading font-semibold text-foreground text-lg">"{profile.intention}"</p>
          </div>
        )}

        {/* Gift History by Person */}
        {giftHistory.length > 0 && (
          <div className="animate-fade-up" style={{ animationDelay: '2000ms' }}>
            <h2 className="font-heading font-bold text-xl text-foreground mb-3">Gift History</h2>
            <div className="space-y-3">
              {Object.entries(historyByRecipient).map(([name, entries]) => (
                <PersonHistoryCard key={name} name={name} entries={entries} />
              ))}
            </div>
          </div>
        )}

        {/* Closing quote */}
        <div
          className="text-center py-6 animate-fade-up"
          style={{ animationDelay: '2100ms' }}
        >
          <p className="font-accent text-xl text-muted-foreground leading-relaxed">
            "Thank you for being thoughtful."
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            — from {yearEvents.length} people, in spirit ♥
          </p>
        </div>
      </div>
    </div>
  );
}
