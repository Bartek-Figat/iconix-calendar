import { test, describe, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { mount, window } from './helpers/dom.js';
import { makeDraggable } from '../src/dragdrop.js';

const R = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t });
before(() => {
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const c = this.classList;
    const nth = (sel, scope) => [...scope.querySelectorAll(sel)].indexOf(this);
    if (c.contains('ixc-col')) return R(100 + nth('.ixc-col', this.parentElement) * 100, 200, 100, parseFloat(this.style.height) || 1152);
    if (c.contains('ixc-tg-adarea')) return R(100, 150, 700, 40);
    return R(0, 0, 0, 0);
  };
});
const Y = (h, m = 0) => 200 + ((h * 60 + m) / 30) * 24 + 2;
const X = (col) => 150 + col * 100;
const fire = (el, type, x, y) => el.dispatchEvent(new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
const hm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const cover = (cal) => { cal.main.getBoundingClientRect = () => R(0, 0, 2000, 2000); };
let cals = [];
const make = async (o) => { const c = await mount(o); cals.push(c); return c; };
afterEach(() => { cals.forEach((c) => c.destroy()); cals = []; document.querySelectorAll('.list').forEach((l) => l.remove()); });

describe('external drag & drop', () => {
  test('an element dropped on a droppable calendar becomes an event (eventReceive, one undo step)', async () => {
    const cal = await make({ events: [], droppable: true });
    cover(cal);
    const list = document.createElement('div');
    list.className = 'list';
    list.innerHTML = '<div class="task" data-x>Write report</div>';
    document.body.appendChild(list);
    const got = [];
    cal.on('eventReceive', ({ event, draggedEl }) => got.push([event.title, draggedEl.className]));
    const dnd = makeDraggable(list, { itemSelector: '.task', eventData: (el) => ({ title: el.textContent, duration: 90, color: '#16a34a' }), remove: true });
    const item = list.querySelector('.task');
    fire(item, 'pointerdown', 10, 10);
    fire(document, 'pointermove', 20, 20);
    assert.ok(document.querySelector('.ixc-ghost'), 'ghost follows the pointer');
    fire(document, 'pointermove', X(2), Y(10));
    assert.equal(cal.getEvents().length, 1, 'preview while hovering');
    fire(document, 'pointerup', X(2), Y(10));
    const [e] = cal.getEvents();
    assert.equal(e.title, 'Write report');
    assert.equal(e.start.getDate(), 11);
    assert.equal(hm(e.start), '10:00');
    assert.equal((e.end - e.start) / 60000, 90);
    assert.equal(e.color, '#16a34a');
    assert.deepEqual(got, [['Write report', 'task']]);
    assert.equal(list.querySelector('.task'), null, 'remove: true takes the element away');
    assert.equal(document.querySelector('.ixc-ghost'), null);
    cal.undo();
    assert.equal(cal.getEvents().length, 0);
    dnd.destroy();
  });

  test('data-event JSON, all-day drops, and calendars that are not droppable', async () => {
    const off = await make({ events: [] }); // droppable: false
    cover(off);
    const list = document.createElement('div');
    list.className = 'list';
    list.innerHTML = `<div data-event='{"title":"Holiday","allDay":true}'>Holiday</div>`;
    document.body.appendChild(list);
    makeDraggable(list);
    const item = list.firstElementChild;
    fire(item, 'pointerdown', 10, 10); fire(document, 'pointermove', 30, 30); fire(document, 'pointermove', X(1), Y(10)); fire(document, 'pointerup', X(1), Y(10));
    assert.equal(off.getEvents().length, 0, 'not droppable');
    off.setOptions({ droppable: true });
    fire(item, 'pointerdown', 10, 10); fire(document, 'pointermove', 30, 30); fire(document, 'pointermove', X(1), 170); fire(document, 'pointerup', X(1), 170);
    const [e] = off.getEvents();
    assert.equal(e.allDay, true);
    assert.equal(e.start.getDate(), 10);
  });

  test('Escape cancels an external drag; refused drops add nothing', async () => {
    const cal = await make({ events: [{ id: 'x', title: 'Busy', start: '2026-11-11T10:00', end: '2026-11-11T11:00' }], droppable: true, selectOverlap: false });
    cover(cal);
    const list = document.createElement('div');
    list.className = 'list';
    list.innerHTML = '<div data-event=\'{"title":"New"}\'>New</div>';
    document.body.appendChild(list);
    makeDraggable(list);
    const item = list.firstElementChild;
    fire(item, 'pointerdown', 10, 10); fire(document, 'pointermove', 30, 30); fire(document, 'pointermove', X(2), Y(10, 10));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(cal.getEvents().length, 1);
    fire(item, 'pointerdown', 10, 10); fire(document, 'pointermove', 30, 30); fire(document, 'pointermove', X(2), Y(10, 10)); fire(document, 'pointerup', X(2), Y(10, 10));
    assert.equal(cal.getEvents().length, 1, 'overlap refused');
  });
});

describe('between calendars', () => {
  test('an event dragged from one calendar to another moves there', async () => {
    const a = await make({ events: [{ id: 'm', title: 'Move me', start: '2026-11-09T10:00', end: '2026-11-09T11:00', color: '#db2777' }] });
    const b = await make({ events: [], droppable: true });
    cover(b);
    const left = [];
    a.on('eventLeave', ({ event }) => left.push(event.id));
    const el = a.root.querySelector('[data-key="m"] .ixc-ev-in');
    fire(el, 'pointerdown', X(0), Y(10, 10));
    fire(a.main, 'pointermove', X(0) + 8, Y(10, 20));
    fire(a.main, 'pointermove', X(3), Y(14, 10));
    fire(a.main, 'pointerup', X(3), Y(14, 10));
    assert.equal(a.getEventById('m'), null);
    const e = b.getEventById('m');
    assert.ok(e, 'kept its id');
    assert.equal(e.start.getDate(), 12);
    assert.equal(hm(e.start), '14:00');
    assert.equal((e.end - e.start) / 60000, 60);
    assert.equal(e.color, '#db2777');
    assert.deepEqual(left, ['m']);
    a.undo();
    assert.ok(a.getEventById('m'), 'undo in the source brings it back');
  });
});
