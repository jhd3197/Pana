import { menuClick } from './menu-helpers.js';
// npm start, then node this file. Proves Galipán's flight gate off the
// mirador: a car that drives into it becomes an avioneta (car shrunk, plane
// with its pana shown, no water sheet), flies well over the road while the
// road stays the driving surface, the chase camera rises with it, and past
// the end it lands as a car again with a touchdown turbo.
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
  await page.goto(`${origin}/g/derrape/?debug&manual&auto&noghost&track=galipan`);
  await page.waitForFunction(() => window.garage?.car);
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 120000 });
  await page.waitForFunction(() => getGates()?.runs.length === 1, null, { timeout: 60000 });

  const scenery = await page.evaluate(() => {
    let water = 0; getActiveTrack().group.traverse(o => { if (o.name === 'transform-water') water++; });
    return { runs: getGates().runs.length, fly: !!getGates().runs[0].fly, water };
  });
  assert.deepEqual(scenery, { runs: 1, fly: true, water: 0 }, `Galipán has one flight gate and no water sheet ${JSON.stringify(scenery)}`);

  // The player drives itself (?auto) into the gate, then halfway along it.
  const flight = await page.evaluate(() => {
    const p = race.player, T = getActiveTrack(), run = getGates().runs[0];
    race.state = 'go'; race.count = 0;
    for (const c of race.cars) if (c !== p) { c.x += 600; c.done = true; }
    const a = T.pointAt(run.s0 - 25), b = T.pointAt(run.s0 - 24.5), h = Math.atan2(b.x - a.x, b.y - a.y);
    Object.assign(p, { x: a.x, z: a.y, y: T.groundAt(a.x, a.y), h, onGround: true, vy: 0, pitch: 0, roll: 0, phaseT: 0, rescueT: 0,
      drift: 0, driftT: 0, driftHeld: false, stall: 0, boost: 0, vf: 26, vx: Math.sin(h) * 26, vz: Math.cos(h) * 26 });
    let frames = 0;
    for (; frames < 240 && !p.plane; frames++) { updateRace(1 / 60); presentRace(1 / 60); }
    const mid = run.s0 + run.len / 2;
    for (let i = 0; i < 600 && (T.paramOf(p.x, p.z, p.y) - mid + T.TOTAL) % T.TOTAL > run.len; i++) { updateRace(1 / 60); presentRace(1 / 60); }
    const plane = p.car.plane, road = T.groundAt(p.x, p.z);
    return { plane: !!p.plane, frames, morph: p.morph, planeVisible: !!plane?.group.visible, pana: !!plane?.pana, carVisible: p.car.chassis.visible,
      lift: p.flyLift, drawnOver: p.car.root.position.y - road, carOver: p.y - road, cameraOver: race.camera.position.y - road, speed: p.vf, run: { s0: run.s0, len: run.len } };
  });
  await page.evaluate(() => renderer.render(race.scene, race.camera));
  await page.screenshot({ path: join(output, 'flight-avioneta.png') });
  assert.ok(flight.plane && flight.frames < 240, `driving off the mirador makes an avioneta ${JSON.stringify(flight)}`);
  assert.ok(flight.morph > 0.95 && flight.planeVisible && flight.pana && !flight.carVisible, `the plane with its pana takes over from the car ${JSON.stringify(flight)}`);
  assert.ok(flight.lift > 10 && flight.drawnOver > 10, `halfway along it flies well over the road ${JSON.stringify(flight)}`);
  assert.ok(flight.carOver < 3, `the road stays the driving surface ${JSON.stringify(flight)}`);
  assert.ok(flight.cameraOver > flight.drawnOver, `the chase camera rises with the plane ${JSON.stringify(flight)}`);

  // Keep flying: past the end it lands as a car with a touchdown turbo.
  const landing = await page.evaluate(() => {
    const p = race.player;
    let frames = 0, turbo = 0;
    for (; frames < 900 && p.plane; frames++) { updateRace(1 / 60); presentRace(1 / 60); turbo = Math.max(turbo, p.boost || 0); }
    for (let i = 0; i < 40; i++) { updateRace(1 / 60); presentRace(1 / 60); }
    return { plane: !!p.plane, frames, morph: p.morph, planeVisible: !!p.car.plane?.group.visible, carVisible: p.car.chassis.visible, lift: p.flyLift, turbo, speed: p.vf };
  });
  assert.ok(!landing.plane && landing.frames < 900, `the end of the gate lands the plane ${JSON.stringify(landing)}`);
  assert.ok(landing.morph < 0.05 && !landing.planeVisible && landing.carVisible && landing.lift < 0.5, `the car comes back on the road ${JSON.stringify(landing)}`);
  assert.ok(landing.turbo > 0.5, `touching down pays a turbo ${JSON.stringify(landing)}`);
  assert.deepEqual(errors, []);
  console.log('PASS derrape flight gate: avioneta off the mirador, flies over the road, camera follows, lands with a turbo.');
} finally { await browser.close(); }
