// Ported from Juan's Casa Guipuzcoana 3D (1).html; original construction,
// dimensions, textures, openings, gallery, stairs and ornaments retained.
import * as THREE from 'three';
import { rng } from '../core/primitives.js';
import { finishPrototype } from './puerto-prototype-kit.js';

export function casaGuipuzcoana({table=false}={}){
const random=rng(751),scene=new THREE.Group();
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}
const pick = a => a[Math.floor(random() * a.length)];
const tileTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#b4532f'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) {
    const y = r * 32;
    g.fillStyle = '#c5683f'; g.fillRect(0, y, w, 14);
    g.fillStyle = '#8c3b22'; g.fillRect(0, y + 28, w, 4);
    g.fillStyle = '#9a4527';
    for (let x = (r % 2) * 8; x < w; x += 16) g.fillRect(x, y, 2, 28);
  }
}, true);
const glassTex = canvasTex(64, 96, (g, w, h) => {
  g.fillStyle = '#1f2b31'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(160,190,200,0.18)'; g.fillRect(4, 4, 24, 40);
  g.fillStyle = '#3a291c';
  g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
  g.fillRect(w / 2 - 2, 0, 4, h);
  for (let i = 1; i < 3; i++) g.fillRect(0, (h / 3) * i - 2, w, 4);
});
const doorTex = canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#4a3122'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#3a2618';
  for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 1.5, h);
  g.strokeStyle = '#2c1c11'; g.lineWidth = 3;
  g.strokeRect(6, 8, w / 2 - 9, h / 2 - 14); g.strokeRect(w / 2 + 3, 8, w / 2 - 9, h / 2 - 14);
  g.strokeRect(6, h / 2 + 4, w / 2 - 9, h / 2 - 14); g.strokeRect(w / 2 + 3, h / 2 + 4, w / 2 - 9, h / 2 - 14);
});
// Patio floor: terracotta squares alternating with pebbled terrazzo, laid on the diagonal
const patioTex = canvasTex(256, 256, (g, w, h) => {
  const c = 32;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const x = i * c, y = j * c;
    if ((i + j) % 2) {
      g.fillStyle = '#7e3a24'; g.fillRect(x, y, c, c);
      g.fillStyle = pick(['#b65a3c', '#c0673f', '#a9502f', '#c97a4f']); g.fillRect(x + 1.5, y + 1.5, c - 3, c - 3);
    } else {
      g.fillStyle = '#cbbda6'; g.fillRect(x, y, c, c);
      for (let k = 0; k < 45; k++) { g.fillStyle = pick(['#8f8274', '#efe6d6', '#6e6458', '#a8927a']); g.fillRect(x + random() * c, y + random() * c, 2, 2); }
    }
  }
}, true);
patioTex.center.set(0.5, 0.5); patioTex.rotation = Math.PI / 4;
const brickTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#6a3424'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 8; r++) for (let k = -1; k < 4; k++) {
    g.fillStyle = pick(['#9b4b31', '#a5543a', '#8e4329', '#a95c3e']);
    g.fillRect(k * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14);
  }
}, true);

// ---------- materials ----------
const std = (color, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0 }, extra));
const M = {
  wall: std(0xf2ede2), stone: std(0xb5875a), plinth: std(0x8d877d), wood: std(0x3b291c),
  iron: std(0x1d1d1f, { roughness: 0.6 }), ceiling: std(0x2e2017),
  column: std(0xa49c90, { flatShading: true }),
  sandstone: std(0xb98c58, { flatShading: true }),
  gallery: std(0x4a3426), treads: std(0x8e4a33),
  tile: std(0xffffff, { map: tileTex, side: THREE.DoubleSide }),
  tileTop: std(0xffffff, { map: tileTex, side: THREE.FrontSide }),
  underside: std(0x2e2017, { side: THREE.BackSide }),
  glass: std(0xffffff, { map: glassTex, roughness: 0.4 }),
  door: std(0xffffff, { map: doorTex }),
  patio: std(0xffffff, { map: patioTex }),
  brick: std(0xffffff, { map: brickTex }),
  lamp: std(0xfff1c2, { emissive: 0xffb84a, emissiveIntensity: 0.15 }),
  ground: std(0xd9d1c1), curb: std(0xe2c14b), rubble: std(0x9a9284, { flatShading: true }),
  pot: std(0x8e2a22, { roughness: 0.6 }), bronze: std(0x2b2724, { roughness: 0.45, metalness: 0.3 }),
  pedestal: std(0xf7f4ee),
};

function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
  parent.add(m); return m;
}
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
function instanced(geo, mat, list, parent) {
  const im = new THREE.InstancedMesh(geo, mat, list.length), m4 = new THREE.Matrix4();
  list.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); });
  im.castShadow = im.receiveShadow = true; parent.add(im); return im;
}
function floorPlane(w, d, mat, tex, x, y, z, parent, tile = 2) {
  const t = tex.clone(); t.needsUpdate = true; t.repeat.set(w / tile, d / tile);
  const m = mesh(new THREE.PlaneGeometry(w, d), mat.clone(), x, y, z, parent);
  m.material.map = t; m.rotation.x = -Math.PI / 2; m.castShadow = false; return m;
}

// Roof geometry from triangles. Faces are turned upward and UVs run down the slope,
// so tile rows sit parallel to the eaves on every face.
function roofGeo(tris) {
  const pos = [], uv = [], up = new THREE.Vector3(0, 1, 0);
  for (const t of tris) {
    let [a, b, c] = t.map(p => new THREE.Vector3().fromArray(p));
    let n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    if (n.y < 0) { [b, c] = [c, b]; n.negate(); }
    const down = up.clone().sub(n.clone().multiplyScalar(n.dot(up))).normalize();
    const across = new THREE.Vector3().crossVectors(n, down);
    for (const p of [a, b, c]) { pos.push(p.x, p.y, p.z); uv.push(p.dot(across) / 1.3, p.dot(down) / 1.6); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
const quad = (p0, p1, p2, p3) => [[p0, p1, p2], [p0, p2, p3]];
function hipRoof(w, d, h) {
  const a = w / 2, b = d / 2, r = Math.max(a - b, 0.01);
  const c1 = [-a, 0, b], c2 = [a, 0, b], c3 = [a, 0, -b], c4 = [-a, 0, -b], R1 = [-r, h, 0], R2 = [r, h, 0];
  return roofGeo([...quad(c1, c2, R2, R1), ...quad(c3, c4, R1, R2), [c2, c3, R2], [c4, c1, R1]]);
}
function gableRoof(halfW, halfD, rise, oh) {
  const s = rise / halfW, a = halfW + oh, e = -oh * s, top = rise + 0.15, b = halfD + oh;
  return roofGeo([...quad([-a, e, b], [0, top, b], [0, top, -b], [-a, e, -b]), ...quad([a, e, -b], [0, top, -b], [0, top, b], [a, e, b])]);
}
function shedRoof(x0, x1, yWall, zWall, yEdge, zEdge) {
  return roofGeo(quad([x0, yWall, zWall], [x1, yWall, zWall], [x1, yEdge, zEdge], [x0, yEdge, zEdge]));
}

// ---------- dimensions ----------
// Front range z 0..6 (facade at z=6), side ranges x ±8..22, back range z -17..-11.
// Open courtyard x -8..8, z -11..0. Pillar line inset 2.4 from the courtyard walls.
const ZF = 6, F1 = 4.2, H2 = 8.2, CH = 11.6, RISE = 3.0;
const CX = 8, CZ0 = 0, CZ1 = -11, PX = 5.6, PZ0 = -2.4, PZ1 = -8.6;

const house = new THREE.Group(); scene.add(house);   // everything the cutaway may hide
const court = new THREE.Group(); scene.add(court);   // courtyard fittings, always shown

// ---------- masses ----------
box(15.5, H2, 6, M.wall, -14.25, H2 / 2, 3, house);                       // front wings
box(15.5, H2, 6, M.wall, 14.25, H2 / 2, 3, house);
box(5.2, 3.5, 6, M.wall, -3.9, 1.75, 3, house);                            // centre, either side of the passage
box(5.2, 3.5, 6, M.wall, 3.9, 1.75, 3, house);
box(13, CH - 3.5, 6, M.wall, 0, 3.5 + (CH - 3.5) / 2, 3, house);           // centre above the passage
box(14, H2, 11, M.wall, -15, H2 / 2, -5.5);                                // side ranges
box(14, H2, 11, M.wall, 15, H2 / 2, -5.5);
box(44, H2, 6, M.wall, 0, H2 / 2, -14);                                    // back range
box(20.85, 0.5, 6.3, M.plinth, -11.725, 0.25, 3.15, house);
box(20.85, 0.5, 6.3, M.plinth, 11.725, 0.25, 3.15, house);
box(44.3, 0.5, 6.3, M.plinth, 0, 0.25, -14.15);
box(0.3, 0.5, 11, M.plinth, -22.05, 0.25, -5.5);
box(0.3, 0.5, 11, M.plinth, 22.05, 0.25, -5.5);
const gShape = new THREE.Shape([new THREE.Vector2(-6.5, 0), new THREE.Vector2(6.5, 0), new THREE.Vector2(0, RISE)]);
mesh(new THREE.ExtrudeGeometry(gShape, { depth: 6, bevelEnabled: false }), M.wall, 0, CH, 0, house);

// ---------- outer roofs ----------
mesh(hipRoof(16.9, 7.4, 2.4), M.tile, -14.25, H2, 3, house);
mesh(hipRoof(16.9, 7.4, 2.4), M.tile, 14.25, H2, 3, house);
mesh(gableRoof(6.5, 3, RISE, 0.7), M.tile, 0, CH, 3, house);
box(0.5, 0.5, 7.6, M.tile, 0, CH + RISE + 0.2, 3, house);
mesh(hipRoof(15.4, 12.4, 2.6), M.tile, -15, H2, -5.5);
mesh(hipRoof(15.4, 12.4, 2.6), M.tile, 15, H2, -5.5);
mesh(hipRoof(45.4, 7.4, 2.4), M.tile, 0, H2, -14);

// Stone quoins: alternating long and short blocks on each corner
function quoins(x, z, nx, nz, y0, y1, parent) {
  let i = 0;
  for (let y = y0; y + 0.45 <= y1; y += 0.5, i++) {
    const L1 = i % 2 ? 0.5 : 0.95, L2 = i % 2 ? 0.95 : 0.5;
    box(L1, 0.45, 0.1, M.stone, x - nx * L1 / 2, y + 0.225, z + nz * 0.05, parent);
    box(0.1, 0.45, L2, M.stone, x + nx * 0.05, y + 0.225, z - nz * L2 / 2, parent);
  }
}
for (const s of [-1, 1]) {
  quoins(22 * s, ZF, s, 1, 0.5, H2, house);
  quoins(22 * s, -17, s, -1, 0.5, H2, scene);
  quoins(6.5 * s, ZF, s, 1, H2, CH, house);
  quoins(6.5 * s, 0, s, -1, H2, CH, house);
}

// Openings: stone surround with glazed, wooden or open infill; optional iron grille or arch.
function opening(x, y, z, w, h, kind = 'window', ry = 0, opts = {}, parent = house) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  const t = 0.24;
  box(t, h, 0.14, M.stone, -w / 2 - t / 2, h / 2, 0.07, g);
  box(t, h, 0.14, M.stone, w / 2 + t / 2, h / 2, 0.07, g);
  if (kind === 'window') box(w + 2 * t + 0.12, t * 0.7, 0.24, M.stone, 0, -t * 0.35, 0.1, g);
  if (kind !== 'passage') {
    const infill = mesh(new THREE.PlaneGeometry(w, h), kind === 'door' ? M.door : M.glass, 0, h / 2, 0.02, g);
    infill.castShadow = false;
  }
  if (opts.arch) {
    if (kind !== 'passage') mesh(new THREE.CircleGeometry(w / 2, 20, 0, Math.PI), kind === 'door' ? M.door : M.glass, 0, h, 0.02, g);
    mesh(new THREE.RingGeometry(w / 2, w / 2 + t, 20, 1, 0, Math.PI), M.stone, 0, h, 0.13, g).material.side = THREE.DoubleSide;
  } else {
    box(w + 2 * t, t, 0.14, M.stone, 0, h + t / 2, 0.07, g);
  }
  if (opts.grille) {
    for (let bx = -w / 2 + 0.15; bx <= w / 2 - 0.1; bx += 0.18) box(0.035, h - 0.1, 0.035, M.iron, bx, h / 2, 0.18, g);
    box(w, 0.04, 0.04, M.iron, 0, h * 0.33, 0.18, g);
    box(w, 0.04, 0.04, M.iron, 0, h * 0.7, 0.18, g);
  }
  return g;
}

function lantern(x, y, z, ry = 0, parent = house) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  box(0.06, 0.06, 0.5, M.iron, 0, 0.35, 0.25, g);
  box(0.34, 0.08, 0.34, M.iron, 0, 0.26, 0.5, g);
  box(0.24, 0.36, 0.24, M.lamp, 0, 0.04, 0.5, g);
  box(0.3, 0.06, 0.3, M.iron, 0, -0.16, 0.5, g);
  return g;
}

// Projecting street balcony with turned balusters, corbels and its own tiled roof
const turned = new THREE.CylinderGeometry(0.045, 0.06, 0.9, 6);
function balcony(x0, x1, y, depth) {
  const L = x1 - x0, cx = (x0 + x1) / 2, zf = ZF + depth, pts = [];
  box(L, 0.2, depth, M.wood, cx, y, ZF + depth / 2, house);
  for (let x = x0 + 0.4; x <= x1 - 0.3; x += 0.8) box(0.18, 0.4, depth * 0.9, M.wood, x, y - 0.3, ZF + depth * 0.45, house);
  for (let x = x0 + 0.1; x <= x1 - 0.05; x += 0.2) pts.push([x, y + 0.55, zf - 0.08]);
  for (let z = ZF + 0.2; z < zf - 0.1; z += 0.2) pts.push([x0 + 0.08, y + 0.55, z], [x1 - 0.08, y + 0.55, z]);
  for (const p of pts) mesh(turned, M.wood, p[0], p[1], p[2], house);
  box(L, 0.1, 0.16, M.wood, cx, y + 1.05, zf - 0.08, house);
  box(0.16, 0.1, depth, M.wood, x0 + 0.08, y + 1.05, ZF + depth / 2, house);
  box(0.16, 0.1, depth, M.wood, x1 - 0.08, y + 1.05, ZF + depth / 2, house);
  const n = Math.max(2, Math.round(L / 2.6) + 1);
  for (let i = 0; i < n; i++) mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), M.wood, x0 + 0.1 + (L - 0.2) * i / (n - 1), y + 1.4, zf - 0.08, house);
  mesh(shedRoof(x0 - 0.3, x1 + 0.3, y + 3.2, ZF, y + 2.65, zf + 0.35), M.tile, 0, 0, 0, house);
}

// ---------- street facade ----------
const GZ = ZF + 3.4;
for (let i = 0; i <= 12; i++) {
  const x = -21 + i * 3.5;
  box(0.8, 0.4, 0.8, M.column, x, 0.2, GZ, house);
  mesh(new THREE.CylinderGeometry(0.3, 0.34, 3.0, 8), M.column, x, 1.9, GZ, house);
  box(0.75, 0.25, 0.75, M.column, x, 3.5, GZ, house);
}
box(44.4, 0.32, 0.4, M.wood, 0, 3.78, GZ, house);
box(44.4, 0.08, 3.4, M.ceiling, 0, 3.9, ZF + 1.7, house).castShadow = false;
for (let x = -21.6; x <= 21.6; x += 1.2) box(0.12, 0.14, 3.4, M.wood, x, 3.8, ZF + 1.7, house);
mesh(shedRoof(-22.4, 22.4, 4.75, ZF, 3.95, GZ + 0.6), M.tile, 0, 0, 0, house);
box(44.8, 0.6, 3.6, M.ground, 0, -0.25, ZF + 1.8, house);

for (let i = 0; i < 12; i++) {
  const x = -19.25 + i * 3.5;
  lantern(x + 1.75, 2.9, ZF);
  if (i === 5 || i === 6) continue;
  if (i % 2 === 0) opening(x, 0.05, ZF, 1.4, 2.9, 'door');
  else opening(x, 0.9, ZF, 1.2, 1.9, 'window', 0, { grille: true });
}
// Main entrance: open double doors into the zaguán (entrance passage)
opening(0, 0.05, ZF, 2.4, 3.3, 'passage');
for (const s of [-1, 1]) {
  const leaf = box(0.08, 3.25, 1.15, M.door, s * 1.18, 1.7, ZF - 0.62, house);
  leaf.material = M.door;
}
floorPlane(2.6, 6, M.brick, brickTex, 0, 0.03, 3, house);
box(2.6, 0.05, 6, M.ceiling, 0, 3.47, 3, house).castShadow = false;
for (let z = 0.6; z < 6; z += 1.1) box(2.6, 0.14, 0.14, M.wood, 0, 3.38, z, house);
box(0.26, 0.36, 0.26, M.lamp, 0, 2.9, 3, house);
box(0.03, 0.4, 0.03, M.iron, 0, 3.25, 3, house);

// Upper floors of the street facade
balcony(-5.4, 5.4, 4.9, 1.3);
for (const x of [-3.9, -1.3, 1.3, 3.9]) opening(x, 5.0, ZF, 1.25, 2.6, 'window');
for (const s of [-1, 1]) {
  balcony(s > 0 ? 16.4 : -21.6, s > 0 ? 21.6 : -16.4, 4.9, 1.2);
  opening(17.8 * s, 5.0, ZF, 1.25, 2.6, 'window');
  opening(20.2 * s, 5.0, ZF, 1.25, 2.6, 'window');
  opening(9.3 * s, 5.3, ZF, 1.35, 2.1, 'window');
  opening(13.4 * s, 5.3, ZF, 1.35, 2.1, 'window');
  lantern(11.35 * s, 6.6, ZF);
  opening(3.1 * s, 8.8, ZF, 1.25, 1.9, 'window');
  // side walls
  opening(22 * s, 5.3, 3, 1.35, 2.1, 'window', s * Math.PI / 2);
  for (const z of [-3, -8]) {
    opening(22 * s, 5.3, z, 1.35, 2.1, 'window', s * Math.PI / 2, {}, scene);
    opening(22 * s, 0.9, z, 1.2, 1.9, 'window', s * Math.PI / 2, { grille: true }, scene);
  }
  opening(22 * s, 5.3, -14, 1.35, 2.1, 'window', s * Math.PI / 2, {}, scene);
  // back wall
  for (const x of [3, 9.5, 14.5, 19]) opening(x * s, 5.3, -17, 1.35, 2.1, 'window', Math.PI, {}, scene);
  for (const x of [6, 12, 17]) opening(x * s, 0.9, -17, 1.2, 1.9, 'window', Math.PI, { grille: true }, scene);
}
opening(0, 11.9, ZF, 1.0, 1.2, 'window', 0, { arch: true });

// ================= COURTYARD =================
// Floors: brick under the galleries, diagonal terracotta and terrazzo in the open patio
floorPlane(16, 11, M.brick, brickTex, 0, 0.02, -5.5, court);
floorPlane(10.5, 5.5, M.patio, patioTex, 0, 0.035, -5.5, court, 2.4);
for (const [w, d, x, z] of [[10.7, 0.14, 0, -2.68], [10.7, 0.14, 0, -8.32], [0.14, 5.5, -5.32, -5.5], [0.14, 5.5, 5.32, -5.5]])
  box(w, 0.1, d, M.wood, x, 0.05, z, court);

// Ground-floor sandstone pillars
const pillarPts = [];
for (const z of [PZ0, PZ1]) for (const x of [-PX, -1.87, 1.87, PX]) pillarPts.push([x, z]);
pillarPts.push([-PX, -5.5], [PX, -5.5]);
for (const [x, z] of pillarPts) {
  box(0.95, 0.3, 0.95, M.sandstone, x, 0.15, z, court);
  box(0.72, 3.6, 0.72, M.sandstone, x, 2.1, z, court);
  box(0.92, 0.22, 0.92, M.sandstone, x, 4.0, z, court);
}

// Upper gallery floor: ring of slabs, with a hole over the staircase
const SY = 4.25;
for (const [w, d, x, z] of [
  [16, 2.75, 0, -1.375],                // front
  [8, 2.75, -4, -9.625],                // back, left of stair
  [2.4, 2.75, 6.8, -9.625],             // back, right of stair (landing)
  [5.6, 1.15, 2.8, -8.825],             // back, beside the stair hole
  [2.75, 5.5, -6.625, -5.5],            // sides
  [2.75, 5.5, 6.625, -5.5],
]) box(w, 0.3, d, M.gallery, x, SY, z, court);
// fascia beam on the pillar line and ceiling joists below
for (const [w, d, x, z] of [[11.6, 0.3, 0, PZ0], [11.6, 0.3, 0, PZ1], [0.3, 6.5, -PX, -5.5], [0.3, 6.5, PX, -5.5]])
  box(w, 0.42, d, M.wood, x, 3.98, z, court);
for (let x = -7.5; x <= 7.5; x += 1.0) {
  box(0.12, 0.16, 2.75, M.wood, x, 4.02, -1.375, court);
  if (x < 0 || x > 5.6) box(0.12, 0.16, 2.75, M.wood, x, 4.02, -9.625, court);
}
for (let z = -7.8; z <= -3.2; z += 1.0) for (const s of [-1, 1]) box(2.75, 0.16, 0.12, M.wood, s * 6.625, 4.02, z, court);

// Upper balustrade of square dark balusters, thin posts with brackets, eaves beam
const balPts = [], BAL_Y = SY + 0.15 + 0.45;
for (let x = -PX; x <= PX + 0.01; x += 0.19) { balPts.push([x, BAL_Y, PZ0]); balPts.push([x, BAL_Y, PZ1]); }
for (let z = PZ1 + 0.19; z < PZ0; z += 0.19) { balPts.push([-PX, BAL_Y, z]); balPts.push([PX, BAL_Y, z]); }
instanced(new THREE.BoxGeometry(0.06, 0.9, 0.06), M.wood, balPts, court);
for (const [w, d, x, z] of [[11.4, 0.14, 0, PZ0], [11.4, 0.14, 0, PZ1], [0.14, 6.4, -PX, -5.5], [0.14, 6.4, PX, -5.5]]) {
  box(w, 0.1, d, M.wood, x, SY + 1.1, z, court);
  box(w, 0.08, d, M.wood, x, SY + 0.2, z, court);
}
const POST_TOP = 7.5;
for (const [x, z] of pillarPts) {
  box(0.17, POST_TOP - SY - 0.15, 0.17, M.wood, x, (POST_TOP + SY + 0.15) / 2, z, court);
  box(0.7, 0.14, 0.2, M.wood, x, POST_TOP - 0.1, z, court);
  box(0.2, 0.14, 0.7, M.wood, x, POST_TOP - 0.1, z, court);
}
for (const [w, d, x, z] of [[11.8, 0.22, 0, PZ0], [11.8, 0.22, 0, PZ1], [0.22, 6.6, -PX, -5.5], [0.22, 6.6, PX, -5.5]])
  box(w, 0.26, d, M.wood, x, POST_TOP + 0.1, z, court);
// Trailing greenery along the back and right rails
const ivy = std(0x5c8a3a, { flatShading: true });
for (let x = -PX + 0.3; x < PX; x += 0.55) {
  const b = mesh(new THREE.IcosahedronGeometry(0.28, 0), ivy, x, SY + 1.15 - random() * 0.4, PZ1 + 0.05, court);
  b.scale.set(1.3, 0.8 + random() * 0.8, 0.7);
}

// Inward-sloping roof ring: tiles on top, dark boarded ceiling underneath
const RO = H2 + 0.1, RI = POST_TOP + 0.1, IX = 4.9, IZ0 = -3.1, IZ1 = -7.9;
const ringTris = [
  ...quad([-CX, RO, CZ0], [CX, RO, CZ0], [IX, RI, IZ0], [-IX, RI, IZ0]),
  ...quad([CX, RO, CZ1], [-CX, RO, CZ1], [-IX, RI, IZ1], [IX, RI, IZ1]),
  ...quad([-CX, RO, CZ1], [-CX, RO, CZ0], [-IX, RI, IZ0], [-IX, RI, IZ1]),
  ...quad([CX, RO, CZ0], [CX, RO, CZ1], [IX, RI, IZ1], [IX, RI, IZ0]),
];
const ringGeo = roofGeo(ringTris);
mesh(ringGeo, M.tileTop, 0, 0, 0, court);
mesh(ringGeo, M.underside, 0, -0.06, 0, court);

// Staircase in the back gallery, rising along x to the upper floor
const STEPS = 16, RISER = (SY + 0.15) / STEPS, TREAD = 0.33, SX0 = 0.3, SZ = -10.27, SW = 1.35;
const stairBal = [];
for (let i = 0; i < STEPS; i++) {
  const x = SX0 + TREAD * i + TREAD / 2, h = RISER * (i + 1);
  box(TREAD, h, SW, M.wall, x, h / 2, SZ, court);
  box(TREAD + 0.03, 0.05, SW + 0.02, M.treads, x, h + 0.02, SZ, court);
  stairBal.push([x, h + 0.47, SZ + SW / 2 - 0.05]);
}
instanced(turned, M.wood, stairBal, court);
{
  const x0 = SX0, y0 = RISER + 0.95, x1 = SX0 + TREAD * STEPS, y1 = SY + 0.15 + 0.95;
  const rail = box(Math.hypot(x1 - x0, y1 - y0), 0.1, 0.12, M.wood, (x0 + x1) / 2, (y0 + y1) / 2, SZ + SW / 2 - 0.05, court);
  rail.rotation.z = Math.atan2(y1 - y0, x1 - x0);
  box(0.18, 1.3, 0.18, M.wood, SX0 - 0.05, 0.65, SZ + SW / 2 - 0.05, court);
  const ball = mesh(new THREE.SphereGeometry(0.11, 8, 6), M.wood, SX0 - 0.05, 1.38, SZ + SW / 2 - 0.05, court);
}

// Courtyard walls: doors, windows and the arched passage back to the street
const UP = SY + 0.17;
// back wall (faces +z)
opening(-6.2, 0.02, CZ1, 1.3, 2.7, 'door', 0, {}, court);
opening(-3.0, 0.02, CZ1, 1.5, 2.3, 'window', 0, { arch: true }, court);
for (const x of [-6.2, -3.0]) opening(x, UP, CZ1, 1.25, 2.4, 'door', 0, {}, court);
opening(6.8, UP, CZ1, 1.2, 2.4, 'door', 0, {}, court);
// side walls (left faces +x, right faces -x)
for (const s of [-1, 1]) {
  const ry = -s * Math.PI / 2;
  opening(s * CX, 0.02, -3.8, 1.3, 2.7, 'door', ry, {}, court);
  opening(s * CX, 0.9, -7.6, 1.2, 1.9, 'window', ry, { grille: true }, court);
  opening(s * CX, UP, -3.8, 1.2, 2.4, 'door', ry, {}, court);
  opening(s * CX, UP, -7.6, 1.2, 2.4, 'door', ry, {}, court);
  lantern(s * CX, 2.7, -5.7, ry, court);
  lantern(s * CX, UP + 2.1, -5.7, ry, court);
}
lantern(-4.6, 2.7, CZ1, 0, court);
lantern(-1.4, UP + 2.1, CZ1, 0, court);
// front wall (faces -z), part of the front range so the cutaway hides it
for (const s of [-1, 1]) {
  opening(s * 5.0, 0.02, CZ0, 1.3, 2.7, 'door', Math.PI);
  opening(s * 4.6, UP, CZ0, 1.2, 2.4, 'door', Math.PI);
  lantern(s * 2.6, 2.7, CZ0, Math.PI);
}
opening(0, UP, CZ0, 1.2, 2.4, 'door', Math.PI);
{
  const sp = new THREE.Shape();
  sp.moveTo(-1.3, 2.2); sp.lineTo(-1.3, 3.5); sp.lineTo(1.3, 3.5); sp.lineTo(1.3, 2.2);
  sp.lineTo(1.1, 2.2); sp.absarc(0, 2.2, 1.1, 0, Math.PI, false); sp.lineTo(-1.3, 2.2);
  mesh(new THREE.ExtrudeGeometry(sp, { depth: 0.3, bevelEnabled: false }), M.wall, 0, 0, 0, house);
  box(0.2, 2.2, 0.3, M.wall, -1.2, 1.1, 0.15, house);
  box(0.2, 2.2, 0.3, M.wall, 1.2, 1.1, 0.15, house);
  opening(0, 0, CZ0, 2.2, 2.2, 'passage', Math.PI, { arch: true });
}

// Plants in red pots, a planter in the middle, busts on pedestals
const frond = new THREE.ConeGeometry(0.3, 1.9, 4);
const leafMats = [0x4f8a34, 0x6aa040, 0x3f7230].map(c => std(c, { flatShading: true }));
function pottedPalm(x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); court.add(g);
  mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.75, 12), M.pot, 0, 0.375, 0, g);
  mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.08, 12), M.pot, 0, 0.75, 0, g);
  for (let i = 0; i < 11; i++) {
    const l = mesh(frond, leafMats[i % 3], 0, 0.95, 0, g);
    l.rotation.set(0, (i / 11) * Math.PI * 2 + random() * 0.3, 0);
    l.rotateZ(0.5 + random() * 0.6);
    l.translateY(0.9); l.scale.set(1, 1, 0.3);
  }
}
pottedPalm(4.5, -3.4, 1.1); pottedPalm(-4.6, -7.6, 1.0); pottedPalm(-7.2, -0.8, 0.85); pottedPalm(7.3, -10.3, 0.85);
if(!table){
// central planter with a lady palm cluster
box(1.5, 0.35, 1.5, M.pot, -0.6, 0.18, -5.6, court);
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * Math.PI * 2, r = 0.35 * random();
  const h = 1.6 + random() * 1.3;
  const sx = -0.6 + Math.cos(a) * r, sz = -5.6 + Math.sin(a) * r;
  mesh(new THREE.CylinderGeometry(0.03, 0.04, h, 5), M.wood, sx, 0.35 + h / 2, sz, court);
  const tuft = mesh(new THREE.IcosahedronGeometry(0.55, 0), leafMats[i % 3], sx + Math.cos(a) * 0.3, 0.35 + h, sz + Math.sin(a) * 0.3, court);
  tuft.scale.set(1.1, 0.55, 1.1);
}
}
function bust(x, z) {
  box(0.5, 1.2, 0.5, M.pedestal, x, 0.6, z, court);
  box(0.46, 0.26, 0.26, M.bronze, x, 1.33, z, court);
  mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 8), M.bronze, x, 1.52, z, court);
  mesh(new THREE.SphereGeometry(0.16, 12, 10), M.bronze, x, 1.7, z, court);
}
bust(-4.3, -10.4); bust(-7.4, -2.6);


// Centre the open patio at the game table origin; no architecture is rescaled.
for(const child of scene.children)child.position.z+=5.5;
const out=finishPrototype(scene,'casa-guipuzcoana');
out.userData.foundationDepth=0.55;out.userData.source='Casa Guipuzcoana 3D (1).html';out.userData.patio=[10.5,5.5];
return out;
}
