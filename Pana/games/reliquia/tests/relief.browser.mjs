// The carved bricks and rock in the real loop: which version each device gets, the swap when the
// picture setting changes, every shader variant compiling, and no draw or triangle added.
// Waits on state only.
import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const check = text => console.log(`ok  ${text}`);
const frames = (page, n = 4) => page.evaluate(n => new Promise(r => { const f = () => --n <= 0 ? r() : requestAnimationFrame(f); f(); }), n);
const browser = await launch();
const dive = async options => {
  const page = await openGame(browser, 'reliquia', { name: 'Juan', room: `fosa-relief-${Date.now().toString(36)}`, ...options });
  page.setDefaultTimeout(120_000);
  await waitFor(page, () => window.reliquia?.room.connected && reliquia.room.isHost);
  await waitFor(page, () => { if (reliquia.state.phase === 'playing') return true; document.getElementById('start').click(); return false; });
  await waitFor(page, () => reliquia.view.world.relief?.size > 0);
  await frames(page);
  return page;
};
const counts = page => page.evaluate(() => { const i = reliquia.view.renderer.info.render; return { calls: i.calls, triangles: i.triangles }; });
// The view's last real frame, not whatever the frame clock happens to catch.
const stand = page => page.evaluate(() => { reliquia.place(reliquia.room.id, -10, 8, Math.PI); reliquia.face(Math.PI, 0); });
try {
  const page = await dive({ query: 'debug' });
  await stand(page);
  await waitFor(page, () => Math.hypot(reliquia.me.x + 10, reliquia.me.z - 8) < .3);
  await frames(page);
  const low = await page.evaluate(() => { const r = reliquia.view.world.relief, mats = []; reliquia.view.scene.traverse(o => { if (o.material?.userData?.relief) mats.push(o.material); }); const rock = mats.find(m => m.userData.relief === 'rock'), brick = mats.find(m => m.userData.relief === 'brick'); return { on: r.on, size: r.size, rockKey: rock.customProgramCacheKey(), brickPatched: !!brick.userData.pomPrior, brickNormal: brick.normalMap?.name }; });
  assert.equal(low.on, false, 'low quality has no parallax');
  assert.equal(low.rockKey, 'pom:relief');
  assert.equal(low.brickPatched, false, 'the bricks are the stock normal map, no patch');
  assert.equal(low.brickNormal, 'relief-brick');
  const before = await counts(page);
  check('low quality: stock normal map on the bricks, one projected tap on the rock');

  // Live: the top detail turns it on, with the same draws and triangles.
  await page.evaluate(async () => { const { setSettings } = await import('/engine/settings.js'); setSettings({ detail: 'alta' }); });
  await waitFor(page, () => reliquia.view.world.relief.on === true);
  await frames(page);
  const high = await page.evaluate(() => { const mats = []; reliquia.view.scene.traverse(o => { if (o.material?.userData?.relief) mats.push(o.material); }); return mats.map(m => m.customProgramCacheKey()); });
  assert.ok(high.includes('pom:world:6:22:3:0:0'), `rock: ${high}`); assert.ok(high.includes('pom:uv:6:18:3:0:0'), `brick: ${high}`);
  const after = await counts(page);
  assert.equal(after.triangles, before.triangles); assert.equal(after.calls, before.calls);
  check(`top detail: the march is on, live, at the same ${after.calls} draws and ${after.triangles} triangles`);

  // Every variant compiles: both projections with self-shadow and the debug view, on an instanced box.
  await page.evaluate(async () => {
    const THREE = await import('three'), { applyPom, reliefMap } = await import('/engine/fx/pom.js'), v = reliquia.view, box = new THREE.BoxGeometry(1, 1, 1), added = [];
    for (const [i, options] of [{ projection: 'uv', selfShadow: true }, { projection: 'world', selfShadow: true, tile: [2, 2] }, { projection: 'uv', debug: true }].entries()) {
      const mesh = new THREE.InstancedMesh(box, applyPom(new THREE.MeshStandardMaterial({ map: reliefMap('brick') }), { heightMap: reliefMap('brick'), ...options }), 1);
      mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-10 + i * 1.3 - 1.3, 1.45, 5)); mesh.frustumCulled = false; v.scene.add(mesh); added.push(mesh);
    }
    v.renderer.render(v.scene, v.camera);
    window.reliefVariants = added;
  });
  await frames(page);
  await page.evaluate(() => window.reliefVariants.forEach(m => { m.removeFromParent(); m.material.dispose(); }));
  check('self-shadow and the debug view compile on both projections');

  // And back.
  await page.evaluate(async () => { const { setSettings } = await import('/engine/settings.js'); setSettings({ detail: 'baja' }); });
  await waitFor(page, () => reliquia.view.world.relief.on === false);
  await frames(page);
  assert.deepEqual(page.errors, []);
  check('back to low quality, with no shader or page errors');
  await page.context().close();

  // The address decides for QA; a phone never gets it even at the top detail.
  const off = await dive({ query: 'debug&pana-detail=alta&pom=0' });
  assert.equal(await off.evaluate(() => reliquia.view.world.relief.on), false);
  await off.context().close();
  const phone = await dive({ mobile: true, query: 'debug&pana-detail=alta' });
  assert.equal(await phone.evaluate(() => reliquia.view.world.relief.on), false);
  assert.deepEqual(phone.errors, []);
  check('?pom=0 turns it off, and a phone stays on the normal map at any setting');
} finally { await browser.close(); }
