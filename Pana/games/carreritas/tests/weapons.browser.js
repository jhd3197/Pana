import { menuClick } from './menu-helpers.js';
// npm start, then node this file. The bigger items in a real race: the cohete
// homes on the car ahead, the chancleta finds the leader, the totuma soaks a
// hit, a caja trampa explodes, the aguacero soaks everyone ahead, and a full
// coin purse powers up the next item.
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
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/carreritas/?debug&manual&track=estadio`);
  await page.waitForFunction(() => window.garage?.car);
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count');

  const result = await page.evaluate(async () => {
    const { addItem } = await import('./item-rules.js');
    const T = getActiveTrack();
    race.state = 'go'; race.count = 0;
    const [owner, victim, third, fourth] = race.cars;
    for (const c of [third, fourth]) { c.done = true; c.x += 900; }
    const place = (c, s) => {
      const a = T.pointAt(s), b = T.pointAt(s + 0.5);
      Object.assign(c, { x: a.x, z: a.y, y: T.groundAt(a.x, a.y), h: Math.atan2(b.x - a.x, b.y - a.y), lap: 1, prog: (s - T.LINE + T.TOTAL) % T.TOTAL,
        done: false, vx: 0, vz: 0, vf: 0, spin: 0, boost: 0, dizzy: 0, shield: 0, cloud: 0, phaseT: 0, impacts: [], coins: 0, inventory: [null, null], selected: 0, lost: 0 });
    };
    const reset = (gap) => { race.items.clear(); place(owner, T.LINE + 35); place(victim, T.LINE + 35 + gap); };
    const run = (seconds) => { for (let i = 0; i < seconds * 60 && race.items.projectiles.length; i++) race.items.update(1 / 60, [owner, victim], true); };
    const out = {};

    reset(70); addItem(owner, 'cohete', 0);
    race.items.use(owner, 1);
    out.rocketTarget = race.items.projectiles[0]?.target === victim;
    run(6); out.rocket = victim.dizzy > 0;

    reset(300); addItem(owner, 'chancleta', 0);
    race.items.use(owner, 1);
    run(16); out.chancleta = victim.dizzy > 0;

    reset(70); addItem(owner, 'cohete', 0); addItem(victim, 'totuma', 0);
    race.items.use(victim, 1);
    out.shieldUp = victim.shield > 0;
    race.items.use(owner, 1); run(6);
    out.shield = victim.dizzy === 0 && victim.shield === 0;

    reset(20); addItem(owner, 'trampa', 0);
    race.items.use(owner, 1);
    const trap = race.items.peels[0];
    out.trapLaid = trap?.kind === 'trampa';
    for (let i = 0; i < 70; i++) race.items.update(1 / 60, [owner, victim], true);   // past the owner's grace
    victim.x = trap.m.position.x; victim.z = trap.m.position.z; victim.y = T.groundAt(victim.x, victim.z);
    race.items.update(1 / 60, [owner, victim], true);
    out.trap = victim.dizzy > 0 && race.items.peels.length === 0;

    reset(40); addItem(owner, 'aguacero', 0); victim.inventory = [null, null]; addItem(victim, 'cohete', 0); victim.useT = 99;
    race.items.use(owner, 1);
    out.rainWarning = victim.cloud === 0 && race.items.rainQueue.some(w => w.target === victim);
    for (let i = 0; i < 60; i++) race.items.update(1 / 60, [owner, victim], true);
    out.rain = victim.cloud > 0 && !(owner.cloud > 0) && !victim.inventory.some(Boolean);   // soaked, and the held cohete slipped away

    reset(40); owner.coins = 10; addItem(owner, 'jugo', 0);
    race.items.use(owner, 1);
    out.juiced = owner.boost > 3;
    renderer.render(race.scene, race.camera);
    return out;
  });
  for (const [name, ok] of Object.entries(result)) assert.ok(ok, `${name} ${JSON.stringify(result)}`);

  // A rocket in flight and a shield bubble render without errors.
  await page.evaluate(async () => {
    const { addItem } = await import('./item-rules.js');
    const p = race.player;
    p.inventory = [null, null]; p.done = false; p.shield = 5; p.cloud = 3;
    addItem(p, 'cohete', 0);
    race.items.use(p, 1);
    for (let i = 0; i < 8; i++) updateRace(1 / 60);
    renderer.render(race.scene, race.camera);
  });
  await page.screenshot({ path: join(output, 'weapons.png') });
  assert.deepEqual(errors, []);
  console.log('carreritas weapons: cohete, chancleta, totuma, trampa, aguacero, juiced OK');
} finally {
  await browser.close();
}
