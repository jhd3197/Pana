// The camp's cavern: a ledge above the dark. Rock walls and a ceiling close in
// the walkable rect, its north-east side falls away into a chasm with a cold
// shaft of light from a hole far above, and a few lamps make warm pools.
//
// Looks only. Collision comes from layout.js and never reads this file: the rock
// stands past the edge of CAMP_RECT, and what stands inside it hangs overhead or
// lies flat on the floor. No lights either: LAMPS lends the view's fixed pool
// (view.js), so going down the lift recompiles nothing. One rock mesh holds the
// walls, ceiling, cliff, boulders and stalactites; it is the same for every run,
// so it is built once and a new jornada's world reuses it.
import * as THREE from 'three';
import { fbm2, rng } from '/engine/random.js';
import { loc } from '/engine/i18n.js';
import { bake } from '/engine/models/core/static-batch.js';
import { mineLantern, mineLadder, mineSupport, mineTrack, mineCart, bulbWire } from '/engine/models/props/mine.js';
import { glowMushrooms, mushroomHalos, MUSHROOM_GLOW } from '/engine/models/props/glow-mushrooms.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';

// The cavern's outline, walls included; the chasm is what the floor leaves out.
const CAVERN = [[-19.2, -2.8], [-3.2, -2.8], [3.2, -2.8], [4.6, -2.8], [4.6, -14], [8, -24], [20, -30], [34, -28], [44, -14], [46, 2], [42, 14], [30, 20], [19.4, 19], [19.4, 26], [19.2, 31.6], [10, 32], [0, 32.2], [-10, 32], [-19.2, 31.6], [-19.4, 20], [-19.6, 8]];
const WALL_ROWS = [-46, -26, -12, -5, -1, .6, 1.8, 3.2, 4.7, 6.2, 8, 10, 12.5, 15, 19, 25];
const CLIFF_ROWS = [-.04, -2, -5, -10, -18, -30, -46];
// The hole in the ceiling, over the chasm so nobody ever walks through its light.
const HOLE = { x: 28, z: 3, r: 7, y: 25 };
// The portal's opening: rock only above it.
const inPortal = (x, z) => Math.abs(x) <= 3.2 && z > -3.5 && z < -2;

// Warm pools, each one a slot of the view's light pool while you are at the camp.
export const LAMPS = [
  { x: -10.8, y: 3, z: 6, color: 0xffa24a, power: 16, reach: 14 },      // the shop
  { x: -7, y: 3.1, z: 9.6, color: 0xffb066, power: 9, reach: 10 },      // the expedition table
  { x: 1.6, y: 3.3, z: -.9, color: 0xffb35c, power: 18, reach: 15 },   // the mine mouth
  { x: 0, y: 3.4, z: -7.6, color: 0xffc98a, power: 5, reach: 8 },      // work light by the lift
  { x: 8.5, y: 3.7, z: 16.5, color: 0xffa858, power: 15, reach: 14 },   // the truck
  { x: 3, y: 1.1, z: 26, color: 0xff7a30, power: 16, reach: 14 },       // the campfire
  { x: 16.6, y: 3, z: 4, color: 0xa8c4ff, power: 11, reach: 13 },       // cold, on the rim
];
// Water falling on the puddles, and the sound of it (ambience.js): period and phase in seconds.
export const DRIPS = [{ x: -3, z: 18.5, r: 1.3, period: 3.7, phase: 0 }, { x: 5.5, z: 9.5, r: 1, period: 5.3, phase: 1.4 }, { x: -11, z: 14.5, r: 1.6, period: 4.4, phase: 2.2 }, { x: 13, z: 6.5, r: 1.1, period: 6.1, phase: .7 }];
const PUDDLES = [...DRIPS, { x: -6, z: 2.5, r: .9 }, { x: 1, z: 29.6, r: 1.2 }, { x: 14.5, z: 27.5, r: 1 }, { x: -15, z: 26, r: .8 }];
const MUSHROOMS = [[-18.7, 12, 'blue'], [-18.6, 21, 'purple'], [-18.8, 3.5, 'blue'], [18.9, 25, 'blue'], [8, 30.8, 'purple'], [-13, 30.9, 'blue'], [-9, -2.2, 'purple']];
const FALL = 1.05;   // seconds a drop takes from the ceiling
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
const FLOOR_EDGE = [[-26, -2.7], ...RIM.map(([x, z]) => [x, z]), [26, 19], [26, 40], [-26, 40]];

const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function outlineDistance(x, z) {
  let best = Infinity, inside = false;
  for (let i = 0, j = CAVERN.length - 1; i < CAVERN.length; j = i++) {
    const [ax, az] = CAVERN[i], [bx, bz] = CAVERN[j], dx = bx - ax, dz = bz - az, k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * k, z - az - dz * k));
    if ((az > z) !== (bz > z) && x < ax + dx * (z - az) / dz) inside = !inside;
  }
  return inside ? best : 0;
}
// Low at the walls, high in the middle, and a chimney up to the hole.
export function ceilingAt(x, z) {
  const hole = 1 - smooth((Math.hypot(x - HOLE.x, z - HOLE.z) - HOLE.r * .5) / (HOLE.r * .6));
  return 6.4 + 8 * smooth(outlineDistance(x, z) / 11) + (fbm2(x * .13 + 7, z * .13) - .5) * 4 + hole * (HOLE.y - 10);
}

function rockGeometry() {
  const positions = [], colors = [], index = [], R = rng(9101), c = new THREE.Color();
  const DAMP = new THREE.Color(0x45484d), WET = new THREE.Color(0x24282e), PALE = new THREE.Color(0x7c7770), COLD = new THREE.Color(0x4a5a70);
  const vertex = (x, y, z) => {
    const n = fbm2(x * .22 + y * .31, z * .22 - y * .17);
    c.copy(DAMP).lerp(n > .5 ? PALE : WET, Math.min(1, Math.abs(n - .5) * 3.2)).lerp(COLD, smooth((y - 5) / 9) * .55);
    positions.push(x, y, z); colors.push(c.r, c.g, c.b);
  };
  const strip = (path, rows, away, skip) => {
    const base = positions.length / 3;
    for (const [x, z, nx, nz] of path) for (const y of rows) {
      const push = away(x, y, z);
      vertex(x + nx * push, y, z + nz * push);
    }
    const h = rows.length;
    for (let i = 0; i + 1 < path.length; i++) for (let r = 0; r + 1 < h; r++) {
      if (skip?.(path[i], path[i + 1], rows[r + 1])) continue;
      const a = base + i * h + r, b = a + h;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  };
  // Walls: pushed out from the cavern only, so they never lean into the rect.
  strip(walk(CAVERN, 1.7, true), WALL_ROWS, (x, y, z) => (inPortal(x, z) ? .25 : x > 4 && x < 5 && z < -3 ? .1 : 1) * (fbm2(x * .2 + 3, z * .2 + y * .24) * 3.4 + Math.abs(Math.sin(y * 1.1 + x * .07)) * .5), (a, b, top) => top <= 4.7 && inPortal(a[0], a[1]) && inPortal(b[0], b[1]));
  // The cliff under the rim, stepping out as it falls so you can see it from the edge.
  strip(RIM, CLIFF_ROWS, (x, y, z) => y > -.1 ? 0 : -y * .12 + fbm2(x * .3, z * .3 + y * .2) * 1.8);
  // Ceiling: one grid that runs past the walls.
  { const step = 1.6, x0 = -24, z0 = -34, nx = 46, nz = 46, base = positions.length / 3;
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) { const x = x0 + i * step, z = z0 + k * step; vertex(x, ceilingAt(x, z), z); }
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { const a = base + i * (nz + 1) + k, b = a + nz + 1; index.push(a, a + 1, b, b, a + 1, b + 1); } }
  const cone = (x, y, z, radius, length, tip) => {
    const base = positions.length / 3, sides = 6, spin = R() * 6;
    for (const [k, r] of [[0, 1], [.45, .55 + R() * .1]]) for (let s = 0; s < sides; s++) { const a = spin + s / sides * Math.PI * 2, w = r * radius * (.85 + R() * .3); vertex(x + Math.cos(a) * w, y + tip * length * k, z + Math.sin(a) * w); }
    vertex(x + (R() - .5) * radius * .4, y + tip * length, z + (R() - .5) * radius * .4);
    for (let s = 0; s < sides; s++) { const a = base + s, b = base + (s + 1) % sides; index.push(a, b, a + sides, b, b + sides, a + sides, a + sides, b + sides, base + sides * 2); }
  };
  // Stalactites everywhere, long enough to loom and clear of any head and the cargo lift's load.
  for (let i = 0; i < 180; i++) {
    const x = -20 + R() * 66, z = -28 + R() * 60, top = ceilingAt(x, z), d = outlineDistance(x, z);
    if (!d || Math.hypot(x - HOLE.x, z - HOLE.z) < HOLE.r + 1.5) continue;
    const length = .7 + R() * R() * 4.2, over = x < 18.6 || z > 18;
    if (over && top - length < 4) continue;
    cone(x, top + .5, z, .22 + length * .13 + R() * .2, length + .5, -1);
  }
  // Teeth and boulders at the wall's foot, just past the rect.
  const foot = [];
  for (let z = 0; z < 31; z += 1.9) foot.push([-18.9 - R() * .3, z]);
  for (let x = -18; x < 18; x += 1.9) foot.push([x, 30.9 + R() * .3]);
  for (let z = 19.5; z < 31; z += 1.9) foot.push([18.9 + R() * .3, z]);
  for (let x = -18; x < -3.8; x += 2.3) foot.push([x, -2.9 - R() * .2]);
  for (const [x, z] of foot) { const length = .5 + R() * R() * 3.4; cone(x, -.1, z, .3 + length * .14, length, 1); }
  // Spires down in the chasm, for the eye to measure the drop by.
  for (let i = 0; i < 16; i++) { const x = 22 + R() * 18, z = -22 + R() * 34; if (Math.hypot(x - HOLE.x, z - HOLE.z) > 6) cone(x, -32, z, 1.6 + R() * 2.2, 12 + R() * 16, 1); }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index); geometry.computeVertexNormals();
  return geometry;
}

// A wide patch of damp rock floor, painted once and tiled every 9 m: soft blotches and grit.
function paintFloor() {
  const size = 512, canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), R = rng(58);
  ctx.fillStyle = '#433f3b'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 150; i++) {
    const x = R() * size, y = R() * size, r = 14 + R() * 62, light = R() < .45, tone = light ? '112,106,98' : '30,30,32', a = .1 + R() * .22;
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
const assets = () => shared ||= { rock: rockGeometry(), floor: paintFloor(), mist: paintMist() };

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
  const { rock, floor: floorMap, mist: mistMap } = assets(), materials = [], own = m => { materials.push(m); return m; };
  cave.add(new THREE.Mesh(rock, own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, flatShading: true, side: THREE.DoubleSide }))));
  // The floor: everything inside the outline but the chasm.
  const shape = new THREE.Shape(FLOOR_EDGE.map(([x, z]) => new THREE.Vector2(x, -z)));
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), own(new THREE.MeshStandardMaterial({ map: floorMap, roughness: .82 })));
  floor.position.y = -.04; cave.add(floor);

  // Timber, rails, the gantry and its load: one bake.
  const wood = own(new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: .95 })), iron = own(new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: .55, metalness: .5 })), rope = own(new THREE.MeshStandardMaterial({ color: 0x5c5040, roughness: 1 }));
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const statics = new THREE.Group();
  const bar = (m, ax, ay, az, bx, by, bz, t = .12) => { const o = new THREE.Mesh(unit, m), a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz); o.position.copy(a).add(b).multiplyScalar(.5); o.scale.set(t, t, a.distanceTo(b)); o.lookAt(b); statics.add(o); };
  const put = (model, x, y, z, h = 0) => { model.position.set(x, y, z); model.rotation.y = h; statics.add(model); return model; };
  // Sets of timber shore the walls; their legs stand just outside the rect.
  for (const z of [3, 11, 19, 27]) put(mineSupport({ width: 2.6, height: 4.4, lantern: false }), -18.75, 0, z, Math.PI / 2);
  for (const x of [-12, -3, 8]) put(mineSupport({ width: 2.6, height: 4.2, lantern: false }), x, 0, 30.8);
  // Rails from the middle of the camp into the mine, and a spur that runs out over the drop.
  const track = points => { const k = 1 / RAIL, model = put(mineTrack({ points: points.map(([x, z]) => [x * k, .16, z * k]), bumper: false }), 0, 0, 0); model.scale.set(RAIL, .55, RAIL); };
  track([[0, 11], [0, 5], [0, -1.4]]);
  track([[1.3, 4.4], [4.6, 1.6], [9, -.6], [13, -2.6], [14.6, -6.2]]);
  // The rail along the edge: it sits past where anyone can stand.
  const rail = [...Array(9).keys()].map(i => [5 + i * 1.65, -2.3]).concat([...Array(13).keys()].map(i => [18.25, -2.3 + i * 1.65]));
  rail.forEach(([x, z], i) => {
    bar(wood, x, -.05, z, x + (i % 3 - 1) * .03, 1.12, z, .13);
    const next = rail[i + 1]; if (!next || (x === 18.25 && z > 16)) return;
    bar(rope, x, 1.02, z, next[0], .98, next[1], .035); bar(rope, x, .6, z, next[0], .56, next[1], .03);
  });
  // A gantry reaching out over the void, cables going straight down into the black.
  const GX = 11, GZ = -8.4;
  for (const s of [-.8, .8]) { bar(wood, GX + s, 5, -2, GX + s, 5.2, GZ, .24); bar(wood, GX + s, .1, -2.3, GX + s, 5, -2.3, .26); bar(wood, GX + s, 1.4, -2.5, GX + s, 5, -5.8, .16); }
  bar(wood, GX - 1.1, 5.2, GZ + .4, GX + 1.1, 5.2, GZ + .4, .2); bar(wood, GX - 1.1, 5, -2.3, GX + 1.1, 5, -2.3, .18);
  bar(iron, GX - .35, 5.2, GZ + .4, GX - .35, -34, GZ + .4, .035); bar(iron, GX + .35, 5.2, GZ + .4, GX + .35, -7.6, GZ + .4, .035);
  bar(iron, GX, 5.2, GZ + .4, GX, ceilingAt(GX, GZ) + .4, GZ + .4, .05);
  put(mineCart({ seed: 7, load: 'empty', hollow: false }), GX + .35, -9.2, GZ + .4, .5);
  // A ladder bolted to the lip, going down until the dark has it.
  for (let k = 0; k < 3; k++) { const ladder = put(mineLadder({ height: 7, lean: 0 }), 7.6, -7 * (k + 1) + .9, -2.95); ladder.rotation.y = Math.PI; }
  // Cables slung overhead; the lamps hang from their chains.
  const wire = (x, z, span, h, height, sag) => {
    put(bulbWire({ span, sag, height, posts: false }), x, 0, z, h);
    for (const s of [-.5, .5]) { const ex = x + Math.cos(h) * span * s, ez = z - Math.sin(h) * span * s; bar(iron, ex, height, ez, ex, ceilingAt(ex, ez) + .3, ez, .03); }
  };
  wire(-9.6, -1.7, 13, 0, 5.2, .9); wire(13, 25, 11, .3, 5.6, 1.1);
  for (const l of LAMPS) {
    if (l.y < 2) continue;
    put(mineLantern(), l.x, l.y + .5, l.z);
    bar(iron, l.x, l.y + .5, l.z, l.x, ceilingAt(l.x, l.z) + .3, l.z, .028);
  }
  const glows = [];
  for (const [x, z, color] of MUSHROOMS) { put(glowMushrooms({ seed: Math.round(x * 13 + z * 7), color, count: 6, spread: .7 }), x, 0, z); glows.push({ x, y: .34, z, color: MUSHROOM_GLOW[color] }); }
  const baked = bake(statics); statics.traverse(o => o.geometry?.dispose());
  cave.add(baked);

  // Signs, each on a post past the edge: the drop, and the way down.
  const danger = plank(own, loc('¡Peligro! Abismo')); danger.position.set(7.5, 1.42, -2.35); cave.add(danger);
  const edge = plank(own, loc('¡Peligro! Abismo')); edge.position.set(18.3, 1.42, 7.2); edge.rotation.y = -Math.PI / 2; cave.add(edge);
  const down = plank(own, loc('Montacargas'), { width: 2.2, height: .5, arrow: true }); down.position.set(0, 6.05, -1.2); cave.add(down);

  // Lamp and mushroom halos: two draws.
  const lampHalos = mushroomHalos(LAMPS.map(l => ({ x: l.x, y: l.y, z: l.z, color: l.color })), halo, { size: 2.6, opacity: .5 }); lampHalos.name = 'Halos de faroles'; cave.add(lampHalos);
  const shrooms = mushroomHalos(glows, halo, { size: 2.6, opacity: .7 }); cave.add(shrooms);

  // The hole far above, the light it lets in, and what sifts down through it.
  const sky = new THREE.Mesh(new THREE.CircleGeometry(HOLE.r * 1.5, 18).rotateX(Math.PI / 2), own(new THREE.MeshBasicMaterial({ color: 0xa8c6ee, fog: false }))); sky.position.set(HOLE.x, HOLE.y + 1, HOLE.z); cave.add(sky);
  const shaftMat = own(shaftMaterial());
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(HOLE.r * .55, 7.5, 62, 22, 1, true), shaftMat); shaft.position.set(HOLE.x, HOLE.y - 31, HOLE.z); shaft.renderOrder = 3; shaft.name = 'Rayo del hueco'; cave.add(shaft);
  const dust = shaftDust(shaftMat.uniforms); own(dust.material); dust.renderOrder = 3; cave.add(dust);
  // A dim bloom far below, and a fainter one down the lift shaft.
  const glowMaterial = own(new THREE.MeshBasicMaterial({ map: halo, color: 0xff7a30, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(44, 44).rotateX(-Math.PI / 2), glowMaterial); deep.position.set(25, -24, 0); cave.add(deep);
  const under = new THREE.Mesh(new THREE.PlaneGeometry(5, 5).rotateX(-Math.PI / 2), glowMaterial); under.position.set(0, -17, -6.6); cave.add(under);
  // Sheets of fog hanging in the chasm: one mesh and one scrolling texture.
  const sheets = [-7, -12, -18, -26].map((y, i) => new THREE.PlaneGeometry(52, 58, 1, 1).rotateX(-Math.PI / 2).rotateY(i * .9).translate(27, y, -5));
  const mistMaterial = own(new THREE.MeshBasicMaterial({ map: mistMap, color: 0x8ea4c0, transparent: true, opacity: .1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  const mist = new THREE.Group(); mist.name = 'Neblina'; for (const g of sheets) { const m = new THREE.Mesh(g, mistMaterial); m.renderOrder = 2; mist.add(m); } cave.add(mist);

  // Puddles, and the drops that keep them full.
  const dummy = new THREE.Object3D();
  const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), own(new THREE.MeshStandardMaterial({ color: 0x142430, emissive: 0x0c1a26, roughness: .08, metalness: .4 })), PUDDLES.length);
  PUDDLES.forEach((p, i) => { dummy.position.set(p.x, .012, p.z); dummy.scale.set(p.r, 1, p.r * (.72 + (i % 3) * .14)); dummy.rotation.y = i * 1.3; dummy.updateMatrix(); puddles.setMatrixAt(i, dummy.matrix); });
  puddles.name = 'Charcos'; cave.add(puddles);
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 5, 4), own(new THREE.MeshBasicMaterial({ color: 0x9fc4e0 })), DRIPS.length), rings = new THREE.InstancedMesh(new THREE.RingGeometry(.86, 1, 18).rotateX(-Math.PI / 2), own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })), DRIPS.length);
  drops.frustumCulled = rings.frustumCulled = false; rings.setColorAt(0, new THREE.Color(0)); cave.add(drops, rings);
  const tops = DRIPS.map(d => ceilingAt(d.x, d.z)), tint = new THREE.Color();

  cave.userData.lamps = LAMPS;
  cave.userData.dispose = () => { materials.forEach(m => m.dispose()); lampHalos.material.dispose(); shrooms.material.dispose(); };
  cave.userData.tick = t => {
    if (!cave.parent?.visible) return;
    shaftMat.uniforms.uTime.value = t;
    mistMap.offset.set(t * .006, t * .0035);
    glowMaterial.opacity = .42 + Math.sin(t * .31) * .1 + Math.sin(t * .83 + 1) * .05;
    shrooms.material.opacity = .62 + Math.sin(t * .9) * .12;
    DRIPS.forEach((d, i) => {
      const k = (t + d.phase) % d.period, falling = k < FALL, y = tops[i] * (1 - (k / FALL) ** 2);
      dummy.rotation.set(0, 0, 0); dummy.position.set(d.x, falling ? y : -5, d.z); dummy.scale.set(1, falling ? 3.4 : 1, 1); dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
      const ripple = Math.min(1, Math.max(0, (k - FALL) / .9));
      dummy.position.set(d.x, .03, d.z); dummy.scale.setScalar(.04 + ripple * .75); dummy.updateMatrix(); rings.setMatrixAt(i, dummy.matrix);
      rings.setColorAt(i, tint.setRGB(.34, .4, .46).multiplyScalar(ripple > 0 && ripple < 1 ? 1 - ripple : 0));
    });
    drops.instanceMatrix.needsUpdate = rings.instanceMatrix.needsUpdate = rings.instanceColor.needsUpdate = true;
  };
  return cave;
}
