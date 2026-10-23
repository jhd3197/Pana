// node bolas-world.browser.js [absolute-playwright-package] [browser-executable]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const base = process.env.PANA_QA_URL || 'http://localhost:8461', output = 'art/bolas-world';
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 600 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script></head><body><canvas></canvas></body></html>`);
  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const { createBolasWorld } = await import('/engine/worlds/bolas-world.js');
    const { inspect } = await import('/studio/preview.js');
    const canvas = document.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, preserveDrawingBuffer: true });
    renderer.setSize(1200, 600, false);
    // r186 uploads a renderer-owned DFG lookup texture on the first PBR draw.
    // Warm it with an independent mesh so every court cycle must still release
    // all of its own resources, including the very first cycle.
    const warmScene = new THREE.Scene(), warmCamera = new THREE.PerspectiveCamera(45, 2, .1, 10);
    warmCamera.position.z = 2;
    const warmMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    warmScene.add(warmMesh); renderer.render(warmScene, warmCamera);
    warmScene.clear(); warmMesh.geometry.dispose(); warmMesh.material.dispose(); renderer.renderLists.dispose();
    const baseline = { ...renderer.info.memory }, records = [];
    if (baseline.geometries !== 0 || baseline.textures !== 1) throw new Error(`Unexpected PBR baseline: ${JSON.stringify(baseline)}`);
    let image = null;
    for (let cycle = 0; cycle < 3; cycle++) {
      const world = createBolasWorld({ aspect: 2 }); world.fit(2);
      renderer.render(world.scene, world.camera);
      const dressing = world.scene.getObjectByName('Court dressing'), instances = [], placements = {};
      dressing.traverse(object => {
        if (!object.isInstancedMesh) return;
        const transforms = [];
        for (let i = 0; i < object.count; i++) {
          const matrix = new THREE.Matrix4(); object.getMatrixAt(i, matrix);
          for (const value of matrix.elements) if (!Number.isFinite(value)) throw new Error('Non-finite court instance matrix');
          transforms.push([matrix.elements[12], matrix.elements[13], matrix.elements[14]]);
        }
        instances.push({ name: object.name, count: object.count });
        (placements[object.name] ||= []).push(...transforms);
      });
      const measured = inspect({ group: dressing });
      if (cycle === 0) image = canvas.toDataURL('image/png');
      records.push({ cycle, instances, placements, stats: measured.stats, bounds: measured.bounds.min.toArray().concat(measured.bounds.max.toArray()) });
      world.dispose(); world.scene.clear(); renderer.renderLists.dispose(); renderer.render(world.scene, world.camera);
      const after = { ...renderer.info.memory };
      if (after.geometries !== baseline.geometries || after.textures !== baseline.textures) throw new Error(`Court resources leaked in cycle ${cycle}: ${JSON.stringify(after)}`);
    }
    renderer.dispose();
    return { records, image };
  });
  await writeFile(`${output}/metrics.json`, JSON.stringify(result.records, null, 2));
  await writeFile(`${output}/court.png`, Buffer.from(result.image.split(',')[1], 'base64'));
  const expectedBounds = [-9.139, 0, -14.772, 9.118, 4.735, 15.099];
  const expectedPlacements = {
    'Court planter': [[-7.6, 0, -13.6], [7.6, 0, -13.6], [-7.6, 0, 13.9], [7.6, 0, 13.9]],
    'Court lamp': [[-7.9, 0, -9.2], [7.9, 0, 6.2], [-7.9, 0, 7.4]],
  };
  const positions = values => [...new Set(values.map(value => value.map(n => n.toFixed(3)).join(',')))].sort();
  for (const record of result.records) {
    assert.equal(record.instances.length, 9);
    assert.equal(record.instances.filter(item => item.name === 'Court planter').length, 7);
    assert.equal(record.instances.filter(item => item.name === 'Court lamp').length, 2);
    for (const item of record.instances) assert.equal(item.count, item.name === 'Court planter' ? 4 : 3);
    assert.equal(record.stats.triangles, 6048);
    assert.ok(record.stats.meshes <= 22, `Court dressing meshes: ${record.stats.meshes}`);
    record.bounds.forEach((value, i) => assert.ok(Math.abs(value - expectedBounds[i]) < 0.001, `Court bounds ${i}: ${value}`));
    for (const [name, expected] of Object.entries(expectedPlacements)) {
      assert.deepEqual(positions(record.placements[name]), positions(expected));
    }
  }
  assert.deepEqual(errors, []);
  console.log('PASS: real court renders, nine instanced batches keep placements/bounds, and three world lifecycles release all geometry and textures');
} finally { await browser.close(); }
