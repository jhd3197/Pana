// Capture actual geometry/material/pose metrics. --baseline saves a reference;
// --compare verifies a previously saved reference after a structural refactor.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const output = 'art/studio/model-library', browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.PANA_TEST_URL || 'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script>');
  const result = await page.evaluate(async () => {
    const { ASSETS } = await import('/studio/catalog.js'), preview = await import('/studio/preview.js');
    const hash = root => {
      root.updateMatrixWorld(true); let h = 2166136261;
      const add = value => { if (!Number.isFinite(value)) throw Error('Nonfinite model data'); h = Math.imul(h ^ Math.round(value * 1e5), 16777619); };
      root.traverse(o => {
        o.matrixWorld.elements.forEach(add);
        if (o.geometry) {
          for (const attribute of Object.values(o.geometry.attributes)) attribute.array.forEach(add);
          o.geometry.index?.array.forEach(add);
        }
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
          m.color?.toArray().forEach(add); m.emissive?.toArray().forEach(add);
          for (const key of ['roughness', 'metalness', 'opacity', 'side']) if (typeof m[key] === 'number') add(m[key]);
        }
      }); return h;
    };
    const models = {};
    for (const asset of ASSETS.filter(a => a.category !== 'Mapas')) {
      const model = await asset.build(); preview.ownMaterials(model); model.update?.(0, 0);
      models[asset.id] = { hash: hash(model.group), ...preview.inspect(model).stats };
      preview.release(model);
    }
    return { assets: ASSETS.map(({ id, name, category, usedBy, previewOptions }) => ({ id, name, category, usedBy, previewOptions })).sort((a,b) => a.id.localeCompare(b.id)), models };
  });
  assert.deepEqual(errors, []); await mkdir(output, { recursive: true });
  if (process.argv.includes('--baseline')) await writeFile(`${output}/before.json`, JSON.stringify(result, null, 2));
  else {
    await writeFile(`${output}/after.json`, JSON.stringify(result, null, 2));
    if (process.argv.includes('--compare')) {
      const before = JSON.parse(await readFile(`${output}/before.json`, 'utf8'));
      assert.deepEqual(JSON.parse(JSON.stringify(result.assets)), before.assets, 'Catalog identity/consumer metadata changed');
      // Compare each ID separately so a failure identifies its model.
      for (const [id, model] of Object.entries(result.models)) assert.deepEqual(model, before.models[id], `${id} changed`);
    }
  }
  console.log(`PASS ${result.assets.length} catalog entries, ${Object.keys(result.models).length} model snapshots`);
} finally { await browser.close(); }
