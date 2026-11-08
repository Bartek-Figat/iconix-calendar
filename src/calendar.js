import * as D from './date.js';
import { expand, describeRule, weekdayPosition } from './recur.js';
import { parseQuickAdd } from './quickadd.js';
import { toICS, fromICS } from './ics.js';
import { icon } from './icons.js';
import { getStrings } from './i18n.js';
import { PRESETS, EVENT_STYLES } from './presets.js';
import { normalizeEvent, findFreeSlot as freeSlot, findClashes, uid } from './model.js';
import { normalizeSources, loadSource, covers } from './sources.js';
import { registerCalendar, calendarAt } from './dragdrop.js';
import { toWall, fromWall, isInstant, zoneLabel } from './tz.js';
// event search (typos, word forms, field queries) is powered by @iconix/search
import { createIndex, highlight as markMatches } from '@iconix/search/engine';
import { timeGrid } from './views/timegrid.js';
import { month, weekGrid } from './views/month.js';
import { agenda, listWeek, listMonth, listYear } from './views/agenda.js';
import { multiMonth } from './views/multimonth.js';
import { year } from './views/year.js';
import { timeline } from './views/timeline.js';

export const VIEWS = {
  day: timeGrid('day', 1),
  week: timeGrid('week', 7),
  days: timeGrid('days', (cal) => cal.o.daysCount),
  resourceDay: timeGrid('resourceDay', 1, { resources: true }),
  month, weekGrid, multiMonth, year, agenda, listWeek, listMonth, listYear, timeline,
};
const VIEW_KEYS = { day: 'd', week: 'w', days: 'x', month: 'm', year: 'y', agenda: 'a', timeline: 'r', resourceDay: 'e', weekGrid: 'g', multiMonth: 'o', listWeek: 'l', listMonth: 'l', listYear: 'l' };
const VIEW_ICONS = { day: 'calendar', week: 'calendar', days: 'calendar', month: 'grid', year: 'layers', agenda: 'list', timeline: 'timeline', resourceDay: 'users', weekGrid: 'grid', multiMonth: 'grid', listWeek: 'list', listMonth: 'list', listYear: 'list' };

/** Parts you can target with the `classNames` option, and the built-in class each one already has. */
export const PARTS = {
  root: '.ixc',
  toolbar: '.ixc-bar',
  title: '.ixc-title',
  button: '.ixc-btn, .ixc-ib',
  viewSwitcher: '.ixc-seg, .ixc-viewsel select',
  search: '.ixc-search',
  sidebar: '.ixc-side',
  quickAdd: '.ixc-qa-box',
  miniMonth: '.ixc-mini',
  calendarList: '.ixc-cal',
  dayHeader: '.ixc-tg-day, .ixc-mo-head > div',
  today: '.ixc-today',
  weekend: '.ixc-weekend',
  dayColumn: '.ixc-col',
  monthCell: '.ixc-mo-cell',
  allDay: '.ixc-tg-allday',
  timeLabel: '.ixc-hours span, .ixc-tl-tick',
  businessOff: '.ixc-off',
  event: '.ixc-ev',
  eventTitle: '.ixc-ev-t',
  eventTime: '.ixc-ev-time',
  more: '.ixc-more',
  nowIndicator: '.ixc-now, .ixc-tl-now',
  resourceLabel: '.ixc-tl-label',
  resourceRow: '.ixc-tl-row',
  agendaDay: '.ixc-ag-day',
  agendaRow: '.ixc-ag-row',
  yearDay: '.ixc-yr-d',
  popover: '.ixc-pop',
  editor: '.ixc-editor',
  palette: '.ixc-pal',
  toast: '.ixc-toast',
};

export const SWATCHES = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0d9488', '#0891b2', '#52525b'];

export const DEFAULTS = {
  view: 'week',
  date: null,
  views: ['day', 'week', 'month', 'year', 'agenda', 'timeline'],
  locale: (typeof navigator !== 'undefined' && navigator.language) || 'en',
  firstDay: 1,
  weekends: true,
  dayStart: 0,
  dayEnd: 24,
  scrollTime: 8,
  slotMinutes: 30,
  snapMinutes: 15,
  slotHeight: 24,
  defaultDuration: 60,
  businessHours: { start: 9, end: 17, days: [1, 2, 3, 4, 5] },
  daysCount: 3,
  agendaDays: 14,
  timelineDays: 1,
  timelineHours: [7, 20],
  monthsCount: 3,
  weekNumbers: false,
  resourceColumns: null,
  fixedWeeks: true,
  events: [],
  eventSources: [],
  lazyFetching: true,
  calendars: [],
  resources: [],
  defaultCalendar: null,
  editable: true,
  selectable: true,
  selectMode: 'create',
  droppable: false,
  unselectAuto: true,
  selectAllow: null,
  selectOverlap: true,
  eventOverlap: true,
  validRange: null,
  toolbar: true,
  sidebar: true,
  palette: true,
  keyboard: true,
  nowIndicator: true,
  showClashes: true,
  theme: 'auto',
  direction: 'auto',
  search: {},
  timeZone: null,
  preset: null,
  accent: null,
  radius: null,
  density: 'comfortable',
  eventStyle: 'soft',
  height: null,
  strings: {},
  eventContent: null,
  eventClass: null,
  classNames: null,
  eventDidMount: null,
  eventAllow: null,
  dayClass: null,
};

const DENSITY = { compact: 0.8, comfortable: 1, spacious: 1.3 };
const escHTML = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export class Calendar {
  constructor(target, options = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) throw new Error('@iconix/calendar: target element not found');
    this.el = el;
    this.o = { ...DEFAULTS, ...options };
    this._listeners = new Map();
    this.history = [];
    this.future = [];
    this._clash = new Set();
    this.state = {
      view: VIEWS[this.o.view] ? this.o.view : 'week',
      date: D.startOfDay(this.o.date ? (this.o.timeZone && isInstant(this.o.date) ? toWall(new Date(this.o.date), this.o.timeZone) : D.toDate(this.o.date)) : toWall(new Date(), this.o.timeZone)),
      query: '',
      hidden: new Set((this.o.calendars || []).filter((c) => c.visible === false).map((c) => c.id)),
      selected: null,
      zoom: 1,
      highlight: null,
      sidebar: this.o.sidebar,
      mini: null,
      clashFocus: false,
      collapsed: new Set(),
      selection: null,
    };
    this.events = [];
    this._initSources();
    this._build();
    if (this.state.sidebar && el.clientWidth && el.clientWidth < 760) this.state.sidebar = false;
    this.render();
    this._bind();
    this._unregister = registerCalendar(this);
    // announce the first range too, so `onViewChange` can load data for it (after listeners are attached)
    queueMicrotask(() => { if (this.root.isConnected) this._emit('viewChange', { view: this.state.view, date: this.getDate(), ...this.getRange() }); });
    this._fetchSources();
  }

  // ---------------------------------------------------------------- getters
  get t() { return this._t || (this._t = getStrings(this.o.locale, this.o.strings)); }
  get locale() { return this.o.locale; }
  /** "Now" as a wall-clock time in the calendar's time zone. */
  now() { return toWall(new Date(), this.o.timeZone); }
  /** Converts instants in user input to wall-clock times of the calendar's zone. */
  _zoneIn(e) {
    const tz = this.o.timeZone;
    if (!tz || !e) return e;
    const out = { ...e };
    for (const k of ['start', 'end']) if (out[k] != null && isInstant(out[k]) && !(out.allDay && !(out[k] instanceof Date))) out[k] = toWall(new Date(out[k]), tz);
    return out;
  }
  _normIn(e) { return this._norm(this._zoneIn(e)); }
  /** Wall-clock Date → real instant (identity without a timeZone). */
  _out(d) { return d == null ? d : fromWall(d, this.o.timeZone); }
  zoneLabel() { return zoneLabel(this.o.timeZone, new Date()); }
  /** Right-to-left layout: direction 'rtl', or 'auto' with an RTL locale (Arabic, Hebrew, Persian, Urdu). */
  get rtl() {
    const d = this.o.direction;
    return d === 'rtl' || (d === 'auto' && /^(ar|he|iw|fa|ur|yi|ps|ckb|dv)\b/i.test(String(this.o.locale)));
  }
  get zoomFactor() { return this.state.zoom * (DENSITY[this.o.density] || 1); }
  get slotHeight() { return Math.round(this.o.slotHeight * this.zoomFactor); }
  _view() { return VIEWS[this.state.view]; }
  esc(s) { return escHTML(s); }
  hl(s) {
    const q = this.state.query.trim();
    if (!q) return escHTML(s);
    return markMatches(String(s ?? ''), q, { stemming: this._stemming(), fuzzy: this.o.search?.fuzzy ?? 'auto' });
  }
  _stemming() { return this.o.search?.stemming ?? (/^pl/i.test(String(this.o.locale)) ? 'en+pl' : 'en'); }
  /** Search index over the events (one document per event or series), rebuilt only when the data changes. */
  _index() {
    const docs = this.events.map((e) => {
      const c = this.calendarOf(e);
      const res = this.resourcesOf(e).map((id) => this._resourceById(id)?.title).filter(Boolean).join(' ');
      return { id: String(e.id), title: e.title || '', location: e.location || '', notes: e.notes || '', calendar: c ? c.name : '', resource: res };
    });
    const sig = docs.map((d) => `${d.id}\u0001${d.title}\u0001${d.location}\u0001${d.notes}\u0001${d.calendar}\u0001${d.resource}`).join('\u0002');
    if (!this._ix || this._ixSig !== sig || this._ixLoc !== this.o.locale) {
      const { keys, ...opts } = this.o.search || {};
      this._ix = createIndex(docs, {
        keys: keys || [{ name: 'title', weight: 3 }, { name: 'location', weight: 1.5 }, { name: 'calendar', weight: 1.2 }, { name: 'resource', weight: 1.2 }, 'notes'],
        id: 'id', stemming: this._stemming(), ...opts,
      });
      this._ixSig = sig;
      this._ixLoc = this.o.locale;
      this._hits = null;
    }
    return this._ix;
  }
  /** Ids of events matching the toolbar query, plus a correction when nothing matched. */
  _queryHits() {
    const q = this.state.query.trim();
    const ix = this._index();
    if (this._hits && this._hits.q === q && this._hits.ix === ix) return this._hits;
    const r = ix.search(q, { limit: 100000 });
    this._hits = { q, ix, ids: new Set(r.hits.map((h) => h.id)), didYouMean: r.didYouMean, total: r.total };
    return this._hits;
  }
  /** Ranked search over all events: typo tolerant, word forms, field queries like "location:atlas". */
  searchEvents(query, { limit = 20 } = {}) {
    const r = this._index().search(String(query || ''), { limit });
    return r.hits.map((h) => this.getEventById(h.id)).filter(Boolean);
  }

  // ---------------------------------------------------------------- data
  _norm(e) { return normalizeEvent(e, { defaultDuration: this.o.defaultDuration }); }
  _pub(e) {
    const tz = this.o.timeZone;
    const conv = (d) => (tz && !e.allDay ? fromWall(d, tz) : new Date(d));
    const o = { ...e, start: conv(e.start), end: conv(e.end), exdates: [...(e.exdates || [])] };
    if (e.rrule) o.rrule = { ...e.rrule }; else delete o.rrule;
    delete o.key; delete o.recurring;
    if (!o.exdates.length) delete o.exdates;
    return o;
  }
  _snap() { return this.events.map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end), rrule: e.rrule ? { ...e.rrule } : null, exdates: [...e.exdates] })); }
  _byId(id) { return this.events.find((e) => String(e.id) === String(id)); }
  _instByKey(key) {
    if (key == null) return null;
    const s = String(key), at = s.lastIndexOf('@');
    const e = this._byId(at < 0 ? s : s.slice(0, at)) || this._byId(s);
    const day = at < 0 || !e || String(e.id) === s ? null : s.slice(at + 1);
    if (!e) return null;
    if (!e.rrule || !day) return { ...e, key: String(e.id), recurring: false };
    const d = D.toDate(day.slice(0, 10));
    return expand(e, d, D.addDays(d, 1)).find((i) => i.key === key) || null;
  }
  /** Resource ids of an event: `resourceIds` (several) or `resourceId`. */
  resourcesOf(i) {
    if (Array.isArray(i.resourceIds) && i.resourceIds.length) return i.resourceIds;
    return i.resourceId == null ? [] : [i.resourceId];
  }
  calendarOf(i) { return (this.o.calendars || []).find((c) => String(c.id) === String(i.calendar)); }
  colorOf(i) {
    if (i.color) return i.color;
    const c = this.calendarOf(i);
    if (c && c.color) return c.color;
    const r = i.resourceId != null && (this.o.resources || []).find((r) => String(r.id) === String(i.resourceId));
    return (r && r.color) || 'var(--ixc-accent)';
  }
  _match(i) {
    if (!this.state.query.trim()) return true;
    return this._queryHits().ids.has(String(i.id));
  }
  _editable(i) { return this.o.editable && i.editable !== false; }

  /** All visible instances that overlap [start, end). */
  instances(start, end, { filter = true } = {}) {
    const out = [];
    for (const e of this.events) {
      if (filter && e.calendar != null && this.state.hidden.has(e.calendar)) continue;
      for (const i of expand(e, start, end)) {
        if (filter && !this._match(i)) continue;
        out.push(i);
      }
    }
    const sel = this.state.selection;
    if (sel && sel.start < end && sel.end > start) {
      out.push({ id: '__selection', key: '__selection', title: '', start: sel.start, end: sel.end, allDay: sel.allDay, resourceId: sel.resourceId, display: 'selection', editable: false, exdates: [], rrule: null });
    }
    return out.sort((a, b) => a.start - b.start || b.end - a.end);
  }

  _computeClashes(start, end) {
    const visible = this.events.filter((e) => e.calendar == null || !this.state.hidden.has(e.calendar));
    const pairs = findClashes(visible, start, end).filter(([x, y]) => this._match(x) && this._match(y));
    const set = new Set(pairs.flat().map((i) => i.key));
    set.pairs = pairs.length;
    return set;
  }

  // ---------------------------------------------------------------- history
  _push(snapshot, label) {
    this.history.push({ events: snapshot, label });
    if (this.history.length > 100) this.history.shift();
    this.future = [];
  }
  _mutate(label, fn) {
    const snap = this._snap();
    const r = fn();
    this._push(snap, label);
    this._changed();
    return r;
  }
  _changed() {
    this.renderMain();
    this._renderSide();
    this._emit('change', { events: this.getEvents() });
  }
  canUndo() { return this.history.length > 0; }
  canRedo() { return this.future.length > 0; }
  undo() {
    const h = this.history.pop();
    if (!h) { this._toast(this.t.nothingToUndo); return false; }
    this.future.push({ events: this._snap(), label: h.label });
    this.events = h.events;
    this.closePopover(true);
    this._changed();
    this._toast(this.t.undone, { label: this.t.cmdRedo, run: () => this.redo() });
    return true;
  }
  redo() {
    const h = this.future.pop();
    if (!h) return false;
    this.history.push({ events: this._snap(), label: h.label });
    this.events = h.events;
    this.closePopover(true);
    this._changed();
    this._toast(this.t.redone);
    return true;
  }

  // ---------------------------------------------------------------- public API
  getEvents() { return this.events.map((e) => this._pub(e)); }
  /** Opens the browser's print dialog; the print stylesheet lays the current view out on paper. */
  print() {
    this.root.classList.add('ixc-printing');
    const done = () => { this.root.classList.remove('ixc-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
  }

  // ---------------------------------------------------------------- event sources
  _initSources() {
    for (const s of this._sources || []) s.ctrl?.abort();
    const o = this.o;
    // the `events` option is the "default" source; `eventSources` are numbered on their own
    let def = [];
    if (Array.isArray(o.events)) def = o.events.length ? normalizeSources([{ id: 'default', events: o.events }]) : [];
    else if (o.events) def = normalizeSources([typeof o.events === 'object' ? o.events : o.events]).map((x) => ({ ...x, id: 'default' }));
    if (def[0] && def[0].kind === 'fn') def[0].events = (...a) => this.o.events(...a); // always the latest function
    this._sources = [...def, ...normalizeSources(o.eventSources || [])];
    this._loading = 0;
    // static sources are available right away
    // a new `events` / `eventSources` value replaces the data; only events of remote sources that still exist stay until reloaded
    const keep = this.events.filter((e) => e.source != null && this._sources.some((s) => s.id === e.source && s.kind !== 'static'));
    this.events = keep.concat(this._sources.filter((s) => s.kind === 'static').flatMap((s) => this._fromSource(s, s.events || [])));
  }
  _fromSource(src, list) {
    const out = [];
    for (const raw of list) {
      const e = typeof src.transform === 'function' ? src.transform(raw) : raw;
      if (!e) continue;
      const ev = { ...e };
      if (src.id !== 'default') ev.source = src.id;
      if (src.color && ev.color == null) ev.color = src.color;
      if (src.calendar != null && ev.calendar == null) ev.calendar = src.calendar;
      if (src.editable === false && ev.editable == null) ev.editable = false;
      if (src.display && ev.display == null) ev.display = src.display;
      try { out.push(this._normIn(ev)); } catch (err) { this._emit('sourceError', { source: src.id, error: err }); }
    }
    return out;
  }
  _setLoading(delta) {
    const was = this._loading > 0;
    this._loading = Math.max(0, this._loading + delta);
    const now = this._loading > 0;
    this.root?.classList.toggle('ixc-loading', now);
    if (was !== now) this._emit('loading', { loading: now });
  }
  /** Loads remote sources for the visible range. Ranges already loaded are skipped unless `force`. */
  _fetchSources(force = false) {
    const remote = (this._sources || []).filter((s) => s.kind !== 'static');
    if (!remote.length) return Promise.resolve();
    const { start, end } = this._view().range(this);
    return Promise.all(remote.map(async (src) => {
      if (!force && this.o.lazyFetching && (src.kind === 'ics' ? src.fetched : covers(src.fetched, start, end))) return;
      src.ctrl?.abort();
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      src.ctrl = ctrl;
      this._setLoading(1);
      try {
        const raw = await loadSource(src, { start: this._out(start), end: this._out(end), signal: ctrl?.signal, view: this.state.view, fetchImpl: this.o.fetch || globalThis.fetch });
        if (src.ctrl !== ctrl || !this.root.isConnected) return; // superseded or destroyed
        src.fetched = { start, end };
        const fresh = this._fromSource(src, raw);
        const prev = src.loadedIds || new Set();
        src.loadedIds = new Set(fresh.map((e) => String(e.id)));
        this.events = this.events.filter((e) => (src.id === 'default' ? !prev.has(String(e.id)) : e.source !== src.id)).concat(fresh);
        this.renderMain();
        this._renderSide();
        this._emit('sourceLoad', { source: src.id, events: fresh.map((e) => this._pub(e)) });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        this._emit('sourceError', { source: src.id, error: err });
      } finally {
        if (src.ctrl === ctrl) src.ctrl = null;
        this._setLoading(-1);
      }
    }));
  }
  /** Drops cached ranges and loads every remote source again. */
  refetchEvents() { for (const s of this._sources || []) s.fetched = null; return this._fetchSources(true); }
  getEventSources() { return (this._sources || []).map(({ id, kind, url, ics, color, calendar }) => ({ id, kind, url, ics, color, calendar })); }
  addEventSource(source) {
    const [src] = normalizeSources([source]);
    if (src.id == null || src.id.startsWith('source-')) src.id = `source-${Date.now().toString(36)}`;
    this._sources.push(src);
    if (src.kind === 'static') { this.events = this.events.concat(this._fromSource(src, src.events || [])); this.renderMain(); this._renderSide(); return Promise.resolve(); }
    return this._fetchSources();
  }
  removeEventSource(id) {
    this._sources = (this._sources || []).filter((s) => { if (s.id === id) s.ctrl?.abort(); return s.id !== id; });
    this.events = this.events.filter((e) => e.source !== id);
    this.renderMain(); this._renderSide();
  }
  getEventById(id) { const e = this._byId(id); return e ? this._pub(e) : null; }
  addEvent(data) {
    const ev = this._normIn(data);
    this._mutate('add', () => this.events.push(ev));
    this._emit('eventCreate', { event: this._pub(ev) });
    return this._pub(ev);
  }
  updateEvent(id, patch) {
    const e = this._byId(id);
    if (!e) return null;
    const old = this._pub(e);
    this._mutate('update', () => {
      const n = this._norm({ ...e, ...this._zoneIn(patch), id: e.id });
      Object.assign(e, n);
    });
    this._emit('eventUpdate', { event: this._pub(e), old });
    return this._pub(e);
  }
  removeEvent(id) {
    const e = this._byId(id);
    if (!e) return false;
    this._mutate('delete', () => { this.events = this.events.filter((x) => x !== e); });
    this._emit('eventDelete', { event: this._pub(e) });
    return true;
  }
  setEvents(list, { history = false } = {}) {
    const snap = this._snap();
    this.events = (list || []).map((e) => this._normIn(e));
    if (history) this._push(snap, 'set');
    this.renderMain();
    this._renderSide();
  }
  getView() { return this.state.view; }
  getDate() { return new Date(this.state.date); }
  getRange() { const r = this._view().range(this); return { start: this._out(r.start), end: this._out(r.end) }; }
  setView(view, date) {
    if (!VIEWS[view]) return;
    this.state.view = view;
    if (date) this.state.date = D.startOfDay(D.toDate(date));
    this._nav();
  }
  gotoDate(date) { this.state.date = D.startOfDay(isInstant(date) && this.o.timeZone ? toWall(new Date(date), this.o.timeZone) : D.toDate(date)); this.state.mini = null; this._nav(); }
  today() { this.gotoDate(this.now()); }
  prev() { this._step(-1); }
  next() { this._step(1); }
  _step(dir) {
    const s = this._view().step(this);
    this.state.date = s.months ? D.addMonths(this.state.date, dir * s.months) : D.addDays(this.state.date, dir * s.days);
    this.state.mini = null;
    this._nav();
  }
  _nav() {
    this.closePopover(true);
    this.render();
    this._fetchSources();
    const r = this.getRange();
    this._emit('viewChange', { view: this.state.view, date: this.getDate(), ...r });
  }
  zoom(dir) {
    if (!this._view().zoomable) return;
    this.state.zoom = D.clamp(+(this.state.zoom * (dir > 0 ? 1.25 : 0.8)).toFixed(3), 0.5, 3);
    this.renderMain();
  }
  setOptions(patch = {}) {
    const p = { ...patch };
    const resetSources = 'events' in p || 'eventSources' in p;
    if ('timeZone' in p && p.timeZone !== this.o.timeZone) {
      const instants = this.events.map((e) => this._pub(e));
      this.o.timeZone = p.timeZone;
      this.events = instants.map((e) => this._normIn(e));
    }
    if ('view' in p && VIEWS[p.view]) { this.state.view = p.view; }
    if ('date' in p && p.date) { this.state.date = D.startOfDay(D.toDate(p.date)); }
    if ('sidebar' in p) this.state.sidebar = p.sidebar;
    if ('calendars' in p) for (const c of p.calendars || []) if (c.visible === false) this.state.hidden.add(c.id);
    Object.assign(this.o, p);
    if ('locale' in p || 'strings' in p) this._t = null;
    if (resetSources) { this._initSources(); this._fetchSources(true); }
    this._buildChrome();
    this.render();
  }
  setQuery(q) { this.state.query = q || ''; if (this._search) this._search.value = this.state.query; this.renderMain(); this._renderSide(); }
  toggleCalendar(id, visible) {
    const h = this.state.hidden;
    const show = visible ?? h.has(id);
    show ? h.delete(id) : h.add(id);
    this.renderMain(); this._renderSide();
  }
  on(name, fn) { if (!this._listeners.has(name)) this._listeners.set(name, new Set()); this._listeners.get(name).add(fn); return () => this.off(name, fn); }
  off(name, fn) { this._listeners.get(name)?.delete(fn); }
  _emit(name, payload) {
    this._listeners.get(name)?.forEach((f) => f(payload));
    this._listeners.get('*')?.forEach((f) => f(name, payload));
    const cb = this.o['on' + cap(name)];
    if (typeof cb === 'function') cb(payload);
  }

  parse(text) {
    return parseQuickAdd(text, { now: this.now(), calendars: this.o.calendars, resources: this.o.resources, defaultDuration: this.o.defaultDuration, locale: this.locale });
  }
  quickAdd(text) {
    const p = this.parse(text);
    if (!p.title && !p.tokens.length) return null;
    const ev = this._norm({
      title: p.title, start: p.start, end: p.end, allDay: p.allDay, rrule: p.rrule,
      calendar: p.calendar ?? this._defaultCal(), resourceId: p.resourceId,
    });
    this._mutate('add', () => this.events.push(ev));
    this._emit('eventCreate', { event: this._pub(ev) });
    const r = this.getRange();
    if (ev.start < r.start || ev.start >= r.end) this.state.date = D.startOfDay(ev.start);
    this.state.selected = ev.rrule ? `${ev.id}@${D.ymd(ev.start)}` : String(ev.id);
    this.render();
    this._view().scrollTo?.(this, ev.start);
    this._toast(`${this.t.created}: ${ev.title || this.t.untitled} · ${this._when(ev)}`, { label: this.t.undo, run: () => this.undo() });
    return this._pub(ev);
  }
  _defaultCal() {
    if (this.o.defaultCalendar != null) return this.o.defaultCalendar;
    const c = (this.o.calendars || []).find((c) => !this.state.hidden.has(c.id));
    return c ? c.id : undefined;
  }
  _when(e) {
    const L = this.locale;
    const day = D.fmt(e.start, L, { weekday: 'short', month: 'short', day: 'numeric' });
    if (e.allDay) {
      const days = D.diffDays(e.start, e.end);
      return days > 1 ? `${day} – ${D.fmt(D.addDays(e.end, -1), L, { weekday: 'short', month: 'short', day: 'numeric' })}` : `${day} · ${this.t.allDay}`;
    }
    return `${day} · ${D.timeStr(e.start, L)}–${D.timeStr(e.end, L)}`;
  }

  /** First gap of `duration` minutes inside business hours, starting at `from`. */
  /** First gap of `duration` minutes inside business hours, across the visible calendars. */
  findFreeSlot({ duration = 30, from, days = 14, hours = this.o.businessHours } = {}) {
    const slot = this._freeWall({ duration, from: from ? (this.o.timeZone && isInstant(from) ? toWall(new Date(from), this.o.timeZone) : D.toDate(from)) : this.now(), days, hours });
    return slot && { start: this._out(slot.start), end: this._out(slot.end) };
  }
  _freeWall({ duration = 30, from = this.now(), days = 14, hours = this.o.businessHours } = {}) {
    const visible = this.events.filter((e) => e.calendar == null || !this.state.hidden.has(e.calendar));
    return freeSlot(visible, { duration, from, days, hours, step: this.o.snapMinutes });
  }
  showFreeSlot(duration = 30) {
    const slot = this._freeWall({ duration });
    if (!slot) { this._toast(this.t.noFree); return null; }
    this.state.highlight = slot;
    if (this._view().kind !== 'time' || this.state.view === 'timeline') this.state.view = this.o.views.includes('week') ? 'week' : 'day';
    this.state.date = D.startOfDay(slot.start);
    this.render();
    this._view().scrollTo?.(this, slot.start);
    this._toast(this.t.freeSlot(this._when(slot)), { label: this.t.book, run: () => this.bookHighlight() });
    return { start: this._out(slot.start), end: this._out(slot.end) };
  }
  bookHighlight(title) {
    const h = this.state.highlight;
    if (!h) return;
    this.state.highlight = null;
    const ev = this._norm({ title: title ?? this.t.focusTime, start: h.start, end: h.end, calendar: this._defaultCal() });
    this._mutate('add', () => this.events.push(ev));
    this._emit('eventCreate', { event: this._pub(ev) });
    this._openAfterRender(String(ev.id));
  }

  exportICS(name) { return toICS(this.events.map((e) => this._pub(e)), { name: name || 'iconix calendar' }); }
  importICS(text, { history = true } = {}) {
    const list = fromICS(text).map((e) => this._normIn({ ...e, id: e.id && this._byId(e.id) ? uid() : e.id }));
    const add = () => this.events.push(...list);
    if (history) this._mutate('import', add); else { add(); this._changed(); }
    this._toast(this.t.imported(list.length));
    return list.map((e) => this._pub(e));
  }
  download(type = 'ics', filename) {
    const ics = type === 'ics';
    const body = ics ? this.exportICS() : JSON.stringify(this.getEvents(), null, 2);
    const blob = new Blob([body], { type: ics ? 'text/calendar' : 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || `calendar.${ics ? 'ics' : 'json'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this._toast(this.t.exported);
  }
  pickICS() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.ics,text/calendar';
    inp.onchange = async () => { const f = inp.files[0]; if (f) this.importICS(await f.text()); };
    inp.click();
  }

  // ---------------------------------------------------------------- DOM
  _build() {
    const root = document.createElement('div');
    root.className = 'ixc';
    root.tabIndex = 0;
    root.innerHTML = `<header class="ixc-bar"></header>
      <div class="ixc-body"><aside class="ixc-side"></aside><div class="ixc-main"></div></div>
      <div class="ixc-layer"></div>`;
    this.el.appendChild(root);
    this.root = root;
    this.bar = root.querySelector('.ixc-bar');
    this.side = root.querySelector('.ixc-side');
    this.main = root.querySelector('.ixc-main');
    this.layer = root.querySelector('.ixc-layer');
    this._buildChrome();
  }
  _buildChrome() {
    const t = this.t;
    const mod = /Mac|iPhone|iPad/.test(typeof navigator !== 'undefined' ? navigator.platform : '') ? '⌘' : 'Ctrl';
    this._mod = mod;
    this.bar.innerHTML = `
      <div class="ixc-bar-l">
        <button class="ixc-ib" data-act="sidebar" title="${t.cmdSidebar} (B)" aria-label="${t.cmdSidebar}">${icon('sidebar')}</button>
        <button class="ixc-btn" data-act="today" title="T">${t.today}</button>
        <div class="ixc-nav"><button class="ixc-ib" data-act="prev" aria-label="${t.prev}" title="${t.prev} (←)">${icon('chevron-left')}</button><button class="ixc-ib" data-act="next" aria-label="${t.next}" title="${t.next} (→)">${icon('chevron-right')}</button></div>
        <h2 class="ixc-title" aria-live="polite"></h2>
        <button class="ixc-clash" data-act="clashes" hidden></button>
      </div>
      <div class="ixc-bar-r">
        <label class="ixc-search">${icon('search', 15)}<input type="search" placeholder="${t.search}" aria-label="${t.search}"><kbd>/</kbd></label>
        <div class="ixc-zoom"><button class="ixc-ib" data-act="zoom-out" title="${t.cmdZoomOut} (-)" aria-label="${t.cmdZoomOut}">${icon('minus', 15)}</button><button class="ixc-ib" data-act="zoom-in" title="${t.cmdZoomIn} (+)" aria-label="${t.cmdZoomIn}">${icon('plus', 15)}</button></div>
        <div class="ixc-seg" role="tablist"></div>
        <label class="ixc-viewsel"><select aria-label="${t.week}"></select>${icon('chevron-right', 13)}</label>
        ${this.o.palette ? `<button class="ixc-btn ixc-cmdk" data-act="palette" title="${t.commands}">${icon('command', 14)}<span>${mod === '⌘' ? '⌘' : 'Ctrl'} K</span></button>` : ''}
      </div>`;
    this._search = this.bar.querySelector('.ixc-search input');
    this._search.value = this.state.query;
    this.side.innerHTML = `
      <div class="ixc-qa">
        <div class="ixc-qa-box">${icon('sparkles', 15)}<input type="text" placeholder="${escHTML(t.quickAdd)}" aria-label="${t.newEvent}"></div>
        <div class="ixc-qa-prev">${t.quickAddHint}</div>
      </div>
      <div class="ixc-mini"></div>
      <div class="ixc-cals"></div>
      <div class="ixc-keys">
        <span><kbd>N</kbd> ${t.newEvent}</span><span><kbd>${mod}</kbd><kbd>K</kbd> ${t.actions}</span>
        <span><kbd>T</kbd> ${t.today}</span><span><kbd>←</kbd><kbd>→</kbd> ${t.next}</span>
        <span><kbd>D</kbd><kbd>W</kbd><kbd>M</kbd><kbd>Y</kbd> ${t.week}…</span><span><kbd>${mod}</kbd><kbd>Z</kbd> ${t.undo}</span>
      </div>`;
    this._qa = this.side.querySelector('.ixc-qa input');
    this._qaPrev = this.side.querySelector('.ixc-qa-prev');
    this.bar.hidden = !this.o.toolbar;
    this.bar.querySelector('.ixc-viewsel select').addEventListener('change', (e) => this.setView(e.target.value));
    this._search.addEventListener('input', () => { this.state.query = this._search.value; this.renderMain(); this._renderSide(); });
    this._search.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.setQuery(''); this.root.focus(); } });
    this._qa.addEventListener('input', () => this._qaPreview());
    this._qa.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this._qa.value.trim()) { this.quickAdd(this._qa.value); this._qa.value = ''; this._qaPreview(); }
      if (e.key === 'Escape') { this._qa.value = ''; this._qaPreview(); this.root.focus(); }
    });
  }
  _isDark() {
    const t = this.o.theme;
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  _applyTheme() {
    const r = this.root, o = this.o;
    r.dataset.theme = o.theme || 'auto';
    r.dir = this.rtl ? 'rtl' : 'ltr';
    r.dataset.density = o.density;
    r.dataset.evstyle = o.eventStyle;
    // preset tokens go inline so they beat the light/dark defaults; tokens from the previous preset are cleared first
    for (const k of this._presetKeys || []) r.style.removeProperty(k);
    const p = typeof o.preset === 'string' ? PRESETS[o.preset] : o.preset;
    this._presetKeys = [];
    if (p) {
      const vars = { ...(p.vars || {}), ...((this._isDark() ? p.dark : p.light) || {}) };
      if (p.radius != null) vars.radius = `${p.radius}px`;
      if (p.font) vars.font = p.font;
      for (const [k, v] of Object.entries(vars)) { const name = `--ixc-${k}`; r.style.setProperty(name, v); this._presetKeys.push(name); }
      r.dataset.preset = typeof o.preset === 'string' ? o.preset : 'custom';
    } else delete r.dataset.preset;
    if (!this._mq && typeof matchMedia !== 'undefined') {
      this._mq = matchMedia('(prefers-color-scheme: dark)');
      this._mqH = () => { if (this.o.theme === 'auto' && this.o.preset) this._applyTheme(); };
      this._mq.addEventListener?.('change', this._mqH);
    }
    if (o.accent) r.style.setProperty('--ixc-accent', o.accent);
    else if (!this._presetKeys.includes('--ixc-accent')) r.style.removeProperty('--ixc-accent');
    if (o.radius != null) r.style.setProperty('--ixc-radius', `${o.radius}px`);
    else if (!this._presetKeys.includes('--ixc-radius')) r.style.removeProperty('--ixc-radius');
    if (o.height) r.style.height = typeof o.height === 'number' ? `${o.height}px` : o.height;
    r.classList.toggle('ixc-noside', !this.state.sidebar);
    r.classList.toggle('ixc-focus-clash', this.state.clashFocus);
  }

  /** Adds the classes from `classNames` to every matching part inside `scope`. */
  _parts(scope) {
    const map = this.o.classNames;
    if (!map || !scope) return;
    for (const [part, extra] of Object.entries(map)) {
      const sel = PARTS[part];
      if (!sel || !extra) continue;
      const list = String(extra).split(/\s+/).filter(Boolean);
      if (scope.matches?.(sel)) scope.classList.add(...list);
      scope.querySelectorAll(sel).forEach((el) => el.classList.add(...list));
    }
  }
  render() {
    this._applyTheme();
    this._parts(this.root);
    this._renderBar();
    this._renderSide();
    this.renderMain();
  }
  _renderBar() {
    const v = this._view(), t = this.t;
    // the view switcher needs room for every button; when it would squeeze the title, use the dropdown
    const width = this.root.clientWidth || 1200;
    const nViews = this.o.views.filter((k) => VIEWS[k]).length;
    const tight = width < 640 + nViews * 78;
    this.root.classList.toggle('ixc-tight', tight);
    this.compact = tight || width < 1100;
    this.bar.querySelector('.ixc-title').textContent = v.title(this);
    this.bar.querySelector('.ixc-zoom').hidden = !v.zoomable;
    const seg = this.bar.querySelector('.ixc-seg');
    const views = this.o.views.filter((k) => VIEWS[k]);
    const label = (k) => (k === 'days' ? `${this.o.daysCount} ${t.days}` : t[k]);
    seg.innerHTML = views.map((k) => `<button role="tab" aria-selected="${k === this.state.view}" data-view="${k}" title="${label(k)} (${VIEW_KEYS[k].toUpperCase()})">${label(k)}</button>`).join('');
    // compact containers get a dropdown instead of the segmented control
    const sel = this.bar.querySelector('.ixc-viewsel select');
    sel.innerHTML = views.map((k) => `<option value="${k}" ${k === this.state.view ? 'selected' : ''}>${label(k)}</option>`).join('');
    this.bar.querySelector('.ixc-viewsel').hidden = views.length < 2;
    seg.hidden = views.length < 2;
    this._parts(this.bar);
  }
  _renderClash() {
    const b = this.bar.querySelector('.ixc-clash');
    const n = this._clash.pairs || 0;
    b.hidden = !n;
    b.classList.toggle('ixc-on', this.state.clashFocus);
    if (n) b.innerHTML = `${icon('alert', 13)}${this.t.clashes(n)}`;
  }
  _renderDidYouMean() {
    const box = this.bar.querySelector('.ixc-search');
    let b = box.querySelector('.ixc-dym');
    const q = this.state.query.trim();
    const h = q ? this._queryHits() : null;
    const dym = h && !h.total ? h.didYouMean : null;
    if (!dym) { b?.remove(); return; }
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'ixc-dym'; box.appendChild(b); }
    b.textContent = `${this.t.didYouMean} ${dym}`;
    b.onclick = (e) => { e.preventDefault(); this.setQuery(dym); this._search.focus(); };
  }
  renderMain() {
    const v = this._view();
    const r = v.range(this);
    this._clash = this.o.showClashes && v.kind !== 'year' ? this._computeClashes(r.start, r.end) : new Set();
    v.render(this, this.main);
    this._renderClash();
    this._renderDidYouMean();
    this._parts(this.main);
    const mounted = this.o.eventDidMount;
    if (typeof mounted === 'function') {
      for (const el of this.main.querySelectorAll('[data-key]')) {
        const i = this._instByKey(el.dataset.key);
        if (i) mounted({ el, event: this._pub(i), view: this.state.view });
      }
    }
  }
  /** Extra classes for a day cell / column from the `dayClass` option. */
  dayClass(date) {
    const f = this.o.dayClass;
    if (typeof f !== 'function') return '';
    const c = f(new Date(date), { view: this.state.view });
    return c ? ` ${c}` : '';
  }
  _renderSide() {
    if (!this.state.sidebar) return;
    const L = this.locale, o = this.o, t = this.t;
    const m = this.state.mini || D.startOfMonth(this.state.date);
    const gs = D.startOfWeek(m, o.firstDay);
    const ge = D.addDays(gs, 42);
    const has = new Set();
    for (const i of this.instances(gs, ge)) {
      let d = D.startOfDay(i.start);
      const last = i.allDay ? D.addDays(i.end, -1) : new Date(i.end - 1);
      for (let k = 0; d <= last && k < 42; k++, d = D.addDays(d, 1)) has.add(D.ymd(d));
    }
    const r = this.getRange();
    const now = this.now();
    let cells = '';
    for (let k = 0; k < 7; k++) cells += `<i>${D.fmt(D.addDays(gs, k), L, { weekday: 'narrow' })}</i>`;
    for (let k = 0; k < 42; k++) {
      const d = D.addDays(gs, k);
      const cls = [];
      if (d.getMonth() !== m.getMonth()) cls.push('ixc-out');
      if (D.isSameDay(d, now)) cls.push('ixc-today');
      if (d >= r.start && d < r.end && this.state.view !== 'year') cls.push('ixc-in');
      if (D.isSameDay(d, this.state.date)) cls.push('ixc-cur');
      if (has.has(D.ymd(d))) cls.push('ixc-has');
      cells += `<button class="${cls.join(' ')}" data-goto="${D.ymd(d)}">${d.getDate()}</button>`;
    }
    this.side.querySelector('.ixc-mini').innerHTML = `
      <div class="ixc-mini-h"><b>${D.fmt(m, L, { month: 'long', year: 'numeric' })}</b>
      <button class="ixc-ib" data-act="mini-prev" aria-label="${t.prev}">${icon('chevron-left', 14)}</button><button class="ixc-ib" data-act="mini-next" aria-label="${t.next}">${icon('chevron-right', 14)}</button></div>
      <div class="ixc-mini-g">${cells}</div>`;
    const cals = o.calendars || [];
    const counts = new Map();
    for (const e of this.events) counts.set(String(e.calendar), (counts.get(String(e.calendar)) || 0) + 1);
    this.side.querySelector('.ixc-cals').innerHTML = cals.length ? `<div class="ixc-side-h">${t.calendars}</div>` + cals.map((c) => `
      <label class="ixc-cal" style="--c:${c.color || 'var(--ixc-accent)'}">
        <input type="checkbox" data-cal="${escHTML(c.id)}" ${this.state.hidden.has(c.id) ? '' : 'checked'}><span class="ixc-check">${icon('check', 11)}</span>
        <span class="ixc-cal-n">${escHTML(c.name || c.id)}</span><em>${counts.get(String(c.id)) || ''}</em>
        <button data-only="${escHTML(c.id)}">${t.only}</button></label>`).join('') : '';
    this._parts(this.side);
  }

  /** A non-interactive shaded block for `display: 'background'` events. */
  bgHTML(i, style) {
    const label = i.title ? `<span>${escHTML(i.title)}</span>` : '';
    return `<div class="ixc-bgev${this.o.eventClass ? ` ${this.o.eventClass(this._pub(i)) || ''}` : ''}" style="${style};--c:${this.colorOf(i)}" title="${escHTML(i.title || '')}">${label}</div>`;
  }
  evHTML(i, x) {
    const t = this.t, L = this.locale;
    const cls = ['ixc-ev', `ixc-ev--${x.variant}`];
    if (x.cls) cls.push(x.cls.trim());
    if (this.state.selected === i.key) cls.push('ixc-sel');
    if (this._clash.has(i.key)) cls.push('ixc-clashing');
    if (i.display === 'selection') cls.push('ixc-selection');
    if (this._draftId != null && String(i.id) === String(this._draftId)) cls.push('ixc-draft');
    if (i.end < this.now()) cls.push('ixc-past');
    if (this.o.eventClass) { const c = this.o.eventClass(this._pub(i)); if (c) cls.push(c); }
    const editable = this._editable(i);
    if (!editable) cls.push('ixc-ro');
    let inner = null;
    if (this.o.eventContent) {
      const r = this.o.eventContent(this._pub(i), { view: this.state.view, variant: x.variant, width: x.width ?? null, height: x.height ?? null });
      if (r != null) inner = typeof r === 'string' ? r : r.outerHTML;
    }
    if (inner == null) {
      const title = `<b class="ixc-ev-t">${this.hl(i.title || t.untitled)}</b>`;
      const time = i.allDay ? '' : D.timeStr(i.start, L);
      const rep = i.rrule ? icon('repeat', 11) : '';
      if (x.variant === 'box') {
        // pick a layout that fits the box, so text is never cut in the middle of a line
        const H = x.height, W = x.width || 200;
        const narrow = W < 74;
        if (narrow) cls.push('ixc-narrow');
        if (H < 34) {
          cls.push('ixc-short');
          inner = W >= 150 ? `${title}<span class="ixc-ev-time">${time}</span>` : title;
        } else {
          const showTime = !narrow || H >= 64;
          const loc = !narrow && H >= 84 && i.location;
          const lines = Math.max(1, Math.floor((H - 8 - (showTime ? 15 : 0) - (loc ? 15 : 0)) / 15));
          inner = `<b class="ixc-ev-t" style="-webkit-line-clamp:${lines};max-height:${lines * 15}px">${this.hl(i.title || t.untitled)}</b>`;
          if (showTime) inner += `<span class="ixc-ev-time">${time}${W >= 118 ? ` – ${D.timeStr(i.end, L)}` : ''}${W >= 140 ? rep : ''}</span>`;
          if (loc) inner += `<span class="ixc-ev-loc">${icon('pin', 11)}<span>${escHTML(i.location)}</span></span>`;
        }
      } else if (x.variant === 'dot') {
        inner = `<i class="ixc-dot"></i><span class="ixc-ev-time">${time}</span>${title}`;
      } else {
        // bars with a known pixel width (timeline) drop extras when space runs out
        const W = x.width;
        if (W != null && W < 30) { cls.push('ixc-tiny'); inner = ''; }
        else if (W != null && W < 90) { cls.push('ixc-narrow'); inner = title; }
        else inner = `${time ? `<span class="ixc-ev-time">${time}</span>` : ''}${title}${rep}`;
      }
    }
    const rs = editable && x.resizeStart ? '<i class="ixc-rs ixc-rs-s" data-resize="start"></i>' : '';
    const re = editable && x.resize ? '<i class="ixc-rs ixc-rs-e" data-resize="end"></i>' : '';
    const label = `${i.title || t.untitled}, ${this._when(i)}`;
    const tip = cls.includes('ixc-tiny') || cls.includes('ixc-narrow') || cls.includes('ixc-short') ? ` title="${escHTML(label)}"` : '';
    return `<div class="${cls.join(' ')}" data-key="${escHTML(i.key)}" role="button" aria-label="${escHTML(label)}"${tip} style="${x.style};--c:${this.colorOf(i)}">${rs}<div class="ixc-ev-in">${inner}</div>${re}</div>`;
  }

  // ---------------------------------------------------------------- events wiring
  _bind() {
    const r = this.root;
    this._h = {
      click: (e) => this._onClick(e),
      dbl: (e) => this._onDbl(e),
      down: (e) => this._onDown(e),
      move: (e) => this._onMove(e),
      up: (e) => this._onUp(e),
      key: (e) => this._onKey(e),
      docDown: (e) => {
        if (this._pop && !this._pop.contains(e.target) && !e.target.closest?.('.ixc-ev,.ixc-ag-row')) this.closePopover();
      },
      enter: () => { this._hover = true; },
      leave: () => { this._hover = false; this._hoverHit = null; },
      wheel: (e) => {
        if ((e.ctrlKey || e.metaKey) && this._view().zoomable) { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1 : -1); }
      },
    };
    r.addEventListener('click', this._h.click);
    this.main.addEventListener('dblclick', this._h.dbl);
    this.main.addEventListener('pointerdown', this._h.down);
    this.main.addEventListener('pointermove', this._h.move);
    this.main.addEventListener('pointerup', this._h.up);
    this.main.addEventListener('pointercancel', this._h.up);
    this.main.addEventListener('wheel', this._h.wheel, { passive: false });
    r.addEventListener('pointerenter', this._h.enter);
    r.addEventListener('pointerleave', this._h.leave);
    document.addEventListener('keydown', this._h.key);
    document.addEventListener('pointerdown', this._h.docDown, true);

    r.addEventListener('change', (e) => {
      const c = e.target.closest('[data-cal]');
      if (c) {
        const id = (this.o.calendars || []).find((x) => String(x.id) === c.dataset.cal)?.id ?? c.dataset.cal;
        this.toggleCalendar(id, c.checked);
      }
    });
    if (typeof ResizeObserver !== 'undefined') {
      let w = 0, h = 0;
      this._ro = new ResizeObserver(([en]) => {
        const { width, height } = en.contentRect;
        if (Math.abs(width - w) < 2 && Math.abs(height - h) < 2) return;
        w = width; h = height;
        cancelAnimationFrame(this._roF);
        this._roF = requestAnimationFrame(() => { if (!this.drag) { this._renderBar(); this.renderMain(); } });
      });
      this._ro.observe(this.main);
    }
    this._tick = setInterval(() => { if (!this.drag && this._view().kind === 'time') this.renderMain(); }, 60000);
  }
  destroy() {
    this._unregister?.();
    for (const s of this._sources || []) s.ctrl?.abort();
    this.closePopover(true);
    this.closePalette();
    document.removeEventListener('keydown', this._h.key);
    document.removeEventListener('pointerdown', this._h.docDown, true);
    this._ro?.disconnect();
    this._mq?.removeEventListener?.('change', this._mqH);
    clearInterval(this._tick);
    this.root.remove();
    this._listeners.clear();
  }

  _qaPreview() {
    const v = this._qa.value.trim();
    if (!v) { this._qaPrev.innerHTML = this.t.quickAddHint; this._qaPrev.classList.remove('ixc-on'); return; }
    this._qaPrev.classList.add('ixc-on');
    this._qaPrev.innerHTML = this._parseChips(this.parse(v));
  }
  _parseChips(p) {
    const t = this.t;
    const chips = [`<span class="ixc-chip">${icon('calendar', 12)}${escHTML(this._when(p))}</span>`];
    const c = p.calendar != null && (this.o.calendars || []).find((x) => x.id === p.calendar);
    if (c) chips.push(`<span class="ixc-chip" style="--c:${c.color}"><i class="ixc-dot"></i>${escHTML(c.name)}</span>`);
    const r = p.resourceId != null && (this.o.resources || []).find((x) => x.id === p.resourceId);
    if (r) chips.push(`<span class="ixc-chip">${icon('users', 12)}${escHTML(r.title)}</span>`);
    if (p.rrule) chips.push(`<span class="ixc-chip">${icon('repeat', 12)}${describeRule(p.rrule, t, this.locale)}</span>`);
    return `<b>${escHTML(p.title || t.untitled)}</b>${chips.join('')}`;
  }

  _onClick(e) {
    const a = e.target.closest('[data-act]');
    if (a && this.root.contains(a)) {
      const act = a.dataset.act;
      const map = {
        today: () => this.today(), prev: () => this.prev(), next: () => this.next(),
        sidebar: () => this.toggleSidebar(), palette: () => this.openPalette(),
        'zoom-in': () => this.zoom(1), 'zoom-out': () => this.zoom(-1),
        clashes: () => { this.state.clashFocus = !this.state.clashFocus; this._applyTheme(); this._renderClash(); },
        'mini-prev': () => { this.state.mini = D.addMonths(this.state.mini || D.startOfMonth(this.state.date), -1); this._renderSide(); },
        'mini-next': () => { this.state.mini = D.addMonths(this.state.mini || D.startOfMonth(this.state.date), 1); this._renderSide(); },
      };
      map[act]?.();
      return;
    }
    const v = e.target.closest('[data-view]');
    if (v && this.bar.contains(v)) { this.setView(v.dataset.view); return; }
    const g = e.target.closest('[data-goto]');
    if (g) { this.gotoDate(g.dataset.goto); return; }
    const only = e.target.closest('[data-only]');
    if (only) {
      e.preventDefault();
      for (const c of this.o.calendars || []) (String(c.id) === only.dataset.only ? this.state.hidden.delete(c.id) : this.state.hidden.add(c.id));
      this.renderMain(); this._renderSide();
      return;
    }
    const gd = e.target.closest('[data-goto-day]');
    if (gd) { this.setView(this.o.views.includes('day') ? 'day' : this.state.view, gd.dataset.gotoDay); return; }
    const gm = e.target.closest('[data-goto-month]');
    if (gm) { this.setView(this.o.views.includes('month') ? 'month' : this.state.view, gm.dataset.gotoMonth); return; }
    const more = e.target.closest('[data-more]');
    if (more) { this._openMore(more.dataset.more, more); return; }
    const tg = e.target.closest('[data-toggle]');
    if (tg && this.main.contains(tg)) { this.toggleResource(tg.dataset.toggle); return; }
    const book = e.target.closest('[data-book]');
    if (book) { this.bookHighlight(); }
  }
  toggleSidebar(v) {
    this.state.sidebar = v ?? !this.state.sidebar;
    this._applyTheme();
    this._renderSide();
  }

  _onDbl(e) {
    if (e.target.closest('[data-key],button')) return;
    const v = this._view();
    const h = v.hit?.(this, e.clientX, e.clientY);
    if (!h || !this.o.selectable || !this.o.editable) return;
    this._createAt(h);
  }
  _createAt(h, { title = '' } = {}) {
    const day = h.kind === 'day';
    const ev = this._norm({
      title,
      start: day ? D.startOfDay(h.date) : h.date,
      end: day ? D.addDays(D.startOfDay(h.date), 1) : D.addMinutes(h.date, this.o.defaultDuration),
      allDay: day, calendar: this._defaultCal(), resourceId: h.resourceId ?? undefined,
    });
    const snap = this._snap();
    this.events.push(ev);
    this.renderMain();
    this._openAfterRender(String(ev.id), { isNew: true, snapshot: snap });
  }
  _openAfterRender(key, opts) {
    this.state.selected = key;
    this.renderMain();
    const el = this.main.querySelector(`[data-key="${CSS.escape(key)}"]`);
    this.openEditor(key, el, opts);
  }

  // ---- drag engine
  _onDown(e) {
    if (e.button !== 0 || this.drag) return;
    if (e.target.closest('[data-goto-day],[data-more],[data-book],[data-goto-month],[data-toggle],input,select,textarea')) return;
    this.root.focus({ preventScroll: true });
    const v = this._view();
    const evEl = e.target.closest('[data-key]');
    const handle = e.target.closest('[data-resize]');
    const touch = e.pointerType === 'touch';
    const hit0 = v.hit?.(this, e.clientX, e.clientY) || null;
    let mode, inst = null;
    if (evEl) {
      inst = this._instByKey(evEl.dataset.key);
      if (!inst) return;
      mode = handle ? `resize-${handle.dataset.resize}` : 'move';
      if (!this._editable(inst) || !hit0) mode = 'click';
      if (touch && this.state.selected !== inst.key) mode = 'click';
    } else {
      if (!hit0 || !this.o.selectable || !this.o.editable) { this._downEmpty = hit0; return; }
      mode = touch ? 'press' : 'create';
    }
    this.drag = { mode, inst, hit0, x: e.clientX, y: e.clientY, started: false, evEl, id: e.pointerId };
    if (mode === 'press') {
      this.drag.timer = setTimeout(() => {
        const d = this.drag;
        if (d && d.mode === 'press' && !d.cancel) { this.drag = null; navigator.vibrate?.(10); this._createAt(d.hit0); }
      }, 450);
    }
    if (mode !== 'click' && mode !== 'press') {
      try { this.main.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    }
  }
  _onMove(e) {
    const v = this._view();
    if (!this.drag) {
      if (v.hit && e.pointerType === 'mouse') this._hoverHit = v.hit(this, e.clientX, e.clientY);
      return;
    }
    const d = this.drag;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) return;
      if (d.mode === 'press') { clearTimeout(d.timer); d.cancel = true; this.drag = null; return; }
      if (d.mode === 'click') return;
      d.started = true;
      d.snapshot = this._snap();
      this.closePopover(true);
      this.root.classList.add('ixc-dragging');
      if (d.mode === 'create') {
        const ev = this._norm({ title: '', start: d.hit0.date, end: D.addMinutes(d.hit0.date, this.o.snapMinutes), allDay: d.hit0.kind === 'day', calendar: this._defaultCal(), resourceId: d.hit0.resourceId ?? undefined });
        this.events.push(ev);
        this._draftId = ev.id;
        d.srcId = ev.id;
      } else {
        d.srcId = d.inst.id;
        const s = this._byId(d.srcId);
        d.orig = { start: new Date(s.start), end: new Date(s.end), allDay: s.allDay, resourceId: s.resourceId, resourceIds: s.resourceIds ? [...s.resourceIds] : undefined };
        this.state.selected = d.inst.key;
      }
      this.root.dataset.drag = d.mode;
    }
    // auto-scroll near edges
    const sc = v.scroller?.(this);
    if (sc) {
      const r = sc.getBoundingClientRect();
      const top = r.top + (sc.querySelector('.ixc-tg-sticky,.ixc-tl-head')?.offsetHeight || 0);
      if (e.clientY < top + 24) sc.scrollTop -= 14; else if (e.clientY > r.bottom - 24) sc.scrollTop += 14;
      if (e.clientX > r.right - 24) sc.scrollLeft += 14; else if (e.clientX < r.left + 24 + (this.state.view === 'timeline' ? 180 : 0)) sc.scrollLeft -= 14;
    }
    if (d.mode === 'move' && !d.inst.recurring) { // a whole series does not travel between calendars
      const other = calendarAt(e.clientX, e.clientY, this);
      if (other) {
        if (d.leaving !== other) {
          d.leaving?._extLeave();
          d.leaving = other;
          const src = this._byId(d.srcId);
          Object.assign(src, { start: new Date(d.orig.start), end: new Date(d.orig.end), allDay: d.orig.allDay, resourceId: d.orig.resourceId });
          this.root.classList.add('ixc-leaving');
          d.hk = null;
          this.renderMain();
        }
        const src = this._byId(d.srcId);
        const { key, recurring, rrule, exdates, ...data } = this._pub(src);
        other._extOver({ ...data, duration: src.allDay ? undefined : (src.end - src.start) / D.MIN }, e.clientX, e.clientY);
        return;
      }
      if (d.leaving) { d.leaving._extLeave(); d.leaving = null; this.root.classList.remove('ixc-leaving'); }
    }
    const hit = v.hit(this, e.clientX, e.clientY);
    if (!hit) return;
    const hk = `${hit.kind}${+hit.date}${hit.resourceId}`;
    if (hk === d.hk) return;
    d.hk = hk;
    this._apply(d, hit);
    d.moved = true;
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this.renderMain());
  }
  /** Applies one drag step, then asks `eventAllow` and rolls back if the new position is refused. */
  _apply(d, hit) {
    const src = this._byId(d.srcId);
    if (!src) return;
    const prev = { start: src.start, end: src.end, allDay: src.allDay, resourceId: src.resourceId, resourceIds: src.resourceIds };
    this._applyRaw(d, hit);
    const ok = this._allowed(d, src);
    d.denied = !ok;
    this.root.classList.toggle('ixc-denied', !ok);
    if (!ok) Object.assign(src, prev);
  }
  /** The occurrence being dragged, at its new position. */
  _window(d, src) {
    if (d.mode === 'create' || !d.inst) return { start: src.start, end: src.end };
    const start = new Date(+d.inst.start + (src.start - d.orig.start));
    return { start, end: new Date(+start + (src.end - src.start)) };
  }
  /** Checks validRange, selectAllow / eventAllow and the overlap rules for a drag step. */
  _allowed(d, src) {
    const o = this.o;
    const win = this._window(d, src);
    const vr = o.validRange;
    if (vr && ((vr.start && win.start < D.toDate(vr.start)) || (vr.end && win.end > D.toDate(vr.end)))) return false;
    const creating = d.mode === 'create';
    if (creating && typeof o.selectAllow === 'function') {
      if (o.selectAllow({ start: win.start, end: win.end, allDay: src.allDay, resourceId: src.resourceId ?? null }) === false) return false;
    }
    if (typeof o.eventAllow === 'function') {
      if (o.eventAllow(this._pub(src), { action: d.mode, old: d.orig ? { ...d.orig } : null, resourceId: src.resourceId ?? null }) === false) return false;
    }
    const rule = creating ? o.selectOverlap : o.eventOverlap;
    if (rule === true || rule == null) return true;
    const mine = this.resourcesOf(src).map(String);
    for (const other of this.events) {
      if (other === src || other.display === 'background') continue;
      const theirs = this.resourcesOf(other).map(String);
      const shared = !mine.length && !theirs.length ? true : mine.some((r) => theirs.includes(r));
      if (!shared) continue;
      for (const i of expand(other, win.start, win.end)) {
        if (i.allDay !== src.allDay) continue;
        if (rule === false) return false;
        if (typeof rule === 'function' && rule(this._pub(i), creating ? null : this._pub(src)) === false) return false;
      }
    }
    return true;
  }
  _applyRaw(d, hit) {
    const src = this._byId(d.srcId);
    const h0 = d.hit0;
    const snapMs = (hit.snap || this.o.snapMinutes) * D.MIN;
    if (d.mode === 'create') {
      if (h0.kind === 'day' || hit.kind === 'day') {
        const a = D.startOfDay(h0.date < hit.date ? h0.date : hit.date), b = D.startOfDay(h0.date < hit.date ? hit.date : h0.date);
        src.start = a; src.end = D.addDays(b, 1); src.allDay = true;
      } else {
        let a = h0.date, b = hit.date;
        if (b < a) [a, b] = [b, a];
        src.start = a; src.end = new Date(b.getTime() + snapMs); src.allDay = false;
      }
      return;
    }
    const inst = d.inst, o = d.orig;
    let ns = inst.start, ne = inst.end, allDay = inst.allDay, dayShift = null;
    if (d.mode === 'move') {
      if (h0.kind === 'time' && hit.kind === 'time') {
        const dm = hit.date - h0.date;
        if (inst.allDay) { dayShift = Math.round(dm / D.DAY_MS); }
        else { ns = new Date(+inst.start + dm); ne = new Date(+inst.end + dm); }
      } else if (h0.kind === 'day' && hit.kind === 'day') {
        dayShift = D.diffDays(h0.date, hit.date); // keeps time of day
      } else if (hit.kind === 'day') {
        ns = D.startOfDay(hit.date); ne = D.addDays(ns, 1); allDay = true;
      } else {
        ns = hit.date; ne = D.addMinutes(ns, inst.allDay ? this.o.defaultDuration : (inst.end - inst.start) / D.MIN); allDay = false;
      }
      if (dayShift != null) {
        src.start = D.addDays(o.start, dayShift); src.end = D.addDays(o.end, dayShift); src.allDay = o.allDay;
      }
      if (hit.resourceId !== undefined) {
        const r = this._resourceById(hit.resourceId);
        if (Array.isArray(o.resourceIds) && o.resourceIds.length) {
          const from = String(h0.resourceId);
          const next = o.resourceIds.map((x) => (String(x) === from && r ? r.id : x));
          src.resourceIds = next.filter((x, k) => next.findIndex((y) => String(y) === String(x)) === k);
        } else src.resourceId = r ? r.id : null;
      }
    } else if (d.mode === 'resize-end') {
      if (hit.kind === 'time' && !inst.allDay) ne = new Date(Math.max(+hit.date + snapMs, +ns + snapMs));
      else if (hit.kind === 'time') ne = D.addDays(D.startOfDay(hit.date), 1);
      else if (inst.allDay) ne = D.addDays(D.startOfDay(hit.date), 1);
      else { ne = new Date(hit.date); ne.setHours(inst.end.getHours(), inst.end.getMinutes()); }
      if (ne <= ns) ne = inst.allDay ? D.addDays(D.startOfDay(ns), 1) : new Date(+ns + snapMs);
    } else if (d.mode === 'resize-start') {
      if (hit.kind === 'time' && !inst.allDay) ns = new Date(Math.min(+hit.date, +ne - snapMs));
      else ns = D.startOfDay(hit.date);
      if (ns >= ne) ns = inst.allDay ? D.addDays(D.startOfDay(ne), -1) : new Date(+ne - snapMs);
    }
    if (dayShift == null) {
      src.start = new Date(+o.start + (ns - inst.start));
      src.end = new Date(+src.start + (ne - ns));
      src.allDay = allDay;
      if (allDay) { src.start = D.startOfDay(src.start); src.end = D.addDays(src.start, Math.max(1, D.diffDays(ns, ne))); }
    }
  }
  _onUp(e) {
    const d = this.drag;
    if (!d) {
      if (this._downEmpty !== undefined && e.type === 'pointerup') {
        this.select(null);
        if (this._downEmpty) this._emit('dateClick', { ...this._downEmpty, date: this._out(this._downEmpty.date) });
      }
      this._downEmpty = undefined;
      return;
    }
    this.drag = null;
    clearTimeout(d.timer);
    try { this.main.releasePointerCapture(d.id); } catch { /* ignore */ }
    this.root.classList.remove('ixc-dragging', 'ixc-denied');
    delete this.root.dataset.drag;
    if (e.type === 'pointercancel' && d.started) { this._cancelDrag(d); return; }
    if (!d.started) {
      if (d.mode === 'press') { this.select(null); return; }
      if (d.inst) {
        if (this.o.unselectAuto) this.unselect();
        this.select(d.inst.key);
        const el = this.main.querySelector(`[data-key="${CSS.escape(d.inst.key)}"]`) || d.evEl;
        this._emit('eventClick', { event: this._pub(this._byId(d.inst.id)), instance: { start: d.inst.start, end: d.inst.end }, el });
        this.openEditor(d.inst.key, el);
      } else {
        this.select(null);
        if (this.o.unselectAuto) this.unselect();
        if (d.hit0) this._emit('dateClick', { ...d.hit0, date: this._out(d.hit0.date) });
      }
      return;
    }
    cancelAnimationFrame(this._raf);
    const src = this._byId(d.srcId);
    if (d.leaving) {
      // dropped on another calendar: it receives a copy, this one lets the event go
      this.root.classList.remove('ixc-leaving');
      const received = d.leaving._extDrop({ from: this });
      if (!received) { this._cancelDrag(d); return; }
      this.events = this.events.filter((x) => x !== src);
      this._push(d.snapshot, 'leave');
      this.state.selected = null;
      this._changed();
      this._emit('eventLeave', { event: this._pub(src), to: d.leaving });
      return;
    }
    // dropped on a refused spot (or a selection that never became valid): put everything back
    if (d.denied || (d.mode === 'create' && src && !this._allowed(d, src))) {
      this._cancelDrag(d);
      return;
    }
    if (d.mode === 'create' && this.o.selectMode === 'range') {
      this._draftId = null;
      this.events = this.events.filter((e) => e !== src);
      this.selectRange({ start: src.start, end: src.end, allDay: src.allDay, resourceId: src.resourceId ?? null });
      return;
    }
    if (d.mode === 'create') {
      this._draftId = null;
      const key = src.rrule ? `${src.id}@${D.ymd(src.start)}` : String(src.id);
      this._openAfterRender(key, { isNew: true, snapshot: d.snapshot });
      return;
    }
    const changed = +src.start !== +d.orig.start || +src.end !== +d.orig.end || src.allDay !== d.orig.allDay || src.resourceId !== d.orig.resourceId || String(src.resourceIds) !== String(d.orig.resourceIds);
    if (changed) {
      this._push(d.snapshot, d.mode);
      this.state.selected = src.rrule ? `${src.id}@${D.ymd(new Date(+d.inst.start + (src.start - d.orig.start)))}` : String(src.id);
      this._emit('eventUpdate', { event: this._pub(src), old: { ...this._pub(src), ...d.orig } });
      this._changed();
    } else this.renderMain();
  }
  // ---------------------------------------------------------------- drops from outside / other calendars
  /** Preview of an event being dragged in from outside (an element or another calendar). */
  _extOver(data, x, y) {
    const v = this._view();
    const hit = v.hit?.(this, x, y);
    if (!hit) { this._extLeave(); return; }
    let ex = this._ext;
    if (!ex) {
      const { duration, ...rest } = data;
      const draft = this._norm({ ...rest, id: rest.id != null && !this._byId(rest.id) ? rest.id : undefined, start: hit.date });
      ex = this._ext = { snapshot: this._snap(), draft, duration: duration ?? (data.start && data.end ? (D.toDate(data.end) - D.toDate(data.start)) / D.MIN : null), data };
      this.events.push(draft);
      this._draftId = draft.id;
    }
    const src = ex.draft;
    const day = hit.kind === 'day';
    const allDay = ex.data.allDay ?? day;
    if (allDay) {
      const days = Math.max(1, ex.data.start && ex.data.end && ex.data.allDay ? D.diffDays(D.toDate(ex.data.start), D.toDate(ex.data.end)) : 1);
      src.start = D.startOfDay(hit.date); src.end = D.addDays(src.start, days); src.allDay = true;
    } else {
      src.start = day ? D.atMinutes(hit.date, 9 * 60) : hit.date;
      src.end = D.addMinutes(src.start, ex.duration || this.o.defaultDuration); src.allDay = false;
    }
    if (hit.resourceId !== undefined) src.resourceId = hit.resourceId;
    ex.ok = this._allowed({ mode: 'create' }, src);
    this.root.classList.toggle('ixc-denied', !ex.ok);
    this.root.classList.add('ixc-receiving');
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this.renderMain());
  }
  _extLeave() {
    const ex = this._ext;
    if (!ex) return;
    this._ext = null;
    this._draftId = null;
    this.events = this.events.filter((e) => e !== ex.draft);
    this.root.classList.remove('ixc-denied', 'ixc-receiving');
    cancelAnimationFrame(this._raf);
    this.renderMain();
  }
  /** Finishes a drop. Returns the new event, or null when it was refused. */
  _extDrop(info = {}) {
    const ex = this._ext;
    if (!ex) return null;
    if (!ex.ok) { this._extLeave(); return null; }
    this._ext = null;
    this._draftId = null;
    this.root.classList.remove('ixc-denied', 'ixc-receiving');
    this._push(ex.snapshot, 'receive');
    const ev = this._pub(ex.draft);
    this.state.selected = String(ex.draft.id);
    this._changed();
    this._emit('eventReceive', { event: ev, ...info });
    this._emit('eventCreate', { event: ev });
    return ev;
  }
  /** Shows a selected range (like a drag in selectMode 'range') and emits `select`. */
  selectRange({ start, end, allDay = false, resourceId = null }) {
    const w = (v) => (this.o.timeZone && isInstant(v) ? toWall(new Date(v), this.o.timeZone) : D.toDate(v));
    const sel = { start: w(start), end: w(end), allDay: !!allDay, resourceId };
    this.state.selection = sel;
    this.renderMain();
    this._emit('select', { ...sel, start: sel.allDay ? new Date(sel.start) : this._out(sel.start), end: sel.allDay ? new Date(sel.end) : this._out(sel.end) });
    return sel;
  }
  unselect() {
    if (!this.state.selection) return;
    this.state.selection = null;
    this.renderMain();
    this._emit('unselect', {});
  }
  getSelection() { const s = this.state.selection; return s ? { ...s, start: s.allDay ? new Date(s.start) : this._out(s.start), end: s.allDay ? new Date(s.end) : this._out(s.end) } : null; }
  /** Resources without children, in tree order (columns of the resource day view). */
  _leafResources() { return this._flatResources().filter((r) => !(r.children && r.children.length)); }
  /** Rows for the timeline: group headers, nested resources with depth, collapsed parts left out. */
  _resourceRows() {
    const rows = [];
    const collapsed = this.state.collapsed;
    const count = (r) => 1 + (r.children || []).reduce((s, c) => s + count(c), 0);
    const walk = (list, depth) => {
      for (const r of list || []) {
        const hasChildren = !!(r.children && r.children.length);
        const isCollapsed = collapsed.has(`r:${r.id}`);
        rows.push({ r, depth, hasChildren, collapsed: isCollapsed });
        if (hasChildren && !isCollapsed) walk(r.children, depth + 1);
      }
    };
    let lastGroup;
    for (const r of this.o.resources || []) {
      if (r.group && r.group !== lastGroup) {
        const members = (this.o.resources || []).filter((x) => x.group === r.group);
        rows.push({ group: r.group, collapsed: collapsed.has(`g:${r.group}`), count: members.reduce((s, x) => s + count(x), 0) });
      }
      lastGroup = r.group;
      if (r.group && collapsed.has(`g:${r.group}`)) continue;
      walk([r], 0);
    }
    return rows;
  }
  toggleResource(key) {
    const c = this.state.collapsed;
    c.has(key) ? c.delete(key) : c.add(key);
    this.renderMain();
  }
  _resourceById(id) { return id == null ? null : this._flatResources().find((x) => String(x.id) === String(id)) || null; }
  _flatResources() {
    const out = [];
    const walk = (list) => { for (const r of list || []) { out.push(r); if (r.children) walk(r.children); } };
    walk(this.o.resources);
    return out;
  }
  _cancelDrag(d) {
    this.events = d.snapshot;
    this._draftId = null;
    this.renderMain();
  }
  select(key) {
    if (this.state.selected === key) return;
    this.state.selected = key;
    this.main.querySelectorAll('.ixc-sel').forEach((el) => el.classList.remove('ixc-sel'));
    if (key != null) this.main.querySelectorAll(`[data-key="${CSS.escape(key)}"]`).forEach((el) => el.classList.add('ixc-sel'));
  }

  // ---- keyboard
  _active() { return this.root.contains(document.activeElement) || this._hover || (this._pal && this._pal.isConnected); }
  _onKey(e) {
    if (!this.o.keyboard || !this._active()) return;
    const k = e.key;
    const mod = e.ctrlKey || e.metaKey;
    const tgt = e.target;
    const typing = tgt && (/^(INPUT|TEXTAREA|SELECT)$/.test(tgt.tagName) || tgt.isContentEditable);
    if (mod && k.toLowerCase() === 'k' && this.o.palette) { e.preventDefault(); this._pal ? this.closePalette() : this.openPalette(); return; }
    if (k === 'Escape') {
      if (this.drag && this.drag.started) { const d = this.drag; this.drag = null; this.root.classList.remove('ixc-dragging'); this._cancelDrag(d); return; }
      if (this._pal) { this.closePalette(); return; }
      if (this._pop) { this.closePopover(false, true); this.root.focus(); return; }
      if (this.state.highlight) { this.state.highlight = null; this.renderMain(); return; }
      if (this.state.selection) { this.unselect(); return; }
      this.select(null);
      return;
    }
    if (typing) return;
    const sel = this.state.selected;
    if (mod) {
      const l = k.toLowerCase();
      if (l === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
      else if (l === 'y') { e.preventDefault(); this.redo(); }
      else if (l === 'c' && sel) { e.preventDefault(); this.copy(sel); }
      else if (l === 'v' && this._clip) { e.preventDefault(); this.paste(); }
      else if (l === 'd' && sel) { e.preventDefault(); this.duplicate(sel); }
      return;
    }
    if (e.altKey) return;
    const views = this.o.views;
    const viewKey = Object.entries(VIEW_KEYS).find(([v, key]) => key === k.toLowerCase() && views.includes(v));
    let handled = true;
    if (viewKey) this.setView(viewKey[0]);
    else if (k === 't' || k === 'T') this.today();
    else if (k === 'ArrowLeft' || k === 'j' || k === 'p') this.prev();
    else if (k === 'ArrowRight' || k === 'k') this.next();
    else if (k === 'n' || k === 'c') this.newEvent();
    else if (k === '/') this._search.focus();
    else if (k === 'f') this.showFreeSlot(30);
    else if (k === 'b') this.toggleSidebar();
    else if (k === '+' || k === '=') this.zoom(1);
    else if (k === '-' || k === '_') this.zoom(-1);
    else if (k === '?') this.openPalette();
    else if ((k === 'Delete' || k === 'Backspace') && sel) this.deleteInstance(sel);
    else if (k === 'Enter' && sel) this.openEditor(sel, this.main.querySelector(`[data-key="${CSS.escape(sel)}"]`));
    else handled = false;
    if (handled) e.preventDefault();
  }
  newEvent() {
    if (this.state.sidebar && this._qa && this._qa.offsetParent) { this._qa.focus(); return; }
    if (this.o.palette) { this.openPalette(); return; }
    const h = this._view().kind === 'time' ? { kind: 'time', date: D.atMinutes(this.state.date, 9 * 60) } : { kind: 'day', date: this.state.date };
    this._createAt(h);
  }
  copy(key) {
    const i = this._instByKey(key);
    if (!i) return;
    this._clip = { ...this._pub(i), start: new Date(i.start), end: new Date(i.end) };
    delete this._clip.rrule; delete this._clip.exdates;
    this._toast(this.t.copied);
  }
  paste() {
    const c = this._clip;
    if (!c) return;
    const h = this._hoverHit;
    let start;
    if (h && h.kind === 'time') start = h.date;
    else if (h) { start = D.startOfDay(h.date); if (!c.allDay) start.setHours(c.start.getHours(), c.start.getMinutes()); }
    else start = D.addDays(c.start, 1);
    const ev = this._norm({ ...c, id: undefined, start, end: new Date(+start + (c.end - c.start)), resourceId: h && h.resourceId !== undefined ? h.resourceId : c.resourceId });
    if (c.allDay) ev.end = D.addDays(ev.start, D.diffDays(c.start, c.end));
    this._mutate('paste', () => this.events.push(ev));
    this.select(String(ev.id));
    this.renderMain();
    this._emit('eventCreate', { event: this._pub(ev) });
    this._toast(this.t.pasted, { label: this.t.undo, run: () => this.undo() });
  }
  duplicate(key) {
    const i = this._instByKey(key);
    if (!i) return;
    this.closePopover();
    const src = this._byId(i.id);
    const ev = this._norm({ ...this._pub(src), start: new Date(src.start), end: new Date(src.end), id: undefined });
    this._mutate('duplicate', () => this.events.push(ev));
    this._emit('eventCreate', { event: this._pub(ev) });
    const k = ev.rrule ? `${ev.id}@${D.ymd(i.start)}` : String(ev.id);
    this._openAfterRender(k);
    this._toast(this.t.duplicated, { label: this.t.undo, run: () => this.undo() });
  }
  deleteInstance(key, { series = false } = {}) {
    const i = this._instByKey(key);
    if (!i) return;
    const src = this._byId(i.id);
    this.closePopover(true);
    if (src.rrule && !series) {
      this._mutate('delete', () => { src.exdates = [...src.exdates, D.ymd(i.start)]; });
    } else {
      this._mutate('delete', () => { this.events = this.events.filter((e) => e !== src); });
    }
    this.state.selected = null;
    this.renderMain();
    this._emit('eventDelete', { event: this._pub(src), occurrence: src.rrule && !series ? i.start : null });
    this._toast(this.t.deleted, { label: this.t.undo, run: () => this.undo() });
  }

  // ---------------------------------------------------------------- popovers
  _popAt(cls, html, anchor) {
    this.closePopover(true);
    const pop = document.createElement('div');
    pop.className = `ixc-pop ${cls}`;
    pop.innerHTML = html;
    this.layer.appendChild(pop);
    this._pop = pop;
    this._parts(pop);
    this._placePop(anchor);
    return pop;
  }
  _placePop(anchor) {
    const pop = this._pop;
    if (!pop) return;
    const rr = this.root.getBoundingClientRect();
    if (rr.width < 560) { pop.classList.add('ixc-sheet'); return; }
    const a = anchor && anchor.isConnected ? anchor.getBoundingClientRect() : { left: rr.left + rr.width / 2 - 10, right: rr.left + rr.width / 2 + 10, top: rr.top + 80, bottom: rr.top + 100 };
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = a.right - rr.left + 10;
    if (x + pw > rr.width - 10) x = a.left - rr.left - pw - 10;
    if (x < 10) x = D.clamp(a.left - rr.left, 10, rr.width - pw - 10);
    let y = D.clamp(a.top - rr.top - 8, 10, Math.max(10, rr.height - ph - 10));
    pop.style.left = `${x}px`;
    pop.style.top = `${y}px`;
  }
  closePopover(silent = false, cancelled = false) {
    const pop = this._pop;
    if (!pop) return;
    this._pop = null;
    pop.remove();
    const ed = this._edit;
    this._edit = null;
    if (!ed || silent && !ed.dirty && !ed.isNew) return;
    const src = this._byId(ed.id);
    if (ed.isNew) {
      if (cancelled && src && !src.title) { this.events = ed.snapshot; this.renderMain(); return; }
      this._push(ed.snapshot, 'add');
      if (src) this._emit('eventCreate', { event: this._pub(src) });
      this._changed();
    } else if (ed.dirty) {
      this._push(ed.snapshot, 'edit');
      if (src) this._emit('eventUpdate', { event: this._pub(src), old: ed.old });
      this._changed();
    }
  }
  _openMore(day, anchor) {
    const d = D.toDate(day);
    const list = this.instances(d, D.addDays(d, 1));
    const L = this.locale;
    const rows = list.map((i) => `<button class="ixc-more-row" data-pick="${escHTML(i.key)}" style="--c:${this.colorOf(i)}"><i class="ixc-dot"></i><span>${i.allDay ? this.t.allDay : D.timeStr(i.start, L)}</span><b>${escHTML(i.title || this.t.untitled)}</b></button>`).join('');
    const pop = this._popAt('ixc-morepop', `<div class="ixc-pop-h"><b>${D.fmt(d, L, { weekday: 'long', month: 'long', day: 'numeric' })}</b><button class="ixc-ib" data-close>${icon('x', 14)}</button></div><div class="ixc-more-list">${rows}</div>`, anchor);
    pop.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { this.closePopover(); return; }
      const p = e.target.closest('[data-pick]');
      if (p) this.openEditor(p.dataset.pick, anchor);
    });
  }

  openEditor(key, anchor, { isNew = false, snapshot = null } = {}) {
    const inst = this._instByKey(key);
    if (!inst) return;
    const src = this._byId(inst.id);
    this.closePopover(true);
    this.select(key);
    this._edit = { key, id: src.id, isNew, snapshot: snapshot || this._snap(), old: this._pub(src), dirty: false, s: inst.start, e: inst.end, anchor };
    const pop = this._popAt('ixc-editor', '', anchor);
    pop.setAttribute('role', 'dialog');
    this._fillEditor();
    this._parts(pop);
    this._placePop(anchor);
    pop.addEventListener('input', (e) => this._edInput(e));
    pop.addEventListener('change', (e) => this._edInput(e, true));
    pop.addEventListener('click', (e) => this._edClick(e));
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.name === 'title') { e.preventDefault(); this.closePopover(); this.root.focus(); }
    });
    const ti = pop.querySelector('[name=title]');
    if (isNew || !src.title) ti.focus({ preventScroll: true });
  }
  _fillEditor() {
    const ed = this._edit, pop = this._pop;
    const src = this._byId(ed.id);
    const t = this.t;
    const ad = src.allDay;
    const endShown = ad ? D.addDays(ed.e, -1) : ed.e;
    const r = src.rrule;
    const rep = !r ? 'none'
      : r.freq === 'weekly' && r.byweekday && r.byweekday.join() === '1,2,3,4,5' ? 'weekdays'
        : r.freq === 'monthly' && r.bysetpos != null ? (r.bysetpos === -1 ? 'monthly-last' : 'monthly-nth')
          : r.freq === 'monthly' && r.bymonthday ? 'monthly' : r.interval > 1 || r.bymonth ? 'custom' : r.freq;
    const wp = weekdayPosition(ed.s);
    const wdName = D.fmt(ed.s, this.locale, { weekday: 'long' });
    const cals = this.o.calendars || [];
    const res = this.o.resources || [];
    const color = this.colorOf(src);
    const opt = (v, l, cur) => `<option value="${escHTML(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${escHTML(l)}</option>`;
    const ro = !this._editable(src);
    pop.style.setProperty('--c', color);
    pop.innerHTML = `
      <div class="ixc-ed-head"><span class="ixc-ed-bar"></span>
        <input class="ixc-ed-title" name="title" value="${escHTML(src.title)}" placeholder="${t.addTitle}" autocomplete="off" ${ro ? 'readonly' : ''}>
        <button class="ixc-ib" data-ed="close" aria-label="${t.done}">${icon('x', 15)}</button></div>
      <div class="ixc-ed-row">${icon('clock', 15)}<div class="ixc-ed-when">
        <input type="${ad ? 'date' : 'datetime-local'}" name="start" value="${D.toInput(ed.s, ad)}" ${ro ? 'readonly' : ''}>
        <span>→</span><input type="${ad ? 'date' : 'datetime-local'}" name="end" value="${D.toInput(endShown, ad)}" ${ro ? 'readonly' : ''}></div></div>
      <div class="ixc-ed-row ixc-ed-sub"><label class="ixc-toggle"><input type="checkbox" name="allDay" ${ad ? 'checked' : ''} ${ro ? 'disabled' : ''}><span></span>${t.allDay}</label>
        <span class="ixc-ed-dur">${this._dur(ed.e - ed.s, ad)}</span></div>
      <div class="ixc-ed-row">${icon('repeat', 15)}<select name="repeat" ${ro ? 'disabled' : ''}>
        ${opt('none', t.rNone, rep)}${opt('daily', t.rDaily, rep)}${opt('weekdays', t.rWeekdays, rep)}${opt('weekly', t.rWeekly, rep)}${opt('monthly', t.rMonthly, rep)}${wp.pos <= 4 ? opt('monthly-nth', t.rMonthlyNth(wp.pos, wdName), rep) : ''}${wp.last ? opt('monthly-last', t.rMonthlyLast(wdName), rep) : ''}${opt('yearly', t.rYearly, rep)}${rep === 'custom' ? opt('custom', describeRule(r, t, this.locale), rep) : ''}</select></div>
      ${r ? `<div class="ixc-ed-note">${t.seriesNote}</div>` : ''}
      ${cals.length ? `<div class="ixc-ed-row">${icon('layers', 15)}<select name="calendar" ${ro ? 'disabled' : ''}>${cals.map((c) => opt(c.id, c.name || c.id, src.calendar)).join('')}</select></div>` : ''}
      ${res.length ? `<div class="ixc-ed-row">${icon('users', 15)}<select name="resourceId" ${ro ? 'disabled' : ''}>${opt('', '—', src.resourceId ?? '')}${res.map((x) => opt(x.id, x.title || x.id, src.resourceId ?? '')).join('')}</select></div>` : ''}
      <div class="ixc-ed-row">${icon('pin', 15)}<input name="location" value="${escHTML(src.location || '')}" placeholder="${t.location}" ${ro ? 'readonly' : ''}></div>
      <div class="ixc-ed-row ixc-ed-top">${icon('note', 15)}<textarea name="notes" rows="2" placeholder="${t.notes}" ${ro ? 'readonly' : ''}>${escHTML(src.notes || '')}</textarea></div>
      ${ro ? '' : `<div class="ixc-ed-colors" role="radiogroup" aria-label="${t.color}">
        <button data-color="" class="ixc-sw-auto${!src.color ? ' ixc-on' : ''}" title="${t.auto}" aria-label="${t.auto}"></button>
        ${SWATCHES.map((c) => `<button data-color="${c}" style="--c:${c}" class="${src.color === c ? 'ixc-on' : ''}" aria-label="${c}"></button>`).join('')}</div>
      <div class="ixc-ed-foot">
        ${r ? `<button class="ixc-btn ixc-danger" data-ed="del-one">${icon('trash', 14)}${t.deleteOne}</button><button class="ixc-btn ixc-danger ixc-ghost" data-ed="del-all">${t.deleteAll}</button>`
    : `<button class="ixc-btn ixc-danger" data-ed="del-all">${icon('trash', 14)}${t.delete}</button>`}
        <button class="ixc-btn" data-ed="dup" title="${this._mod}+D">${icon('copy', 14)}${t.duplicate}</button>
        <span class="ixc-grow"></span><button class="ixc-btn ixc-primary" data-ed="close">${t.done}</button></div>`}`;
  }
  _dur(ms, allDay) {
    if (allDay) { const d = Math.round(ms / D.DAY_MS); return `${d} ${d === 1 ? this.t.day.toLowerCase() : this.t.days.toLowerCase()}`; }
    const m = Math.round(ms / D.MIN), h = Math.floor(m / 60), r = m % 60;
    return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
  }
  _edInput(e, isChange) {
    const ed = this._edit;
    if (!ed) return;
    const src = this._byId(ed.id);
    const el = e.target, name = el.name;
    if (!name || !this._editable(src)) return;
    const ad = src.allDay;
    let rebuild = false;
    if (name === 'title' || name === 'location' || name === 'notes') {
      if (isChange) return;
      src[name] = el.value;
    } else if (name === 'start') {
      const v = D.fromInput(el.value); if (!v || isNaN(v)) return;
      const delta = v - ed.s;
      src.start = new Date(+src.start + delta); src.end = new Date(+src.end + delta);
      ed.e = new Date(+ed.e + delta); ed.s = v;
      rebuild = 'end';
    } else if (name === 'end') {
      let v = D.fromInput(el.value); if (!v || isNaN(v)) return;
      if (ad) v = D.addDays(v, 1);
      if (v <= ed.s) return;
      src.end = new Date(+src.start + (v - ed.s)); ed.e = v;
      rebuild = 'dur';
    } else if (name === 'allDay') {
      if (el.checked) {
        src.start = D.startOfDay(src.start);
        const days = Math.max(1, D.diffDays(ed.s, new Date(ed.e - 1)) + 1);
        src.end = D.addDays(src.start, days);
        ed.s = D.startOfDay(ed.s); ed.e = D.addDays(ed.s, days);
      } else {
        src.start = D.atMinutes(src.start, 9 * 60); src.end = D.addMinutes(src.start, this.o.defaultDuration);
        ed.s = D.atMinutes(ed.s, 9 * 60); ed.e = D.addMinutes(ed.s, this.o.defaultDuration);
      }
      src.allDay = el.checked;
      rebuild = true;
    } else if (name === 'repeat') {
      const v = el.value;
      if (v === 'custom') return;
      const day = ed.s.getDay();
      src.rrule = v === 'none' ? null
        : v === 'weekdays' ? { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }
          : v === 'monthly-nth' ? { freq: 'monthly', byweekday: [day], bysetpos: weekdayPosition(ed.s).pos }
            : v === 'monthly-last' ? { freq: 'monthly', byweekday: [day], bysetpos: -1 }
              : { freq: v };
      if (!src.rrule) { // keep the occurrence the user was looking at
        const dur = src.end - src.start; src.start = new Date(ed.s); src.end = new Date(+ed.s + dur); src.exdates = [];
      }
      rebuild = true;
    } else if (name === 'calendar') {
      src.calendar = (this.o.calendars || []).find((c) => String(c.id) === el.value)?.id ?? el.value;
      this._pop.style.setProperty('--c', this.colorOf(src));
    } else if (name === 'resourceId') {
      src.resourceId = el.value === '' ? null : (this.o.resources || []).find((r) => String(r.id) === el.value)?.id ?? el.value;
    } else return;
    ed.dirty = true;
    ed.key = src.rrule ? `${src.id}@${D.ymd(ed.s)}` : String(src.id);
    this.state.selected = ed.key;
    this.renderMain();
    if (rebuild === true) { this._fillEditor(); }
    else if (rebuild === 'end') { const i = this._pop.querySelector('[name=end]'); i.value = D.toInput(ad ? D.addDays(ed.e, -1) : ed.e, ad); }
    if (rebuild) this._pop.querySelector('.ixc-ed-dur').textContent = this._dur(ed.e - ed.s, src.allDay);
  }
  _edClick(e) {
    const ed = this._edit;
    if (!ed) return;
    const c = e.target.closest('[data-color]');
    if (c) {
      const src = this._byId(ed.id);
      src.color = c.dataset.color || undefined;
      if (!src.color) delete src.color;
      ed.dirty = true;
      this._pop.style.setProperty('--c', this.colorOf(src));
      this._pop.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('ixc-on', b === c));
      this.renderMain();
      return;
    }
    const b = e.target.closest('[data-ed]');
    if (!b) return;
    const a = b.dataset.ed;
    if (a === 'close') { this.closePopover(); this.root.focus(); }
    else if (a === 'dup') { const k = ed.key; this.closePopover(); this.duplicate(k); }
    else if (a === 'del-one' || a === 'del-all') {
      const k = ed.key;
      if (ed.isNew) { this.events = ed.snapshot; this._edit = null; this._pop.remove(); this._pop = null; this.renderMain(); return; }
      // fold pending edits into the same undo step
      const snap = ed.snapshot;
      this._edit = null; this._pop.remove(); this._pop = null;
      const i = this._instByKey(k);
      const src = this._byId(ed.id);
      if (src.rrule && a === 'del-one' && i) src.exdates = [...src.exdates, D.ymd(i.start)];
      else this.events = this.events.filter((x) => x !== src);
      this._push(snap, 'delete');
      this.state.selected = null;
      this._changed();
      this._emit('eventDelete', { event: this._pub(src) });
      this._toast(this.t.deleted, { label: this.t.undo, run: () => this.undo() });
    }
  }

  // ---------------------------------------------------------------- toast
  _toast(msg, action) {
    clearTimeout(this._toastT);
    this.layer.querySelector('.ixc-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'ixc-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${escHTML(msg)}</span>${action ? `<button>${escHTML(action.label)}</button>` : ''}`;
    if (action) el.querySelector('button').onclick = () => { el.remove(); action.run(); };
    this.layer.appendChild(el);
    this._parts(el);
    this._toastT = setTimeout(() => { el.classList.add('ixc-out'); setTimeout(() => el.remove(), 200); }, 4200);
  }

  // ---------------------------------------------------------------- command palette
  _commands() {
    const t = this.t, m = this._mod;
    const cmds = [
      { icon: 'calendar', label: t.cmdToday, kbd: 'T', run: () => this.today() },
      { icon: 'sparkles', label: t.cmdNew, kbd: 'N', run: () => this.newEvent() },
      { icon: 'zap', label: t.cmdFree30, kbd: 'F', run: () => this.showFreeSlot(30), kw: 'free slot find availability wolne' },
      { icon: 'zap', label: t.cmdFree60, run: () => this.showFreeSlot(60), kw: 'free slot hour find wolne' },
      ...this.o.views.filter((v) => VIEWS[v]).map((v) => ({ icon: VIEW_ICONS[v], label: t.cmdView(v === 'days' ? `${this.o.daysCount} ${t.days}` : t[v]), kbd: VIEW_KEYS[v].toUpperCase(), run: () => this.setView(v), kw: 'view widok' })),
      { icon: 'chevron-left', label: t.cmdPrev, kbd: '←', run: () => this.prev() },
      { icon: 'chevron-right', label: t.cmdNext, kbd: '→', run: () => this.next() },
      { icon: 'undo', label: t.cmdUndo, kbd: `${m} Z`, run: () => this.undo() },
      { icon: 'redo', label: t.cmdRedo, kbd: `${m} ⇧ Z`, run: () => this.redo() },
      { icon: 'search', label: t.search, kbd: '/', run: () => this._search.focus() },
      { icon: 'alert', label: t.cmdClashes, run: () => { this.state.clashFocus = !this.state.clashFocus; this._applyTheme(); this._renderClash(); }, kw: 'conflict overlap kolizje' },
      { icon: 'eye', label: t.cmdWeekends, run: () => { this.o.weekends = !this.o.weekends; this.render(); }, kw: 'weekend' },
      { icon: 'sidebar', label: t.cmdSidebar, kbd: 'B', run: () => this.toggleSidebar() },
      { icon: 'plus', label: t.cmdZoomIn, kbd: '+', run: () => this.zoom(1) },
      { icon: 'minus', label: t.cmdZoomOut, kbd: '−', run: () => this.zoom(-1) },
      ...['light', 'dark', 'auto'].map((th) => ({ icon: th === 'dark' ? 'moon' : 'sun', label: t.cmdTheme(th), run: () => this.setOptions({ theme: th }), kw: 'theme dark light motyw' })),
      ...EVENT_STYLES.map((s) => ({ icon: 'palette', label: t.cmdStyle(s), run: () => this.setOptions({ eventStyle: s }), kw: 'style styl' })),
      ...Object.entries(PRESETS).map(([k, p]) => ({ icon: 'layers', label: t.cmdPreset(p.label), run: () => this.setOptions({ preset: k }), kw: 'preset theme motyw' })),
      ...['compact', 'comfortable', 'spacious'].map((s) => ({ icon: 'type', label: t.cmdDensity(s), run: () => this.setOptions({ density: s }), kw: 'density gęstość' })),
      { icon: 'layers', label: t.cmdShowAll, run: () => { this.state.hidden.clear(); this.renderMain(); this._renderSide(); } },
      { icon: 'x', label: t.cmdClearSearch, run: () => this.setQuery('') },
      { icon: 'download', label: t.cmdExportIcs, run: () => this.download('ics'), kw: 'ical export download' },
      { icon: 'upload', label: t.cmdImportIcs, run: () => this.pickICS(), kw: 'ical import upload' },
      { icon: 'download', label: t.cmdExportJson, run: () => this.download('json'), kw: 'json export' },
    ];
    return cmds.map((c) => ({ ...c, group: t.actions }));
  }
  _paletteItems(q) {
    const t = this.t, L = this.locale;
    const cmds = this._commands();
    if (!q) return cmds;
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const fits = (s) => words.every((w) => s.toLowerCase().includes(w));
    const cm = cmds.filter((c) => fits(`${c.label} ${c.kw || ''}`));
    const now = this.now();
    const evs = [];
    for (const h of this._index().search(q, { limit: 6 }).hits) {
      const e = this._byId(h.id);
      if (!e) continue;
      const next = e.rrule ? expand(e, D.startOfDay(now), D.addDays(now, 400))[0] || e : e;
      evs.push({ group: t.events, icon: 'calendar', label: e.title || t.untitled, hint: this._when(next), color: this.colorOf(e), run: () => this.reveal(next.key || String(e.id), next.start) });
    }
    const p = this.parse(q);
    const hasWhen = p.tokens.some((x) => x.type !== 'calendar' && x.type !== 'resource');
    const create = { group: t.create, icon: 'sparkles', label: `${t.create}: ${p.title || t.untitled}`, chips: this._parseChips(p), run: () => this.quickAdd(q) };
    return hasWhen ? [create, ...cm, ...evs] : [...cm, ...evs, create];
  }
  reveal(key, date) {
    this.closePalette();
    if (this.state.view === 'year') this.state.view = 'week';
    this.state.date = D.startOfDay(date);
    this.state.query = '';
    if (this._search) this._search.value = '';
    this.render();
    this._view().scrollTo?.(this, date);
    const el = this.main.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el) this.openEditor(key, el); else this.select(key);
  }
  openPalette(initial = '') {
    if (!this.o.palette) return;
    if (this._pal) { this._pal.querySelector('input').focus(); return; }
    this.closePopover();
    const t = this.t;
    const wrap = document.createElement('div');
    wrap.className = 'ixc-pal-wrap';
    wrap.innerHTML = `<div class="ixc-pal" role="dialog" aria-label="${t.actions}">
      <div class="ixc-pal-in">${icon('command', 16)}<input type="text" placeholder="${t.commands}" aria-label="${t.commands}" autocomplete="off" spellcheck="false"><kbd>esc</kbd></div>
      <div class="ixc-pal-list" role="listbox"></div>
      <div class="ixc-pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> run</span><span>“Dentist fri 4pm #personal”</span></div></div>`;
    this.layer.appendChild(wrap);
    this._pal = wrap;
    this._parts(wrap);
    const input = wrap.querySelector('input');
    const list = wrap.querySelector('.ixc-pal-list');
    let items = [], active = 0;
    const draw = () => {
      items = this._paletteItems(input.value.trim());
      active = 0;
      let g = null, html = '';
      items.forEach((it, i) => {
        if (it.group !== g) { g = it.group; html += `<div class="ixc-pal-g">${escHTML(g)}</div>`; }
        html += `<button class="ixc-pal-item" role="option" data-i="${i}" ${it.color ? `style="--c:${it.color}"` : ''}>
          ${icon(it.icon, 15)}<span class="ixc-pal-l">${escHTML(it.label)}${it.chips ? `<span class="ixc-pal-chips">${it.chips}</span>` : ''}</span>
          ${it.hint ? `<small>${escHTML(it.hint)}</small>` : ''}${it.kbd ? `<kbd>${escHTML(it.kbd)}</kbd>` : ''}</button>`;
      });
      list.innerHTML = html || `<div class="ixc-pal-empty">${t.noResults}</div>`;
      mark();
    };
    const mark = () => {
      list.querySelectorAll('.ixc-pal-item').forEach((b) => b.classList.toggle('ixc-on', +b.dataset.i === active));
      list.querySelector('.ixc-on')?.scrollIntoView?.({ block: 'nearest' });
    };
    const run = (i) => { const it = items[i]; if (!it) return; this.closePalette(); it.run(); };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    });
    list.addEventListener('mousemove', (e) => { const b = e.target.closest('[data-i]'); if (b && +b.dataset.i !== active) { active = +b.dataset.i; mark(); } });
    list.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) run(+b.dataset.i); });
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) this.closePalette(); });
    input.value = initial;
    draw();
    input.focus();
  }
  closePalette() {
    if (!this._pal) return;
    this._pal.remove();
    this._pal = null;
    this.root.focus({ preventScroll: true });
  }
}

export function createCalendar(target, options) {
  return new Calendar(target, options);
}
