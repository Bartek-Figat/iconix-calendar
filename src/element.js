import { Calendar } from './calendar.js';

const ATTRS = ['view', 'date', 'locale', 'theme', 'first-day', 'event-style', 'density', 'accent', 'day-start', 'day-end', 'sidebar'];
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const parse = (k, v) => {
  if (['firstDay', 'dayStart', 'dayEnd'].includes(k)) return +v;
  if (k === 'sidebar') return v !== 'false';
  return v;
};

/**
 * <ixc-calendar view="month" theme="dark"></ixc-calendar>
 * el.options = { events, calendars, ... }  ·  el.api -> Calendar instance
 * Events are re-dispatched as DOM events prefixed with "ixc:" (e.g. "ixc:eventUpdate").
 * Light DOM on purpose, so the regular stylesheet applies.
 */
export class IxcCalendarElement extends HTMLElement {
  static get observedAttributes() { return ATTRS; }
  constructor() { super(); this._opts = {}; }
  set options(o) { this._opts = { ...this._opts, ...o }; if (this.api) this.api.setOptions(o); }
  get options() { return this._opts; }
  connectedCallback() {
    if (this.api) return;
    if (!this.style.display) this.style.display = 'block';
    const o = { ...this._opts };
    for (const a of ATTRS) if (this.hasAttribute(a)) o[camel(a)] = parse(camel(a), this.getAttribute(a));
    this.api = new Calendar(this, o);
    this.api.on('*', (name, detail) => this.dispatchEvent(new CustomEvent(`ixc:${name}`, { detail, bubbles: true })));
  }
  disconnectedCallback() { this.api?.destroy(); this.api = null; }
  attributeChangedCallback(name, _, v) {
    if (!this.api) return;
    const k = camel(name);
    this.api.setOptions({ [k]: parse(k, v) });
  }
}
if (typeof customElements !== 'undefined' && !customElements.get('ixc-calendar')) customElements.define('ixc-calendar', IxcCalendarElement);
