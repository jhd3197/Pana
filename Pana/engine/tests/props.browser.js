// node props.browser.js [absolute-playwright-package] [browser-executable]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.argv[3] ? { executablePath: process.argv[3] } : {}) });
const base = process.env.PANA_QA_URL || 'http://localhost:8461', output = 'art/studio/props';
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 610 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;color:#292e2b;font:16px system-ui}header{padding:25px 30px 0;font-weight:600}canvas{display:block;width:1600px;height:500px}.names{display:grid;grid-template-columns:repeat(5,1fr);text-align:center}.names span{display:block;font:12px monospace;color:#626a64;margin-top:8px}</style></head><body><header>Pana · Objetos compartidos</header><canvas></canvas><div class="names"></div></body></html>`);
  const metrics = await page.evaluate(async () => {
    const THREE = await import('three');
    const { makeMango } = await import('/engine/models/props/mango.js');
    const { ceiba } = await import('/engine/models/vegetation/ceiba.js');
    const { bush } = await import('/engine/models/vegetation/bush.js');
    const { casita } = await import('/engine/models/props/island-house.js');
    const { bake } = await import('/engine/models/core/static-batch.js');
    const { createPreview, fitCamera, inspect, ownMaterials, release } = await import('/studio/preview.js');
    const builders = [() => makeMango(), () => makeMango({ gold: true }), () => ceiba({ seed: 7 }), () => bush({ seed: 7 }), () => casita({ seed: 7 })];
    const names = ['Mango', 'Mango dorado', 'Ceiba', 'Arbusto', 'Casita de isla'];
    const shape = root => {
      const values = []; root.updateMatrixWorld(true);
      root.traverse(node => {
        if (!node.isMesh) return;
        for (const attr of Object.values(node.geometry.attributes)) for (const value of attr.array) if (!Number.isFinite(value)) throw new Error('Non-finite geometry');
        values.push(...node.geometry.attributes.position.array, ...node.matrixWorld.elements);
      });
      let hash = 2166136261;
      for (const value of values) { hash ^= Math.round(value * 10000); hash = Math.imul(hash, 16777619); }
      return hash >>> 0;
    };
    const models = builders.map(build => ({ group: build() }));
    const metrics = models.map((model, i) => {
      const duplicate = builders[i]();
      const first = new Set(); model.group.traverse(o => { if (o.geometry) first.add(o.geometry); });
      duplicate.traverse(o => { if (first.has(o.geometry)) throw new Error('Instances share disposable geometry'); });
      if (shape(model.group) !== shape(duplicate)) throw new Error('Non-deterministic model');
      duplicate.traverse(o => o.geometry?.dispose());
      const originalBounds = new THREE.Box3().setFromObject(model.group, true);
      const batched = bake(model.group), batchedBounds = new THREE.Box3().setFromObject(batched, true);
      if (originalBounds.min.distanceTo(batchedBounds.min) > 0.001 || originalBounds.max.distanceTo(batchedBounds.max) > 0.001) throw new Error('Batching changed the model bounds');
      if (shape(batched) === undefined) throw new Error('Invalid batched geometry');
      const batchedMeshes = batched.children.length; batched.traverse(o => o.geometry?.dispose());
      ownMaterials(model);
      return { name: names[i], ...inspect(model).stats, bounds: [originalBounds.min.toArray(), originalBounds.max.toArray()], batchedMeshes };
    });
    for (const seed of [0, 3, 81]) for (const build of [ceiba, bush, casita]) {
      const variant = build({ seed, flowers: true }); shape(variant); variant.traverse(o => o.geometry?.dispose());
    }
    const stage = createPreview(document.querySelector('canvas'), true);
    stage.renderer.setSize(1600, 500, false); stage.renderer.setScissorTest(true);
    models.forEach((model, i) => {
      stage.scene.add(model.group); stage.camera.aspect = 320 / 500;
      fitCamera(stage.camera, inspect(model).bounds);
      stage.renderer.setViewport(i * 320, 0, 320, 500); stage.renderer.setScissor(i * 320, 0, 320, 500);
      stage.renderer.render(stage.scene, stage.camera); stage.scene.remove(model.group);
    });
    document.querySelector('.names').innerHTML = metrics.map(m => `<div>${m.name}<span>${m.triangles.toLocaleString('es')} tri</span></div>`).join('');
    window.propPreview = { stage, models, names, inspect, fitCamera, release, THREE };
    return metrics;
  });
  metrics.forEach((m, i) => {
    // the tree-kit ceiba's map tier is ~8 k; whole-map budgets guard the forests
    assert.ok(m.triangles < [1800, 1800, 9000, 4000, 7500][i], `${m.name} triangle budget`);
    assert.ok(m.dimensions.every(v => v > 0 && Number.isFinite(v)));
    assert.ok(m.batchedMeshes <= [6, 6, 6, 6, 14][i], `${m.name}: ${m.batchedMeshes} static draw calls`);
    if (i < 2) { assert.ok(m.dimensions[1] < 2.5); assert.ok(m.dimensions[0] < 2); }
    else { assert.ok(m.bounds[0][1] > -0.08); assert.ok(m.dimensions[1] < [0, 0, 11, 2, 4.5][i]); }
  });
  await page.screenshot({ path: `${output}/models.png` });
  await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
  await page.setViewportSize({ width: 900, height: 760 });
  for (let i = 0; i < 5; i++) {
    await page.evaluate(i => {
      const { stage, models, inspect, fitCamera } = propPreview;
      document.querySelector('header').hidden = true; document.querySelector('.names').hidden = true;
      const canvas = document.querySelector('canvas'); canvas.style.width = '900px'; canvas.style.height = '760px';
      stage.renderer.setScissorTest(false); stage.renderer.setSize(900, 760, false); stage.renderer.setViewport(0, 0, 900, 760);
      models.forEach(model => stage.scene.remove(model.group)); stage.scene.add(models[i].group);
      stage.camera.aspect = 900 / 760; fitCamera(stage.camera, inspect(models[i]).bounds); stage.renderer.render(stage.scene, stage.camera);
    }, i);
    await page.screenshot({ path: `${output}/${['mango', 'gold-mango', 'ceiba', 'bush', 'casita'][i]}.png` });
    if (i === 0 || i === 4) {
      await page.evaluate(i => {
        const { stage, models, inspect, THREE } = propPreview;
        const center = inspect(models[i]).bounds.getCenter(new THREE.Vector3());
        stage.camera.position.x = center.x * 2 - stage.camera.position.x;
        stage.camera.position.z = center.z * 2 - stage.camera.position.z;
        stage.camera.lookAt(center); stage.renderer.render(stage.scene, stage.camera);
      }, i);
      await page.screenshot({ path: `${output}/${i === 0 ? 'mango' : 'casita'}-back.png` });
    }
  }
  // The same foliage/house factories are baked into all three shared environments.
  for (const game of ['bululu', 'escondidas', 'cocina']) {
    await page.goto(`${base}/g/${game}/?debug`);
    await page.waitForFunction(game => {
      const renderer = game === 'bululu' ? window.renderer : game === 'escondidas' ? window.hunt?.renderer : window.cocina?.renderer;
      return renderer?.info.render.frame > 2;
    }, game, { timeout: 120000 });
    await page.screenshot({ path: `${output}/${game}.png` });
    console.log(`Shared-prop consumer rendered: ${game}`);
  }
  assert.deepEqual(errors, []); console.log(JSON.stringify(metrics, null, 2));
  console.log('PASS: finite/deterministic models, geometry ownership, shape/triangle budgets and static batching');
} finally { await browser.close(); }
