// Minimal browser environment for DOM tests (jsdom).
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
const define = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
for (const k of ['window', 'document', 'HTMLElement', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'customElements', 'SVGElement', 'Element', 'HTMLDivElement', 'DocumentFragment', 'MutationObserver']) {
  define(k, k === 'window' ? w : typeof w[k] === 'function' && !/^[A-Z]/.test(k) ? w[k].bind(w) : w[k]);
}
define('navigator', w.navigator);
define('CSS', { escape: (s) => String(s).replace(/([^\w-])/g, '\\$1') });

export { w as window };

/** Mounts a calendar into a fresh container and returns it; call cal.destroy() in the test. */
export async function mount(options = {}) {
  const { createCalendar } = await import('../../src/index.js');
  const host = document.createElement('div');
  document.body.appendChild(host);
  const cal = createCalendar(host, { locale: 'en-GB', date: '2026-11-09', sidebar: true, ...options });
  const destroy = cal.destroy.bind(cal);
  cal.destroy = () => { destroy(); host.remove(); };
  return cal;
}

export const key = (cal, k, extra = {}) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
