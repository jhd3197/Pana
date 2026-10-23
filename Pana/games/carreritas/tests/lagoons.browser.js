import { menuClick } from './menu-helpers.js';
// npm start, then node this file. Proves the open-water lagoons (Margarita's
// La Restinga, the Delta's laguna): the road stops at the waterline, a
// lancha steers anywhere afloat with no walls and no zamuro, the shore and
// the boats on the water bounce it, a moving boat's wake kicks a hop, and
// river drivers cross and climb the slipway without a rescue.
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
const output = process.env.PANA_TEST_ARTIFACTS || join(tmpdir(), 'carreritas-qa');
await mkdir(output, { recursive: true });
const errors = [];
const results = {};
try {
  for (const id of ['margarita', 'delta']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', error => errors.push(`${id}: ${error}`));
    await page.goto(`${origin}/g/carreritas/?debug&manual&noghost&track=${id}`);
    await page.waitForFunction(() => window.garage?.car);
    await menuClick(page, '#play');
    await page.waitForFunction(() => race.state === 'count', null, { timeout: 120000 });

    const r = await page.evaluate(() => {
      const T = getActiveTrack(), water = T.openWater, run = water.runs[0], p = race.player, others = race.cars.filter(c => c !== p);
      race.state = 'go'; race.count = 0;
      for (const c of others) { c.x += 3000; c.done = true; }
      const step = n => { for (let i = 0; i < n; i++) { updateRace(1 / 60); presentRace(1 / 60); } };
      const frame = s => { const a = T.pointAt(s), q = T.pointAt(s + .5), l = Math.hypot(q.x - a.x, q.y - a.y); return { x: a.x, z: a.y, tx: (q.x - a.x) / l, tz: (q.y - a.y) / l }; };
      const set = (c, x, z, h, v) => Object.assign(c, { x, z, y: T.groundAt(x, z), h, onGround: true, vy: 0, pitch: 0, roll: 0, drift: 0, driftT: 0,
        stall: 0, boost: 0, spin: 0, vf: v, vr: 0, vx: Math.sin(h) * v, vz: Math.cos(h) * v, outT: 0, stuckT: 0, rescueT: 0 });
      const names = [];
      T.group.traverse(o => { if (o.name === 'transform-water' || o.name === 'coastal-road-strip') names.push(o.name); });
      const out = { len: run.len, sheets: names.filter(n => n === 'transform-water').length, gaps: T.gaps.length,
        strips: names.filter(n => n === 'coastal-road-strip').length, roadOver: water.surfaceAt(frame(run.s0 + run.len / 2).x, frame(run.s0 + run.len / 2).z) };

      // Head straight at the shore off to one side, 12 m out, hands off: it
      // stays afloat, no zamuro, and the bank stops it (head-on, like a tire
      // wall: the bounce turns into reverse and the hull brakes it).
      const m = frame(run.s0 + run.len / 2), nx = -m.tz, nz = m.tx;
      let side = 1, shore = 0;
      for (const sg of [1, -1]) { let d = 0; while (d < 200 && water.surfaceAt(m.x + nx * sg * d, m.z + nz * sg * d) != null) d += 1; if (d > 24) { side = sg; shore = d; break; } }
      set(p, m.x + nx * side * (shore - 12), m.z + nz * side * (shore - 12), Math.atan2(nx * side, nz * side), 20);
      let dryFrames = 0, outT = 0, rescued = false, reached = 0;
      for (let i = 0; i < 240; i++) {
        step(1);
        if (water.surfaceAt(p.x, p.z, p.y) == null) dryFrames++;
        outT = Math.max(outT, p.outT || 0); rescued ||= p.rescueT > 0;
        reached = Math.max(reached, (p.x - m.x) * nx * side + (p.z - m.z) * nz * side);
      }
      out.shore = { shore, reached: +reached.toFixed(1), speed: +Math.hypot(p.vx, p.vz).toFixed(1), boat: !!p.boat, dryFrames, outT, rescued, off: Math.round(Math.abs(T.offsetOf(p.x, p.z, p.y))) };

      // Ram an anchored fishing boat (the obstacles without speed).
      const anchored = T.waterObstacles.flatMap(f => f()).filter(o => !o.v);
      const fish = anchored[0];
      set(p, fish.x, fish.z - 14, 0, 18);
      let closest = 99;
      for (let i = 0; i < 90; i++) { step(1); closest = Math.min(closest, Math.hypot(p.x - fish.x, p.z - fish.z)); }
      out.ram = { boats: anchored.length, closest: +closest.toFixed(2), reach: fish.r + 1.8, back: p.vz < 0 };

      // Ride in a moving boat's wake: it throws the lancha up.
      const movers = () => T.waterObstacles.flatMap(f => f()).filter(o => o.v);
      let wakeHop = false;
      for (let k = 0; k < movers().length && !wakeHop; k++) {
        const o = movers()[k], fx = Math.sin(o.h), fz = Math.cos(o.h);
        set(p, o.x - fx * 8, o.z - fz * 8, o.h, o.v);
        p.wakeT = 0; p.boat = true;
        for (let i = 0; i < 20 && !wakeHop; i++) { step(1); wakeHop = (p.wakeT || 0) > 0; }
      }
      out.wake = { movers: movers().length, hop: wakeHop };

      // River drivers cross the lagoon and climb out without a rescue.
      p.x += 3000; p.done = true;
      others.forEach((c, k) => {
        const f = frame(run.s0 - 100 - k * 9), h = Math.atan2(f.tx, f.tz);
        c.done = false;
        set(c, f.x - f.tz * (k % 2 ? 3 : -3), f.z + f.tx * (k % 2 ? 3 : -3), h, 16);
      });
      const rescues = others.map(() => 0), boats = others.map(() => false);
      for (let i = 0; i < 60 * 30; i++) {
        step(1);
        others.forEach((c, k) => { if (c.rescueT > 0 && !c.wasRescued) rescues[k]++; c.wasRescued = c.rescueT > 0; boats[k] ||= !!c.boat; });
      }
      out.bots = others.map((c, k) => ({ past: Math.round(((T.paramOf(c.x, c.z, c.y) - run.s0) % T.TOTAL + T.TOTAL) % T.TOTAL - run.len), rescues: rescues[k], wasBoat: boats[k], boat: !!c.boat }));
      return out;
    });
    await page.evaluate(() => renderer.render(race.scene, race.camera));
    await page.screenshot({ path: join(output, `lagoon-${id}.png`) });
    results[id] = r;

    assert.ok(r.len > 150 && r.sheets === 0, `${id}: an open run with no painted water sheet ${JSON.stringify(r)}`);
    assert.equal(r.roadOver, 0, `${id}: the line through the middle is open water`);
    if (id === 'margarita') assert.ok(r.strips >= 2, `${id}: the asphalt stops at both slipways ${r.strips}`);
    else assert.ok(r.gaps >= 1, `${id}: no road drawn under the laguna ${r.gaps}`);
    assert.ok(r.shore.boat && r.shore.dryFrames === 0 && !r.shore.rescued && r.shore.outT === 0, `${id}: off the line the lancha stays afloat, no zamuro ${JSON.stringify(r.shore)}`);
    assert.ok(r.shore.reached > r.shore.shore - 4 && r.shore.reached < r.shore.shore && r.shore.speed < 2, `${id}: the shore stops it ${JSON.stringify(r.shore)}`);
    assert.ok(r.ram.boats === 2 && r.ram.closest >= r.ram.reach - 0.3 && r.ram.back, `${id}: two fishing boats, solid ${JSON.stringify(r.ram)}`);
    assert.ok(r.wake.movers >= 2 && r.wake.hop, `${id}: a moving boat's wake kicks a hop ${JSON.stringify(r.wake)}`);
    for (const b of r.bots) assert.ok(b.past > 0 && b.rescues === 0 && b.wasBoat && !b.boat, `${id}: river drivers cross as lanchas and drive on ${JSON.stringify(r.bots)}`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('carreritas lagoons: open water on Margarita and the Delta OK', JSON.stringify(results));
} finally {
  await browser.close();
}
