import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openGame } from '../../../tests/browser-kit.js';

const browser = await launch();
const output = process.env.PANA_TEST_ARTIFACTS || join(tmpdir(), 'pana-snow-loading');
await mkdir(output, { recursive: true });
try {
  const page = await openGame(browser, 'carreritas', { query: 'debug&manual&auto&track=paramo' });
  const preparation = await page.evaluate(async () => {
    const THREE = await import('three');
    const { prepareRace } = await import('/g/carreritas/prepare-race.js');
    const r = new THREE.WebGLRenderer(), scene = new THREE.Scene(); r.setSize(128, 128);
    const camera = new THREE.PerspectiveCamera(50, 1, .1, 100); camera.position.z = 5;
    const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial({ color: 'red' });
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4;
    const texture = new THREE.CanvasTexture(canvas); material.map = texture;
    const objects = Array.from({ length: 110 }, (_, i) => {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.x = i === 109 ? 200 : (i % 10 - 5) * .1;
      scene.add(mesh); return mesh;
    });
    const hidden = new THREE.Group(); hidden.visible = false; scene.add(hidden);
    const hiddenMesh = new THREE.Mesh(geometry, material); hidden.add(hiddenMesh);
    let hiddenDraws = 0, distantDraws = 0, uploads = 0;
    hiddenMesh.onBeforeRender = () => hiddenDraws++;
    objects.at(-1).onBeforeRender = () => distantDraws++;
    const init = r.initTexture.bind(r); r.initTexture = t => { uploads++; init(t); };
    const originalRender = r.render.bind(r);
    const before = objects.map(o => [o.layers.mask, o.frustumCulled, o.visible]);
    const state = () => ({ objects: objects.map(o => [o.layers.mask, o.frustumCulled, o.visible]), scissor: r.getScissor(new THREE.Vector4()).toArray(), test: r.getScissorTest() });
    r.setScissor(3, 4, 100, 101); r.setScissorTest(false);
    const initial = state();
    let slices = 0;
    const cancelled = await prepareRace(r, scene, camera, async label => {
      if (label.includes('paisaje')) slices++;
      await new Promise(requestAnimationFrame);
      return slices < 2;
    });
    const afterCancel = state();
    let threw = false;
    r.render = () => { throw Error('Expected GPU preparation failure'); };
    try { await prepareRace(r, scene, camera, async () => true); } catch { threw = true; }
    const afterFailure = state(); r.render = originalRender;
    uploads = 0; slices = 0;
    const completed = await prepareRace(r, scene, camera, async label => {
      if (label.includes('paisaje')) slices++;
      await new Promise(requestAnimationFrame); return true;
    });
    const afterSuccess = state(), firstSlices = slices;
    slices = 0;
    await prepareRace(r, scene, camera, async label => { if (label.includes('paisaje')) slices++; return true; });
    const result = { cancelled, completed, threw, before, initial, afterCancel, afterFailure, afterSuccess,
      hiddenDraws, distantDraws, uploads, firstSlices, replaySlices: slices };
    geometry.dispose(); material.dispose(); texture.dispose(); r.dispose(); r.forceContextLoss();
    return result;
  });
  assert.equal(preparation.cancelled, false);
  assert.ok(preparation.completed && preparation.threw);
  for (const key of ['afterCancel', 'afterFailure', 'afterSuccess']) assert.deepEqual(preparation[key], preparation.initial, key);
  assert.equal(preparation.hiddenDraws, 0);
  assert.equal(preparation.distantDraws, 0, 'unseen geometry stays off the loading path');
  assert.equal(preparation.uploads, 2, 'one shared texture per preparation call');
  assert.ok(preparation.firstSlices > 0);
  assert.equal(preparation.replaySlices, 0, 'unchanged prepared objects are reused');

  // Real game lifecycle: GPU animation does not upload vertex positions each
  // frame; both split cameras render flakes around their own view.
  const raceProof = await page.evaluate(async () => {
    const { setSettings } = await import('/engine/settings.js');
    toGarage(); setup.split = true; setup.mirror = true; await startRace(0);
    const snow = race.rain.snow, T = getActiveTrack();
    const positions = snow.geometry.attributes.position, seeds = snow.geometry.attributes.flakeSeed;
    const before = [positions.version, seeds.version, race.rain.lines.geometry.attributes.position.version];
    const low = snow.geometry.instanceCount;
    const sample = t => { race.rain.update(0, 80, 0, t, 0); return T.group.userData.snowAmount.value; };
    const a = sample(90), b = sample(0), c = sample(90);
    setSettings({ quality: 'media' }); const medium = snow.geometry.instanceCount;
    setSettings({ quality: 'alta' }); const high = snow.geometry.instanceCount;
    // Drive the shaders in the real mirrored scene and second camera.
    const seen = [];
    snow.onBeforeRender = (_renderer, _scene, camera) => seen.push(camera.uuid);
    renderer.render(race.scene, race.camera); renderer.render(race.scene, race.camera2);
    snow.onBeforeRender = () => {};
    race.player.cloud = 1; race.items.update(0, race.cars, false);
    const itemRain = race.rain.lines.visible;
    race.player.cloud = 0; race.items.update(0, race.cars, false);
    const mats = new Set(); T.group.traverse(o => { for (const m of [].concat(o.material || [])) if (m.userData.snowAmount) mats.add(m); });
    const clone = [...mats][0].clone();
    const independent = clone.userData.snowAmount !== [...mats][0].userData.snowAmount;
    clone.dispose();
    return { id: T.id, snow: snow.visible, rain: race.rain.lines.visible, low, medium, high,
      before, after: [positions.version, seeds.version, race.rain.lines.geometry.attributes.position.version],
      a, b, c, seen, cameras: [race.camera.uuid, race.camera2.uuid], independent,
      materials: mats.size, shared: [...mats].every(m => m.userData.snowAmount === T.group.userData.snowAmount), split: !!race.p2, itemRain };
  });
  assert.equal(raceProof.id, 'paramo'); assert.ok(raceProof.snow && !raceProof.rain && raceProof.split, JSON.stringify(raceProof));
  assert.deepEqual([raceProof.low, raceProof.medium, raceProof.high], [280, 700, 1400]);
  assert.deepEqual(raceProof.before, raceProof.after, 'snow changes uniforms, not CPU buffers');
  assert.ok(raceProof.a > raceProof.b); assert.equal(raceProof.a, raceProof.c);
  assert.deepEqual(raceProof.seen, raceProof.cameras);
  assert.ok(raceProof.independent && raceProof.shared && raceProof.materials > 0);
  assert.ok(raceProof.itemRain, 'Aguacero still produces rain on Páramo');
  await page.screenshot({ path: join(output, 'paramo-snow.png') });

  const surface = await page.evaluate(async () => {
    const THREE = await import('three');
    const { applyNatureMaterials } = await import('/g/carreritas/tracks/nature-material.js');
    const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true }); r.setSize(256, 256);
    const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 2));
    const source = new THREE.MeshStandardMaterial({ color: 0x315123 });
    const geo = new THREE.BoxGeometry(3, 2, 3), box = new THREE.Mesh(geo, source);
    box.userData.snowSurface = true; box.position.y = 100; group.add(box);
    applyNatureMaterials(group, 'paramo');
    const clone = box.material.clone(); box.material = clone;
    const camera = new THREE.PerspectiveCamera(45, 1, .1, 100); camera.position.set(4, 105, 6); camera.lookAt(0, 100, 0);
    const pixels = amount => {
      clone.userData.snowAmount.value = amount; r.render(scene, camera);
      const gl = r.getContext(), out = new Uint8Array(256 * 256 * 4); gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,out); return out;
    };
    const dry = pixels(0), snowy = pixels(1), programs = r.info.programs.length;
    let changed = 0; for (let i = 0; i < dry.length; i += 4) if (snowy[i] > dry[i] + 20) changed++;
    clone.userData.natureDetail.value = 0;
    const low = pixels(1); let lowChanged = 0;
    for (let i = 0; i < dry.length; i++) if (dry[i] !== low[i]) lowChanged++;
    const programsAfter = r.info.programs.length;
    geo.dispose(); source.dispose(); clone.dispose(); group.userData.dispose(); r.dispose(); r.forceContextLoss();
    return { changed, lowChanged, programs, programsAfter };
  });
  assert.ok(surface.changed > 100, JSON.stringify(surface));
  assert.equal(surface.lowChanged, 0, 'low quality restores the authored surface');
  assert.equal(surface.programsAfter, surface.programs, 'snow and quality use uniforms');

  const reset = await page.evaluate(async () => {
    toGarage(); setup.split = false; setup.mirror = false; await startRace(0);
    const snow = getActiveTrack().group.userData.snowAmount.value;
    toGarage(); document.getElementById('t-next').click(); await startRace(0);
    return { snow, id: getActiveTrack().id, visible: race.rain.snow.visible };
  });
  assert.equal(reset.snow, 0.28); assert.notEqual(reset.id, 'paramo'); assert.equal(reset.visible, false);
  const mobile = await openGame(browser, 'carreritas', { mobile: true, query: 'debug&manual&auto&track=paramo' });
  await mobile.evaluate(() => startRace(0));
  assert.ok(await mobile.evaluate(() => race.rain.snow.visible && race.rain.snow.geometry.instanceCount === 280));
  await mobile.screenshot({ path: join(output, 'paramo-mobile.png') });
  assert.deepEqual([...page.errors, ...mobile.errors], []);
  console.log(JSON.stringify({ preparation: { firstSlices: preparation.firstSlices, replaySlices: preparation.replaySlices }, raceProof, surface, reset }));
} finally { await browser.close(); }
