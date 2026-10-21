// Quick visual check: open a game on a fresh server, let its real frame loop
// run, and save a burst of screenshots plus a state line per shot. Seconds
// instead of a full browser suite, for "does it look right?" questions.
//
//   npm run shots -- <game> [options]
//   npm run shots -- derrape --track chuao --at gate-60 --shots 8 --every 250
//   npm run shots -- derrape --track tovar,sabana --lap 0.1,0.4,0.7
//   npm run shots -- derrape --track sabana --menu --view .9:.6:.8
//
// Options (all games):
//   --query a=b&c    extra URL query (debug is always on)
//   --shots N        screenshots to take (default 6)
//   --every MS       milliseconds between shots (default 300)
//   --wait MS        wait after the game is ready, before the first shot
//   --size WxH       viewport (default 960x600)
//   --eval JS        run this in the page once it is ready (after --at)
//   --keys a,b       hold these keys (KeyboardEvent.key names) while shooting
//   --out DIR        where the pictures go (default: a new temp folder)
//   PANA_TEST_URL    reuse a running server instead of starting one
// Derrape:
//   --track ID       circuit (default estadio); the race starts on autopilot,
//                    unless --keys drives it (then the keys are the input)
//   --at WHERE       drop the player there first: a route fraction (0.9),
//                    "gate" (first transform gate) or "gate-80" (80 m before)
//   --lap F1,F2      driver view at these lap fractions instead of a burst:
//                    racer on the grid line there, chase camera reset, one
//                    <track>-<fraction>.jpg each; --track may list several
//                    circuits (a,b,c). Default size 1280x720.
//   --menu           render the menu picture from the real scene, racers
//                    hidden: <track>.webp (1200x800) and <track>-thumb.webp
//                    (480x320) written straight into
//                    games/derrape/public/images/menu with their sources.json
//                    entries, unless --out points elsewhere
//   --view Y:P:D     menu orbit: yaw and pitch in radians around the map
//                    centre (default .6:.75); D scales the radius (default 1)
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
const menu = argv.includes('--menu'), lap = opt('lap', null);
if ((menu || lap) && game !== 'derrape') { console.error('--menu and --lap are Derrape options'); process.exit(1); }
const menuDir = path.resolve(import.meta.dirname, '../games/derrape/public/images/menu');
const [width, height] = opt('size', lap ? '1280x720' : '960x600').split('x').map(Number);
const out = path.resolve(opt('out', menu && !lap ? menuDir : fs.mkdtempSync(path.join(os.tmpdir(), `pana-shots-${game}-`))));
fs.mkdirSync(out, { recursive: true });

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const { base, log, stop } = await startServer();
const browser = await chromium.launch({ headless: true, args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const errors = [];
try {
  if (menu || lap) await stills();
  else await burst();
} finally {
  await browser.close();
  stop();
}
if (errors.length) { console.error(`Page errors:\n${errors.join('\n')}${log ? `\nServer log: ${log}` : ''}`); process.exit(1); }

async function burst() {
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
        heat: +(p.tireHeat || 0).toFixed(2), hits: p.hits || 0, smashed: race.props?.props?.filter(q => q.down > 0).length ?? 0, boost: +(p.boost || 0).toFixed(2), boat: !!p.boat, morph: +(p.morph || 0).toFixed(2), air: !p.onGround };
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
}

// Derrape stills drive the debug globals directly: no menus, no race clock.
async function stills() {
  const page = await browser.newPage({ viewport: menu && !lap ? { width: 1200, height: 800 } : { width, height } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    localStorage.setItem('pana:name', 'Shots');
    localStorage.setItem('pana:settings', JSON.stringify({ sound: false, music: false, quality: 'alta' }));
  });
  await page.goto(`${base}/g/derrape/?debug&auto&track=estadio`);
  await page.waitForFunction(() => window.getActiveTrack && garage.car, null, { timeout: 180000 });
  for (const id of opt('track', 'estadio').split(',')) {
    if (lap) for (const f of lap.split(',').map(Number)) {
      const url = await page.evaluate(async ([id, f]) => {
        if (getActiveTrack()?.id !== id || !race.trackReady) { toGarage(); buildTrack(id); await startRace(0); }
        const T = getActiveTrack(), p = race.player;
        // placeRacer puts grid row n at LINE - 9 - 8n: solve for the wanted distance.
        const s = ((f * T.TOTAL) % T.TOTAL + T.TOTAL) % T.TOTAL;
        placeRacer(p, 0, (T.LINE - 9 - s) / 8);
        race.state = 'go'; race.camPos = null;
        for (let i = 0; i < 30; i++) updateRace(1 / 60, true);
        renderer.render(race.scene, race.camera);
        return renderer.domElement.toDataURL('image/jpeg', .85);
      }, [id, f]);
      const file = path.join(out, `${id}-${f}.jpg`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(file);
    }
    if (menu) await menuPicture(page, id);
  }
}

// The menu wants <id>.webp (1200x800) and <id>-thumb.webp (480x320); the
// page's own canvas encodes the WebP, so no image tool is needed.
async function menuPicture(page, id) {
  const [yaw = .6, pitch = .75, dist = 1] = opt('view', '').split(':').filter(Boolean).map(Number);
  const [full, thumb] = await page.evaluate(async ([id, yaw, pitch, dist]) => {
    toGarage(); buildTrack(id); await startRace(0);
    const T = getActiveTrack(), cam = race.camera, sun = race.sun;
    for (let i = 0; i < 20; i++) updateRace(1 / 60, false);
    for (const c of race.cars) if (c.root) c.root.visible = false;
    const r = Math.max(T.bounds.x, T.bounds.z) * 1.35 * dist;
    cam.position.set(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r, Math.cos(yaw) * Math.cos(pitch) * r);
    cam.lookAt(0, 0, 0); cam.far = 6000; cam.aspect = 1.5; cam.updateProjectionMatrix();
    // One shadow frustum over the whole map, not the racer's local box.
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, far: r * 4 });
    sun.target.position.set(0, 0, 0); sun.position.set(-r * .6, r * 1.2, r * .5);
    sun.shadow.camera.updateProjectionMatrix();
    renderer.setPixelRatio(1); renderer.setSize(1200, 800);
    for (const o of T.animated) o.userData.tick(30, 1 / 60);
    race.sky.update(30, T.def.palette?.daylight ?? 1);
    renderer.render(race.scene, cam);
    const small = document.createElement('canvas'); small.width = 480; small.height = 320;
    const ctx = small.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(renderer.domElement, 0, 0, 480, 320);
    return [renderer.domElement.toDataURL('image/webp', .8), small.toDataURL('image/webp', .8)];
  }, [id, yaw, pitch, dist]);
  const written = [];
  for (const [file, url, w] of [[`${id}.webp`, full, 1200], [`${id}-thumb.webp`, thumb, 480]]) {
    if (!url.startsWith('data:image/webp')) throw new Error('this browser cannot encode WebP');
    const bytes = Buffer.from(url.split(',')[1], 'base64');
    fs.writeFileSync(path.join(out, file), bytes);
    written.push({ file, source: `Native render: ${id} circuit`, width: w, bytes: bytes.length });
    console.log(path.join(out, file), `${Math.round(bytes.length / 1024)} KB`);
  }
  if (out !== menuDir) return;
  const sources = path.join(menuDir, 'sources.json'), text = fs.readFileSync(sources, 'utf8'), list = JSON.parse(text);
  for (const entry of written) {
    const i = list.images.findIndex(e => e.file === entry.file);
    if (i >= 0) list.images[i] = entry; else list.images.push(entry);
  }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(sources, `${JSON.stringify(list, null, 2)}\n`.replace(/\n/g, eol));
  console.log(`updated ${sources}`);
}
