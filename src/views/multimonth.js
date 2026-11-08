import * as D from '../date.js';

const CHIPS = 2;

/** Several full months side by side, each day listing its first events. `monthsCount` sets how many. */
export const multiMonth = {
  id: 'multiMonth', kind: 'day',
  step(cal) { return { months: cal.o.monthsCount }; },
  range(cal) {
    const start = D.startOfMonth(cal.state.date);
    return { start, end: D.addMonths(start, cal.o.monthsCount) };
  },
  title(cal) {
    const { start, end } = multiMonth.range(cal);
    return D.fmtRange(start, D.addDays(end, -1), cal.locale, { month: cal.compact ? 'short' : 'long', year: 'numeric' });
  },
  render(cal, main) {
    const { start, end } = multiMonth.range(cal);
    const L = cal.locale, o = cal.o, t = cal.t;
    const all = cal.instances(D.startOfWeek(start, o.firstDay), D.addDays(end, 7)).filter((i) => !i.display || i.display === 'auto');
    const now = cal.now();
    const wd = [];
    for (let i = 0; i < 7; i++) wd.push(`<i>${D.fmt(D.addDays(D.startOfWeek(now, o.firstDay), i), L, { weekday: 'short' })}</i>`);
    let html = '';
    for (let m = start; m < end; m = D.addMonths(m, 1)) {
      const gs = D.startOfWeek(m, o.firstDay);
      const weeks = Math.ceil(D.diffDays(gs, D.addMonths(m, 1)) / 7);
      let cells = '';
      for (let k = 0; k < weeks * 7; k++) {
        const d = D.addDays(gs, k);
        if (d.getMonth() !== m.getMonth()) { cells += '<div class="ixc-mm-d ixc-outside"></div>'; continue; }
        const list = all.filter((i) => D.overlaps(i.start, i.end, d, D.addDays(d, 1)));
        const chips = list.slice(0, CHIPS).map((i) => `<button class="ixc-mm-ev${cal.state.selected === i.key ? ' ixc-sel' : ''}" data-key="${cal.esc(i.key)}" style="--c:${cal.colorOf(i)}" title="${cal.esc(`${i.title || t.untitled} · ${i.allDay ? t.allDay : D.timeStr(i.start, L)}`)}">${cal.esc(i.title || t.untitled)}</button>`).join('');
        const more = list.length > CHIPS ? `<button class="ixc-mm-more" data-goto-day="${D.ymd(d)}">${t.more(list.length - CHIPS)}</button>` : '';
        const cls = `${D.isSameDay(d, now) ? ' ixc-today' : ''}${d.getDay() % 6 === 0 ? ' ixc-weekend' : ''}${cal.dayClass(d)}`;
        cells += `<div class="ixc-mm-d${cls}" data-date="${D.ymd(d)}"><button class="ixc-mm-n" data-goto-day="${D.ymd(d)}">${d.getDate()}</button>${chips}${more}</div>`;
      }
      html += `<section class="ixc-mm-m"><button class="ixc-mm-t" data-goto-month="${D.ymd(m)}">${D.fmt(m, L, { month: 'long', year: 'numeric' })}</button>
        <div class="ixc-mm-g"><div class="ixc-mm-wd">${wd.join('')}</div><div class="ixc-mm-days">${cells}</div></div></section>`;
    }
    main.innerHTML = `<div class="ixc-mm" data-view="multiMonth">${html}</div>`;
  },
  hit() { return null; },
};
