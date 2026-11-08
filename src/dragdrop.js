// Drag & drop across calendars and from any element on the page.
const registry = new Set();

export function registerCalendar(cal) {
  registry.add(cal);
  return () => registry.delete(cal);
}

/** The droppable calendar under a screen point (other than `except`). */
export function calendarAt(x, y, except) {
  for (const cal of registry) {
    if (cal === except || !cal.o.droppable || !cal.root.isConnected) continue;
    const r = cal.main.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return cal;
  }
  return null;
}

function readData(el, eventData) {
  if (typeof eventData === 'function') return eventData(el);
  if (eventData) return { ...eventData };
  if (el.dataset.event) { try { return JSON.parse(el.dataset.event); } catch { /* fall through */ } }
  return { title: el.textContent.trim() };
}

/**
 * Lets elements outside the calendar be dragged onto any calendar with `droppable: true`.
 *   makeDraggable(listEl, { itemSelector: '.task', eventData: (el) => ({ title: el.textContent, duration: 45 }) })
 * eventData fields: any event field plus `duration` (minutes). Without eventData, `data-event` JSON or the text is used.
 */
export function makeDraggable(container, { itemSelector = '[data-event]', eventData = null, remove = false, ghostClass = '' } = {}) {
  const root = typeof container === 'string' ? document.querySelector(container) : container;
  if (!root) throw new Error('@iconix/calendar: draggable container not found');
  let st = null;

  const move = (e) => {
    if (!st) return;
    if (!st.started) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 5) return;
      st.started = true;
      st.ghost = document.createElement('div');
      st.ghost.className = `ixc-ghost ${ghostClass}`.trim();
      st.ghost.textContent = st.data.title || '';
      if (st.data.color) st.ghost.style.setProperty('--c', st.data.color);
      document.body.appendChild(st.ghost);
      st.el.classList.add('ixc-dragging-src');
    }
    e.preventDefault();
    st.ghost.style.transform = `translate(${e.clientX + 12}px, ${e.clientY + 10}px)`;
    const cal = calendarAt(e.clientX, e.clientY);
    if (st.over && st.over !== cal) st.over._extLeave();
    st.over = cal;
    if (cal) cal._extOver(st.data, e.clientX, e.clientY);
    st.ghost.classList.toggle('ixc-ghost-over', !!cal);
  };
  const up = (e) => {
    if (!st) return;
    const s = st;
    st = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('keydown', key);
    s.ghost?.remove();
    s.el.classList.remove('ixc-dragging-src');
    if (!s.started || e.type !== 'pointerup') { s.over?._extLeave(); return; }
    const ev = s.over ? s.over._extDrop({ draggedEl: s.el }) : null;
    if (ev && remove) s.el.remove();
  };
  const key = (e) => { if (e.key === 'Escape') up({ type: 'cancel' }); };
  const down = (e) => {
    if (e.button !== 0) return;
    const el = e.target.closest(itemSelector);
    if (!el || !root.contains(el)) return;
    st = { el, x: e.clientX, y: e.clientY, data: readData(el, eventData), started: false, over: null };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('keydown', key);
  };
  root.addEventListener('pointerdown', down);
  root.classList.add('ixc-draggable');
  return { destroy() { root.removeEventListener('pointerdown', down); root.classList.remove('ixc-draggable'); up({ type: 'cancel' }); } };
}
