// i18n-ignore-file: model names and world signage stay Spanish.
// The tambor set for La Rueda de Tambor: the culo e' puya drums, the long
// drum on its fork, the charrasca, the maracas, the caracol, the pink beach
// shack, the pañuelo, the "violín" cloud that follows a sweaty dancer and the
// shell ring that marks the rueda. Registered in Pana Studio
// (web/studio/catalog/tambor.js). Feet at the origin, +Z forward, metres.
// Each factory returns a group whose userData.dispose frees what it built.
import * as THREE from 'three';
import { disposeModel } from '/engine/models/props/game-table.js';

export const TAMBOR_COLORS = { amarillo: '#ffc83d', azul: '#2f6fd6', rojo: '#e8402f', verde: '#2baa72', rosa: '#f08fa8', madera: '#9a6238', cuero: '#f3dfb4' };
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .62, ...extra });
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const owned = (group) => { group.userData.dispose = () => disposeModel(group); return group; };

// A drum body with painted bands, a skin on top and zig-zag lacing. Its axis is +Y.
function drumBody(group, { length, radius, waist = .9, bands = ['amarillo', 'azul', 'rojo'], wood = TAMBOR_COLORS.madera, skins = 1 }) {
  const profile = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, r = radius * (1 - (1 - waist) * Math.sin(t * Math.PI));
    profile.push(new THREE.Vector2(r, t * length));
  }
  part(group, new THREE.LatheGeometry(profile, 20), mat(wood, { roughness: .7 }));
  const skin = mat(TAMBOR_COLORS.cuero, { roughness: .85 });
  part(group, new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, .025, 22), skin, 0, length, 0);
  if (skins > 1) part(group, new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, .025, 22), skin, 0, 0, 0);
  bands.forEach((name, i) => {
    const y = length * (.22 + i * .28 / Math.max(1, bands.length - 1) * 1.6);
    const r = radius * (1 - (1 - waist) * Math.sin(y / length * Math.PI)) + .004;
    part(group, new THREE.CylinderGeometry(r, r, length * .07, 20, 1, true), mat(TAMBOR_COLORS[name] || name, { roughness: .5, side: THREE.DoubleSide }), 0, y, 0);
  });
  // Rope lacing from rim to rim.
  const rope = mat('#efe2c0', { roughness: 1 }), points = [], turns = 8;
  for (let i = 0; i <= turns * 2; i++) {
    const a = i / (turns * 2) * Math.PI * 2, y = i % 2 ? length * .1 : length * .96;
    const r = radius * (1 - (1 - waist) * Math.sin(y / length * Math.PI)) + .01;
    points.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  part(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0), 64, .006, 4), rope);
  part(group, new THREE.TorusGeometry(radius * 1.03, .012, 6, 24), rope, 0, length * .96, 0).rotation.x = Math.PI / 2;
}

// One culo e' puya: prima (small), cruzao or pujao (the biggest).
export function createCuloEPuya({ size = 'prima', bands } = {}) {
  const group = new THREE.Group(); group.name = `Culo e' puya · ${size}`;
  const dims = { prima: [.78, .12], cruzao: [.86, .135], pujao: [.95, .15] }[size] || [.8, .12];
  drumBody(group, { length: dims[0], radius: dims[1], waist: .82, bands, skins: 2 });
  return owned(group);
}

// The three culo e' puya leaning on a low rack, skins toward the player (−Z side is the player's).
export function createCuloEPuyaSet() {
  const group = new THREE.Group(); group.name = 'Juego de culo e\' puya';
  const wood = mat(TAMBOR_COLORS.madera, { roughness: .9 });
  part(group, new THREE.BoxGeometry(1.15, .08, .3), wood, 0, .32, .1);
  for (const x of [-.5, .5]) part(group, new THREE.BoxGeometry(.07, .34, .07), wood, x, .16, .1);
  [['prima', -.34, ['amarillo', 'azul', 'rojo']], ['cruzao', 0, ['rojo', 'amarillo', 'verde']], ['pujao', .36, ['azul', 'amarillo', 'rojo']]].forEach(([size, x, bands]) => {
    const drum = createCuloEPuya({ size, bands }); drum.position.set(x, .02, .22); drum.rotation.x = -.42; group.add(drum);
  });
  group.userData.skins = [new THREE.Vector3(-.34, .72, -.1), new THREE.Vector3(.36, .82, -.14)];
  return owned(group);
}

// The long drum (la mina) resting on its crossed-stick fork, played on the
// body with sticks, with its little curbata beside it.
export function createMina() {
  const group = new THREE.Group(); group.name = 'Tambor largo con horqueta';
  const body = new THREE.Group(); group.add(body);
  drumBody(body, { length: 2.1, radius: .21, waist: .94, bands: ['rojo', 'amarillo', 'azul', 'verde'] });
  body.position.set(0, .06, .9); body.rotation.x = -1.05;
  const pole = mat('#7a5232', { roughness: .95 });
  for (const s of [-1, 1]) {
    const leg = part(group, new THREE.CylinderGeometry(.03, .04, 1.55, 6), pole, s * .22, .72, -.2);
    leg.rotation.z = s * -.38;
  }
  part(group, new THREE.TorusGeometry(.06, .02, 5, 10), mat('#efe2c0'), 0, 1.3, -.2).rotation.x = Math.PI / 2;
  const curbata = createCuloEPuya({ size: 'pujao', bands: ['verde', 'amarillo', 'rojo'] });
  curbata.scale.set(1.5, .75, 1.5); curbata.position.set(-.85, 0, .25); group.add(curbata);
  // Two sticks lying across the body.
  const stick = mat('#d9b98c', { roughness: .8 });
  for (const s of [-1, 1]) { const st = part(group, new THREE.CylinderGeometry(.018, .022, .5, 6), stick, s * .3, .75, .42); st.rotation.z = Math.PI / 2 + s * .3; }
  group.userData.hit = new THREE.Vector3(0, .9, .3);
  return owned(group);
}

// La charrasca: a ridged metal tube on a crate, with its scraper.
export function createCharrasca({ crate = true } = {}) {
  const group = new THREE.Group(); group.name = 'Charrasca';
  if (crate) part(group, new THREE.BoxGeometry(.6, .55, .45), mat('#c8a06a', { roughness: .95 }), 0, .275, 0);
  const metal = mat('#c9d1d6', { metalness: .8, roughness: .32 }), profile = [];
  for (let i = 0; i <= 24; i++) profile.push(new THREE.Vector2(.055 + (i % 2) * .008, i / 24 * .42));
  const tube = part(group, new THREE.LatheGeometry(profile, 16), metal, -.08, .63, 0);
  tube.rotation.z = Math.PI / 2 - .2; tube.position.x = .13;
  const scraper = part(group, new THREE.CylinderGeometry(.008, .008, .32, 6), metal, .05, .7, .12);
  scraper.rotation.z = 1.1;
  part(group, new THREE.SphereGeometry(.03, 8, 6), mat('#7a5232'), -.08, .62, .12);
  return owned(group);
}

// A maraca (or the pair, crossed): gourd, handle and painted stripes.
export function createMaraca({ color = TAMBOR_COLORS.amarillo } = {}) {
  const group = new THREE.Group(); group.name = 'Maraca';
  const gourd = part(group, new THREE.SphereGeometry(.09, 14, 10), mat(color, { roughness: .45 }), 0, .2, 0);
  gourd.scale.set(1, 1.15, 1);
  part(group, new THREE.TorusGeometry(.091, .012, 6, 18), mat(TAMBOR_COLORS.rojo, { roughness: .45 }), 0, .2, 0).rotation.x = Math.PI / 2;
  part(group, new THREE.CylinderGeometry(.016, .02, .16, 8), mat('#7a5232'), 0, .06, 0);
  return owned(group);
}
export function createMaracas() {
  const group = new THREE.Group(); group.name = 'Maracas';
  const a = createMaraca(), b = createMaraca({ color: TAMBOR_COLORS.verde });
  a.position.set(-.07, 0, 0); a.rotation.z = .35; b.position.set(.07, 0, 0); b.rotation.z = -.35;
  group.add(a, b);
  return owned(group);
}

// El caracol: a conch with a spire, knobs on the shoulder and a pink lip.
export function createCaracol() {
  const group = new THREE.Group(); group.name = 'Caracol';
  const shell = mat('#f6e1c6', { roughness: .5 }), profile = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, r = t < .7 ? Math.sin(t / .7 * Math.PI / 2) * .13 : .13 * (1 - (t - .7) / .3) + .01;
    profile.push(new THREE.Vector2(r, t * .38));
  }
  const body = part(group, new THREE.LatheGeometry(profile, 18), shell);
  body.rotation.z = Math.PI / 2; body.position.set(.19, .13, 0);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2, knob = part(group, new THREE.ConeGeometry(.022, .06, 6), shell, .02, .13 + Math.cos(a) * .13, Math.sin(a) * .13);
    knob.rotation.x = a;
  }
  const lip = part(group, new THREE.SphereGeometry(.12, 14, 10, 0, Math.PI), mat('#f39ab0', { roughness: .35, side: THREE.DoubleSide }), .08, .1, .06);
  lip.scale.set(1.3, .75, .5); lip.rotation.y = -.3;
  part(group, new THREE.CylinderGeometry(.012, .02, .06, 8), shell, -.21, .13, 0).rotation.z = Math.PI / 2;
  group.userData.mouthpiece = new THREE.Vector3(-.24, .13, 0);
  return owned(group);
}

// A pañuelo: a red handkerchief that flutters. userData.update(t) waves it.
export function createPanuelo({ color = TAMBOR_COLORS.rojo } = {}) {
  const group = new THREE.Group(); group.name = 'Pañuelo';
  const geometry = new THREE.PlaneGeometry(.42, .42, 6, 6), base = geometry.attributes.position.array.slice();
  const cloth = part(group, geometry, mat(color, { roughness: .8, side: THREE.DoubleSide }), 0, -.2, 0);
  cloth.rotation.z = Math.PI / 4;
  group.userData.update = (t) => {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], reach = (x + y + .42) / .84;
      p.setZ(i, Math.sin(t * 9 + x * 8 + y * 5) * .06 * reach);
    }
    p.needsUpdate = true; geometry.computeVertexNormals();
  };
  group.userData.tick = group.userData.update;
  return owned(group);
}

// The "violín": a little green cloud with wavy stink lines that follows a
// pana who danced too long. userData.update(t) bobs it.
export function createViolinCloud() {
  const group = new THREE.Group(); group.name = 'Nube de violín';
  const puff = mat('#b9d47a', { roughness: 1, transparent: true, opacity: .85 });
  for (const [x, y, z, s] of [[0, 0, 0, .2], [.18, .04, .02, .15], [-.17, .03, -.02, .16], [.05, .14, 0, .14]]) part(group, new THREE.SphereGeometry(s, 12, 8), puff, x, y, z);
  const line = mat('#6f8f3a', { roughness: 1 }), waves = [];
  for (const x of [-.15, 0, .15]) {
    const pts = []; for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3(x + Math.sin(i * .9) * .04, -.25 - i * .035, 0));
    const wave = part(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, .008, 4), line); waves.push(wave);
  }
  group.userData.update = (t) => {
    group.children.forEach((c, i) => { if (!waves.includes(c)) c.position.y += Math.sin(t * 3 + i) * .0015; });
    waves.forEach((w, i) => { w.position.y = ((t * .3 + i * .33) % 1) * .12; w.scale.x = 1 + Math.sin(t * 6 + i) * .3; });
  };
  group.userData.tick = group.userData.update;
  return owned(group);
}

// A canvas painted onto a board: the shack's sign.
function signBoard(text, width, height, colors) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(512 * height / width);
  const g = canvas.getContext('2d');
  g.fillStyle = colors.back; g.fillRect(0, 0, canvas.width, canvas.height);
  g.strokeStyle = colors.trim; g.lineWidth = 14; g.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  g.fillStyle = colors.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = canvas.height * .6;
  do g.font = `${size}px "Luckiest Guy", system-ui, sans-serif`; while (g.measureText(text).width > canvas.width - 60 && (size -= 4) > 20);
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: .8 }));
}

// La casita rosada: the pink beach shack with a tin roof, a counter, stools
// and a hand-painted sign. Front +Z.
export function createPinkShack({ sign = 'TAMBOR Y FRÍAS', night = false } = {}) {
  const group = new THREE.Group(); group.name = 'La casita rosada';
  const pink = mat(TAMBOR_COLORS.rosa, { roughness: .85 }), white = mat('#fff6ea', { roughness: .8 }), wood = mat('#a47a52', { roughness: .95 });
  part(group, new THREE.BoxGeometry(4.6, .25, 3.4), mat('#cfc2a8', { roughness: 1 }), 0, .125, 0);
  part(group, new THREE.BoxGeometry(4.4, 2.6, .18), pink, 0, 1.55, -1.5);
  for (const x of [-2.1, 2.1]) part(group, new THREE.BoxGeometry(.18, 2.6, 3), pink, x, 1.55, 0);
  // Front wall with a big serving window.
  part(group, new THREE.BoxGeometry(4.4, .95, .18), pink, 0, .72, 1.4);
  part(group, new THREE.BoxGeometry(4.4, .55, .18), pink, 0, 2.6, 1.4);
  for (const x of [-1.85, 1.85]) part(group, new THREE.BoxGeometry(.7, 1.15, .18), pink, x, 1.75, 1.4);
  part(group, new THREE.BoxGeometry(3.2, .1, .6), wood, 0, 1.24, 1.6);
  part(group, new THREE.BoxGeometry(4.5, .08, .24), white, 0, 2.32, 1.5);
  // Blue shutters propped open.
  for (const s of [-1, 1]) { const shutter = part(group, new THREE.BoxGeometry(.75, 1.1, .05), mat('#2f8fd6', { roughness: .7 }), s * 1.95, 1.75, 1.75); shutter.rotation.y = s * .9; }
  // Corrugated tin roof, tilted back.
  const roofGeo = new THREE.PlaneGeometry(5.2, 4.2, 40, 1), rp = roofGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) rp.setZ(i, Math.sin(rp.getX(i) * 18) * .035);
  roofGeo.computeVertexNormals();
  const roof = part(group, roofGeo, mat('#b8c3c9', { metalness: .55, roughness: .45, side: THREE.DoubleSide }), 0, 3.05, .1);
  roof.rotation.x = -Math.PI / 2 + .12;
  const board = signBoard(sign, 3, .6, { back: '#fff3e0', trim: TAMBOR_COLORS.azul, ink: TAMBOR_COLORS.rojo });
  board.position.set(0, 3.2, 1.75); board.rotation.x = -.08; board.castShadow = true; group.add(board);
  // Stools and a cooler out front.
  for (const x of [-1, 0, 1]) {
    part(group, new THREE.CylinderGeometry(.2, .2, .07, 12), mat(TAMBOR_COLORS.amarillo), x, .72, 2.2);
    part(group, new THREE.CylinderGeometry(.04, .05, .68, 6), wood, x, .36, 2.2);
  }
  part(group, new THREE.BoxGeometry(.7, .5, .45), mat('#2f8fd6', { roughness: .5 }), 1.9, .5, 2.3);
  part(group, new THREE.BoxGeometry(.72, .1, .47), white, 1.9, .78, 2.3);
  // Inside: a warm glow through the window at night.
  if (night) {
    const lamp = new THREE.PointLight('#ffb35c', 6, 9, 2); lamp.position.set(0, 2, .6); group.add(lamp);
    part(group, new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffcf7a', emissiveIntensity: 3 }), 0, 2.15, .6);
  }
  return owned(group);
}

// String lights between two points: bulbs on a sagging wire.
export function createStringLights({ span = 10, sag = .8, bulbs = 18, colors = ['#ffd27a', '#ff8a6b', '#7ad7ff', '#b6ff7a'] } = {}) {
  const group = new THREE.Group(); group.name = 'Bombillos';
  const pts = []; for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push(new THREE.Vector3((t - .5) * span, -Math.sin(t * Math.PI) * sag, 0)); }
  part(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .012, 4), mat('#2b2b2b'));
  const geometry = new THREE.SphereGeometry(.07, 8, 6);
  colors.forEach((color, k) => {
    const list = []; for (let i = k; i < bulbs; i += colors.length) list.push(i);
    const bulb = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: 2.4 }), list.length);
    const m = new THREE.Matrix4();
    list.forEach((i, n) => { const t = (i + .5) / bulbs; m.makeTranslation((t - .5) * span, -Math.sin(t * Math.PI) * sag - .08, 0); bulb.setMatrixAt(n, m); });
    group.add(bulb);
  });
  return owned(group);
}

// The rueda's floor: a trampled circle of darker sand ringed with shells.
export function createRuedaRing({ radius = 3.4 } = {}) {
  const group = new THREE.Group(); group.name = 'Rueda de conchas';
  const floor = part(group, new THREE.CircleGeometry(radius, 48), mat('#e5c995', { roughness: 1 }), 0, .012, 0);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  const count = 44, shell = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 8, 6), mat('#fff4ea', { roughness: .5 }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, .45, .8), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a * 3);
    m.compose(new THREE.Vector3(Math.cos(a) * (radius + .1), .03, Math.sin(a) * (radius + .1)), q, s);
    shell.setMatrixAt(i, m); shell.setColorAt(i, c.set(['#fff4ea', '#ffd9c7', '#f8e7b5'][i % 3]));
  }
  shell.receiveShadow = true; group.add(shell);
  return owned(group);
}

// A malecón mural: a long wall with a painted tropical scene. Front +Z.
export function createMural({ width = 9, height = 3, title = 'CHORONÍ' } = {}) {
  const group = new THREE.Group(); group.name = 'Mural del malecón';
  part(group, new THREE.BoxGeometry(width + .3, height + .3, .4), mat('#efe6d6', { roughness: .95 }), 0, (height + .3) / 2, -.22);
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#ff8a5c'); sky.addColorStop(.55, '#ffd36b'); sky.addColorStop(.56, '#2fb5c9'); sky.addColorStop(1, '#1f7fa8');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff1a8'; g.beginPath(); g.arc(W * .72, H * .42, H * .16, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 4; i++) {
    const x = W * (.08 + i * .27), base = H;
    g.strokeStyle = '#6b4a2e'; g.lineWidth = 14; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + 30, H * .55, x + 10, H * .28); g.stroke();
    g.fillStyle = ['#2baa72', '#3fbf5a', '#239a64', '#4fcf6a'][i];
    for (let k = 0; k < 6; k++) { g.save(); g.translate(x + 10, H * .28); g.rotate(k / 6 * Math.PI * 2); g.beginPath(); g.ellipse(48, 0, 52, 13, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
  }
  for (let i = 0; i < 5; i++) {
    const x = W * (.18 + i * .16), y = H * .78;
    g.fillStyle = ['#e8402f', '#2f6fd6', '#ffc83d', '#f08fa8', '#2baa72'][i];
    g.beginPath(); g.ellipse(x, y, 26, 44, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.arc(x, y - 58, 20, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#fff'; g.strokeStyle = '#1b1440'; g.lineWidth = 10; g.textAlign = 'center';
  g.font = `${Math.round(H * .2)}px "Luckiest Guy", system-ui, sans-serif`;
  g.strokeText(title, W * .5, H * .2); g.fillText(title, W * .5, H * .2);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  part(group, new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: .85 }), 0, height / 2 + .15, 0);
  return owned(group);
}

// A floating name over a pana's head, so friends on voice chat know who is who.
export function createNameTag(text, color = '#ff5a3d') {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = 'rgba(22, 22, 26, .72)'; g.beginPath(); g.roundRect(4, 8, 248, 48, 24); g.fill();
  g.fillStyle = color; g.beginPath(); g.arc(30, 32, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
  let size = 30; do g.font = `${size}px "Luckiest Guy", system-ui, sans-serif`; while (g.measureText(text).width > 196 && (size -= 2) > 14);
  g.fillText(text, 48, 34);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(1.5, .375, 1); sprite.renderOrder = 9; sprite.name = 'Nombre';
  sprite.userData.dispose = () => { texture.dispose(); sprite.material.dispose(); };
  return sprite;
}
