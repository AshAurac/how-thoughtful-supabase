import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, X } from 'lucide-react';
import { computeBuyDates } from '@/lib/dateUtils';
import { LOVE_LANGUAGES } from '@/lib/catalogs';
import NativePicker from '@/components/NativePicker';

const OCCASIONS = ['birthday','anniversary','holiday','graduation','baby_shower','wedding','housewarming','thank_you','just_because','other'];
const PRIORITIES = ['free','low','medium','high'];

// Returns a contextual label for the age/years field
function ageLabel(occasion) {
  if (occasion === 'birthday') return 'Age they\'re turning';
  if (occasion === 'anniversary') return 'Years together';
  if (occasion === 'wedding') return 'Years married';
  if (occasion === 'graduation') return 'Years of study';
  if (occasion === 'baby_shower') return 'Weeks along (optional)';
  return 'Age / Years (optional)';
}

function recipientUpdatesFromEvent(data) {
  const updates = {};

  if (data.occasion === 'birthday' && data.event_date) {
    const [, month, day] = data.event_date.split('-').map(Number);
    if (month && day) {
      updates.birthday_month = month;
      updates.birthday_day = day;
    }
    if (data.age_or_years) updates.age = data.age_or_years;
  }

  if (data.love_language) updates.love_language = data.love_language;
  if (data.notes) updates.notes = data.notes;

  return updates;
}

function mergeRecipientUpdates(existing, updates) {
  return Object.entries(updates).reduce((acc, [key, value]) => {
    if (value === undefined || value === null || value === '') return acc;
    if (key === 'notes' && existing?.notes && existing.notes !== value) {
      acc.notes = `${existing.notes}\n\n${value}`;
      return acc;
    }
    if (!existing?.[key]) acc[key] = value;
    return acc;
  }, {});
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    recipient_name: '', giver_name: '', occasion: 'birthday', event_date: '',
    budget: '', priority: 'medium', recurring: false,
    notes: '', reflection: '', love_language: '', age_or_years: '',
  });
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [showGiverPicker, setShowGiverPicker] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const { data: recipients = [] } = useQuery({
    queryKey: ['recipients'],
    queryFn: () => base44.entities.Recipient.list(),
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const buyDates = data.event_date ? computeBuyDates(data.event_date) : {};
      let recipientId = selectedRecipientId;
      const event = await base44.entities.Event.create({
        ...data,
        recipient_id: recipientId,
        ...buyDates,
        reminders_sent: []
      });

      // Keep the person profile useful when an occasion reveals birthday/context details.
      const profileUpdates = recipientUpdatesFromEvent(data);
      if (!selectedRecipientId && data.recipient_name) {
        const existing = recipients.find(r => r.name.toLowerCase() === data.recipient_name.toLowerCase());
        if (!existing) {
          const recipient = await base44.entities.Recipient.create({
            name: data.recipient_name,
            ...profileUpdates
          });
          recipientId = recipient?.id;
        } else {
          recipientId = existing.id;
          const mergedUpdates = mergeRecipientUpdates(existing, profileUpdates);
          if (Object.keys(mergedUpdates).length) {
            await base44.entities.Recipient.update(existing.id, mergedUpdates);
          }
        }
      } else if (selectedRecipientId) {
        const existing = recipients.find(r => r.id === selectedRecipientId);
        const mergedUpdates = mergeRecipientUpdates(existing, profileUpdates);
        if (Object.keys(mergedUpdates).length) {
          await base44.entities.Recipient.update(selectedRecipientId, mergedUpdates);
        }
      }

      if (recipientId && event?.recipient_id !== recipientId) {
        await base44.entities.Event.update(event.id, { recipient_id: recipientId });
      }
      queryClient.invalidateQueries({ queryKey: ['recipients'] });

      return { ...event, recipient_id: recipientId || event?.recipient_id };
    },
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Occasion added');
      navigate(`/events/${event.id}`);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.recipient_name || !form.event_date) {
      toast.error('Please fill in the required fields');
      return;
    }
    mutation.mutate({
      ...form,
      budget: form.budget ? parseFloat(form.budget) : 0,
      age_or_years: form.age_or_years ? parseInt(form.age_or_years) : null,
    });
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-sand-200 transition-all">
          <ArrowLeft className="w-5 h-5 text-ink" />
        </button>
        <div>
          <p className="font-accent text-muted-foreground">new</p>
          <h1 className="font-heading font-bold text-2xl text-foreground">Add Occasion</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Who is this for? *</label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRecipientPicker(v => !v)}
              className="w-full flex items-center justify-between border border-border rounded-2xl px-4 py-3 bg-card text-left focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            >
              <span className={form.recipient_name ? 'text-foreground font-body' : 'text-muted-foreground font-body'}>
                {form.recipient_name || 'e.g. Mom, Alex, Sarah'}
              </span>
              <div className="flex items-center gap-1">
                {form.recipient_name && (
                  <button type="button" onClick={e => { e.stopPropagation(); set('recipient_name', ''); setSelectedRecipientId(null); }} className="p-1 rounded-full hover:bg-muted">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>

            {showRecipientPicker && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
                {recipients.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      set('recipient_name', r.name);
                      setSelectedRecipientId(r.id);
                      setShowRecipientPicker(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-all text-left"
                  >
                    <span className="font-body text-sm text-foreground">{r.name}</span>
                    {r.relationship && <span className="text-xs text-muted-foreground">{r.relationship}</span>}
                  </button>
                ))}
                <div className="border-t border-border px-4 py-2">
                  <input
                    autoFocus
                    value={form.recipient_name}
                    onChange={e => { set('recipient_name', e.target.value); setSelectedRecipientId(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') setShowRecipientPicker(false); }}
                    placeholder="Or type a new name…"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-1 font-body"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Occasion *</label>
            <NativePicker
              label="Occasion"
              value={form.occasion}
              onChange={v => set('occasion', v)}
              options={OCCASIONS.map(o => ({ value: o, label: o.replace(/_/g, ' ') }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
            <NativePicker
              label="Priority"
              value={form.priority}
              onChange={v => set('priority', v)}
              options={PRIORITIES.map(p => ({ value: p, label: p }))}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Date *</label>
          <input
            type="date"
            value={form.event_date}
            onChange={e => set('event_date', e.target.value)}
            className="w-full border border-border rounded-2xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Budget ($)</label>
            <input
              type="number"
              value={form.budget}
              onChange={e => set('budget', e.target.value)}
              placeholder="0"
              className="w-full border border-border rounded-2xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{ageLabel(form.occasion)}</label>
            <input
              type="number"
              value={form.age_or_years}
              onChange={e => set('age_or_years', e.target.value)}
              placeholder="Optional"
              className="w-full border border-border rounded-2xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body"
            />
          </div>
        </div>

        {/* Gifting on behalf of */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Gift is from <span className="text-muted-foreground font-normal">(optional — leave blank if it's from you)</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGiverPicker(v => !v)}
              className="w-full flex items-center justify-between border border-border rounded-2xl px-4 py-3 bg-card text-left focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            >
              <span className={form.giver_name ? 'text-foreground font-body' : 'text-muted-foreground font-body'}>
                {form.giver_name || 'e.g. your son, your partner…'}
              </span>
              <div className="flex items-center gap-1">
                {form.giver_name && (
                  <button type="button" onClick={e => { e.stopPropagation(); set('giver_name', ''); }} className="p-1 rounded-full hover:bg-muted">
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
            {showGiverPicker && (
              <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
                {recipients.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { set('giver_name', r.name); setShowGiverPicker(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-all text-left"
                  >
                    <span className="font-body text-sm text-foreground">{r.name}</span>
                    {r.relationship && <span className="text-xs text-muted-foreground">{r.relationship}</span>}
                  </button>
                ))}
                <div className="border-t border-border px-4 py-2">
                  <input
                    autoFocus
                    value={form.giver_name}
                    onChange={e => set('giver_name', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') setShowGiverPicker(false); }}
                    placeholder="Or type a name…"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-1 font-body"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Their love language</label>
          <NativePicker
            label="Love language"
            value={form.love_language}
            onChange={v => set('love_language', v)}
            options={[{ value: '', label: 'Not sure' }, ...LOVE_LANGUAGES.map(l => ({ value: l.value, label: l.label }))]}
            placeholder="Not sure"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Ideas, context, anything..."
            rows={3}
            className="w-full border border-border rounded-2xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body resize-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="recurring"
            checked={form.recurring}
            onChange={e => set('recurring', e.target.checked)}
            className="w-4 h-4 accent-terracotta"
          />
          <label htmlFor="recurring" className="text-sm text-foreground font-body">Repeats every year</label>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-terracotta text-white py-4 rounded-full font-heading font-semibold hover:bg-terracotta-dark transition-all hover:-translate-y-0.5 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Add occasion'}
        </button>
      </form>
    </div>
  );
}
