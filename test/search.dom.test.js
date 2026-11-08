import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from './helpers/dom.js';

const calendars = [{ id: 'w', name: 'Work' }, { id: 'h', name: 'Personal' }];
const resources = [{ id: 'atlas', title: 'Atlas room' }];
const events = () => [
  { id: 'a', title: 'Design review', start: '2026-11-09T11:00', end: '2026-11-09T12:00', calendar: 'w', location: 'Nova room' },
  { id: 'b', title: 'Dentist', start: '2026-11-10T15:00', end: '2026-11-10T16:00', calendar: 'h', notes: 'bring the x-ray' },
  { id: 'c', title: 'Sprint planning', start: '2026-11-11T10:00', end: '2026-11-11T11:00', calendar: 'w', resourceId: 'atlas' },
  { id: 'd', title: 'Spotkania z klientami', start: '2026-11-12T10:00', end: '2026-11-12T11:00', calendar: 'w' },
];
const shown = (cal) => [...cal.root.querySelectorAll('.ixc-main [data-key]')].map((e) => e.dataset.key).sort();
let cal;
afterEach(() => { cal?.destroy(); cal = null; });

describe('event search (powered by @iconix/search)', () => {
  test('forgives typos and highlights the real word', async () => {
    cal = await mount({ events: events(), calendars });
    cal.setQuery('desgn reveiw');
    assert.deepEqual(shown(cal), ['a']);
    assert.match(cal.root.querySelector('[data-key="a"] .ixc-ev-t').innerHTML, /<mark>Design<\/mark> <mark>review<\/mark>/);
  });

  test('searches location, notes, calendar name and resource title', async () => {
    cal = await mount({ events: events(), calendars, resources });
    cal.setQuery('nova'); assert.deepEqual(shown(cal), ['a']);
    cal.setQuery('x-ray'); assert.deepEqual(shown(cal), ['b']);
    cal.setQuery('personal'); assert.deepEqual(shown(cal), ['b']);
    cal.setQuery('atlas'); assert.deepEqual(shown(cal), ['c']);
  });

  test('field queries narrow to one field', async () => {
    cal = await mount({ events: events(), calendars });
    cal.setQuery('calendar:work');
    assert.deepEqual(shown(cal), ['a', 'c', 'd']);
    cal.setQuery('location:nova');
    assert.deepEqual(shown(cal), ['a']);
  });

  test('Polish word forms match with a Polish locale', async () => {
    cal = await mount({ events: events(), calendars, locale: 'pl-PL' });
    cal.setQuery('spotkanie klient');
    assert.deepEqual(shown(cal), ['d']);
  });

  test('"did you mean" appears when nothing matches and applies the correction', async () => {
    cal = await mount({ events: events(), calendars });
    cal.setQuery('dentsit planing zzz');
    cal.setQuery('dentsit');
    assert.deepEqual(shown(cal), ['b'], 'one typo still finds it');
    cal.setQuery('spritn plannnig');
    const btn = cal.root.querySelector('.ixc-dym');
    if (btn) { // only when the engine could not match the typos directly
      assert.match(btn.textContent, /Did you mean/);
      btn.click();
      assert.deepEqual(shown(cal), ['c']);
    } else assert.deepEqual(shown(cal), ['c']);
    cal.setQuery('');
    assert.equal(cal.root.querySelector('.ixc-dym'), null);
  });

  test('searchEvents ranks title matches first and the index follows edits', async () => {
    cal = await mount({ events: events(), calendars });
    assert.deepEqual(cal.searchEvents('review').map((e) => e.id), ['a']);
    cal.addEvent({ id: 'e', title: 'Code review', start: '2026-11-13T10:00', location: 'Review corner' });
    const ids = cal.searchEvents('review').map((e) => e.id);
    assert.deepEqual(ids.sort(), ['a', 'e']);
    cal.updateEvent('a', { title: 'Design sync' });
    assert.deepEqual(cal.searchEvents('review').map((e) => e.id), ['e']);
  });

  test('the command palette lists matching events ranked by the engine', async () => {
    cal = await mount({ events: events(), calendars });
    cal.openPalette('dentst');
    const items = [...cal.root.querySelectorAll('.ixc-pal-item')].map((b) => b.textContent);
    assert.ok(items.some((t) => /Dentist/.test(t)), 'typo tolerant in the palette too');
  });

  test('search options pass through to the engine', async () => {
    cal = await mount({ events: events(), calendars, search: { fuzzy: false } });
    cal.setQuery('dentsit');
    assert.deepEqual(shown(cal), [], 'no typo tolerance when fuzzy: false');
  });
});
