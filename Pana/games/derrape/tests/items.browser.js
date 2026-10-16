// npm start, then node this file. Uses the same optional runtime paths as maps.browser.js.
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  // Keep the real input handlers and renderer, but step simulation explicitly.
  await page.goto(`${origin}/g/derrape/?debug&manual&track=estadio`);
  await page.waitForFunction(() => window.garage?.car);
  assert.equal(await page.locator('.car-choice').count(), 8);
  for (let i = 0; i < 8; i++) {
    await page.locator('.car-choice').nth(i).click();
    const car = await page.evaluate(() => {
      garage.spin = false; garage.turn.rotation.y = 0;
      renderer.render(garage.scene, garage.camera);
      let finite = true;
      garage.car.root.traverse(o => {
        if (o.geometry) for (const n of o.geometry.attributes.position.array) if (!Number.isFinite(n)) finite = false;
      });
      return { finite, driver: !!garage.car.driver, wheels: garage.car.wheels.length,
        parts: garage.car.detachables.length, drawCalls: renderer.info.render.calls };
    });
    assert.ok(car.finite && car.driver && car.wheels === 4 && car.parts >= 4);
    await page.screenshot({ path: join(output, `garage-${i}.png`) });
  }
  await page.locator('.car-choice').first().click();
  await page.locator('#play').click();
  await page.waitForFunction(() => race.state === 'count');

  const pickups = await page.evaluate(async () => {
    const { addItem, canBlock } = await import('./item-rules.js');
    const c = race.player, items = race.items;
    race.state = 'go'; race.count = 0;
    const visit = b => { c.x = b.x; c.y = b.y; c.z = b.z; items.update(1 / 60, [c], true); };
    const a = items.boxes[0], b = items.boxes[1], full = items.boxes[2];
    visit(a); visit(b);
    const two = c.inventory.every(Boolean), opening = c.inventory.every(i => i?.rolling > 0);
    const original = JSON.stringify(c.inventory.map(i => i.kind));
    visit(full);
    const fullIntact = full.down === 0 && full.m.visible && JSON.stringify(c.inventory.map(i => i.kind)) === original;
    const broken = !a.m.visible && items.fragments.pieces.length > 0;
    // Fragments settle against local ground and the crate returns on schedule.
    c.x += 40;
    for (let i = 0; i < 180; i++) items.update(1 / 60, [], true);
    const respawn = a.down === 0 && a.m.visible && items.fragments.pieces.length === 0;
    c.inventory = [null, null];
    for (const coin of items.coins.slice(0, 12)) visit(coin);
    const coins = c.coins, total = c.coinsCollected;
    const collected = items.coins[0];
    const before = c.coinsCollected; visit(collected);
    const onePickup = c.coinsCollected === before;
    for (let i = 0; i < 490; i++) items.update(1 / 60, [], true);
    const coinRespawn = collected.m.visible && collected.down === 0;
    // Prepared active item stays ready while its reserve is opening.
    addItem(c, 'mango', 0); addItem(c, 'jugo', 0.65);
    items.update(1 / 60, [c], true);
    const guardVisible = race.trackGroup.getObjectByName('held-mango')?.visible;
    const independent = canBlock(c) && c.inventory[1].rolling > 0;
    return { two, opening, fullIntact, broken, respawn, coins, total, onePickup, coinRespawn, guardVisible, independent };
  });
  for (const name of ['two', 'opening', 'fullIntact', 'broken', 'respawn', 'onePickup', 'coinRespawn', 'guardVisible', 'independent']) assert.ok(pickups[name], name);
  assert.equal(pickups.coins, 10); assert.equal(pickups.total, 12);

  const combat = await page.evaluate(async () => {
    const { addItem } = await import('./item-rules.js');
    const T = getActiveTrack(), [owner, victim] = race.cars;
    const place = (c, s) => {
      const a = T.pointAt(s), b = T.pointAt(s + 0.5);
      Object.assign(c, { x: a.x, z: a.y, y: T.groundAt(a.x, a.y), h: Math.atan2(b.x - a.x, b.y - a.y),
        done: false, isPlayer: true, vx: 0, vz: 0, vf: 0, spin: 0, boost: 0, inventory: [null, null], selected: 0, lost: 0 });
    };
    const reset = () => { race.items.clear(); place(owner, T.LINE + 35); place(victim, T.LINE + 48); };
    const step = () => { for (let i = 0; i < 100 && race.items.projectiles.length; i++) race.items.update(1 / 60, [owner, victim], true); };
    reset(); addItem(owner, 'mango', 0); addItem(victim, 'mango', 0); addItem(victim, 'jugo', 0);
    race.items.use(owner, 1); step();
    const shield = victim.lost === 0 && victim.inventory.filter(Boolean).length === 1 && victim.inventory[victim.selected].kind === 'jugo';
    reset(); addItem(owner, 'mango', 0); addItem(victim, 'jugo', 0); addItem(victim, 'mango', 0);
    race.items.use(owner, 1); step();
    const reserveNoShield = victim.lost > 0 && victim.inventory[1].kind === 'mango';
    reset(); place(owner, T.LINE + 52); place(victim, T.LINE + 36);
    addItem(owner, 'mango', 0);
    race.items.use(owner, -1);
    const backwards = race.items.projectiles[0].travel === -1;
    step(); const rearHit = victim.lost > 0;
    reset(); addItem(owner, 'mango3', 0);
    race.items.use(owner); const triple = owner.inventory[0].n === 2;
    // Conchas honor direction too; juice stays non-directional.
    reset(); addItem(owner, 'concha', 0); race.items.use(owner, -1);
    const peel = race.items.peels[0].m.position;
    const peelBack = (peel.x - owner.x) * Math.sin(owner.h) + (peel.z - owner.z) * Math.cos(owner.h) < -3;
    reset(); addItem(owner, 'jugo', 0); race.items.use(owner); const juice = owner.boost === 2.2;
    return { shield, reserveNoShield, backwards, rearHit, triple, peelBack, juice };
  });
  for (const [name, value] of Object.entries(combat)) assert.ok(value, name);

  await page.evaluate(async () => {
    await startRace(0); race.state = 'go'; race.count = 0;
    const { addItem } = await import('./item-rules.js');
    addItem(race.player, 'mango3', 0); addItem(race.player, 'jugo', 0);
    updateRace(1 / 60);
  });
  await page.keyboard.press('q');
  assert.equal(await page.evaluate(() => race.player.selected), 1);
  await page.keyboard.press('1');
  await page.keyboard.press('x');
  assert.equal(await page.evaluate(() => race.items.projectiles[0].travel), -1);
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => race.player.inventory[0].n), 1);
  // Holding the key is not rapid-fire.
  await page.keyboard.down(' '); await page.keyboard.down(' '); await page.keyboard.up(' ');
  assert.equal(await page.evaluate(() => race.player.inventory[race.player.selected].kind), 'jugo');
  await page.evaluate(() => updateRace(1 / 60));
  assert.equal(await page.locator('#throw-back').isDisabled(), true);
  await page.locator('#throw-front').click();
  assert.equal(await page.evaluate(() => race.player.boost), 2.2);

  // Render the actual supply row and its fragments with readable UI.
  await page.evaluate(async () => {
    const { addItem } = await import('./item-rules.js');
    await startRace(0); race.state = 'go'; race.count = 0;
    const c = race.player, T = getActiveTrack(), box = race.items.boxes[0];
    c.x = box.x; c.z = box.z; c.y = box.y; c.h = box.h;
    race.items.update(1 / 60, [c], true);
    c.inventory = [null, null]; addItem(c, 'mango3', 0); addItem(c, 'jugo', 0);
    c.coins = 7; c.coinsCollected = 7;
    updateRace(1 / 60); renderer.render(race.scene, race.camera);
  });
  await page.screenshot({ path: join(output, 'crates-inventory.png') });
  assert.match(await page.locator('#item-status').innerText(), /bloquea/);
  assert.equal(await page.locator('#coin-count').innerText(), '07');
  await page.keyboard.down('w');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(() => !!race.keys.w), false);
  await page.keyboard.up('w');
  // Esc opens the pause menu; its "Volver al garaje" cleans up the race.
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pana-menu-dialog').evaluate(d => d.open), true);
  await page.keyboard.down('w');
  assert.equal(await page.evaluate(() => !!race.keys.w), false, 'keys stay with the menu');
  await page.keyboard.up('w');
  await page.locator('#to-garage').click();
  assert.equal(await page.evaluate(() => race.state), 'off');
  const clean = await page.evaluate(() => race.items.fragments.pieces.length === 0 && race.items.projectiles.length === 0 &&
    !race.trackGroup.getObjectByName('held-mango'));
  assert.ok(clean, 'garage cleanup');
  await page.locator('#play').click();
  await page.waitForFunction(() => race.state === 'count');
  assert.equal(await page.evaluate(() => race.player.coinsCollected), 0);
  assert.deepEqual(await page.evaluate(() => race.player.inventory), [null, null]);

  // Elevated pickups use local terrain height, including coins on the island.
  const elevated = await page.evaluate(async () => {
    toGarage(); buildTrack('bululu'); await startRace(0);
    const c = race.player, coin = race.items.coins.reduce((a, b) => a.y > b.y ? a : b);
    c.x = coin.x; c.y = coin.y; c.z = coin.z;
    race.items.update(1 / 60, [c], true);
    return { high: coin.y, coins: c.coins };
  });
  assert.ok(elevated.high > 3); assert.equal(elevated.coins, 1);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => errors.push(String(error)));
  await mobile.goto(`${origin}/g/derrape/?debug&manual&track=estadio`);
  await mobile.waitForFunction(() => window.garage?.car);
  const framed = await mobile.evaluate(async () => {
    const THREE = await import('three');
    garage.car.root.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(garage.car.root);
    const points = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      points.push(new THREE.Vector3(x, y, z).project(garage.camera));
    }
    return points.every(p => Math.abs(p.x) < 1 && p.y < 1 && p.y > -1);
  });
  assert.ok(framed, 'portrait garage frames the entire car');
  await mobile.screenshot({ path: join(output, 'mobile-garage.png') });
  await mobile.locator('#play').tap();
  await mobile.waitForFunction(() => race.state === 'count');
  await mobile.evaluate(async () => {
    race.state = 'go'; race.count = 0;
    const { addItem } = await import('./item-rules.js');
    addItem(race.player, 'mango', 0); addItem(race.player, 'jugo', 0);
    updateRace(1 / 60); renderer.render(race.scene, race.camera);
  });
  await mobile.screenshot({ path: join(output, 'mobile-race.png') });
  await mobile.locator('#throw-back').tap();
  assert.equal(await mobile.evaluate(() => race.items.projectiles[0].travel), -1);
  const hud = await mobile.evaluate(() => {
    const item = document.querySelector('#item').getBoundingClientRect();
    const speed = document.querySelector('#speedo').getBoundingClientRect();
    const controls = [...document.querySelectorAll('.touch-drive button')].map(b => b.getBoundingClientRect());
    return { fits: item.x >= 0 && item.right <= speed.x && speed.right <= innerWidth && item.bottom <= innerHeight,
      touchSize: controls.every(r => r.width >= 44 && r.height >= 44),
      noOverlap: controls.every(r => r.bottom <= item.y) };
  });
  assert.ok(hud.fits && hud.touchSize && hud.noOverlap, 'mobile HUD and touch targets fit');
  await mobile.setViewportSize({ width: 320, height: 740 });
  const narrow = await mobile.evaluate(() => {
    const bounds = selector => document.querySelector(selector).getBoundingClientRect();
    const item = bounds('#item'), speed = bounds('#speedo'), position = bounds('#pos'), map = bounds('.minimap');
    return item.right <= speed.x && speed.right <= innerWidth && position.right <= map.x;
  });
  assert.ok(narrow, 'narrow phone controls and position counter do not overlap');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pickups, combat, elevated, mobile: hud, artifacts: output }));
  console.log('Garage, crates, coins, inventory, combat, keyboard, touch and restart checks passed.');
} finally { await browser.close(); }
