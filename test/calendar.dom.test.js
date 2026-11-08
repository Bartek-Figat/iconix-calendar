import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, key } from './helpers/dom.js';

const calendars = [{ id: 'work', name: 'Work', color: '#2563eb' }, { id: 'home', name: 'Personal', color: '#16a34a' }];
const base = () => [
  { id: 'a', title: 'Design review', start: '2026-11-09T11:00', end: '2026-11-09T12:00', calendar: 'work' },
  { id: 'b', title: 'Lunch', start: '2026-11-10T12:30', end: '2026-11-10T13:30', calendar: 'home' },
  { id: 'c', title: 'Offsite', start: '2026-11-11', end: '2026-11-13', calendar: 'work' },
  { id: 's', title: 'Standup', start: '2026-11-02T09:00', end: '2026-11-02T09:15', calendar: 'work', rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] } },
];
let cal;
afterEach(() => { cal?.destroy(); cal = null; });

describe('rendering', () => {
  test('every view renders without throwing and sets a title', async () => {
    cal = await mount({ events: base(), calendars, views: ['day', 'week', 'days', 'month', 'year', 'agenda', 'timeline'] });
    for (const v of ['day', 'week', 'days', 'month', 'year', 'agenda', 'timeline']) {
      cal.setView(v);
      assert.equal(cal.getView(), v);
      assert.ok(cal.root.querySelector('.ixc-title').textContent.length > 3, `title for ${v}`);
      assert.equal(cal.root.querySelector('.ixc-main').firstElementChild.dataset.view, v);
    }
  });

  test('week view shows timed, all-day and recurring events', async () => {
    cal = await mount({ events: base(), calendars });
    const keys = [...cal.root.querySelectorAll('[data-key]')].map((e) => e.dataset.key);
    assert.ok(keys.includes('a') && keys.includes('b') && keys.includes('c'));
    assert.equal(keys.filter((k) => k.startsWith('s@')).length, 5, 'standup on 5 weekdays');
  });

  test('event colors come from the calendar, own color wins', async () => {
    cal = await mount({ events: [...base(), { id: 'x', title: 'X', start: '2026-11-12T10:00', color: '#db2777', calendar: 'work' }], calendars });
    const color = (k) => cal.root.querySelector(`[data-key="${k}"]`).style.getPropertyValue('--c');
    assert.equal(color('a'), '#2563eb');
    assert.equal(color('x'), '#db2777');
  });

  test('user text is escaped', async () => {
    cal = await mount({ events: [{ id: 'h', title: '<img src=x onerror=alert(1)>', start: '2026-11-09T10:00' }] });
    assert.equal(cal.root.querySelector('img'), null);
    assert.match(cal.root.querySelector('[data-key="h"]').textContent, /<img/);
  });
});

describe('data API + history', () => {
  test('add / update / remove with undo and redo', async () => {
    cal = await mount({ events: base() });
    const changes = [];
    cal.on('change', ({ events }) => changes.push(events.length));
    const e = cal.addEvent({ title: 'New', start: '2026-11-12T15:00' });
    assert.equal(cal.getEventById(e.id).end.getHours(), 16, 'default duration 60');
    cal.updateEvent(e.id, { title: 'Renamed' });
    assert.equal(cal.getEventById(e.id).title, 'Renamed');
    cal.removeEvent(e.id);
    assert.equal(cal.getEventById(e.id), null);
    cal.undo();
    assert.equal(cal.getEventById(e.id).title, 'Renamed');
    cal.undo();
    assert.equal(cal.getEventById(e.id).title, 'New');
    cal.redo();
    assert.equal(cal.getEventById(e.id).title, 'Renamed');
    assert.deepEqual(changes, [5, 5, 4, 5, 5, 5]);
  });

  test('getEvents returns copies, not internal state', async () => {
    cal = await mount({ events: base() });
    const list = cal.getEvents();
    list[0].title = 'hacked';
    list[0].start.setFullYear(1999);
    assert.equal(cal.getEventById('a').title, 'Design review');
    assert.equal(cal.getEventById('a').start.getFullYear(), 2026);
  });

  test('deleting one occurrence adds an exdate; series delete removes it', async () => {
    cal = await mount({ events: base() });
    cal.deleteInstance('s@2026-11-11');
    assert.deepEqual(cal.getEventById('s').exdates, ['2026-11-11']);
    assert.equal(cal.root.querySelector('[data-key="s@2026-11-11"]'), null);
    cal.deleteInstance('s@2026-11-10', { series: true });
    assert.equal(cal.getEventById('s'), null);
    cal.undo();
    assert.ok(cal.getEventById('s'));
  });

  test('copy + paste and duplicate create new events', async () => {
    cal = await mount({ events: base() });
    cal.copy('a');
    cal.paste();
    const pasted = cal.getEvents().filter((e) => e.title === 'Design review');
    assert.equal(pasted.length, 2);
    assert.equal(pasted[1].start.getDate(), 10, 'without a hovered slot it pastes one day later');
    cal.duplicate('b');
    assert.equal(cal.getEvents().filter((e) => e.title === 'Lunch').length, 2);
  });

  test('quickAdd parses text, uses #calendar and selects the event', async () => {
    cal = await mount({ events: [], calendars });
    const created = [];
    cal.on('eventCreate', ({ event }) => created.push(event));
    const e = cal.quickAdd('Dentist fri 16:30 for 45 min #personal');
    assert.equal(e.title, 'Dentist');
    assert.equal(e.calendar, 'home');
    assert.equal(e.start.getDay(), 5);
    assert.equal((e.end - e.start) / 60000, 45);
    assert.equal(created.length, 1);
  });

  test('ICS export and import round trip', async () => {
    cal = await mount({ events: base() });
    const ics = cal.exportICS();
    assert.match(ics, /BEGIN:VCALENDAR/);
    cal.setEvents([]);
    const back = cal.importICS(ics);
    assert.equal(back.length, 4);
    assert.equal(cal.getEventById('s').rrule.freq, 'weekly');
    cal.undo();
    assert.equal(cal.getEvents().length, 0);
  });
});

describe('filters, search and tools', () => {
  test('search hides non-matching events', async () => {
    cal = await mount({ events: base() });
    cal.setQuery('lunch');
    const keys = [...cal.root.querySelectorAll('.ixc-main [data-key]')].map((e) => e.dataset.key);
    assert.deepEqual(keys, ['b']);
    assert.ok(cal.root.querySelector('mark'));
    cal.setQuery('');
    assert.ok(cal.root.querySelectorAll('.ixc-main [data-key]').length > 1);
  });

  test('hidden calendars are not rendered and do not block free slots', async () => {
    cal = await mount({ events: base(), calendars });
    cal.toggleCalendar('work', false);
    assert.equal(cal.root.querySelector('[data-key="a"]'), null);
    const slot = cal.findFreeSlot({ duration: 60, from: new Date(2026, 10, 9, 9) });
    assert.equal(slot.start.getHours(), 9, 'standup is hidden, so 9:00 is free');
    cal.toggleCalendar('work', true);
    const slot2 = cal.findFreeSlot({ duration: 60, from: new Date(2026, 10, 9, 9) });
    assert.equal(slot2.start.getMinutes(), 15);
  });

  test('clash badge counts overlapping events', async () => {
    cal = await mount({ events: [...base(), { id: 'd', title: 'Call', start: '2026-11-09T11:30', end: '2026-11-09T12:30', calendar: 'home' }], calendars });
    const badge = cal.root.querySelector('.ixc-clash');
    assert.equal(badge.hidden, false);
    assert.match(badge.textContent, /1 clash/);
    assert.ok(cal.root.querySelector('[data-key="d"]').classList.contains('ixc-clashing'));
  });
});

describe('hooks', () => {
  test('eventContent, eventClass, eventDidMount and dayClass', async () => {
    const mounted = [];
    cal = await mount({
      events: base(), view: 'month',
      eventContent: (e) => `<span class="custom">${e.title.toUpperCase()}</span>`,
      eventClass: (e) => (e.id === 'a' ? 'vip' : ''),
      eventDidMount: ({ el, event }) => mounted.push([el.dataset.key, event.title]),
      dayClass: (d) => (d.getDate() === 11 && d.getMonth() === 10 ? 'holiday' : ''),
    });
    assert.ok(cal.root.querySelector('.custom'));
    assert.ok(cal.root.querySelector('[data-key="a"]').classList.contains('vip'));
    assert.ok(mounted.some(([k, t]) => k === 'a' && t === 'Design review'));
    assert.equal(cal.root.querySelectorAll('.ixc-mo-cell.holiday').length, 1);
  });

  test('eventAllow rolls a drag step back when it returns false', async () => {
    cal = await mount({ events: base(), eventAllow: (e) => e.start.getDay() !== 6 });
    const inst = { ...cal.getEventById('a'), key: 'a' };
    const d = { mode: 'move', srcId: 'a', inst, orig: { start: inst.start, end: inst.end, allDay: false }, hit0: { kind: 'time', date: inst.start } };
    cal._apply(d, { kind: 'time', date: new Date(2026, 10, 14, 11) }); // Saturday
    assert.equal(cal.getEventById('a').start.getDate(), 9, 'refused');
    assert.ok(cal.root.classList.contains('ixc-denied'));
    cal._apply(d, { kind: 'time', date: new Date(2026, 10, 13, 11) }); // Friday
    assert.equal(cal.getEventById('a').start.getDate(), 13, 'allowed');
  });

  test('drag apply keeps duration and moves recurring series by the same delta', async () => {
    cal = await mount({ events: base() });
    const s = cal.getEventById('s');
    const inst = { ...s, key: 's@2026-11-10', start: new Date(2026, 10, 10, 9), end: new Date(2026, 10, 10, 9, 15) };
    const d = { mode: 'move', srcId: 's', inst, orig: { start: s.start, end: s.end, allDay: false }, hit0: { kind: 'time', date: inst.start } };
    cal._apply(d, { kind: 'time', date: new Date(2026, 10, 10, 10) });
    const after = cal.getEventById('s');
    assert.equal(after.start.getHours(), 10);
    assert.equal((after.end - after.start) / 60000, 15);
    assert.equal(after.start.getDate(), 2, 'series start keeps its day');
  });

  test('callbacks in options fire like listeners', async () => {
    const seen = [];
    cal = await mount({ events: [], onEventCreate: () => seen.push('create'), onViewChange: ({ view }) => seen.push(view) });
    cal.addEvent({ title: 'x', start: '2026-11-09T10:00' });
    cal.setView('month');
    assert.deepEqual(seen, ['week', 'create', 'month'], 'initial range first');
  });
});

describe('initial load', () => {
  test('viewChange fires once after creation with the visible range', async () => {
    const seen = [];
    cal = await mount({ events: [], onViewChange: (p) => seen.push(p) });
    await Promise.resolve();
    assert.equal(seen.length, 1, 'exactly once');
    assert.equal(seen[0].view, 'week');
    assert.equal(seen[0].start.getDate(), 9);
    assert.equal(seen[0].end.getDate(), 16);
  });
});

describe('styling', () => {
  test('presets set tokens for the current mode and clean up when switched', async () => {
    cal = await mount({ events: [], preset: 'ocean', theme: 'light' });
    const st = cal.root.style;
    assert.equal(st.getPropertyValue('--ixc-accent'), '#0284c7');
    assert.equal(cal.root.dataset.preset, 'ocean');
    cal.setOptions({ theme: 'dark' });
    assert.equal(st.getPropertyValue('--ixc-accent'), '#38bdf8');
    assert.equal(st.getPropertyValue('--ixc-bg'), '#06121c');
    cal.setOptions({ preset: 'zinc' });
    assert.equal(st.getPropertyValue('--ixc-bg'), '', 'ocean bg removed');
    cal.setOptions({ preset: null, accent: '#db2777' });
    assert.equal(st.getPropertyValue('--ixc-accent'), '#db2777');
    assert.equal(cal.root.dataset.preset, undefined);
  });

  test('custom preset object, event style, density and radius', async () => {
    cal = await mount({ events: [], preset: { radius: 18, light: { accent: '#0f766e' } }, theme: 'light', eventStyle: 'glass', density: 'compact' });
    assert.equal(cal.root.style.getPropertyValue('--ixc-radius'), '18px');
    assert.equal(cal.root.style.getPropertyValue('--ixc-accent'), '#0f766e');
    assert.equal(cal.root.dataset.evstyle, 'glass');
    assert.equal(cal.root.dataset.density, 'compact');
    cal.setOptions({ radius: 4 });
    assert.equal(cal.root.style.getPropertyValue('--ixc-radius'), '4px', 'radius option beats the preset');
  });

  test('locale changes UI strings', async () => {
    cal = await mount({ events: [], locale: 'pl-PL' });
    assert.equal(cal.root.querySelector('[data-act="today"]').textContent, 'Dziś');
    cal.setOptions({ strings: { today: 'Teraz' } });
    assert.equal(cal.root.querySelector('[data-act="today"]').textContent, 'Teraz');
  });
});

describe('keyboard, palette and editor', () => {
  test('view and navigation shortcuts', async () => {
    cal = await mount({ events: base() });
    cal.root.focus();
    key(cal, 'm');
    assert.equal(cal.getView(), 'month');
    key(cal, 'ArrowRight');
    assert.equal(cal.getDate().getMonth(), 11);
    key(cal, 't');
    assert.equal(cal.getDate().toDateString(), new Date().toDateString());
  });

  test('Ctrl+Z undoes, Delete removes the selected event', async () => {
    cal = await mount({ events: base() });
    cal.root.focus();
    cal.select('a');
    key(cal, 'Delete');
    assert.equal(cal.getEventById('a'), null);
    key(cal, 'z', { ctrlKey: true });
    assert.ok(cal.getEventById('a'));
  });

  test('palette lists commands and creates from a sentence', async () => {
    cal = await mount({ events: [], calendars });
    cal.root.focus();
    key(cal, 'k', { ctrlKey: true });
    const input = cal.root.querySelector('.ixc-pal input');
    assert.ok(input, 'palette open');
    assert.ok(cal.root.querySelectorAll('.ixc-pal-item').length > 20);
    input.value = 'Coffee tomorrow 9:30 #work';
    input.dispatchEvent(new Event('input'));
    assert.match(cal.root.querySelector('.ixc-pal-item').textContent, /Create: Coffee/);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(cal.root.querySelector('.ixc-pal'), null, 'closed after running');
    assert.equal(cal.getEvents()[0].title, 'Coffee');
  });

  test('editor edits live and commits one undo step on close', async () => {
    cal = await mount({ events: base(), calendars });
    const before = cal.history.length;
    cal.openEditor('a', cal.root.querySelector('[data-key="a"]'));
    const title = cal.root.querySelector('.ixc-editor [name=title]');
    title.value = 'Design review v2';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    assert.equal(cal.getEventById('a').title, 'Design review v2');
    const rep = cal.root.querySelector('.ixc-editor [name=repeat]');
    rep.value = 'weekdays';
    rep.dispatchEvent(new Event('change', { bubbles: true }));
    assert.deepEqual(cal.getEventById('a').rrule.byweekday, [1, 2, 3, 4, 5]);
    cal.closePopover();
    assert.equal(cal.history.length, before + 1);
    cal.undo();
    assert.equal(cal.getEventById('a').title, 'Design review');
    assert.equal(cal.getEventById('a').rrule, undefined);
  });

  test('destroy removes the DOM and global listeners', async () => {
    cal = await mount({ events: base() });
    const root = cal.root;
    cal.destroy();
    cal = null;
    assert.equal(root.isConnected, false);
  });
});
