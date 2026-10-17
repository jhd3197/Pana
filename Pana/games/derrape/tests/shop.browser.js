import { menuClick } from './menu-helpers.js';
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

  // Buy Azul Caribe: the turntable car turns blue and the wallet pays 25.
  await menuClick(page, '#open-shop');
  await page.locator('#shop-paint [data-id="caribe"]').click();
  await page.locator('#shop-horn [data-id="cucaracha"]').click();
  const shop = await page.evaluate(() => {
    const colours = new Set();
    garage.car.root.traverse(o => { if (o.material?.color) colours.add('#' + o.material.color.getHexString()); });
    return { coins: getWallet().coins, blue: colours.has('#1f6fe0'), red: colours.has('#e0262f'), horn: getWallet().horn };
  });
  await page.screenshot({ path: join(output, 'shop.png') });
  assert.equal(shop.coins, 0);
  assert.ok(shop.blue && !shop.red, `repainted ${JSON.stringify(shop)}`);
  assert.equal(shop.horn, 'cucaracha', '40 - 25 for the paint leaves exactly 15 for the horn');
  await page.locator('#shop-close').click();

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

  // A trophy unlocks mirror mode.
  await page.evaluate(() => { localStorage.removeItem('derrape:profile'); localStorage.setItem('derrape:trophies', JSON.stringify({ mango: 'bronce' })); });
  await page.reload();
  await page.waitForFunction(() => window.garage?.car);
  assert.equal(await page.locator('#mirror').isDisabled(), false);
  assert.equal(await page.locator('#mode-pick .mode-trophy').count(), 1, 'the cup button shows its trophy');
  assert.deepEqual(errors, []);
  console.log('derrape taller: wallet, paint, horn, unlocks OK');
} finally {
  await browser.close();
}
