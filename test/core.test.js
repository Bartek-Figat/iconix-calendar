import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expand } from '../src/recur.js';
import { parseQuickAdd } from '../src/quickadd.js';
import { toICS, fromICS } from '../src/ics.js';
import { packColumns, packLanes } from '../src/layout.js';
import * as D from '../src/date.js';

const now = new Date(2026, 10, 8, 10, 0); // Sun 8 Nov 2026, 10:00
const cals = [{ id: 'work', name: 'Work' }, { id: 'home', name: 'Personal' }];
const res = [{ id: 'atlas', title: 'Atlas room' }];

test('weekly recurrence on weekdays', () => {
  const ev = { id: 's', start: new Date(2026, 10, 2, 9), end: new Date(2026, 10, 2, 9, 15), rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }, exdates: ['2026-11-04'] };
  const out = expand(ev, new Date(2026, 10, 2), new Date(2026, 10, 9));
  assert.deepEqual(out.map((i) => i.start.getDate()), [2, 3, 5, 6]);
  assert.equal(out[0].key, 's@2026-11-02');
});

test('recurrence respects count and month-end skipping', () => {
  const ev = { id: 'm', start: new Date(2026, 0, 31, 8), end: new Date(2026, 0, 31, 9), rrule: { freq: 'monthly', count: 3 } };
  const out = expand(ev, new Date(2026, 0, 1), new Date(2027, 0, 1));
  assert.deepEqual(out.map((i) => i.start.getMonth()), [0, 2, 4]); // Jan, Mar, May (no 31st in Feb/Apr)
});

test('daily recurrence far in the future stays fast and correct', () => {
  const ev = { id: 'd', start: new Date(2020, 0, 1, 7), end: new Date(2020, 0, 1, 7, 30), rrule: { freq: 'daily' } };
  const out = expand(ev, new Date(2026, 5, 1), new Date(2026, 5, 3));
  assert.equal(out.length, 2);
  assert.equal(out[0].start.getHours(), 7);
});

test('quick add: english, time range, calendar tag, resource', () => {
  const p = parseQuickAdd('Design review tomorrow 2pm-3:30pm #work @atlas', { now, calendars: cals, resources: res });
  assert.equal(p.title, 'Design review');
  assert.equal(p.start.getDate(), 9);
  assert.equal(p.start.getHours(), 14);
  assert.equal(p.end.getHours(), 15);
  assert.equal(p.end.getMinutes(), 30);
  assert.equal(p.calendar, 'work');
  assert.equal(p.resourceId, 'atlas');
});

test('quick add: polish weekday, 24h time and duration', () => {
  const p = parseQuickAdd('Dentysta w piątek o 16:30 przez 45 min #personal', { now, calendars: cals });
  assert.equal(p.title, 'Dentysta');
  assert.equal(p.start.getDay(), 5);
  assert.equal(D.minutesOfDay(p.start), 16 * 60 + 30);
  assert.equal((p.end - p.start) / 60000, 45);
  assert.equal(p.calendar, 'home');
});

test('quick add: recurring and all-day', () => {
  const a = parseQuickAdd('Standup every weekday 9:00-9:15', { now });
  assert.deepEqual(a.rrule, { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] });
  assert.equal(a.title, 'Standup');
  const b = parseQuickAdd('Mom birthday 12 dec yearly', { now });
  assert.equal(b.allDay, true);
  assert.equal(b.start.getMonth(), 11);
  assert.equal(b.rrule.freq, 'yearly');
  const c = parseQuickAdd('Konferencja 20.11 cały dzień', { now });
  assert.equal(c.allDay, true);
  assert.equal(c.start.getDate(), 20);
  assert.equal(c.title, 'Konferencja');
});

test('quick add: plain text goes to next full hour', () => {
  const p = parseQuickAdd('Call Jan', { now: new Date(2026, 10, 8, 10, 20) });
  assert.equal(p.start.getHours(), 11);
  assert.equal(p.title, 'Call Jan');
});

test('ics round trip keeps times, all-day, recurrence and escaping', () => {
  const evs = [
    { id: 'a', title: 'Lunch; with, Ann', start: new Date(2026, 10, 9, 13), end: new Date(2026, 10, 9, 14), allDay: false, location: 'Café\nCorner' },
    { id: 'b', title: 'Trip', start: new Date(2026, 10, 12), end: new Date(2026, 10, 15), allDay: true, rrule: { freq: 'weekly', byweekday: [1, 3] }, exdates: ['2026-11-16'] },
  ];
  const back = fromICS(toICS(evs));
  assert.equal(back.length, 2);
  assert.equal(back[0].title, 'Lunch; with, Ann');
  assert.equal(back[0].location, 'Café\nCorner');
  assert.equal(+back[0].start, +evs[0].start);
  assert.equal(back[1].allDay, true);
  assert.equal(+back[1].end, +evs[1].end);
  assert.deepEqual(back[1].rrule, { freq: 'weekly', byweekday: [1, 3] });
  assert.deepEqual(back[1].exdates, ['2026-11-16']);
});

test('layout packing', () => {
  const segs = packColumns([{ s: 0, e: 60 }, { s: 30, e: 90 }, { s: 60, e: 120 }, { s: 200, e: 230 }]);
  const by = (s) => segs.find((x) => x.s === s);
  assert.equal(by(0).cols, 2);
  assert.equal(by(60).col, 0);
  assert.equal(by(200).cols, 1);
  const lanes = packLanes([{ s: 0, e: 3 }, { s: 1, e: 2 }, { s: 3, e: 5 }]);
  assert.equal(lanes, 2);
});
