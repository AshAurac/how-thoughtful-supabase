import { computeBuyDates } from '@/lib/dateUtils';
import { normalizeRecipientName } from '@/lib/recipientMatching';

function toInt(value) {
  const parsed = parseInt(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function localDateFromYmd(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isValidMonthDay(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function nextBirthdayDate(monthValue, dayValue, now = new Date()) {
  const month = toInt(monthValue);
  const day = toInt(dayValue);
  if (!month || !day) return null;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  for (let offset = 0; offset <= 8; offset += 1) {
    const year = today.getFullYear() + offset;
    if (!isValidMonthDay(year, month, day)) continue;

    const candidate = new Date(year, month - 1, day);
    candidate.setHours(0, 0, 0, 0);
    if (candidate >= today) return formatYmd(year, month, day);
  }

  return null;
}

function eventMatchesRecipient(event, recipient) {
  if (!event || !recipient) return false;
  if (recipient.id && event.recipient_id === recipient.id) return true;
  return normalizeRecipientName(event.recipient_name) === normalizeRecipientName(recipient.name);
}

function eventMatchesBirthday(event, recipient) {
  const eventDate = localDateFromYmd(event?.event_date);
  const month = toInt(recipient?.birthday_month);
  const day = toInt(recipient?.birthday_day);
  return Boolean(eventDate && month && day && eventDate.getMonth() + 1 === month && eventDate.getDate() === day);
}

function isUpcoming(eventDate) {
  const date = localDateFromYmd(eventDate);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date >= today;
}

export function findBirthdayEventForRecipient(recipient, events = []) {
  const candidates = events
    .filter(event => event?.occasion === 'birthday')
    .filter(event => !event.completed)
    .filter(event => eventMatchesRecipient(event, recipient));

  const upcomingExact = candidates
    .filter(event => eventMatchesBirthday(event, recipient))
    .filter(event => isUpcoming(event.event_date))
    .sort((a, b) => localDateFromYmd(a.event_date) - localDateFromYmd(b.event_date));

  if (upcomingExact[0]) return upcomingExact[0];

  const upcomingAnyBirthday = candidates
    .filter(event => isUpcoming(event.event_date))
    .sort((a, b) => localDateFromYmd(a.event_date) - localDateFromYmd(b.event_date));

  return upcomingAnyBirthday[0] || null;
}

export function birthdayEventPayloadFromRecipient(recipient, now = new Date()) {
  const eventDate = nextBirthdayDate(recipient?.birthday_month, recipient?.birthday_day, now);
  if (!recipient?.name || !eventDate) return null;

  const payload = {
    recipient_name: recipient.name,
    recipient_id: recipient.id || null,
    occasion: 'birthday',
    event_date: eventDate,
    priority: 'medium',
    budget: 0,
    recurring: true,
    reminders_sent: [],
    ...computeBuyDates(eventDate),
  };

  if (recipient.age) payload.age_or_years = toInt(recipient.age);
  if (recipient.love_language) payload.love_language = recipient.love_language;
  if (recipient.notes) payload.notes = recipient.notes;

  return payload;
}

export function birthdayEventUpdatesFromRecipient(event, recipient) {
  const payload = birthdayEventPayloadFromRecipient(recipient);
  if (!payload || !event) return null;

  const updates = {};
  const fillIfMissing = ['priority', 'love_language', 'age_or_years', 'notes', 'reminders_sent'];

  if (event.recipient_name !== payload.recipient_name) updates.recipient_name = payload.recipient_name;
  if (payload.recipient_id && event.recipient_id !== payload.recipient_id) updates.recipient_id = payload.recipient_id;
  if (event.occasion !== 'birthday') updates.occasion = 'birthday';
  if (event.event_date !== payload.event_date) {
    updates.event_date = payload.event_date;
    Object.assign(updates, computeBuyDates(payload.event_date));
  }
  if (event.recurring !== true) updates.recurring = true;

  fillIfMissing.forEach(key => {
    const value = payload[key];
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value) && value.length === 0) return;
    if (!event[key] || (Array.isArray(event[key]) && event[key].length === 0)) {
      updates[key] = value;
    }
  });

  return updates;
}

export async function syncBirthdayEventForRecipient({ recipient, events = [], eventEntity }) {
  const payload = birthdayEventPayloadFromRecipient(recipient);
  if (!payload || !eventEntity) return { action: 'none', event: null };

  const existing = findBirthdayEventForRecipient(recipient, events);
  if (!existing) {
    const event = await eventEntity.create(payload);
    return { action: 'created', event };
  }

  const updates = birthdayEventUpdatesFromRecipient(existing, recipient);
  if (!updates || !Object.keys(updates).length) {
    return { action: 'unchanged', event: existing };
  }

  const event = await eventEntity.update(existing.id, updates);
  return { action: 'updated', event };
}
