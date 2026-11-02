// La biblioteca sepultada: an old library buried under the mine, for
// Reliquia's library jornadas and anything else that wants dusty stacks.
// Metres, +Y up, +Z forward, origin on the floor.
//
//   bookcases(cases, { seed })   every bookcase of a level in a few draw calls
//   bookcase({ length, height, double })   one, for Studio
//   libraryLadder, readingTable, scribeDesk, lectern, candelabra, chandelier,
//   tornCurtain, bookcaseDoor (a hinged case for a secret passage)
//   cobwebs(list) / cobweb()     alpha cards, instanced
//   candleFlames(points)         every candle flame of a level, one shader:
//                                flicker, blow-outs and a global dim
//   dustMotes()                  motes drifting in a lamp beam, camera-local
//
// Small props are plain-coloured boxes and cylinders, so a level can bake
// them into a handful of batches (engine/models/core/static-batch.js); the
// instanced pieces (cases, webs, flames) must stay out of `bake`.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

const WOOD = { dark: 0x5a3a22, mid: 0x7a5232, light: 0x9a6c44, dust: 0xa09684 };
const BOOK_COLORS = [0x6b2a22, 0x3b4a2c, 0x2c3550, 0x6a4a22, 0x4a2a3a, 0x7a6a4a, 0x2e2a26, 0x5a3a2a, 0x445a5a];
const owned = (m) => { m.userData.reliquiaOwned = true; return m; };
const std = (color, extra = {}) => owned(new THREE.MeshStandardMaterial({ color, roughness: .9, ...extra }));
function part(parent, geometry, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m; }
const box = (parent, material, w, h, d, x, y, z) => part(parent, new THREE.BoxGeometry(w, h, d), material, x, y + h / 2, z);
const cyl = (parent, material, r0, r1, h, x, y, z, seg = 8) => part(parent, new THREE.CylinderGeometry(r0, r1, h, seg), material, x, y + h / 2, z);

// ---------- Textures, painted once ----------
let spineMap = null, webMap = null;
// A strip of book spines: muted cloth and leather, gold bands, worn tops.
function spineTexture() {
  if (spineMap) return spineMap;
  const r = rng(71), w = 512, h = 128, canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = '#120c08'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w;) {
    const bw = 10 + Math.floor(r() * 16), top = Math.floor(r() * 26), c = new THREE.Color(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]).multiplyScalar(1.4 + r() * .8);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(x + 1, top, bw - 2, h - top);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + bw - 3, top, 2, h - top);
    g.fillStyle = 'rgba(255,240,200,.12)'; g.fillRect(x + 2, top, 2, h - top);
    if (r() < .7) { g.fillStyle = `rgba(214,170,80,${.5 + r() * .4})`; for (const y of [top + 10 + r() * 8, h - 22 - r() * 10]) g.fillRect(x + 2, y, bw - 5, 3); }
    if (r() < .4) { g.fillStyle = 'rgba(230,220,190,.5)'; g.fillRect(x + 3, top + 30 + r() * 20, bw - 7, 10); }
    g.fillStyle = 'rgba(160,150,130,.35)'; g.fillRect(x + 1, top, bw - 2, 3);
    x += bw;
  }
  spineMap = new THREE.CanvasTexture(canvas); spineMap.colorSpace = THREE.SRGBColorSpace; spineMap.anisotropy = 4;
  return spineMap;
}
// A corner web: threads fanning from the corner, sagging rings between them.
function webTexture() {
  if (webMap) return webMap;
  const s = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = s;
  const g = canvas.getContext('2d'), r = rng(23);
  g.strokeStyle = 'rgba(235,230,220,.85)'; g.lineWidth = 1.3;
  const spokes = 9, angles = Array.from({ length: spokes }, (_, i) => (i / (spokes - 1)) * Math.PI / 2 + (r() - .5) * .06);
  for (const a of angles) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05); g.stroke(); }
  g.lineWidth = 1;
  for (let k = 1; k < 12; k++) {
    const rad = k * s / 12 * (1 + (r() - .5) * .08);
    g.strokeStyle = `rgba(235,230,220,${.75 - k * .035})`; g.beginPath();
    angles.forEach((a, i) => {
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (!i) g.moveTo(x, y); else { const m = (a + angles[i - 1]) / 2, sag = rad * .86; g.quadraticCurveTo(Math.cos(m) * sag, Math.sin(m) * sag, x, y); }
    });
    g.stroke();
  }
  // A torn strand or two hanging loose.
  g.strokeStyle = 'rgba(235,230,220,.5)'; for (let i = 0; i < 3; i++) { const x = 40 + r() * 160; g.beginPath(); g.moveTo(x, x * .4); g.quadraticCurveTo(x + 10, x * .4 + 50, x - 6, x * .4 + 90); g.stroke(); }
  webMap = new THREE.CanvasTexture(canvas); webMap.colorSpace = THREE.SRGBColorSpace;
  return webMap;
}

function instanced(geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = 0; mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
}
function push(mesh, m, color) { const i = mesh.count++; m.updateMatrix(); mesh.setMatrixAt(i, m.matrix); if (color) mesh.setColorAt(i, color); }
function finish(mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); mesh.computeBoundingBox?.(); return mesh; }

// ---------- Bookcases ----------
// cases: [{ x, z, h (rotation), length, height = 3.4, double = true, dust = .5 }]
// The case runs along its local x; a double case shows books on both faces.
export function bookcases(cases, { seed = 1 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Estanterías';
  const unit = new THREE.BoxGeometry(1, 1, 1), lean = new THREE.BoxGeometry(1, 1, 1);
  const frameMat = std(0xffffff, { roughness: .85 }), bookMat = std(0xffffff, { map: spineTexture(), roughness: .95 }), loose = std(0xffffff, { roughness: .9 });
  // Matrices and colours are collected first, so each mesh gets its exact count.
  const frameMesh = [], bookMesh = [], looseMesh = [];
  const m = new THREE.Object3D(), parent = new THREE.Object3D(), col = new THREE.Color(), tmp = new THREE.Object3D();
  const wood = new THREE.Color(WOOD.dark), woodMid = new THREE.Color(WOOD.mid), dust = new THREE.Color(WOOD.dust);
  for (const c of cases) {
    const L = c.length, H = c.height ?? 3.4, D = c.double === false ? .42 : .8, sides = c.double === false ? [1] : [1, -1], levels = Math.floor(H / .42);
    parent.position.set(c.x, 0, c.z); parent.rotation.set(0, c.h || 0, 0); parent.updateMatrix();
    // Parts in the case's frame, then into the world.
    const put = (mesh, x, y, z, sx, sy, sz, color, rz = 0, ry = 0) => {
      tmp.position.set(x, y, z); tmp.rotation.set(0, ry, rz); tmp.scale.set(sx, sy, sz); tmp.updateMatrix();
      mesh.push(new THREE.Matrix4().multiplyMatrices(parent.matrix, tmp.matrix), color.getHex());
    };
    const tint = (base, v = .2) => col.copy(base).multiplyScalar(1 - v / 2 + r() * v);
    // Frame: two end panels, a plinth, a cornice and a dusty top, the back.
    for (const s of [-1, 1]) put(frameMesh, s * (L / 2 - .04), H / 2, 0, .08, H, D, tint(wood));
    put(frameMesh, 0, .06, 0, L, .12, D + .04, tint(wood));
    put(frameMesh, 0, H - .05, 0, L + .12, .1, D + .12, tint(woodMid));
    put(frameMesh, 0, H + .005, 0, L + .1, .01, D + .1, col.copy(dust).lerp(wood, r() * .3));
    const single = sides.length === 1;
    put(frameMesh, 0, H / 2, single ? -D / 2 + .02 : 0, L - .1, H - .2, .04, tint(wood, .1));
    for (let k = 1; k < Math.ceil(L); k++) put(frameMesh, -L / 2 + k * (L / Math.ceil(L)), H / 2, 0, .05, H - .2, D - .02, tint(wood));
    for (let l = 1; l < levels; l++) put(frameMesh, 0, l * (H - .1) / levels + .06, 0, L - .1, .04, D - .02, tint(woodMid));
    // Books: runs of spines on every level and face, some gaps, a few leaning.
    for (const side of sides) for (let l = 0; l < levels; l++) {
      const y0 = l * (H - .1) / levels + .08, room = (H - .1) / levels - .06;
      for (let x = -L / 2 + .1; x < L / 2 - .15;) {
        const w = Math.min(L / 2 - .1 - x, .25 + r() * .45);
        if (r() < .14) { x += w * .6; continue; }
        const bh = room * (.62 + r() * .3), bd = (D / sides.length) * (.55 + r() * .3);
        put(bookMesh, x + w / 2, y0 + bh / 2, single ? -D / 2 + .05 + bd / 2 : side * (.03 + bd / 2), w, bh, bd,
          col.setHSL(0, 0, .55 + r() * .45), 0, side < 0 ? Math.PI : 0);
        x += w;
        if (r() < .12 && x < L / 2 - .3) {
          const lw = .05 + r() * .04, lh = room * (.6 + r() * .3), tilt = (r() < .5 ? -1 : 1) * (.25 + r() * .3);
          put(looseMesh, x + .08, y0 + lh / 2 - .01, single ? -D / 2 + .16 : side * .14, lw, lh, .22, col.setHex(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]), tilt);
          x += .18;
        }
      }
    }
  }
  for (const [geometry, material, list] of [[unit, frameMat, frameMesh], [unit, bookMat, bookMesh], [lean, loose, looseMesh]]) {
    const mesh = instanced(geometry, material, list.length / 2);
    for (let i = 0; i < list.length; i += 2) { mesh.setMatrixAt(i / 2, list[i]); mesh.setColorAt(i / 2, col.setHex(list[i + 1])); }
    mesh.count = list.length / 2; group.add(finish(mesh));
  }
  group.userData.dispose = () => { [unit, lean].forEach(g => g.dispose()); [frameMat, bookMat, loose].forEach(m => m.dispose()); };
  return group;
}
export function bookcase({ length = 3, height = 3.4, double = false, seed = 3 } = {}) {
  return bookcases([{ x: 0, z: 0, h: 0, length, height, double }], { seed });
}

// ---------- Furniture ----------
export function libraryLadder({ height = 3.2 } = {}) {
  const group = new THREE.Group(); group.name = 'Escalera de biblioteca';
  const wood = std(WOOD.light), iron = std(0x2a2a2a, { metalness: .6, roughness: .5 });
  const tilt = .16, rail = new THREE.BoxGeometry(.06, height, .06);
  for (const s of [-1, 1]) { const m = part(group, rail, wood, s * .24, height / 2, -height * tilt / 2); m.rotation.x = tilt; }
  for (let y = .3; y < height - .1; y += .32) { const rung = box(group, wood, .5, .04, .08, 0, y, -y * tilt); rung.rotation.x = tilt; }
  for (const s of [-1, 1]) cyl(group, iron, .05, .05, .04, s * .24, 0, 0, 8).rotation.z = Math.PI / 2;
  box(group, iron, .62, .03, .04, 0, height - .1, -height * tilt + .02);
  return group;
}
// A chair, sometimes knocked over.
function chair(parent, wood, x, z, h, fallen) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = h; parent.add(c);
  box(c, wood, .44, .05, .42, 0, .45, 0);
  for (const [a, b] of [[-.19, -.18], [.19, -.18], [-.19, .18], [.19, .18]]) box(c, wood, .045, .45, .045, a, 0, b);
  box(c, wood, .44, .5, .04, 0, .5, -.2);
  if (fallen) { c.rotation.z = Math.PI / 2; c.position.y = .22; }
  return c;
}
export function readingTable({ length = 5.2, width = 1.2, seed = 4, chairs = true } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Mesa de lectura';
  const wood = std(WOOD.mid), dark = std(WOOD.dark), paper = std(0xd9cdb0), cover = std(0x5a2a22), wax = std(0xe8dcc0);
  box(group, wood, length, .07, width, 0, .78, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, dark, .1, .78, .1, sx * (length / 2 - .2), 0, sz * (width / 2 - .15));
  box(group, dark, length - .5, .06, .06, 0, .2, 0);
  // Open books, loose pages, a candle stub burnt down.
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group(); b.position.set((r() - .5) * (length - 1), .85, (r() - .5) * (width - .4)); b.rotation.y = r() * 6; group.add(b);
    for (const s of [-1, 1]) { const page = box(b, paper, .2, .03, .28, s * .1, 0, 0); page.rotation.z = -s * .08; }
    box(b, cover, .42, .015, .3, 0, -.015, 0);
  }
  for (let i = 0; i < 4; i++) { const p = box(group, paper, .21, .004, .29, (r() - .5) * length * .9, .815, (r() - .5) * width * .8); p.rotation.y = r() * 6; }
  cyl(group, wax, .03, .035, .06, (r() - .5) * length * .6, .815, 0);
  if (chairs) for (let i = 0; i < Math.floor(length / 1.3); i++) for (const s of [-1, 1]) {
    if (r() < .35) continue;
    chair(group, dark, -length / 2 + .7 + i * 1.3 + (r() - .5) * .2, s * (width / 2 + .32), s < 0 ? 0 : Math.PI, r() < .2);
  }
  return group;
}
// A copyist's slanted desk with a stool, an inkwell and pages.
export function scribeDesk({ seed = 5 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Pupitre de copista';
  const wood = std(WOOD.mid), dark = std(WOOD.dark), paper = std(0xd9cdb0), ink = std(0x101418, { roughness: .3 });
  const top = box(group, wood, 1.5, .06, .8, 0, .92, 0); top.rotation.x = -.22;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, dark, .08, .92 + sz * .08, .08, sx * .68, 0, sz * .32);
  box(group, dark, 1.36, .05, .7, 0, .3, 0);
  for (let i = 0; i < 3; i++) { const p = box(group, paper, .24, .005, .32, (r() - .5) * 1.1, 1, (r() - .5) * .3); p.rotation.set(-.22, (r() - .5) * .5, 0); }
  cyl(group, ink, .04, .05, .07, .58, .95, -.28);
  const stool = new THREE.Group(); stool.position.set((r() - .5) * .4, 0, .75); group.add(stool);
  cyl(stool, wood, .22, .22, .05, 0, .5, 0, 10);
  for (let i = 0; i < 3; i++) { const a = i * 2.09; const leg = box(stool, dark, .04, .52, .04, Math.cos(a) * .15, 0, Math.sin(a) * .15); leg.rotation.set(Math.sin(a) * .12, 0, -Math.cos(a) * .12); }
  if (r() < .4) { stool.rotation.z = Math.PI / 2; stool.position.y = .25; }
  return group;
}
export function lectern({ seed = 6, big = false } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = big ? 'Atril maldito' : 'Atril';
  const wood = std(big ? WOOD.dark : WOOD.mid), paper = std(0xd9cdb0), cover = std(big ? 0x2a1010 : 0x4a2a1a), gold = std(0xb08a3a, { metalness: .6, roughness: .45 });
  const s = big ? 1.5 : 1;
  cyl(group, wood, .32 * s, .4 * s, .1, 0, 0, 0, 10);
  cyl(group, wood, .09 * s, .11 * s, 1.0 * s, 0, .1, 0, 8);
  const head = new THREE.Group(); head.position.y = 1.1 * s; head.rotation.x = -.5; group.add(head);
  box(head, wood, .6 * s, .05, .45 * s, 0, 0, 0);
  box(head, wood, .6 * s, .06, .04, 0, 0, .22 * s);
  for (const side of [-1, 1]) { const page = box(head, paper, .27 * s, .035, .36 * s, side * .14 * s, .05, 0); page.rotation.z = -side * .1; }
  box(head, cover, .58 * s, .02, .38 * s, 0, .035, 0);
  if (big) { for (const side of [-1, 1]) { const chain = box(group, gold, .03, .9, .03, side * .45, .2, 0); chain.rotation.z = side * .3; } box(head, gold, .1, .02, .1, 0, .12, 0); }
  if (r() < .5 && !big) { const p = box(group, paper, .21, .004, .29, .3, .002, .2); p.rotation.y = r() * 6; }
  return group;
}
// Floor-standing iron candelabrum. userData.flames: candle-tip points
// (local), for candleFlames().
export function candelabra({ arms = 3, height = 1.7, seed = 7 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Candelabro';
  const iron = std(0x2b2723, { metalness: .55, roughness: .55 }), wax = std(0xe6d9b8, { roughness: .7 }), drip = std(0xd8c9a2);
  for (let i = 0; i < 3; i++) { const a = i * 2.094; const foot = box(group, iron, .05, .05, .32, Math.cos(a) * .12, 0, Math.sin(a) * .12); foot.rotation.y = -a + Math.PI / 2; }
  cyl(group, iron, .03, .035, height, 0, 0, 0, 6);
  const flames = [];
  const tips = arms === 1 ? [[0, 0]] : Array.from({ length: arms }, (_, i) => { const t = (i / (arms - 1) - .5) * 2; return [t * .32, -Math.abs(t) * .08]; });
  box(group, iron, .7, .03, .03, 0, height - .05, 0);
  for (const [x, dy] of tips) {
    cyl(group, iron, .05, .03, .04, x, height + dy, 0, 8);
    const len = .12 + r() * .16;
    cyl(group, wax, .025, .028, len, x, height + dy + .04, 0, 7);
    cyl(group, drip, .032, .02, .04, x, height + dy + .04, 0, 7);
    flames.push(new THREE.Vector3(x, height + dy + .04 + len + .03, 0));
  }
  group.userData.flames = flames;
  return group;
}
// A single candle in a brass stick, for tables and shelves. userData.flames as above.
export function candleStick({ seed = 11 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Vela';
  const brass = std(0x8a6a2a, { metalness: .6, roughness: .45 }), wax = std(0xe6d9b8, { roughness: .7 });
  cyl(group, brass, .07, .08, .015, 0, 0, 0, 10); cyl(group, brass, .015, .02, .07, 0, .015, 0, 6); cyl(group, brass, .035, .02, .02, 0, .085, 0, 8);
  const len = .08 + r() * .12; cyl(group, wax, .02, .022, len, 0, .1, 0, 7);
  group.userData.flames = [new THREE.Vector3(0, .1 + len + .025, 0)];
  return group;
}
// The chandelier that no one has lit in a century: an iron ring on chains,
// dead candles, a web. `drop` is how far it hangs below `ceiling`.
export function chandelier({ ceiling = 4.6, drop = 1.7, seed = 8 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Lámpara de araña';
  const iron = std(0x2b2723, { metalness: .55, roughness: .55 }), wax = std(0xcfc2a0);
  const y = ceiling - drop, ring = new THREE.Mesh(new THREE.TorusGeometry(.9, .04, 6, 24), iron); ring.rotation.x = Math.PI / 2; ring.position.y = y; group.add(ring);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(.45, .03, 6, 16), iron); inner.rotation.x = Math.PI / 2; inner.position.y = y + .25; group.add(inner);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4, chain = box(group, iron, .025, drop, .025, Math.cos(a) * .45, y, Math.sin(a) * .45); chain.rotation.set(Math.sin(a) * .25, 0, -Math.cos(a) * .25); }
  box(group, iron, .03, .4, .03, 0, ceiling - .4, 0);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (r() < .2) continue; cyl(group, wax, .025, .03, .06 + r() * .1, Math.cos(a) * .9, y + .02, Math.sin(a) * .9, 6); }
  return group;
}
// A tattered curtain: a hanging cloth whose hem is torn into tongues.
export function tornCurtain({ width = 2.4, height = 3.2, seed = 9, color = 0x4a1a1e } = {}) {
  const r = rng(seed), segX = 18, segY = 10, geometry = new THREE.PlaneGeometry(width, height, segX, segY), pos = geometry.attributes.position;
  const tongues = Array.from({ length: segX + 1 }, () => r());
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), col = Math.round((x / width + .5) * segX), down = (height / 2 - y) / height;
    pos.setZ(i, Math.sin(x * 4.2 + r() * .3) * .08 + down * down * (r() - .5) * .12);
    // Torn hem: the lower part of some columns rides up into ragged tongues.
    if (down > .7) pos.setY(i, y + tongues[col] ** 3 * height * .22 * (down - .7) / .3);
  }
  geometry.computeVertexNormals();
  const cloth = std(color, { side: THREE.DoubleSide, roughness: 1 }), rod = std(0x2b2723, { metalness: .5 });
  const group = new THREE.Group(); group.name = 'Cortina rasgada';
  part(group, geometry, cloth, 0, height / 2 + .1, 0);
  cyl(group, rod, .025, .025, width + .3, 0, height + .1, 0, 6).rotation.z = Math.PI / 2;
  return group;
}
// A secret door that is a bookcase: it swings on `userData.hinge` (open:
// hinge.rotation.y = ±1.45). Its origin is the middle of the doorway.
export function bookcaseDoor({ width = 4, height = 3.6, seed = 10 } = {}) {
  const group = new THREE.Group(); group.name = 'Estante secreto';
  const hinge = new THREE.Group(); hinge.position.x = -width / 2; group.add(hinge);
  const cases = bookcases([{ x: width / 2, z: 0, h: 0, length: width, height, double: false }], { seed });
  hinge.add(cases);
  group.userData = { hinge, dispose: () => cases.userData.dispose() };
  return group;
}

// ---------- Cobwebs ----------
// list: [{ x, y, z, h, size = 1, tilt = 0 }], each a web card filling a
// corner: its top-left corner at the point, spreading down and along +x.
export function cobwebs(list, { opacity = .42 } = {}) {
  const geometry = new THREE.PlaneGeometry(1, 1).translate(.5, -.5, 0);
  const material = owned(new THREE.MeshLambertMaterial({ map: webTexture(), color: 0xa49e90, transparent: true, opacity, alphaTest: .04, depthWrite: false, side: THREE.DoubleSide }));
  const mesh = instanced(geometry, material, list.length), m = new THREE.Object3D();
  for (const w of list) { m.position.set(w.x, w.y, w.z); m.rotation.set(w.tilt || 0, w.h || 0, 0, 'YXZ'); m.scale.setScalar(w.size || 1); push(mesh, m); }
  finish(mesh); mesh.receiveShadow = false; mesh.renderOrder = 2; mesh.name = 'Telarañas';
  mesh.userData.dispose = () => { geometry.dispose(); material.dispose(); };
  return mesh;
}
export function cobweb({ size = 1.2 } = {}) {
  const group = new THREE.Group(); group.name = 'Telaraña';
  group.add(cobwebs([{ x: -size / 2, y: size, z: 0, h: 0, size }, { x: -size / 2, y: size, z: 0, h: -Math.PI / 2, size: size * .8, tilt: .3 }]));
  return group;
}

// ---------- Candle flames ----------
// points: [Vector3 | {x, y, z}]. Two additive billboard layers (a bright
// core and a soft halo) in one InstancedMesh each; the flicker, the global
// level and the blow-outs all live in the shader, so nothing is allocated
// per frame. userData: tick(t), level(v 0..1), blowOut(x, z, radius, amount 0..1),
// fog(near, far).
const FLAME_VERTEX = `
  uniform float uTime, uLevel, uFogNear, uFogFar; uniform vec4 uOut; uniform vec2 uSize; uniform float uLift;
  varying vec2 vUv; varying float vLife;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float phase = fract(sin(dot(world.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
    float flick = 0.84 + 0.1 * sin(uTime * 11.0 + phase) + 0.07 * sin(uTime * 23.0 + phase * 1.7) + 0.05 * sin(uTime * 3.1 + phase * 3.0);
    float gone = (1.0 - smoothstep(uOut.z * 0.6, uOut.z, distance(world.xz, uOut.xy))) * uOut.w;
    float life = (1.0 - gone) * uLevel;
    vec4 mv = viewMatrix * world;
    vec2 size = uSize * flick * mix(0.2, 1.0, life);
    mv.xy += vec2(position.x * size.x, (position.y + uLift) * size.y);
    gl_Position = projectionMatrix * mv;
    vUv = uv;
    vLife = life * flick * (1.0 - smoothstep(uFogNear, uFogFar, -mv.z));
  }`;
const FLAME_FRAGMENT = `
  uniform vec3 uColor, uCore; uniform float uFalloff, uGain;
  varying vec2 vUv; varying float vLife;
  void main() {
    vec2 p = vUv * 2.0 - 1.0; p.y = p.y < 0.0 ? p.y * 1.6 : p.y * 0.8;
    float a = pow(max(0.0, 1.0 - length(p)), uFalloff);
    gl_FragColor = vec4(mix(uColor, uCore, a) * a * vLife * uGain, 1.0);
  }`;
export function candleFlames(points) {
  const group = new THREE.Group(); group.name = 'Velas';
  const geometry = new THREE.PlaneGeometry(1, 1), shared = { uTime: { value: 0 }, uLevel: { value: 1 }, uOut: { value: new THREE.Vector4(0, 0, 1, 0) }, uFogNear: { value: 4 }, uFogFar: { value: 24 } };
  const layer = (size, lift, falloff, gain, color, core) => {
    const material = owned(new THREE.ShaderMaterial({
      uniforms: { ...shared, uSize: { value: new THREE.Vector2(...size) }, uLift: { value: lift }, uFalloff: { value: falloff }, uGain: { value: gain }, uColor: { value: new THREE.Color(color) }, uCore: { value: new THREE.Color(core) } },
      vertexShader: FLAME_VERTEX, fragmentShader: FLAME_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const mesh = instanced(geometry, material, points.length), m = new THREE.Object3D();
    for (const p of points) { m.position.set(p.x, p.y, p.z); push(mesh, m); }
    finish(mesh); mesh.frustumCulled = false; mesh.receiveShadow = false; mesh.renderOrder = 3;
    group.add(mesh); return material;
  };
  const materials = [layer([.08, .2], .35, 1.1, 1.9, 0xff8a2a, 0xfff2c0), layer([1.1, 1.1], 0, 2.2, .5, 0xff7a1a, 0xffb050)];
  group.userData = {
    count: points.length,
    tick(t) { shared.uTime.value = t; },
    level(v) { shared.uLevel.value = v; },
    blowOut(x, z, radius, amount) { shared.uOut.value.set(x, z, radius, amount); },
    fog(near, far) { shared.uFogNear.value = near; shared.uFogFar.value = far; },
    dispose() { geometry.dispose(); materials.forEach(m => m.dispose()); },
  };
  return group;
}

// ---------- Dust in a lamp beam ----------
// Camera-local motes in front of the eye; they show where the beam is.
// userData.tick(t), userData.strength(v 0..1).
export function dustMotes({ count = 260, seed = 12 } = {}) {
  const r = rng(seed), positions = new Float32Array(count * 3), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) { positions.set([(r() - .5) * 3.2, (r() - .5) * 2.2 - .2, -.6 - r() * 6], i * 3); phases[i] = r() * 100; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const uniforms = { uTime: { value: 0 }, uStrength: { value: 1 }, uScale: { value: 300 } };
  const material = owned(new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime, uScale; attribute float phase; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * .21 + phase) * .25, mod(-uTime * .05 + phase, 2.2) - 1.1 + sin(uTime * .4 + phase * 2.) * .05, cos(uTime * .17 + phase) * .25);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float beam = 1.0 - smoothstep(.18, .5, length(p.xy / max(.6, -p.z)));
        vA = beam * smoothstep(.5, 1.2, -p.z) * (1.0 - smoothstep(4.5, 6.5, -p.z));
        gl_PointSize = uScale * .012 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uStrength; varying float vA;
      void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1.0, .9, .72) * (1.0 - smoothstep(.2, .5, d)) * vA * uStrength * .55, 1.0); }`,
  }));
  const points = new THREE.Points(geometry, material); points.name = 'Polvo'; points.frustumCulled = false; points.renderOrder = 4;
  points.userData = { tick(t) { uniforms.uTime.value = t; }, strength(v) { uniforms.uStrength.value = v; }, scale(px) { uniforms.uScale.value = px; }, dispose() { geometry.dispose(); material.dispose(); } };
  return points;
}

// Studio preview: a short aisle between two double cases, a candelabrum
// and webs, without a ceiling.
export function libraryAisle() {
  const group = new THREE.Group(); group.name = 'Pasillo de la biblioteca';
  group.add(bookcases([{ x: 0, z: -1.5, h: 0, length: 4 }, { x: 0, z: 1.5, h: 0, length: 4 }], { seed: 2 }));
  const c = candelabra({}); c.position.set(2.6, 0, 0); group.add(c);
  const flames = candleFlames(c.userData.flames.map(p => p.clone().add(c.position))); group.add(flames);
  group.add(cobwebs([{ x: -2, y: 3.45, z: -1.1, h: 0, size: 1 }, { x: 1.2, y: 3.45, z: 1.1, h: Math.PI, size: .8 }]));
  const ladder = libraryLadder({}); ladder.position.set(-.8, 0, -1.05); ladder.rotation.y = Math.PI; group.add(ladder);
  group.userData.tick = t => flames.userData.tick(t);
  group.userData.previewBounds = [[-3, 0, -2.5], [3, 3.6, 2.5]];
  return group;
}
