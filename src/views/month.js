import * as D from '../date.js';
import { packLanes } from '../layout.js';

const LANE = 22;
const HEAD = 28;

export const month = {
  id: 'month', kind: 'day',
  step() { return { months: 1 }; },
  range(cal) {
    const m = D.startOfMonth(cal.state.date);
    const start = D.startOfWeek(m, cal.o.firstDay);
    const weeks = cal.o.fixedWeeks ? 6 : Math.ceil(D.diffDays(start, D.addMonths(m, 1)) / 7);
    return { start, end: D.addDays(start, weeks * 7), weeks, month: m };
  },
  title(cal) { return D.fmt(cal.state.date, cal.locale, { month: cal.compact ? 'short' : 'long', year: 'numeric' }); },
  render(cal, main) {
    const { start, weeks, month: m } = this.range(cal);
    const L = cal.locale, t = cal.t, o = cal.o;
    const now = cal.now();
    const both = cal.instances(start, D.addDays(start, weeks * 7));
    const bgAll = both.filter((i) => i.display === 'background');
    const all = both.filter((i) => i.display !== 'background');
    const cols = [];
    for (let i = 0; i < 7; i++) {
      const d = D.addDays(start, i);
      if (!o.weekends && (d.getDay() === 0 || d.getDay() === 6)) continue;
      cols.push(i);
    }
    const N = cols.length;
    const mainH = main.clientHeight || 600;
    const weekH = (mainH - 34) / weeks;
    const fit = Math.max(1, Math.floor((weekH - HEAD - 4) / LANE));

    const head = cols.map((c) => `<div>${D.fmt(D.addDays(start, c), L, { weekday: 'short' })}</div>`).join('');
    let body = '';
    for (let w = 0; w < weeks; w++) {
      const ws = D.addDays(start, w * 7);
      const days = cols.map((c) => D.addDays(ws, c));
      const di = days.map(D.dayIndex);
      const items = [];
      for (const i of all) {
        const endDay = i.allDay ? D.addDays(i.end, -1) : new Date(i.end.getTime() - 1);
        const a = D.dayIndex(i.start), b = Math.max(a, D.dayIndex(endDay));
        let c0 = di.findIndex((x) => x >= a), c1 = -1;
        for (let k = 0; k < N; k++) if (di[k] <= b) c1 = k;
        if (c0 < 0 || c1 < c0) continue;
        items.push({ i, s: c0, e: c1 + 1, cutL: di[c0] > a, cutR: di[c1] < b, multi: a !== b || i.allDay });
      }
      const lanes = packLanes(items);
      const shown = lanes > fit ? fit - 1 : fit;
      const hidden = new Array(N).fill(0);
      let evs = '';
      for (const it of items) {
        if (it.lane >= shown) { for (let k = it.s; k < it.e; k++) hidden[k]++; continue; }
        const style = `left:calc(${(it.s / N) * 100}% + 3px);width:calc(${((it.e - it.s) / N) * 100}% - 7px);top:${HEAD + it.lane * LANE}px`;
        evs += cal.evHTML(it.i, {
          variant: it.multi ? 'bar' : 'dot', style,
          cls: (it.cutL ? ' ixc-cut-l' : '') + (it.cutR ? ' ixc-cut-r' : ''),
          resize: !it.cutR && it.multi,
        });
      }
      hidden.forEach((h, k) => {
        if (h) evs += `<button class="ixc-more" data-more="${D.ymd(days[k])}" style="left:calc(${(k / N) * 100}% + 3px);width:calc(${100 / N}% - 7px);top:${HEAD + shown * LANE}px">${t.more(h)}</button>`;
      });
      const cells = days.map((d) => {
        const cls = ['ixc-mo-cell'];
        if (m && d.getMonth() !== m.getMonth()) cls.push('ixc-outside');
        if (D.isSameDay(d, now)) cls.push('ixc-today');
        if (d.getDay() % 6 === 0) cls.push('ixc-weekend');
        const extra = cal.dayClass(d).trim();
        if (extra) cls.push(extra);
        const label = d.getDate() === 1 || (!m && d === days[0]) ? D.fmt(d, L, { month: 'short', day: 'numeric' }) : d.getDate();
        const bg = bgAll.filter((i) => D.overlaps(i.start, i.end, d, D.addDays(d, 1))).map((i) => cal.bgHTML(i, 'inset:0')).join('');
        return `<div class="${cls.join(' ')}" data-date="${D.ymd(d)}">${bg}<button class="ixc-mo-num" data-goto-day="${D.ymd(d)}">${label}</button></div>`;
      }).join('');
      const wk = o.weekNumbers ? `<span class="ixc-wkn">${t.weekShort}${D.weekNumber(ws)}</span>` : '';
      body += `<div class="ixc-mo-week" data-week="${D.ymd(ws)}">${wk}<div class="ixc-mo-cells">${cells}</div><div class="ixc-mo-evs">${evs}</div></div>`;
    }
    main.innerHTML = `<div class="ixc-month${m ? '' : ' ixc-weekgrid'}" data-view="${this.id}" style="--n:${N}"><div class="ixc-mo-head">${head}</div><div class="ixc-mo-body">${body}</div></div>`;
  },
  hit(cal, x, y) {
    const weeks = [...cal.main.querySelectorAll('.ixc-mo-week')];
    if (!weeks.length) return null;
    const rects = weeks.map((w) => w.getBoundingClientRect());
    const yy = D.clamp(y, rects[0].top, rects[rects.length - 1].bottom - 1);
    let w = rects.findIndex((r) => yy >= r.top && yy < r.bottom);
    if (w < 0) w = 0;
    const cells = weeks[w].querySelectorAll('.ixc-mo-cell');
    const r = rects[w];
    let k = D.clamp(Math.floor(((x - r.left) / r.width) * cells.length), 0, cells.length - 1);
    if (cal.rtl) k = cells.length - 1 - k;
    return { kind: 'day', date: D.toDate(cells[k].dataset.date) };
  },
};

/** One week drawn like a month row: all events stacked as bars and dots, no time grid. */
export const weekGrid = {
  ...month,
  id: 'weekGrid',
  step() { return { days: 7 }; },
  range(cal) {
    const start = D.startOfWeek(cal.state.date, cal.o.firstDay);
    return { start, end: D.addDays(start, 7), weeks: 1, month: null };
  },
  title(cal) {
    const { start } = weekGrid.range(cal);
    return D.fmtRange(start, D.addDays(start, 6), cal.locale, { month: cal.compact ? 'short' : 'long', day: 'numeric', year: 'numeric' });
  },
};
