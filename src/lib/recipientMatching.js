export function normalizeRecipientName(name = '') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

export function findRecipientMatch(name, recipients = []) {
  const normalized = normalizeRecipientName(name);
  if (!normalized) return null;

  const exact = recipients.find(r => normalizeRecipientName(r.name) === normalized);
  if (exact) return { recipient: exact, type: 'exact' };

  const candidates = recipients
    .map(recipient => {
      const candidate = normalizeRecipientName(recipient.name);
      if (!candidate) return null;

      const distance = levenshtein(normalized, candidate);
      const maxLength = Math.max(normalized.length, candidate.length);
      const includes = normalized.includes(candidate) || candidate.includes(normalized);
      const likely =
        (maxLength <= 6 && distance <= 1) ||
        (maxLength > 6 && distance <= 2) ||
        (includes && Math.min(normalized.length, candidate.length) >= 4);

      return likely ? { recipient, type: 'similar', distance } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);

  return candidates[0] || null;
}

export function recipientPayloadFromForm(data) {
  return {
    name: data.name?.trim() || '',
    age: data.age ? parseInt(data.age) : undefined,
    birthday_month: data.birthday_month ? parseInt(data.birthday_month) : undefined,
    birthday_day: data.birthday_day ? parseInt(data.birthday_day) : undefined,
    relationship: data.relationship || '',
    love_language: data.love_language || '',
    interests: Array.isArray(data.interests)
      ? data.interests
      : data.interests
        ? data.interests.split(',').map(s => s.trim()).filter(Boolean)
        : [],
    notes: data.notes || '',
    style_preferences: data.style_preferences || '',
    gift_likes: data.gift_likes || '',
    gift_avoidances: data.gift_avoidances || '',
    wishlist_notes: data.wishlist_notes || '',
  };
}

export function mergeRecipientPayload(existing, incoming) {
  return Object.entries(incoming).reduce((acc, [key, value]) => {
    if (key === 'name') return acc;
    if (value === undefined || value === null || value === '') return acc;
    if (Array.isArray(value) && value.length === 0) return acc;

    if (['notes', 'style_preferences', 'gift_likes', 'gift_avoidances', 'wishlist_notes'].includes(key) && existing?.[key] && existing[key] !== value) {
      acc[key] = `${existing[key]}\n\n${value}`;
      return acc;
    }

    if (Array.isArray(value) && Array.isArray(existing?.[key])) {
      const merged = Array.from(new Set([...existing[key], ...value]));
      if (merged.length !== existing[key].length) acc[key] = merged;
      return acc;
    }

    if (!existing?.[key]) acc[key] = value;
    return acc;
  }, {});
}
