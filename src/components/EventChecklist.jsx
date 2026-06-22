import { useState } from 'react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';

const CHECKLISTS = {
  birthday: [
    { id: 'gift', label: 'Get a gift 🎁' },
    { id: 'card', label: 'Write a heartfelt card ✉️' },
    { id: 'cake', label: 'Organise a cake or dessert 🎂' },
    { id: 'plan', label: 'Plan the day — meal, activity or party 🎉' },
    { id: 'invites', label: 'Send invites if applicable 📨' },
    { id: 'morning', label: 'Be first to wish them happy birthday ☀️' },
    { id: 'present', label: 'Be fully present — put your phone away 💛' },
  ],
  anniversary: [
    { id: 'gift', label: 'Choose a meaningful gift 🎁' },
    { id: 'reservation', label: 'Book a special dinner or experience 🍽️' },
    { id: 'card', label: 'Write a love note or card ✉️' },
    { id: 'photo', label: 'Plan a photo moment to remember 📷' },
    { id: 'surprise', label: 'Add one unexpected surprise element 🌹' },
    { id: 'present', label: 'Be fully present — no distractions 💛' },
  ],
  wedding: [
    { id: 'gift', label: 'Buy from their registry or give cash 💝' },
    { id: 'rsvp', label: 'RSVP and sort transport/accommodation 🏨' },
    { id: 'outfit', label: 'Sort outfit well in advance 👗' },
    { id: 'card', label: 'Write a genuine congratulations card ✉️' },
    { id: 'morning', label: 'Send morning-of message to the couple ☀️' },
    { id: 'present', label: 'Be fully present and celebrate them 💛' },
  ],
  baby_shower: [
    { id: 'gift', label: 'Buy from their registry 🍼' },
    { id: 'card', label: 'Write an encouraging card ✉️' },
    { id: 'food', label: 'Contribute to food/cake if hosting 🎂' },
    { id: 'game', label: 'Know any shower games in advance 🎮' },
  ],
  graduation: [
    { id: 'gift', label: 'Get a thoughtful gift or cash 🎓' },
    { id: 'card', label: 'Write a proud, encouraging card ✉️' },
    { id: 'meal', label: 'Book a celebratory meal 🍽️' },
    { id: 'photo', label: 'Take a proper photo together 📷' },
  ],
  holiday: [
    { id: 'gifts', label: 'Finalise all gifts and wrap them 🎁' },
    { id: 'cards', label: 'Write and send cards early ✉️' },
    { id: 'food', label: 'Plan or contribute to holiday meals 🍽️' },
    { id: 'travel', label: 'Confirm travel and logistics 🚗' },
    { id: 'present', label: 'Put devices away during family time 💛' },
  ],
  housewarming: [
    { id: 'gift', label: 'Bring a thoughtful home gift 🏡' },
    { id: 'food', label: 'Bring food, wine, or flowers 🌸' },
    { id: 'card', label: 'Write a warm welcome home card ✉️' },
  ],
  thank_you: [
    { id: 'note', label: 'Write a specific, personal thank-you note ✉️' },
    { id: 'gift', label: 'Pair with a small token if appropriate 🎁' },
    { id: 'timely', label: "Send within a few days while it's fresh ⏱️" },
  ],
  just_because: [
    { id: 'gift', label: 'Pick something small but meaningful 🎁' },
    { id: 'note', label: 'Write a genuine "thinking of you" note ✉️' },
    { id: 'timing', label: 'Deliver at an unexpected moment for impact 💛' },
  ],
  other: [
    { id: 'gift', label: 'Prepare a thoughtful gift 🎁' },
    { id: 'card', label: 'Write a sincere card ✉️' },
    { id: 'present', label: 'Be fully present on the day 💛' },
  ],
};

export default function EventChecklist({ occasion, completed = [], onChange }) {
  const [expanded, setExpanded] = useState(false);

  const items = CHECKLISTS[occasion] || CHECKLISTS.other;
  const checked = new Set(completed);
  const doneCount = items.filter(item => checked.has(item.id)).length;

  const toggle = (id) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange?.([...next]);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-2">
          <p className="font-heading font-semibold text-foreground">Day checklist</p>
          {doneCount > 0 && (
            <span className="text-xs bg-moss/20 text-moss-dark px-2 py-0.5 rounded-full font-medium">
              {doneCount}/{items.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {doneCount === items.length && items.length > 0 && (
            <p className="text-center text-sm text-moss font-heading font-semibold py-1">
              🎉 All done! You're a thoughtful legend.
            </p>
          )}
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                checked.has(item.id) ? 'bg-moss/10' : 'bg-muted hover:bg-secondary'
              }`}
            >
              {checked.has(item.id)
                ? <CheckCircle2 className="w-5 h-5 text-moss flex-shrink-0" />
                : <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              }
              <span className={`text-sm ${checked.has(item.id) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
