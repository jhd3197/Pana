// Rendered proof: seeded surfaces survive batching, instances, Studio cloning and
// live quality changes without extra draws, geometry or texture allocations.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PANA_BROWSER_PATH ? { executablePath: process.env.PANA_BROWSER_PATH } : {}) });
const origin = process.env.PANA_TEST_URL || 'http://localhost:8461', output = 'art/nature-surfaces';
await mkdir(output, { recursive: true });
const errors = [], proof = {};
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${origin}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0}canvas{display:block}</style><canvas></canvas>');
  proof.fixture = await page.evaluate(async () => {
    const THREE = await import('three'), preview = await import('/studio/preview.js');
    const { natureSurface } = await import('/engine/models/core/nature-surface.js');
    const nature = await import('/g/derrape/tracks/nature-material.js');
    const { applyRaceQuality } = await import('/g/derrape/quality.js');
    const { ceiba } = await import('/engine/models/vegetation/ceiba.js');
    const { palm } = await import('/engine/models/vegetation/palm.js');
    const { mountainPine } = await import('/engine/models/vegetation/mountain-pine.js');
    const { bake, instancePlacements } = await import('/engine/models/core/static-batch.js');
    const stage = preview.createPreview(document.querySelector('canvas'), true);
    stage.renderer.setSize(1200, 800, false); stage.camera.aspect = 1.5;
    const group = new THREE.Group();
    const ground = new THREE.PlaneGeometry(110, 90, 1, 1); ground.rotateX(-Math.PI / 2);
    const color = new THREE.Color(0x83a85d), colors = new Float32Array(ground.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    group.add(new THREE.Mesh(natureSurface(ground, 'grass'), material));
    const forest = new THREE.Group();
    const tree = ceiba({ seed: 71, detail: 'distant' }); tree.position.set(-9, 0, 0); forest.add(tree);
    const palmTree = palm({ seed: 13 }); palmTree.position.set(6, 0, -3); forest.add(palmTree);
    const pine = mountainPine({ seed: 57 }); pine.position.set(18, 0, -10); forest.add(pine);
    // An unmarked object shares the exact same material/batch as a marked crown.
    const crown = []; tree.traverse(o => { if (o.geometry?.attributes.natureSurface?.getX(0) * 3 === 2) crown.push(o); });
    const block = new THREE.BoxGeometry(3, 3, 3), white = new Float32Array(block.attributes.position.count * 3).fill(1);
    block.setAttribute('color', new THREE.BufferAttribute(white, 3));
    const cube = new THREE.Mesh(block, crown[0].material); cube.castShadow = cube.receiveShadow = true; cube.position.set(0, 1.5, 2); forest.add(cube);
    const batched = bake(forest); group.add(batched);
    forest.traverse(o => o.geometry?.dispose());
    instancePlacements(group, ceiba({ seed: 12, detail: 'distant' }), [
      { x: -19, y: 0, z: -17, scale: 1.4 }, { x: 2, y: 0, z: -20, scale: 1.7, rot: 1.3 },
    ], { name: 'proof-instances' });
    stage.scene.add(group);
    stage.camera.position.set(26, 13, 32); stage.camera.lookAt(0, 3, -4); stage.camera.updateProjectionMatrix();
    const before = preview.inspect({ group }).stats;
    stage.renderer.render(stage.scene, stage.camera);
    const baseline = new Uint8Array(1200 * 800 * 4), gl = stage.renderer.getContext();
    gl.readPixels(0, 0, 1200, 800, gl.RGBA, gl.UNSIGNED_BYTE, baseline);
    nature.applyNatureMaterials(group, 'puerto');
    const after = preview.inspect({ group }).stats;
    let mixed = false, wind = false;
    group.traverse(o => {
      const a = o.geometry?.attributes.natureSurface;
      if (a && a.array.includes(0) && a.array.includes(170)) mixed = true;
      if (o.material?.baseKey?.includes('wind')) wind = true;
    });
    const originals = new Set(); group.traverse(o => { if (o.material?.userData.natureDetail) originals.add(o.material); });
    preview.ownMaterials({ group });
    let independent = true;
    group.traverse(o => { if (o.material?.userData.natureDetail && [...originals].some(m => m.userData.natureDetail === o.material.userData.natureDetail)) independent = false; });
    window.natureProof = { THREE, preview, stage, group, applyRaceQuality, nature, originals, pixels: { baseline } };
    return { before, after, mixed, wind, independent };
  });
  for (const key of ['meshes', 'triangles', 'vertices', 'textures', 'dimensions']) assert.deepEqual(proof.fixture.before[key], proof.fixture.after[key], key);
  assert.ok(proof.fixture.mixed && proof.fixture.wind && proof.fixture.independent, JSON.stringify(proof.fixture));
  proof.tiers = {};
  for (const quality of ['baja', 'media', 'alta', 'baja']) {
    const metrics = await page.evaluate(quality => {
      const s = natureProof;
      s.applyRaceQuality(s.stage.renderer, { trackGroup: s.group }, quality);
      // Isolate texture detail from quality's separate shadows and visibility.
      s.stage.renderer.shadowMap.enabled = false;
      s.stage.renderer.render(s.stage.scene, s.stage.camera);
      const gl = s.stage.renderer.getContext(), pixels = new Uint8Array(1200 * 800 * 4);
      gl.readPixels(0, 0, 1200, 800, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      s.pixels ||= {};
      const delta = other => {
        const old = s.pixels[other]; if (!old) return null;
        let sum = 0, changed = 0, maxChannel = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const d = Math.abs(pixels[i] - old[i]) + Math.abs(pixels[i + 1] - old[i + 1]) + Math.abs(pixels[i + 2] - old[i + 2]);
          sum += d; if (d) changed++;
          for (let c = 0; c < 3; c++) maxChannel = Math.max(maxChannel, Math.abs(pixels[i + c] - old[i + c]));
        }
        return { mean: sum / (1200 * 800 * 3), changed, maxChannel };
      };
      const repeat = delta(quality), lowDifference = delta('baja'), mediumDifference = delta('media'), originalDifference = delta('baseline');
      const point = new s.THREE.Vector3(0, 1.5, 3.51).project(s.stage.camera);
      const cx = Math.round((point.x + 1) * 600), cy = Math.round((point.y + 1) * 400);
      let unmarkedDifference = 0;
      for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++) {
        const i = (y * 1200 + x) * 4;
        for (let channel = 0; channel < 3; channel++) unmarkedDifference += Math.abs(pixels[i + channel] - s.pixels.baseline[i + channel]);
      }
      s.pixels[quality] = pixels;
      const info = s.stage.renderer.info;
      return { repeat, lowDifference, mediumDifference, originalDifference, unmarkedDifference, calls: info.render.calls, triangles: info.render.triangles, textures: info.memory.textures, programs: info.programs.length };
    }, quality);
    if (proof.tiers[quality]) assert.equal(metrics.repeat.mean, 0, 'Low returns to exactly the original pixels');
    else proof.tiers[quality] = metrics;
    assert.equal(metrics.unmarkedDifference, 0, 'Plaster sharing a leaf batch stays plain');
    // Extra interpolants can slightly change multisample coverage at silhouettes.
    // Allow only sparse edge pixels, not a systematic color/geometry difference.
    if (quality === 'baja') assert.ok(metrics.originalDifference.mean < 0.002 && metrics.originalDifference.changed < 200, JSON.stringify(metrics.originalDifference));
    await page.screenshot({ path: `${output}/trees-${quality}.png` });
  }
  for (const quality of ['media', 'alta']) {
    assert.ok(proof.tiers[quality].lowDifference.changed > 30000, JSON.stringify(proof.tiers));
    for (const key of ['calls', 'triangles', 'textures', 'programs']) assert.equal(proof.tiers[quality][key], proof.tiers.baja[key], key);
  }
  assert.ok(proof.tiers.alta.mediumDifference.changed > 5000, 'High adds visible fine detail');
  // Same recipe is reproducible; fifty seeds can produce distinct surfaces.
  proof.recipes = await page.evaluate(() => {
    const { nature } = natureProof;
    const recipes = Array.from({ length: 50 }, (_, i) => nature.natureStyle('puerto', i));
    return { unique: new Set(recipes.map(JSON.stringify)).size, stable: JSON.stringify(recipes[12]) === JSON.stringify(nature.natureStyle('puerto', 12)) };
  });
  assert.equal(proof.recipes.unique, 50); assert.ok(proof.recipes.stable);
  proof.tufts = await page.evaluate(async () => {
    const s = natureProof, { createGrassField } = await import('/g/derrape/tracks/grass-field.js'), { rng } = await import('/engine/models/core/primitives.js');
    const random = rng(713), placements = [];
    for (let x = -45; x < 45; x += 2.1) for (let z = -35; z < 35; z += 2.1) {
      if (Math.abs(x) < 2.5 && Math.abs(z - 2) < 2.5) continue;
      placements.push({ x: x + random() * 1.6, y: -0.025, z: z + random() * 1.6, scale: 0.8 + random() * 0.5, rot: random() * Math.PI * 2 });
    }
    const tufts = createGrassField(placements, { height: 0.85 }); s.group.add(tufts); s.tufts = tufts;
    const field = tufts.children[0], counts = {};
    for (const tier of ['baja', 'media', 'alta']) { s.applyRaceQuality(s.stage.renderer, { trackGroup: s.group }, tier); counts[tier] = { visible: field.visible, count: field.count }; }
    s.stage.scene.environment = null;
    for (const child of [...s.stage.scene.children]) if (child.isLight) child.removeFromParent();
    s.stage.scene.add(new s.THREE.HemisphereLight(0xe4f5ff, 0x75985d, 1.7));
    const sun = new s.THREE.DirectionalLight(0xffefcc, 2.4); sun.position.set(-260, 450, 330); s.stage.scene.add(sun);
    return { counts, trianglesPerTuft: field.geometry.index.count / 3 };
  });
  assert.equal(proof.tufts.trianglesPerTuft, 21);
  assert.equal(proof.tufts.counts.baja.count, 0); assert.equal(proof.tufts.counts.baja.visible, false);
  assert.ok(proof.tufts.counts.media.count > 0 && proof.tufts.counts.media.count < proof.tufts.counts.alta.count);
  for (const quality of ['baja', 'media', 'alta']) {
    await page.evaluate(quality => {
      const s = natureProof; s.applyRaceQuality(s.stage.renderer, { trackGroup: s.group }, quality);
      s.stage.camera.position.set(11, 2.5, 22); s.stage.camera.lookAt(8, 0.3, 10);
      s.stage.renderer.render(s.stage.scene, s.stage.camera);
    }, quality);
    await page.screenshot({ path: `${output}/grass-3d-${quality}.png` });
  }
  proof.lifecycle = await page.evaluate(() => {
    const s = natureProof, events = [];
    s.originals.forEach(m => m.addEventListener('dispose', () => events.push(m.uuid)));
    s.group.userData.dispose(); s.group.userData.dispose();
    const result = { count: events.length, expected: s.originals.size };
    s.preview.release({ group: s.group }); return result;
  });
  assert.equal(proof.lifecycle.count, proof.lifecycle.expected);
  proof.maps = [];
  for (const id of ['puerto', 'plaza', 'selva', 'llanos', 'salinas']) {
    const result = await page.evaluate(async id => {
      const s = natureProof, { makeTrack, getTrack } = await import('/g/derrape/tracks.js');
      if (s.world) s.preview.release({ group: s.world });
      const T = makeTrack(getTrack(id)), group = T.build(); s.world = group; s.T = T;
      s.preview.ownMaterials({ group }); s.stage.scene.add(group);
      // Map proof uses that circuit's lighting, without the object turntable's
      // studio environment. This matches the landscape's intended palette.
      s.stage.scene.environment = null;
      for (const child of [...s.stage.scene.children]) if (child.isLight) child.removeFromParent();
      const pal = T.def.palette;
      s.stage.scene.add(new s.THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, pal.hemiInt));
      const sun = new s.THREE.DirectionalLight(pal.sun, pal.sunInt); sun.position.set(-260, 450, 330); s.stage.scene.add(sun);
      let grass = 0, leaves = 0, bark = 0, instances = 0;
      group.traverse(o => {
        const attr = o.geometry?.attributes.natureSurface;
        if (!attr) return;
        if (!o.material.userData.natureDetail) throw Error(`Unshaded nature geometry: ${o.name}`);
        for (const n of attr.array) { if (n > 0 && n <= 85) grass++; else if (n === 170) leaves++; else if (n === 255) bark++; }
        if (o.isInstancedMesh) instances++;
      });
      s.preview.fitCamera(s.stage.camera, new s.THREE.Box3(new s.THREE.Vector3(...T.def.previewBounds[0]), new s.THREE.Vector3(...T.def.previewBounds[1])), true);
      s.stage.renderer.render(s.stage.scene, s.stage.camera);
      const tuftPositions = group.getObjectByName('ground-grass').userData.placements || [];
      const invalidTufts = tuftPositions.filter(p => Math.abs(T.offsetOf(p.x, p.z)) <= T.HW + 5 || p.y > T.terrainAt(p.x, p.z) + 0.02);
      return { id, grass, leaves, bark, instances, tuftCount: tuftPositions.length, invalidTufts, ...s.preview.inspect({ group }).stats, draws: s.stage.renderer.info.render.calls };
    }, id);
    assert.ok(result.leaves && result.bark, JSON.stringify(result));
    if (id === 'salinas') assert.equal(result.grass, 0, 'Salt flats and sand must not acquire grass');
    else assert.ok(result.grass, JSON.stringify(result));
    assert.deepEqual(result.invalidTufts, [], 'Tufts remain grounded and outside the driving corridor');
    if (id === 'puerto') assert.ok(result.tuftCount > 500, 'Substantial roadside grass');
    if (id === 'salinas') assert.equal(result.tuftCount, 0);
    if (id === 'puerto') { assert.ok(result.triangles < 3200000); assert.ok(result.draws < 900); }
    proof.maps.push(result);
    await page.screenshot({ path: `${output}/map-${id}.png` });
    if (id === 'puerto') for (const quality of ['baja', 'alta']) {
      await page.evaluate(quality => {
        const s = natureProof;
        s.applyRaceQuality(s.stage.renderer, { trackGroup: s.world }, quality);
        s.stage.camera.position.set(370, 170, 155); s.stage.camera.lookAt(80, 12, -110);
        s.stage.renderer.render(s.stage.scene, s.stage.camera);
      }, quality);
      await page.screenshot({ path: `${output}/puerto-town-${quality}.png` });
    }
  }
  await page.close();
  const game = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  game.on('pageerror', e => errors.push(String(e)));
  game.on('console', m => { if (m.type() === 'error' && /THREE|WebGL/.test(m.text())) errors.push(m.text()); });
  await game.goto(`${origin}/g/derrape/?debug&manual&track=puerto`);
  await game.waitForFunction(() => window.garage?.car);
  proof.live = await game.evaluate(async () => {
    const { setSettings } = await import('/engine/settings.js');
    setSettings({ quality: 'baja' }); await startRace(0);
    const values = () => { const out = new Set(); race.trackGroup.traverse(o => { if (o.material?.userData.natureDetail) out.add(o.material.userData.natureDetail.value); }); return [...out]; };
    const low = values(); setSettings({ quality: 'media' }); const medium = values();
    setSettings({ quality: 'alta' }); const high = values();
    toGarage(); buildTrack('estadio'); await startRace(0); const switched = values();
    toGarage(); buildTrack('salinas'); await startRace(0);
    for (let i = 0; i < 3; i++) updateRace(1 / 60);
    const emptyField = race.trackGroup.getObjectByName('ground-grass').children.length === 0;
    toGarage(); buildTrack('puerto'); await startRace(0); const returned = values();
    renderer.render(race.scene, race.camera);
    return { low, medium, high, switched, returned, emptyField };
  });
  assert.deepEqual(proof.live, { low: [0], medium: [1], high: [2], switched: [2], returned: [2], emptyField: true });
  await game.evaluate(() => {
    const T = getActiveTrack(), s = T.TOTAL * 0.48, p = T.pointAt(s), q = T.pointAt(s + 0.5), c = race.player;
    race.state = 'go'; race.count = 0; document.getElementById('count').textContent = '';
    Object.assign(c, { x: p.x, z: p.y, y: T.surfaceAt(p.x, p.y), h: Math.atan2(q.x - p.x, q.y - p.y), vx: 0, vz: 0, vy: 0, onGround: true, phaseT: 0, ghost: false });
    race.camPos = null;
    for (let i = 0; i < 3; i++) updateRace(1 / 60);
    renderer.render(race.scene, race.camera);
  });
  await game.screenshot({ path: `${output}/race-puerto.png` });
  assert.deepEqual(errors, []);
  await writeFile(`${output}/proof.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally { await browser.close(); }
