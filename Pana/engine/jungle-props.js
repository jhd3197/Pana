// Jungle ruins and traversal pieces shared by every game. Each factory is
// deterministic, grounded at y = 0, faces +Z (bridges span the X axis) and
// returns baked static batches. Waterfalls animate through userData.tick.
import * as THREE from 'three';
import { M, mesh, box as plainBox, tube, rng } from './props.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addWaterMotion } from './water-details.js';
import { leafBlade, taperedStem } from './botanical-shapes.js';
import { fern, monstera, bake } from './flora.js';

const STONE = [0x787f6f, 0x92917b, 0x697566, 0x858977].map(c => M(c, { roughness: 1, vertexColors: true }));
const DARK = M(0x2c312a, { roughness: 1 }), MOSS = M(0x4b783e, { roughness: 1 });
const JADE = M(0x3b9784, { roughness: 0.6, emissive: 0x174f40, emissiveIntensity: 0.4 });
const VINE = M(0x56683a, { flatShading: false, roughness: 1 });
const LEAF = M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, flatShading: false, roughness: 1 });
const ROPE = M(0xc9a96e, { flatShading: false, roughness: 1 });
const TAU = Math.PI * 2;

// Soft chipped edges catch the light; darker lower faces suggest damp stone.
// All variation lives in vertex colors and therefore survives static batching.
function weather(geo, x = 0, y = 0, z = 0) {
  const p = geo.attributes.position, colors = [];
  for (let i = 0; i < p.count; i++) {
    const shade = 0.82 + Math.sin((p.getX(i) + x) * 5.1 + (p.getZ(i) + z) * 3.7) * 0.065 + Math.sin((p.getY(i) + y) * 8.4) * 0.045;
    colors.push(shade * 0.98, shade, shade * 0.94);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); return geo;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  if (!STONE.includes(mat)) return plainBox(w, h, d, mat, x, y, z);
  const geo = new RoundedBoxGeometry(w, h, d, 1, Math.min(0.075, w * 0.08, h * 0.12, d * 0.08));
  return mesh(weather(geo, x, y, z), mat, x, y, z);
}

function finish(group, name) {
  group.traverse(o => {
    if (o.geometry && STONE.includes(o.material) && !o.geometry.attributes.color) weather(o.geometry, o.position.x, o.position.y, o.position.z);
  });
  const out = bake(group); out.name = name;
  group.traverse(o => o.geometry?.dispose());
  return out;
}

// A boulder whose lowest point rests exactly on y = 0 or above `y`.
function boulder(group, radius, [x, y, z], [sx, sy, sz], seed, color = STONE[seed % 4]) {
  const geo = new THREE.IcosahedronGeometry(radius, 1), p = geo.attributes.position, random = rng(seed), seen = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(3)).join(',');
    if (!seen.has(key)) seen.set(key, 0.78 + random() * 0.4);
    const k = seen.get(key); p.setXYZ(i, p.getX(i) * k * sx, p.getY(i) * k * sy, p.getZ(i) * k * sz);
  }
  geo.computeVertexNormals(); geo.computeBoundingBox();
  const m = mesh(weather(geo, x, y, z), color, x, Math.max(y, -geo.boundingBox.min.y), z);
  group.add(m); return m;
}

// Hanging liana with alternating leaves, from `top` straight down.
export function liana(group, [x, y, z], length, seed, sway = 0.3) {
  const pts = Array.from({ length: 7 }, (_, i) => [x + Math.sin(i * 0.9 + seed) * sway * i / 6, y - length * i / 6, z + Math.sin(i * 0.7 + seed) * 0.1]);
  group.add(mesh(taperedStem(pts, 0.06, 0.035, 14, 5), VINE));
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const count = Math.max(3, Math.round(length * 2.2));
  for (let i = 1; i <= count; i++) {
    const at = curve.getPointAt(i / (count + 1));
    const leaf = mesh(leafBlade(0.32, 0.11, 0.05, i % 2 ? 0x4f8d3e : 0x66a04a, 4), LEAF, at.x, at.y, at.z);
    leaf.rotation.set(0, i * 2.3 + seed, -0.9); group.add(leaf);
  }
}

// A vine following any path (draped over stone), leaves on both sides.
function creeper(group, points, seed, radius = 0.05) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  group.add(mesh(new THREE.TubeGeometry(curve, points.length * 6, radius, 5, false), VINE));
  const count = Math.round(curve.getLength() * 5);
  for (let i = 1; i < count; i++) {
    const at = curve.getPointAt(i / count);
    const leaf = mesh(leafBlade(0.38, 0.15, 0.07, i % 3 ? 0x3e743f : 0x75a84d, 5), LEAF, at.x, at.y, at.z);
    leaf.rotation.set(0.3, i * 2.4 + seed, i % 2 ? 0.5 : -0.6); group.add(leaf);
  }
}

function mossPad(group, [x, y, z], [sx, sz], seed) {
  const pad = mesh(new THREE.SphereGeometry(1, 8, 4, 0, TAU, 0, Math.PI / 2), MOSS, x, y, z);
  pad.scale.set(sx, 0.12, sz); pad.rotation.y = seed; group.add(pad);
}

// ---------- 033 · Stone temple entrance ----------
// A stepped facade with a corbelled doorway, a carved mask lintel and braziers.
export function templeEntrance({ seed = 33 } = {}) {
  const r = rng(seed), g = new THREE.Group(), course = 0.78, base = 0.9;
  for (let s = 0; s < 3; s++) {
    const front = 3.6 - s * 0.55, back = -3.8, h = (s + 1) * 0.3;
    g.add(box(12.4 - s * 0.5, h, front - back, STONE[s], 0, h / 2, (front + back) / 2));
  }
  for (let row = 0; row < 11; row++) {
    const tier = Math.floor(row / 4), half = 5.6 - tier * 1.1, depth = 4.2 - tier * 0.5, front = 0.8 - tier * 0.35;
    const opening = row < 5 ? 1.6 : 1.6 - (row - 4) * 0.38, y = base + row * course + course / 2;
    for (const side of [-1, 1]) {
      const inner = opening > 0.2 ? opening : 0, count = Math.max(1, Math.round((half - inner) / 1.15));
      const width = (half - inner) / count;
      for (let c = 0; c < count; c++) {
        const block = box(width - 0.06, course - 0.05, depth, STONE[Math.floor(r() * 4)], side * (inner + (c + 0.5) * width), y, front - depth / 2);
        block.position.z += (r() - 0.5) * 0.06; g.add(block);
      }
    }
    if (row % 4 === 3) for (let i = 0; i < 3; i++) mossPad(g, [(r() - 0.5) * half * 1.8, y + course / 2, front - 0.25 - (r() * 0.3)], [0.5 + r() * 0.6, 0.25], i);
  }
  // Through-passage: side recesses darken the interior without sealing the door.
  for (const s of [-1, 1]) g.add(box(0.04, 3.8, 4, DARK, s * 1.59, base + 1.9, -1.2));
  g.add(box(3.3, 0.05, 4.0, DARK, 0, base + 0.03, -1.2));
  // Mask lintel over the opening and a roof comb on top.
  const top = base + 11 * course;
  g.add(box(4.8, 1.8, 1.2, STONE[1], 0, top + 0.9, -0.6));
  for (const s of [-1, 1]) {
    g.add(box(0.95, 0.4, 0.2, DARK, s * 0.75, top + 1.15, 0.05), box(0.4, 0.25, 0.22, JADE, s * 0.75, top + 1.15, 0.08));
    g.add(box(0.5, 1.1, 0.4, STONE[2], s * 2.1, top + 0.9, 0.05));
    const fang = mesh(new THREE.ConeGeometry(0.16, 0.45, 4), STONE[0], s * 0.4, top + 0.28, 0.02); fang.rotation.z = Math.PI; g.add(fang);
  }
  g.add(box(1.6, 0.25, 0.25, DARK, 0, top + 0.55, 0.05));
  g.add(box(3.6, 1.2, 0.6, STONE[3], 0, top + 2.4, -0.8));
  for (const x of [-1.1, 0, 1.1]) g.add(box(0.5, 0.6, 0.65, DARK, x, top + 2.4, -0.8));
  // Jade frets along the second tier.
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const x = s * (2.3 + i * 1.1), y = base + 5.3 * course;
    g.add(box(0.8, 0.14, 0.1, JADE, x, y, 0.8 - 0.35 + 0.05), box(0.14, 0.5, 0.1, JADE, x - s * 0.33, y - 0.2, 0.8 - 0.35 + 0.05));
  }
  // Braziers flank the steps.
  const ember = M(0xff8a1f, { emissive: 0xff5a1a, emissiveIntensity: 0.9 });
  for (const s of [-1, 1]) {
    g.add(box(0.7, 1.3, 0.7, STONE[2], s * 2.6, base + 0.65, 2.0));
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.3, 0.35, 8), STONE[1], s * 2.6, base + 1.47, 2.0));
    g.add(mesh(new THREE.IcosahedronGeometry(0.3, 0), ember, s * 2.6, base + 1.65, 2.0));
  }
  for (let i = 0; i < 6; i++) {
    const x = (i < 3 ? -1 : 1) * (2.0 + (i % 3) * 1.4 + r() * 0.4);
    liana(g, [x, base + 8 * course - (i % 3) * 0.8, 0.8 - 0.75], 2 + r() * 2.5, seed + i);
  }
  for (const s of [-1, 1]) { const f = fern({ seed: seed + s }); f.position.set(s * 5.6, 0, 2.8); g.add(f); }
  for (const s of [-1, 1]) {
    // Repeated shallow carvings on the door jambs, with a restrained jade center.
    for (let j = 0; j < 4; j++) {
      const x = s * 2.15, y = 1.65 + j * 0.8;
      const diamond = box(0.32, 0.32, 0.06, j === 2 ? JADE : DARK, x, y, 0.83); diamond.rotation.z = Math.PI / 4; g.add(diamond);
    }
    const block = box(0.9, 0.4, 0.8, STONE[2], s * 4.6, 1.1, 2); block.rotation.y = s * 0.4; g.add(block);
    creeper(g, [[s * 2.8, 9.2, 0.18], [s * 3.1, 7.4, 0.22], [s * 3.6, 6.7, 0.55], [s * 3.7, 4.5, 0.57], [s * 4.2, 3.5, 0.91], [s * 4.4, 1.8, 0.91]], seed + s);
    // A few face cracks establish age without obscuring the block courses.
    for (let i = 0; i < 3; i++) {
      const x = s * (3.0 + i * 0.8), y = 1.8 + i * 0.8;
      const points = [[x - 0.18, y + 0.3, 0.835], [x - 0.06, y + 0.08, 0.842], [x + 0.08, y, 0.84], [x + 0.03, y - 0.2, 0.835]].map(p => new THREE.Vector3(...p));
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 6, 0.012, 3, false), DARK));
    }
  }
  return finish(g, 'templeEntrance');
}

// ---------- 034 · Rope suspension bridge ----------
// Spans X from -span/2 to span/2 between two stone ledges; walk along X.
export function ropeBridge({ span = 14, seed = 34 } = {}) {
  if (!Number.isFinite(span) || span < 4 || span > 40) throw new RangeError('ropeBridge span must be between 4 and 40');
  const r = rng(seed), g = new THREE.Group(), half = span / 2, deck = 1.7, sag = 0.75;
  const plankMat = [M(0x8a5a33, { roughness: 0.9 }), M(0x9c6a3c, { roughness: 0.9 }), M(0x76492a, { roughness: 0.9 })];
  const post = M(0x5c3a20, { roughness: 0.9 });
  const at = x => deck - sag * (1 - (x / half) ** 2), hand = x => deck + 1.15 - sag * 0.7 * (1 - (x / half) ** 2);
  for (const s of [-1, 1]) {
    g.add(box(2.6, deck, 3.0, STONE[1], s * (half + 1.3), deck / 2, 0));
    mossPad(g, [s * (half + 1.6), deck, 0.6], [0.9, 0.7], s);
    boulder(g, 0.8, [s * (half + 2.2), 0, 1.5], [1, 0.8, 1], seed + s + 5);
    for (const z of [-0.85, 0.85]) {
      g.add(mesh(new THREE.CylinderGeometry(0.11, 0.13, 1.75, 8), post, s * (half + 0.15), deck + 0.87, z));
      for (let k = 0; k < 3; k++) {
        const binding = mesh(new THREE.TorusGeometry(0.135, 0.022, 5, 10), ROPE, s * (half + 0.15), deck + 1.04 + k * 0.055, z);
        binding.rotation.x = Math.PI / 2; g.add(binding);
      }
      g.add(tube([s * (half + 0.15), deck + 1.6, z], [s * (half + 2.3), deck, z * 1.25], 0.03, ROPE));
    }
  }
  const n = Math.round(span / 0.42);
  for (let i = 0; i < n; i++) {
    const x = -half + (i + 0.5) * span / n;
    const plank = mesh(new RoundedBoxGeometry(span / n - 0.045, 0.09, 1.6, 1, 0.018), plankMat[Math.floor(r() * 3)], x, at(x), (r() - 0.5) * 0.06);
    plank.rotation.set(0, (r() - 0.5) * 0.08, Math.atan(sag * 2 * x / half ** 2)); g.add(plank);
    for (const z of [-0.64, 0.64]) g.add(tube([x - 0.1, at(x) + 0.055, z], [x + 0.1, at(x) + 0.055, z], 0.014, ROPE));
  }
  const rope = (fn, z, dy = 0) => {
    const pts = Array.from({ length: 17 }, (_, i) => { const x = -half - 0.15 + (span + 0.3) * i / 16; return new THREE.Vector3(x, fn(x) + dy, z); });
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 5, false), ROPE));
  };
  for (const z of [-0.78, 0.78]) {
    rope(at, z, -0.05); rope(hand, z);
    for (let i = 1; i < 12; i++) { const x = -half + span * i / 12; g.add(tube([x, at(x) - 0.04, z], [x, hand(x), z], 0.018, ROPE)); }
    for (let i = 0; i < 12; i++) {
      const a = -half + span * i / 12, b = -half + span * (i + 1) / 12;
      g.add(tube([a, hand(a), z], [b, at(b) + 0.08, z], 0.012, ROPE));
    }
  }
  return finish(g, 'ropeBridge');
}

// ---------- 035 · Waterfall rock formation ----------
// A horseshoe cliff pours into a pool at its foot (pool toward +Z).
export function waterfallRocks({ seed = 35 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  const water = M(0x3fb4b8, { flatShading: false, roughness: 0.15, metalness: 0.1 });
  g.add(mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.08, 28), water, 0, 0.2, 1.7));
  let k = 0;
  for (let col = -3; col <= 3; col++) {
    const height = col === 0 ? 4.6 : 5.6 - Math.abs(col) * 0.6 + r() * 0.4;
    for (let y = 0.6; y < height; y += 1.15) {
      const back = col === 0 ? -2.4 : -1.4 - r() * 0.6;
      boulder(g, 1.0 + r() * 0.35, [col * 1.15 + (r() - 0.5) * 0.3, y, back], [1, 0.85, 0.9], seed + k++);
    }
  }
  boulder(g, 1.25, [0, 5.0, -1.6], [1.2, 0.45, 1.0], seed + k++, STONE[1]); // spillway lip
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) boulder(g, 1.0 - i * 0.12, [s * (3.5 - i * 0.2), 0.5 + (3 - i) * 0.5, -0.6 + i * 1.0], [1, 0.9, 1], seed + k++);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + 0.76 * i / 8);
    boulder(g, 0.45 + r() * 0.3, [Math.cos(a) * 2.9, 0, 1.7 + Math.sin(a) * 2.9], [1, 0.7, 1], seed + k++);
  }
  // Raycast onto the actual displaced stones; epiphytes must not float above them.
  g.updateMatrixWorld(true);
  const stones = []; g.traverse(o => { if (o.isMesh && STONE.includes(o.material)) stones.push(o); });
  const ground = (x, z) => {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
    return ray.intersectObjects(stones, false)[0]?.point.y ?? 0;
  };
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.5) * 6, z = -1.8 + r() * 0.6;
    mossPad(g, [x, ground(x, z) - 0.05, z], [0.4 + r() * 0.25, 0.35], i);
  }
  const plants = [fern({ seed: seed + 1 }), fern({ seed: seed + 2 }), monstera({ seed: seed + 3 })];
  [[-2.4, -1.6], [2.6, -1.4], [-3.6, 2.2]].forEach(([x, z], i) => { plants[i].position.set(x, i === 2 ? 0 : ground(x, z) - 0.035, z); plants[i].scale.setScalar(i === 2 ? 1 : 0.8); g.add(plants[i]); });
  for (const x of [-1.5, 1.7]) {
    const top = ground(x, -1.6) - 0.15, points = [];
    for (let i = 0; i < 6; i++) {
      const y = top - i * 0.46, px = x + Math.sin(i * 0.9) * 0.13;
      const ray = new THREE.Raycaster(new THREE.Vector3(px, y, 10), new THREE.Vector3(0, 0, -1));
      const front = ray.intersectObjects(stones, false)[0]?.point.z ?? -0.3;
      points.push([px, y, front + 0.05]);
    }
    creeper(g, points, seed + Math.round(x * 10), 0.035);
  }
  const out = finish(g, 'waterfallRocks');
  // Broken, translucent rivulets vary along Y, so scrolling visibly falls.
  const canvas = Object.assign(document.createElement('canvas'), { width: 128, height: 256 }), ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6abfc8'; ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 90; i++) {
    const x = r() * 128, y = r() * 256, w = 1 + r() * 4, h = 10 + r() * 75;
    ctx.fillStyle = `rgba(232,255,250,${0.12 + r() * 0.48})`;
    ctx.fillRect(x, y, w, h); ctx.fillRect(x, y - 256, w, h);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapT = THREE.RepeatWrapping; texture.colorSpace = THREE.SRGBColorSpace; texture.repeat.y = 2;
  const sheetGeo = new THREE.PlaneGeometry(1.55, 4.85, 14, 28), sp = sheetGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const t = (2.425 - sp.getY(i)) / 4.85, x = sp.getX(i);
    sp.setXYZ(i, x * (1 + t * 0.33), 5.08 - t * 4.85, -0.72 + Math.sqrt(t) * 1.35 + Math.sin(x * 14) * 0.025);
  }
  sheetGeo.computeVertexNormals();
  const rest = sp.array.slice();
  const sheet = new THREE.Mesh(sheetGeo, new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0.82, depthWrite: false, roughness: 0.24, side: THREE.DoubleSide }));
  sheet.name = 'Falling water'; sheet.userData.dispose = () => texture.dispose(); out.add(sheet);
  const foamGroup = new THREE.Group(), foamMat = M(0xd7f3e9, { flatShading: false, roughness: 0.6 });
  for (let i = 0; i < 22; i++) {
    const a = r() * TAU, radius = r() * 0.85;
    const foam = mesh(new THREE.SphereGeometry(0.1 + r() * 0.12, 8, 5), foamMat, Math.cos(a) * radius, 0.25, 0.65 + Math.sin(a) * radius * 0.45);
    foam.scale.y = 0.18; foamGroup.add(foam);
  }
  out.add(finish(foamGroup, 'Impact foam'));
  const spray = Array.from({ length: 6 }, (_, i) => {
    const a = i * TAU / 6;
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.28, 0.65), new THREE.Vector3(Math.cos(a) * 0.65, 1.0, 0.65 + Math.sin(a) * 0.65), new THREE.Vector3(Math.cos(a), 0.25, 0.65 + Math.sin(a)));
  });
  const motion = addWaterMotion(out, [[0, 0.26, 0.65, 0.95], [-1, 0.26, 1.4, 0.4], [1.2, 0.26, 1.0, 0.35]], spray);
  out.userData.tick = t => {
    texture.offset.y = (t * 0.85) % 1;
    for (let i = 0; i < sp.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], amount = (5.08 - y) / 4.85;
      sp.setZ(i, rest[i * 3 + 2] + Math.sin(y * 8 + x * 13 + t * 5) * 0.035 * amount);
    }
    sp.needsUpdate = true; sheetGeo.computeVertexNormals(); motion(t);
  };
  out.userData.tick(0);
  return out;
}

// ---------- 036 · Vine-covered stone arch ----------
export function vineArch({ seed = 36 } = {}) {
  const r = rng(seed), g = new THREE.Group(), inner = 2.2, outer = 3.0, spring = 3.7, depth = 0.9;
  for (const s of [-1, 1]) {
    const x = s * (inner + outer) / 2;
    g.add(box(1.25, 0.45, 1.3, STONE[2], x, 0.225, 0));
    for (let i = 0; i < 6; i++) {
      const block = box(0.82, 0.52, depth, STONE[Math.floor(r() * 4)], x + (r() - 0.5) * 0.06, 0.45 + 0.27 + i * 0.54, 0);
      block.rotation.y = (r() - 0.5) * 0.08; g.add(block);
    }
    g.add(box(1.05, 0.2, 1.1, STONE[1], x, spring - 0.1, 0));
  }
  // Wedge-shaped voussoirs; the keystone carries a jade inlay.
  const pieces = 11;
  for (let k = 0; k < pieces; k++) {
    const a0 = Math.PI * k / pieces + 0.012, a1 = Math.PI * (k + 1) / pieces - 0.012, shape = new THREE.Shape();
    shape.moveTo(Math.cos(a0) * inner, Math.sin(a0) * inner); shape.lineTo(Math.cos(a0) * outer, Math.sin(a0) * outer);
    shape.lineTo(Math.cos(a1) * outer, Math.sin(a1) * outer); shape.lineTo(Math.cos(a1) * inner, Math.sin(a1) * inner); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: k === 5 ? depth + 0.2 : depth, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 1 }); geo.translate(0, 0, -(k === 5 ? depth + 0.2 : depth) / 2);
    const stone = mesh(weather(geo, 0, spring, 0), STONE[(k * 3 + seed) % 4], 0, spring, 0);
    if (k === 2) stone.rotation.z = -0.025; // one settled stone
    g.add(stone);
  }
  g.add(box(0.36, 0.36, 0.08, JADE, 0, spring + (inner + outer) / 2, depth / 2 + 0.12));
  // Fallen block and moss.
  const fallen = box(0.8, 0.5, 0.9, STONE[0], 3.6, 0.38, 1.2); fallen.rotation.set(0.1, 0.6, 0.15); g.add(fallen);
  for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.14); mossPad(g, [Math.cos(a) * outer * 0.98, spring + Math.sin(a) * outer * 0.98 - 0.05, (r() - 0.5) * 0.4], [0.45, 0.4], i); }
  // A creeper drapes over the crown and spills down both faces.
  creeper(g, Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.1 + 0.8 * i / 8); return [Math.cos(a) * (outer + 0.06), spring + Math.sin(a) * (outer + 0.06), 0.25 * Math.sin(i * 1.3)]; }), seed);
  creeper(g, [[-2.6, 0.1, 0.5], [-2.7, 1.3, 0.5], [-2.5, 2.4, 0.5], [-2.65, 3.4, 0.48], [-2.4, 4.6, 0.46], [-1.8, 5.6, 0.47]], seed + 1, 0.045);
  creeper(g, [[2.65, 0.45, 0.5], [2.5, 1.3, 0.52], [2.7, 2.2, 0.5], [2.6, 3.4, 0.52], [2.4, 4.5, 0.5], [1.9, 5.4, 0.51]], seed + 2, 0.04);
  for (let i = 0; i < 5; i++) { const a = Math.PI * (0.2 + i * 0.15); liana(g, [Math.cos(a) * inner * 1.05, spring + Math.sin(a) * inner * 0.98, (i % 2 ? 0.25 : -0.25)], 0.8 + r() * 1.6, seed + i, 0.15); }
  for (const s of [-1, 1]) { const f = fern({ seed: seed + 3 + s }); f.scale.setScalar(0.8); f.position.set(s * 3.4, 0, -0.6); g.add(f); }
  return finish(g, 'vineArch');
}

// ---------- 037 · Bamboo bridge ----------
// Lashed bamboo deck on trestles with short ramps; walk along X.
export function bambooBridge({ span = 10, seed = 37 } = {}) {
  if (!Number.isFinite(span) || span < 4 || span > 40) throw new RangeError('bambooBridge span must be between 4 and 40');
  const r = rng(seed), g = new THREE.Group(), half = span / 2, deck = 1.3, ramp = 2.2;
  const culms = [M(0xb7b45e, { flatShading: false, roughness: 0.7 }), M(0xc9b77a, { flatShading: false, roughness: 0.75 }), M(0xa6a650, { flatShading: false, roughness: 0.7 })];
  const node = M(0x7f7d3e, { flatShading: false, roughness: 0.8 });
  const culm = (a, b, radius, mat = culms[Math.floor(r() * 3)], nodes = true) => {
    g.add(tube(a, b, radius, mat));
    if (!nodes) return;
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), len = va.distanceTo(vb);
    for (let d = 0.45; d < len - 0.1; d += 0.5) g.add(tube(va.clone().lerp(vb, (d - 0.02) / len).toArray(), va.clone().lerp(vb, (d + 0.02) / len).toArray(), radius * 1.18, node));
  };
  const lash = (x, y, z) => {
    for (let i = 0; i < 3; i++) {
      const ring = mesh(new THREE.TorusGeometry(0.09, 0.016, 4, 8), ROPE, x + (i - 1) * 0.04, y, z); ring.rotation.y = Math.PI / 2; g.add(ring);
    }
  };
  // Deck: transverse culms on two stringers, plus ramps at both ends.
  for (const z of [-0.75, 0.75]) culm([-half, deck - 0.12, z], [half, deck - 0.12, z], 0.075);
  for (let x = -half + 0.08; x < half; x += 0.16) {
    culm([x, deck, -0.95], [x, deck, 0.95], 0.075, undefined, false);
    for (const z of [-0.95, 0.95]) {
      const end = mesh(new THREE.CircleGeometry(0.046, 8), node, x, deck, z + Math.sign(z) * 0.002); if (z < 0) end.rotation.y = Math.PI; g.add(end);
    }
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 12; i++) {
      const t = (i + 0.5) / 12, x = s * (half + t * ramp), y = deck - t * (deck - 0.12);
      culm([x, y, -0.95], [x, y, 0.95], 0.065, undefined, false);
    }
    for (const z of [-0.75, 0.75]) culm([s * half, deck - 0.12, z], [s * (half + ramp), 0.05, z], 0.07);
  }
  // Crossed trestle legs at the ends and middle.
  for (const x of [-half + 0.4, 0, half - 0.4]) {
    for (const z of [-1, 1]) {
      culm([x - 0.5, 0.04, z * 1.05], [x + 0.2, deck - 0.1, z * 0.8], 0.07);
      culm([x + 0.5, 0.04, z * 1.05], [x - 0.2, deck - 0.1, z * 0.8], 0.07);
      lash(x, deck * 0.55, z * 0.92);
    }
    culm([x, deck - 0.2, -1.0], [x, deck - 0.2, 1.0], 0.07);
  }
  // Handrails with lashed posts.
  for (const z of [-0.9, 0.9]) {
    for (let x = -half; x <= half + 0.01; x += span / 5) { culm([x, deck, z], [x, deck + 1.05, z], 0.05); lash(x, deck + 0.95, z); }
    culm([-half - 0.1, deck + 1.0, z], [half + 0.1, deck + 1.0, z], 0.055);
    culm([-half, deck + 0.55, z], [half, deck + 0.55, z], 0.045);
  }
  return finish(g, 'bambooBridge');
}

// ---------- 038 · Ancient stone totem ----------
// Three stacked carved faces (jaguar, owl, capybara) under a feathered crest.
export function stoneTotem({ seed = 38 } = {}) {
  const r = rng(seed), g = new THREE.Group();
  g.add(box(1.9, 0.35, 1.9, STONE[2], 0, 0.175, 0), box(1.45, 0.3, 1.45, STONE[1], 0, 0.5, 0));
  let y = 0.65;
  ['jaguar', 'owl', 'capybara'].forEach((kind, i) => {
    const tier = new THREE.Group(); tier.position.y = y; tier.rotation.y = (r() - 0.5) * 0.12; g.add(tier);
    const h = 1.2, stone = STONE[(i + seed) % 4];
    tier.add(box(1.15, h, 1.0, stone, 0, h / 2, 0));
    tier.add(box(1.25, 0.14, 1.08, STONE[(i + 1) % 4], 0, h - 0.07, 0));
    const front = 0.5;
    if (kind === 'owl') for (const s of [-1, 1]) {
      const ring = mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 14), STONE[3], s * 0.26, 0.78, front + 0.03); tier.add(ring);
      tier.add(box(0.14, 0.14, 0.06, JADE, s * 0.26, 0.78, front + 0.02));
    } else for (const s of [-1, 1]) {
      tier.add(box(0.32, 0.16, 0.08, DARK, s * 0.25, 0.8, front), box(0.12, 0.1, 0.09, JADE, s * 0.25, 0.8, front + 0.01));
      tier.add(box(0.4, 0.1, 0.14, stone, s * 0.25, 0.95, front + 0.04));
    }
    if (kind === 'capybara') {
      tier.add(box(0.62, 0.42, 0.3, stone, 0, 0.42, front + 0.12));
      for (const s of [-1, 1]) {
        tier.add(box(0.07, 0.05, 0.04, DARK, s * 0.12, 0.55, front + 0.28));
        tier.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), stone, s * 0.45, h + 0.05, 0.1));
      }
      tier.add(box(0.36, 0.04, 0.04, DARK, 0, 0.32, front + 0.28));
    } else {
      tier.add(box(0.2, 0.32, 0.18, stone, 0, 0.6, front + 0.08));
      tier.add(box(0.64, 0.2, 0.06, DARK, 0, 0.28, front));
      for (let t = 0; t < 4; t++) tier.add(box(0.08, 0.1, 0.07, STONE[1], -0.21 + t * 0.14, 0.33, front + 0.01));
      if (kind === 'jaguar') for (const s of [-1, 1]) { const fang = mesh(new THREE.ConeGeometry(0.06, 0.2, 4), STONE[1], s * 0.24, 0.2, front + 0.04); fang.rotation.z = Math.PI; tier.add(fang); }
    }
    for (const s of [-1, 1]) {
      const spool = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 10), STONE[1], s * 0.63, 0.7, 0); spool.rotation.z = Math.PI / 2; tier.add(spool);
      const gem = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 8), JADE, s * 0.64, 0.7, 0); gem.rotation.z = Math.PI / 2; tier.add(gem);
    }
    y += h;
  });
  // Feather crest.
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.28, feather = box(0.24, 1.0, 0.16, STONE[(i + 1) % 4], Math.sin(a) * 0.55, y + 0.45 + Math.cos(a) * 0.15, -0.05);
    feather.rotation.z = -a; g.add(feather);
  }
  g.add(mesh(new THREE.IcosahedronGeometry(0.17, 0), JADE, 0, y + 0.2, 0.25));
  g.add(box(0.95, 0.3, 0.8, STONE[0], 0, y + 0.15, 0));
  mossPad(g, [0.2, y + 0.3, 0.1], [0.4, 0.35], 1); mossPad(g, [-0.4, 1.85, 0.3], [0.35, 0.3], 2);
  creeper(g, [[0.6, 0.65, 0.45], [0.66, 1.4, 0.3], [0.6, 2.2, 0.52], [0.68, 3.0, 0.2], [0.55, 3.6, 0.5]], seed, 0.035);
  const f = fern({ seed }); f.scale.setScalar(0.7); f.position.set(-1.05, 0, 0.9); g.add(f);
  return finish(g, 'stoneTotem');
}

// ---------- 040 · Hollow tree trunk ----------
// A fallen hollow log along X, open at both ends with broken rims.
export function hollowLog({ seed = 40, length = 6 } = {}) {
  if (!Number.isFinite(length) || length < 3 || length > 20) throw new RangeError('hollowLog length must be between 3 and 20');
  const r = rng(seed), g = new THREE.Group(), R = 0.95, Ri = 0.68, rings = 12;
  const profile = [new THREE.Vector2(Ri, 0)];
  for (let j = 0; j <= rings; j++) profile.push(new THREE.Vector2(R, length * j / rings));
  for (let j = rings; j >= 0; j--) profile.push(new THREE.Vector2(Ri, length * j / rings));
  const geo = new THREE.LatheGeometry(profile, 48), p = geo.attributes.position, colors = [];
  const bark = new THREE.Color(0x5b4632), barkLight = new THREE.Color(0x7a6145), heart = new THREE.Color(0xb08a5c), dark = new THREE.Color(0x3d2d1f);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const radius = Math.hypot(x, z), a = Math.atan2(x, z), outside = radius > (R + Ri) / 2;
    const end = y < 0.01 ? -1 : y > length - 0.01 ? 1 : 0;
    if (outside) { const k = 1 + 0.055 * Math.sin(a * 13 + Math.sin(y * 0.7 + seed) * 0.4) + 0.02 * Math.sin(a * 23 + y * 0.4); x *= k; z *= k; }
    if (end) y += end * (0.12 * Math.abs(Math.sin(a * 3 + seed)) + 0.08 * Math.abs(Math.sin(a * 7 - seed)));
    p.setXYZ(i, x, y, z);
    const c = end ? heart.clone().lerp(barkLight, 0.3) : outside ? bark.clone().lerp(barkLight, 0.45 + 0.35 * Math.sin(a * 13 + Math.sin(y * 0.7 + seed) * 0.4)) : dark.clone().lerp(heart, 0.12 + Math.abs(Math.cos(y)) * 0.12);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.computeVertexNormals();
  geo.rotateZ(Math.PI / 2); geo.translate(length / 2, 0, 0); geo.computeBoundingBox(); geo.translate(0, -geo.boundingBox.min.y, 0);
  const top = geo.boundingBox.max.y - geo.boundingBox.min.y;
  // Double-sided so the hollow inside reads through the broken ends.
  g.add(mesh(geo, M(0xffffff, { vertexColors: true, flatShading: false, roughness: 1, side: THREE.DoubleSide })));
  for (let i = 0; i < 5; i++) mossPad(g, [-length / 2 + 0.45 + i * (length - 0.9) / 5 + r() * 0.15, top - 0.15, (r() - 0.5) * 0.5], [0.4 + r() * 0.2, 0.35], i);
  // Lengthwise fissures follow the bark instead of spiralling around the log.
  const fissure = M(0x403426, { roughness: 1 });
  for (let i = 0; i < 9; i++) {
    const a = 0.15 + i * Math.PI / 9;
    const pts = Array.from({ length: 9 }, (_, j) => new THREE.Vector3(-length / 2 + 0.25 + (length - 0.5) * j / 8, top / 2 + Math.sin(a) * R * 1.01, Math.cos(a) * R * 1.01));
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.012, 4, false), fissure));
  }
  const fungus = M(0xd9b77a, { flatShading: false, roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const shelf = mesh(new THREE.CylinderGeometry(0.22 - i * 0.02, 0.24 - i * 0.02, 0.05, 12, 1, false, 0, Math.PI), fungus, 0.6 + (i % 3) * 0.35, 0.7 + (i % 2) * 0.28 + i * 0.05, R * 0.97);
    shelf.rotation.y = -Math.PI / 2; g.add(shelf);
  }
  const caps = M(0xc8433a, { flatShading: false, roughness: 0.8 }), stalk = M(0xf1e6cf, { flatShading: false });
  for (let i = 0; i < 4; i++) {
    const x = -length / 2 - 0.3 + r() * 0.5, z = 0.9 + r() * 0.4;
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.18, 6), stalk, x, 0.09, z));
    g.add(mesh(new THREE.SphereGeometry(0.1, 8, 5, 0, TAU, 0, Math.PI / 2), caps, x, 0.17, z));
  }
  g.add(mesh(taperedStem([[-0.8, top - 0.2, 0.2], [-0.95, top + 0.4, 0.45], [-1.2, top + 0.8, 0.5]], 0.14, 0.05, 6, 6), M(0x5b4632, { flatShading: false, roughness: 1 })));
  const f = fern({ seed }); f.scale.setScalar(0.65); f.position.set(length / 2 + 0.3, 0, -0.8); g.add(f);
  return finish(g, 'hollowLog');
}
