// npm start, then node this file. Proves the driving skills in a real race:
// rocket start, stall, drift charge and release, ramp trick.
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
  await page.waitForFunction(() => window.garage?.car);
  await page.locator('#play').click();
  await page.waitForFunction(() => race.state === 'count');

  // Gas held from the second half of "1": rocket start.
  const rocket = await page.evaluate(() => {
    race.count = 1.5; race.keys = { w: true };
    for (let i = 0; i < 60 && race.state === 'count'; i++) updateRace(1 / 60);
    return { state: race.state, boost: race.player.boost, stall: race.player.stall };
  });
  assert.equal(rocket.state, 'go');
  assert.ok(rocket.boost > 0.5 && rocket.stall === 0, `rocket start ${JSON.stringify(rocket)}`);

  // Gas mashed on "3": the engine floods and the car cannot accelerate.
  const stall = await page.evaluate(() => {
    const p = race.player;
    race.state = 'count'; race.count = 3.5; race.throttleAt = null; p.boost = 0;
    race.keys = { w: true };
    for (let i = 0; i < 200 && race.state === 'count'; i++) updateRace(1 / 60);
    const stalled = p.stall > 0;
    p.vx = p.vz = 0;
    for (let i = 0; i < 20; i++) updateRace(1 / 60);
    return { stalled, speed: Math.abs(p.vf) };
  });
  assert.ok(stall.stalled && stall.speed < 1, `stall ${JSON.stringify(stall)}`);

  // Hop into a drift, hold it through three spark levels, release for a turbo.
  const drift = await page.evaluate(() => {
    const p = race.player;
    for (const c of race.cars) if (c !== p) { c.x += 400; c.done = true; }
    p.stall = 0; p.boost = 0; p.vf = 26;
    p.vx = Math.sin(p.h) * 26; p.vz = Math.cos(p.h) * 26;
    race.keys = { w: true, shift: true, a: true };
    let started = false, level = 0;
    const x0 = p.x, z0 = p.z;
    for (let i = 0; i < 200; i++) {
      updateRace(1 / 60);
      if (p.drift) { started = true; level = Math.max(level, p.driftLvl); }
      // pin the car mid-road so the test measures the drift, not the walls
      if (p.drift) { p.x = x0; p.z = z0; }
    }
    const before = p.boost;
    renderer.render(race.scene, race.camera);
    race.keys = { w: true };
    updateRace(1 / 60);
    return { started, level, before, after: p.boost, dir: p.drift };
  });
  await page.screenshot({ path: join(output, 'drive-drift.png') });
  assert.ok(drift.started, 'a held drift button with steering starts a drift');
  assert.equal(drift.level, 3, `drift reaches purple sparks ${JSON.stringify(drift)}`);
  assert.ok(drift.after > 1.2 && drift.dir === 0, `release pays the purple turbo ${JSON.stringify(drift)}`);

  // A trick pressed in the air lands with a short turbo.
  const trick = await page.evaluate(() => {
    const p = race.player;
    race.keys = {};
    updateRace(1 / 60);
    p.boost = 0; p.onGround = false; p.y += 5; p.vy = 7; p.airTime = 0.1; p.hopping = false;
    p.pitch = p.roll = p.pitchV = p.rollV = 0; p.vx = p.vz = p.vf = 0;
    race.keys = { shift: true };
    updateRace(1 / 60);
    const tricked = p.trick;
    race.keys = {};
    for (let i = 0; i < 120 && !p.onGround; i++) updateRace(1 / 60);
    return { tricked, landed: p.onGround, boost: p.boost };
  });
  assert.ok(trick.tricked && trick.landed && trick.boost > 0.3, `trick ${JSON.stringify(trick)}`);
  assert.deepEqual(errors, []);
  console.log('derrape drive: rocket start, stall, drift levels and tricks OK');
} finally {
  await browser.close();
}
