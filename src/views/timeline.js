import * as D from '../date.js';
import { packLanes } from '../layout.js';

const LANE = 28;

/**
 * Resource timeline: one row per resource, time runs left to right.
 * timelineDays: 1 (hours of one day) · 7 / any number (hours of each day) · 'month' (one cell per day).
 * Resources can have `children` (collapsible tree) or a `group`, extra columns come from `resourceColumns`.
 */
export const timeline = {
  id: 'timeline', kind: 'time', zoomable: true,
  step(cal) { return cal.o.timelineDays === 'month' ? { months: 1 } : { days: cal.o.timelineDays }; },
  range(cal) {
    const n = cal.o.timelineDays;
    if (n === 'month') {
      const start = D.startOfMonth(cal.state.date);
      return { start, end: D.addMonths(start, 1), days: D.daysInMonth(start), month: true };
    }
    const start = n === 7 ? D.startOfWeek(cal.state.date, cal.o.firstDay) : D.startOfDay(cal.state.date);
    return { start, end: D.addDays(start, n), days: n };
  },
  title(cal) {
    const { start, days, month } = timeline.range(cal);
    if (month) return D.fmt(start, cal.locale, { month: cal.compact ? 'short' : 'long', year: 'numeric' });
    if (days === 1) return D.fmt(start, cal.locale, (cal.compact ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    return D.fmtRange(start, D.addDays(start, days - 1), cal.locale, { month: cal.compact ? 'short' : 'long', day: 'numeric', year: 'numeric' });
  },
  geom(cal) {
    const { start, days, month } = timeline.range(cal);
    const o = cal.o;
    if (month) {
      // whole days: one cell per day
      const dayW = 46 * cal.zoomFactor;
      return { start, days, month, sM: 0, eM: 1440, ppm: dayW / 1440, dayW, W: dayW * days, hourW: dayW / 24 };
    }
    // multi-day timelines show only the useful hours of each day, so events get real width
    const [h0, h1] = days === 1 ? [o.dayStart, o.dayEnd] : (o.timelineHours || [7, 20]);
    const sM = h0 * 60, eM = h1 * 60;
    const hourW = (days === 1 ? 96 : 52) * cal.zoomFactor;
    const ppm = hourW / 60;
    const dayW = (eM - sM) * ppm;
    return { start, days, sM, eM, ppm, dayW, W: dayW * days, hourW };
  },
  /** Resource columns shown left of the lanes. */
  columns(cal) {
    const cols = cal.o.resourceColumns;
    if (cols && cols.length) return cols.map((c) => ({ width: 140, ...c }));
    return [{ field: 'title', label: cal.t.resources, width: 188, main: true }];
  },
  render(cal, main) {
    const g = timeline.geom(cal);
    const { start, days, sM, eM, ppm, dayW, W, hourW, month } = g;
    const L = cal.locale, t = cal.t;
    const end = D.addDays(start, days);
    const both = cal.instances(start, end);
    const bgAll = both.filter((i) => i.display === 'background');
    const all = both.filter((i) => i.display !== 'background');
    const toX = (d) => {
      const di = D.clamp(D.diffDays(start, d), 0, days);
      if (di >= days) return W;
      const m = D.clamp(D.minutesOfDay(d), sM, eM);
      return di * dayW + (m - sM) * ppm;
    };
    const cols = timeline.columns(cal);
    const lw = cols.reduce((s, c) => s + c.width, 0);
    const known = new Set(cal._flatResources().map((r) => String(r.id)));
    const resOf = (i) => cal.resourcesOf(i).map(String).filter((x) => known.has(x));
    const rowsData = cal._resourceRows();
    if (all.some((i) => !resOf(i).length)) rowsData.push({ r: { id: '', title: t.unassigned, _none: true }, depth: 0 });
    const now = cal.now();
    const nowX = now >= start && now < end ? toX(now) : null;
    const cellValue = (r, c) => (typeof c.render === 'function' ? c.render(r) : cal.esc(r[c.field] ?? ''));

    let rows = '';
    for (const row of rowsData) {
      if (row.group) {
        rows += `<div class="ixc-tl-group" data-toggle="g:${cal.esc(row.group)}"><span>${row.collapsed ? '▸' : '▾'} ${cal.esc(row.group)}</span><em>${row.count}</em></div>`;
        continue;
      }
      const r = row.r;
      const mine = all.filter((i) => (r._none ? !resOf(i).length : resOf(i).includes(String(r.id))));
      const items = mine.map((i) => {
        const x0 = i.allDay ? D.diffDays(start, i.start) * dayW : toX(i.start);
        const x1 = i.allDay ? D.diffDays(start, i.end) * dayW : toX(i.end);
        return { i, s: Math.max(0, x0), e: Math.min(W, Math.max(x1, x0 + 18)) };
      }).filter((x) => x.e > 0 && x.s < W);
      const lanes = packLanes(items);
      const h = Math.max(1, lanes) * LANE + 12;
      // working hours of this resource (falls back to the calendar's businessHours)
      const bh = r.businessHours !== undefined ? r.businessHours : cal.o.businessHours;
      let off = '';
      if (bh && !month) {
        for (let d = 0; d < days; d++) {
          const day = D.addDays(start, d);
          const x0 = d * dayW;
          if (bh.days && !bh.days.includes(day.getDay())) { off += `<div class="ixc-off" style="left:${x0}px;width:${dayW}px"></div>`; continue; }
          const a = D.clamp(bh.start * 60, sM, eM), b = D.clamp(bh.end * 60, sM, eM);
          if (a > sM) off += `<div class="ixc-off" style="left:${x0}px;width:${(a - sM) * ppm}px"></div>`;
          if (b < eM) off += `<div class="ixc-off" style="left:${x0 + (b - sM) * ppm}px;width:${(eM - b) * ppm}px"></div>`;
        }
      } else if (bh && month && bh.days) {
        for (let d = 0; d < days; d++) if (!bh.days.includes(D.addDays(start, d).getDay())) off += `<div class="ixc-off" style="left:${d * dayW}px;width:${dayW}px"></div>`;
      }
      const bgs = bgAll.filter((i) => !cal.resourcesOf(i).length || resOf(i).includes(String(r.id))).map((i) => {
        const x0 = i.allDay ? D.diffDays(start, i.start) * dayW : toX(i.start);
        const x1 = i.allDay ? D.diffDays(start, i.end) * dayW : toX(i.end);
        return x1 > 0 && x0 < W ? cal.bgHTML(i, `left:${Math.max(0, x0)}px;width:${Math.min(W, x1) - Math.max(0, x0)}px`) : '';
      }).join('');
      const bars = items.map((x) => cal.evHTML(x.i, {
        width: Math.max(16, x.e - x.s - 3),
        variant: 'bar', style: `left:${x.s + 1}px;width:${Math.max(16, x.e - x.s - 3)}px;top:${6 + x.lane * LANE}px`,
        resize: true, resizeStart: true,
      })).join('');
      const color = r.color ? `style="--c:${r.color}"` : '';
      const toggle = row.hasChildren ? `<button class="ixc-tl-tg" data-toggle="r:${cal.esc(r.id)}" aria-expanded="${!row.collapsed}" aria-label="${row.collapsed ? 'Expand' : 'Collapse'}">${row.collapsed ? '▸' : '▾'}</button>` : '';
      const cells = cols.map((c, k) => {
        if (k === 0) {
          return `<div class="ixc-tl-cell ixc-tl-cell-main" style="width:${c.width}px;padding-left:${14 + row.depth * 16}px">${toggle}${r.color ? '<i class="ixc-swatch"></i>' : ''}<span><b>${c.field === 'title' || !c.field ? cal.esc(r.title || r.id) : cellValue(r, c)}</b>${r.subtitle && cols.length === 1 ? `<small>${cal.esc(r.subtitle)}</small>` : ''}</span>${cols.length === 1 ? `<em>${mine.length || ''}</em>` : ''}</div>`;
        }
        return `<div class="ixc-tl-cell" style="width:${c.width}px">${cellValue(r, c)}</div>`;
      }).join('');
      rows += `<div class="ixc-tl-row${row.hasChildren ? ' ixc-tl-parent' : ''}" data-res="${cal.esc(r.id)}">
        <div class="ixc-tl-label" ${color}>${cells}</div>
        <div class="ixc-tl-lane" style="width:${W}px;height:${h}px">${off}${bgs}${bars}${nowX != null ? `<div class="ixc-tl-now" style="left:${nowX}px"></div>` : ''}</div></div>`;
    }

    // axis
    let axis = '';
    const every = hourW < 20 ? 6 : hourW < 40 ? 2 : 1;
    for (let d = 0; d < days; d++) {
      const day = D.addDays(start, d);
      const today = D.isSameDay(day, now) ? ' ixc-today' : '';
      if (month) {
        axis += `<div class="ixc-tl-dayc${today}${day.getDay() % 6 === 0 ? ' ixc-weekend' : ''}" style="left:${d * dayW}px;width:${dayW}px"><button data-goto-day="${D.ymd(day)}"><small>${D.fmt(day, L, { weekday: 'narrow' })}</small>${day.getDate()}</button></div>`;
        continue;
      }
      if (days > 1) axis += `<div class="ixc-tl-dayl${today}" style="left:${d * dayW}px;width:${dayW}px"><button data-goto-day="${D.ymd(day)}">${D.fmt(day, L, { weekday: 'short', day: 'numeric' })}</button></div>`;
      for (let m = sM; m < eM; m += 60 * every) {
        if (days > 1 && (eM - m) * ppm < 44) continue; // keep the next day's first label readable
        axis += `<span class="ixc-tl-tick" style="left:${d * dayW + (m - sM) * ppm}px">${D.hourLabel(m / 60, L)}</span>`;
      }
    }
    const corner = cols.map((c) => `<div class="ixc-tl-ch" style="width:${c.width}px">${cal.esc(c.label ?? c.field)}</div>`).join('');
    const sc = main.querySelector('.ixc-tl-scroll');
    const keep = sc && main.firstElementChild?.dataset.view === 'timeline' ? [sc.scrollLeft, sc.scrollTop] : null;
    main.innerHTML = `<div class="ixc-tl${days > 1 ? ' ixc-tl-multi' : ''}${month ? ' ixc-tl-month' : ''}" data-view="timeline" style="--hw:${month ? dayW : hourW * every}px;--dw:${dayW}px;--lw:${lw}px">
      <div class="ixc-tl-scroll"><div class="ixc-tl-grid" style="width:calc(var(--lw) + ${W}px)">
        <div class="ixc-tl-head"><div class="ixc-tl-corner">${corner}</div><div class="ixc-tl-axis" style="width:${W}px">${axis}</div></div>
        ${rows}
        <div class="ixc-tl-fill"><div class="ixc-tl-label"></div><div class="ixc-tl-lane" style="width:${W}px"></div></div>
      </div></div></div>`;
    const sc2 = main.querySelector('.ixc-tl-scroll');
    // in RTL the scroll position counts leftwards from 0 (negative values)
    const dirX = cal.rtl ? -1 : 1;
    if (keep) { sc2.scrollLeft = keep[0]; sc2.scrollTop = keep[1]; }
    else if (days === 1) sc2.scrollLeft = dirX * Math.max(0, (cal.o.scrollTime * 60 - sM) * ppm - 40);
    else if (month && now >= start && now < end) sc2.scrollLeft = dirX * Math.max(0, toX(now) - 3 * dayW);
  },
  scroller(cal) { return cal.main.querySelector('.ixc-tl-scroll'); },
  hit(cal, x, y) {
    const lanes = [...cal.main.querySelectorAll('.ixc-tl-row > .ixc-tl-lane')];
    if (!lanes.length) return null;
    const rects = lanes.map((l) => l.getBoundingClientRect());
    const yy = D.clamp(y, rects[0].top, rects[rects.length - 1].bottom - 1);
    let k = rects.findIndex((r) => yy >= r.top && yy < r.bottom);
    if (k < 0) k = 0;
    const { start, days, sM, eM, ppm, dayW, W, month } = timeline.geom(cal);
    const px = D.clamp(cal.rtl ? rects[k].left + Math.min(rects[k].width, W) - x : x - rects[k].left, 0, W - 1);
    const di = Math.floor(px / dayW);
    let m = sM + (px - di * dayW) / ppm;
    const snap = month ? 1440 : days > 1 ? 60 : cal.o.snapMinutes;
    m = D.clamp(Math.floor(m / snap) * snap, sM, eM - snap);
    const res = cal._resourceById(lanes[k].parentElement.dataset.res);
    if (month) return { kind: 'day', date: D.addDays(start, di), resourceId: res ? res.id : null };
    return { kind: 'time', date: D.atMinutes(D.addDays(start, di), m), resourceId: res ? res.id : null, snap };
  },
};
