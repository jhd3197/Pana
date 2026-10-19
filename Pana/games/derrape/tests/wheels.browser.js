import { hideTaller, menuStep } from './menu-helpers.js';
// Cauchos (custom wheels): composed-tune math, garage flow with persistence,
// and real stepCar simulations for drift (palo vs calle) and mud (barro vs
// calle). npm start, then node this file. Same idiom as items.browser.js.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461';
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/derrape/?debug&manual&track=estadio`);
  await page.waitForFunction(() => window.garage?.car);

  // 1. composeTune is pure and orders the profiles as designed.
  const math = await page.evaluate(async () => {
    const { WHEEL_DEFINITIONS, wheelById, composeTune } = await import('./wheel-definitions.js');
    const base = { top: 35, accel: 21, turn: 2.3, mass: 1.15, grip: 6 };
    const t = id => composeTune(base, wheelById(id).profile);
    return {
      count: WHEEL_DEFINITIONS.length,
      slick: t('slick').grip, calle: t('calle').grip, palo: t('palo').grip,
      barroResist: t('barro').offroadResist, calleResist: t('calle').offroadResist,
      lluviaFloor: t('lluvia').wetFloor,
      baseIntact: JSON.stringify(base) === JSON.stringify({ top: 35, accel: 21, turn: 2.3, mass: 1.15, grip: 6 }),
      fallback: wheelById('no-existe').id,
    };
  });
  assert.equal(math.count, 8);
  assert.ok(math.slick > math.calle && math.calle > math.palo, 'grip order: slick > calle > palo');
  assert.ok(math.barroResist > math.calleResist, 'barro resists roughness, calle does not');
  assert.ok(math.lluviaFloor > 0.5, 'lluvia keeps a wet grip floor');
  assert.ok(math.baseIntact, 'composeTune never mutates the car tune');
  assert.equal(math.fallback, 'calle');

  // 2. Garage flow: eight cauchos, selection recomputes stats and persists.
  assert.equal(await page.locator('.wheel-choice').count(), 8);
  const calleStats = await page.evaluate(() => [...document.querySelectorAll('#stats .n')].map(n => n.textContent));
  await menuStep(page, 'car');
  await hideTaller(page);
  await page.locator('[data-car-tab="wheels"]').click();
  await page.locator('.wheel-choice').nth(3).click();   // Llantas de palo
  const picked = await page.evaluate(() => ({
    stored: localStorage.getItem('derrape:wheels'),
    name: document.getElementById('wheel-name').textContent,
    stats: [...document.querySelectorAll('#stats .n')].map(n => n.textContent),
    radius: garage.car.radius,
  }));
  assert.equal(picked.stored, 'palo');
  assert.equal(picked.name, 'Llantas de palo');
  assert.notDeepEqual(picked.stats, calleStats, 'stats bars recompute for the car + wheel combo');
  assert.equal(picked.radius, 0.66, 'the turntable car wears the wooden wheels');
  await page.reload();
  await page.waitForFunction(() => window.garage?.car && document.getElementById('wheel-name').textContent.length > 0);
  const restored = await page.evaluate(() => ({
    name: document.getElementById('wheel-name').textContent,
    pressed: document.querySelector('.wheel-choice[aria-pressed="true"] span')?.textContent,
  }));
  assert.equal(restored.name, 'Llantas de palo', 'wheel choice survives reload');
  assert.equal(restored.pressed, 'Llantas de palo');

  // 3. Drift on dry asphalt: identical input, palo keeps more lateral slip.
  const drift = await page.evaluate(async () => {
    const run = async wheelId => {
      await startRace(0, wheelId);
      race.state = 'go'; race.count = 0;
      const T = getActiveTrack(), c = race.player;
      const a = T.pointAt(T.LINE + 40), b = T.pointAt(T.LINE + 40.5);
      const h = Math.atan2(b.x - a.x, b.y - a.y);
      Object.assign(c, { x: a.x, z: a.y, y: T.groundAt(a.x, a.y), h,
        vx: Math.sin(h) * 25 - Math.cos(h) * 8, vz: Math.cos(h) * 25 + Math.sin(h) * 8,
        vf: 25, vr: 8, vy: 0, onGround: true, pitch: 0, roll: 0, pitchV: 0, rollV: 0,
        steer: 0, boost: 0, spin: 0, coins: 0, lap: 1, dizzy: 0 });
      c.prog = (T.paramOf(c.x, c.z) - T.LINE + T.TOTAL) % T.TOTAL;
      for (let i = 0; i < 12; i++) stepCar(c, { throttle: 0, steer: 0.6 }, 1 / 60);
      return Math.abs(c.vr);
    };
    const palo = await run('palo');
    const calle = await run('calle');
    return { palo, calle, wheels: race.cars.map(c => c.wheel) };
  });
  assert.ok(drift.palo > drift.calle * 1.2, `palo slides more than calle (${drift.palo.toFixed(2)} vs ${drift.calle.toFixed(2)})`);
  assert.ok(new Set(drift.wheels).size > 1, 'rivals bring their own cauchos');

  // 4. Mud in La Selva: at full roughness barro keeps speed, calle bogs down.
  const mud = await page.evaluate(async () => {
    toGarage(); buildTrack('selva');
    const { roughnessAt } = await import('./offroad.js');
    const run = async wheelId => {
      await startRace(0, wheelId);
      race.state = 'go'; race.count = 0;
      const T = getActiveTrack(), c = race.player;
      const a = T.pointAt(T.LINE + 60), b = T.pointAt(T.LINE + 60.5);
      const tx = b.x - a.x, tz = b.y - a.y, l = Math.hypot(tx, tz) || 1;
      const h = Math.atan2(tx, tz);
      const off = T.HW + T.def.offroad.fullAt;   // deep in the grass: roughness 1
      const x = a.x - tz / l * off, z = a.y + tx / l * off;
      Object.assign(c, { x, z, y: T.groundAt(x, z), h, vx: Math.sin(h) * 15, vz: Math.cos(h) * 15,
        vf: 15, vr: 0, vy: 0, onGround: true, pitch: 0, roll: 0, pitchV: 0, rollV: 0,
        steer: 0, boost: 0, spin: 0, coins: 0, lap: 1, dizzy: 0 });
      c.prog = (T.paramOf(c.x, c.z) - T.LINE + T.TOTAL) % T.TOTAL;
      const rough = roughnessAt(T, c.x, c.z);
      for (let i = 0; i < 60; i++) stepCar(c, { throttle: 1, steer: 0 }, 1 / 60);
      return { forward: c.vf, rough };
    };
    const barro = await run('barro');
    const calle = await run('calle');
    return { barro, calle };
  });
  assert.ok(mud.barro.rough > 0.9 && mud.calle.rough > 0.9, 'both mud runs sit at full roughness');
  assert.ok(mud.barro.forward > mud.calle.forward + 1,
    `barro keeps speed in mud (${mud.barro.forward.toFixed(1)} vs ${mud.calle.forward.toFixed(1)})`);

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ math, drift, mud }));
  console.log('Wheel profiles, garage flow, drift and mud checks passed.');
} finally { await browser.close(); }
