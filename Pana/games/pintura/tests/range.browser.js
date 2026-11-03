// The armory's shooting range in a real page: Probar opens a first-person lane
// with the saved kit, shots land on the 10 and 50 m targets with their distance,
// the 100 m board is past El Tuqueque's range (the ball falls short where the
// rules say), splats show, the HUD pieces never overlap at four sizes, and Esc or
// Volver leave the armory exactly as it was with the range's WebGL context gone.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const SIZES = [[1280, 720], [1920, 1080], [1024, 600]];
// Runs in the page: the range's HUD pieces that show, any that leave the screen, any two that overlap.
function layout() {
  const read = document.getElementById('range-read'); read.hidden = false; read.querySelector('b').textContent = '100 m'; read.querySelector('span').textContent = '3 pepazos';
  const ids = ['range-back', 'range-reset', 'range-read', 'range-ammo', 'range-cross', 'range-fire', 'range-aim', 'range-reload', 'range-grenade'];
  const boxes = ids.map(id => [id, document.getElementById(id)]).filter(([, el]) => el && el.checkVisibility()).map(([id, el]) => [id, el.getBoundingClientRect()]);
  const off = boxes.filter(([, r]) => r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight).map(([id]) => id), overlaps = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const [a, r] = boxes[i], [b, q] = boxes[j], w = Math.min(r.right, q.right) - Math.max(r.left, q.left), h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
    if (w > 2 && h > 2) overlaps.push(`${a}|${b}`);
  }
  const round = [...document.querySelectorAll('#range *')].filter(el => !el.closest('.pk-scope') && parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0).length;
  return { shown: boxes.map(([id]) => id), off, overlaps, round };
}
const frames = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function enter(page) {
  await page.evaluate(() => localStorage.setItem('pintura:kit', JSON.stringify({ weapon: 'bullpup' })));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitFor(page, () => window.pinturaDebug?.room.connected && window.PANA_PREPARED === true, null, 120_000);
  await page.locator('#open-armory').click();
  const name = await page.locator('#armory-name').textContent();
  await page.locator('#armory-range').click();
  await waitFor(page, () => pinturaDebug.armory.range?.ready && pinturaDebug.armory.range.view.renderer.info.render.calls > 0);
  return name;
}
const browser = await launch();
try {
  const page = await openGame(browser, 'pintura', { name: 'Tiro', query: 'debug', wait: false });
  const name = await enter(page);
  assert.match(name, /Tuqueque/);
  // The 10 m target and the moving one at 50 m, then the 100 m board.
  await page.evaluate(() => pinturaDebug.armory.range.debugShoot([0, 3], 6));
  await waitFor(page, () => !pinturaDebug.armory.range.busy);
  const shot = await page.evaluate(() => { const r = pinturaDebug.armory.range, info = r.view.renderer.info.render; return { on: r.stats.on, splats: r.view.splats, read: document.getElementById('range-read').textContent, calls: info.calls, tris: info.triangles }; });
  assert.ok(shot.on[10] > 0 && shot.on[50] > 0, `hits by target ${JSON.stringify(shot.on)}`);
  assert.ok(shot.splats >= 2, 'paint stays on the targets');
  assert.match(shot.read, /\d+ m/);
  assert.ok(shot.calls < 140, `${shot.calls} draw calls`);
  await page.evaluate(() => pinturaDebug.armory.range.debugShoot([5], 1));
  await waitFor(page, () => !pinturaDebug.armory.range.busy && pinturaDebug.armory.range.stats.short != null);
  const short = await page.evaluate(() => ({ at: pinturaDebug.armory.range.stats.short, on: pinturaDebug.armory.range.stats.on[100] || 0 }));
  assert.equal(short.on, 0); assert.ok(Math.abs(short.at - 61) <= 3, `fell short at ${short.at} m`);
  // T resets the targets.
  await page.keyboard.press('t');
  assert.equal(await page.evaluate(() => pinturaDebug.armory.range.view.splats), 0);
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height }); await frames(page);
    const l = await page.evaluate(layout);
    assert.deepEqual(l.overlaps, [], `${width}×${height}`); assert.deepEqual(l.off, [], `${width}×${height}`); assert.equal(l.round, 0, 'square corners');
  }
  // Esc leaves the range, not the armory; the armory is as it was and the range's context is gone.
  await page.evaluate(() => { window.rangeRenderer = pinturaDebug.armory.range.view.renderer; });
  await page.keyboard.press('Escape');
  await waitFor(page, () => !document.getElementById('range') && !pinturaDebug.armory.ranging);
  const after = await page.evaluate(() => ({ open: document.getElementById('armory').open, name: document.getElementById('armory-name').textContent, lost: window.rangeRenderer.getContext().isContextLost() }));
  assert.deepEqual(after, { open: true, name, lost: true });
  // Again, out through Volver.
  await page.locator('#armory-range').click();
  await waitFor(page, () => pinturaDebug.armory.range?.ready);
  await page.locator('#range-back').click();
  await waitFor(page, () => !document.getElementById('range'));
  assert.equal(await page.evaluate(() => document.getElementById('armory').open), true);
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // A phone held upright: the touch buttons show, nothing overlaps, Pinta fires.
  const phone = await openGame(browser, 'pintura', { name: 'Tel', query: 'debug', mobile: true, wait: false });
  await enter(phone); await frames(phone);
  const l = await phone.evaluate(layout);
  assert.ok(l.shown.includes('range-fire'), 'touch buttons on a phone');
  assert.deepEqual(l.overlaps, []); assert.deepEqual(l.off, []);
  const before = await phone.evaluate(() => pinturaDebug.armory.range.sim.me.fired);
  const box = await phone.locator('#range-fire').boundingBox();
  await phone.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await waitFor(phone, n => pinturaDebug.armory.range.sim.me.fired > n, before);
  assert.deepEqual(phone.errors, []);
  console.log('range: hits', JSON.stringify(shot.on), '· short at', short.at, 'm ·', shot.calls, 'calls ·', shot.tris, 'triangles');
} finally {
  await browser.close();
}
