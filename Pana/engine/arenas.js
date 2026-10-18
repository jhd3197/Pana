import * as THREE from 'three';
import { arenaInfo, tableArenaInfo, courtArenaInfo, arenaLayout, outsideTable } from './arena-layouts.js';
import { createEstadioEnvironment } from './estadio.js';
import { createPuertoTableEnvironment } from './puerto-tables.js';
import { createPlazaEnvironment } from './plaza.js';
import { createPlazaProp, crate, marketStall } from './models/props/plaza.js';
import { propDefinition } from './models/props/plaza-definitions.js';
import { beachHut } from './models/props/beach.js';
import { fishingBoat, coastalLighthouse, fishingNetRack } from './models/props/coastal.js';
import { llaneroRanchHouse, horseStable, waterWindmill, ranchFence, hayBale, feedingTrough, oldTractor } from './models/props/ranch.js';
import { templeEntrance, vineArch, stoneTotem } from './models/props/jungle.js';
import { palm } from './models/vegetation/palm.js';
import { mangoTree } from './models/vegetation/mango-tree.js';
import { bamboo } from './models/vegetation/bamboo.js';
import { fern } from './models/vegetation/fern.js';
import { bake } from './models/core/static-batch.js';
import { disposeModel } from './models/props/game-table.js';
import { waterSurface, sampleWaterWave } from './models/effects/water-surface.js';
import { createAmbientLife } from './ambient-life.js';

// Where background life may move on each map (see ambient-life.js): a kart
// lane, strolling paths and a patch of sky, all outside every mode's play area.
const LIFE = {
  plaza: { lane: [[-34, -19.4], [34, -19.4]], walks: [[[-22.4, -15], [-22.4, 18.4], [22.4, 18.4], [22.4, -15]], [[22.4, 18.4], [-22.4, 18.4], [-22.4, -15]], [[22.4, 6], [22.4, -14]]], sky: { x: 0, z: -6, radius: 17, height: 15 } },
  estadio: { lane: [[22.3, -75], [22.3, 75]], walks: [[[-13, -20], [-13, 24], [8, 24]], [[8, 24], [-13, 24], [-13, -16]]], sky: { x: -6, z: -10, radius: 20, height: 18 } },
  arena: { lane: [[20.6, -40], [20.6, 40]], walks: [[[-20.4, -16], [-20.4, 20.4], [16, 20.4]], [[16, 20.4], [-20.4, 20.4], [-20.4, -12]]], sky: { x: 0, z: 0, radius: 19, height: 16 } },
};

const palettes = {
  puerto: { ground: '#dfc79b', court: '#ecd7ae', trim: '#3b9298', sky: '#badde5', stone: '#a77b51' },
  hato: { ground: '#94a35e', court: '#d5b47d', trim: '#a76342', sky: '#dce3c2', stone: '#c6a057' },
  ruinas: { ground: '#617d52', court: '#a6ad83', trim: '#47756a', sky: '#c0d6cc', stone: '#858c76' },
};

// A Bolas Criollas court (11 × 24 m, long axis Z) with its benches, calce and
// the thrower's camera: everything inside this rectangle stays clear.
export const COURT_CLEAR = { x: 8.8, z: 17 };
const outsideCourt = (x, z, r = 0) => Math.abs(x) - r > COURT_CLEAR.x || Math.abs(z) - r > COURT_CLEAR.z;

// One world, four uses: hide-and-seek props, paintball cover, a clear table
// courtyard, or an open court. All solid cover is built from the same bounds as the pure rules.
const infoFor = mode => mode === 'table' ? tableArenaInfo : mode === 'court' ? courtArenaInfo : arenaInfo;
export function createArenaEnvironment(id = 'plaza', { mode = 'hunt', props } = {}) {
  id = infoFor(mode)(id).id;
  if(id==='guipuzcoana'||id==='san-carlos')return createPuertoTableEnvironment(id);
  if (id === 'estadio') return createEstadioEnvironment();
  if (id === 'plaza') {
    const model = createPlazaEnvironment({ ...(mode === 'table' ? { cooking: true, clearance: (x, z, r = 0) => Math.hypot(x, z) - r > 10 } : {}),
      ...(mode === 'court' ? { fountain: false, clearance: outsideCourt, openFloor: { x: 6.1, z: 12.6 } } : {}), ...(props ? { mapProps: props } : {}) });
    return { ...model, id, dispose() { model.group.traverse(o => o.userData.dispose?.()); disposeModel(model.group); } };
  }
  const layout = arenaLayout(id), palette = palettes[id], group = new THREE.Group(), statics = new THREE.Group(), animated = [], cameraBounds = [];
  group.name = arenaInfo(id).name; group.userData.mapId = id; group.userData.mode = mode;
  const placements = [], materials = new Map();
  const material = color => { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: .88 })); return materials.get(color); };
  function box(w, h, d, color, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; return m;
  }
  function place(object, x, z, { angle = 0, scale = 1, live = false, assetId = '', y = 0, perimeter = true } = {}) {
    object.position.set(x, y, z); object.rotation.y = angle; object.scale.setScalar(scale); object.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(object);
    // Model origins are not their footprints (the temple includes deep stairs).
    // Keep the whole perimeter model beyond the court and the follow camera.
    if (perimeter && bounds.min.x < 22 && bounds.max.x > -22 && bounds.min.z < 22 && bounds.max.z > -22) {
      const axis = Math.abs(x) > Math.abs(z) ? 'x' : 'z', side = axis === 'x' ? x : z;
      object.position[axis] += side >= 0 ? 22 - bounds.min[axis] : -22 - bounds.max[axis];
      object.updateMatrixWorld(true); bounds.setFromObject(object);
    }
    cameraBounds.push(bounds); placements.push({ assetId, perimeter, min: bounds.min.toArray(), max: bounds.max.toArray() });
    object.userData.assetId = assetId;
    if (live) { group.add(object); animated.push(object); } else statics.add(object);
    return object;
  }
  statics.add(box(180, .3, 180, palette.ground, 0, -.25, id === 'puerto' ? 66 : 0));
  statics.add(box(37.2, .12, 37.2, palette.court, 0, -.07));
  // A low continuous curb makes the play boundary visible from every camera.
  for (const side of [-1, 1]) {
    statics.add(box(37.2, .32, .3, palette.trim, 0, .08, side * 18.55));
    statics.add(box(.3, .32, 37.2, palette.trim, side * 18.55, .08));
  }
  if (id === 'puerto') {
    const sea = waterSurface(new THREE.PlaneGeometry(300, 260, 80, 70).rotateX(-Math.PI / 2), { kind: 'sea', amplitude: .08, color: '#419baf' });
    sea.position.set(0, -.25, -154); group.add(sea); animated.push(sea);
    statics.add(box(52, .5, 7, '#a07b54', 0, -.2, -23));
    for (let x = -25; x <= 25; x += 1) statics.add(box(.035, .015, 7, '#73583d', x, .06, -23));
    for (const x of [-23, -12, 0, 12, 23]) statics.add(box(.35, 2.1, .35, '#846348', x, .55, -26));
    place(coastalLighthouse(), 21, -31, { scale: 1.2, assetId: 'coastal-lighthouse' });
    for (const [x, z, angle] of [[-13, -30, .2], [5, -31, -.3]]) {
      const boat = place(fishingBoat(), x, z, { angle, live: true, assetId: 'fishing-boat', y: -.25 });
      boat.userData.tick = t => { const wave = sampleWaterWave(x, z, t, .08); boat.position.y = -.25 + wave.y; boat.rotation.set(wave.pitch, angle, wave.roll); };
    }
    for (const side of [-1, 1]) {
      place(beachHut(), side * 24, -11, { angle: -side * Math.PI / 2, scale: 1.5, assetId: 'beachHut' });
      place(marketStall({ seed: side + 4, colors: [0x3b9298, 0xf2d292] }), side * 23, 4, { angle: -side * Math.PI / 2, assetId: 'market-stall' });
      place(fishingNetRack(), side * 22, 13, { assetId: 'fishing-net-rack' });
      for (const [i, z] of [-17, -1, 18].entries()) place(palm({ h: 7 + i, seed: i + 7 }), side * 27, z, { assetId: 'palm' });
    }
  } else if (id === 'hato') {
    place(llaneroRanchHouse(), -9, -25, { scale: 1.5, assetId: 'ranch-house' });
    place(horseStable(), 15, -25, { scale: 1.3, assetId: 'horse-stable' });
    place(waterWindmill({ height: 12 }), -23, -13, { live: true, assetId: 'water-windmill' });
    place(oldTractor(), 23, 6, { angle: -.6, assetId: 'old-tractor' });
    for (const side of [-1, 1]) {
      for (const z of [-9, 0, 9]) place(ranchFence({ span: 8 }), side * 21, z, { angle: Math.PI / 2, assetId: 'ranch-fence' });
      place(feedingTrough(), side * 23, 15, { assetId: 'feeding-trough' });
      for (const [i, z] of [-20, 0, 21].entries()) place(mangoTree({ h: 6.5, seed: i + 42 }), side * 31, z, { assetId: 'mangoTree' });
      for (const x of [6, 14]) place(hayBale(), side * x, 22, { assetId: 'hay-bale' });
    }
  } else {
    place(templeEntrance(), 0, -25, { scale: 1.55, assetId: 'temple-entrance' });
    for (const side of [-1, 1]) {
      place(vineArch(), side * 23, 0, { angle: Math.PI / 2, assetId: 'vine-arch' });
      place(stoneTotem(), side * 12, -23, { scale: 1.2, assetId: 'stone-totem' });
      for (const [i, z] of [-19, -8, 9, 20].entries()) {
        place(mangoTree({ h: 8 + i % 2, seed: i + 29 }), side * 29, z, { assetId: 'mangoTree' });
        place(bamboo({ seed: i + 12 }), side * 23, z, { assetId: 'bamboo' });
        place(fern({ seed: i + 4 }), side * 20, z + 1, { scale: 1.3, assetId: 'fern' });
      }
    }
    for (const x of [-20, -11, 11, 20]) place(fern({ seed: x + 23 }), x, 23, { scale: 2, assetId: 'fern' });
  }

  for (const o of layout.cover) {
    if (mode === 'table' && !outsideTable(o)) continue;
    if (mode === 'court' && !outsideCourt(o.x, o.z, Math.max(o.w, o.d) / 2)) continue;
    const solid = new THREE.Group(); solid.name = 'Arena cover';
    if (id === 'ruinas') {
      // Solid core fills every collision box; stone joints and moss stay inside it.
      solid.add(box(o.w, o.h, o.d, palette.stone, 0, o.h / 2));
      for (let y = .4; y < o.h; y += .55) solid.add(box(o.w, .035, o.d + .002, '#636e5e', 0, y));
      for (let row = 0; row * .55 + .12 < o.h; row++) {
        const y = row * .55 + .12, height = Math.min(.5, o.h - y);
        for (let x = -o.w / 2 + .65 + row % 2 * .6; x < o.w / 2; x += 1.25) solid.add(box(.025, height, o.d + .003, '#636e5e', x, y + height / 2));
        for (let z = -o.d / 2 + .65 + row % 2 * .6; z < o.d / 2; z += 1.25) solid.add(box(o.w + .003, height, .025, '#636e5e', 0, y + height / 2, z));
      }
      solid.add(box(o.w, .08, o.d, '#53734e', 0, o.h - .04));
    } else {
      const columns = Math.ceil(o.w / 2), rows = Math.ceil(o.d / 2);
      for (let x = 0; x < columns; x++) for (let z = 0; z < rows; z++) {
        const object = id === 'hato' ? hayBale() : crate();
        const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3()), wrapper = new THREE.Group();
        object.position.sub(bounds.min); wrapper.add(object); wrapper.scale.set(o.w / columns / size.x, o.h / size.y, o.d / rows / size.z);
        wrapper.position.set(-o.w / 2 + x * o.w / columns, 0, -o.d / 2 + z * o.d / rows); solid.add(wrapper);
      }
    }
    place(solid, o.x, o.z, { assetId: 'arena-cover', perimeter: false });
  }
  if (mode !== 'paint') for (const p of props || layout.props) {
    if (mode === 'table' && !outsideTable({ ...p, r: propDefinition(p.type).radius })) continue;
    if (mode === 'court' && !outsideCourt(p.x, p.z, propDefinition(p.type).radius)) continue;
    place(createPlazaProp(p.type), p.x, p.z, { angle: p.h, assetId: p.type, perimeter: false });
  }
  if (mode === 'table') {
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, .06, 64), material(palette.court));
    floor.position.y = -.015; floor.receiveShadow = true; statics.add(floor);
  }
  const batch = bake(statics), originalGeometry = new Set();
  statics.traverse(o => { if (o.geometry) originalGeometry.add(o.geometry); }); originalGeometry.forEach(g => g.dispose()); group.add(batch);
  // Canonical factories may cache materials. Own clones before any map is freed.
  const owned = new Map();
  group.traverse(o => { if (o.material) {
    const own = m => { if (!owned.has(m)) owned.set(m, m.clone()); return owned.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
  } });
  group.userData.placements = placements;
  let disposed = false;
  return { id, group, palette, cameraBounds, bounds: new THREE.Box3(new THREE.Vector3(-32, 0, -34), new THREE.Vector3(32, 18, 25)),
    update(t, dt) { animated.forEach(o => o.userData.tick?.(t, dt)); },
    dispose() { if (disposed) return; disposed = true; group.traverse(o => o.userData.dispose?.()); disposeModel(group); },
  };
}

// Rebuild only on a changed map ID; table/game objects and cameras stay mounted.
const ARENAS_WITH_LIFE = new Set(['puerto', 'hato', 'ruinas']);
export function createArenaSlot(scene, { mode = 'table', plazaScale = 1, props } = {}) {
  let current, life = null;
  return {
    setMap(id = 'plaza') {
      id = infoFor(mode)(id).id;
      if (current?.id === id) return;
      const next = createArenaEnvironment(id, { mode, props });
      if (id === 'plaza') next.group.scale.setScalar(plazaScale);
      life?.dispose(); current?.dispose(); current = next; scene.add(current.group); scene.userData.mapId = id;
      // Tables and courts get background life; action maps stay readable for play.
      const routes = (mode === 'table' || mode === 'court') && (LIFE[id] || (ARENAS_WITH_LIFE.has(id) ? LIFE.arena : null));
      life = routes ? createAmbientLife(routes, { seed: id.length * 31 + 7 }) : null;
      if (life) current.group.add(life.group);
    },
    get group() { return current?.group; },
    get current() { return current; },
    get life() { return life; },
    update(t, dt) { current?.update(t, dt); life?.update(t, dt); },
    dispose() { life?.dispose(); life = null; current?.dispose(); current = null; },
  };
}
