// Every body keeps the shared sculpt's proportions, independent of wheel lift.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { launch, openGame } from '../../../tests/browser-kit.js';

const browser = await launch();
const output = process.env.PANA_TEST_ARTIFACTS || join(tmpdir(), 'pana-driver-fit');
await mkdir(output, { recursive: true });
try {
  const page = await openGame(browser, 'carreritas', { query: 'debug&manual' });
  const metrics = await page.evaluate(async () => {
    const T = await import('three'), { CARS } = await import('./cars.js');
    const { DEFAULT_AVATAR } = await import('/engine/avatar.js');
    const { WHEEL_DEFINITIONS } = await import('./wheel-definitions.js');
    const { batchRacer } = await import('./racer-render.js');
    const bounds = root => { const b = new T.Box3(); root.traverseVisible(n => { if (n.isMesh) b.expandByObject(n, true); }); return b; };
    const out = [];
    for (const def of CARS) for (const hat of ['none', 'chef', 'llanero']) {
      const fits = [];
      for (const wheel of [null, WHEEL_DEFINITIONS.find(w => w.id === 'barro').wheel]) {
        const car = def.build({ ...DEFAULT_AVATAR, hat }, wheel), d = car.driver;
        car.root.updateMatrixWorld(true);
        const origin = car.chassis.getWorldPosition(new T.Vector3()).y;
        const face = new T.Box3().setFromObject(d.head.getObjectByName('Broad cocoa muzzle'), true);
        const fit = { scale: d.group.scale.toArray(), neck: d.neck.scale.toArray(), y: d.group.position.y, roofed: !car.fit.cabin.open,
          top: bounds(d.head).max.y - origin, mouth: face.min.y - origin, ...car.fit.driver };
        // Garage updates and the batched racing model must keep the same fit.
        batchRacer(car, def.color);
        for (let frame = 0; frame < 30; frame++) { d.update(1 / 60); d.neck.rotation.y = .3; }
        fit.animatedNeck = d.neck.scale.toArray(); fit.animatedSize = d.group.scale.toArray();
        fits.push(fit);
        const geometry = new Set(); car.root.traverse(n => { if (n.geometry) geometry.add(n.geometry); });
        d.dispose(); geometry.forEach(g => g.dispose()); car.batchedMaterials?.forEach(m => m.dispose());
      }
      out.push({ id: def.id, hat, fits });
    }
    return out;
  });
  for (const { id, hat, fits } of metrics) {
    for (const f of fits) {
      assert.deepEqual(f.neck, [1, 1, 1], `${id}/${hat}: no head-only resizing`);
      assert.deepEqual(f.scale, [f.size, f.size, f.size]);
      assert.deepEqual(f.animatedNeck, f.neck);
      assert.deepEqual(f.animatedSize, [f.size, f.size, f.size]);
      assert.ok(f.size > .3 && f.size <= .82 && Number.isFinite(f.y), `${id}/${hat}: usable uniform fit`);
      assert.ok(f.mouth >= f.sightline - 1e-5, `${id}/${hat}: face clears the dashboard`);
      assert.ok(!f.roofed || Number.isFinite(f.roofBottom), `${id}/${hat}: roof clearance is measured`);
      assert.ok(f.top <= f.roofBottom + 1e-5, `${id}/${hat}: equipped hat clears the roof`);
    }
    assert.ok(Math.abs(fits[0].size - fits[1].size) < 1e-8, `${id}/${hat}: wheels do not resize the driver`);
    assert.ok(Math.abs(fits[0].y - fits[1].y) < 1e-8, `${id}/${hat}: wheels do not reseat the driver`);
  }
  // Real meshes, same camera and lighting, for visual comparison across bodies.
  await page.evaluate(async () => {
    const T = await import('three'), { CARS } = await import('./cars.js');
    document.querySelectorAll('body > :not(canvas)').forEach(n => { n.style.display = 'none'; });
    const scene = new T.Scene(); scene.background = new T.Color('#0e0b24');
    scene.add(new T.HemisphereLight(0xffffff, 0x8778aa, 3));
    const sun = new T.DirectionalLight(0xffffff, 3); sun.position.set(4, 7, 6); scene.add(sun);
    const camera = new T.PerspectiveCamera(38, innerWidth / innerHeight, .1, 100);
    window.driverShot = async (id, side) => {
      if (window.shotCar) { scene.remove(shotCar.root); shotCar.driver.dispose(); }
      window.shotCar = CARS.find(c => c.id === id).build({ hat: 'none', outfit: 'franela', outfitColor: '#ff4b4b' });
      scene.add(shotCar.root); shotCar.driver.update(1 / 60);
      camera.position.set(side ? 6 : 3.5, 3.3, side ? 2.8 : 7); camera.lookAt(0, 1.55, 0);
      renderer.render(scene, camera);
    };
  });
  for (const id of ['chamo', 'bala', 'toro', 'escarabajo']) {
    await page.evaluate(id => driverShot(id, true), id);
    await page.screenshot({ path: join(output, `${id}-driver.png`) });
  }
  assert.deepEqual(page.errors, []);
  console.log(`PASS ${metrics.length} body/headwear fits, lifted wheels, garage updates and race batching`);
} finally { await browser.close(); }
