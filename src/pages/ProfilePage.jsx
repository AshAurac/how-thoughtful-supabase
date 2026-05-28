import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { LogOut, Trash2, AlertTriangle, Sun, Moon, Sparkles, Mail, CheckCircle2, Plus, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LOVE_LANGUAGES } from '@/lib/catalogs';
import NativePicker from '@/components/NativePicker';
import { useFeatureFlags, FEATURES } from '@/hooks/useFeatureFlags';
import FeedbackCard from '@/components/FeedbackCard';

function useDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDark(next);
  };
  return [isDark, toggle];
}

const SKILLS = ['cooking','writing','photography','music','art','gardening','knitting','coding','fitness','yoga','sewing','language','carpentry'];

export default function ProfilePage({ user }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    skills: [], love_languages_give: [], love_languages_receive: [],
    personality: '', work: '', free_text: '', intention: '',
    intention_year: new Date().getFullYear(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const [profileId, setProfileId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDark, toggleDark] = useDarkMode();
  const [verifyState, setVerifyState] = useState('idle'); // idle | sending | sent
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [customSkill, setCustomSkill] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { isUnlocked, toggle: toggleFeature } = useFeatureFlags(user);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const profiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      return profiles[0] || null;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setProfileId(profile.id);
      setForm({
        skills: profile.skills || [],
        love_languages_give: profile.love_languages_give || [],
        love_languages_receive: profile.love_languages_receive || [],
        personality: profile.personality || '',
        work: profile.work || '',
        free_text: profile.free_text || '',
        intention: profile.intention || '',
        intention_year: profile.intention_year || new Date().getFullYear(),
        timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  }, [profile]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleArray = (key, val) => {
    setForm(f => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter(v => v !== val) : [...f[key], val],
    }));
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (profileId) {
        return base44.entities.UserProfile.update(profileId, { ...data, profile_completed: true });
      } else {
        return base44.entities.UserProfile.create({ ...data, profile_completed: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setSaveSuccess(true);
      toast.success('Profile saved!');
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <p className="font-accent text-muted-foreground text-lg">about you</p>
        <h1 className="font-heading font-bold text-2xl text-foreground">Your Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">This helps generate more personal gift ideas for your style.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Skills */}
        <div>
          <label className="block font-heading font-semibold text-foreground mb-2">Your skills & interests</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {SKILLS.map(skill => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleArray('skills', skill)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all capitalize ${
                  form.skills.includes(skill)
                    ? 'bg-terracotta text-white'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {skill}
              </button>
            ))}
            {/* Custom skills */}
            {form.skills.filter(s => !SKILLS.includes(s)).map(skill => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleArray('skills', skill)}
                className="px-3 py-1.5 rounded-full text-sm transition-all capitalize bg-terracotta text-white flex items-center gap-1"
              >
                {skill} <X className="w-3 h-3" />
              </button>
            ))}
          </div>
          {/* Add custom skill */}
          <div className="flex gap-2">
            <input
              value={customSkill}
              onChange={e => setCustomSkill(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = customSkill.trim().toLowerCase();
                  if (val && !form.skills.includes(val)) toggleArray('skills', val);
                  setCustomSkill('');
                }
              }}
              placeholder="Add your own..."
              className="flex-1 border border-border rounded-full px-4 py-2 text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body"
            />
            <button
              type="button"
              onClick={() => {
                const val = customSkill.trim().toLowerCase();
                if (val && !form.skills.includes(val)) toggleArray('skills', val);
                setCustomSkill('');
              }}
              className="w-9 h-9 rounded-full bg-terracotta text-white flex items-center justify-center hover:bg-terracotta-dark transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Love languages — give */}
        <div>
          <label className="block font-heading font-semibold text-foreground mb-2">How you love to give</label>
          <div className="flex flex-wrap gap-2">
            {LOVE_LANGUAGES.map(l => (
              <button
                key={l.value}
                type="button"
                onClick={() => toggleArray('love_languages_give', l.value)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  form.love_languages_give.includes(l.value)
                    ? 'bg-moss text-white'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">What I do for work</label>
          <input
            value={form.work}
            onChange={e => set('work', e.target.value)}
            placeholder="Teacher, designer, parent..."
            className="w-full border border-border rounded-2xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">A bit about you</label>
          <textarea
            value={form.free_text}
            onChange={e => set('free_text', e.target.value)}
            placeholder="What makes you you? Helps AI understand your style."
            rows={3}
            className="w-full border border-border rounded-2xl px-4 py-3 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body resize-none"
          />
        </div>

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Your timezone</label>
          <NativePicker
            label="Your timezone"
            value={form.timezone}
            onChange={v => set('timezone', v)}
            options={Intl.supportedValuesOf('timeZone').map(tz => ({ value: tz, label: tz.replace(/_/g, ' ') }))}
            placeholder="Select timezone..."
          />
          <p className="text-xs text-muted-foreground mt-1">Used to send reminders at the right time for you.</p>
        </div>

        {/* Yearly intention */}
        <div className="bg-muted border border-border rounded-2xl p-4">
          <p className="font-accent text-muted-foreground mb-2">this year I want to give more...</p>
          <textarea
            value={form.intention}
            onChange={e => set('intention', e.target.value)}
            placeholder="e.g. handmade gifts, experiences, my time..."
            rows={2}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-terracotta/50 font-body resize-none text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className={`w-full py-4 rounded-full font-heading font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2 ${
            saveSuccess ? 'bg-moss text-white' : 'bg-terracotta text-white hover:bg-terracotta-dark'
          }`}
        >
          {mutation.isPending ? 'Saving...' : saveSuccess ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : 'Save profile'}
        </button>
      </form>

      {/* AI Credits bar — lifetime users */}
      {profile?.is_premium && profile?.premium_type === 'lifetime' && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-terracotta" />
            <span className="font-heading font-semibold text-foreground">AI Credits</span>
            <span className="ml-auto font-heading font-bold text-foreground">{profile?.ai_credits || 0} left</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-terracotta rounded-full transition-all"
              style={{ width: `${Math.min(100, ((profile?.ai_credits || 0) / 200) * 100)}%` }}
            />
          </div>
          {(profile?.ai_credits || 0) <= 0 ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-muted-foreground">You've used all your credits. Top up to keep going:</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'credits_50', credits: 50, price: '$2.99' },
                  { id: 'credits_150', credits: 150, price: '$6.99', best: true },
                  { id: 'credits_400', credits: 400, price: '$14.99' },
                ].map(pack => (
                  <Link
                    key={pack.id}
                    to={`/upgrade`}
                    className={`relative flex flex-col items-center py-3 px-2 rounded-2xl border text-center hover:border-terracotta/50 transition-all ${pack.best ? 'border-terracotta' : 'border-border'}`}
                  >
                    {pack.best && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-terracotta text-white text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap">Best value</span>
                    )}
                    <span className="font-heading font-bold text-foreground text-sm mt-1">{pack.price}</span>
                    <span className="text-xs text-muted-foreground">{pack.credits} credits</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Each AI idea generation uses 1 credit.</p>
          )}
        </div>
      )}

      {/* Email verification */}
      <div className="bg-card border border-border rounded-2xl px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="text-sm font-body text-foreground">{user?.email}</p>
              <p className="text-xs text-muted-foreground">Verification status for your account</p>
            </div>
          </div>
          {user?.email_confirmed_at ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" /> Unverified
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-3">
          <p className="text-xs text-muted-foreground">
            {user?.email_confirmed_at
              ? 'Your email is verified and you can continue with purchases and premium features.'
              : 'You can still use the app, but checkout and premium features require email verification.'}
          </p>
          {!user?.email_confirmed_at && (
            <button
              type="button"
              disabled={verificationBusy}
              onClick={async () => {
                try {
                  setVerificationBusy(true);
                  await base44.auth.resendVerificationEmail(user.email);
                  toast.success('Verification email sent — check your inbox.');
                } catch (error) {
                  toast.error(error?.message || 'Could not send verification email.');
                } finally {
                  setVerificationBusy(false);
                }
              }}
              className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-all disabled:opacity-60"
            >
              {verificationBusy ? 'Sending…' : 'Resend Verification Email'}
            </button>
          )}
        </div>
      </div>

      {/* Features panel */}
      <div className="bg-card border border-border rounded-2xl px-5 py-4 space-y-4">
        <div>
          <p className="font-heading font-semibold text-foreground">Features</p>
          <p className="text-xs text-muted-foreground mt-0.5">Turn on sections you're ready to explore, or let them unlock naturally as you use the app.</p>
        </div>
        <div className="space-y-3">
          {Object.entries(FEATURES).map(([key, feat]) => {
            const on = isUnlocked(key);
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body text-foreground">{feat.label}</p>
                  <p className="text-xs text-muted-foreground leading-tight">{feat.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFeature(key, !on)}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${on ? 'bg-terracotta' : 'bg-border'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dark mode toggle */}
      <div className="flex items-center justify-between bg-card border border-border rounded-2xl px-5 py-4">
        <div className="flex items-center gap-3">
          {isDark ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
          <span className="font-body text-sm text-foreground">{isDark ? 'Dark mode' : 'Light mode'}</span>
        </div>
        <button
          type="button"
          onClick={toggleDark}
          className={`relative w-11 h-6 rounded-full transition-colors ${isDark ? 'bg-terracotta' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <FeedbackCard user={user} />

      <footer className="rounded-3xl border border-border bg-card px-5 py-4 text-center">
        <p className="text-xs text-muted-foreground mb-2">Helpful links</p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
      </footer>

      <button
        onClick={() => base44.auth.logout('/')}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all font-body text-sm select-none min-h-[44px]"
      >
        <LogOut className="w-4 h-4" />
        Log out
      </button>

      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-full border border-destructive/30 text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-all font-body text-sm select-none min-h-[44px]"
      >
        <Trash2 className="w-4 h-4" />
        Delete account
      </button>

      {/* Delete account confirmation sheet */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full bg-card rounded-t-3xl shadow-2xl px-6 py-6"
            style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center mb-5">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
            </div>
            <h3 className="font-heading font-bold text-foreground text-xl text-center mb-2">Delete your account?</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
              This will permanently delete all your events, recipients, gifts, and profile data. This cannot be undone.
            </p>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  try {
                    if (profileId) await base44.entities.UserProfile.delete(profileId);
                    await base44.auth.logout('/welcome');
                  } catch {
                    toast.error('Could not delete account. Please contact support.');
                  }
                }}
                className="w-full bg-destructive text-destructive-foreground py-4 rounded-full font-heading font-semibold transition-all hover:opacity-90 select-none min-h-[44px]"
              >
                Yes, delete my account
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full border border-border text-foreground py-4 rounded-full font-heading font-semibold hover:bg-muted transition-all select-none min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}