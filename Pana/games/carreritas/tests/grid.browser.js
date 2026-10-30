// The twelve-car grid on every circuit: each slot sits on the road, clear of
// its edge, on the level it was placed on, out of gaps and open water, and in
// the same terrain (car, lancha or avioneta) as pole. Then a full-grid race
// starts twelve cars with no errors.
// Run against npm start with Playwright installed in the test environment.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  await page.goto(`${origin}/g/carreritas/?debug&manual&quality=low&noghost&track=estadio`);
  await page.waitForFunction(() => window.getActiveTrack && window.garage?.car, null, { timeout: 120_000 });
  const ids = await page.evaluate(() => TRACKS.map(t => t.id));
  const requested = process.env.PANA_GRID_TRACKS?.split(',');
  const problems = [];
  for (const id of requested || ids) {
    const found = await page.evaluate(async id => {
      const { gridSlot, MAX_RACERS } = await import('./online-rules.js');
      const { gateAt, gateRuns } = await import('./transform-gates.js');
      await loadTrack(id); buildTrack(id);
      const T = getActiveTrack(), runs = gateRuns(T), out = [], spots = [];
      const terrain = c => gateAt(T, runs, c.x, c.z, c.y)?.fly ? 'air' : gateAt(T, runs, c.x, c.z, c.y) ? 'water' : 'road';
      for (let slot = 0; slot < MAX_RACERS; slot++) {
        const { lane, row } = gridSlot(slot), c = {};
        placeRacer(c, lane, row);
        const s = c.safe.s, wrap = d => Math.min(Math.abs(d), T.TOTAL - Math.abs(d));
        const edge = T.HW - Math.abs(T.offsetOf(c.x, c.z, c.y));
        if (!(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.z))) out.push(`slot ${slot}: not finite`);
        if (edge < 1.2) out.push(`slot ${slot}: ${edge.toFixed(2)} m from the road edge`);
        if (wrap(T.paramOf(c.x, c.z, c.y) - ((s % T.TOTAL) + T.TOTAL) % T.TOTAL) > 2) out.push(`slot ${slot}: lands on another stretch of road`);
        if (T.gapAt(((s % T.TOTAL) + T.TOTAL) % T.TOTAL)) out.push(`slot ${slot}: in a road gap`);
        if (T.openWater?.surfaceAt(c.x, c.z, c.y) != null) out.push(`slot ${slot}: afloat`);
        if (Math.abs(c.y - T.heightAtS(s)) > 1.5) out.push(`slot ${slot}: ${(c.y - T.heightAtS(s)).toFixed(2)} m off the road height`);
        spots.push({ slot, terrain: terrain(c), x: c.x, z: c.z });
      }
      for (const a of spots) {
        if (a.terrain !== spots[0].terrain) out.push(`slot ${a.slot}: starts as ${a.terrain}, pole as ${spots[0].terrain}`);
        for (const b of spots) if (b.slot > a.slot && Math.hypot(a.x - b.x, a.z - b.z) < 5) out.push(`slots ${a.slot} and ${b.slot} overlap`);
      }
      return out;
    }, id);
    problems.push(...found.map(p => `${id} ${p}`));
  }
  assert.deepEqual(problems, [], 'every grid slot is a clean start');

  // A full-grid race: twelve cars on the grid, bots in every empty slot.
  const race = await page.evaluate(async () => {
    toGarage(); setup.mode = 'race'; setup.split = false; setup.laps = 1;
    document.querySelector('#field-pick [data-field="12"]').click();
    buildTrack('estadio'); await startRace(0);
    for (let i = 0; i < 90; i++) updateRace(1 / 30);
    const cars = window.race.cars;
    return { count: cars.length, bots: cars.filter(c => !c.isPlayer).length, names: new Set(cars.map(c => c.name)).size,
      finite: cars.every(c => Number.isFinite(c.x) && Number.isFinite(c.z)), note: document.getElementById('launch-note').textContent, field: setup.field };
  });
  assert.equal(race.count, 12, 'twelve cars start');
  assert.equal(race.bots, 11, 'bots fill every empty slot');
  assert.equal(race.names, 12, 'every racer has their own name');
  assert.ok(race.finite, 'every car keeps a finite position');
  assert.equal(race.field, 12, 'the Parrilla choice is saved');
  assert.match(race.note, /11 rivales/);
  assert.deepEqual(errors, []);
  console.log(`grid: ${requested?.length || ids.length} circuits, twelve slots each, and a twelve-car race`);
} finally {
  await browser.close();
}
