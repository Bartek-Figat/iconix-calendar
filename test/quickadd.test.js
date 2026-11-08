import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuickAdd } from '../src/quickadd.js';
import * as D from '../src/date.js';

// Sunday 8 November 2026, 10:20
const now = new Date(2026, 10, 8, 10, 20);
const calendars = [{ id: 'work', name: 'Work' }, { id: 'home', name: 'Personal' }];
const resources = [{ id: 'atlas', title: 'Atlas room' }, { id: 'anna', title: 'Anna Kowalska' }];
const P = (text, o = {}) => parseQuickAdd(text, { now, calendars, resources, ...o });
const hm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// [input, title, date (yyyy-mm-dd), start hh:mm | 'all', end hh:mm | null]
const CASES = [
  ['Lunch tomorrow 1pm', 'Lunch', '2026-11-09', '13:00', '14:00'],
  ['Call at 9', 'Call', '2026-11-08', '09:00', '10:00'],
  ['Review 14:30', 'Review', '2026-11-08', '14:30', '15:30'],
  ['Sync 9-10', 'Sync', '2026-11-08', '09:00', '10:00'],
  ['Sync 9:30–11', 'Sync', '2026-11-08', '09:30', '11:00'],
  ['Workshop 1pm to 3pm', 'Workshop', '2026-11-08', '13:00', '15:00'],
  ['Late 11pm-1am', 'Late', '2026-11-08', '23:00', '01:00'],
  ['Focus 2-4pm', 'Focus', '2026-11-08', '14:00', '16:00'],
  ['Meeting monday 10am for 30 min', 'Meeting', '2026-11-09', '10:00', '10:30'],
  ['Talk friday 15:00 for 1.5h', 'Talk', '2026-11-13', '15:00', '16:30'],
  ['Talk fri 15:00 2h30', 'Talk', '2026-11-13', '15:00', '17:30'],
  ['Brunch sunday 11', 'Brunch 11', '2026-11-08', 'all', null],
  ['Brunch next sunday at 11', 'Brunch', '2026-11-15', '11:00', '12:00'],
  ['Party on saturday at 8pm', 'Party', '2026-11-14', '20:00', '21:00'],
  ['Dinner 2026-12-24 18:00', 'Dinner', '2026-12-24', '18:00', '19:00'],
  ['Trip 20.11', 'Trip', '2026-11-20', 'all', null],
  ['Trip 20.11.2027', 'Trip', '2027-11-20', 'all', null],
  ['Old 1.1', 'Old', '2027-01-01', 'all', null],
  ['Gala 12 dec', 'Gala', '2026-12-12', 'all', null],
  ['Gala dec 12th 7pm', 'Gala', '2026-12-12', '19:00', '20:00'],
  ['Concert March 3', 'Concert', '2027-03-03', 'all', null],
  ['Holiday today all day', 'Holiday', '2026-11-08', 'all', null],
  ['Dentist in 3 days at 8', 'Dentist', '2026-11-11', '08:00', '09:00'],
  ['Review in 2 weeks', 'Review', '2026-11-22', 'all', null],
  ['Plan next week', 'Plan', '2026-11-09', 'all', null],
  ['Lunch at noon', 'Lunch', '2026-11-08', '12:00', '13:00'],
  ['Day after tomorrow 7am run', 'run', '2026-11-10', '07:00', '08:00'],
  // Polish
  ['Spotkanie jutro o 14', 'Spotkanie', '2026-11-09', '14:00', '15:00'],
  ['Dentysta w piątek o 16:30', 'Dentysta', '2026-11-13', '16:30', '17:30'],
  ['Kino pojutrze 19-21', 'Kino', '2026-11-10', '19:00', '21:00'],
  ['Basen w środę o 7 przez 45 min', 'Basen', '2026-11-11', '07:00', '07:45'],
  ['Urlop 24 grudnia', 'Urlop', '2026-12-24', 'all', null],
  ['Wigilia 24.12 cały dzień', 'Wigilia', '2026-12-24', 'all', null],
  ['Konferencja za 2 tygodnie', 'Konferencja', '2026-11-22', 'all', null],
  ['Lunch dziś o 13 do 14', 'Lunch', '2026-11-08', '13:00', '14:00'],
  ['Spacer w przyszły poniedziałek', 'Spacer', '2026-11-09', 'all', null], // said on a Sunday: tomorrow
  ['Obiad w południe', 'Obiad', '2026-11-08', '12:00', '13:00'],
];

describe('quick add: dates and times', () => {
  for (const [input, title, date, start, end] of CASES) {
    test(input, () => {
      const p = P(input);
      assert.equal(p.title, title, 'title');
      assert.equal(D.ymd(p.start), date, 'date');
      if (start === 'all') { assert.equal(p.allDay, true, 'all day'); assert.equal(D.diffDays(p.start, p.end), 1); }
      else { assert.equal(p.allDay, false); assert.equal(hm(p.start), start, 'start'); assert.equal(hm(p.end), end, 'end'); }
    });
  }
});

describe('quick add: recurrence', () => {
  const R = [
    ['Standup every weekday 9:00', { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }],
    ['Gym every monday 18:00', { freq: 'weekly', byweekday: [1] }],
    ['Water plants daily', { freq: 'daily' }],
    ['Report weekly friday', { freq: 'weekly' }],
    ['Rent monthly 1.12', { freq: 'monthly' }],
    ['Birthday 3 may yearly', { freq: 'yearly' }],
    ['Joga co tydzień', { freq: 'weekly' }],
    ['Leki codziennie o 8', { freq: 'daily' }],
    ['Trening w każdy czwartek o 19', { freq: 'weekly', byweekday: [4] }],
    ['Raport w dni robocze o 9', { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }],
  ];
  for (const [input, rule] of R) test(input, () => assert.deepEqual(P(input).rrule, rule));

  test('"every <weekday>" also sets the first date', () => {
    const p = P('Gym every wednesday 18:00');
    assert.equal(D.ymd(p.start), '2026-11-11');
  });
});

describe('quick add: tags, mentions and tokens', () => {
  test('#calendar by id or name prefix, @resource by id or word', () => {
    assert.equal(P('A #work').calendar, 'work');
    assert.equal(P('A #pers').calendar, 'home');
    assert.equal(P('A @atlas').resourceId, 'atlas');
    assert.equal(P('A @anna').resourceId, 'anna');
    assert.equal(P('A @kowal').resourceId, 'anna');
  });
  test('unknown tags stay in the title when calendars are configured', () => {
    const p = P('Fix #123 bug');
    assert.equal(p.title, 'Fix #123 bug');
    assert.equal(p.calendar, undefined);
  });
  test('without configured calendars any #tag becomes the calendar id', () => {
    assert.equal(parseQuickAdd('A #side-project', { now }).calendar, 'side-project');
  });
  test('emails and unknown mentions are left alone', () => {
    assert.equal(P('Mail ann@example.com').title, 'Mail ann@example.com');
    assert.equal(P('Ping @nobody').title, 'Ping @nobody');
  });
  test('tokens describe what was understood', () => {
    const types = P('Sync tomorrow 9-10 #work every monday').tokens.map((t) => t.type).sort();
    assert.deepEqual(types, ['calendar', 'date', 'repeat', 'time']);
  });
  test('slash dates follow the locale', () => {
    assert.equal(D.ymd(P('X 3/4', { locale: 'en-US' }).start), '2027-03-04');
    assert.equal(D.ymd(P('X 3/4', { locale: 'en-GB' }).start), '2027-04-03');
  });
  test('plain text goes to the next full hour, with the default duration', () => {
    const p = P('Call Jan', { defaultDuration: 30 });
    assert.equal(hm(p.start), '11:00');
    assert.equal(hm(p.end), '11:30');
  });
  test('invalid numbers are not treated as dates or times', () => {
    const p = P('Room 45.13 at 25');
    assert.equal(p.title, 'Room 45.13 at 25');
  });
  test('empty input is handled', () => {
    const p = P('');
    assert.equal(p.title, '');
    assert.deepEqual(p.tokens, []);
  });
});

describe('quick add: advanced repeats', () => {
  const R2 = [
    ['Board every 2nd tuesday 10:00', { freq: 'monthly', byweekday: [2], bysetpos: 2 }, '2026-11-10'],
    ['Rent every last friday of the month', { freq: 'monthly', byweekday: [5], bysetpos: -1 }, '2026-11-27'],
    ['Spotkanie w każdy drugi wtorek miesiąca o 10', { freq: 'monthly', byweekday: [2], bysetpos: 2 }, '2026-11-10'],
    ['Pay monthly on the 15th', { freq: 'monthly', bymonthday: [15] }, '2026-11-15'],
    ['Sync every 2 weeks monday 9:00', { freq: 'weekly', interval: 2 }, '2026-11-09'],
    ['Basen co 3 dni', { freq: 'daily', interval: 3 }, null],
    ['Ping every hour', { freq: 'hourly' }, null],
  ];
  for (const [input, rule, date] of R2) {
    test(input, () => {
      const p = P(input);
      assert.deepEqual(p.rrule, rule);
      if (date) assert.equal(D.ymd(p.start), date);
    });
  }
});
