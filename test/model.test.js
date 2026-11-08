import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, occurrences, findFreeSlot, findClashes } from '../src/model.js';
import { PRESETS, EVENT_STYLES } from '../src/presets.js';
import { readFileSync } from 'node:fs';
import * as D from '../src/date.js';

describe('normalizeEvent', () => {
  test('date-only strings become all-day with an exclusive end', () => {
    const e = normalizeEvent({ title: 'Trip', start: '2026-11-12', end: '2026-11-15' });
    assert.equal(e.allDay, true);
    assert.equal(D.diffDays(e.start, e.end), 3);
  });
  test('missing or backwards end gets the default duration', () => {
    assert.equal((normalizeEvent({ start: '2026-11-12T10:00' }).end - new Date(2026, 10, 12, 10)) / 6e4, 60);
    assert.equal((normalizeEvent({ start: '2026-11-12T10:00', end: '2026-11-12T09:00' }, { defaultDuration: 30 }).end - new Date(2026, 10, 12, 10)) / 6e4, 30);
  });
  test('ids are generated and input is not mutated', () => {
    const input = { title: 'x', start: '2026-11-12T10:00', rrule: { freq: 'weekly', byweekday: [1] } };
    const e = normalizeEvent(input);
    assert.ok(e.id);
    e.rrule.byweekday.push(3);
    assert.deepEqual(input.rrule.byweekday, [1]);
  });
  test('invalid start throws a helpful error', () => {
    assert.throws(() => normalizeEvent({ title: 'Bad', start: 'nope' }), /Invalid start for event "Bad"/);
  });
});

describe('occurrences / free slots / clashes', () => {
  const events = [
    { id: 'st', title: 'Standup', start: '2026-11-02T09:00', end: '2026-11-02T09:15', rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] } },
    { id: 'a', title: 'A', start: '2026-11-09T09:15', end: '2026-11-09T10:00' },
    { id: 'b', title: 'B', start: '2026-11-09T10:30', end: '2026-11-09T12:00' },
    { id: 'c', title: 'C', start: '2026-11-09T11:00', end: '2026-11-09T11:30' },
    { id: 'r1', title: 'Room 1', start: '2026-11-09T11:00', end: '2026-11-09T12:00', resourceId: 'atlas' },
    { id: 'r2', title: 'Room 2', start: '2026-11-09T11:30', end: '2026-11-09T12:30', resourceId: 'nova' },
    { id: 'all', title: 'Holiday', start: '2026-11-10', allDay: true },
  ].map((e) => normalizeEvent(e));

  test('occurrences expands recurrences and sorts', () => {
    const list = occurrences(events, new Date(2026, 10, 9), new Date(2026, 10, 10));
    assert.equal(list[0].title, 'Standup');
    assert.ok(list.every((x, i) => i === 0 || list[i - 1].start <= x.start));
  });

  test('free slot finds the first gap long enough', () => {
    const from = new Date(2026, 10, 9, 8);
    assert.deepEqual(D.minutesOfDay(findFreeSlot(events, { duration: 30, from }).start), 10 * 60);
    assert.deepEqual(D.minutesOfDay(findFreeSlot(events, { duration: 60, from }).start), 12 * 60 + 30);
  });

  test('free slot skips weekends and all-day events do not block', () => {
    const slot = findFreeSlot(events, { duration: 60, from: new Date(2026, 10, 7, 12) }); // Saturday
    assert.equal(slot.start.getDay(), 1);
    const tue = findFreeSlot(events, { duration: 60, from: new Date(2026, 10, 10, 9) });
    assert.equal(D.minutesOfDay(tue.start), 9 * 60 + 15);
  });

  test('free slot returns null when nothing fits and honours "any hours"', () => {
    assert.equal(findFreeSlot(events, { duration: 600, from: new Date(2026, 10, 9), days: 3 }), null);
    const night = findFreeSlot(events, { duration: 60, from: new Date(2026, 10, 7, 22), hours: null });
    assert.equal(night.start.getHours(), 22);
  });

  test('clashes are counted per resource', () => {
    const pairs = findClashes(events, new Date(2026, 10, 9), new Date(2026, 10, 10));
    const names = pairs.map(([x, y]) => `${x.title}/${y.title}`);
    assert.deepEqual(names, ['B/C'], 'Room 1 and Room 2 are different resources');
  });
});

describe('presets and styles', () => {
  const hex = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
  test('every preset has a valid accent for light and dark', () => {
    for (const [name, p] of Object.entries(PRESETS)) {
      assert.ok(p.label, `${name} label`);
      assert.match(p.light.accent, hex, `${name} light accent`);
      assert.match(p.dark.accent, hex, `${name} dark accent`);
      for (const [k, v] of Object.entries({ ...p.light, ...p.dark })) assert.ok(hex.test(v) || /^\d/.test(v) || /\(/.test(v), `${name}.${k} = ${v}`);
    }
  });
  test('every event style except the default has CSS', () => {
    const css = readFileSync(new URL('../src/calendar.css', import.meta.url), 'utf8');
    for (const s of EVENT_STYLES.filter((x) => x !== 'soft')) assert.ok(css.includes(`[data-evstyle="${s}"]`), `css for ${s}`);
  });
  test('tokens used by presets exist in the stylesheet', () => {
    const css = readFileSync(new URL('../src/calendar.css', import.meta.url), 'utf8');
    const keys = new Set(Object.values(PRESETS).flatMap((p) => Object.keys({ ...p.light, ...p.dark, ...p.vars })));
    for (const k of keys) assert.ok(css.includes(`--ixc-${k}`), `--ixc-${k} is used in calendar.css`);
  });
});
