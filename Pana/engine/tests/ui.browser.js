// Shared menu and settings (engine/ui.js + engine/settings.js), against npm start.
// node ui.browser.js [absolute-playwright-package] [browser-executable]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { leaveLobby, menuStep } from '../../games/carreritas/tests/menu-helpers.js';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const base = process.env.PANA_QA_URL || 'http://localhost:8461';
const check = text => console.log(`ok  ${text}`);
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));

  // The hub edits the same saved settings the games read.
  await page.goto(`${base}/`);
  await page.locator('#open-settings').click();
  await page.locator('#pana-menu-dialog[open]').waitFor();
  await page.locator('.pana-settings-nav button', { hasText: 'Audio' }).click();
  await page.locator('#pana-set-sound').click();
  await page.locator('.pana-settings-nav button', { hasText: 'Imagen' }).click();
  await page.locator('#pana-set-quality [data-value="baja"]').click();
  await page.locator('.pana-settings-nav button', { hasText: 'Ratón y teclado' }).click();
  await page.getByRole('tab', { name: 'Ayudas', exact: true }).click();
  await page.locator('#pana-set-hints').click();
  assert.deepEqual(await page.evaluate(() => {
    const s=JSON.parse(localStorage.getItem('pana:settings'));
    return Object.fromEntries(['sound','volume','music','quality','hints','orientation'].map(k=>[k,s[k]]));
  }),
    { sound: false, volume: 0.8, music: 0.5, quality: 'baja', hints: false, orientation: 'juego' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#pana-menu-dialog').evaluate(d => d.open), false);
  check('hub settings save sound, resolution and hints');

  // A game picks them up on load.
  await page.goto(`${base}/g/carreritas/?debug&manual&track=estadio`);
  await page.waitForFunction(() => window.garage?.car);
  assert.equal(await page.evaluate(() => renderer.getPixelRatio()), 1);
  assert.equal(await page.locator('.keys').isHidden(), true);
  assert.equal(await page.locator('#pana-set-sound').getAttribute('aria-checked'), 'false');
  await page.locator('#pana-set-quality [data-value="alta"]').evaluate(b => b.click());
  assert.equal(await page.evaluate(() => renderer.getPixelRatio()), 2);
  check('games apply saved settings and follow live changes');

  // Esc opens the menu with focus inside; Tab stays in the dialog; Esc returns focus.
  // The workshop is the final setup step and contains the race start action.
  await leaveLobby(page); await menuStep(page, 'car');
  await page.locator('#play').focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'pana-resume');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => !!document.activeElement.closest('#pana-menu-dialog')), true);
  await page.locator('#pana-tab-game').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#pana-tab-settings').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'play');
  check('Esc, focus containment, tab arrows and focus return');

  // Keys pressed while the menu is open never reach the game.
  await page.keyboard.press('Escape');
  await page.keyboard.down('h');
  assert.equal(await page.evaluate(() => !!race.keys.h), false);
  await page.keyboard.up('h');
  await page.locator('#pana-resume').click();
  check('game input is blocked while the menu is open');

  // Invite copies a clean room link.
  await page.goto(`${base}/g/cocina/?name=QA&debug`);
  await page.waitForFunction(() => window.cocina?.room.connected);
  await page.locator('#pana-lobby-invite').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(link, /\/g\/cocina\/\?room=/); assert.doesNotMatch(link, /debug|name=/);
  check('invite copies the room link without debug or name');

  // M toggles the shared mute everywhere.
  await page.locator('#pana-lobby-status').click();
  const before = await page.locator('#sound').getAttribute('aria-pressed');
  await page.keyboard.press('m');
  assert.notEqual(await page.locator('#sound').getAttribute('aria-pressed'), before);
  check('M toggles the saved sound setting');

  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
