import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { window, mount } from './helpers/dom.js';

const ev = [{ id: 'a', title: 'Kickoff', start: '2026-11-09T10:00', end: '2026-11-09T11:00' }];
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('classNames', () => {
  test('adds classes to toolbar, events, today, popovers and toasts', async () => {
    const cal = await mount({ events: ev, date: new Date(), classNames: { toolbar: 'tb x', event: 'my-ev', today: 'is-today', sidebar: 'side', editor: 'ed', toast: 'tt', palette: 'pp', root: 'rooty' } });
    assert.ok(cal.root.classList.contains('rooty'));
    assert.ok(cal.root.querySelector('.ixc-bar.tb.x'));
    assert.ok(cal.root.querySelector('.ixc-side.side'));
    assert.ok(cal.root.querySelector('.ixc-today.is-today'));
    cal.gotoDate('2026-11-09');
    assert.ok(cal.root.querySelector('[data-key="a"].my-ev'), 'reapplied after re-render');
    cal.openEditor('a', cal.root.querySelector('[data-key="a"]'));
    assert.ok(cal.root.querySelector('.ixc-editor.ed'));
    cal.closePopover();
    cal.removeEvent('a');
    cal.undo();
    assert.ok(cal.root.querySelector('.ixc-toast.tt'));
    cal.openPalette();
    assert.ok(cal.root.querySelector('.ixc-pal.pp'));
    cal.destroy();
  });
  test('unknown parts are ignored', async () => {
    const cal = await mount({ events: ev, classNames: { nope: 'x', event: '' } });
    assert.ok(cal.root.querySelector('[data-key="a"]'));
    cal.destroy();
  });
});

describe('web component', () => {
  test('<ixc-calendar> reads attributes, options and re-dispatches events', async () => {
    await import('../src/element.js');
    const el = document.createElement('ixc-calendar');
    el.setAttribute('view', 'month');
    el.setAttribute('first-day', '0');
    el.options = { events: ev, date: '2026-11-09', locale: 'en-GB' };
    const seen = [];
    el.addEventListener('ixc:eventCreate', (e) => seen.push(e.detail.event.title));
    document.body.appendChild(el);
    assert.equal(el.api.getView(), 'month');
    assert.equal(el.api.o.firstDay, 0);
    assert.equal(el.api.getEvents().length, 1);
    el.setAttribute('view', 'agenda');
    assert.equal(el.api.getView(), 'agenda');
    el.options = { theme: 'dark' };
    assert.equal(el.api.root.dataset.theme, 'dark');
    el.api.addEvent({ title: 'From API', start: '2026-11-10T09:00' });
    assert.deepEqual(seen, ['From API']);
    el.remove();
    assert.equal(el.api, null, 'destroyed on disconnect');
  });
});

describe('React wrapper', () => {
  test('mounts, exposes the instance by ref, updates props and unmounts', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { Calendar } = await import('../src/react.js');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const ref = React.createRef();
    const created = [];
    const render = (props) => React.act(() => root.render(React.createElement(Calendar, { ref, events: ev, date: '2026-11-09', locale: 'en-GB', className: 'wrap', ...props })));
    await render({ view: 'week', onEventCreate: () => created.push(1) });
    assert.ok(host.querySelector('.wrap > .ixc'), 'calendar inside the wrapper div');
    assert.equal(ref.current.getView(), 'week');
    await render({ view: 'month', onEventCreate: () => created.push(2) });
    assert.equal(ref.current.getView(), 'month', 'prop change applied');
    ref.current.addEvent({ title: 'x', start: '2026-11-10T09:00' });
    assert.deepEqual(created, [2], 'latest callback is used');
    const cal = ref.current;
    await render({ view: 'month', events: [...ev, { id: 'b', title: 'B', start: '2026-11-11T10:00' }] });
    assert.equal(cal.getEvents().length, 2, 'new events array replaces data');
    await React.act(() => root.unmount());
    assert.equal(host.querySelector('.ixc'), null, 'destroyed on unmount');
    host.remove();
  });
});

describe('Vue wrapper', () => {
  test('mounts, reacts to props, emits kebab-case events and exposes api', async () => {
    const { createApp, h, ref, nextTick } = await import('vue');
    const { IxCalendar } = await import('../src/vue.js');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const view = ref('week');
    const events = ref(ev);
    const created = [];
    const calRef = ref(null);
    const app = createApp({
      render: () => h(IxCalendar, { ref: calRef, view: view.value, events: events.value, options: { date: '2026-11-09', locale: 'en-GB' }, onEventCreate: (p) => created.push(p.event.title) }),
    });
    app.mount(host);
    await tick();
    const api = calRef.value.api;
    assert.equal(api.getView(), 'week');
    view.value = 'month';
    await nextTick();
    assert.equal(api.getView(), 'month');
    events.value = [...ev, { id: 'b', title: 'B', start: '2026-11-11T10:00' }];
    await nextTick();
    assert.equal(api.getEvents().length, 2);
    api.addEvent({ title: 'Vue event', start: '2026-11-12T10:00' });
    assert.deepEqual(created, ['Vue event']);
    app.unmount();
    assert.equal(host.querySelector('.ixc'), null);
    host.remove();
  });
});
