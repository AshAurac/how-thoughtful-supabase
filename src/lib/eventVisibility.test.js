import test from 'node:test';
import assert from 'node:assert/strict';
import { isEventVisible, visibleActiveEvents } from './eventVisibility.js';

const now = new Date(2026, 5, 20);

test('keeps a background event hidden at 61 days and reveals it at 60 days', () => {
  assert.equal(isEventVisible({ background_until: '2026-06-21' }, now), false);
  assert.equal(isEventVisible({ background_until: '2026-06-20' }, now), true);
});

test('filters completed and background events from active surfaces', () => {
  const events = [
    { id: 'visible' },
    { id: 'done', completed: true },
    { id: 'background', background_until: '2026-06-21' },
  ];
  assert.deepEqual(visibleActiveEvents(events, now).map(event => event.id), ['visible']);
});
