// Real WebGL models, camera picking, full-viewport layout and Studio factories.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.PANA_TEST_URL || 'http://localhost:8461', out = 'art/plaza-games';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent('<style>body{margin:0}</style><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  const ids = ['pool-table', 'pool-ball', 'pool-cue', 'poker-table', 'poker-card', 'poker-chips', 'paint-marker'];
  for (const id of ids) {
    const result = await page.evaluate(async id => {
      const THREE = await import('three'), { ASSETS } = await import('/studio/catalog.js');
      window.modelPreview?.dispose();
      const asset = ASSETS.find(a => a.id === id), model = await asset.build();
      const bounds = new THREE.Box3().setFromObject(model.group), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
      const scene = new THREE.Scene(); scene.background = new THREE.Color('#dce5e0'); scene.add(model.group);
      scene.add(new THREE.HemisphereLight('#ffffff', '#9a8060', 2.5)); const sun = new THREE.DirectionalLight('#fff0d2', 3); sun.position.set(-6, 12, 5); scene.add(sun);
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setSize(900, 700); document.querySelector('canvas')?.remove(); document.body.append(renderer.domElement);
      const camera = new THREE.PerspectiveCamera(38, 900 / 700, .001, 100); camera.position.copy(center).add(new THREE.Vector3(.3, .8, 1).normalize().multiplyScalar(size.length() * 1.6)); camera.lookAt(center); renderer.render(scene, camera);
      let finite = true; model.group.traverse(o => { const p = o.geometry?.attributes.position; if (p) for (const v of p.array) if (!Number.isFinite(v)) finite = false; });
      window.modelPreview = { dispose() { model.group.userData.dispose(); model.group.userData.dispose(); renderer.dispose(); } };
      return { finite, size: size.toArray(), calls: renderer.info.render.calls };
    }, id);
    assert.ok(result.finite && result.size.every(n => n > 0), `${id}: usable finite geometry`);
    if (id === 'poker-chips') assert.ok(result.calls <= 2, 'chip stacks batch to two materials');
    await page.screenshot({ path: `${out}/studio-${id}.png` });
  }
  await page.evaluate(() => window.modelPreview.dispose()); await page.close();
  for (const game of ['billar', 'poquer', 'pintura'].filter(game => !process.argv[2] || process.argv.slice(2).includes(game))) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true, deviceScaleFactor: 1 });
    await context.addInitScript(() => { localStorage.setItem('pana:name', 'Prueba 3D'); localStorage.setItem('pana:settings', JSON.stringify({ sound: false, quality: 'baja' })); });
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(`${base}/g/${game}/?room=three-${game}-${Date.now()}&debug`);
    await p.waitForFunction(game => window[`${game}Debug`]?.room.connected, game, { timeout: 90000 });
    const practice = await p.locator('#practice').boundingBox(); assert.ok(practice.y + practice.height <= 800, `${game}: laptop start visible`);
    await p.locator('#practice').click();
    await p.waitForFunction(game => window[`${game}Debug`].room.state.phase !== 'lobby', game);
    for (const [width, height] of [[1280, 800], [390, 844], [844, 390]]) {
      await p.setViewportSize({ width, height }); await p.waitForTimeout(350);
      if (game === 'poquer') await p.waitForFunction(() => [...document.querySelectorAll('.seat')].every(n => n.style.left && n.style.top));
      const info = await p.evaluate(game => {
        const { world, room } = window[`${game}Debug`], canvas = world.renderer.domElement, rect = canvas.getBoundingClientRect();
        let error = 0;
        if (game === 'billar') { const s = world.screen(500, 250), q = world.point(s.x, s.y); error = Math.hypot(q.x - 500, q.y - 250); }
        if (game === 'pintura') { const me = room.state.players.find(p => p.id === room.id), f = world.forward(), x = me.x + f.x * 6, z = me.z + f.z * 6, s = world.screen(x, z), q = world.point(s.x, s.y); error = Math.hypot(q.x - x, q.z - z); }
        return { perspective: world.camera.isPerspectiveCamera, error, w: rect.width, h: rect.height, overflow: document.documentElement.scrollWidth > innerWidth, draws: world.renderer.info.render.calls };
      }, game);
      assert.ok(info.perspective && info.error < .001, `${game}: perspective picking matches game coordinates`);
      assert.deepEqual([info.w, info.h, info.overflow], [width, height, false]);
      if (game === 'poquer') assert.ok(await p.evaluate(() => {
        const labels = [...document.querySelectorAll('.seat')].map(n => n.getBoundingClientRect());
        return labels.every((a, i) => labels.slice(i + 1).every(b => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top));
      }), `poker player labels remain separate at ${width}×${height}`);
      const buttons = game === 'billar' ? ['shoot'] : game === 'poquer' ? ['call', 'raise'] : ['fire', 'reload'];
      for (const id of buttons) { const b = await p.locator(`#${id}`).boundingBox(); assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= width + 1 && b.y + b.height <= height + 1, `${game}/${id}: reachable at ${width}×${height}`); }
      await p.screenshot({ path: `${out}/${game}-${width}-proof.png` });
    }
    if (game === 'pintura') {
      await p.setViewportSize({ width: 1280, height: 800 });
      const before = await p.evaluate(() => pinturaDebug.world.camera.getWorldDirection(new pinturaDebug.world.camera.position.constructor()).toArray());
      await p.locator('#world').focus(); await p.keyboard.down('e'); await p.waitForFunction(start => Math.abs(pinturaDebug.world.yaw - start) > .5, await p.evaluate(() => pinturaDebug.world.yaw)); await p.keyboard.up('e');
      const after = await p.evaluate(() => pinturaDebug.world.camera.getWorldDirection(new pinturaDebug.world.camera.position.constructor()).toArray()); assert.ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > .3, 'Q/E turn the real first-person camera');
    }
    await context.close(); console.log(`ok: ${game} 3D stage, picking, laptop and touch layouts`);
  }
  assert.deepEqual(errors, []); console.log('Studio models and three-game 3D proof passed.');
} finally { await browser.close(); }
