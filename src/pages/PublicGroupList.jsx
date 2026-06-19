import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';
import { Gift, Check, ExternalLink } from 'lucide-react';

export default function PublicGroupList() {
  const { token } = useParams();
  const queryClient = useQueryClient();

  // Auto-unlock group gifting feature if user is authenticated
  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!authed) return;
      try {
        const profiles = await base44.entities.UserProfile.list();
        const profile = profiles[0];
        if (profile && !profile.feature_group_lists) {
          await base44.entities.UserProfile.update(profile.id, { feature_group_lists: true });
        }
      } catch {}
    });
  }, []);
  const [claimName, setClaimName] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimingId, setClaimingId] = useState(null);
  const [blockedEmail, setBlockedEmail] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);

  const { data: list, isLoading } = useQuery({
    queryKey: ['publicGroupList', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_shared_list', { p_token: token });
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ['publicGroupItems', list?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_shared_list_items', { p_token: token });
      if (error) throw error;
      return data || [];
    },
    enabled: !!list?.id,
  });

  const claimMutation = useMutation({
    mutationFn: async ({ itemId, name, email }) => {
      const { data, error } = await supabase.rpc('claim_public_shared_list_item', {
        p_token: token,
        p_item_id: itemId,
        p_name: name,
        p_email: email,
      });
      if (error) throw error;
      localStorage.setItem(`shared-list-claim:${itemId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicGroupItems', list?.id] });
      setClaimingId(null);
      setClaimName('');
      setClaimEmail('');
      toast.success("You've got it! No one else will buy this now 🎁");
    },
  });

  const unclaimMutation = useMutation({
    mutationFn: async ({ itemId }) => {
      const claimSecret = localStorage.getItem(`shared-list-claim:${itemId}`);
      if (!claimSecret) throw new Error('This item can only be unclaimed from the browser that claimed it.');
      const { data, error } = await supabase.rpc('unclaim_public_shared_list_item', {
        p_token: token,
        p_item_id: itemId,
        p_claim_secret: claimSecret,
      });
      if (error) throw error;
      if (!data) throw new Error('The claim could not be verified.');
      localStorage.removeItem(`shared-list-claim:${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicGroupItems', list?.id] });
      toast.success('Item unclaimed');
    },
  });

  const handleCheckBlocked = () => {
    if (list?.recipient_email && blockedEmail.toLowerCase().trim() === list.recipient_email.toLowerCase().trim()) {
      setIsBlocked(true);
    }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-sand-200 border-t-terracotta rounded-full animate-spin" />
    </div>
  );

  if (!list) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 p-6">
      <div className="text-4xl">🔍</div>
      <h1 className="font-heading font-bold text-xl text-ink">List not found</h1>
      <p className="text-sm text-ink-soft text-center">This link may have expired or been removed.</p>
    </div>
  );

  // Email guard — ask visitor to confirm they're not the recipient
  if (list.recipient_email && !isBlocked && claimName === '' && claimEmail === '') {
    // Only show guard if we haven't interacted yet — handled inline
  }

  if (isBlocked) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-5xl">🙈</div>
      <h1 className="font-heading font-bold text-xl text-ink">Oops! This is a surprise.</h1>
      <p className="text-sm text-ink-soft text-center max-w-xs">
        This list is meant to be a secret from you, {list.recipient_name}! Please don't peek — something special is being planned for you 💛
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-full bg-terracotta/10 flex items-center justify-center mx-auto">
            <Gift className="w-7 h-7 text-terracotta" />
          </div>
          <h1 className="font-heading font-bold text-2xl text-ink">{list.title}</h1>
          <p className="text-sm text-ink-soft">For {list.recipient_name} · {list.occasion?.replace(/_/g, ' ')}</p>
          <p className="text-xs text-ink-soft bg-sand-100 rounded-full px-4 py-1.5 inline-block">
            Claim an item so nobody else buys the same thing 🎁
          </p>
        </div>

        {/* Recipient email check */}
        {list.recipient_email && (
          <div className="bg-sand-100 border border-sand-300 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-heading font-semibold text-ink">Are you {list.recipient_name}?</p>
            <p className="text-xs text-ink-soft">Enter your email to confirm you should see this.</p>
            <div className="flex gap-2">
              <input
                value={blockedEmail}
                onChange={e => setBlockedEmail(e.target.value)}
                placeholder="Your email"
                className="flex-1 border border-sand-300 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/50"
              />
              <button onClick={handleCheckBlocked} className="px-4 py-2 bg-sand-200 text-ink rounded-xl text-sm font-medium hover:bg-sand-300 transition-all">
                Check
              </button>
            </div>
          </div>
        )}

        {/* Items */}
        {items.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink-soft">No ideas added yet — check back soon!</div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className={`bg-white border rounded-2xl p-4 transition-all ${item.is_claimed ? 'border-moss/30 bg-moss/5 opacity-75' : 'border-sand-300'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className={`font-heading font-semibold text-sm ${item.is_claimed ? 'line-through text-ink-soft' : 'text-ink'}`}>{item.name}</p>
                    {item.estimated_price && <p className="text-xs text-ink-soft">{item.estimated_price}</p>}
                    {item.description && <p className="text-xs text-ink-soft mt-0.5">{item.description}</p>}
                    {item.link && (
                      <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-terracotta hover:underline mt-1">
                        View link <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                {item.is_claimed ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-moss-dark font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Claimed by {item.claimed_by_name}
                    </span>
                    {/* Allow unclaiming if you're the one who claimed it */}
                    <button
                      onClick={() => unclaimMutation.mutate(
                        { itemId: item.id },
                        { onError: error => toast.error(error.message) }
                      )}
                      className="text-xs text-ink-soft hover:text-terracotta transition-colors"
                    >
                      Not buying it? Unclaim
                    </button>
                  </div>
                ) : (
                  <>
                    {claimingId === item.id ? (
                      <div className="space-y-2 mt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input value={claimName} onChange={e => setClaimName(e.target.value)} placeholder="Your name *" className="border border-sand-300 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/50" />
                          <input value={claimEmail} onChange={e => setClaimEmail(e.target.value)} placeholder="Your email *" className="border border-sand-300 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-terracotta/50" />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!claimName || !claimEmail) { toast.error('Name and email needed'); return; }
                              if (list.recipient_email && claimEmail.toLowerCase().trim() === list.recipient_email.toLowerCase().trim()) {
                                setIsBlocked(true); return;
                              }
                              claimMutation.mutate({ itemId: item.id, name: claimName, email: claimEmail });
                            }}
                            className="flex-1 bg-terracotta text-white py-2 rounded-full text-xs font-heading font-semibold hover:bg-terracotta-dark transition-all"
                          >
                            I'll buy this 🎁
                          </button>
                          <button onClick={() => setClaimingId(null)} className="px-3 py-2 rounded-full text-xs text-ink-soft hover:bg-sand-100 transition-all">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setClaimingId(item.id)}
                        className="mt-2 text-xs font-heading font-semibold text-terracotta hover:text-terracotta-dark transition-colors"
                      >
                        I'll buy this →
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-ink-soft pb-4">Made with 💛 by How Thoughtful</p>
      </div>
    </div>
  );
}
