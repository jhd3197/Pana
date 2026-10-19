// Bululú on phones: in a minigame the six score cards are one slim strip that
// leaves the field clear, the menu never sits on a card, the touch buttons
// match the minigame, every pana stays in frame held either way, and
// Chinazo's letterbox maps a finger to the same aim a 16:9 screen would.
import assert from 'node:assert/strict';
import { launch } from '../../../tests/browser-kit.js';

const base = process.env.PANA_TEST_URL || 'http://localhost:8461';
const browser = await launch();
const errors = [];

async function play(id, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false, music: false })));
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(`${id} ${width}x${height}: ${e.message}`));
  await page.goto(`${base}/g/bululu/?debug&play=${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof fastForward === 'function', null, { timeout: 120_000 });
  // held upright, Bululú asks for landscape; "Jugar así" keeps playing
  if (height > width) await page.locator('.pana-rotate [data-act="stay"]').click({ timeout: 10_000 });
  await page.locator('#start').click();
  await page.locator('#prompt button').first().click({ timeout: 60_000 });
  await page.waitForFunction(() => minigame()?.state === 'run', null, { timeout: 60_000 });
  return page;
}
const rect = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, shown: r.width > 0 && getComputedStyle(document.querySelector(s)).visibility !== 'hidden' }; }, sel);
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// every actor's chest projected through the minigame camera, inside the frame
const inFrame = page => page.evaluate(() => {
  const { game } = minigame(), V = game.camera.position.constructor;
  return game.actors.map(a => { const p = a.pana.group.getWorldPosition(new V()); p.y += 1; p.project(game.camera); return Math.abs(p.x) < 1 && Math.abs(p.y) < 1; });
});

try {
  let page = await play('atrapa', 844, 390);
  const cards = await rect(page, '#cards'), menu = await rect(page, '#menu');
  assert(cards.y < 20 && cards.h < 50, `cards are a slim strip at the top (${JSON.stringify(cards)})`);
  assert(!overlap(cards, menu), 'the menu button does not cover a card');
  assert.deepEqual([(await rect(page, '#t-left')).shown, (await rect(page, '#t-right')).shown, (await rect(page, '#t-jump')).shown], [true, true, false]);
  assert.deepEqual(await inFrame(page), Array(6).fill(true));
  console.log('PASS landscape Atrapa: slim cards, clear menu, move buttons only, six panas in frame');
  await page.context().close();

  page = await play('atrapa', 390, 844);
  assert.deepEqual(await inFrame(page), Array(6).fill(true));
  console.log('PASS upright Atrapa keeps all six panas in frame');
  await page.context().close();

  page = await play('caida', 844, 390);
  assert.deepEqual([(await rect(page, '#t-left')).shown, (await rect(page, '#t-jump')).shown], [false, true]);
  assert.equal((await page.locator('#t-jump').textContent()).trim(), '¡Dale!');
  console.log('PASS Caída shows only its ¡Dale! button');
  await page.context().close();

  // Chinazo keeps 16:9 upright: a touch at the box's centre line aims at y = 0
  page = await play('chinazo', 390, 844);
  const aspect = await page.evaluate(() => minigame().game.camera.aspect);
  assert(Math.abs(aspect - 16 / 9) < 1e-6, `Chinazo camera aspect ${aspect}`);
  await page.evaluate(() => {
    const c = document.querySelector('canvas'), ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 3, pointerType: 'mouse', button: 0, clientX: x, clientY: y, bubbles: true }));
    ev('pointermove', innerWidth * 0.75, innerHeight / 2);
  });
  await page.waitForFunction(() => Math.abs(minigame().game.sim.shooters[0].aim.y) < 0.02 && Math.abs(minigame().game.sim.shooters[0].aim.x - 0.5) < 0.02);
  console.log('PASS upright Chinazo draws letterboxed and aims through the box');
  await page.context().close();

  assert.deepEqual(errors, []);
} finally { await browser.close(); }
