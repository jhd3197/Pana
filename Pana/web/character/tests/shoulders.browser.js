// Connected-garment regression and close-up visual checks. Run like studio.browser.js.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url), { chromium } = require(process.argv[2] || 'playwright');
const output = process.env.PANA_QA_OUTPUT || 'art/character/shoulders';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(`${process.env.PANA_QA_URL || 'http://localhost:8461'}/character/reference.html`);
  await p.waitForFunction(() => !!window.panaStudio);
  for (const style of ['shirt', 'hoodie', 'tropical', 'sport']) {
  const topology = await p.evaluate(style => {
    const g = panaStudio.pana.wardrobe.tops[style].garment.geometry, edgeMap = new Map(), neighbors = new Map();
    const connect = (map, a, b) => { if (!map.has(a)) map.set(a, new Set()); map.get(a).add(b); };
    for (let i = 0; i < g.index.count; i += 3) {
      const face = Array.from({ length: 3 }, (_, j) => g.index.getX(i + j));
      face.forEach((a, j) => {
        const b = face[(j + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
        const e = edgeMap.get(key) || { a, b, count: 0, winding: 0 };
        e.count++; e.winding += a < b ? 1 : -1; edgeMap.set(key, e);
        connect(neighbors, a, b); connect(neighbors, b, a);
      });
    }
    const components = map => {
      const seen = new Set(); let count = 0;
      for (const id of map.keys()) if (!seen.has(id)) {
        count++; const pending = [id]; seen.add(id);
        while (pending.length) for (const n of map.get(pending.pop()) || []) if (!seen.has(n)) { seen.add(n); pending.push(n); }
      }
      return count;
    };
    const boundary = new Map();
    let invalidEdges = 0, invalidWeights = 0;
    for (const e of edgeMap.values()) {
      if (e.count > 2 || (e.count === 2 && e.winding !== 0)) invalidEdges++;
      if (e.count === 1) { connect(boundary, e.a, e.b); connect(boundary, e.b, e.a); }
    }
    const w = g.attributes.skinWeight;
    for (let i = 0; i < w.count; i++) if (Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) > 0.00001) invalidWeights++;
    return { components: components(neighbors), openings: components(boundary), invalidEdges, invalidWeights };
  }, style);
  assert.deepEqual(topology, { components: 1, openings: 4, invalidEdges: 0, invalidWeights: 0 }, style);
  }
  for (const pose of ['idle', 'wave', 'walk', 'run', 'carry']) {
    await p.evaluate(async pose => {
      const { pana, camera, controls } = panaStudio;
      panaStudio.setView('front'); pana.setColor('#7da941');
      for (let i = 0; i < 60; i++) pana.update(1 / 60, { pose });
      camera.position.set(0, 2.05, 5.8); controls.target.set(0, 1.7, 0); controls.update();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, pose);
    await p.screenshot({ path: `${output}/${pose}.png`, clip: { x: 210, y: 320, width: 700, height: 440 }, animations: 'disabled' });
  }
  await p.locator('[data-outfit="chef"]').click();
  assert.equal(await p.evaluate(() => panaStudio.pana.arms.every(a => a.getObjectByName('Arm and mitten').geometry.drawRange.start === 0)), true);
  assert.equal(await p.evaluate(() => panaStudio.pana.wardrobe.foundation.group.visible && panaStudio.pana.arms.every(a => !a.getObjectByName('Arm and mitten').visible)), true);
  assert.deepEqual(errors, []);
  console.log('PASS: four connected tops, four intended openings each, consistent winding/weights, five shirt poses and fuller chef body');
} finally { await browser.close(); }
