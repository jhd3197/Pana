// Independent clothing/headwear/eyewear/wristband integration checks.
// Run with the same Playwright and Chrome arguments as studio.browser.js.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const output = process.env.PANA_QA_OUTPUT || 'art/character/mix';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const garments = ['shirt', 'chef', 'hoodie', 'tropical', 'sport'], hats = ['none', 'cap', 'chef', 'band'];
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${process.env.PANA_QA_URL || 'http://localhost:8461'}/personaje.html`);
  await page.waitForFunction(() => window.panaStudio?.renderer.info.render.triangles > 0);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const snapshot = async name => {
    await page.evaluate(() => window.scrollTo(0, 0)); await settle();
    await page.screenshot({ path: `${output}/${name}.png` });
  };
  const identity = await page.evaluate(() => [panaStudio.pana.head.uuid, panaStudio.pana.body.uuid, ...panaStudio.pana.arms.map(a => a.uuid)]);
  for (const garment of garments) {
    await page.locator('#garment').selectOption(garment);
    for (const hat of hats) {
      await page.locator(`[data-headwear="${hat}"]`).click();
      for (const glasses of ['none', 'round', 'sun']) {
        await page.locator(`[data-glasses="${glasses}"]`).click();
        for (const wrists of [false, true]) {
          await page.locator('#wristbands').setChecked(wrists); await settle();
          const result = await page.evaluate(() => {
            const p = panaStudio.pana, w = p.wardrobe;
            return {
              garment: w.outfit, hat: w.headwear, glasses: p.eyewear.style, wrists: w.wristbands,
              tops: Object.entries(w.tops).filter(([, t]) => t.group.visible).map(([id]) => id),
              apron: w.chef.apron.visible,
              hats: [w.chef.hat, w.details.cap, w.details.sports].map(g => g.visible),
              wristsVisible: w.details.wrists.every(g => g.visible),
              wristFits: w.details.wrists.map(g => g.children.filter(c => c.visible).map(c => c.name)),
              armStart: p.arms[0].getObjectByName('Arm and mitten').geometry.drawRange.start,
            };
          });
          assert.deepEqual([result.garment, result.hat, result.glasses, result.wrists], [garment, hat, glasses, wrists]);
          assert.deepEqual(result.tops, garment === 'chef' ? [] : [garment]);
          assert.equal(result.apron, garment === 'chef');
          assert.deepEqual(result.hats, ['chef', 'cap', 'band'].map(id => id === hat));
          assert.equal(result.wristsVisible, wrists);
          assert.deepEqual(result.wristFits, Array.from({ length: 2 }, () => [garment === 'hoodie' ? 'Long sleeve wrist fit' : 'Bare wrist fit']));
          assert.equal(result.armStart, garment === 'hoodie' ? 6000 : ['shirt', 'tropical'].includes(garment) ? 3840 : 0);
        }
      }
    }
  }
  assert.deepEqual(await page.evaluate(() => [panaStudio.pana.head.uuid, panaStudio.pana.body.uuid, ...panaStudio.pana.arms.map(a => a.uuid)]), identity);
  // Warm the optional mouth surfaces before the later wave opens the smile.
  await page.locator('[data-expression="smile"]').click(); await settle();
  await page.locator('[data-expression="natural"]').click(); await settle();
  const memory = await page.evaluate(() => ({ ...panaStudio.renderer.info.memory }));

  await page.locator('#reset').click();
  await page.locator('[data-headwear="cap"]').click();
  assert.equal(await page.locator('#customization-status').isVisible(), true);
  assert.equal(await page.locator('[data-outfit][aria-pressed="true"]').count(), 0);
  assert.equal(await page.locator('#garment').inputValue(), 'shirt');
  await snapshot('franela-cap');
  await page.locator('[data-headwear-color="#7da941"]').click();
  assert.deepEqual(await page.evaluate(() => {
    const w = panaStudio.pana.wardrobe;
    return [w.color, w.headwearColor, w.tops.hoodie.cloth.color.getHexString(), w.details.cap.getObjectByName('Paneled cap crown').material[0].color.getHexString()];
  }), ['#ee3024', '#7da941', '3479cb', '7da941']);
  await page.locator('#garment').selectOption('hoodie');
  assert.deepEqual(await page.evaluate(() => [panaStudio.pana.wardrobe.headwear, panaStudio.pana.wardrobe.headwearColor]), ['cap', '#7da941']);
  await page.locator('[data-color="#9165b4"]').click();
  assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.headwearColor), '#7da941');
  await page.locator('#wristbands').check();
  await snapshot('hoodie-custom');

  await page.locator('#garment').selectOption('chef');
  await page.locator('[data-headwear="chef"]').click();
  await page.locator('[data-color="#3479cb"]').click();
  await page.locator('[data-headwear-color="#9165b4"]').click();
  assert.deepEqual(await page.evaluate(() => {
    const w = panaStudio.pana.wardrobe;
    return [w.chef.apron.getObjectByName('Curved apron').material.color.getHexString(), w.chef.hat.getObjectByName('Toque colored emblem').material.color.getHexString()];
  }), ['3479cb', '9165b4']);
  await page.locator('#garment').selectOption('shirt');
  await page.locator('#wristbands').uncheck();
  await page.locator('[data-glasses="round"]').click();
  await snapshot('franela-chef-hat');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#capture').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'pana-personaje.png'); await download.saveAs(`${output}/mixed-export.png`);
  for (const pose of ['wave', 'run']) {
    await page.evaluate(pose => { for (let i = 0; i < 60; i++) panaStudio.pana.update(1 / 60, { pose }); }, pose);
    await snapshot(`mixed-${pose}`);
  }
  await page.evaluate(() => { for (let i = 0; i < 80; i++) panaStudio.pana.update(1 / 60, { pose: 'idle' }); });
  for (const garment of garments) {
    await page.locator(`[data-outfit="${garment}"]`).click(); await settle();
    assert.deepEqual(await page.evaluate(() => [panaStudio.pana.wardrobe.outfit, panaStudio.pana.wardrobe.headwear, panaStudio.pana.wardrobe.wristbands]),
      [garment, { shirt: 'none', chef: 'chef', hoodie: 'cap', tropical: 'none', sport: 'band' }[garment], garment === 'sport']);
    assert.equal(await page.locator('#garment').inputValue(), garment);
    assert.equal(await page.locator('#customization-status').isVisible(), false);
    assert.equal(await page.evaluate(() => panaStudio.pana.eyewear.style), 'round');
  }
  await page.locator('#reset').click();
  assert.deepEqual(await page.evaluate(() => {
    const w = panaStudio.pana.wardrobe;
    return [w.outfit, w.headwear, w.wristbands, w.color, panaStudio.pana.eyewear.style];
  }), ['shirt', 'none', false, '#ee3024', 'none']);
  assert.equal(await page.locator('#headwear-colors').isVisible(), false);
  assert.equal(await page.locator('#garment option[value="base"]').count(), 0);
  assert.deepEqual(await page.evaluate(() => ({ ...panaStudio.renderer.info.memory })), memory);

  for (const width of [950, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('[data-headwear="chef"]').click(); await page.locator('[data-view="front"]').click(); await settle();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const fit = await page.evaluate(() => {
      const { pana, camera } = panaStudio, rect = document.querySelector('canvas').getBoundingClientRect();
      const top = pana.head.position.clone().set(0, 1.44, 0); pana.head.localToWorld(top); top.project(camera);
      const foot = pana.group.position.clone().set(0, 0, 0).project(camera);
      return { top: (1 - top.y) * rect.height / 2, foot: (1 - foot.y) * rect.height / 2,
        controls: document.querySelector('.viewbar').getBoundingClientRect().top - rect.top };
    });
    assert.ok(fit.top > 100 && fit.foot < fit.controls - 10, JSON.stringify(fit));
    await page.evaluate(() => window.scrollTo(0, 0)); await settle();
    await page.screenshot({ path: `${output}/${width === 390 ? 'mobile' : 'laptop'}-mix.png`, fullPage: true });
    await page.locator('[data-headwear="none"]').click();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: 120 combinations, independent colors and pieces, 5 presets, fit variants, rig identity, stable resources, mixed PNG, poses, reset and mobile/laptop framing');
} finally { await browser.close(); }
