// The plot in 3D: ground, hills, fence, house, beds, crops, decorations and the
// player's pana. It only draws what plot.view() says; the rules are engine/plot/.
// Light on purpose: scenery and models bake with their colours in the vertices, crops
// are built once per kind and stage, shadows redraw only when something changed, and it renders at 30 fps.
import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { M, box, mesh } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { conucoBed, conucoBunting, conucoCrop, conucoHouse, conucoScarecrow } from '/engine/models/props/conuco.js';
import { ranchFence } from '/engine/models/props/ranch.js';
import { campfire, chinchorro } from '/engine/models/props/llano-life.js';
import { parkBench } from '/engine/models/props/pueblo.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { rng } from '/engine/random.js';

const FRAME_MS = 1000 / 30, WALK = 2.6;
const BED_SIZE = 2.2, BED_GAP = 2.75, BED_ROWS = [.9, 3.65, 6.4];
// Bed index → place: the middle of the first rows fill first, so few beds still look planned.
const BED_ORDER = [[0, 0], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1], [-1, 2], [1, 2], [0, 2]];
export const bedAt = index => { const [column, row] = BED_ORDER[index]; return { x: column * BED_GAP, z: BED_ROWS[row] }; };
const HOME = { x: 5.1, z: -1.1 };   // beside the house at every tier, clear of the porch and the beds

const DECOR = {
  banca: { build: () => bake(parkBench(), { tint: true }), at: [-4.2, 0, -.8], turn: .45 },
  espantapajaros: { build: () => conucoScarecrow(), at: [6, 0, 3.4], turn: -.4 },
  banderines: { build: () => conucoBunting({ span: 11 }), at: [0, 0, -5.2], turn: 0 },
  fogon: { build: () => campfire(), at: [-6.3, 0, 3.6], turn: 0, scale: .75 },
  chinchorro: { build: () => chinchorro(), at: [7.2, 0, -2.2], turn: -1.15, scale: .68 },
  palma: { build: () => palm({ h: 6, seed: 7, detail: 'low' }), at: [-7.4, 0, -3.8], turn: 0 },
};

function groundAndHills() {
  const g = new THREE.Group(), random = rng(21);
  const plot = mesh(new THREE.PlaneGeometry(19, 17), M(0x7fb24e, { roughness: 1 }), 0, 0, 1.2);
  plot.rotation.x = -Math.PI / 2; g.add(plot);
  const land = mesh(new THREE.CircleGeometry(95, 24), M(0x6a9f43, { roughness: 1 }), 0, -.03, 0);
  land.rotation.x = -Math.PI / 2; land.castShadow = false; g.add(land);
  const yard = mesh(new THREE.PlaneGeometry(9, 4.2), M(0xa58a5d, { roughness: 1 }), 0, .012, -.7);
  yard.rotation.x = -Math.PI / 2; g.add(yard);
  for (let i = 0; i < 26; i++) {
    const tuft = mesh(new THREE.ConeGeometry(.09 + random() * .05, .24 + random() * .16, 4), M(i % 2 ? 0x5e9a3a : 0x8fc25a, { roughness: 1 }), (random() - .5) * 18, .13, -7 + random() * 16);
    if (Math.abs(tuft.position.x) < 4.4 && tuft.position.z > -2.4) continue;   // keep the beds and the yard clean
    g.add(tuft);
  }
  for (let i = 0; i < 9; i++) {
    const size = 11 + random() * 12, height = 5 + random() * 8;
    const hill = mesh(new THREE.ConeGeometry(size, height, 7), M(i % 2 ? 0x4e8650 : 0x5b9558, { roughness: 1 }), -58 + i * 15 + random() * 5, height / 2 - .2, -38 - random() * 16);
    hill.rotation.y = random() * 3; hill.castShadow = false; hill.receiveShadow = false; g.add(hill);
  }
  return bake(g, { tint: true });
}

export function createConucoScene(canvas) {
  const world = createTableWorld(canvas, {
    fit: 'window', arena: false, fov: 38, fog: [70, 170],
    sun: { position: [-11, 20, 11], box: 15, far: 60 },
  });
  const { renderer, scene, camera } = world;
  // The shadow map redraws only when something moved.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  const dirty = () => { renderer.shadowMap.needsUpdate = true; };

  scene.add(groundAndHills());
  const fences = new THREE.Group();
  for (const [x, z, turn] of [[-4.5, -6.6, 0], [4.5, -6.6, 0], [-9, -2.6, Math.PI / 2], [-9, 5.4, Math.PI / 2], [9, -2.6, Math.PI / 2], [9, 5.4, Math.PI / 2]]) {
    const fence = ranchFence({ span: turn ? 8 : 9 }); fence.position.set(x, 0, z); fence.rotation.y = turn; fences.add(fence);
  }
  scene.add(bake(fences, { tint: true }));

  // Houses and crops are built the first time they are seen and kept for the page.
  const kept = new Map();
  const once = (key, build) => { if (!kept.has(key)) kept.set(key, build()); return kept.get(key); };

  const houseSlot = new THREE.Group(); houseSlot.position.set(0, 0, -4.6); scene.add(houseSlot);
  const bedMeshes = [], crops = [], cropKeys = [];
  for (let i = 0; i < BED_ORDER.length; i++) {
    const { x, z } = bedAt(i), bed = conucoBed({ size: BED_SIZE, seed: 3 + i });
    bed.position.set(x, 0, z); bed.visible = false; scene.add(bed); bedMeshes.push(bed);
    const slot = new THREE.Group(); slot.position.set(x, 0, z); scene.add(slot); crops.push(slot); cropKeys.push('');
  }
  const decorSlots = new Map();

  const pana = buildCharacter(loadAvatar());
  pana.group.position.set(HOME.x, 0, HOME.z); pana.group.scale.setScalar(.82);
  pana.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(pana.group);
  const walk = { x: HOME.x, z: HOME.z, moving: false, facing: 0 };

  function walkTo(x, z) {
    walk.x = x; walk.z = z; walk.moving = true;
    walk.facing = Math.atan2(x - pana.group.position.x, z - pana.group.position.z);
    pana.group.rotation.y = walk.facing;
  }
  // Up to the bed's front edge, never into the plants.
  const visitBed = index => { const { x, z } = bedAt(index); walkTo(x + (x >= 0 ? -.2 : .2), z + BED_SIZE / 2 + .45); };

  let shownTier = 0, bedCount = -1;
  const out = new Set();
  function sync(view) {
    if (view.tier !== shownTier) {
      shownTier = view.tier;
      houseSlot.clear();
      houseSlot.add(once(`house:${view.tier}`, () => conucoHouse({ tier: view.tier })));
      dirty();
    }
    if (view.beds.length !== bedCount) {
      bedCount = view.beds.length;
      bedMeshes.forEach((bed, i) => { bed.visible = i < bedCount; });
      dirty();
    }
    for (let i = 0; i < crops.length; i++) {
      const bed = view.beds[i], key = bed ? `${bed.crop}:${bed.stage}` : '';
      if (key !== cropKeys[i]) {
        cropKeys[i] = key; crops[i].clear();
        if (bed) {
          const model = once(`crop:${key}`, () => conucoCrop({ crop: bed.crop, stage: bed.stage }));
          // A bed shares its model's geometry and materials with any other bed like it.
          crops[i].add(model.parent ? model.clone() : model);
        }
        dirty();
      }
      // Within a stage it keeps growing a little, so a long crop visibly moves.
      if (bed) {
        const size = bed.ready ? 1 : bed.stage === 'young' ? .7 + bed.growth * .6 : .85 + bed.growth;
        if (crops[i].scale.x !== size) { crops[i].scale.setScalar(size); dirty(); }
      }
    }
    const wanted = new Set(view.decor);
    for (const id of Object.keys(DECOR)) {
      if (wanted.has(id) === out.has(id)) continue;
      const def = DECOR[id];
      if (wanted.has(id)) {
        if (!decorSlots.has(id)) {
          const model = def.build(); model.position.set(...def.at); model.rotation.y = def.turn; model.scale.setScalar(def.scale ?? 1);
          decorSlots.set(id, model);
        }
        scene.add(decorSlots.get(id)); out.add(id);
      } else { scene.remove(decorSlots.get(id)); out.delete(id); }
      dirty();
    }
  }

  // The whole plot in frame, above the bottom bar and clear of the sheet on a wide screen.
  const wide = new THREE.Box3(new THREE.Vector3(-8.4, 0, -6.6), new THREE.Vector3(8.4, 4.2, 7.9));
  // Upright, the beds matter more than the fence: the sides of the plot may run off screen.
  const tall = new THREE.Box3(new THREE.Vector3(-4.6, 0, -6), new THREE.Vector3(4.6, 4.2, 7.9));
  let onResize = () => {};
  function frameView() {
    const w = innerWidth, h = innerHeight;
    const safe = { x: 0, y: Math.min(64, h * .1), width: w, height: Math.max(120, h - Math.min(64, h * .1) - Math.min(70, h * .12)) };
    world.frameCamera(w < h ? tall : wide, [0, .78, 1.15], safe);
    onResize();
  }
  addEventListener('resize', frameView);
  frameView();

  // Bed → its rectangle on screen in CSS pixels, for the page's buttons.
  const corner = new THREE.Vector3();
  function bedRect(index) {
    const { x, z } = bedAt(index), half = BED_SIZE / 2;
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const [cx, cz] of [[x - half, z - half], [x + half, z - half], [x - half, z + half], [x + half, z + half]]) {
      corner.set(cx, 0, cz).project(camera);
      const sx = (corner.x + 1) / 2 * innerWidth, sy = (1 - corner.y) / 2 * innerHeight;
      left = Math.min(left, sx); right = Math.max(right, sx); top = Math.min(top, sy); bottom = Math.max(bottom, sy);
    }
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  let sinceDraw = FRAME_MS, time = 0;
  return {
    renderer, scene, camera, sync, walkTo, visitBed, bedRect, frameView,
    set onResize(fn) { onResize = fn; },
    frame(dt) {
      time += dt; sinceDraw += dt * 1000;
      const p = pana.group.position;
      let moving = false;
      if (walk.moving) {
        const dx = walk.x - p.x, dz = walk.z - p.z, left = Math.hypot(dx, dz), step = WALK * dt;
        if (left <= step) { p.x = walk.x; p.z = walk.z; walk.moving = false; pana.group.rotation.y = 0; }
        else { p.x += dx / left * step; p.z += dz / left * step; moving = true; }
        dirty();
      }
      if (sinceDraw < FRAME_MS) return;
      const elapsed = sinceDraw / 1000; sinceDraw %= FRAME_MS;
      pana.update(elapsed, { walk: moving, speed: moving ? WALK : 0 });
      for (const id of out) decorSlots.get(id).userData.tick?.(time, elapsed);
      world.draw(elapsed);
    },
    dispose() {
      removeEventListener('resize', frameView);
      pana.dispose();
      for (const model of kept.values()) model.userData.dispose?.();
      world.dispose();
    },
  };
}
