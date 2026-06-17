import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, X, Upload } from 'lucide-react';
import { LOVE_LANGUAGES } from '@/lib/catalogs';
import NativePicker from '@/components/NativePicker';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import BulkImportRecipients from '@/components/BulkImportRecipients';
import { findRecipientMatch, mergeRecipientPayload, recipientPayloadFromForm } from '@/lib/recipientMatching';
import { syncBirthdayEventForRecipient } from '@/lib/birthdayOccasions';

export default function RecipientsPage({ user }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState(null);
  const [form, setForm] = useState({
    name: '',
    age: '',
    birthday_month: '',
    birthday_day: '',
    relationship: '',
    love_language: '',
    interests: '',
    notes: '',
    style_preferences: '',
    gift_likes: '',
    gift_avoidances: '',
    wishlist_notes: ''
  });

  const updateForm = (updates) => {
    setForm(f => ({ ...f, ...updates }));
    setDuplicateMatch(null);
  };

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ['recipients', user?.email],
    queryFn: () => base44.entities.Recipient.filter({ created_by: user?.email }, 'name'),
    enabled: !!user?.email,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events', user?.email],
    queryFn: () => base44.entities.Event.filter({ created_by: user?.email }, 'event_date'),
    enabled: !!user?.email,
  });

  const { onTouchStart, onTouchMove, onTouchEnd, indicatorRef } = usePullToRefresh(async () => {
    await queryClient.invalidateQueries({ queryKey: ['recipients'] });
  });

  const resetForm = () => {
    setForm({ name: '', age: '', birthday_month: '', birthday_day: '', relationship: '', love_language: '', interests: '', notes: '', style_preferences: '', gift_likes: '', gift_avoidances: '', wishlist_notes: '' });
    setDuplicateMatch(null);
  };

  const addMutation = useMutation({
    mutationFn: async ({ data, mode = 'create', match }) => {
      const payload = recipientPayloadFromForm(data);
      let recipient;
      if (mode === 'merge' && match?.recipient) {
        const merged = mergeRecipientPayload(match.recipient, payload);
        recipient = Object.keys(merged).length
          ? await base44.entities.Recipient.update(match.recipient.id, merged)
          : match.recipient;
      } else {
        recipient = await base44.entities.Recipient.create(payload);
      }
      const birthdaySync = await syncBirthdayEventForRecipient({
        recipient,
        events,
        eventEntity: base44.entities.Event,
      });
      return { recipient, birthdaySync };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recipients'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      setShowAdd(false);
      resetForm();
      const personAction = variables?.mode === 'merge' ? 'Person updated' : 'Person added';
      if (result?.birthdaySync?.action === 'created') {
        toast.success(`${personAction} and birthday occasion created`);
      } else if (result?.birthdaySync?.action === 'updated') {
        toast.success(`${personAction} and birthday occasion synced`);
      } else {
        toast.success(personAction);
      }
    },
  });

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!duplicateMatch) {
      const match = findRecipientMatch(form.name, recipients);
      if (match) {
        setDuplicateMatch(match);
        return;
      }
    }
    addMutation.mutate({ data: form, mode: 'create' });
  };

  const handleMergeDuplicate = () => {
    addMutation.mutate({ data: form, mode: 'merge', match: duplicateMatch });
  };

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
      <div className="flex items-center justify-between">
        <div>
          <p className="font-accent text-muted-foreground text-lg">the people you love</p>
          <h1 className="font-heading font-bold text-2xl text-foreground">People</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 bg-moss/15 border border-moss/30 text-moss-dark px-3 py-2 rounded-full font-heading font-semibold text-sm hover:bg-moss/25 transition-all"
          >
            <Upload className="w-4 h-4" /> Import all
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 bg-terracotta text-white px-4 py-2 rounded-full font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {showImport && <BulkImportRecipients onClose={() => setShowImport(false)} />}

      {showAdd && (
        <form
          onSubmit={handleAddSubmit}
          className="bg-muted border border-border rounded-2xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-heading font-semibold text-foreground">Add person</h3>
            <button type="button" onClick={() => setShowAdd(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={form.name}
              onChange={e => updateForm({ name: e.target.value })}
              placeholder="Name *"
              required
              className="col-span-2 border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
            <input
              type="number"
              value={form.age}
              onChange={e => updateForm({ age: e.target.value })}
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
              onChange={e => updateForm({ birthday_month: e.target.value })}
              placeholder="Birthday month"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
            <input
              type="number"
              min="1"
              max="31"
              value={form.birthday_day}
              onChange={e => updateForm({ birthday_day: e.target.value })}
              placeholder="Birthday day"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.relationship}
              onChange={e => updateForm({ relationship: e.target.value })}
              placeholder="Relationship"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
            <NativePicker
              label="Love language"
              placeholder="Love language"
              value={form.love_language}
              onChange={v => updateForm({ love_language: v })}
              options={[{ value: '', label: 'None' }, ...LOVE_LANGUAGES.map(l => ({ value: l.value, label: l.label }))]}
            />
          </div>
          <input
            value={form.interests}
            onChange={e => updateForm({ interests: e.target.value })}
            placeholder="Interests (comma-separated)"
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
          />
          <textarea
            value={form.notes}
            onChange={e => updateForm({ notes: e.target.value })}
            placeholder="Notes"
            rows={3}
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
          />
          <details className="rounded-2xl border border-border bg-card px-3 py-2">
            <summary className="cursor-pointer text-sm font-heading font-semibold text-foreground">Extra details for better gift ideas</summary>
            <div className="mt-3 space-y-2">
              <textarea
                value={form.style_preferences}
                onChange={e => updateForm({ style_preferences: e.target.value })}
                placeholder="Style and preferences"
                rows={2}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
              />
              <textarea
                value={form.gift_likes}
                onChange={e => updateForm({ gift_likes: e.target.value })}
                placeholder="Things they love"
                rows={2}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
              />
              <textarea
                value={form.gift_avoidances}
                onChange={e => updateForm({ gift_avoidances: e.target.value })}
                placeholder="Things to avoid"
                rows={2}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
              />
              <textarea
                value={form.wishlist_notes}
                onChange={e => updateForm({ wishlist_notes: e.target.value })}
                placeholder="Wishlist or past gift notes"
                rows={2}
                className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50 resize-none"
              />
            </div>
          </details>
          {duplicateMatch && (
            <div className="bg-butter/30 border border-butter rounded-2xl p-3 space-y-2">
              <p className="text-sm font-heading font-semibold text-foreground">
                {duplicateMatch.type === 'exact' ? 'This person already exists.' : 'This looks similar to someone already in People.'}
              </p>
              <p className="text-sm text-muted-foreground">
                Existing person: <span className="font-medium text-foreground">{duplicateMatch.recipient.name}</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleMergeDuplicate}
                  disabled={addMutation.isPending}
                  className="bg-moss text-white py-2 rounded-full text-sm font-heading font-semibold hover:bg-moss-dark transition-all disabled:opacity-60"
                >
                  Update existing
                </button>
                <button
                  type="button"
                  onClick={() => addMutation.mutate({ data: form, mode: 'create' })}
                  disabled={addMutation.isPending}
                  className="bg-card border border-border text-foreground py-2 rounded-full text-sm font-heading font-semibold hover:bg-muted transition-all disabled:opacity-60"
                >
                  Create separate
                </button>
              </div>
            </div>
          )}
          <button type="submit" className="w-full bg-terracotta text-white py-2.5 rounded-full text-sm font-heading font-semibold hover:bg-terracotta-dark transition-all">
            {duplicateMatch ? 'Create separate person' : 'Add person'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-sand-200 rounded-2xl animate-pulse" />)}</div>
      ) : recipients.length === 0 ? (
        <div className="text-center py-10 space-y-4">
          <p className="font-accent text-2xl text-muted-foreground">no one yet</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Add all your people at once — the more you tell us about them, the more thoughtful your gift ideas become.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-2 bg-moss/15 border border-moss/30 text-moss-dark px-5 py-2.5 rounded-full font-heading font-semibold text-sm hover:bg-moss/25 transition-all"
            >
              <Upload className="w-4 h-4" /> Import everyone at once
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 bg-terracotta text-white px-5 py-2.5 rounded-full font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all"
            >
              <Plus className="w-4 h-4" /> Add one person
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {recipients.map(r => (
            <Link
              key={r.id}
              to={`/recipients/${r.id}`}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-terracotta/40 transition-all hover:-translate-y-0.5"
            >
              <div className="w-10 h-10 rounded-full bg-terracotta/10 flex items-center justify-center text-terracotta font-heading font-bold text-lg">
                {r.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-heading font-semibold text-foreground">{r.name}</p>
                {r.relationship && <p className="text-sm text-muted-foreground capitalize">{r.relationship}</p>}
                {r.birthday_month && r.birthday_day && (
                  <p className="text-xs text-muted-foreground">
                    Birthday {String(r.birthday_day).padStart(2, '0')}/{String(r.birthday_month).padStart(2, '0')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {r.age && (
                  <span className="text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-full">
                    age {r.age}
                  </span>
                )}
                {r.love_language && (
                  <span className="text-xs bg-secondary text-muted-foreground px-2.5 py-1 rounded-full">
                    {r.love_language.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
