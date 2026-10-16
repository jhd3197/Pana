// Pana signature landmarks: geometry, ownership, grounding and render proof.
// node Pana/engine/tests/landmarks.browser.js [emblemas|selva] (PANA_PLAYWRIGHT_PATH / PANA_BROWSER_PATH optional)
// emblemas: the Pana landmarks. selva: jungle ruins/obstacles plus the jungle plants.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const SETS = {
  emblemas: { title: 'Emblemas', count: 10, output: 'art/studio/landmarks', categories: ['Emblemas'], ids: ['mangoTree'] },
  selva: { title: 'Selva y trópico', count: 10, output: 'art/studio/jungle', categories: ['Selva'], ids: ['jungleGiant', 'tropicalBush', 'palm'] },
};
const set = SETS[process.argv[2] || 'emblemas'];
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', output = set.output;
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1030 }, deviceScaleFactor: 1 }), errors = [];
  page.on('pageerror', e => errors.push(e.message)); await page.goto(`${base}/studio/settings.html`);
  await page.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;color:#303934;font:16px system-ui}header{height:70px;box-sizing:border-box;padding:24px 35px;font-weight:600}canvas{display:block;width:1500px;height:960px}.label{position:absolute;width:500px;text-align:center;pointer-events:none}.label span{display:block;font:12px monospace;color:#69766e;margin-top:5px}</style></head><body><header>PANA · ${set.title}</header><canvas></canvas><div id="labels"></div></body></html>`);
  const metrics = await page.evaluate(async set => {
    const THREE = await import('three'), { ASSETS } = await import('/studio/catalog.js');
    const { createPreview, inspect, fitCamera, ownMaterials } = await import('/studio/preview.js');
    const hash = root => {
      let h = 2166136261; root.updateMatrixWorld(true);
      root.traverse(o => {
        if (!o.geometry) return;
        for (const attr of Object.values(o.geometry.attributes)) for (const v of attr.array) { if (!Number.isFinite(v)) throw Error('Non-finite geometry'); h = Math.imul(h ^ Math.round(v * 10000), 16777619); }
        for (const v of o.matrixWorld.elements) { if (!Number.isFinite(v)) throw Error('Non-finite transform'); h = Math.imul(h ^ Math.round(v * 10000), 16777619); }
        if (o.instanceMatrix) for (const v of o.instanceMatrix.array) { if (!Number.isFinite(v)) throw Error('Non-finite instance'); h = Math.imul(h ^ Math.round(v * 10000), 16777619); }
      }); return h >>> 0;
    };
    const assets = ASSETS.filter(a => set.categories.includes(a.category) || set.ids.includes(a.id)), models = [], details = [];
    for (const asset of assets) {
      const model = await asset.build(), twin = await asset.build();
      const own = new Set(); model.group.traverse(o => o.geometry && own.add(o.geometry));
      twin.group.traverse(o => { if (own.has(o.geometry)) throw Error(`${asset.id} shares geometry`); });
      if (hash(model.group) !== hash(twin.group)) throw Error(`${asset.id} is not deterministic`);
      const owned = []; twin.group.traverse(o => { o.geometry?.dispose(); if (o.userData.dispose) owned.push(o.userData.dispose); }); owned.forEach(d => d());
      if (model.update) {
        model.update(0, 0); const still = hash(model.group);
        model.update(1.3, 1.3); const moving = hash(model.group);
        if (still === moving) throw Error(`${asset.id} animation does not move`);
        model.update(0, 0);
        if (hash(model.group) !== still) throw Error(`${asset.id} animation accumulates instead of using absolute time`);
        model.update(1.3, 0.016);
      }
      ownMaterials(model);
      const info = inspect(model);
      details.push({ id: asset.id, name: asset.name, ...info.stats, minY: info.bounds.min.y, animated: !!model.update });
      models.push(model);
    }
    const { ropeBridge, bambooBridge, templeEntrance, hollowLog } = await import('/engine/models/props/jungle.js');
    const { welcomeArch, panaFlagpole, capybaraStatue } = await import('/engine/models/props/monuments.js');
    const { flagPole } = await import('/engine/models/props/flags.js');
    const dispose = group => group.traverse(o => { o.geometry?.dispose(); o.userData.dispose?.(); });
    // A visible opening must actually be empty geometry, including the rear.
    const passage = (group, origin, direction, distance, label) => {
      group.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction), 0, distance);
      if (ray.intersectObject(group, true).length) throw Error(`${label} passage blocked`);
      dispose(group);
    };
    passage(welcomeArch(), [0, 1.2, 5], [0, 0, -1], 10, 'Welcome arch');
    passage(templeEntrance(), [0, 2.2, 5], [0, 0, -1], 10, 'Temple');
    passage(hollowLog(), [-5, 1, 0], [1, 0, 0], 10, 'Hollow log');
    for (const build of [ropeBridge, bambooBridge]) {
      let previous = 0;
      for (const span of [6, 14, 24]) {
        const group = build({ span, seed: 7 }); hash(group);
        const b = new THREE.Box3().setFromObject(group), width = b.max.x - b.min.x;
        if (width <= previous || b.min.y < -0.05) throw Error('Bridge span/grounding regression');
        previous = width; dispose(group);
      }
      for (const span of [0, -4, NaN, Infinity]) {
        let rejected = false; try { build({ span }); } catch (e) { rejected = e instanceof RangeError; }
        if (!rejected) throw Error('Invalid bridge span was accepted');
      }
    }
    for (const build of [panaFlagpole, flagPole]) {
      const pole = build({ h: 4 }); pole.userData.tick(0); hash(pole); pole.userData.tick(100); hash(pole); dispose(pole);
    }
    // The shared flagpole must keep Venezuela as its default.
    const pole = flagPole(), explicit = flagPole({ flag: 'venezuela' });
    const flagCanvas = group => { let canvas; group.traverse(o => { if (o.material?.map) canvas = o.material.map.image; }); return canvas.toDataURL(); };
    if (flagCanvas(pole) !== flagCanvas(explicit)) throw Error('Default flag changed');
    dispose(pole); dispose(explicit);
    const stone = capybaraStatue({ finish: 'stone', scale: 2 }); hash(stone); dispose(stone);
    const stage = createPreview(document.querySelector('canvas'), true);
    stage.renderer.setSize(1500, 960, false); stage.renderer.setScissorTest(true);
    const cols = 5, w = 300, h = 480;
    models.forEach((model, i) => {
      const x = (i % cols) * w, y = 960 - (Math.floor(i / cols) + 1) * h;
      stage.scene.add(model.group); stage.camera.aspect = w / h; fitCamera(stage.camera, inspect(model).bounds);
      stage.renderer.setViewport(x, y, w, h); stage.renderer.setScissor(x, y, w, h);
      stage.renderer.render(stage.scene, stage.camera); stage.scene.remove(model.group);
      const label = document.createElement('div'); label.className = 'label'; label.style.width = `${w}px`;
      label.style.left = `${x}px`; label.style.top = `${70 + 960 - y - 40}px`;
      label.innerHTML = `${details[i].name}<span>${details[i].triangles.toLocaleString('es')} tri · ${details[i].meshes} mallas</span>`;
      document.getElementById('labels').append(label);
    });
    window.landmarks = { stage, models, inspect, fitCamera, THREE };
    return details;
  }, set);
  await page.screenshot({ path: `${output}/landmarks.png` });
  await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
  assert.equal(metrics.length, set.count, `${set.title} registrations`);
  for (const m of metrics) {
    assert.ok(m.triangles < 90000, `${m.id} triangle budget: ${m.triangles}`);
    // The existing plaza fountain keeps its separate water streams and textured character parts.
    assert.ok(m.meshes <= (m.id === 'plaza-fountain' ? 40 : 24), `${m.id} draw calls: ${m.meshes}`);
    assert.ok(m.minY > -0.05, `${m.id} grounded: ${m.minY}`);
    assert.ok(m.dimensions.every(v => v > 0.5 && v < 22), `${m.id} size ${m.dimensions}`);
  }
  await page.setViewportSize({ width: 900, height: 760 });
  for (let i = 0; i < metrics.length; i++) {
    await page.evaluate(i => {
      const { stage, models, inspect, fitCamera } = landmarks;
      document.querySelector('header').hidden = true; document.getElementById('labels').hidden = true;
      const canvas = document.querySelector('canvas'); canvas.style.width = '900px'; canvas.style.height = '760px';
      stage.renderer.setScissorTest(false); stage.renderer.setSize(900, 760, false); stage.renderer.setViewport(0, 0, 900, 760);
      models.forEach(m => stage.scene.remove(m.group)); stage.scene.add(models[i].group);
      stage.camera.aspect = 900 / 760; fitCamera(stage.camera, inspect(models[i]).bounds); stage.renderer.render(stage.scene, stage.camera);
    }, i);
    await page.screenshot({ path: `${output}/${metrics[i].id}.png` });
  }
  assert.deepEqual(errors, []); console.log(JSON.stringify(metrics.map(({ id, triangles, meshes, dimensions }) => ({ id, triangles, meshes, dimensions: dimensions.map(v => +v.toFixed(2)) })), null, 1));
  console.log(`PASS: ${set.title}: deterministic, grounded, own their geometry and render`);
} finally { await browser.close(); }
