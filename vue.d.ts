import type { DefineComponent, Plugin } from 'vue';
import type { CalendarOptions, EventInput, ViewName, CalendarSource, Resource } from './index';

export declare const IxCalendar: DefineComponent<{
  options?: CalendarOptions;
  events?: EventInput[];
  view?: ViewName;
  date?: string | Date | number;
  calendars?: CalendarSource[];
  resources?: Resource[];
  theme?: 'light' | 'dark' | 'auto';
  locale?: string;
}>;
export declare const IconixCalendarPlugin: Plugin;
export default IxCalendar;
