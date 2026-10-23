import assert from 'node:assert/strict';
import { launch, base } from '../../tests/browser-kit.js';

// Guard the shared trees' real map tiers, not just full-detail Studio models.
// Direct coverage for changed-suites.js: tree-kit.js, araguaney.js, mango-tree.js,
// saman.js, ceiba.js, mangrove.js, jungle-giant.js, emergent-tree.js,
// strangler-fig.js and selva-trees.js. Factories/options come from the catalog.
const browser = await launch();
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script>');
  const result = await page.evaluate(async () => {
    const { default: catalog } = await import('/engine/models/vegetation/catalog.js');
    const { inspect } = await import('/studio/preview.js');
    // Per-tree ceilings include bark, roots, fruit and the matapalo's shrine.
    const budgets = {
      bucare: [3100, 6000, 2], mangoTree: [1800, 8000, 3], saman: [3000, 10000, 2],
      ceiba: [1800, 7500, 3], mangrove: [2600, 6500, 3], jungleGiant: [3200, 15500, 3],
      'emergent-tree': [5000, 12000, 3], 'strangler-fig': [6500, 14500, 7], cacao: [1600, 6500, 3],
    };
    const check = (ok, message) => { if (!ok) throw Error(message); };
    const maxima = {};
    for (const [id, limits] of Object.entries(budgets)) {
      const asset = catalog.find(a => a.id === id), module = await import(asset.source);
      const build = options => module[asset.factory]({ ...asset.previewOptions, ...options });
      const measure = options => {
        const group = build(options), { stats, bounds } = inspect({ group });
        let hash = 2166136261, foliage = 0;
        const values = [];
        group.traverse(o => {
          if (!o.geometry) return;
          for (const attribute of Object.values(o.geometry.attributes)) for (const value of attribute.array) {
            check(Number.isFinite(value), `${id}: nonfinite geometry`);
            values.push(value);
            hash = Math.imul(hash ^ Math.round(value * 1e5), 16777619);
          }
          if (o.geometry.attributes.natureSurface?.array.includes(170)) {
            foliage++;
            check(o.material.customProgramCacheKey().startsWith('pana-tree-'), `${id}: foliage lost wind`);
            check(!o.material.transparent && !o.material.map, `${id}: foliage added alpha/texture work`);
          }
        });
        check(stats.textures === 0 && stats.meshes <= limits[2] && stats.materials <= limits[2], `${id}: batching budget`);
        check(foliage === (options.leaves === false ? 0 : 1), `${id}: leaf toggle/tagging`);
        check(bounds.max.y > 0 && stats.dimensions.every(n => Number.isFinite(n) && n > 0), `${id}: invalid bounds`);
        group.traverse(o => o.geometry?.dispose());
        return { hash, values, triangles: stats.triangles };
      };
      maxima[id] = {};
      for (const [tier, detail] of ['low', 'game'].entries()) {
        let max = 0;
        const hashes = new Set();
        for (const seed of [1, 7, 19, 31, 47, 83]) {
          const options = { detail, seed }, a = measure(options), b = measure(options);
          const diff = a.values.findIndex((n, i) => Math.abs(n - b.values[i]) >= 1e-5);
          check(a.values.length === b.values.length && diff === -1, `${id}/${detail}/${seed}: unstable seed (${a.values.length}/${b.values.length}, at ${diff}: ${a.values[diff]}/${b.values[diff]})`);
          check(a.triangles <= limits[tier], `${id}/${detail}/${seed}: ${a.triangles} triangles exceeds ${limits[tier]}`);
          check(measure({ ...options, leaves: false }).triangles < a.triangles, `${id}: removing leaves did not remove geometry`);
          hashes.add(a.hash); max = Math.max(max, a.triangles);
        }
        check(hashes.size === 6, `${id}/${detail}: seeds do not vary`);
        maxima[id][detail] = max;
      }
      for (const detail of ['lite', 'full']) {
        measure({ detail, seed: 7 }); measure({ detail, seed: 7, leaves: false });
      }
    }
    return maxima;
  });
  assert.deepEqual(errors, []);
  console.log('PASS broadleaf trees: nine species, finite seeded geometry, all tiers, leaf toggles, wind and budgets', result);
} finally { await browser.close(); }
