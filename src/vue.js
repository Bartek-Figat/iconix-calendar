import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Calendar as Core } from './calendar.js';

const EVENTS = ['change', 'eventClick', 'eventCreate', 'eventUpdate', 'eventDelete', 'viewChange', 'dateClick'];

/**
 * <IxCalendar :events="events" view="week" @event-update="save" ref="cal" />
 * Pass any core option as a prop (or all at once through :options). The exposed `api` is the Calendar instance.
 */
export const IxCalendar = defineComponent({
  name: 'IxCalendar',
  inheritAttrs: false,
  props: {
    options: { type: Object, default: () => ({}) },
    events: { type: Array, default: undefined },
    view: { type: String, default: undefined },
    date: { type: [String, Date, Number], default: undefined },
    calendars: { type: Array, default: undefined },
    resources: { type: Array, default: undefined },
    theme: { type: String, default: undefined },
    locale: { type: String, default: undefined },
  },
  emits: EVENTS.map((e) => e.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())),
  setup(props, { emit, expose, attrs }) {
    const el = ref(null);
    let cal = null;
    const collect = () => {
      const o = { ...props.options };
      for (const k of ['events', 'view', 'date', 'calendars', 'resources', 'theme', 'locale']) if (props[k] !== undefined) o[k] = props[k];
      return o;
    };
    onMounted(() => {
      cal = new Core(el.value, collect());
      cal.on('*', (name, payload) => emit(name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()), payload));
    });
    onBeforeUnmount(() => { cal && cal.destroy(); cal = null; });
    watch(() => props.events, (v) => cal && v && cal.setOptions({ events: v }));
    watch(() => [props.view, props.date, props.calendars, props.resources, props.theme, props.locale, props.options], () => {
      if (!cal) return;
      const o = collect();
      delete o.events;
      cal.setOptions(o);
    }, { deep: true });
    expose({ get api() { return cal; } });
    return () => h('div', { ...attrs, ref: el, style: { height: '100%', ...(attrs.style || {}) } });
  },
});

export const IconixCalendarPlugin = { install(app) { app.component('IxCalendar', IxCalendar); } };
export default IxCalendar;
