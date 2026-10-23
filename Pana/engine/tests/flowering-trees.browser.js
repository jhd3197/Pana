import assert from 'node:assert/strict';
import { launch, base } from '../../tests/browser-kit.js';

// Geometry budgets and factory contracts for the shared flowering trees.
// Rendered bloom/green/rewind and live-map proof live in Carreritas's bloom suite.
const browser = await launch();
try {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const { araguaney } = await import('/engine/models/vegetation/araguaney.js');
    const { inspect } = await import('/studio/preview.js');
    const check = (ok, message) => { if (!ok) throw Error(message); };
    const hashes = new Set(), maximum = { low: 0, game: 0 };
    function measure(options) {
      const group = araguaney(options), stats = inspect({ group }).stats;
      let hash = 2166136261, foliage = 0;
      group.traverse(o => {
        if (!o.geometry) return;
        for (const a of Object.values(o.geometry.attributes)) for (const n of a.array) {
          check(Number.isFinite(n), `Nonfinite geometry: ${JSON.stringify(options)}`);
          hash = Math.imul(hash ^ Math.round(n * 1e5), 16777619);
        }
        if (o.geometry.attributes.natureSurface?.array.includes(170)) foliage++;
        check(o.material.customProgramCacheKey().startsWith('pana-tree-'), 'Lost wind material');
      });
      check(new THREE.Box3().setFromObject(group).min.y > -0.05, 'Tree is below its origin');
      check(stats.textures === 0 && stats.meshes <= 2 && stats.materials <= 2, 'Tree batching budget');
      check(foliage === (options.leaves === false ? 0 : 1), 'Foliage tagging contract');
      group.traverse(o => o.geometry?.dispose());
      return { stats, hash };
    }
    for (const bloom of ['gold', 'pink']) for (const detail of ['low', 'game']) for (let seed = 1; seed <= 24; seed++) {
      const options = { bloom, detail, seed }, a = measure(options), b = measure(options);
      check(a.hash === b.hash, 'Same seed changed the model');
      hashes.add(a.hash);
      maximum[detail] = Math.max(maximum[detail], a.stats.triangles);
      check(a.stats.triangles <= (detail === 'low' ? 3100 : 6000), `Triangle budget: ${JSON.stringify({ options, ...a.stats })}`);
      const green = measure({ ...options, flowers: false });
      check(green.hash !== a.hash, 'Flower toggle has no effect');
    }
    for (const bloom of ['gold', 'pink', 'coral']) for (const detail of ['low', 'game', 'lite', 'full']) {
      measure({ bloom, detail, seed: 7 }); measure({ bloom, detail, seed: 7, leaves: false });
    }
    return { maximum, unique: hashes.size };
  });
  assert.equal(result.unique, 96);
  assert.deepEqual(errors, []);
  console.log('PASS flowering trees: seeded geometry, budgets, tags, wind, tiers and leaf/flower toggles', result);
} finally { await browser.close(); }
