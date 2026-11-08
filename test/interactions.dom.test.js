import { test, describe, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { mount, key, window } from './helpers/dom.js';

// ---------------------------------------------------------------- fake layout
// jsdom has no layout engine, so give the parts the hit-testing reads a predictable geometry:
//   time grid: columns are 100px wide starting at x=100, 0:00 is at y=200, 24px per 30 min
//   all-day strip: y 150–190      month: rows 100px tall from y=100, 7 cells × 100px
//   timeline: lanes 50px tall from y=100, starting at x=200, 96px per hour
const R = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t });
before(() => {
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const c = this.classList;
    const nth = (sel, scope) => [...scope.querySelectorAll(sel)].indexOf(this);
    if (c.contains('ixc-col')) return R(100 + nth('.ixc-col', this.parentElement) * 100, 200, 100, parseFloat(this.style.height) || 1152);
    if (c.contains('ixc-tg-adarea')) return R(100, 150, 700, 40);
    if (c.contains('ixc-mo-week')) return R(0, 100 + nth('.ixc-mo-week', this.parentElement) * 100, 700, 100);
    if (c.contains('ixc-tl-lane')) return R(200, 100 + nth('.ixc-tl-lane', this.closest('.ixc-tl-grid')) * 50, parseFloat(this.style.width) || 2304, 50);
    if (c.contains('ixc')) return R(0, 0, 1200, 800);
    return R(0, 0, 0, 0);
  };
});
const Y = (h, m = 0) => 200 + ((h * 60 + m) / 30) * 24 + 2; // a point just inside that time
const X = (col) => 150 + col * 100; // middle of a week column (Mon = 0)

const fire = (el, type, x, y, extra = {}) => {
  const e = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(e, k, { value: v });
  el.dispatchEvent(e);
};
const el = (cal, key, sub = '') => cal.root.querySelector(`[data-key="${key}"]${sub ? ` ${sub}` : ''}`);
function drag(cal, target, from, to, { up = true, extra } = {}) {
  fire(target, 'pointerdown', from[0], from[1], extra);
  fire(cal.main, 'pointermove', from[0] + 6, from[1] + 6, extra);
  fire(cal.main, 'pointermove', to[0], to[1], extra);
  if (up) fire(cal.main, 'pointerup', to[0], to[1], extra);
}
const hm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

const events = () => [
  { id: 'a', title: 'Design review', start: '2026-11-09T11:00', end: '2026-11-09T12:00' },
  { id: 'c', title: 'Offsite', start: '2026-11-11', end: '2026-11-13' },
  { id: 'ro', title: 'Locked', start: '2026-11-10T15:00', end: '2026-11-10T16:00', editable: false },
];
let cal;
afterEach(() => { cal?.destroy(); cal = null; });

describe('time grid drag & drop', () => {
  test('move to another day and time keeps the duration and is one undo step', async () => {
    cal = await mount({ events: events() });
    const updates = [];
    cal.on('eventUpdate', (p) => updates.push(p));
    drag(cal, el(cal, 'a', '.ixc-ev-in'), [X(0), Y(11, 10)], [X(2), Y(14, 10)]);
    const a = cal.getEventById('a');
    assert.equal(a.start.getDate(), 11);
    assert.equal(hm(a.start), '14:00');
    assert.equal(hm(a.end), '15:00');
    assert.equal(updates.length, 1);
    assert.equal(updates[0].old.start.getDate(), 9);
    assert.equal(cal.history.length, 1);
    cal.undo();
    assert.equal(hm(cal.getEventById('a').start), '11:00');
  });

  test('resize from the bottom and from the top', async () => {
    cal = await mount({ events: events() });
    drag(cal, el(cal, 'a', '[data-resize="end"]'), [X(0), Y(12)], [X(0), Y(13, 15)]);
    assert.equal(hm(cal.getEventById('a').end), '13:30');
    drag(cal, el(cal, 'a', '[data-resize="start"]'), [X(0), Y(11)], [X(0), Y(9, 45)]);
    assert.equal(hm(cal.getEventById('a').start), '9:45');
    assert.equal(hm(cal.getEventById('a').end), '13:30');
  });

  test('resizing can never make an event shorter than one snap step', async () => {
    cal = await mount({ events: events() });
    drag(cal, el(cal, 'a', '[data-resize="end"]'), [X(0), Y(12)], [X(0), Y(8)]);
    const a = cal.getEventById('a');
    assert.equal((a.end - a.start) / 60000, 15);
  });

  test('drag on empty grid creates an event, opens the editor, Enter keeps it', async () => {
    cal = await mount({ events: [] });
    drag(cal, cal.root.querySelectorAll('.ixc-col')[1], [X(1), Y(9, 30)], [X(1), Y(10, 45)]);
    const [e] = cal.getEvents();
    assert.equal(hm(e.start), '9:30');
    assert.equal(hm(e.end), '11:00');
    const title = cal.root.querySelector('.ixc-editor [name=title]');
    assert.ok(title, 'editor opened');
    title.value = 'Planning';
    title.dispatchEvent(new window.Event('input', { bubbles: true }));
    title.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.equal(cal.root.querySelector('.ixc-editor'), null);
    assert.equal(cal.getEvents()[0].title, 'Planning');
    cal.undo();
    assert.equal(cal.getEvents().length, 0, 'creating + naming is a single undo step');
  });

  test('Escape on a new untitled event throws it away', async () => {
    cal = await mount({ events: [] });
    drag(cal, cal.root.querySelectorAll('.ixc-col')[3], [X(3), Y(9)], [X(3), Y(10)]);
    assert.equal(cal.getEvents().length, 1);
    cal.root.focus();
    key(cal, 'Escape');
    assert.equal(cal.getEvents().length, 0);
    assert.equal(cal.history.length, 0);
  });

  test('dragging into the all-day strip and back converts the event', async () => {
    cal = await mount({ events: events() });
    drag(cal, el(cal, 'a', '.ixc-ev-in'), [X(0), Y(11, 10)], [X(2), 170]);
    let a = cal.getEventById('a');
    assert.equal(a.allDay, true);
    assert.equal(a.start.getDate(), 11);
    drag(cal, el(cal, 'c', '.ixc-ev-in'), [X(2), 165], [X(3), Y(10)]);
    const c = cal.getEventById('c');
    assert.equal(c.allDay, false);
    assert.equal(c.start.getDate(), 12);
    assert.equal(hm(c.start), '10:00');
    assert.equal((c.end - c.start) / 60000, 60, 'default duration');
  });

  test('Escape cancels a drag in progress', async () => {
    cal = await mount({ events: events() });
    drag(cal, el(cal, 'a', '.ixc-ev-in'), [X(0), Y(11, 10)], [X(4), Y(16)], { up: false });
    assert.equal(cal.getEventById('a').start.getDate(), 13, 'preview moved');
    key(cal, 'Escape');
    fire(cal.main, 'pointerup', X(4), Y(16));
    assert.equal(cal.getEventById('a').start.getDate(), 9);
    assert.equal(cal.history.length, 0);
  });

  test('a click without movement selects, emits eventClick and opens the editor', async () => {
    cal = await mount({ events: events() });
    const clicks = [];
    cal.on('eventClick', (p) => clicks.push(p.event.id));
    const target = el(cal, 'a', '.ixc-ev-in');
    fire(target, 'pointerdown', X(0), Y(11, 10));
    fire(cal.main, 'pointerup', X(0) + 2, Y(11, 10));
    assert.deepEqual(clicks, ['a']);
    assert.equal(cal.state.selected, 'a');
    assert.ok(cal.root.querySelector('.ixc-editor'));
  });

  test('clicking empty space emits dateClick with the time', async () => {
    cal = await mount({ events: [] });
    const hits = [];
    cal.on('dateClick', (h) => hits.push(h));
    const col = cal.root.querySelectorAll('.ixc-col')[4];
    fire(col, 'pointerdown', X(4), Y(15, 20));
    fire(cal.main, 'pointerup', X(4), Y(15, 20));
    assert.equal(hits.length, 1);
    assert.equal(hits[0].date.getDate(), 13);
    assert.equal(hm(hits[0].date), '15:15', 'snapped to 15 minutes');
  });

  test('double-click on empty space creates an event', async () => {
    cal = await mount({ events: [] });
    fire(cal.root.querySelectorAll('.ixc-col')[0], 'dblclick', X(0), Y(8));
    assert.equal(cal.getEvents().length, 1);
    assert.equal(hm(cal.getEvents()[0].start), '8:00');
  });

  test('locked events cannot be dragged and editing is read-only', async () => {
    cal = await mount({ events: events() });
    drag(cal, el(cal, 'ro', '.ixc-ev-in'), [X(1), Y(15, 10)], [X(3), Y(9)]);
    assert.equal(cal.getEventById('ro').start.getDate(), 10);
    assert.ok(cal.root.querySelector('.ixc-editor [name=title][readonly]'));
    assert.equal(cal.root.querySelector('.ixc-editor [data-ed="del-all"]'), null);
  });

  test('on touch an unselected event is tapped, not dragged', async () => {
    cal = await mount({ events: events() });
    drag(cal, el(cal, 'a', '.ixc-ev-in'), [X(0), Y(11, 10)], [X(2), Y(14)], { extra: { pointerType: 'touch' } });
    assert.equal(cal.getEventById('a').start.getDate(), 9);
    assert.equal(cal.state.selected, 'a');
    cal.closePopover();
    drag(cal, el(cal, 'a', '.ixc-ev-in'), [X(0), Y(11, 10)], [X(2), Y(14, 10)], { extra: { pointerType: 'touch' } });
    assert.equal(cal.getEventById('a').start.getDate(), 11, 'once selected it can be dragged');
  });

  test('hover + Ctrl+V pastes at the hovered slot', async () => {
    cal = await mount({ events: events() });
    cal.copy('a');
    cal.root.focus();
    fire(cal.main, 'pointermove', X(5), Y(16), { pointerType: 'mouse' });
    key(cal, 'v', { ctrlKey: true });
    const copies = cal.getEvents().filter((e) => e.title === 'Design review');
    assert.equal(copies.length, 2);
    assert.equal(copies[1].start.getDate(), 14);
    assert.equal(hm(copies[1].start), '16:00');
  });
});

describe('month drag & drop', () => {
  test('moving an all-day event across weeks', async () => {
    cal = await mount({ events: events(), view: 'month' });
    // Nov 2026 grid starts Mon 26 Oct; row 2 = 9–15 Nov
    drag(cal, el(cal, 'c', '.ixc-ev-in'), [250, 330], [450, 430]);
    const c = cal.getEventById('c');
    assert.equal(c.start.getDate(), 20);
    assert.equal(c.end.getDate(), 22);
  });

  test('resizing an all-day event in month view', async () => {
    cal = await mount({ events: events(), view: 'month' });
    drag(cal, el(cal, 'c', '[data-resize="end"]'), [345, 330], [550, 330]);
    assert.equal(cal.getEventById('c').end.getDate(), 15);
  });

  test('a timed event keeps its time when moved to another day', async () => {
    cal = await mount({ events: events(), view: 'month' });
    drag(cal, el(cal, 'a', '.ixc-ev-in'), [50, 330], [450, 330]);
    const a = cal.getEventById('a');
    assert.equal(a.start.getDate(), 13);
    assert.equal(hm(a.start), '11:00');
  });

  test('"+N more" opens a day list and picking an event opens the editor', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, title: `Item ${i}`, start: `2026-11-12T${String(8 + i).padStart(2, '0')}:00` }));
    cal = await mount({ events: many, view: 'month' });
    const more = cal.root.querySelector('[data-more="2026-11-12"]');
    assert.ok(more, '+N more button');
    more.click();
    const rows = cal.root.querySelectorAll('.ixc-morepop [data-pick]');
    assert.equal(rows.length, 9);
    rows[3].click();
    assert.equal(cal.root.querySelector('.ixc-editor [name=title]').value, 'Item 3');
  });
});

describe('timeline drag & drop', () => {
  test('moving an event to another resource row', async () => {
    cal = await mount({
      view: 'timeline', sidebar: false,
      resources: [{ id: 'atlas', title: 'Atlas' }, { id: 'nova', title: 'Nova' }],
      events: [{ id: 'r', title: 'Booking', start: '2026-11-09T10:00', end: '2026-11-09T11:00', resourceId: 'atlas' }],
    });
    const x = 200 + 10 * 96 + 20;
    drag(cal, el(cal, 'r', '.ixc-ev-in'), [x, 125], [x, 175]);
    const r = cal.getEventById('r');
    assert.equal(r.resourceId, 'nova');
    assert.equal(hm(r.start), '10:00');
    drag(cal, el(cal, 'r', '.ixc-ev-in'), [x, 175], [x + 96, 175]);
    assert.equal(hm(cal.getEventById('r').start), '11:00');
  });

  test('events without a known resource land in "Unassigned"', async () => {
    cal = await mount({ view: 'timeline', resources: [{ id: 'atlas', title: 'Atlas' }], events: [{ id: 'u', title: 'Loose', start: '2026-11-09T10:00' }] });
    const rows = [...cal.root.querySelectorAll('.ixc-tl-row')].map((r) => r.dataset.res);
    assert.deepEqual(rows, ['atlas', '']);
    assert.ok(cal.root.querySelector('.ixc-tl-row[data-res=""] [data-key="u"]'));
  });

  test('grouped resources get group headers, week mode shows day labels', async () => {
    cal = await mount({ view: 'timeline', timelineDays: 7, resources: [{ id: 'a', title: 'A', group: 'Rooms' }, { id: 'b', title: 'B', group: 'Rooms' }, { id: 'c', title: 'C', group: 'People' }], events: [] });
    assert.deepEqual([...cal.root.querySelectorAll('.ixc-tl-group span')].map((g) => g.textContent.replace(/^[▾▸]\s*/, '')), ['Rooms', 'People']);
    assert.equal(cal.root.querySelectorAll('.ixc-tl-dayl').length, 7);
  });
});

describe('editor details', () => {
  test('changing start keeps the duration; end before start is ignored', async () => {
    cal = await mount({ events: events() });
    cal.openEditor('a', el(cal, 'a'));
    const start = cal.root.querySelector('.ixc-editor [name=start]');
    start.value = '2026-11-10T08:30';
    start.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(hm(cal.getEventById('a').end), '9:30');
    const end = cal.root.querySelector('.ixc-editor [name=end]');
    end.value = '2026-11-10T07:00';
    end.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(hm(cal.getEventById('a').end), '9:30');
    assert.match(cal.root.querySelector('.ixc-ed-dur').textContent, /1 h/);
  });

  test('all-day toggle, calendar, color and location', async () => {
    cal = await mount({ events: events(), calendars: [{ id: 'w', name: 'Work', color: '#111111' }, { id: 'h', name: 'Home', color: '#222222' }] });
    cal.openEditor('a', el(cal, 'a'));
    const q = (s) => cal.root.querySelector(`.ixc-editor ${s}`);
    q('[name=allDay]').checked = true;
    q('[name=allDay]').dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(cal.getEventById('a').allDay, true);
    assert.equal(q('[name=start]').type, 'date', 'inputs switch to date pickers');
    q('[name=calendar]').value = 'h';
    q('[name=calendar]').dispatchEvent(new window.Event('change', { bubbles: true }));
    q('[data-color="#16a34a"]').click();
    q('[name=location]').value = 'Room 1';
    q('[name=location]').dispatchEvent(new window.Event('input', { bubbles: true }));
    const a = cal.getEventById('a');
    assert.deepEqual([a.calendar, a.color, a.location], ['h', '#16a34a', 'Room 1']);
  });

  test('delete button removes, toast Undo brings it back', async () => {
    cal = await mount({ events: events() });
    cal.openEditor('a', el(cal, 'a'));
    cal.root.querySelector('.ixc-editor [data-ed="del-all"]').click();
    assert.equal(cal.getEventById('a'), null);
    const undo = cal.root.querySelector('.ixc-toast button');
    assert.equal(undo.textContent, 'Undo');
    undo.click();
    assert.ok(cal.getEventById('a'));
  });

  test('recurring events offer "delete this one" and "delete series"', async () => {
    cal = await mount({ events: [{ id: 's', title: 'Standup', start: '2026-11-09T09:00', end: '2026-11-09T09:15', rrule: { freq: 'daily' } }] });
    cal.openEditor('s@2026-11-11', el(cal, 's@2026-11-11'));
    assert.ok(cal.root.querySelector('.ixc-ed-note'), 'series note shown');
    cal.root.querySelector('[data-ed="del-one"]').click();
    assert.deepEqual(cal.getEventById('s').exdates, ['2026-11-11']);
    cal.openEditor('s@2026-11-12', el(cal, 's@2026-11-12'));
    cal.root.querySelector('[data-ed="del-all"]').click();
    assert.equal(cal.getEventById('s'), null);
  });

  test('duplicate button copies the event', async () => {
    cal = await mount({ events: events() });
    cal.openEditor('a', el(cal, 'a'));
    cal.root.querySelector('[data-ed="dup"]').click();
    assert.equal(cal.getEvents().filter((e) => e.title === 'Design review').length, 2);
  });
});

describe('toolbar, sidebar and palette', () => {
  test('toolbar buttons and view dropdown', async () => {
    cal = await mount({ events: [] });
    const click = (act) => cal.root.querySelector(`[data-act="${act}"]`).click();
    click('next');
    assert.equal(cal.getDate().getDate(), 16);
    click('prev'); click('prev');
    assert.equal(cal.getDate().getDate(), 2);
    const z = cal.slotHeight;
    click('zoom-in');
    assert.ok(cal.slotHeight > z);
    const sel = cal.root.querySelector('.ixc-viewsel select');
    sel.value = 'agenda';
    sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(cal.getView(), 'agenda');
    cal.root.querySelector('[data-view="month"]').click();
    assert.equal(cal.getView(), 'month');
    click('sidebar');
    assert.ok(cal.root.classList.contains('ixc-noside'));
  });

  test('sidebar quick add, mini month and "only" filter', async () => {
    cal = await mount({ events: events(), calendars: [{ id: 'w', name: 'Work' }, { id: 'h', name: 'Home' }] });
    const qa = cal.root.querySelector('.ixc-qa input');
    qa.value = 'Gym friday 18:00 #home';
    qa.dispatchEvent(new window.Event('input'));
    assert.match(cal.root.querySelector('.ixc-qa-prev').textContent, /Gym/);
    qa.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    assert.equal(cal.getEvents().find((e) => e.title === 'Gym').calendar, 'h');
    assert.equal(qa.value, '');
    cal.root.querySelector('[data-act="mini-next"]').click();
    assert.match(cal.root.querySelector('.ixc-mini-h b').textContent, /December/);
    cal.root.querySelector('[data-goto="2026-12-03"]').click();
    assert.equal(cal.getDate().getMonth(), 11);
    cal.root.querySelector('[data-only="h"]').click();
    assert.equal(cal.state.hidden.has('w'), true);
    assert.equal(cal.state.hidden.has('h'), false);
  });

  test('palette: arrow keys move, Enter runs, empty search says so', async () => {
    cal = await mount({ events: events() });
    cal.openPalette();
    const input = cal.root.querySelector('.ixc-pal input');
    input.value = 'month view';
    input.dispatchEvent(new window.Event('input'));
    const items = [...cal.root.querySelectorAll('.ixc-pal-item')];
    assert.match(items[0].textContent, /Month view/);
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown' }));
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowUp' }));
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    assert.equal(cal.getView(), 'month');
    cal.openPalette('design');
    assert.ok([...cal.root.querySelectorAll('.ixc-pal-item')].some((b) => /Design review/.test(b.textContent)), 'events are searchable');
    cal.closePalette();
    assert.equal(cal.root.querySelector('.ixc-pal'), null);
  });

  test('free slot tool highlights a slot that can be booked', async () => {
    cal = await mount({ events: events(), view: 'month' });
    const slot = cal.showFreeSlot(30);
    assert.ok(slot);
    assert.equal(cal.getView(), 'week', 'switches to a time view');
    cal.root.querySelector('[data-book]').click();
    assert.ok(cal.getEvents().some((e) => e.title === 'Focus time' && +e.start === +slot.start));
  });
});
