import { resultClick } from './menu-helpers.js';
import { menuStep, menuClick } from './menu-helpers.js';
// npm start, then node this file. The taller: a race pays into the wallet,
// paint repaints the player's car on the turntable and in the race, horns
// and flames equip, and trophies unlock mirror mode.
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/carreritas/?debug&manual&track=estadio`);
  await page.evaluate(() => { for (const k of ['carreritas:setup', 'carreritas:trophies', 'carreritas:wallet', 'carreritas:profile']) localStorage.removeItem(k); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);
  assert.equal(await page.locator('#mirror').isDisabled(), true, 'mirror waits for a trophy');

  // Win a race: the coins picked up plus the podium bonus land in the wallet.
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count');
  const paid = await page.evaluate(() => {
    race.state = 'go'; race.count = 0;
    race.player.coinsCollected = 30;
    race.player.lap = race.laps + 1;
    for (let i = 0; i < 3 && race.state !== 'end'; i++) updateRace(1 / 60);
    return { wallet: getWallet().coins };
  });
  assert.ok(paid.wallet >= 40, `first place pays 30 picked up + 10 ${JSON.stringify(paid)}`);
  await page.locator('#collect-rewards').click();
  await page.waitForFunction(()=>document.getElementById('cash-in').dataset.sceneReady==='true');
  assert.ok(await page.locator('#cash-world').evaluate(c=>!!c.getContext('webgl2')),'the ceremony renders actual 3D pickups');
  await page.locator('#cash-done').click();
  if(await page.locator('#cash-in').isVisible())await page.locator('#cash-done').click();
  await page.locator('#collect-rewards').click();
  assert.equal(await page.evaluate(()=>getWallet().coins),paid.wallet,'replaying the receipt never pays twice');
  await page.locator('#cash-done').click();
  if(await page.locator('#cash-in').isVisible())await page.locator('#cash-done').click();
  await page.evaluate(() => { getWallet().coins = 40; }); // isolate the shopping budget from performance bonuses
  await resultClick(page, '#back');

  // Buy Azul Caribe directly from the paint slot: the wallet pays 25.
  await menuStep(page, 'car');
  await page.locator('[data-tab="pintura"]').click();
  await page.locator('#shop-paint [data-id="caribe"]').click();
  assert.equal(await page.evaluate(() => getWallet().coins), 15, 'click buys and equips the paint');
  await page.locator('#loadout-back').click();
  await page.locator('[data-tab="sonido"]').click();
  await page.locator('#shop-horn [data-id="cucaracha"]').click();
  await page.locator('#loadout-back').click();
  const shop = await page.evaluate(() => {
    const colours = new Set();
    garage.car.root.traverse(o => { if (o.material?.color) colours.add('#' + o.material.color.getHexString()); });
    return { coins: getWallet().coins, blue: colours.has('#1f6fe0'), red: colours.has('#e0262f'), horn: getWallet().horn };
  });
  await page.screenshot({ path: join(output, 'shop.png') });
  assert.equal(shop.coins, 0);
  assert.ok(shop.blue && !shop.red, `repainted ${JSON.stringify(shop)}`);
  assert.equal(shop.horn, 'cucaracha', '40 - 25 for the paint leaves exactly 15 for the horn');

  // The race car wears the paint too.
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count');
  const raced = await page.evaluate(() => {
    const colours = new Set();
    race.player.car.root.traverse(o => { if (o.material?.color) colours.add('#' + o.material.color.getHexString()); });
    return colours.has('#1f6fe0');
  });
  assert.ok(raced, 'the race car is blue');
  await page.evaluate(() => toGarage());

  // Parts: hover previews the bars without spending; buying the turbo
  // changes the race car tune and looks. An unaffordable part stays unequipped.
  await page.evaluate(() => { getWallet().coins = 100; });
  await menuStep(page, 'car');
  await page.locator('[data-tab="motor"]').click();
  await page.locator('#shop-motor [data-id="turbo"]').hover();
  assert.equal(await page.locator('#shop-stats dd i.up').count() > 0, true, 'hover shows the gain on the bars');
  assert.match(await page.locator('#shop-motor [data-id="turbo"] .pills').textContent(), /\+1 Vel/);
  await page.locator('#shop-motor [data-id="turbo"]').click();
  await page.locator('#loadout-back').click();
  await page.locator('[data-tab="aleron"]').click();
  await page.locator('#shop-aleron [data-id="rally"]').click();
  assert.match(await page.locator('#loadout-message').textContent(), /Te faltan 30 mangos/, 'turbo + rally cost 130');
  await page.locator('#loadout-back').click();
  const parts = await page.evaluate(() => ({ coins: getWallet().coins, parts: getWallet().parts.chamo }));
  assert.deepEqual(parts, { coins: 25, parts: { motor: 'turbo' } });
  await menuClick(page, '#play');
  await page.waitForFunction(() => race.state === 'count');
  const tuned = await page.evaluate(async () => {
    const { composeTune, wheelById } = await import('./wheel-definitions.js');
    const plain = composeTune(race.player.def.tune, wheelById(race.player.wheel).profile);
    return { accel: race.player.tune.accel / plain.accel, mass: race.player.tune.mass / plain.mass, parts: race.player.cosmetics.parts };
  });
  assert.ok(Math.abs(tuned.accel - 1.06) < 1e-9 && Math.abs(tuned.mass - 1.04) < 1e-9, `turbo tune ${JSON.stringify(tuned)}`);
  assert.deepEqual(tuned.parts, { motor: 'turbo' });
  await page.evaluate(() => toGarage());

  // Old saves: a bare 'carreritas:wheels' pick moves into the profile.
  await page.evaluate(() => { localStorage.removeItem('carreritas:profile'); localStorage.setItem('carreritas:wheels', 'barro'); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);
  assert.equal(await page.evaluate(() => [garage.wheel, getWallet().wheel].join()), 'barro,barro');

  // A trophy unlocks mirror mode.
  await page.evaluate(() => { localStorage.removeItem('carreritas:profile'); localStorage.setItem('carreritas:trophies', JSON.stringify({ mango: 'bronce' })); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);
  assert.equal(await page.locator('#mirror').isDisabled(), false);
  assert.equal(await page.locator('#mode-pick .mode-trophy').count(), 1, 'the cup button shows its trophy');
  assert.deepEqual(errors, []);
  console.log('carreritas taller: wallet, hover-preview and direct purchase, paint, horn, parts, wheel migration, unlocks OK');
} finally {
  await browser.close();
}
