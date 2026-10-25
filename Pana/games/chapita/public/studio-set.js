// The street set for Chapita: the bottle cap itself (flat or bent, with
// invented soda and malta brands, tricolor and gold), the sticks you bat with,
// the señora's window, the street and the block court floors, a chain-link
// fence, bleachers, the red-and-white superbloque, the tuyuyo bump and the
// jugadas' extras (a dog, a storm drain, the abuelo's paper, a tumbleweed,
// a broken palo, a ball and a bat).
// Registered in Pana Studio (web/studio/catalog/chapita.js). Each factory
// returns a group whose userData.dispose frees what it built; ground at y = 0,
// fronts face +Z unless a comment says otherwise.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from '/engine/models/props/game-table.js';

const DISPLAY = '"Luckiest Guy", "Nunito", system-ui, sans-serif';
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .6, ...extra });
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const owned = (group) => { group.userData.dispose = () => disposeModel(group); return group; };
function painted(width, height, draw) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const paint = () => { ctx.clearRect(0, 0, width, height); draw(ctx, width, height); texture.needsUpdate = true; };
  paint(); try { document.fonts?.ready?.then(paint); } catch { /* no font API */ }
  return texture;
}

// ---------- the chapita ----------
// Invented brands only: a cola, a malta, a grape soda, plus tricolor and gold.
export const CAP_BRANDS = {
  kolita: { label: 'Kolita del Ávila', crown: '#d62828', face: '#ffd23f', ink: '#d62828', word: 'KOLITA' },
  malta: { label: 'Malta Mañanera', crown: '#3b2416', face: '#f2c14e', ink: '#3b2416', word: 'MALTA' },
  uvita: { label: 'Uvita Sabanera', crown: '#6a2c91', face: '#f4ecff', ink: '#6a2c91', word: 'UVITA' },
  tricolor: { label: 'Tricolor', crown: '#1f4fd1', face: '#ffffff', ink: '#ffffff', word: '' },
  oro: { label: 'Chapita de oro', crown: '#e3b23c', face: '#ffe08a', ink: '#9a6a12', word: 'ORO', metal: true },
};
// A crown cap, 0,1 m across (toy-sized so it reads on screen): 21 crimps on
// the skirt, a printed top and, when bent (0–1), the dent a bad destapador
// leaves. Lies flat, top up.
export function createChapita({ brand = 'kolita', bent = 0, radius = .1 } = {}) {
  const b = CAP_BRANDS[brand] || CAP_BRANDS.kolita, group = new THREE.Group(); group.name = `Chapita · ${b.label}`;
  const metal = { metalness: b.metal ? .85 : .55, roughness: b.metal ? .25 : .35 };
  const skirt = new THREE.CylinderGeometry(radius, radius * 1.08, radius * .32, 63, 1, true), p = skirt.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), crimp = 1 + .07 * Math.max(0, Math.cos(a * 21)) * (p.getY(i) < 0 ? 1 : .3);
    p.setX(i, x * crimp); p.setZ(i, z * crimp);
  }
  skirt.computeVertexNormals();
  part(group, skirt, mat(b.crown, { ...metal, side: THREE.DoubleSide }), 0, radius * .16, 0);
  const face = painted(256, 256, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = b.crown; ctx.fillRect(0, 0, w, w);
    if (brand === 'tricolor') {
      ['#ffd23f', '#1f4fd1', '#d62828'].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(0, i * w / 3, w, w / 3 + 1); });
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 8; i++) { const a = Math.PI * (1.15 + i * .1); ctx.beginPath(); ctx.arc(c + Math.cos(a) * 64, c + 34 + Math.sin(a) * 64, 9, 0, Math.PI * 2); ctx.fill(); }
      return;
    }
    ctx.fillStyle = b.face; ctx.beginPath(); ctx.arc(c, c, c * .82, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = b.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(c, c, c * .68, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = b.ink; ctx.font = `${b.word.length > 5 ? 50 : 62}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(b.word, c, c + 4, w * .74);
  });
  const top = new THREE.CircleGeometry(radius, 48); top.rotateX(-Math.PI / 2);
  part(group, top, mat('#ffffff', { ...metal, map: face }), 0, radius * .32, 0);
  if (bent > 0) group.traverse(o => {
    if (!o.isMesh) return;
    const q = o.geometry.attributes.position;
    for (let i = 0; i < q.count; i++) { const x = q.getX(i); q.setY(i, q.getY(i) + Math.abs(x) * Math.abs(x) / radius * bent * .9 - (x > 0 ? x * bent * .25 : 0)); }
    o.geometry.computeVertexNormals();
  });
  group.userData.previewBounds = [[-.13, -.02, -.13], [.13, .1, .13]];
  return owned(group);
}

// ---------- the sticks ----------
export const PALOS = {
  escoba: { label: 'Palo de escoba', color: '#c9955a', length: 1.25 },
  coleto: { label: 'Palo de coleto', color: '#8bb7d6', length: 1.18 },
  tricolor: { label: 'Palo tricolor', color: '#ffd23f', length: 1.25 },
  teipe: { label: 'Palo con teipe', color: '#c9955a', length: 1.25 },
  dorado: { label: 'Palo dorado', color: '#e3b23c', length: 1.3 },
};
// A broomstick bat, 3 cm thick. Origin at the grip end, the stick along +Y.
export function createPalo({ kind = 'escoba' } = {}) {
  const k = PALOS[kind] || PALOS.escoba, group = new THREE.Group(); group.name = k.label;
  const r = .028, L = k.length, extra = kind === 'dorado' ? { metalness: .7, roughness: .3 } : { roughness: .55 };
  if (kind === 'tricolor') ['#ffd23f', '#1f4fd1', '#d62828'].forEach((color, i) => part(group, new THREE.CylinderGeometry(r, r, L / 3, 14), mat(color), 0, L / 6 + i * L / 3, 0));
  else part(group, new THREE.CylinderGeometry(r, r, L, 14), mat(k.color, extra), 0, L / 2, 0);
  part(group, new THREE.SphereGeometry(r, 12, 8), mat(k.color, extra), 0, L, 0);
  if (kind === 'coleto') part(group, new THREE.CylinderGeometry(r * .7, r * .35, .06, 10), mat('#d9d9d9', { metalness: .6 }), 0, L + .03, 0);
  if (kind === 'escoba') part(group, new THREE.CylinderGeometry(r * 1.05, r * 1.05, .05, 14), mat('#e85d3a'), 0, L - .04, 0);
  if (kind === 'teipe' || kind === 'dorado') for (let i = 0; i < 7; i++) {
    const wrap = part(group, new THREE.TorusGeometry(r * 1.05, .007, 6, 16), mat(kind === 'teipe' ? '#2b2d42' : '#fff2b8'), 0, .05 + i * .045, 0); wrap.rotation.x = Math.PI / 2 + .25;
  }
  group.userData.previewBounds = [[-.3, 0, -.3], [.3, 1.35, .3]];
  return owned(group);
}

// ---------- the señora's window ----------
// A barred window in a stucco patch, 2,4 × 2,4 m: open green shutters, a
// flower pot on the sill. The opening's centre is at x = 0, y = 1,95 above
// the patch's base; userData.opening = [x0, x1, y0, y1] relative to it.
export function createSenoraWindow() {
  const group = new THREE.Group(); group.name = 'La ventana de la señora';
  part(group, new THREE.BoxGeometry(2.4, 2.4, .12), mat('#f3d9a4', { roughness: .95 }), 0, 1.2 + .55, 0);
  const frame = mat('#ffffff', { roughness: .5 }), green = mat('#2f8f6b'), iron = mat('#2b2d42', { metalness: .5, roughness: .4 });
  part(group, new THREE.BoxGeometry(1.5, 1.2, .05), mat('#3b2a1e', { roughness: 1 }), 0, 1.95, .04);
  for (const [w, h, x, y] of [[1.7, .12, 0, 2.6], [1.7, .14, 0, 1.3], [.12, 1.4, -.8, 1.95], [.12, 1.4, .8, 1.95]]) part(group, new THREE.BoxGeometry(w, h, .14), frame, x, y, .08);
  for (let i = -3; i <= 3; i++) part(group, new THREE.CylinderGeometry(.015, .015, 1.2, 6), iron, i * .2, 1.95, .12);
  for (const s of [-1, 1]) {
    const shutter = new THREE.Group(); shutter.position.set(s * .8, 1.95, .14); shutter.rotation.y = s * -1.1; group.add(shutter);
    part(shutter, new RoundedBoxGeometry(.75, 1.26, .05, 2, .02), green, s * .375, 0, 0);
    for (let i = 0; i < 6; i++) part(shutter, new THREE.BoxGeometry(.62, .03, .02), mat('#246f53'), s * .375, -.5 + i * .2, .03);
  }
  part(group, new THREE.BoxGeometry(1.8, .08, .32), frame, 0, 1.22, .18);
  part(group, new THREE.CylinderGeometry(.13, .1, .2, 12), mat('#c4572a'), .45, 1.36, .2);
  for (let i = 0; i < 5; i++) part(group, new THREE.SphereGeometry(.07, 8, 6), mat(i % 2 ? '#ff4f6d' : '#52d273'), .45 + Math.cos(i * 1.3) * .08, 1.52 + (i % 3) * .03, .2 + Math.sin(i * 1.3) * .06);
  group.userData.opening = [-.75, .75, 1.35, 2.55];
  return owned(group);
}

// ---------- floors ----------
// The barrio's T junction, the plate at the origin and the street out to −Z:
// the near street between house fronts, the sidewalk (la acera) where the
// cross street starts, the cross street and the far sidewalk under the
// house fronts at z = −26. Chalk plate and pitcher's mark included.
export function createStreetGround({ acera = 12.5, wall = 26, side = 4.6, cross = 12 } = {}) {
  const group = new THREE.Group(); group.name = 'La calle del barrio';
  const asphalt = mat('#55565e', { roughness: .95 }), walk = mat('#c9c0b0', { roughness: .9 }), curb = mat('#e8e2d6', { roughness: .8 });
  const chalk = mat('#ffffff', { roughness: .9 }), yellow = mat('#ffd23f', { roughness: .8 });
  const slab = (w, h, d, m, x, y, z) => part(group, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  slab(140, .1, 140, mat('#8c8473', { roughness: 1 }), 0, -.08, -20);
  const near = acera - 1.1 + 5, nearZ = 5 - near / 2;   // from z = 5 to the sidewalk
  slab((side - 1.2) * 2, .06, near, asphalt, 0, 0, nearZ);
  for (const s of [-1, 1]) {
    slab(1.2, .18, near, walk, s * (side - .6), .06, nearZ);
    slab(.14, .2, near, curb, s * (side - 1.2), .07, nearZ);
  }
  slab(cross * 2, .18, 1.1, walk, 0, .06, -(acera - .55));
  slab(cross * 2, .2, .14, curb, 0, .07, -acera);
  slab(cross * 2, .06, wall - acera - 1.6, asphalt, 0, 0, -(acera + (wall - acera - 1.6) / 2));
  slab(cross * 2, .18, 1.6, walk, 0, .06, -(wall - .8));
  slab(cross * 2, .2, .14, curb, 0, .07, -(wall - 1.6));
  // Painted lane dashes along the cross street, a chalk plate and the mark.
  for (let x = -cross + 1; x < cross; x += 3) slab(1.4, .01, .14, yellow, x, .035, -(acera + (wall - acera - 1.6) / 2));
  const plate = new THREE.Shape([[-.3, 0], [.3, 0], [.3, -.3], [0, -.55], [-.3, -.3]].map(([x, y]) => new THREE.Vector2(x, y)));
  const plateMesh = part(group, new THREE.ShapeGeometry(plate), chalk, 0, .035, -.25); plateMesh.rotation.x = -Math.PI / 2; plateMesh.rotation.z = Math.PI;
  slab(.7, .01, .1, chalk, 0, .035, -10.5);
  group.userData.previewBounds = [[-14, 0, -28], [14, 2, 4]];
  return owned(group);
}

// The block's court: bright blue with yellow and white lines, the plate at the
// origin and the court out to −Z (the same zones as the street).
export function createBlockCourt({ acera = 12.5, wall = 26, width = 17.2 } = {}) {
  const group = new THREE.Group(); group.name = 'La cancha del bloque';
  const blue = mat('#2c7be5', { roughness: .7 }), apron = mat('#1c5fb8', { roughness: .8 }), white = mat('#ffffff', { roughness: .7 }), yellow = mat('#ffd23f', { roughness: .7 });
  const slab = (w, h, d, m, x, y, z) => part(group, new THREE.BoxGeometry(w, h, d), m, x, y, z);
  slab(160, .1, 160, mat('#a39a86', { roughness: 1 }), 0, -.08, -20);
  slab(width + 3, .06, wall + 7, apron, 0, 0, -(wall + 7) / 2 + 4.5);
  slab(width, .08, wall + 4, blue, 0, .01, -(wall + 4) / 2 + 3.5);
  const line = (w, d, m, x, z) => slab(w, .01, d, m, x, .06, z);
  for (const s of [-1, 1]) line(.12, wall + 4, white, s * width / 2, -(wall + 4) / 2 + 3.5);
  line(width, .12, white, 0, 3.5); line(width, .12, white, 0, -wall + .5);
  line(width, .18, yellow, 0, -acera);
  line(.12, acera, yellow, -4.6, -acera / 2); line(.12, acera, yellow, 4.6, -acera / 2);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.75, 48), white); ring.rotation.x = -Math.PI / 2; ring.position.set(0, .061, -19); group.add(ring);
  const plate = new THREE.Shape([[-.3, 0], [.3, 0], [.3, -.3], [0, -.55], [-.3, -.3]].map(([x, y]) => new THREE.Vector2(x, y)));
  const plateMesh = part(group, new THREE.ShapeGeometry(plate), white, 0, .062, -.25); plateMesh.rotation.x = -Math.PI / 2; plateMesh.rotation.z = Math.PI;
  line(.7, .1, white, 0, -10.5);
  group.userData.previewBounds = [[-11, 0, -30], [11, 1, 6]];
  return owned(group);
}

// ---------- the block ----------
// Chain-link fence along +X, `length` metres, 3 m tall, with optional
// sponsor banners (invented brands).
export const SPONSORS = ['Kolita del Ávila', 'Malta Mañanera', 'Arepera La Chamba', 'Ferretería El Tornillo', 'Panadería La Cuadra'];
export function createChainFence({ length = 12, height = 3, banners = 0, seed = 0 } = {}) {
  const group = new THREE.Group(); group.name = 'Cerca de ciclón';
  const iron = mat('#9aa3ad', { metalness: .6, roughness: .4 });
  const mesh = painted(128, 128, (ctx, w) => {
    ctx.strokeStyle = 'rgba(200,208,216,.95)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, w); ctx.moveTo(w, 0); ctx.lineTo(0, w); ctx.stroke();
  });
  mesh.wrapS = mesh.wrapT = THREE.RepeatWrapping; mesh.repeat.set(length / .5, height / .5);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(length, height), new THREE.MeshStandardMaterial({ map: mesh, transparent: true, alphaTest: .3, side: THREE.DoubleSide, metalness: .4, roughness: .5 }));
  net.position.set(0, height / 2, 0); group.add(net);
  for (let x = -length / 2; x <= length / 2 + .01; x += 3) part(group, new THREE.CylinderGeometry(.045, .045, height + .1, 8), iron, x, (height + .1) / 2, 0);
  part(group, new THREE.CylinderGeometry(.03, .03, length, 8), iron, 0, height, 0).rotation.z = Math.PI / 2;
  for (let i = 0; i < banners; i++) {
    const name = SPONSORS[(seed + i) % SPONSORS.length], colors = ['#d62828', '#ffd23f', '#2ad1b2', '#ff8a3d', '#8e4de8'];
    const tex = painted(512, 128, (ctx, w, h) => {
      ctx.fillStyle = colors[(seed + i) % colors.length]; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.fillStyle = '#ffffff'; ctx.font = `54px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, w / 2, h / 2 + 3, w - 40);
    });
    const banner = part(group, new THREE.PlaneGeometry(2.6, .65), mat('#ffffff', { map: tex, side: THREE.DoubleSide }), -length / 2 + (i + .5) * length / banners, 1.1, .03);
    banner.castShadow = false;
  }
  group.userData.previewBounds = [[-length / 2, 0, -1], [length / 2, height, 1]];
  return owned(group);
}

// Three-step metal bleachers, 6 m long, seats facing +Z; userData.seats are
// the seat points for the crowd.
export function createBleachers({ length = 6 } = {}) {
  const group = new THREE.Group(); group.name = 'Gradas';
  const plank = mat('#e8e2d6', { roughness: .6 }), iron = mat('#5b6b7a', { metalness: .5, roughness: .4 }), seats = [];
  for (let i = 0; i < 3; i++) {
    part(group, new THREE.BoxGeometry(length, .08, .45), plank, 0, .45 + i * .45, -i * .7);
    part(group, new THREE.BoxGeometry(length, .06, .3), plank, 0, .2 + i * .45, -i * .7 + .25);
    for (let x = -length / 2 + .7; x < length / 2; x += 1.2) seats.push([x, .5 + i * .45, -i * .7]);
  }
  for (let x = -length / 2 + .1; x <= length / 2; x += length / 3) for (let i = 0; i < 3; i++) part(group, new THREE.BoxGeometry(.06, .45 + i * .45, .06), iron, x, (.45 + i * .45) / 2, -i * .7);
  group.userData.seats = seats;
  group.userData.previewBounds = [[-length / 2, 0, -2], [length / 2, 2, .5]];
  return owned(group);
}

// A red-and-white superbloque: a slab tower of `floors` storeys, 3 m each,
// with the stripes and the balcony grid of the reel. Front faces +Z.
export function createSuperbloque({ floors = 12, width = 22, depth = 9 } = {}) {
  const group = new THREE.Group(); group.name = 'Superbloque';
  const H = floors * 3;
  const facade = painted(512, 512, (ctx, w, h) => {
    const rows = floors, cols = 10;
    ctx.fillStyle = '#f2ece2'; ctx.fillRect(0, 0, w, h);
    for (let r = 0; r < rows; r++) {
      const y = r * h / rows;
      ctx.fillStyle = r % 2 ? '#d64933' : '#e2674f'; ctx.fillRect(0, y + h / rows * .72, w, h / rows * .28);
      for (let c = 0; c < cols; c++) {
        const x = c * w / cols;
        ctx.fillStyle = (r * 7 + c * 3) % 5 === 0 ? '#ffe9a8' : '#3d5a73'; ctx.fillRect(x + w / cols * .18, y + h / rows * .18, w / cols * .64, h / rows * .46);
        if ((r * 5 + c) % 4 === 0) { ctx.fillStyle = ['#ff4f6d', '#2ad1b2', '#ffc629'][(r + c) % 3]; ctx.fillRect(x + w / cols * .2, y + h / rows * .6, w / cols * .6, h / rows * .1); }
      }
    }
  });
  const side = painted(128, 512, (ctx, w, h) => { ctx.fillStyle = '#e8e0d2'; ctx.fillRect(0, 0, w, h); for (let r = 0; r < floors; r++) { ctx.fillStyle = '#d64933'; ctx.fillRect(0, r * h / floors + h / floors * .75, w, h / floors * .25); } });
  const front = mat('#ffffff', { map: facade, roughness: .9 }), flank = mat('#ffffff', { map: side, roughness: .9 }), roof = mat('#bdb3a3', { roughness: 1 });
  part(group, new THREE.BoxGeometry(width, H, depth), [flank, flank, roof, roof, front, front], 0, H / 2, 0);
  for (let r = 1; r < floors; r += 1) part(group, new THREE.BoxGeometry(width + .2, .14, .5), mat('#f7f2ea'), 0, r * 3, depth / 2 + .2);
  part(group, new THREE.BoxGeometry(3, 2.4, 3), roof, width / 2 - 3, H + 1.2, 0);
  group.userData.previewBounds = [[-width / 2, 0, -depth / 2], [width / 2, H + 3, depth / 2 + 1]];
  return owned(group);
}

// The apodo and number on the back of a franela: a 0,62 m decal facing +Z
// (the scene turns it to the pana's back).
export function createApodo({ name = 'Pana', number = 4, color = '#e8453c' } = {}) {
  const map = painted(256, 256, (ctx) => {
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `44px ${DISPLAY}`; ctx.fillText(String(name).toUpperCase(), 128, 60, 236);
    ctx.font = `130px ${DISPLAY}`; ctx.lineWidth = 10; ctx.strokeStyle = color; ctx.strokeText(String(number), 128, 160); ctx.fillText(String(number), 128, 160);
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62), new THREE.MeshStandardMaterial({ map, transparent: true, roughness: .8 }));
  decal.name = `Apodo · ${name}`; decal.userData.dispose = () => { map.dispose(); decal.geometry.dispose(); decal.material.dispose(); };
  return decal;
}

// The tuyuyo: a shiny pink bump for the forehead after a chapazo.
export function createTuyuyo({ size = .16 } = {}) {
  const group = new THREE.Group(); group.name = 'Tuyuyo';
  part(group, new THREE.SphereGeometry(size, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ff7a9a', { roughness: .3 }), 0, 0, 0);
  part(group, new THREE.SphereGeometry(size * .25, 8, 6), mat('#ffffff', { roughness: .1, emissive: '#ffffff', emissiveIntensity: .4 }), -size * .3, size * .7, size * .2);
  group.userData.previewBounds = [[-.2, 0, -.2], [.2, .2, .2]];
  return owned(group);
}

// ---------- the jugadas' extras ----------
// Props for the jugadas locas (jugada-motion.js), sized for the game's panas.

// The broken palo: the grip half (origin at the grip, along +Y) and the loose
// top half (origin at the break), both splintered. userData.low / .top.
export const PALO_BREAK = .7;
export function createPaloPartido({ kind = 'escoba' } = {}) {
  const k = PALOS[kind] || PALOS.escoba, group = new THREE.Group(); group.name = `${k.label} partido`;
  const r = .028, m = mat(k.color, { roughness: .55 }), splinter = new THREE.ConeGeometry(r, .07, 6);
  const low = new THREE.Group(), top = new THREE.Group(); group.add(low, top);
  part(low, new THREE.CylinderGeometry(r, r, PALO_BREAK, 14), m, 0, PALO_BREAK / 2, 0);
  part(low, splinter, m, 0, PALO_BREAK + .03, 0);
  part(top, new THREE.CylinderGeometry(r, r, k.length - PALO_BREAK, 14), m, 0, (k.length - PALO_BREAK) / 2, 0);
  part(top, splinter, m, 0, -.03, 0).rotation.x = Math.PI;
  part(top, new THREE.SphereGeometry(r, 12, 8), m, 0, k.length - PALO_BREAK, 0);
  top.position.set(.12, PALO_BREAK + .05, 0); top.rotation.z = -.35;
  Object.assign(group.userData, { low, top, previewBounds: [[-.3, 0, -.3], [.4, 1.35, .3]] });
  return owned(group);
}

// The other equipment: a stitched ball and a wooden bat (origin at the knob,
// along +Y, as long as a palo), for the Pelota y bate option.
export function createPelota({ radius = .065 } = {}) {
  const group = new THREE.Group(); group.name = 'Pelota';
  part(group, new THREE.SphereGeometry(radius, 24, 16), mat('#fff4dd', { roughness: .7 }));
  const stitch = new THREE.MeshBasicMaterial({ color: '#bd3d31' });
  for (const sign of [-1, 1]) {
    const pts = Array.from({ length: 49 }, (_, i) => { const a = i / 48 * Math.PI * 2; return new THREE.Vector3(sign * radius * .5, radius * .87 * Math.sin(a), radius * .87 * Math.cos(a)); });
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 48, radius * .04, 5, true), stitch));
  }
  group.userData.previewBounds = [[-.08, -.08, -.08], [.08, .08, .08]];
  return owned(group);
}
export function createBate({ length = 1.25 } = {}) {
  const group = new THREE.Group(), k = length / 1.7; group.name = 'Bate de madera';
  const shape = [[.045, 0], [.055, .06], [.035, .1], [.04, .45], [.085, 1.05], [.09, 1.6], [.065, 1.68], [0, 1.7]].map(([r, y]) => new THREE.Vector2(r * k, y * k));
  part(group, new THREE.LatheGeometry(shape, 24), mat('#b77d42', { roughness: .5 }));
  group.userData.previewBounds = [[-.3, 0, -.3], [.3, 1.35, .3]];
  return owned(group);
}

// A street dog, caramel coloured, about knee high on a pana. Faces +Z.
// userData.pose(phase, running, wag) moves its legs, body and tail;
// userData.mouth is where it carries the chapita.
export function createPerro() {
  const group = new THREE.Group(); group.name = 'Perro callejero';
  const fur = mat('#c98a4b', { roughness: .9 }), light = mat('#e7b27a', { roughness: .9 }), dark = mat('#6b4226', { roughness: .9 }), black = mat('#1b1410', { roughness: .3 });
  const S = .5, rig = new THREE.Group(); rig.scale.setScalar(S); group.add(rig);
  const body = new THREE.Group(); body.position.y = .62; rig.add(body);
  part(body, new THREE.SphereGeometry(.38, 20, 14), fur).scale.set(.75, .72, 1.35);
  const head = new THREE.Group(); head.position.set(0, .32, .5); body.add(head);
  part(head, new THREE.SphereGeometry(.26, 18, 14), fur);
  part(head, new THREE.SphereGeometry(.14, 14, 10), light, 0, -.07, .24).scale.set(.95, .75, 1.2);
  part(head, new THREE.SphereGeometry(.05, 10, 8), black, 0, -.02, .41);
  for (const s of [-1, 1]) {
    part(head, new THREE.SphereGeometry(.035, 8, 6), black, s * .11, .08, .21);
    const ear = part(head, new THREE.SphereGeometry(.12, 12, 8), dark, s * .22, .04, -.02); ear.scale.set(.4, 1, .7); ear.rotation.z = s * .5;
  }
  const mouth = new THREE.Object3D(); mouth.position.set(0, -.14, .36); head.add(mouth);
  const legs = [[.17, .33], [-.17, .33], [.17, -.33], [-.17, -.33]].map(([x, z]) => {
    const leg = new THREE.Group(); leg.position.set(x, -.05, z); body.add(leg);
    part(leg, new THREE.CylinderGeometry(.06, .05, .5, 10), fur, 0, -.27, 0);
    part(leg, new THREE.SphereGeometry(.07, 10, 8), dark, 0, -.53, .03);
    return leg;
  });
  const tail = new THREE.Group(); tail.position.set(0, .12, -.48); tail.rotation.x = -.8; body.add(tail);
  part(tail, new THREE.CylinderGeometry(.035, .02, .42, 8), fur, 0, .2, 0);
  Object.assign(group.userData, { body, head, mouth, legs, tail,
    pose(phase = 0, running = false, wag = 0) {
      legs.forEach((leg, i) => { leg.rotation.x = running ? Math.sin(phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * .8 : 0; });
      body.position.y = .62 + (running ? Math.abs(Math.sin(phase)) * .06 : 0);
      tail.rotation.z = Math.sin(wag * 18) * .6; head.rotation.x = 0;
    },
    previewBounds: [[-.3, 0, -.4], [.3, .55, .5]] });
  return owned(group);
}

// A storm drain grate set in the street, 0,55 × 0,85 m, flush with the ground.
export function createAlcantarilla() {
  const group = new THREE.Group(); group.name = 'Alcantarilla';
  part(group, new THREE.BoxGeometry(.62, .03, .92), mat('#8d8a82', { roughness: .95 }), 0, .015, 0);
  part(group, new THREE.BoxGeometry(.55, .035, .85), mat('#1e2228', { roughness: .9 }), 0, .02, 0);
  const bar = mat('#6d737c', { metalness: .4, roughness: .5 });
  for (let i = -3; i <= 3; i++) part(group, new THREE.BoxGeometry(.5, .025, .04), bar, 0, .04, i * .11);
  group.userData.previewBounds = [[-.4, 0, -.5], [.4, .1, .5]];
  return owned(group);
}

// The abuelo's newspaper, open wide: El Barrio, 0,8 × 0,56 m, facing +Z.
export function createPeriodico() {
  const map = painted(256, 180, (ctx, w, h) => {
    ctx.fillStyle = '#f4f1e8'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#1d1d1d';
    ctx.font = '900 30px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillText('EL BARRIO', w / 2, 34); ctx.fillRect(10, 42, w - 20, 3);
    ctx.fillStyle = '#9a9a9a'; ctx.fillRect(14, 54, 100, 70);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = '#b5b0a4'; ctx.fillRect(126, 56 + i * 12, w - 140, 5); ctx.fillRect(14, 132 + i % 4 * 12, 100, 5); }
  });
  const group = new THREE.Group(); group.name = 'Periódico El Barrio';
  part(group, new THREE.PlaneGeometry(.8, .56), new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: .9 }));
  group.userData.previewBounds = [[-.45, -.3, -.1], [.45, .3, .1]];
  return owned(group);
}

// A tumbleweed of dry twigs for when the street goes quiet. Radius 0,25 m.
export function createBolaDePaja({ radius = .25 } = {}) {
  const group = new THREE.Group(); group.name = 'Bola de paja';
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), new THREE.MeshBasicMaterial({ color: '#9b7a4a', wireframe: true })));
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(radius * .7, 1), new THREE.MeshBasicMaterial({ color: '#7d5f36', wireframe: true })));
  group.userData.previewBounds = [[-.3, -.3, -.3], [.3, .3, .3]];
  return owned(group);
}
