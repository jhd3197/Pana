// The camp's cavern: a rock terrace on the shore of an underground lake, in a hall
// so big its far wall is a blue haze. A rock tower holds the mine mouth, a low berm
// rings the rest of the walkable rect, and past it the hall goes on (camp-vista.js:
// columns, carved faces, the road, the shore) with a pit under the gantry for the
// way down, a cold shaft from a hole far above and warm pools from a few lamps.
//
// Looks only. Collision comes from layout.js and never reads this file: the rock
// stands past the edge of CAMP_RECT, and what stands inside it hangs overhead or
// lies flat on the floor. No lights either: LAMPS lends the view's fixed pool
// (view.js), so going down the lift recompiles nothing. The rock and the vista are
// the same for every run, so they are built once and each jornada's world reuses them.
import * as THREE from 'three';
import { fbm2, rng } from '/engine/random.js';
import { loc } from '/engine/i18n.js';
import { bake } from '/engine/models/core/static-batch.js';
import { mineLantern, mineLadder, mineSupport, mineTrack, mineCart, bulbWire } from '/engine/models/props/mine.js';
import { glowMushrooms, mushroomHalos, MUSHROOM_GLOW } from '/engine/models/props/glow-mushrooms.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { buildVista, ceilingAt, HOLE, LAKE_Y, LEDGE_MUSHROOMS, PIT, HEAD, GATE, SEARCHLIGHT } from './camp-vista.js';
import { createBeams, createFallsMesh, createFarGlows, createLake, createSpores } from './camp-falls.js';
import { dressExpedition } from './camp-gear.js';

export { ceilingAt };

// The tower of rock the mine goes into: its foot stands just past the rect's north edge.
const TOWER = [[-20.5, -2.8], [-3.2, -2.8], [3.2, -2.8], [4.6, -2.8], [4.6, -14], [3, -25], [-7, -33], [-20, -32], [-31, -20], [-28, -8]], TOWER_MID = [-11, -16];
const TOWER_ROWS = [-12, -5, -1, .6, 1.8, 3.2, 4.7, 6.2, 8, 10, 12.5, 15, 19, 25, 33, 44, 58, 76, 96, 118, 146];
const CLIFF_ROWS = [-.04, -2, -5, -9, -13];
// The berm around the rest of the rect, walked with its outside on the left. A gap lets the road out.
const BERM = [[19.5, 17.6], [19.5, 26], [19.3, 31.7], [10, 32], [0, 32.2], [-10, 32], [-19.3, 31.7], [-19.5, 20], [-19.5, 8], [-19.4, -6]];
export const ROAD_GAP = [-6.2, -.6];
const inGap = (x, z) => z > 29 && x > ROAD_GAP[0] && x < ROAD_GAP[1];
// The decal of paler stone across the camp, from the mine to the gap: flat, so nothing to collide with.
const WALKWAY = [[1.9, -1.8], [2.4, 1.6], [5.6, 5.4], [5.6, 9.2], [2.4, 13.2], [-1.2, 16.6], [-3.2, 20.6], [-4.8, 25], [-3.6, 29], [-3.4, 32]];
// The portal's opening: rock only above it.
const inPortal = (x, z) => Math.abs(x) <= 3.2 && z > -3.5 && z < -2;

// Warm pools, each one a slot of the view's light pool while you are at the camp.
export const LAMPS = [
  { x: -10.8, y: 3, z: 6, color: 0xffa24a, power: 16, reach: 14 },      // the shop
  { x: -7, y: 3.1, z: 9.6, color: 0xffb066, power: 9, reach: 10 },      // the expedition table
  { x: 1.6, y: 3.3, z: -.9, color: 0xffb35c, power: 18, reach: 15 },   // the mine mouth
  { x: 0, y: 3.4, z: -5.2, color: 0xffc98a, power: 15, reach: 11 },     // the welcome at the lift, where you come up
  { x: 8.5, y: 3.7, z: 16.5, color: 0xffa858, power: 15, reach: 14 },   // the truck
  { x: 3, y: 1.1, z: 26, color: 0xff7a30, power: 16, reach: 14 },       // the campfire
  { x: 16.6, y: 3, z: 4, color: 0xa8c4ff, power: 11, reach: 13 },       // cold, on the rim
];
// Water falling on the puddles, and the sound of it (ambience.js): period and phase in seconds.
export const DRIPS = [{ x: -3, z: 18.5, r: 1.3, period: 3.7, phase: 0 }, { x: 5.5, z: 9.5, r: 1, period: 5.3, phase: 1.4 }, { x: -11, z: 14.5, r: 1.6, period: 4.4, phase: 2.2 }, { x: 13, z: 6.5, r: 1.1, period: 6.1, phase: .7 }];
const PUDDLES = [...DRIPS, { x: -6, z: 2.5, r: .9 }, { x: 1, z: 29.6, r: 1.2 }, { x: 14.5, z: 27.5, r: 1 }, { x: -15, z: 26, r: .8 }];
// Water falls from up in the dark: a drop is only ever seen for its last stretch.
const DRIP_TOP = 15;
const MUSHROOMS = [[-18.7, 12, 'blue'], [-18.6, 21, 'purple'], [-18.8, 3.5, 'blue'], [18.9, 25, 'blue'], [8, 30.8, 'purple'], [-13, 30.9, 'blue'], [-9, -2.2, 'purple']];
const FALL = 1.05;   // seconds a drop takes from the ceiling
// How far a hanging chain runs up: past where the dark has it.
const CHAIN = 62;
const RAIL = .6;     // the library's track is built wide for a roller coaster
// A drop reaching its puddle during the dt that ends at t (the same clock as the view's).
export const dripLands = (d, t, dt) => { const k = (t + d.phase) % d.period - FALL; return k >= 0 && k < dt; };

// Along a polyline, a point every `step` with its normal to the left of travel; `closed` joins the ends.
function walk(line, step, closed) {
  const out = [], n = closed ? line.length : line.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, az] = line[i], [bx, bz] = line[(i + 1) % line.length], len = Math.hypot(bx - ax, bz - az), parts = Math.max(1, Math.round(len / step));
    for (let k = 0; k < parts; k++) out.push([ax + (bx - ax) * k / parts, az + (bz - az) * k / parts, (bz - az) / len, -(bx - ax) / len]);
  }
  if (closed) out.push(out[0]); else { const [x, z] = line[n], last = out.at(-1); out.push([x, z, last[2], last[3]]); }
  return out;
}
// The floor's broken lip: it only ever breaks toward the chasm, past the rect.
const RIM = walk([[4.5, -2.5], [18.5, -2.5], [18.5, 18.7]], 1.1, false).map(([x, z, nx, nz]) => { const out = fbm2(x * .7 + 4, z * .7) * 1.3; return [x + nx * out, z + nz * out, nx, nz]; });
const FLOOR_EDGE = [[-20.8, -2.7], ...RIM.map(([x, z]) => [x, z]), [20.8, 19], [20.8, 32.8], [-20.8, 32.8]];

const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const towerPinch = y => y < 10 ? 1 : y < 76 ? 1 - .5 * smooth((y - 10) / 66) : .5 + .75 * smooth((y - 76) / 66);
function rockGeometry() {
  const positions = [], colors = [], index = [], R = rng(9101), c = new THREE.Color();
  const DAMP = new THREE.Color(0x3a4a5c), WET = new THREE.Color(0x1a2636), PALE = new THREE.Color(0x64788c), COLD = new THREE.Color(0x1c3248), REDDISH = new THREE.Color(0x5e2c22);
  const vertex = (x, y, z) => {
    const n = fbm2(x * .22 + y * .31, z * .22 - y * .17), rust = smooth((fbm2(x * .06 + 21, y * .09 + z * .06) - .55) * 9);
    c.copy(DAMP).lerp(n > .5 ? PALE : WET, Math.min(1, Math.abs(n - .5) * 3.2)).lerp(REDDISH, rust * .7).lerp(COLD, smooth((y - 7) / 16) * .7);
    positions.push(x, y, z); colors.push(c.r, c.g, c.b);
  };
  const strip = (path, rows, away, skip, pinch = () => 1) => {
    const base = positions.length / 3;
    for (const [x, z, nx, nz] of path) for (const y of rows) {
      const push = away(x, y, z), k = pinch(y);
      vertex(TOWER_MID[0] + (x + nx * push - TOWER_MID[0]) * k, y, TOWER_MID[1] + (z + nz * push - TOWER_MID[1]) * k);
    }
    const h = rows.length;
    for (let i = 0; i + 1 < path.length; i++) for (let r = 0; r + 1 < h; r++) {
      if (skip?.(path[i], path[i + 1], rows[r + 1])) continue;
      const a = base + i * h + r, b = a + h;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  };
  // The tower: pushed in away from the rect, so it never leans over anyone, narrowing to a waist and flaring into the roof.
  strip(walk(TOWER, 2.2, true), TOWER_ROWS, (x, y, z) => (inPortal(x, z) ? .25 : x > 4 && x < 5 && z < -3 ? .1 : 1) * (fbm2(x * .2 + 3, z * .2 + y * .24) * 3 + Math.abs(Math.sin(y * 1.1 + x * .07)) * .5), (a, b, top) => top <= 4.7 && inPortal(a[0], a[1]) && inPortal(b[0], b[1]), towerPinch);
  // The cliff under the rim, stepping out as it falls so you can see it from the edge.
  strip(RIM, CLIFF_ROWS, (x, y, z) => y > -.1 ? 0 : -y * .12 + fbm2(x * .3, z * .3 + y * .2) * 1.8);
  // The berm: over the crest and down the far side to the water, one sheet of quads.
  const path = walk(BERM, 1.7, false), rows = 8, crest = (x, z) => .35 + fbm2(x * .19 + 5, z * .19) * 1.3 + Math.max(0, Math.sin(x * .7 + z * .9) - .75) * 2;
  { const base = positions.length / 3;
    for (const [x, z, nx, nz] of path) { const top = crest(x, z), wobble = fbm2(x * .4, z * .4 + 2);
      for (const [y, out] of [[-.1, 0], [top * .55, .12], [top, .5], [top * .62, 1.2], [-1.6, 2.6 + wobble], [-5, 4.6 + wobble * 2], [-9.5, 7.5 + wobble * 3], [-14, 10 + wobble * 3]]) vertex(x + nx * out, y, z + nz * out); }
    for (let i = 0; i + 1 < path.length; i++) { if (inGap(path[i][0], path[i][1]) || inGap(path[i + 1][0], path[i + 1][1])) continue; for (let r = 0; r < rows - 1; r++) { const a = base + i * rows + r, b = a + rows; index.push(a, b, a + 1, b, b + 1, a + 1); } } }
  const cone = (x, y, z, radius, length, tip) => {
    const base = positions.length / 3, sides = 6, spin = R() * 6;
    for (const [k, r] of [[0, 1], [.45, .55 + R() * .1]]) for (let s = 0; s < sides; s++) { const a = spin + s / sides * Math.PI * 2, w = r * radius * (.85 + R() * .3); vertex(x + Math.cos(a) * w, y + tip * length * k, z + Math.sin(a) * w); }
    vertex(x + (R() - .5) * radius * .4, y + tip * length, z + (R() - .5) * radius * .4);
    for (let s = 0; s < sides; s++) { const a = base + s, b = base + (s + 1) % sides; index.push(a, b, a + sides, b, b + sides, a + sides, a + sides, b + sides, base + sides * 2); }
  };
  // Teeth and boulders at the berm's foot, just past the rect, and spires standing on its far side.
  const foot = [];
  for (let z = 0; z < 31; z += 1.9) foot.push([-18.9 - R() * .3, z]);
  for (let x = -18; x < 18; x += 1.9) foot.push([x, 30.9 + R() * .3]);
  for (let z = 19.5; z < 31; z += 1.9) foot.push([18.9 + R() * .3, z]);
  for (let x = -18; x < -3.8; x += 2.3) foot.push([x, -2.9 - R() * .2]);
  for (const [i, [x, z]] of foot.entries()) { if (inGap(x, z) || (z > 0 && i % 2)) continue; const length = z > 0 ? .3 + R() * R() * 1.1 : .5 + R() * R() * 3.4; cone(x, -.1, z, .22 + length * .14, length, 1); }
  for (let i = 0; i < 34; i++) { const [x, z, nx, nz] = path[Math.floor(R() * path.length)]; if (inGap(x, z)) continue; const out = 3 + R() * 6, length = 1 + R() * R() * 3.5; cone(x + nx * out, -9, z + nz * out, .8 + length * .13, length + 7.5, 1); }
  // A pedestal under the searchlight, and the tower's feet.
  cone(SEARCHLIGHT.x + .4, -14, SEARCHLIGHT.z, 3.4, 14.2, 1);
  for (let i = 0; i < 14; i++) { const x = -24 - R() * 10, z = -4 - R() * 26, length = 4 + R() * R() * 14; cone(x, -9, z, 1.2 + length * .15, length, 1); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}
// The far hall's two soups (camp-vista.js): what stands in the air, and its image in the lake.
function vistaGeometries() {
  const v = buildVista(), soup = (p, c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeBoundingSphere(); return g; };
  return { vista: soup(v.positions, v.colors), mirror: soup(v.mirrorPositions, v.mirrorColors), glows: v.glows };
}

// A wide patch of damp rock floor, painted once and tiled every 9 m: soft blotches and grit.
function paintFloor() {
  const size = 512, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), R = rng(58);
  ctx.fillStyle = '#3a3e46'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 150; i++) {
    const x = R() * size, y = R() * size, r = 14 + R() * 62, light = R() < .45, tone = light ? '96,104,116' : '24,28,36', a = .1 + R() * .22;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) { const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, `rgba(${tone},${a})`); g.addColorStop(1, `rgba(${tone},0)`); ctx.fillStyle = g; ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
  }
  for (let i = 0; i < 2600; i++) { const n = R() < .5; ctx.fillStyle = n ? 'rgba(20,20,22,.2)' : 'rgba(140,134,124,.12)'; ctx.fillRect(R() * size, R() * size, 1 + R(), 1 + R()); }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(1 / 9, 1 / 9); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
function paintMist() {
  const size = 256, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), R = rng(77);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 46; i++) {
    const x = R() * size, y = R() * size, r = 24 + R() * 56, a = .05 + R() * .09;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) { const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// The shaft from the hole: an open cone that fades downward and at its edges, seen only from outside.
function shaftMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz); vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        float edge = pow(abs(dot(vN, vView)), 2.0), fall = pow(vUv.y, 1.15);
        float streak = .72 + .28 * sin(vUv.x * 44.0 + sin(vUv.x * 13.0) * 3.0 + uTime * .12);
        gl_FragColor = vec4(vec3(.5, .64, .86) * edge * fall * streak * 1.05, 1.0); }`,
  });
}
// Dust sifting down the shaft, one draw.
function shaftDust(uniforms) {
  const count = 110, R = rng(31), positions = new Float32Array(count * 3), phases = new Float32Array(count);
  for (let i = 0; i < count; i++) { const a = R() * 6.283, r = Math.sqrt(R()) * 4; positions.set([Math.cos(a) * r, R() * 56, Math.sin(a) * r], i * 3); phases[i] = R() * 100; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -2, 0), 40);
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; attribute float phase; varying float vA;
      void main() {
        float y = 30.0 - mod(position.y + uTime * (.7 + fract(phase) * .6), 56.0);
        vec3 p = vec3(position.x + sin(uTime * .3 + phase) * .5, y, position.z + cos(uTime * .23 + phase) * .5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = smoothstep(-26.0, 4.0, y) * (.55 + .45 * sin(uTime * 1.4 + phase * 3.0));
        gl_PointSize = 34.0 / -mv.z * (.7 + fract(phase * 7.0)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA;
      void main() { float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(.62, .72, .9) * (1.0 - smoothstep(.1, .5, d)) * vA * .75, 1.0); }`,
  });
  const points = new THREE.Points(geometry, material); points.position.set(HOLE.x, 0, HOLE.z); points.name = 'Polvo del hueco';
  return points;
}

let shared = null;
const assets = () => shared ||= { rock: rockGeometry(), floor: paintFloor(), mist: paintMist(), ...vistaGeometries() };

// A plank with paint on it; the words come through the locale table.
function plank(own, text, { width = 2.4, height = .62, arrow = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.round(512 * height / width);
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#5a4230'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#3e2c20'; for (let y = h / 3; y < h; y += h / 3) ctx.fillRect(0, y, w, 3);
  ctx.fillStyle = '#e8c872'; ctx.font = `900 ${h * .46}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text.toUpperCase(), arrow ? w * .44 : w / 2, h * .54, w * (arrow ? .74 : .92));
  if (arrow) { const x = w * .9, m = h / 2; ctx.beginPath(); ctx.moveTo(x - h * .14, m - h * .3); ctx.lineTo(x + h * .14, m - h * .3); ctx.lineTo(x + h * .14, m + .02 * h); ctx.lineTo(x + h * .3, m + .02 * h); ctx.lineTo(x, m + h * .36); ctx.lineTo(x - h * .3, m + .02 * h); ctx.lineTo(x - h * .14, m + .02 * h); ctx.closePath(); ctx.fill(); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, .06), [0, 1, 2, 3, 4, 5].map(i => own(new THREE.MeshStandardMaterial(i === 4 ? { map: texture, roughness: .9 } : { color: 0x3e2c20, roughness: .95 }))));
}

export function createCampCave({ halo = glowTexture() } = {}) {
  const cave = new THREE.Group(); cave.name = 'Caverna';
  const { rock, floor: floorMap, mist: mistMap, vista, mirror, glows: vistaGlows } = assets(), materials = [], own = m => { materials.push(m); return m; };
  cave.add(new THREE.Mesh(rock, own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, flatShading: true, side: THREE.DoubleSide }))));
  // The floor: everything inside the outline but the chasm.
  const shape = new THREE.Shape(FLOOR_EDGE.map(([x, z]) => new THREE.Vector2(x, -z)));
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), own(new THREE.MeshStandardMaterial({ map: floorMap, roughness: .82 })));
  floor.position.y = -.04; cave.add(floor);
  // The whole far hall: one unlit, unfogged draw, and its reflection under the lake's sheet.
  const distance = own(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, toneMapped: false }));
  const hall = new THREE.Mesh(vista, distance); hall.name = 'Caverna lejana'; cave.add(hall);
  const image = new THREE.Mesh(mirror, distance); image.name = 'Reflejos'; cave.add(image);
  const lake = createLake(); own(lake.material); cave.add(lake);
  // The way across the camp: the same stone, paler, flat on the floor.
  { const n = 60, width = 1.25, points = [], tints = [], uvs = [], faces = [], pale = new THREE.Color(), curve = new THREE.CatmullRomCurve3(WALKWAY.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    for (let i = 0; i <= n; i++) {
      const p = curve.getPoint(i / n), q = curve.getTangent(i / n), w = width * (.8 + fbm2(i * .3, 1) * .5);
      for (const [side, k] of [[-1, 1.7], [-.7, 3.4], [.7, 3.4], [1, 1.7]]) { const x = p.x - q.z * w * side, z = p.z + q.x * w * side; points.push(x, -.016, z); uvs.push(x, -z); pale.setHex(0x8fa3b4).multiplyScalar(k * (.6 + fbm2(x * .9, z * .9) * .7)); tints.push(pale.r, pale.g, pale.b); }
      if (i < n) for (let s = 0; s < 3; s++) { const a = i * 4 + s, b = a + 4; faces.push(a, a + 1, b, b, a + 1, b + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(tints, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(faces); g.computeVertexNormals();
    const walkway = new THREE.Mesh(g, own(new THREE.MeshStandardMaterial({ map: floorMap, vertexColors: true, roughness: .78, side: THREE.DoubleSide }))); walkway.name = 'Camino'; cave.add(walkway); }

  // Timber, rails, the gantry and its load: one bake.
  const wood = own(new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: .95 })), iron = own(new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: .55, metalness: .5 })), rope = own(new THREE.MeshStandardMaterial({ color: 0x5c5040, roughness: 1 })), unlit = own(new THREE.MeshBasicMaterial({ color: 0xffc070, fog: false, toneMapped: false }));
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const statics = new THREE.Group();
  const bar = (m, ax, ay, az, bx, by, bz, t = .12) => { const o = new THREE.Mesh(unit, m), a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz); o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(t, t, a.distanceTo(b)); o.lookAt(b); statics.add(o); };
  const put = (model, x, y, z, h = 0) => { model.position.set(x, y, z); model.rotation.y = h; statics.add(model); return model; };
  // One set of timber frames the gap in the berm, where the road goes down to the shore.
  put(mineSupport({ width: 5.6, height: 4.2, lantern: true }), -3.4, 0, 30.9);
  for (const y of [.55, 1.05]) bar(wood, -6, y, 30.7, -.8, y + (y > 1 ? -.1 : .1), 30.7, .12);
  for (const [a, b] of [[-5.6, -4], [-2.8, -1.2]]) { bar(wood, a, 0, 30.72, b, 1.25, 30.72, .1); bar(wood, b, 0, 30.72, a, 1.25, 30.72, .1); }
  // Rails from the middle of the camp into the mine, and a spur that runs out over the drop.
  const track = points => { const k = 1 / RAIL, model = put(mineTrack({ points: points.map(([x, z]) => [x * k, .16, z * k]), bumper: false }), 0, 0, 0); model.scale.set(RAIL, .55, RAIL); };
  track([[0, 11], [0, 5], [0, -1.4]]);
  track([[1.3, 4.4], [4.6, 1.6], [9, -.6], [12.4, -2.1]]);
  // The rail along the edge: it sits past where anyone can stand.
  const rail = [...Array(9).keys()].map(i => [5 + i * 1.65, -2.3]).concat([...Array(13).keys()].map(i => [18.25, -2.3 + i * 1.65]));
  rail.forEach(([x, z], i) => {
    bar(wood, x, -.05, z, x + (i % 3 - 1) * .03, 1.12, z, .13);
    const next = rail[i + 1]; if (!next || (x === 18.25 && z > 16)) return;
    bar(rope, x, 1.02, z, next[0], .98, next[1], .035); bar(rope, x, .6, z, next[0], .56, next[1], .03);
  });
  // A gantry reaching out over the pit, cables going straight down its well into the black.
  const GX = 11, GZ = -8.4;
  for (const s of [-.8, .8]) { bar(wood, GX + s, 5, -2, GX + s, 5.2, GZ, .24); bar(wood, GX + s, .1, -2.3, GX + s, 5, -2.3, .26); bar(wood, GX + s, 1.4, -2.5, GX + s, 5, -5.8, .16); }
  bar(wood, GX - 1.1, 5.2, GZ + .4, GX + 1.1, 5.2, GZ + .4, .2); bar(wood, GX - 1.1, 5, -2.3, GX + 1.1, 5, -2.3, .18);
  bar(iron, GX - .35, 5.2, GZ + .4, GX - .35, PIT.bottom + 4, GZ + .4, .035); bar(iron, GX + .35, 5.2, GZ + .4, GX + .35, -15.4, GZ + .4, .035);
  bar(iron, GX, 5.2, GZ + .4, GX, 40, GZ + .4, .05);
  put(mineCart({ seed: 7, load: 'empty', hollow: false }), GX + .35, -17, GZ + .4, .5);
  // A ladder bolted to the lip, down to the rock around the pit.
  { const ladder = put(mineLadder({ height: 7, lean: 0 }), 9.6, -6.8, -2.95); ladder.rotation.y = Math.PI; }
  // Cables slung overhead; the lamps hang from their chains.
  const wire = (x, z, span, h, height, sag) => {
    put(bulbWire({ span, sag, height, posts: false }), x, 0, z, h);
    for (const s of [-.5, .5]) { const ex = x + Math.cos(h) * span * s, ez = z - Math.sin(h) * span * s; bar(iron, ex, height, ez, ex, height + CHAIN, ez, .03); }
  };
  wire(-9.6, -1.7, 13, 0, 5.2, .9); wire(13, 25, 11, .3, 5.6, 1.1);
  for (const l of LAMPS) {
    if (l.y < 2) continue;
    put(mineLantern(), l.x, l.y + .5, l.z);
    bar(iron, l.x, l.y + .5, l.z, l.x, l.y + CHAIN, l.z, .028);
  }
  const glows = [];
  for (const [x, z, color] of MUSHROOMS) { put(glowMushrooms({ seed: Math.round(x * 13 + z * 7), color, count: 6, spread: .7 }), x, 0, z); glows.push({ x, y: .34, z, color: MUSHROOM_GLOW[color] }); }
  for (const [x, y, z, color, size, wall] of LEDGE_MUSHROOMS) { const model = put(glowMushrooms({ seed: Math.round(x * 17 + z * 5 + y), color, count: wall === undefined ? 5 : 4, wall: wall !== undefined, spread: .8 }), x, y, z, wall ?? 0); model.scale.setScalar(size); glows.push({ x, y: y + .3 * size, z, color: MUSHROOM_GLOW[color], big: true }); }
  const gearGlows = dressExpedition({ statics, bar, put, wood, iron, rope, unlit });
  const baked = bake(statics); statics.traverse(o => o.geometry?.dispose());
  cave.add(baked);

  // Signs, each on a post past the edge: the drop, and the way down.
  const danger = plank(own, loc('¡Peligro! Abismo')); danger.position.set(7.5, 1.42, -2.35); cave.add(danger);
  const edge = plank(own, loc('¡Peligro! Abismo')); edge.position.set(18.3, 1.42, 7.2); edge.rotation.y = -Math.PI / 2; cave.add(edge);
  const down = plank(own, loc('Montacargas'), { width: 2.2, height: .5, arrow: true }); down.position.set(0, 6.05, -1.2); cave.add(down);
  const pit = plank(own, loc('La Fosa'), { width: 2.2, height: .56, arrow: true }); pit.position.set(11, 1.42, -2.35); cave.add(pit);

  // Lamp and mushroom halos: two draws.
  const lampHalos = mushroomHalos(LAMPS.map(l => ({ x: l.x, y: l.y, z: l.z, color: l.color })), halo, { size: 2.6, opacity: .5 }); lampHalos.name = 'Halos de faroles'; cave.add(lampHalos);
  const shrooms = mushroomHalos(glows.filter(g => !g.big), halo, { size: 2.6, opacity: .7 }); cave.add(shrooms);
  // The rest, seen across the hall past the fog, each with its own size: bigger ledges, gear, the vista's lanterns and fungi.
  const far = createFarGlows([...vistaGlows, ...gearGlows, ...glows.filter(g => g.big).map(g => ({ ...g, size: 3.4 }))], halo); own(far.material); cave.add(far);
  // The falls, the amber light cones, the spores: a draw each.
  const falls = createFallsMesh(); own(falls.material); cave.add(falls);
  const beams = createBeams([
    { from: [SEARCHLIGHT.x, SEARCHLIGHT.y, SEARCHLIGHT.z], to: [HEAD.x - 4, HEAD.y + 2, HEAD.z + 6], near: .5, far: 32, color: 0xffb04a, strength: 1 },
    { from: [-22, -5, 44], to: [GATE.x, GATE.y, GATE.z], near: .3, far: 17, color: 0xffa95a, strength: .34 },
    { from: [5, -6.4, 78], to: [20, -7, 104], near: .4, far: 7.5, color: 0xffb46a, strength: .4 },
    { from: [11, 5, -8], to: [11.6, -28, -10.6], near: .3, far: 5.5, color: 0xffb46a, strength: .7 },
    { from: [1.6, 3.2, -.9], to: [1.6, -.2, -.9], near: .14, far: 2.6, color: 0xffb46a, strength: .42 },
    { from: [-7, 3, 9.6], to: [-7, -.1, 9.6], near: .14, far: 2.4, color: 0xffb46a, strength: .3 },
  ]); own(beams.material); cave.add(beams);
  const spores = createSpores({ uTime: { value: 0 } }); own(spores.material); cave.add(spores);

  // The hole far above, the light it lets in, and what sifts down through it.
  const HOLE_Y = ceilingAt(HOLE.x, HOLE.z) - 5, SHAFT_H = HOLE_Y - LAKE_Y;
  const sky = new THREE.Mesh(new THREE.CircleGeometry(HOLE.r * 1.5, 18).rotateX(Math.PI / 2), own(new THREE.MeshBasicMaterial({ color: 0xa8c6ee, fog: false }))); sky.position.set(HOLE.x, HOLE_Y, HOLE.z); cave.add(sky);
  const shaftMat = own(shaftMaterial());
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(HOLE.r * .55, HOLE.r * 1.15, SHAFT_H, 22, 1, true), shaftMat); shaft.position.set(HOLE.x, LAKE_Y + SHAFT_H / 2, HOLE.z); shaft.renderOrder = 3; shaft.name = 'Rayo del hueco'; cave.add(shaft);
  const dust = shaftDust(shaftMat.uniforms); own(dust.material); dust.renderOrder = 3; dust.position.y = 16; cave.add(dust);
  // A dim bloom far down the pit, a fainter one down the lift shaft, a warm pool where the cage comes up.
  const glowMaterial = own(new THREE.MeshBasicMaterial({ map: halo, color: 0xff7a30, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(PIT.r * 2.2, PIT.r * 2.2).rotateX(-Math.PI / 2), glowMaterial); deep.position.set(PIT.x, PIT.bottom + 5, PIT.z); cave.add(deep);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), glowMaterial); under.position.set(0, -17, -6.6); cave.add(under);
  const welcome = new THREE.Mesh(new THREE.PlaneGeometry(9, 11).rotateX(-Math.PI / 2), own(new THREE.MeshBasicMaterial({ map: halo, color: 0xffa050, transparent: true, opacity: .26, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))); welcome.position.set(0, .025, -3); welcome.name = 'Bienvenida'; cave.add(welcome);
  // Coming up the lift, the shaft's last stretch is warm with the light from above.
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 9).translate(0, 4.5, 0), own(new THREE.MeshBasicMaterial({ map: halo, color: 0xffb060, transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }))); spill.position.set(0, -9.2, -4.78); spill.rotation.y = Math.PI; spill.name = 'Luz de arriba'; cave.add(spill);
  // Sheets of fog low over the lake: one material and one scrolling texture.
  const sheets = [LAKE_Y + 1.3, LAKE_Y + 4, LAKE_Y + 11].map((y, i) => new THREE.PlaneGeometry(560, 560, 1, 1).rotateX(-Math.PI / 2).rotateY(i * .9).translate(10, y, 5));
  mistMap.repeat.set(5, 5);
  const mistMaterial = own(new THREE.MeshBasicMaterial({ map: mistMap, color: 0x7fa2c2, transparent: true, opacity: .07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  const mist = new THREE.Group(); mist.name = 'Neblina'; for (const g of sheets) { const m = new THREE.Mesh(g, mistMaterial); m.renderOrder = 2; mist.add(m); } cave.add(mist);

  // Puddles, and the drops that keep them full.
  const dummy = new THREE.Object3D();
  const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), own(new THREE.MeshStandardMaterial({ color: 0x142430, emissive: 0x0c1a26, roughness: .08, metalness: .4 })), PUDDLES.length);
  PUDDLES.forEach((p, i) => { dummy.position.set(p.x, .012, p.z); dummy.scale.set(p.r, 1, p.r * (.72 + (i % 3) * .14)); dummy.rotation.y = i * 1.3; dummy.updateMatrix(); puddles.setMatrixAt(i, dummy.matrix); });
  puddles.name = 'Charcos'; cave.add(puddles);
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 5, 4), own(new THREE.MeshBasicMaterial({ color: 0x9fc4e0 })), DRIPS.length), rings = new THREE.InstancedMesh(new THREE.RingGeometry(.86, 1, 18).rotateX(-Math.PI / 2), own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), DRIPS.length);
  drops.frustumCulled = rings.frustumCulled = false; rings.setColorAt(0, new THREE.Color(0)); cave.add(drops, rings);
  const tint = new THREE.Color();

  cave.userData.lamps = LAMPS;
  cave.userData.dispose = () => { materials.forEach(m => m.dispose()); lampHalos.material.dispose(); shrooms.material.dispose(); };
  cave.userData.tick = t => {
    if (!cave.parent?.visible) return;
    shaftMat.uniforms.uTime.value = t; falls.material.uniforms.uTime.value = t; lake.material.uniforms.uTime.value = t; spores.material.uniforms.uTime.value = t;
    beams.material.uniforms.uBreath.value = .92 + Math.sin(t * .4) * .06 + Math.sin(t * 1.3) * .02;
    mistMap.offset.set(t * .006, t * .0035);
    glowMaterial.opacity = .42 + Math.sin(t * .31) * .1 + Math.sin(t * .83 + 1) * .05;
    shrooms.material.opacity = .62 + Math.sin(t * .9) * .12;
    DRIPS.forEach((d, i) => {
      const k = (t + d.phase) % d.period, falling = k < FALL, y = DRIP_TOP * (1 - (k / FALL) ** 2);
      dummy.rotation.set(0, 0, 0); dummy.position.set(d.x, falling ? y : -5, d.z); dummy.scale.set(1, falling ? 3.4 : 1, 1); dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
      const ripple = Math.min(1, Math.max(0, (k - FALL) / .9));
      dummy.position.set(d.x, .03, d.z); dummy.scale.setScalar(.04 + ripple * .75); dummy.updateMatrix(); rings.setMatrixAt(i, dummy.matrix);
      rings.setColorAt(i, tint.setRGB(.34, .4, .46).multiplyScalar(ripple > 0 && ripple < 1 ? 1 - ripple : 0));
    });
    drops.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = rings.instanceColor.needsUpdate = true;
  };
  return cave;
}
