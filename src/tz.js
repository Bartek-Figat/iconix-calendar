// Time zones without a library: Intl does the zone math.
// Inside the calendar every time is a "wall clock" Date (its local fields = the time in the chosen zone);
// everything handed to your code is a real instant.
const cache = new Map();
function parts(date, tz) {
  let f = cache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    cache.set(tz, f);
  }
  const p = {};
  for (const { type, value } of f.formatToParts(date)) p[type] = value;
  return p;
}

/** Instant → wall-clock time in `tz`. */
export function toWall(instant, tz) {
  if (!tz) return new Date(instant);
  const p = parts(instant, tz);
  return new Date(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second, instant.getMilliseconds());
}

const offsetAt = (t, tz) => {
  const p = parts(new Date(t), tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
};

/** Wall-clock time in `tz` → instant. */
export function fromWall(wall, tz) {
  if (!tz) return new Date(wall);
  const guess = Date.UTC(wall.getFullYear(), wall.getMonth(), wall.getDate(), wall.getHours(), wall.getMinutes(), wall.getSeconds(), wall.getMilliseconds());
  let t = guess - offsetAt(guess, tz);
  t = guess - offsetAt(t, tz); // second pass settles DST edges
  return new Date(t);
}

/** True for values that name an exact instant: Date objects, numbers, ISO strings with Z or an offset. */
export function isInstant(v) {
  return v instanceof Date || typeof v === 'number' || (typeof v === 'string' && /T.*(Z|[+-]\d\d:?\d\d)$/i.test(v));
}

/** Short label like "GMT-5" for the zone at a moment. */
export function zoneLabel(tz, at = new Date()) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz || undefined, timeZoneName: 'shortOffset' }).formatToParts(at);
    return (p.find((x) => x.type === 'timeZoneName') || {}).value || '';
  } catch { return ''; }
}
