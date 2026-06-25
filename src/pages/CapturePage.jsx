import ConversationalCapture from '@/components/ConversationalCapture';

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="font-accent text-2xl text-muted-foreground mb-1">capture</p>
        <h1 className="font-heading font-bold text-3xl text-foreground">Start with what you know</h1>
        <p className="text-muted-foreground mt-2">
          No form-filling marathon. Say the messy version first, then approve the tidy plan.
        </p>
      </div>
      <ConversationalCapture />
    </div>
  );
}
