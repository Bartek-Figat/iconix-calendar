// DOM-free helpers shared by the calendar, the CLI and the tests.
import * as D from './date.js';
import { expand } from './recur.js';

let uidN = 0;
export const uid = () => `ev-${Date.now().toString(36)}-${(uidN++).toString(36)}`;

/** Turns user input (strings, missing ends, date-only values) into a clean event with Date fields. */
export function normalizeEvent(e, { defaultDuration = 60 } = {}) {
  const start = D.toDate(e.start);
  if (isNaN(start)) throw new TypeError(`Invalid start for event ${JSON.stringify(e.title ?? e.id ?? '')}`);
  const allDay = e.allDay ?? D.isDateOnly(e.start);
  let end = e.end != null ? D.toDate(e.end) : null;
  let s = start;
  if (allDay) {
    s = D.startOfDay(start);
    end = end ? D.startOfDay(end) : D.addDays(s, 1);
    if (end <= s) end = D.addDays(s, 1);
  } else if (!end || isNaN(end) || end <= start) {
    end = D.addMinutes(start, defaultDuration);
  }
  const out = { ...e, id: e.id != null ? e.id : uid(), title: e.title ?? '', start: s, end, allDay: !!allDay };
  out.rrule = e.rrule ? { ...e.rrule, byweekday: e.rrule.byweekday ? [...e.rrule.byweekday] : undefined } : null;
  out.exdates = e.exdates ? [...e.exdates] : [];
  delete out.key; delete out.recurring;
  return out;
}

/** Every occurrence of every event that overlaps [start, end), sorted by start. */
export function occurrences(events, start, end) {
  return events.flatMap((e) => expand(e, start, end)).sort((a, b) => a.start - b.start || b.end - a.end);
}

/**
 * First gap of `duration` minutes inside working hours, starting at `from`.
 * `events` must be normalized. All-day events do not block time.
 */
export function findFreeSlot(events, {
  duration = 30, from = new Date(), days = 14,
  hours = { start: 9, end: 17, days: [1, 2, 3, 4, 5] }, step = 15,
} = {}) {
  const stepMs = step * D.MIN;
  let day = D.startOfDay(from);
  for (let k = 0; k < days; k++, day = D.addDays(day, 1)) {
    const h = hours || { start: 0, end: 24 };
    if (h.days && !h.days.includes(day.getDay())) continue;
    let a = D.atMinutes(day, h.start * 60);
    const b = D.atMinutes(day, h.end * 60);
    if (a < from) a = new Date(Math.ceil(from.getTime() / stepMs) * stepMs);
    if (a >= b) continue;
    const busy = occurrences(events, day, D.addDays(day, 1)).filter((i) => !i.allDay && i.display !== 'background');
    let cur = a;
    for (const i of busy) {
      if (i.end <= cur) continue;
      if (i.start - cur >= duration * D.MIN) break;
      cur = new Date(Math.max(cur, i.end));
      if (cur >= b) break;
    }
    if (b - cur >= duration * D.MIN) return { start: cur, end: D.addMinutes(cur, duration) };
  }
  return null;
}

/** Pairs of overlapping timed events that share a resource (or both have none). */
export function findClashes(events, start, end) {
  const list = occurrences(events, start, end).filter((i) => !i.allDay && i.end - i.start < D.DAY_MS && i.display !== 'background');
  const byRes = new Map();
  for (const i of list) {
    const k = i.resourceId == null ? '' : String(i.resourceId);
    if (!byRes.has(k)) byRes.set(k, []);
    byRes.get(k).push(i);
  }
  const pairs = [];
  for (const arr of byRes.values()) {
    let active = [];
    for (const i of arr) {
      active = active.filter((a) => a.end > i.start);
      for (const a of active) pairs.push([a, i]);
      active.push(i);
    }
  }
  return pairs;
}
