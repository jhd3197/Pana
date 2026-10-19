// Wardrobe changes must preserve the body projection and an articulated underarm.
// Run with the same Playwright/browser arguments as studio.browser.js.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const output = process.env.PANA_QA_OUTPUT || 'art/character/proportions';
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
  const snapshot = () => page.evaluate(() => {
    const { pana, camera, controls } = panaStudio, height = document.querySelector('canvas').clientHeight;
    const foot = pana.group.localToWorld(pana.group.position.clone().set(0, 0, 0)).project(camera);
    const top = pana.group.localToWorld(pana.group.position.clone().set(0, 3.5, 0)).project(camera);
    return { camera: [...camera.position, ...camera.quaternion, ...controls.target, camera.zoom, camera.fov],
      bodyPixels: (top.y - foot.y) * height / 2,
      scales: [pana.group, pana.body, pana.head, ...pana.arms, ...pana.legs].flatMap(o => o.scale.toArray()) };
  });
  const sameProjection = (actual, expected, label) => {
    assert.ok(Math.abs(actual.bodyPixels - expected.bodyPixels) < 0.00001, `${label}: body changed size`);
    actual.camera.forEach((v, i) => assert.ok(Math.abs(v - expected.camera[i]) < 1e-8, `${label}: camera moved`));
    assert.deepEqual(actual.scales, expected.scales, `${label}: rig was scaled`);
  };
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 950, height: 844 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport); await page.locator('[data-view="front"]').click(); await settle();
    const baseline = await snapshot();
    for (const garment of ['shirt', 'chef', 'hoodie', 'tropical', 'sport']) {
      await page.locator(`[data-outfit="${garment}"]`).click(); await settle();
      sameProjection(await snapshot(), baseline, `${viewport.width}/${garment}/preset`);
      for (const hat of ['none', 'chef', 'cap', 'band']) {
        await page.locator(`[data-headwear="${hat}"]`).click(); await settle();
        sameProjection(await snapshot(), baseline, `${viewport.width}/${garment}/${hat}`);
      }
    }
    await page.locator('[data-headwear="chef"]').click();
    const fit = await page.evaluate(() => {
      const { pana, camera } = panaStudio, rect = document.querySelector('canvas').getBoundingClientRect();
      const top = pana.head.localToWorld(pana.head.position.clone().set(0, 1.44, 0)).project(camera);
      const foot = pana.group.localToWorld(pana.group.position.clone().set(0, 0, 0)).project(camera);
      return { top: (1 - top.y) * rect.height / 2, foot: (1 - foot.y) * rect.height / 2,
        controls: document.querySelector('.viewbar').getBoundingClientRect().top - rect.top };
    });
    assert.ok(fit.top > 100 && fit.foot < fit.controls - 10, `Hat/feet clearance ${JSON.stringify(fit)}`);
    // A user's custom zoom and orbit must survive the same change, too.
    await page.locator('canvas').press('ArrowLeft'); await page.locator('canvas').press('ArrowUp'); await settle();
    const custom = await snapshot();
    await page.locator('[data-headwear="none"]').click(); await page.locator('[data-outfit="chef"]').click(); await settle();
    sameProjection(await snapshot(), custom, `${viewport.width}/custom orbit`);
  }

  const articulation = await page.evaluate(() => {
    const { pana } = panaStudio, mesh = pana.wardrobe.foundation.garment, p = mesh.geometry.attributes.position;
    const point = pana.group.position.clone(), rest = new Float32Array(p.count * 3);
    pana.resetPose(); pana.group.updateMatrixWorld(true); mesh.skeleton.update();
    for (let i = 0; i < p.count; i++) {
      mesh.applyBoneTransform(i, point.fromBufferAttribute(p, i)); point.toArray(rest, i * 3);
    }
    let flankSamples = 0, maxFlankMovement = 0, forearmSamples = 0, maxForearmError = 0;
    for (const pose of ['wave', 'run', 'carry']) {
      pana.resetPose();
      for (let frame = 0; frame < 60; frame++) pana.update(1 / 60, { pose });
      // Isolate arm movement: the torso/legs must not get dragged by the arms.
      pana.body.position.set(0, 0, 0); pana.body.rotation.set(0, 0, 0);
      pana.legs.forEach(leg => leg.rotation.set(0, 0, 0));
      pana.group.updateMatrixWorld(true); mesh.skeleton.update();
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        mesh.applyBoneTransform(i, point.fromBufferAttribute(p, i));
        if (y > 0.95 && y < 1.30 && Math.abs(x) > 0.45) {
          flankSamples++;
          maxFlankMovement = Math.max(maxFlankMovement, Math.hypot(point.x - rest[i * 3], point.y - rest[i * 3 + 1], point.z - rest[i * 3 + 2]));
        }
        if (Math.abs(x) > 1.10) {
          const bone = x > 0 ? 3 : 4;
          const rigid = pana.group.position.clone().fromBufferAttribute(p, i)
            .applyMatrix4(mesh.skeleton.boneInverses[bone]).applyMatrix4(mesh.skeleton.bones[bone].matrixWorld);
          forearmSamples++; maxForearmError = Math.max(maxForearmError, point.distanceTo(rigid));
        }
      }
    }
    pana.resetPose();
    return { flankSamples, maxFlankMovement, forearmSamples, maxForearmError };
  });
  assert.ok(articulation.flankSamples > 100 && articulation.maxFlankMovement < 0.015, JSON.stringify(articulation));
  assert.ok(articulation.forearmSamples > 100 && articulation.maxForearmError < 0.005, JSON.stringify(articulation));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('[data-outfit="chef"]').click(); await page.locator('[data-view="front"]').click();
  for (const hat of ['chef', 'none']) {
    await page.locator(`[data-headwear="${hat}"]`).click(); await page.evaluate(() => window.scrollTo(0, 0)); await settle();
    await page.screenshot({ path: `${output}/chef-${hat === 'chef' ? 'hat' : 'no-hat'}.png` });
  }
  for (const garment of ['chef', 'sport', 'tropical']) {
    await page.locator(`[data-outfit="${garment}"]`).click();
    await page.evaluate(() => { panaStudio.pana.resetPose(); for (let i = 0; i < 60; i++) panaStudio.pana.update(1 / 60, { pose: 'wave' }); });
    for (const view of ['front', 'three-quarter', 'back']) {
      await page.locator(`[data-view="${view}"]`).click(); await page.evaluate(() => window.scrollTo(0, 0)); await settle();
      await page.screenshot({ path: `${output}/${garment}-wave-${view}.png` });
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: constant body projection/camera across every garment and hat at desktop/laptop/mobile, preserved custom orbit/zoom, hat clearance and stable flank/forearm articulation');
  console.log(articulation);
} finally { await browser.close(); }
