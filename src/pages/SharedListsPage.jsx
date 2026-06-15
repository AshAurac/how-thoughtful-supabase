import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Link as LinkIcon, Trash2, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import NativePicker from '@/components/NativePicker';
import { useAuth } from '@/lib/AuthContext';

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export default function SharedListsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    recipient_name: '',
    recipient_email: '',
    occasion: 'birthday',
    list_type: 'group_gift',
  });

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ['sharedLists', user?.email],
    queryFn: () => base44.entities.SharedList.filter({ created_by: user?.email }, '-created_date'),
    enabled: !!user?.email,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SharedList.create({
      ...data,
      share_token: generateToken(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedLists'] });
      setShowForm(false);
      setForm({ title: '', recipient_name: '', recipient_email: '', occasion: 'birthday', list_type: 'group_gift' });
      toast.success('List created! Share the link with your group 🎉');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SharedList.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedLists'] });
      toast.success('List deleted');
    },
  });

  const copyLink = (token) => {
    const url = `${window.location.origin}/group/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied! Share it with your group 🔗');
  };

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-accent text-muted-foreground text-lg">coordinate with your people</p>
          <h1 className="font-heading font-bold text-2xl text-foreground">Group Lists</h1>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 bg-terracotta text-white px-4 py-2 rounded-full text-sm font-heading font-semibold hover:bg-terracotta-dark transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" /> New list
        </button>
      </div>

      {/* Type explainer cards */}
      {!showForm && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-1.5">
            <div className="text-2xl">🎁</div>
            <p className="font-heading font-semibold text-sm text-foreground">Group Gift List</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Everyone collaborates on ideas for one person. No double-ups — anyone can claim an item so others know it's covered. Great for birthdays or big occasions.</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-1.5">
            <div className="text-2xl">🎅</div>
            <p className="font-heading font-semibold text-sm text-foreground">Secret Santa</p>
            <p className="text-xs text-muted-foreground leading-relaxed">Each participant is secretly assigned someone to buy for. They can browse that person's wishlist without revealing who they are. Perfect for group draws.</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h2 className="font-heading font-semibold text-foreground">Create a group list</h2>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="List name (e.g. Mum's 60th birthday gifts)"
            className="w-full border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.recipient_name}
              onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
              placeholder="Recipient's name *"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
            <input
              value={form.recipient_email}
              onChange={e => setForm(f => ({ ...f, recipient_email: e.target.value }))}
              placeholder="Their email (to block access)"
              className="border border-border rounded-xl px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NativePicker
              label="Occasion"
              value={form.occasion}
              onChange={v => setForm(f => ({ ...f, occasion: v }))}
              options={['birthday','anniversary','holiday','graduation','baby_shower','wedding','christmas','just_because'].map(o => ({ value: o, label: o.replace(/_/g, ' ') }))}
            />
            <NativePicker
              label="List type"
              value={form.list_type}
              onChange={v => setForm(f => ({ ...f, list_type: v }))}
              options={[
                { value: 'group_gift', label: 'Group gift list' },
                { value: 'secret_santa', label: 'Secret Santa 🎅' },
              ]}
            />
          </div>
          {form.list_type === 'secret_santa' && (
            <p className="text-xs text-muted-foreground bg-butter/30 rounded-xl px-3 py-2">
              🎅 After creating, add all participants and then hit "Assign & Email Santas" — each person will be secretly emailed their match.
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!form.title || !form.recipient_name) { toast.error('Please fill in the required fields'); return; }
                createMutation.mutate(form);
              }}
              disabled={createMutation.isPending}
              className="flex-1 bg-terracotta text-white py-2 rounded-full text-sm font-heading font-semibold hover:bg-terracotta-dark transition-all disabled:opacity-60"
            >
              Create list
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-full text-sm text-muted-foreground hover:bg-muted transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {lists.length === 0 && !showForm ? (
        <div className="text-center py-12 space-y-2">
          <div className="text-4xl">🎁</div>
          <p className="font-heading font-semibold text-foreground">No group lists yet</p>
          <p className="text-sm text-muted-foreground">Create one to coordinate gifts with friends or family — no more double-ups!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map(list => (
            <div key={list.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                      {list.list_type === 'secret_santa' ? '🎅 Secret Santa' : '🎁 Group gift'}
                    </span>
                  </div>
                  <Link to={`/group-manage/${list.id}`} className="font-heading font-semibold text-foreground hover:text-terracotta transition-colors mt-1 block">
                    {list.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">For {list.recipient_name} · {list.occasion?.replace(/_/g, ' ')}</p>
                </div>
                <button onClick={() => deleteMutation.mutate(list.id)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-terracotta transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                <Link
                  to={`/group-manage/${list.id}`}
                  className="flex items-center gap-1 text-xs bg-muted text-foreground px-3 py-1.5 rounded-full hover:bg-secondary transition-all font-medium"
                >
                  <Gift className="w-3 h-3" /> Manage
                </Link>
                <button
                  onClick={() => copyLink(list.share_token)}
                  className="flex items-center gap-1 text-xs bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full hover:bg-terracotta/20 transition-all font-medium"
                >
                  <LinkIcon className="w-3 h-3" /> Copy invite link
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
