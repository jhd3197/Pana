import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', code = `dealer-${Date.now()}`, errors = [];
await mkdir('art/caida', { recursive: true });
async function open(name, room = code) {
  console.log(`Opening ${name}`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  await context.addInitScript(name => { localStorage.setItem('pana:name', name); localStorage.setItem('pana:settings', JSON.stringify({ quality: 'baja', sound: false })); }, name);
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
  await page.goto(`${base}/g/caida/?room=${room}&debug`);
  await page.waitForFunction(() => window.caidaDebug?.world && caidaDebug.room.connected, null, { timeout: 90000 });
  await page.locator('#loading').waitFor({ state: 'hidden' }); return page;
}
async function sync(page, revision) { await page.waitForFunction(r => caidaDebug.room.state.revision >= r, revision); }
try {
  const a = await open('Ana'), b = await open('Beto');
  await a.waitForFunction(() => caidaDebug.room.members.size === 2);
  // The host's seat order deals first here; starter.browser.js covers the cachos.
  await a.locator('#pana-room-more').click(); await a.locator('[data-room-option="cantos"][data-value="false"]').click(); await a.locator('[data-room-option="starter"][data-value="anfitrion"]').click(); await a.locator('#pana-room-done').click();
  await a.evaluate(() => { caidaDebug.room.game.rng = 1; });
  await a.locator('#start').click(); await b.waitForFunction(() => caidaDebug.room.state.phase === 'dealing');
  console.log('Both clients reached the dealer screen');
  assert.equal(await a.locator('[data-option="call"]').count(), 0);
  assert.equal(await a.locator('#deal-cards').isDisabled(), true);
  assert.equal(await a.locator('[data-deal-call][aria-pressed="true"]').count(), 0);
  assert.equal(await b.locator('#call-one').isDisabled(), true);
  assert.equal(await b.locator('#cut-deck').isDisabled(), true);
  const original = await a.evaluate(() => caidaDebug.room.state.stock);
  await b.evaluate(() => { caidaDebug.room.action('cut', { at: 7 }); caidaDebug.room.action('call', { call: 'up' }); caidaDebug.room.action('deal'); });
  await b.waitForTimeout(200);
  assert.deepEqual(await a.evaluate(() => caidaDebug.room.state.stock), original);
  assert.equal(await a.evaluate(() => caidaDebug.room.state.dealCall), null);
  for (let i = 0; i < 7; i++) await a.locator('#cut-position').press('ArrowLeft');
  await a.locator('#cut-deck').click();
  await b.waitForFunction(() => caidaDebug.room.state.cutAt === 13);
  assert.deepEqual(await b.evaluate(() => caidaDebug.room.state.stock), [...original.slice(13), ...original.slice(0, 13)]);
  assert.equal(await a.locator('#cut-deck').isDisabled(), true);
  assert.equal(await a.locator('#hand .hand-card').count(), 0);
  const spectator = await open('Carla');
  await spectator.waitForFunction(() => caidaDebug.room.state.cutAt === 13);
  assert.equal(await spectator.evaluate(() => caidaDebug.room.seat), -1);
  assert.equal(await spectator.locator('#deal-cards').isDisabled(), true);
  await spectator.close();
  for (const [width, height] of [[390, 667], [667, 390], [768, 1024], [1280, 720]]) {
    await a.setViewportSize({ width, height }); await a.locator('#deal-cards').scrollIntoViewIfNeeded();
    assert.equal(await a.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const button = await a.locator('#deal-cards').boundingBox();
    assert.ok(button.x >= 0 && button.x + button.width <= width && button.y >= 0 && button.y + button.height <= height);
    await a.screenshot({ path: `art/caida/dealer-${width}.png` });
  }
  await a.setViewportSize({ width: 1280, height: 720 });
  await a.locator('#call-one').focus(); await a.keyboard.press('Space');
  await b.waitForFunction(() => caidaDebug.room.state.dealCall === 'up');
  await a.locator('#deal-cards').click(); await b.waitForFunction(() => caidaDebug.room.state.phase === 'playing');
  console.log('PASS dealer-only cut, mandatory fresh choice, real cut order, spectator late join, keyboard and four layouts');

  const humans = new Map([[await a.evaluate(() => caidaDebug.room.id), a], [await b.evaluate(() => caidaDebug.room.id), b]]);
  let sawLastHand = false;
  for (let i = 0; i < 50; i++) {
    const state = await a.evaluate(() => caidaDebug.room.state);
    if (state.phase !== 'playing') break;
    if (!state.stock.length && !sawLastHand) {
      sawLastHand = true;
      assert.equal(await a.locator('#last-hand').isVisible(), true);
      assert.match(await a.locator('#announcement').textContent(), /Últimas.*cuatro de mesa/);
    }
    const actor = humans.get(state.players[state.turn].id); await sync(actor, state.revision);
    await actor.evaluate(() => caidaDebug.room.action('play', { card: caidaDebug.chooseMove(caidaDebug.room.state).card }));
    await a.waitForFunction(r => caidaDebug.room.state.revision > r, state.revision);
  }
  assert.equal(sawLastHand, true);
  await b.locator('#result').waitFor({ state: 'visible' });
  assert.equal(await b.evaluate(() => caidaDebug.room.state.phase), 'round-over');
  const previousScores = await b.evaluate(() => caidaDebug.room.state.scores);
  await b.locator('#next-round').click(); await a.waitForFunction(() => caidaDebug.room.state.phase === 'dealing');
  assert.equal(await b.locator('#dealer-title').textContent(), 'Te toca repartir.');
  assert.equal(await b.locator('#deal-cards').isDisabled(), true);
  assert.equal(await b.locator('[data-deal-call][aria-pressed="true"]').count(), 0);
  await b.locator('#previous-round-title').click();
  assert.deepEqual(await b.evaluate(() => caidaDebug.room.state.previousRound.scores), previousScores);
  assert.match(await b.locator('#previous-round-scores').textContent(), /20|cartas/);
  await b.screenshot({ path: 'art/caida/dealer-recap.png' });
  await b.locator('#call-four').click(); await b.locator('#cut-position').press('Home'); await b.locator('#cut-deck').click();
  await a.waitForFunction(() => caidaDebug.room.state.cutAt === 1);
  const pending = await b.evaluate(() => caidaDebug.room.state.stock);
  await a.close(); await b.waitForFunction(() => caidaDebug.room.isHost);
  assert.deepEqual(await b.evaluate(() => caidaDebug.room.state.stock), pending);
  assert.equal(await b.evaluate(() => caidaDebug.room.state.dealCall), 'down');
  await b.locator('#deal-cards').click(); await b.waitForFunction(() => caidaDebug.room.state.phase === 'playing');
  console.log('PASS full two-client reparto, últimas, rotating dealer without host permission, recap and migration during cut');
  await b.close();

  // A dealer who leaves hands the pending ritual to a bot, including its cut.
  const d = await open('Dani', `${code}-leave`), e = await open('Eva', `${code}-leave`);
  await d.waitForFunction(() => caidaDebug.room.members.size === 2);
  await d.evaluate(() => caidaDebug.room.action('configure', { options: { starter: 'anfitrion' } })); await d.waitForFunction(() => caidaDebug.room.state.options.starter === 'anfitrion');
  await d.locator('#start').click(); await d.locator('#cut-deck').click();
  await e.waitForFunction(() => caidaDebug.room.state.cutAt === 20);
  await d.close(); await e.waitForFunction(() => caidaDebug.room.isHost && caidaDebug.room.state.phase === 'playing');
  assert.equal(await e.evaluate(() => caidaDebug.room.state.cutAt), 20);
  console.log('PASS bot completes a disconnected dealer’s pending deal');

  // Deterministic hand fixture checks the actual on-table canto presentation.
  await e.evaluate(async () => {
    const { deck } = await import('/g/caida/rules.js');
    const room = caidaDebug.room, g = room.game, hand = ['oros-5', 'copas-6', 'bastos-7'];
    g.players.forEach(p => { p.hand = []; p.captured = []; p.announced = null; });
    g.players[room.seat].hand = deck().filter(c => hand.includes(c.id));
    g.stock = deck().filter(c => !hand.includes(c.id)); g.table = []; g.turn = room.seat; g.scores.fill(0); g.phase = 'playing'; g.revision++; room.publish();
  });
  assert.match(await e.locator('#canto-name').textContent(), /Patrulla.*6/);
  assert.match(await e.locator('#canto-help').textContent(), /Tres cartas seguidas/);
  await e.locator('#chant').click();
  assert.match(await e.locator('#announcement').textContent(), /Patrulla/);
  assert.equal(await e.locator('#chant').isVisible(), false);
  await e.screenshot({ path: 'art/caida/patrulla.png' });
  console.log('PASS Patrulla explanation, announcement and single-use canto');
  assert.deepEqual(errors, []);
} catch (error) {
  for (const [i, context] of browser.contexts().entries()) for (const page of context.pages()) {
    await page.screenshot({ path: `art/caida/dealer-failure-${i}.png`, timeout: 10000 }).catch(() => {});
  }
  throw error;
} finally { await browser.close(); }
