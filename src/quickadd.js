// Natural-language quick add, English + Polish.
// "Lunch with Ann tomorrow 1pm-2pm #work @atlas every friday"  ->  event fields
import { addDays, addMinutes, atMinutes, startOfDay, MIN } from './date.js';

const WEEKDAYS = [
  ['sun', 'sunday', 'niedz', 'niedziela', 'niedzielę', 'niedziele'],
  ['mon', 'monday', 'pon', 'poniedziałek', 'poniedzialek'],
  ['tue', 'tues', 'tuesday', 'wt', 'wtorek'],
  ['wed', 'wednesday', 'śr', 'środa', 'środę', 'sroda', 'srode'],
  ['thu', 'thur', 'thurs', 'thursday', 'czw', 'czwartek'],
  ['fri', 'friday', 'pt', 'piątek', 'piatek'],
  ['sat', 'saturday', 'sob', 'sobota', 'sobotę', 'sobote'],
];
const MONTHS = [
  ['january', 'jan', 'styczeń', 'stycznia', 'sty'],
  ['february', 'feb', 'luty', 'lutego', 'lut'],
  ['march', 'mar', 'marzec', 'marca'],
  ['april', 'apr', 'kwiecień', 'kwietnia', 'kwi'],
  ['may', 'maj', 'maja'],
  ['june', 'jun', 'czerwiec', 'czerwca', 'cze'],
  ['july', 'jul', 'lipiec', 'lipca', 'lip'],
  ['august', 'aug', 'sierpień', 'sierpnia', 'sie'],
  ['september', 'sep', 'sept', 'wrzesień', 'września', 'wrz'],
  ['october', 'oct', 'październik', 'października', 'paź', 'paz'],
  ['november', 'nov', 'listopad', 'listopada', 'lis'],
  ['december', 'dec', 'grudzień', 'grudnia', 'gru'],
];
const wdOf = (w) => WEEKDAYS.findIndex((a) => a.includes(w.toLowerCase()));
const moOf = (w) => MONTHS.findIndex((a) => a.includes(w.toLowerCase()));
const WD_RE = WEEKDAYS.flat().sort((a, b) => b.length - a.length).join('|');
const L = '[\\p{L}]';

function hour(h, m, ap) {
  h = +h; m = +(m || 0);
  if (ap) { ap = ap.toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; }
  if (h > 24 || m > 59) return null;
  return h * 60 + m;
}

/**
 * @returns {{title:string,start:Date,end:Date,allDay:boolean,calendar?:string,resourceId?:string,rrule?:object,tokens:{type:string,text:string}[]}}
 */
export function parseQuickAdd(text, opts = {}) {
  const { now = new Date(), calendars = [], resources = [], defaultDuration = 60, locale = 'en' } = opts;
  const monthFirst = /^en-us/i.test(locale) || locale === 'en';
  let s = ` ${String(text || '')} `;
  const tokens = [];
  const out = { allDay: false };
  let date = null, startMin = null, endMin = null, dur = null, allDay = false, rrule = null;

  const take = (re, fn) => {
    s = s.replace(re, (...m) => {
      const r = fn(m);
      if (r === false) return m[0];
      tokens.push({ type: r.type, text: m[0].trim() });
      return ' ';
    });
  };
  const today = startOfDay(now);
  const nextWd = (wd, strict) => {
    let d = (wd - today.getDay() + 7) % 7;
    if (d === 0 && strict) d = 7;
    return addDays(today, d);
  };

  // #calendar
  take(/\s#([\p{L}\d_-]+)(?=\s)/giu, (m) => {
    const q = m[1].toLowerCase();
    // with no calendar list configured, any #tag is taken as the calendar id
    const c = !calendars.length ? { id: m[1] } : calendars.find((c) => String(c.id).toLowerCase() === q) ||
      calendars.find((c) => (c.name || '').toLowerCase().startsWith(q));
    if (!c) return false;
    out.calendar = c.id;
    return { type: 'calendar' };
  });
  // @resource
  take(/\s@([\p{L}][\p{L}\d_.-]*)(?=\s)/giu, (m) => {
    const q = m[1].toLowerCase();
    const r = resources.find((r) => String(r.id).toLowerCase() === q) ||
      resources.find((r) => (r.title || '').toLowerCase().split(/\s+/).some((w) => w.startsWith(q)));
    if (!r) return false;
    out.resourceId = r.id;
    return { type: 'resource' };
  });
  // recurrence
  take(new RegExp(`\\s(?:every|each|co|w\\s+każdy|w\\s+każdą|każdy|każdą|w\\s+kazdy)\\s+(${WD_RE})(?=\\s)`, 'giu'), (m) => {
    const wd = wdOf(m[1]);
    rrule = { freq: 'weekly', byweekday: [wd] };
    if (!date) date = nextWd(wd);
    return { type: 'repeat' };
  });
  // "every 2nd tuesday", "every last friday of the month", "w każdy drugi wtorek miesiąca", "co ostatni piątek"
  const NTH = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4, last: -1,
    pierwszy: 1, pierwszą: 1, drugi: 2, drugą: 2, trzeci: 3, trzecią: 3, czwarty: 4, czwartą: 4, ostatni: -1, ostatnią: -1 };
  take(new RegExp(`\\s(?:every|each|on\\s+the|co|w\\s+każdy|w\\s+każdą|każdy|każdą)\\s+(${Object.keys(NTH).join('|')})\\s+(${WD_RE})(?:\\s+(?:of\\s+(?:the|every)\\s+month|of\\s+each\\s+month|miesiąca|w\\s+miesiącu))?(?=\\s)`, 'giu'), (m) => {
    const wd = wdOf(m[2]); const pos = NTH[m[1].toLowerCase()];
    if (wd < 0 || !pos) return false;
    rrule = { freq: 'monthly', byweekday: [wd], bysetpos: pos };
    if (!date) {
      // first matching day from today on
      for (let k = 0; k < 400 && !date; k++) {
        const d = addDays(today, k);
        if (d.getDay() !== wd) continue;
        const nth = Math.ceil(d.getDate() / 7);
        const isLast = d.getDate() + 7 > new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        if ((pos > 0 && nth === pos) || (pos < 0 && isLast)) date = d;
      }
    }
    return { type: 'repeat' };
  });
  // "every 2 weeks", "every 3 days", "co 2 tygodnie", "co 3 dni"
  take(/\s(?:every|co)\s+(\d+)\s+(days?|weeks?|months?|years?|dni|dzień|tygodni[ea]?|tydzień|miesiące|miesięcy|miesiąc|lata|lat|rok)(?=\s)/giu, (m) => {
    const u = m[2].toLowerCase();
    const freq = /^(d|dn|dz)/.test(u) ? 'daily' : /^(w|t)/.test(u) ? 'weekly' : /^m/.test(u) ? 'monthly' : 'yearly';
    rrule = { freq, interval: +m[1] };
    return { type: 'repeat' };
  });
  // "monthly on the 15th", "every month on the 1st", "co miesiąc 15."
  take(/\s(?:monthly|every\s+month)\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?=\s)/giu, (m) => {
    rrule = { freq: 'monthly', bymonthday: [+m[1]] };
    let d = new Date(today.getFullYear(), today.getMonth(), +m[1]);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, +m[1]);
    if (!date) date = d;
    return { type: 'repeat' };
  });
  take(/\s(?:hourly|every\s+hour|co\s+godzinę|co\s+godzine)(?=\s)/giu, () => { rrule = { freq: 'hourly' }; return { type: 'repeat' }; });
  take(/\s(?:every\s+weekday|weekdays|w\s+dni\s+robocze|dni\s+robocze)(?=\s)/giu, () => {
    rrule = { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }; return { type: 'repeat' };
  });
  take(/\s(?:daily|every\s+day|codziennie|co\s+dzień|co\s+dzien|każdego\s+dnia)(?=\s)/giu, () => { rrule = { freq: 'daily' }; return { type: 'repeat' }; });
  take(/\s(?:weekly|every\s+week|co\s+tydzień|co\s+tydzien)(?=\s)/giu, () => { rrule = { freq: 'weekly' }; return { type: 'repeat' }; });
  take(/\s(?:monthly|every\s+month|co\s+miesiąc|co\s+miesiac)(?=\s)/giu, () => { rrule = { freq: 'monthly' }; return { type: 'repeat' }; });
  take(/\s(?:yearly|annually|every\s+year|co\s+rok|corocznie)(?=\s)/giu, () => { rrule = { freq: 'yearly' }; return { type: 'repeat' }; });
  // all day
  take(/\s(?:all[\s-]day|cały\s+dzień|caly\s+dzien|całodniowe|calodniowe)(?=\s)/giu, () => { allDay = true; return { type: 'allday' }; });

  // dates
  take(/\s(\d{4})-(\d{1,2})-(\d{1,2})(?=\s)/g, (m) => { date = new Date(+m[1], m[2] - 1, +m[3]); return { type: 'date' }; });
  take(/\s(?:on\s+)?(\d{1,2})([./])(\d{1,2})(?:\2(\d{2,4}))?(?=\s)/g, (m) => {
    let d = +m[1], mo = +m[3];
    if (m[2] === '/' && monthFirst) [d, mo] = [mo, d];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    let y = m[4] ? +m[4] : today.getFullYear();
    if (y < 100) y += 2000;
    date = new Date(y, mo - 1, d);
    if (!m[4] && date < today) date = new Date(y + 1, mo - 1, d);
    return { type: 'date' };
  });
  const setMD = (mo, d) => {
    let dt = new Date(today.getFullYear(), mo, d);
    if (dt < today) dt = new Date(today.getFullYear() + 1, mo, d);
    date = dt;
  };
  take(/\s(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([\p{L}]{3,})\.?(?=\s)/giu, (m) => {
    const mo = moOf(m[2]); if (mo < 0 || +m[1] > 31) return false; setMD(mo, +m[1]); return { type: 'date' };
  });
  take(/\s(?:on\s+)?([\p{L}]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s)/giu, (m) => {
    const mo = moOf(m[1]); if (mo < 0 || +m[2] > 31) return false; setMD(mo, +m[2]); return { type: 'date' };
  });
  take(/\s(?:today|tonight|dziś|dzis|dzisiaj)(?=\s)/giu, () => { date = today; return { type: 'date' }; });
  take(/\s(?:day\s+after\s+tomorrow|pojutrze)(?=\s)/giu, () => { date = addDays(today, 2); return { type: 'date' }; });
  take(/\s(?:tomorrow|tmrw|jutro)(?=\s)/giu, () => { date = addDays(today, 1); return { type: 'date' }; });
  take(/\s(?:in|za)\s+(\d+)\s+(days?|dni|dzień|weeks?|tygodni[ea]?|tydzień)(?=\s)/giu, (m) => {
    const n = +m[1] * (/^(w|t)/i.test(m[2]) ? 7 : 1); date = addDays(today, n); return { type: 'date' };
  });
  take(/\s(?:next\s+week|w\s+przyszłym\s+tygodniu|za\s+tydzień)(?=\s)/giu, () => { date = nextWd(1, true); return { type: 'date' }; });
  take(new RegExp(`\\s(next|on|this|w|we|we\\s+wtorek|w\\s+przyszły|w\\s+przyszłą|przyszły|przyszłą|przyszly)?\\s*(${WD_RE})\\.?(?=\\s)`, 'giu'), (m) => {
    const wd = wdOf(m[2]); if (wd < 0) return false;
    date = nextWd(wd, !!m[1] && /next|przysz/i.test(m[1]));
    return { type: 'date' };
  });

  // time ranges: 9-10, 9:30–11, 1pm to 3pm, 14:00 do 15:30
  take(/\s(?:at|o|from|od|godz\.?)?\s*(\d{1,2})(?::|\.(?=\d\d))?(\d{2})?\s*(am|pm)?\s*(?:-|–|—|to|do|until)\s*(\d{1,2})(?::|\.(?=\d\d))?(\d{2})?\s*(am|pm)?(?=\s)/giu, (m) => {
    const ap2 = m[6], ap1 = m[3] || (ap2 && +m[1] <= +m[4] ? ap2 : null);
    const a = hour(m[1], m[2], ap1), b = hour(m[4], m[5], ap2);
    if (a == null || b == null) return false;
    startMin = a; endMin = b <= a ? b + 24 * 60 : b;
    return { type: 'time' };
  });
  // durations: for 30 min, 1h, 2h30, 90m, przez 2 godziny
  take(/\s(?:for|przez|na)?\s*(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours?|godz\.?|godzin[ay]?|godzinę|m|min|mins|minutes?|minut[y]?)(?:\s*(\d+)\s*(?:m|min)?)?(?=\s)/giu, (m) => {
    const v = parseFloat(m[1].replace(',', '.'));
    dur = /^(h|g)/i.test(m[2]) ? v * 60 + (+m[3] || 0) : v;
    return { type: 'duration' };
  });
  // single times: at 9, o 14, 14:30, 3pm, 3:30pm
  take(/\s(?:at|o|@|godz\.?)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?=\s)/giu, (m) => {
    const a = hour(m[1], m[2], m[3]); if (a == null) return false; startMin = a; return { type: 'time' };
  });
  take(/\s(\d{1,2}):(\d{2})\s*(am|pm)?(?=\s)/giu, (m) => {
    const a = hour(m[1], m[2], m[3]); if (a == null) return false; startMin = a; return { type: 'time' };
  });
  take(/\s(\d{1,2})\s*(am|pm)(?=\s)/giu, (m) => {
    const a = hour(m[1], 0, m[2]); if (a == null) return false; startMin = a; return { type: 'time' };
  });
  // noon / evening words
  take(/\s(?:at\s+)?(?:noon|w\s+południe|w\s+poludnie)(?=\s)/giu, () => { startMin = 12 * 60; return { type: 'time' }; });

  let title = s.replace(/\s+/g, ' ').trim()
    .replace(/^(?:at|on|in|w|o|na|we)\s+/i, '')
    .replace(/\s+(?:at|on|in|w|o|na|we|from|od|-)$/i, '');

  let start, end;
  if (startMin != null && !allDay) {
    const day = date || today;
    start = atMinutes(day, startMin);
    end = endMin != null ? atMinutes(day, endMin) : addMinutes(start, dur || defaultDuration);
  } else if (date || allDay) {
    start = startOfDay(date || today);
    end = addDays(start, 1);
    allDay = true;
    if (dur && !rrule && dur >= 24 * 60) end = addDays(start, Math.round(dur / 1440));
  } else {
    // nothing said about time: next full hour today
    start = new Date(Math.ceil(now.getTime() / (60 * MIN)) * 60 * MIN);
    end = addMinutes(start, dur || defaultDuration);
  }
  return { ...out, title, start, end, allDay, rrule, tokens };
}
