// An indoor shooting range: the covered lane (concrete floor with lane lines and
// distance numbers, panelled walls, a ceiling with baffles and strip lights,
// the berm at the back, a booth with its bench and rail), the targets that
// stand down it and the hanging distance signs. Pepazo's armory range uses it.
//
//   const lane = createRangeLane({ length: 105, half: 6, marks: [10, 25, 50] });  // origin: the firing line, lane down +X
//   const target = createRangeTarget({ kind: 'paper' });   // paper, board, popup, back; faces +Z
//   target.userData.face   → the group splats go on (origin at the bottom centre of the face, front at z 0)
//   target.userData.size   → { w, h } of that face
//   createRangeSign({ meters: 50 })                         // a sign that hangs from its top, faces +Z
//
// Every factory returns a group with userData.dispose(). Plain colours are baked
// into a few batches; the textures (numbers, the paper silhouette) are painted once.
import * as THREE from 'three';
import { bake } from '/engine/models/core/static-batch.js';
import { FONT, letter, whenFont } from '/engine/models/core/lettering.js';
import { disposeModel } from './game-table.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .85, ...extra });
function put(root, geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); root.add(mesh); return mesh;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function texture(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// A baked group whose dispose also frees the textures and the unbaked geometry.
function finish(root, name) {
  const textures = new Set(), geometries = new Set();
  root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material?.map) textures.add(o.material.map); });
  const out = bake(root, { tint: true }); out.name = name;
  let disposed = false;
  out.userData.dispose = () => { if (disposed) return; disposed = true; disposeModel(out); geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); };
  return out;
}

// "50 m" in the cartoon lettering, yellow with an ink outline on a clear canvas.
const paintNumber = (g, meters) => { g.clearRect(0, 0, 256, 128); letter(g, [`${meters} m`], 256, 128, { margin: .04 }); };
export function rangeNumberTexture(meters) {
  const [c, g] = canvas(256, 128); paintNumber(g, meters);
  return texture(c);
}
// A material showing the number, repainted once the lettering's web font arrives.
function numberMaterial(meters, extra = {}) {
  const material = new THREE.MeshBasicMaterial({ map: rangeNumberTexture(meters), transparent: true, ...extra });
  whenFont(material, g => paintNumber(g, meters)); return material;
}

// The lane. length: firing line to the berm; half: half its width; height: the ceiling.
export function createRangeLane({ length = 105, half = 6, height = 5.2, marks = [10, 25, 50, 75, 100] } = {}) {
  const root = new THREE.Group(), long = length + 7, mid = (length - 5) / 2 + 1;
  const concrete = std('#a39d92'), dark = std('#4a535e'), panel = std('#3f5d73'), plaster = std('#e2d9c6'), ceiling = std('#8d939b'), pillar = std('#c4b9a3');
  const yellow = std('#f2c230'), ink = std('#1d1f24'), white = std('#eeeae0'), wood = std('#9b6a3e'), steel = std('#8c98a3', { metalness: .5, roughness: .4 });
  const sand = std('#a07c52'), rubber = std('#3a3430'), light = new THREE.MeshBasicMaterial({ color: '#fff7e2' });
  // Floor, side walls (dark acoustic panels under plaster), ceiling and the back wall.
  put(root, box(long, .1, half * 2), concrete, mid, -.05, 0);
  for (const s of [-1, 1]) {
    put(root, box(long, 1.3, .2), panel, mid, .65, s * (half + .1));
    put(root, box(long, height - 1.3, .2), plaster, mid, 1.3 + (height - 1.3) / 2, s * (half + .1));
    put(root, box(long, .12, .08), yellow, mid, 1.32, s * (half - .02));
    // Pilasters every 10 m give the walls depth.
    for (let x = 10; x < length; x += 10) put(root, box(.5, height, .3), pillar, x - .5, height / 2, s * (half - .05));
    put(root, box(long, .06, .06), white, mid, .005, s * (half - .45));
  }
  put(root, box(long, .12, half * 2 + .4), ceiling, mid, height + .06, 0);
  // Baffles across the ceiling every 5 m, a strip light between each pair, two rows.
  for (let x = 2.5; x < length; x += 5) {
    put(root, box(.35, .45, half * 2), dark, x, height - .22, 0);
    for (const z of [-half * .45, half * .45]) put(root, box(3.6, .06, .28), light, x + 2.5, height - .04, z);
  }
  put(root, box(1, height, half * 2 + .4), dark, length + 1.5, height / 2, 0);
  // The berm: a rubber-faced slope and sand at its foot.
  put(root, box(3.2, .1, half * 2), rubber, length - .4, 1.4, 0, 0, 0, Math.PI * .32).scale.set(1, 1, 1);
  put(root, box(2.4, 2.8, half * 2), rubber, length + .4, 1.4, 0);
  put(root, box(2.6, .5, half * 2), sand, length - 1.6, .25, 0);
  // Behind the shooter: the booth's back wall, its low dividers and the ceiling over it.
  put(root, box(.2, height, half * 2), panel, -5, height / 2, 0);
  for (const z of [-1.7, 1.7]) put(root, box(3.2, 1.9, .08), panel, -.6, .95, z);
  // The firing line: yellow and black hazard blocks across the floor.
  for (let z = -half + .25, i = 0; z < half; z += .5, i++) put(root, box(.22, .012, .5), i % 2 ? ink : yellow, .1, .006, z + .25 - .25);
  // The bench and its rail.
  put(root, box(.5, .07, 3.2), wood, .95, .86, 0);
  put(root, box(.45, .82, 3.1), panel, .98, .41, 0);
  put(root, new THREE.CylinderGeometry(.025, .025, 3.4, 8), steel, 1.3, .98, 0, Math.PI / 2);
  for (const z of [-1.5, 0, 1.5]) put(root, new THREE.CylinderGeometry(.02, .02, .12, 6), steel, 1.3, .92, z);
  // Distance lines across the floor and their marks on the side walls.
  for (const m of marks) if (m < length) put(root, box(.12, .012, half * 2 - 1), white, m, .007, 0);
  const lane = finish(root, 'Polígono de tiro');
  // The numbers (textured, so outside the colour batches): on the floor before each line and on both walls.
  const numbers = new THREE.Group(), plane = new THREE.PlaneGeometry(3.4, 1.7), wall = new THREE.PlaneGeometry(1.6, .8);
  for (const m of marks) {
    if (m >= length) continue;
    const material = numberMaterial(m, { depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const floor = new THREE.Mesh(plane, material); floor.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); floor.position.set(m - 1.3, .02, 0); numbers.add(floor);
    for (const s of [-1, 1]) { const tag = new THREE.Mesh(wall, material); tag.position.set(m + 1.2, 2.3, s * (half - .02)); tag.rotation.y = s < 0 ? 0 : Math.PI; numbers.add(tag); }
  }
  lane.add(numbers);
  const dispose = lane.userData.dispose;
  lane.userData.dispose = () => { dispose(); plane.dispose(); wall.dispose(); numbers.children.forEach(o => { o.material.map.dispose(); o.material.dispose(); }); };
  return lane;
}

// A sign that hangs from the ceiling: the distance on both faces, chains from its top (origin).
export function createRangeSign({ meters = 50 } = {}) {
  const root = new THREE.Group(), frame = std('#1d1f24'), chain = std('#8c98a3', { metalness: .5 });
  put(root, box(1.7, .85, .08), frame, 0, -.95, 0);
  for (const x of [-.6, .6]) put(root, box(.03, .55, .03), chain, x, -.27, 0);
  const out = finish(root, 'Letrero de distancia');
  const material = numberMaterial(meters), plane = new THREE.PlaneGeometry(1.5, .75);
  for (const s of [1, -1]) { const face = new THREE.Mesh(plane, material); face.position.set(0, -.95, s * .045); face.rotation.y = s > 0 ? 0 : Math.PI; out.add(face); }
  const dispose = out.userData.dispose;
  out.userData.dispose = () => { dispose(); plane.dispose(); material.map.dispose(); material.dispose(); };
  return out;
}

// The faces, painted once per kind: paper with a pana's silhouette and scoring rings,
// a white board with a grid, the big back board with its rings.
const FACES = {
  paper: { w: 1.25, h: 1.8, bottom: .2 }, popup: { w: 1.25, h: 1.8, bottom: .2 },
  board: { w: 1.4, h: 1.4, bottom: .6 }, back: { w: 4.2, h: 3.2, bottom: .35 },
};
function faceTexture(kind) {
  const [c, g] = kind === 'back' ? canvas(512, 390) : kind === 'board' ? canvas(256, 256) : canvas(256, 368), W = c.width, H = c.height;
  if (kind === 'board') {
    g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, W, H); g.strokeStyle = '#c9c3b5'; g.lineWidth = 2;
    for (let i = 32; i < W; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); }
    g.fillStyle = '#1d1f24'; g.beginPath(); g.arc(W / 2, H / 2, 16, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1d1f24'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
  } else if (kind === 'back') {
    g.fillStyle = '#efe6d2'; g.fillRect(0, 0, W, H);
    ['#1d1f24', '#efe6d2', '#1d1f24', '#efe6d2', '#e2453c', '#f2c230'].forEach((color, i) => { g.fillStyle = color; g.beginPath(); g.arc(W / 2, H / 2, 180 - i * 30, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = '#1d1f24'; g.lineWidth = 10; g.strokeRect(5, 5, W - 10, H - 10);
  } else {
    // Paper: a pana's outline (round head, round ears, broad body) in ink, rings on the chest.
    g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#26303a';
    // Rings on the chest, at the height the rules shoot at (1.1 m on a face from 0.2 m).
    g.beginPath(); g.arc(W / 2, 70, 52, 0, Math.PI * 2); g.fill();
    for (const s of [-1, 1]) { g.beginPath(); g.arc(W / 2 + s * 42, 26, 17, 0, Math.PI * 2); g.fill(); }
    g.beginPath(); g.moveTo(30, H); g.lineTo(38, 168); g.quadraticCurveTo(W / 2, 108, W - 38, 168); g.lineTo(W - 30, H); g.fill();
    g.strokeStyle = '#e9dcc0'; g.lineWidth = 4;
    for (const r of [20, 44, 68]) { g.beginPath(); g.arc(W / 2, 184, r, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.arc(W / 2, 70, 24, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#e2453c'; g.beginPath(); g.arc(W / 2, 184, 9, 0, Math.PI * 2); g.fill();
    g.font = `20px ${FONT}`; g.fillStyle = '#e9dcc0'; g.textAlign = 'center'; g.fillText('5', W / 2, 184 - 24); g.fillText('4', W / 2, 184 - 48);
  }
  return texture(c);
}

// kind: paper (on a stand), popup (drops back on a hinge: rotate userData.face.rotation.x
// from 0 up to -PI/2 down), board, back. The face's front is at z 0.
export function createRangeTarget({ kind = 'paper' } = {}) {
  const size = FACES[kind] || FACES.paper, root = new THREE.Group(), steel = std('#59636d', { metalness: .4, roughness: .5 }), wood = std('#8a5d36');
  if (kind === 'popup') put(root, box(size.w * .9, .22, .5), steel, 0, .11, -.15);
  else if (kind === 'back') for (const x of [-size.w / 2 + .2, size.w / 2 - .2]) put(root, box(.18, size.bottom + size.h, .18), wood, x, (size.bottom + size.h) / 2, -.14);
  else {
    put(root, box(size.w * .8, .06, .6), steel, 0, .03, -.12);
    for (const x of [-size.w / 2 + .06, size.w / 2 - .06]) put(root, box(.05, size.bottom + size.h * .6, .05), steel, x, (size.bottom + size.h * .6) / 2, -.06);
  }
  const body = finish(root, 'Blanco de tiro');
  const face = new THREE.Group(); face.position.y = size.bottom;
  const material = new THREE.MeshStandardMaterial({ map: faceTexture(kind), roughness: .9 }), plane = new THREE.Mesh(new THREE.BoxGeometry(size.w, size.h, .03), material);
  plane.position.set(0, size.h / 2, -.016); face.add(plane); body.add(face);
  body.userData.face = face; body.userData.size = { w: size.w, h: size.h };
  const dispose = body.userData.dispose;
  body.userData.dispose = () => { dispose(); plane.geometry.dispose(); material.map.dispose(); material.dispose(); };
  return body;
}
