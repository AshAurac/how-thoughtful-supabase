export function localDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isEventVisible(event, now = new Date()) {
  if (!event?.background_until) return true;
  return event.background_until <= localDateKey(now);
}

export function visibleActiveEvents(events = [], now = new Date()) {
  return events.filter(event => !event.completed && isEventVisible(event, now));
}
