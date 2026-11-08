import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { run, parseArgs, CliError } from '../bin/cli.js';

const now = new Date(2026, 10, 8, 10, 0);
let dir, file;
const exec = (...argv) => { let out = ''; const code = run(argv, { now, out: (s) => { out += s; } }); return { code, out }; };

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'ixc-cli-'));
  file = join(dir, 'events.json');
  writeFileSync(file, JSON.stringify({ events: [
    { id: 'st', title: 'Standup', start: '2026-11-02T09:00', end: '2026-11-02T09:15', calendar: 'team', rrule: { freq: 'weekly', byweekday: [1, 2, 3, 4, 5] } },
    { id: 'a', title: 'Call', start: '2026-11-09T15:00', end: '2026-11-09T16:00', calendar: 'work' },
    { id: 'b', title: 'Dentist', start: '2026-11-09T15:30', end: '2026-11-09T16:15', calendar: 'home' },
    { id: 'c', title: 'Offsite', start: '2026-11-11', end: '2026-11-13', calendar: 'work' },
  ] }));
});
after(() => rmSync(dir, { recursive: true, force: true }));

describe('argument parsing', () => {
  test('flags, values, short aliases and positionals', () => {
    const a = parseArgs(['free', 'x.json', '--duration', '60', '--json', '-o', 'out.txt', '--hours=8-18']);
    assert.deepEqual(a._, ['free', 'x.json']);
    assert.deepEqual(a.flags, { duration: '60', json: true, out: 'out.txt', hours: '8-18' });
  });
});

describe('commands', () => {
  test('help and version', () => {
    assert.match(exec('--help').out, /Commands/);
    assert.match(exec().out, /Usage/);
    assert.match(exec('-v').out, /^\d+\.\d+\.\d+/);
  });

  test('parse --json', () => {
    const { out } = exec('parse', 'Dentist', 'friday', '4pm', 'for', '45', 'min', '#personal', '--json');
    const ev = JSON.parse(out);
    assert.equal(ev.title, 'Dentist');
    assert.equal(ev.calendar, 'personal');
    assert.equal(new Date(ev.start).getDay(), 5);
    assert.equal((new Date(ev.end) - new Date(ev.start)) / 60000, 45);
  });

  test('convert json → ics → json keeps events', () => {
    const ics = join(dir, 'out.ics');
    exec('convert', file, '-o', ics);
    assert.match(readFileSync(ics, 'utf8'), /RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR/);
    const back = join(dir, 'back.json');
    exec('convert', ics, '-o', back);
    const list = JSON.parse(readFileSync(back, 'utf8'));
    assert.equal(list.length, 4);
    assert.equal(list.find((e) => e.id === 'c').start, '2026-11-11');
  });

  test('agenda groups by day', () => {
    const { out } = exec('agenda', file, '--from', '2026-11-09', '--days', '1');
    assert.match(out, /Monday 9 November/);
    assert.match(out, /Standup/);
    assert.match(out, /Dentist/);
  });

  test('free finds a slot and exits 1 when there is none', () => {
    const { code, out } = exec('free', file, '--from', '2026-11-09T09:00', '--duration', '60', '--json');
    assert.equal(code, 0);
    assert.equal(new Date(JSON.parse(out).start).getHours(), 9);
    assert.equal(new Date(JSON.parse(out).start).getMinutes(), 15);
    assert.equal(exec('free', file, '--duration', '600', '--days', '2', '--from', '2026-11-09').code, 1);
  });

  test('clashes reports overlaps with exit code 1', () => {
    const { code, out } = exec('clashes', file, '--from', '2026-11-09');
    assert.equal(code, 1);
    assert.match(out, /Call.*Dentist/);
    assert.equal(exec('clashes', file, '--from', '2026-11-16').code, 0);
  });

  test('expand turns a series into single events', () => {
    const { out } = exec('expand', file, '--from', '2026-11-09', '--to', '2026-11-14');
    const list = JSON.parse(out).filter((e) => e.seriesId === 'st');
    assert.equal(list.length, 5);
    assert.equal(list[0].id, 'st@2026-11-09');
  });

  test('validate catches broken data', () => {
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, JSON.stringify([
      { id: 1, title: 'ok', start: '2026-11-09T10:00' },
      { id: 1, title: 'dup', start: '2026-11-09T10:00' },
      { title: 'backwards', start: '2026-11-09T10:00', end: '2026-11-09T09:00' },
      { title: 'nostart' },
      { title: 'rule', start: '2026-11-09', rrule: { freq: 'minutely' } },
    ]));
    const { code, out } = exec('validate', bad, '--json');
    const r = JSON.parse(out);
    assert.equal(code, 1);
    assert.equal(r.problems.length, 4);
    assert.equal(exec('validate', file).code, 0);
  });

  test('stats, presets, css and init', () => {
    const s = JSON.parse(exec('stats', file, '--from', '2026-11-09', '--days', '7', '--json').out);
    assert.equal(s.occurrences, 5 + 2 + 1);
    assert.match(exec('presets').out, /nord/);
    const css = exec('css', 'ocean', '--dark').out;
    assert.match(css, /\.ixc\[data-theme="dark"\]/);
    assert.match(css, /--ixc-accent: #38bdf8;/);
    assert.match(exec('init', 'vue').out, /IxCalendar/);
  });

  test('helpful errors', () => {
    assert.throws(() => exec('nope'), CliError);
    assert.throws(() => exec('agenda', join(dir, 'missing.json')), /File not found/);
    assert.throws(() => exec('free', file, '--duration', 'abc'), /positive number/);
    assert.throws(() => exec('free', file, '--hours', '18-9'), /9-17/);
    assert.throws(() => exec('css', 'unknown'), /Unknown preset/);
    assert.throws(() => exec('init', 'svelte'), /Unknown template/);
  });

  test('works as a real executable', () => {
    const r = spawnSync(process.execPath, [new URL('../bin/cli.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), 'nope'], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Unknown command/);
  });
});
