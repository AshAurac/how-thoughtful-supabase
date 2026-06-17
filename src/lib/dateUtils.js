import { addDays, subDays, differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';

export function computeBuyDates(eventDateStr) {
  const eventDate = parseISO(eventDateStr);
  return {
    buy_online_by: format(subDays(eventDate, 28), 'yyyy-MM-dd'),
    buy_local_by: format(subDays(eventDate, 14), 'yyyy-MM-dd'),
    wrap_by: format(subDays(eventDate, 3), 'yyyy-MM-dd'),
  };
}

export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const d = parseISO(dateStr);
  if (!isValid(d)) return null;
  return differenceInCalendarDays(d, now);
}

export function relativeDayLabel(daysAway, compact = false) {
  if (daysAway === null) return '';
  if (daysAway < 0) return 'Past';
  if (daysAway === 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  return compact ? `${daysAway}d` : `${daysAway} days away`;
}

export function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = parseISO(dateStr);
  if (!isValid(d)) return dateStr;
  return format(d, 'MMM d, yyyy');
}

export function urgencyLabel(daysAway) {
  if (daysAway === null) return '';
  if (daysAway < 0) return 'past';
  if (daysAway === 0) return 'today!';
  if (daysAway <= 7) return `${daysAway}d away`;
  if (daysAway <= 30) return `${daysAway}d away`;
  return `${daysAway}d`;
}

export function urgencyColor(daysAway) {
  if (daysAway === null) return 'text-ink-soft';
  if (daysAway < 0) return 'text-ink-soft line-through';
  if (daysAway <= 3) return 'text-terracotta font-semibold';
  if (daysAway <= 7) return 'text-terracotta';
  if (daysAway <= 14) return 'text-butter-dark';
  return 'text-ink-soft';
}

export function getUpcomingEvents(events, days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // compare date-only, avoids UTC offset issues
  const cutoff = addDays(today, days);
  return events
    .filter(e => {
      if (!e.event_date) return false;
      // Parse YYYY-MM-DD as local date to avoid UTC offset shifting the day
      const [y, m, d] = e.event_date.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return isValid(date) && date >= today && date <= cutoff;
    })
    .sort((a, b) => {
      const [ay, am, ad] = a.event_date.split('-').map(Number);
      const [by, bm, bd] = b.event_date.split('-').map(Number);
      return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
    });
}
