import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Heart, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function JoinEventPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error | login_required
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function accept() {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) {
        // Save token in session storage so we can resume after login
        sessionStorage.setItem('pending_event_invite', token);
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      try {
        // Auto-unlock deliveries & saved for collaborative users
        try {
          const profiles = await base44.entities.UserProfile.list();
          const profile = profiles[0];
          if (profile) {
            const updates = {};
            if (!profile.feature_deliveries) updates.feature_deliveries = true;
            if (!profile.feature_saved) updates.feature_saved = true;
            if (Object.keys(updates).length) await base44.entities.UserProfile.update(profile.id, updates);
          }
        } catch {}

        const res = await base44.functions.invoke('acceptEventInvite', { token });
        if (res?.event_id) {
          setStatus('success');
          setTimeout(() => navigate(`/events/${res.event_id}`), 2000);
        } else {
          setStatus('error');
          setMessage(res?.error || 'Something went wrong.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(err.message || 'Invalid or expired invite link.');
      }
    }
    accept();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-terracotta/10 flex items-center justify-center mx-auto">
          <Heart className="w-7 h-7 text-terracotta" />
        </div>
        <h1 className="font-heading font-bold text-2xl text-foreground">How Thoughtful</h1>

        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mx-auto" />
            <p className="text-muted-foreground">Accepting your invite…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-moss mx-auto" />
            <p className="font-heading font-semibold text-foreground">You're in! 🎉</p>
            <p className="text-sm text-muted-foreground">Taking you to the event now…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-heading font-semibold text-foreground">Invite issue</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate('/')}
              className="bg-terracotta text-white px-6 py-2.5 rounded-full font-heading font-semibold text-sm hover:bg-terracotta-dark transition-all"
            >
              Go home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
