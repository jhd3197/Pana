// Geometry proof and reference renders; run against the local Pana server.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const output = 'art/studio/colonial-houses'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${process.env.PANA_TEST_URL || 'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee}canvas{display:block}</style><canvas></canvas>');
  const metrics = await page.evaluate(async () => {
    const THREE = await import('three');
    const { colonialHouse } = await import('/engine/models/props/colonial-house.js');
    const { HOUSE_PRESETS } = await import('/engine/models/props/colonial-house-definitions.js');
    const { createPreview, inspect, fitCamera } = await import('/studio/preview.js');
    const hash = (g, positionsOnly = false) => {
      let h = 2166136261;
      g.traverse(o => { if (o.geometry) for (const attr of positionsOnly ? [o.geometry.attributes.position] : Object.values(o.geometry.attributes)) for (const n of attr.array) { if (!Number.isFinite(n)) throw Error('Non-finite geometry'); h = Math.imul(h ^ Math.round(n * 10000), 16777619); } });
      return h >>> 0;
    };
    const dispose = g => g.traverse(o => o.geometry?.dispose());
    const models = [], metrics = [];
    for (const preset of HOUSE_PRESETS) {
      const group = colonialHouse(preset), twin = colonialHouse(preset), low = colonialHouse({ ...preset, detail: 'low' });
      if (hash(group) !== hash(twin)) throw Error('Seed mismatch');
      const owned = new Set(); group.traverse(o => o.geometry && owned.add(o.geometry)); twin.traverse(o => { if (owned.has(o.geometry)) throw Error('Shared geometry'); });
      if (JSON.stringify(group.userData.houseSpec) !== JSON.stringify(low.userData.houseSpec)) throw Error('Quality changes recipe');
      const bounds = new THREE.Box3().setFromObject(group);
      if (bounds.min.y < -0.05) throw Error(`Below ground: ${preset.id} ${bounds.min.y}`);
      // Shoot into the upper door panel: the first hit must sit behind the wall.
      const spec = group.userData.houseSpec, door = spec.openings.find(o => o.face === 'front' && o.floor === 0 && o.kind === 'door');
      group.updateMatrixWorld(true);
      const wallZ = spec.faces[0].position[2];
      const hits = new THREE.Raycaster(new THREE.Vector3(door.x + 0.2, door.bottom + 2, wallZ + 0.7), new THREE.Vector3(0, 0, -1), 0, 1).intersectObject(group, true);
      if (!hits.length || hits[0].point.z >= wallZ - 0.01) throw Error(`Door has no recess: ${preset.id}`);
      const info = inspect({ group }); metrics.push({ id: preset.id, ...info.stats, bounds: [bounds.min.toArray(), bounds.max.toArray()], lowTriangles: inspect({ group: low }).stats.triangles });
      dispose(twin); dispose(low); models.push({ group });
    }
    const stage = createPreview(document.querySelector('canvas'), true); stage.renderer.setSize(1500, 1000, false); stage.renderer.setScissorTest(true);
    window.proof = { THREE, stage, models, inspect, fitCamera, colonialHouse, HOUSE_PRESETS, hash };
    for (const [i, model] of models.entries()) {
      stage.scene.add(model.group); stage.camera.aspect = 500 / 500; fitCamera(stage.camera, inspect(model).bounds);
      stage.renderer.setViewport(i % 3 * 500, 500 - Math.floor(i / 3) * 500, 500, 500); stage.renderer.setScissor(i % 3 * 500, 500 - Math.floor(i / 3) * 500, 500, 500);
      stage.renderer.render(stage.scene, stage.camera); stage.scene.remove(model.group);
    }
    return metrics;
  });
  await page.screenshot({ path: `${output}/families.png` });
  await page.evaluate(() => {
    const { stage, models, inspect, fitCamera } = proof;
    models.forEach((model, i) => {
      stage.scene.add(model.group); const { center } = fitCamera(stage.camera, inspect(model).bounds);
      stage.camera.position.x = center.x * 2 - stage.camera.position.x; stage.camera.position.z = center.z * 2 - stage.camera.position.z; stage.camera.lookAt(center);
      const x = i % 3 * 500, y = 500 - Math.floor(i / 3) * 500;
      stage.renderer.setViewport(x, y, 500, 500); stage.renderer.setScissor(x, y, 500, 500); stage.renderer.render(stage.scene, stage.camera); stage.scene.remove(model.group);
    });
  });
  await page.screenshot({ path: `${output}/rear-views.png` });
  for (let i = 0; i < 3; i++) {
    await page.evaluate(i => {
      const { stage, models, inspect, fitCamera } = proof;
      models.forEach(m => stage.scene.remove(m.group)); stage.scene.add(models[i].group);
      stage.renderer.setScissorTest(false); stage.renderer.setSize(1500, 1000, false); stage.renderer.setViewport(0, 0, 1500, 1000); stage.camera.aspect = 1.5;
      fitCamera(stage.camera, inspect(models[i]).bounds); stage.renderer.render(stage.scene, stage.camera);
    }, i);
    await page.screenshot({ path: `${output}/${metrics[i].id}.png` });
  }
  await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
  // Twenty-four independent houses, not recolors of one stretched prototype.
  const variants = await page.evaluate(async () => {
    const { stage, models, inspect, fitCamera, colonialHouse, THREE } = proof;
    const { HOUSE_FAMILIES, HOUSE_PLANTING } = await import('/engine/models/props/colonial-house-definitions.js');
    models.forEach(m => stage.scene.remove(m.group));
    stage.renderer.setSize(1800, 1200, false); stage.renderer.setScissorTest(true); stage.camera.aspect = 1;
    const results = [];
    for (let i = 0; i < 24; i++) {
      const family = HOUSE_FAMILIES[i % 6], group = colonialHouse({ seed: 119 + i * 7, family: family.id, planting: HOUSE_PLANTING[i % 5].id, floors: family.floors[Math.floor(i / 6) % family.floors.length] });
      const runtime = { group }, b = inspect(runtime).bounds, spec = group.userData.houseSpec;
      if (!b.min.toArray().every(Number.isFinite) || !b.max.toArray().every(Number.isFinite) || b.min.y < -0.05) throw Error(`Invalid variant ${i}`);
      const envelope = new THREE.Box3(new THREE.Vector3(...spec.envelope.min), new THREE.Vector3(...spec.envelope.max));
      if (!envelope.expandByScalar(1e-5).containsBox(b)) throw Error(`Variant ${i} exceeds placement envelope: ${b.min.toArray()} / ${b.max.toArray()}`);
      results.push({ seed: spec.seed, family: spec.family, bounds: [b.min.toArray(), b.max.toArray()], ...inspect(runtime).stats });
      stage.scene.add(group); fitCamera(stage.camera, b);
      const x = i % 6 * 300, y = 900 - Math.floor(i / 6) * 300;
      stage.renderer.setViewport(x, y, 300, 300); stage.renderer.setScissor(x, y, 300, 300); stage.renderer.render(stage.scene, stage.camera);
      stage.scene.remove(group); group.traverse(o => o.geometry?.dispose());
    }
    return results;
  });
  await page.setViewportSize({ width: 1800, height: 1200 });
  await page.screenshot({ path: `${output}/24-variations.png` });
  await writeFile(`${output}/variants.json`, JSON.stringify(variants, null, 2));
  const batchMetrics = await page.evaluate(async () => {
    const { stage, inspect, fitCamera, colonialHouse, THREE, hash } = proof;
    const { createHouseBatch } = await import('/engine/models/props/colonial-house-spec.js');
    const specs = createHouseBatch(103), hashes = new Set(), results = [];
    stage.renderer.setSize(2500, 1250, false); stage.camera.aspect = 1;
    for (const [i, spec] of specs.entries()) {
      const group = colonialHouse({ spec }), b = inspect({ group }).bounds, stats = inspect({ group }).stats;
      const envelope = new THREE.Box3(new THREE.Vector3(...spec.envelope.min), new THREE.Vector3(...spec.envelope.max));
      if (!envelope.expandByScalar(1e-5).containsBox(b)) throw Error(`Batch house ${i} exceeds envelope`);
      hashes.add(hash(group, true));
      results.push({ index: i, family: spec.family, windowStyle: spec.windowStyle, roof: spec.roof, ...stats });
      stage.scene.add(group); fitCamera(stage.camera, b);
      const x = i % 10 * 250, y = 1000 - Math.floor(i / 10) * 250;
      stage.renderer.setViewport(x, y, 250, 250); stage.renderer.setScissor(x, y, 250, 250); stage.renderer.render(stage.scene, stage.camera);
      stage.scene.remove(group); group.traverse(o => o.geometry?.dispose());
    }
    if (hashes.size !== 50) throw Error('Repeated geometry in the batch');
    return results;
  });
  await page.setViewportSize({ width: 2500, height: 1250 }); await page.screenshot({ path: `${output}/50-houses.png` });
  await writeFile(`${output}/50-house-metrics.json`, JSON.stringify(batchMetrics, null, 2));
  await page.evaluate(async () => {
    const { stage, inspect, fitCamera, THREE, hash } = proof;
    const { opening } = await import('/engine/models/props/colonial-house-parts.js');
    const { HOUSE_WINDOWS, HOUSE_PALETTES } = await import('/engine/models/props/colonial-house-definitions.js');
    const hashes = new Set();
    stage.renderer.setSize(1500, 1000, false); stage.camera.aspect = 1;
    for (const [i, windowStyle] of HOUSE_WINDOWS.entries()) {
      const group = new THREE.Group();
      opening(group, { x: 0, bottom: 0.1, width: windowStyle.id === 'doble' ? 1.9 : 1.23, height: 2.47, kind: 'window', windowStyle: windowStyle.id, arch: windowStyle.id === 'arco' }, HOUSE_PALETTES[0], 'game');
      hashes.add(hash(group)); stage.scene.add(group); fitCamera(stage.camera, inspect({ group }).bounds);
      const x = i % 3 * 500, y = 500 - Math.floor(i / 3) * 500;
      stage.renderer.setViewport(x, y, 500, 500); stage.renderer.setScissor(x, y, 500, 500); stage.renderer.render(stage.scene, stage.camera);
      stage.scene.remove(group); group.traverse(o => o.geometry?.dispose());
    }
    if (hashes.size !== 6) throw Error('Window choices have repeated geometry');
  });
  await page.setViewportSize({ width: 1500, height: 1000 }); await page.screenshot({ path: `${output}/six-windows.png` });
  await page.evaluate(async () => {
    const { colonialHouse, inspect } = proof;
    const { trailingVine } = await import('/engine/models/vegetation/trailing-vine.js');
    for (const height of [0.7, 2.1, 3]) for (const seed of [0, 7, 119]) {
      const group = trailingVine({ seed, height }), bounds = inspect({ group }).bounds;
      if (bounds.min.y < -0.05 || group.userData.attachment[1] !== height) throw Error('Invalid vine attachment or ground origin');
      group.traverse(o => o.geometry?.dispose());
    }
    for (const options of [
      { family: 'casa-balcon', width: 12, depth: 8, floorHeight: 4.4, planting: 'flores' },
      { family: 'casa-portal', width: 5.8, depth: 4.5, floorHeight: 3.6, planting: 'ventanas' },
      { family: 'casa-remate', width: 5.8, floors: 2, partyWalls: ['left', 'right', 'rear'], planting: 'ninguna' },
    ]) {
      const group = colonialHouse(options), stats = inspect({ group }).stats;
      if (!stats.dimensions.every(Number.isFinite) || stats.meshes > 8) throw Error('Invalid extreme dimensions');
      group.traverse(o => o.geometry?.dispose());
    }
  });
  for (const m of metrics) { assert.ok(m.triangles < 45000, `${m.id}: ${m.triangles} triangles`); assert.ok(m.meshes <= 8, `${m.id}: ${m.meshes} meshes`); assert.ok(m.lowTriangles < m.triangles); }
  assert.deepEqual(errors, []); console.log(JSON.stringify(metrics.map(({ id, triangles, meshes, lowTriangles }) => ({ id, triangles, meshes, lowTriangles }))));
  console.log('PASS colonial house geometry, seeds, owned resources, detail tiers and reference renders');
} finally { await browser.close(); }
