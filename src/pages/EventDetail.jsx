import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Check, Sparkles, Lightbulb, Pencil, ChevronDown } from 'lucide-react';
import { formatEventDate, daysUntil, computeBuyDates } from '@/lib/dateUtils';
import PriorityBadge from '@/components/PriorityBadge';
import NativePicker from '@/components/NativePicker';

const OCCASIONS = ['birthday','anniversary','holiday','graduation','baby_shower','wedding','housewarming','thank_you','just_because','other'];
const PRIORITIES = ['free','low','medium','high'];
import EventChecklist from '@/components/EventChecklist';
import GiftBounceAnimation from '@/components/GiftBounceAnimation';
import ShareEventButton from '@/components/ShareEventButton';
import GiftTimeline from '@/components/GiftTimeline';
import GiftWrapAnimation from '@/components/GiftWrapAnimation';

function GiftCheckbox({ checked, onChange, label }) {
  return (
    <button
      onClick={onChange}
      className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-all border min-h-[44px] ${
        checked
          ? 'bg-moss/20 text-moss-dark border-moss/30'
          : 'bg-muted text-muted-foreground border-border hover:bg-secondary'
      }`}
    >
      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${checked ? 'bg-moss border-moss' : 'border-border'}`}>
        {checked && <Check className="w-2.5 h-2.5 text-white" />}
      </div>
      {label}
    </button>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddGift, setShowAddGift] = useState(false);
  const [newGift, setNewGift] = useState({ name: '', price: '', description: '', link: '' });
  const [reflection, setReflection] = useState('');
  const [editingReflection, setEditingReflection] = useState(false);
  const [celebratingGift, setCelebratingGift] = useState(null);
  const [editingEvent, setEditingEvent] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showGiftWrap, setShowGiftWrap] = useState(false);
  const [journeyComplete, setJourneyComplete] = useState(false);

  const { data: event, isLoading: loadingEvent } = useQuery({
    queryKey: ['event', id],
    queryFn: () => base44.entities.Event.filter({ id }),
    select: data => data[0],
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ['gifts', id],
    queryFn: () => base44.entities.Gift.filter({ event_id: id }),
  });

  const updateEventMutation = useMutation({
    mutationFn: (data) => base44.entities.Event.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', id] }),
  });

  const addGiftMutation = useMutation({
    mutationFn: (data) => base44.entities.Gift.create({ ...data, event_id: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gifts', id] });
      setShowAddGift(false);
      setNewGift({ name: '', price: '', description: '', link: '' });
      toast.success('Gift added');
    },
  });

  const updateGiftMutation = useMutation({
    mutationFn: ({ giftId, data }) => base44.entities.Gift.update(giftId, data),
    onMutate: async ({ giftId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['gifts', id] });
      const previous = queryClient.getQueryData(['gifts', id]);
      queryClient.setQueryData(['gifts', id], (old = []) =>
        old.map(g => g.id === giftId ? { ...g, ...data } : g)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['gifts', id], ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['gifts', id] }),
  });

  const deleteGiftMutation = useMutation({
    mutationFn: (giftId) => base44.entities.Gift.delete(giftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gifts', id] });
      toast.success('Gift removed');
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => base44.entities.Event.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Occasion deleted');
      navigate('/');
    },
  });

  const saveToHistoryMutation = useMutation({
    mutationFn: (historyData) => base44.entities.GiftHistory.create(historyData),
  });

  const handleGiftGiven = async () => {
    const totalSpent = gifts.reduce((s, g) => s + (g.price || 0), 0);
    await saveToHistoryMutation.mutateAsync({
      event_id: event.id,
      recipient_name: event.recipient_name,
      recipient_id: event.recipient_id || null,
      occasion: event.occasion,
      event_date: event.event_date,
      year: new Date(event.event_date).getFullYear(),
      budget: event.budget || 0,
      notes: event.notes || '',
      reflection: event.reflection || '',
      giver_name: event.giver_name || '',
      love_language: event.love_language || '',
      total_spent: totalSpent,
      gifts_given: gifts.map(g => ({ name: g.name, price: g.price || 0, description: g.description || '' })),
    });
    // Archive the occasion so it disappears from the dashboard
    await base44.entities.Event.update(id, { completed: true });
    queryClient.invalidateQueries({ queryKey: ['events'] });
    setShowGiftWrap(true);
  };

  if (loadingEvent) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}</div>;
  }
  if (!event) return <div className="text-center py-12 text-muted-foreground">Event not found</div>;

  const days = daysUntil(event.event_date);

  const timeline = [
    { label: 'Order online by', date: event.buy_online_by, days: daysUntil(event.buy_online_by) },
    { label: 'Buy locally by', date: event.buy_local_by, days: daysUntil(event.buy_local_by) },
    { label: 'Wrap by', date: event.wrap_by, days: daysUntil(event.wrap_by) },
  ].filter(t => t.date);

  const handleGiftCheck = (gift, field) => {
    const newValue = !gift[field];
    updateGiftMutation.mutate({ giftId: gift.id, data: { [field]: newValue } });
    // Trigger bounce when marking 'sent' as done (the final step)
    if (field === 'sent' && newValue) {
      setCelebratingGift(gift.id);
    }
  };

  const handleCelebrationDone = (gift) => {
    setCelebratingGift(null);
    // If not recurring, delete the gift; if recurring, just leave it
    if (!event?.recurring) {
      deleteGiftMutation.mutate(gift.id);
    }
  };

  const handleAddGift = (e) => {
    e.preventDefault();
    if (!newGift.name) { toast.error('Gift needs a name'); return; }
    addGiftMutation.mutate({ ...newGift, price: newGift.price ? parseFloat(newGift.price) : 0 });
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {celebratingGift && (
        <GiftBounceAnimation onComplete={() => handleCelebrationDone(gifts.find(g => g.id === celebratingGift))} />
      )}
      {showGiftWrap && (
        <GiftWrapAnimation
          recipientName={event?.recipient_name}
          onComplete={() => { setShowGiftWrap(false); navigate('/'); }}
        />
      )}
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-1 p-2 rounded-full hover:bg-muted transition-all">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          {editingEvent ? (
            <div className="space-y-3">
              <input
                value={editForm.recipient_name}
                onChange={e => setEditForm(f => ({ ...f, recipient_name: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-foreground bg-card font-heading font-bold text-xl focus:outline-none focus:ring-2 focus:ring-terracotta/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <NativePicker
                  label="Occasion"
                  value={editForm.occasion}
                  onChange={v => setEditForm(f => ({ ...f, occasion: v }))}
                  options={OCCASIONS.map(o => ({ value: o, label: o.replace(/_/g, ' ') }))}
                />
                <NativePicker
                  label="Priority"
                  value={editForm.priority}
                  onChange={v => setEditForm(f => ({ ...f, priority: v }))}
                  options={PRIORITIES.map(p => ({ value: p, label: p }))}
                />
              </div>
              <input
                type="date"
                value={editForm.event_date}
                onChange={e => setEditForm(f => ({ ...f, event_date: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50"
              />
              <input
                type="number"
                value={editForm.budget}
                onChange={e => setEditForm(f => ({ ...f, budget: e.target.value }))}
                placeholder="Budget ($)"
                className="w-full border border-border rounded-xl px-3 py-2 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={editForm.age_or_years}
                  onChange={e => setEditForm(f => ({ ...f, age_or_years: e.target.value }))}
                  placeholder={editForm.occasion === 'anniversary' ? 'Years together' : 'Age turning'}
                  className="border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50"
                />
                <input
                  value={editForm.giver_name}
                  onChange={e => setEditForm(f => ({ ...f, giver_name: e.target.value }))}
                  placeholder="Gift from (optional)"
                  className="border border-border rounded-xl px-3 py-2 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50"
                />
              </div>
              <textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes..."
                rows={2}
                className="w-full border border-border rounded-xl px-3 py-2 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const buyDates = editForm.event_date ? computeBuyDates(editForm.event_date) : {};
                    updateEventMutation.mutate({ ...editForm, budget: editForm.budget ? parseFloat(editForm.budget) : 0, age_or_years: editForm.age_or_years ? parseInt(editForm.age_or_years) : null, ...buyDates });
                    setEditingEvent(false);
                    toast.success('Occasion updated');
                  }}
                  className="flex-1 bg-terracotta text-white py-2 rounded-full text-sm font-heading font-semibold hover:bg-terracotta-dark transition-all"
                >
                  Save
                </button>
                <button onClick={() => setEditingEvent(false)} className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:bg-muted transition-all">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-accent text-muted-foreground text-lg">{event.occasion?.replace(/_/g, ' ')}</p>
              {event.giver_name && (
                <p className="text-xs text-muted-foreground mb-0.5">From <span className="font-semibold text-foreground">{event.giver_name}</span></p>
              )}
              <div className="flex items-center gap-2">
              <h1 className="font-heading font-bold text-2xl text-foreground">{event.recipient_name}</h1>
              <button
                onClick={() => { setEditForm({ recipient_name: event.recipient_name, giver_name: event.giver_name || '', occasion: event.occasion, event_date: event.event_date, priority: event.priority, budget: event.budget || '', age_or_years: event.age_or_years || '', notes: event.notes || '' }); setEditingEvent(true); }}
                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
              >
                <Pencil className="w-4 h-4" />
              </button>

              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <PriorityBadge priority={event.priority} />
                <span className="text-sm text-muted-foreground">{formatEventDate(event.event_date)}</span>
                {days !== null && days >= 0 && (
                  <span className={`text-sm font-medium ${days <= 7 ? 'text-terracotta' : 'text-muted-foreground'}`}>
                    {days === 0 ? 'Today!' : `${days} days away`}
                  </span>
                )}
              </div>
              <div className="mt-2">
                <ShareEventButton eventId={event.id} collaboratorEmails={event.collaborator_emails || []} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gift Given — shown at top when journey is complete */}
      {journeyComplete && !editingEvent && (
        <button
          onClick={handleGiftGiven}
          disabled={saveToHistoryMutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-terracotta to-moss text-white py-4 rounded-2xl font-heading font-bold text-base hover:opacity-90 transition-all hover:-translate-y-0.5 shadow-md disabled:opacity-60"
        >
          {saveToHistoryMutation.isPending ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="text-xl">🎁</span>
          )}
          I gave this gift!
        </button>
      )}

      {/* Gift journey timeline */}
      {!editingEvent && (
        <GiftTimeline daysLeft={days !== null ? days : 999} onAllDone={() => setJourneyComplete(true)} />
      )}

      {/* Buy-by timeline */}
      {timeline.length > 0 && (
        <div className="bg-muted border border-border rounded-2xl p-4">
          <p className="font-accent text-muted-foreground mb-3">buy-by timeline</p>
          <div className="space-y-2">
            {timeline.map(t => (
              <div key={t.label} className="flex items-center justify-between">
                <span className="text-sm text-foreground font-medium">{t.label}</span>
                <span className={`text-sm font-medium ${
                  t.days !== null && t.days <= 3 ? 'text-terracotta' :
                  t.days !== null && t.days <= 7 ? 'text-butter-dark' : 'text-muted-foreground'
                }`}>
                  {t.days !== null && t.days < 0 ? 'Passed' : t.days === 0 ? 'Today' : t.days !== null ? `in ${t.days}d` : formatEventDate(t.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gifts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-semibold text-lg text-foreground">Gifts</h2>
          <button
            onClick={() => setShowAddGift(v => !v)}
            className="flex items-center gap-1 text-sm text-terracotta hover:text-terracotta-dark font-medium"
          >
            <Plus className="w-4 h-4" /> Add gift
          </button>
        </div>

        {showAddGift && (
          <form onSubmit={handleAddGift} className="bg-muted border border-border rounded-2xl p-4 mb-3 space-y-3">
            <input
              value={newGift.name}
              onChange={e => setNewGift(g => ({ ...g, name: e.target.value }))}
              placeholder="Gift name *"
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={newGift.price}
                onChange={e => setNewGift(g => ({ ...g, price: e.target.value }))}
                placeholder="Price ($)"
                className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
              />
              <input
                value={newGift.link}
                onChange={e => setNewGift(g => ({ ...g, link: e.target.value }))}
                placeholder="Link (optional)"
                className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-terracotta text-white py-2 rounded-full text-sm font-heading font-semibold hover:bg-terracotta-dark transition-all">
                Add
              </button>
              <button type="button" onClick={() => setShowAddGift(false)} className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:bg-secondary transition-all">
                Cancel
              </button>
            </div>
          </form>
        )}

        {gifts.length === 0 && !showAddGift ? (
          <div className="bg-muted border border-border rounded-2xl p-4 text-center">
            <p className="text-sm text-muted-foreground">No gifts yet. Add one above or get ideas below.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {gifts.map(gift => (
              <div key={gift.id} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-heading font-semibold text-foreground">{gift.name}</p>
                    {gift.price > 0 && <p className="text-sm text-muted-foreground">${gift.price}</p>}
                    {gift.link && (
                      <a href={gift.link} target="_blank" rel="noreferrer" className="text-xs text-terracotta hover:underline">View link</a>
                    )}
                  </div>
                  <button
                    onClick={() => deleteGiftMutation.mutate(gift.id)}
                    className="p-2.5 rounded-full hover:bg-muted text-muted-foreground hover:text-terracotta transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <GiftCheckbox checked={gift.bought} onChange={() => handleGiftCheck(gift, 'bought')} label="Bought" />
                  <GiftCheckbox checked={gift.wrapped} onChange={() => handleGiftCheck(gift, 'wrapped')} label="Wrapped" />
                  <GiftCheckbox checked={gift.card_written} onChange={() => handleGiftCheck(gift, 'card_written')} label="Card" />
                  <GiftCheckbox checked={gift.sent} onChange={() => handleGiftCheck(gift, 'sent')} label="Sent" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Get ideas buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to={`/ideas?event_id=${event.id}&recipient=${encodeURIComponent(event.recipient_name)}`}
          className="flex items-center justify-center gap-2 bg-ink text-white py-3 rounded-2xl font-heading font-semibold text-sm hover:bg-ink/90 transition-all hover:-translate-y-0.5"
        >
          <Sparkles className="w-4 h-4 text-butter" />
          AI ideas
        </Link>
        <Link
          to={`/ideas?event_id=${event.id}&recipient=${encodeURIComponent(event.recipient_name)}&tab=curated`}
          className="flex items-center justify-center gap-2 bg-muted border border-border text-foreground py-3 rounded-2xl font-heading font-semibold text-sm hover:bg-secondary transition-all hover:-translate-y-0.5"
        >
          <Lightbulb className="w-4 h-4 text-moss" />
          Free ideas
        </Link>
      </div>

      {/* Day checklist */}
      <EventChecklist occasion={event.occasion} />

      {/* Notes dropdown */}
      {event.notes && !editingEvent && (
        <div className="bg-muted border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowNotes(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="font-heading font-semibold text-sm text-foreground">Notes</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showNotes ? 'rotate-180' : ''}`} />
          </button>
          {showNotes && (
            <div className="px-4 pb-4">
              <p className="text-sm text-foreground whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Reflection */}
      <div className="bg-muted border border-border rounded-2xl p-4">
        <p className="font-accent text-muted-foreground mb-2">a moment of gratitude</p>
        {editingReflection ? (
          <div className="space-y-2">
            <textarea
              value={reflection || event.reflection || ''}
              onChange={e => setReflection(e.target.value)}
              placeholder="What do you appreciate about this person? (20 seconds is enough)"
              rows={3}
              className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  updateEventMutation.mutate({ reflection: reflection || event.reflection });
                  setEditingReflection(false);
                  toast.success('Saved');
                }}
                className="flex-1 bg-terracotta text-white py-2 rounded-full text-sm font-heading font-semibold hover:bg-terracotta-dark transition-all"
              >
                Save
              </button>
              <button onClick={() => setEditingReflection(false)} className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:bg-secondary transition-all">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div onClick={() => { setReflection(event.reflection || ''); setEditingReflection(true); }} className="cursor-pointer">
            {event.reflection ? (
              <p className="text-sm text-foreground italic">"{event.reflection}"</p>
            ) : (
              <p className="text-sm text-muted-foreground">Tap to write a 20-second note about why you're grateful for them.</p>
            )}
          </div>
        )}
      </div>
      {/* Delete occasion */}
      {!editingEvent && (
        <button
          onClick={() => setConfirmDelete(true)}
          className="w-full flex items-center justify-center gap-2 border border-destructive/40 text-destructive py-3 rounded-2xl font-heading font-semibold text-sm hover:bg-destructive/5 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Delete this occasion
        </button>
      )}

      {/* Delete confirmation sheet */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setConfirmDelete(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full bg-card rounded-t-3xl shadow-2xl px-6 py-6 space-y-4"
            style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <h3 className="font-heading font-bold text-foreground text-xl text-center">Delete this occasion?</h3>
            <p className="text-sm text-muted-foreground text-center">This will permanently delete the occasion and all its gifts. This cannot be undone.</p>
            <button
              onClick={() => deleteEventMutation.mutate()}
              disabled={deleteEventMutation.isPending}
              className="w-full bg-destructive text-destructive-foreground py-4 rounded-full font-heading font-semibold hover:opacity-90 transition-all min-h-[44px]"
            >
              {deleteEventMutation.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="w-full border border-border text-foreground py-4 rounded-full font-heading font-semibold hover:bg-muted transition-all min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}