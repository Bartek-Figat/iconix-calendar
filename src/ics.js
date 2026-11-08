// iCalendar (RFC 5545) export / import, covering the fields the calendar uses.
import { ymd, pad, addDays } from './date.js';

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
const unesc = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateVal = (d) => ymd(d).replace(/-/g, '');

function fold(line) {
  const out = [];
  while (line.length > 74) { out.push(line.slice(0, 74)); line = ' ' + line.slice(74); }
  out.push(line);
  return out.join('\r\n');
}

export function toICS(events, { name = 'Calendar', prodId = '-//iconix//calendar//EN' } = {}) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${prodId}`, 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`];
  const stamp = utc(new Date());
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${esc(e.id)}@iconix-calendar`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      L.push(`DTSTART;VALUE=DATE:${dateVal(e.start)}`, `DTEND;VALUE=DATE:${dateVal(e.end)}`);
    } else {
      L.push(`DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end)}`);
    }
    L.push(`SUMMARY:${esc(e.title || '')}`);
    if (e.location) L.push(`LOCATION:${esc(e.location)}`);
    if (e.notes) L.push(`DESCRIPTION:${esc(e.notes)}`);
    if (e.calendar) L.push(`CATEGORIES:${esc(e.calendar)}`);
    if (e.color) L.push(`COLOR:${esc(e.color)}`);
    if (e.rrule) {
      const r = e.rrule;
      const parts = [`FREQ=${r.freq.toUpperCase()}`];
      if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`);
      if (r.count) parts.push(`COUNT=${r.count}`);
      if (r.until) parts.push(`UNTIL=${dateVal(new Date(r.until))}`);
      if (r.byweekday && r.byweekday.length) {
        // a single bysetpos with one weekday is written the common way: BYDAY=2TU / -1FR
        const one = r.bysetpos != null && [].concat(r.bysetpos).length === 1 && r.byweekday.length === 1;
        parts.push(`BYDAY=${r.byweekday.map((d) => (one ? [].concat(r.bysetpos)[0] : '') + DAYS[d]).join(',')}`);
        if (r.bysetpos != null && !one) parts.push(`BYSETPOS=${[].concat(r.bysetpos).join(',')}`);
      }
      if (r.bymonthday) parts.push(`BYMONTHDAY=${[].concat(r.bymonthday).join(',')}`);
      if (r.bymonth) parts.push(`BYMONTH=${[].concat(r.bymonth).join(',')}`);
      L.push(`RRULE:${parts.join(';')}`);
      for (const x of e.exdates || []) {
        const d = new Date(x.slice(0, 4), x.slice(5, 7) - 1, x.slice(8, 10), e.start.getHours(), e.start.getMinutes());
        L.push(e.allDay ? `EXDATE;VALUE=DATE:${x.replace(/-/g, '')}` : `EXDATE:${utc(d)}`);
      }
    }
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

function parseDT(v) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h == null) return { date: new Date(+y, mo - 1, +d), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, mo - 1, +d, +h, +mi, +(s || 0))), allDay: false };
  return { date: new Date(+y, mo - 1, +d, +h, +mi, +(s || 0)), allDay: false };
}

export function fromICS(text) {
  const lines = String(text).replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const raw of lines) {
    if (!raw) continue;
    if (raw === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (raw === 'END:VEVENT') {
      if (cur && cur.start) {
        if (!cur.end) cur.end = cur.allDay ? addDays(cur.start, 1) : new Date(cur.start.getTime() + 3600000);
        events.push(cur);
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = raw.indexOf(':');
    if (i < 0) continue;
    const key = raw.slice(0, i).split(';')[0].toUpperCase();
    const val = raw.slice(i + 1);
    switch (key) {
      case 'UID': cur.id = unesc(val).replace(/@iconix-calendar$/, ''); break;
      case 'SUMMARY': cur.title = unesc(val); break;
      case 'LOCATION': cur.location = unesc(val); break;
      case 'DESCRIPTION': cur.notes = unesc(val); break;
      case 'CATEGORIES': cur.calendar = unesc(val).split(',')[0]; break;
      case 'COLOR': cur.color = unesc(val); break;
      case 'DTSTART': { const p = parseDT(val); if (p) { cur.start = p.date; cur.allDay = p.allDay; } break; }
      case 'DTEND': { const p = parseDT(val); if (p) cur.end = p.date; break; }
      case 'EXDATE': {
        cur.exdates = cur.exdates || [];
        for (const v of val.split(',')) { const p = parseDT(v); if (p) cur.exdates.push(ymd(p.date)); }
        break;
      }
      case 'RRULE': {
        const r = {};
        for (const part of val.split(';')) {
          const [k, v] = part.split('=');
          if (k === 'FREQ') r.freq = v.toLowerCase();
          else if (k === 'INTERVAL') r.interval = +v;
          else if (k === 'COUNT') r.count = +v;
          else if (k === 'UNTIL') { const p = parseDT(v); if (p) r.until = p.date; }
          else if (k === 'BYDAY') {
            const items = v.split(',');
            r.byweekday = items.map((d) => DAYS.indexOf(d.slice(-2))).filter((d) => d >= 0);
            const pos = items.map((d) => d.slice(0, -2)).filter(Boolean).map(Number);
            if (pos.length) r.bysetpos = pos.length === 1 ? pos[0] : pos;
          } else if (k === 'BYSETPOS') r.bysetpos = v.split(',').map(Number).length === 1 ? +v : v.split(',').map(Number);
          else if (k === 'BYMONTHDAY') r.bymonthday = v.split(',').map(Number);
          else if (k === 'BYMONTH') r.bymonth = v.split(',').map(Number);
        }
        if (['hourly', 'daily', 'weekly', 'monthly', 'yearly'].includes(r.freq)) cur.rrule = r;
        break;
      }
    }
  }
  return events;
}

export const pad2 = pad;
