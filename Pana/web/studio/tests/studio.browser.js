// node studio.browser.js [absolute-playwright-package] [browser-executable]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const base = process.env.PANA_QA_URL || 'http://localhost:8461', output = 'art/studio';
await mkdir(output, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
  await page.goto(`${base}/studio.html`);
  await page.locator('#startup').waitFor({ state: 'hidden', timeout: 300000 });
  const assets = await page.evaluate(() => panaLibrary.assets.map(({ id, source, category }) => ({ id, source, category })));
  assert.ok(assets.length >= 50); assert.equal(new Set(assets.map(a => a.id)).size, assets.length);
  await page.screenshot({ path: `${output}/library.png` });
  await page.locator('#search').fill('mazorca'); assert.equal(await page.locator('[data-asset]').count(), 1);
  await page.locator('[data-asset="corn"]').click();
  await page.waitForFunction(() => panaLibrary.selected === 'corn' && document.querySelector('#preview-status').hidden);
  await page.locator('#search').fill('zzzz-missing'); assert.equal(await page.locator('#empty').isVisible(), true);
  await page.locator('#clear-search').click();
  for (const [category, count] of [['Pueblo', 10], ['Páramo', 8], ['Termales', 5], ['Vegetación', 22]]) {
    await page.locator(`[data-category="${category}"]`).click();
    assert.equal(await page.locator('[data-asset]').count(), count, `${category} registrations`);
  }
  await page.locator('[data-category="Todos"]').click();
  await page.locator('#search').fill('051'); assert.equal(await page.locator('[data-asset="frailejon"]').count(), 1);
  await page.locator('#search').fill('');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click(); const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'pana-studio-inventario.json'); await download.saveAs(`${output}/inventory.json`);
  for (const asset of assets) {
    // Map constructors can occupy the main thread during the click itself.
    // Use the same budget as the subsequent preview-ready check.
    await page.locator(`[data-asset="${asset.id}"]`).click({ timeout: 90000 });
    await page.waitForFunction(id => panaLibrary.selected === id && document.querySelector('#preview-status').hidden, asset.id, { timeout: 90000 });
    assert.equal(await page.locator('#source').getAttribute('href'), asset.source);
    assert.equal(await page.evaluate(() => Number.isFinite(panaLibrary.camera.position.length()) && panaLibrary.current.group.children.length > 0), true, asset.id);
    if (['pana-chef', 'car-chamo', 'car-machito', 'plaza', 'track-estadio', 'mangoTree'].includes(asset.id)) await page.screenshot({ path: `${output}/${asset.id}.png` });
    console.log(`preview ${asset.id}`);
  }
  await page.locator('[data-category="Mapas"]').click(); assert.ok(await page.locator('[data-asset]').count() >= 10);
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('[data-category="Personajes"]').click(); await page.locator('[data-asset="pana"]').click();
  await page.waitForFunction(() => panaLibrary.selected === 'pana' && document.querySelector('#preview-status').hidden);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({ path: `${output}/mobile-library.png`, fullPage: true });
  await page.goto(`${base}/personaje.html`); await page.waitForFunction(() => window.panaStudio);
  await page.locator('[data-outfit="hoodie"]').click(); await page.locator('[data-headwear="chef"]').click(); await page.locator('[data-glasses="round"]').click(); await page.locator('#wristbands').check();
  await page.locator('#save-avatar').click(); assert.match(await page.locator('#save-status').innerText(), /guardada/);
  const adapter = await page.evaluate(async () => {
    const { buildCharacter } = await import('/engine/character.js'), { loadAvatar, normalizeAvatar } = await import('/engine/avatar.js');
    const avatar = loadAvatar(), start = performance.now(), model = buildCharacter(avatar);
    const constructionMs = performance.now() - start;
    model.update(1 / 60, { walk: 1, carry: true }); model.group.updateMatrixWorld(true);
    let triangles = 0; model.group.traverseVisible(o => { if (o.isMesh) triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3; });
    const state = { version: model.group.userData.characterVersion, wardrobe: [model.wardrobe.outfit, model.wardrobe.headwear, model.eyewear.style, model.wardrobe.wristbands],
      triangles, constructionMs, avatar, migratedOutfit: normalizeAvatar({ outfit: 'nada' }).outfit };
    model.dispose(); const driver = buildCharacter(avatar, { seated: true }); driver.armL.rotation.set(0.2, 0, 1.3); driver.update(0.1, { open: true });
    state.driver = [driver.armL.rotation.z, driver.legs[0].rotation.x, driver.mouth.openness > 0]; driver.dispose(); return state;
  });
  assert.deepEqual(adapter.wardrobe, ['hoodie', 'chef', 'round', true]); assert.equal(adapter.version, 'studio-v1');
  assert.equal(adapter.migratedOutfit, 'franela'); assert.ok(adapter.triangles < 80000); assert.deepEqual(adapter.driver, [1.3, -Math.PI / 2, true]);
  assert.deepEqual(errors, []); console.log('PASS: all catalog previews, filters, inventory export, mobile, saved wardrobe and standing/seated game adapter', adapter);
} finally { await browser.close(); }
