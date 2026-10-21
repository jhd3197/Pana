import { hideTaller, menuClick } from './menu-helpers.js';
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
const output = process.env.PANA_TEST_ARTIFACTS || join(tmpdir(), 'derrape-qa');
await mkdir(output, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/g/derrape/?debug&manual&track=estadio`);
  await page.evaluate(() => { for (const k of ['derrape:setup', 'derrape:trophies', 'derrape:wallet', 'derrape:profile']) localStorage.removeItem(k); });
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
    return { wallet: getWallet().coins, text: document.getElementById('result-coins').textContent };
  });
  assert.equal(paid.wallet, 40, `first place pays 30 picked up + 10 ${JSON.stringify(paid)}`);
  await page.locator('#back').click();

  // Try Azul Caribe on the turntable, then buy it: the wallet pays 25.
  await menuClick(page, '#open-shop');
  await page.locator('[data-tab="pintura"]').click();
  await page.locator('#shop-paint [data-id="caribe"]').click();
  assert.match(await page.locator('#shop-try').textContent(), /Probando\s+Azul Caribe/);
  assert.equal(await page.evaluate(() => getWallet().coins), 40, 'trying is free');
  await page.locator('#shop-buy').click();
  await page.locator('[data-tab="sonido"]').click();
  await page.locator('#shop-horn [data-id="cucaracha"]').click();
  await page.locator('#shop-buy').click();
  const shop = await page.evaluate(() => {
    const colours = new Set();
    garage.car.root.traverse(o => { if (o.material?.color) colours.add('#' + o.material.color.getHexString()); });
    return { coins: getWallet().coins, blue: colours.has('#1f6fe0'), red: colours.has('#e0262f'), horn: getWallet().horn };
  });
  await page.screenshot({ path: join(output, 'shop.png') });
  assert.equal(shop.coins, 0);
  assert.ok(shop.blue && !shop.red, `repainted ${JSON.stringify(shop)}`);
  assert.equal(shop.horn, 'cucaracha', '40 - 25 for the paint leaves exactly 15 for the horn');
  await hideTaller(page);

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

  // Parts: hovering previews the bars, a tried part costs nothing until
  // bought, and a bought turbo really changes the race car's tune and looks.
  await page.evaluate(() => { getWallet().coins = 100; });
  await menuClick(page, '#open-shop');
  await page.locator('[data-tab="motor"]').click();
  await page.locator('#shop-motor [data-id="turbo"]').hover();
  assert.equal(await page.locator('#shop-stats dd i.up').count() > 0, true, 'hover shows the gain on the bars');
  assert.match(await page.locator('#shop-motor [data-id="turbo"] .pills').textContent(), /\+1 Vel/);
  await page.locator('#shop-motor [data-id="turbo"]').click();
  await page.locator('[data-tab="aleron"]').click();
  await page.locator('#shop-aleron [data-id="rally"]').click();
  assert.match(await page.locator('#shop-buy').textContent(), /Te faltan 30 mangos/, 'turbo + rally cost 130');
  await page.locator('#shop-aleron [data-id="rally"]').click();   // take the wing off again
  await page.locator('#shop-buy').click();
  const parts = await page.evaluate(() => ({ coins: getWallet().coins, parts: getWallet().parts.chamo, trying: !document.getElementById('shop-try').hidden }));
  assert.deepEqual(parts, { coins: 25, parts: { motor: 'turbo' }, trying: false });
  await hideTaller(page);
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

  // Old saves: a bare 'derrape:wheels' pick moves into the profile.
  await page.evaluate(() => { localStorage.removeItem('derrape:profile'); localStorage.setItem('derrape:wheels', 'barro'); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);
  assert.equal(await page.evaluate(() => [garage.wheel, getWallet().wheel].join()), 'barro,barro');

  // A trophy unlocks mirror mode.
  await page.evaluate(() => { localStorage.removeItem('derrape:profile'); localStorage.setItem('derrape:trophies', JSON.stringify({ mango: 'bronce' })); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);
  assert.equal(await page.locator('#mirror').isDisabled(), false);
  assert.equal(await page.locator('#mode-pick .mode-trophy').count(), 1, 'the cup button shows its trophy');
  assert.deepEqual(errors, []);
  console.log('derrape taller: wallet, try-before-buy, paint, horn, parts, wheel migration, unlocks OK');
} finally {
  await browser.close();
}
