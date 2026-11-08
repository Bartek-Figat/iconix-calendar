#!/usr/bin/env node
// iconix-calendar CLI: work with event files (.json / .ics) from the terminal or CI.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extname, resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseQuickAdd } from '../src/quickadd.js';
import { toICS, fromICS } from '../src/ics.js';
import { PRESETS, EVENT_STYLES } from '../src/presets.js';
import { normalizeEvent, occurrences, findFreeSlot, findClashes } from '../src/model.js';
import * as D from '../src/date.js';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));

// ---------------------------------------------------------------- tiny helpers
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = c(1), dim = c(2), red = c(31), green = c(32), yellow = c(33), blue = c(34), magenta = c(35);

export class CliError extends Error {}

export function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { args._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) args.flags[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('-')) args.flags[k] = argv[++i];
      else args.flags[k] = true;
    } else if (/^-[a-z]$/i.test(a)) {
      const map = { o: 'out', d: 'days', h: 'help', v: 'version', l: 'locale' };
      const k = map[a[1]] || a[1];
      if (['help', 'version'].includes(k)) args.flags[k] = true;
      else args.flags[k] = argv[++i];
    } else args._.push(a);
  }
  return args;
}

function num(v, name, def) {
  if (v === undefined || v === true) return def;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new CliError(`--${name} must be a positive number, got "${v}"`);
  return n;
}
function date(v, name, def) {
  if (v === undefined || v === true) return def;
  const d = D.toDate(v);
  if (isNaN(d)) throw new CliError(`--${name} is not a valid date: "${v}"`);
  return d;
}
function hoursFlag(v) {
  if (v === undefined) return { start: 9, end: 17, days: [1, 2, 3, 4, 5] };
  if (v === 'any') return null;
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(v);
  if (!m || +m[1] >= +m[2] || +m[2] > 24) throw new CliError(`--hours must look like 9-17 (or "any"), got "${v}"`);
  return { start: +m[1], end: +m[2], days: [1, 2, 3, 4, 5] };
}

/** Reads events from .json (array or { events: [] }) or .ics, normalized. */
export function readEvents(file) {
  if (!file) throw new CliError('Missing input file');
  const path = resolve(file);
  if (!existsSync(path)) throw new CliError(`File not found: ${file}`);
  const text = readFileSync(path, 'utf8');
  let raw;
  if (/\.ics$/i.test(path) || /^BEGIN:VCALENDAR/m.test(text)) raw = fromICS(text);
  else {
    try { raw = JSON.parse(text); } catch (e) { throw new CliError(`${file} is not valid JSON: ${e.message}`); }
    if (!Array.isArray(raw)) raw = raw && Array.isArray(raw.events) ? raw.events : null;
    if (!raw) throw new CliError(`${file} must contain an array of events or { "events": [...] }`);
  }
  return raw.map((e, i) => {
    try { return normalizeEvent(e); } catch (err) { throw new CliError(`Event #${i + 1}: ${err.message}`); }
  });
}

const serial = (e) => {
  const o = { ...e, start: e.allDay ? D.ymd(e.start) : e.start.toISOString(), end: e.allDay ? D.ymd(e.end) : e.end.toISOString() };
  if (!o.rrule) delete o.rrule;
  if (!o.exdates || !o.exdates.length) delete o.exdates;
  delete o.key; delete o.recurring;
  return o;
};
const when = (e, L) => (e.allDay ? 'all day' : `${D.timeStr(e.start, L)}–${D.timeStr(e.end, L)}`);

// ---------------------------------------------------------------- commands
const SNIPPETS = {
  react: `import { Calendar } from '@iconix/calendar/react';
import '@iconix/calendar/css';

export function Schedule({ events, onSave }) {
  return (
    <div style={{ height: 720 }}>
      <Calendar events={events} view="week" onChange={({ events }) => onSave(events)} />
    </div>
  );
}
`,
  next: `// app/schedule/page.jsx
import { Calendar } from '@iconix/calendar/react'; // already "use client"
import '@iconix/calendar/css';

export default async function Page() {
  const events = await fetch('https://example.com/api/events').then((r) => r.json());
  return <main style={{ height: '100dvh' }}><Calendar events={events} view="month" /></main>;
}
`,
  vue: `<script setup>
import { ref } from 'vue';
import { IxCalendar } from '@iconix/calendar/vue';
import '@iconix/calendar/css';

const events = ref([]);
</script>

<template>
  <IxCalendar :events="events" view="week" style="height: 720px" @change="({ events: list }) => (events = list)" />
</template>
`,
  html: `<!doctype html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@iconix/calendar/src/calendar.css">
  <script type="module" src="https://cdn.jsdelivr.net/npm/@iconix/calendar/src/element.js/+esm"></script>
</head>
<body>
  <ixc-calendar view="week" style="height: 700px"></ixc-calendar>
  <script type="module">
    const el = document.querySelector('ixc-calendar');
    el.options = { events: [{ title: 'Hello', start: new Date(), allDay: true }] };
  </script>
</body>
</html>
`,
  js: `import { createCalendar } from '@iconix/calendar';
import '@iconix/calendar/css';

const cal = createCalendar('#calendar', {
  view: 'week',
  events: [],
  onChange: ({ events }) => localStorage.setItem('events', JSON.stringify(events)),
});
`,
};

const HELP = `${bold('iconix-calendar')} ${dim(`v${pkg.version}`)} – event files from the terminal

${bold('Usage')}
  iconix-calendar <command> [options]

${bold('Commands')}
  parse <text…>              Quick-add parser: sentence → event JSON
  convert <in> [-o out]      .ics ↔ .json (direction from the file extension)
  agenda <file>              Upcoming events, grouped by day     [--days 7] [--from date]
  free <file>                Next free slot                      [--duration 30] [--hours 9-17|any] [--from] [--days 14]
  clashes <file>             Overlapping events per resource     [--days 7] [--from date]
  expand <file>              Recurrences → single events (JSON)  [--from date] [--to date | --days 30]
  validate <file>            Check a file, exit 1 on errors
  stats <file>               Counts per calendar, busiest day, total hours
  presets                    List theme presets and event styles
  css <preset>               Print a preset as CSS variables     [--dark]
  init <react|next|vue|html|js> [-o file]   Starter code

${bold('Options')}
  --locale <tag>   Date/time formatting (default en-GB)
  --json           Machine-readable output where it applies
  -o, --out <file> Write to a file instead of stdout
  -h, --help       This help        -v, --version

${bold('Examples')}
  iconix-calendar parse "Dentist friday 4pm for 45 min #personal"
  iconix-calendar convert google-export.ics -o events.json
  iconix-calendar free events.json --duration 60 --hours 8-18
  iconix-calendar css nord --dark >> theme.css
`;

export function run(argv, { now = new Date(), out = (s) => process.stdout.write(s) } = {}) {
  const a = parseArgs(argv);
  const f = a.flags;
  const L = typeof f.locale === 'string' ? f.locale : 'en-GB';
  const print = (s) => out(s.endsWith('\n') ? s : `${s}\n`);
  const emit = (text) => {
    if (typeof f.out === 'string') { writeFileSync(resolve(f.out), text); print(green(`✓ wrote ${f.out}`)); } else print(text);
  };
  const [cmd, ...rest] = a._;

  if (f.version) { print(pkg.version); return 0; }
  if (!cmd || f.help || cmd === 'help') { print(HELP); return 0; }

  switch (cmd) {
    case 'parse': {
      const text = rest.join(' ');
      if (!text) throw new CliError('Usage: parse <text…>');
      const p = parseQuickAdd(text, { now, locale: L });
      const ev = { title: p.title, start: p.allDay ? D.ymd(p.start) : p.start.toISOString(), end: p.allDay ? D.ymd(p.end) : p.end.toISOString(), allDay: p.allDay };
      if (p.rrule) ev.rrule = p.rrule;
      if (p.calendar) ev.calendar = p.calendar;
      if (f.json) { print(JSON.stringify(ev, null, 2)); return 0; }
      print(`${bold(p.title || '(no title)')}\n  ${blue(D.fmt(p.start, L, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}  ${when(p, L)}`
        + (p.rrule ? `\n  ${magenta(`repeats ${p.rrule.freq}${p.rrule.byweekday ? ` on ${p.rrule.byweekday.map((d) => D.fmt(new Date(2026, 10, 1 + d), L, { weekday: 'short' })).join(', ')}` : ''}`)}` : '')
        + (p.tokens.length ? `\n  ${dim(`understood: ${p.tokens.map((t) => `${t.type} "${t.text}"`).join(', ')}`)}` : '')
        + `\n${dim(JSON.stringify(ev))}`);
      return 0;
    }
    case 'convert': {
      const [input] = rest;
      const events = readEvents(input);
      const target = typeof f.out === 'string' ? extname(f.out).toLowerCase() : (/\.ics$/i.test(input) ? '.json' : '.ics');
      emit(target === '.ics' ? toICS(events) : JSON.stringify(events.map(serial), null, 2));
      return 0;
    }
    case 'agenda': {
      const events = readEvents(rest[0]);
      const from = D.startOfDay(date(f.from, 'from', now));
      const days = num(f.days, 'days', 7);
      const list = occurrences(events, from, D.addDays(from, days));
      if (f.json) { print(JSON.stringify(list.map(serial), null, 2)); return 0; }
      if (!list.length) { print(dim(`Nothing scheduled in the next ${days} days.`)); return 0; }
      let lines = [];
      for (let d = from; d < D.addDays(from, days); d = D.addDays(d, 1)) {
        const today = list.filter((i) => D.overlaps(i.start, i.end, d, D.addDays(d, 1)));
        if (!today.length) continue;
        lines.push(bold(D.fmt(d, L, { weekday: 'long', day: 'numeric', month: 'long' })));
        for (const i of today) lines.push(`  ${dim(when(i, L).padEnd(13))} ${i.title || '(no title)'}${i.calendar ? dim(`  #${i.calendar}`) : ''}${i.rrule ? dim(' ↻') : ''}`);
      }
      print(lines.join('\n'));
      return 0;
    }
    case 'free': {
      const events = readEvents(rest[0]);
      const duration = num(f.duration, 'duration', 30);
      const slot = findFreeSlot(events, { duration, from: date(f.from, 'from', now), days: num(f.days, 'days', 14), hours: hoursFlag(f.hours) });
      if (f.json) { print(JSON.stringify(slot && { start: slot.start.toISOString(), end: slot.end.toISOString() })); return slot ? 0 : 1; }
      if (!slot) { print(yellow(`No free ${duration} min slot found.`)); return 1; }
      print(`${green('Free:')} ${bold(D.fmt(slot.start, L, { weekday: 'long', day: 'numeric', month: 'long' }))} ${D.timeStr(slot.start, L)}–${D.timeStr(slot.end, L)}`);
      return 0;
    }
    case 'clashes': {
      const events = readEvents(rest[0]);
      const from = D.startOfDay(date(f.from, 'from', now));
      const pairs = findClashes(events, from, D.addDays(from, num(f.days, 'days', 7)));
      if (f.json) { print(JSON.stringify(pairs.map(([x, y]) => [serial(x), serial(y)]), null, 2)); return pairs.length ? 1 : 0; }
      if (!pairs.length) { print(green('✓ No clashes.')); return 0; }
      for (const [x, y] of pairs) {
        print(`${yellow('⚠')} ${D.fmt(x.start, L, { weekday: 'short', day: 'numeric', month: 'short' })}  ${bold(x.title)} ${dim(when(x, L))}  ↔  ${bold(y.title)} ${dim(when(y, L))}${x.resourceId != null ? dim(`  @${x.resourceId}`) : ''}`);
      }
      print(yellow(`${pairs.length} clash${pairs.length === 1 ? '' : 'es'}`));
      return 1;
    }
    case 'expand': {
      const events = readEvents(rest[0]);
      const from = date(f.from, 'from', D.startOfDay(now));
      const to = f.to !== undefined ? date(f.to, 'to') : D.addDays(from, num(f.days, 'days', 30));
      if (to <= from) throw new CliError('--to must be after --from');
      const list = occurrences(events, from, to).map((i) => ({ ...serial(i), id: `${i.id}@${D.ymd(i.start)}`, seriesId: i.id, rrule: undefined, exdates: undefined }));
      emit(JSON.stringify(list, null, 2));
      return 0;
    }
    case 'validate': {
      const problems = [];
      let raw;
      try {
        const text = readFileSync(resolve(rest[0] || ''), 'utf8');
        raw = /^BEGIN:VCALENDAR/m.test(text) ? fromICS(text) : JSON.parse(text);
        if (!Array.isArray(raw)) raw = raw.events;
        if (!Array.isArray(raw)) throw new Error('expected an array of events or { "events": [...] }');
      } catch (e) { throw new CliError(`Cannot read ${rest[0] || '(no file)'}: ${e.message}`); }
      const ids = new Map();
      raw.forEach((e, n) => {
        const at = `#${n + 1}${e && e.title ? ` "${e.title}"` : ''}`;
        if (!e || typeof e !== 'object') { problems.push(`${at}: not an object`); return; }
        if (e.start == null) problems.push(`${at}: missing start`);
        else if (isNaN(D.toDate(e.start))) problems.push(`${at}: invalid start "${e.start}"`);
        if (e.end != null && isNaN(D.toDate(e.end))) problems.push(`${at}: invalid end "${e.end}"`);
        else if (e.end != null && e.start != null && D.toDate(e.end) < D.toDate(e.start)) problems.push(`${at}: end is before start`);
        if (e.rrule && !['hourly', 'daily', 'weekly', 'monthly', 'yearly'].includes(e.rrule.freq)) problems.push(`${at}: unknown rrule.freq "${e.rrule.freq}"`);
        if (e.rrule && e.rrule.byweekday && !e.rrule.byweekday.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) problems.push(`${at}: rrule.byweekday must contain 0–6`);
        if (e.id != null) { if (ids.has(String(e.id))) problems.push(`${at}: duplicate id "${e.id}" (also #${ids.get(String(e.id))})`); else ids.set(String(e.id), n + 1); }
      });
      if (f.json) { print(JSON.stringify({ ok: !problems.length, events: raw.length, problems }, null, 2)); return problems.length ? 1 : 0; }
      if (!problems.length) { print(green(`✓ ${raw.length} events, no problems.`)); return 0; }
      for (const p of problems) print(`${red('✗')} ${p}`);
      print(red(`${problems.length} problem${problems.length === 1 ? '' : 's'} in ${raw.length} events`));
      return 1;
    }
    case 'stats': {
      const events = readEvents(rest[0]);
      const from = D.startOfDay(date(f.from, 'from', now));
      const days = num(f.days, 'days', 30);
      const list = occurrences(events, from, D.addDays(from, days));
      const byCal = {}; const byDay = {}; let minutes = 0;
      for (const i of list) {
        byCal[i.calendar ?? '(none)'] = (byCal[i.calendar ?? '(none)'] || 0) + 1;
        byDay[D.ymd(i.start)] = (byDay[D.ymd(i.start)] || 0) + 1;
        if (!i.allDay) minutes += (i.end - i.start) / D.MIN;
      }
      const busiest = Object.entries(byDay).sort((x, y) => y[1] - x[1])[0];
      const res = { from: D.ymd(from), days, events: events.length, occurrences: list.length, hours: +(minutes / 60).toFixed(1), byCalendar: byCal, busiestDay: busiest ? { date: busiest[0], events: busiest[1] } : null };
      if (f.json) { print(JSON.stringify(res, null, 2)); return 0; }
      print(`${bold(`${list.length} occurrences`)} of ${events.length} events in ${days} days from ${res.from}, ${res.hours} h scheduled`);
      for (const [k, v] of Object.entries(byCal).sort((x, y) => y[1] - x[1])) print(`  ${String(v).padStart(4)}  ${k}`);
      if (busiest) print(dim(`busiest day: ${busiest[0]} (${busiest[1]} events)`));
      return 0;
    }
    case 'presets': {
      if (f.json) { print(JSON.stringify({ presets: Object.keys(PRESETS), eventStyles: EVENT_STYLES })); return 0; }
      print(bold('Presets'));
      for (const [k, p] of Object.entries(PRESETS)) print(`  ${k.padEnd(8)} ${dim(`accent ${p.light?.accent ?? '-'} / ${p.dark?.accent ?? '-'}${p.radius != null ? `, radius ${p.radius}` : ''}${p.font ? ', custom font' : ''}`)}`);
      print(`${bold('Event styles')}\n  ${EVENT_STYLES.join(', ')}`);
      return 0;
    }
    case 'css': {
      const name = rest[0];
      const p = PRESETS[name];
      if (!p) throw new CliError(`Unknown preset "${name ?? ''}". Try: ${Object.keys(PRESETS).join(', ')}`);
      const vars = { ...(p.vars || {}), ...((f.dark ? p.dark : p.light) || {}) };
      if (p.radius != null) vars.radius = `${p.radius}px`;
      if (p.font) vars.font = p.font;
      const sel = f.dark ? '.ixc[data-theme="dark"]' : '.ixc';
      emit(`/* @iconix/calendar preset: ${name}${f.dark ? ' (dark)' : ''} */\n${sel} {\n${Object.entries(vars).map(([k, v]) => `  --ixc-${k}: ${v};`).join('\n')}\n}\n`);
      return 0;
    }
    case 'init': {
      const kind = rest[0] || 'react';
      const code = SNIPPETS[kind];
      if (!code) throw new CliError(`Unknown template "${kind}". Use one of: ${Object.keys(SNIPPETS).join(', ')}`);
      emit(code);
      return 0;
    }
    default:
      throw new CliError(`Unknown command "${cmd}". Run with --help to see all commands.`);
  }
}

// run only when executed directly (not when imported by tests)
const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  try {
    process.exitCode = run(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${red('error')} ${e instanceof CliError ? e.message : e.stack}\n`);
    process.exitCode = 2;
  }
}
