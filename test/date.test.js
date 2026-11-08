import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/date.js';
import { getStrings } from '../src/i18n.js';
import { packColumns, packLanes } from '../src/layout.js';

describe('date helpers', () => {
  test('toDate: date-only strings are local midnight, Dates are copied', () => {
    const d = D.toDate('2026-03-29');
    assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 2, 29, 0]);
    const src = new Date(2026, 0, 1);
    const copy = D.toDate(src);
    copy.setFullYear(2000);
    assert.equal(src.getFullYear(), 2026);
    assert.equal(D.isDateOnly('2026-01-01'), true);
    assert.equal(D.isDateOnly('2026-01-01T10:00'), false);
  });

  test('addMonths clamps to the end of shorter months', () => {
    assert.equal(D.ymd(D.addMonths(new Date(2026, 0, 31), 1)), '2026-02-28');
    assert.equal(D.ymd(D.addMonths(new Date(2028, 0, 31), 1)), '2028-02-29');
    assert.equal(D.ymd(D.addMonths(new Date(2026, 2, 31), -1)), '2026-02-28');
    assert.equal(D.ymd(D.addMonths(new Date(2026, 10, 15), 14)), '2028-01-15');
  });

  test('startOfWeek respects the first day', () => {
    const sun = new Date(2026, 10, 8);
    assert.equal(D.ymd(D.startOfWeek(sun, 1)), '2026-11-02');
    assert.equal(D.ymd(D.startOfWeek(sun, 0)), '2026-11-08');
    assert.equal(D.ymd(D.startOfWeek(new Date(2026, 10, 14), 6)), '2026-11-14');
  });

  test('diffDays counts calendar days across DST changes', () => {
    assert.equal(D.diffDays(new Date(2026, 2, 28), new Date(2026, 2, 30)), 2);
    assert.equal(D.diffDays(new Date(2026, 9, 24, 23), new Date(2026, 9, 26, 1)), 2);
    assert.equal(D.diffDays(new Date(2026, 11, 31), new Date(2027, 0, 1)), 1);
    assert.equal(D.diffDays(new Date(2026, 0, 2), new Date(2026, 0, 1)), -1);
  });

  test('atMinutes and minutesOfDay', () => {
    assert.equal(D.minutesOfDay(D.atMinutes(new Date(2026, 0, 1, 15), 9 * 60 + 30)), 570);
    assert.equal(D.ymd(D.atMinutes(new Date(2026, 0, 1), 24 * 60 + 30)), '2026-01-02', 'overflow rolls into the next day');
  });

  test('overlaps is exclusive at the edges, clamp works', () => {
    assert.equal(D.overlaps(0, 10, 10, 20), false);
    assert.equal(D.overlaps(0, 11, 10, 20), true);
    assert.equal(D.clamp(5, 0, 3), 3);
    assert.equal(D.clamp(-1, 0, 3), 0);
  });

  test('12h vs 24h formatting follows the locale', () => {
    assert.equal(D.uses12h('en-US'), true);
    assert.equal(D.uses12h('pl-PL'), false);
    assert.equal(D.timeStr(new Date(2026, 0, 1, 14, 0), 'en-US'), '2pm');
    assert.equal(D.timeStr(new Date(2026, 0, 1, 9, 30), 'en-US'), '9:30am');
    assert.equal(D.timeStr(new Date(2026, 0, 1, 9, 5), 'pl-PL'), '09:05');
    assert.deepEqual([0, 9, 12, 18].map((h) => D.hourLabel(h, 'en-US')), ['12am', '9am', '12pm', '6pm']);
    assert.equal(D.hourLabel(7, 'en-GB'), '07:00');
  });

  test('fmtRange collapses shared parts', () => {
    const s = D.fmtRange(new Date(2026, 10, 9), new Date(2026, 10, 15), 'en-GB', { month: 'long', day: 'numeric', year: 'numeric' });
    assert.match(s, /^9\s*–\s*15 November 2026$/);
  });

  test('form input round trip', () => {
    const d = new Date(2026, 10, 9, 7, 5);
    assert.equal(D.toInput(d, false), '2026-11-09T07:05');
    assert.equal(D.toInput(d, true), '2026-11-09');
    assert.equal(+D.fromInput('2026-11-09T07:05'), +d);
    assert.equal(+D.fromInput('2026-11-09'), +new Date(2026, 10, 9));
    assert.equal(D.fromInput(''), null);
  });
});

describe('strings', () => {
  test('english default, polish by locale, unknown falls back to english', () => {
    assert.equal(getStrings('en-US').today, 'Today');
    assert.equal(getStrings('pl-PL').today, 'Dziś');
    assert.equal(getStrings('xx').today, 'Today');
  });
  test('polish plural forms for clashes', () => {
    const t = getStrings('pl');
    assert.deepEqual([1, 3, 7].map(t.clashes), ['1 kolizja', '3 kolizje', '7 kolizji']);
    assert.deepEqual([1, 2].map(getStrings('en').clashes), ['1 clash', '2 clashes']);
  });
  test('overrides win and every english key is translated in every language', async () => {
    assert.equal(getStrings('pl', { today: 'Teraz' }).today, 'Teraz');
    const { STRINGS } = await import('../src/i18n.js');
    const keys = Object.keys(STRINGS.en);
    for (const [lang, table] of Object.entries(STRINGS)) {
      for (const k of keys) assert.equal(typeof table[k], typeof STRINGS.en[k], `${lang}.${k}`);
    }
    assert.equal(getStrings('de-AT').today, 'Heute');
    assert.equal(getStrings('fr-CA').more(2), '+2 de plus');
    assert.equal(getStrings('es-MX').clashes(3), '3 conflictos');
  });
});

describe('layout', () => {
  test('lanes reuse freed space; longer items first on ties', () => {
    const items = [{ s: 0, e: 2, id: 'short' }, { s: 0, e: 5, id: 'long' }, { s: 2, e: 3, id: 'next' }];
    assert.equal(packLanes(items), 2);
    const by = Object.fromEntries(items.map((i) => [i.id, i.lane]));
    assert.deepEqual(by, { long: 0, short: 1, next: 1 });
  });
  test('columns stretch to the right when the neighbour column is free', () => {
    const segs = packColumns([{ s: 0, e: 60, id: 'a' }, { s: 0, e: 30, id: 'b' }, { s: 0, e: 30, id: 'c' }, { s: 40, e: 60, id: 'd' }]);
    const by = Object.fromEntries(segs.map((g) => [g.id, g]));
    assert.equal(by.a.cols, 3);
    assert.equal(by.d.col, 1);
    assert.equal(by.d.span, 2, 'd can use columns 1 and 2');
    assert.equal(by.b.span, 1);
  });
  test('separate clusters get their own column count', () => {
    const segs = packColumns([{ s: 0, e: 10 }, { s: 5, e: 15 }, { s: 20, e: 30 }]);
    assert.deepEqual(segs.map((g) => g.cols), [2, 2, 1]);
  });
});
