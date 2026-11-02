// La Plaza's town: the square around the court. Colonial facades close all four
// sides (row houses with balconies, shutters and a portal arcade), a church with
// its bell tower and stone atrio heads the north side, and a cobbled street,
// a sidewalk and a garden verge run round the fence with lamps, benches,
// planters, trees, a market, a parked truck and motos. String lights and
// bunting hang from the glorieta's roof to the facades, and the court's paving
// gets its pattern: a rosette round the glorieta, rings round the fountains,
// lane stripes and a border.
//
// Everything is scenery: outside the fence (|x| or |z| over 28) or overhead (the
// strands, over 4 m) or flat paint, so no collider changes and the collision
// audit still sees only the cover. scene.js imports this module the first time
// La Plaza stands, so the lobby and the other courts never load it.
//
// Draw cost: every plain material bakes into one tinted batch (one draw with
// shadows, one without), the bulbs are one unlit mesh, the paving pattern one
// multiply-blended mesh, the cobbles three textured meshes. Only trees, lamps,
// benches, planters and stalls by the fence cast shadows; facades are beyond
// the sun's shadow box anyway.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colonialHouse } from '/engine/models/props/colonial-house.js';
import { colonialChurch } from '/engine/models/props/pueblo.js';
import { bench, planter, streetLamp, marketStall } from '/engine/models/props/plaza.js';
import { produceCrates, parkedMoto } from '/engine/models/props/barrio.js';
import { cargoHandcart } from '/engine/models/props/cargo-handcart.js';
import { fruitDeliveryTruck } from '/engine/models/props/fruit-delivery-truck.js';
import { streetMural } from '/engine/models/props/street-mural.js';
import { araguaney } from '/engine/models/vegetation/araguaney.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { bake } from '/engine/models/core/static-batch.js';
import { BUNTING } from '/engine/worlds/look.js';

// The rings round the court (metres from the centre, the fence at 28).
const VERGE = 28.4, STREET = 30, WALK = 34, FRONT = 36, ROW = 31;
// Row houses per side, cycled: family, floors, palette, windows, roof.
const HOUSES = [
  ['casa-balcon', 2, 'azul', 'reja-curva', 'tejas'], ['casa-baja', 1, 'amarillo', 'postigos', 'tejas'],
  ['casa-remate', 1, 'cielo', 'arco', 'azotea'], ['casa-esquina', 2, 'coral-crema', 'doble', 'cuatro-aguas'],
  ['casa-baja', 2, 'turquesa', 'celosia', 'tejas'], ['casa-larga', 1, 'crema', 'postigos', 'tejas'],
  ['casa-balcon', 2, 'amarillo', 'reja', 'azotea'], ['casa-remate', 2, 'coral-crema', 'arco', 'tejas'],
];
const WIDTH = { 'casa-balcon': 7.2, 'casa-baja': 7.2, 'casa-remate': 7.8, 'casa-esquina': 7.8, 'casa-larga': 10.8, 'casa-portal': 7.8 };
// Each side: where its facades face from, and the stretches left open (the atrio).
const SIDES = [
  { id: 'north', at: (u, out) => [u, -out], turn: 0, gaps: [[-10, 10]] },
  { id: 'south', at: (u, out) => [-u, out], turn: Math.PI, gaps: [], portal: [-12, 12] },
  { id: 'west', at: (u, out) => [-out, -u], turn: Math.PI / 2, gaps: [] },
  { id: 'east', at: (u, out) => [out, u], turn: -Math.PI / 2, gaps: [] },
];

export function createPlazaTown({ paving } = {}) {
  const group = new THREE.Group(), statics = new THREE.Group(), bounds = [], owned = [];
  group.name = 'Plaza town';
  const own = x => { owned.push(x); return x; };
  // A model placed at (x, z) facing `turn`; `shadow` keeps its cast shadows.
  function place(model, x, z, turn = 0, { shadow = false, scale = 1, camera = true, y = 0 } = {}) {
    model.position.set(x, y, z); model.rotation.y = turn; model.scale.setScalar(scale);
    model.traverse(o => { if (o.isMesh) { o.castShadow = shadow; o.receiveShadow = true; } });
    statics.add(model); if (camera) { model.updateMatrixWorld(true); bounds.push(new THREE.Box3().setFromObject(model)); }
    return model;
  }

  // --- Ground: verge, street, sidewalk and atrio, cobbles with world-scaled UVs ---
  const ring = (inner, outer, y, cut) => {
    const parts = [], rect = (x0, z0, x1, z1) => {
      if (x1 - x0 < .01 || z1 - z0 < .01) return;
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y, (z0 + z1) / 2), p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 8, -p.getZ(i) / 8);
      parts.push(g);
    };
    for (const s of [-1, 1]) {
      const [a, b] = s < 0 ? [-outer, -inner] : [inner, outer];
      if (cut && s < 0) { rect(-outer, a, cut[0], b); rect(cut[1], a, outer, b); } else rect(-outer, a, outer, b);
      rect(a, -inner, b, inner);
    }
    return mergeGeometries(parts);
  };
  const map = own(paving.clone()); map.repeat.set(1, 1); map.needsUpdate = true;
  const cobbles = (color, geometry) => {
    const mesh = new THREE.Mesh(geometry, own(new THREE.MeshStandardMaterial({ map, color, roughness: .95 }))); mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  cobbles('#d9c3a5', ring(VERGE, STREET, .01));
  cobbles('#8f8a86', ring(STREET, WALK, 0));
  cobbles('#efe4d2', ring(WALK, FRONT + 8, .14, [-10, 10]));
  // The atrio: a grey stone forecourt two steps up, before the church.
  const atrio = new THREE.PlaneGeometry(20, 13).rotateX(-Math.PI / 2).translate(0, .3, -(WALK + 7.5));
  { const p = atrio.attributes.position, uv = atrio.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 5, -p.getZ(i) / 5); }
  cobbles('#b9b6b4', atrio);
  const mat = new Map(), paint = (color, roughness = .9) => { const key = `${color}:${roughness}`; if (!mat.has(key)) mat.set(key, new THREE.MeshStandardMaterial({ color, roughness })); return mat.get(key); };
  const slab = (w, h, d, color, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint(color)); m.position.set(x, y + h / 2, z); m.receiveShadow = true; statics.add(m); return m; };
  // Curbs between the street and the sidewalk; the atrio's two steps and its platform.
  for (const s of [-1, 1]) { slab(2 * WALK + .5, .14, .25, '#cfc6b8', 0, 0, s * (WALK + .12)); slab(.25, .14, 2 * WALK, '#cfc6b8', s * (WALK + .12), 0, 0); }
  slab(20.4, .15, .5, '#a9a5a2', 0, 0, -WALK - .25); slab(20.4, .15, .5, '#a9a5a2', 0, .15, -WALK - .75);
  slab(20, .3, 13, '#b2aeab', 0, -.01, -(WALK + 7.5));

  // --- Facades: a continuous row of colonial houses on every side ---
  let seed = 3, n = 0;
  for (const side of SIDES) {
    const stretches = [];
    let from = -ROW;
    for (const [a, b] of side.gaps) { stretches.push([from, a]); from = b; }
    stretches.push([from, ROW]);
    for (const [start, end] of stretches) {
      let u = start;
      while (end - u > 5.7) {
        let [family, floors, palette, windowStyle, roof] = HOUSES[n++ % HOUSES.length];
        const portal = side.portal && u + 3 > side.portal[0] && u + 3 < side.portal[1];
        if (portal) { family = 'casa-portal'; floors = 1; roof = 'tejas'; }
        let width = WIDTH[family], left = end - u - width;
        if (left < 5.8) width = Math.min(12, end - u);
        if (family === 'casa-larga' && width < 9) family = 'casa-baja';
        if (family === 'casa-balcon' || family === 'casa-esquina') floors = 2;
        const first = u === start, last = end - u - width < 5.7, depth = 6.4;
        const house = colonialHouse({ seed: seed++, family, floors, width, depth, palette, windowStyle, roof, detail: 'low', partyWalls: ['rear', ...(first ? [] : ['left']), ...(last ? [] : ['right'])] });
        const [x, z] = side.at(u + width / 2, FRONT + depth / 2);
        place(house, x, z, side.turn);
        u += width + .02;
      }
    }
  }
  // The church heads the square, raised on its atrio.
  place(colonialChurch(), 0, -(FRONT + 6.2), 0, { scale: 1.6, y: .29 });
  // Corner houses close the four street ends.
  for (const [i, [sx, sz]] of [[-1, -1], [1, 1], [-1, 1]].entries()) {
    const house = colonialHouse({ seed: 40 + i, family: 'casa-esquina', floors: 2, palette: ['turquesa', 'amarillo', 'coral-crema'][i], windowStyle: 'postigos', roof: 'cuatro-aguas', detail: 'low' });
    place(house, sx * (FRONT + 6), sz * (FRONT + 6), Math.atan2(-sx, -sz));
  }
  place(streetMural(), FRONT + 5, -(FRONT + 5), -Math.PI / 4);

  // --- The verge: lamps, benches, planters, trees ---
  const verge = (STREET + VERGE) / 2;
  for (const side of SIDES) {
    const north = side.id === 'north';
    for (const u of [-22.5, -13.5, -4.5, 4.5, 13.5, 22.5]) {
      if (north && Math.abs(u) < 10) continue;
      const [x, z] = side.at(u, verge); place(streetLamp(), x, z, 0, { shadow: true, camera: false });
    }
    for (const u of north ? [-18, 18] : [-18, -9, 9, 18]) { const [x, z] = side.at(u, verge + .2); place(bench(), x, z, side.turn, { shadow: true, camera: false }); }
    for (const u of north ? [-11, 11] : [0]) { const [x, z] = side.at(u, north ? WALK + .9 : verge); place(planter({ seed: u + 9 }), x, z, 0, { shadow: true, camera: false }); }
  }
  // Trees on the sidewalk corners and beside the atrio.
  for (const [i, [x, z]] of [[-35, -35], [35, -35], [-35, 35], [35, 35], [-8.2, -36.4], [8.2, -36.4]].entries()) {
    place(i % 2 ? mangoTree({ seed: i + 3 }) : araguaney({ seed: i + 8 }), x, z, i, { shadow: true, scale: i > 3 ? .75 : 1, y: i > 3 ? .29 : 0 });
  }

  // --- Street life: market on the south street, a truck, motos, a handcart ---
  for (const [i, x] of [-19, -7, 7, 19].entries()) place(marketStall({ seed: i + 2, colors: [[0xd94f45, 0xf5bc3c], [0x2fa6a0, 0xf4ead2], [0xf08a3c, 0xfff1d6], [0x4f9d4a, 0xf5bc3c]][i] }), x, 32.2, Math.PI, { shadow: true });
  for (const [i, x] of [-13, 1.5, 13].entries()) place(produceCrates({ w: 1.6, d: 1, h: 1.1, seed: i + 5, detail: 'light' }), x, 31.4, Math.PI);
  place(cargoHandcart(), 25.5, 32.6, -Math.PI / 2 + .3);
  place(fruitDeliveryTruck(), 32, -15, Math.PI);
  for (const [i, z] of [6, 8.2, 10.4].entries()) place(parkedMoto({ color: ['#e8443a', '#2b6fd6', '#f2b631'][i], seed: i + 1, detail: 'light' }), -32.8, z, Math.PI / 2 + .25);

  // --- String lights and bunting over the court, all of it above 4 m ---
  const wires = [], bulbs = [], flags = [], bulbColors = ['#fff1c2', '#ffd36b', '#ff8a6b', '#7fe3c4', '#ff9fd0'].map(c => new THREE.Color(c));
  const bulb = new THREE.OctahedronGeometry(.11, 0), flagColors = BUNTING.map(c => new THREE.Color(c));
  function strand(a, b, sag, { lights = true, bunting = false } = {}) {
    const length = a.distanceTo(b), count = Math.round(length / 1.4), at = t => new THREE.Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
    const points = Array.from({ length: count + 1 }, (_, i) => at(i / count));
    for (let i = 0; i < count; i++) {
      const p = points[i], q = points[i + 1], mid = p.clone().add(q).multiplyScalar(.5), wire = new THREE.CylinderGeometry(.015, .015, p.distanceTo(q), 3);
      wire.applyMatrix4(new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize()), new THREE.Vector3(1, 1, 1))); wires.push(wire);
      if (lights) { const g = bulb.clone().translate(mid.x, mid.y - .1, mid.z); paintVertices(g, bulbColors[(i + bulbs.length) % bulbColors.length]); bulbs.push(g); }
      if (bunting) {
        const c = flagColors[i % flagColors.length], down = new THREE.Vector3(mid.x, mid.y - .55, mid.z), g = new THREE.BufferGeometry().setFromPoints([p.clone().lerp(q, .12), q.clone().lerp(p, .12), down]);
        g.computeVertexNormals(); paintVertices(g, c); flags.push(g);
      }
    }
  }
  const kiosk = [[.9, .9], [-.9, .9], [.9, -.9], [-.9, -.9]];
  for (const [x, z] of kiosk) strand(new THREE.Vector3(x, 4.7, z), new THREE.Vector3(Math.sign(x) * 34.6, 5.4, Math.sign(z) * 34.6), .9);
  for (const z of [-21, 21]) strand(new THREE.Vector3(-FRONT + .2, 5.6, z), new THREE.Vector3(FRONT - .2, 5.6, z), 1.2, { lights: false, bunting: true });
  for (const x of [-11.5, 11.5]) strand(new THREE.Vector3(x, 6.6, -FRONT + .2), new THREE.Vector3(x, 6.6, FRONT - .2), 1.7);
  statics.add(new THREE.Mesh(mergeGeometries(wires), paint('#3a3330', .8)));
  const bulbMesh = new THREE.Mesh(own(mergeGeometries(bulbs)), own(new THREE.MeshBasicMaterial({ vertexColors: true }))); bulbMesh.name = 'String light bulbs'; group.add(bulbMesh);
  const flagMesh = new THREE.Mesh(own(mergeGeometries(flags)), own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide }))); group.add(flagMesh);
  [...wires, ...bulbs, ...flags, bulb].forEach(g => g.dispose());

  // --- The court's paving pattern: a multiply tint over the cobbles, one mesh ---
  group.add(pavingPattern(own));

  // The bake copies every static mesh, so their sources go; the tinted batch keeps its own materials.
  const batch = bake(statics, { tint: true }); group.add(batch);
  statics.traverse(o => o.geometry?.dispose()); mat.forEach(m => m.dispose());
  return {
    group, bounds,
    dispose() {
      group.removeFromParent(); group.traverse(o => o.geometry?.dispose());
      batch.userData.tinted?.forEach(m => m.dispose()); owned.forEach(o => o.dispose?.());
    },
  };
}

function paintVertices(geometry, color) {
  const n = geometry.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
  geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); geometry.deleteAttribute('uv');
  return geometry;
}

// Flat shapes on the court, each tinting the cobbles under it (multiply blend):
// terracotta and grey wedges round the glorieta, rings round the spine's
// fountains, double stripes along both lanes and a border inside the fence.
function pavingPattern(own) {
  const parts = [], Y = .024;
  const terracotta = new THREE.Color(.86, .58, .46), grey = new THREE.Color(.74, .76, .8), dark = new THREE.Color(.62, .5, .44);
  const add = (g, color) => { g.rotateX(-Math.PI / 2).translate(0, Y, 0); const out = g.index ? g.toNonIndexed() : g; if (out !== g) g.dispose(); paintVertices(out, color); out.deleteAttribute('normal'); parts.push(out); };
  const wedges = 16;
  for (let i = 0; i < wedges; i++) add(new THREE.RingGeometry(3.4, 6.1, 2, 1, i * Math.PI * 2 / wedges, Math.PI * 2 / wedges), i % 2 ? terracotta : grey);
  add(new THREE.RingGeometry(6.1, 6.5, 48), dark); add(new THREE.RingGeometry(3.3, 3.45, 48), dark);
  for (const z of [-10.2, 10.2]) { const g = new THREE.RingGeometry(3.05, 3.55, 40); g.translate(0, -z, 0); add(g, terracotta); }
  const strip = (x, z, w, d, color) => { const g = new THREE.PlaneGeometry(w, d); g.translate(x, -z, 0); add(g, color); };
  for (const s of [-1, 1]) for (const o of [-1.7, 1.7]) {
    strip(o, s * 19.85, .35, 11.7, terracotta); strip(s * 16.15, o, 19.1, .35, terracotta);
  }
  for (const s of [-1, 1]) { strip(0, s * 26.1, 52.6, .8, dark); strip(s * 26.1, 0, .8, 51, dark); }
  const geometry = own(mergeGeometries(parts)); parts.forEach(g => g.dispose());
  const material = own(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, fog: false }));
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'Paving pattern'; mesh.renderOrder = -1; return mesh;
}
