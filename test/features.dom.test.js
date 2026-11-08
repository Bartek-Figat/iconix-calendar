import { test, describe, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { mount, key, window } from './helpers/dom.js';
import { weekNumber } from '../src/date.js';

// same fake geometry as interactions.dom.test.js
const R = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t });
before(() => {
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const c = this.classList;
    const nth = (sel, scope) => [...scope.querySelectorAll(sel)].indexOf(this);
    if (c.contains('ixc-col')) return R(100 + nth('.ixc-col', this.parentElement) * 100, 200, 100, parseFloat(this.style.height) || 1152);
    if (c.contains('ixc-tg-adarea')) return R(100, 150, 700, 40);
    if (c.contains('ixc-mo-week')) return R(0, 100 + nth('.ixc-mo-week', this.parentElement) * 100, 700, 100);
    if (c.contains('ixc-tl-lane')) return R(400, 100 + nth('.ixc-tl-row > .ixc-tl-lane', this.closest('.ixc-tl-grid')) * 50, parseFloat(this.style.width) || 2304, 50);
    return R(0, 0, 0, 0);
  };
});
const Y = (h, m = 0) => 200 + ((h * 60 + m) / 30) * 24 + 2;
const X = (col) => 150 + col * 100;
const fire = (el, type, x, y) => el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
function drag(cal, target, from, to) {
  fire(target, 'pointerdown', ...from);
  fire(cal.main, 'pointermove', from[0] + 6, from[1] + 6);
  fire(cal.main, 'pointermove', ...to);
  fire(cal.main, 'pointerup', ...to);
}
const hm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
let cal;
afterEach(() => { cal?.destroy(); cal = null; });

describe('range selection', () => {
  test('selectMode "range": drag selects, emits select, creates nothing; Esc clears', async () => {
    const sel = [];
    cal = await mount({ events: [], selectMode: 'range', onSelect: (s) => sel.push(s) });
    drag(cal, cal.root.querySelectorAll('.ixc-col')[2], [X(2), Y(10)], [X(2), Y(11, 30)]);
    assert.equal(cal.getEvents().length, 0);
    assert.equal(sel.length, 1);
    assert.equal(hm(sel[0].start), '10:00');
    assert.equal(hm(sel[0].end), '11:45');
    assert.ok(cal.root.querySelector('.ixc-selection'), 'selection is drawn');
    assert.equal(hm(cal.getSelection().start), '10:00');
    cal.root.focus();
    key(cal, 'Escape');
    assert.equal(cal.getSelection(), null);
    assert.equal(cal.root.querySelector('.ixc-selection'), null);
  });

  test('selectRange / unselect from code, and clicking empty space unselects', async () => {
    const un = [];
    cal = await mount({ events: [], onUnselect: () => un.push(1) });
    cal.selectRange({ start: '2026-11-10T09:00', end: '2026-11-10T10:00' });
    assert.ok(cal.root.querySelector('.ixc-selection'));
    const col = cal.root.querySelectorAll('.ixc-col')[4];
    fire(col, 'pointerdown', X(4), Y(15));
    fire(cal.main, 'pointerup', X(4), Y(15));
    assert.equal(cal.getSelection(), null);
    assert.equal(un.length, 1);
  });

  test('selectAllow and selectOverlap limit creating', async () => {
    cal = await mount({
      events: [{ id: 'busy', title: 'Busy', start: '2026-11-11T10:00', end: '2026-11-11T11:00' }],
      selectAllow: ({ start }) => start.getHours() >= 9, selectOverlap: false,
    });
    drag(cal, cal.root.querySelectorAll('.ixc-col')[1], [X(1), Y(7)], [X(1), Y(8)]);
    assert.equal(cal.getEvents().length, 1, 'before 9:00 refused');
    drag(cal, cal.root.querySelectorAll('.ixc-col')[2], [X(2), Y(9)], [X(2), Y(10, 30)]);
    assert.equal(cal.getEvents().length, 1, 'overlapping Busy refused');
  });
});

describe('overlap rules and valid range', () => {
  const base = () => [
    { id: 'a', title: 'A', start: '2026-11-09T10:00', end: '2026-11-09T11:00' },
    { id: 'b', title: 'B', start: '2026-11-09T13:00', end: '2026-11-09T14:00' },
    { id: 'bg', title: 'Lunch window', start: '2026-11-09T12:00', end: '2026-11-09T13:00', display: 'background' },
  ];
  test('eventOverlap: false stops events from landing on each other (background events never block)', async () => {
    cal = await mount({ events: base(), eventOverlap: false });
    drag(cal, cal.root.querySelector('[data-key="a"] .ixc-ev-in'), [X(0), Y(10, 10)], [X(0), Y(13, 10)]);
    assert.equal(hm(cal.getEventById('a').start), '10:00', 'onto B refused');
    drag(cal, cal.root.querySelector('[data-key="a"] .ixc-ev-in'), [X(0), Y(10, 10)], [X(0), Y(12, 10)]);
    assert.equal(hm(cal.getEventById('a').start), '12:00', 'onto the background event allowed');
  });
  test('eventOverlap as a function decides per pair', async () => {
    cal = await mount({ events: [...base(), { id: 'c', title: 'Soft', start: '2026-11-09T15:00', end: '2026-11-09T16:00', soft: true }], eventOverlap: (still) => !!still.soft });
    drag(cal, cal.root.querySelector('[data-key="a"] .ixc-ev-in'), [X(0), Y(10, 10)], [X(0), Y(15, 10)]);
    assert.equal(hm(cal.getEventById('a').start), '15:00');
    drag(cal, cal.root.querySelector('[data-key="a"] .ixc-ev-in'), [X(0), Y(15, 10)], [X(0), Y(13, 10)]);
    assert.equal(hm(cal.getEventById('a').start), '15:00', 'B is not soft');
  });
  test('validRange refuses moves outside it', async () => {
    cal = await mount({ events: base(), validRange: { start: '2026-11-09', end: '2026-11-12' } });
    drag(cal, cal.root.querySelector('[data-key="a"] .ixc-ev-in'), [X(0), Y(10, 10)], [X(4), Y(10, 10)]);
    assert.equal(cal.getEventById('a').start.getDate(), 9);
    drag(cal, cal.root.querySelector('[data-key="a"] .ixc-ev-in'), [X(0), Y(10, 10)], [X(2), Y(10, 10)]);
    assert.equal(cal.getEventById('a').start.getDate(), 11);
  });
});

describe('background events', () => {
  test('render as shaded blocks in every view and do not count as clashes or busy time', async () => {
    cal = await mount({
      events: [
        { id: 'x', title: 'Meeting', start: '2026-11-09T12:00', end: '2026-11-09T13:00' },
        { id: 'bg', title: 'Closed', start: '2026-11-09T12:00', end: '2026-11-09T14:00', display: 'background', color: '#dc2626' },
      ],
    });
    assert.ok(cal.root.querySelector('.ixc-col .ixc-bgev'));
    assert.equal(cal.root.querySelector('[data-key="bg"]'), null, 'not an interactive event');
    assert.equal(cal.root.querySelector('.ixc-clash').hidden, true);
    const slot = cal.findFreeSlot({ duration: 60, from: new Date(2026, 10, 9, 12), hours: null });
    assert.equal(hm(slot.start), '13:00', 'only the real meeting blocks');
    cal.setView('month');
    assert.ok(cal.root.querySelector('.ixc-mo-cell .ixc-bgev'));
    cal.setView('agenda');
    assert.ok(!cal.root.textContent.includes('Closed'), 'not listed in the agenda');
  });
});

describe('resources', () => {
  const resources = [
    { id: 'hq', title: 'Headquarters', kind: 'Site', children: [
      { id: 'a', title: 'Room A', kind: 'Meeting', businessHours: { start: 8, end: 12, days: [1, 2, 3, 4, 5] } },
      { id: 'b', title: 'Room B', kind: 'Workshop' },
    ] },
    { id: 'c', title: 'Remote', kind: 'Virtual' },
  ];
  const events = [
    { id: 'm', title: 'Shared', start: '2026-11-09T10:00', end: '2026-11-09T11:00', resourceIds: ['a', 'c'] },
    { id: 'n', title: 'B only', start: '2026-11-09T09:00', end: '2026-11-09T10:00', resourceId: 'b' },
  ];

  test('timeline: extra columns, nested rows, collapsing, multi-resource events', async () => {
    cal = await mount({ view: 'timeline', resources, events, resourceColumns: [{ field: 'title', label: 'Room', width: 160 }, { field: 'kind', label: 'Kind', width: 100 }] });
    assert.deepEqual([...cal.root.querySelectorAll('.ixc-tl-ch')].map((c) => c.textContent), ['Room', 'Kind']);
    assert.deepEqual([...cal.root.querySelectorAll('.ixc-tl-row')].map((r) => r.dataset.res), ['hq', 'a', 'b', 'c']);
    assert.match(cal.root.querySelector('.ixc-tl-row[data-res="a"]').textContent, /Meeting/);
    assert.equal(cal.root.querySelectorAll('[data-key="m"]').length, 2, 'shown in both rows');
    assert.ok(cal.root.querySelector('.ixc-tl-row[data-res="a"] .ixc-off'), 'room A has its own business hours');
    cal.root.querySelector('[data-toggle="r:hq"]').click();
    assert.deepEqual([...cal.root.querySelectorAll('.ixc-tl-row')].map((r) => r.dataset.res), ['hq', 'c']);
    cal.root.querySelector('[data-toggle="r:hq"]').click();
    assert.equal(cal.root.querySelectorAll('.ixc-tl-row').length, 4);
  });

  test('dragging a multi-resource event moves only the row it was grabbed in', async () => {
    cal = await mount({ view: 'timeline', resources, events });
    const rows = [...cal.root.querySelectorAll('.ixc-tl-row')].map((r) => r.dataset.res); // hq, a, b, c
    const yOf = (id) => 100 + rows.indexOf(id) * 50 + 25;
    const x = 400 + 10 * 96 + 20;
    const inA = cal.root.querySelector('.ixc-tl-row[data-res="a"] [data-key="m"] .ixc-ev-in');
    drag(cal, inA, [x, yOf('a')], [x, yOf('b')]);
    assert.deepEqual(cal.getEventById('m').resourceIds, ['b', 'c']);
  });

  test('groups collapse too', async () => {
    cal = await mount({ view: 'timeline', resources: [{ id: 'x', title: 'X', group: 'G1' }, { id: 'y', title: 'Y', group: 'G1' }, { id: 'z', title: 'Z', group: 'G2' }], events: [] });
    cal.root.querySelector('[data-toggle="g:G1"]').click();
    assert.deepEqual([...cal.root.querySelectorAll('.ixc-tl-row')].map((r) => r.dataset.res), ['z']);
  });

  test('resource day view: one column per resource, drag between columns', async () => {
    cal = await mount({ view: 'resourceDay', resources, events, date: '2026-11-09' });
    const heads = [...cal.root.querySelectorAll('.ixc-tg-res b')].map((b) => b.textContent);
    assert.deepEqual(heads, ['Room A', 'Room B', 'Remote'], 'leaf resources only');
    assert.equal(cal.root.querySelectorAll('[data-key="m"]').length, 2);
    drag(cal, cal.root.querySelector('[data-res="b"] [data-key="n"] .ixc-ev-in'), [X(1), Y(9, 10)], [X(2), Y(9, 10)]);
    assert.equal(cal.getEventById('n').resourceId, 'c');
    drag(cal, cal.root.querySelectorAll('.ixc-col')[0], [X(0), Y(14)], [X(0), Y(15)]);
    const created = cal.getEvents().find((e) => e.id !== 'm' && e.id !== 'n');
    assert.equal(created.resourceId, 'a', 'new events get the column resource');
  });
});

describe('new views', () => {
  const events = [
    { id: 'a', title: 'Alpha', start: '2026-11-09T10:00', end: '2026-11-09T11:00' },
    { id: 'b', title: 'Beta', start: '2026-12-02T10:00', end: '2026-12-02T11:00' },
    { id: 'c', title: 'Gamma', start: '2026-03-02T10:00', end: '2026-03-02T11:00' },
  ];
  test('list views cover a week, a month and a year', async () => {
    cal = await mount({ events, views: ['listWeek', 'listMonth', 'listYear'], view: 'listWeek' });
    const titles = () => [...cal.root.querySelectorAll('.ixc-ag-row b')].map((b) => b.textContent);
    assert.deepEqual(titles(), ['Alpha']);
    cal.setView('listMonth');
    assert.deepEqual(titles(), ['Alpha']);
    cal.setView('listYear');
    assert.deepEqual(titles(), ['Gamma', 'Alpha', 'Beta']);
    assert.equal(cal.root.querySelector('.ixc-title').textContent, '2026');
    cal.next();
    assert.equal(cal.root.querySelector('.ixc-title').textContent, '2027');
  });

  test('multi-month shows N months with event chips; chips open the editor', async () => {
    cal = await mount({ events, view: 'multiMonth', monthsCount: 2 });
    assert.equal(cal.root.querySelectorAll('.ixc-mm-m').length, 2);
    const chip = cal.root.querySelector('.ixc-mm-ev[data-key="b"]');
    assert.ok(chip, 'December chip');
    fire(chip, 'pointerdown', 0, 0);
    fire(cal.main, 'pointerup', 0, 0);
    assert.equal(cal.root.querySelector('.ixc-editor [name=title]').value, 'Beta');
    cal.next();
    assert.match(cal.root.querySelector('.ixc-title').textContent, /January/);
  });

  test('week grid is a single month-style row', async () => {
    cal = await mount({ events, view: 'weekGrid' });
    assert.equal(cal.root.querySelectorAll('.ixc-mo-week').length, 1);
    assert.ok(cal.root.querySelector('[data-key="a"]'));
    drag(cal, cal.root.querySelector('[data-key="a"] .ixc-ev-in'), [50, 130], [350, 130]);
    assert.equal(cal.getEventById('a').start.getDate(), 12);
  });

  test('month timeline: one cell per day, drag moves by days', async () => {
    cal = await mount({ events, view: 'timeline', timelineDays: 'month', resources: [{ id: 'r', title: 'R' }] });
    assert.equal(cal.root.querySelectorAll('.ixc-tl-dayc').length, 30);
    assert.match(cal.root.querySelector('.ixc-title').textContent, /November 2026/);
    cal.next();
    assert.equal(cal.root.querySelectorAll('.ixc-tl-dayc').length, 31);
  });

  test('week numbers in week and month views', async () => {
    assert.equal(weekNumber(new Date(2026, 10, 9)), 46);
    assert.equal(weekNumber(new Date(2027, 0, 1)), 53, '1 Jan 2027 is in ISO week 53 of 2026');
    assert.equal(weekNumber(new Date(2026, 0, 1)), 1);
    cal = await mount({ events: [], weekNumbers: true });
    assert.equal(cal.root.querySelector('.ixc-wk').textContent, 'W46');
    cal.setView('month');
    assert.equal(cal.root.querySelectorAll('.ixc-wkn').length, 6);
  });
});
