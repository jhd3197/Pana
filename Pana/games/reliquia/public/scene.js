// Reliquia's world from a generated run: the camp's cavern with the truck, and
// each floor's galleries built the first time anyone can reach them. Every
// prop comes from the shared model library (Pana Studio). Collision never
// reads this file: it all comes from layout.js, built from the same deck.
import * as THREE from 'three';
import { rng } from '/engine/random.js';
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
import { glowMushrooms, mushroomHalos } from '/engine/models/props/glow-mushrooms.js';
import { expeditionJeep, expeditionTent, expeditionCampfire, supplyPile, campBench, investigationTable } from '/engine/models/props/expedition-camp.js';
import { lajaRock } from '/engine/models/props/amazonas.js';
import { china } from '/engine/models/props/china.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { bookcases, bookcaseDoor, libraryLadder, readingTable, scribeDesk, lectern, candelabra, candleStick, chandelier, hangingLantern, armchair, tallWindow, tornCurtain, cobwebs, candleFlames, rugs, groundMist, bookPiles } from '/engine/models/props/reliquia-library.js';
import { writingDesk, travelTrunk, drapedFurniture, oldWardrobe, bookHeap, rollingShelf, rollingLadder, oldLantern, oldBook } from '/engine/models/props/reliquia-hideouts.js';
import { createPaintMarker } from '/engine/models/props/paintball.js';
import { marketStall } from '/engine/models/props/plaza.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hideNook } from '/engine/models/props/reliquia-boss.js';
import { createFire } from '/engine/fx/fire.js';
import { getSettings } from '/engine/settings.js';
import { giantMushroom, puffball, hangingRope, ropeAnchor, narrowBeam, coiledRope, flareStick, sealedParcel, ceilingCrackMark, floodSurface } from '/engine/models/props/fosa-biomes.js';
import { createCampCave } from './camp-cave.js';
import { layoutFor } from './layout.js';
import { visibleItems, liftView, SHOP, SHOP_AT, shopSpot, RUBBLE_HOLD } from './rules.js';
import { ITEMS, ARTIFACTS } from './items.js';
import { TRUCK, TABLE, HEIGHT, CAGE, floorOf, inRect } from './deck.js';
import { onPlate } from './sucesos.js';

const PALETTES = ['sol', 'jade', 'maldita'];
// The camp's gallery: damp dark stone, nothing sunny about it.
const GALLERY_STONE = { floor: 0x5c5850, bricks: [0x4e4c48, 0x45433f, 0x575450], band: 0x3a3226, ceiling: 0x1c1a1c, glyph: 0x8a7a58 };
export const paletteFor = (floor, theme = 'mina') => theme !== 'mina' && RUIN_PALETTES[theme] ? RUIN_PALETTES[theme] : RUIN_PALETTES[PALETTES[(floor - 1) % PALETTES.length]];
const FACTORIES = { ...treasure, oldBook, flareStick: () => flareStick({ lit: false }), coiledRope, sealedParcel, mineCart: () => mineCart({ load: 'gold', hollow: true }), olmecHead: () => olmecHead({ size: 1.3 }), jaguarStatue: () => jaguarStatue({ gold: true, scale: .7 }), china, expeditionLantern, createPaintMarker: () => createPaintMarker({ color: '#ff5ab4' }) };
const GLOW = { tool: 0xfff1d6, treasure: 0xffc23d, big: 0xffd36a, junk: 0x9aa4b0 };

// One prototype per item kind; every copy on the map is a cheap clone.
const prototypes = new Map();
export function itemModel(kind) {
  if (!prototypes.has(kind)) {
    const model = FACTORIES[ITEMS[kind].model]();
    if (kind === 'farol') model.scale.setScalar(1.3);
    if (kind === 'honda') model.scale.setScalar(1.1);
    if (kind === 'marcadora') model.scale.setScalar(.55);
    prototypes.set(kind, model);
  }
  return prototypes.get(kind).clone();
}
export const glowColor = kind => ITEMS[kind].artifact ? treasure.ARTIFACT_AURA[kind] : ITEMS[kind].junk ? GLOW.junk : ITEMS[kind].tool ? GLOW.tool : ITEMS[kind].size === 'big' ? GLOW.big : GLOW.treasure;

// How a fire sits on each thing that burns: where its base is, how big it is.
const FIRES = { brazier: { y: 1.27, height: 1.45, radius: .34 }, campfire: { y: .22, height: 2.1, radius: .72, emberSize: .05 } };
const FIRE_DRAW = 30;   // past this the fog has it: no flame cards at all
const RUBBLE_TINT = .36, RUBBLE_CHIP = 0x5a5044, ROCK_FX = 30;
const reducedMotion = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createExpeditionWorld({ seed = 1, depth = 1, theme, roof = true, onFx = null } = {}) {
  const L = layoutFor(seed, depth, theme), run = L.run, floors = run.floors;
  const group = new THREE.Group(); group.name = 'Fosa · La mina del sol'; // i18n-ignore: scene graph name
  const owned = new Set(), animated = [], floorsBuilt = new Map(), calm = reducedMotion();
  let fireDetail = getSettings().detail;
  // Every fire: the view lends each near one a light; its crackles go to whoever listens.
  const fire = (kind, parent, x, z, seedOf) => {
    const { y, ...size } = FIRES[kind], made = createFire({ ...size, seed: seedOf, calm, quality: fireDetail, onCrackle: e => onFx?.({ type: 'crackle', ...e }) });
    made.group.position.set(x, y, z); parent.add(made.group); return { x, z, fire: made };
  };
  const halo = glowTexture(), haloMaterials = new Map();
  const haloMaterial = color => { if (!haloMaterials.has(color)) haloMaterials.set(color, new THREE.SpriteMaterial({ map: halo, color, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); return haloMaterials.get(color); };
  const mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .9, ...extra }); owned.add(m); return m; };
  const place = (parent, model, x, y, z, h = 0, s = 1) => { model.position.set(x, y, z); model.rotation.y = h; if (s !== 1) model.scale.multiplyScalar(s); parent.add(model); return model; };

  // ---------- Camp ----------
  const camp = new THREE.Group(); camp.name = 'Campamento'; group.add(camp);
  const campStatic = new THREE.Group();
  const cave = createCampCave({ halo }); camp.add(cave); animated.push(cave);
  const truck = place(camp, expeditionJeep(), TRUCK.x, 0, TRUCK.z, TRUCK.h, 1.25);
  const truckRing = new THREE.Mesh(new THREE.RingGeometry(4.3, 4.6, 64), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: .6, depthWrite: false })); owned.add(truckRing.material);
  truckRing.rotation.x = -Math.PI / 2; truckRing.position.set(TRUCK.x, .04, TRUCK.z); camp.add(truckRing);
  const bed = new THREE.Group(); bed.position.set(TRUCK.x, 1.4, TRUCK.z); bed.rotation.y = TRUCK.h; camp.add(bed);
  place(campStatic, investigationTable(), TABLE.x, 0, TABLE.z, 0);
  place(campStatic, expeditionTent({ color: 'mustard' }), -9, 0, 22, .4);
  place(campStatic, expeditionTent({ color: 'olive', seed: 4 }), -14, 0, 14, 1.2);
  const campfireModel = place(camp, expeditionCampfire({ flame: false }), 3, 0, 26); animated.push(campfireModel);
  const campFires = [fire('campfire', camp, 3, 26, 41)];
  place(campStatic, campBench({ length: 2 }), 0, 0, 25, .3); place(campStatic, campBench({ length: 2 }), 6, 0, 26.5, -.4);
  place(campStatic, supplyPile({ seed: 5 }), 14, 0, 11, -.6);
  place(campStatic, mineCrate({ seed: 3 }), -3, 0, 4, .4); place(campStatic, mineCrate({ seed: 5, tnt: true }), -4, 0, 2.6, -.2);
  // The mine is a level gallery into the rock: an open mouth and timber sets inside.
  place(campStatic, minePortal({ name: 'LA MINA DEL SOL', niche: false }), 0, 0, -1.6, 0);
  place(campStatic, mineSupport({ width: 3.9, height: 3.8, lantern: true }), 0, 0, -3.8);
  for (const [x, z, r] of [[-4, -2.2, 1.6], [4.2, -2.4, 1.4]]) place(campStatic, lajaRock({ seed: x * 13 + 5, radius: r, flat: .8 }), x, 0, z);
  place(camp, treasure.liftShaft({ below: 18, above: 5 }), run.lifts[0].x, 0, run.lifts[0].z, run.lifts[0].h);
  for (const pad of run.cargo.filter(c => c.floor === 0)) place(camp, treasure.cargoLift({ height: 6 }), pad.x, 0, pad.z, Math.PI / 2);
  for (const [x, z, r] of [[-17, -1, 2.4], [18, 22, 2.8], [-18, 26, 2.2]]) place(campStatic, lajaRock({ seed: x * 7, radius: r }), x, 0, z);
  const mouth = ruinShell({ inside: (x, z) => floorOf(x) === 0 && run.stubs.some(s => s.floor === 0 && inRect(x, z, s.rect)), ground: L.groundAt, open: (x, z) => z > -2, solid: (x, z) => !inShaft(0, x, z), sky: (x, z) => inShaft(0, x, z, .4), bounds: [-4, -16, 4, 0], palette: GALLERY_STONE, seed: 3, tile: 1 });
  camp.add(mouth); owned.add(mouth);
  const campBatch = bake(campStatic, { cellSize: 30 }); campStatic.traverse(o => o.geometry?.dispose()); camp.add(campBatch);

  // The shop: a market stall with what mangos can buy laid on its counter.
  place(camp, marketStall({ seed: 4, colors: [0x2fb5a8, 0xffc23d] }), SHOP_AT.x, 0, SHOP_AT.z, SHOP_AT.h);
  SHOP.forEach(([kind], i) => { const at = shopSpot(i), m = itemModel(kind); if (kind === 'farol') m.scale.multiplyScalar(.6); m.position.set(at.x, 1.27, at.z); m.rotation.y = SHOP_AT.h; camp.add(m); });
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
      case 'candelabra': return candelabra({ arms: 3, seed: d.x | 0 });
      case 'ladder': return libraryLadder({ height: 3.3 });
      case 'lectern': return lectern({ seed: d.z | 0 });
      case 'bigLectern': return lectern({ big: true });
      case 'chandelier': return chandelier({ ceiling: HEIGHT, drop: 1.5, seed: d.x | 0, lit: true });
      case 'giantMushroom': return giantMushroom({ seed: (d.x * 7 + d.z * 3) | 0 });
      case 'puffball': return puffball({ seed: d.z | 0 });
      case 'crack': return ceilingCrackMark({ seed: (d.x * 3 + d.z) | 0 });
      default: return null;
    }
  }
  function buildFloor(f) {
    if (floorsBuilt.has(f) || f < 1 || f > floors) return floorsBuilt.get(f);
    const root = new THREE.Group(); root.name = `Piso ${f}`; group.add(root);
    const library = run.theme === 'biblioteca', statics = new THREE.Group(), palette = paletteFor(depth, run.theme), x0 = f * L.SPACING - 60;
    const shell = () => ruinShell({ inside: (x, z) => insideFloor(f, x, z), ground: L.groundAt, solid: (x, z) => !L.overPit(x, z) && !inShaft(f, x, z) && !run.bridges.some(b => b.beam && inRect(x, z, b.rect)), sky: (x, z) => inShaft(f, x, z, .4) || run.cargo.some(c => c.floor === f && Math.abs(x - c.x) < 1.6 && Math.abs(z - c.z) < 1.6), bounds: [x0, -140, x0 + 120, 20], palette, seed: f * 13, roof });
    const floor = { root, shell: shell(), revealed: '', fires: [], seals: new Map(), winches: new Map(), chests: new Map(), plates: [], rubble: new Map(), rebuild: shell, flames: null, doors: [], spots: new Map(), webs: null, mist: null, chandeliers: [], water: null, waterLevel: .13, spans: new Map(), ropes: new Map(), twins: [], decorGlows: [] };
    root.add(floor.shell);
    // Candle flames of the whole floor go in one instanced shader.
    const flamePoints = [], flamesOf = (model, x, y, z, h = 0) => { for (const p of model.userData.flames || []) flamePoints.push(new THREE.Vector3(p.x * Math.cos(h) + p.z * Math.sin(h) + x, p.y + y, -p.x * Math.sin(h) + p.z * Math.cos(h) + z)); };
    for (const d of run.decor.filter(d => d.floor === f)) {
      // The bowl and its coals bake with the floor; only the flame is alive.
      if (d.kind === 'brazier') { place(statics, brazier({ seed: d.x | 0, lit: false }), d.x, 0, d.z); floor.fires.push(fire('brazier', root, d.x, d.z, (d.x * 7 + d.z * 3) | 0)); continue; }
      const model = decorModel(d); if (!model) continue;
      if (d.kind === 'vein') { model.rotation.z = Math.PI / 2; model.position.y = 1.6; }
      if (d.kind === 'chandelier') floor.chandeliers.push({ x: d.x, z: d.z });
      if (model.userData.glow) floor.decorGlows.push({ x: d.x, y: model.userData.glow.y, z: d.z, color: model.userData.glow.color });
      flamesOf(model, d.x, 0, d.z, d.h);
      place(statics, model, d.x, model.position.y, d.z, d.h);
    }
    if (library) furnishLibrary(f, statics, root, floor, flamesOf);
    if (run.theme === 'inundada') flood(f, root, floor);
    // Skulls and crystals give the dark corners a little colour (crystals are
    // instanced with their own shader, so they stay out of the static batch).
    for (const r of run.rooms.filter(r => r.floor === f)) {
      const k = (r.x * 7 + r.z * 3) | 0;
      if (library) continue;
      if (depth > 1 && k % 3 === 0) place(statics, skull({ size: .35 }), r.rect[0] + 1, 0, r.rect[3] - 1.1, k);
      if (k % 2 === 0) place(root, crystalCluster({ size: .9, color: (k >> 1) % 8, seed: k }), r.rect[2] - .8, 0, r.rect[1] + .8, k);
    }
    dress(f, statics, root);
    sowMushrooms(f, statics, root, floor);
    for (const pit of run.pits.filter(p => p.floor === f)) {
      const [a, b, c, d] = pit.rect, hole = new THREE.Mesh(new THREE.BoxGeometry(c - a, .5, d - b), mat(0x07040c));
      hole.position.set((a + c) / 2, -7, (b + d) / 2); root.add(hole);
      if (!pit.water) for (let i = 0; i < 6; i++) place(root, crystalCluster({ size: 1.4, color: i % 8, seed: i + f }), a + (i % 3 + .5) * (c - a) / 3, -6.6, i < 3 ? b + 1.2 : d - 1.2, i);
      else { const pool = floodSurface({ rects: [pit.rect], y: -.6, color: 0x06181c, opacity: .94 }); root.add(pool); floor.pools = [...(floor.pools || []), pool]; }
      // A hanging platform stops well above the bottom; its slabs come with the shell.
      const [ia, ib, ic, id] = pit.island, top = -(pit.low || 0) - .15, tall = top + 6.95, island = new THREE.Mesh(new THREE.BoxGeometry(ic - ia, tall, id - ib), mat(0x8a7356, { flatShading: true }));
      island.position.set((ia + ic) / 2, top - tall / 2, (ib + id) / 2); root.add(island);
    }
    for (const pit of run.pits.filter(p => p.floor === f)) pitEdge(pit, root, run.bridges.filter(q => q.floor === f && q.room === pit.room).map(q => q.rect), run.theme === 'biblioteca');
    // Hiding nooks, baked with the floor: two slabs, a dark gap, a chalk hand.
    for (const n of run.nooks.filter(q => q.floor === f)) { const library = run.theme === 'biblioteca', model = hideNook(library ? { stone: 0x4c4a4c, dark: 0x302e32, chalk: 0xd6d8d0, sill: 0x74767a } : {}); flamesOf(model, n.mouth.x, 0, n.mouth.z, n.h); place(statics, model, n.mouth.x, 0, n.mouth.z, n.h); }
    for (const b of run.bridges.filter(b => b.floor === f)) {
      const span = b.rect[3] - b.rect[1], x = (b.rect[0] + b.rect[2]) / 2, z = (b.rect[1] + b.rect[3]) / 2;
      if (b.beam) { place(statics, narrowBeam({ span, width: b.rect[2] - b.rect[0], seed: (x + z) | 0 }), x, 0, z); continue; }
      const bridge = place(root, ropeBridge({ span: Math.max(4, span), seed: f * 9 }), x, -1.7, z, Math.PI / 2);
      if (b.needs) { bridge.visible = false; floor.spans.set(b.id, bridge); place(statics, ropeAnchor(), b.x + 1.5, 0, b.z); place(statics, ropeAnchor(), b.x - 1.5, 0, b.z); }
    }
    // Ropes hang off a stake at the rim, down past the platform's edge.
    for (const r of run.ropes.filter(r => r.floor === f)) {
      place(statics, ropeAnchor({ tied: !r.needs }), r.x + 1, 0, r.z);
      const rope = place(root, hangingRope({ length: r.low + .9, seed: r.id.length }), r.x, .9, (r.z + r.bz) / 2);
      rope.visible = !r.needs; floor.ropes.set(r.id, rope);
    }
    // The golden chamber's twin plates: they light while a weight is on them.
    for (const t of run.twins.filter(t => t.floor === f)) for (const q of t.plates) {
      const plate = place(root, treasure.trapPlate(), q.x, .01, q.z);
      plate.userData.glyph.material = mat(0x8a6a2a, { emissive: 0xffc23d, emissiveIntensity: .25 });
      floor.twins.push({ q, wall: t.wall, plate });
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
    for (const pad of run.cargo.filter(c => c.floor === f)) place(root, treasure.cargoLift({ button: Math.sign(pad.bx - pad.x) || 1 }), pad.x, 0, pad.z);
    const batch = bake(statics, { cellSize: 26 }); statics.traverse(o => o.geometry?.dispose()); root.add(batch);
    if (flamePoints.length) { floor.flames = candleFlames(flamePoints); root.add(floor.flames); }
    floorsBuilt.set(f, floor);
    return floor;
  }
  // Walls and corridors get dressed so no stretch of brick is bare: lanterns
  // and timber sets in the mine, jaguar reliefs, hanging roots and doorway
  // pillars deeper down. Nothing here collides; it all hugs the walls.
  // The pit's edge: a low stone lip and a pale band you cannot miss in the dark,
  // and sheer walls so the drop reads as a drop. Three draws per pit.
  function pitEdge(pit, root, gaps, library) {
    const [a, b, c, d] = pit.rect, [ia, ib, ic, id] = pit.island, lip = [], band = [], side = [];
    const piece = (list, x0, x1, z0, z1, y, h) => { const g = new THREE.BoxGeometry(x1 - x0, h, z1 - z0); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2); list.push(g); };
    const curb = (x0, x1, z0, z1, along) => {
      // Split around the bridge's foot.
      let spans = [along === 'x' ? [x0, x1] : [z0, z1]];
      for (const q of gaps) if (along === 'x' ? q[1] < z1 + .4 && q[3] > z0 - .4 : q[0] < x1 + .4 && q[2] > x0 - .4) { const g0 = along === 'x' ? q[0] : q[1], g1 = along === 'x' ? q[2] : q[3]; spans = spans.flatMap(([u, v]) => [[u, Math.min(v, g0)], [Math.max(u, g1), v]]).filter(([u, v]) => v - u > .2); }
      for (const [u, v] of spans) {
        const [xa, xb, za, zb] = along === 'x' ? [u, v, z0, z1] : [x0, x1, u, v];
        piece(lip, xa, xb, za, zb, .05, .1);
        if (along === 'x') piece(band, xa, xb, (za + zb) / 2 - .05, (za + zb) / 2 + .05, .106, .012); else piece(band, (xa + xb) / 2 - .05, (xa + xb) / 2 + .05, za, zb, .106, .012);
      }
    };
    curb(a - .28, c + .28, b - .28, b + .02, 'x'); curb(a - .28, c + .28, d - .02, d + .28, 'x'); curb(a - .28, a + .02, b, d, 'z'); curb(c - .02, c + .28, b, d, 'z');
    curb(ia - .2, ic + .2, ib - .2, ib + .02, 'x'); curb(ia - .2, ic + .2, id - .02, id + .2, 'x'); curb(ia - .2, ia + .02, ib, id, 'z'); curb(ic - .02, ic + .2, ib, id, 'z');
    piece(side, a - .02, c + .02, b - .06, b, -3.6, 7); piece(side, a - .02, c + .02, d, d + .06, -3.6, 7); piece(side, a - .06, a, b, d, -3.6, 7); piece(side, c, c + .06, b, d, -3.6, 7);
    const merged = list => { const g = mergeGeometries(list, false); list.forEach(q => q.dispose()); return g; };
    const edge = new THREE.Mesh(merged(lip), mat(library ? 0x4a4c52 : 0x6a5c48, { flatShading: true })); edge.receiveShadow = true;
    const walls = new THREE.Mesh(merged(side), mat(0x0d0a10));
    const stripe = new THREE.Mesh(merged(band), mat(library ? 0xc9ccc4 : 0xe0b860, { emissive: library ? 0x5a5c58 : 0x7a4f12, emissiveIntensity: 1 }));
    root.add(edge, walls, stripe);
  }
  // The flooded tunnels: one sheet of shallow water over every room and corridor,
  // cut around the pits (a dry island keeps its head above it).
  function flood(f, root, floor) {
    const cut = (rects, [a, b, c, d]) => rects.flatMap(r => {
      if (r[0] >= c || r[2] <= a || r[1] >= d || r[3] <= b) return [r];
      const out = [];
      if (r[0] < a) out.push([r[0], r[1], a, r[3]]);
      if (r[2] > c) out.push([c, r[1], r[2], r[3]]);
      const x0 = Math.max(r[0], a), x1 = Math.min(r[2], c);
      if (r[1] < b) out.push([x0, r[1], x1, b]);
      if (r[3] > d) out.push([x0, d, x1, r[3]]);
      return out;
    });
    const rooms = run.rooms.filter(r => r.floor === f && !r.hidden);
    let rects = rooms.map(r => r.rect);
    for (const pit of run.pits.filter(p => p.floor === f)) rects = cut(rects, pit.rect);
    let halls = run.corridors.filter(c => c.floor === f && !c.hidden).map(c => c.rect);
    for (const r of rooms) halls = cut(halls, r.rect);
    floor.water = floodSurface({ rects: [...rects, ...halls] });
    root.add(floor.water);
  }
  function dress(f, statics, root) {
    if (run.theme === 'biblioteca') return;
    // Timber and lamps in the mine's first levels and (rotten, unlit) in the flooded
    // tunnels; carved reliefs in the temple and the deep mine; roots in the grove.
    const theme = run.theme, timbered = theme === 'inundada' || (theme === 'mina' && depth <= 2), lamps = theme === 'mina' && depth <= 2;
    const openings = [...run.corridors, ...run.stubs].filter(c => c.floor === f).map(c => c.rect);
    for (const room of run.rooms.filter(r => r.floor === f)) {
      const [x0, z0, x1, z1] = room.rect, k = (room.x * 3 + room.z * 7) | 0, spots = [];
      for (const t of [-.32, 0, .32]) {
        spots.push({ x: room.x + t * room.w, z: z0 + .2, h: 0 }, { x: room.x + t * room.w, z: z1 - .2, h: Math.PI });
        spots.push({ x: x0 + .2, z: room.z + t * room.d, h: Math.PI / 2 }, { x: x1 - .2, z: room.z + t * room.d, h: -Math.PI / 2 });
      }
      const free = spots.filter(p => !openings.some(o => inRect(p.x, p.z, o, 1.6)) && !run.seals.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 3) && !run.plates.some(q => q.room === room.id && Math.abs(q.z - p.z) < 1.2)
        // Nothing hangs on the wall behind a nook: a carving floating in its opening reads as a wall.
        && !run.nooks.some(n => n.room === room.id && inRect(p.x, p.z, n.rect, 1.2)));
      free.forEach((p, i) => {
        if ((i + k) % 3 === 2) return;
        if (lamps) { const lamp = place(statics, mineLantern({}), p.x + Math.sin(p.h) * .1, 2.3, p.z + Math.cos(p.h) * .1, p.h); lamp.scale.setScalar(1.2); }
        else if ((i + k) % 3 === 0 && theme !== 'hongos' && theme !== 'inundada' || theme === 'templo') place(statics, jaguarRelief({ width: 2.2, height: 1, seed: k + i, moss: depth % 2 === 0 }), p.x, 1.1, p.z, p.h);
        else { const roots = rootCurtain({ seed: k + i, length: 2.6 + (i % 3) * .6, width: 2.4 }); roots.position.set(p.x + Math.sin(p.h) * .5, HEIGHT, p.z + Math.cos(p.h) * .5); statics.add(roots); }
      });
      if (k % 2 === 0 || theme === 'templo') place(statics, ruinRubble({ seed: k, count: theme === 'templo' ? 7 : 4, spread: theme === 'templo' ? 1.4 : .9 }), x0 + 1.2, 0, z1 - 1.2, k);
    }
    for (const c of run.corridors.filter(c => c.floor === f)) {
      const [x0, z0, x1, z1] = c.rect, along = c.horizontal ? x1 - x0 : z1 - z0, mid = c.horizontal ? (z0 + z1) / 2 : (x0 + x1) / 2;
      if (theme === 'hongos') continue;
      if (timbered) for (let t = 2.5; t < along - 1.5; t += 4.5) place(statics, mineSupport({ width: 3.6, height: 3.8, lantern: lamps && t < 3 }), c.horizontal ? x0 + t : mid, 0, c.horizontal ? mid : z0 + t, c.horizontal ? Math.PI / 2 : 0);
      else for (const end of [0, along]) for (const s of [-1, 1]) {
        const a = c.horizontal ? x0 + end : mid + s * 2.15, b = c.horizontal ? mid + s * 2.15 : z0 + end;
        place(statics, ruinColumn({ seed: (a * 5 + b) | 0, radius: .32, height: HEIGHT }), a, 0, b);
      }
    }
  }
  // Glowing fungi on every floor of every jornada: shelves on the walls, clumps
  // at their feet and down in the pits. Their own stream of numbers, so the
  // deck never notices, and nothing here collides. Baked with the floor, all
  // the halos in one draw; floor.glows lists them for the view's light pool.
  function sowMushrooms(f, statics, root, floor) {
    // The grove is thick with them.
    const library = run.theme === 'biblioteca', grove = run.theme === 'hongos', R = rng(run.seed * 13 + f * 101 + depth), glows = [...floor.decorGlows];
    const openings = [...run.corridors, ...run.stubs].filter(c => c.floor === f).map(c => c.rect);
    const busy = (x, z) => openings.some(o => inRect(x, z, o, 1.2)) || run.seals.some(q => q.floor === f && Math.hypot(q.x - x, q.z - z) < 3.2)
      || run.plates.some(q => q.floor === f && Math.hypot(q.x - x, q.z - z) < 2) || run.nooks.some(q => q.floor === f && Math.hypot(q.mouth.x - x, q.mouth.z - z) < 2.4)
      || [...run.lifts, ...run.cargo].some(q => q.floor === f && Math.hypot(q.x - x, q.z - z) < 4.2) || run.solids.some(q => q.floor === f && inRect(x, z, q.rect, .5));
    const sow = (x, y, z, h, wall) => {
      const model = place(statics, glowMushrooms({ seed: Math.floor(R() * 1e6), wall }), x, y, z, h), { y: gy, z: gz, color } = model.userData.glow;
      glows.push({ x: x + Math.sin(h) * gz, y: y + gy, z: z + Math.cos(h) * gz, color });
    };
    // Along a stretch of wall: h faces away from the rock.
    const wall = (x, z, h) => {
      const ix = Math.sin(h), iz = Math.cos(h);
      if (L.overPit(x + ix * .5, z + iz * .5)) return;
      if (library || R() < .45) { if (!busy(x + ix * .5, z + iz * .5)) sow(x + ix * .45, 0, z + iz * .45, h, false); }
      else if (!busy(x + ix * .1, z + iz * .1)) sow(x + ix * .02, .7 + R() * 1.9, z + iz * .02, h, true);
    };
    // Not in hidden rooms: a light borrowed there would shine through the wall and give the secret away.
    for (const room of run.rooms.filter(r => r.floor === f && !r.hidden)) {
      const [x0, z0, x1, z1] = room.rect, chance = library ? .24 : grove ? .78 : .42;
      for (const t of [-.38, -.13, .13, .38]) {
        if (R() < chance) wall(room.x + t * room.w, z0 + .03, 0);
        if (R() < chance) wall(room.x + t * room.w, z1 - .03, Math.PI);
        if (R() < chance) wall(x0 + .03, room.z + t * room.d, Math.PI / 2);
        if (R() < chance) wall(x1 - .03, room.z + t * room.d, -Math.PI / 2);
      }
    }
    if (!library) for (const c of run.corridors.filter(c => c.floor === f && !c.hidden)) for (let n = grove ? 3 : 1; n > 0; n--) {
      const [x0, z0, x1, z1] = c.rect, side = R() < .5, t = .3 + R() * .4;
      if (c.horizontal) wall(x0 + (x1 - x0) * t, side ? z0 + .03 : z1 - .03, side ? 0 : Math.PI);
      else wall(side ? x0 + .03 : x1 - .03, z0 + (z1 - z0) * t, side ? Math.PI / 2 : -Math.PI / 2);
    }
    // Pits glow from below: clumps on the bottom, shelves down the sheer sides.
    for (const pit of run.pits.filter(p => p.floor === f)) {
      const [a, b, c, d] = pit.rect, bottom = -6.75;
      for (let i = 0; i < 4; i++) sow(a + .8 + R() * (c - a - 1.6), bottom, i % 2 ? b + .9 : d - .9, R() * 6, false);
      for (let i = 0; i < 4; i++) { const y = -1.4 - R() * 3.8, u = a + .8 + R() * (c - a - 1.6); if (i % 2) sow(u, y, b + .02, 0, true); else sow(u, y, d - .02, Math.PI, true); }
    }
    if (!glows.length) return;
    floor.glows = glows; floor.mushroomHalos = mushroomHalos(glows, halo); root.add(floor.mushroomHalos);
  }
  // La biblioteca sepultada: the dealt bookcases (each room its own mix of
  // shelf variants), tables and desks, then cases along every free stretch
  // of wall, a tall window or two in the reading hall, webs everywhere (fans
  // in corners and arches, sheets sagging across aisles, strands hanging from
  // the ceiling), a few small flames, rugs, piles of books, and low mist only
  // in the rooms chosen for it. The hiding spots get their own models.
  function furnishLibrary(f, statics, root, floor, flamesOf) {
    // Webs hang from just under the rough ceiling slabs, never inside them.
    const WEB_TOP = HEIGHT - .32;
    const cases = [], webs = [], rugList = [], piles = [], mist = [], seed = f * 31 + depth * 7, R = rng(seed);
    const rooms = run.rooms.filter(r => r.floor === f);
    // Every room its own style: a main shelf variant, how full the shelves are,
    // and (in the stacks) maybe one collapsed case.
    const styles = new Map(rooms.map(r => [r.id, { main: ['arched', 'plain', 'pillar', 'arched'][Math.floor(R() * 4)], fill: .72 + R() * .25, collapse: r.kind === 'estanterias' && R() < .5, collapsed: false }]));
    // Low ground mist is an accent: always the reading hall, a stacks room
    // with a fallen case, never more than one room in three.
    const misty = new Set(rooms.filter(r => r.kind === 'lectura').map(r => r.id));
    for (const r of rooms) if (styles.get(r.id).collapse && misty.size < Math.ceil(rooms.length / 3)) misty.add(r.id);
    const variantFor = (s, along, length) => {
      const st = styles.get(s.room);
      if (st.collapse && !st.collapsed && along && R() < .35) { st.collapsed = true; return 'collapsed'; }
      const roll = R();
      const v = roll < .62 ? st.main : roll < .78 ? 'ladder' : roll < .88 ? 'low' : ['arched', 'plain', 'pillar'][Math.floor(R() * 3)];
      return v === 'pillar' && length < 2.6 ? 'arched' : v;
    };
    const deskSpots = new Set(run.spots.filter(sp => sp.floor === f && sp.desk).map(sp => `${sp.x.toFixed(2)},${sp.z.toFixed(2)}`));
    // Variants first: a collapsed case tips into an aisle, and the case across
    // that aisle keeps the ladder somebody was climbing when it went.
    const shelves = run.solids.filter(s => s.floor === f && s.kind === 'shelf'), variants = new Map(), tips = new Map(), ladderSide = new Map();
    for (const s of shelves) { const along = s.axis === 'x'; variants.set(s, variantFor(s, along, along ? s.rect[2] - s.rect[0] : s.rect[3] - s.rect[1])); }
    for (const s of shelves) if (variants.get(s) === 'collapsed') {
      const cz = (s.rect[1] + s.rect[3]) / 2, cx = (s.rect[0] + s.rect[2]) / 2;
      const across = shelves.find(q => q !== s && q.room === s.room && q.axis === 'x' && Math.abs(Math.abs((q.rect[1] + q.rect[3]) / 2 - cz) - 3) < .1 && q.rect[0] < s.rect[2] && q.rect[2] > s.rect[0] && variants.get(q) !== 'collapsed');
      const toward = across ? Math.sign((across.rect[1] + across.rect[3]) / 2 - cz) : (R() < .5 ? -1 : 1);
      tips.set(s, toward);
      if (across) { variants.set(across, 'ladder'); ladderSide.set(across, { side: -toward, x: Math.max(across.rect[0] + .6, Math.min(across.rect[2] - .6, cx + (R() - .5))) }); }
    }
    for (const s of run.solids.filter(s => s.floor === f)) {
      const [a, b, c, d] = s.rect, x = (a + c) / 2, z = (b + d) / 2, along = s.axis === 'x', length = along ? c - a : d - b;
      if (s.kind === 'shelf') {
        const height = s.tall ? 3.8 : 3.3, variant = variants.get(s), h = along ? 0 : Math.PI / 2, top = variant === 'low' ? 1.3 : height;
        cases.push({ x, z, h, length, height: top, variant, fill: styles.get(s.room).fill, room: s.room, tip: tips.get(s) });
        // A rolling ladder leans on one face.
        if (variant === 'ladder') { const pin = ladderSide.get(s), t = pin ? pin.x - x : (R() - .5) * (length - 1), side = pin ? pin.side : R() < .5 ? -1 : 1, lad = libraryLadder({ height: Math.min(3.3, height - .1) }); place(statics, lad, along ? x + t : x + side * .95, 0, along ? z + side * .95 : z + t, along ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2)); }
        // Webs: fans at the ends up to the ceiling, in the corners of the arches.
        for (const end of [-1, 1]) if (R() < .5) webs.push({ x: along ? (end < 0 ? a + .05 : c - .05) : x - end * .4, y: WEB_TOP, z: along ? z + end * .4 : (end < 0 ? b + .05 : d - .05), h: along ? end * -Math.PI / 2 : (end < 0 ? 0 : Math.PI), size: Math.min(1.4, WEB_TOP - top + .5), tilt: (R() - .5) * .3 });
        if (variant === 'arched' || variant === 'pillar') for (const face of [-1, 1]) for (let k = 0; k < 2; k++) if (R() < .5) {
          const inner = variant === 'pillar' ? length - 1.04 : length, bays = Math.max(1, Math.round(inner / .95)), bayW = (inner - .1) / bays, bay = Math.floor(R() * bays), right = R() < .5;
          const u = -inner / 2 + .05 + (bay + (right ? 1 : 0)) * bayW + (right ? -.04 : .04), wy = top - .2, fz = face * .41;
          webs.push({ x: along ? x + u : x + fz, y: wy, z: along ? z + fz : z - u, h: h + (right ? Math.PI : 0), size: .35 + R() * .35, tilt: 0 });
        }
        // Somebody left a candle burning on the floor here and there.
        if (along && R() < .16) { const sx = a + .3 + R() * (c - a - .6), sz = z + (R() < .5 ? -1 : 1) * .55, stick = candleStick({ seed: (sx * 7) | 0 }); flamesOf(stick, sx, 0, sz); place(statics, stick, sx, 0, sz, R() * 6); }
        if (variant === 'collapsed' && misty.has(s.room)) mist.push({ x, z, w: length + 2, d: 4 });
      }
      if (s.kind === 'table') {
        place(statics, readingTable({ length: c - a - .2, width: d - b, seed: (x * 3) | 0 }), x, 0, z, 0);
        if (R() < .4) { const stick = candleStick({ seed: x | 0 }), sz = z + (R() - .5) * .4, sx = x + (R() < .5 ? -1.4 : 1.1); flamesOf(stick, sx, .855, sz); place(statics, stick, sx, .855, sz); }
        // A ripped web hanging off a corner of the table.
        if (R() < .7) webs.push({ type: 'drape', x: a + .15, y: .86, z, w: .9, size: .7, h: Math.PI / 2 });
      }
      if (s.kind === 'desk' && !deskSpots.has(`${x.toFixed(2)},${z.toFixed(2)}`)) place(statics, scribeDesk({ seed: (x * 5 + z) | 0 }), x, 0, z, s.h || 0);
    }
    // Wall cases: single-sided, backs to the bricks, never across an opening,
    // a seal, a dart lane, the cargo lift or a hiding spot against the wall.
    const openings = [...run.corridors, ...run.stubs].filter(c => c.floor === f).map(c => c.rect);
    for (const room of rooms) {
      const [x0, z0, x1, z1] = room.rect, st = styles.get(room.id);
      const walls = [
        { along: 'x', fixed: z0, into: 1, from: x0, to: x1 }, { along: 'x', fixed: z1, into: -1, from: x0, to: x1 },
        { along: 'z', fixed: x0, into: 1, from: z0, to: z1 }, { along: 'z', fixed: x1, into: -1, from: z0, to: z1 },
      ];
      let windows = room.kind === 'lectura' ? 2 : 0;
      for (const w of walls) {
        let spans = [[w.from + 1.9, w.to - 1.9]];
        const cut = (a, b) => { spans = spans.flatMap(([p, q]) => [[p, Math.min(q, a)], [Math.max(p, b), q]]).filter(([p, q]) => q - p >= 1.6); };
        for (const o of openings) {
          const near = w.along === 'x' ? o[1] - .8 < w.fixed && o[3] + .8 > w.fixed : o[0] - .8 < w.fixed && o[2] + .8 > w.fixed;
          if (near) { if (w.along === 'x') cut(o[0] - .6, o[2] + .6); else cut(o[1] - .6, o[3] + .6); }
        }
        for (const q of run.seals.filter(q => q.room === room.id)) if (w.along === 'x') cut(q.x - 3.4, q.x + 3.4);
        for (const p of run.plates.filter(p => p.room === room.id)) if (w.along === 'z') cut(p.z - 1.2, p.z + 1.2);
        for (const n of run.nooks.filter(n => n.room === room.id)) { const near = w.along === 'x' ? Math.abs(n.z - w.fixed) < 1.6 : Math.abs(n.x - w.fixed) < 1.6; if (near) { if (w.along === 'x') cut(n.rect[0] - .3, n.rect[2] + .3); else cut(n.rect[1] - .3, n.rect[3] + .3); } }
        for (const pad of run.cargo.filter(c => c.floor === f && inRect(c.x, c.z, room.rect))) { if (w.along === 'x') cut(pad.x - 2.4, pad.x + 2.4); else cut(pad.z - 2.4, pad.z + 2.4); }
        for (const sp of run.spots.filter(sp => sp.room === room.id && (sp.wall || sp.kind === 'lantern'))) {
          const near = w.along === 'x' ? Math.abs(sp.z - w.fixed) < 1.6 : Math.abs(sp.x - w.fixed) < 1.6, half = (sp.len || 1) / 2 + .3;
          if (near) { if (w.along === 'x') cut(sp.x - half, sp.x + half); else cut(sp.z - half, sp.z + half); }
        }
        // The reading hall's tall windows take the middle of a long stretch.
        if (windows && w.along === 'x') {
          const longest = spans.reduce((best, sp) => sp[1] - sp[0] > (best ? best[1] - best[0] : 0) ? sp : best, null);
          if (longest && longest[1] - longest[0] >= 4.4) {
            const mid = (longest[0] + longest[1]) / 2, pane = tallWindow({ width: 1.5, height: 2.6, seed: (mid * 3) | 0 });
            place(root, pane, mid, 0, w.fixed + w.into * .08, w.into > 0 ? 0 : Math.PI); cut(mid - 1.2, mid + 1.2); windows--;
            webs.push({ type: 'drape', x: mid + .4, y: WEB_TOP, z: w.fixed + w.into * .5, w: 1.1, size: 1.6, h: w.into > 0 ? 0 : Math.PI });
          }
        }
        for (const [p, q] of spans) for (let a = p; a < q - 1.2;) {
          const len = Math.min(q - a, 2.4 + R() * 1.2), mid = a + len / 2, off = w.fixed + w.into * .23, height = 3.2 + R() * .7;
          const pick = R() < .68 ? st.main : ['arched', 'plain', 'pillar'][Math.floor(R() * 3)], variant = pick === 'pillar' && len < 2.6 ? 'arched' : pick;
          cases.push(w.along === 'x' ? { x: mid, z: off, h: w.into > 0 ? 0 : Math.PI, length: len, height, double: false, variant, fill: st.fill, room: room.id, pillarHeight: HEIGHT } : { x: off, z: mid, h: w.into > 0 ? Math.PI / 2 : -Math.PI / 2, length: len, height, double: false, variant, fill: st.fill, room: room.id, pillarHeight: HEIGHT });
          // Webs in the corners of the arches of a wall case.
          if (variant === 'arched' || variant === 'pillar') for (let k = 0; k < 2; k++) if (R() < .5) {
            const inner = variant === 'pillar' ? len - 1.04 : len, bays = Math.max(1, Math.round(inner / .95)), bayW = (inner - .1) / bays, right = R() < .5, u = -inner / 2 + .05 + (Math.floor(R() * bays) + (right ? 1 : 0)) * bayW + (right ? -.04 : .04), front = w.fixed + w.into * .45;
            const along = w.along === 'x', sx = along ? (w.into > 0 ? u : -u) : 0, sz = along ? 0 : (w.into > 0 ? -u : u);
            webs.push({ x: along ? mid + sx : front, y: height - .2, z: along ? front : mid + sz, h: (along ? (w.into > 0 ? 0 : Math.PI) : (w.into > 0 ? Math.PI / 2 : -Math.PI / 2)) + (right ? Math.PI : 0), size: .35 + R() * .35, tilt: 0 });
          }
          // Piles of books against the wall cases; now and then a candle on one.
          if (R() < .35) { const t = a + .4 + R() * (len - .8); piles.push({ x: w.along === 'x' ? t : off + w.into * .5, z: w.along === 'x' ? off + w.into * .5 : t, h: R() * 3, n: 3 + Math.floor(R() * 8), candle: R() < .3 }); }
          a += len + .15;
        }
      }
      // Webs: fans in the ceiling corners, sheets sagging under the ceiling and
      // across the aisles, strands hanging down in the open.
      for (const [cx, cz, ax, az] of [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]]) { R(); webs.push(cornerWeb(cx, cz, ax, az, WEB_TOP, 1.1 + R() * 1.1, R)); }
      for (let i = 0; i < Math.min(3, 1 + Math.floor(room.w * room.d / 150)); i++) webs.push({ type: 'sheet', x: room.x + (R() - .5) * (room.w - 4), y: WEB_TOP + .1, z: room.z + (R() - .5) * (room.d - 4), w: 2.5 + R() * 3, d: 1.8 + R() * 2, sag: .4 + R() * .5, h: R() * 3 });
      if (room.kind === 'estanterias') for (const aisle of [-4.5, -1.5, 1.5, 4.5]) for (const sx of [-1, 1]) if (R() < .45) webs.push({ type: 'sheet', x: room.x + sx * (3.5 + R() * 3), y: 3.62, z: room.z + aisle, w: 1.6 + R() * 1.8, d: 3, sag: .45 + R() * .3, h: 0 });
      for (let i = 0; i < 3 + Math.floor(room.w * room.d / 90); i++) webs.push({ type: 'drape', x: room.x + (R() - .5) * (room.w - 3), y: WEB_TOP + .1, z: room.z + (R() - .5) * (room.d - 3), w: .5 + R() * .9, size: 1.2 + R() * 1.1, h: R() * 3 });
      // Light: a chandelier in the big rooms (most still lit), a lantern over
      // the stacks' nave. Small flames only, never a lamp of their own.
      if (room.w >= 16 && !run.decor.some(d => d.kind === 'chandelier' && d.room === room.id)) {
        const stacks = room.kind === 'estanterias', lamp = chandelier({ ceiling: HEIGHT, drop: 1.4, seed: room.x | 0, lit: R() < .7 }), lx = room.x + (stacks ? 0 : (R() - .5) * 2), lz = room.z + (stacks ? (R() < .5 ? -1.5 : 1.5) : (R() - .5) * 2);
        flamesOf(lamp, lx, 0, lz); place(statics, lamp, lx, 0, lz, R() * 3); floor.chandeliers.push({ x: lx, z: lz });
        webs.push({ type: 'drape', x: lx + .3, y: WEB_TOP + .1, z: lz, w: 1, size: 1.5, h: R() * 3 });
      }
      if (room.kind === 'estanterias') for (const sz of [-1, 1]) if (R() < .6) { const lamp = hangingLantern({ ceiling: HEIGHT, drop: 1.3 + R() * .4 }), lz = room.z + sz * (4.5 + R() * 2); flamesOf(lamp, room.x, 0, lz); place(statics, lamp, room.x, 0, lz); }
      // Rugs: worn and faded, in the reading hall, the entrance and some crossings.
      const rugColor = () => [0x4a5468, 0x5a3a42, 0x4e4a40][Math.floor(R() * 3)];
      if (room.kind === 'lectura') { rugList.push({ x: room.x, z: room.z, w: 2.6, d: room.d - 5, color: rugColor() }); rugList.push({ x: room.x + (R() < .5 ? -1 : 1) * 5, z: room.z, w: 3.4, d: 2.2, h: R() * .2, color: rugColor() }); }
      else if (room.kind === 'entrada' || (room.kind === 'estanterias' && R() < .6) || R() < .3) rugList.push({ x: room.x + (room.kind === 'estanterias' ? 0 : (R() - .5) * 4), z: room.z + (room.kind === 'estanterias' ? 0 : (R() - .5) * 4), w: 2.2 + R(), d: 3 + R() * 1.4, h: room.kind === 'estanterias' ? 0 : R() * .4, color: rugColor() });
      // The reading hall: worn armchairs by the walls, low mist over the floor.
      if (room.kind === 'lectura') for (const sd of [-1, 1]) {
        const ax = room.x + sd * (room.w / 2 - 1.5), az = room.z + (R() - .5) * 3;
        if (run.obstacles.some(o => o.floor === f && Math.hypot(o.x - ax, o.z - az) < o.r + 1) || run.solids.some(q => q.floor === f && inRect(ax, az, q.rect, .8)) || openings.some(o => inRect(ax, az, o, 1.5))) continue;
        place(statics, armchair({ seed: (ax * 3) | 0 }), ax, 0, az, sd > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
      if (misty.has(room.id) && room.kind !== 'estanterias') for (const [u, v] of [[-.28, -.25], [.28, -.25], [-.28, .25], [.28, .25], [0, 0]]) mist.push({ x: room.x + u * room.w, z: room.z + v * room.d, w: room.w * .5, d: room.d * .5 });
    }
    // Corridors: webs up high, a sheet across, a lantern, torn curtains at the ends.
    for (const c of run.corridors.filter(c => c.floor === f)) {
      const [x0, z0, x1, z1] = c.rect;
      if (R() < .9) { const t = .3 + R() * .4; webs.push(c.horizontal ? cornerWeb(x0 + (x1 - x0) * t, z0, 0, 1, WEB_TOP, 1.3, R, 1) : cornerWeb(x0, z0 + (z1 - z0) * t, 1, 0, WEB_TOP, 1.3, R, 1)); }
      if (R() < .7) webs.push({ type: 'sheet', x: (x0 + x1) / 2, y: WEB_TOP + .1, z: (z0 + z1) / 2, w: c.horizontal ? 2.5 : 4, d: c.horizontal ? 4 : 2.5, sag: .5 + R() * .4 });
      if (R() < .5) { const lamp = hangingLantern({ ceiling: HEIGHT, drop: 1.4 }), lx = (x0 + x1) / 2, lz = (z0 + z1) / 2; flamesOf(lamp, lx, 0, lz); place(statics, lamp, lx, 0, lz); }
      if (c.hidden) continue;
      for (const end of [0, 1]) if (R() < .5) {
        const side = R() < .5 ? -1 : 1, curtain = tornCurtain({ width: 1.2, height: 3.7, seed: (x0 * 3 + z0 + end * 7) | 0, color: R() < .6 ? 0x3a2e34 : 0x2e3238 });
        if (c.horizontal) place(root, curtain, end ? x1 - .7 : x0 + .7, 0, side < 0 ? z0 + .2 : z1 - .2, 0);
        else place(root, curtain, side < 0 ? x0 + .2 : x1 - .2, 0, end ? z1 - .7 : z0 + .7, Math.PI / 2);
      }
    }
    // The secret room hides behind a bookcase that swings open into its passage.
    for (const hid of run.hidden.filter(h => h.floor === f)) {
      const corridor = run.corridors.find(c => c.id === hid.corridor), room = run.rooms.find(r => r.floor === f && r.id !== hid.room && (r.id === corridor?.a || r.id === corridor?.b));
      if (!room) continue;
      const [x0, z0, x1, z1] = room.rect, gaps = [Math.abs(hid.x - x1), Math.abs(hid.x - x0), Math.abs(hid.z - z0), Math.abs(hid.z - z1)], min = Math.min(...gaps);
      const face = [{ x: -1, z: 0, at: [x1, hid.z] }, { x: 1, z: 0, at: [x0, hid.z] }, { x: 0, z: 1, at: [hid.x, z0] }, { x: 0, z: -1, at: [hid.x, z1] }][gaps.indexOf(min)];
      const door = bookcaseDoor({ width: 4, height: 3.7, seed: hid.x | 0 });
      place(root, door, face.at[0] + face.x * .22, 0, face.at[1] + face.z * .22, Math.atan2(face.x, face.z));
      floor.doors.push({ id: hid.id, door, open: 0 });
    }
    // The hiding spots: searched ones stay open (drawers out, sheets off, doors ajar).
    for (const sp of run.spots.filter(sp => sp.floor === f)) {
      const model = spotModel(sp); if (!model) continue;
      place(root, model, sp.x, 0, sp.z, sp.h);
      floor.spots.set(sp.id, { model, t: 0, x: sp.x, z: sp.z });
      if ((sp.kind === 'debris' || sp.kind === 'trunk' || sp.kind === 'sheet') && R() < .4) webs.push({ x: sp.x - Math.cos(sp.h) * .45, y: 1, z: sp.z + Math.sin(sp.h) * .45, h: sp.h + Math.PI / 2, size: .55, tilt: .5 });
    }
    // One set of instanced cases per room, so the rooms out of view are culled.
    for (const room of new Set(cases.map(c => c.room))) root.add(bookcases(cases.filter(c => c.room === room), { seed: seed + root.children.length }));
    floor.cases = cases;
    if (piles.length) { const books = bookPiles(piles, { seed }); root.add(books); books.userData.tops.forEach((top, i) => { if (!piles[i].candle) return; const stick = candleStick({ seed: i }); flamesOf(stick, top.x, top.y, top.z); place(statics, stick, top.x, top.y, top.z); }); }
    if (webs.length) { floor.webs = cobwebs(webs); root.add(floor.webs); }
    if (rugList.length) root.add(rugs(rugList));
    if (mist.length) { floor.mist = groundMist(mist); root.add(floor.mist); }
  }
  function spotModel(sp) {
    const seed = (sp.x * 7 + sp.z * 3) | 0;
    switch (sp.kind) {
      case 'trunk': return travelTrunk({ seed });
      case 'drawer': return writingDesk({ seed });
      case 'sheet': return drapedFurniture({ seed, width: 1.1, height: 1.05, depth: .95 });
      case 'wardrobe': return oldWardrobe({ seed });
      case 'debris': return bookHeap({ seed });
      case 'shelf': return rollingShelf({ seed, length: sp.len || 2.6 });
      case 'ladder': return rollingLadder({ length: sp.len || 2.2 });
      case 'lantern': return oldLantern({ seed });
      default: return null;
    }
  }
  // A web card across the corner between two walls running along ax and az
  // from (x, z); with `flat`, one web along a single wall (ax or az).
  function cornerWeb(x, z, ax, az, top, size, R, flat) {
    const p1 = flat ? { x, z } : { x: x + ax * size * .7, z }, p2 = flat ? { x: x + ax * size, z: z + az * size } : { x, z: z + az * size * .7 };
    const dx = p2.x - p1.x, dz = p2.z - p1.z, len = Math.hypot(dx, dz) || 1, h = Math.atan2(-dz, dx);
    if (flat) return { x: p1.x + az * .02, y: top, z: p1.z + ax * .02, h, size: len, tilt: 0 };
    const n = { x: Math.sin(h), z: Math.cos(h) }, toCorner = (x - (p1.x + p2.x) / 2) * n.x + (z - (p1.z + p2.z) / 2) * n.z;
    return { x: p1.x, y: top, z: p1.z, h, size: len, tilt: (toCorner < 0 ? 1 : -1) * (.5 + R() * .25) };
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
  const itemRoot = new THREE.Group(); itemRoot.name = 'Botín'; group.add(itemRoot); // i18n-ignore: scene graph name
  const items = new Map();
  function syncItems(state, viewer) {
    const seen = new Set(), vf = viewer ? floorOf(viewer.x) : 0;
    for (const item of visibleItems(state)) {
      if (item.state === 'big' && false) continue;
      seen.add(item.id);
      let shown = items.get(item.id);
      if (!shown) {
        const model = itemModel(item.kind), aura = new THREE.Sprite(haloMaterial(glowColor(item.kind)));
        const size = ITEMS[item.kind].size; aura.scale.setScalar(ITEMS[item.kind].halo || (size === 'big' ? 3.2 : 1.1)); aura.position.y = size === 'big' ? ITEMS[item.kind].halo ? .35 : 1 : .35;
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

  // Cave-ins: a heap per fallen tunnel, breaking as the shared hold fills. Everyone
  // sees the same breaking because it only ever reads state.rubble; the code for it
  // loads with the first cave-in, and until then the heap just stands there.
  const rubbleRoot = new THREE.Group(); rubbleRoot.name = 'Derrumbes'; group.add(rubbleRoot);
  const heaps = new Map(), rubbleMaterials = new Map();
  let rockCracks = null, rockLoad = null;
  // The shared stone bleaches to white under a headlamp; a fallen heap is dark and dusty.
  const dusty = source => { if (!rubbleMaterials.has(source)) { const m = source.clone(); m.color.multiplyScalar(RUBBLE_TINT); rubbleMaterials.set(source, m); owned.add(m); } return rubbleMaterials.get(source); };
  function addHeap(id) {
    const c = run.corridors.find(c => c.id === id); if (!c) return null;
    const pile = ruinRubble({ seed: c.rect[0] | 0, count: 14, spread: 2.2 });
    pile.traverse(o => { if (o.material) o.material = dusty(o.material); });
    const x = (c.rect[0] + c.rect[2]) / 2, z = (c.rect[1] + c.rect[3]) / 2;
    pile.position.set(x, 0, z); pile.scale.set(1.4, 2.2, 1.4); rubbleRoot.add(pile);
    // Seen from the two ends of its tunnel: the sides of the heap are in the rock.
    return { pile, crack: null, x, z, faces: c.horizontal ? [0, Math.PI] : [Math.PI / 2, -Math.PI / 2], faceWidth: (c.horizontal ? c.rect[3] - c.rect[1] : c.rect[2] - c.rect[0]) / 2, floor: c.floor, seed: (c.rect[0] * 7 + c.rect[1] * 3) | 0 };
  }
  const rockEvent = e => onFx?.(e), rockDust = (x, y, z, strength) => onFx?.({ type: 'dust', x, y, z, strength });
  function dropHeap(heap) { if (heap.crack) heap.crack.dispose(); else heap.pile.removeFromParent(); heap.pile.traverse(o => o.geometry?.dispose()); }
  function syncRubble(state, dt, viewer) {
    const live = state.rubble || {}, ids = Object.keys(live), vf = viewer ? floorOf(viewer.x) : -1;
    if (ids.length && !rockLoad) rockLoad = import('/engine/fx/rock-crack.js').then(m => { rockCracks = m; }).catch(() => {});
    for (const id of ids) {
      let heap = heaps.get(id);
      if (!heap) { heap = addHeap(id); if (!heap) continue; heaps.set(id, heap); }
      if (rockCracks && !heap.crack) heap.crack = rockCracks.createRockCrack({ rock: heap.pile, seed: heap.seed, faces: heap.faces, faceWidth: heap.faceWidth, quality: getSettings().detail, motion: calm ? 0 : 1, chipColor: RUBBLE_CHIP, onEvent: rockEvent, dust: rockDust });
      // Only what you can see throws chips and makes a noise; the cracks grow anyway.
      const seen = !viewer || (heap.floor === vf && Math.hypot(heap.x - viewer.x, heap.z - viewer.z) < ROCK_FX);
      heap.crack?.setProgress(live[id] / RUBBLE_HOLD, { viewer, silent: !seen });
      heap.seen = seen;
    }
    for (const [id, heap] of heaps) {
      const gone = !(id in live);
      if (gone && !heap.crack) { dropHeap(heap); heaps.delete(id); continue; }
      if (gone && !heap.crack.broken) heap.crack.break({ silent: !heap.seen });
      heap.crack?.update(dt);
      if (gone && heap.crack.done) { dropHeap(heap); heaps.delete(id); }
    }
  }

  const tickFires = (fires, t, dt, viewer) => {
    for (const f of fires) {
      const distance = viewer ? Math.hypot(f.x - viewer.x, f.z - viewer.z) : 0;
      f.fire.group.visible = distance < FIRE_DRAW;
      if (f.fire.group.visible || f.fire.flare > 0) f.fire.update(dt, t, { distance });
    }
  };
  const allFires = () => [...campFires, ...[...floorsBuilt.values()].flatMap(floor => floor.fires)];
  function update(t, state = {}, dt = .016, viewer = null) {
    tickWind(t, .8);
    for (const a of animated) a.userData.tick?.(t, dt);
    if (getSettings().detail !== fireDetail) { fireDetail = getSettings().detail; for (const f of allFires()) f.fire.setQuality(fireDetail); }
    if (!viewer || floorOf(viewer.x) === 0) tickFires(campFires, t, dt, viewer);
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
      for (const d of floor.doors) { d.open = THREE.MathUtils.damp(d.open, revealedNow[d.id] ? 1 : 0, 1.6, dt); d.door.userData.hinge.rotation.y = d.open * 1.45; }
      if (floor.flames) floor.flames.userData.tick(t);
      if (floor.root.visible) tickFires(floor.fires, t, dt, viewer);
      if (floor.mushroomHalos) floor.mushroomHalos.material.opacity = .6 + Math.sin(t * .9 + f) * .12;
      floor.webs?.userData.tick(t); floor.mist?.userData.tick(t);
      if (floor.water) { floor.waterLevel = THREE.MathUtils.damp(floor.waterLevel, state.suceso?.kind === 'creciente' ? .68 : .13, .8, dt); floor.water.userData.level(floor.waterLevel); floor.water.userData.tick(t); }
      for (const pool of floor.pools || []) pool.userData.tick(t);
      for (const [id, bridge] of floor.spans) bridge.visible = !!state.strung?.[id];
      for (const [id, rope] of floor.ropes) rope.visible = !run.ropes.find(r => r.id === id).needs || !!state.strung?.[id];
      for (const { q, wall, plate } of floor.twins) plate.userData.glyph.material.emissiveIntensity = state.revealed?.[wall] || (state.players && onPlate(state, q)) ? 2 : .25 + Math.sin(t * 2) * .12;
      // Searched spots open (and stay open); far ones are not drawn.
      for (const [id, sp] of floor.spots) {
        const want = state.spots?.[id] ? 1 : 0;
        if (sp.t !== want) { sp.t = Math.abs(want - sp.t) < .01 ? want : THREE.MathUtils.damp(sp.t, want, 3.2, dt); sp.model.userData.open(sp.t); }
        sp.model.visible = !viewer || Math.abs(sp.x - viewer.x) + Math.abs(sp.z - viewer.z) < 26;
      }
      for (const { id, plate } of floor.plates) plate.userData.glyph.material.emissiveIntensity = (state.plates?.[id] || 0) > (state.time || 0) ? 1.4 : .15 + Math.sin(t * 3 + id) * .1;
    }
    const ride = liftView(state.lift), at = run.lifts.find(l => l.floor === ride.floor);
    if (at) { cage.position.set(at.x, ride.y, at.z); cage.rotation.y = at.h; }
    cage.visible = !viewer || floorOf(viewer.x) === ride.floor;
    syncRubble(state, dt, viewer);
    syncItems(state, viewer);
    for (const shown of items.values()) if (shown.root.visible && shown.state === 'ground' && ITEMS[shown.kind].size !== 'big') { shown.spin += dt; shown.aura.material.opacity = .4 + Math.sin(shown.spin * 3) * .15; }
    syncTruck(state);
    truckRing.material.opacity = .45 + Math.sin(t * 3) * .15;
  }
  function dispose() {
    for (const f of allFires()) f.fire.dispose();
    for (const heap of heaps.values()) dropHeap(heap);
    const geometries = new Set(), materials = new Set();
    group.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) materials.add(m); o.userData.dispose?.(); });
    geometries.forEach(g => g.dispose());
    owned.forEach(m => m.dispose?.()); haloMaterials.forEach(m => m.dispose()); halo.dispose();
    materials.forEach(m => { if (m.map && m.map !== halo) m.map.dispose?.(); });
  }
  // The candles' shader inputs, from the view: fog, a global level (lights
  // dying in a scare) and a blow-out around a point.
  function candles({ level = 1, out = null, near = 4, far = 24 } = {}) {
    for (const floor of floorsBuilt.values()) {
      for (const f of floor.fires) f.fire.setLevel(level);
      const u = floor.flames?.userData; if (!u) continue;
      u.level(level); u.fog(near, far);
      if (out) u.blowOut(out.x, out.z, out.r, out.amount); else u.blowOut(0, 0, 1, 0);
    }
  }
  // The fire burning at a point, for the view's light pool.
  const fireAt = (f, x, z) => (f === 0 ? campFires : floorsBuilt.get(f)?.fires || []).find(q => Math.abs(q.x - x) < 1 && Math.abs(q.z - z) < 1)?.fire || null;
  // Something feeds the fires on a floor (the near ones, when `at` and `within` are given).
  const feedFires = (f, strength = 1, at = null, within = 18) => { for (const q of f === 0 ? campFires : floorsBuilt.get(f)?.fires || []) if (!at || Math.hypot(q.x - at.x, q.z - at.z) < within) q.fire.feed(strength); };
  // How close the nearest burning fire is, 0..1 inside `range` metres: for its roar.
  const fireNear = (x, z, f, range = 9) => { let best = 0; for (const q of f === 0 ? campFires : floorsBuilt.get(f)?.fires || []) { const k = 1 - Math.hypot(q.x - x, q.z - z) / range; if (k > best) best = k * q.fire.level; } return best; };
  return { group, update, dispose, buildFloor, candles, fireAt, feedFires, fireNear, heaps, campLamps: cave.userData.lamps, floors: floorsBuilt, items, layout: L, run, bounds: new THREE.Box3(new THREE.Vector3(-40, -8, -140), new THREE.Vector3(floors * L.SPACING + 60, 20, 40)) };
}
