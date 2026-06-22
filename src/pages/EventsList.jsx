import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { base44 } from '@/api/base44Client';
import { Plus, Upload, Users } from 'lucide-react';
import { daysUntil, urgencyColor, formatEventDate, relativeDayLabel } from '@/lib/dateUtils';
import PriorityBadge from '@/components/PriorityBadge';
import BulkImportEvents from '@/components/BulkImportEvents';
import { visibleActiveEvents } from '@/lib/eventVisibility';

export default function EventsList({ user }) {
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);

  const { onTouchStart, onTouchMove, onTouchEnd, indicatorRef } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ['events'] });
  });

  const { data: ownEvents = [] } = useQuery({
    queryKey: ['events', user?.email],
    queryFn: () => base44.entities.Event.filter({ created_by: user?.email }, 'event_date'),
    enabled: !!user?.email,
  });

  const { data: sharedEvents = [] } = useQuery({
    queryKey: ['sharedEvents', user?.email],
    queryFn: () => base44.entities.Event.filter({ collaborator_emails: user?.email }, 'event_date'),
    enabled: !!user?.email,
  });

  const isLoading = false;
  const ownIds = new Set(ownEvents.map(e => e.id));
  const events = visibleActiveEvents([...ownEvents, ...sharedEvents.filter(e => !ownIds.has(e.id))])
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div
      className="space-y-5"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        ref={indicatorRef}
        className="flex justify-center pointer-events-none"
        style={{ opacity: 0, transition: 'opacity 0.2s', marginBottom: '-1.25rem' }}
      >
        <div className="w-6 h-6 border-2 border-terracotta/40 border-t-terracotta rounded-full animate-spin" />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-accent text-muted-foreground text-lg">your occasions</p>
          <h1 className="font-heading font-bold text-2xl text-foreground">All Events</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 bg-moss/15 border border-moss/30 text-moss-dark px-3 py-2 rounded-full font-heading font-semibold text-sm hover:bg-moss/25 transition-all"
          >
            <Upload className="w-4 h-4" /> Import all
          </button>
          <Link
            to="/events/new"
            className="flex items-center gap-2 bg-terracotta text-white px-4 py-2 rounded-full font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" /> Add
          </Link>
        </div>
      </div>

      {showImport && <BulkImportEvents onClose={() => setShowImport(false)} />}

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-10 space-y-4">
          <p className="font-accent text-2xl text-muted-foreground">nothing yet</p>
          <p className="text-muted-foreground text-sm">Add your first occasion, or import a bunch at once.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 bg-moss/15 border border-moss/30 text-moss-dark px-5 py-2.5 rounded-full font-heading font-semibold text-sm hover:bg-moss/25 transition-all"
            >
              <Upload className="w-4 h-4" /> Import all at once — it's quick!
            </button>
            <Link to="/events/new" className="inline-flex items-center gap-2 bg-terracotta text-white px-5 py-2.5 rounded-full font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all hover:-translate-y-0.5">
              <Plus className="w-4 h-4" /> Add one occasion
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const days = daysUntil(event.event_date);
            return (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-terracotta/40 transition-all hover:-translate-y-0.5"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="font-heading font-semibold text-foreground">{event.recipient_name}</span>
                    <PriorityBadge priority={event.priority} />
                    {event.created_by !== user?.email && (
                      <span className="inline-flex items-center gap-1 text-xs bg-moss/20 text-moss-dark px-2 py-0.5 rounded-full font-medium">
                        <Users className="w-3 h-3" /> Shared
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground capitalize">{event.occasion?.replace(/_/g, ' ')} · {formatEventDate(event.event_date)}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium ${urgencyColor(days)}`}>
                    {relativeDayLabel(days, true)}
                  </span>
                  {event.budget > 0 && (
                    <div className="text-xs text-muted-foreground">${event.budget}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
