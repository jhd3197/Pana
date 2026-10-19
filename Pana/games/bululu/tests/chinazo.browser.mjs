// ¡Chinazo! in a real page: the aim input from the mouse, the keyboard alone
// and a finger, the round's ending, and the board working again afterwards.
// Usage: PANA_PLAYWRIGHT_PATH=… node Pana/games/bululu/tests/chinazo.browser.mjs
import assert from 'node:assert/strict';
import { launch, waitPrepared } from '../../../tests/browser-kit.js';
import { mkdir } from 'node:fs/promises';
const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await launch();
const errors = [];
const check = (text) => console.log(`PASS ${text}`);
await mkdir('art/bululu', { recursive: true });

async function open(query, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, ...options });
  await context.addInitScript(() => localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false, music: false })));
  const page = await context.newPage();
  page.on('pageerror', (e) => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) { errors.push(m.text()); console.error(m.text()); } });
  await page.goto(`${base}/g/bululu/?${query}`, { waitUntil: 'domcontentloaded' });
  await waitPrepared(page);
  return page;
}
const shooter = (page) => page.evaluate(() => { const s = minigame().game.sim.shooters[0]; return { aim: { ...s.aim }, shots: s.shots, ammo: s.ammo, reload: s.reload, pulling: s.pulling }; });
async function startRound(page) {
  await page.locator('#start').click({ timeout: 90000 });
  await page.locator('#prompt button').click({ timeout: 30000 });   // ¡Listo!
  await page.waitForFunction(() => minigame()?.state === 'run', null, { timeout: 30000 });
}

try {
  // ---------- mouse and keyboard ----------
  const page = await open('play=chinazo&debug&speed=2');
  await startRound(page);
  assert.equal(await page.evaluate(() => document.body.classList.contains('mini-aim')), true);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('canvas')).cursor), 'none');
  assert.equal(await page.locator('.reticle').count(), 6);
  check('aim minigame: mini-aim body class, hidden cursor, six reticles');

  await page.mouse.move(960, 180);
  await page.waitForFunction(() => Math.abs(minigame().game.sim.shooters[0].aim.x - 0.5) < 0.02);
  let s = await shooter(page);
  assert.ok(Math.abs(s.aim.y - 0.5) < 0.02, `mouse y → NDC (${s.aim.y})`);
  await page.mouse.down();
  await page.waitForFunction(() => minigame().game.sim.shooters[0].pulling);
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForFunction(() => minigame().game.sim.shooters[0].shots === 1);
  check('the reticle follows the mouse; press pulls, release fires');

  // a quick click still waits for the minimum pull, and fires once
  await page.mouse.down(); await page.mouse.up();
  await page.waitForFunction(() => minigame().game.sim.shooters[0].shots === 2);
  await page.waitForTimeout(300);
  assert.equal((await shooter(page)).shots, 2);
  check('a click shorter than the minimum pull still fires once');

  // keyboard alone: D moves right (accelerating), Space pulls and releases
  s = await shooter(page);
  await page.keyboard.down('a'); await page.waitForTimeout(400); await page.keyboard.up('a');
  const moved = await shooter(page);
  assert.ok(moved.aim.x < s.aim.x - 0.2, `A moves the reticle left (${s.aim.x} → ${moved.aim.x})`);
  await page.keyboard.down('w'); await page.waitForTimeout(150); await page.keyboard.up('w');
  assert.ok((await shooter(page)).aim.y > moved.aim.y, 'W moves it up');
  await page.waitForFunction(() => minigame().game.sim.shooters[0].reload === 0 && minigame().game.sim.shooters[0].ammo > 0);
  const before = (await shooter(page)).shots;
  await page.keyboard.down(' '); await page.waitForTimeout(200); await page.keyboard.up(' ');
  await page.waitForFunction((n) => minigame().game.sim.shooters[0].shots === n + 1, before);
  check('keyboard: WASD steers the reticle, Space pulls and fires');
  await page.screenshot({ path: 'art/bululu/chinazo-play.png' });

  // the timer runs out: winner card, +10, then the cursor is back
  await page.waitForFunction(() => minigame()?.state === 'outro', null, { timeout: 60000 });
  await page.locator('#winner').waitFor({ state: 'visible' });
  const card = await page.locator('#winner').textContent();
  assert.ok(/GANADOR|NADIE/.test(card), card);
  assert.equal(await page.evaluate(() => document.body.classList.contains('mini-aim')), false);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.querySelector('canvas')).cursor), 'none');
  check(`round ends with the winner card (${card.replace(/\s+/g, ' ').trim()}) and gives the cursor back`);
  await page.context().close();

  // ---------- touch: drag anywhere to aim, lift to fire ----------
  const touch = await open('play=chinazo&debug&speed=2', { hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 } });
  await startRound(touch);
  assert.equal(await touch.evaluate(() => [...document.querySelectorAll('.touch')].every((el) => getComputedStyle(el).display === 'none')), true);
  const t0 = await shooter(touch);
  await touch.evaluate(() => {
    const c = document.querySelector('canvas'), ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true }));
    ev('pointerdown', 400, 300);
    for (let k = 1; k <= 10; k++) ev('pointermove', 400 + k * 12, 300 - k * 6);
  });
  const t1 = await shooter(touch);
  assert.ok(t1.aim.x > t0.aim.x + 0.3 && t1.aim.y > t0.aim.y + 0.15, `dragging moves the reticle (${JSON.stringify(t0.aim)} → ${JSON.stringify(t1.aim)})`);
  await touch.waitForFunction(() => minigame().game.sim.shooters[0].pulling);
  await touch.waitForTimeout(200);
  await touch.evaluate(() => document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', bubbles: true })));
  await touch.waitForFunction(() => minigame().game.sim.shooters[0].shots === 1);
  check('touch: the move buttons hide, a drag aims and lifting the finger fires');
  await touch.screenshot({ path: 'art/bululu/chinazo-touch.png' });
  await touch.context().close();

  // ---------- back on the board: minimap and dice still work ----------
  const board = await open('debug&auto&mini=chinazo&rounds=2');
  await board.waitForFunction(() => typeof fastForward === 'function', null, { timeout: 90000 });
  await board.waitForFunction(() => document.querySelector('#intro').classList.contains('hidden'), null, { timeout: 30000 });
  await board.evaluate(async () => {
    for (let i = 0; i < 120 && !minigame(); i++) await fastForward(5);
    if (!minigame()) throw new Error(`Board stalled before minigame: ${document.querySelector('#room-status').textContent}`);
    for (let i = 0; i < 120 && minigame(); i++) await fastForward(5);
    if (minigame()) throw new Error(`Minigame stalled in ${minigame().state}`);
  });
  assert.equal(await board.evaluate(() => document.body.classList.contains('mini-aim')), false);
  const tiles = await board.evaluate(() => players.map((p) => p.tile).join());
  await board.locator('#minimap').click({ position: { x: 80, y: 60 } });
  assert.equal(await board.evaluate(() => document.querySelector('#look').classList.contains('on')), true);
  await board.keyboard.press('Tab');
  await board.evaluate(() => fastForward(25));
  assert.notEqual(await board.evaluate(() => players.map((p) => p.tile).join()), tiles, 'round 2 dice move the panas');
  check('after ¡Chinazo! the minimap click and the dice work as before');
  await board.context().close();

  // ---------- the shuffle bag: every minigame, never twice in a row ----------
  const bag = await open('debug&auto&rounds=20');
  await bag.waitForFunction(() => typeof fastForward === 'function', null, { timeout: 90000 });
  await bag.waitForFunction(() => document.querySelector('#intro').classList.contains('hidden'), null, { timeout: 30000 });
  const order = await bag.evaluate(async () => {
    const seen = [];
    const title = document.querySelector('#mini-title');
    new MutationObserver(() => seen.push(title.textContent)).observe(title, { childList: true, characterData: true, subtree: true });
    await fastForward(1200);
    return seen;
  });
  for (let i = 1; i < order.length; i++) assert.notEqual(order[i], order[i - 1], `repeat at ${i}: ${order.join(', ')}`);
  assert.ok(order.includes('¡Chinazo!'), order.join(', '));
  check(`${order.length} minigames in 1200 s, none twice in a row, ¡Chinazo! among them`);
  await bag.context().close();

  assert.deepEqual(errors, []);
  console.log('PASS ¡Chinazo! browser suite');
} finally {
  await browser.close();
}
