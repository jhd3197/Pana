// Compile the actual night-world materials, including off-camera reflectors.
// r186 changed vColor to vec4; emissive radiance still requires RGB.
import assert from 'node:assert/strict';
import { base, launch } from '../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
  });
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script><canvas></canvas>');
  for (const id of ['track-galipan', 'track-maracaibo', 'track-tovar']) {
    const result = await page.evaluate(async id => {
      const THREE = await import('three');
      const { ASSETS } = await import('/studio/catalog.js');
      const { createPreview, fitCamera, release } = await import('/studio/preview.js');
      const asset = ASSETS.find(asset => asset.id === id);
      const model = await asset.build();
      const canvas = document.createElement('canvas');
      document.body.replaceChildren(canvas);
      const stage = createPreview(canvas, true);
      stage.renderer.setSize(320, 240, false); stage.camera.aspect = 4 / 3;
      // Keep original hooks; Material.clone() can discard onBeforeCompile.
      stage.scene.add(model.group);
      model.update?.(1, 0);
      fitCamera(stage.camera, model.bounds || new THREE.Box3().setFromObject(model.group), true);
      const materials = new Set();
      model.group.traverse(object => {
        if (!object.isMesh) return;
        object.frustumCulled = false;
        for (const material of [].concat(object.material || [])) materials.add(material);
      });
      stage.renderer.compile(stage.scene, stage.camera);
      stage.renderer.render(stage.scene, stage.camera);
      const result = {
        revision: THREE.REVISION,
        patched: [...materials].filter(material => material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile).length,
        programs: stage.renderer.info.programs.length,
        failed: stage.renderer.info.programs.filter(program => program.diagnostics?.runnable === false).length,
      };
      release(model); stage.dispose();
      return result;
    }, id);
    assert.equal(result.revision, '186');
    assert.ok(result.patched > 0, `${id}: exercise real shader hooks`);
    assert.ok(result.programs > 0, `${id}: compile actual programs`);
    assert.equal(result.failed, 0, `${id}: every shader links`);
    assert.deepEqual(errors, [], `${id}: no shader errors`);
    console.log(`PASS ${id}: ${result.programs} programs, ${result.patched} patched materials`);
  }
} finally { await browser.close(); }
