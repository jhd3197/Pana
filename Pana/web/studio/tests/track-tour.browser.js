// Real Studio interaction plus native route/camera regression for every circuit.
// node track-tour.browser.js [absolute-playwright-package]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const browser = process.env.PANA_QA_PROFILE ? null : await chromium.launch({ headless: true });
const base = process.env.PANA_QA_URL || 'http://localhost:8461', output = 'art/studio/tours';
await mkdir(output, { recursive: true });
const errors = [], records = [];
let context;
try {
  const options = { viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', permissions: ['clipboard-read','clipboard-write'] };
  context = browser ? await browser.newContext(options) : await chromium.launchPersistentContext(process.env.PANA_QA_PROFILE, { ...options, headless: true });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/studio.html#track-desierto`);
  await page.locator('#startup').waitFor({ state: 'hidden', timeout: 300000 });
  await page.waitForFunction(() => panaLibrary.current && document.querySelector('#preview-status').hidden, null, { timeout: 90000 });
  assert.equal(await page.evaluate(() => panaLibrary.thumbnails.state.generated), 0, 'opening one circuit does not prepare the catalog');
  const choose = async id => {
    await page.evaluate(id => { history.pushState(null, '', '/studio/assets/' + encodeURIComponent(id)); dispatchEvent(new PopStateEvent('popstate')); }, id);
    await page.waitForFunction(id => panaLibrary.selected === id && document.querySelector('#preview-status').hidden, id, { timeout: 90000 });
  };
  const seek = async value => page.locator('#tour-progress').evaluate((input, value) => { input.value = String(value); input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  const ids = await page.evaluate(() => panaLibrary.assets.filter(a => a.id.startsWith('track-')).map(a => a.id));
  for (const id of ids) {
    await choose(id);
    assert.equal(await page.locator('#track-tour').isVisible(), true);
    assert.equal(await page.evaluate(() => panaLibrary.tour.playing), false, 'never autoplay on selection');
    const record = await page.evaluate(async () => {
      const { tourPose } = await import('/studio/track-tour.js'), T = panaLibrary.current.route;
      const fail = message => { throw Error(T.id + ': ' + message); };
      let maxHeight = 0, maxStep = 0, previous;
      for (let s = 0; s < T.TOTAL; s += 2) {
        const view = tourPose(T, s), p = view.position;
        if (![...p, ...view.target].every(Number.isFinite)) fail('non-finite camera');
        // Over a jump gap (Puerto's ramp) there is no road under the camera, only the chasm:
        // measure from the road line the jump crosses, allowing the ramp lip it leaves from.
        const at = (T.LINE || 0) + s, lip = Math.max(0, ...(T.ramps || []).map(r => r.h));
        if (T.gapAt?.(at)) {
          const over = p.y - T.heightAtS(at);
          if (over < 2.9 || over > 12 + lip) fail(`camera gap clearance ${over}`);
        } else {
          const height = p.y - T.groundAt(p.x, p.z); maxHeight = Math.max(maxHeight, height);
          if (height < 2.9 || height > 12) fail(`camera road clearance ${height}`);
        }
        if (Math.abs(T.offsetOf(p.x, p.z)) > .05) fail('camera left centreline');
        if (previous) maxStep = Math.max(maxStep, p.distanceTo(previous));
        previous = p;
      }
      const first = tourPose(T, 0), end = tourPose(T, T.TOTAL), line = T.pointAt(T.LINE);
      if (first.position.distanceTo(end.position) > 1e-5 || first.target.distanceTo(end.target) > 1e-5) fail('lap seam');
      if (Math.hypot(first.position.x-line.x,first.position.z-line.y) > 1e-5) fail('wrong start line');
      if (maxStep > 4) fail(`camera jumps ${maxStep} m`);
      return { id: T.id, length: T.TOTAL, maxHeight, maxStep };
    });
    records.push(record); console.log('route', JSON.stringify(record));
    await page.locator('#tour-play').click();
    await page.waitForFunction(() => panaLibrary.tour.distance > 2);
    assert.equal(await page.evaluate(() => panaLibrary.camera.fov), 64);
    assert.equal(await page.evaluate(() => panaLibrary.scene.background.getHex() === panaLibrary.current.route.def.palette.horizon && !!panaLibrary.scene.fog), true);
    assert.equal(await page.evaluate(() => panaLibrary.scene.children.filter(o=>o.userData.isSky).length),1,'one live tour sky');
    await page.locator('#tour-play').click();
    const paused = await page.evaluate(() => ({ distance: panaLibrary.tour.distance, camera: panaLibrary.camera.position.toArray() }));
    await page.waitForTimeout(150);
    const settled = await page.evaluate(() => ({ distance: panaLibrary.tour.distance, camera: panaLibrary.camera.position.toArray() }));
    assert.equal(settled.distance, paused.distance);
    assert.ok(await page.evaluate(() => Math.abs(panaLibrary.scene.getObjectByName('Living sky').material.uniforms.time.value-panaLibrary.tour.distance/24)<1e-8),'sky pauses with tour');
    // OrbitControls converts through spherical coordinates, with floating-point roundoff.
    assert.ok(settled.camera.every((v,i) => Math.abs(v-paused.camera[i]) < 1e-8), 'paused camera stays still');
    await seek(id === 'track-selva' ? await page.evaluate(async () => { const {TUNNEL}=await import('/g/carreritas/tracks/selva-layout.js'),T=panaLibrary.current.route;return (((TUNNEL.from+.02)*T.TOTAL-T.LINE+T.TOTAL)%T.TOTAL)/T.TOTAL*1000; }) : 230);
    await page.locator('#tour-expand').click();
    await page.waitForFunction(() => document.querySelector('#preview').clientWidth > 1400);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${output}/${id}.png` });
    await page.locator('#tour-expand').click();
    await page.locator('#tour-overview').click();
    assert.equal(await page.evaluate(() => panaLibrary.camera.fov), 34);
    assert.equal(await page.evaluate(() => panaLibrary.scene.fog), null);
    assert.equal(await page.evaluate(() => panaLibrary.tour.active), false);
    assert.equal(await page.evaluate(() => panaLibrary.scene.children.filter(o=>o.userData.isSky).length),0,'overview releases the sky');
  }
  await choose('track-desierto'); await seek(500);
  await page.locator('#tour-copy').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /50\.0 %/); assert.match(copied, /Pista XYZ:/); assert.match(copied, /\/studio\/assets\/track-desierto/);
  assert.equal(await page.evaluate(() => panaLibrary.tour.playing), false);
  await page.locator('#tour-speed').selectOption('4'); await seek(999);
  await page.locator('#tour-play').click(); await page.waitForFunction(() => !panaLibrary.tour.playing);
  assert.equal(await page.locator('#tour-progress').inputValue(), '1000');
  assert.equal(await page.locator('#tour-play').innerText(), 'Repetir recorrido');
  await page.locator('#tour-play').click(); await page.waitForFunction(() => panaLibrary.tour.playing && panaLibrary.tour.distance < 100);
  await page.locator('#tour-play').click();
  // Inspect while paused; resume returns to the sampled road camera.
  const canvas = await page.locator('#preview').boundingBox();
  const beforeOrbit = await page.evaluate(() => panaLibrary.camera.position.toArray());
  await page.mouse.move(canvas.x+canvas.width/2, canvas.y+canvas.height/2); await page.mouse.down();
  await page.mouse.move(canvas.x+canvas.width/2+90, canvas.y+canvas.height/2, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(200);
  assert.notDeepEqual(await page.evaluate(() => panaLibrary.camera.position.toArray()), beforeOrbit);
  await page.locator('#preview').focus(); await page.keyboard.press('ArrowRight');
  assert.ok(await page.evaluate(() => panaLibrary.tour.distance) >= 120);
  await page.keyboard.press('Space'); assert.equal(await page.evaluate(() => panaLibrary.tour.playing), true);
  // Simulate visibility loss to exercise the same handler used by background tabs.
  await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden; });
  assert.equal(await page.evaluate(() => panaLibrary.tour.playing), false);
  await page.locator('#tour-expand').click(); await choose('corn');
  assert.equal(await page.locator('#track-tour').isVisible(), false);
  assert.equal(await page.evaluate(() => document.querySelector('#studio-app').classList.contains('expanded-view')), false);
  assert.equal(await page.evaluate(() => panaLibrary.camera.fov), 34);
  await page.locator('#camera-view').selectOption('side'); assert.equal(await page.evaluate(() => panaLibrary.camera.position.x > 0), true);
  await choose('track-desierto'); await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#tour-play').click(); await page.waitForFunction(() => panaLibrary.tour.distance > 2); await page.locator('#tour-play').click();
  await page.locator('#tour-expand').click();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const controls = await page.locator('#track-tour').boundingBox(); assert.ok(controls.y + controls.height <= 845);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${output}/mobile.png` });
  await page.reload(); await page.locator('#startup').waitFor({ state: 'hidden', timeout: 90000 });
  assert.equal(await page.evaluate(() => panaLibrary.thumbnails.state.generated), 0, 'warm thumbnails are reused');
  await page.waitForFunction(() => panaLibrary.current && document.querySelector('#preview-status').hidden, null, { timeout: 90000 });
  assert.equal(await page.evaluate(() => panaLibrary.tour.playing), false);
  assert.deepEqual(errors, []); await writeFile(`${output}/routes.json`, JSON.stringify(records,null,2));
  console.log('PASS: eight routes, playback, pause, scrub, copy, completion, orbit, keyboard, visibility, asset switch, mobile and warm cache');
} finally { await context?.close(); await browser?.close(); }
