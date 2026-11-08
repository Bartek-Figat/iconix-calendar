import * as D from '../date.js';
import { packLanes, packColumns } from '../layout.js';

/**
 * Day / week / N-days view with an all-day strip and a scrolling time grid.
 * With `{ resources: true }` the columns are resources for one day (the "vertical resource view").
 */
export function timeGrid(id, count, { resources: byResource = false } = {}) {
  const n = (cal) => (byResource ? 1 : typeof count === 'function' ? count(cal) : count);
  const view = {
    id, kind: 'time', zoomable: true,
    step(cal) { return { days: n(cal) }; },
    range(cal) {
      const c = n(cal);
      const start = c === 7 ? D.startOfWeek(cal.state.date, cal.o.firstDay) : D.startOfDay(cal.state.date);
      const days = [];
      for (let i = 0; i < c; i++) {
        const d = D.addDays(start, i);
        if (!cal.o.weekends && c > 1 && (d.getDay() === 0 || d.getDay() === 6)) continue;
        days.push(d);
      }
      if (!days.length) days.push(start);
      return { start, end: D.addDays(start, c), days };
    },
    /** Columns: one per day, or one per resource for the current day. */
    columns(cal) {
      const { days } = view.range(cal);
      if (!byResource) return days.map((day) => ({ day, res: null }));
      const leaves = cal._leafResources();
      return (leaves.length ? leaves : [{ id: '', title: cal.t.unassigned }]).map((res) => ({ day: days[0], res }));
    },
    title(cal) {
      const { days } = view.range(cal);
      const L = cal.locale;
      if (days.length === 1) return D.fmt(days[0], L, (cal.compact ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
      return D.fmtRange(days[0], days[days.length - 1], L, { month: cal.compact ? 'short' : 'long', day: 'numeric', year: 'numeric' });
    },
    render(cal, main) {
      const o = cal.o, L = cal.locale, t = cal.t;
      const { days } = view.range(cal);
      const cols = view.columns(cal);
      const N = cols.length;
      const slot = o.slotMinutes, sh = cal.slotHeight;
      const sM = o.dayStart * 60, eM = o.dayEnd * 60;
      const H = ((eM - sM) / slot) * sh;
      const rs = days[0], re = D.addDays(days[days.length - 1], 1);
      const both = cal.instances(rs, re);
      const bgAll = both.filter((i) => i.display === 'background');
      const all = both.filter((i) => i.display !== 'background');
      const now = cal.now();
      const inCol = (i, col) => !col.res || (col.res.id === '' ? !cal.resourcesOf(i).length : cal.resourcesOf(i).some((r) => String(r) === String(col.res.id)));
      const dayIdx = days.map(D.dayIndex);
      const colOf = (date, endSide) => {
        // first day whose index is >= date (start side) / last day whose index is < date (end side)
        const di = D.dayIndex(date);
        if (!endSide) { const i = dayIdx.findIndex((x) => x >= di); return i < 0 ? days.length : i; }
        let j = -1;
        for (let i = 0; i < days.length; i++) if (dayIdx[i] < di) j = i;
        return j;
      };

      // ---- all-day strip
      const top = [], timed = [];
      for (const i of all) (i.allDay || i.end - i.start >= D.DAY_MS ? top : timed).push(i);
      const bars = [];
      for (const i of top) {
        if (byResource) {
          cols.forEach((col, k) => { if (inCol(i, col)) bars.push({ i, s: k, e: k + 1, cutL: i.start < col.day, cutR: i.end > D.addDays(col.day, 1) }); });
          continue;
        }
        const endRef = i.allDay ? i.end : new Date(i.end.getTime() - 1);
        const c0 = colOf(i.start, false);
        const c1 = colOf(i.allDay ? i.end : D.addDays(D.startOfDay(endRef), 1), true);
        if (c0 > c1 || c0 >= N) continue;
        bars.push({ i, s: c0, e: c1 + 1, cutL: i.start < days[c0], cutR: i.end > D.addDays(days[c1], 1) });
      }
      const lanes = packLanes(bars);
      const adH = Math.max(1, lanes) * 24 + 6;
      const barHTML = bars.map((b) =>
        cal.evHTML(b.i, {
          variant: 'bar',
          style: `left:calc(${(b.s / N) * 100}% + 2px);width:calc(${((b.e - b.s) / N) * 100}% - 5px);top:${3 + b.lane * 24}px`,
          cls: (b.cutL ? ' ixc-cut-l' : '') + (b.cutR ? ' ixc-cut-r' : ''),
          resize: !b.cutR && b.i.allDay && !byResource,
        })).join('');

      // ---- columns
      // approximate column width in px, so events can pick a layout that fits (narrow / short / full)
      const gw = parseFloat(getComputedStyle(cal.root).getPropertyValue('--ixc-gw')) || 58;
      const colMin = byResource ? 130 : 0;
      const colW = Math.max(30, colMin, ((main.clientWidth || 800) - gw - 12) / N);
      const colHTML = cols.map((col) => {
        const day = col.day;
        const d0 = D.atMinutes(day, sM), d1 = D.atMinutes(day, eM);
        const segs = [];
        for (const i of timed) {
          if (!inCol(i, col)) continue;
          if (!D.overlaps(i.start, i.end, D.startOfDay(day), D.addDays(D.startOfDay(day), 1))) continue;
          const a = new Date(Math.max(i.start, d0)), b = new Date(Math.min(i.end, d1));
          let s = (D.minutesOfDay(a) - sM) + (D.diffDays(day, a) * 1440);
          let e = (D.minutesOfDay(b) - sM) + (D.diffDays(day, b) * 1440);
          if (i.end <= d0) { s = 0; e = 0; } else if (i.start >= d1) { s = eM - sM; e = s; }
          const minVis = (22 / sh) * slot;
          segs.push({ i, s, e: Math.max(e, s + minVis), realE: e, cutT: i.start < d0 || !D.isSameDay(i.start, day), cutB: i.end > d1 || !D.isSameDay(new Date(i.end - 1), day) });
        }
        packColumns(segs);
        const evs = segs.map((g) => {
          const topPx = (g.s / slot) * sh;
          const h = Math.max(20, ((Math.max(g.realE, g.s) - g.s) / slot) * sh - 2);
          // overlapping events cascade: each one is wider than its column and later ones sit on top,
          // so titles stay readable instead of being squeezed into thin slivers
          const l = (g.col / g.cols) * 100;
          const last = g.col + g.span >= g.cols;
          const w = last ? 100 - l : Math.min(100 - l, (g.span / g.cols) * 100 * 1.7);
          return cal.evHTML(g.i, {
            variant: 'box', height: h, width: (colW * w) / 100 - 5,
            style: `top:${topPx}px;height:${h}px;left:calc(${l}% + 2px);width:calc(${w}% - 5px);z-index:${2 + g.col}`,
            cls: (g.cutT ? ' ixc-cut-t' : '') + (g.cutB ? ' ixc-cut-b' : '') + (g.col > 0 ? ' ixc-stacked' : ''),
            resizeStart: !g.cutT, resize: !g.cutB,
          });
        }).join('');
        let bgs = '';
        for (const i of bgAll) {
          if (!D.overlaps(i.start, i.end, d0, d1)) continue;
          if (col.res && cal.resourcesOf(i).length && !inCol(i, col)) continue; // background events without resources cover every column
          const a = i.allDay ? 0 : Math.max(0, ((D.minutesOfDay(new Date(Math.max(i.start, d0))) - sM) / slot) * sh);
          const bEnd = i.allDay || i.end >= d1 ? H : ((D.minutesOfDay(i.end) - sM) / slot) * sh;
          bgs += cal.bgHTML(i, `top:${a}px;height:${Math.max(4, bEnd - a)}px`);
        }
        const bh = col.res && col.res.businessHours !== undefined ? col.res.businessHours : o.businessHours;
        let shade = '';
        if (bh) {
          const workDay = !bh.days || bh.days.includes(day.getDay());
          if (!workDay) shade = `<div class="ixc-off" style="top:0;height:${H}px"></div>`;
          else {
            const a = (bh.start * 60 - sM) / slot * sh, b = (bh.end * 60 - sM) / slot * sh;
            if (a > 0) shade += `<div class="ixc-off" style="top:0;height:${Math.min(a, H)}px"></div>`;
            if (b < H) shade += `<div class="ixc-off" style="top:${Math.max(b, 0)}px;height:${H - Math.max(b, 0)}px"></div>`;
          }
        }
        let nowLine = '';
        if (o.nowIndicator && D.isSameDay(day, now)) {
          const m = D.minutesOfDay(now);
          if (m >= sM && m <= eM) nowLine = `<div class="ixc-now" style="top:${((m - sM) / slot) * sh}px"></div>`;
        }
        let hl = '';
        const h0 = cal.state.highlight;
        if (h0 && !col.res && D.overlaps(h0.start, h0.end, d0, d1)) {
          const a = (Math.max(D.minutesOfDay(h0.start), sM) - sM) / slot * sh;
          const b = (Math.min(D.minutesOfDay(h0.end) || 1440, eM) - sM) / slot * sh;
          hl = `<button class="ixc-hl" data-book style="top:${a}px;height:${Math.max(b - a - 2, 18)}px"><b>${t.free}</b> ${D.timeStr(h0.start, L)}–${D.timeStr(h0.end, L)} · ${t.clickToBook}</button>`;
        }
        const today = D.isSameDay(day, now);
        const resAttr = col.res ? ` data-res="${cal.esc(col.res.id)}"` : '';
        return `<div class="ixc-col${today && !col.res ? ' ixc-today' : ''}${day.getDay() % 6 === 0 ? ' ixc-weekend' : ''}${cal.dayClass(day)}" data-date="${D.ymd(day)}"${resAttr} style="height:${H}px">${shade}${bgs}${hl}${evs}${nowLine}</div>`;
      }).join('');

      const head = cols.map((col) => {
        if (col.res) {
          const r = col.res;
          return `<div class="ixc-tg-day ixc-tg-res" ${r.color ? `style="--c:${r.color}"` : ''} title="${cal.esc(r.title || r.id)}">
            ${r.color ? '<i class="ixc-dot"></i>' : ''}<span class="ixc-tg-rt"><b>${cal.esc(r.title || r.id)}</b>${r.subtitle ? `<small>${cal.esc(r.subtitle)}</small>` : ''}</span></div>`;
        }
        const d = col.day;
        const today = D.isSameDay(d, now);
        return `<button class="ixc-tg-day${today ? ' ixc-today' : ''}${cal.dayClass(d)}" data-goto-day="${D.ymd(d)}">
          <span class="ixc-tg-wd">${D.fmt(d, L, { weekday: 'short' })}</span><span class="ixc-tg-num">${d.getDate()}</span></button>`;
      }).join('');

      const hours = [];
      for (let m = Math.ceil(sM / 60) * 60; m < eM; m += 60) {
        if (m === sM) continue;
        hours.push(`<span style="top:${((m - sM) / slot) * sh}px">${D.hourLabel(m / 60, L)}</span>`);
      }
      const corner = o.weekNumbers ? `<span class="ixc-wk">${t.weekShort}${D.weekNumber(days[0])}</span>` : cal.zoneLabel();

      const scroller = main.querySelector('.ixc-tg-scroll');
      const prevScroll = scroller && main.firstElementChild?.dataset.view === id ? [scroller.scrollTop, scroller.scrollLeft] : null;
      main.innerHTML = `
      <div class="ixc-tg${byResource ? ' ixc-tg-resmode' : ''}" data-view="${id}" style="--n:${N};--sh:${sh}px;--hour:${(60 / slot) * sh}px;--colmin:${colMin}px">
        <div class="ixc-tg-scroll">
          <div class="ixc-tg-sticky">
            <div class="ixc-tg-head"><div class="ixc-gutter ixc-tz">${corner}</div>${head}</div>
            <div class="ixc-tg-allday"><div class="ixc-gutter">${t.allDay}</div>
              <div class="ixc-tg-adarea" style="height:${adH}px">${cols.map((c, k) => `<i style="left:${(k / N) * 100}%"></i>`).join('')}${barHTML}</div></div>
          </div>
          <div class="ixc-tg-body">
            <div class="ixc-gutter ixc-hours" style="height:${H}px">${hours.join('')}</div>
            <div class="ixc-tg-cols">${colHTML}</div>
          </div>
        </div>
      </div>`;
      const sc = main.querySelector('.ixc-tg-scroll');
      if (prevScroll) { sc.scrollTop = prevScroll[0]; sc.scrollLeft = prevScroll[1]; }
      else sc.scrollTop = Math.max(0, ((o.scrollTime * 60 - sM) / slot) * sh);
    },
    scroller(cal) { return cal.main.querySelector('.ixc-tg-scroll'); },
    scrollTo(cal, date) {
      const sc = view.scroller(cal); if (!sc) return;
      const y = ((D.minutesOfDay(date) - cal.o.dayStart * 60) / cal.o.slotMinutes) * cal.slotHeight;
      if (sc.scrollTo) sc.scrollTo({ top: Math.max(0, y - 80), behavior: 'smooth' }); else sc.scrollTop = Math.max(0, y - 80);
    },
    hit(cal, x, y) {
      const main = cal.main;
      const cols = [...main.querySelectorAll('.ixc-col')];
      if (!cols.length) return null;
      const rects = cols.map((c) => c.getBoundingClientRect());
      const cx = D.clamp(x, rects[0].left, rects[rects.length - 1].right - 1);
      let k = rects.findIndex((r) => cx >= r.left && cx < r.right);
      if (k < 0) k = 0;
      const day = D.toDate(cols[k].dataset.date);
      const extra = {};
      if (byResource) { const r = cal._resourceById(cols[k].dataset.res); extra.resourceId = r ? r.id : null; }
      const ad = main.querySelector('.ixc-tg-adarea').getBoundingClientRect();
      if (y < ad.bottom) return { kind: 'day', allDay: true, date: day, ...extra };
      const o = cal.o, sM = o.dayStart * 60, eM = o.dayEnd * 60;
      const r = rects[k];
      let m = sM + ((y - r.top) / cal.slotHeight) * o.slotMinutes;
      m = D.clamp(Math.floor(m / o.snapMinutes) * o.snapMinutes, sM, eM - o.snapMinutes);
      return { kind: 'time', date: D.atMinutes(day, m), ...extra };
    },
  };
  return view;
}
