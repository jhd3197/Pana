import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base = process.env.PANA_TEST_URL || 'http://localhost:8488';
const browser = await chromium.launch({ headless: true });
const errors = [];
const output = 'Pana/engine/qa'; await mkdir(output, { recursive: true });
async function open(game, name, code, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  await context.addInitScript(name => { localStorage.setItem('pana:name', name); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); }, name);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(game + ': ' + e.message));
  await page.goto(`${base}/g/${game}/?room=${code}&debug`, { waitUntil: 'domcontentloaded' });
  await page.locator('#pana-lobby-ready:not([disabled])').waitFor({ timeout: 120000 });
  return page;
}
try {
  const code = 'lobby-' + Date.now();
  const host = await open('curiara', 'Ana', code), guest = await open('curiara', 'Bruno', code);
  await host.waitForFunction(() => document.querySelectorAll('.pk-game-lobby-player').length === 2);
  await guest.locator('#pana-lobby-ready').click();
  await host.waitForFunction(() => [...document.querySelectorAll('.pk-game-lobby-state')].some(n => n.textContent === 'Esperando'));
  await host.locator('#start').click();
  assert.equal(await host.locator('#pana-lobby-shell').isVisible(), true);
  await guest.locator('#pana-lobby-ready').click();
  await host.waitForFunction(() => [...document.querySelectorAll('.pk-game-lobby-state')].every(n => n.textContent === 'Listo'));
  await host.screenshot({ path: `${output}/curiara-illustrated-lobby.png` });
  await host.locator('[data-format="parejas"]').click();
  await guest.locator('#seats:not(.hidden)').waitFor();
  await guest.getByRole('button', { name: 'Curiara 2, popa', exact: true }).click();
  await host.waitForFunction(() => document.querySelector('#seats').textContent.includes('Bruno'));
  await host.screenshot({ path: `${output}/curiara-teams.png` });
  await host.locator('[data-format="todos"]').click();
  await host.locator('#start').click();
  await guest.locator('#pana-lobby-shell').waitFor({ state: 'hidden', timeout: 30000 });
  assert.equal(await guest.evaluate(() => ['countdown', 'racing'].includes(window.curiara.state.phase)), true);
  await host.context().close(); await guest.context().close();
  console.log('PASS two-client Curiara: actual loaded state, readiness hold, host start, both enter game.');
  const games = process.env.PANA_LOBBY_GAMES?.split(',').filter(Boolean) || ['billar', 'bululu', 'caida', 'cocina', 'criollas', 'domino', 'embuste', 'escondidas', 'galope', 'ludo', 'pintura', 'poquer', 'reliquia'];
  for (const game of games) {
    const page = await open(game, 'Pana', 'qa-' + game + '-' + Date.now());
    assert.equal(await page.locator('#pana-lobby-shell').isVisible(), true, game);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, game);
    console.log('PASS prepared lobby: ' + game);
    await page.context().close();
  }
  const mobile = await open('curiara', 'Pana móvil', 'mobile-' + Date.now(), true);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await mobile.screenshot({ path: `${output}/curiara-illustrated-mobile.png`, fullPage: true });
  await mobile.context().close();
  // A failed module never becomes "ready" and has an actionable retry.
  const failed = await browser.newPage();
  await failed.route('**/g/pintura/game.js', route => route.abort());
  await failed.goto(`${base}/g/pintura/`);
  await failed.getByRole('button', { name: 'Volver a intentar', exact: true }).waitFor();
  assert.equal(await failed.locator('#pana-lobby-ready').isDisabled(), true);
  await failed.close();
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
