// The real paint-kit models in a WebGL page: all eighteen markers build with every
// attachment set the armory allows, each part lands on the model, the data the game
// reads (tip, sight, bore, optic kind) agrees with paint-arsenal.js, the batched
// version keeps it, and camo stays inert unless asked for and shares one program.
import assert from 'node:assert/strict';
import { launch, openGame } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  const page = await openGame(browser, 'pintura', { name: 'Kit', wait: false });
  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const kit = await import('/engine/models/props/paintball-kit.js');
    const { ATTACHMENT_RULES, ATTACHMENT_SLOTS, MARKERS } = await import('/g/pintura/armory-data.js');
    const PART = { barrel: 'Accesorio · cañón afinado', hopper: 'Accesorio · tolva grande', stock: 'Accesorio · culata ligera', optic: 'Accesorio · mira' };
    const problems = [], meshes = root => { const list = []; root.traverse(o => { if (o.isMesh) list.push(o); }); return list; };
    const finite = root => meshes(root).every(m => [...m.geometry.attributes.position.array].every(Number.isFinite));
    let builds = 0;
    for (const { id } of MARKERS) {
      const parts = ATTACHMENT_RULES[id];
      for (let mask = 0; mask < 1 << parts.length; mask++) {
        const chosen = parts.filter((_, i) => mask & (1 << i)); if (chosen.length > ATTACHMENT_SLOTS) continue;
        let model;
        try { model = kit.createPaintKit({ weapon: id, attachments: chosen, color: '#29c5cd', charm: 'mango', pattern: 'dots' }); } catch (error) { problems.push(`${id} ${chosen}: ${error.message}`); continue; }
        builds++;
        const names = meshes(model).map(m => m.name);
        for (const part of parts) if (chosen.includes(part) !== names.some(n => n.startsWith(PART[part]))) problems.push(`${id} ${chosen}: ${part} ${chosen.includes(part) ? 'missing' : 'drawn unasked'}`);
        const u = model.userData;
        if (u.bore !== kit.PAINT_KIT_BORE[id]) problems.push(`${id}: bore ${u.bore} vs ${kit.PAINT_KIT_BORE[id]}`);
        if (!(u.tip > 0) || !(u.sight > 0) || !Number.isFinite(u.sightX)) problems.push(`${id} ${chosen}: tip/sight ${u.tip}/${u.sight}/${u.sightX}`);
        if ((u.optic ?? null) !== (chosen.includes('optic') ? kit.PAINT_OPTICS[id] : null)) problems.push(`${id} ${chosen}: optic ${u.optic}`);
        if (u.class !== kit.classOf(id).id || model.name !== kit.PAINT_WEAPONS[id]) problems.push(`${id}: class/name ${u.class}/${model.name}`);
        if (!finite(model)) problems.push(`${id} ${chosen}: non-finite geometry`);
        if (meshes(model).some(m => m.geometry.attributes.camoPos || m.material.userData.camo)) problems.push(`${id}: camo without being asked`);
        u.dispose();
      }
      // Batched: same data, fewer draws, every part kept.
      const full = parts.slice(0, ATTACHMENT_SLOTS), plain = kit.createPaintKit({ weapon: id, attachments: full }), baked = kit.bakePaintKit({ weapon: id, attachments: full });
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
    const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') }); renderer.setSize(64, 64, false); renderer.debug.checkShaderErrors = true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 20); camera.position.set(2, 1, 3); camera.lookAt(0, .2, .5);
    scene.add(new THREE.HemisphereLight('#fff', '#445', 2));
    const selva = kit.createPaintKit({ weapon: 'carbine', camo: 'selva' }), rumba = kit.createPaintKit({ weapon: 'marksman', camo: 'rumba', attachments: ['optic'] }), baked = kit.bakePaintKit({ weapon: 'lmg', camo: 'jaguar', attachments: ['hopper', 'optic'] });
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
    return { problems, builds, camoPrograms, glError, colours };
  });
  assert.deepEqual(result.problems, []);
  assert.ok(result.builds >= 18 * 15, `built ${result.builds} marker/attachment sets`);
  assert.equal(result.glError, 0, 'WebGL reported an error');
  assert.equal(result.camoPrograms, 1, 'every camo material shares one compiled program');
  assert.deepEqual(result.colours, ['4b5b2c', '1a1030', 'f28b42'], 'each camo keeps its own colours');
  assert.deepEqual(page.errors, []);
  console.log(`ok: ${result.builds} marker/attachment sets build with parts on their mounts, bore/optic/tip agree, baking keeps them, camo is inert unless asked and shares one program`);
} finally {
  await browser.close();
}
