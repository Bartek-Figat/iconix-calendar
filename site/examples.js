// All live examples, shared by the home page gallery and the docs page.
import { calendars, resources, demoEvents, demoWeek } from './demo-data.js';
import { esc } from './util.js';
import { makeDraggable, createCalendar as createCal } from '../src/index.js';

const week = demoWeek();
const at = (d, h, m = 0) => new Date(week.getFullYear(), week.getMonth(), week.getDate() + d, h, m);
const pad = (n) => String(n).padStart(2, '0');
const ymdL = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const iso = (d) => `${ymdL(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// the calendar currently shown, for examples whose rules look at other events
let current = null;
export const setCurrent = (cal) => { current = cal; };
function roomTaken(ev) {
  return current && current.getEvents().some((o) => o.id !== ev.id && o.resourceId === ev.resourceId && o.start < ev.end && ev.start < o.end);
}

// ================================================================ EXAMPLES
const HOLIDAYS = new Set([ymdL(at(3, 0)), `${week.getFullYear()}-12-25`, `${week.getFullYear()}-12-26`, `${week.getFullYear() + 1}-01-01`]);
const people = resources.filter((r) => r.group === 'People');
const rooms = resources.filter((r) => r.group === 'Rooms');

export const EXAMPLES = [
  {
    id: 'basic', title: 'Minimal setup', tag: 'Basics',
    desc: 'An element and an array of events. Everything else has a sensible default: week view, sidebar, quick add, palette, keyboard.',
    opts: () => ({ events: demoEvents() }),
    code: `import { createCalendar } from '@iconix/calendar';
import '@iconix/calendar/css';

createCalendar('#calendar', {
  events: [
    { title: 'Kickoff', start: '${iso(at(0, 10))}', end: '${iso(at(0, 11))}' },
    { title: 'Offsite', start: '${iso(at(2, 0)).slice(0, 10)}', end: '${iso(at(4, 0)).slice(0, 10)}' }, // all-day
  ],
});`,
  },
  {
    id: 'hours', title: 'Working hours, 15-minute grid', tag: 'Basics',
    desc: 'Show only 7:00–20:00 on weekdays, with a fine 15-minute grid and shaded time outside business hours.',
    opts: () => ({ events: demoEvents(), dayStart: 7, dayEnd: 20, slotMinutes: 15, snapMinutes: 5, slotHeight: 16, weekends: false, businessHours: { start: 8, end: 18, days: [1, 2, 3, 4, 5] }, scrollTime: 7 }),
    code: `createCalendar('#calendar', {
  events,
  dayStart: 7,
  dayEnd: 20,
  slotMinutes: 15,
  snapMinutes: 5,
  slotHeight: 16,
  weekends: false,
  businessHours: { start: 8, end: 18, days: [1, 2, 3, 4, 5] },
});`,
  },
  {
    id: 'readonly', title: 'Read-only schedule', tag: 'Basics',
    desc: 'For public timetables: no dragging, no creating, no sidebar. Clicking still opens the details, read-only. Mark single events with editable: false instead if you only need to lock some.',
    opts: () => ({ events: demoEvents(), editable: false, selectable: false, sidebar: false, views: ['week', 'month', 'agenda'] }),
    code: `createCalendar('#calendar', {
  events,
  editable: false,
  selectable: false,
  sidebar: false,
  views: ['week', 'month', 'agenda'],
});

// or lock single events:
{ title: 'Board meeting', start, end, editable: false }`,
  },
  {
    id: 'rooms', title: 'Room booking without double booking', tag: 'Resources',
    desc: 'A day timeline of rooms. eventAllow refuses any drag that would overlap another booking in the same room; the event snaps back and the cursor shows it is not allowed.',
    opts: () => ({
      events: demoEvents().filter((e) => rooms.some((r) => r.id === e.resourceId)), resources: rooms,
      view: 'timeline', views: ['timeline', 'day', 'week'], sidebar: false, date: at(1, 0),
      eventAllow: (ev, { action }) => action === 'create' || !roomTaken(ev),
    }),
    code: `const cal = createCalendar('#calendar', {
  events,
  resources: [
    { id: 'atlas', title: 'Atlas room', subtitle: 'Floor 2 · 8 seats', group: 'Rooms' },
    { id: 'nova', title: 'Nova room', subtitle: 'Floor 3 · 4 seats', group: 'Rooms' },
  ],
  view: 'timeline',
  eventAllow: (event) => !cal.getEvents().some((other) =>
    other.id !== event.id &&
    other.resourceId === event.resourceId &&
    other.start < event.end && event.start < other.end),
});`,
  },
  {
    id: 'team', title: 'Team week planner', tag: 'Resources',
    desc: 'The same timeline across a whole week with people as rows. Drag work between people; zoom with + and −.',
    opts: () => ({ events: demoEvents().filter((e) => people.some((p) => p.id === e.resourceId) || e.calendar === 'work'), resources: people, view: 'timeline', timelineDays: 7, views: ['timeline', 'week'], sidebar: false }),
    code: `createCalendar('#calendar', {
  events,
  resources: [
    { id: 'anna', title: 'Anna Kowalska', subtitle: 'Design', color: '#0d9488' },
    { id: 'marek', title: 'Marek Nowak', subtitle: 'Engineering', color: '#ca8a04' },
  ],
  view: 'timeline',
  timelineDays: 7,
});`,
  },
  {
    id: 'content', title: 'Custom event content', tag: 'Rendering',
    desc: 'eventContent lets you render the inside of every event yourself: here an avatar with initials, the title and the room.',
    opts: () => ({
      events: demoEvents(), resources, sidebar: false,
      eventContent: (e, { variant, height }) => {
        if (variant !== 'box' || height < 30) return null; // default look for bars, dots and very short events
        const r = resources.find((x) => x.id === e.resourceId);
        const ini = (r ? r.title : e.title).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
        const tall = height >= 56;
        return `<div class="ex-ev${tall ? '' : ' ex-ev--row'}"><span class="ex-av">${ini}</span><b>${esc(e.title)}</b>${tall && r ? `<small>${esc(r.title)}</small>` : ''}</div>`;
      },
    }),
    code: `createCalendar('#calendar', {
  events,
  // ctx: { view, variant: 'box' | 'bar' | 'dot', width, height }
  eventContent: (event, { variant, height }) => {
    if (variant !== 'box' || height < 30) return null; // null = default rendering
    const initials = event.title.split(' ').map((w) => w[0]).join('');
    const tall = height >= 56;                   // adapt to the space you get
    return \`<div class="my-ev \${tall ? '' : 'row'}">
      <span class="avatar">\${initials}</span>
      <b>\${event.title}</b>
    </div>\`;                                     // or return an HTMLElement
  },
});`,
  },
  {
    id: 'rules', title: 'Highlight by rule', tag: 'Rendering',
    desc: 'eventClass adds your own class names. Interviews get a dashed outline, anything over two hours gets a striped background.',
    opts: () => ({
      events: demoEvents(), sidebar: false,
      eventClass: (e) => [e.title.startsWith('Interview') && 'is-hot', e.end - e.start > 2 * 36e5 && !e.allDay && 'is-long'].filter(Boolean).join(' '),
    }),
    code: `createCalendar('#calendar', {
  events,
  eventClass: (event) => {
    if (event.title.startsWith('Interview')) return 'is-hot';
    if (event.end - event.start > 2 * 3600e3) return 'is-long';
  },
});

/* CSS */
.ixc-ev.is-hot  { outline: 2px dashed var(--c); outline-offset: 1px; }
.ixc-ev.is-long { background-image: repeating-linear-gradient(
  45deg, transparent 0 6px, color-mix(in srgb, var(--c) 12%, transparent) 6px 12px); }`,
  },
  {
    id: 'allow', title: 'Drag & drop rules', tag: 'Behaviour',
    desc: 'eventAllow is called on every drag step. Here: nothing in the past, nothing at the weekend and no meeting longer than 3 hours. Try dragging an event onto Saturday.',
    opts: () => ({
      events: demoEvents(), sidebar: false,
      eventAllow: (e) => {
        const day = e.start.getDay();
        return e.end > new Date() && day !== 0 && day !== 6 && (e.allDay || e.end - e.start <= 3 * 36e5);
      },
    }),
    code: `createCalendar('#calendar', {
  events,
  eventAllow: (event, { action, old }) => {
    // action: 'move' | 'resize-start' | 'resize-end' | 'create'
    const day = event.start.getDay();
    if (event.end < new Date()) return false;         // no past
    if (day === 0 || day === 6) return false;         // no weekends
    if (event.end - event.start > 3 * 3600e3) return false; // max 3h
    return true;
  },
});`,
  },
  {
    id: 'days', title: 'Holidays & special days', tag: 'Rendering',
    desc: 'dayClass returns a class for any day column or month cell. Use it for holidays, blackout dates or payroll days.',
    opts: () => ({ events: demoEvents(), view: 'month', sidebar: false, dayClass: (d) => (HOLIDAYS.has(ymdL(d)) ? 'holiday' : '') }),
    code: `const holidays = new Set(['2026-11-11', '2026-12-25', '2026-12-26']);
const ymd = (d) => d.toLocaleDateString('sv'); // 2026-11-11

createCalendar('#calendar', {
  events,
  view: 'month',
  dayClass: (date, { view }) => (holidays.has(ymd(date)) ? 'holiday' : ''),
});

/* CSS */
.ixc .holiday { background: color-mix(in srgb, red 6%, transparent); }`,
  },
  {
    id: 'recurring', title: 'Recurring events', tag: 'Data',
    desc: 'Daily, weekdays, weekly on chosen days, monthly, yearly, with interval, count and until. exdates skips single occurrences, which is also what “Delete this one” does.',
    opts: () => ({
      view: 'month', sidebar: false, calendars, events: [
        { id: 'r1', title: 'Standup', start: at(-14, 9), end: at(-14, 9, 15), calendar: 'team', rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }, exdates: [iso(at(2, 0)).slice(0, 10)] },
        { id: 'r2', title: 'Gym', start: at(-14, 18), end: at(-14, 19), calendar: 'personal', rrule: { freq: 'weekly', byweekday: [1, 4] } },
        { id: 'r3', title: 'Sprint review', start: at(4, 15), end: at(4, 16), calendar: 'work', rrule: { freq: 'weekly', interval: 2, count: 6 } },
        { id: 'r4', title: 'Rent', start: new Date(week.getFullYear(), week.getMonth(), 1), allDay: true, calendar: 'personal', rrule: { freq: 'monthly' } },
        { id: 'r5', title: 'Pay day', start: new Date(week.getFullYear(), week.getMonth(), 28), allDay: true, calendar: 'work', rrule: { freq: 'monthly', until: '2027-06-30' } },
      ],
    }),
    code: `events: [
  // every weekday, but skip one day
  { title: 'Standup', start: '2026-10-26T09:00', end: '2026-10-26T09:15',
    rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }, exdates: ['2026-11-11'] },
  // Monday and Thursday
  { title: 'Gym', start, end, rrule: { freq: 'weekly', byweekday: [1, 4] } },
  // every 2 weeks, 6 times
  { title: 'Sprint review', start, end, rrule: { freq: 'weekly', interval: 2, count: 6 } },
  // monthly until June
  { title: 'Pay day', start: '2026-11-28', allDay: true, rrule: { freq: 'monthly', until: '2027-06-30' } },
]`,
  },
  {
    id: 'agenda', title: 'Agenda widget', tag: 'Layouts',
    desc: 'Just the list: a single view, no sidebar, seven days at a time. Good for dashboards and side panels.',
    opts: () => ({ events: demoEvents(), calendars, view: 'agenda', views: ['agenda'], agendaDays: 7, sidebar: false, date: week }),
    code: `createCalendar('#upcoming', {
  events,
  view: 'agenda',
  views: ['agenda'],
  agendaDays: 7,
  sidebar: false,
});`,
  },
  {
    id: 'mini', title: 'Embedded month, no chrome', tag: 'Layouts',
    desc: 'Hide the toolbar, sidebar and palette, use compact density and drive navigation from your own buttons.',
    actions: [['‹ Prev', (c) => c.prev()], ['Today', (c) => c.today()], ['Next ›', (c) => c.next()]],
    opts: () => ({ events: demoEvents(), calendars, view: 'month', toolbar: false, sidebar: false, palette: false, density: 'compact', eventStyle: 'pill', date: week }),
    code: `const cal = createCalendar('#calendar', {
  events,
  view: 'month',
  toolbar: false,
  sidebar: false,
  palette: false,
  density: 'compact',
  eventStyle: 'pill',
});

prevBtn.onclick = () => cal.prev();
todayBtn.onclick = () => cal.today();
nextBtn.onclick = () => cal.next();`,
  },
  {
    id: 'brand', title: 'Your brand, your tokens', tag: 'Styling',
    desc: 'Pass a custom preset object with light and dark tokens, a radius and a font. Every --ixc-* variable can be set this way or in plain CSS.',
    opts: () => ({
      events: demoEvents(), calendars, sidebar: true, eventStyle: 'glass',
      preset: {
        radius: 18, font: '"Trebuchet MS", system-ui, sans-serif',
        light: { accent: '#0f766e', 'bg-soft': '#f2fbf9', 'bg-muted': '#e3f5f1', border: '#cfe9e3', off: '#ecf8f5b3' },
        dark: { accent: '#2dd4bf', bg: '#04120f', 'bg-soft': '#071a16', 'bg-muted': '#0c2621', border: '#163a33', off: '#071a1699' },
      },
    }),
    code: `createCalendar('#calendar', {
  events,
  eventStyle: 'glass',
  preset: {
    radius: 18,
    font: '"Trebuchet MS", system-ui, sans-serif',
    light: { accent: '#0f766e', 'bg-soft': '#f2fbf9', 'bg-muted': '#e3f5f1', border: '#cfe9e3' },
    dark:  { accent: '#2dd4bf', bg: '#04120f', 'bg-soft': '#071a16', border: '#163a33' },
  },
});`,
  },
  {
    id: 'i18n', title: 'Localization', tag: 'Basics',
    desc: 'Polish dates, 24-hour time, Monday first, plus your own wording for any label. Quick add understands Polish too: try “spotkanie jutro o 14”.',
    opts: () => ({ events: demoEvents(), calendars, locale: 'pl-PL', firstDay: 1, strings: { today: 'Teraz' }, view: 'week' }),
    code: `createCalendar('#calendar', {
  events,
  locale: 'pl-PL',     // dates, 12/24h and built-in strings
  firstDay: 1,         // Monday
  strings: { today: 'Teraz', newEvent: 'Dodaj' },
});`,
  },
  {
    id: 'events', title: 'Listen to everything', tag: 'API',
    desc: 'Every interaction emits an event. Drag, edit or create something and watch the log below the calendar.',
    log: true,
    opts: () => ({ events: demoEvents(), calendars, sidebar: false }),
    code: `const cal = createCalendar('#calendar', {
  events,
  onEventCreate: ({ event }) => api.post('/events', event),
  onEventUpdate: ({ event, old }) => api.put(\`/events/\${event.id}\`, event),
  onEventDelete: ({ event, occurrence }) => api.delete(\`/events/\${event.id}\`),
});

cal.on('viewChange', ({ view, start, end }) => loadRange(start, end));
cal.on('*', (name, payload) => console.log(name, payload));`,
  },
  {
    id: 'api', title: 'Drive it from code', tag: 'API',
    desc: 'The instance exposes the same tools as the UI. Click the buttons: they call the methods shown in the code.',
    actions: [
      ['quickAdd()', (c) => c.quickAdd('Design sync tomorrow 15:00-16:00 #work')],
      ['showFreeSlot(60)', (c) => c.showFreeSlot(60)],
      ['setView("month")', (c) => c.setView('month')],
      ['undo()', (c) => c.undo()],
      ['openPalette()', (c) => c.openPalette()],
      ['exportICS()', (c, log) => log(c.exportICS().split('\r\n').slice(0, 12).join('\n') + '\n…')],
    ],
    log: true,
    opts: () => ({ events: demoEvents(), calendars, sidebar: false }),
    code: `cal.quickAdd('Design sync tomorrow 15:00-16:00 #work');
cal.showFreeSlot(60);            // finds and highlights the next free hour
cal.setView('month');
cal.gotoDate('2026-12-01');
cal.undo(); cal.redo();
cal.addEvent({ title: 'Launch', start: '2026-11-20', allDay: true });
cal.updateEvent('launch', { color: '#db2777' });
const ics = cal.exportICS();     // RFC 5545
cal.importICS(await file.text());
cal.openPalette('free');`,
  },
  {
    id: 'mount', title: 'Tooltips with eventDidMount', tag: 'Rendering',
    desc: 'eventDidMount runs for every rendered event element, so you can attach tooltips, data attributes or a third-party library. Hover an event.',
    opts: () => ({
      events: demoEvents(), calendars, sidebar: false,
      eventDidMount: ({ el, event }) => {
        el.title = `${event.title}\n${event.start.toLocaleString()}${event.location ? `\n📍 ${event.location}` : ''}`;
        el.dataset.calendar = event.calendar || '';
      },
    }),
    code: `createCalendar('#calendar', {
  events,
  eventDidMount: ({ el, event, view }) => {
    el.title = \`\${event.title} · \${event.location ?? ''}\`;
    tippy(el, { content: event.notes });   // any tooltip library
  },
});`,
  },
];

// ---- "Style any part" examples: classNames + CSS, injected only while the example is open
const STYLE_EXAMPLES = [
  {
    id: 'parts-toolbar', title: 'Toolbar, title and buttons', tag: 'Style any part',
    desc: 'classNames adds your own classes to any part of the calendar. Here the toolbar gets a gradient and the buttons become pills. Tailwind utility classes work the same way, e.g. { toolbar: "bg-slate-900 text-white" }.',
    classNames: { toolbar: 'x-toolbar', title: 'x-title', button: 'x-btn', viewSwitcher: 'x-switch' },
    css: `.x-toolbar { background: linear-gradient(90deg, #4f46e5, #db2777); border-bottom: 0; }
.x-toolbar .x-title { color: #fff; letter-spacing: -0.03em; }
.x-toolbar .x-btn { border-radius: 999px !important; background: #ffffff26 !important; color: #fff !important; border-color: #ffffff40 !important; }
.x-toolbar .x-switch { background: #ffffff26; border-radius: 999px; }
.x-toolbar .x-switch button { color: #ffffffcc; border-radius: 999px; }
.x-toolbar .x-switch button[aria-selected="true"] { background: #fff; color: #4f46e5; }
.x-toolbar select.x-switch { background: #ffffff26; color: #fff; border-color: #ffffff55; border-radius: 999px; }
.x-toolbar .ixc-search, .x-toolbar .ixc-zoom { border-color: #ffffff55; color: #fff; }
.x-toolbar .ixc-search input { color: #fff; }
.x-toolbar .ixc-search input::placeholder { color: #ffffffb3; }
.x-toolbar .ixc-clash { background: #ffffff26 !important; color: #fff !important; }`,
  },
  {
    id: 'parts-days', title: 'Today, weekends and day headers', tag: 'Style any part',
    desc: 'Target today, weekends and the day headers separately: a tinted today column with an accent bar, hatched weekends and bold headers.',
    classNames: { today: 'x-today', weekend: 'x-weekend', dayHeader: 'x-head' },
    date: () => new Date(),
    css: `.ixc-col.x-today { background: color-mix(in srgb, var(--ixc-accent) 7%, transparent); box-shadow: inset 0 3px 0 var(--ixc-accent); }
.ixc-col.x-weekend, .ixc-mo-cell.x-weekend {
  background-image: repeating-linear-gradient(135deg, transparent 0 8px, color-mix(in srgb, var(--ixc-fg) 5%, transparent) 8px 9px);
}
.x-head .ixc-tg-wd { font-weight: 700; color: var(--ixc-fg); }
.x-head.x-today .ixc-tg-num { border-radius: 999px; }`,
  },
  {
    id: 'parts-events', title: 'Event cards', tag: 'Style any part',
    desc: 'The event, its title and its time are separate parts. Here events become raised cards with a colored top edge and an uppercase time.',
    classNames: { event: 'x-card', eventTitle: 'x-card-title', eventTime: 'x-card-time' },
    css: `.ixc-ev.x-card { background: var(--ixc-bg); color: var(--ixc-fg); border-radius: 10px;
  box-shadow: 0 1px 2px #0000000f, 0 6px 16px -8px #0000004d, inset 0 3px 0 var(--c); }
.ixc-ev.x-card:hover { background: var(--ixc-bg); box-shadow: 0 2px 4px #00000014, 0 10px 22px -8px #00000059, inset 0 3px 0 var(--c); }
.x-card .x-card-title { font-weight: 700; }
.x-card .x-card-time { text-transform: uppercase; color: var(--c); opacity: 1; font-weight: 600; }`,
  },
  {
    id: 'parts-grid', title: 'Grid, time labels and now line', tag: 'Style any part',
    desc: 'Restyle the time grid itself: bolder hour labels, dotted time outside business hours and a glowing now line.',
    classNames: { timeLabel: 'x-label', businessOff: 'x-off', nowIndicator: 'x-now', dayColumn: 'x-col' },
    date: () => new Date(),
    css: `.x-label { font: 600 11px/1 system-ui, sans-serif; color: var(--ixc-fg); }
.ixc-off.x-off { background: radial-gradient(color-mix(in srgb, var(--ixc-fg) 18%, transparent) 1px, transparent 1px) 0 0 / 10px 10px; }
.ixc-now.x-now { height: 3px; background: linear-gradient(90deg, #f43f5e, #f59e0b); box-shadow: 0 0 12px #f43f5e99; }
.ixc-now.x-now::before { background: #f43f5e; box-shadow: 0 0 0 4px #f43f5e33; }
.ixc-col.x-col { border-left-style: dashed; }`,
  },
  {
    id: 'parts-sidebar', title: 'Sidebar, quick add and mini month', tag: 'Style any part',
    desc: 'The sidebar and everything in it can be styled on its own: a dark sidebar next to a light grid, with a glowing quick add box.',
    classNames: { sidebar: 'x-side', quickAdd: 'x-qa', miniMonth: 'x-mini', calendarList: 'x-cal' },
    css: `.ixc-side.x-side { background: #0f172a; color: #e2e8f0; border-right: 0; }
.x-side .ixc-side-h, .x-side .ixc-mini-g i, .x-side .ixc-qa-prev, .x-side .ixc-keys, .x-side .ixc-cal em { color: #94a3b8; }
.x-side .x-qa { background: #1e293b; border-color: #334155; color: #a78bfa; box-shadow: 0 0 0 3px #7c3aed33; }
.x-side .x-qa input { color: #fff; }
.x-side .x-mini .ixc-cur { background: #a78bfa !important; color: #0f172a !important; }
.x-side .x-mini button:hover, .x-side .x-cal:hover { background: #1e293b; }
.x-side .ixc-ib { color: #cbd5e1; }
.x-side .ixc-ib:hover { background: #1e293b; }
.x-side kbd { background: #1e293b; border-color: #334155; color: #cbd5e1; }`,
  },
  {
    id: 'parts-popups', title: 'Editor, palette and toast', tag: 'Style any part',
    desc: 'Pop-ups are parts too. Use the buttons to open the editor, the palette or a toast.',
    classNames: { editor: 'x-editor', palette: 'x-pal', toast: 'x-toast' },
    actions: [
      ['Open editor', (c) => { const el = c.main.querySelector('.ixc-ev--box[data-key]'); if (el) c.openEditor(el.dataset.key, el); }],
      ['Open palette', (c) => c.openPalette()],
      ['Show toast', (c) => c.undo()],
    ],
    css: `.ixc-pop.x-editor { border-radius: 20px; border: 2px solid var(--c); box-shadow: 0 30px 60px -20px color-mix(in srgb, var(--c) 60%, transparent); }
.ixc-pal.x-pal { border-radius: 22px; border: 0; box-shadow: 0 0 0 1px #7c3aed55, 0 40px 80px -20px #7c3aed80; }
.x-pal .ixc-pal-item.ixc-on { background: #7c3aed !important; color: #fff !important; }
.ixc-toast.x-toast { background: linear-gradient(90deg, #4f46e5, #db2777); color: #fff; border-radius: 999px; padding-left: 18px; }`,
  },
  {
    id: 'parts-css', title: 'Plain CSS, no options', tag: 'Style any part',
    desc: 'You do not need classNames at all: every part has a stable ixc-* class. Wrap the calendar in your own class and override what you like.',
    hostClass: 'brand-cal',
    css: `/* <div class="brand-cal"><div id="calendar"></div></div> */
.brand-cal .ixc { --ixc-accent: #0d9488; --ixc-radius: 16px; border-width: 2px; }
.brand-cal .ixc-bar { background: var(--ixc-bg-soft); }
.brand-cal .ixc-tg-day .ixc-tg-num { font-size: 22px; }
.brand-cal .ixc-ev { border-radius: 12px; }
.brand-cal .ixc-hours span { color: #0d9488; }
.brand-cal .ixc-tg-allday { background: color-mix(in srgb, #0d9488 6%, transparent); }`,
  },
];
for (const x of STYLE_EXAMPLES) {
  x.opts = () => ({
    events: demoEvents(), calendars, sidebar: x.id === 'parts-sidebar',
    ...(x.classNames ? { classNames: x.classNames } : {}), ...(x.date ? { date: x.date() } : {}),
  });
  const cn = x.classNames ? JSON.stringify(x.classNames, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:').replace(/\n/g, '\n  ') : '';
  x.code = `${cn ? `createCalendar('#calendar', {\n  events,\n  classNames: ${cn},\n});\n\n` : ''}/* CSS */\n${x.css}`;
}
EXAMPLES.push(...STYLE_EXAMPLES);


// ---------------------------------------------------------------- more recipes (shown on the docs page)
const store = new Map(); // fake backend for the data examples
const sampleICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ics-1
DTSTART:${iso(at(1, 16)).replace(/[-:]/g, '')}00
DTEND:${iso(at(1, 17)).replace(/[-:]/g, '')}00
SUMMARY:Imported: Tax advisor
LOCATION:Main street 12
END:VEVENT
BEGIN:VEVENT
UID:ics-2
DTSTART;VALUE=DATE:${ymdL(at(3, 0)).replace(/-/g, '')}
SUMMARY:Imported: Conference
END:VEVENT
END:VCALENDAR`;
const notes = (o) => ({ events: demoEvents(), calendars, sidebar: false, ...o });

const MORE = [
  // ---------------- Basics
  {
    id: 'start-view', title: 'Open on a date and view', tag: 'Basics',
    desc: 'Choose the first view and date, and which view buttons appear (in your order).',
    opts: () => notes({ view: 'month', date: at(21, 0), views: ['month', 'week', 'agenda'] }),
    code: `createCalendar('#calendar', {
  events,
  view: 'month',
  date: '2026-12-01',
  views: ['month', 'week', 'agenda'], // order = button order
});`,
  },
  {
    id: 'n-days', title: 'N-day view (4 days)', tag: 'Basics',
    desc: 'The “days” view shows any number of days starting from the current date. Great for phones and planners.',
    opts: () => notes({ view: 'days', daysCount: 4, views: ['days', 'week', 'month'] }),
    code: `createCalendar('#calendar', {
  events,
  view: 'days',
  daysCount: 4,
  views: ['days', 'week', 'month'],
});`,
  },
  {
    id: 'us', title: 'US style: Sunday first, 12-hour clock', tag: 'Basics',
    desc: 'The locale decides the clock format; firstDay decides the first column.',
    opts: () => notes({ locale: 'en-US', firstDay: 0 }),
    code: `createCalendar('#calendar', {
  events,
  locale: 'en-US', // 9am, 2:30pm
  firstDay: 0,     // Sunday
});`,
  },
  {
    id: 'weekdays', title: 'Work week only', tag: 'Basics',
    desc: 'Hide Saturday and Sunday in week, N-day and month views.',
    opts: () => notes({ weekends: false, view: 'week' }),
    code: `createCalendar('#calendar', { events, weekends: false });`,
  },
  {
    id: 'day-only', title: 'Single day, big slots', tag: 'Basics',
    desc: 'One view, no switcher, taller rows: a reception desk or a kiosk screen.',
    opts: () => notes({ view: 'day', views: ['day'], slotHeight: 36, dayStart: 7, dayEnd: 21, date: at(2, 0) }),
    code: `createCalendar('#calendar', {
  events,
  view: 'day',
  views: ['day'],     // a single view hides the switcher
  slotHeight: 36,
  dayStart: 7,
  dayEnd: 21,
});`,
  },
  {
    id: 'fixed-height', title: 'Fixed height', tag: 'Basics',
    desc: 'By default the calendar fills its container. Pass height to fix it instead.',
    opts: () => notes({ height: 420, view: 'month' }),
    code: `createCalendar('#calendar', { events, height: 420 }); // or '60vh'`,
  },

  // ---------------- Data
  {
    id: 'fetch', title: 'Load events from an API', tag: 'Data',
    desc: 'Load the visible range whenever the view changes. This example fakes the server with a 400 ms delay.',
    log: true,
    opts: () => ({
      events: [], calendars, sidebar: false,
      onViewChange: ({ start, end }) => {
        setTimeout(() => current?.setEvents(demoEvents().filter((e) => e.start < end && e.end > start)), 400);
      },
    }),
    code: `const cal = createCalendar('#calendar', {
  events: [],
  onViewChange: async ({ start, end }) => {
    const res = await fetch(\`/api/events?from=\${start.toISOString()}&to=\${end.toISOString()}\`);
    cal.setEvents(await res.json());   // no undo step
  },
});`,
  },
  {
    id: 'local', title: 'Save to localStorage', tag: 'Data',
    desc: 'onChange gives you the full list after every change. Drag something, then reload the page: it is still there.',
    opts: () => {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem('ixc-demo-events') || 'null'); } catch { /* ignore */ }
      return { events: saved || demoEvents().slice(0, 12), calendars, sidebar: false, onChange: ({ events }) => { try { localStorage.setItem('ixc-demo-events', JSON.stringify(events)); } catch { /* ignore */ } } };
    },
    actions: [['Reset', (c) => { try { localStorage.removeItem('ixc-demo-events'); } catch { /* ignore */ } c.setEvents(demoEvents().slice(0, 12)); }]],
    code: `const saved = JSON.parse(localStorage.getItem('events') || '[]');

createCalendar('#calendar', {
  events: saved,                     // ISO strings are fine
  onChange: ({ events }) => localStorage.setItem('events', JSON.stringify(events)),
});`,
  },
  {
    id: 'crud', title: 'Sync create / update / delete to a server', tag: 'Data',
    desc: 'Fine-grained callbacks map one-to-one to REST calls. The log shows the requests this would send.',
    log: true,
    opts: () => ({
      events: demoEvents(), calendars, sidebar: false,
      onEventCreate: ({ event }) => { store.set(event.id, event); current?._toast(`POST /events  “${event.title || 'untitled'}”`); },
      onEventUpdate: ({ event }) => current?._toast(`PUT /events/${event.id}`),
      onEventDelete: ({ event }) => current?._toast(`DELETE /events/${event.id}`),
    }),
    code: `createCalendar('#calendar', {
  events,
  onEventCreate: ({ event }) => api.post('/events', event),
  onEventUpdate: ({ event }) => api.put(\`/events/\${event.id}\`, event),
  onEventDelete: ({ event, occurrence }) =>
    occurrence
      ? api.post(\`/events/\${event.id}/skip\`, { date: occurrence })  // one of a series
      : api.delete(\`/events/\${event.id}\`),
});`,
  },
  {
    id: 'ics-import', title: 'Import an .ics file', tag: 'Data',
    desc: 'importICS takes the text of any iCalendar file (Google, Outlook, Apple). The button imports a small sample; the palette has “Import .ics” for real files.',
    actions: [['importICS(sample)', (c) => { c.importICS(sampleICS); c.gotoDate(at(1, 0)); }], ['Pick a file…', (c) => c.pickICS()]],
    opts: () => notes({ events: demoEvents().slice(0, 6) }),
    code: `// from a file input
input.onchange = async () => cal.importICS(await input.files[0].text());

// or from a URL
cal.importICS(await fetch('/team.ics').then((r) => r.text()));`,
  },
  {
    id: 'export', title: 'Export .ics and JSON', tag: 'Data',
    desc: 'exportICS returns RFC 5545 text you can serve or download; download() saves a file directly.',
    log: true,
    actions: [['exportICS()', (c, log) => log(c.exportICS().split('\r\n').slice(0, 14).join('\n') + '\n…')], ['download("ics")', (c) => c.download('ics', 'my-calendar.ics')], ['download("json")', (c) => c.download('json')]],
    opts: () => notes({}),
    code: `const text = cal.exportICS();       // string
cal.download('ics', 'team.ics');      // saves a file
cal.download('json');                 // calendar.json`,
  },
  {
    id: 'multi-day', title: 'All-day and multi-day events', tag: 'Data',
    desc: 'Date-only strings are all-day. The end is exclusive, like iCalendar: a 3-day trip ends on the day after.',
    opts: () => notes({
      view: 'month', events: [
        { id: 'trip', title: 'Lisbon trip', start: ymdL(at(2, 0)), end: ymdL(at(5, 0)), color: '#ea580c' },
        { id: 'conf', title: 'Conference', start: ymdL(at(8, 0)), end: ymdL(at(10, 0)), color: '#7c3aed' },
        { id: 'night', title: 'Night shift', start: at(4, 22), end: at(5, 6), color: '#0891b2' },
        { id: 'bday', title: 'Birthday', start: ymdL(at(12, 0)), allDay: true, color: '#db2777' },
      ],
    }),
    code: `events: [
  { title: 'Lisbon trip', start: '2026-11-11', end: '2026-11-14' }, // 11, 12, 13
  { title: 'Night shift', start: '2026-11-13T22:00', end: '2026-11-14T06:00' },
  { title: 'Birthday', start: '2026-11-21', allDay: true },
]`,
  },
  {
    id: 'colors', title: 'Colors per calendar or per event', tag: 'Data',
    desc: 'Events take their calendar’s color; an event’s own color wins. Without either they use the accent.',
    opts: () => notes({
      calendars: [{ id: 'a', name: 'Engineering', color: '#0ea5e9' }, { id: 'b', name: 'Sales', color: '#f59e0b' }],
      events: [
        { id: 1, title: 'Deploy', start: at(0, 10), end: at(0, 11), calendar: 'a' },
        { id: 2, title: 'Demo for Acme', start: at(1, 13), end: at(1, 14), calendar: 'b' },
        { id: 3, title: 'Hotfix (red)', start: at(2, 9), end: at(2, 10), calendar: 'a', color: '#dc2626' },
        { id: 4, title: 'No calendar', start: at(3, 15), end: at(3, 16) },
      ], sidebar: true,
    }),
    code: `createCalendar('#calendar', {
  calendars: [
    { id: 'eng', name: 'Engineering', color: '#0ea5e9' },
    { id: 'sales', name: 'Sales', color: '#f59e0b' },
  ],
  events: [
    { title: 'Deploy', start, end, calendar: 'eng' },
    { title: 'Hotfix', start, end, calendar: 'eng', color: '#dc2626' }, // wins
  ],
});`,
  },
  {
    id: 'own-filters', title: 'Calendar filters in your own UI', tag: 'Data',
    desc: 'Hide the sidebar and drive filters from your app with toggleCalendar().',
    actions: calendars.map((c) => [`toggle ${c.name}`, (cal) => cal.toggleCalendar(c.id)]),
    opts: () => notes({}),
    code: `checkbox.onchange = () => cal.toggleCalendar('work', checkbox.checked);
// start hidden: calendars: [{ id: 'travel', name: 'Travel', visible: false }]`,
  },

  // ---------------- Behaviour
  {
    id: 'lock-past', title: 'Lock the past', tag: 'Behaviour',
    desc: 'Past events cannot be moved and nothing can be dropped into the past. eventClass dims them further.',
    opts: () => notes({
      date: new Date(),
      eventAllow: (e, { old }) => e.start >= new Date() && (!old || old.start >= new Date()),
      eventClass: (e) => (e.end < new Date() ? 'is-locked' : ''),
    }),
    css: '.ixc-ev.is-locked { filter: grayscale(1); opacity: .45; cursor: not-allowed; }',
    code: `createCalendar('#calendar', {
  events,
  eventAllow: (event, { old }) => event.start >= new Date() && (!old || old.start >= new Date()),
  eventClass: (event) => (event.end < new Date() ? 'is-locked' : ''),
});`,
  },
  {
    id: 'snap', title: 'Hour grid, 30-minute snapping', tag: 'Behaviour',
    desc: 'slotMinutes sets the grid rows, snapMinutes how far drags jump.',
    opts: () => notes({ slotMinutes: 60, snapMinutes: 30, slotHeight: 44 }),
    code: `createCalendar('#calendar', {
  events,
  slotMinutes: 60,
  snapMinutes: 30,
  slotHeight: 44,
});`,
  },
  {
    id: 'move-only', title: 'Move but never create', tag: 'Behaviour',
    desc: 'selectable: false turns off drag-to-create and double-click, editing stays on.',
    opts: () => notes({ selectable: false }),
    code: `createCalendar('#calendar', { events, selectable: false });`,
  },
  {
    id: 'office-hours', title: 'Only inside business hours', tag: 'Behaviour',
    desc: 'Refuse anything that starts before 9:00 or ends after 17:00 on a weekday.',
    opts: () => notes({
      businessHours: { start: 9, end: 17, days: [1, 2, 3, 4, 5] },
      eventAllow: (e) => e.allDay || ((e.start.getDay() % 6 !== 0) && e.start.getHours() >= 9 && (e.end.getHours() < 17 || (e.end.getHours() === 17 && e.end.getMinutes() === 0)) && e.start.toDateString() === new Date(e.end - 1).toDateString()),
    }),
    code: `createCalendar('#calendar', {
  events,
  businessHours: { start: 9, end: 17, days: [1, 2, 3, 4, 5] },
  eventAllow: (e) => {
    if (e.allDay) return true;
    const weekday = e.start.getDay() % 6 !== 0;
    const from = e.start.getHours() >= 9;
    const to = e.end.getHours() * 60 + e.end.getMinutes() <= 17 * 60;
    return weekday && from && to;
  },
});`,
  },
  {
    id: 'no-keys', title: 'No keyboard shortcuts, no palette', tag: 'Behaviour',
    desc: 'For pages that have their own shortcuts.',
    opts: () => notes({ keyboard: false, palette: false }),
    code: `createCalendar('#calendar', { events, keyboard: false, palette: false });`,
  },
  {
    id: 'no-clashes', title: 'Turn off clash detection', tag: 'Behaviour',
    desc: 'If overlaps are normal in your domain, hide the badge and markers.',
    opts: () => notes({ showClashes: false, nowIndicator: false }),
    code: `createCalendar('#calendar', { events, showClashes: false, nowIndicator: false });`,
  },

  // ---------------- Rendering
  {
    id: 'emoji', title: 'Emoji per calendar', tag: 'Rendering',
    desc: 'eventContent for every variant: boxes, bars and month dots all get an emoji in front of the title.',
    opts: () => {
      const EMOJI = { work: '💼', team: '👥', focus: '🎧', personal: '🌿', travel: '✈️' };
      return notes({ view: 'month', eventContent: (e) => `<span style="display:flex;gap:6px;align-items:center;min-width:0"><span>${EMOJI[e.calendar] || '📌'}</span><b class="ixc-ev-t">${esc(e.title)}</b></span>` });
    },
    code: `const EMOJI = { work: '💼', team: '👥', personal: '🌿', travel: '✈️' };

createCalendar('#calendar', {
  events,
  eventContent: (e) => \`<span>\${EMOJI[e.calendar] ?? '📌'}</span> <b>\${e.title}</b>\`,
});`,
  },
  {
    id: 'attendees', title: 'Extra data: attendees and status', tag: 'Rendering',
    desc: 'Events keep any extra fields you give them. Here “attendees” is shown as a count and status: "cancelled" is struck through.',
    opts: () => notes({
      events: demoEvents().slice(0, 16).map((e, i) => ({ ...e, attendees: (i * 7) % 9 + 1, status: i % 5 === 3 ? 'cancelled' : 'confirmed' })),
      eventClass: (e) => (e.status === 'cancelled' ? 'is-cancelled' : ''),
      eventContent: (e, { variant, height }) => (variant === 'box' && height >= 34
        ? `<b class="ixc-ev-t">${esc(e.title)}</b><span class="ixc-ev-time">👤 ${e.attendees} · ${e.status}</span>` : null),
    }),
    css: '.ixc-ev.is-cancelled { opacity: .55; } .ixc-ev.is-cancelled .ixc-ev-t { text-decoration: line-through; }',
    code: `events: [{ title: 'Review', start, end, attendees: 6, status: 'cancelled' }],
eventClass: (e) => (e.status === 'cancelled' ? 'is-cancelled' : ''),
eventContent: (e, { variant }) =>
  variant === 'box' ? \`<b>\${e.title}</b><span>👤 \${e.attendees} · \${e.status}</span>\` : null,

/* CSS */
.ixc-ev.is-cancelled .ixc-ev-t { text-decoration: line-through; }`,
  },
  {
    id: 'element-content', title: 'Return a DOM element', tag: 'Rendering',
    desc: 'eventContent can return an HTMLElement instead of a string, e.g. one built by your framework or a template.',
    opts: () => notes({
      eventContent: (e, { variant }) => {
        if (variant !== 'box') return null;
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;flex-direction:column;gap:2px';
        const b = document.createElement('b'); b.className = 'ixc-ev-t'; b.textContent = e.title;
        const s = document.createElement('small'); s.textContent = e.location || e.calendar || ''; s.style.opacity = '.75';
        el.append(b, s);
        return el;
      },
    }),
    code: `eventContent: (event, { variant }) => {
  if (variant !== 'box') return null;
  const el = document.createElement('div');
  el.innerHTML = '<b></b><small></small>';
  el.querySelector('b').textContent = event.title;   // safe text
  el.querySelector('small').textContent = event.location ?? '';
  return el;
}`,
  },

  // ---------------- Resources
  {
    id: 'timeline-day', title: 'Day timeline 6:00–22:00, zoomed', tag: 'Resources',
    desc: 'dayStart / dayEnd crop the day timeline; zoom with + and − or Ctrl + wheel.',
    opts: () => notes({ view: 'timeline', views: ['timeline'], resources, dayStart: 6, dayEnd: 22, date: at(2, 0) }),
    code: `createCalendar('#calendar', {
  events,
  resources,
  view: 'timeline',
  dayStart: 6,
  dayEnd: 22,
});`,
  },
  {
    id: 'timeline-hours', title: 'Week timeline, custom hours', tag: 'Resources',
    desc: 'timelineHours sets which hours of each day the week timeline shows.',
    opts: () => notes({ view: 'timeline', views: ['timeline'], timelineDays: 7, timelineHours: [8, 18], resources: resources.filter((r) => r.group === 'People') }),
    code: `createCalendar('#calendar', {
  events,
  resources,
  view: 'timeline',
  timelineDays: 7,
  timelineHours: [8, 18],
});`,
  },

  // ---------------- Layouts
  {
    id: 'year-only', title: 'Year overview', tag: 'Layouts',
    desc: 'The year heat map on its own: how busy every day is. Click a day to open it.',
    opts: () => notes({ view: 'year', views: ['year', 'day'] }),
    code: `createCalendar('#calendar', { events, view: 'year', views: ['year', 'day'] });`,
  },
  {
    id: 'agenda-3', title: 'Next three days', tag: 'Layouts',
    desc: 'A compact “up next” list for a dashboard card.',
    opts: () => notes({ view: 'agenda', views: ['agenda'], agendaDays: 3, toolbar: false, density: 'compact', date: new Date() }),
    code: `createCalendar('#upNext', {
  events,
  view: 'agenda',
  views: ['agenda'],
  agendaDays: 3,
  toolbar: false,
  density: 'compact',
});`,
  },

  // ---------------- Styling
  {
    id: 'dark', title: 'Dark mode', tag: 'Styling',
    desc: 'theme: "dark" forces it; "auto" follows the operating system.',
    opts: () => notes({ theme: 'dark', preset: 'grape', eventStyle: 'solid' }),
    code: `createCalendar('#calendar', { events, theme: 'dark', preset: 'grape', eventStyle: 'solid' });`,
  },
  {
    id: 'brutal', title: 'Brutal preset', tag: 'Styling',
    desc: 'Square corners, hard shadow, thick borders. One option.',
    opts: () => notes({ preset: 'brutal', eventStyle: 'solid' }),
    code: `createCalendar('#calendar', { events, preset: 'brutal', eventStyle: 'solid' });`,
  },
  {
    id: 'glass-bg', title: 'Glass events on a photo-like background', tag: 'Styling',
    desc: 'The glass style blurs whatever is behind the calendar. Give its container a gradient and make the calendar background translucent.',
    hostClass: 'glass-host',
    opts: () => notes({ eventStyle: 'glass', theme: 'dark' }),
    css: `.glass-host { background: radial-gradient(circle at 20% 20%, #7c3aed, transparent 50%), radial-gradient(circle at 80% 70%, #0891b2, transparent 50%), #0b0b12; border-radius: 18px; }
.glass-host .ixc { --ixc-bg: #0b0b1299; --ixc-bg-soft: #ffffff08; --ixc-border: #ffffff1a; backdrop-filter: blur(4px); }`,
    code: `createCalendar('#calendar', { events, eventStyle: 'glass', theme: 'dark' });

/* CSS */
.glass-host { background: radial-gradient(circle at 20% 20%, #7c3aed, transparent 50%), #0b0b12; }
.glass-host .ixc { --ixc-bg: #0b0b1299; --ixc-border: #ffffff1a; }`,
  },
  {
    id: 'tokens-only', title: 'Only CSS variables', tag: 'Styling',
    desc: 'Change the accent, radius, font and grid colors with a handful of tokens.',
    hostClass: 'tok-host',
    opts: () => notes({}),
    css: `.tok-host .ixc { --ixc-accent: #e11d48; --ixc-radius: 4px; --ixc-font: Georgia, serif; --ixc-border: #f1d5db; --ixc-bg-soft: #fff7f8; --ixc-now: #e11d48; }`,
    code: `.ixc {
  --ixc-accent: #e11d48;
  --ixc-radius: 4px;
  --ixc-font: Georgia, serif;
  --ixc-border: #f1d5db;
  --ixc-bg-soft: #fff7f8;
}`,
  },

  // ---------------- API
  {
    id: 'own-search', title: 'Search from your own input', tag: 'API',
    desc: 'setQuery filters every view and highlights matches.',
    actions: [['setQuery("review")', (c) => c.setQuery('review')], ['setQuery("gym")', (c) => c.setQuery('gym')], ['clear', (c) => c.setQuery('')]],
    opts: () => notes({ toolbar: false }),
    code: `searchInput.oninput = () => cal.setQuery(searchInput.value);`,
  },
  {
    id: 'history-buttons', title: 'Undo / redo buttons', tag: 'API',
    desc: 'Drag something, then use your own buttons. canUndo() tells you when to enable them.',
    log: true,
    actions: [['undo()', (c, log) => log(`undo → ${c.undo()}`)], ['redo()', (c, log) => log(`redo → ${c.redo()}`)], ['canUndo()', (c, log) => log(`canUndo → ${c.canUndo()}`)]],
    opts: () => notes({}),
    code: `undoBtn.onclick = () => cal.undo();
redoBtn.onclick = () => cal.redo();
cal.on('change', () => {
  undoBtn.disabled = !cal.canUndo();
  redoBtn.disabled = !cal.canRedo();
});`,
  },
  {
    id: 'navigate', title: 'Navigate from code', tag: 'API',
    desc: 'gotoDate, setView, prev, next and today; getRange tells you what is visible.',
    log: true,
    actions: [['gotoDate(+30 days)', (c) => c.gotoDate(at(30, 0))], ['setView("day")', (c) => c.setView('day')], ['next()', (c) => c.next()], ['today()', (c) => c.today()], ['getRange()', (c, log) => { const r = c.getRange(); log(`${r.start.toDateString()} → ${r.end.toDateString()}`); }]],
    opts: () => notes({}),
    code: `cal.gotoDate('2026-12-24');
cal.setView('day', '2026-12-24');
cal.next(); cal.prev(); cal.today();
const { start, end } = cal.getRange();`,
  },
  {
    id: 'quick-add-own', title: 'Your own quick-add box', tag: 'API',
    desc: 'parse() shows what a sentence means without saving; quickAdd() saves it.',
    log: true,
    actions: [
      ['parse("Lunch fri 13-14 #personal")', (c, log) => { const p = c.parse('Lunch fri 13-14 #personal'); log(JSON.stringify({ title: p.title, start: p.start.toLocaleString(), end: p.end.toLocaleString(), calendar: p.calendar })); }],
      ['quickAdd(…)', (c) => c.quickAdd('Lunch fri 13-14 #personal')],
    ],
    opts: () => notes({}),
    code: `input.oninput = () => preview.textContent = JSON.stringify(cal.parse(input.value));
input.onkeydown = (e) => e.key === 'Enter' && cal.quickAdd(input.value);`,
  },
];
for (const x of MORE) x.docsOnly = true;
EXAMPLES.push(...MORE);

// ---------------------------------------------------------------- top-6 features: sources, rules, background, selection, resources, views
const fakeFetch = (routes) => async (url) => {
  await new Promise((r) => setTimeout(r, 600)); // pretend network
  const u = new URL(url, location.href);
  const body = routes[u.pathname.split('/').pop()];
  if (body == null) return { ok: false, status: 404, statusText: 'Not Found' };
  const value = typeof body === 'function' ? body(u) : body;
  return { ok: true, status: 200, json: async () => value, text: async () => value };
};
const teamICS = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:feed-1\r\nDTSTART:${iso(at(1, 15)).replace(/[-:]/g, '')}00\r\nDTEND:${iso(at(1, 16)).replace(/[-:]/g, '')}00\r\nSUMMARY:Team feed: retro prep\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:feed-2\r\nDTSTART;VALUE=DATE:${ymdL(at(4, 0)).replace(/-/g, '')}\r\nSUMMARY:Team feed: offsite\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const garage = [
  { id: 'b1', title: 'Bay 1', kind: 'Alignment' }, { id: 'b2', title: 'Bay 2', kind: 'Diagnostics' }, { id: 'b3', title: 'Bay 3', kind: 'Body' },
  { id: 'b4', title: 'Bay 4', kind: 'EV', businessHours: { start: 10, end: 16, days: [1, 2, 3, 4, 5] } },
  { id: 'la', title: 'Lift A', kind: '2-post' }, { id: 'lb', title: 'Lift B', kind: '4-post' }, { id: 'pa', title: 'Paint', kind: 'Booth' }, { id: 'ti', title: 'Tires', kind: 'Fitting' },
];
const garageJobs = (d = 2) => [
  ['b1', 11, 12, 'Camry — geometry'], ['b1', 13, 15.5, 'Model Y — toe'], ['b2', 10, 12, 'Jetta — sensors'], ['b2', 10.5, 12.5, 'Caddy — no start'],
  ['b2', 13.5, 15, 'Golf — fault trace'], ['b4', 9.5, 10.5, 'Kona — recall'], ['b4', 13, 14.5, 'Bolt — software'], ['b4', 15, 17.5, 'Leaf — battery'],
  ['la', 11, 13.5, 'Service A'], ['la', 12, 14, 'Inspection'], ['la', 14.5, 16, 'Brakes'], ['lb', 9, 10.5, 'Exhaust'], ['lb', 13.5, 17.5, 'Gearbox rebuild'],
  ['pa', 10, 13, 'Full respray'], ['pa', 14, 15.5, 'Primer'], ['ti', 8, 9.5, 'Puncture'], ['ti', 10.5, 13, 'Fleet tires ×4'],
].map(([r, a, b, title], k) => ({ id: `g${k}`, title, resourceId: r, start: at(d, Math.floor(a), (a % 1) * 60), end: at(d, Math.floor(b), (b % 1) * 60), color: ['#ea580c', '#7c3aed', '#2563eb', '#0d9488'][k % 4] }));

const TOP = [
  // ---------------- sources
  {
    id: 'src-function', title: 'Load per range with a function', tag: 'Event sources', homeToo: true,
    desc: 'The events option can be a function. It is called with the visible range (and an AbortSignal) whenever you navigate; ranges already loaded are not fetched again. Watch the loading bar.',
    log: true,
    opts: () => notes({
      events: async ({ start, end }) => { await new Promise((r) => setTimeout(r, 700)); return demoEvents().filter((e) => e.start < end && e.end > start); },
      onLoading: ({ loading }) => current?._toast(loading ? 'Loading…' : 'Loaded'),
    }),
    code: `createCalendar('#calendar', {
  // called with the visible range; return an array or a Promise
  events: async ({ start, end, signal }) => {
    const res = await fetch(\`/api/events?from=\${start.toISOString()}&to=\${end.toISOString()}\`, { signal });
    return res.json();
  },
  onLoading: ({ loading }) => spinner.hidden = !loading,
});`,
  },
  {
    id: 'src-url', title: 'JSON feed URL', tag: 'Event sources',
    desc: 'Give a URL and the calendar calls it with ?start=…&end=… (ISO). Rename the params, add your own, or map the server format with transform. (This page fakes the server.)',
    opts: () => notes({
      fetch: fakeFetch({ events: (u) => demoEvents().filter((e) => e.start >= new Date(u.searchParams.get('from')) && e.start < new Date(u.searchParams.get('to'))).map((e) => ({ uid: e.id, name: e.title, from: e.start, to: e.end, team: e.calendar })) }),
      eventSources: [{ id: 'api', url: '/api/events', startParam: 'from', endParam: 'to', extraParams: { team: 'all' }, transform: (r) => ({ id: r.uid, title: r.name, start: r.from, end: r.to, calendar: r.team }) }],
    }),
    code: `createCalendar('#calendar', {
  eventSources: [{
    id: 'api',
    url: '/api/events',              // GET /api/events?from=…&to=…&team=all
    startParam: 'from',
    endParam: 'to',
    extraParams: { team: 'all' },    // or a function
    headers: { Authorization: \`Bearer \${token}\` },
    transform: (row) => ({ id: row.uid, title: row.name, start: row.from, end: row.to }),
  }],
  onSourceError: ({ source, error }) => toast(\`\${source}: \${error.message}\`),
});`,
  },
  {
    id: 'src-ics', title: 'Subscribe to an .ics feed', tag: 'Event sources',
    desc: 'Any iCalendar URL (Google, Outlook, Apple “public address”) works as a source. It is fetched once and parsed in the browser; the server must allow CORS.',
    opts: () => notes({ fetch: fakeFetch({ 'team.ics': teamICS }), eventSources: [{ id: 'team', ics: '/feeds/team.ics', color: '#db2777', editable: false }] }),
    code: `createCalendar('#calendar', {
  eventSources: [
    { id: 'team', ics: 'https://calendar.google.com/calendar/ical/…/basic.ics', color: '#db2777', editable: false },
  ],
});`,
  },
  {
    id: 'src-many', title: 'Several sources with colors', tag: 'Event sources',
    desc: 'Mix static arrays, functions and feeds. Each source can set color, calendar and editable for its events. Add or remove sources at runtime.',
    actions: [
      ['addEventSource(holidays)', (c) => c.addEventSource({ id: 'holidays', color: '#dc2626', display: 'background', events: [{ id: 'h1', title: 'Public holiday', start: ymdL(at(3, 0)), allDay: true }] })],
      ['removeEventSource("holidays")', (c) => c.removeEventSource('holidays')],
      ['refetchEvents()', (c) => c.refetchEvents()],
      ['getEventSources()', (c) => c._toast(c.getEventSources().map((s) => `${s.id}:${s.kind}`).join(', '))],
    ],
    opts: () => notes({
      events: [],
      eventSources: [
        { id: 'work', color: '#2563eb', events: demoEvents().filter((e) => e.calendar === 'work').map(({ calendar, ...e }) => e) },
        { id: 'gym', color: '#16a34a', events: ({ start }) => [1, 3, 5].map((d) => ({ id: `gym${d}`, title: 'Gym', start: new Date(start.getFullYear(), start.getMonth(), start.getDate() + d - 1, 18), end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + d - 1, 19) })) },
      ],
    }),
    code: `createCalendar('#calendar', {
  eventSources: [
    { id: 'work', color: '#2563eb', events: workEvents },
    { id: 'gym', color: '#16a34a', events: ({ start, end }) => gymSlots(start, end) },
  ],
});
cal.addEventSource({ id: 'holidays', display: 'background', events: holidays });
cal.removeEventSource('holidays');
cal.refetchEvents();`,
  },

  // ---------------- repeat rules
  {
    id: 'rules-advanced', title: '“2nd Tuesday”, “last Friday”, 1st & 15th', tag: 'Data', homeToo: true,
    desc: 'Monthly by weekday position (bysetpos), by month day (negative counts from the end), yearly in chosen months, every N weeks and hourly. All round-trip through .ics, and quick add understands “every 2nd tuesday” or “w każdy ostatni piątek”.',
    opts: () => notes({
      view: 'month', events: [
        { id: 'r1', title: 'Board (2nd Tue)', start: at(1, 10), end: at(1, 11), color: '#7c3aed', rrule: { freq: 'monthly', byweekday: [2], bysetpos: 2 } },
        { id: 'r2', title: 'Payroll (last Fri)', start: at(4, 12), end: at(4, 13), color: '#16a34a', rrule: { freq: 'monthly', byweekday: [5], bysetpos: -1 } },
        { id: 'r3', title: 'Invoices (1st & 15th)', start: ymdL(new Date(week.getFullYear(), week.getMonth(), 1)), allDay: true, color: '#ea580c', rrule: { freq: 'monthly', bymonthday: [1, 15] } },
        { id: 'r4', title: 'Sprint review', start: at(4, 15), end: at(4, 16), color: '#2563eb', rrule: { freq: 'weekly', interval: 2 } },
      ],
    }),
    code: `events: [
  { title: 'Board', start, end, rrule: { freq: 'monthly', byweekday: [2], bysetpos: 2 } },    // 2nd Tuesday
  { title: 'Payroll', start, end, rrule: { freq: 'monthly', byweekday: [5], bysetpos: -1 } }, // last Friday
  { title: 'Invoices', start, allDay: true, rrule: { freq: 'monthly', bymonthday: [1, 15] } },
  { title: 'Sprint review', start, end, rrule: { freq: 'weekly', interval: 2 } },
  { title: 'Thanksgiving', start, rrule: { freq: 'yearly', bymonth: [11], byweekday: [4], bysetpos: 4 } },
  { title: 'Backup check', start, end, rrule: { freq: 'hourly', interval: 6 } },
]`,
  },

  // ---------------- background events + selection + constraints
  {
    id: 'background', title: 'Background events', tag: 'Behaviour', homeToo: true,
    desc: 'display: "background" draws a shaded block behind the grid: closures, lunch breaks, availability. They are not draggable, never clash and never block the free-slot finder.',
    opts: () => notes({
      events: [...demoEvents(),
        { id: 'bg-lunch', title: 'Lunch break', start: at(0, 12), end: at(0, 13), display: 'background', color: '#16a34a', rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] } },
        { id: 'bg-closed', title: 'Office closed', start: at(4, 15), end: at(4, 19), display: 'background', color: '#dc2626' },
        { id: 'bg-trip', title: 'Out of office', start: ymdL(at(3, 0)), allDay: true, display: 'background', color: '#ea580c' },
      ],
    }),
    code: `events: [
  { title: 'Lunch break', start: '2026-11-09T12:00', end: '2026-11-09T13:00', display: 'background',
    color: '#16a34a', rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] } },
  { title: 'Office closed', start: '2026-11-13T15:00', end: '2026-11-13T19:00', display: 'background', color: '#dc2626' },
  { title: 'Out of office', start: '2026-11-12', allDay: true, display: 'background' },
]`,
  },
  {
    id: 'select-range', title: 'Select a range, then decide', tag: 'Behaviour', homeToo: true,
    desc: 'With selectMode: "range" dragging selects time instead of creating an event; you get onSelect with the range and can open your own booking form. Esc or a click clears it.',
    log: true,
    actions: [['Book the selection', (c, log) => { const s = c.getSelection(); if (!s) { log('Drag on the grid first'); return; } c.addEvent({ title: 'Booked', ...s }); c.unselect(); }], ['unselect()', (c) => c.unselect()]],
    opts: () => notes({ selectMode: 'range', onSelect: ({ start, end }) => current?._toast(`Selected ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`) }),
    code: `const cal = createCalendar('#calendar', {
  selectMode: 'range',          // drag = select, not create
  onSelect: ({ start, end, allDay, resourceId }) => openBookingForm({ start, end }),
  onUnselect: () => closeBookingForm(),
});
cal.selectRange({ start, end });  // from code
cal.unselect();`,
  },
  {
    id: 'no-overlap', title: 'No double booking (built-in)', tag: 'Behaviour',
    desc: 'eventOverlap: false and selectOverlap: false refuse anything that lands on another event of the same resource. A refused drop puts the event back where it was. Use a function for exceptions.',
    opts: () => notes({ eventOverlap: false, selectOverlap: false }),
    code: `createCalendar('#calendar', {
  events,
  eventOverlap: false,
  selectOverlap: false,
  // or decide per pair:
  // eventOverlap: (still, moving) => still.calendar === 'focus',
});`,
  },
  {
    id: 'valid-range', title: 'Only this month is bookable', tag: 'Behaviour',
    desc: 'validRange refuses moves, resizes and new events outside the range.',
    opts: () => notes({ view: 'month', validRange: { start: ymdL(new Date(week.getFullYear(), week.getMonth(), 1)), end: ymdL(new Date(week.getFullYear(), week.getMonth() + 1, 1)) } }),
    code: `createCalendar('#calendar', {
  events,
  validRange: { start: '2026-11-01', end: '2026-12-01' },
});`,
  },

  // ---------------- resources
  {
    id: 'garage', title: 'Workshop bays with columns', tag: 'Resources', homeToo: true,
    desc: 'resourceColumns adds columns to the resource area (here Bay | Kind). Bay 4 has its own business hours; overlapping jobs stack in lanes.',
    opts: () => notes({ view: 'timeline', views: ['timeline', 'resourceDay'], resources: garage, events: garageJobs(2), date: at(2, 0), resourceColumns: [{ field: 'title', label: 'Bay', width: 110 }, { field: 'kind', label: 'Kind', width: 110 }] }),
    code: `createCalendar('#calendar', {
  view: 'timeline',
  resources: [
    { id: 'b1', title: 'Bay 1', kind: 'Alignment' },
    { id: 'b4', title: 'Bay 4', kind: 'EV', businessHours: { start: 10, end: 16, days: [1, 2, 3, 4, 5] } },
    { id: 'la', title: 'Lift A', kind: '2-post' },
  ],
  resourceColumns: [
    { field: 'title', label: 'Bay', width: 110 },
    { field: 'kind', label: 'Kind', width: 110 },     // or render: (r) => html
  ],
  events: jobs,                                      // { resourceId: 'b1', … }
});`,
  },
  {
    id: 'nested', title: 'Nested, collapsible resources', tag: 'Resources',
    desc: 'Resources can have children. Click the arrows to collapse a building; group headers collapse too.',
    opts: () => notes({
      view: 'timeline', date: at(1, 0),
      resources: [
        { id: 'hq', title: 'Warsaw HQ', color: '#2563eb', children: [{ id: 'atlas', title: 'Atlas room' }, { id: 'nova', title: 'Nova room' }] },
        { id: 'kr', title: 'Kraków office', color: '#7c3aed', children: [{ id: 'studio', title: 'Studio' }, { id: 'kr-2', title: 'Wawel room' }] },
        { id: 'anna', title: 'Anna Kowalska', group: 'People' }, { id: 'marek', title: 'Marek Nowak', group: 'People' },
      ],
    }),
    code: `resources: [
  { id: 'hq', title: 'Warsaw HQ', children: [
    { id: 'atlas', title: 'Atlas room' },
    { id: 'nova', title: 'Nova room' },
  ] },
  { id: 'anna', title: 'Anna Kowalska', group: 'People' },   // grouped rows
]
// cal.toggleResource('r:hq') / cal.toggleResource('g:People')`,
  },
  {
    id: 'multi-resource', title: 'One event, several resources', tag: 'Resources',
    desc: 'resourceIds puts an event in several rows (a meeting needs a room and two people). Dragging it moves only the row you grabbed.',
    opts: () => notes({
      view: 'timeline', date: at(1, 0), resources: resources.slice(0, 5),
      events: [
        { id: 'mr1', title: 'Hiring panel', start: at(1, 10), end: at(1, 11, 30), resourceIds: ['atlas', 'anna', 'marek'], color: '#7c3aed' },
        { id: 'mr2', title: 'Podcast: guest', start: at(1, 13), end: at(1, 15), resourceIds: ['studio', 'anna'], color: '#db2777' },
      ],
    }),
    code: `events: [
  { title: 'Hiring panel', start, end, resourceIds: ['atlas', 'anna', 'marek'] },
]`,
  },
  {
    id: 'resource-day', title: 'Resources as columns', tag: 'Resources', homeToo: true,
    desc: 'The resourceDay view puts each resource in its own column for one day, a classic for clinics, salons and studios. Drag between columns to reassign.',
    opts: () => notes({ view: 'resourceDay', views: ['resourceDay', 'timeline', 'day'], resources: resources.filter((r) => r.group === 'People').concat(resources.filter((r) => r.group === 'Rooms')), date: at(1, 0) }),
    code: `createCalendar('#calendar', {
  view: 'resourceDay',
  views: ['resourceDay', 'timeline', 'day'],
  resources,          // one column per resource (leaves of a tree)
  events,
});`,
  },
  {
    id: 'timeline-month', title: 'Month timeline', tag: 'Resources',
    desc: 'timelineDays: "month" shows one cell per day for the whole month: good for vacations, rentals and capacity planning.',
    opts: () => notes({
      view: 'timeline', timelineDays: 'month', resources: resources.filter((r) => r.group === 'People'),
      events: [
        { id: 'v1', title: 'Vacation', start: ymdL(at(3, 0)), end: ymdL(at(10, 0)), resourceId: 'anna', color: '#16a34a' },
        { id: 'v2', title: 'Conference', start: ymdL(at(8, 0)), end: ymdL(at(10, 0)), resourceId: 'marek', color: '#7c3aed' },
        { id: 'v3', title: 'Sick leave', start: ymdL(at(0, 0)), end: ymdL(at(2, 0)), resourceId: 'julia', color: '#dc2626' },
        { id: 'v4', title: 'On call', start: ymdL(at(14, 0)), end: ymdL(at(21, 0)), resourceId: 'julia', color: '#ea580c' },
      ],
    }),
    code: `createCalendar('#calendar', {
  view: 'timeline',
  timelineDays: 'month',   // 1 | 7 | any number | 'month'
  resources: people,
  events: absences,
});`,
  },

  // ---------------- views
  {
    id: 'multi-month', title: 'Several months at once', tag: 'Layouts', homeToo: true,
    desc: 'The multiMonth view shows full months side by side with the first events of each day. monthsCount sets how many.',
    opts: () => notes({ view: 'multiMonth', views: ['multiMonth', 'month', 'year'], monthsCount: 3 }),
    code: `createCalendar('#calendar', { events, view: 'multiMonth', monthsCount: 3 });`,
  },
  {
    id: 'week-grid', title: 'Week grid with week numbers', tag: 'Layouts',
    desc: 'weekGrid draws one week like a month row: no hours, just the day’s events. weekNumbers adds ISO week numbers to week and month views.',
    opts: () => notes({ view: 'weekGrid', views: ['weekGrid', 'week', 'month'], weekNumbers: true }),
    code: `createCalendar('#calendar', { events, view: 'weekGrid', weekNumbers: true });`,
  },
  {
    id: 'lists', title: 'List by week, month or year', tag: 'Layouts',
    desc: 'listWeek, listMonth and listYear list every event of the period, grouped by day.',
    opts: () => notes({ view: 'listMonth', views: ['listWeek', 'listMonth', 'listYear'] }),
    code: `createCalendar('#calendar', { events, view: 'listMonth', views: ['listWeek', 'listMonth', 'listYear'] });`,
  },
];
for (const x of TOP) x.docsOnly = !x.homeToo;
EXAMPLES.push(...TOP);

// ---------------------------------------------------------------- drag in, between calendars, RTL, zones, languages, print
const MORE3 = [
  {
    id: 'external-drag', title: 'Drag tasks onto the calendar', tag: 'Drag & drop', homeToo: false,
    desc: 'makeDraggable turns any list into a source of events. Drop a task on a day or a time; it disappears from the list (remove: true). The calendar needs droppable: true.',
    before: `<div class="ex-tasks" id="exTasks"><b>Backlog</b>
      <div class="ex-task" data-event='{"title":"Write release notes","duration":90,"color":"#2563eb"}'>Write release notes <small>1 h 30</small></div>
      <div class="ex-task" data-event='{"title":"Review PR #182","duration":45,"color":"#7c3aed"}'>Review PR #182 <small>45 min</small></div>
      <div class="ex-task" data-event='{"title":"Call the bank","duration":30,"color":"#16a34a"}'>Call the bank <small>30 min</small></div>
      <div class="ex-task" data-event='{"title":"Team offsite","allDay":true,"color":"#ea580c"}'>Team offsite <small>all day</small></div></div>`,
    setup: () => { const d = makeDraggable('#exTasks', { itemSelector: '.ex-task', remove: true }); return () => d.destroy(); },
    opts: () => notes({ droppable: true, onEventReceive: ({ event }) => current?._toast(`Received “${event.title}”`) }),
    code: `import { createCalendar, makeDraggable } from '@iconix/calendar';

createCalendar('#calendar', {
  droppable: true,
  onEventReceive: ({ event, draggedEl }) => api.post('/events', event),
});

// <div id="backlog"><div class="task" data-event='{"title":"Review PR","duration":45}'>Review PR</div></div>
makeDraggable('#backlog', {
  itemSelector: '.task',
  remove: true,                              // take the item out of the list on drop
  // eventData: (el) => ({ title: el.textContent, duration: 30 }),  // instead of data-event
});`,
  },
  {
    id: 'two-calendars', title: 'Drag between two calendars', tag: 'Drag & drop',
    desc: 'Events can travel between droppable calendars: drag one from the top calendar into the “Someday” calendar below and back. The source fires eventLeave, the target eventReceive.',
    afterHtml: '<div class="ex-second"><b>Someday</b><div id="exSecond"></div></div>',
    setup: () => {
      const second = createCal('#exSecond', {
        view: 'week', date: week, sidebar: false, toolbar: false, droppable: true, locale: 'en-GB', scrollTime: 9,
        theme: document.documentElement.dataset.theme || 'light',
        events: [{ id: 'someday-1', title: 'Learn Rust', start: at(5, 10), end: at(5, 12), color: '#ea580c' }],
      });
      return () => second.destroy();
    },
    opts: () => notes({ droppable: true, onEventLeave: ({ event }) => current?._toast(`“${event.title}” moved away`) }),
    code: `const work = createCalendar('#work', { events: workEvents, droppable: true });
const someday = createCalendar('#someday', { events: [], droppable: true });

work.on('eventLeave', ({ event }) => api.move(event.id, 'someday'));
someday.on('eventReceive', ({ event }) => console.log('got', event.title));`,
  },
  {
    id: 'rtl', title: 'Right-to-left (Hebrew)', tag: 'Basics',
    desc: 'direction: "rtl" mirrors the whole layout. With direction "auto" (the default) Arabic, Hebrew, Persian and Urdu locales switch automatically.',
    opts: () => notes({ locale: 'he-IL', sidebar: true }),
    code: `createCalendar('#calendar', {
  locale: 'he-IL',        // direction 'auto' → right-to-left
  // direction: 'rtl',    // or force it
});`,
  },
  {
    id: 'time-zones', title: 'Show any time zone', tag: 'Basics', homeToo: true,
    desc: 'timeZone shows the calendar in another zone. Times without an offset (“2026-11-09T10:00”) are read in that zone and everything you get back is a real instant, so switching zones never moves an event.',
    log: true,
    actions: ['UTC', 'Europe/Warsaw', 'America/New_York', 'Asia/Tokyo', 'Asia/Kolkata'].map((tz) => [tz, (c, log) => { c.setOptions({ timeZone: tz }); const e = c.getEventById('tz-call'); log(`${tz.padEnd(18)} “Call with Tokyo” starts ${e.start.toISOString()} (same instant)`); }]),
    opts: () => notes({ timeZone: 'Europe/Warsaw', events: [...demoEvents(), { id: 'tz-call', title: 'Call with Tokyo', start: `${ymdL(at(1, 0))}T09:00:00Z`, end: `${ymdL(at(1, 0))}T10:00:00Z`, color: '#db2777' }] }),
    code: `createCalendar('#calendar', {
  timeZone: 'America/New_York',
  events: [
    { title: 'Standup', start: '2026-11-09T09:00' },              // 9:00 in New York
    { title: 'Call', start: '2026-11-10T01:00:00Z' },             // an exact instant
  ],
  onEventUpdate: ({ event }) => save(event.start.toISOString()), // real instants
});
cal.setOptions({ timeZone: 'Asia/Tokyo' });`,
  },
  {
    id: 'languages', title: 'Built-in languages', tag: 'Basics',
    desc: 'UI text ships in English, Polish, German, French and Spanish; dates and times use Intl, so they are right in every language. Override any string with strings: {…}.',
    actions: ['en-GB', 'pl-PL', 'de-DE', 'fr-FR', 'es-ES', 'he-IL', 'ja-JP'].map((l) => [l, (c) => c.setOptions({ locale: l })]),
    opts: () => notes({ locale: 'de-DE', sidebar: true }),
    code: `createCalendar('#calendar', {
  locale: 'de-DE',                 // en, pl, de, fr, es built in; others fall back to English text
  strings: { today: 'Jetzt' },     // override any label
});`,
  },
  {
    id: 'print', title: 'Print the current view', tag: 'API',
    desc: 'print() opens the print dialog. The print stylesheet hides buttons and side panels, unrolls scroll areas and keeps event colors.',
    actions: [['print()', (c) => c.print()]],
    opts: () => notes({ view: 'week' }),
    code: `printButton.onclick = () => cal.print();
/* Ctrl+P works too: the print styles always apply to the calendar */`,
  },
];
for (const x of MORE3) x.docsOnly = !x.homeToo;
EXAMPLES.push(...MORE3);
