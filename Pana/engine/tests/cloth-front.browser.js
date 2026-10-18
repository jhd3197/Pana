// Compare the accelerated sampler against the original triangle-ray algorithm.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
try {
  const page = await browser.newPage();
  await page.goto(`${process.env.PANA_TEST_URL || 'http://localhost:8461'}/studio/settings.html`);
  await page.setContent(`<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>`);
  const results = await page.evaluate(async () => {
    const THREE = await import('three');
    const { buildSoftCharacter } = await import('/engine/models/characters/pana/model.js');
    const { clothDepths } = await import('/engine/models/characters/pana/cloth-front.js');
    const results = [];
    for (const quality of ['game', 'studio']) {
      const model = buildSoftCharacter({ quality });
      for (const style of ['hoodie', 'tropical', 'sport']) {
        const geometry = model.wardrobe.tops[style].garment.geometry;
        const t = performance.now();
        const { depths, nx, ny, minX, minY, width, height } = clothDepths(geometry);
        const acceleratedMs = performance.now() - t;
        const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        const proxy = new THREE.Mesh(geometry, material), ray = new THREE.Raycaster();
        proxy.updateMatrixWorld(true);
        let maxError = 0;
        const referenceStart = performance.now();
        for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
          ray.set(new THREE.Vector3(minX + i / nx * width, minY + j / ny * height, 2), new THREE.Vector3(0, 0, -1));
          const hit = ray.intersectObject(proxy, false).find(h => h.point.z > 0);
          maxError = Math.max(maxError, Math.abs(depths[j * (nx + 1) + i] - (hit ? hit.point.z : 0.31)));
        }
        results.push({ quality, style, maxError, acceleratedMs, referenceMs: performance.now() - referenceStart });
        material.dispose();
      }
      model.dispose();
    }
    return results;
  });
  for (const r of results) assert.ok(r.maxError < 1e-7, `${r.quality}/${r.style}: ${r.maxError}`);
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
