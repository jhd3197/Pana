// Mouth geometry, timing and studio integration. Run with the same arguments
// as studio.browser.js, against the existing local server.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const output = process.env.PANA_QA_OUTPUT || 'art/character/expressions';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const errors = [], base = process.env.PANA_QA_URL || 'http://localhost:8461';
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/personaje.html`);
  await page.waitForFunction(() => window.panaStudio?.renderer.info.render.triangles > 0);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const snapshot = async name => {
    await page.evaluate(() => window.scrollTo(0, 0)); await settle();
    await page.screenshot({ path: `${output}/${name}.png` });
  };
  const state = () => page.evaluate(() => {
    const p = panaStudio.pana;
    return { expression: p.mouth.expression, opening: p.mouth.openness,
      teeth: p.mouth.teeth.visible, tongue: p.mouth.tongue.visible, paused: panaStudio.paused };
  });
  assert.deepEqual(await state(), { expression: 'natural', opening: 0, teeth: false, tongue: false, paused: true });
  const identity = await page.evaluate(() => [panaStudio.pana.head.uuid, panaStudio.pana.mouth.lining.geometry.uuid]);
  for (const expression of ['natural', 'smile', 'talk', 'laugh']) {
    await page.locator(`[data-expression="${expression}"]`).click();
    assert.equal(await page.locator(`[data-expression="${expression}"]`).getAttribute('aria-pressed'), 'true');
    assert.equal((await state()).expression, expression);
    const opening = (await state()).opening;
    await page.waitForTimeout(140); assert.equal((await state()).opening, opening, 'Paused expressions must stay still');
    for (const view of ['front', 'three-quarter', 'side']) {
      await page.locator(`[data-view="${view}"]`).click(); await snapshot(`${expression}-${view}`);
    }
  }
  const curves = await page.evaluate(() => {
    const p = panaStudio.pana, result = {};
    for (const expression of ['natural', 'smile', 'talk', 'laugh']) {
      p.setExpression('natural', { immediate: true }); p.setExpression(expression);
      const values = [];
      for (let i = 0; i < 1200; i++) { p.mouth.update(1 / 60, 'idle'); values.push(p.mouth.openness); }
      result[expression] = { min: Math.min(...values), max: Math.max(...values),
        rest: values.filter(v => v < 0.01).length / values.length,
        maxStep: Math.max(...values.slice(1).map((v, i) => Math.abs(v - values[i]))) };
    }
    // Close from a full grin, not just from the default initialization.
    p.setExpression('smile', { immediate: true }); p.setExpression('natural');
    for (let i = 0; i < 60; i++) p.update(1 / 60);
    result.closed = { opening: p.mouth.openness, teeth: p.mouth.teeth.visible, tongue: p.mouth.tongue.visible };
    p.setExpression('natural', { immediate: true });
    const wave = [];
    for (let i = 0; i < 720; i++) { p.mouth.update(1 / 60, 'wave'); wave.push(p.mouth.openness); }
    result.wave = { max: Math.max(...wave), rests: wave.filter(v => v < 0.01).length };
    const geometries = [p.mouth.lining.geometry, p.mouth.tongue.geometry, p.head.getObjectByName('Sculpted head').geometry];
    result.finite = geometries.every(g => [...g.morphAttributes.position, ...g.morphAttributes.normal]
      .every(a => a.count === g.attributes.position.count && a.array.every(Number.isFinite)));
    return result;
  });
  assert.ok(curves.natural.rest > 0.6 && curves.natural.max > 0.4);
  assert.equal(curves.smile.max, 1);
  for (const mode of ['talk', 'laugh']) {
    assert.ok(curves[mode].max > 0.6 && curves[mode].min < 0.01 && curves[mode].rest > 0.15, mode);
    assert.ok(curves[mode].maxStep < 0.2, 'Transitions should be smooth');
  }
  assert.deepEqual(curves.closed, { opening: 0, teeth: false, tongue: false });
  assert.ok(curves.wave.max > 0.6 && curves.wave.rests > 50, 'Waving also needs closed-mouth rests');
  assert.equal(curves.finite, true);

  // Expression choices do not reset clothes, and all accessories follow the face.
  await page.locator('[data-expression="laugh"]').click();
  for (const outfit of ['shirt', 'chef', 'hoodie', 'tropical', 'sport']) {
    await page.locator(`[data-outfit="${outfit}"]`).click();
    for (const glasses of ['none', 'round', 'sun']) {
      await page.locator(`[data-glasses="${glasses}"]`).click(); await settle();
      assert.equal((await state()).expression, 'laugh');
    }
  }
  await page.locator('#garment').selectOption('shirt');
  await page.locator('[data-headwear="chef"]').click();
  await page.locator('[data-glasses="round"]').click();
  await page.locator('[data-expression="natural"]').click();
  assert.equal(await page.evaluate(() => panaStudio.pana.wardrobe.headwear), 'chef');
  assert.deepEqual(await page.evaluate(() => [panaStudio.pana.head.uuid, panaStudio.pana.mouth.lining.geometry.uuid]), identity);
  await page.locator('[data-view="three-quarter"]').click(); await snapshot('natural-custom-outfit');
  const warmed = await page.evaluate(() => ({ ...panaStudio.renderer.info.memory }));
  for (let i = 0; i < 40; i++) {
    await page.evaluate(i => {
      const p = panaStudio.pana;
      p.setExpression(['natural', 'smile', 'talk', 'laugh'][i % 4], { immediate: true });
      p.mouth.update(0.05, 'idle');
    }, i); await settle();
  }
  assert.deepEqual(await page.evaluate(() => ({ ...panaStudio.renderer.info.memory })), warmed);

  // Real animation-loop behavior, including blinking and global pause.
  await page.locator('[data-expression="talk"]').click(); await page.locator('#pause').click();
  const start = (await state()).opening;
  await page.waitForFunction(start => Math.abs(panaStudio.pana.mouth.openness - start) > 0.12, start);
  await page.waitForFunction(() => panaStudio.pana.eyes[0].scale.y < 0.5);
  await page.locator('#pause').click(); const pausedState = await state();
  await page.waitForTimeout(220); assert.deepEqual(await state(), pausedState);
  await page.locator('[data-expression="laugh"]').click();
  await page.locator('[data-pose="wave"]').click();
  await page.waitForFunction(() => panaStudio.pana.armR.rotation.z < -2);
  assert.equal((await state()).expression, 'laugh');
  await page.locator('#reset').click();
  assert.deepEqual(await state(), { expression: 'natural', opening: 0, teeth: false, tongue: false, paused: true });
  assert.deepEqual(await page.evaluate(() => panaStudio.pana.arms.map(a => a.rotation.z)), [0.4, -0.4]);
  await snapshot('natural-studio');
  const downloadPromise = page.waitForEvent('download'); await page.locator('#capture').click();
  await (await downloadPromise).saveAs(`${output}/closed-mouth-export.png`);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, reducedMotion: 'reduce' });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(`${base}/personaje.html`); await mobile.waitForFunction(() => !!window.panaStudio);
  await mobile.locator('[data-expression="talk"]').click();
  assert.equal(await mobile.evaluate(() => panaStudio.paused), true);
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await mobile.locator('[data-expression="natural"]').click();
  await mobile.evaluate(() => window.scrollTo(0, 0)); await mobile.screenshot({ path: `${output}/mobile.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: closed mouth, 4 expressions/3 views, smooth motion and rest intervals, blink/pause, wardrobe independence, stable resources, reset, PNG and mobile/reduced motion');
} finally { await browser.close(); }
