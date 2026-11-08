import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from './helpers/dom.js';
import { toWall, fromWall, isInstant } from '../src/tz.js';

const wallStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
let cal;
afterEach(() => { cal?.destroy(); cal = null; });

describe('zone math', () => {
  test('instant ↔ wall clock in several zones', () => {
    const t = new Date('2026-11-09T15:30:00Z');
    assert.equal(wallStr(toWall(t, 'Asia/Tokyo')), '2026-11-10 00:30');
    assert.equal(wallStr(toWall(t, 'America/New_York')), '2026-11-09 10:30');
    assert.equal(wallStr(toWall(t, 'Asia/Kolkata')), '2026-11-09 21:00', 'half-hour offset');
    assert.equal(wallStr(toWall(t, 'UTC')), '2026-11-09 15:30');
    for (const tz of ['Asia/Tokyo', 'America/New_York', 'Asia/Kolkata', 'Europe/Warsaw', 'Australia/Adelaide']) {
      assert.equal(fromWall(toWall(t, tz), tz).toISOString(), t.toISOString(), tz);
    }
  });
  test('both sides of a DST change', () => {
    // New York: EDT (-4) until 1 Nov 2026 02:00, then EST (-5)
    assert.equal(fromWall(new Date(2026, 9, 31, 12, 0), 'America/New_York').toISOString(), '2026-10-31T16:00:00.000Z');
    assert.equal(fromWall(new Date(2026, 10, 2, 12, 0), 'America/New_York').toISOString(), '2026-11-02T17:00:00.000Z');
  });
  test('what counts as an instant', () => {
    assert.ok(isInstant(new Date()));
    assert.ok(isInstant('2026-11-09T10:00:00Z'));
    assert.ok(isInstant('2026-11-09T10:00+02:00'));
    assert.ok(!isInstant('2026-11-09T10:00'), 'no offset = wall clock in the calendar zone');
    assert.ok(!isInstant('2026-11-09'));
  });
});

describe('calendar with timeZone', () => {
  test('strings without offset are times in the zone; outputs are real instants', async () => {
    cal = await mount({ timeZone: 'Asia/Tokyo', events: [{ id: 'a', title: 'Tokyo standup', start: '2026-11-09T10:00', end: '2026-11-09T10:30' }] });
    assert.equal(cal.getEventById('a').start.toISOString(), '2026-11-09T01:00:00.000Z');
    const col = cal.root.querySelector('[data-key="a"]').closest('.ixc-col');
    assert.equal(col.dataset.date, '2026-11-09');
    assert.match(cal.root.querySelector('[data-key="a"]').getAttribute('aria-label'), /10:00/, 'drawn at Tokyo time');
    assert.equal(cal.root.querySelector('.ixc-tz').textContent, 'GMT+9');
  });

  test('instants in input are placed by their time in the zone', async () => {
    cal = await mount({ timeZone: 'America/New_York', events: [] });
    cal.addEvent({ id: 'x', title: 'Call', start: '2026-11-10T14:00:00Z', end: new Date('2026-11-10T15:00:00Z') });
    const el = cal.root.querySelector('[data-key="x"]');
    assert.equal(el.closest('.ixc-col').dataset.date, '2026-11-10');
    assert.match(el.textContent, /09:00/);
    assert.equal(cal.getEventById('x').end.toISOString(), '2026-11-10T15:00:00.000Z');
  });

  test('switching zones keeps every event at the same instant', async () => {
    cal = await mount({ timeZone: 'UTC', events: [{ id: 'n', title: 'Late', start: '2026-11-09T20:00:00Z', end: '2026-11-09T21:00:00Z' }] });
    assert.equal(cal.root.querySelector('[data-key="n"]').closest('.ixc-col').dataset.date, '2026-11-09');
    cal.setOptions({ timeZone: 'Asia/Tokyo' });
    assert.equal(cal.root.querySelector('[data-key="n"]').closest('.ixc-col').dataset.date, '2026-11-10', 'next morning in Tokyo');
    assert.equal(cal.getEventById('n').start.toISOString(), '2026-11-09T20:00:00.000Z');
  });

  test('editing in the zone, .ics export and all-day events', async () => {
    cal = await mount({ timeZone: 'Asia/Kolkata', events: [{ id: 'k', title: 'K', start: '2026-11-09T09:00', end: '2026-11-09T10:00' }, { id: 'd', title: 'Diwali', start: '2026-11-08', allDay: true }] });
    cal.updateEvent('k', { title: 'K2' });
    assert.equal(cal.getEventById('k').start.toISOString(), '2026-11-09T03:30:00.000Z', 'unchanged by an edit');
    assert.match(cal.exportICS(), /DTSTART:20261109T033000Z/);
    assert.match(cal.exportICS(), /DTSTART;VALUE=DATE:20261108/);
    assert.equal(cal.getEventById('d').start.getDate(), 8, 'all-day stays a calendar date');
  });

  test('sources and viewChange receive instant ranges', async () => {
    const ranges = [];
    cal = await mount({ timeZone: 'Asia/Tokyo', events: ({ start, end }) => { ranges.push([start.toISOString(), end.toISOString()]); return []; } });
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(ranges[0], ['2026-11-08T15:00:00.000Z', '2026-11-15T15:00:00.000Z'], 'Mon 00:00 – next Mon 00:00 in Tokyo');
    const r = cal.getRange();
    assert.equal(r.start.toISOString(), '2026-11-08T15:00:00.000Z');
  });

  test('free slots are found in zone hours and returned as instants', async () => {
    cal = await mount({ timeZone: 'America/New_York', events: [{ id: 'b', title: 'Busy', start: '2026-11-09T09:00', end: '2026-11-09T10:00' }] });
    const slot = cal.findFreeSlot({ duration: 60, from: '2026-11-09T13:00:00Z' }); // 08:00 New York
    assert.equal(slot.start.toISOString(), '2026-11-09T15:00:00.000Z', '10:00 New York');
  });
});
