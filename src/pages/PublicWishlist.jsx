import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { Gift, ExternalLink, Heart } from 'lucide-react';

const PRIORITY_LABEL = { low: 'Nice to have', medium: 'Would love it', high: 'Really wants this' };
const PRIORITY_COLOR = {
  low: 'bg-sand-200 text-ink-soft',
  medium: 'bg-butter/30 text-butter-dark',
  high: 'bg-terracotta/20 text-terracotta',
};

export default function PublicWishlist() {
  const { token } = useParams();

  // Auto-unlock wishlist feature if the user is authenticated
  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!authed) return;
      try {
        const profiles = await base44.entities.UserProfile.list();
        const profile = profiles[0];
        if (profile && !profile.feature_wishlist) {
          await base44.entities.UserProfile.update(profile.id, { feature_wishlist: true });
        }
      } catch {}
    });
  }, []);

  const { data: wishlist, isLoading } = useQuery({
    queryKey: ['publicWishlist', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_wishlist', { p_token: token });
      if (error) throw error;
      return data?.[0] || null;
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sand-200 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  if (!wishlist) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Gift className="w-12 h-12 text-sand-300" />
        <h1 className="font-heading font-bold text-2xl text-ink">Wishlist not found</h1>
        <p className="text-ink-soft text-sm">This link may have expired or been removed.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-sand-300 px-6 py-8 text-center">
        <div className="w-14 h-14 rounded-full bg-terracotta/10 flex items-center justify-center mx-auto mb-3">
          <Heart className="w-7 h-7 text-terracotta" />
        </div>
        <h1 className="font-heading font-bold text-2xl text-ink">{wishlist.title || 'Wishlist'}</h1>
        <p className="text-sm text-ink-soft mt-1 font-accent">a few things they'd love</p>
      </div>

      {/* Items */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {(!wishlist.items || wishlist.items.length === 0) ? (
          <div className="text-center py-10">
            <p className="font-accent text-xl text-ink-soft">nothing added yet</p>
          </div>
        ) : (
          wishlist.items.map((item, idx) => (
            <div key={idx} className="bg-white border border-sand-300 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h3 className="font-heading font-semibold text-ink">{item.name}</h3>
                  {item.description && <p className="text-sm text-ink-soft mt-0.5">{item.description}</p>}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {item.price && (
                      <span className="text-sm text-ink-soft">~${item.price}</span>
                    )}
                    {item.priority && (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[item.priority] || PRIORITY_COLOR.medium}`}>
                        {PRIORITY_LABEL[item.priority] || item.priority}
                      </span>
                    )}
                  </div>
                </div>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 flex items-center gap-1 bg-terracotta text-white text-xs px-3 py-1.5 rounded-full font-medium hover:bg-terracotta-dark transition-all"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="text-center pb-10">
        <p className="text-xs text-ink-soft font-accent">made with How Thoughtful 🎁</p>
      </div>
    </div>
  );
}
