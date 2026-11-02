// La biblioteca sepultada: an old, abandoned library buried under the mine,
// for Reliquia's library jornadas and anything else that wants cold, dusty
// stacks. Metres, +Y up, +Z forward, origin on the floor.
//
//   bookcases(cases, { seed })   every bookcase of a room in a few draw calls;
//                                case.variant: plain, arched, pillar, ladder,
//                                collapsed (leaning, books spilled), low
//   bookcase({ length, height, double, variant })   one, for Studio
//   libraryLadder, readingTable, scribeDesk, lectern, candelabra, candleStick,
//   chandelier (lit: userData.flames), hangingLantern, armchair, tallWindow,
//   tornCurtain, bookcaseDoor (a hinged case for a secret passage)
//   cobwebs(list) / cobweb()     sheer webs, instanced: corner fans, sagging
//                                sheets under the ceiling, hanging drapes; a
//                                shared uniform sways them (userData.tick)
//   candleFlames(points)         every small flame of a level, one shader:
//                                flicker, blow-outs and a global dim
//   dustMotes()                  pale motes drifting around the eye, brighter
//                                in a lamp beam
//   rugs(list), groundMist(list) worn rugs and low drifting mist, instanced
//
// Small props are plain-coloured boxes and cylinders, so a level can bake
// them into a handful of batches (engine/models/core/static-batch.js); the
// instanced pieces (cases, webs, flames, rugs, mist) must stay out of `bake`.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';
import { stoneTexture } from '/engine/models/props/reliquia-ruins.js';

// Cold and desaturated: grey-brown wood with a hint of plum, cold stone,
// dull brass, faded spines. Warmth is left to a few small flames.
export const LIBRARY_COLORS = { dark: 0x342a2e, mid: 0x44383c, light: 0x54474b, dust: 0x7a7c82, stone: 0x4a5260, iron: 0x24252a, brass: 0x6a6046, paper: 0xb4ae9e, wax: 0xcfc8b6 };
const WOOD = LIBRARY_COLORS;
const BOOK_COLORS = [0x4a2a2c, 0x2e3a2c, 0x2c3446, 0x4a3e2c, 0x3c2a36, 0x5a5448, 0x2a2826, 0x46342c, 0x34444a, 0x50464a];
const owned = (m) => { m.userData.reliquiaOwned = true; return m; };
// Matte Lambert: old dusty wood, cloth and iron have no sheen, and a
// specular highlight would turn dark wood pale in a headlamp.
const std = (color, { roughness, metalness, ...extra } = {}) => owned(new THREE.MeshLambertMaterial({ color, ...extra }));
function part(parent, geometry, material, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m; }
const box = (parent, material, w, h, d, x, y, z) => part(parent, new THREE.BoxGeometry(w, h, d), material, x, y + h / 2, z);
const cyl = (parent, material, r0, r1, h, x, y, z, seg = 8) => part(parent, new THREE.CylinderGeometry(r0, r1, h, seg), material, x, y + h / 2, z);

// ---------- Textures, painted once ----------
const painted = new Map();
const paint = (key, w, h, draw, setup = t => t) => {
  if (painted.has(key)) return painted.get(key);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  draw(canvas.getContext('2d'), rng(key.length * 97 + w));
  const texture = setup(new THREE.CanvasTexture(canvas)); painted.set(key, texture); return texture;
};
// A strip of book spines: faded cloth and leather, dull bands, dusty tops.
// A run of about seven spines (a run box is a quarter metre or so, so each
// spine is a few centimetres): faded cloth and leather, dull bands, dusty tops.
const spineTexture = () => paint('spines', 256, 128, (g, r) => {
  g.fillStyle = '#0c0a0b'; g.fillRect(0, 0, 256, 128);
  const grey = new THREE.Color(0x5a5a5e);
  for (let x = 0; x < 256;) {
    const bw = Math.min(256 - x, 26 + Math.floor(r() * 20)), top = Math.floor(r() * 30), c = new THREE.Color(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]).lerp(grey, .2 + r() * .25).multiplyScalar(1.05 + r() * .45);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(x + 1, top, bw - 2, 128 - top);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x + bw - 4, top, 3, 128 - top);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 2, top, 3, 128 - top);
    if (r() < .6) { g.fillStyle = `rgba(160,150,120,${.2 + r() * .3})`; for (const y of [top + 9 + r() * 8, 108 - r() * 10]) g.fillRect(x + 3, y, bw - 7, 3); }
    if (r() < .4) { g.fillStyle = 'rgba(190,190,180,.25)'; g.fillRect(x + 5, top + 30 + r() * 24, bw - 11, 12); }
    g.fillStyle = 'rgba(160,164,170,.55)'; g.fillRect(x + 1, top, bw - 2, 5);
    x += bw;
  }
}, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
// Sheer webs, white on clear: `corner` fans out of a corner, `sheet` is a
// messy net sagging between two edges, `drape` hangs in long strands.
function thread(g, x0, y0, x1, y1, sag, alpha, width = 1) {
  g.strokeStyle = `rgba(235,238,242,${alpha})`; g.lineWidth = width; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1); g.stroke();
}
const webTexture = kind => paint(`web-${kind}`, 256, 256, (g, r) => {
  const s = 256;
  if (kind === 'corner') {
    const spokes = 11, angles = Array.from({ length: spokes }, (_, i) => (i / (spokes - 1)) * Math.PI / 2 + (r() - .5) * .08);
    for (const a of angles) thread(g, 0, 0, Math.cos(a) * s * 1.05, Math.sin(a) * s * 1.05, 0, .55 + r() * .3, 1.1);
    for (let k = 1; k < 16; k++) {
      const rad = k * s / 16 * (1 + (r() - .5) * .1);
      angles.forEach((a, i) => {
        if (!i || r() < .12) return;  // broken threads
        const b = angles[i - 1], sag = rad * .1 * (1 + r());
        thread(g, Math.cos(b) * rad, Math.sin(b) * rad, Math.cos(a) * rad, Math.sin(a) * rad, sag, .5 - k * .02, .8);
      });
    }
    for (let i = 0; i < 5; i++) { const x = 30 + r() * 180; thread(g, x, x * (.2 + r() * .6), x + (r() - .5) * 40, x * .5 + 60 + r() * 90, 10, .35, .7); }
  } else if (kind === 'sheet') {
    // Long threads strung edge to edge, sagging, tangled into a gauze.
    for (let i = 0; i < 70; i++) { const y0 = r() * s * .3, y1 = r() * s * .3; thread(g, 0, y0, s, y1, 60 + r() * 140, .18 + r() * .35, .6 + r() * .7); }
    for (let i = 0; i < 40; i++) { const x = r() * s, y = r() * s * .6; thread(g, x, y, x + (r() - .5) * 120, y + 40 + r() * 80, 20, .15 + r() * .3, .6); }
    // A couple of fans tucked in, and loose wisps dangling from the middle.
    for (let f = 0; f < 3; f++) { const cx = 30 + r() * 200, cy = 20 + r() * 60; for (let k = 0; k < 9; k++) { const a = Math.PI * (.15 + k * .08); thread(g, cx, cy, cx + Math.cos(a) * 70, cy + Math.sin(a) * 70, 0, .3, .7); } }
    for (let i = 0; i < 14; i++) { const x = 40 + r() * 176, y = s * (.3 + r() * .25); thread(g, x, y, x + (r() - .5) * 20, y + 30 + r() * 70, 6, .28, .6); }
  } else {
    // Drape: strands from the top edge, frayed, fading down.
    for (let i = 0; i < 60; i++) {
      const x = r() * s, len = s * (.35 + r() * .65), sway = (r() - .5) * 30;
      const grad = g.createLinearGradient(0, 0, 0, len); grad.addColorStop(0, `rgba(235,238,242,${.45 + r() * .35})`); grad.addColorStop(1, 'rgba(235,238,242,0)');
      g.strokeStyle = grad; g.lineWidth = .6 + r() * .9; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + sway * .3, len * .3, x + sway, len * .7, x + sway * .8, len); g.stroke();
    }
    for (let i = 0; i < 22; i++) { const y = r() * s * .55, x = r() * s; thread(g, x, y, x + 20 + r() * 60, y + (r() - .5) * 10, 8, .2, .6); }
  }
}, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; });
// A worn rug: a border, a faded medallion, a grain of wear, frayed ends.
const rugTexture = () => paint('rug', 256, 256, (g, r) => {
  g.fillStyle = '#d8d4d0'; g.fillRect(8, 0, 240, 256);
  g.strokeStyle = 'rgba(70,64,64,.8)'; g.lineWidth = 10; g.strokeRect(22, 18, 212, 220);
  g.strokeStyle = 'rgba(150,140,130,.8)'; g.lineWidth = 3; g.strokeRect(36, 32, 184, 192);
  g.fillStyle = 'rgba(90,80,80,.7)'; g.beginPath(); g.ellipse(128, 128, 54, 70, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(200,190,180,.8)'; g.beginPath(); g.ellipse(128, 128, 30, 42, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(90,80,80,.6)'; g.beginPath(); g.arc(i % 2 ? 60 : 196, i < 2 ? 60 : 196, 14, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${r() < .5 ? '240,240,240' : '40,36,36'},${r() * .14})`; g.fillRect(r() * 256, r() * 256, 2, 1); }
  for (let i = 0; i < 6; i++) { const x = r() * 256, y = r() * 256, gr = g.createRadialGradient(x, y, 0, x, y, 20 + r() * 40); gr.addColorStop(0, 'rgba(220,220,225,.35)'); gr.addColorStop(1, 'rgba(220,220,225,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
  // Fringe: threads off both short ends, some missing; bites out of an edge.
  g.fillStyle = '#c8c4bc'; for (const y of [0, 248]) for (let x = 10; x < 246; x += 4) if (r() < .8) g.fillRect(x, y + (y ? 0 : 8 - 8 * r()), 2, 4 + r() * 6);
  g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(r() < .5 ? 8 : 248, r() * 256, 6 + r() * 10, 0, Math.PI * 2); g.fill(); }
}, t => { t.colorSpace = THREE.SRGBColorSpace; return t; });
// Soft mist: fbm blobs with a round falloff.
const mistTexture = () => paint('mist', 128, 128, (g, r) => {
  for (let i = 0; i < 60; i++) { const x = 20 + r() * 88, y = 20 + r() * 88, rad = 10 + r() * 30, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(255,255,255,${.12 + r() * .12})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
}, t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; });

function instanced(geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = 0; mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
}
function push(mesh, m, color) { const i = mesh.count++; m.updateMatrix(); mesh.setMatrixAt(i, m.matrix); if (color) mesh.setColorAt(i, color); }
function finish(mesh) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere(); mesh.computeBoundingBox?.(); return mesh; }

// ---------- Bookcases ----------
// An arch panel for a bay: a unit-wide header with a round-topped opening.
let archGeometry = null;
function arch() {
  if (archGeometry) return archGeometry;
  const s = new THREE.Shape(), w = .42, spring = .38;
  s.moveTo(-.5, 0); s.lineTo(-w, 0); s.lineTo(-w, spring); s.absarc(0, spring, w, Math.PI, 0, true); s.lineTo(w, 0); s.lineTo(.5, 0); s.lineTo(.5, 1); s.lineTo(-.5, 1); s.lineTo(-.5, 0);
  // A flat panel facing out of the bay: an extruded one cost ten times the triangles.
  archGeometry = new THREE.ShapeGeometry(s, 6).translate(0, 0, .05);
  return archGeometry;
}
// cases: [{ x, z, h (rotation), length, height = 3.4, double = true, variant = 'plain', fill = .6 }]
// The case runs along its local x; a double case shows books on both faces.
export const CASE_VARIANTS = ['plain', 'arched', 'pillar', 'ladder', 'collapsed', 'low'];
export function bookcases(cases, { seed = 1 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Estanterías';
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const frameMat = std(0xffffff, { roughness: .88 }), bookMat = std(0xffffff, { map: spineTexture(), roughness: .95 }), loose = std(0xffffff, { roughness: .9 });
  const stoneMat = std(0xffffff, { map: stoneTexture('slab'), roughness: .95 });
  // Matrices and colours are collected first, so each mesh gets its exact count.
  const lists = { frame: [], book: [], loose: [], arch: [], stone: [] };
  const parent = new THREE.Object3D(), tmp = new THREE.Object3D(), col = new THREE.Color();
  const wood = new THREE.Color(WOOD.dark), woodMid = new THREE.Color(WOOD.mid), woodLight = new THREE.Color(WOOD.light), dust = new THREE.Color(WOOD.dust), stone = new THREE.Color(WOOD.stone);
  for (const c of cases) {
    const variant = c.variant || 'plain', low = variant === 'low', H = low ? 1.3 : c.height ?? 3.4, single = c.double === false, D = single ? .42 : .8, sides = single ? [1] : [1, -1];
    const fill = (c.fill ?? .6) * (variant === 'collapsed' ? .45 : 1);
    // Leaning: a collapsed case tips toward one face.
    const tip = variant === 'collapsed' ? (c.tip || (r() < .5 ? -1 : 1)) * (.12 + r() * .07) : 0;
    parent.position.set(c.x, 0, c.z); parent.rotation.set(tip, c.h || 0, 0, 'YXZ'); parent.updateMatrix();
    const put = (list, x, y, z, sx, sy, sz, color, rz = 0, ry = 0, rx = 0) => {
      tmp.position.set(x, y, z); tmp.rotation.set(rx, ry, rz); tmp.scale.set(sx, sy, sz); tmp.updateMatrix();
      list.push(new THREE.Matrix4().multiplyMatrices(parent.matrix, tmp.matrix), color.getHex());
    };
    const tint = (base, v = .2) => col.copy(base).multiplyScalar(1 - v / 2 + r() * v);
    // Stone pillars at both ends take a bite out of the case.
    const pillar = variant === 'pillar' && c.length > 2.4, pw = .52;
    const L = pillar ? c.length - pw * 2 : c.length;
    if (pillar) for (const s of [-1, 1]) {
      const px = s * (c.length / 2 - pw / 2), ph = (c.pillarHeight || H + .9);
      put(lists.stone, px, ph / 2, 0, pw - .08, ph, Math.min(D, .62) - .04, tint(stone, .25));
      put(lists.stone, px, .1, 0, pw, .2, Math.min(D, .62) + .06, tint(stone, .2));
      put(lists.stone, px, ph - .18, 0, pw + .06, .18, Math.min(D, .62) + .1, tint(stone, .2));
      put(lists.stone, px, ph - .04, 0, pw + .14, .08, Math.min(D, .62) + .16, tint(stone, .15));
    }
    // Frame: end panels, a plinth, a cornice with a dusty top, the back.
    const bays = Math.max(1, Math.round(L / (low ? 1.2 : .95))), bayW = (L - .1) / bays;
    for (const s of [-1, 1]) put(lists.frame, s * (L / 2 - .04), H / 2, 0, .08, H, D, tint(wood));
    put(lists.frame, 0, .07, 0, L, .14, D + .04, tint(wood));
    put(lists.frame, 0, H - .06, 0, L + .12, .12, D + .12, tint(woodMid));
    put(lists.frame, 0, H - .14, 0, L + .04, .04, D + .08, tint(woodLight));
    put(lists.frame, 0, H + .006, 0, L + .1, .012, D + .1, col.copy(dust).lerp(wood, r() * .4));
    put(lists.frame, 0, H / 2, single ? -D / 2 + .02 : 0, L - .1, H - .2, .04, tint(wood, .1));
    // Carved mullions between bays, standing proud of the shelves.
    for (let k = 1; k < bays; k++) for (const side of sides) put(lists.frame, -L / 2 + .05 + k * bayW, H / 2, side * (D / 2 - .02), .07, H - .16, .06, tint(woodMid));
    if (!single) for (let k = 1; k < bays; k++) put(lists.frame, -L / 2 + .05 + k * bayW, H / 2, 0, .04, H - .2, D - .04, tint(wood));
    const archH = variant === 'arched' && !low ? Math.min(.75, bayW * .8) : 0;
    if (archH) for (let k = 0; k < bays; k++) for (const side of sides) put(lists.arch, -L / 2 + .05 + (k + .5) * bayW, H - .16 - archH, side * (D / 2 - .03) - (side < 0 ? 0 : .05), bayW, archH, 1, tint(woodMid, .15), 0, side < 0 ? Math.PI : 0);
    const levels = Math.max(2, Math.floor((H - archH * .5) / .44)), levelH = (H - .2 - archH * .4) / levels;
    for (let l = 1; l < levels + (archH ? 1 : 0); l++) put(lists.frame, 0, .14 + l * levelH, 0, L - .1, .035, D - .02, tint(woodMid));
    // Books, bay by bay: dusty runs that lean, flat stacks, gaps, empty shelves.
    for (const side of sides) for (let l = 0; l < levels; l++) for (let k = 0; k < bays; k++) {
      const y0 = .16 + l * levelH, room = levelH - .05, bx0 = -L / 2 + .09 + k * bayW, bx1 = bx0 + bayW - .08, depth = (D / sides.length) * .8;
      const z = d => single ? -D / 2 + .06 + d / 2 : side * (.03 + d / 2);
      if (r() > fill) { if (r() < .3) put(lists.loose, bx0 + .1 + r() * (bayW - .3), y0 + .02, z(.18), .22, .04, .17, col.setHex(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]), 0, r() * .4); continue; }
      let x = r() < .5 ? bx0 : bx0 + r() * bayW * .3;
      const end = Math.min(bx1, x + bayW * (.5 + r() * .5));
      while (x < end - .05) {
        const w = Math.min(end - x, .18 + r() * .2), bh = room * (.62 + r() * .32), bd = depth * (.7 + r() * .3);
        put(lists.book, x + w / 2, y0 + bh / 2, z(bd), w, bh, bd, col.setHSL(0, 0, .42 + r() * .38), 0, side < 0 ? Math.PI : 0);
        x += w + (r() < .25 ? .04 + r() * .08 : 0);
      }
      // The last book of a run leans on it; the rest of the bay holds a stack or nothing.
      if (r() < .45 && x < bx1 - .1) { const lh = room * (.6 + r() * .3), tilt = -(.25 + r() * .35); put(lists.loose, x + .06, y0 + lh / 2 * Math.cos(tilt) - .01, z(.2), .05, lh, .2, col.setHex(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]), tilt); x += .16; }
      if (r() < .5 && bx1 - x > .26) { const n = 2 + Math.floor(r() * 4), sx = x + .02 + (bx1 - x - .26) * r(); for (let i = 0; i < n; i++) put(lists.loose, sx + .12, y0 + .02 + i * .045, z(.17), .22 + r() * .04, .04, .16 + r() * .03, col.setHex(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]).multiplyScalar(.9 + r() * .3), 0, (r() - .5) * .3); }
    }
    // A collapsed case has spilled its books across the floor on the side it tips to.
    if (variant === 'collapsed') {
      const toward = Math.sign(tip) || 1;
      parent.rotation.set(0, c.h || 0, 0); parent.updateMatrix();
      for (let i = 0; i < 22; i++) put(lists.loose, (r() - .5) * L, .03 + r() * .05, toward * (D / 2 + .2 + r() * r() * 1.3), .2 + r() * .08, .04 + r() * .03, .15 + r() * .04, col.setHex(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]), (r() - .5) * .3, r() * 3, (r() - .5) * .3);
      for (let i = 0; i < 3; i++) put(lists.frame, (r() - .5) * L * .8, .03, toward * (D / 2 + .3 + r() * .6), .7 + r() * .4, .035, D - .1, tint(woodMid), 0, (r() - .5) * .8);
    }
  }
  const meshes = [[unit, frameMat, lists.frame], [unit, bookMat, lists.book], [unit, loose, lists.loose], [arch(), frameMat, lists.arch], [unit, stoneMat, lists.stone]];
  for (const [geometry, material, list] of meshes) {
    if (!list.length) continue;
    const mesh = instanced(geometry, material, list.length / 2);
    for (let i = 0; i < list.length; i += 2) { mesh.setMatrixAt(i / 2, list[i]); mesh.setColorAt(i / 2, col.setHex(list[i + 1])); }
    mesh.count = list.length / 2; group.add(finish(mesh));
  }
  group.userData.dispose = () => { unit.dispose(); [frameMat, bookMat, loose, stoneMat].forEach(m => m.dispose()); };
  return group;
}
export function bookcase({ length = 3, height = 3.4, double = false, variant = 'arched', seed = 3 } = {}) {
  return bookcases([{ x: 0, z: 0, h: 0, length, height, double, variant, fill: .7 }], { seed });
}
// Every variant side by side, for Studio.
export function shelfVariants() {
  const group = new THREE.Group(); group.name = 'Variantes de estantería';
  const cases = CASE_VARIANTS.map((variant, i) => ({ x: (i - 2.5) * 3.4, z: 0, h: 0, length: 3, height: 3.4, double: false, variant, fill: .7 }));
  group.add(bookcases(cases, { seed: 5 }));
  const ladder = libraryLadder({ height: 3.2 }); ladder.position.set(cases[3].x, 0, .7); ladder.rotation.y = Math.PI; group.add(ladder);
  group.userData.previewBounds = [[-11, 0, -2], [11, 4.4, 2.5]];
  return group;
}

// ---------- Furniture ----------
export function libraryLadder({ height = 3.2 } = {}) {
  const group = new THREE.Group(); group.name = 'Escalera de biblioteca';
  const wood = std(WOOD.light), iron = std(WOOD.iron, { metalness: .5, roughness: .6 });
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
  const wood = std(WOOD.mid), dark = std(WOOD.dark), paper = std(WOOD.paper), cover = std(0x3a2a2c), dust = std(WOOD.dust);
  box(group, wood, length, .07, width, 0, .78, 0);
  box(group, dust, length - .1, .005, width - .1, 0, .85, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(group, dark, .1, .78, .1, sx * (length / 2 - .2), 0, sz * (width / 2 - .15));
  box(group, dark, length - .5, .06, .06, 0, .2, 0);
  // Open books, loose pages, a stack left behind.
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Group(); b.position.set((r() - .5) * (length - 1), .86, (r() - .5) * (width - .4)); b.rotation.y = r() * 6; group.add(b);
    for (const s of [-1, 1]) { const page = box(b, paper, .2, .03, .28, s * .1, 0, 0); page.rotation.z = -s * .08; }
    box(b, cover, .42, .015, .3, 0, -.015, 0);
  }
  for (let i = 0; i < 4; i++) { const p = box(group, paper, .21, .004, .29, (r() - .5) * length * .9, .855, (r() - .5) * width * .8); p.rotation.y = r() * 6; }
  for (let i = 0; i < 3 + Math.floor(r() * 3); i++) box(group, std(BOOK_COLORS[i % BOOK_COLORS.length]), .24, .045, .17, length * .3, .855 + i * .046, -width * .2).rotation.y = (r() - .5) * .4;
  if (chairs) for (let i = 0; i < Math.floor(length / 1.3); i++) for (const s of [-1, 1]) {
    if (r() < .35) continue;
    chair(group, dark, -length / 2 + .7 + i * 1.3 + (r() - .5) * .2, s * (width / 2 + .32), s < 0 ? 0 : Math.PI, r() < .3);
  }
  return group;
}
// A copyist's slanted desk with a stool, an inkwell and pages.
export function scribeDesk({ seed = 5 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Pupitre de copista';
  const wood = std(WOOD.mid), dark = std(WOOD.dark), paper = std(WOOD.paper), ink = std(0x101418, { roughness: .3 });
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
  const wood = std(big ? WOOD.dark : WOOD.mid), paper = std(WOOD.paper), cover = std(big ? 0x2a1416 : 0x3a2a2a), brass = std(WOOD.brass, { metalness: .5, roughness: .5 });
  const s = big ? 1.5 : 1;
  cyl(group, wood, .32 * s, .4 * s, .1, 0, 0, 0, 10);
  cyl(group, wood, .09 * s, .11 * s, 1.0 * s, 0, .1, 0, 8);
  const head = new THREE.Group(); head.position.y = 1.1 * s; head.rotation.x = -.5; group.add(head);
  box(head, wood, .6 * s, .05, .45 * s, 0, 0, 0);
  box(head, wood, .6 * s, .06, .04, 0, 0, .22 * s);
  for (const side of [-1, 1]) { const page = box(head, paper, .27 * s, .035, .36 * s, side * .14 * s, .05, 0); page.rotation.z = -side * .1; }
  box(head, cover, .58 * s, .02, .38 * s, 0, .035, 0);
  if (big) { for (const side of [-1, 1]) { const chain = box(group, brass, .03, .9, .03, side * .45, .2, 0); chain.rotation.z = side * .3; } box(head, brass, .1, .02, .1, 0, .12, 0); }
  if (r() < .5 && !big) { const p = box(group, paper, .21, .004, .29, .3, .002, .2); p.rotation.y = r() * 6; }
  return group;
}
// Floor-standing iron candelabrum. userData.flames: candle-tip points (local).
export function candelabra({ arms = 3, height = 1.7, seed = 7 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Candelabro';
  const iron = std(WOOD.iron, { metalness: .5, roughness: .6 }), wax = std(WOOD.wax, { roughness: .7 }), drip = std(0xbdb6a4);
  for (let i = 0; i < 3; i++) { const a = i * 2.094; const foot = box(group, iron, .05, .05, .32, Math.cos(a) * .12, 0, Math.sin(a) * .12); foot.rotation.y = -a + Math.PI / 2; }
  cyl(group, iron, .03, .035, height, 0, 0, 0, 6);
  const flames = [];
  const tips = arms === 1 ? [[0, 0]] : Array.from({ length: arms }, (_, i) => { const t = (i / (arms - 1) - .5) * 2; return [t * .32, -Math.abs(t) * .08]; });
  box(group, iron, .7, .03, .03, 0, height - .05, 0);
  for (const [x, dy] of tips) {
    cyl(group, iron, .05, .03, .04, x, height + dy, 0, 8);
    const len = .06 + r() * .16;
    cyl(group, wax, .025, .028, len, x, height + dy + .04, 0, 7);
    cyl(group, drip, .032, .02, .04, x, height + dy + .04, 0, 7);
    // Some candles burnt out long ago.
    if (r() < .75) flames.push(new THREE.Vector3(x, height + dy + .04 + len + .03, 0));
  }
  group.userData.flames = flames;
  return group;
}
// A single candle in a brass stick, for tables and shelves. userData.flames as above.
export function candleStick({ seed = 11 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Vela';
  const brass = std(WOOD.brass, { metalness: .5, roughness: .5 }), wax = std(WOOD.wax, { roughness: .7 });
  cyl(group, brass, .07, .08, .015, 0, 0, 0, 10); cyl(group, brass, .015, .02, .07, 0, .015, 0, 6); cyl(group, brass, .035, .02, .02, 0, .085, 0, 8);
  const len = .05 + r() * .12; cyl(group, wax, .02, .022, len, 0, .1, 0, 7);
  group.userData.flames = [new THREE.Vector3(0, .1 + len + .025, 0)];
  return group;
}
// A dusty iron chandelier on chains. `lit`: some of its candles still burn
// (userData.flames); a dead one keeps its stubs. `drop` is how far it hangs.
export function chandelier({ ceiling = 4.6, drop = 1.7, seed = 8, lit = false, tiers = 2 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = lit ? 'Lámpara de araña' : 'Lámpara de araña apagada';
  const iron = std(WOOD.iron, { metalness: .5, roughness: .6 }), wax = std(WOOD.wax), dust = std(WOOD.dust, { roughness: 1 });
  const y = ceiling - drop, flames = [];
  const ring = (radius, at, candles) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(radius, .03, 6, 22), iron); m.rotation.x = Math.PI / 2; m.position.y = at; group.add(m);
    for (let i = 0; i < candles; i++) {
      const a = i / candles * Math.PI * 2 + at, x = Math.cos(a) * radius, z = Math.sin(a) * radius, len = .05 + r() * .12;
      cyl(group, iron, .04, .025, .03, x, at, z, 6); cyl(group, wax, .02, .024, len, x, at + .03, z, 6);
      if (lit && r() < .7) flames.push(new THREE.Vector3(x, at + .03 + len + .025, z));
    }
  };
  ring(.8, y, 8); if (tiers > 1) ring(.42, y + .32, 5);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4, chain = box(group, iron, .02, drop, .02, Math.cos(a) * .4, y, Math.sin(a) * .4); chain.rotation.set(Math.sin(a) * .23, 0, -Math.cos(a) * .23); }
  box(group, iron, .03, .5, .03, 0, ceiling - .5, 0); cyl(group, iron, .06, .1, .2, 0, y - .2, 0, 8);
  // Dust caked on the arms and a drip of grime.
  for (let i = 0; i < 6; i++) { const a = r() * 6.28; box(group, dust, .08, .012, .05, Math.cos(a) * .8, y + .03, Math.sin(a) * .8); }
  group.userData.flames = flames;
  return group;
}
// An iron lantern hanging on a chain; userData.flames: its small flame.
export function hangingLantern({ ceiling = 4.6, drop = 1.4, lit = true } = {}) {
  const group = new THREE.Group(); group.name = 'Farol colgante';
  const iron = std(WOOD.iron, { metalness: .5, roughness: .6 }), glass = std(0x30343a, { roughness: .3, transparent: true, opacity: .55 });
  const y = ceiling - drop;
  box(group, iron, .02, drop - .2, .02, 0, y + .32, 0);
  box(group, iron, .2, .02, .2, 0, y, 0); box(group, iron, .22, .02, .22, 0, y + .28, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(group, iron, .015, .28, .015, x * .09, y, z * .09);
  box(group, glass, .16, .26, .16, 0, y + .01, 0);
  cyl(group, iron, .0, .13, .1, 0, y + .3, 0, 4).rotation.y = Math.PI / 4;
  group.userData.flames = lit ? [new THREE.Vector3(0, y + .12, 0)] : [];
  return group;
}
// A worn armchair with a sagging seat, its cloth faded.
export function armchair({ seed = 12 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Sillón gastado';
  const cloth = std([0x4a3438, 0x3a4048, 0x4a4434][Math.floor(r() * 3)], { roughness: 1 }), wood = std(WOOD.dark), dust = std(WOOD.dust, { roughness: 1 });
  box(group, cloth, .8, .16, .7, 0, .3, .04); box(group, cloth, .8, .7, .18, 0, .4, -.3);
  for (const s of [-1, 1]) box(group, cloth, .14, .3, .7, s * .38, .38, .02);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(group, wood, .06, .3, .06, x * .33, 0, z * .27);
  box(group, dust, .7, .006, .55, 0, .465, .06); box(group, dust, .76, .006, .14, 0, 1.1, -.3);
  const tear = box(group, std(0x8a8070), .18, .02, .1, .1, .47, .1); tear.rotation.y = .5;
  return group;
}
// A tall window long bricked up behind; its panes still give a faint, cold
// grey-blue glow (an emissive plane, not a light). Curtains hang in tatters.
export function tallWindow({ width = 1.6, height = 3, seed = 13 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Ventanal';
  const frame = std(WOOD.dark), stone = std(WOOD.stone, { map: stoneTexture('slab') });
  const glow = owned(new THREE.MeshBasicMaterial({ color: 0x5c6c82, transparent: true, opacity: .7, fog: true }));
  const sill = .7, top = sill + height;
  const pane = part(group, new THREE.PlaneGeometry(width, height), glow, 0, sill + height / 2, .02);
  pane.renderOrder = 1;
  for (const s of [-1, 1]) box(group, stone, .22, top + .2, .2, s * (width / 2 + .11), 0, .02);
  box(group, stone, width + .44, .18, .26, 0, sill - .18, .03); box(group, stone, width + .5, .24, .24, 0, top, .02);
  box(group, frame, .05, height, .06, 0, sill, .04);
  for (let i = 1; i < 4; i++) box(group, frame, width, .04, .06, 0, sill + i * height / 4, .04);
  // Broken panes: darker squares where boards were nailed up.
  for (let i = 0; i < 3; i++) box(group, frame, width * .4, .3 + r() * .3, .03, (r() < .5 ? -1 : 1) * width * .25, sill + r() * height * .8, .06).rotation.z = (r() - .5) * .3;
  const curtain = tornCurtain({ width: width * .6, height: height + .4, seed, color: 0x3a3438 }); curtain.position.set(-width * .45, sill - .4, .2); group.add(curtain);
  return group;
}
// A tattered curtain: a hanging cloth whose hem is torn into tongues.
export function tornCurtain({ width = 2.4, height = 3.2, seed = 9, color = 0x3a2e34 } = {}) {
  const r = rng(seed), segX = 18, segY = 10, geometry = new THREE.PlaneGeometry(width, height, segX, segY), pos = geometry.attributes.position;
  const tongues = Array.from({ length: segX + 1 }, () => r());
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), col = Math.round((x / width + .5) * segX), down = (height / 2 - y) / height;
    pos.setZ(i, Math.sin(x * 4.2 + r() * .3) * .08 + down * down * (r() - .5) * .12);
    // Torn hem: the lower part of some columns rides up into ragged tongues.
    if (down > .6) pos.setY(i, y + tongues[col] ** 2.5 * height * .32 * (down - .6) / .4);
  }
  geometry.computeVertexNormals();
  const cloth = std(color, { side: THREE.DoubleSide, roughness: 1 }), rod = std(WOOD.iron, { metalness: .5 });
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
  const cases = bookcases([{ x: width / 2, z: 0, h: 0, length: width, height, double: false, variant: 'arched', fill: .75 }], { seed });
  hinge.add(cases);
  group.userData = { hinge, dispose: () => cases.userData.dispose() };
  return group;
}

// ---------- Cobwebs ----------
// list: [{ type = 'corner', x, y, z, h, size = 1, tilt = 0, w, d, sag }]
//   corner: a fan across a corner, its top-left at the point, spreading down and along +x
//   sheet:  a net strung under a ceiling, centred on the point, `w` wide along
//           local x and `d` across, sagging `sag` in the middle
//   drape:  strands hanging from the point, `w` wide and `size` long
// Lambert with a faint cold emissive so a web shows in the dark and glows
// in a beam; userData.tick(t) sways every web through one shared uniform.
const WEB_SWAY = {
  corner: 'float free = (1.0 - uv.y) * (1.0 - uv.x * .5);',
  sheet: 'float free = sin(uv.x * 3.1416) * sin(uv.y * 3.1416);',
  drape: 'float free = (1.0 - uv.y) * (1.0 - uv.y);',
};
function webMaterial(type, time, opacity) {
  const material = owned(new THREE.MeshLambertMaterial({ map: webTexture(type), color: 0xc8ccd2, emissive: 0x40454e, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
      #else
        float ph = 0.0;
      #endif
      ${WEB_SWAY[type]}
      transformed.z += sin(uTime * .8 + ph + position.x * 2.0) * .045 * free;
      transformed.x += sin(uTime * .53 + ph * 1.3) * .02 * free;`);
  };
  material.customProgramCacheKey = () => `reliquia-web-${type}`;
  return material;
}
function sheetGeometry() {
  // A net that sags in the middle: a 1 × 1 plane (x along, z across) bent down.
  const g = new THREE.PlaneGeometry(1, 1, 8, 6).rotateX(-Math.PI / 2), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, -(1 - (2 * x) ** 2) * (1 - (2 * z) ** 2 * .6)); }
  g.computeVertexNormals(); return g;
}
export function cobwebs(list, { opacity = .62 } = {}) {
  const group = new THREE.Group(); group.name = 'Telarañas';
  const time = { value: 0 }, geometries = [], materials = [];
  const kinds = {
    corner: () => new THREE.PlaneGeometry(1, 1).translate(.5, -.5, 0),
    sheet: sheetGeometry,
    drape: () => new THREE.PlaneGeometry(1, 1, 1, 4).translate(0, -.5, 0),
  };
  const m = new THREE.Object3D();
  for (const [type, make] of Object.entries(kinds)) {
    const items = list.filter(w => (w.type || 'corner') === type); if (!items.length) continue;
    const geometry = make(), material = webMaterial(type, time, type === 'corner' ? Math.min(1, opacity * 1.25) : type === 'sheet' ? opacity * .85 : opacity);
    geometries.push(geometry); materials.push(material);
    const mesh = instanced(geometry, material, items.length);
    for (const w of items) {
      m.position.set(w.x, w.y, w.z); m.rotation.set(w.tilt || 0, w.h || 0, 0, 'YXZ');
      if (type === 'sheet') m.scale.set(w.w || 2, w.sag ?? .6, w.d || 1.5);
      else if (type === 'drape') m.scale.set(w.w || .8, w.size || 1.5, 1);
      else m.scale.setScalar(w.size || 1);
      push(mesh, m);
    }
    finish(mesh); mesh.receiveShadow = false; mesh.renderOrder = 2; mesh.name = `Telarañas (${type})`;
    group.add(mesh);
  }
  group.userData = { tick(t) { time.value = t; }, dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); } };
  return group;
}
export function cobweb({ size = 1.2 } = {}) {
  const group = new THREE.Group(); group.name = 'Telaraña';
  const webs = cobwebs([{ x: -size / 2, y: size, z: 0, h: 0, size }, { x: -size / 2, y: size, z: 0, h: -Math.PI / 2, size: size * .8, tilt: .3 },
    { type: 'sheet', x: .6, y: size + .1, z: .4, w: 1.4, d: 1, sag: .35 }, { type: 'drape', x: .9, y: size + .1, z: .6, w: .6, size: 1.1 }]);
  group.add(webs); group.userData.tick = t => webs.userData.tick(t);
  return group;
}

// ---------- Candle flames ----------
// points: [Vector3 | {x, y, z}]. Two additive billboard layers (a small
// bright core and a faint glow) in one InstancedMesh each; the flicker, the
// global level and the blow-outs all live in the shader, so nothing is
// allocated per frame. userData: tick(t), level(v 0..1), blowOut(x, z,
// radius, amount 0..1), fog(near, far).
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
  // A small bright tip and a faint, short glow: warm accents, never a wash.
  const materials = [layer([.055, .14], .35, 1.2, 1.6, 0xff9a40, 0xfff0c8), layer([.5, .5], 0, 2.6, .28, 0xff8a3a, 0xffc070)];
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

// ---------- Dust in the air ----------
// Camera-local motes: a faint haze everywhere around the eye that lights up
// in the lamp's beam. One draw call, a fixed pool, no per-frame allocation.
// userData.tick(t), userData.strength(v 0..1), userData.scale(px).
export function dustMotes({ count = 520, seed = 12 } = {}) {
  const r = rng(seed), positions = new Float32Array(count * 3), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) { positions.set([(r() - .5) * 5, (r() - .5) * 2.8 - .1, -.5 - r() * 7.5], i * 3); phases[i] = r() * 100; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  const uniforms = { uTime: { value: 0 }, uStrength: { value: 1 }, uScale: { value: 300 } };
  const material = owned(new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime, uScale; attribute float phase; varying float vA;
      void main() {
        vec3 p = position + vec3(sin(uTime * .19 + phase) * .3, mod(-uTime * .04 + phase, 2.8) - 1.4 + sin(uTime * .37 + phase * 2.) * .06, cos(uTime * .15 + phase) * .3);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float beam = 1.0 - smoothstep(.16, .48, length(p.xy / max(.6, -p.z)));
        float near = smoothstep(.4, 1.1, -p.z) * (1.0 - smoothstep(5.5, 8.0, -p.z));
        vA = (beam * .85 + .15) * near * (.6 + .4 * sin(uTime * 1.7 + phase * 5.0));
        gl_PointSize = uScale * (.009 + .006 * fract(phase)) / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uStrength; varying float vA;
      void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.86, .88, .92) * (1.0 - smoothstep(.15, .5, d)) * vA * uStrength * .6, 1.0); }`,
  }));
  const points = new THREE.Points(geometry, material); points.name = 'Polvo'; points.frustumCulled = false; points.renderOrder = 4;
  points.userData = { tick(t) { uniforms.uTime.value = t; }, strength(v) { uniforms.uStrength.value = v; }, scale(px) { uniforms.uScale.value = px; }, dispose() { geometry.dispose(); material.dispose(); } };
  return points;
}

// ---------- Piles of books on the floor ----------
// list: [{ x, z, h, n }]: stacks of n books, a few slid off; one draw call.
// userData.tops: where a candle could stand on each stack.
export function bookPiles(list, { seed = 14 } = {}) {
  const r = rng(seed), geometry = new THREE.BoxGeometry(1, 1, 1), material = std(0xffffff, { roughness: .95 });
  const total = list.reduce((n, p) => n + (p.n || 6) + 2, 0), mesh = instanced(geometry, material, total), m = new THREE.Object3D(), c = new THREE.Color(), tops = [];
  for (const p of list) {
    let y = 0;
    for (let i = 0; i < (p.n || 6); i++) {
      const w = .22 + r() * .1, th = .035 + r() * .03, d = .16 + r() * .05;
      m.position.set(p.x + (r() - .5) * .05, y + th / 2, p.z + (r() - .5) * .05); m.rotation.set(0, (p.h || 0) + (r() - .5) * .5, 0); m.scale.set(w, th, d);
      push(mesh, m, c.setHex(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)]).multiplyScalar(.85 + r() * .4)); y += th;
    }
    tops.push({ x: p.x, y, z: p.z });
    for (let i = 0; i < 2; i++) { const a = r() * 6.28; m.position.set(p.x + Math.cos(a) * .3, .02, p.z + Math.sin(a) * .3); m.rotation.set(0, r() * 3, (r() - .5) * .2); m.scale.set(.24, .04, .17); push(mesh, m, c.setHex(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)])); }
  }
  finish(mesh); mesh.name = 'Pilas de libros'; mesh.userData = { tops, dispose() { geometry.dispose(); material.dispose(); } };
  return mesh;
}

// ---------- Rugs and mist ----------
// list: [{ x, z, w, d, h, color }]: worn rugs flat on the floor, one draw call.
export function rugs(list) {
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const material = owned(new THREE.MeshLambertMaterial({ map: rugTexture(), alphaTest: .4, polygonOffset: true, polygonOffsetFactor: -2 }));
  const mesh = instanced(geometry, material, list.length), m = new THREE.Object3D(), c = new THREE.Color();
  for (const rug of list) { m.position.set(rug.x, .012, rug.z); m.rotation.set(0, rug.h || 0, 0); m.scale.set(rug.w || 2, 1, rug.d || 3); push(mesh, m, c.set(rug.color ?? 0x4a5468)); }
  finish(mesh); mesh.name = 'Alfombras'; mesh.userData.dispose = () => { geometry.dispose(); material.dispose(); };
  return mesh;
}
// list: [{ x, z, w, d, y = .25 }]: soft layers of cold mist close to the
// floor, drifting slowly; the accent of a few chosen rooms, not a global fog.
// userData.tick(t), userData.fade(near, far).
export function groundMist(list) {
  const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), uniforms = { uTime: { value: 0 }, uMap: { value: mistTexture() }, uFar: { value: 18 }, uColor: { value: new THREE.Color(0x9aa6b8) } };
  const material = owned(new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `uniform float uTime; varying vec2 vUv, vDrift; varying float vDepth, vEdge;
      void main() {
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vUv = uv; vDrift = world.xz * .18 + vec2(uTime * .025, uTime * .013) + instanceMatrix[3].y;
        vec4 mv = viewMatrix * world; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uFar, uTime; uniform vec3 uColor; varying vec2 vUv, vDrift; varying float vDepth;
      void main() {
        vec2 e = min(vUv, 1.0 - vUv); float edge = smoothstep(0.0, .3, e.x) * smoothstep(0.0, .3, e.y);
        float n = texture2D(uMap, vDrift).r * .7 + texture2D(uMap, vDrift * 1.9 - vec2(uTime * .02, 0.0)).r * .6;
        float a = n * edge * (1.0 - smoothstep(uFar * .55, uFar, vDepth)) * smoothstep(.6, 2.4, vDepth) * .3;
        gl_FragColor = vec4(uColor, a); }`,
  }));
  const mesh = instanced(geometry, material, list.length * 2), m = new THREE.Object3D();
  for (const p of list) for (let k = 0; k < 2; k++) { m.position.set(p.x, (p.y ?? .12) + k * .22, p.z); m.rotation.set(0, k * .7, 0); m.scale.set((p.w || 4) * (1 - k * .12), 1, (p.d || 4) * (1 - k * .12)); push(mesh, m); }
  finish(mesh); mesh.receiveShadow = false; mesh.renderOrder = 5; mesh.name = 'Neblina';
  mesh.userData = { tick(t) { uniforms.uTime.value = t; }, fade(far) { uniforms.uFar.value = far; }, dispose() { geometry.dispose(); material.dispose(); } };
  return mesh;
}

// Studio preview: a short aisle between two cases, a lit chandelier, webs,
// a rug and a patch of mist, without a ceiling.
export function libraryAisle() {
  const group = new THREE.Group(); group.name = 'Pasillo de la biblioteca';
  group.add(bookcases([{ x: 0, z: -1.5, h: 0, length: 4, variant: 'arched' }, { x: 0, z: 1.5, h: 0, length: 4, variant: 'pillar', pillarHeight: 4 }], { seed: 2 }));
  const c = candelabra({}); c.position.set(2.6, 0, 0); group.add(c);
  const lamp = chandelier({ ceiling: 4.2, drop: 1.4, lit: true }); group.add(lamp);
  const flames = candleFlames([...c.userData.flames.map(p => p.clone().add(c.position)), ...lamp.userData.flames]); group.add(flames);
  const webs = cobwebs([{ x: -2, y: 3.45, z: -1.1, h: 0, size: 1 }, { x: 1.2, y: 3.45, z: 1.1, h: Math.PI, size: .8 }, { type: 'sheet', x: 0, y: 4, z: 0, w: 3.6, d: 2.4, sag: .6 }, { type: 'drape', x: -1, y: 4, z: .3, w: .9, size: 2 }]);
  group.add(webs, rugs([{ x: 0, z: 0, w: 1.4, d: 3, h: Math.PI / 2, color: 0x56404a }]), groundMist([{ x: 0, z: 0, w: 5, d: 3 }]));
  const ladder = libraryLadder({}); ladder.position.set(-.8, 0, -1.05); ladder.rotation.y = Math.PI; group.add(ladder);
  group.userData.tick = t => { flames.userData.tick(t); webs.userData.tick(t); };
  group.userData.previewBounds = [[-3, 0, -2.5], [3, 4.2, 2.5]];
  return group;
}
