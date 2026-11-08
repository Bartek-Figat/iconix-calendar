import type { ForwardRefExoticComponent, RefAttributes, CSSProperties } from 'react';
import type { Calendar as Core, CalendarOptions } from './index';

export interface CalendarProps extends CalendarOptions {
  className?: string;
  style?: CSSProperties;
  id?: string;
}
export declare const Calendar: ForwardRefExoticComponent<CalendarProps & RefAttributes<Core>>;
export default Calendar;
