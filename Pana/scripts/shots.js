// Quick visual check: open a game on a fresh server, let its real frame loop
// run, and save a burst of screenshots plus a state line per shot. Seconds
// instead of a full browser suite, for "does it look right?" questions.
//
//   npm run shots -- <game> [options]
//   npm run shots -- derrape --track chuao --at gate-60 --shots 8 --every 250
//
// Options (all games):
//   --query a=b&c    extra URL query (debug is always on)
//   --shots N        screenshots to take (default 6)
//   --every MS       milliseconds between shots (default 300)
//   --wait MS        wait after the game is ready, before the first shot
//   --size WxH       viewport (default 960x600)
//   --eval JS        run this in the page once it is ready (after --at)
//   --keys a,b       hold these keys (KeyboardEvent.key names) while shooting
//   --out DIR        where the PNGs go (default: a new temp folder)
//   PANA_TEST_URL    reuse a running server instead of starting one
// Derrape:
//   --track ID       circuit (default estadio); the race starts on autopilot,
//                    unless --keys drives it (then the keys are the input)
//   --at WHERE       drop the player there first: a route fraction (0.9),
//                    "gate" (first transform gate) or "gate-80" (80 m before)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer } from './pana-server.js';

const argv = process.argv.slice(2);
if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
  console.log(fs.readFileSync(import.meta.filename, 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(argv.length ? 0 : 1);
}
const game = argv[0];
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i > 0 && argv[i + 1] != null ? argv[i + 1] : fallback; };
const shots = Number(opt('shots', 6)), every = Number(opt('every', 300)), wait = Number(opt('wait', 0));
const [width, height] = opt('size', '960x600').split('x').map(Number);
const out = path.resolve(opt('out', fs.mkdtempSync(path.join(os.tmpdir(), `pana-shots-${game}-`))));
fs.mkdirSync(out, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const { base, log, stop } = await startServer();
const browser = await chromium.launch({ headless: true, args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', e => errors.push(String(e)));
  const derrape = game === 'derrape';
  const keys = opt('keys', '').split(',').filter(Boolean);
  const query = ['debug', derrape && !keys.length && 'auto', derrape && `track=${opt('track', 'estadio')}`, opt('query', '')].filter(Boolean).join('&');
  await page.goto(`${base}/g/${game}/?${query}`);
  await page.waitForFunction(() => window.PANA_PREPARED === true, null, { timeout: 180000 });
  let state = () => null;
  if (derrape) {
    const { menuClick } = await import('../games/derrape/tests/menu-helpers.js');
    await menuClick(page, '#play');
    await page.waitForFunction(() => race.state === 'go', null, { timeout: 180000 });
    const at = opt('at', null);
    if (at) await page.evaluate(at => {
      const p = race.player, T = getActiveTrack(), gate = getGates?.()?.runs[0];
      const m = /^gate(-?\d+)?$/.exec(at);
      if (m && !gate) throw new Error(`${T.id} has no transform gate`);
      const s = m ? gate.s0 + Number(m[1] || 0) : Number(at) * T.TOTAL;
      const a = T.pointAt(s), b = T.pointAt(s + 0.5), h = Math.atan2(b.x - a.x, b.y - a.y), v = Math.max(20, Math.abs(p.vf));
      Object.assign(p, { x: a.x, z: a.y, y: T.groundAt(a.x, a.y), h, onGround: true, vy: 0, vf: v, vx: Math.sin(h) * v, vz: Math.cos(h) * v });
    }, at);
    state = () => page.evaluate(() => {
      const p = race.player, T = getActiveTrack();
      return { clock: +race.clock.toFixed(2), s: Math.round(T.paramOf(p.x, p.z, p.y)), u: +(T.paramOf(p.x, p.z, p.y) / T.TOTAL).toFixed(3),
        kmh: Math.round(p.vf * 4), drift: p.drift, level: p.driftLvl || 0, charge: +(p.driftT || 0).toFixed(2),
        heat: +(p.tireHeat || 0).toFixed(2), boost: +(p.boost || 0).toFixed(2), boat: !!p.boat, morph: +(p.morph || 0).toFixed(2), air: !p.onGround };
    });
  }
  const code = opt('eval', null);
  if (code) console.log('eval →', JSON.stringify(await page.evaluate(code)));
  for (const key of keys) await page.keyboard.down(key === 'shift' ? 'Shift' : key);
  if (wait) await page.waitForTimeout(wait);
  for (let i = 0; i < shots; i++) {
    const file = path.join(out, `${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    console.log(file, JSON.stringify(await state()));
    if (i < shots - 1) await page.waitForTimeout(every);
  }
} finally {
  await browser.close();
  stop();
}
if (errors.length) { console.error(`Page errors:\n${errors.join('\n')}${log ? `\nServer log: ${log}` : ''}`); process.exit(1); }
