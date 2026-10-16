import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true });
const base = process.env.PANA_QA_URL || 'http://localhost:8461', errors = [];
await mkdir('art/caida', { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/g/caida/?room=interaction-${Date.now()}&debug`);
  await page.waitForFunction(() => caidaDebug.world && caidaDebug.room.connected, null, { timeout: 90000 });
  await page.locator('#cantos').uncheck(); await page.locator('#start').click();
  assert.equal(await page.locator('.table-rank').count(), await page.evaluate(() => caidaDebug.room.state.table.length));
  await page.locator('.table-rank').first().click(); assert.equal(await page.locator('#toast').evaluate(e => e.classList.contains('show')), true);
  await page.keyboard.press('1'); assert.equal(await page.locator('.hand-card.selected').count(), 1);
  const expected = await page.evaluate(() => caidaDebug.previewPlay(caidaDebug.room.state, caidaDebug.room.state.players[caidaDebug.room.seat].hand[0], caidaDebug.room.seat).capture.length);
  assert.equal(await page.locator('.table-rank.will-capture').count(), expected);
  const rev = await page.evaluate(() => caidaDebug.room.state.revision); await page.keyboard.press('Enter'); await page.waitForFunction(r => caidaDebug.room.state.revision > r, rev);
  const before = await page.evaluate(() => caidaDebug.world.camera.position.toArray()); await page.locator('#camera-view').click();
  await page.waitForTimeout(500); const after = await page.evaluate(() => caidaDebug.world.camera.position.toArray()); assert.ok(Math.abs(before[2] - after[2]) > 5);
  await page.screenshot({ path: 'art/caida/mobile-table-final.png' });
  console.log('PASS keyboard selection/confirmation, readable table cards, matching previews and distinct mobile cameras');
  for (const [width, height] of [[390, 667], [768, 1024], [1280, 720], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const tools = await page.locator('.table-tools').boundingBox(), scores = await page.locator('.scoreboard').boundingBox();
    assert.ok(tools.y >= scores.y + scores.height, `${width}: view control clears scoreboard`);
    await page.screenshot({ path: `art/caida/layout-${width}.png` });
  }
  console.log('PASS four viewport sizes, no horizontal overflow, controls stay below scoreboard');
  await page.goto(`${base}/g/domino/?room=caida-regression-${Date.now()}&debug`);
  await page.waitForFunction(() => window.dominoDebug?.world, null, { timeout: 90000 });
  const identity = await page.evaluate(async () => { const a = await import('/g/domino/table-model.js'), b = await import('/engine/models/props/game-table.js'); return a.createDominoTable === b.createGameTable && a.createDominoChair === b.createGameChair; });
  assert.equal(identity, true); await page.screenshot({ path: 'art/caida/domino-regression.png' }); console.log('PASS Dominó scene and shared factory export identity');
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
