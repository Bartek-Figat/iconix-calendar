// Docs page: searchable sidebar, guides, every live example and the API reference.
import { createCalendar, DEFAULTS, PARTS, PRESETS, EVENT_STYLES } from '../src/index.js';
import { icon } from '../src/icons.js';
import { demoWeek } from './demo-data.js';
import { hl, copy, esc } from './util.js';
import { EXAMPLES, setCurrent } from './examples.js';
import { OPT_DOCS, API, KEYS, CLI, PART_DOCS } from './api-data.js';
import { createIndex, highlight as markMatches } from '@iconix/search/engine';

const $ = (s, r = document) => r.querySelector(s);
const html = document.documentElement;
const siteTheme = () => html.dataset.theme || 'light';
const week = demoWeek();

// ---------------------------------------------------------------- content
const GUIDES = [
  {
    id: 'install', title: 'Install', text: 'npm pnpm yarn bun css stylesheet setup',
    body: () => `<p class="lead-s">One package, one stylesheet. Two sibling packages install with it: <a class="ul" href="https://bartek-figat.github.io/iconix-site/">@iconix/icons</a> draws every icon and <a class="ul" href="https://bartek-figat.github.io/iconix-search/">@iconix/search</a> powers event search (typos, word forms, field queries like <code>location:atlas</code>). This docs search runs on it too.</p>
      ${code('npm i @iconix/calendar\n# or: pnpm add · yarn add · bun add', 'Terminal')}
      ${code("import '@iconix/calendar/css';", 'Stylesheet (once, anywhere)')}
      <p>Give the calendar a container with a height; it fills it. Then pick your stack in the next pages, or jump straight to the <a class="ul" href="#ex-basic">examples</a>.</p>`,
  },
  {
    id: 'react', title: 'React', text: 'react component ref props hooks',
    body: () => `<p class="lead-s">Every option is a prop. <code>ref</code> gives you the full instance.</p>${code(`import { useRef, useState } from 'react';
import { Calendar } from '@iconix/calendar/react';
import '@iconix/calendar/css';

export function Schedule() {
  const api = useRef(null);
  const [events, setEvents] = useState([]);
  return (
    <div style={{ height: 720 }}>
      <Calendar ref={api} view="week" events={events} onChange={({ events }) => setEvents(events)} />
      <button onClick={() => api.current.showFreeSlot(60)}>Find me an hour</button>
    </div>
  );
}`, 'React')}<p>Callback props can change on every render without re-creating the calendar. A new <code>events</code> array replaces the data.</p>`,
  },
  {
    id: 'next', title: 'Next.js', text: 'next app router server component use client',
    body: () => `<p class="lead-s">The React entry already carries <code>"use client"</code>, so a Server Component can render it directly.</p>${code(`// app/schedule/page.jsx
import { Calendar } from '@iconix/calendar/react';
import '@iconix/calendar/css';

export default async function Page() {
  const events = await getEvents();
  return <main style={{ height: '100dvh' }}><Calendar events={events} view="month" /></main>;
}`, 'Next.js')}`,
  },
  {
    id: 'vue', title: 'Vue & Nuxt', text: 'vue nuxt component props emits clientonly',
    body: () => `<p class="lead-s">Common options are props, everything else goes in <code>:options</code>. Events are kebab-case. In Nuxt wrap it in <code>&lt;ClientOnly&gt;</code>.</p>${code(`<script setup>
import { ref } from 'vue';
import { IxCalendar } from '@iconix/calendar/vue';
import '@iconix/calendar/css';

const events = ref([]);
const cal = ref(null); // cal.value.api -> instance
</script>

<template>
  <IxCalendar ref="cal" view="month" :events="events" :options="{ firstDay: 1 }"
    style="height: 720px" @change="({ events: list }) => (events = list)" />
</template>`, 'Vue')}`,
  },
  {
    id: 'html', title: 'HTML / Web Component', text: 'web component custom element cdn no build ixc-calendar',
    body: () => `<p class="lead-s">No build step: a custom element in the light DOM. Events arrive as DOM events prefixed with <code>ixc:</code>.</p>${code(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@iconix/calendar/src/calendar.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/@iconix/calendar/src/element.js/+esm"></script>

<ixc-calendar view="week" first-day="1" style="height: 700px"></ixc-calendar>
<script type="module">
  const el = document.querySelector('ixc-calendar');
  el.options = { events: [{ title: 'Launch', start: '2026-11-12', allDay: true }] };
  el.addEventListener('ixc:change', (e) => console.log(e.detail.events));
</script>`, 'HTML')}`,
  },
  {
    id: 'js', title: 'Vanilla JavaScript', text: 'createCalendar vanilla svelte angular solid',
    body: () => `<p class="lead-s"><code>createCalendar(element, options)</code> returns the instance. Use it from Svelte, Angular, Solid or anything else in its mount hook.</p>${code(`import { createCalendar } from '@iconix/calendar';
import '@iconix/calendar/css';

const cal = createCalendar('#calendar', {
  view: 'week',
  events: await fetch('/api/events').then((r) => r.json()),
  onEventUpdate: ({ event }) => api.save(event),
});

cal.quickAdd('Team lunch friday 12:30 #team');`, 'JavaScript')}`,
  },
  {
    id: 'events-data', title: 'Event data', text: 'event fields id title start end allDay rrule exdates resourceId calendar color',
    body: () => `<p class="lead-s">Events are plain objects. Strings and Dates both work; you always get Dates back.</p>
      ${table(['Field', 'Type', 'Notes'], [
    ['id', 'string | number', 'Generated if missing.'], ['title', 'string', ''], ['start', 'Date | string', '“2026-11-12” = all-day, “2026-11-12T10:00” = local time.'],
    ['end', 'Date | string', 'Exclusive. Missing → default duration (timed) or the next day (all-day).'], ['allDay', 'boolean', 'Inferred from date-only strings.'],
    ['calendar', 'id', 'Links to calendars[] for color and filters.'], ['resourceId', 'id', 'Row in the timeline.'], ['color', 'CSS color', 'Overrides the calendar color.'],
    ['resourceIds', 'id[]', 'Several rows / columns at once (instead of resourceId).'], ['display', '"auto" | "background"', 'Background events are shaded blocks: no drag, no clashes, not busy time.'],
    ['rrule', '{ freq, interval, count, until, byweekday, bysetpos, bymonthday, bymonth }', 'freq: hourly, daily, weekly, monthly, yearly. byweekday: 0 = Sunday. bysetpos: 2 = second, -1 = last. bymonthday: -1 = last day.'], ['exdates', 'string[]', 'Skipped occurrences, “YYYY-MM-DD”.'],
    ['location, notes', 'string', 'Shown in the editor, searchable.'], ['editable', 'boolean', 'false locks one event.'], ['…anything', 'any', 'Extra fields are kept and passed back to you.'],
  ])}`,
  },
];

const API_PAGES = [
  { id: 'options', title: 'Options', text: Object.keys(OPT_DOCS).join(' ') },
  { id: 'methods', title: 'Methods', text: API.map((a) => a[0]).join(' ') },
  { id: 'events', title: 'Events & callbacks', text: 'change eventClick eventCreate eventUpdate eventDelete viewChange dateClick select unselect loading sourceLoad sourceError on off' },
  { id: 'parts', title: 'Styleable parts', text: Object.keys(PARTS).join(' ') + ' classNames css' },
  { id: 'presets', title: 'Presets & event styles', text: Object.keys(PRESETS).join(' ') + ' ' + EVENT_STYLES.join(' ') + ' theme dark' },
  { id: 'tokens', title: 'CSS tokens', text: 'css variables tokens --ixc accent radius font bg border' },
  { id: 'keyboard', title: 'Keyboard', text: KEYS.map((k) => k[0]).join(' ') },
  { id: 'cli', title: 'CLI', text: CLI.map((c) => c[0]).join(' ') + ' npx terminal' },
];

const EVENTS_DOC = [
  ['change', '{ events }', 'After every committed change: create, edit, drag, delete, undo, redo, import.'],
  ['eventClick', '{ event, instance: { start, end }, el }', 'A click on an event (also opens the editor).'],
  ['eventCreate', '{ event }', 'A new event: drag, double-click, quick add, paste, duplicate, addEvent().'],
  ['eventUpdate', '{ event, old }', 'Moved, resized or edited.'],
  ['eventDelete', '{ event, occurrence }', 'occurrence is set when one date of a series was removed.'],
  ['viewChange', '{ view, date, start, end }', 'View or date range changed; load data for start–end here.'],
  ['dateClick', '{ kind, date, allDay?, resourceId? }', 'A click on empty grid.'],
  ['select', '{ start, end, allDay, resourceId }', 'A range was selected (selectMode: "range" or selectRange()).'],
  ['unselect', '{}', 'The selection was cleared.'],
  ['loading', '{ loading }', 'true when the first source starts loading, false when the last one finishes.'],
  ['sourceLoad', '{ source, events }', 'One source finished loading.'],
  ['sourceError', '{ source, error }', 'A source failed (HTTP error, exception, bad data).'],
  ['eventReceive', '{ event, draggedEl? , from? }', 'An event was dropped in from a makeDraggable() list or another calendar.'],
  ['eventLeave', '{ event, to }', 'An event was dragged out to another calendar.'],
];

// ---------------------------------------------------------------- helpers
const code = (src, label = 'Code', lang = 'js') => `<div class="code-card"><div class="code-h"><span>${esc(label)}</span><button class="copy" data-copy="${encodeURIComponent(src)}">${icon('copy', 15)}Copy</button></div><pre><code>${hl(src, lang)}</code></pre></div>`;
const table = (head, rows, id) => `<div class="table-wrap"><table class="opts"${id ? ` id="${id}"` : ''}><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr${r.id ? ` id="${r.id}"` : ''}>${(r.cells || r).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const show = (v) => (v === null ? 'null' : Array.isArray(v) ? (v.length ? JSON.stringify(v).replace(/"/g, "'") : '[]') : typeof v === 'object' ? JSON.stringify(v).replace(/"/g, '') : typeof v === 'string' ? `"${v}"` : String(v));
const usedIn = (needle) => EXAMPLES.filter((x) => new RegExp(`\\b${needle}\\b`).test(x.code)).slice(0, 4);
const chips = (list) => (list.length ? `<span class="docs-chips">${list.map((x) => `<a href="#ex-${x.id}">${esc(x.title)}</a>`).join('')}</span>` : '');

// ---------------------------------------------------------------- navigation model
const tags = [...new Set(EXAMPLES.map((x) => x.tag))];
const ITEMS = [
  ...GUIDES.map((g) => ({ route: `start-${g.id}`, title: g.title, group: 'Getting started', text: `${g.title} ${g.text}` })),
  ...tags.flatMap((tag) => EXAMPLES.filter((x) => x.tag === tag).map((x) => ({ route: `ex-${x.id}`, title: x.title, group: `Examples · ${tag}`, text: `${x.title} ${x.tag} ${x.desc} ${x.code} ${x.css || ''}` }))),
  ...API_PAGES.map((p) => ({ route: `api-${p.id}`, title: p.title, group: 'API reference', text: `${p.title} ${p.text}` })),
  // single options / methods / parts are searchable too and jump to their row
  ...Object.keys(OPT_DOCS).map((k) => ({ route: `api-options:opt-${k}`, title: k, group: 'Option', text: `${k} ${OPT_DOCS[k]}`, sub: true })),
  ...API.map(([m, d]) => ({ route: `api-methods:m-${m.split('(')[0]}`, title: m.split(' · ')[0], group: 'Method', text: `${m} ${d}`, sub: true })),
  ...Object.keys(PARTS).map((k) => ({ route: `api-parts:p-${k}`, title: k, group: 'Part', text: `${k} ${PARTS[k]} ${PART_DOCS[k] || ''}`, sub: true })),
];
const MAIN = ITEMS.filter((i) => !i.sub);

let query = '';
let ix = null;
/** Docs search index (built once): titles weigh most, then the group, then the full text and code. */
function docsIndex() {
  return ix || (ix = createIndex(ITEMS.map((it, k) => ({ id: String(k), title: it.title, group: it.group, text: it.text, main: it.sub ? 0 : 1 })), {
    keys: [{ name: 'title', weight: 4 }, { name: 'group', weight: 1.5 }, 'text'], id: 'id', boost: (d) => (d.main ? 1.15 : 1),
  }));
}
function drawNav() {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const nav = $('#docsNav');
  const cur = location.hash.slice(1).split(':')[0];
  if (!words.length) {
    const link = (route, title) => `<a href="#${route}" class="${route === cur ? 'on' : ''}">${esc(title)}</a>`;
    const sec = (title, inner) => `<div class="docs-g"><div class="docs-gh">${title}</div>${inner}</div>`;
    nav.innerHTML = sec('Getting started', GUIDES.map((g) => link(`start-${g.id}`, g.title)).join(''))
      + sec(`Examples <em>${EXAMPLES.length}</em>`, tags.map((tag) => `<div class="docs-sub">${esc(tag)}</div>`
        + EXAMPLES.filter((x) => x.tag === tag).map((x) => link(`ex-${x.id}`, x.title)).join('')).join(''))
      + sec('API reference', API_PAGES.map((p) => link(`api-${p.id}`, p.title)).join(''));
    $('#docsCount').textContent = '';
    return;
  }
  // ranked, typo-tolerant search by @iconix/search
  const res = docsIndex().search(query, { limit: 60 });
  const scored = res.hits.map((h) => ({ it: ITEMS[+h.id] }));
  const mark = (txt) => markMatches(txt, query);
  nav.innerHTML = scored.length
    ? `<div class="docs-g">${scored.map(({ it }) => `<a href="#${it.route}" class="docs-res"><span>${mark(it.title)}</span><small>${esc(it.group)}</small></a>`).join('')}</div>`
    : `<div class="docs-empty">Nothing found for “${esc(query)}”.${res.didYouMean ? `<br><button class="docs-dym" data-dym="${esc(res.didYouMean)}">Did you mean “${esc(res.didYouMean)}”?</button>` : ''}<br>Try “drag”, “resource”, “dark”, “ics” or an option name.</div>`;
  nav.querySelector('[data-dym]')?.addEventListener('click', (e) => { const v = e.currentTarget.dataset.dym; $('#docsQ').value = v; query = v; drawNav(); });
  $('#docsCount').textContent = `${scored.length} result${scored.length === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------- pages
let cal = null;
let exCur = null;
let cleanup = null;
function pager(route) {
  const i = MAIN.findIndex((x) => x.route === route);
  const prev = MAIN[i - 1], next = MAIN[i + 1];
  return `<nav class="docs-pager">${prev ? `<a href="#${prev.route}"><small>Previous</small>${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="#${next.route}" class="nx"><small>Next</small>${esc(next.title)}</a>` : ''}</nav>`;
}
function crumbs(...parts) { return `<p class="eyebrow docs-crumb">${parts.map(esc).join(' · ')}</p>`; }

function renderExample(x, main) {
  exCur = x;
  main.innerHTML = `${crumbs('Examples', x.tag)}<h1 class="docs-h1">${esc(x.title)}</h1><p class="lead-s">${esc(x.desc)}</p>
    ${x.actions ? `<div class="ex-actions">${x.actions.map(([l], i) => `<button data-act-i="${i}">${esc(l)}</button>`).join('')}</div>` : ''}
    ${x.before || ''}
    <div class="ex-frame"><div id="docsCal" class="${x.hostClass || ''}"></div></div>
    ${x.afterHtml || ''}
    <style id="docsStyle">${x.css || ''}</style>
    ${x.log ? '<div class="ex-log" id="docsLog"></div>' : ''}
    ${code(x.code, x.css && !x.code.includes('/* CSS */') ? 'JavaScript' : 'Code · the same options work as React / Vue props')}
    ${x.css && !x.code.includes('/* CSS */') ? code(x.css, 'CSS', 'css') : ''}
    ${pager(`ex-${x.id}`)}`;
  setCurrent(null);
  cal = createCalendar('#docsCal', { date: week, theme: siteTheme(), locale: 'en-GB', ...x.opts() });
  setCurrent(cal);
  cleanup = x.setup ? x.setup(cal, main) : null;
  const logEl = $('#docsLog');
  const log = (line) => { if (!logEl) return; const r = document.createElement('div'); r.textContent = line; logEl.prepend(r); };
  if (x.log) cal.on('*', (name, p) => { const e = p && p.event; log(`${new Date().toLocaleTimeString()}  ${name}${e ? `  “${e.title}”` : p && p.view ? `  ${p.view}` : ''}`); });
  main.querySelectorAll('[data-act-i]').forEach((b) => b.addEventListener('click', () => x.actions[+b.dataset.actI][1](cal, log)));
}

function renderApi(id, main) {
  const head = (t, lead) => `${crumbs('API reference')}<h1 class="docs-h1">${t}</h1><p class="lead-s">${lead}</p>`;
  let body = '';
  if (id === 'options') {
    body = head('Options', 'The second argument of <code>createCalendar()</code>, props in React and Vue, <code>.options</code> on the web component. Change any of them later with <code>setOptions()</code>.')
      + table(['Option', 'Default', 'What it does'], Object.keys(OPT_DOCS).map((k) => {
        let d = DEFAULTS[k];
        if (k === 'locale') d = 'navigator.language'; else if (k === 'date') d = 'today'; else d = show(d);
        return { id: `opt-${k}`, cells: [`<code>${k}</code>`, esc(d ?? '—'), `${esc(OPT_DOCS[k])}${chips(usedIn(k))}`] };
      }));
  } else if (id === 'methods') {
    body = head('Methods', 'Available on the instance from <code>createCalendar()</code>, a React <code>ref</code>, Vue’s exposed <code>api</code> or <code>element.api</code>.')
      + table(['Method', 'What it does'], API.map(([m, d]) => ({ id: `m-${m.split('(')[0]}`, cells: [`<code>${esc(m)}</code>`, `${esc(d)}${chips(usedIn(m.split('(')[0]))}`] })));
  } else if (id === 'events') {
    body = head('Events & callbacks', 'Every event can be passed as an <code>on…</code> option or subscribed with <code>cal.on(name, fn)</code>. <code>cal.on("*", (name, payload) => …)</code> receives all of them.')
      + table(['Event', 'Option', 'Payload', 'When'], EVENTS_DOC.map(([n, p, w]) => [`<code>${n}</code>`, `<code>on${n[0].toUpperCase()}${n.slice(1)}</code>`, `<code>${esc(p)}</code>`, `${esc(w)}${chips(usedIn(`on${n[0].toUpperCase()}${n.slice(1)}`))}`]))
      + code(`const off = cal.on('eventUpdate', ({ event, old }) => save(event));
off(); // unsubscribe

createCalendar('#calendar', { onViewChange: ({ start, end }) => load(start, end) });`, 'Subscribing');
  } else if (id === 'parts') {
    body = head('Styleable parts', 'Every part of the UI has a stable <code>ixc-*</code> class you can target in CSS, and a <code>classNames</code> key to add your own classes (Tailwind works).')
      + code(`createCalendar('#calendar', {
  classNames: {
    toolbar: 'bg-slate-900 text-white',
    event: 'rounded-xl shadow-sm',
    today: 'bg-indigo-50',
  },
});`, 'classNames')
      + table(['classNames key', 'Built-in class', 'What it is'], Object.entries(PARTS).map(([k, sel]) => ({ id: `p-${k}`, cells: [`<code>${k}</code>`, `<code>${esc(sel)}</code>`, esc(PART_DOCS[k] || '')] })))
      + `<p>See it live: ${chips(EXAMPLES.filter((x) => x.tag === 'Style any part'))}</p>`;
  } else if (id === 'presets') {
    body = head('Presets & event styles', 'One option each. Presets set light and dark tokens; event styles change how events are drawn. Try them all in the <a class="ul" href="./index.html#styles">Styles playground</a>.')
      + table(['Preset', 'Accent light / dark', 'Radius', 'Font'], Object.entries(PRESETS).map(([k, p]) => [`<code>${k}</code>`, `<span class="docs-sw" style="background:${p.light.accent}"></span><span class="docs-sw" style="background:${p.dark.accent}"></span> ${p.light.accent} / ${p.dark.accent}`, p.radius ?? 'default', p.font ? esc(p.font.split(',')[0]) : 'inherit']))
      + table(['Event style', 'Look'], EVENT_STYLES.map((s) => [`<code>${s}</code>`, `<span class="evs-demo" data-evstyle="${s}"><span class="ixc-ev ixc-ev--bar" style="--c:#7c3aed;position:relative;width:180px"><span class="ixc-ev-in"><b class="ixc-ev-t">Standup</b></span></span></span>`]))
      + code(`createCalendar('#calendar', { preset: 'nord', eventStyle: 'glass', theme: 'auto' });
// your own preset
createCalendar('#calendar', { preset: { radius: 18, light: { accent: '#0f766e' }, dark: { accent: '#2dd4bf' } } });`, 'Usage');
  } else if (id === 'tokens') {
    const css = [...document.styleSheets].flatMap((sh) => { try { return [...sh.cssRules]; } catch { return []; } })
      .find((r) => r.selectorText === '.ixc' && r.style.getPropertyValue('--ixc-bg'));
    const toks = css ? [...css.style].filter((p) => p.startsWith('--ixc-')).map((p) => [`<code>${p}</code>`, `<code>${esc(css.style.getPropertyValue(p).trim())}</code>`]) : [];
    body = head('CSS tokens', 'All colors, the radius and the fonts are CSS variables on <code>.ixc</code>. Dark mode redefines them under <code>[data-theme="dark"]</code>.')
      + table(['Token', 'Light default'], toks)
      + code(`.ixc {
  --ixc-accent: #db2777;
  --ixc-radius: 14px;
  --ixc-font: "Inter", system-ui, sans-serif;
}
.ixc[data-theme="dark"] { --ixc-bg: #0b0b0f; }`, 'CSS', 'css');
  } else if (id === 'keyboard') {
    body = head('Keyboard', 'Shortcuts work while the pointer is over the calendar or focus is inside it, and never while you type in a field. Turn them off with <code>keyboard: false</code>.')
      + table(['Action', 'Keys'], KEYS.map(([l, k]) => [esc(l), k.map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')]));
  } else if (id === 'cli') {
    body = head('CLI', 'The package installs an <code>iconix-calendar</code> command for scripts and CI. It reads <code>.json</code> and <code>.ics</code>; add <code>--json</code> for machine-readable output. Exit codes: 0 ok, 1 the check found something, 2 usage error.')
      + table(['Command', 'What it does'], CLI.map(([c, d]) => [`<code>${esc(c)}</code>`, esc(d)]))
      + code(`npx iconix-calendar parse "Dentist friday 4pm for 45 min #personal"
npx iconix-calendar convert export.ics -o events.json
npx iconix-calendar free events.json --duration 60 --hours 8-18
npx iconix-calendar clashes events.json --days 14 || echo "double booked!"
npx iconix-calendar validate events.json
npx iconix-calendar css nord --dark >> theme.css
npx iconix-calendar init react -o Schedule.jsx`, 'Terminal');
  }
  main.innerHTML = body + pager(`api-${id}`);
}

function route() {
  const [r, anchor] = (location.hash.slice(1) || 'start-install').split(':');
  const main = $('#docsMain');
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  cal?.destroy(); cal = null;
  if (r.startsWith('ex-')) {
    const x = EXAMPLES.find((e) => e.id === r.slice(3)) || EXAMPLES[0];
    renderExample(x, main);
    document.title = `${x.title} – Iconix Calendar examples`;
  } else if (r.startsWith('api-')) {
    renderApi(r.slice(4), main);
    document.title = `${main.querySelector('h1')?.textContent || 'API'} – Iconix Calendar`;
  } else {
    const g = GUIDES.find((x) => `start-${x.id}` === r) || GUIDES[0];
    main.innerHTML = `${crumbs('Getting started')}<h1 class="docs-h1">${esc(g.title)}</h1>${g.body()}${pager(`start-${g.id}`)}`;
    document.title = `${g.title} – Iconix Calendar docs`;
  }
  main.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(decodeURIComponent(b.dataset.copy), b)));
  drawNav();
  document.body.classList.remove('docs-open');
  if (anchor) {
    const row = document.getElementById(anchor);
    if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('docs-hit'); setTimeout(() => row.classList.remove('docs-hit'), 2000); }
  } else window.scrollTo({ top: 0 });
  $('#docsNav a.on')?.scrollIntoView?.({ block: 'nearest' });
}

// ---------------------------------------------------------------- wiring
const q = $('#docsQ');
q.addEventListener('input', () => { query = q.value.trim(); drawNav(); });
q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const first = $('#docsNav a'); if (first) { location.hash = first.getAttribute('href'); q.blur(); } }
  if (e.key === 'Escape') { q.value = ''; query = ''; drawNav(); q.blur(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.closest('.ixc')) { e.preventDefault(); q.focus(); }
});
window.addEventListener('hashchange', route);
$('#docsMenu').addEventListener('click', () => document.body.classList.toggle('docs-open'));
document.querySelectorAll('[data-i]').forEach((el) => { el.outerHTML = icon(el.dataset.i, el.dataset.i === 'search' ? 16 : 15); });
const setThemeIcon = () => { $('#themeBtn').innerHTML = icon(siteTheme() === 'dark' ? 'sun' : 'moon', 18); };
$('#themeBtn').addEventListener('click', () => {
  const t = siteTheme() === 'dark' ? 'light' : 'dark';
  html.dataset.theme = t;
  try { localStorage.setItem('ixc-site-theme', t); } catch { /* private mode */ }
  setThemeIcon();
  cal?.setOptions({ theme: t });
});
setThemeIcon();
route();
