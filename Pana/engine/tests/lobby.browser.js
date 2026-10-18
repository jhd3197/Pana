import assert from 'node:assert/strict';
import { launch, base } from '../../tests/browser-kit.js';
import { mkdir } from 'node:fs/promises';
const browser = await launch();
const errors = [];
const output = 'Pana/engine/qa'; await mkdir(output, { recursive: true });
async function open(game, name, code, mobile = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
  await context.addInitScript(name => { localStorage.setItem('pana:name', name); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); }, name);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(game + ': ' + e.message));
  await page.goto(`${base}/g/${game}/?room=${code}&debug`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PANA_PREPARED === true && document.querySelector('#pana-lobby-ready')?.disabled === false, null, { timeout: 120000 });
  return page;
}
try {
  const code = 'lobby-' + Date.now();
  const host = await open('curiara', 'Ana', code), guest = await open('curiara', 'Bruno', code);
  await host.waitForFunction(() => document.querySelectorAll('.pk-game-lobby-player').length === 2);
  await guest.setViewportSize({ width: 390, height: 844 });
  assert.equal(await guest.locator('#lobby-invite').isVisible(), false, 'one invite action stays in the header');
  const guestFooterFits = await guest.locator('.pk-game-lobby-foot').evaluate(footer => {
    const controls = [...footer.querySelectorAll('button,a')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    const bounds = controls.map(el => el.getBoundingClientRect());
    return controls.every((el, i) => el.scrollWidth <= el.clientWidth + 1 && bounds[i].left >= 0 && bounds[i].right <= innerWidth + 1 && bounds[i].bottom <= innerHeight + 1)
      && bounds.every((a, i) => bounds.slice(i + 1).every(b => a.right <= b.left + 1 || b.right <= a.left + 1 || a.bottom <= b.top + 1 || b.bottom <= a.top + 1));
  });
  assert.equal(guestFooterFits, true, 'mobile guest ready labels fit without overlapping footer controls');
  await guest.screenshot({ path: `${output}/curiara-guest-mobile.png` });
  await guest.setViewportSize({ width: 1440, height: 1000 });
  await guest.locator('#pana-lobby-ready').click();
  await host.waitForFunction(() => [...document.querySelectorAll('.pk-game-lobby-state')].some(n => n.textContent === 'Esperando'));
  await host.locator('#start').click();
  assert.equal(await host.locator('#pana-lobby-shell').isVisible(), true);
  assert.equal(await host.evaluate(() => curiara.state.phase), 'lobby');
  await host.locator('#start').press('Enter');
  assert.equal(await host.evaluate(() => curiara.state.phase), 'lobby', 'keyboard start obeys the same ready barrier');
  await guest.locator('#pana-lobby-ready').click();
  await host.waitForFunction(() => [...document.querySelectorAll('.pk-game-lobby-state')].every(n => n.textContent === 'Listo'));
  await host.screenshot({ path: `${output}/curiara-illustrated-lobby.png` });
  await host.locator('[data-room-option="crew"][data-value="duos"]').click();
  await guest.locator('#seats:not([hidden])').waitFor();
  assert.equal(await guest.locator('#seats [data-roster-group]').count(), 2);
  await guest.locator('#seats [data-roster-move="3"]').click();
  await host.waitForFunction(() => document.querySelector('#seats').textContent.includes('Bruno'));
  await host.screenshot({ path: `${output}/curiara-teams.png` });
  await host.locator('[data-room-option="crew"][data-value="todos"]').click();
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
  assert.equal(await mobile.locator('#start').evaluate(button => { const r = button.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), true, 'mobile start stays in the shared footer');
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
