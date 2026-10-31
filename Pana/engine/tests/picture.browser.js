// Picture settings in a real game: address settings apply without being saved,
// shadows off reaches the renderer and halves nothing it should not, the
// stats overlay and engine/perf.js report the frame, the Imagen page edits the
// knobs and offers a reload for what waits for one, and the FPS cap skips
// frames without losing the last one.
import assert from 'node:assert/strict';
import { launch, base, openGame, waitPrepared } from '../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'domino', { query: 'pana-shadows=off&pana-stats', wait: false });
  await waitPrepared(page);
  const start = await page.evaluate(async () => {
    const s = await import('/engine/settings.js'), perf = await import('/engine/perf.js');
    const renderer = s.boundRenderers()[0];
    return { shadows: s.getSettings().shadows, quality: s.getSettings().quality, enabled: renderer.shadowMap.enabled,
      saved: JSON.parse(localStorage.getItem('pana:settings')).shadows, frame: await perf.measureFrame(5) };
  });
  assert.equal(start.shadows, 'off'); assert.equal(start.quality, 'custom');
  assert.equal(start.enabled, false, 'shadows off reaches the bound renderer');
  assert.notEqual(start.saved, 'off', 'address settings are not saved');
  await page.locator('.pana-perf').waitFor();
  assert.match(await page.locator('.pana-perf').innerText(), /llamadas/);
  console.log('PASS address settings apply to this page only; overlay shows');

  // The Imagen page: picking shadows by hand replaces the address's value,
  // drops it from the address and draws them again.
  await page.keyboard.press('Escape');
  await page.locator('.pana-menu[open]').waitFor();
  await page.locator('#pana-tab-settings').click();
  await page.locator('.pana-settings-workspace').waitFor();
  await page.locator('.pana-settings-nav button', { hasText: 'Imagen' }).click();
  assert.equal(await page.getByRole('tab', { name: 'Ayudas', exact: true }).count(), 0, 'input hints stay on the device pages');
  assert.match(await page.locator('.pana-image-status').innerText(), /se dibuja a \d+×\d+/);
  // Q / E step through the category's tabs from anywhere in Ajustes.
  const selected = () => page.locator('.pana-setting-tab[aria-selected=true]').innerText();
  await page.keyboard.press('KeyE'); assert.match(await selected(), /rendimiento/i);
  await page.keyboard.press('KeyQ'); assert.match(await selected(), /calidad/i);
  await page.getByRole('radiogroup', { name: 'Sombras' }).getByRole('radio', { name: 'Bajas' }).click();
  const after = await page.evaluate(async () => {
    const s = await import('/engine/settings.js'), perf = await import('/engine/perf.js');
    return { enabled: s.boundRenderers()[0].shadowMap.enabled, search: location.search, saved: JSON.parse(localStorage.getItem('pana:settings')).shadows, frame: await perf.measureFrame(5) };
  });
  assert.equal(after.enabled, true); assert.equal(after.saved, 'baja');
  assert.doesNotMatch(after.search, /pana-shadows/, 'a hand-picked value leaves the address');
  assert.ok(after.frame.draws > start.frame.draws, `shadow passes draw again (${start.frame.draws} → ${after.frame.draws})`);
  // Shadow size and smoothing wait for a reload: in a game the page says so
  // and offers it, and only while the choice differs from what was loaded.
  const note = () => page.locator('.pana-reload-note').isVisible();
  assert.equal(await note(), false, 'Bajas draws the same size as the loaded (off) shadows');
  await page.getByRole('radiogroup', { name: 'Sombras' }).getByRole('radio', { name: 'Altas' }).click();
  assert.equal(await note(), true, 'a new shadow size offers a reload');
  await page.getByRole('radiogroup', { name: 'Sombras' }).getByRole('radio', { name: 'Bajas' }).click();
  await page.getByRole('switch', { name: 'Suavizado de bordes' }).click();
  assert.equal(await note(), true, 'smoothing offers a reload');
  await page.getByRole('switch', { name: 'Suavizado de bordes' }).click();
  await page.getByRole('radiogroup', { name: 'Calidad' }).getByRole('radio', { name: 'Rápida' }).click();
  assert.equal(await note(), false, 'back to what was loaded, no reload needed');
  assert.equal(await page.evaluate(async () => (await import('/engine/settings.js')).getSettings().quality), 'baja');
  console.log('PASS Imagen page edits knobs, tidies the address and offers a reload only when needed');

  // FPS cap: a continuously drawing renderer skips frames, and a frame drawn
  // after the game stops is still painted once the interval has passed.
  const cap = await page.evaluate(async () => {
    const THREE = await import('three'), s = await import('/engine/settings.js');
    const renderer = new THREE.WebGLRenderer(s.rendererOptions()); s.bindRenderer(renderer, 1, { fit: 'canvas' });
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
    const run = async n => { const from = renderer.info.render.frame, t = performance.now(); for (let i = 0; i < n; i++) await new Promise(r => requestAnimationFrame(() => { renderer.render(scene, camera); r(); })); return { drawn: renderer.info.render.frame - from, ms: (performance.now() - t) / n }; };
    const free = await run(60);
    s.setSettings({ fpsCap: 30 });
    const capped = await run(60);
    const before = renderer.info.render.frame;
    renderer.render(scene, camera); renderer.render(scene, camera);
    await new Promise(r => setTimeout(r, 120));
    const flushed = renderer.info.render.frame - before;
    s.setSettings({ fpsCap: 0 });
    return { free, capped, flushed };
  });
  assert.equal(cap.free.drawn, 60);
  if (cap.capped.ms < 25) assert.ok(cap.capped.drawn <= 40, `30 fps cap at ${(1000 / cap.capped.ms).toFixed(0)} Hz drew ${cap.capped.drawn} of 60`);
  assert.ok(cap.flushed >= 1, 'the last skipped frame is painted');
  console.log('PASS FPS cap skips frames and paints the last one');

  // The frame-rate guard stays at full resolution when it is turned off.
  const guard = await page.evaluate(async () => {
    const s = await import('/engine/settings.js');
    s.setSettings({ autoScale: false });
    const until = performance.now() + 5000;   // more than the guard's 90-frame window at 40 ms
    while (performance.now() < until) await new Promise(r => requestAnimationFrame(() => { const t = performance.now() + 40; while (performance.now() < t); r(); }));
    return s.renderStep();
  });
  assert.equal(guard, 0, 'slow frames leave the resolution alone with the guard off');
  console.log('PASS frame-rate guard switch');
  assert.deepEqual(page.errors, []);
} finally {
  await browser.close();
}
