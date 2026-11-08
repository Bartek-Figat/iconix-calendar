export type ViewName = 'day' | 'week' | 'days' | 'resourceDay' | 'month' | 'weekGrid' | 'multiMonth' | 'year' | 'agenda' | 'listWeek' | 'listMonth' | 'listYear' | 'timeline';
export type DateInput = Date | string | number;
export type PartName = 'root' | 'toolbar' | 'title' | 'button' | 'viewSwitcher' | 'search' | 'sidebar' | 'quickAdd' | 'miniMonth' | 'calendarList'
  | 'dayHeader' | 'today' | 'weekend' | 'dayColumn' | 'monthCell' | 'allDay' | 'timeLabel' | 'businessOff' | 'event' | 'eventTitle' | 'eventTime'
  | 'more' | 'nowIndicator' | 'resourceLabel' | 'resourceRow' | 'agendaDay' | 'agendaRow' | 'yearDay' | 'popover' | 'editor' | 'palette' | 'toast';
export type EventStyle = 'soft' | 'solid' | 'outline' | 'stripe' | 'pill' | 'glass' | 'gradient' | 'minimal';
export type PresetName = 'zinc' | 'ocean' | 'forest' | 'sunset' | 'grape' | 'rose' | 'nord' | 'paper' | 'mono' | 'brutal';
/** Token names without the --ixc- prefix, e.g. { accent: '#0f766e', 'bg-soft': '#f2fbf9' } */
export interface Preset { label?: string; radius?: number; font?: string; vars?: Record<string, string>; light?: Record<string, string>; dark?: Record<string, string>; }

export interface RecurrenceRule {
  freq: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;
  count?: number;
  until?: DateInput;
  /** 0 = Sunday … 6 = Saturday */
  byweekday?: number[];
  /** With byweekday in monthly/yearly rules: 2 = second, -1 = last */
  bysetpos?: number | number[];
  /** Days of the month, -1 = last day */
  bymonthday?: number[];
  /** Months 1–12 */
  bymonth?: number[];
}

export interface EventInput {
  id?: string | number;
  title?: string;
  start: DateInput;
  /** Exclusive. For all-day events this is the day after the last day. */
  end?: DateInput;
  allDay?: boolean;
  calendar?: string | number;
  resourceId?: string | number | null;
  /** Several resources at once (timeline rows / resourceDay columns). */
  resourceIds?: (string | number)[];
  /** 'background' = shaded block, not draggable, never a clash. */
  display?: 'auto' | 'background';
  /** Id of the event source this event came from. */
  source?: string;
  color?: string;
  location?: string;
  notes?: string;
  rrule?: RecurrenceRule | null;
  /** 'YYYY-MM-DD' dates of skipped occurrences */
  exdates?: string[];
  editable?: boolean;
  [extra: string]: unknown;
}

export interface CalendarEvent extends EventInput {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

export interface CalendarSource { id: string | number; name: string; color?: string; visible?: boolean; }
export interface Resource {
  id: string | number; title: string; subtitle?: string; group?: string; color?: string;
  businessHours?: { start: number; end: number; days?: number[] } | null;
  children?: Resource[];
  [field: string]: unknown;
}
export interface ResourceColumn { field?: string; label?: string; width?: number; render?: (resource: Resource) => string; }
export interface Range { start: Date; end: Date; }
export type EventsFunction = (info: { start: Date; end: Date; signal?: AbortSignal; view: ViewName }) => EventInput[] | Promise<EventInput[]>;
export interface EventSourceInput {
  id?: string; events?: EventInput[] | EventsFunction; url?: string; ics?: string;
  startParam?: string; endParam?: string; extraParams?: Record<string, string> | (() => Record<string, string>);
  headers?: Record<string, string>; transform?: (raw: any) => EventInput | null;
  color?: string; calendar?: string | number; editable?: boolean; display?: 'auto' | 'background';
}

export interface Hit { kind: 'time' | 'day'; date: Date; allDay?: boolean; resourceId?: string | number | null; }

export interface CalendarOptions {
  view?: ViewName;
  date?: DateInput;
  views?: ViewName[];
  locale?: string;
  /** 0 = Sunday, 1 = Monday */
  firstDay?: number;
  weekends?: boolean;
  dayStart?: number;
  dayEnd?: number;
  scrollTime?: number;
  slotMinutes?: number;
  snapMinutes?: number;
  slotHeight?: number;
  defaultDuration?: number;
  businessHours?: { start: number; end: number; days?: number[] } | null;
  daysCount?: number;
  agendaDays?: number;
  timelineDays?: number | 'month';
  monthsCount?: number;
  weekNumbers?: boolean;
  resourceColumns?: ResourceColumn[] | null;
  fixedWeeks?: boolean;
  events?: EventInput[] | string | EventsFunction | EventSourceInput;
  eventSources?: (EventSourceInput | EventInput[] | string | EventsFunction)[];
  lazyFetching?: boolean;
  fetch?: typeof fetch;
  calendars?: CalendarSource[];
  resources?: Resource[];
  defaultCalendar?: string | number | null;
  editable?: boolean;
  selectable?: boolean;
  selectMode?: 'create' | 'range';
  /** Accept drops from makeDraggable() lists and other calendars. */
  droppable?: boolean;
  /** IANA time zone to show, e.g. 'America/New_York'. Outputs stay real instants. */
  timeZone?: string | null;
  direction?: 'ltr' | 'rtl' | 'auto';
  /** Options for the @iconix/search engine behind event search: fuzzy, stemming, keys, synonyms… */
  search?: Record<string, unknown>;
  unselectAuto?: boolean;
  selectAllow?: (range: Range & { allDay: boolean; resourceId: string | number | null }) => boolean | void;
  selectOverlap?: boolean | ((event: CalendarEvent) => boolean);
  eventOverlap?: boolean | ((stillEvent: CalendarEvent, movingEvent: CalendarEvent | null) => boolean);
  validRange?: { start?: DateInput; end?: DateInput } | null;
  toolbar?: boolean;
  sidebar?: boolean;
  palette?: boolean;
  keyboard?: boolean;
  nowIndicator?: boolean;
  showClashes?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  accent?: string | null;
  radius?: number | null;
  density?: 'compact' | 'comfortable' | 'spacious';
  eventStyle?: EventStyle;
  /** A built-in preset name or your own { light, dark, vars, radius, font } object. */
  preset?: PresetName | Preset | null;
  height?: number | string | null;
  strings?: Partial<Record<string, string | ((n: any) => string)>>;
  eventContent?: (event: CalendarEvent, ctx: { view: ViewName; variant: 'box' | 'bar' | 'dot'; width: number | null; height: number | null }) => string | HTMLElement | null | undefined;
  eventClass?: (event: CalendarEvent) => string | undefined;
  /** Extra classes for any part of the UI, e.g. { toolbar: 'shadow-sm', event: 'rounded-xl' }. */
  classNames?: Partial<Record<PartName, string>>;
  /** Hours shown per day in multi-day timelines. Default [7, 20]. */
  timelineHours?: [number, number];
  /** Called for every rendered event element. */
  eventDidMount?: (p: { el: HTMLElement; event: CalendarEvent; view: ViewName }) => void;
  /** Return false to refuse a drag, resize or create at that position. */
  eventAllow?: (event: CalendarEvent, ctx: { action: 'move' | 'resize-start' | 'resize-end' | 'create'; old: { start: Date; end: Date; allDay: boolean; resourceId?: unknown } | null; resourceId: string | number | null }) => boolean | void;
  /** Extra class names for day columns and month cells. */
  dayClass?: (date: Date, ctx: { view: ViewName }) => string | undefined;

  onChange?: (p: { events: CalendarEvent[] }) => void;
  onEventClick?: (p: { event: CalendarEvent; instance: { start: Date; end: Date }; el: HTMLElement }) => void;
  onEventCreate?: (p: { event: CalendarEvent }) => void;
  onEventUpdate?: (p: { event: CalendarEvent; old: CalendarEvent }) => void;
  onEventDelete?: (p: { event: CalendarEvent; occurrence?: Date | null }) => void;
  onViewChange?: (p: { view: ViewName; date: Date; start: Date; end: Date }) => void;
  onDateClick?: (p: Hit) => void;
  onSelect?: (p: Range & { allDay: boolean; resourceId: string | number | null }) => void;
  onUnselect?: () => void;
  onLoading?: (p: { loading: boolean }) => void;
  onEventReceive?: (p: { event: CalendarEvent; draggedEl?: HTMLElement; from?: Calendar }) => void;
  onEventLeave?: (p: { event: CalendarEvent; to: Calendar }) => void;
  onSourceLoad?: (p: { source: string; events: CalendarEvent[] }) => void;
  onSourceError?: (p: { source: string; error: Error }) => void;
}

export interface QuickAddResult {
  title: string; start: Date; end: Date; allDay: boolean;
  calendar?: string | number; resourceId?: string | number; rrule: RecurrenceRule | null;
  tokens: { type: string; text: string }[];
}

export declare class Calendar {
  constructor(target: HTMLElement | string, options?: CalendarOptions);
  readonly o: Required<CalendarOptions>;
  getEvents(): CalendarEvent[];
  getEventById(id: string | number): CalendarEvent | null;
  addEvent(e: EventInput): CalendarEvent;
  updateEvent(id: string | number, patch: Partial<EventInput>): CalendarEvent | null;
  removeEvent(id: string | number): boolean;
  setEvents(list: EventInput[], opts?: { history?: boolean }): void;
  getView(): ViewName;
  getDate(): Date;
  getRange(): { start: Date; end: Date };
  setView(view: ViewName, date?: DateInput): void;
  gotoDate(date: DateInput): void;
  today(): void;
  prev(): void;
  next(): void;
  zoom(direction: 1 | -1): void;
  setOptions(patch: CalendarOptions): void;
  setQuery(q: string): void;
  toggleCalendar(id: string | number, visible?: boolean): void;
  toggleSidebar(visible?: boolean): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  parse(text: string): QuickAddResult;
  quickAdd(text: string): CalendarEvent | null;
  findFreeSlot(opts?: { duration?: number; from?: Date; days?: number; hours?: { start: number; end: number; days?: number[] } | null }): { start: Date; end: Date } | null;
  showFreeSlot(duration?: number): { start: Date; end: Date } | null;
  exportICS(name?: string): string;
  importICS(text: string, opts?: { history?: boolean }): CalendarEvent[];
  download(type?: 'ics' | 'json', filename?: string): void;
  openPalette(initial?: string): void;
  closePalette(): void;
  openEditor(key: string, anchor?: HTMLElement | null): void;
  select(key: string | null): void;
  copy(key: string): void;
  paste(): void;
  duplicate(key: string): void;
  deleteInstance(key: string, opts?: { series?: boolean }): void;
  on(name: string, fn: (...args: any[]) => void): () => void;
  off(name: string, fn: (...args: any[]) => void): void;
  refetchEvents(): Promise<void>;
  addEventSource(source: EventSourceInput | EventInput[] | string | EventsFunction): Promise<void>;
  removeEventSource(id: string): void;
  getEventSources(): { id: string; kind: 'static' | 'fn' | 'url' | 'ics'; url?: string; ics?: string; color?: string; calendar?: string | number }[];
  selectRange(range: { start: DateInput; end: DateInput; allDay?: boolean; resourceId?: string | number | null }): Range;
  unselect(): void;
  getSelection(): (Range & { allDay: boolean; resourceId: string | number | null }) | null;
  toggleResource(key: string): void;
  print(): void;
  /** Ranked event search (typo tolerant, word forms, field queries like "location:atlas"). */
  searchEvents(query: string, options?: { limit?: number }): CalendarEvent[];
  /** Current time as wall-clock time in the calendar zone. */
  now(): Date;
  destroy(): void;
}

export declare function createCalendar(target: HTMLElement | string, options?: CalendarOptions): Calendar;
export declare function parseQuickAdd(text: string, opts?: { now?: Date; calendars?: CalendarSource[]; resources?: Resource[]; defaultDuration?: number; locale?: string }): QuickAddResult;
export declare function toICS(events: CalendarEvent[], opts?: { name?: string }): string;
export declare function fromICS(text: string): EventInput[];
export declare function expandRecurrence(event: CalendarEvent, start: Date, end: Date): (CalendarEvent & { key: string; recurring: boolean })[];
export declare const DEFAULTS: CalendarOptions;
export declare const SWATCHES: string[];
export declare const PRESETS: Record<PresetName, Preset>;
export declare const EVENT_STYLES: EventStyle[];
export declare const PARTS: Record<PartName, string>;
export declare function makeDraggable(container: HTMLElement | string, options?: {
  itemSelector?: string;
  eventData?: EventInput | ((el: HTMLElement) => EventInput & { duration?: number });
  remove?: boolean;
  ghostClass?: string;
}): { destroy(): void };
export declare function toWall(instant: Date, timeZone: string | null): Date;
export declare function fromWall(wall: Date, timeZone: string | null): Date;
