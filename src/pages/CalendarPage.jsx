import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, isValid } from 'date-fns';
import PriorityBadge from '@/components/PriorityBadge';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { visibleActiveEvents } from '@/lib/eventVisibility';

const PRIORITY_COLORS = {
  high: 'bg-terracotta',
  medium: 'bg-butter',
  low: 'bg-sand-300',
  free: 'bg-moss',
};

export default function CalendarPage({ user }) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: events = [] } = useQuery({
    queryKey: ['events', user?.email],
    queryFn: () => base44.entities.Event.filter({ created_by: user?.email }, 'event_date'),
    enabled: !!user?.email,
  });

  const { onTouchStart, onTouchMove, onTouchEnd, indicatorRef } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ['events'] });
  });

  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const visibleEvents = visibleActiveEvents(events);
  const eventsOnDay = (day) =>
    visibleEvents.filter(e => {
      const d = parseISO(e.event_date);
      return isValid(d) && isSameDay(d, day);
    });

  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

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
        <p className="font-accent text-muted-foreground text-lg">plan ahead</p>
        <h1 className="font-heading font-bold text-2xl text-foreground">Calendar</h1>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
          className="p-2 rounded-full hover:bg-sand-200 transition-all"
        >
          <ChevronLeft className="w-5 h-5 text-ink" />
        </button>
        <h2 className="font-heading font-semibold text-foreground text-lg">
          {format(current, 'MMMM yyyy')}
        </h2>
        <button
          onClick={() => setCurrent(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
          className="p-2 rounded-full hover:bg-sand-200 transition-all"
        >
          <ChevronRight className="w-5 h-5 text-ink" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
        ))}
        {/* Padding */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map(day => {
          const dayEvents = eventsOnDay(day);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isToday = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
              className={`flex flex-col items-center py-1.5 rounded-xl transition-all ${
                isSelected ? 'bg-terracotta text-white' :
                isToday ? 'bg-secondary text-foreground font-semibold' :
                'hover:bg-muted text-foreground'
              }`}
            >
              <span className="text-sm">{format(day, 'd')}</span>
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map((e, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : PRIORITY_COLORS[e.priority] || 'bg-ink-soft'}`}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      {selectedDay && (
        <div>
          <h3 className="font-heading font-semibold text-foreground mb-3">
            {format(selectedDay, 'MMMM d')}
          </h3>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map(event => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="flex items-center gap-3 bg-white border border-sand-300 rounded-2xl p-3 hover:border-terracotta/40 transition-all"
                >
                  <div className="flex-1">
                    <p className="font-heading font-semibold text-foreground">{event.recipient_name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{event.occasion?.replace(/_/g, ' ')}</p>
                  </div>
                  <PriorityBadge priority={event.priority} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
