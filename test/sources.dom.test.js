import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from './helpers/dom.js';

let cal;
afterEach(() => { cal?.destroy(); cal = null; });
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const rendered = () => [...cal.root.querySelectorAll('.ixc-main [data-key]')].map((e) => e.dataset.key);
const range = (start) => [{ id: `e-${start.getDate()}`, title: 'From fn', start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 10) }];

/** fetch stub: routes by URL, records calls */
function fakeFetch(routes, calls = []) {
  return async (url, { signal } = {}) => {
    calls.push(String(url));
    const u = new URL(url);
    const r = routes[u.pathname];
    if (!r) return { ok: false, status: 404, statusText: 'Not Found' };
    if (r.delay) await new Promise((res, rej) => { const t = setTimeout(res, r.delay); signal?.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }); });
    const body = typeof r.body === 'function' ? r.body(u) : r.body;
    return { ok: true, status: 200, json: async () => body, text: async () => body };
  };
}

describe('function source', () => {
  test('is called with the visible range, lazily, and again on refetch', async () => {
    const calls = [];
    cal = await mount({ events: ({ start, end }) => { calls.push([start.getDate(), end.getDate()]); return range(start); } });
    await wait();
    assert.deepEqual(calls, [[9, 16]]);
    assert.deepEqual(rendered(), ['e-9']);
    cal.next(); await wait();
    assert.deepEqual(calls.at(-1), [16, 23]);
    assert.deepEqual(rendered(), ['e-16'], 'previous range replaced');
    cal.setView('day'); await wait();
    assert.equal(calls.length, 2, 'day inside the loaded week: no new call');
    await cal.refetchEvents();
    assert.equal(calls.length, 3);
  });

  test('async functions, loading events and the root class', async () => {
    const seen = [];
    cal = await mount({ events: async ({ start }) => { await wait(5); return range(start); }, onLoading: ({ loading }) => seen.push(loading) });
    await wait();
    assert.ok(cal.root.classList.contains('ixc-loading'));
    await wait(20);
    assert.deepEqual(seen, [true, false]);
    assert.ok(!cal.root.classList.contains('ixc-loading'));
    assert.deepEqual(rendered(), ['e-9']);
  });

  test('errors are reported and loading ends', async () => {
    const errors = [];
    cal = await mount({ events: async () => { throw new Error('boom'); }, onSourceError: ({ error }) => errors.push(error.message) });
    await wait(5);
    assert.deepEqual(errors, ['boom']);
    assert.ok(!cal.root.classList.contains('ixc-loading'));
  });

  test('a slow, superseded request never overwrites a newer one', async () => {
    let n = 0;
    cal = await mount({ events: async ({ start, signal }) => { const me = ++n; await wait(me === 2 ? 30 : 1); if (signal?.aborted) throw Object.assign(new Error('x'), { name: 'AbortError' }); return [{ id: `r${me}`, title: `req ${me}`, start: new Date(start.getTime() + 36e6) }]; } });
    cal.next(); // request 2 (slow)
    cal.prev(); // request 3 (fast) – back to a range that request 1 may have loaded
    await wait(60);
    assert.ok(!rendered().includes('r2'), 'the aborted slow request is ignored');
  });
});

describe('URL and .ics sources', () => {
  test('JSON feed gets start/end params, extra params and transform; source color applies', async () => {
    const calls = [];
    const fetch = fakeFetch({ '/api/events': { body: (u) => ({ events: [{ id: 'x', name: 'Remote', when: u.searchParams.get('start').slice(0, 10) }] }) } }, calls);
    cal = await mount({
      fetch,
      eventSources: [{ id: 'api', url: 'http://test/api/events', color: '#ff0000', extraParams: { team: 'a' }, transform: (r) => ({ id: r.id, title: r.name, start: r.when }) }],
    });
    await wait(5);
    const u = new URL(calls[0]);
    assert.equal(u.searchParams.get('team'), 'a');
    assert.ok(u.searchParams.get('start').startsWith('2026-11-0'), 'ISO start');
    assert.ok(u.searchParams.get('end'));
    const e = cal.getEventById('x');
    assert.equal(e.title, 'Remote');
    assert.equal(e.color, '#ff0000');
    assert.equal(e.source, 'api');
    assert.deepEqual(cal.getEventSources().map((s) => [s.id, s.kind]), [['api', 'url']]);
  });

  test('a plain URL string as `events`, custom param names, HTTP errors', async () => {
    const calls = []; const errors = [];
    cal = await mount({
      fetch: fakeFetch({ '/feed': { body: [{ id: 'f', title: 'Feed', start: '2026-11-10T10:00' }] } }, calls),
      eventSources: [{ url: 'http://test/feed', startParam: 'from', endParam: 'to' }, 'http://test/missing'],
      onSourceError: ({ source, error }) => errors.push(`${source}: ${error.message}`),
    });
    await wait(5);
    assert.ok(new URL(calls[0]).searchParams.has('from'));
    assert.ok(cal.getEventById('f'));
    assert.deepEqual(errors, ['source-1: 404 Not Found']);
  });

  test('.ics feeds are fetched once and parsed', async () => {
    const calls = [];
    const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:i1\r\nDTSTART:20261110T090000\r\nDTEND:20261110T100000\r\nSUMMARY:From ICS\r\nEND:VEVENT\r\nEND:VCALENDAR';
    cal = await mount({ fetch: fakeFetch({ '/team.ics': { body: ics } }, calls), eventSources: ['http://test/team.ics'] });
    await wait(5);
    assert.equal(cal.getEventById('i1').title, 'From ICS');
    cal.next(); await wait(5);
    assert.equal(calls.length, 1, 'not fetched again per range');
  });
});

describe('managing sources', () => {
  test('static sources, add / remove at runtime, editable flag', async () => {
    cal = await mount({ eventSources: [{ id: 'holidays', events: [{ id: 'h', title: 'Holiday', start: '2026-11-11' }], color: '#16a34a', editable: false }] });
    assert.equal(cal.getEventById('h').color, '#16a34a');
    assert.equal(cal.getEventById('h').editable, false);
    await cal.addEventSource({ id: 'extra', events: [{ id: 'x', title: 'Extra', start: '2026-11-12T10:00' }] });
    assert.ok(rendered().includes('x'));
    cal.removeEventSource('holidays');
    assert.equal(cal.getEventById('h'), null);
    assert.ok(cal.getEventById('x'));
  });

  test('setOptions with a new function source reloads', async () => {
    cal = await mount({ events: () => [{ id: 'a', title: 'A', start: '2026-11-10T10:00' }] });
    await wait();
    cal.setOptions({ events: () => [{ id: 'b', title: 'B', start: '2026-11-10T11:00' }] });
    await wait();
    assert.deepEqual(cal.getEvents().map((e) => e.id), ['b']);
  });

  test('editing a remote event still works and fires callbacks', async () => {
    const updates = [];
    cal = await mount({ events: () => [{ id: 'r', title: 'Remote', start: '2026-11-10T10:00' }], onEventUpdate: ({ event }) => updates.push(event.title) });
    await wait();
    cal.updateEvent('r', { title: 'Edited' });
    assert.deepEqual(updates, ['Edited']);
  });
});
