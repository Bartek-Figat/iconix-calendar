'use client';
import { createElement, forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { Calendar as Core } from './calendar.js';

const OWN = new Set(['className', 'style', 'id']);
// layout effect so the instance exists before the ref handle is read; plain effect on the server
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * <Calendar events={events} view="week" onEventUpdate={...} ref={apiRef} />
 * Every core option is a prop. `ref` gives you the Calendar instance (undo(), quickAdd(), gotoDate()…).
 */
export const Calendar = forwardRef(function Calendar(props, ref) {
  const el = useRef(null);
  const inst = useRef(null);
  const prev = useRef({});

  useIsoLayoutEffect(() => {
    const opts = {};
    for (const k in props) if (!OWN.has(k)) opts[k] = props[k];
    inst.current = new Core(el.current, opts);
    prev.current = props;
    return () => { inst.current.destroy(); inst.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cal = inst.current;
    if (!cal || prev.current === props) return;
    const patch = {};
    let changed = false;
    for (const k in props) {
      if (OWN.has(k) || props[k] === prev.current[k]) continue;
      if (typeof props[k] === 'function') { cal.o[k] = props[k]; continue; } // callbacks never re-render
      patch[k] = props[k];
      changed = true;
    }
    prev.current = props;
    if (changed) cal.setOptions(patch);
  });

  useImperativeHandle(ref, () => inst.current, [inst.current]);
  return createElement('div', { ref: el, className: props.className, style: { height: '100%', ...props.style }, id: props.id });
});

export default Calendar;
