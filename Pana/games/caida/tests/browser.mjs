import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const base = process.env.PANA_QA_URL || 'http://localhost:8461', code = `caida-${Date.now()}`, errors = [];
await mkdir('art/caida', { recursive: true });
const check = text => console.log(`PASS ${text}`);
async function open(name, mobile = false, room = code) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage(); page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
  await page.goto(`${base}/g/caida/?room=${room}&name=${name}&debug`);
  await page.waitForFunction(() => window.caidaDebug?.world && caidaDebug.room.connected, null, { timeout: 90000 });
  await page.locator('#loading').waitFor({ state: 'hidden' }); return page;
}
async function advance(host, humans) {
  const state = await host.evaluate(() => caidaDebug.room.state); if (state.phase !== 'playing') return false;
  const player = state.players[state.turn], human = humans.get(player.id);
  if (player.id === null) await host.evaluate(() => caidaDebug.room.tick(2));
  else {
    assert.ok(human, 'human client exists'); await human.waitForFunction(r => caidaDebug.room.state.revision >= r, state.revision);
    if (await human.locator('#chant').isVisible()) await human.locator('#chant').click();
    else {
      const move = await human.evaluate(() => caidaDebug.chooseMove(caidaDebug.room.state));
      await human.locator(`[data-card="${move.card}"]`).click(); await human.locator('#play').click();
    }
  }
  await host.waitForFunction(r => caidaDebug.room.state.revision > r, state.revision); return true;
}
try {
  const a = await open('Juan'), b = await open('María');
  await a.waitForFunction(() => caidaDebug.room.members.size === 2); await b.waitForFunction(() => caidaDebug.room.seat === 1);
  await a.screenshot({ path: 'art/caida/desktop-lobby.png' });
  assert.equal(await a.evaluate(() => caidaDebug.world.characters[0].group.userData.characterVersion), 'studio-v1');
  assert.equal(await b.locator('#start').isDisabled(), true); check('3D scene, Spanish cards, shared Pana characters and two connected seats');
  await a.locator('#cantos').uncheck(); await b.waitForFunction(() => !caidaDebug.room.state.options.cantos);
  await a.locator('#start').click(); await b.waitForFunction(() => caidaDebug.room.state.phase === 'playing');
  const humans = new Map([[await a.evaluate(() => caidaDebug.room.id), a], [await b.evaluate(() => caidaDebug.room.id), b]]);
  for (let i = 0; i < 8; i++) if (!await advance(a, humans)) break;
  await a.screenshot({ path: 'art/caida/desktop-playing.png' });
  const rev = await a.evaluate(() => caidaDebug.room.state.revision); await b.waitForFunction(r => caidaDebug.room.state.revision === r, rev);
  assert.deepEqual(await b.evaluate(() => caidaDebug.room.state.table), await a.evaluate(() => caidaDebug.room.state.table)); check('real two-client selects, previews, plays and captures replicate');
  await a.locator('#camera-view').click(); await a.waitForTimeout(600); await a.screenshot({ path: 'art/caida/table-view.png' });
  const snapshot = await b.evaluate(() => ({ round: caidaDebug.room.state.round, scores: caidaDebug.room.state.scores }));
  await a.close(); await b.waitForFunction(() => caidaDebug.room.isHost);
  assert.equal(await b.evaluate(() => caidaDebug.room.state.round), snapshot.round); assert.deepEqual(await b.evaluate(() => caidaDebug.room.state.scores), snapshot.scores); check('host migration preserves active match');
  await b.locator('#menu').click(); const paused = await b.evaluate(() => caidaDebug.room.state.revision); await b.waitForTimeout(1400); assert.equal(await b.evaluate(() => caidaDebug.room.state.revision), paused); await b.locator('#pana-resume').click(); check('shared pause menu stops solo bots');
  humans.clear(); humans.set(await b.evaluate(() => caidaDebug.room.id), b);
  for (let i = 0; i < 100; i++) if (!await advance(b, humans)) break;
  await b.locator('#result').waitFor({ state: 'visible' }); await b.screenshot({ path: 'art/caida/results.png' });
  await b.locator('#next-round').click(); await b.waitForFunction(() => caidaDebug.room.state.phase === 'playing'); check('full deal, card counting and next round');
  await b.close();
  const m = await open('Móvil', true, `${code}-mobile`); await m.screenshot({ path: 'art/caida/mobile-lobby.png' }); assert.equal(await m.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await m.locator('#cantos').uncheck(); await m.locator('#start').tap();
  await m.locator('.hand-card').first().tap(); assert.equal(await m.locator('#play').isDisabled(), false); await m.locator('#play').tap();
  await m.waitForTimeout(1500); await m.screenshot({ path: 'art/caida/mobile-playing.png' }); check('390px touch layout, selection and confirmation');
  await m.evaluate(() => { caidaDebug.room.cut(); }); await m.waitForFunction(() => !caidaDebug.room.connected);
  await m.locator('#practice').click(); await m.locator('#mode').selectOption('teams'); await m.locator('#start').click();
  await m.waitForFunction(() => caidaDebug.room.state.players.length === 4 && caidaDebug.world.characters.filter(Boolean).length === 4); check('offline fallback and four-seat mode');
  await m.screenshot({ path: 'art/caida/mobile-teams.png' });
  const studio = await browser.newPage({ viewport: { width: 1440, height: 900 } }); studio.on('pageerror', e => errors.push(e.message));
  await studio.goto(`${base}/studio.html#caida-card`); await studio.locator('#startup').waitFor({ state: 'hidden', timeout: 300000 });
  for (const id of ['caida-card', 'caida-score-token', 'domino-table', 'domino-chair']) {
    await studio.locator('#back-library').click();
    await studio.locator('#search').fill(id); await studio.locator(`[data-asset="${id}"]`).click();
    await studio.waitForFunction(id => panaLibrary.selected === id && document.querySelector('#preview-status').hidden, id, { timeout: 90000 });
    assert.ok(await studio.evaluate(() => panaLibrary.current.group.children.length > 0));
  }
  await studio.screenshot({ path: 'art/caida/studio.png' }); check('new Studio models and shared table/chair previews');
  await studio.goto(`${base}/`); await studio.getByRole('heading', { name: 'Caída', exact: true }).waitFor(); check('hub automatically discovers Caída');
  assert.deepEqual(errors, []); check('no uncaught browser errors');
} catch (error) {
  for (const [i, context] of browser.contexts().entries()) for (const page of context.pages()) { await page.screenshot({ path: `art/caida/failure-${i}.png` }).catch(() => {}); console.log(await page.evaluate(() => window.caidaDebug ? { phase: caidaDebug.room.state.phase, seat: caidaDebug.room.seat, turn: caidaDebug.room.state.turn, connected: caidaDebug.room.connected } : location.href).catch(() => null)); }
  throw error;
} finally { await browser.close(); }
