import { addDays, startOfDay, startOfWeek, ymd, toDate, DAY_MS } from './date.js';

const LIMIT = 5000;
const HOUR = 3600000;

function instance(ev, s, e) {
  return { ...ev, start: s, end: e, key: ev.rrule ? `${ev.id}@${ymd(s)}${ev.rrule.freq === 'hourly' ? `T${s.getHours()}${s.getMinutes()}` : ''}` : String(ev.id), recurring: !!ev.rrule };
}

/**
 * Days of one month that match the rule, sorted.
 * - byweekday + bysetpos: "2nd Tuesday" ({ byweekday: [2], bysetpos: 2 }), "last Friday" (bysetpos: -1)
 * - byweekday alone: every such weekday in the month
 * - bymonthday: [1, 15, -1] (negative counts from the end)
 * - nothing: the day of the month of the first occurrence
 */
function monthDays(y, m, r, s0) {
  const last = new Date(y, m + 1, 0).getDate();
  let days;
  if (r.byweekday && r.byweekday.length && r.freq !== 'weekly') {
    days = [];
    for (let d = 1; d <= last; d++) if (r.byweekday.includes(new Date(y, m, d).getDay())) days.push(d);
    if (r.bysetpos) {
      const pos = [].concat(r.bysetpos);
      days = pos.map((p) => (p > 0 ? days[p - 1] : days[days.length + p])).filter(Boolean);
    }
  } else if (r.bymonthday && [].concat(r.bymonthday).length) {
    days = [].concat(r.bymonthday).map((d) => (d < 0 ? last + d + 1 : d)).filter((d) => d >= 1 && d <= last);
  } else {
    days = s0.getDate() <= last ? [s0.getDate()] : [];
  }
  return [...new Set(days)].sort((a, b) => a - b);
}

/**
 * Expands one event into the instances that overlap [rs, re).
 * rrule: { freq: 'hourly'|'daily'|'weekly'|'monthly'|'yearly', interval?, count?, until?,
 *          byweekday?: number[], bymonthday?: number[], bysetpos?: number|number[], bymonth?: number[] (1–12) }
 */
export function expand(ev, rs, re) {
  const r = ev.rrule;
  if (!r) return ev.start < re && ev.end > rs ? [instance(ev, ev.start, ev.end)] : [];
  const out = [];
  const interval = Math.max(1, r.interval | 0 || 1);
  const dur = ev.end - ev.start;
  const until = r.until ? toDate(r.until) : null;
  if (until && !(r.until instanceof Date) && /^\d{4}-\d{2}-\d{2}$/.test(r.until)) until.setHours(23, 59, 59);
  const count = r.count > 0 ? r.count : Infinity;
  const ex = new Set(ev.exdates || []);
  const months = r.bymonth && r.bymonth.length ? r.bymonth.map((m) => m - 1) : null;
  const s0 = ev.start;
  const at = (day) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), s0.getHours(), s0.getMinutes(), s0.getSeconds());
  let n = 0;
  // returns false when iteration should stop
  const emit = (s) => {
    if (s < s0) return true;
    if (months && !months.includes(s.getMonth())) return true;
    n++;
    if (n > count || (until && s > until) || s >= re) return false;
    const e = new Date(s.getTime() + dur);
    if (e > rs && !ex.has(ymd(s))) out.push(instance(ev, s, e));
    return true;
  };
  const canSkip = count === Infinity && !months;

  if (r.freq === 'hourly') {
    let i = 0;
    if (canSkip && rs > s0) i = Math.max(0, Math.floor((rs - s0 - dur) / (HOUR * interval)) - 1);
    for (let k = 0; k < LIMIT * 4; k++, i++) if (!emit(new Date(s0.getTime() + i * interval * HOUR))) break;
  } else if (r.freq === 'daily') {
    let i = 0;
    if (canSkip && rs > s0) i = Math.max(0, Math.floor((rs - s0 - dur) / (DAY_MS * interval)) - 1);
    for (let k = 0; k < LIMIT; k++, i++) if (!emit(at(addDays(s0, i * interval)))) break;
  } else if (r.freq === 'weekly') {
    const days = (r.byweekday && r.byweekday.length ? [...r.byweekday] : [s0.getDay()]).sort((a, b) => a - b);
    const ws = startOfWeek(s0, 0);
    let w = 0;
    if (canSkip && rs > s0) w = Math.max(0, Math.floor((rs - s0 - dur) / (DAY_MS * 7 * interval)) - 1);
    outer: for (let k = 0; k < LIMIT; k++, w++) {
      const base = addDays(ws, w * 7 * interval);
      for (const wd of days) {
        const day = addDays(base, wd);
        if (day < startOfDay(s0)) continue;
        if (!emit(at(day))) break outer;
      }
    }
  } else if (r.freq === 'monthly') {
    outer: for (let i = 0; i < LIMIT; i++) {
      const y = s0.getFullYear(), m = s0.getMonth() + i * interval;
      const first = new Date(y, m, 1);
      if (first > re) break;
      for (const d of monthDays(first.getFullYear(), first.getMonth(), r, s0)) {
        if (!emit(at(new Date(first.getFullYear(), first.getMonth(), d)))) break outer;
      }
    }
  } else if (r.freq === 'yearly') {
    const inYear = months || [s0.getMonth()];
    const simple = !r.byweekday && !r.bymonthday;
    outer: for (let i = 0; i < LIMIT; i++) {
      const y = s0.getFullYear() + i * interval;
      if (new Date(y, 0, 1) > re) break;
      for (const m of [...inYear].sort((a, b) => a - b)) {
        const days = simple ? (new Date(y, m, s0.getDate()).getMonth() === m ? [s0.getDate()] : []) : monthDays(y, m, r, s0);
        for (const d of days) if (!emit(at(new Date(y, m, d)))) break outer;
      }
    }
  } else if (ev.start < re && ev.end > rs) {
    out.push(instance(ev, ev.start, ev.end));
  }
  return out;
}

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];
const ORD_PL = ['', 'pierwszy', 'drugi', 'trzeci', 'czwarty', 'piąty'];
/** Nth weekday of the month for a date: { pos: 1..5, last: boolean } */
export function weekdayPosition(d) {
  const pos = Math.ceil(d.getDate() / 7);
  const last = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { pos, last };
}

export function describeRule(r, t, locale = 'en') {
  if (!r) return '';
  const pl = /^pl/i.test(locale) || t.today === 'Dziś';
  const wd = (d) => new Intl.DateTimeFormat(pl ? 'pl' : 'en', { weekday: 'long' }).format(new Date(2026, 10, 1 + d));
  const every = r.interval > 1 ? (pl ? `Co ${r.interval} ` : `Every ${r.interval} `) : '';
  if (r.freq === 'hourly') return r.interval > 1 ? (pl ? `Co ${r.interval} godz.` : `Every ${r.interval} hours`) : t.rHourly;
  if (r.freq === 'weekly' && r.byweekday && r.byweekday.join() === '1,2,3,4,5' && !every) return t.rWeekdays;
  if (r.freq === 'monthly' && r.byweekday && r.byweekday.length === 1 && r.bysetpos != null) {
    const p = [].concat(r.bysetpos)[0];
    const pos = p === -1 ? (pl ? 'ostatni' : 'last') : (pl ? ORD_PL[p] : ORD[p]) || `${p}.`;
    return pl ? `Co miesiąc: ${pos} ${wd(r.byweekday[0])}` : `Monthly on the ${pos} ${wd(r.byweekday[0])}`;
  }
  if (r.freq === 'monthly' && r.bymonthday) {
    const list = [].concat(r.bymonthday).map((d) => (d === -1 ? (pl ? 'ostatni dzień' : 'last day') : d)).join(', ');
    return pl ? `Co miesiąc, dnia ${list}` : `Monthly on day ${list}`;
  }
  if (every) {
    const unit = { daily: pl ? 'dni' : 'days', weekly: pl ? 'tyg.' : 'weeks', monthly: pl ? 'mies.' : 'months', yearly: pl ? 'lata' : 'years' }[r.freq];
    return `${every}${unit}`;
  }
  return { daily: t.rDaily, weekly: t.rWeekly, monthly: t.rMonthly, yearly: t.rYearly }[r.freq] || '';
}
