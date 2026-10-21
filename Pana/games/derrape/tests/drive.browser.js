import { menuClick } from './menu-helpers.js';
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
  await menuClick(page, '#play');
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
  // A jumped start floods the engine: the car still moves, only weakly.
  assert.ok(stall.stalled && stall.speed > 0 && stall.speed < 4.5, `stall ${JSON.stringify(stall)}`);

  // Drive a real bend with simple held input, then release for a turbo.
  // Never pin the car in place: that used to hide the forced-turn wall crashes.
  const drift = await page.evaluate(() => {
    const p = race.player, T = getActiveTrack(), s = 1254;
    for (const c of race.cars) if (c !== p) { c.x += 400; c.done = true; }
    const a=T.pointAt(s), b=T.pointAt(s+.5), h=Math.atan2(b.x-a.x,b.y-a.y);
    Object.assign(p,{x:a.x,z:a.y,y:T.groundAt(a.x,a.y),h,onGround:true,vy:0,pitch:0,roll:0,
      drift:0,driftT:0,driftHeld:false,driftExitT:0,stall:0,boost:0,vf:32,vx:Math.sin(h)*32,vz:Math.cos(h)*32});
    race.keys = { w: true, shift: true, d: true };
    let started = false, level = 0, maxOff = 0;
    for (let i = 0; i < 90; i++) {
      updateRace(1 / 60);
      if (p.drift) { started = true; level = Math.max(level, p.driftLvl); }
      maxOff=Math.max(maxOff,Math.abs(T.offsetOf(p.x,p.z)));
    }
    const before = p.boost;
    renderer.render(race.scene, race.camera);
    race.keys = { w: true };
    updateRace(1 / 60);
    return { started, level, before, after: p.boost, dir: p.drift, maxOff, limit:T.HW-1.6 };
  });
  await page.screenshot({ path: join(output, 'drive-drift.png') });
  assert.ok(drift.started, 'a held drift button with steering starts a drift');
  assert.ok(drift.level>=1, `real cornering earns sparks ${JSON.stringify(drift)}`);
  assert.ok(drift.maxOff<drift.limit, `drift stays off the walls ${JSON.stringify(drift)}`);
  assert.ok(drift.after > 0.4 && drift.dir === 0, `release pays the earned turbo ${JSON.stringify(drift)}`);

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
