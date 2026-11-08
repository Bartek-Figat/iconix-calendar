# Changelog

## 0.1.0

First release.

### Views
- 13 views: day, week, N days, resources as columns, month, week grid, multi-month, year heat map, agenda, list week / month / year and a resource timeline by day, week or month.
- Week numbers, business hours (also per resource), background events and a now indicator.

### Working with events
- Drag to create, move and resize, across days, the all-day strip and resources.
- Drag from any list on the page (`makeDraggable`) and between calendars (`droppable`).
- Range selection (`selectMode: 'range'`) with `selectAllow`, `selectOverlap`, `eventOverlap`, `validRange` and `eventAllow`.
- Undo and redo, copy, paste and duplicate, a command palette (Ctrl/⌘ K) and keyboard shortcuts for everything.
- Natural-language quick add in English and Polish: “Board every 2nd tuesday 10:00 #work”.
- A free-slot finder and clash detection.

### Data
- Event sources: arrays, functions called per visible range, JSON feed URLs and .ics feeds, with lazy loading and a loading indicator.
- Repeat rules: daily, weekly on chosen days, monthly by day or by weekday position (“2nd Tuesday”, “last Friday”), yearly, hourly, with interval, count, until and skipped dates.
- .ics import and export, JSON export.
- Time zones (`timeZone`): events are shown in the chosen zone, everything you get back is a real instant.

### Look and feel
- 10 presets with light and dark variants, 8 event styles, density, radius and accent options.
- `classNames` for 32 parts of the UI, plus stable `ixc-*` classes and CSS variables.
- Right-to-left layouts, a print stylesheet and UI text in English, Polish, German, French and Spanish.
- Every icon comes from @iconix/icons; event search (typos, word forms, field queries) is powered by @iconix/search.

### Frameworks and tools
- React and Vue components, a `<ixc-calendar>` web component and plain JavaScript.
- TypeScript types.
- An `iconix-calendar` CLI: parse, convert, agenda, free, clashes, expand, validate, stats, presets, css and init.
