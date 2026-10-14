// Wardrobe integration and visual review. Run like studio.browser.js.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const output = process.env.PANA_QA_OUTPUT || 'art/character/wardrobe';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const errors = [];
const outfits = ['shirt', 'chef', 'hoodie', 'tropical', 'sport'];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${process.env.PANA_QA_URL || 'http://localhost:8461'}/personaje.html`);
  await page.waitForFunction(() => window.panaStudio?.renderer.info.render.triangles > 0);
  assert.equal(await page.locator('[data-outfit="base"]').count(), 0);
  const identity = await page.evaluate(() => [panaStudio.pana.head.uuid, panaStudio.pana.body.uuid, ...panaStudio.pana.arms.map(a => a.uuid)]);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  for (const outfit of outfits) {
    await page.locator(`[data-outfit="${outfit}"]`).click();
    for (const glasses of ['none', 'round', 'sun']) {
      await page.locator(`[data-glasses="${glasses}"]`).click();
      await settle();
      const state = await page.evaluate(() => {
        const p = panaStudio.pana;
        return { outfit: p.wardrobe.outfit, glasses: p.eyewear.style, chef: p.wardrobe.chef.apron.visible && p.wardrobe.chef.hat.visible, shirt: p.wardrobe.shirt.visible,
          armStart: p.arms[0].getObjectByName('Arm and mitten').geometry.drawRange.start,
          headAttachments: p.wardrobe.chef.hat.parent === p.head && p.eyewear.root.parent === p.head,
          visibleGlasses: Object.values(p.eyewear.variants).filter(g => g.visible).length,
          visibleTops: Object.entries(p.wardrobe.tops).filter(([, t]) => t.group.visible).map(([id]) => id),
          cap: p.wardrobe.details.cap.visible, sports: p.wardrobe.details.sports.visible,
          wrists: p.wardrobe.details.wrists.every(w => w.visible),
          capParent: p.wardrobe.details.cap.parent === p.head };
      });
      assert.equal(state.outfit, outfit); assert.equal(state.glasses, glasses);
      assert.equal(state.chef, outfit === 'chef'); assert.equal(state.shirt, outfit === 'shirt');
      assert.equal(state.armStart === 0, ['chef', 'sport'].includes(outfit)); assert.equal(state.headAttachments, true);
      assert.deepEqual(state.visibleTops, outfit === 'chef' ? [] : [outfit]);
      assert.equal(state.cap, outfit === 'hoodie'); assert.equal(state.capParent, true);
      assert.equal(state.sports, outfit === 'sport'); assert.equal(state.wrists, outfit === 'sport');
      assert.equal(state.visibleGlasses, glasses === 'none' ? 0 : 1);
      await page.screenshot({ path: `${output}/${outfit}-${glasses}.png` });
    }
  }
  // Color is remembered per look; printed flowers and ivory sports fabric stay light.
  await page.locator('[data-outfit="hoodie"]').click(); await page.locator('[data-color="#7da941"]').click();
  await page.locator('[data-outfit="tropical"]').click();
  assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.color), '#3479cb');
  await page.locator('[data-color="#9165b4"]').click();
  assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.tops.tropical.cloth.color.getHexString()), 'ffffff');
  await page.locator('[data-outfit="hoodie"]').click();
  assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.color), '#7da941');
  assert.equal(await page.locator('[data-color="#7da941"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-outfit="chef"]').click();
  await page.locator('[data-color="#3479cb"]').click();
  assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.chef.apron.getObjectByName('Curved apron').material.color.getHexString()), '3479cb');
  assert.equal(await page.evaluate(() => panaStudio.pana.eyewear.style), 'sun');
  for (const view of ['front', 'side', 'back']) {
    await page.locator(`[data-view="${view}"]`).click(); await settle();
    await page.screenshot({ path: `${output}/chef-${view}.png` });
  }
  await page.locator('[data-view="three-quarter"]').click();
  await page.locator('[data-glasses="round"]').click();
  for (const pose of ['wave', 'walk', 'run', 'carry']) {
    await page.evaluate(pose => {
      const p = panaStudio.pana;
      for (let i = 0; i < 60; i++) p.update(1 / 60, { pose });
      if (pose === 'walk' || pose === 'run') {
        // Review cloth clearance at an extended stride, not a passing neutral frame.
        const target = pose === 'run' ? 0.42 : 0.32;
        for (let i = 0; i < 120 && Math.abs(p.legs[0].rotation.x) < target; i++) p.update(1 / 60, { pose });
      }
    }, pose);
    await settle(); await page.screenshot({ path: `${output}/chef-${pose}.png` });
    assert.equal(await page.evaluate(() => panaStudio.pana.eyewear.root.visible), true);
  }
  assert.deepEqual(await page.evaluate(() => [panaStudio.pana.head.uuid, panaStudio.pana.body.uuid, ...panaStudio.pana.arms.map(a => a.uuid)]), identity);
  const memory = await page.evaluate(() => panaStudio.renderer.info.memory.geometries);
  for (let i = 0; i < 30; i++) {
    await page.evaluate(({ i, outfits }) => {
      panaStudio.pana.setOutfit(outfits[i % outfits.length]);
      panaStudio.pana.setGlasses(['none', 'round', 'sun'][i % 3]);
      panaStudio.pana.update(1 / 60);
    }, { i, outfits }); await settle();
  }
  assert.equal(await page.evaluate(() => panaStudio.renderer.info.memory.geometries), memory);
  await page.locator('#reset').click();
  assert.deepEqual(await page.evaluate(() => [panaStudio.pana.wardrobe.outfit, panaStudio.pana.eyewear.style, panaStudio.pana.wardrobe.color]), ['shirt', 'none', '#ee3024']);
  assert.equal(await page.locator('[data-glasses="none"]').getAttribute('aria-pressed'), 'true');
  for (const outfit of ['hoodie', 'tropical', 'sport']) {
    await page.locator(`[data-outfit="${outfit}"]`).click();
    await page.locator(`[data-glasses="${outfit === 'tropical' ? 'sun' : 'none'}"]`).click();
    for (const view of ['front', 'side', 'back', 'three-quarter']) {
      await page.locator(`[data-view="${view}"]`).click(); await settle();
      await page.screenshot({ path: `${output}/${outfit}-${view}.png` });
    }
    for (const pose of ['wave', 'run', 'carry']) {
      await page.evaluate(pose => {
        const p = panaStudio.pana;
        for (let i = 0; i < 60; i++) p.update(1 / 60, { pose });
        if (pose === 'run') for (let i = 0; i < 120 && Math.abs(p.legs[0].rotation.x) < 0.42; i++) p.update(1 / 60, { pose });
      }, pose); await settle();
      await page.screenshot({ path: `${output}/${outfit}-${pose}.png` });
    }
    await page.evaluate(() => { for (let i = 0; i < 80; i++) panaStudio.pana.update(1 / 60, { pose: 'idle' }); });
  }
  await page.locator('#reset').click();
  for (const width of [950, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('[data-outfit="chef"]').click();
    await page.locator('[data-view="front"]').click();
    await page.locator('[data-glasses="round"]').click(); await settle();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const fit = await page.evaluate(() => {
      const { pana, camera } = panaStudio, canvas = document.querySelector('canvas').getBoundingClientRect();
      const top = pana.head.position.clone().set(0, 1.44, 0); pana.head.localToWorld(top); top.project(camera);
      const foot = pana.group.position.clone().set(0, 0, 0); foot.project(camera);
      return { top: (1 - top.y) * canvas.height / 2, foot: (1 - foot.y) * canvas.height / 2,
        controlsTop: document.querySelector('.viewbar').getBoundingClientRect().top - canvas.top };
    });
    assert.ok(fit.top > 100, `Hat needs room above it: ${JSON.stringify(fit)}`);
    assert.ok(fit.foot < fit.controlsTop - 10, `Feet should clear controls: ${JSON.stringify(fit)}`);
    await page.screenshot({ path: `${output}/${width === 390 ? 'mobile' : 'laptop'}.png`, fullPage: true });
    await page.locator('[data-outfit="hoodie"]').click(); await page.locator('[data-view="three-quarter"]').click(); await settle();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${output}/${width === 390 ? 'mobile' : 'laptop'}-hoodie.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 15 outfit/lens combinations, remembered colors, outfit attachments, poses, rig identity, resource reuse, reset, mobile/laptop framing and no browser errors');
} finally { await browser.close(); }
