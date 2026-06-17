import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Sparkles, Lightbulb, Bookmark, BookmarkCheck, ExternalLink, ChevronDown, X } from 'lucide-react';
import { getCuratedIdeas } from '@/lib/catalogs';
import PaywallModal from '@/components/PaywallModal';
import NativePicker from '@/components/NativePicker';

const AFFILIATE_TAG = 'howthoughtful-20';

function IdeaCard({ idea, onSave, saved }) {
  const amazonUrl = `https://www.amazon.com/s?k=${encodeURIComponent(idea.name)}&tag=${AFFILIATE_TAG}`;
  const isFree = idea.estimated_price === '$0' || idea.is_free;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 hover:border-terracotta/40 transition-all">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-heading font-semibold text-foreground text-sm">{idea.name}</h3>
            {isFree && (
              <span className="px-2 py-0.5 bg-moss/20 text-moss-dark text-xs rounded-full font-medium">free</span>
            )}
          </div>
          {idea.estimated_price && !isFree && (
            <span className="text-xs text-muted-foreground">{idea.estimated_price}</span>
          )}
        </div>
        <button
          onClick={() => onSave(idea)}
          className="p-2.5 rounded-full hover:bg-muted transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          {saved ? (
            <BookmarkCheck className="w-4 h-4 text-terracotta" />
          ) : (
            <Bookmark className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
      {idea.description && <p className="text-sm text-muted-foreground mb-2">{idea.description}</p>}
      {idea.why_it_works && (
        <p className="text-xs text-moss-dark italic mb-2">{idea.why_it_works}</p>
      )}
      {!isFree && (
        <a
          href={amazonUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-terracotta hover:text-terracotta-dark"
        >
          Find on Amazon <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

export default function IdeasPage({ user }) {
  const urlParams = new URLSearchParams(window.location.search);
  const defaultTab = urlParams.get('tab') === 'curated' ? 'curated' : 'ai';
  const eventId = urlParams.get('event_id');

  const [tab, setTab] = useState(defaultTab);
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paywallReason, setPaywallReason] = useState(null);
  const [recipient, setRecipient] = useState(urlParams.get('recipient') || '');
  const [selectedRecipientId, setSelectedRecipientId] = useState(null);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);
  const [occasion, setOccasion] = useState('birthday');
  const [budget, setBudget] = useState('50');
  const [savedIds, setSavedIds] = useState(new Set());

  // Track local uses in state so the gate re-evaluates on every render
  const currentMonth = new Date().toISOString().slice(0, 7);
  const lsKey = `ai_uses_${currentMonth}`;
  const [localUses, setLocalUses] = useState(() => parseInt(localStorage.getItem(lsKey) || '0', 10));

  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      return profiles[0] || null;
    },
    enabled: !!user,
  });

  const { data: savedIdeas = [] } = useQuery({
    queryKey: ['savedIdeas', user?.email],
    queryFn: () => base44.entities.SavedIdea.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  const { data: recipients = [] } = useQuery({
    queryKey: ['recipients'],
    queryFn: () => base44.entities.Recipient.list(),
    enabled: !!user,
  });

  const { data: currentEvent } = useQuery({
    queryKey: ['ideaEvent', eventId],
    queryFn: async () => {
      const events = await base44.entities.Event.filter({ id: eventId });
      return events[0] || null;
    },
    enabled: !!user && !!eventId,
  });

  useEffect(() => {
    setSavedIds(new Set(savedIdeas.map(s => s.name)));
  }, [savedIdeas]);

  useEffect(() => {
    if (!currentEvent) return;
    setRecipient(currentEvent.recipient_name || '');
    setOccasion(currentEvent.occasion || 'birthday');
    setBudget(String(currentEvent.budget || 50));
    if (currentEvent.recipient_id) setSelectedRecipientId(currentEvent.recipient_id);
  }, [currentEvent]);

  useEffect(() => {
    if (selectedRecipientId || !recipient || recipients.length === 0) return;
    const match = recipients.find(r => r.name?.toLowerCase() === recipient.toLowerCase());
    if (match) setSelectedRecipientId(match.id);
  }, [recipient, recipients, selectedRecipientId]);

  const isPremium = profile?.is_premium;

  // If premium, use profile data; otherwise fall back to localStorage
  const monthlyUses = isPremium
    ? (profile?.monthly_ai_reset_month === currentMonth ? (profile?.monthly_ai_uses || 0) : 0)
    : localUses;

  const FREE_LIMIT = 3;
  const PREMIUM_LIMIT = 30;
  const limit = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
  const usesRemaining = Math.max(0, limit - monthlyUses);
  const canUseAI = usesRemaining > 0;

  const aiButtonLabel = () => {
    if (usesRemaining > 0) return `Generate AI ideas (${usesRemaining} left this month)`;
    return isPremium ? "Monthly limit reached" : "Unlock AI ideas";
  };

  const aiStatusBadge = () => {
    if (isPremium) return <span className="text-xs text-moss font-medium">{usesRemaining} of {PREMIUM_LIMIT} uses this month</span>;
    if (usesRemaining > 0) return <span className="text-xs text-terracotta font-medium">{usesRemaining} free uses this month</span>;
    return <span className="text-xs text-muted-foreground">free limit reached</span>;
  };

  const handleGetAI = async () => {
    if (!canUseAI) {
      setPaywallReason(isPremium ? 'out_of_credits' : 'paywall');
      return;
    }

    setLoading(true);
    try {
      // Build recipient context from saved profile if available
      const recipientProfile = selectedRecipientId
        ? recipients.find(r => r.id === selectedRecipientId)
        : null;

      const recipientLines = [];
      if (recipientProfile?.age) recipientLines.push(`Age: ${recipientProfile.age}`);
      if (recipientProfile?.relationship) recipientLines.push(`Relationship to giver: ${recipientProfile.relationship}`);
      if (recipientProfile?.interests?.length) recipientLines.push(`Known interests & hobbies: ${recipientProfile.interests.join(', ')}`);
      if (recipientProfile?.notes) recipientLines.push(`Personal notes about them: ${recipientProfile.notes}`);
      if (recipientProfile?.love_language) recipientLines.push(`Their love language: ${recipientProfile.love_language.replace(/_/g, ' ')}`);
      if (recipientProfile?.style_preferences) recipientLines.push(`Their style and preferences: ${recipientProfile.style_preferences}`);
      if (recipientProfile?.gift_likes) recipientLines.push(`Things they love: ${recipientProfile.gift_likes}`);
      if (recipientProfile?.gift_avoidances) recipientLines.push(`Things to avoid: ${recipientProfile.gift_avoidances}`);
      if (recipientProfile?.wishlist_notes) recipientLines.push(`Wishlist or past gift notes: ${recipientProfile.wishlist_notes}`);

      const occasionLines = [];
      if (currentEvent?.notes) occasionLines.push(`Occasion notes: ${currentEvent.notes}`);
      if (currentEvent?.style_preferences) occasionLines.push(`Occasion-specific style/preferences: ${currentEvent.style_preferences}`);
      if (currentEvent?.gift_likes) occasionLines.push(`Occasion-specific things they love: ${currentEvent.gift_likes}`);
      if (currentEvent?.gift_avoidances) occasionLines.push(`Occasion-specific things to avoid: ${currentEvent.gift_avoidances}`);
      if (currentEvent?.wishlist_notes) occasionLines.push(`Occasion-specific wishlist/past gift notes: ${currentEvent.wishlist_notes}`);

      const giverLines = [];
      if (profile?.skills?.length) giverLines.push(`Giver's skills (for handmade/personal ideas): ${profile.skills.join(', ')}`);
      if (profile?.intention) giverLines.push(`Giver's intention this gifting season: ${profile.intention}`);
      if (profile?.personality) giverLines.push(`Giver's personality/style: ${profile.personality}`);

      const prompt = `You are a thoughtful gift recommendation expert. Prioritise ideas in this order:

1. MOST IMPORTANT — The recipient as a person:
   Name: ${recipient || 'a friend'}
   ${recipientLines.length ? recipientLines.join('\n   ') : 'No profile saved — use the occasion and trends to guide ideas.'}

2. The occasion: ${occasion.replace(/_/g, ' ')} — consider what would feel meaningful and appropriate for this milestone.
   ${occasionLines.length ? occasionLines.join('\n   ') : 'No extra occasion context.'}

3. Current gift trends — check what is popular and well-reviewed right now that would genuinely fit this person's interests. Do not suggest generic trending gifts if they don't match the recipient.

4. LEAST IMPORTANT — The giver's context. Use this only after recipient and occasion fit are satisfied:
   ${giverLines.length ? giverLines.join('\n   ') : 'No giver profile.'}

Budget: $${budget || 50}. Vary price points within budget.

Suggest exactly 6 specific, creative, intentional gift ideas. Ideas should feel like they were chosen FOR THIS PERSON, not generic.
Return STRICT JSON only — no prose, no markdown — as:
{"ideas":[{"name":"...","description":"...","estimated_price":"$XX","why_it_works":"one sentence on why this suits them specifically"}]}
CRUCIAL: at least ONE idea MUST be free ($0) — a personal act, skill, or gift of time that suits the recipient.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            ideas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  estimated_price: { type: "string" },
                  why_it_works: { type: "string" },
                }
              }
            }
          }
        }
      });

      setIdeas(result.ideas || []);

      // Update usage tracking
      const newUses = monthlyUses + 1;
      if (!isPremium) {
        localStorage.setItem(lsKey, String(newUses));
        setLocalUses(newUses);
        if (newUses >= FREE_LIMIT) {
          toast('That was your last free AI idea this month — upgrade for more!');
        }
      }

      if (user?.email) {
        const profiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
        if (profiles[0]) {
          await base44.entities.UserProfile.update(profiles[0].id, {
            monthly_ai_uses: newUses,
            monthly_ai_reset_month: currentMonth,
          });
          queryClient.invalidateQueries({ queryKey: ['userProfile'] });
        }
      }
    } catch (err) {
      toast.error(err?.message || 'Something went wrong. Try again.');
    }
    setLoading(false);
  };

  const handleGetCurated = () => {
    const recipientProfile = selectedRecipientId
      ? recipients.find(r => r.id === selectedRecipientId)
      : null;
    const { ideas: curatedIdeas } = getCuratedIdeas(
      profile?.skills || [],
      recipientProfile?.love_language || null,
      recipientProfile?.interests || [],
      occasion
    );
    setIdeas(curatedIdeas);
  };

  const handleSave = async (idea) => {
    if (savedIds.has(idea.name)) {
      toast('Already saved');
      return;
    }
    await base44.entities.SavedIdea.create({
      name: idea.name,
      description: idea.description || '',
      estimated_price: idea.estimated_price || '',
      why_it_works: idea.why_it_works || '',
      recipient_name: recipient,
      event_id: urlParams.get('event_id') || undefined,
    });
    setSavedIds(s => new Set([...s, idea.name]));
    queryClient.invalidateQueries({ queryKey: ['savedIdeas'] });
    toast.success('Saved to your ideas');
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="font-accent text-muted-foreground text-lg">find something meaningful</p>
        <h1 className="font-heading font-bold text-2xl text-foreground">Gift Ideas</h1>
      </div>

      {/* Tab toggle */}
      <div className="flex bg-muted rounded-full p-1 gap-1">
        <button
          onClick={() => setTab('ai')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-heading font-semibold transition-all ${
            tab === 'ai' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4 text-terracotta" />
          AI personalized
          {usesRemaining > 0 && (
            <span className="w-2 h-2 rounded-full bg-terracotta animate-shimmer" />
          )}
        </button>
        <button
          onClick={() => setTab('curated')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-heading font-semibold transition-all ${
            tab === 'curated' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lightbulb className="w-4 h-4 text-moss" />
          Curated (free)
        </button>
      </div>

      {/* Form */}
      <div className="space-y-3">
        {/* Recipient picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRecipientPicker(v => !v)}
            className="w-full flex items-center justify-between border border-border rounded-2xl px-4 py-3 bg-card text-left focus:outline-none focus:ring-2 focus:ring-terracotta/50"
          >
            <span className={recipient ? 'text-foreground font-body' : 'text-muted-foreground font-body'}>
              {recipient || 'Who is this for?'}
            </span>
            <div className="flex items-center gap-2">
              {recipient && (
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); setRecipient(''); setSelectedRecipientId(null); }}
                  className="p-1 rounded-full hover:bg-muted"
                >
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
                  onClick={() => { setRecipient(r.name); setSelectedRecipientId(r.id); setShowRecipientPicker(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-all text-left"
                >
                  <span className="font-body text-sm text-foreground">{r.name}</span>
                  {r.relationship && <span className="text-xs text-muted-foreground">{r.relationship}</span>}
                </button>
              ))}
              <div className="border-t border-border px-4 py-2">
                <input
                  autoFocus
                  value={recipient}
                  onChange={e => { setRecipient(e.target.value); setSelectedRecipientId(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') setShowRecipientPicker(false); }}
                  placeholder="Or type a name…"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none py-1 font-body"
                />
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NativePicker
            label="Occasion"
            value={occasion}
            onChange={v => setOccasion(v)}
            options={['birthday','anniversary','holiday','graduation','baby_shower','wedding','thank_you','just_because'].map(o => ({ value: o, label: o.replace(/_/g, ' ') }))}
          />
          <input
            type="number"
            value={budget}
            onChange={e => setBudget(e.target.value)}
            placeholder="Budget ($)"
            className="border border-border rounded-2xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body"
          />
        </div>
      </div>

      {/* CTA button */}
      {tab === 'ai' ? (
        <div className="space-y-2">
          <button
            onClick={handleGetAI}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-ink text-white py-4 rounded-full font-heading font-semibold hover:bg-ink/90 transition-all hover:-translate-y-0.5 disabled:opacity-60"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Finding ideas...
              </span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-butter" />
                {aiButtonLabel()}
              </>
            )}
          </button>
          <div className="text-center">{aiStatusBadge()}</div>
        </div>
      ) : (
        <button
          onClick={handleGetCurated}
          className="w-full flex items-center justify-center gap-2 bg-moss text-white py-4 rounded-full font-heading font-semibold hover:bg-moss-dark transition-all hover:-translate-y-0.5"
        >
          <Lightbulb className="w-4 h-4" />
          Get free curated ideas
        </button>
      )}

      {/* Results */}
      {ideas.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-foreground">
            {ideas.length} ideas for {recipient || 'them'}
          </h2>
          {ideas.map((idea, i) => (
            <IdeaCard
              key={i}
              idea={idea}
              onSave={handleSave}
              saved={savedIds.has(idea.name)}
            />
          ))}
        </div>
      )}

      {paywallReason && (
        <PaywallModal reason={paywallReason} onClose={() => setPaywallReason(null)} />
      )}
    </div>
  );
}
