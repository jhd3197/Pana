import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.env.PANA_TEST_URL || 'http://localhost:8470';
const browser = await chromium.launch({ headless: true });
const errors = [];
const output = 'Pana/web/qa';
fs.mkdirSync(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.locator('.game').last().waitFor();
  await page.locator('#feature-art img').evaluate(img => img.decode());
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#feature-name').textContent(), 'Derrape');
  assert.equal(await page.locator('#feature-art canvas').count(), 0);
  assert.equal(await page.locator('.game-art[src]').count(), await page.locator('.game').count());
  await page.screenshot({ path: `${output}/launcher-desktop.png` });
  await page.locator('button[data-category="Mesa"]').click();
  assert.equal(await page.locator('.game:visible').count(), await page.locator('[data-id="ludo"]').count() ? 7 : 6);
  for (const game of ['criollas', 'ludo', 'qqsmp']) {
    if (!await page.locator(`[data-id="${game}"]`).count()) continue;
    const card = page.locator(`[data-id="${game}"] img`);
    assert.match(await card.getAttribute('src'), new RegExp(`${game}-card\\.jpg$`));
    await card.evaluate(img => img.decode());
    await page.locator(`[data-id="${game}"] button`).click();
    assert.match(await page.locator('#feature-art img').getAttribute('src'), new RegExp(`${game}\\.jpg$`));
    await page.locator('#feature-art img').evaluate(img => img.decode());
  }
  await page.locator('[data-id="caida"] button').click();
  assert.equal(await page.locator('#feature-name').textContent(), 'Caída');
  await page.locator('#create-room').click();
  assert.match(await page.locator('#room-link').inputValue(), /\/g\/caida\/\?room=/);
  await page.locator('#room-copy').click();
  await page.getByRole('button', { name: 'Link copiado', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.locator('#room-link').inputValue());
  await page.locator('#room-dialog [data-close-dialog]').click();
  await page.locator('button[data-category="Fiesta"]').click();
  await page.locator('[data-id="pintura"] button').click();
  assert.equal(await page.locator('#feature-name').textContent(), 'Pepazo');
  await page.locator('#open-settings').click();
  await page.locator('#pana-menu-dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#feature-art img').evaluate(img => img.decode());
  await page.screenshot({ path: `${output}/launcher-mobile.png`, fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#join-code').click();
  await page.locator('#room-code').fill('launcher-qa');
  // Verify the hosting hook can prevent every room-code launch before navigation.
  await page.evaluate(() => document.addEventListener('pana:launch', e => { e.preventDefault(); window.intent = e.detail; }, { once: true }));
  await page.locator('#code-form button').click();
  assert.equal(await page.evaluate(() => window.intent.game), 'pintura');
  assert.match(await page.evaluate(() => window.intent.url), /room=launcher-qa/);
  assert.deepEqual(errors, []);
  console.log('Launcher: artwork, categories, names, private/code rooms, settings, mobile and hosting hook passed.');
} finally { await browser.close(); }
