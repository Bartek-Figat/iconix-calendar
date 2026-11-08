// Styles playground and the Examples gallery.
import { createCalendar, PRESETS, EVENT_STYLES } from '../src/index.js';
import { icon } from '../src/icons.js';
import { calendars, resources, demoEvents, demoWeek } from './demo-data.js';
import { hl, copy, esc } from './util.js';
import { EXAMPLES, setCurrent } from './examples.js';

const $ = (s, r = document) => r.querySelector(s);
const siteTheme = () => document.documentElement.dataset.theme || 'light';
const week = demoWeek();
const at = (d, h, m = 0) => new Date(week.getFullYear(), week.getMonth(), week.getDate() + d, h, m);
const pad = (n) => String(n).padStart(2, '0');
const ymdL = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const iso = (d) => `${ymdL(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// ================================================================ STYLES
const style = { preset: 'zinc', eventStyle: 'soft' };
let styleCal = null;
if ($('#styleCal')) {
styleCal = createCalendar('#styleCal', {
  view: 'week', date: week, events: demoEvents(), calendars, resources,
  sidebar: false, theme: siteTheme(), preset: style.preset, eventStyle: style.eventStyle,
  views: ['day', 'week', 'month', 'timeline'], scrollTime: 9, locale: 'en-GB',
});

function swatches(p) {
  const v = { bg: '#fff', 'bg-muted': '#f4f4f5', border: '#e4e4e7', fg: '#09090b', ...(p.light || {}) };
  return [v.accent, v['bg-muted'], v.border, v.fg].map((c) => `<i style="background:${c}"></i>`).join('');
}
$('#presetGrid').innerHTML = Object.entries(PRESETS).map(([k, p]) => `
  <button class="preset${k === style.preset ? ' on' : ''}" data-preset="${k}" style="${p.font ? `font-family:${esc(p.font).replace(/"/g, "'")}` : ''}">
    <span class="preset-sw">${swatches(p)}</span><b>${p.label}</b><small>${p.radius != null ? `radius ${p.radius}` : 'default'}</small></button>`).join('');
const STYLE_NOTES = { soft: 'Tinted card', solid: 'Filled', outline: 'Hairline', stripe: 'Left bar', pill: 'Rounded', glass: 'Frosted', gradient: 'Gradient', minimal: 'Dot + text' };
$('#evStyleGrid').innerHTML = EVENT_STYLES.map((s) => `
  <button class="evs${s === style.eventStyle ? ' on' : ''}" data-evs="${s}"><span class="evs-demo" data-evstyle="${s}"><span class="ixc-ev ixc-ev--bar" style="--c:#7c3aed;position:relative"><span class="ixc-ev-in"><b class="ixc-ev-t">Standup</b></span></span></span><b>${s}</b><small>${STYLE_NOTES[s]}</small></button>`).join('');

function styleCode() {
  const p = PRESETS[style.preset];
  const vars = Object.entries(p.light || {}).map(([k, v]) => `  --ixc-${k}: ${v};`).join('\n');
  const dark = Object.entries(p.dark || {}).map(([k, v]) => `  --ixc-${k}: ${v};`).join('\n');
  const js = `createCalendar('#calendar', {\n  preset: '${style.preset}',\n  eventStyle: '${style.eventStyle}',\n  theme: 'auto', // 'light' | 'dark' | 'auto'\n});\n\n// React: <Calendar preset="${style.preset}" eventStyle="${style.eventStyle}" />`;
  const css = `/* or set the same tokens yourself in CSS */\n.ixc {\n${vars}${p.radius != null ? `\n  --ixc-radius: ${p.radius}px;` : ''}${p.font ? `\n  --ixc-font: ${p.font};` : ''}\n}\n.ixc[data-theme="dark"] {\n${dark}\n}`;
  $('#styleJs').innerHTML = hl(js);
  $('#styleCss').innerHTML = hl(css, 'css');
  $('#styleJs').dataset.raw = js;
  $('#styleCss').dataset.raw = css;
}
$('#presetGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]'); if (!b) return;
  style.preset = b.dataset.preset;
  document.querySelectorAll('#presetGrid .preset').forEach((x) => x.classList.toggle('on', x === b));
  styleCal.setOptions({ preset: style.preset });
  styleCode();
});
$('#evStyleGrid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-evs]'); if (!b) return;
  style.eventStyle = b.dataset.evs;
  document.querySelectorAll('#evStyleGrid .evs').forEach((x) => x.classList.toggle('on', x === b));
  styleCal.setOptions({ eventStyle: style.eventStyle });
  styleCode();
});
$('#styleMode').addEventListener('click', (e) => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  document.querySelectorAll('#styleMode button').forEach((x) => x.classList.toggle('on', x === b));
  styleCal.setOptions({ theme: b.dataset.v });
});
$('#styleCopyJs').addEventListener('click', (e) => copy($('#styleJs').dataset.raw, e.currentTarget));
$('#styleCopyCss').addEventListener('click', (e) => copy($('#styleCss').dataset.raw, e.currentTarget));
styleCode();
document.querySelectorAll('#styleMode button').forEach((x) => x.classList.toggle('on', x.dataset.v === siteTheme()));
}

let exCal = null;
let exCur = null;
const SHOWN = document.body.dataset.page === 'docs' ? EXAMPLES : EXAMPLES.filter((x) => !x.docsOnly);
const tags = [...new Set(SHOWN.map((x) => x.tag))];
$('#exList').innerHTML = tags.map((tag) => `<div class="ex-g">${tag}</div>` + SHOWN.filter((x) => x.tag === tag)
  .map((x) => `<button data-ex="${x.id}"><b>${x.title}</b></button>`).join('')).join('');

function log(line) {
  const box = $('#exLog');
  const row = document.createElement('div');
  row.textContent = line;
  box.prepend(row);
  while (box.children.length > 40) box.lastChild.remove();
}
function openExample(id) {
  const x = EXAMPLES.find((e) => e.id === id) || EXAMPLES[0];
  exCur = x;
  document.querySelectorAll('#exList [data-ex]').forEach((b) => b.classList.toggle('on', b.dataset.ex === x.id));
  if (location.hash.startsWith('#ex-') || exCal) history.replaceState(null, '', '#ex-' + x.id);
  $('#exTitle').textContent = x.title;
  $('#exDesc').textContent = x.desc;
  $('#exCode').innerHTML = hl(x.code);
  exCal?.destroy();
  $('#exCal').innerHTML = '';
  $('#exStyle').textContent = x.css || '';
  $('#exCal').className = x.hostClass || '';
  setCurrent(null);
  exCal = createCalendar('#exCal', { date: week, theme: siteTheme(), locale: 'en-GB', ...x.opts() });
  setCurrent(exCal);
  $('#exLog').innerHTML = '';
  $('#exLog').hidden = !x.log;
  if (x.log) {
    exCal.on('*', (name, p) => {
      const e = p && p.event;
      log(`${new Date().toLocaleTimeString()}  ${name}${e ? `  “${e.title}”  ${e.start.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}` : p && p.view ? `  ${p.view}` : ''}`);
    });
  }
  $('#exActions').innerHTML = (x.actions || []).map(([l], i) => `<button data-act-i="${i}">${esc(l)}</button>`).join('');
  $('#exActions').hidden = !x.actions;
}
$('#exList').addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b) openExample(b.dataset.ex); });
$('#exActions').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act-i]'); if (!b) return;
  exCur.actions[+b.dataset.actI][1](exCal, log);
});
$('#exCopy').addEventListener('click', (e) => copy(exCur.code, e.currentTarget));
if ($('#exCount')) $('#exCount').textContent = EXAMPLES.length;
// deep links: index.html#ex-rooms opens that example
const deep = /^#ex-(.+)$/.exec(location.hash);
openExample(deep ? deep[1] : 'basic');
if (deep && document.getElementById('styles')) setTimeout(() => document.getElementById('exTitle').scrollIntoView({ behavior: 'instant', block: 'start' }), 50);

window.addEventListener('site-theme', (e) => {
  styleCal?.setOptions({ theme: e.detail });
  document.querySelectorAll('#styleMode button').forEach((x) => x.classList.toggle('on', x.dataset.v === e.detail));
  exCal?.setOptions({ theme: e.detail });
});
document.querySelectorAll('[data-gi]').forEach((el) => { el.outerHTML = icon(el.dataset.gi, 15); });
