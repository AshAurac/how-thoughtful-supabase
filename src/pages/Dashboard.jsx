import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { visibleActiveEvents } from '@/lib/eventVisibility';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { Plus, Sparkles, Package, Mail, CalendarPlus, CheckCircle2, HelpCircle } from 'lucide-react';
import { getUpcomingEvents, daysUntil, urgencyColor, formatEventDate, relativeDayLabel } from '@/lib/dateUtils';
import PriorityBadge from '@/components/PriorityBadge';
import ActionQueue from '@/components/ActionQueue';
import { isEmailVerified } from '@/lib/authStatus';
import ConversationalCapture from '@/components/ConversationalCapture';
import { toast } from 'sonner';

function getNextActionLabel(days) {
  if (days <= 0) return { label: 'Today!', urgent: true };
  if (days <= 7) return { label: 'Buy now', urgent: true };
  if (days <= 14) return { label: 'Buy gift now', urgent: true };
  if (days <= 28) return { label: 'Plan gift', urgent: false };
  return null;
}

function groupByMonth(events) {
  const groups = {};
  events.forEach(event => {
    const d = new Date(`${event.event_date}T00:00:00`);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, events: [] };
    groups[key].events.push(event);
  });
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function UpcomingByMonth({ upcoming }) {
  const groups = groupByMonth(upcoming);
  const [selectedKey, setSelectedKey] = useState(() => groups.length > 0 ? groups[0][0] : null);

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !groups.some(([key]) => key === selectedKey)) {
      setSelectedKey(groups[0][0]);
    }
  }, [groups, selectedKey]);

  if (upcoming.length === 0) {
    return (
      <div className="bg-muted border border-border rounded-2xl p-6 text-center">
        <p className="font-accent text-xl text-muted-foreground mb-2">nothing on the horizon</p>
        <p className="text-sm text-muted-foreground mb-4">Add your first occasion and never panic-buy again.</p>
        <Link
          to="/events/new"
          className="inline-flex items-center gap-2 bg-terracotta text-white px-5 py-2.5 rounded-full font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> Add an occasion
        </Link>
      </div>
    );
  }

  const selectedGroup = groups.find(([key]) => key === selectedKey);

  return (
    <div>
      {/* Month selector buttons */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {groups.map(([key, { label, events }]) => {
          const shortLabel = label.replace(/\s\d{4}$/, ''); // e.g. "June" instead of "June 2026"
          const isSelected = key === selectedKey;
          return (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={`flex-none px-4 py-2 rounded-full text-sm font-heading font-semibold transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-terracotta text-white'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:border-terracotta/40'
              }`}
            >
              {shortLabel}
              <span className={`ml-1.5 text-xs ${isSelected ? 'text-white/70' : 'text-muted-foreground'}`}>
                {events.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Events for selected month */}
      {selectedGroup && (
        <div className="border border-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-border">
            {selectedGroup[1].events.map(event => {
              const days = daysUntil(event.event_date);
              return (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="flex items-center gap-3 bg-card px-4 py-3 hover:bg-muted transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-heading font-semibold text-foreground truncate">{event.recipient_name}</span>
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={event.priority} />
                        {event.budget && (
                          <span className="text-xs text-muted-foreground">${event.budget.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground capitalize">{event.occasion?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const act = getNextActionLabel(days);
                      return act ? (
                        <span className={`text-xs font-heading font-semibold px-2 py-0.5 rounded-full ${act.urgent ? 'bg-terracotta/10 text-terracotta' : 'bg-muted text-muted-foreground'}`}>
                          {act.label}
                        </span>
                      ) : (
                        <span className={`text-sm font-medium ${urgencyColor(days)}`}>
                          {relativeDayLabel(days, true)}
                        </span>
                      );
                    })()}
                    <div className="text-xs text-muted-foreground mt-0.5">{formatEventDate(event.event_date)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ user }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('priority');
  const [tourChoiceVisible, setTourChoiceVisible] = useState(false);
  const emailVerified = isEmailVerified(user);

  const { onTouchStart, onTouchMove, onTouchEnd, indicatorRef } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries();
  });

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      return profiles[0] || null;
    },
    enabled: !!user,
  });

  useEffect(() => {
    const dismissed = localStorage.getItem('howThoughtfulTourDismissed');
    const completed = localStorage.getItem('howThoughtfulTourCompleted');
    const shouldOffer = profile?.first_capture_completed_at && profile?.app_tour_status === 'offered' && !dismissed && !completed;
    setTourChoiceVisible(Boolean(shouldOffer));
  }, [profile]);

  useEffect(() => {
    const restart = () => setTourChoiceVisible(true);
    window.addEventListener('how-thoughtful-tour-restart', restart);
    return () => window.removeEventListener('how-thoughtful-tour-restart', restart);
  }, []);

  const handleTourChoice = async (choice) => {
    if (choice === 'show') {
      localStorage.setItem('howThoughtfulTourCompleted', 'true');
      toast.info('Tiny tour: Capture adds plans, Calendar shows timing, People holds details, and More has the specialised tools.');
    } else if (choice === 'never') {
      localStorage.setItem('howThoughtfulTourDismissed', 'true');
    }
    setTourChoiceVisible(false);

    try {
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, {
          app_tour_status: choice === 'show' ? 'completed' : choice === 'never' ? 'dismissed' : 'maybe_later',
        });
        queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      }
    } catch {
      // Local choice still takes effect.
    }
  };

  const { data: ownEvents = [], error: ownEventsError, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', user?.email],
    queryFn: () => base44.entities.Event.filter({ created_by: user?.email }, '-event_date'),
    enabled: !!user?.email,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const events = visibleActiveEvents(ownEvents);

  const { data: gifts = [] } = useQuery({
    queryKey: ['gifts', user?.email],
    queryFn: () => base44.entities.Gift.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: planActions = [] } = useQuery({
    queryKey: ['planActions', user?.email],
    queryFn: () => base44.entities.PlanAction.filter({ created_by: user?.email, completed: false }, 'due_date'),
    enabled: !!user?.email,
  });

  const upcoming = getUpcomingEvents(events, 365 * 3);
  const deliveries = gifts.filter(g => g.delivery_status === 'ordered' || g.delivery_status === 'shipped');
  const importantActions = [
    ...planActions.slice(0, 2).map(action => ({
      icon: CheckCircle2,
      title: action.title,
      subtitle: action.due_date ? `Due ${formatEventDate(action.due_date)}` : 'From your capture',
      to: action.event_id ? `/events/${action.event_id}` : '/capture',
    })),
    ...upcoming.slice(0, 3).map(event => ({
      icon: CalendarPlus,
      title: `${event.recipient_name}: ${event.occasion?.replace(/_/g, ' ')}`,
      subtitle: `${relativeDayLabel(daysUntil(event.event_date), true)} · ${formatEventDate(event.event_date)}`,
      to: `/events/${event.id}`,
    })),
  ].slice(0, 3);

  return (
    <div
      className="space-y-6"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        ref={indicatorRef}
        className="flex justify-center pointer-events-none"
        style={{ opacity: 0, transition: 'opacity 0.2s', marginBottom: '-1.5rem' }}
      >
        <div className="w-6 h-6 border-2 border-terracotta/40 border-t-terracotta rounded-full animate-spin" />
      </div>
      {/* Hero greeting */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-accent text-2xl text-muted-foreground mb-1">good to see you</p>
          <h1 className="font-heading font-bold text-3xl text-foreground">
            {upcoming.length > 0
              ? `${upcoming.length} ${upcoming.length === 1 ? 'occasion' : 'occasions'} coming up`
              : 'Nothing upcoming — enjoy the peace'}
          </h1>
        </div>
        <Link to="/events/new" className="flex items-center gap-2 border border-border text-foreground px-4 py-2 rounded-full font-heading font-semibold text-sm hover:bg-muted transition-all whitespace-nowrap">
          <Plus className="w-4 h-4" /> Manual
        </Link>
      </div>

      <ConversationalCapture compact />

      {tourChoiceVisible && (
        <div className="bg-moss/15 border border-moss/30 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-moss/20 flex items-center justify-center">
              <HelpCircle className="w-4 h-4 text-moss" />
            </div>
            <div className="flex-1">
              <p className="font-heading font-semibold text-foreground">Want a quick tour?</p>
              <p className="text-sm text-muted-foreground mt-1">Now that you’ve captured your first occasion, I can point out the useful places without making the app feel like homework.</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={() => handleTourChoice('show')} className="bg-moss text-white rounded-full px-4 py-2 text-sm font-heading font-semibold">Show me</button>
                <button onClick={() => handleTourChoice('later')} className="bg-card border border-border rounded-full px-4 py-2 text-sm font-heading font-semibold">Maybe later</button>
                <button onClick={() => handleTourChoice('never')} className="text-muted-foreground rounded-full px-4 py-2 text-sm font-heading font-semibold">Don’t show again</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importantActions.length > 0 && (
        <div>
          <h2 className="font-heading font-semibold text-lg text-foreground mb-3">Most useful next</h2>
          <div className="grid gap-2">
            {importantActions.map(({ icon: Icon, title, subtitle, to }, index) => (
              <Link key={`${title}-${index}`} to={to} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 hover:bg-muted">
                <div className="w-9 h-9 rounded-full bg-terracotta/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-terracotta" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tabbed views: Coming up / Priority */}
      <div>
        <div className="flex bg-sand-200 dark:bg-muted rounded-full p-1 gap-1 mb-4">
          <button
            onClick={() => setActiveTab('priority')}
            className={`flex-1 py-2 rounded-full text-sm font-heading font-semibold transition-all ${
              activeTab === 'priority' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Priority
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2 rounded-full text-sm font-heading font-semibold transition-all ${
              activeTab === 'upcoming' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Coming up
          </button>
        </div>

        {activeTab === 'upcoming' && (
          eventsLoading ? (
            <div className="bg-muted border border-border rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Loading occasions…</p>
            </div>
          ) : ownEventsError ? (
            <div className="bg-muted border border-border rounded-2xl p-6 text-center">
              <p className="font-heading font-semibold text-foreground">Couldn’t load occasions</p>
              <p className="text-sm text-muted-foreground mt-1">{ownEventsError.message}</p>
            </div>
          ) : (
            <UpcomingByMonth upcoming={upcoming} />
          )
        )}

        {activeTab === 'priority' && (
          <>
            {/* Email verification nudge */}
            {!emailVerified && (
              <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-terracotta/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-terracotta" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-heading font-semibold text-foreground">Verify your email</p>
                  <p className="text-xs text-muted-foreground">Make sure reminders reach you</p>
                </div>
                <Link
                  to="/profile"
                  className="shrink-0 text-xs font-heading font-semibold text-terracotta border border-terracotta/40 px-3 py-1.5 rounded-full hover:bg-terracotta hover:text-white transition-all"
                >
                  Go →
                </Link>
              </div>
            )}
            {eventsLoading ? (
                <div className="bg-muted border border-border rounded-2xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">Loading occasions…</p>
                </div>
              ) : ownEventsError ? (
                <div className="bg-muted border border-border rounded-2xl p-6 text-center">
                  <p className="font-heading font-semibold text-foreground">Couldn’t load occasions</p>
                  <p className="text-sm text-muted-foreground mt-1">{ownEventsError.message}</p>
                </div>
              ) : events.length > 0
              ? <ActionQueue events={events} gifts={gifts} />
              : (
                <div className="bg-muted border border-border rounded-2xl p-6 text-center">
                  <p className="font-accent text-xl text-muted-foreground mb-2">nothing to prioritise</p>
                  <p className="text-sm text-muted-foreground">Add occasions to see your action queue here.</p>
                </div>
              )
            }
          </>
        )}
      </div>

      {/* Deliveries strip */}
      {deliveries.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold text-lg text-foreground">On the way</h2>
            <Link to="/deliveries" className="text-sm text-terracotta hover:text-terracotta-dark font-medium">See all</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {deliveries.map(g => (
              <div key={g.id} className="flex-none w-44 bg-card border border-border rounded-2xl p-3">
                <Package className="w-4 h-4 text-moss mb-2" />
                <p className="font-body font-medium text-sm text-foreground truncate">{g.name}</p>
                <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full ${
                  g.delivery_status === 'shipped' ? 'bg-butter/30 text-butter-dark' : 'bg-sand-200 text-ink-soft'
                }`}>
                  {g.delivery_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inspire me CTA */}
      <Link
        to="/ideas"
        className="flex items-center justify-center gap-2 w-full bg-ink text-white py-4 rounded-2xl font-heading font-semibold hover:bg-ink/90 transition-all hover:-translate-y-0.5"
      >
        <Sparkles className="w-5 h-5 text-butter" />
        Inspire me with gift ideas
      </Link>
    </div>
  );
}
