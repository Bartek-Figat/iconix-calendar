import * as D from '../date.js';
import { icon } from '../icons.js';
import { describeRule } from '../recur.js';

export const agenda = {
  id: 'agenda', kind: 'list',
  step(cal) { return { days: cal.o.agendaDays }; },
  range(cal) {
    const start = D.startOfDay(cal.state.date);
    return { start, end: D.addDays(start, cal.o.agendaDays) };
  },
  title(cal) {
    const { start, end } = agenda.range(cal);
    return D.fmtRange(start, D.addDays(end, -1), cal.locale, { month: cal.compact ? 'short' : 'long', day: 'numeric', year: 'numeric' });
  },
  render(cal, main) {
    const { start, end } = this.range(cal);
    const L = cal.locale, t = cal.t;
    const all = cal.instances(start, end).filter((i) => !i.display || i.display === 'auto');
    const now = cal.now();
    let html = '';
    for (let d = start; d < end; d = D.addDays(d, 1)) {
      const next = D.addDays(d, 1);
      const list = all.filter((i) => D.overlaps(i.start, i.end, d, next));
      if (!list.length) continue;
      list.sort((a, b) => (b.allDay - a.allDay) || a.start - b.start);
      const rows = list.map((i) => {
        const time = i.allDay || (i.start <= d && i.end >= next)
          ? t.allDay
          : `${D.timeStr(i.start < d ? d : i.start, L)} – ${D.timeStr(i.end > next ? next : i.end, L)}`;
        const cal_ = cal.calendarOf(i);
        const meta = [cal_ && cal_.name, i.location && `${icon('pin', 12)} ${cal.esc(i.location)}`, i.rrule && `${icon('repeat', 12)} ${describeRule(i.rrule, t, L)}`]
          .filter(Boolean).join('<span class="ixc-sep">·</span>');
        return `<button class="ixc-ag-row${i.end < now ? ' ixc-past' : ''}${cal.state.selected === i.key ? ' ixc-sel' : ''}" data-key="${i.key}" style="--c:${cal.colorOf(i)}">
          <span class="ixc-ag-time">${time}</span><span class="ixc-ag-dot"></span>
          <span class="ixc-ag-main"><b>${cal.hl(i.title || t.untitled)}</b>${meta ? `<small>${meta}</small>` : ''}</span></button>`;
      }).join('');
      const today = D.isSameDay(d, now);
      html += `<section class="ixc-ag-day${today ? ' ixc-today' : ''}">
        <button class="ixc-ag-date" data-goto-day="${D.ymd(d)}"><span class="ixc-ag-num">${d.getDate()}</span>
        <span><b>${D.fmt(d, L, { weekday: 'long' })}</b><small>${D.fmt(d, L, { month: 'long', year: 'numeric' })}</small></span></button>
        <div class="ixc-ag-list">${rows}</div></section>`;
    }
    if (!html) {
      html = `<div class="ixc-empty">${icon('calendar', 28)}<b>${cal.state.query ? t.noResults : t.nothing}</b><span>${t.nothingHint}</span></div>`;
    }
    main.innerHTML = `<div class="ixc-agenda" data-view="${this.id}">${html}</div>`;
  },
  hit() { return null; },
};

/** List of events for a whole week, month or year. */
function listOf(id, unit) {
  const view = {
    ...agenda,
    id,
    step() { return unit === 'week' ? { days: 7 } : unit === 'month' ? { months: 1 } : { months: 12 }; },
    range(cal) {
      const d = cal.state.date;
      if (unit === 'week') { const start = D.startOfWeek(d, cal.o.firstDay); return { start, end: D.addDays(start, 7) }; }
      if (unit === 'month') { const start = D.startOfMonth(d); return { start, end: D.addMonths(start, 1) }; }
      const start = new Date(d.getFullYear(), 0, 1);
      return { start, end: new Date(d.getFullYear() + 1, 0, 1) };
    },
    title(cal) {
      const { start, end } = view.range(cal);
      if (unit === 'year') return String(start.getFullYear());
      if (unit === 'month') return D.fmt(start, cal.locale, { month: cal.compact ? 'short' : 'long', year: 'numeric' });
      return D.fmtRange(start, D.addDays(end, -1), cal.locale, { month: cal.compact ? 'short' : 'long', day: 'numeric', year: 'numeric' });
    },
  };
  return view;
}
export const listWeek = listOf('listWeek', 'week');
export const listMonth = listOf('listMonth', 'month');
export const listYear = listOf('listYear', 'year');
