import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const output = 'art/studio/colonial-houses'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.PANA_TEST_URL || 'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;font:17px system-ui;color:#28362c}canvas{display:block}.label{position:absolute;top:22px;width:450px;text-align:center}</style><canvas></canvas>');
  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const { colonialHouse } = await import('/engine/models/props/colonial-house.js');
    const { finishWall } = await import('/engine/models/props/colonial-house-finish.js');
    const { createHouseSpec } = await import('/engine/models/props/colonial-house-spec.js');
    const { HOUSE_FINISHES, HOUSE_PALETTES } = await import('/engine/models/props/colonial-house-definitions.js');
    const { createPreview, inspect, fitCamera } = await import('/studio/preview.js');
    const stage = createPreview(document.querySelector('canvas'), true), stats = [];
    stage.renderer.setSize(1800, 1100, false); stage.renderer.setScissorTest(true); stage.camera.aspect = 450 / 550;
    const hash = group => {
      let h = 2166136261;
      group.traverse(o => { if (o.geometry) for (const attr of Object.values(o.geometry.attributes)) for (const n of attr.array) { if (!Number.isFinite(n)) throw Error('Invalid finish geometry'); h = Math.imul(h ^ Math.round(n * 100000), 16777619); } });
      return h >>> 0;
    };
    const release = group => group.traverse(o => o.geometry?.dispose());
    for (const [row, palette] of ['amarillo', 'azul'].entries()) {
      let baseline;
      const hashes = new Set();
      for (const [column, finish] of HOUSE_FINISHES.entries()) {
        const spec = createHouseSpec({ seed: 37, family: 'casa-baja', width: 8.6, depth: 5.8, floors: 2, palette, planting: 'ninguna', windowStyle: 'reja', roof: 'tejas', layout: 'clasica', door: 'square', wallFinish: finish.id, finishSeed: 47 });
        const group = colonialHouse({ spec }), twin = colonialHouse({ spec }), info = inspect({ group });
        if (hash(group) !== hash(twin)) throw Error('Finish is not deterministic');
        const owned = new Set(); group.traverse(o => o.geometry && owned.add(o.geometry)); twin.traverse(o => { if (owned.has(o.geometry)) throw Error('Shared finish geometry'); });
        hashes.add(hash(group)); release(twin);
        if (!column) baseline = info.stats;
        if (info.stats.meshes !== baseline.meshes || info.stats.materials !== baseline.materials || info.stats.textures !== 0) throw Error('Finish adds draw calls or textures');
        if (info.stats.triangles > baseline.triangles + 6000) throw Error('Finish exceeds geometry allowance');
        for (const face of spec.faces) for (let floor = 0; floor < spec.floors; floor++) {
          const decoration = new THREE.Group(); finishWall(decoration, face, floor, spec, HOUSE_PALETTES.find(p => p.id === palette).wall);
          decoration.updateMatrixWorld(true);
          decoration.traverse(o => {
            if (!o.isMesh) return;
            const b = new THREE.Box3().setFromObject(o);
            for (const slot of face.openings.filter(s => s.floor === floor)) {
              if (b.max.x > slot.x - slot.width / 2 - 0.15 && b.min.x < slot.x + slot.width / 2 + 0.15 && b.max.y > slot.bottom - 0.1 && b.min.y < slot.bottom + slot.height + 0.2) throw Error('Paint or bricks overlap opening trim');
            }
          });
          release(decoration);
        }
        stats.push({ palette, finish: finish.id, ...info.stats });
        stage.scene.add(group); fitCamera(stage.camera, info.bounds);
        stage.renderer.setViewport(column * 450, (1 - row) * 550, 450, 550); stage.renderer.setScissor(column * 450, (1 - row) * 550, 450, 550); stage.renderer.render(stage.scene, stage.camera);
        stage.scene.remove(group); release(group);
        if (!row) { const label = document.createElement('div'); label.className = 'label'; label.style.left = column * 450 + 'px'; label.textContent = finish.name; document.body.append(label); }
      }
      if (hashes.size !== 4) throw Error('Finish choices do not change appearance');
    }
    return stats;
  });
  await page.screenshot({ path: `${output}/wall-finishes.png` });
  await writeFile(`${output}/wall-finish-metrics.json`, JSON.stringify(result, null, 2));
  assert.deepEqual(errors, []);
  console.log('PASS four finishes in yellow/blue: deterministic, owned, no blocked openings, no extra draw calls/textures, bounded triangles');
  console.log(JSON.stringify(result.map(({ palette, finish, triangles, meshes }) => ({ palette, finish, triangles, meshes }))));
} finally { await browser.close(); }
