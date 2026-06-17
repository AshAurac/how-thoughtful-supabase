import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { ArrowLeft, Check, Gift, Pencil, Trash2, X } from 'lucide-react';
import { formatEventDate } from '@/lib/dateUtils';
import { LOVE_LANGUAGES } from '@/lib/catalogs';
import NativePicker from '@/components/NativePicker';
import { syncBirthdayEventForRecipient } from '@/lib/birthdayOccasions';

const emptyForm = {
  name: '',
  age: '',
  birthday_month: '',
  birthday_day: '',
  relationship: '',
  love_language: '',
  interests: '',
  notes: ''
};

function formatBirthday(month, day) {
  if (!month || !day) return null;
  const date = new Date(Date.UTC(2024, Number(month) - 1, Number(day)));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export default function RecipientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: recipient } = useQuery({
    queryKey: ['recipient', id],
    queryFn: async () => {
      const list = await base44.entities.Recipient.filter({ id });
      return list[0];
    },
  });

  useEffect(() => {
    if (!recipient) return;
    setForm({
      name: recipient.name || '',
      age: recipient.age || '',
      birthday_month: recipient.birthday_month || '',
      birthday_day: recipient.birthday_day || '',
      relationship: recipient.relationship || '',
      love_language: recipient.love_language || '',
      interests: (recipient.interests || []).join(', '),
      notes: recipient.notes || ''
    });
  }, [recipient]);

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list(),
  });

  const { data: gifts = [] } = useQuery({
    queryKey: ['gifts'],
    queryFn: () => base44.entities.Gift.list(),
  });

  const recipientEvents = events.filter(e => e.recipient_id === id || e.recipient_name === recipient?.name);
  const eventIds = new Set(recipientEvents.map(e => e.id));
  const recipientGifts = gifts.filter(g => eventIds.has(g.event_id));
  const totalSpent = recipientGifts.reduce((s, g) => s + (g.price || 0), 0);
  const birthday = recipient ? formatBirthday(recipient.birthday_month, recipient.birthday_day) : null;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const updatedRecipient = await base44.entities.Recipient.update(id, {
        name: form.name.trim(),
        age: form.age ? parseInt(form.age) : null,
        birthday_month: form.birthday_month ? parseInt(form.birthday_month) : null,
        birthday_day: form.birthday_day ? parseInt(form.birthday_day) : null,
        relationship: form.relationship.trim(),
        love_language: form.love_language,
        interests: form.interests ? form.interests.split(',').map(s => s.trim()).filter(Boolean) : [],
        notes: form.notes.trim()
      });
      const birthdaySync = await syncBirthdayEventForRecipient({
        recipient: updatedRecipient,
        events,
        eventEntity: base44.entities.Event,
      });
      return { recipient: updatedRecipient, birthdaySync };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recipient', id] });
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setEditing(false);
      if (result?.birthdaySync?.action === 'created') {
        toast.success('Person updated and birthday occasion created');
      } else if (result?.birthdaySync?.action === 'updated') {
        toast.success('Person updated and birthday occasion synced');
      } else {
        toast.success('Person updated');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Recipient.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      queryClient.invalidateQueries({ queryKey: ['recipient', id] });
      toast.success('Person deleted');
      navigate('/recipients');
    },
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    updateMutation.mutate();
  };

  if (!recipient) return <div className="h-32 bg-muted rounded-2xl animate-pulse" />;

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-start gap-3">
        <button onClick={() => navigate(-1)} className="mt-1 p-2 rounded-full hover:bg-muted transition-all">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-full bg-terracotta/10 flex items-center justify-center text-terracotta font-heading font-bold text-xl">
              {recipient.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="font-heading font-bold text-2xl text-foreground">{recipient.name}</h1>
              {recipient.relationship && (
                <p className="text-sm text-muted-foreground capitalize">{recipient.relationship}</p>
              )}
            </div>
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-full border border-border hover:bg-muted transition-all"
              title="Edit person"
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="bg-muted border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-foreground">Edit person</h2>
            <button type="button" onClick={() => { setEditing(false); setForm({
              name: recipient.name || '',
              age: recipient.age || '',
              birthday_month: recipient.birthday_month || '',
              birthday_day: recipient.birthday_day || '',
              relationship: recipient.relationship || '',
              love_language: recipient.love_language || '',
              interests: (recipient.interests || []).join(', '),
              notes: recipient.notes || ''
            }); }}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Name *"
              className="col-span-2 border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
            <input
              type="number"
              value={form.age}
              onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
              placeholder="Age"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="1"
              max="12"
              value={form.birthday_month}
              onChange={e => setForm(f => ({ ...f, birthday_month: e.target.value }))}
              placeholder="Birthday month"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
            <input
              type="number"
              min="1"
              max="31"
              value={form.birthday_day}
              onChange={e => setForm(f => ({ ...f, birthday_day: e.target.value }))}
              placeholder="Birthday day"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.relationship}
              onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
              placeholder="Relationship"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
            <NativePicker
              label="Love language"
              placeholder="Love language"
              value={form.love_language}
              onChange={v => setForm(f => ({ ...f, love_language: v }))}
              options={[{ value: '', label: 'None' }, ...LOVE_LANGUAGES.map(l => ({ value: l.value, label: l.label }))]}
            />
          </div>
          <input
            value={form.interests}
            onChange={e => setForm(f => ({ ...f, interests: e.target.value }))}
            placeholder="Interests (comma-separated)"
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
          />
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes"
            rows={4}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
          />
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="w-full bg-terracotta text-white py-2.5 rounded-full text-sm font-heading font-semibold hover:bg-terracotta-dark transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save person'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending}
            className="w-full min-h-[44px] border border-destructive/40 text-destructive py-2.5 rounded-full text-sm font-heading font-semibold hover:bg-destructive/5 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete person
          </button>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="font-heading font-bold text-xl text-foreground">{recipientEvents.length}</p>
          <p className="text-xs text-muted-foreground">occasions</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="font-heading font-bold text-xl text-foreground">{recipientGifts.filter(g => g.bought).length}</p>
          <p className="text-xs text-muted-foreground">gifts given</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <p className="font-heading font-bold text-xl text-terracotta">${Math.round(totalSpent)}</p>
          <p className="text-xs text-muted-foreground">total spent</p>
        </div>
      </div>

      {/* Love language + interests */}
      {(birthday || recipient.age || recipient.love_language || recipient.notes || (recipient.interests || []).length > 0) && (
        <div className="bg-muted border border-border rounded-2xl p-4 space-y-2">
          {birthday && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Birthday:</span>
              <span className="text-xs bg-card border border-border px-2.5 py-1 rounded-full text-foreground">
                {birthday}
              </span>
            </div>
          )}
          {recipient.age && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Age:</span>
              <span className="text-xs bg-card border border-border px-2.5 py-1 rounded-full text-foreground">
                {recipient.age}
              </span>
            </div>
          )}
          {recipient.love_language && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Love language:</span>
              <span className="text-xs bg-card border border-border px-2.5 py-1 rounded-full text-foreground capitalize">
                {recipient.love_language.replace(/_/g, ' ')}
              </span>
            </div>
          )}
          {recipient.interests?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipient.interests.map(i => (
                <span key={i} className="text-xs bg-card border border-border px-2.5 py-1 rounded-full text-foreground">
                  {i}
                </span>
              ))}
            </div>
          )}
          {recipient.notes && (
            <p className="text-sm text-muted-foreground whitespace-pre-line pt-1">{recipient.notes}</p>
          )}
        </div>
      )}

      {/* Events */}
      <div>
        <h2 className="font-heading font-semibold text-lg text-foreground mb-3">Occasions</h2>
        {recipientEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet for {recipient.name}.</p>
        ) : (
          <div className="space-y-2">
            {recipientEvents.map(event => (
              <a
                key={event.id}
                href={`/events/${event.id}`}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3 hover:border-terracotta/40 transition-all"
              >
                <Gift className="w-4 h-4 text-terracotta" />
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm capitalize">{event.occasion?.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">{formatEventDate(event.event_date)}</p>
                </div>
                {event.budget > 0 && <span className="text-xs text-muted-foreground">${event.budget}</span>}
              </a>
            ))}
          </div>
        )}
      </div>

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
            <h3 className="font-heading font-bold text-foreground text-xl text-center">Delete {recipient.name}?</h3>
            <p className="text-sm text-muted-foreground text-center">
              This removes the person from People. Existing occasions and gifts stay in your app, so delete those separately if you do not want to keep them.
            </p>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="w-full bg-destructive text-destructive-foreground py-4 rounded-full font-heading font-semibold hover:opacity-90 transition-all min-h-[44px] disabled:opacity-60"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Yes, delete person'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleteMutation.isPending}
              className="w-full border border-border text-foreground py-4 rounded-full font-heading font-semibold hover:bg-muted transition-all min-h-[44px] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
