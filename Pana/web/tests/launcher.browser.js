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
  // Every tile shows its illustration, or its live card.js art while it has none (Trifulca).
  assert.equal(await page.locator('.game-art[src]').count() + await page.locator('canvas.game-art').count(), await page.locator('.game').count());
  await page.screenshot({ path: `${output}/launcher-desktop.png` });
  assert.equal(await page.locator('[data-row="Mesa"] .game').count(), await page.locator('[data-id="ludo"]').count() ? 7 : 6);
  assert.deepEqual(await page.locator('.game-row-title').evaluateAll(n => n.map(t => t.firstChild.textContent)), ['Carreras', 'Mesa', 'Fiesta', 'Aventura']);
  for (const game of ['criollas', 'ludo', 'qqsmp']) {
    if (!await page.locator(`[data-id="${game}"]`).count()) continue;
    const card = page.locator(`[data-id="${game}"] img`);
    assert.match(await card.getAttribute('src'), new RegExp(`${game}-card\\.jpg$`));
    await card.scrollIntoViewIfNeeded();   // rows below the strip load their art lazily
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
  for (const game of ['tambor', 'stop', 'chapita']) {
    if (!await page.locator(`[data-id="${game}"]`).count()) continue;
    const card = page.locator(`[data-id="${game}"] img`);
    assert.match(await card.getAttribute('src'), new RegExp(`${game}-card\\.jpg$`));
    await card.scrollIntoViewIfNeeded();   // rows below the strip load their art lazily
    await card.evaluate(img => img.decode());
    await page.locator(`[data-id="${game}"] button`).click();
    assert.match(await page.locator('#feature-art img').getAttribute('src'), new RegExp(`${game}\\.jpg$`));
    await page.locator('#feature-art img').evaluate(img => img.decode());
  }
  await page.locator('[data-id="pintura"] button').click();
  assert.equal(await page.locator('#feature-name').textContent(), 'Pepazo');
  // A controller: the d-pad walks the rows, the banner follows, A plays.
  await page.evaluate(() => {
    window.__pad = { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad];
    dispatchEvent(new Event('gamepadconnected'));
  });
  const press = async i => {
    for (const on of [true, false]) {
      await page.evaluate(([i, on]) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; }, [i, on]);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
  };
  await page.locator('.games-wrap').evaluate(wrap => wrap.scrollTo(0, 0));
  await page.locator('#play-featured').focus();   // the pad stays where the mouse left focus
  await press(13); await press(13);   // down to Carreras, down to Mesa
  assert.equal(await page.evaluate(() => document.activeElement.closest('[data-row]')?.dataset.row), 'Mesa');
  const padGame = await page.evaluate(() => document.activeElement.closest('.game').dataset.id);
  assert.equal(await page.evaluate(() => document.querySelector('.game-pick[aria-pressed="true"]').closest('.game').dataset.id), padGame);
  await page.evaluate(() => document.addEventListener('pana:launch', e => { e.preventDefault(); window.padIntent = e.detail; }, { once: true }));
  await press(0);
  assert.equal(await page.evaluate(() => window.padIntent.game), padGame);
  await press(9);   // the menu button (☰) opens Ajustes, B closes it
  await page.locator('#pana-menu-dialog[open]').waitFor();
  await press(1);
  await page.waitForFunction(() => !document.querySelector('#pana-menu-dialog[open]'));
  await page.evaluate(() => { navigator.getGamepads = () => []; });
  await page.locator('[data-id="pintura"] button').click();
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
