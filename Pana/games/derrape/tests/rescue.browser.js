// npm start, then node this file. The zamuro rescue in a real race: R asks
// for it, a car thrown off the course is carried back, a stuck car is freed,
// and none of it changes the lap count.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const output = process.env.PANA_TEST_ARTIFACTS || join(tmpdir(), 'derrape-qa');
await mkdir(output, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/derrape/?debug&manual&track=estadio`);
  await page.evaluate(() => { localStorage.removeItem('derrape:setup'); localStorage.removeItem('derrape:profile'); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);
  await page.locator('#play').click();
  await page.waitForFunction(() => race.state === 'count');

  // R: the zamuro lifts the player, shows up, and sets the car back on the road.
  const manual = await page.evaluate(() => {
    race.state = 'go'; race.count = 0;
    const p = race.player;
    for (const c of race.cars) if (c !== p) { c.done = true; c.x += 900; }
    p.coins = 5;
    for (let i = 0; i < 40; i++) updateRace(1 / 60);
    const lap = p.lap;
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'r', bubbles: true }));
    const started = p.rescueT > 0;
    for (let i = 0; i < 30; i++) updateRace(1 / 60);
    const zamuro = race.scene.getObjectByName('rescue-zamuro')?.visible === true;
    renderer.render(race.scene, race.camera);
    for (let i = 0; i < 120; i++) updateRace(1 / 60);
    const T = getActiveTrack();
    return { started, zamuro, done: p.rescueT === 0 && p.onGround, coins: p.coins, lap: p.lap === lap,
      onRoad: Math.abs(T.offsetOf(p.x, p.z)) < T.HW };
  });
  assert.ok(manual.started && manual.zamuro && manual.done && manual.onRoad && manual.lap, `manual ${JSON.stringify(manual)}`);
  assert.equal(manual.coins, 3, 'a rescue costs two coins');

  // Thrown far off the course: the zamuro comes on its own.
  const thrown = await page.evaluate(() => {
    const p = race.player, T = getActiveTrack();
    const s = T.paramOf(p.x, p.z), a = T.pointAt(s), b = T.pointAt(s + 1);
    const tx = b.x - a.x, tz = b.y - a.y, l = Math.hypot(tx, tz);
    p.x = a.x - tz / l * (T.HW + 9); p.z = a.y + tx / l * (T.HW + 9);
    p.y = T.groundAt(p.x, p.z) + 3; p.onGround = false; p.vy = 0;
    let rescued = false;
    for (let i = 0; i < 300 && !rescued; i++) { updateRace(1 / 60); rescued = p.rescueT > 0; }
    for (let i = 0; i < 140; i++) updateRace(1 / 60);
    return { rescued, onRoad: Math.abs(T.offsetOf(p.x, p.z)) < T.HW };
  });
  assert.ok(thrown.rescued && thrown.onRoad, `thrown ${JSON.stringify(thrown)}`);

  // Pinned with the gas down for three seconds: freed automatically.
  const stuck = await page.evaluate(() => {
    const p = race.player, x = p.x, z = p.z;
    race.keys = { w: true };
    let rescued = false;
    for (let i = 0; i < 260 && !rescued; i++) { updateRace(1 / 60); p.x = x; p.z = z; p.vx = p.vz = 0; rescued = p.rescueT > 0; }
    race.keys = {};
    return { rescued };
  });
  assert.ok(stuck.rescued, 'a stuck car is rescued');
  await page.screenshot({ path: join(output, 'rescue.png') });
  assert.deepEqual(errors, []);
  console.log('derrape rescue: R, off-course and stuck pickups OK');
} finally {
  await browser.close();
}
