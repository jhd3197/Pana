import { menuClick } from './menu-helpers.js';
// npm start, then node this file. Proves the Choroní river stretch: a car
// that drives through the entry gate becomes a lancha (hull unfolded, wheels
// tucked, splash slow-mo, metamorfosis stat), drifting on the water charges
// faster, and the exit gate turns it back into a car without losing speed.
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
  await page.goto(`${origin}/g/derrape/?debug&manual&auto&noghost&track=choroni`);
  await page.waitForFunction(() => window.garage?.car);
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count', null, { timeout: 120000 });

  const scenery = await page.evaluate(() => {
    const T = getActiveTrack(), names = [];
    T.group.traverse(o => { if (o.name === 'transform-water' || o.name === 'transform-gate') names.push(o.name); });
    return { runs: getGates().runs.length, water: names.filter(n => n === 'transform-water').length, markers: names.filter(n => n === 'transform-gate').length };
  });
  assert.deepEqual(scenery, { runs: 1, water: 1, markers: 0 }, `Choroní has one river stretch, the water its only cue ${JSON.stringify(scenery)}`);

  // The player drives itself (?auto) at speed through the entry gate.
  const entry = await page.evaluate(() => {
    const p = race.player, T = getActiveTrack(), run = getGates().runs[0];
    race.state = 'go'; race.count = 0;
    for (const c of race.cars) if (c !== p) { c.x += 600; c.done = true; }
    const place = s => {
      const a = T.pointAt(s), b = T.pointAt(s + .5), h = Math.atan2(b.x - a.x, b.y - a.y);
      Object.assign(p, { x: a.x, z: a.y, y: T.groundAt(a.x, a.y), h, onGround: true, vy: 0, pitch: 0, roll: 0,
        drift: 0, driftT: 0, driftHeld: false, stall: 0, boost: 0, vf: 26, vx: Math.sin(h) * 26, vz: Math.cos(h) * 26 });
    };
    place(run.s0 - 25);
    const metamorfosis = () => JSON.parse(localStorage.getItem('pana:stats') || '{}')?.counters?.['derrape.metamorfosis'] ?? null;
    const before = metamorfosis();
    let frames = 0;
    for (; frames < 240 && !p.boat; frames++) { updateRace(1 / 60); presentRace(1 / 60); }
    for (let i = 0; i < 40; i++) { updateRace(1 / 60); presentRace(1 / 60); }
    const lancha = p.car.lancha;
    return { boat: !!p.boat, frames, morph: p.morph, lanchaVisible: !!lancha?.group.visible, lanchaScale: lancha?.group.scale.z ?? 0,
      pana: !!lancha?.pana, carVisible: p.car.chassis.visible, wheel: p.car.wheels[0].steer.scale.x, speed: p.vf, statsBefore: before, statsAfter: metamorfosis() };
  });
  await page.evaluate(() => renderer.render(race.scene, race.camera));
  await page.screenshot({ path: join(output, 'transform-lancha.png') });
  assert.ok(entry.boat, `driving through the entry gate makes a lancha ${JSON.stringify(entry)}`);
  assert.ok(entry.morph > 0.95 && entry.lanchaVisible && entry.lanchaScale > 1 && entry.pana, `the Lancha peñero with its pana takes over ${JSON.stringify(entry)}`);
  assert.ok(!entry.carVisible && entry.wheel < 0.05, `the car shrinks away ${JSON.stringify(entry)}`);
  assert.ok(entry.speed > 18, `momentum survives the splash ${JSON.stringify(entry)}`);
  assert.equal(entry.statsAfter, (entry.statsBefore ?? 0) + 1, `the splash counts one metamorfosis ${JSON.stringify(entry)}`);

  // On the water a drift charges faster than the same drift on asphalt.
  const wake = await page.evaluate(() => {
    const p = race.player, gates = getGates();
    const charge = boat => { const c = { boat, drift: 1, driftT: 0, x: 1e4, z: 1e4, y: 0 }; for (let i = 0; i < 60; i++) gates.step(c, 1 / 60); return c.driftT; };
    return { water: charge(true), road: charge(false), boat: p.boat };
  });
  assert.ok(wake.water > wake.road, `a drift on the water charges the wake turbo ${JSON.stringify(wake)}`);

  // Keep driving: past the exit arch the lancha turns back into a car.
  const exit = await page.evaluate(() => {
    const p = race.player;
    let frames = 0;
    for (; frames < 900 && p.boat; frames++) { updateRace(1 / 60); presentRace(1 / 60); }
    for (let i = 0; i < 40; i++) { updateRace(1 / 60); presentRace(1 / 60); }
    return { boat: !!p.boat, frames, morph: p.morph, lanchaVisible: !!p.car.lancha?.group.visible, carVisible: p.car.chassis.visible, wheel: p.car.wheels[0].steer.scale.x, speed: p.vf };
  });
  assert.ok(!exit.boat && exit.frames < 900, `the exit gate makes a car again ${JSON.stringify(exit)}`);
  assert.ok(exit.morph < 0.05 && !exit.lanchaVisible && exit.carVisible && exit.wheel > 0.95, `the lancha goes and the car comes back ${JSON.stringify(exit)}`);
  assert.ok(exit.speed > 15, `the car leaves the water at speed ${JSON.stringify(exit)}`);

  // Chuao's quebrada is already water: its gate follows the wet stretch with
  // no second water sheet.
  await page.evaluate(() => { toGarage(); buildTrack('chuao'); });
  const chuao = await page.evaluate(() => {
    const T = getActiveTrack(), names = [];
    T.group.traverse(o => { if (o.name === 'transform-water' || o.name === 'transform-gate') names.push(o.name); });
    const run = getGates().runs[0];
    return { runs: getGates().runs.length, len: run.len, sheets: names.filter(n => n === 'transform-water').length };
  });
  assert.ok(chuao.runs === 1 && chuao.len > 100 && chuao.sheets === 0, `Chuao's quebrada is a lancha stretch ${JSON.stringify(chuao)}`);

  // Margarita floods La Restinga's causeway; Delta's causeways ford two caños.
  // Each stretch draws its own water sheet.
  for (const [id, runs, minLen] of [['margarita', 1, 300], ['delta', 2, 80]]) {
    await page.evaluate(id => { toGarage(); buildTrack(id); }, id);
    const armed = await page.evaluate(() => {
      const T = getActiveTrack(), names = [];
      T.group.traverse(o => { if (o.name === 'transform-water') names.push(o.name); });
      return { runs: getGates().runs.length, len: Math.min(...getGates().runs.map(r => r.len)), sheets: names.length };
    });
    assert.ok(armed.runs === runs && armed.len > minLen && armed.sheets === runs, `${id} has its lancha stretches ${JSON.stringify(armed)}`);
  }
  assert.deepEqual(errors, []);
  console.log('derrape transform gates: car → lancha → car on Choroní; Chuao, Margarita and Delta armed OK', JSON.stringify({ entry, exit }));
} finally {
  await browser.close();
}
