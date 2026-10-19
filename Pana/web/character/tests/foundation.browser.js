// Fuller exposed-body fit and appearance. Run like studio.browser.js.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const output = process.env.PANA_QA_OUTPUT || 'art/character/foundation';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${process.env.PANA_QA_URL || 'http://localhost:8461'}/character/reference.html`);
  await page.waitForFunction(() => window.panaStudio?.renderer.info.render.triangles > 0);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const screenshot = async (name, close = false) => {
    await page.evaluate(() => window.scrollTo(0, 0)); await settle();
    await page.screenshot({ path: `${output}/${name}.png`, ...(close ? { clip: { x: 230, y: 300, width: 650, height: 500 } } : {}) });
  };
  for (const outfit of ['shirt', 'chef', 'sport', 'tropical', 'hoodie']) {
    await page.locator(`[data-outfit="${outfit}"]`).click();
    assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.foundation.group.visible), ['chef', 'sport', 'tropical'].includes(outfit));
    assert.equal(await page.evaluate(() => panaStudio.pana.body.getObjectByName('Continuous belly and legs').visible), !['chef', 'sport', 'tropical'].includes(outfit));
    assert.equal(await page.evaluate(() => panaStudio.pana.arms.every(a => a.getObjectByName('Arm and mitten').visible)), !['chef', 'sport', 'tropical'].includes(outfit));
    for (const view of ['front', 'three-quarter', 'side', 'back']) {
      await page.locator(`[data-view="${view}"]`).click(); await screenshot(`${outfit}-${view}`);
    }
    if (['chef', 'sport', 'tropical', 'shirt'].includes(outfit)) for (const pose of ['idle', 'wave', 'run', 'carry']) {
      await page.evaluate(pose => {
        const { pana, camera, controls } = panaStudio;
        pana.resetPose();
        if (pose !== 'idle') for (let i = 0; i < 60; i++) pana.update(1 / 60, { pose });
        camera.position.set(0, 2.05, 5.8); controls.target.set(0, 1.7, 0); controls.update();
      }, pose);
      await screenshot(`${outfit}-${pose}-close`, true);
    }
    await page.evaluate(() => panaStudio.pana.resetPose());
  }
  const initial = await page.evaluate(() => ({ ...panaStudio.renderer.info.memory }));
  const anatomy = await page.evaluate(() => {
    const g = panaStudio.pana.wardrobe.foundation.garment.geometry, p = g.attributes.position, w = g.attributes.skinWeight, c = g.attributes.color;
    let invalidWeights = 0, brownLegs = 0;
    for (let i = 0; i < p.count; i++) {
      if (Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) > 0.00001) invalidWeights++;
      if (p.getY(i) < 0.65 && c.getX(i) < 0.5) brownLegs++;
    }
    return { finite: p.array.every(Number.isFinite) && g.attributes.normal.array.every(Number.isFinite), invalidWeights, brownLegs };
  });
  assert.deepEqual(anatomy, { finite: true, invalidWeights: 0, brownLegs: 0 });
  const furColor = await page.evaluate(() => panaStudio.pana.wardrobe.foundation.cloth.color.getHexString());
  await page.locator('[data-outfit="chef"]').click(); await page.locator('[data-color="#3479cb"]').click();
  assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.foundation.cloth.color.getHexString()), furColor);
  assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.foundation.group.children.some(c => ['Hem', 'Neck binding', 'Sleeve hem'].includes(c.name))), false);
  for (let i = 0; i < 15; i++) {
    await page.evaluate(i => { panaStudio.pana.setOutfit(['shirt', 'chef', 'sport', 'tropical', 'hoodie'][i % 5]); panaStudio.pana.update(1 / 60); }, i); await settle();
  }
  assert.deepEqual(await page.evaluate(() => ({ ...panaStudio.renderer.info.memory })), initial);
  await page.locator('[data-outfit="chef"]').click(); await page.locator('[data-color="#ee3024"]').click();
  await page.locator('[data-headwear-color="#ee3024"]').click();
  await page.locator('[data-view="three-quarter"]').click(); await page.evaluate(() => panaStudio.pana.resetPose());
  await screenshot('chef-finished');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-view="front"]').click(); await settle();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await screenshot('chef-mobile');
  assert.deepEqual(errors, []);
  console.log('PASS: foundation visibility, five outfits/four views, exposed-body poses, fur color independence, no clothing bindings, stable resources and no browser errors');
  console.log('Chef render:', await page.evaluate(() => ({ triangles: panaStudio.renderer.info.render.triangles, calls: panaStudio.renderer.info.render.calls })));
} finally { await browser.close(); }
