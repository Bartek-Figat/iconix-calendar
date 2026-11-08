const en = {
  today: 'Today', prev: 'Previous', next: 'Next',
  day: 'Day', week: 'Week', days: 'Days', month: 'Month', year: 'Year', agenda: 'Agenda', timeline: 'Timeline',
  resourceDay: 'Resources', weekGrid: 'Week grid', multiMonth: 'Months', listWeek: 'List', listMonth: 'Month list', listYear: 'Year list', weekShort: 'W',
  allDay: 'All day', more: (n) => `+${n} more`, untitled: '(No title)', addTitle: 'Add a title',
  search: 'Search events', quickAdd: 'Lunch with Ann tomorrow 1pm #work', quickAddHint: 'Type naturally, press Enter',
  newEvent: 'New event', calendars: 'Calendars', resources: 'Resources', unassigned: 'Unassigned', only: 'only',
  delete: 'Delete', deleteOne: 'Delete this one', deleteAll: 'Delete series', duplicate: 'Duplicate', done: 'Done',
  location: 'Location', notes: 'Notes', calendar: 'Calendar', resource: 'Resource', color: 'Color', auto: 'Auto',
  repeat: 'Repeat', rNone: 'Does not repeat', rDaily: 'Every day', rWeekdays: 'Every weekday', rWeekly: 'Every week',
  rMonthly: 'Every month', rYearly: 'Every year', rHourly: 'Every hour',
  rMonthlyNth: (n, wd) => `Monthly on the ${['', '1st', '2nd', '3rd', '4th'][n]} ${wd}`, rMonthlyLast: (wd) => `Monthly on the last ${wd}`, seriesNote: 'Changes apply to every occurrence',
  clashes: (n) => (n === 1 ? '1 clash' : `${n} clashes`),
  nothing: 'Nothing scheduled', nothingHint: 'Press N or drag on the grid to add an event.',
  noResults: 'No events match', commands: 'Type a command, an event, or something to add…',
  create: 'Create', goTo: 'Go to', events: 'Events', actions: 'Actions',
  deleted: 'Event deleted', undo: 'Undo', undone: 'Undone', redone: 'Redone', nothingToUndo: 'Nothing to undo',
  created: 'Event added', copied: 'Copied', pasted: 'Pasted', duplicated: 'Duplicated',
  freeSlot: (d) => `Free slot: ${d}`, book: 'Book it', noFree: 'No free slot in the next two weeks', focusTime: 'Focus time',
  imported: (n) => `Imported ${n} event${n === 1 ? '' : 's'}`, exported: 'Exported',
  cmdToday: 'Go to today', cmdPrev: 'Previous period', cmdNext: 'Next period', cmdView: (v) => `${v} view`,
  cmdNew: 'New event', cmdFree30: 'Find a free 30 min slot', cmdFree60: 'Find a free 1 hour slot',
  cmdUndo: 'Undo', cmdRedo: 'Redo', cmdWeekends: 'Show / hide weekends', cmdSidebar: 'Show / hide sidebar',
  cmdZoomIn: 'Zoom in', cmdZoomOut: 'Zoom out', cmdTheme: (t) => `Theme: ${t}`, cmdStyle: (s) => `Event style: ${s}`, cmdPreset: (p) => `Preset: ${p}`,
  cmdDensity: (d) => `Density: ${d}`, cmdExportIcs: 'Export .ics', cmdImportIcs: 'Import .ics',
  cmdExportJson: 'Export JSON', cmdShowAll: 'Show all calendars', cmdClearSearch: 'Clear search', cmdClashes: 'Highlight clashes',
  free: 'Free', clickToBook: 'click to book', didYouMean: 'Did you mean',
};

const pl = {
  today: 'Dziś', prev: 'Wstecz', next: 'Dalej',
  day: 'Dzień', week: 'Tydzień', days: 'Dni', month: 'Miesiąc', year: 'Rok', agenda: 'Agenda', timeline: 'Oś czasu',
  resourceDay: 'Zasoby', weekGrid: 'Tydzień (siatka)', multiMonth: 'Miesiące', listWeek: 'Lista', listMonth: 'Lista miesiąca', listYear: 'Lista roku', weekShort: 'T',
  allDay: 'Cały dzień', more: (n) => `+${n} więcej`, untitled: '(Bez tytułu)', addTitle: 'Dodaj tytuł',
  search: 'Szukaj wydarzeń', quickAdd: 'Lunch z Anią jutro 13:00 #praca', quickAddHint: 'Pisz naturalnie, Enter dodaje',
  newEvent: 'Nowe wydarzenie', calendars: 'Kalendarze', resources: 'Zasoby', unassigned: 'Nieprzypisane', only: 'tylko',
  delete: 'Usuń', deleteOne: 'Usuń to jedno', deleteAll: 'Usuń serię', duplicate: 'Duplikuj', done: 'Gotowe',
  location: 'Miejsce', notes: 'Notatki', calendar: 'Kalendarz', resource: 'Zasób', color: 'Kolor', auto: 'Auto',
  repeat: 'Powtarzaj', rNone: 'Nie powtarza się', rDaily: 'Codziennie', rWeekdays: 'W dni robocze', rWeekly: 'Co tydzień',
  rMonthly: 'Co miesiąc', rYearly: 'Co rok', rHourly: 'Co godzinę',
  rMonthlyNth: (n, wd) => `Co miesiąc: ${['', 'pierwszy', 'drugi', 'trzeci', 'czwarty'][n]} ${wd}`, rMonthlyLast: (wd) => `Co miesiąc: ostatni ${wd}`, seriesNote: 'Zmiany dotyczą całej serii',
  clashes: (n) => (n === 1 ? '1 kolizja' : n < 5 ? `${n} kolizje` : `${n} kolizji`),
  nothing: 'Nic zaplanowanego', nothingHint: 'Naciśnij N albo przeciągnij po siatce, aby dodać wydarzenie.',
  noResults: 'Brak pasujących wydarzeń', commands: 'Wpisz polecenie, wydarzenie albo coś do dodania…',
  create: 'Utwórz', goTo: 'Idź do', events: 'Wydarzenia', actions: 'Akcje',
  deleted: 'Usunięto wydarzenie', undo: 'Cofnij', undone: 'Cofnięto', redone: 'Przywrócono', nothingToUndo: 'Nie ma czego cofnąć',
  created: 'Dodano wydarzenie', copied: 'Skopiowano', pasted: 'Wklejono', duplicated: 'Zduplikowano',
  freeSlot: (d) => `Wolny termin: ${d}`, book: 'Zarezerwuj', noFree: 'Brak wolnego terminu w ciągu dwóch tygodni', focusTime: 'Czas na skupienie',
  imported: (n) => `Zaimportowano: ${n}`, exported: 'Wyeksportowano',
  cmdToday: 'Idź do dziś', cmdPrev: 'Poprzedni okres', cmdNext: 'Następny okres', cmdView: (v) => `Widok: ${v}`,
  cmdNew: 'Nowe wydarzenie', cmdFree30: 'Znajdź wolne 30 min', cmdFree60: 'Znajdź wolną godzinę',
  cmdUndo: 'Cofnij', cmdRedo: 'Ponów', cmdWeekends: 'Pokaż / ukryj weekendy', cmdSidebar: 'Pokaż / ukryj panel boczny',
  cmdZoomIn: 'Powiększ', cmdZoomOut: 'Pomniejsz', cmdTheme: (t) => `Motyw: ${t}`, cmdStyle: (s) => `Styl wydarzeń: ${s}`, cmdPreset: (p) => `Motyw: ${p}`,
  cmdDensity: (d) => `Gęstość: ${d}`, cmdExportIcs: 'Eksportuj .ics', cmdImportIcs: 'Importuj .ics',
  cmdExportJson: 'Eksportuj JSON', cmdShowAll: 'Pokaż wszystkie kalendarze', cmdClearSearch: 'Wyczyść wyszukiwanie', cmdClashes: 'Podświetl kolizje',
  free: 'Wolne', clickToBook: 'kliknij, aby zarezerwować', didYouMean: 'Czy chodziło o',
};

import { de, fr, es } from './locales.js';

export const STRINGS = { en, pl, de, fr, es };
export function getStrings(locale = 'en', overrides = {}) {
  return { ...en, ...(STRINGS[String(locale).slice(0, 2).toLowerCase()] || {}), ...overrides };
}
