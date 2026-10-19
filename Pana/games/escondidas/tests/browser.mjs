// Optional browser QA, against a running Pana server. No app dependency added.
// node browser.mjs [path-to-playwright-package] [path-to-browser-executable]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = process.env.PANA_QA_URL || 'http://localhost:8461';
const output = process.env.PANA_QA_OUTPUT;
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const errors = [];
const room = `qa-${Date.now().toString(36)}`;
const check = text => console.log(`ok  ${text}`);
async function newPage(name, mobile = false, code = room) {
  const context = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja' })));
  const page = await context.newPage(); page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
  await page.goto(`${base}/g/escondidas/?room=${code}&name=${name}&debug`);
  await page.waitForFunction(() => window.hunt?.room.connected && window.PANA_PREPARED === true, undefined, { timeout: 120000 });
  return page;
}
try {
  const a = await newPage('Juan'), b = await newPage('Ana');
  await a.waitForFunction(() => hunt.room.members.size === 2);
  await b.waitForFunction(() => hunt.room.members.size === 2);
  check('two real clients join one room');
  if (output) await a.screenshot({ path: path.join(output, 'pana-hunt-lobby.png') });
  // The role picker lives in the shared room menu's "more" panel.
  await a.locator('#pana-room-more').click(); await a.getByRole('button', { name: 'Ser buscador', exact: true }).click(); await a.locator('#pana-room-done').click();
  await a.locator('#start').click(); await b.waitForFunction(() => hunt.state.phase === 'hide');
  assert.equal(await a.evaluate(() => hunt.state.seeker === hunt.room.id), true);
  const before = await b.evaluate(() => hunt.state.players.find(p => p.id === hunt.room.id).x);
  await b.keyboard.down('d');
  await b.waitForFunction(x => hunt.state.players.find(p => p.id === hunt.room.id).x > x + 0.8, before);
  await b.keyboard.up('d'); check('remote input moves the player on the host');
  for (const key of ['1', '2', '3']) {
    await b.keyboard.press(key);
    await b.waitForFunction(k => hunt.state.players.find(p => p.id === hunt.room.id).changes === 3 - Number(k), key);
  }
  await b.keyboard.press('4'); await b.waitForFunction(() => document.getElementById('toast').textContent.includes('No te quedan'));
  assert.equal(await b.evaluate(() => hunt.state.players.find(p => p.id === hunt.room.id).prop), 'cooler');
  check('remote transformations stop after exactly three changes');
  const ids = await a.evaluate(() => ({ host: hunt.room.id, other: hunt.state.players.find(p => !p.bot && p.id !== hunt.room.id).id }));
  await a.evaluate(({ host, other }) => { hunt.step(hunt.state.hideSeconds + 1); hunt.place(host, -2, 14); hunt.place(other, -4, 14); }, ids);
  await b.waitForFunction(() => hunt.state.phase === 'hunt');
  // First person: the seeker turns to put the hider under the crosshair, then checks.
  await a.evaluate(() => { hunt.aimAt(-4, 14); }); await a.keyboard.press('e'); await b.waitForFunction(() => hunt.state.players.find(p => p.id === hunt.room.id).caught);
  check('capture and score synchronize between clients');
  const c = await newPage('Luisa', true);
  await c.waitForFunction(() => hunt.state.players.find(p => p.id === hunt.room.id)?.spectator);
  check('late arrival spectates the active round');
  await a.evaluate(() => { hunt.room.game.remaining = 0.01; hunt.room.tick(0.1, {}); });
  await b.waitForFunction(() => hunt.state.phase === 'results'); await c.waitForFunction(() => hunt.state.phase === 'results');
  await a.locator('#next').click();
  await b.waitForFunction(() => hunt.state.seeker === hunt.room.id && hunt.state.round === 2);
  await c.waitForFunction(() => hunt.state.round === 2 && !hunt.state.players.find(p => p.id === hunt.room.id).spectator);
  check('results, role rotation and late player admission synchronize');
  await a.close();
  await b.waitForFunction(() => hunt.room.isHost && hunt.state.phase === 'lobby');
  await c.waitForFunction(() => hunt.state.phase === 'lobby');
  assert.equal(await b.locator('#world').evaluate(el => el.style.filter), '');
  check('host departure returns survivors to a usable, unblurred lobby');
  await b.locator('#pana-room-more').click(); await b.locator('#role-seek').click(); await b.locator('#pana-room-done').click(); await b.locator('#start').click();
  await c.waitForFunction(() => hunt.state.phase === 'hide');
  const initialX = await c.evaluate(() => hunt.state.players.find(p => p.id === hunt.room.id).x);
  const button = await c.locator('[data-move="right"]').boundingBox();
  await c.mouse.move(button.x + button.width / 2, button.y + button.height / 2); await c.mouse.down();
  await c.waitForFunction(x => hunt.state.players.find(p => p.id === hunt.room.id).x > x + 0.5, initialX);
  await c.mouse.up(); await c.locator('[data-prop="barrel"]').click();
  await c.waitForFunction(() => hunt.state.players.find(p => p.id === hunt.room.id).prop === 'barrel');
  assert.equal(await c.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (output) await c.screenshot({ path: path.join(output, 'pana-hunt-mobile.png') });
  check('mobile movement controls, prop buttons and 390px layout work');
  await c.close();
  await b.waitForFunction(() => hunt.room.members.size === 1);
  // Run all remaining rounds through the normal result/replay buttons.
  for (let i = 0; i < 4; i++) {
    await b.evaluate(() => { hunt.room.game.finish('hiders', 'Fin de prueba'); hunt.room.tick(0, {}); });
    await b.waitForFunction(() => ['results', 'finished'].includes(hunt.state.phase));
    if (i < 3) await b.locator('#next').click();
  }
  assert.equal(await b.evaluate(() => hunt.state.phase), 'finished');
  await b.locator('#next').click();
  assert.equal(await b.evaluate(() => hunt.state.round), 1);
  assert.equal(await b.evaluate(() => hunt.state.players.every(p => p.score === 0)), true);
  check('complete match and replay reset scores and changes');
  await b.evaluate(() => hunt.room.cut());
  await b.waitForFunction(() => !hunt.room.connected); await b.locator('#practice').click();
  await b.waitForFunction(() => hunt.room.offline && hunt.state.phase === 'lobby');
  await b.locator('#pana-room-more').click(); await b.locator('#role-hide').click(); await b.locator('#pana-room-done').click(); await b.locator('#start').click(); await b.keyboard.press('1');
  await b.waitForFunction(() => hunt.camera.position.y < 4);
  if (output) await b.screenshot({ path: path.join(output, 'pana-hunt-gameplay.png') });
  check('connection failure offers playable local practice');
  await b.goto(base + '/g/derrape/?track=llanos&debug'); await b.waitForFunction(() => window.race && window.garage);
  await b.evaluate(() => startRace(0)); check('Derrape loads and starts on Los Llanos with the market kit');
  await b.goto(base + '/g/bululu/?debug'); await b.waitForFunction(() => window.board && window.players);
  assert.equal(await b.evaluate(async () => { const shared = await import('/engine/models/vegetation/index.js'), original = await import('/g/bululu/flora.js'); return shared.palm === original.palm && shared.mangoTree === original.mangoTree; }), true);
  check('Bululú renders and retains exactly the same shared foliage factories');
  await b.goto(base + '/'); await b.getByRole('heading', { name: 'Escondidas · Pana Hunt', exact: true }).waitFor();
  assert.equal(await b.evaluate(async () => typeof (await import('/g/escondidas/card.js')).mount), 'function');
  check('hub discovers Escondidas and resolves its live artwork imports');
  assert.deepEqual(errors, []); check('no uncaught browser errors');
} finally { await browser.close(); }
