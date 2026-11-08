import { createCalendar, DEFAULTS, PARTS } from '../src/index.js';
import { icon } from '../src/icons.js';
import { calendars, resources, demoEvents, demoWeek } from './demo-data.js';
import { hl, copy } from './util.js';
import { OPT_DOCS, API, KEYS, CLI, PART_DOCS } from './api-data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// ---------------------------------------------------------------- icons used by the page chrome
const ico = (n, s = 16) => icon(n, s); // all icons come from @iconix/icons
const paintIcons = (root = document) => $$('[data-i]', root).forEach((el) => { el.outerHTML = ico(el.dataset.i, el.closest('.btn') ? 17 : 15); });

// ---------------------------------------------------------------- theme
const html = document.documentElement;
const siteTheme = () => html.dataset.theme || 'light';
function setThemeIcon() { $('#themeBtn').innerHTML = ico(siteTheme() === 'dark' ? 'sun' : 'moon', 18); }

// ---------------------------------------------------------------- calendar
const custom = { accent: null, eventStyle: 'soft', density: 'comfortable', locale: 'en-GB', firstDay: 1, radius: 10, weekends: true, sidebar: true };
const cal = createCalendar('#cal', {
  view: innerWidth < 640 ? 'days' : 'week',
  date: demoWeek(),
  events: demoEvents(),
  calendars,
  resources,
  locale: custom.locale,
  firstDay: 1,
  theme: siteTheme(),
  scrollTime: 8,
  views: ['day', 'week', 'days', 'resourceDay', 'month', 'multiMonth', 'year', 'agenda', 'timeline'],
});
window.cal = cal; // handy for poking around in devtools
$('#sidebarCtl').checked = cal.state.sidebar; // the calendar hides its sidebar on narrow screens

$('#themeBtn').addEventListener('click', () => {
  const t = siteTheme() === 'dark' ? 'light' : 'dark';
  html.dataset.theme = t;
  try { localStorage.setItem('ixc-site-theme', t); } catch { /* private mode */ }
  setThemeIcon();
  cal.setOptions({ theme: t });
  window.dispatchEvent(new CustomEvent('site-theme', { detail: t }));
});

function scrollToDemo() { $('#demo').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
$$('[data-try]').forEach((b) => b.addEventListener('click', () => {
  cal.toggleSidebar(true);
  $('#sidebarCtl').checked = true;
  const qa = $('#cal .ixc-qa input');
  qa.value = b.dataset.try;
  qa.dispatchEvent(new Event('input'));
  qa.focus();
}));

// ---------------------------------------------------------------- customizer + snippet
const ACCENTS = [null, '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#18181b'];
$('#accentCtl').innerHTML = ACCENTS.map((c, i) => `<button data-c="${c || ''}" style="--c:${c || 'conic-gradient(#2563eb,#60a5fa)'};${c ? '' : 'background:#2563eb'}" class="${i === 0 ? 'on' : ''}" aria-label="${c || 'default accent'}"></button>`).join('');
$('#accentCtl').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#accentCtl button').forEach((x) => x.classList.toggle('on', x === b));
  custom.accent = b.dataset.c || null;
  cal.setOptions({ accent: custom.accent });
  snippet();
});
$$('.custom .seg').forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('button', seg).forEach((x) => x.classList.toggle('on', x === b));
  const k = seg.dataset.opt;
  custom[k] = k === 'firstDay' ? +b.dataset.v : b.dataset.v;
  cal.setOptions({ [k]: custom[k] });
  snippet();
}));
$('#radiusCtl').addEventListener('input', (e) => { custom.radius = +e.target.value; cal.setOptions({ radius: custom.radius }); snippet(); });
$('#weekendsCtl').addEventListener('change', (e) => { custom.weekends = e.target.checked; cal.setOptions({ weekends: custom.weekends }); snippet(); });
$('#sidebarCtl').addEventListener('change', (e) => { custom.sidebar = e.target.checked; cal.toggleSidebar(custom.sidebar); snippet(); });

const SNIP_DEF = { accent: null, eventStyle: 'soft', density: 'comfortable', locale: 'en-GB', firstDay: 1, radius: 10, weekends: true, sidebar: true };
let snipTab = 'react';
function snippet() {
  const diff = Object.entries(custom).filter(([k, v]) => v !== SNIP_DEF[k] && !(k === 'locale' && v === 'en-GB'));
  const val = (v) => (typeof v === 'string' ? `'${v}'` : String(v));
  let code;
  if (snipTab === 'react') {
    const props = diff.map(([k, v]) => (typeof v === 'string' ? `  ${k}="${v}"` : `  ${k}={${v}}`));
    code = `import { Calendar } from '@iconix/calendar/react';\nimport '@iconix/calendar/css';\n\n<Calendar\n  events={events}\n  calendars={calendars}\n  resources={resources}\n${props.length ? props.join('\n') + '\n' : ''}  onChange={({ events }) => save(events)}\n/>`;
  } else if (snipTab === 'vue') {
    const opts = diff.map(([k, v]) => `${k}: ${val(v)}`).join(', ');
    code = `<script setup>\nimport { IxCalendar } from '@iconix/calendar/vue';\nimport '@iconix/calendar/css';\n</script>\n\n<template>\n  <IxCalendar\n    :events="events"\n    :calendars="calendars"\n    :resources="resources"${opts ? `\n    :options="{ ${opts} }"` : ''}\n    @change="({ events }) => save(events)"\n  />\n</template>`;
  } else {
    const opts = diff.map(([k, v]) => `  ${k}: ${val(v)},`);
    code = `import { createCalendar } from '@iconix/calendar';\nimport '@iconix/calendar/css';\n\nconst cal = createCalendar('#calendar', {\n  events,\n  calendars,\n  resources,\n${opts.length ? opts.join('\n') + '\n' : ''}  onChange: ({ events }) => save(events),\n});`;
  }
  $('#snipCode').innerHTML = hl(code);
  $('#snipCode').dataset.raw = code;
}
$('#snipTabs').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#snipTabs button').forEach((x) => x.classList.toggle('on', x === b));
  snipTab = b.dataset.t;
  snippet();
});
$('#snipCopy').addEventListener('click', (e) => copy($('#snipCode').dataset.raw, e.currentTarget));

// ---------------------------------------------------------------- tools
const TOOLS = [
  { i: 'sparkles', t: 'Natural-language quick add', d: '“Lunch with Ann tomorrow 1pm #work @nova every friday”. Dates, times, durations, repeats, calendars and resources, in English and Polish.', k: ['N'], run: () => { cal.toggleSidebar(true); $('#cal .ixc-qa input').focus(); } },
  { i: 'command', t: 'Command palette', d: 'One box for everything: run any action, jump to an event, or type a sentence to create one. Fuzzy, keyboard-driven.', k: ['Ctrl', 'K'], run: () => cal.openPalette() },
  { i: 'plus', t: 'Drag to create', d: 'Drag across the time grid, the all-day strip, month cells or timeline rows. Double-click works too; on touch, long-press.', k: ['drag'] },
  { i: 'arrow', t: 'Move & resize', d: 'Drag events between days, into the all-day strip and back, or onto another resource. Resize from either edge with snapping.', k: ['drag'] },
  { i: 'undo', t: 'Undo & redo', d: 'Every change, including drags, edits, deletes and imports, goes on a 100-step history. Toasts offer a one-click undo.', k: ['Ctrl', 'Z'], run: () => cal.undo() },
  { i: 'copy', t: 'Copy, paste, duplicate', d: 'Copy an event, hover a slot and paste it there. Duplicate keeps everything, including the repeat rule.', k: ['Ctrl', 'C', 'V', 'D'] },
  { i: 'zap', t: 'Free-slot finder', d: 'Finds the next gap of 30 or 60 minutes inside business hours across your visible calendars and offers to book it.', k: ['F'], run: () => cal.showFreeSlot(30) },
  { i: 'alert', t: 'Clash detection', d: 'Overlapping events for the same person or room get a marker and a counter. Click the counter to dim everything else.', k: [], run: () => { cal.setView('week'); cal.today(); } },
  { i: 'repeat', t: 'Recurring events', d: 'Daily, weekdays, weekly on chosen days, monthly, yearly, with interval, count and until. Delete a single occurrence or the series.', k: [] },
  { i: 'search', t: 'Smart search', d: 'Powered by @iconix/search: forgives typos (“desgn reveiw”), matches word forms in English and Polish, understands field queries like location:atlas, ranks by relevance and offers “Did you mean…”.', k: ['/'], run: () => $('#cal .ixc-search input').focus() },
  { i: 'layers', t: 'Calendar filters', d: 'Toggle calendars on and off, or click “only” to solo one. Counts show how many events each holds.', k: [] },
  { i: 'calendar', t: 'Mini month navigator', d: 'Shows the visible range, today and which days have events. Click to jump.', k: [] },
  { i: 'grid', t: 'Year heat map', d: 'Twelve months at a glance, shaded by how busy each day is. Click a day to open it.', k: ['Y'], run: () => cal.setView('year') },
  { i: 'users', t: 'Resource timeline', d: 'Rooms, people or machines as rows, time across. Grouped, sticky headers, drag between rows. Free, not a paid add-on.', k: ['R'], run: () => cal.setView('timeline') },
  { i: 'plus', t: 'Zoom', d: 'Make hours taller or shorter with the toolbar, + and −, or Ctrl + mouse wheel. Works in the time grid and the timeline.', k: ['+', '−'], run: () => cal.zoom(1) },
  { i: 'keyboard', t: 'Keyboard everything', d: 'Views, navigation, create, delete, undo and search all have a key. Shortcuts stay out of the way while you type.', k: ['T', 'D', 'W', 'M'] },
  { i: 'download', t: '.ics import & export', d: 'RFC 5545 in and out, including all-day events, repeat rules and skipped dates. JSON export as well.', k: [], run: () => cal.openPalette('ics') },
  { i: 'palette', t: 'Themes & tokens', d: 'Ten presets with light and dark variants, eight event styles, accent, radius and density. Every color is a CSS variable.', k: [] },
  { i: 'type', t: 'Any language', d: 'Dates and times come from Intl, so 12h or 24h follows the locale. UI strings ship in English and Polish, and you can override any of them.', k: [] },
  { i: 'sidebar', t: 'Responsive & touch', d: 'Container queries adapt the toolbar and sidebar to the space you give it. On phones the editor becomes a bottom sheet.', k: ['B'] },
];
$('#toolsGrid').innerHTML = TOOLS.map((x, n) => `<article class="tool">
  <div class="tool-h"><span class="tool-i">${icon(x.i, 17)}</span><h4>${x.t}</h4></div>
  <p>${x.d}</p>
  <div class="k">${x.k.map((k) => `<kbd>${k}</kbd>`).join('')}${x.run ? `<button class="k-try" data-tool="${n}">Try it →</button>` : ''}</div></article>`).join('');
$('#toolsGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]'); if (!b) return;
  scrollToDemo();
  setTimeout(() => TOOLS[+b.dataset.tool].run(), 450);
});

// ---------------------------------------------------------------- usage
const USAGE = {
  React: {
    note: 'Every option is a prop. The ref gives you the full API: undo(), quickAdd(), gotoDate(), exportICS() and more.',
    code: `import { useRef, useState } from 'react';
import { Calendar } from '@iconix/calendar/react';
import '@iconix/calendar/css';

const calendars = [
  { id: 'work', name: 'Work', color: '#2563eb' },
  { id: 'home', name: 'Personal', color: '#16a34a' },
];

export function Schedule() {
  const api = useRef(null);
  const [events, setEvents] = useState([
    { id: 1, title: 'Kickoff', start: '2026-11-09T10:00', end: '2026-11-09T11:00', calendar: 'work' },
    { id: 2, title: 'Offsite', start: '2026-11-12', end: '2026-11-14', calendar: 'work' },
  ]);

  return (
    <div style={{ height: 720 }}>
      <Calendar
        ref={api}
        view="week"
        events={events}
        calendars={calendars}
        onChange={({ events }) => setEvents(events)}
      />
      <button onClick={() => api.current.showFreeSlot(60)}>Find me an hour</button>
    </div>
  );
}`,
  },
  'Next.js': {
    note: 'The React entry already carries "use client", so you can render it straight from a Server Component page.',
    code: `// app/schedule/page.jsx  (Server Component)
import { Calendar } from '@iconix/calendar/react';
import '@iconix/calendar/css';
import { getEvents } from '@/lib/db';

export default async function Page() {
  const events = await getEvents();
  return (
    <main style={{ height: '100dvh' }}>
      <Calendar events={events} view="month" />
    </main>
  );
}`,
  },
  'Vue / Nuxt': {
    note: 'Props for the common options, :options for everything else, and kebab-case events. In Nuxt, wrap it in <ClientOnly>.',
    code: `<script setup>
import { ref } from 'vue';
import { IxCalendar } from '@iconix/calendar/vue';
import '@iconix/calendar/css';

const events = ref([
  { id: 1, title: 'Kickoff', start: '2026-11-09T10:00', end: '2026-11-09T11:00' },
]);
const cal = ref(null); // cal.value.api -> Calendar instance
</script>

<template>
  <ClientOnly>
    <IxCalendar
      ref="cal"
      view="month"
      :events="events"
      :options="{ firstDay: 1, eventStyle: 'solid' }"
      style="height: 720px"
      @change="({ events: list }) => (events = list)"
    />
  </ClientOnly>
</template>`,
  },
  'HTML (no build)': {
    note: 'A custom element in the light DOM. Set .options from JavaScript; events arrive as DOM events prefixed with “ixc:”.',
    code: `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@iconix/calendar/src/calendar.css">
<script type="module" src="https://cdn.jsdelivr.net/npm/@iconix/calendar/src/element.js/+esm"></script>

<ixc-calendar view="week" first-day="1" style="height: 700px"></ixc-calendar>

<script type="module">
  const el = document.querySelector('ixc-calendar');
  el.options = {
    events: [{ title: 'Launch', start: '2026-11-12', allDay: true }],
  };
  el.addEventListener('ixc:change', (e) => console.log(e.detail.events));
</script>`,
  },
  JavaScript: {
    note: 'createCalendar() mounts into any element and returns the instance. This is what the wrappers use under the hood.',
    code: `import { createCalendar } from '@iconix/calendar';
import '@iconix/calendar/css';

const cal = createCalendar('#calendar', {
  view: 'week',
  events: await fetch('/api/events').then((r) => r.json()),
  onEventUpdate: ({ event }) => api.save(event),
});

cal.quickAdd('Team lunch friday 12:30 #team'); // parses and adds
cal.showFreeSlot(60);                          // highlights the next free hour
const ics = cal.exportICS();                   // RFC 5545 text`,
  },
};
let usageTab = 'React';
function drawUsage() {
  $('#usageTabs').innerHTML = Object.keys(USAGE).map((k) => `<button class="${k === usageTab ? 'on' : ''}" data-u="${k}">${k}</button>`).join('');
  $('#usageNote').textContent = USAGE[usageTab].note;
  $('#usageLang').textContent = usageTab;
  $('#usageCode').innerHTML = hl(USAGE[usageTab].code);
}
$('#usageTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-u]'); if (b) { usageTab = b.dataset.u; drawUsage(); } });
$('#usageCopy').addEventListener('click', (e) => copy(USAGE[usageTab].code, e.currentTarget));
$('#persistCode').innerHTML = hl(`<Calendar
  events={events}
  onEventCreate={({ event }) => api.post('/events', event)}
  onEventUpdate={({ event }) => api.put(\`/events/\${event.id}\`, event)}
  onEventDelete={({ event }) => api.delete(\`/events/\${event.id}\`)}
/>`);

// ---------------------------------------------------------------- cli
$('#cliDemo').innerHTML = `<span class="tk-c">$</span> npx iconix-calendar parse "Dentist friday 4pm for 45 min #personal"
<b>Dentist</b>
  <span class="tk-t">Friday, 13 November 2026</span>  16:00–16:45
  <span class="tk-c">understood: date "friday", duration "for 45 min", time "4pm"</span>

<span class="tk-c">$</span> npx iconix-calendar free events.json --duration 60 --hours 8-18
<span class="tk-s">Free:</span> <b>Monday 9 November</b> 09:15–10:15

<span class="tk-c">$</span> npx iconix-calendar clashes events.json --days 7
<span class="tk-n">⚠</span> Thu 12 Nov  <b>Customer call</b> <span class="tk-c">15:00–16:00</span>  ↔  <b>Dentist</b> <span class="tk-c">15:30–16:15</span>
<span class="tk-n">1 clash</span>

<span class="tk-c">$</span> npx iconix-calendar convert google-export.ics -o events.json
<span class="tk-s">✓ wrote events.json</span>`;
$('#cliTable tbody').innerHTML = CLI.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');

// ---------------------------------------------------------------- where
const WHERE = [
  ['React 18+ (incl. 19)', 'Component with a ref to the whole API. Callbacks never trigger a re-mount.', '@iconix/calendar/react'],
  ['Next.js (App Router)', 'Marked “use client”, so Server Components can render it directly. Pages Router works too.', '@iconix/calendar/react'],
  ['Vue 3', 'Component plus plugin. Props, :options and kebab-case events; the instance is exposed as api.', '@iconix/calendar/vue'],
  ['Nuxt 3', 'Same Vue component inside <ClientOnly>, because the calendar measures the DOM.', '@iconix/calendar/vue'],
  ['Web Component', '<ixc-calendar> for any page or framework. Attributes, .options and ixc:* DOM events.', '@iconix/calendar/element'],
  ['Vanilla JavaScript', 'createCalendar(element, options) returns the instance. No framework at all.', '@iconix/calendar'],
  ['Svelte, Angular, Solid, Astro', 'Mount with createCalendar() in onMount / ngAfterViewInit, or drop in the web component.', '@iconix/calendar'],
  ['TypeScript', 'Types ship with the package for the core, the React component and the Vue component.', 'index.d.ts'],
  ['@iconix/search', 'The same engine that powers event search is its own package: a search box with suggestions, facets and six result layouts.', 'npm i @iconix/search'],
  ['Node.js CLI', 'iconix-calendar parse, convert, free, clashes, validate… for scripts and CI. Node 18+.', 'npx iconix-calendar --help'],
];
$('#whereGrid').innerHTML = WHERE.map(([h, p, c]) => `<div class="where-c"><h4>${esc(h)}</h4><p>${esc(p)}</p><code>${esc(c)}</code></div>`).join('');

// ---------------------------------------------------------------- options
const show = (v) => (v === null ? 'null' : Array.isArray(v) ? (v.length ? JSON.stringify(v).replace(/"/g, "'") : '[]') : typeof v === 'object' ? JSON.stringify(v).replace(/"/g, '') : typeof v === 'string' ? `"${v}"` : String(v));
$('#optsTable tbody').innerHTML = Object.keys(OPT_DOCS).map((k) => {
  let d = DEFAULTS[k];
  if (k === 'locale') d = 'navigator.language';
  if (k === 'date') d = 'today';
  return `<tr><td>${k}</td><td>${esc(typeof d === 'string' && (k === 'locale' || k === 'date') ? d : show(d))}</td><td>${esc(OPT_DOCS[k])}</td></tr>`;
}).join('') + `<tr><td>on…</td><td>—</td><td>onChange, onEventClick, onEventCreate, onEventUpdate, onEventDelete, onViewChange, onDateClick. Also available as cal.on('eventUpdate', fn).</td></tr>`;

$('#apiTable tbody').innerHTML = API.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('');

$('#keysGrid').innerHTML = KEYS.map(([l, k]) => `<div><span>${l}</span><span>${k.map((x) => `<kbd>${x}</kbd>`).join('')}</span></div>`).join('');

$('#partsTable tbody').innerHTML = Object.entries(PARTS).map(([k, sel]) => `<tr><td>${k}</td><td>${esc(sel)}</td><td>${esc(PART_DOCS[k] || '')}</td></tr>`).join('');
$('#cssCode').innerHTML = hl(`.ixc {
  --ixc-accent: #db2777;
  --ixc-radius: 14px;
  --ixc-font: "Inter", system-ui, sans-serif;
  --ixc-bg: #ffffff;
  --ixc-border: #e4e4e7;
  --ixc-now: #db2777;
}
.ixc[data-theme="dark"] {
  --ixc-bg: #0b0b0f;
}`, 'css');

// ---------------------------------------------------------------- misc
$$('[data-copy]').forEach((b) => b.addEventListener('click', () => copy(b.dataset.copy, b)));
paintIcons();
setThemeIcon();
drawUsage();
snippet();
$('#sizeStat').textContent = '~65 KB';
