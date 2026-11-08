// Date helpers. Everything works in the viewer's local time zone.
export const MIN = 60000;
export const DAY_MS = 86400000;

export const pad = (n) => String(n).padStart(2, '0');

export function toDate(v) {
  if (v instanceof Date) return new Date(v.getTime());
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(v);
}
export const isDateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => { const r = new Date(d.getTime()); r.setDate(r.getDate() + n); return r; };
export const addMinutes = (d, n) => new Date(d.getTime() + n * MIN);
export const daysInMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export function addMonths(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
  r.setDate(Math.min(d.getDate(), daysInMonth(r)));
  return r;
}
export function startOfWeek(d, firstDay = 1) {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() - firstDay + 7) % 7));
}
export const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
/** Calendar day number, immune to DST. */
export const dayIndex = (d) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
export const diffDays = (a, b) => dayIndex(b) - dayIndex(a);
export const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();
export function atMinutes(day, min) {
  const r = startOfDay(day);
  r.setHours(0, min, 0, 0);
  return r;
}
/** ISO 8601 week number (weeks start on Monday, week 1 contains 4 January). */
export function weekNumber(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / DAY_MS + 1) / 7);
}
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const overlaps = (aS, aE, bS, bE) => aS < bE && bS < aE;
export const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

const cache = new Map();
export function fmt(d, locale, opts) {
  const k = locale + JSON.stringify(opts);
  let f = cache.get(k);
  if (!f) { f = new Intl.DateTimeFormat(locale, opts); cache.set(k, f); }
  return f.format(d);
}
export function fmtRange(a, b, locale, opts) {
  const k = 'r' + locale + JSON.stringify(opts);
  let f = cache.get(k);
  if (!f) { f = new Intl.DateTimeFormat(locale, opts); cache.set(k, f); }
  return f.formatRange ? f.formatRange(a, b) : `${f.format(a)} – ${f.format(b)}`;
}
export function uses12h(locale) {
  try { return !!new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12; } catch { return false; }
}
export function timeStr(d, locale) {
  if (uses12h(locale)) {
    return fmt(d, locale, d.getMinutes() ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' })
      .replace(/\s?([AP])\.?M\.?/i, (_, p) => p.toLowerCase() + 'm');
  }
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function hourLabel(h, locale) {
  if (uses12h(locale)) {
    const hh = h % 24;
    return hh === 0 ? '12am' : hh === 12 ? '12pm' : hh < 12 ? `${hh}am` : `${hh - 12}pm`;
  }
  return `${pad(h % 24)}:00`;
}
export const toInput = (d, allDay) => (allDay ? ymd(d) : `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
export function fromInput(v) {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return toDate(v);
  const [date, time] = v.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, mi);
}
