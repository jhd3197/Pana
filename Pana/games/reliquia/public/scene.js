// Reliquia's world from a generated run: the sunlit camp with the truck, and
// each floor's galleries built the first time anyone can reach them. Every
// prop comes from the shared model library (Pana Studio). Collision never
// reads this file: it all comes from layout.js, built from the same deck.
import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
import { ruinShell, RUIN_PALETTES } from '/engine/models/props/reliquia-ruins.js';
import * as treasure from '/engine/models/props/reliquia-treasure.js';
import { expeditionWinch, expeditionLantern } from '/engine/models/props/reliquia.js';
import { ruinColumn, fallenColumn, ruinRubble, stela, brazier, sunSeal, olmecHead } from '/engine/models/props/ruins.js';
import { goldVein, orePile, mineSupport, mineLanternPost, mineLantern, minePortal, mineCart, mineCrate } from '/engine/models/props/mine.js';
import { stalactiteCluster, rootCurtain } from '/engine/models/props/caves.js';
import { coffin, graveCandles, skull } from '/engine/models/props/cemetery.js';
import { jaguarStatue, jaguarRelief } from '/engine/models/props/jaguar-stone.js';
import { ropeBridge } from '/engine/models/props/jungle.js';
import { crystalCluster } from '/engine/models/props/crystals.js';
import { expeditionJeep, expeditionTent, expeditionCampfire, supplyPile, campBench, investigationTable } from '/engine/models/props/expedition-camp.js';
import { lajaRock } from '/engine/models/props/amazonas.js';
import { rockyCliff } from '/engine/models/props/mountain.js';
import { china } from '/engine/models/props/china.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { fern } from '/engine/models/vegetation/fern.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { monstera } from '/engine/models/vegetation/monstera.js';
import { heliconia } from '/engine/models/vegetation/heliconia.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { layoutFor } from './layout.js';
import { visibleItems, liftView } from './rules.js';
import { ITEMS, ARTIFACTS } from './items.js';
import { TRUCK, TABLE, HEIGHT, CAGE, floorOf, inRect } from './deck.js';

const PALETTES = ['sol', 'jade', 'maldita'];
export const paletteFor = floor => RUIN_PALETTES[PALETTES[(floor - 1) % PALETTES.length]];
const FACTORIES = { ...treasure, mineCart: () => mineCart({ load: 'gold' }), olmecHead: () => olmecHead({ size: 1.3 }), jaguarStatue: () => jaguarStatue({ gold: true, scale: .7 }), china, expeditionLantern };
const GLOW = { tool: 0xfff1d6, treasure: 0xffc23d, big: 0xffd36a };

// One prototype per item kind; every copy on the map is a cheap clone.
const prototypes = new Map();
export function itemModel(kind) {
  if (!prototypes.has(kind)) {
    const model = FACTORIES[ITEMS[kind].model]();
    if (kind === 'farol') model.scale.setScalar(1.3);
    if (kind === 'honda') model.scale.setScalar(1.1);
    prototypes.set(kind, model);
  }
  return prototypes.get(kind).clone();
}
export const glowColor = kind => ITEMS[kind].artifact ? treasure.ARTIFACT_AURA[kind] : ITEMS[kind].tool ? GLOW.tool : ITEMS[kind].size === 'big' ? GLOW.big : GLOW.treasure;

export function createExpeditionWorld({ seed = 1, floors = 3, roof = true } = {}) {
  const L = layoutFor(seed, floors), run = L.run;
  const group = new THREE.Group(); group.name = 'Reliquia · La mina del sol';
  const owned = new Set(), animated = [], floorsBuilt = new Map();
  const halo = glowTexture(), haloMaterials = new Map();
  const haloMaterial = color => { if (!haloMaterials.has(color)) haloMaterials.set(color, new THREE.SpriteMaterial({ map: halo, color, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); return haloMaterials.get(color); };
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .9, ...extra }); owned.add(m); return m; };
  const place = (parent, model, x, y, z, h = 0, s = 1) => { model.position.set(x, y, z); model.rotation.y = h; if (s !== 1) model.scale.multiplyScalar(s); parent.add(model); return model; };

  // ---------- Camp ----------
  const camp = new THREE.Group(); camp.name = 'Campamento'; group.add(camp);
  const campStatic = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 48), mat(0x7fb257, { roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.04; ground.receiveShadow = true; camp.add(ground);
  const clearing = new THREE.Mesh(new THREE.CircleGeometry(15, 40), mat(0xd9b77c, { roughness: 1 })); clearing.rotation.x = -Math.PI / 2; clearing.position.set(0, .02, 13); clearing.receiveShadow = true; camp.add(clearing);
  const truck = place(camp, expeditionJeep(), TRUCK.x, 0, TRUCK.z, TRUCK.h, 1.25);
  const truckRing = new THREE.Mesh(new THREE.RingGeometry(4.3, 4.6, 64), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .6, depthWrite: false })); owned.add(truckRing.material);
  truckRing.rotation.x = -Math.PI / 2; truckRing.position.set(TRUCK.x, .04, TRUCK.z); camp.add(truckRing);
  const bed = new THREE.Group(); bed.position.set(TRUCK.x, 1.4, TRUCK.z); bed.rotation.y = TRUCK.h; camp.add(bed);
  place(campStatic, investigationTable(), TABLE.x, 0, TABLE.z, 0);
  place(campStatic, expeditionTent({ color: 'mustard' }), -9, 0, 22, .4);
  place(campStatic, expeditionTent({ color: 'olive', seed: 4 }), -14, 0, 14, 1.2);
  const fire = place(camp, expeditionCampfire({ light: true }), 3, 0, 26); animated.push(fire);
  place(campStatic, campBench({ length: 2 }), 0, 0, 25, .3); place(campStatic, campBench({ length: 2 }), 6, 0, 26.5, -.4);
  place(campStatic, supplyPile({ seed: 5 }), 14, 0, 11, -.6);
  place(campStatic, mineCrate({ seed: 3 }), -3, 0, 4, .4); place(campStatic, mineCrate({ seed: 5, tnt: true }), -4, 0, 2.6, -.2);
  // The mine is a level gallery into the hill: an open mouth, timber sets
  // inside and rock on both flanks, with the tepuy wall further back.
  place(campStatic, minePortal({ name: 'LA MINA DEL SOL', niche: false }), 0, 0, -1.6, 0);
  place(campStatic, mineSupport({ width: 3.9, height: 3.8, lantern: true }), 0, 0, -3.8);
  for (const s of [-1, 1]) place(campStatic, rockyCliff({ seed: 60 + s, width: 20, height: 10, depth: 8 }), s * 14.9, 0, -7.2, 0, 1.2);
  for (const [x, z, r] of [[-4, -2.2, 1.6], [4.2, -2.4, 1.4]]) place(campStatic, lajaRock({ seed: x * 13 + 5, radius: r, flat: .8 }), x, 0, z);
  place(campStatic, lajaRock({ seed: 77, radius: 3.4, flat: .5 }), 0, 4.9, -8);
  place(camp, treasure.liftShaft({ below: 18, above: 5 }), run.lifts[0].x, 0, run.lifts[0].z, run.lifts[0].h);
  // The tepuy wall rises behind the mine; the selva closes the camp in.
  for (let i = -3; i <= 3; i++) place(campStatic, rockyCliff({ seed: 54 + i, width: 20, height: 12, depth: 6 }), i * 17, 0, -24 - Math.abs(i) * 2, 0, 2.2);
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * .1 + (i / 26) * Math.PI * 1.8, r = 24 + (i % 3) * 4, x = Math.sin(a) * r, z = 12 - Math.cos(a) * r;
    if (z < -4) continue;
    const plant = i % 4 === 0 ? ceiba({ seed: i + 3 }) : i % 4 === 1 ? palm({ seed: i, h: 8 + i % 3 }) : i % 4 === 2 ? monstera({ seed: i }) : heliconia({ seed: i });
    place(campStatic, plant, x, 0, z, i, i % 4 === 0 ? 1.1 : 1.3);
  }
  for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 16 + (i % 4); place(campStatic, fern({ seed: i + 9 }), Math.sin(a) * r, 0, 13 + Math.cos(a) * r, i, 1.4); }
  for (const [x, z, r] of [[-15, 4, 2.4], [16, 4, 2], [18, 22, 2.8], [-18, 26, 2.2]]) place(campStatic, lajaRock({ seed: x * 7, radius: r }), x, 0, z);
  const mouth = ruinShell({ inside: (x, z) => floorOf(x) === 0 && run.stubs.some(s => s.floor === 0 && inRect(x, z, s.rect)), ground: L.groundAt, open: (x, z) => z > -2, solid: (x, z) => !inShaft(0, x, z), sky: (x, z) => inShaft(0, x, z, .4), bounds: [-4, -16, 4, 0], palette: RUIN_PALETTES.sol, seed: 3, tile: 1 });
  camp.add(mouth); owned.add(mouth);
  const campBatch = bake(campStatic, { cellSize: 30 }); campStatic.traverse(o => o.geometry?.dispose()); camp.add(campBatch);

  // The one cage: it sinks out of a stop and rises into the next.
  const cage = treasure.liftCage(); cage.name = 'Montacargas'; group.add(cage);
  // ---------- Floors, built on demand ----------
  function decorModel(d) {
    switch (d.kind) {
      case 'column': return ruinColumn({ seed: d.x | 0, radius: .7, height: HEIGHT + .2 });
      case 'fallenColumn': return fallenColumn({ seed: d.z | 0 });
      case 'rubble': return ruinRubble({ seed: d.x | 0, count: 7, spread: 2 });
      case 'stalactites': { const s = stalactiteCluster({ seed: d.x | 0, length: 1.6 }); s.position.y = HEIGHT; return s; }
      case 'statue': return jaguarStatue({ seed: d.z | 0, scale: .75 });
      case 'vein': return goldVein({ seed: d.z | 0, count: 7 });
      case 'ore': return orePile({ seed: d.x | 0, radius: 1.6 });
      case 'support': return mineSupport({ width: 4.6, height: HEIGHT - .1, lantern: true });
      case 'coffin': return coffin({ open: (d.x | 0) % 2 === 0 });
      case 'candles': return graveCandles({ count: 6, seed: d.z | 0 });
      case 'altar': return sunSeal({ size: 2.2 });
      case 'mineLamp': return mineLanternPost({});
      default: return null;
    }
  }
  function buildFloor(f) {
    if (floorsBuilt.has(f) || f < 1 || f > floors) return floorsBuilt.get(f);
    const root = new THREE.Group(); root.name = `Piso ${f}`; group.add(root);
    const statics = new THREE.Group(), palette = paletteFor(f), x0 = f * L.SPACING - 60;
    const shell = () => ruinShell({ inside: (x, z) => insideFloor(f, x, z), ground: L.groundAt, solid: (x, z) => !L.overPit(x, z) && !inShaft(f, x, z), sky: (x, z) => inShaft(f, x, z, .4), bounds: [x0, -140, x0 + 120, 20], palette, seed: f * 13, roof });
    const floor = { root, shell: shell(), revealed: '', braziers: [], seals: new Map(), winches: new Map(), chests: new Map(), plates: [], rubble: new Map(), rebuild: shell };
    root.add(floor.shell);
    for (const d of run.decor.filter(d => d.floor === f)) {
      if (d.kind === 'brazier') { const b = place(root, brazier({ seed: d.x | 0, lit: true }), d.x, 0, d.z); floor.braziers.push(b); animated.push(b); continue; }
      const model = decorModel(d); if (!model) continue;
      if (d.kind === 'vein') { model.rotation.z = Math.PI / 2; model.position.y = 1.6; }
      place(statics, model, d.x, model.position.y, d.z, d.h);
    }
    // Skulls and crystals give the dark corners a little colour (crystals are
    // instanced with their own shader, so they stay out of the static batch).
    for (const r of run.rooms.filter(r => r.floor === f)) {
      const k = (r.x * 7 + r.z * 3) | 0;
      if (f > 1 && k % 3 === 0) place(statics, skull({ size: .35 }), r.rect[0] + 1, 0, r.rect[3] - 1.1, k);
      if (k % 2 === 0) place(root, crystalCluster({ size: .9, color: (k >> 1) % 8, seed: k }), r.rect[2] - .8, 0, r.rect[1] + .8, k);
    }
    dress(f, statics, root);
    for (const pit of run.pits.filter(p => p.floor === f)) {
      const [a, b, c, d] = pit.rect, hole = new THREE.Mesh(new THREE.BoxGeometry(c - a, .5, d - b), mat(0x07040c));
      hole.position.set((a + c) / 2, -7, (b + d) / 2); root.add(hole);
      for (let i = 0; i < 6; i++) place(root, crystalCluster({ size: 1.4, color: i % 8, seed: i + f }), a + (i % 3 + .5) * (c - a) / 3, -6.6, i < 3 ? b + 1.2 : d - 1.2, i);
      const [ia, ib, ic, id] = pit.island, island = new THREE.Mesh(new THREE.BoxGeometry(ic - ia, 6.8, id - ib), mat(0x8a7356, { flatShading: true }));
      island.position.set((ia + ic) / 2, -3.55, (ib + id) / 2); root.add(island);
    }
    for (const b of run.bridges.filter(b => b.floor === f)) {
      const span = b.rect[3] - b.rect[1], bridge = ropeBridge({ span: Math.max(4, span), seed: f * 9 });
      place(root, bridge, (b.rect[0] + b.rect[2]) / 2, -1.7, (b.rect[1] + b.rect[3]) / 2, Math.PI / 2);
    }
    for (const seal of run.seals.filter(s => s.floor === f)) {
      const slab = place(root, treasure.stairSeal({ width: 4.6, height: HEIGHT }), seal.x, 0, seal.z + .2, 0); floor.seals.set(seal.id, { slab, height: 0 });
      for (const w of seal.winches || []) { const model = place(root, expeditionWinch(), w.x, 0, w.z, Math.PI); floor.winches.set(w.id, model); }
    }
    for (const c of run.chests.filter(c => c.floor === f)) { const model = place(root, treasure.treasureChest({ seed: c.id }), c.x, 0, c.z, c.h); floor.chests.set(c.id, { model, open: 0 }); }
    for (const p of run.plates.filter(p => p.floor === f)) {
      const plate = place(root, treasure.trapPlate(), p.x, .01, p.z);
      plate.userData.glyph.material = mat(0x6a5a3a, { emissive: 0xff4a2a, emissiveIntensity: 0 });
      floor.plates.push({ id: p.id, plate });
      for (const d of p.darts) place(statics, treasure.dartHead(), d.x + d.dx * .05, 1.1, d.z, d.dx > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    // The montacargas shaft: a hole in the floor and the ceiling, rock and
    // timber all the way up and down.
    for (const stop of run.lifts.filter(l => l.floor === f)) place(root, treasure.liftShaft(), stop.x, 0, stop.z, stop.h);
    const batch = bake(statics, { cellSize: 26 }); statics.traverse(o => o.geometry?.dispose()); root.add(batch);
    floorsBuilt.set(f, floor);
    return floor;
  }
  // Walls and corridors get dressed so no stretch of brick is bare: lanterns
  // and timber sets in the mine, jaguar reliefs, hanging roots and doorway
  // pillars deeper down. Nothing here collides; it all hugs the walls.
  function dress(f, statics, root) {
    const openings = [...run.corridors, ...run.stubs].filter(c => c.floor === f).map(c => c.rect);
    for (const room of run.rooms.filter(r => r.floor === f)) {
      const [x0, z0, x1, z1] = room.rect, k = (room.x * 3 + room.z * 7) | 0, spots = [];
      for (const t of [-.32, 0, .32]) {
        spots.push({ x: room.x + t * room.w, z: z0 + .2, h: 0 }, { x: room.x + t * room.w, z: z1 - .2, h: Math.PI });
        spots.push({ x: x0 + .2, z: room.z + t * room.d, h: Math.PI / 2 }, { x: x1 - .2, z: room.z + t * room.d, h: -Math.PI / 2 });
      }
      const free = spots.filter(p => !openings.some(o => inRect(p.x, p.z, o, 1.6)) && !run.seals.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 3) && !run.plates.some(q => q.room === room.id && Math.abs(q.z - p.z) < 1.2));
      free.forEach((p, i) => {
        if ((i + k) % 3 === 2) return;
        if (f === 1) { const lamp = place(statics, mineLantern({}), p.x + Math.sin(p.h) * .1, 2.3, p.z + Math.cos(p.h) * .1, p.h); lamp.scale.setScalar(1.2); }
        else if ((i + k) % 3 === 0) place(statics, jaguarRelief({ width: 2.2, height: 1, seed: k + i, moss: f === 2 }), p.x, 1.1, p.z, p.h);
        else { const roots = rootCurtain({ seed: k + i, length: 2.6 + (i % 3) * .6, width: 2.4 }); roots.position.set(p.x + Math.sin(p.h) * .5, HEIGHT, p.z + Math.cos(p.h) * .5); statics.add(roots); }
      });
      if (k % 2 === 0) place(statics, ruinRubble({ seed: k, count: 4, spread: .9 }), x0 + 1.2, 0, z1 - 1.2, k);
    }
    for (const c of run.corridors.filter(c => c.floor === f)) {
      const [x0, z0, x1, z1] = c.rect, along = c.horizontal ? x1 - x0 : z1 - z0, mid = c.horizontal ? (z0 + z1) / 2 : (x0 + x1) / 2;
      if (f === 1) for (let t = 2.5; t < along - 1.5; t += 4.5) place(statics, mineSupport({ width: 3.6, height: 3.8, lantern: t < 3 }), c.horizontal ? x0 + t : mid, 0, c.horizontal ? mid : z0 + t, c.horizontal ? Math.PI / 2 : 0);
      else for (const end of [0, along]) for (const s of [-1, 1]) {
        const a = c.horizontal ? x0 + end : mid + s * 2.15, b = c.horizontal ? mid + s * 2.15 : z0 + end;
        place(statics, ruinColumn({ seed: (a * 5 + b) | 0, radius: .32, height: HEIGHT }), a, 0, b);
      }
    }
  }
  // The cage's square at a stop: no floor slabs, no ceiling.
  function inShaft(f, x, z, pad = 0) { const stop = run.lifts.find(l => l.floor === f); return !!stop && Math.abs(x - stop.x) < CAGE + pad && Math.abs(z - stop.z) < CAGE + pad; }
  // A hidden room only joins the floor once its fake wall has fallen.
  let revealedNow = {};
  const insideFloor = (f, x, z) => {
    if (floorOf(x) !== f) return false;
    for (const r of run.rooms) if (r.floor === f && inRect(x, z, r.rect)) return !r.hidden || !!revealedNow[r.hidden];
    for (const c of run.corridors) if (c.floor === f && inRect(x, z, c.rect)) return !c.hidden || !!revealedNow[c.hidden];
    return run.stubs.some(s => s.floor === f && inRect(x, z, s.rect));
  };

  // ---------- Items ----------
  const itemRoot = new THREE.Group(); itemRoot.name = 'Botín'; group.add(itemRoot);
  const items = new Map();
  function syncItems(state, viewer) {
    const seen = new Set(), vf = viewer ? floorOf(viewer.x) : 0;
    for (const item of visibleItems(state)) {
      if (item.state === 'big' && false) continue;
      seen.add(item.id);
      let shown = items.get(item.id);
      if (!shown) {
        const model = itemModel(item.kind), aura = new THREE.Sprite(haloMaterial(glowColor(item.kind)));
        const size = ITEMS[item.kind].size; aura.scale.setScalar(size === 'big' ? 3.2 : 1.1); aura.position.y = size === 'big' ? 1 : .35;
        const root = new THREE.Group(); root.add(model, aura); itemRoot.add(root);
        shown = { root, model, aura, kind: item.kind, spin: Math.random() * 6 }; items.set(item.id, shown);
        root.position.set(item.x, item.y || 0, item.z);
      }
      const near = !viewer || (floorOf(item.x) === vf && Math.hypot(item.x - viewer.x, item.z - viewer.z) < 45);
      shown.root.visible = near;
      if (!near) continue;
      const target = new THREE.Vector3(item.x, (item.y || 0) + L.groundAt(item.x, item.z) * (item.state === 'air' ? 0 : 1), item.z);
      if (shown.root.position.distanceTo(target) > 4) shown.root.position.copy(target); else shown.root.position.lerp(target, .5);
      shown.root.rotation.y = item.h || 0;
      shown.model.rotation.z = item.tip > 0 ? Math.sin(item.tip * 12) * .3 : 0;
      shown.state = item.state;
    }
    for (const [id, shown] of items) if (!seen.has(id)) { shown.root.removeFromParent(); items.delete(id); }
  }

  let truckKey = '';
  function syncTruck(state) {
    const key = state.truck.slice(-12).join();
    if (key === truckKey) return; truckKey = key;
    bed.clear();
    state.truck.slice(-12).forEach((kind, i) => {
      const model = itemModel(kind), big = ITEMS[kind].size === 'big';
      model.scale.multiplyScalar(big ? .45 : 1.4);
      model.position.set((i % 3 - 1) * .55, Math.floor(i / 6) * .35, -1.2 - Math.floor(i / 3) % 2 * .7); bed.add(model);
    });
  }

  let previous = {};
  function update(t, state = {}, dt = .016, viewer = null) {
    tickWind(t, .8);
    for (const a of animated) a.userData.tick?.(t, dt);
    revealedNow = state.revealed || {};
    // Floors: the camp always; floor 1 at once; the next when its seal opens.
    const want = new Set([1]);
    for (const seal of run.seals) if (state.open?.[seal.id]) want.add(seal.floor + 1);
    if (viewer) want.add(floorOf(viewer.x));
    for (const f of want) buildFloor(f);
    const vf = viewer ? floorOf(viewer.x) : 0;
    camp.visible = !viewer || vf === 0;
    for (const [f, floor] of floorsBuilt) {
      floor.root.visible = !viewer || f === vf;
      const key = run.hidden.filter(h => h.floor === f && revealedNow[h.id]).map(h => h.id).join();
      if (key !== floor.revealed) { floor.revealed = key; floor.shell.removeFromParent(); floor.shell.userData.dispose(); floor.shell = floor.rebuild(); floor.root.add(floor.shell); }
      for (const [id, seal] of floor.seals) { seal.height = THREE.MathUtils.damp(seal.height, state.open?.[id] ? -HEIGHT - .4 : 0, 2.2, dt); seal.slab.position.y = seal.height; }
      for (const [id, model] of floor.winches) { const w = state.winches?.[id]; model.userData.wheel.rotation.z = -(w?.progress || 0) * Math.PI * 2 - (w?.latched > 0 ? t * 2 : 0); }
      for (const [id, chest] of floor.chests) { const open = !!state.chests?.[id]; chest.open = THREE.MathUtils.damp(chest.open, open ? 1 : 0, 6, dt); chest.model.userData.lid.rotation.x = -chest.open * 1.9; }
      for (const { id, plate } of floor.plates) plate.userData.glyph.material.emissiveIntensity = (state.plates?.[id] || 0) > (state.time || 0) ? 1.4 : .15 + Math.sin(t * 3 + id) * .1;
    }
    const ride = liftView(state.lift), at = run.lifts.find(l => l.floor === ride.floor);
    if (at) { cage.position.set(at.x, ride.y, at.z); cage.rotation.y = at.h; }
    cage.visible = !viewer || floorOf(viewer.x) === ride.floor;
    // Rubble from collapses.
    const rubbleRoot = group.getObjectByName('Derrumbes') || Object.assign(new THREE.Group(), { name: 'Derrumbes' });
    if (!rubbleRoot.parent) group.add(rubbleRoot);
    const rubbleKey = Object.keys(state.rubble || {}).join();
    if (rubbleKey !== previous.rubble) {
      previous.rubble = rubbleKey;
      rubbleRoot.children.forEach(o => o.userData.dispose?.()); rubbleRoot.clear();
      for (const id of Object.keys(state.rubble || {})) { const c = run.corridors.find(c => c.id === id); if (c) { const pile = ruinRubble({ seed: c.rect[0] | 0, count: 14, spread: 2.2 }); pile.position.set((c.rect[0] + c.rect[2]) / 2, 0, (c.rect[1] + c.rect[3]) / 2); pile.scale.set(1.4, 2.2, 1.4); rubbleRoot.add(pile); } }
    }
    syncItems(state, viewer);
    for (const shown of items.values()) if (shown.root.visible && shown.state === 'ground' && ITEMS[shown.kind].size !== 'big') { shown.spin += dt; shown.aura.material.opacity = .4 + Math.sin(shown.spin * 3) * .15; }
    syncTruck(state);
    truckRing.material.opacity = .45 + Math.sin(t * 3) * .15;
  }
  function dispose() {
    const geometries = new Set(), materials = new Set();
    group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); o.userData.dispose?.(); });
    geometries.forEach(g => g.dispose());
    owned.forEach(m => m.dispose?.()); haloMaterials.forEach(m => m.dispose()); halo.dispose();
    materials.forEach(m => { if (m.map && m.map !== halo) m.map.dispose?.(); });
  }
  return { group, update, dispose, buildFloor, floors: floorsBuilt, items, layout: L, run, bounds: new THREE.Box3(new THREE.Vector3(-40, -8, -140), new THREE.Vector3(floors * L.SPACING + 60, 20, 40)) };
}
