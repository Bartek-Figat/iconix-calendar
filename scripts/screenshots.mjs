// npm run screenshots: renders the site in headless Edge / Chrome and saves the README images to docs/screenshots/.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'screenshots');
const PORT = 5600 + Math.floor(Math.random() * 200);
const BASE = `http://localhost:${PORT}/site/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(out, { recursive: true });

const server = spawn(process.execPath, [join(root, 'server.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { if ((await fetch(BASE)).ok) break; } catch { /* starting */ } await sleep(100); }
const b = await launch();

/** Loads a page in a theme, runs `prepare`, then saves the box around `selector` (plus padding), or the viewport. */
async function shot(name, { page = '', width = 1360, height = 900, dark = false, selector, pad = 24, prepare = '', wait = 700 }) {
  await b.viewport(width, height, dark);
  // a unique query makes every visit a real navigation (a changed #hash alone would not reload)
  const url = (k) => { const [path, hash] = page.split('#'); return `${BASE}${path}?shot=${name}-${k}${hash ? `#${hash}` : ''}`; };
  await b.goto(url(1));
  await b.eval(`try { localStorage.clear(); localStorage.setItem('ixc-site-theme', '${dark ? 'dark' : 'light'}'); } catch {} return 1;`);
  await b.goto(url(2));
  await sleep(900); // icons and the search engine come from the CDN
  await b.eval(`document.documentElement.style.scrollBehavior = 'auto'; ${prepare}; return 1;`);
  await sleep(wait);
  // clip is in page coordinates (viewport position + scroll)
  const box = selector ? await b.eval(`const rs = ${JSON.stringify([].concat(selector))}.map((q) => document.querySelector(q).getBoundingClientRect()); const r = { x: Math.min(...rs.map((a) => a.x)), y: Math.min(...rs.map((a) => a.y)), width: Math.max(...rs.map((a) => a.right)) - Math.min(...rs.map((a) => a.x)), height: Math.max(...rs.map((a) => a.bottom)) - Math.min(...rs.map((a) => a.y)) }; return { x: Math.max(0, r.x - ${pad}), y: Math.max(0, r.y + scrollY - ${pad}), w: Math.min(innerWidth, r.width + ${pad * 2}), h: r.height + ${pad * 2} };`) : null;
  const params = { format: 'png', captureBeyondViewport: !!box };
  if (box) params.clip = { x: box.x, y: box.y, width: box.w, height: Math.min(box.h, 2400), scale: 1 };
  const png = Buffer.from((await b.send('Page.captureScreenshot', params)).data, 'base64');
  writeFileSync(join(out, `${name}.png`), png);
  console.log('saved', name);
}
const toDemo = "document.querySelector('.try').scrollIntoView({ block: 'start' }); window.scrollBy(0, -80)";

try {
  // 1. hero
  await shot('hero', { height: 860, selector: '.hero .wrap', pad: 0 });
  // 2. week view with sidebar
  await shot('week', { height: 1000, prepare: toDemo, selector: '#demo .demo-frame', pad: 16 });
  // 3. command palette creating an event from a sentence
  await shot('palette', {
    height: 1000,
    prepare: `${toDemo}; window.cal.openPalette('Dentist friday 4pm for 45 min #personal')`,
    selector: '#demo .demo-frame', pad: 16,
  });
  // 4. resource timeline with columns (docs example), dark
  await shot('timeline-dark', { page: 'docs.html#ex-garage', dark: true, height: 1000, selector: '.docs-main .ex-frame', pad: 16 });
  // 5. a preset + event style from the Styles section, dark
  await shot('styles-dark', {
    dark: true, height: 1000,
    prepare: "document.querySelector('#styles').scrollIntoView({ block: 'start' }); document.querySelector('[data-preset=\"grape\"]').click(); document.querySelector('[data-evs=\"solid\"]').click(); window.scrollBy(0, 120)",
    selector: '.styles-frame', pad: 16,
  });
  // 6. docs page: sidebar search over 82 examples and the API
  await shot('docs', {
    page: 'docs.html#ex-select-range', height: 900,
    prepare: "const q = document.querySelector('#docsQ'); q.value = 'resurce'; q.dispatchEvent(new Event('input'))",
  });
  // 7. phone
  await shot('phone', { width: 390, height: 780, prepare: "document.querySelector('.demo-frame').scrollIntoView({ block: 'start' }); window.scrollBy(0, -70)" });
} finally {
  await b.close();
  server.kill();
}
