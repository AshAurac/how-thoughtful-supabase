import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Sparkles, Check, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(String(reader.result || '').split(',')[1] || '');
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

function ReviewList({ title, items, empty }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <h3 className="font-heading font-semibold text-foreground mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="bg-muted rounded-xl p-3 text-sm">
              <p className="font-heading font-semibold text-foreground">
                {item.name || item.recipient_name || item.title || item.occasion || 'Captured detail'}
              </p>
              <p className="text-muted-foreground">
                {[item.relationship, item.occasion, item.event_date, item.budget ? `A$${item.budget}` : null, item.notes]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConversationalCapture({ compact = false }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [draft, setDraft] = useState(null);
  const [allowance, setAllowance] = useState(null);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [answer, setAnswer] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const analyse = async (payload) => {
    setLoading(true);
    try {
      const result = await base44.functions.invoke('capturePlan', payload);
      setDraft(result.draft);
      setAllowance(result.allowance);
      setMeta({
        audio_used: result.audio_used,
        model: result.model,
        transcript_sha256: result.transcript_sha256,
      });
    } catch (error) {
      toast.error(error.message || 'Could not understand that yet.');
    } finally {
      setLoading(false);
    }
  };

  const handleTextSubmit = () => {
    if (!text.trim()) {
      toast.info('Try something like “Mum’s birthday is next month and she loves gardening.”');
      return;
    }
    analyse({ input_type: 'text', text });
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const audio_base64 = await blobToBase64(blob);
        analyse({ input_type: 'audio', audio_base64, audio_mime: blob.type || 'audio/webm' });
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      window.setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
        setRecording(false);
      }, 5 * 60 * 1000);
    } catch {
      toast.error('Microphone access was blocked. Typing works just as well.');
    }
  };

  const continueCapture = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const result = await base44.functions.invoke('continueCapture', { draft, answer });
      setDraft(result.draft);
      setAnswer('');
    } catch (error) {
      toast.error(error.message || 'Could not add that detail.');
    } finally {
      setLoading(false);
    }
  };

  const commit = async () => {
    setLoading(true);
    try {
      await base44.functions.invoke('commitCapturePlan', {
        draft,
        ...meta,
        idempotency_key: crypto.randomUUID(),
      });
      toast.success('Your plan is ready.');
      navigate('/');
    } catch (error) {
      toast.error(error.message || 'Could not save the plan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-terracotta" />
          <h2 className="font-heading font-bold text-xl text-foreground">Tell us what’s coming up</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Type or talk naturally. You can mention people, dates, budgets, gift ideas, worries — the app will sort it into a plan before saving.
        </p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. Hannah’s 3rd birthday is on 12 August. She loves Bluey and dinosaurs. Budget around $40. Also Dad’s Father’s Day gift needs posting."
          className="w-full min-h-[130px] rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-terracotta/30"
        />
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <button
            type="button"
            onClick={handleTextSubmit}
            disabled={loading}
            className="flex-1 bg-terracotta text-white rounded-full py-3 font-heading font-semibold hover:bg-terracotta-dark disabled:opacity-60"
          >
            {loading ? 'Reading it…' : 'Understand this'}
          </button>
          <button
            type="button"
            onClick={toggleRecording}
            disabled={loading}
            className={`flex items-center justify-center gap-2 rounded-full py-3 px-5 font-heading font-semibold border ${recording ? 'border-terracotta text-terracotta bg-terracotta/10' : 'border-border text-foreground bg-background'}`}
          >
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {recording ? 'Stop' : 'Talk'}
          </button>
        </div>
        {allowance && (
          <p className="text-xs text-muted-foreground mt-3">
            Capture allowance: {allowance.remaining} of {allowance.limit} left{allowance.scope === 'free_lifetime' ? ' on Free' : ' this month'}.
          </p>
        )}
      </div>

      {draft && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-moss" />
            <h2 className="font-heading font-bold text-xl text-foreground">Here’s what I understood</h2>
          </div>
          <ReviewList title="People" items={draft.people || []} empty="No people detected yet." />
          <ReviewList title="Occasions" items={draft.occasions || []} empty="No occasions detected yet." />
          <ReviewList title="Next actions" items={draft.actions || []} empty="No actions detected yet." />

          {draft.follow_up_question ? (
            <div className="bg-butter/20 border border-butter rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-butter-dark" />
                <p className="font-heading font-semibold text-foreground">{draft.follow_up_question}</p>
              </div>
              <div className="flex gap-2">
                <input
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      continueCapture();
                    }
                  }}
                  placeholder="Add the missing detail"
                  className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none"
                />
                <button onClick={continueCapture} disabled={loading} className="bg-ink text-white rounded-full px-4 font-heading font-semibold text-sm">
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={commit}
              disabled={loading}
              className="w-full bg-ink text-white rounded-2xl py-4 font-heading font-bold hover:bg-ink/90 disabled:opacity-60"
            >
              {loading ? 'Making your plan…' : 'Make my plan'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
