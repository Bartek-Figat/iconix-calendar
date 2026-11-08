import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { expand, describeRule } from '../src/recur.js';
import { toICS, fromICS } from '../src/ics.js';
import { getStrings } from '../src/i18n.js';
import * as D from '../src/date.js';

const ev = (start, mins, rrule, extra = {}) => ({ id: 'e', title: 'E', start, end: new Date(+start + mins * 6e4), rrule, exdates: [], ...extra });
const days = (list) => list.map((i) => D.ymd(i.start));

describe('recurrence', () => {
  test('daily with interval', () => {
    const out = expand(ev(new Date(2026, 10, 1, 8), 30, { freq: 'daily', interval: 3 }), new Date(2026, 10, 1), new Date(2026, 10, 12));
    assert.deepEqual(days(out), ['2026-11-01', '2026-11-04', '2026-11-07', '2026-11-10']);
  });

  test('until is inclusive for date-only values', () => {
    const out = expand(ev(new Date(2026, 10, 1, 18), 60, { freq: 'daily', until: '2026-11-03' }), new Date(2026, 10, 1), new Date(2026, 11, 1));
    assert.deepEqual(days(out), ['2026-11-01', '2026-11-02', '2026-11-03']);
  });

  test('weekly every second week on two days', () => {
    const out = expand(ev(new Date(2026, 10, 2, 9), 60, { freq: 'weekly', interval: 2, byweekday: [1, 4] }), new Date(2026, 10, 1), new Date(2026, 11, 1));
    assert.deepEqual(days(out), ['2026-11-02', '2026-11-05', '2026-11-16', '2026-11-19', '2026-11-30']);
  });

  test('weekly byweekday never emits before the first start', () => {
    const out = expand(ev(new Date(2026, 10, 4, 9), 60, { freq: 'weekly', byweekday: [1, 3, 5] }), new Date(2026, 10, 1), new Date(2026, 10, 9));
    assert.deepEqual(days(out), ['2026-11-04', '2026-11-06']);
  });

  test('count counts occurrences before the visible range too', () => {
    const out = expand(ev(new Date(2026, 10, 2, 9), 60, { freq: 'daily', count: 5 }), new Date(2026, 10, 5), new Date(2026, 10, 30));
    assert.deepEqual(days(out), ['2026-11-05', '2026-11-06']);
  });

  test('yearly on 29 February only happens in leap years', () => {
    const out = expand(ev(new Date(2028, 1, 29, 12), 60, { freq: 'yearly' }), new Date(2028, 0, 1), new Date(2037, 0, 1));
    assert.deepEqual(days(out), ['2028-02-29', '2032-02-29', '2036-02-29']);
  });

  test('keeps wall-clock time across a DST change', () => {
    const out = expand(ev(new Date(2026, 2, 26, 9), 60, { freq: 'daily' }), new Date(2026, 2, 26), new Date(2026, 2, 31));
    assert.ok(out.every((i) => i.start.getHours() === 9));
  });

  test('occurrence that started before the range but still runs is included', () => {
    const out = expand(ev(new Date(2026, 10, 1, 22), 240, { freq: 'daily' }), new Date(2026, 10, 3), new Date(2026, 10, 4));
    assert.deepEqual(days(out), ['2026-11-02', '2026-11-03']);
  });

  test('exdates skip, keys are unique per day, unknown freq acts like a single event', () => {
    const out = expand(ev(new Date(2026, 10, 2, 9), 15, { freq: 'daily' }, { exdates: ['2026-11-03'] }), new Date(2026, 10, 2), new Date(2026, 10, 5));
    assert.deepEqual(out.map((i) => i.key), ['e@2026-11-02', 'e@2026-11-04']);
    assert.equal(expand(ev(new Date(2026, 10, 2, 9), 15, { freq: 'minutely' }), new Date(2026, 10, 1), new Date(2026, 10, 30)).length, 1);
  });

  test('describeRule', () => {
    const t = getStrings('en');
    assert.equal(describeRule({ freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }, t), 'Every weekday');
    assert.equal(describeRule({ freq: 'monthly' }, t), 'Every month');
    assert.equal(describeRule(null, t), '');
  });
});

describe('ics', () => {
  test('long lines are folded at 75 octets and unfolded again', () => {
    const title = 'A very long title '.repeat(10).trim();
    const ics = toICS([{ id: 'x', title, start: new Date(2026, 0, 1, 9), end: new Date(2026, 0, 1, 10) }]);
    assert.ok(ics.split('\r\n').every((l) => l.length <= 75));
    assert.equal(fromICS(ics)[0].title, title);
  });

  test('CRLF line endings, calendar name escaped', () => {
    const ics = toICS([], { name: 'Team; Q4' });
    assert.ok(ics.includes('\r\n'));
    assert.match(ics, /X-WR-CALNAME:Team\\; Q4/);
  });

  test('parses UTC, floating local and date values', () => {
    const [a, b, c] = fromICS(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:a
DTSTART:20261109T090000Z
DTEND:20261109T100000Z
SUMMARY:UTC
END:VEVENT
BEGIN:VEVENT
UID:b
DTSTART;TZID=Europe/Warsaw:20261109T090000
SUMMARY:Local
END:VEVENT
BEGIN:VEVENT
UID:c
DTSTART;VALUE=DATE:20261112
SUMMARY:Day
END:VEVENT
END:VCALENDAR`);
    assert.equal(a.start.toISOString(), '2026-11-09T09:00:00.000Z');
    assert.equal(b.start.getHours(), 9);
    assert.equal(b.end - b.start, 3600000, 'missing DTEND = 1 hour');
    assert.equal(c.allDay, true);
    assert.equal(D.ymd(c.end), '2026-11-13', 'missing all-day DTEND = next day');
  });

  test('RRULE with UNTIL, COUNT, INTERVAL, BYDAY and comma separated EXDATE', () => {
    const [e] = fromICS(`BEGIN:VEVENT
UID:r
DTSTART:20261102T090000
RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=10;UNTIL=20270101;BYDAY=MO,WE
EXDATE:20261104T090000,20261116T090000
END:VEVENT`);
    assert.deepEqual({ ...e.rrule, until: D.ymd(e.rrule.until) }, { freq: 'weekly', interval: 2, count: 10, until: '2027-01-01', byweekday: [1, 3] });
    assert.deepEqual(e.exdates, ['2026-11-04', '2026-11-16']);
  });

  test('unsupported repeat rules and events without a start are dropped safely', () => {
    const list = fromICS(`BEGIN:VEVENT
UID:h
DTSTART:20261102T090000
RRULE:FREQ=MINUTELY
END:VEVENT
BEGIN:VEVENT
SUMMARY:no start
END:VEVENT
garbage line
BEGIN:VEVENT
UID:bad
DTSTART:not-a-date
END:VEVENT`);
    assert.equal(list.length, 1);
    assert.equal(list[0].rrule, undefined);
  });

  test('round trip keeps location, notes, color and calendar', () => {
    const src = { id: 'k', title: 'K', start: new Date(2026, 10, 9, 9), end: new Date(2026, 10, 9, 10), location: 'Room, 2', notes: 'line 1\nline 2', color: '#db2777', calendar: 'work' };
    const [back] = fromICS(toICS([src]));
    for (const k of ['id', 'location', 'notes', 'color', 'calendar']) assert.equal(back[k], src[k], k);
  });

  test('all-day exdates are written as dates', () => {
    const ics = toICS([{ id: 'd', title: 'D', allDay: true, start: new Date(2026, 10, 2), end: new Date(2026, 10, 3), rrule: { freq: 'daily' }, exdates: ['2026-11-04'] }]);
    assert.match(ics, /EXDATE;VALUE=DATE:20261104/);
  });
});

describe('advanced repeat rules', () => {
  test('monthly on the 2nd Tuesday', () => {
    const out = expand(ev(new Date(2026, 10, 10, 10), 60, { freq: 'monthly', byweekday: [2], bysetpos: 2 }), new Date(2026, 10, 1), new Date(2027, 3, 1));
    assert.deepEqual(days(out), ['2026-11-10', '2026-12-08', '2027-01-12', '2027-02-09', '2027-03-09']);
  });
  test('monthly on the last Friday', () => {
    const out = expand(ev(new Date(2026, 10, 27, 17), 60, { freq: 'monthly', byweekday: [5], bysetpos: -1 }), new Date(2026, 10, 1), new Date(2027, 2, 1));
    assert.deepEqual(days(out), ['2026-11-27', '2026-12-25', '2027-01-29', '2027-02-26']);
  });
  test('monthly on several days, including the last day of the month', () => {
    const out = expand(ev(new Date(2026, 0, 1, 9), 30, { freq: 'monthly', bymonthday: [1, 15, -1] }), new Date(2026, 1, 1), new Date(2026, 2, 1));
    assert.deepEqual(days(out), ['2026-02-01', '2026-02-15', '2026-02-28']);
  });
  test('monthly every weekday listed (all Mondays and Wednesdays)', () => {
    const out = expand(ev(new Date(2026, 10, 2, 9), 30, { freq: 'monthly', byweekday: [1, 3] }), new Date(2026, 10, 1), new Date(2026, 11, 1));
    assert.equal(out.length, 9);
  });
  test('yearly in chosen months on a chosen weekday (US Thanksgiving: 4th Thursday of November)', () => {
    const out = expand(ev(new Date(2026, 10, 26, 12), 240, { freq: 'yearly', bymonth: [11], byweekday: [4], bysetpos: 4 }), new Date(2026, 0, 1), new Date(2029, 0, 1));
    assert.deepEqual(days(out), ['2026-11-26', '2027-11-25', '2028-11-23']);
  });
  test('bymonth limits a daily rule to some months', () => {
    const out = expand(ev(new Date(2026, 11, 30, 8), 30, { freq: 'daily', bymonth: [1] }), new Date(2026, 11, 1), new Date(2027, 1, 1));
    assert.equal(out.length, 31);
    assert.equal(days(out)[0], '2027-01-01');
  });
  test('count counts in order with several days per month', () => {
    const out = expand(ev(new Date(2026, 10, 1, 9), 30, { freq: 'monthly', bymonthday: [1, 15], count: 3 }), new Date(2026, 10, 1), new Date(2027, 6, 1));
    assert.deepEqual(days(out), ['2026-11-01', '2026-11-15', '2026-12-01']);
  });
  test('hourly with interval and unique keys', () => {
    const out = expand(ev(new Date(2026, 10, 9, 8), 15, { freq: 'hourly', interval: 2 }), new Date(2026, 10, 9), new Date(2026, 10, 9, 15));
    assert.deepEqual(out.map((i) => i.start.getHours()), [8, 10, 12, 14]);
    assert.equal(new Set(out.map((i) => i.key)).size, 4);
  });
  test('descriptions', () => {
    const t = getStrings('en');
    assert.equal(describeRule({ freq: 'monthly', byweekday: [2], bysetpos: 2 }, t), 'Monthly on the 2nd Tuesday');
    assert.equal(describeRule({ freq: 'monthly', byweekday: [5], bysetpos: -1 }, t), 'Monthly on the last Friday');
    assert.equal(describeRule({ freq: 'monthly', bymonthday: [15] }, t), 'Monthly on day 15');
    assert.equal(describeRule({ freq: 'weekly', interval: 2 }, t), 'Every 2 weeks');
    assert.equal(describeRule({ freq: 'hourly' }, t), 'Every hour');
    assert.match(describeRule({ freq: 'monthly', byweekday: [2], bysetpos: 2 }, getStrings('pl'), 'pl'), /drugi wtorek/);
  });
  test('ics round trip of BYDAY=2TU, BYMONTHDAY, BYMONTH and HOURLY', () => {
    const src = [
      { id: 'n', title: 'Board', start: new Date(2026, 10, 10, 10), end: new Date(2026, 10, 10, 11), rrule: { freq: 'monthly', byweekday: [2], bysetpos: 2 } },
      { id: 'd', title: 'Rent', start: new Date(2026, 10, 1, 9), end: new Date(2026, 10, 1, 10), rrule: { freq: 'monthly', bymonthday: [1, -1] } },
      { id: 'y', title: 'Thanks', start: new Date(2026, 10, 26, 12), end: new Date(2026, 10, 26, 16), rrule: { freq: 'yearly', bymonth: [11], byweekday: [4], bysetpos: 4 } },
      { id: 'h', title: 'Ping', start: new Date(2026, 10, 9, 8), end: new Date(2026, 10, 9, 8, 5), rrule: { freq: 'hourly', interval: 3 } },
    ];
    const ics = toICS(src);
    assert.match(ics, /RRULE:FREQ=MONTHLY;BYDAY=2TU/);
    assert.match(ics, /BYMONTHDAY=1,-1/);
    assert.match(ics, /RRULE:FREQ=YEARLY;BYDAY=4TH;BYMONTH=11/);
    const back = fromICS(ics);
    assert.deepEqual(back[0].rrule, { freq: 'monthly', byweekday: [2], bysetpos: 2 });
    assert.deepEqual(back[1].rrule, { freq: 'monthly', bymonthday: [1, -1] });
    assert.deepEqual(back[2].rrule, { freq: 'yearly', byweekday: [4], bysetpos: 4, bymonth: [11] });
    assert.deepEqual(back[3].rrule, { freq: 'hourly', interval: 3 });
    assert.match(toICS([{ ...src[0], rrule: { freq: 'monthly', byweekday: [1, 3], bysetpos: [1, -1] } }]), /BYDAY=MO,WE;BYSETPOS=1,-1/);
  });
});
