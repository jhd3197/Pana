import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const base = process.env.PANA_QA_URL || 'http://localhost:8461';
const output = process.env.PANA_QA_OUTPUT || path.resolve('Pana/games/reliquia/qa');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio.html`);
  await page.locator('#startup').waitFor({ state: 'hidden', timeout: 300000 });
  console.log('ok  Studio startup and thumbnails');
  for (const id of ['temple-mummy', 'sun-guardian', 'sun-relic', 'expedition-winch', 'expedition-lantern', 'reliquia']) {
    await page.locator('#nav-library').click();
    await page.locator(`[data-asset="${id}"]`).click({ timeout: 90000 });
    await page.waitForFunction(id => panaLibrary.selected === id && document.querySelector('#preview-status').hidden, id, { timeout: 90000 });
    const info = await page.evaluate(async () => {
      const { Box3 } = await import('three'), current = panaLibrary.current;
      current.update?.(2.5, 0.016); current.group.updateMatrixWorld(true);
      const b = new Box3().setFromObject(current.group);
      return { finite: [...b.min.toArray(), ...b.max.toArray(), ...panaLibrary.camera.position.toArray()].every(Number.isFinite), nonempty: !b.isEmpty() };
    });
    assert.ok(info.finite && info.nonempty, `${id} finite renderable bounds`);
    await page.screenshot({ path: path.join(output, `studio-${id}.png`) });
    console.log(`ok  native Studio preview: ${id}`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
