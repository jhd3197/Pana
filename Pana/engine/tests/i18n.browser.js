// Languages: the hub and a game in English, the Idioma setting, and two panas
// in one room who each read the room in their own language.
import assert from 'node:assert/strict';
import { launch, base, openGame, waitFor } from '../../tests/browser-kit.js';
const browser = await launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // Automated browsers keep Spanish unless the address asks.
  await page.goto(`${base}/`);
  await page.locator('#games .game').first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'es');
  assert.match(await page.locator('body').textContent(), /Tengo un código/);

  await page.goto(`${base}/?pana-language=en`);
  await page.locator('#games .game').first().waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  const hub = await page.locator('body').textContent();
  assert.match(hub, /I have a code/);
  assert.doesNotMatch(hub, /Tengo un código/);
  // Game names are never translated, even when they are also a word (Lancha).
  assert.equal(await page.locator('.game[data-id="lancha"] .game-name').textContent(), 'Lancha');
  // Descriptions come translated from /api/games?lang=en.
  const api = await page.evaluate(() => fetch('/api/games?lang=en').then(r => r.json()));
  assert.match(api.games.find(g => g.id === 'domino').description, /Saturday/);
  console.log('PASS hub follows ?pana-language and keeps game names');

  // Ajustes → Idioma: the hub reloads in the chosen language and keeps it.
  await page.goto(`${base}/ajustes.html`);
  await page.locator('.pana-settings-workspace').waitFor();
  await page.locator('.pana-settings-nav button', { hasText: 'Idioma' }).click();
  await Promise.all([page.waitForEvent('load'), page.locator('#pana-set-language [data-value="en"]').click()]);
  await page.locator('.pana-settings-workspace').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pana:settings')).language), 'en');
  assert.ok(await page.locator('.pana-settings-nav button', { hasText: 'Language' }).count());
  await page.locator('[data-settings-category="language"]').waitFor();
  // From the hub's gear too: back on the hub, Ajustes open on Idioma, now in Spanish.
  await page.goto(`${base}/`);
  await page.locator('#games .game').first().waitFor();
  assert.match(await page.locator('body').textContent(), /I have a code/, 'the saved choice applies everywhere');
  await page.locator('#open-settings').click();
  await page.locator('.pana-settings-nav button', { hasText: 'Language' }).click();
  await Promise.all([page.waitForEvent('load'), page.locator('#pana-set-language [data-value="es"]').click()]);
  await page.locator('[data-settings-category="language"]').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.lang), 'es');
  assert.ok(await page.locator('dialog[open] .pana-settings-workspace').count(), 'Ajustes stay open after the reload');
  assert.deepEqual(errors, []);
  console.log('PASS Idioma saves the language and reloads the hub');

  // One room, two languages: each pana reads the lobby in their own.
  const room = `IDIOMA${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const host = await openGame(browser, 'domino', { name: 'Ana', room });
  const guest = await openGame(browser, 'domino', { name: 'Bob', room, query: 'pana-language=en' });
  const label = p => p.locator('#pana-lobby-shell .pk-game-lobby-roster h2').textContent();
  await waitFor(host, () => /· 2 \//.test(document.querySelector('#pana-lobby-shell .pk-game-lobby-roster h2').textContent));
  await waitFor(guest, () => /· 2 \//.test(document.querySelector('#pana-lobby-shell .pk-game-lobby-roster h2').textContent));
  assert.match(await label(host), /^Panas en la sala · 2 \/ \d$/);
  assert.match(await label(guest), /^Players in the room · 2 \/ \d$/);
  assert.equal(await host.evaluate(() => document.documentElement.lang), 'es');
  // Player names are left alone in every language.
  assert.ok(await guest.locator('#pana-lobby-roster [translate="no"]', { hasText: 'Ana' }).count());
  assert.deepEqual([...host.errors, ...guest.errors], []);
  console.log('PASS one room, two languages');
} finally {
  await browser.close();
}
