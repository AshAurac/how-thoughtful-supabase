import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { parseISO, isValid, format } from 'date-fns';
import PriorityBadge from '@/components/PriorityBadge';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { visibleActiveEvents } from '@/lib/eventVisibility';

const SEASONS = [
  { name: 'Spring', months: [3, 4, 5], color: 'bg-moss/20 text-moss-dark border-moss/30' },
  { name: 'Summer', months: [6, 7, 8], color: 'bg-butter/40 text-butter-dark border-butter/40' },
  { name: 'Fall', months: [9, 10, 11], color: 'bg-terracotta/20 text-terracotta border-terracotta/30' },
  { name: 'Winter', months: [12, 1, 2], color: 'bg-sand-200 text-ink-soft border-sand-300' },
];

export default function SeasonPage({ user }) {
  const queryClient = useQueryClient();

  const { data: events = [] } = useQuery({
    queryKey: ['events', user?.email],
    queryFn: () => base44.entities.Event.filter({ created_by: user?.email }, 'event_date'),
    enabled: !!user?.email,
  });

  const { onTouchStart, onTouchMove, onTouchEnd, indicatorRef } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ['events'] });
  });

  const getSeasonEvents = (months) =>
    visibleActiveEvents(events).filter(e => {
      const d = parseISO(e.event_date);
      return isValid(d) && months.includes(d.getMonth() + 1);
    });

  const currentMonth = new Date().getMonth() + 1;
  const currentSeason = SEASONS.find(s => s.months.includes(currentMonth));

  return (
    <div
      className="space-y-5"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div ref={indicatorRef} className="flex justify-center pointer-events-none" style={{ opacity: 0, transition: 'opacity 0.2s', marginBottom: '-1.5rem' }}>
        <div className="w-6 h-6 border-2 border-terracotta/40 border-t-terracotta rounded-full animate-spin" />
      </div>
      <div>
        <p className="font-accent text-muted-foreground text-lg">plan the season</p>
        <h1 className="font-heading font-bold text-2xl text-foreground">Seasonal Prep</h1>
        <p className="text-sm text-muted-foreground mt-1">Group your upcoming occasions by season for smarter batch-buying.</p>
      </div>

      {SEASONS.map(season => {
        const seasonEvents = getSeasonEvents(season.months);
        const isCurrent = season.name === currentSeason?.name;
        return (
          <div
            key={season.name}
            className={`border rounded-2xl p-4 ${isCurrent ? 'border-terracotta/40 bg-white' : 'border-sand-300 bg-sand-50'}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-3 py-1 rounded-full text-sm font-heading font-semibold border ${season.color}`}>
                {season.name}
              </span>
              {isCurrent && <span className="text-xs text-terracotta font-medium">now</span>}
              <span className="text-xs text-muted-foreground ml-auto">{seasonEvents.length} occasion{seasonEvents.length !== 1 ? 's' : ''}</span>
            </div>
            {seasonEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in {season.name.toLowerCase()} yet.</p>
            ) : (
              <div className="space-y-2">
                {seasonEvents.map(event => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="flex items-center gap-3 bg-white border border-sand-300 rounded-xl p-3 hover:border-terracotta/40 transition-all"
                  >
                    <div className="flex-1">
                      <p className="font-heading font-semibold text-foreground text-sm">{event.recipient_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{event.occasion?.replace(/_/g, ' ')} · {format(parseISO(event.event_date), 'MMM d')}</p>
                    </div>
                    <PriorityBadge priority={event.priority} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
