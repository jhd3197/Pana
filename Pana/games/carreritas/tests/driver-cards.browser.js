// Race drivers: trimDriver keeps the pana's shape while shedding studio
// detail; a rival's card replaces it with a baked photograph that looks like
// it at racing distance, and the real pana returns close to a camera. A far
// rival's car is one merged mesh that looks like the real one at 40 m.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true }), errors = [];
try {
  const page = await browser.newPage(); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`${process.env.PANA_TEST_URL || 'http://localhost:8461'}/g/carreritas/?debug&manual`);
  await page.waitForFunction(() => window.garage?.car, null, { timeout: 90000 });
  const r = await page.evaluate(async () => {
    const THREE = await import('three'), { CARS } = await import('./cars.js');
    const { trimDriver, batchRacer } = await import('./racer-render.js'), cards = await import('./driver-cards.js');
    const { prepareImpostors, impostorPlacements } = await import('/engine/models/core/impostor.js');
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(50, 1, .1, 200);
    scene.background = new THREE.Color(0x8fb8d8); scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(8, 12, 10); scene.add(sun);
    const target = new THREE.WebGLRenderTarget(256, 256);
    const shot = () => { const data = new Uint8Array(256 * 256 * 4); renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.readRenderTargetPixels(target, 0, 0, 256, 256, data); renderer.setRenderTarget(null); return data; };
    const shown = root => { const out = []; root.traverse(o => { if (!o.isMesh) return; for (let p = o; p; p = p.parent) if (!p.visible) return; out.push(o); }); return out; };
    const car = CARS[1].build({ name: 'Pana', color: '#e63946' }); scene.add(car.root); batchRacer(car, CARS[1].color);
    const before = shown(car.driver.group), size = new THREE.Box3().setFromObject(car.driver.group).getSize(new THREE.Vector3());
    trimDriver(car);
    const after = shown(car.driver.group), trimmed = new THREE.Box3().setFromObject(car.driver.group).getSize(new THREE.Vector3());
    // A racing-distance view from behind and above, as the chase camera sees a rival.
    camera.position.set(5, 5.5, -17); camera.lookAt(0, 1.4, 0); camera.updateMatrixWorld();
    const real = shot();
    cards.cardDriver(car); prepareImpostors(renderer);
    const card = car.driverCard, baked = card.userData.atlas.targets.albedo, texels = new Uint8Array(baked.width * baked.height * 4);
    renderer.readRenderTargetPixels(baked, 0, 0, baked.width, baked.height, texels);
    const far = cards.showRival(car, { x: 0, z: 0 }, [camera]), photo = shot();
    camera.position.set(2, 2, -4); camera.updateMatrixWorld();
    const near = cards.showRival(car, { x: 0, z: 0 }, [camera]), realVisible = car.driver.group.visible, cardVisible = card.visible;
    let difference = 0; for (let i = 0; i < real.length; i += 4) for (let k = 0; k < 3; k++) difference += Math.abs(real[i + k] - photo[i + k]);
    // The distant car: 40 m away, real parts against the merged mesh.
    cards.farCar(car);
    const parts = car.far.parts.length;
    camera.position.set(8, 8, -39); camera.lookAt(0, 1, 0); camera.fov = 12; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    cards.showRival(car, { x: 0, z: 0 }, [camera]); const merged = shot(), farOn = car.far.on && car.far.mesh.visible && car.far.parts.every(p => !p.visible);
    car.far.on = false; car.far.mesh.visible = false; car.far.parts.forEach(p => { p.visible = true; }); const whole = shot();
    const boating = (cards.showRival(car, { x: 0, z: 0, boat: true }, [camera]), car.far.on);
    camera.position.set(3, 3, -20); camera.updateMatrixWorld(); cards.showRival(car, { x: 0, z: 0 }, [camera]);
    const backOn = !car.far.on && car.far.parts.every(p => p.visible);
    let farDifference = 0; for (let i = 0; i < whole.length; i += 4) for (let k = 0; k < 3; k++) farDifference += Math.abs(whole[i + k] - merged[i + k]);
    target.dispose();
    // Identical sources share one bake, and the atlas outlives its cards so
    // a map loaded again reuses it; a different source bakes its own.
    const prop = color => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.ConeGeometry(1, 3, 7), new THREE.MeshStandardMaterial({ color }))); return g; };
    const holder = new THREE.Group(), place = color => impostorPlacements(holder, prop(color), [{ x: 0, y: 0, z: 0 }], { name: 'cache-probe' })[0];
    const one = place(0x2a8040), two = place(0x2a8040), other = place(0x804020); prepareImpostors(renderer);
    const atlas = m => m.userData.atlas.targets.albedo, shared = atlas(one) === atlas(two) && atlas(one) !== atlas(other);
    one.geometry.dispose(); two.geometry.dispose();
    const again = place(0x2a8040); prepareImpostors(renderer);
    const reused = atlas(again) === atlas(one) && !!renderer.properties.get(atlas(again).texture).__webglTexture;
    again.geometry.dispose(); other.geometry.dispose();
    return {
      shared, reused,
      shown: [before.length, after.length], physical: after.filter(o => o.material.isMeshPhysicalMaterial).length,
      size: size.toArray(), trimmed: trimmed.toArray(), carded: !!card, far, near, realVisible, cardVisible,
      baked: card.geometry.instanceCount === 1 && baked.width > 1 && texels.some((v, i) => i % 4 === 3 && v > 200), meanChannelDifference: difference / (256 * 256 * 3),
      parts, farOn, boating, backOn, farDifference: farDifference / (256 * 256 * 3),
    };
  });
  assert.ok(r.shown[1] < r.shown[0], `trim hides studio details: ${r.shown}`);
  assert.equal(r.physical, 0, 'race drivers use standard materials');
  assert.ok(r.size.every((v, i) => Math.abs(v - r.trimmed[i]) < .05), `trim keeps the pana's size: ${r.size} vs ${r.trimmed}`);
  assert.ok(r.carded && r.baked, 'the rival gets a baked card');
  assert.equal(r.far, false, 'a far camera sees the card');
  assert.ok(r.near && r.realVisible && !r.cardVisible, 'a close camera sees the real pana again');
  // The card only differs inside the driver's few hundred pixels at this distance.
  assert.ok(r.meanChannelDifference < .25, `the card reads like the pana at racing distance: ${r.meanChannelDifference}`);
  assert.ok(r.parts > 8 && r.farOn, `beyond 35 m the rival is one mesh instead of ${r.parts} parts`);
  assert.equal(r.boating, false, 'a boat or plane phase keeps the real car');
  assert.ok(r.backOn, 'closer than 35 m the real parts return');
  assert.ok(r.farDifference < 1, `the merged car reads like the real one at 40 m: ${r.farDifference}`);
  assert.ok(r.shared && r.reused, 'identical impostor sources share one kept bake');
  assert.deepEqual(errors, []);
  console.log('driver cards ok', JSON.stringify(r));
} finally { await browser.close(); }
