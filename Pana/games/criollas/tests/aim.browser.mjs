import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'criollas', { query: 'debug', mobile: true });
  await page.locator('#pana-room-more').click();
  await page.locator('[data-room-option="opener"][data-value="anfitrion"]').click();
  await page.locator('#pana-room-done').click(); await page.locator('#practice').click();
  await waitFor(page, () => criollasDebug.room.state.phase === 'aiming');
  await page.locator('[data-mode=aire]').click();
  await page.locator('#loft').fill('4'); await page.locator('#loft').dispatchEvent('input');
  await waitFor(page, () => criollasDebug.world.guides.target?.flight.some(p => p.height > 3.9));
  await page.evaluate(() => { const d = criollasDebug; d.world.render(d.room.state, { dt: 0, shot: d.shot, active: true }); });
  assert.ok(await page.evaluate(() => {
    const d = criollasDebug, target = d.world.guides.target, drop = d.world.scene.getObjectByName('Landing target');
    return drop.visible && Math.abs(drop.position.z - target.touchdown.z) < .001 && target.path[0].z === target.touchdown.z;
  }));
  assert.ok(await page.locator('#shoot').evaluate(b => b.scrollWidth <= b.clientWidth));
  assert.ok(await page.evaluate(() => {
    const controls = document.querySelector('#controls').getBoundingClientRect(), camera = document.querySelector('#side-controls').getBoundingClientRect();
    return camera.bottom <= controls.top && document.documentElement.scrollWidth <= innerWidth;
  }));
  await mkdir('art/criollas', { recursive: true });
  await page.screenshot({ path: 'art/criollas/air-phone-final.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await waitFor(page, () => criollasDebug.world.renderer.domElement.width >= 1280);
  await page.evaluate(() => { const d = criollasDebug; d.world.render(d.room.state, { dt: 0, shot: d.shot, active: true }); });
  await page.screenshot({ path: 'art/criollas/air-desktop-final.png' });
  await page.evaluate(() => criollasDebug.room.action('difficulty', { difficulty: 'experto' }));
  await waitFor(page, () => !criollasDebug.world.scene.getObjectByName('Landing target').visible && !criollasDebug.world.scene.getObjectByName('Stopping target').visible);
  assert.deepEqual(page.errors, []);
  console.log('PASS adjustable 3D flight, distinct landing/roll, phone fit and hidden expert targets');
} finally { await browser.close(); }
