// Demo data for the site, built around the current week so it always looks alive.
const startOfWeek = (d) => { const s = new Date(d.getFullYear(), d.getMonth(), d.getDate()); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; };
const at = (base, dayOffset, h, m = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, h, m);
const day = (base, dayOffset) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset);

export const calendars = [
  { id: 'work', name: 'Work', color: '#2563eb' },
  { id: 'team', name: 'Team rituals', color: '#7c3aed' },
  { id: 'focus', name: 'Focus', color: '#0891b2' },
  { id: 'personal', name: 'Personal', color: '#16a34a' },
  { id: 'travel', name: 'Travel', color: '#ea580c' },
];

export const resources = [
  { id: 'atlas', title: 'Atlas room', subtitle: 'Floor 2 · 8 seats', group: 'Rooms', color: '#2563eb' },
  { id: 'nova', title: 'Nova room', subtitle: 'Floor 3 · 4 seats', group: 'Rooms', color: '#7c3aed' },
  { id: 'studio', title: 'Studio', subtitle: 'Podcast booth', group: 'Rooms', color: '#db2777' },
  { id: 'anna', title: 'Anna Kowalska', subtitle: 'Design', group: 'People', color: '#0d9488' },
  { id: 'marek', title: 'Marek Nowak', subtitle: 'Engineering', group: 'People', color: '#ca8a04' },
  { id: 'julia', title: 'Julia Wiśniewska', subtitle: 'Product', group: 'People', color: '#ea580c' },
];

function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296); }

/** Monday of the week the demo opens on: this week, or next week when it is already the weekend. */
export function demoWeek(now = new Date()) {
  const w = startOfWeek(now);
  return now.getDay() === 0 || now.getDay() === 6 ? day(w, 7) : w;
}

export function demoEvents(now = new Date()) {
  const w = demoWeek(now);
  const ev = [
    { id: 'standup', title: 'Daily standup', start: at(w, -28, 9), end: at(w, -28, 9, 15), calendar: 'team', resourceId: 'atlas', rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] }, location: 'Atlas room' },
    { id: 'design', title: 'Design review', start: at(w, 0, 11), end: at(w, 0, 12), calendar: 'work', resourceId: 'nova', location: 'Nova room', notes: 'New onboarding flow, v3 mocks.' },
    { id: 'plan', title: 'Sprint planning', start: at(w, 1, 10), end: at(w, 1, 11, 30), calendar: 'team', resourceId: 'atlas', location: 'Atlas room' },
    { id: 'oneone', title: '1:1 with Anna', start: at(w, 1, 14), end: at(w, 1, 14, 30), calendar: 'work', resourceId: 'anna' },
    { id: 'int1', title: 'Interview: frontend', start: at(w, 1, 11, 30), end: at(w, 1, 12, 30), calendar: 'work', resourceId: 'julia' },
    { id: 'freeze', title: 'Release freeze', start: day(w, 2), end: day(w, 5), allDay: true, calendar: 'work' },
    { id: 'lunch', title: 'Lunch with Ola', start: at(w, 2, 12, 30), end: at(w, 2, 13, 30), calendar: 'personal', location: 'Charlotte, Plac Zbawiciela' },
    { id: 'arch', title: 'Architecture sync', start: at(w, 2, 14), end: at(w, 2, 15, 30), calendar: 'work', resourceId: 'nova' },
    { id: 'focus1', title: 'Deep work', start: at(w, 3, 9, 30), end: at(w, 3, 11, 30), calendar: 'focus' },
    { id: 'int2', title: 'Interview: backend', start: at(w, 3, 13), end: at(w, 3, 14), calendar: 'work', resourceId: 'marek' },
    { id: 'call', title: 'Customer call — Acme', start: at(w, 3, 15), end: at(w, 3, 16), calendar: 'work', location: 'Zoom' },
    { id: 'dentist', title: 'Dentist', start: at(w, 3, 15, 30), end: at(w, 3, 16, 15), calendar: 'personal' },
    { id: 'pod', title: 'Podcast recording', start: at(w, 4, 10), end: at(w, 4, 12), calendar: 'work', resourceId: 'studio' },
    { id: 'retro', title: 'Sprint retro', start: at(w, 4, 16), end: at(w, 4, 17), calendar: 'team', resourceId: 'atlas' },
    { id: 'demo', title: 'Demo day', start: at(w, 4, 13, 30), end: at(w, 4, 15), calendar: 'team', resourceId: 'nova' },
    { id: 'gym', title: 'Gym', start: at(w, -14, 18), end: at(w, -14, 19), calendar: 'personal', rrule: { freq: 'weekly', byweekday: [1, 3, 5] } },
    { id: 'market', title: 'Farmers market', start: at(w, 5, 10), end: at(w, 5, 11, 30), calendar: 'personal' },
    { id: 'run', title: 'Long run', start: at(w, 6, 8), end: at(w, 6, 9, 30), calendar: 'personal', rrule: { freq: 'weekly' } },
    { id: 'flight', title: 'Flight WAW → BER', start: at(w, 7, 7, 10), end: at(w, 7, 8, 40), calendar: 'travel', location: 'Chopin Airport' },
    { id: 'berlin', title: 'Berlin offsite', start: day(w, 7), end: day(w, 10), allDay: true, calendar: 'travel' },
    { id: 'board', title: 'Board deck due', start: day(w, -10), end: day(w, -9), allDay: true, calendar: 'work', rrule: { freq: 'monthly' } },
    { id: 'payday', title: 'Payday', start: new Date(w.getFullYear(), 0, 10), end: new Date(w.getFullYear(), 0, 11), allDay: true, calendar: 'personal', rrule: { freq: 'monthly' } },
    { id: 'bday', title: "Mom's birthday", start: day(w, 12), end: day(w, 13), allDay: true, calendar: 'personal', rrule: { freq: 'yearly' } },
    { id: 'tl1', title: 'Workshop prep', start: at(w, 0, 13), end: at(w, 0, 15), calendar: 'work', resourceId: 'anna' },
    { id: 'tl2', title: 'Code review', start: at(w, 0, 15, 30), end: at(w, 0, 16, 30), calendar: 'work', resourceId: 'marek' },
    { id: 'tl3', title: 'Roadmap', start: at(w, 2, 10), end: at(w, 2, 11), calendar: 'work', resourceId: 'julia' },
  ];

  // a sprinkle of history and future across the year, for the heat map
  const r = rng(42);
  const titles = ['Client workshop', 'Hiring sync', 'Budget review', 'Offsite planning', 'User interviews', 'Vendor call', 'Quarterly review', 'Pairing session', 'Doctor', 'Dinner with friends', 'Team lunch', 'Concert', 'Kids recital', 'Yoga', 'Bike service'];
  const cal = ['work', 'work', 'team', 'focus', 'personal'];
  const y0 = new Date(now.getFullYear(), 0, 1);
  for (let k = 0; k < 170; k++) {
    const d = Math.floor(r() * 365);
    const dt = day(y0, d);
    if (Math.abs(dt - w) < 14 * 864e5) continue;
    if (dt.getDay() === 0 && r() < 0.7) continue;
    const h = 8 + Math.floor(r() * 10);
    const len = [30, 45, 60, 60, 90, 120][Math.floor(r() * 6)];
    const s = at(dt, 0, h, r() < 0.5 ? 0 : 30);
    ev.push({ id: `r${k}`, title: titles[Math.floor(r() * titles.length)], start: s, end: new Date(+s + len * 60000), calendar: cal[Math.floor(r() * cal.length)] });
  }
  return ev;
}
