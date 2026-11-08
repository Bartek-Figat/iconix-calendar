// Event sources: load events per visible range from a URL, a function or an .ics feed.
import { fromICS } from './ics.js';

/**
 * Accepted shapes (in `events` or in the `eventSources` array):
 *   [ {…}, {…} ]                          static events
 *   'https://api/events'                  JSON feed, called with ?start=…&end=… (ISO)
 *   'https://…/team.ics'                  iCalendar feed (fetched once)
 *   ({ start, end, signal }) => events     function, may return a Promise
 *   { url | events | ics, id?, color?, calendar?, editable?, startParam?, endParam?, extraParams?, transform?, headers? }
 */
export function normalizeSources(list) {
  return list.filter((s) => s != null).map((s, i) => {
    let src;
    if (typeof s === 'string') src = /\.ics(\?|$)/i.test(s) ? { ics: s } : { url: s };
    else if (typeof s === 'function') src = { events: s };
    else if (Array.isArray(s)) src = { events: s };
    else src = { ...s };
    if (src.id == null) src.id = `source-${i}`;
    src.kind = src.ics ? 'ics' : src.url ? 'url' : typeof src.events === 'function' ? 'fn' : 'static';
    src.fetched = null;
    return src;
  });
}

function withParams(url, params) {
  const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost/');
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  return u.toString();
}

/** Loads one source for [start, end). Returns raw event objects. */
export async function loadSource(src, { start, end, signal, view, fetchImpl = globalThis.fetch }) {
  if (src.kind === 'static') return src.events || [];
  if (src.kind === 'fn') {
    const r = await src.events({ start: new Date(start), end: new Date(end), signal, view });
    return Array.isArray(r) ? r : (r && r.events) || [];
  }
  if (!fetchImpl) throw new Error('fetch is not available');
  if (src.kind === 'ics') {
    const res = await fetchImpl(src.ics, { signal, headers: src.headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText || ''}`.trim());
    return fromICS(await res.text());
  }
  const extra = typeof src.extraParams === 'function' ? src.extraParams() : src.extraParams || {};
  const url = withParams(src.url, { [src.startParam || 'start']: start.toISOString(), [src.endParam || 'end']: end.toISOString(), ...extra });
  const res = await fetchImpl(url, { signal, headers: src.headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText || ''}`.trim());
  const body = await res.json();
  return Array.isArray(body) ? body : body.events || [];
}

/** True when the already loaded range covers the requested one (lazy fetching). */
export function covers(fetched, start, end) {
  return !!fetched && fetched.start <= start && fetched.end >= end;
}
