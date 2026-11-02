// Hiding spots for an old library (or any dusty interior): furniture a
// player searches. Every piece is two merged, vertex-coloured meshes (the
// body and the part that moves), so a whole level of them costs a few draw
// calls. userData.open(t) poses it from shut (0) to searched (1): drawers
// slide out, a lid or doors swing, a dust sheet slides off, a heap spreads,
// a shelf or ladder rolls aside from a niche, an old lantern lights.
//
//   writingDesk, travelTrunk, drapedFurniture, oldWardrobe, bookHeap,
//   rollingShelf, rollingLadder, oldLantern, oldBook (a junk find)
//
// Metres, +Y up, the front faces +Z (where you stand to search it), origin
// on the floor. Wall pieces (rollingShelf, rollingLadder, oldWardrobe) have
// their back at z = -depth / 2.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '/engine/models/core/primitives.js';

// Cold, dusty colours: grey-brown wood, dull brass, pale linen.
export const HIDEOUT_COLORS = { wood: 0x2e2628, dark: 0x221c1e, light: 0x3c3234, brass: 0x6e6448, iron: 0x26262a, linen: 0x7a7e84, dust: 0x8a8c90, niche: 0x0c0b0d };
const BOOKS = [0x4a2a2c, 0x2e3a2c, 0x2c3446, 0x4a3e2c, 0x3c2a36, 0x5a5448, 0x2a2826, 0x46342c, 0x34444a];
let shared = null;
const material = () => shared ??= new THREE.MeshLambertMaterial({ vertexColors: true });
const glowMap = (() => { let t = null; return () => {
  if (t) return t;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.35, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64); t = new THREE.CanvasTexture(c); return t;
}; })();

// Collects coloured boxes and cylinders, then merges them into one mesh.
function parts() {
  const list = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const add = (geometry, color, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    m.compose(p.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), s.set(1, 1, 1)); g.applyMatrix4(m);
    c.set(color); const colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = c.r; colors[i + 1] = c.g; colors[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.deleteAttribute('uv'); list.push(g);
    if (geometry !== g) geometry.dispose();
  };
  return {
    box(w, h, d, x, y, z, color, rx, ry, rz) { add(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z, rx, ry, rz); },
    cyl(r0, r1, h, x, y, z, color, seg = 8, rx, ry, rz) { add(new THREE.CylinderGeometry(r0, r1, h, seg), color, x, y + h / 2, z, rx, ry, rz); },
    raw(geometry, color, x = 0, y = 0, z = 0, rx, ry, rz) { add(geometry, color, x, y, z, rx, ry, rz); },
    mesh(name) {
      const geometry = list.length ? mergeGeometries(list) : new THREE.BufferGeometry(); list.forEach(g => g.dispose()); list.length = 0;
      const mesh = new THREE.Mesh(geometry, material()); mesh.name = name; mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
    },
  };
}
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const finish = (group, open) => { group.userData.open = open; group.userData.dispose = () => group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); open(0); return group; };

// A writing desk with a pedestal of three drawers that slide out.
export function writingDesk({ seed = 1 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Escritorio con gavetas';
  const b = parts(), W = HIDEOUT_COLORS;
  b.box(1.3, .06, .66, 0, .76, 0, W.wood); b.box(1.3, .01, .66, 0, .82, 0, W.dust);
  for (const [x, z] of [[-.6, -.28], [-.6, .28]]) b.box(.06, .76, .06, x, 0, z, W.dark);
  b.box(.48, .74, .62, .38, .02, 0, W.dark); b.box(.5, .04, .64, .38, 0, 0, W.dark);
  // Paper and an inkwell under the dust.
  for (let i = 0; i < 3; i++) b.box(.22, .004, .3, -.3 + r() * .3, .82, (r() - .5) * .3, 0xb8b2a4, 0, r() * 2);
  b.cyl(.035, .045, .06, -.48, .82, -.18, 0x14161a);
  const body = b.mesh('Escritorio'), drawers = [];
  for (let i = 0; i < 3; i++) {
    const d = parts(); d.box(.42, .2, .56, 0, 0, 0, shade(W.wood, 1.05)); d.box(.1, .025, .025, 0, .09, .29, W.brass);
    const mesh = d.mesh('Gaveta'); mesh.position.set(.38, .07 + i * .23, .04); group.add(mesh); drawers.push(mesh);
  }
  group.add(body);
  return finish(group, t => drawers.forEach((m, i) => { m.position.z = .04 + Math.min(1, Math.max(0, t * 1.6 - i * .3)) * .32; }));
}

// A travelling trunk with iron bands; the lid swings up.
export function travelTrunk({ seed = 2 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Baúl';
  const b = parts(), W = HIDEOUT_COLORS, wood = r() < .5 ? W.wood : W.light;
  b.box(.96, .46, .56, 0, 0, 0, wood);
  for (const x of [-.32, .32]) b.box(.05, .47, .58, x, 0, 0, W.iron);
  b.box(.14, .1, .03, 0, .32, .285, W.brass);
  group.add(b.mesh('Baúl'));
  const lid = new THREE.Group(); lid.position.set(0, .46, -.28); group.add(lid);
  const l = parts(); l.box(.96, .14, .56, 0, 0, .28, wood); l.box(.97, .01, .57, 0, .14, .28, W.dust);
  for (const x of [-.32, .32]) l.box(.05, .15, .58, x, 0, .28, W.iron);
  lid.add(l.mesh('Tapa'));
  return finish(group, t => { lid.rotation.x = -t * 1.75; });
}

// Furniture under a pale dust sheet; searching pulls the sheet off and
// leaves it in a heap beside a worn armchair.
export function drapedFurniture({ seed = 3, width = 1.1, height = 1.05, depth = .9 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Mueble tapado';
  const b = parts(), W = HIDEOUT_COLORS, fabric = [0x4a3438, 0x3a4048, 0x4a4434][Math.floor(r() * 3)];
  // The armchair under it: worn seat, back, arms, short legs.
  b.box(width * .9, .14, depth * .8, 0, .32, .05, fabric); b.box(width * .9, .62, .18, 0, .42, -depth * .32, fabric);
  for (const s of [-1, 1]) b.box(.16, .3, depth * .78, s * width * .4, .38, .05, shade(fabric, .85));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(.06, .32, .06, x * width * .4, 0, z * depth * .32, W.dark);
  b.box(width * .6, .1, .02, 0, .5, depth * .2 + .1, shade(fabric, .7), -.3);
  group.add(b.mesh('Sillón viejo'));
  // The sheet: a box blown up and sagging, its hem flared and uneven.
  const g = new THREE.BoxGeometry(width * 1.04, height, depth * 1.04, 7, 5, 6), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), low = .5 - y / height;
    const flare = 1 + low * low * .35 + (r() - .5) * .05, round = y > height * .3 ? .9 : 1;
    pos.setXYZ(i, x * flare * round, y - (y > height * .45 ? Math.abs(x) * .12 : 0) - (low > .95 ? r() * .08 : 0), z * flare * round);
  }
  g.computeVertexNormals();
  const s = parts(); s.raw(g, W.linen, 0, height / 2, 0);
  const sheet = s.mesh('Sábana'); group.add(sheet);
  return finish(group, t => {
    sheet.position.set(t * (width * .95), 0, t * .25); sheet.scale.set(1 + t * .35, 1 - t * .8, 1 + t * .2); sheet.rotation.y = -t * .5;
  });
}

// A tall wardrobe with two doors that swing open.
export function oldWardrobe({ seed = 4, width = 1.2, height = 2.15, depth = .6 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Armario';
  const b = parts(), W = HIDEOUT_COLORS;
  b.box(width, height, .04, 0, .1, -depth / 2 + .02, W.dark);
  for (const s of [-1, 1]) b.box(.05, height, depth, s * (width / 2 - .025), .1, 0, W.wood);
  b.box(width, .05, depth, 0, .1, 0, W.wood); b.box(width + .08, .1, depth + .06, 0, height + .1, 0, W.light);
  b.box(width + .1, .01, depth + .08, 0, height + .2, 0, W.dust);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(.07, .1, .07, x * (width / 2 - .05), 0, z * (depth / 2 - .05), W.dark);
  b.box(width - .1, .03, depth - .08, 0, height * .62, 0, W.dark);
  // Inside: an old coat and boxes in the dark.
  b.box(.34, .8, .08, -.2 + r() * .1, height * .62 - .85, -.1, 0x2e3036, 0, 0, .05); b.box(.3, .22, .3, .25, .15, -.05, 0x403630);
  group.add(b.mesh('Armario'));
  const doors = [-1, 1].map(s => {
    const hinge = new THREE.Group(); hinge.position.set(s * (width / 2 - .02), .1, depth / 2); group.add(hinge);
    const d = parts(); d.box(width / 2 - .04, height - .02, .035, -s * (width / 4 - .01), .01, 0, W.wood);
    d.box(width / 2 - .16, height * .38, .01, -s * (width / 4 - .01), height * .5, .02, shade(W.wood, .8)); d.box(width / 2 - .16, height * .3, .01, -s * (width / 4 - .01), height * .1, .02, shade(W.wood, .8));
    d.box(.025, .1, .03, -s * (width / 2 - .1), height * .5, .03, W.brass);
    hinge.add(d.mesh('Puerta')); return { hinge, s };
  });
  return finish(group, t => doors.forEach(({ hinge, s }, i) => { hinge.rotation.y = s * Math.min(1, t * 1.3 - i * .15) * 1.7 * (t > 0 ? 1 : 0); }));
}

// A heap of fallen books and plaster; digging spreads it out.
export function bookHeap({ seed = 5, radius = .55 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Libros caídos';
  const b = parts(), pile = new THREE.Group(); group.add(pile);
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius, y = Math.max(0, (1 - d / radius) * .32 - r() * .08);
    const w = .14 + r() * .12, h = .03 + r() * .04, depth = .1 + r() * .08;
    b.box(w, h, depth, Math.cos(a) * d, y, Math.sin(a) * d, BOOKS[Math.floor(r() * BOOKS.length)], (r() - .5) * .8, r() * 3, (r() - .5) * .8);
  }
  for (let i = 0; i < 8; i++) { const a = r() * 6.28, d = r() * radius; b.box(.08 + r() * .1, .05, .08 + r() * .08, Math.cos(a) * d, 0, Math.sin(a) * d, 0x7c7a78, r(), r() * 3, r()); }
  pile.add(b.mesh('Montón'));
  return finish(group, t => { pile.scale.set(1 + t * .55, 1 - t * .55, 1 + t * .55); pile.position.z = t * .15; });
}

// A narrow niche in the wall behind a piece that rolls aside.
function niche(group, depth, w = 1, h = 1.5, y = .25) {
  const b = parts(), W = HIDEOUT_COLORS;
  b.box(w, h, .02, 0, y, -depth / 2 + .01, W.niche);
  for (const s of [-1, 1]) b.box(.08, h + .08, .05, s * (w / 2 + .04), y - .04, -depth / 2 + .02, 0x4a4e56);
  b.box(w + .16, .08, .05, 0, y + h, -depth / 2 + .02, 0x4a4e56);
  group.add(b.mesh('Nicho'));
}
// A low bookcase on rollers that slides along the wall off a niche.
export function rollingShelf({ seed = 6, length = 2.6, depth = .5 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Estante corredizo';
  const W = HIDEOUT_COLORS, w = length * .55, H = 1.9;
  niche(group, depth, .9, 1.3, .2);
  const b = parts();
  for (const s of [-1, 1]) b.box(.05, H, depth - .06, s * (w / 2 - .025), 0, 0, W.wood);
  b.box(w, .05, depth - .06, 0, H - .05, 0, W.light); b.box(w, .04, depth - .06, 0, .04, 0, W.dark); b.box(w, H, .03, 0, 0, -depth / 2 + .05, W.dark);
  for (let l = 1; l < 4; l++) b.box(w - .06, .03, depth - .08, 0, l * H / 4, 0, W.wood);
  for (let l = 0; l < 4; l++) for (let x = -w / 2 + .06; x < w / 2 - .1;) { const bw = .04 + r() * .04; if (r() < .25) { x += .1; continue; } const bh = .2 + r() * .16; b.box(bw, bh, .2, x + bw / 2, l * H / 4 + .08, .02, BOOKS[Math.floor(r() * BOOKS.length)]); x += bw + .005; }
  for (const s of [-1, 1]) b.cyl(.03, .03, .03, s * (w / 2 - .1), 0, .1, W.iron, 6, 0, 0, Math.PI / 2);
  const shelf = b.mesh('Estante'); group.add(shelf);
  const shut = -(length - w) / 2 + .02, aside = (length - w) / 2 - .02;
  return finish(group, t => { shelf.position.x = shut + (aside - shut) * t; });
}
// A library ladder leaning on the wall, a dusty cloth hung over the niche
// behind it; the ladder rolls aside along the wall.
export function rollingLadder({ length = 2.2, depth = .5, height = 2.8 } = {}) {
  const group = new THREE.Group(); group.name = 'Escalera corrediza';
  const W = HIDEOUT_COLORS, back = -depth / 2, foot = depth / 2 - .05, lean = Math.atan2(foot - back - .08, height);
  niche(group, depth, .8, 1.1, .3);
  const b = parts();
  b.box(.72, 1.25, .02, 0, .22, back + .05, 0x55514e, .04);
  for (const s of [-1, 1]) b.box(.05, height, .05, s * .24, 0, (foot + back + .08) / 2, W.light, -lean);
  for (let y = .3; y < height - .15; y += .32) b.box(.48, .035, .06, 0, y, foot - (foot - back - .08) * (y / height), W.light);
  for (const s of [-1, 1]) b.cyl(.035, .035, .03, s * .24, 0, foot, W.iron, 6, 0, 0, Math.PI / 2);
  const ladder = b.mesh('Escalera'); group.add(ladder);
  return finish(group, t => { ladder.position.x = t * (length / 2 - .25); });
}
// An old oil lantern on an iron post: lit (open), a small flame and glow.
export function oldLantern({ seed = 8, height = 1.5 } = {}) {
  const group = new THREE.Group(); group.name = 'Candil viejo';
  const b = parts(), W = HIDEOUT_COLORS;
  b.cyl(.16, .2, .05, 0, 0, 0, W.iron, 8); b.cyl(.025, .03, height, 0, .05, 0, W.iron, 6);
  b.box(.22, .02, .22, 0, height + .05, 0, W.iron); b.box(.22, .02, .22, 0, height + .33, 0, W.iron);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(.015, .3, .015, x * .1, height + .05, z * .1, W.iron);
  b.cyl(.0, .14, .12, 0, height + .35, 0, W.iron, 4, 0, Math.PI / 4); b.cyl(.025, .025, .04, 0, height + .07, 0, 0xd8cbb0, 6);
  // Sooty glass panes.
  for (const [w, d, x, z] of [[.18, .005, 0, .1], [.18, .005, 0, -.1], [.005, .18, .1, 0], [.005, .18, -.1, 0]]) b.box(w, .26, d, x, height + .07, z, 0x3a3a3c);
  group.add(b.mesh('Candil'));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc070 })); flame.scale.set(1, 1.8, 1); flame.position.y = height + .16; group.add(flame);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap(), color: 0xffa860, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending })); glow.scale.setScalar(.7); glow.position.y = height + .2; group.add(glow);
  group.userData.flame = new THREE.Vector3(0, height + .2, 0);
  const dispose = () => { flame.geometry.dispose(); flame.material.dispose(); glow.material.dispose(); };
  finish(group, t => { flame.visible = glow.visible = t > .05; glow.material.opacity = .55 * t; });
  const base = group.userData.dispose; group.userData.dispose = () => { base(); dispose(); };
  return group;
}
// A dusty old book: worth next to nothing, but it fills a hand.
export function oldBook({ seed = 9 } = {}) {
  const r = rng(seed), group = new THREE.Group(); group.name = 'Libro viejo';
  const b = parts(), cover = BOOKS[Math.floor(r() * BOOKS.length)];
  b.box(.26, .06, .19, 0, 0, 0, cover); b.box(.24, .05, .175, .008, .005, 0, 0xc8bfa8); b.box(.02, .062, .19, -.125, 0, 0, shade(cover, .7));
  group.add(b.mesh('Libro'));
  return group;
}

// Studio preview: every hiding spot in a row, half searched.
export function hidingSpots() {
  const group = new THREE.Group(); group.name = 'Escondites';
  const list = [writingDesk(), travelTrunk(), drapedFurniture(), oldWardrobe(), bookHeap(), rollingShelf(), rollingLadder(), oldLantern()];
  list.forEach((m, i) => { m.position.set((i - 3.5) * 2.4, 0, 0); m.userData.open(i % 2 ? 1 : 0); group.add(m); });
  group.userData.previewBounds = [[-10, 0, -1.5], [10, 3, 1.5]];
  group.userData.dispose = () => list.forEach(m => m.userData.dispose());
  return group;
}
