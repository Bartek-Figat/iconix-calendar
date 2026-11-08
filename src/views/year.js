import * as D from '../date.js';

/** Twelve mini months with a heat map of how busy each day is. */
export const year = {
  id: 'year', kind: 'year',
  step() { return { months: 12 }; },
  range(cal) {
    const start = new Date(cal.state.date.getFullYear(), 0, 1);
    return { start, end: new Date(start.getFullYear() + 1, 0, 1) };
  },
  title(cal) { return String(cal.state.date.getFullYear()); },
  render(cal, main) {
    const { start, end } = year.range(cal);
    const L = cal.locale, o = cal.o;
    const counts = new Map();
    for (const i of cal.instances(start, end).filter((x) => !x.display || x.display === 'auto')) {
      let d = D.startOfDay(i.start < start ? start : i.start);
      const last = i.allDay ? D.addDays(i.end, -1) : new Date(i.end - 1);
      for (let k = 0; d <= last && k < 62; k++, d = D.addDays(d, 1)) {
        const key = D.ymd(d); counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const now = cal.now();
    const wd = [];
    for (let i = 0; i < 7; i++) wd.push(D.fmt(D.addDays(D.startOfWeek(now, o.firstDay), i), L, { weekday: 'narrow' }));
    let html = '';
    for (let mo = 0; mo < 12; mo++) {
      const m = new Date(start.getFullYear(), mo, 1);
      const gs = D.startOfWeek(m, o.firstDay);
      let cells = '';
      for (let k = 0; k < 42; k++) {
        const d = D.addDays(gs, k);
        if (d.getMonth() !== mo) { cells += '<span></span>'; continue; }
        const c = counts.get(D.ymd(d)) || 0;
        const lvl = c === 0 ? 0 : c === 1 ? 1 : c === 2 ? 2 : c <= 4 ? 3 : 4;
        cells += `<button data-goto-day="${D.ymd(d)}" class="ixc-yr-d ixc-h${lvl}${D.isSameDay(d, now) ? ' ixc-today' : ''}" title="${D.fmt(d, L, { weekday: 'short', month: 'short', day: 'numeric' })}${c ? ` · ${c}` : ''}">${d.getDate()}</button>`;
      }
      html += `<div class="ixc-yr-m"><button class="ixc-yr-t" data-goto-month="${D.ymd(m)}">${D.fmt(m, L, { month: 'long' })}</button>
        <div class="ixc-yr-g">${wd.map((w) => `<i>${w}</i>`).join('')}${cells}</div></div>`;
    }
    const legend = [0, 1, 2, 3, 4].map((l) => `<span class="ixc-yr-d ixc-h${l}"></span>`).join('');
    main.innerHTML = `<div class="ixc-year" data-view="year"><div class="ixc-yr-grid">${html}</div>
      <div class="ixc-yr-legend"><span>0</span>${legend}<span>5+</span></div></div>`;
  },
  hit() { return null; },
};
