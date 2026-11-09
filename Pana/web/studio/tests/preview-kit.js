// Shared by the studio-previews-<n> suites: each opens every `count`-th catalog
// entry, so the whole catalog is previewed across the shards without one suite
// outgrowing the runner's per-suite limit as models are registered.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const SHOTS = ['pana-chef', 'car-chamo', 'car-machito', 'plaza', 'track-estadio', 'mangoTree'];

export async function previewShard(index, count) {
  const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
  const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
  const base = process.env.PANA_QA_URL || 'http://localhost:8461', output = 'art/studio';
  await mkdir(output, { recursive: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text()); });
    await page.goto(`${base}/studio/library`);
    await page.locator('#startup').waitFor({ state: 'hidden', timeout: 300000 });
    const all = await page.evaluate(() => panaLibrary.assets.map(({ id, source }) => ({ id, source })));
    assert.ok(all.length >= 50);
    const assets = all.filter((_, i) => i % count === index);
    for (const asset of assets) {
      const start = Date.now();
      await page.locator('#nav-library').click();
      // Map constructors can occupy the main thread during the click itself.
      // Use the same budget as the subsequent preview-ready check.
      await page.locator(`[data-asset="${asset.id}"]`).click({ timeout: 90000 });
      await page.waitForFunction(id => panaLibrary.selected === id && document.querySelector('#preview-status').hidden, asset.id, { timeout: 90000 });
      assert.equal(await page.locator('#source').getAttribute('href'), asset.source);
      assert.equal(await page.evaluate(() => Number.isFinite(panaLibrary.camera.position.length()) && (() => { let drawn = 0; panaLibrary.current.group.traverse(o => { if (o.geometry) drawn++; }); return drawn > 0; })()), true, asset.id);
      if (SHOTS.includes(asset.id)) await page.screenshot({ path: `${output}/${asset.id}.png` });
      console.log(`preview ${asset.id} ${Date.now() - start} ms`);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: catalog previews shard ${index + 1}/${count} (${assets.length} of ${all.length})`);
  } finally { await browser.close(); }
}
