// The real paint-kit models in a WebGL page: all eighteen markers build with every
// gunsmith option alone and with full slots, each part lands on the model, the data the game
// reads (tip, sight, bore, the chosen Mira kind) agrees, the small hopper is smaller, the batched
// version keeps it, camo stays inert unless asked for and shares one program, and El
// Acolchado is one cheap mesh that fits the pana's torso and rides its body.
import assert from 'node:assert/strict';
import { launch, openGame } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'pintura', { name: 'Kit', wait: false });
  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const kit = await import('/engine/models/props/paintball-kit.js');
    const { SLOT_RULES, MARKERS, kitModel, partOf } = await import('/g/pintura/armory-data.js');
    const PART = kit.PAINT_PART_LABELS;
    const problems = [], meshes = root => { const list = []; root.traverse(o => { if (o.isMesh) list.push(o); }); return list; };
    const finite = root => meshes(root).every(m => [...m.geometry.attributes.position.array].every(Number.isFinite));
    const partBox = (root, part) => { const b = new THREE.Box3(); root.updateMatrixWorld(true); for (const m of meshes(root)) if (m.name.startsWith(PART[part])) b.expandByObject(m); return b.getSize(new THREE.Vector3()).length(); };
    let builds = 0;
    for (const { id } of MARKERS) {
      const rules = SLOT_RULES[id], slots = Object.keys(rules);
      // Bare, every option alone, and every slot filled with its first and with its last option.
      const kits = [{}, ...slots.flatMap(s => rules[s].map(p => ({ [s]: p }))), Object.fromEntries(slots.map(s => [s, rules[s][0]])), Object.fromEntries(slots.map(s => [s, rules[s].at(-1)]))];
      for (const chosen of kits) {
        const look = kitModel({ weapon: id, slots: chosen }), label = JSON.stringify(chosen);
        let model;
        try { model = kit.createPaintKit({ weapon: id, ...look, color: '#29c5cd', charm: 'mango', pattern: 'dots' }); } catch (error) { problems.push(`${id} ${label}: ${error.message}`); continue; }
        builds++;
        const names = meshes(model).map(m => m.name);
        for (const slot of slots) { const part = partOf(rules[slot][0]).part; if (!!chosen[slot] !== names.some(n => n.startsWith(PART[part]))) problems.push(`${id} ${label}: ${part} ${chosen[slot] ? 'missing' : 'drawn unasked'}`); }
        const u = model.userData;
        if (u.bore !== kit.PAINT_KIT_BORE[id]) problems.push(`${id}: bore ${u.bore} vs ${kit.PAINT_KIT_BORE[id]}`);
        if (!(u.tip > 0) || !(u.sight > 0) || !Number.isFinite(u.sightX)) problems.push(`${id} ${label}: tip/sight ${u.tip}/${u.sight}/${u.sightX}`);
        if ((u.optic ?? null) !== (chosen.optic ?? null)) problems.push(`${id} ${label}: optic drawn ${u.optic}`);
        if (u.class !== kit.classOf(id).id || model.name !== kit.PAINT_WEAPONS[id]) problems.push(`${id}: class/name ${u.class}/${model.name}`);
        if (!finite(model)) problems.push(`${id} ${label}: non-finite geometry`);
        if (meshes(model).some(m => m.geometry.attributes.camoPos || m.material.userData.camo)) problems.push(`${id}: camo without being asked`);
        u.dispose();
      }
      // The small hopper is drawn smaller than the big one.
      if (rules.hopper.length > 1) {
        const size = h => { const m = kit.createPaintKit({ weapon: id, ...kitModel({ weapon: id, slots: { hopper: h } }) }), s = partBox(m, 'hopper'); m.userData.dispose(); return s; };
        if (!(size('minihopper') < size('hopper') * .85)) problems.push(`${id}: small hopper not smaller`);
      }
      // Batched: same data, fewer draws, every part kept.
      const full = kitModel({ weapon: id, slots: Object.fromEntries(slots.map(s => [s, rules[s].at(-1)])) }), plain = kit.createPaintKit({ weapon: id, ...full }), baked = kit.bakePaintKit({ weapon: id, ...full });
      const b = baked.userData, p = plain.userData;
      if (b.tip !== p.tip || b.sight !== p.sight || b.bore !== kit.PAINT_KIT_BORE[id] || b.optic !== p.optic) problems.push(`${id}: baked data ${JSON.stringify([b.tip, b.sight, b.bore, b.optic])}`);
      if (meshes(baked).length >= meshes(plain).length) problems.push(`${id}: baking saved no draws (${meshes(baked).length}/${meshes(plain).length})`);
      const box = m => new THREE.Box3().setFromObject(m, true), a = box(plain), c = box(baked);
      if (a.min.distanceTo(c.min) > .001 || a.max.distanceTo(c.max) > .001) problems.push(`${id}: baking moved the bounds`);
      const clone = baked.clone(); if (meshes(clone)[0].geometry !== meshes(baked)[0].geometry) problems.push(`${id}: clones do not share geometry`);
      p.dispose(); b.dispose();
    }
    if (kit.createPaintKit({ weapon: 'nope' }).name !== 'La Chispa') problems.push('an unknown id does not fall back to La Chispa');
    // Camo: only a preset id turns it on; free colours are ignored.
    if (kit.resolveCamo({ colors: ['#000', '#111', '#222', '#333'], pattern: 'digital' }) !== null || kit.resolveCamo('none') !== null) problems.push('free camo colours are accepted');
    // A solid camo is only the body colour: no shader hook, no camoPos, baked or not.
    for (const solid of [kit.createPaintKit({ weapon: 'smg', camo: 'liso-uva' }), kit.bakePaintKit({ weapon: 'smg', camo: 'liso-uva' })]) {
      if (solid.userData.camo?.pattern !== 'solid') problems.push('a solid camo lost its settings');
      if (meshes(solid).some(m => m.geometry.attributes.camoPos || m.material.userData.camo || m.material.onBeforeCompile?.name === 'camoCompile')) problems.push('a solid camo compiles the camo shader');
      if (!meshes(solid).some(m => m.material.color?.getHexString() === '6a2d9f' || m.geometry.attributes.color)) problems.push('a solid camo did not recolour the body');
      solid.userData.dispose();
    }
    // El Acolchado: one vertex-coloured mesh, a few thousand triangles, inside the torso
    // envelope (feet at 0, +Z forward), worn on the body at the same place, fully disposed.
    const vest = kit.createPaintVest(), vestMeshes = meshes(vest), vestBox = new THREE.Box3().setFromObject(vest);
    const tris = vestMeshes.reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
    if (vest.name !== 'El Acolchado' || typeof vest.userData.dispose !== 'function') problems.push('vest lost its name or dispose');
    if (!finite(vest)) problems.push('vest has non-finite geometry');
    const inside = (v, lo, hi) => v >= lo && v <= hi;
    if (!inside(vestBox.min.x, -.56, -.4) || !inside(vestBox.max.x, .4, .56) || !inside(vestBox.min.y, .62, .75) || !inside(vestBox.max.y, 1.1, 1.22) || !inside(vestBox.min.z, -.52, -.4) || !inside(vestBox.max.z, .4, .55)) problems.push(`vest outside the torso envelope ${JSON.stringify([vestBox.min, vestBox.max])}`);
    const { buildCharacter } = await import('/engine/models/characters/pana/avatar-model.js');
    const pana = buildCharacter({}), worn = kit.wearPaintVest(pana); pana.group.updateMatrixWorld(true);
    const wornBox = new THREE.Box3().setFromObject(worn);
    if (worn.parent !== pana.body || wornBox.min.distanceTo(vestBox.min) > .001 || wornBox.max.distanceTo(vestBox.max) > .001) problems.push('a worn vest does not sit where it was modelled');
    let freed = 0; const owned = vestMeshes.flatMap(m => [m.geometry, m.material]); owned.forEach(o => o.addEventListener('dispose', () => freed++));
    vest.userData.dispose(); worn.userData.dispose(); pana.dispose();
    if (freed !== owned.length) problems.push(`vest dispose freed ${freed}/${owned.length}`);
    const vestStats = { meshes: vestMeshes.length, tris };
    const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') }); renderer.setSize(64, 64, false); renderer.debug.checkShaderErrors = true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 20); camera.position.set(2, 1, 3); camera.lookAt(0, .2, .5);
    scene.add(new THREE.HemisphereLight('#fff', '#445', 2));
    const selva = kit.createPaintKit({ weapon: 'carbine', camo: 'selva' }), rumba = kit.createPaintKit({ weapon: 'marksman', camo: 'rumba', attachments: ['optic'], opticKind: 'scope' }), baked = kit.bakePaintKit({ weapon: 'lmg', camo: 'jaguar', attachments: ['hopper', 'optic'], hopperScale: .72 });
    const camoMeshes = [selva, rumba, baked].map(m => meshes(m).filter(o => o.material.userData.camo));
    if (camoMeshes.some(list => !list.length || list.some(o => !o.geometry.attributes.camoPos || o.geometry.attributes.camoPos.count !== o.geometry.attributes.position.count))) problems.push('a camo body lost camoPos (baked or not)');
    const keys = camoMeshes.flat().map(o => o.material.customProgramCacheKey());
    if (new Set(keys).size !== 1 || keys[0] !== 'pana-camo') problems.push(`camo cache keys ${[...new Set(keys)]}`);
    if (baked.userData.camo?.pattern !== 'tiger') problems.push('baked camo lost its settings');
    selva.position.x = -1; rumba.position.x = 1; scene.add(selva, rumba, baked);
    renderer.render(scene, camera);
    const camoPrograms = renderer.info.programs.filter(p => p.cacheKey.includes('pana-camo')).length;
    const gl = renderer.getContext(), glError = gl.getError();
    // Each camo material keeps its own colours although they share the program.
    const colours = camoMeshes.map(list => renderer.properties.get(list[0].material).uniforms?.uC0?.value.getHexString());
    selva.userData.dispose(); rumba.userData.dispose(); baked.userData.dispose(); renderer.dispose();
    return { problems, builds, camoPrograms, glError, colours, vestStats };
  });
  assert.deepEqual(result.problems, []);
  assert.ok(result.builds >= 18 * 8, `built ${result.builds} marker/slot sets`);
  assert.equal(result.glError, 0, 'WebGL reported an error');
  assert.equal(result.camoPrograms, 1, 'every camo material shares one compiled program');
  assert.deepEqual(result.colours, ['4b5b2c', '1a1030', 'f28b42'], 'each camo keeps its own colours');
  assert.equal(result.vestStats.meshes, 1, 'El Acolchado draws in one call');
  assert.ok(result.vestStats.tris <= 5000, `El Acolchado has ${result.vestStats.tris} triangles`);
  assert.deepEqual(page.errors, []);
  console.log(`ok: ${result.builds} marker/slot sets build with parts on their mounts, bore/optic/tip agree, baking keeps them, camo is inert unless asked and shares one program, El Acolchado is ${result.vestStats.tris} triangles in one draw`);
} finally {
  await browser.close();
}
