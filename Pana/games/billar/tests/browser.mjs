// Real Colyseus sessions plus mouse, keyboard and touch on the actual canvas.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', code = `pool-${Date.now()}`, errors = [];
const browser = await chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
await mkdir('art/billar', { recursive: true });
const wait = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 90000 });
const check = text => console.log(`ok: ${text}`);
async function open(name, room = code, mobile = false, full = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
  await context.addInitScript(name => {
    localStorage.setItem('pana:name', name);
    localStorage.setItem('pana:avatar', JSON.stringify({ hat: 'gorra', outfit: 'hoodie', outfitColor: '#3775cc' }));
    localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' }));
  }, name);
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/g/billar/?room=${room}&debug`, { waitUntil: 'domcontentloaded' });
  await wait(page, () => !!window.billarDebug);
  if (!full) await wait(page, () => billarDebug.room.connected);
  return page;
}
async function target(page, x, y) {
  const point = await page.evaluate(([x, y]) => billarDebug.world.screen(x, y), [x, y]); await page.mouse.click(point.x, point.y);
}
async function power(page, value) { await page.locator('#power').fill(String(value)); }
async function same(a, b) {
  const state = await a.evaluate(() => billarDebug.room.state);
  await wait(b, revision => billarDebug.room.state.revision === revision, state.revision);
  assert.deepEqual(await b.evaluate(() => billarDebug.room.state.balls), state.balls);
  assert.deepEqual(await b.evaluate(() => billarDebug.room.state.groups), state.groups);
  assert.equal(await b.evaluate(() => billarDebug.room.state.turn), state.turn);
}
// Arrange specific late-game shots after the opening break has used an intact rack.
async function fixture(host, type, turn = 1) {
  await host.evaluate(({ type, turn }) => {
    const r = billarDebug.room, s = r.game;
    s.phase = 'aiming'; s.turn = turn; s.shots = 2; s.shot = null; s.result = null; s.ballInHand = false; s.groups = ['stripes', 'solids'];
    s.balls.forEach(b => { b.pocketed = ![0, 8, 9, ...(type === 'pot' ? [1] : [])].includes(b.id); b.vx = b.vy = 0; });
    Object.assign(s.balls[0], { x: 140, y: 140 });
    Object.assign(s.balls[type === 'pot' ? 1 : 8], { x: 70, y: 70 });
    Object.assign(s.balls[9], { x: 850, y: 350 });
    if (type === 'scratch') Object.assign(s.balls[8], { x: 750, y: 250 });
    s.revision++; r.publish();
  }, { type, turn });
}
try {
  const a = await open('Juan'), b = await open('María');
  await wait(a, () => billarDebug.room.members.size === 2); await wait(b, () => billarDebug.room.seat === 1);
  assert.ok(await b.locator('#start').isDisabled());
  await a.locator('#portrait-0').waitFor({ state: 'visible', timeout: 90000 });
  assert.ok(await a.locator('#portrait-0').evaluate(img => img.naturalWidth === 160));
  await a.screenshot({ path: 'art/billar/lobby.png' }); check('lobby renders the saved shared pana and two-player room');
  const practiceBox = await a.locator('#practice').boundingBox(); assert.ok(practiceBox.y + practiceBox.height <= 800, 'laptop lobby actions fit');
  const c = await open('Tercero', code, false, true);
  await wait(c, () => document.getElementById('connection').textContent.includes('llena'));
  assert.equal(await c.evaluate(() => billarDebug.room.connected), false); await c.close(); check('third client cannot create a duplicate room');
  await a.locator('#start').click(); await wait(b, () => billarDebug.room.state.phase === 'aiming');
  await wait(a, () => billarDebug.world.camera.isPerspectiveCamera && billarDebug.world.balls.size === 16);
  assert.ok(await a.evaluate(() => {
    const world = billarDebug.world, rect = document.getElementById('table').getBoundingClientRect();
    return rect.width === innerWidth && rect.height === innerHeight && [[100, 100], [500, 250], [900, 400]].every(([x, y]) => { const s = world.screen(x, y), p = world.point(s.x, s.y); return Math.hypot(x - p.x, y - p.y) < .001; });
  }), 'fullscreen perspective table maps shots back to authoritative cloth coordinates');
  const revision = await a.evaluate(() => billarDebug.room.state.revision);
  await b.evaluate(() => billarDebug.room.action('shoot', { angle: 0, power: 1 }));
  await b.waitForTimeout(200); assert.equal(await a.evaluate(() => billarDebug.room.state.revision), revision);
  await target(a, 690, 250); await power(a, 100); await a.locator('#shoot').click();
  await wait(b, () => billarDebug.room.state.phase === 'rolling');
  await wait(a, () => billarDebug.room.state.phase === 'aiming'); await same(a, b);
  assert.equal(await b.evaluate(() => billarDebug.room.state.shots), 1); await b.screenshot({ path: 'art/billar/playing.png' });
  check('mouse break physically disperses the rack and two clients agree; wrong-seat shot rejected');

  await fixture(a, 'pot'); await same(a, b);
  await target(b, 70, 70); await power(b, 22); await b.locator('#shoot').click();
  await wait(a, () => billarDebug.room.state.phase === 'rolling');
  await wait(b, () => billarDebug.room.state.shots === 3 && billarDebug.room.state.phase === 'aiming'); await same(a, b);
  assert.equal(await b.evaluate(() => billarDebug.room.state.balls[1].pocketed), true);
  assert.equal(await b.evaluate(() => billarDebug.room.state.turn), 1); check('guest cue shot pots a solid and keeps the turn');

  await fixture(a, 'scratch'); await same(a, b); await target(b, 0, 0); await power(b, 30); await b.locator('#shoot').click();
  await wait(a, () => billarDebug.room.state.ballInHand); await same(a, b);
  assert.equal(await a.evaluate(() => billarDebug.room.state.turn), 0);
  await target(a, 850, 350); assert.equal(await a.evaluate(() => billarDebug.room.state.ballInHand), true);
  await target(a, 300, 200); await wait(b, () => !billarDebug.room.state.ballInHand);
  assert.ok(Math.abs(await b.evaluate(() => billarDebug.room.state.balls[0].x) - 300) < 1); check('scratch awards rival ball in hand; occupied placements are rejected');

  await fixture(a, 'eight'); await same(a, b); await target(b, 70, 70); await power(b, 22); await b.locator('#shoot').click();
  await a.locator('#results').waitFor({ state: 'visible' }); await b.locator('#results').waitFor({ state: 'visible' });
  assert.equal(await a.evaluate(() => billarDebug.room.state.result.winner), 1); assert.ok(await b.locator('#again').isDisabled());
  await b.screenshot({ path: 'art/billar/results.png' }); await a.locator('#again').click(); await wait(b, () => billarDebug.room.state.round === 2); await same(a, b);
  check('legal eight produces shared results and the host can start a clean rematch');

  await target(a, 690, 250); await power(a, 100); await a.locator('#shoot').click();
  await wait(b, () => billarDebug.room.state.phase === 'rolling' && billarDebug.room.state.shot.elapsed > .2);
  await a.close(); await wait(b, () => billarDebug.room.isHost);
  await wait(b, () => billarDebug.room.state.phase === 'aiming');
  assert.equal(await b.evaluate(() => billarDebug.room.state.round), 2);
  assert.equal(await b.evaluate(() => billarDebug.room.state.shots), 1);
  const d = await open('Luis'); await wait(d, () => billarDebug.room.seat === 0); await same(b, d);
  check('host departure during a shot preserves the round; a new friend takes the free seat');
  await d.reload(); await wait(d, () => window.billarDebug?.room.connected && billarDebug.room.seat === 0); await same(b, d);
  check('reloaded client catches up without resetting the table');
  await b.close(); await d.close();

  const m = await open('Móvil', `${code}-mobile`, true);
  await m.screenshot({ path: 'art/billar/mobile-lobby.png' });
  const mobilePractice = await m.locator('#practice').boundingBox(); assert.ok(mobilePractice.y + mobilePractice.height <= 844, 'phone lobby actions fit');
  await m.locator('#practice').tap();
  await wait(m, () => billarDebug.room.offline && billarDebug.room.state.phase === 'aiming');
  await wait(m, () => billarDebug.world.rotation > 0);
  const touch = await m.evaluate(() => billarDebug.world.screen(690, 250)); await m.touchscreen.tap(touch.x, touch.y);
  const oldAngle = await m.evaluate(() => billarDebug.angle); await m.locator('#aim-right').tap();
  assert.ok(await m.evaluate(() => billarDebug.angle) > oldAngle);
  await m.screenshot({ path: 'art/billar/mobile-playing.png' });
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const shotBox = await m.locator('#shoot').boundingBox(); assert.ok(shotBox.y + shotBox.height <= 844);
  await m.locator('#shoot').tap(); await wait(m, () => billarDebug.room.state.phase === 'rolling');
  await m.locator('#menu').tap(); const elapsed = await m.evaluate(() => billarDebug.room.state.shot.elapsed); await m.waitForTimeout(300);
  assert.equal(await m.evaluate(() => billarDebug.room.state.shot.elapsed), elapsed);
  await m.locator('#pana-resume').tap(); await wait(m, () => billarDebug.room.state.phase === 'aiming');
  assert.equal(await m.locator('#shoot').isDisabled(), false); check('portrait touch aiming, fine adjustment, visible controls and shared practice pause work');
  await m.setViewportSize({ width: 844, height: 390 }); await m.screenshot({ path: 'art/billar/mobile-landscape.png' });
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await m.setViewportSize({ width: 667, height: 375 });
  const landscapeShot = await m.locator('#shoot').boundingBox(); assert.ok(landscapeShot.y + landscapeShot.height <= 375);
  assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await m.close();

  const offline = await open('Sin red', `${code}-offline`); await offline.evaluate(() => billarDebug.room.cut());
  await wait(offline, () => !billarDebug.room.connected); await offline.locator('#practice').click();
  assert.equal(await offline.evaluate(() => billarDebug.room.state.phase), 'aiming');
  await offline.locator('#table').focus(); await offline.keyboard.press('ArrowRight'); await offline.keyboard.press('Space');
  await wait(offline, () => billarDebug.room.state.phase === 'rolling'); check('keyboard shots and local fallback after a lost connection work');
  await offline.goto(`${base}/`); await offline.getByRole('heading', { name: 'Billar', exact: true }).waitFor();
  assert.equal(await offline.getByRole('heading', { name: 'Billar', exact: true }).count(), 1);
  assert.deepEqual(errors, []); check('hub discovers Billar once and no browser exceptions occurred');
} catch (error) {
  for (const [i, context] of browser.contexts().entries()) for (const page of context.pages()) {
    console.log(await page.evaluate(() => window.billarDebug ? { state: billarDebug.room.state, connected: billarDebug.room.connected, host: billarDebug.room.isHost, seat: billarDebug.room.seat } : location.href).catch(() => null));
    await page.screenshot({ path: `art/billar/failure-${i}.png` }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
