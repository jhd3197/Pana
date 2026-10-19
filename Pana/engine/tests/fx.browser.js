// Puffs: one draw call for all the smoke, puffs that fade and go, room that grows.
// The frame-rate guard: slow frames lower every bound renderer's pixel ratio.
import assert from 'node:assert/strict';
import { launch, base } from '../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent('<style>body{margin:0}</style><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  const puffs = await page.evaluate(async () => {
    const THREE = await import('three'), { Puffs } = await import('/engine/fx.js');
    const renderer = new THREE.WebGLRenderer(); renderer.setSize(640, 480); document.body.append(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 640 / 480, 0.1, 100);
    camera.position.set(0, 4, 12); camera.lookAt(0, 1, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
    const p = new Puffs(scene);
    p.spawn(new THREE.Vector3(0, 0, 0), { count: 40, color: 0xff0000 });
    p.spawn(new THREE.Vector3(2, 0, 0), { count: 60, color: 0x00ff00, life: 3 });
    renderer.render(scene, camera);
    const calls = renderer.info.render.calls, alive = p.count, capacity = p.capacity;
    for (let i = 0; i < 100; i++) p.update(1 / 60);
    const afterShort = p.count;   // 1.67 s: the red puffs (life 0.77–1.43 s) are gone, the green (2.1–3.9 s) remain
    for (let i = 0; i < 200; i++) p.update(1 / 60);
    renderer.render(scene, camera);
    return { calls, alive, capacity, afterShort, afterAll: p.count, meshes: scene.children.filter(o => o.isInstancedMesh).length };
  });
  assert.equal(puffs.alive, 100);
  assert.ok(puffs.capacity >= 100, 'the pool grew past its first 64');
  assert.equal(puffs.meshes, 1, 'growing replaced the mesh instead of adding one');
  assert.ok(puffs.calls <= 2, `all puffs draw together (${puffs.calls} calls)`);
  assert.equal(puffs.afterShort, 60, 'short-lived puffs are gone, long-lived ones stay');
  assert.equal(puffs.afterAll, 0, 'every puff fades out');

  const guard = await page.evaluate(async () => {
    const THREE = await import('three'), settings = await import('/engine/settings.js');
    settings.setSettings({ quality: 'alta' });
    const renderer = new THREE.WebGLRenderer(); settings.bindRenderer(renderer, 2);
    const before = renderer.getPixelRatio();
    // Busy frames: ~40 ms each, longer than the 22 ms limit.
    const until = performance.now() + 6000;
    while (performance.now() < until && settings.renderStep() === 0) {
      await new Promise(r => requestAnimationFrame(() => { const t = performance.now() + 40; while (performance.now() < t); r(); }));
    }
    const step = settings.renderStep(), after = renderer.getPixelRatio();
    settings.setSettings({ quality: 'media' });
    return { before, after, step, reset: settings.renderStep(), dpr: devicePixelRatio };
  });
  assert.ok(guard.step >= 1, 'slow frames step the resolution down');
  if (guard.dpr > 1) assert.ok(guard.after < guard.before, `pixel ratio dropped (${guard.before} → ${guard.after})`);
  assert.equal(guard.reset, 0, 'picking a quality starts again at full resolution');
  assert.deepEqual(errors, []);
  console.log('PASS fx: puffs pooled and fading; the frame-rate guard steps down and resets');
} finally { await browser.close(); }
