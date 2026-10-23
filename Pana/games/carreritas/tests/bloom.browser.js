import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launch, openGame, base } from '../../../tests/browser-kit.js';

const browser = await launch(), output = join(tmpdir(), 'pana-plaza-bloom');
await mkdir(output, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 650 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script><style>body{margin:0}</style><canvas></canvas>');
  const fixture = await page.evaluate(async () => {
    const THREE = await import('three'), preview = await import('/studio/preview.js');
    const { araguaney } = await import('/engine/models/vegetation/araguaney.js');
    const { instancePlacements } = await import('/engine/models/core/static-batch.js');
    const { plazaBloom } = await import('/g/carreritas/tracks/plaza-bloom.js');
    const { applyNatureMaterials } = await import('/g/carreritas/tracks/nature-material.js');
    const { applyRaceQuality } = await import('/g/carreritas/quality.js');
    const group = new THREE.Group();
    for (const [bloom, x, name] of [['gold', -4, 'araguaney'], ['pink', 4, 'apamate']]) {
      instancePlacements(group, araguaney({ bloom, detail: 'low', seed: 15 }), [{ x, y: 0, z: 0, scale: 1.4 }], { name: `festive-${name}` });
    }
    instancePlacements(group, araguaney({ flowers: false, detail: 'low', seed: 8 }), [{ x: 0, y: 0, z: -8 }], { name: 'unaffected-green-tree' });
    const before = preview.inspect({ group }).stats;
    const petals = plazaBloom(group); applyNatureMaterials(group, 'plaza');
    const stage = preview.createPreview(document.querySelector('canvas'), true);
    stage.renderer.setSize(900, 650, false); stage.camera.aspect = 900 / 650;
    stage.camera.position.set(16, 10, 26); stage.camera.lookAt(0, 4.5, 0); stage.camera.updateProjectionMatrix();
    stage.scene.add(group);
    const crowns = [], other = [];
    group.traverse(o => { if (o.material?.userData.bloomTime) crowns.push(o); else if (o.material?.userData.natureDetail) other.push(o); });
    const originals = crowns.map(o => o.material), petalMaterial = petals.material;
    const versions = () => Object.values(petals.geometry.attributes).map(a => a.version);
    const originalVersions = versions();
    preview.ownMaterials({ group });
    const independent = crowns.every((o, i) => o.material.userData.bloomTime !== originals[i].userData.bloomTime);
    petals.userData.tick(90);
    const cloneTicks = crowns.every(o => o.material.userData.bloomTime.value === 90) && petals.material.uniforms.bloomTime.value === 90;
    const untouched = originals.every(m => m.userData.bloomTime.value === 0) && petalMaterial.uniforms.bloomTime.value === 0;
    const pixels = () => {
      stage.renderer.render(stage.scene, stage.camera);
      const gl = stage.renderer.getContext(), p = new Uint8Array(900 * 650 * 4);
      gl.readPixels(0, 0, 900, 650, gl.RGBA, gl.UNSIGNED_BYTE, p); return p;
    };
    const delta = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };
    const samples = {};
    for (const quality of ['baja', 'media', 'alta']) {
      applyRaceQuality(stage.renderer, { trackGroup: group }, quality); stage.renderer.shadowMap.enabled = false;
      const count = petals.geometry.instanceCount; petals.geometry.instanceCount = 0;
      petals.userData.tick(0); const bloom = pixels();
      petals.userData.tick(90); const green = pixels();
      petals.userData.tick(0); const reset = pixels();
      samples[quality] = { count, changed: delta(bloom, green), reset: delta(bloom, reset) };
    }
    const programs = stage.renderer.info.programs.length;
    petals.geometry.instanceCount = petals.userData.petalField.full;
    petals.userData.tick(12); const a = pixels();
    petals.userData.tick(14);
    // Freeze canopy time to isolate falling-petal motion.
    crowns.forEach(o => { o.material.userData.bloomTime.value = 12; });
    const motion = delta(a, pixels());
    petals.userData.tick(12); const rewind = delta(a, pixels());
    window.bloomProof = { stage, group, petals, preview, crowns, originals, petalMaterial };
    return { before, independent, cloneTicks, untouched, samples, programs, afterPrograms: stage.renderer.info.programs.length,
      motion, rewind, originalVersions, versions: versions(), trees: petals.userData.petalField.trees,
      crownCount: crowns.length, excluded: other.every(o => !o.userData.bloom), wind: crowns.every(o => o.material.baseKey.includes('pana-tree-')) };
  });
  await page.screenshot({ path: join(output, 'fixture.png') });
  assert.deepEqual(errors, []);
  assert.ok(fixture.independent && fixture.cloneTicks && fixture.untouched && fixture.excluded && fixture.wind, JSON.stringify(fixture));
  assert.equal(fixture.trees, 2); assert.equal(fixture.crownCount, 2);
  assert.deepEqual(['baja', 'media', 'alta'].map(q => fixture.samples[q].count), [0, 24, 72]);
  assert.equal(fixture.samples.baja.changed, 0);
  for (const q of ['media', 'alta']) assert.ok(fixture.samples[q].changed > 1000, `${q}: ${JSON.stringify(fixture.samples[q])}`);
  for (const q of ['baja', 'media', 'alta']) assert.equal(fixture.samples[q].reset, 0);
  assert.ok(fixture.motion > 10, `visible moving petals: ${fixture.motion}`); assert.equal(fixture.rewind, 0);
  assert.equal(fixture.programs, fixture.afterPrograms);
  assert.deepEqual(fixture.versions, fixture.originalVersions);
  for (const [label, time] of [['flowers', 0], ['green', 90]]) {
    await page.evaluate(time => { const s = bloomProof; s.petals.userData.tick(time); s.stage.renderer.render(s.stage.scene, s.stage.camera); }, time);
    await page.screenshot({ path: join(output, `${label}.png`) });
  }
  await page.evaluate(() => {
    const s = bloomProof; s.preview.release({ group: s.group }); s.group.userData.dispose(); s.petals.userData.dispose();
    s.stage.dispose();
  });
  assert.deepEqual(errors, []); await page.close();

  const game = await openGame(browser, 'carreritas', { query: 'debug&manual&auto&track=plaza' });
  const live = await game.evaluate(async () => {
    const { setSettings } = await import('/engine/settings.js');
    toGarage(); setup.split = true; setup.mirror = true; await startRace(0);
    const T = getActiveTrack(), petals = T.group.getObjectByName('plaza-petals');
    const low = petals.geometry.instanceCount;
    setSettings({ quality: 'media' }); const medium = petals.geometry.instanceCount;
    setSettings({ quality: 'alta' }); const high = petals.geometry.instanceCount;
    race.clock = 90; presentRace(0);
    const at90 = petals.material.uniforms.bloomTime.value;
    race.clock = 0; presentRace(0);
    const reset = petals.material.uniforms.bloomTime.value;
    const seen = []; petals.onBeforeRender = (_r, _s, camera) => seen.push(camera.uuid);
    petals.frustumCulled = false;
    renderer.render(race.scene, race.camera); renderer.render(race.scene, race.camera2);
    petals.onBeforeRender = () => {}; petals.frustumCulled = true;
    const sources = []; T.group.traverse(o => { if (o.material?.userData.bloomTime) sources.push(o.name); });
    let disposed = 0; petals.material.addEventListener('dispose', () => disposed++);
    toGarage(); setup.split = false; setup.mirror = false;
    document.getElementById('t-next').click(); await startRace(0);
    return { low, medium, high, at90, reset, seen, sources, disposed, trees: petals.userData.petalField.trees,
      cameras: [race.camera.uuid, race.camera2.uuid], next: getActiveTrack().id, oldField: !!race.trackGroup.getObjectByName('plaza-petals') };
  });
  assert.ok(live.trees > 0); assert.deepEqual([live.low, live.medium, live.high], [0, live.trees * 12, live.trees * 36]);
  assert.equal(live.at90, 90); assert.equal(live.reset, 0); assert.deepEqual(live.seen, live.cameras);
  assert.ok(live.sources.every(n => ['festive-araguaney', 'festive-apamate'].includes(n)));
  assert.equal(live.disposed, 1); assert.notEqual(live.next, 'plaza'); assert.equal(live.oldField, false);
  assert.deepEqual(game.errors, []);
  console.log('Plaza bloom: rendered patches, petals, quality, rewind, clones, split/mirror and disposal pass', JSON.stringify({ fixture, live }));
} finally { await browser.close(); }
