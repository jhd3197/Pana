import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { extendTerrain } from './world-horizon.js';
import { coastalVegetation } from './coastal-vegetation.js';
import { MAP, noise } from './tovar-layout.js';

// Colonia Tovar: the German town in the clouds. Hydrangea climbs, the
// strawberry market, a fog-filled forest of hairpins and the mirador ridge.
export function createWorld(scene, layout, roadDistance, scale = 1.3) {
  const vegetation = coastalVegetation(scene, scale, roadDistance);
  let horizon = null;
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const rand = rng(MAP.seed);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const d = new THREE.Object3D();
  const uTime = { value: 0 };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  const { SIZE, X0, Z0, NR, STEP, RP, SEG, RR, hwL, hwR, roadY, bank, roadFrame, roadAt, lateralHW, idxNear, sampleR, inArea, VA,
    farH: originalFarH, groundH: originalGroundH, PADS, terrainH, inForest, inTown, TZ } = layout;
  const groundH = (x, z) => horizon?.heightAt(x, z) ?? originalGroundH(x, z);

  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const roadTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#6a6a6c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(30,30,34,${rr(0.08, 0.25).toFixed(2)})` : `rgba(220,220,225,${rr(0.04, 0.12).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    c.strokeStyle = 'rgba(30,30,30,0.5)'; c.lineWidth = 1.5;
    for (let k = 0; k < 18; k++) { let x = rr(30, w - 30), y = rr(0, h); c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 8; j++) { x += rr(-10, 10); y += rr(4, 14); c.lineTo(x, y); } c.stroke(); }
    c.fillStyle = 'rgba(245,245,240,0.95)'; c.fillRect(w * 0.04, 0, 7, h); c.fillRect(w * 0.96 - 7, 0, 7, h);
  });
  const paveTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#5a5a5e'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = -((y / 16) % 2) * 16; x < w; x += 32) { const v = (88 + rand() * 30) | 0; c.fillStyle = `rgb(${v},${v},${v + 4})`; c.fillRect(x + 1, y + 1, 30, 14); }
  });
  const timberTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#f3efe4'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { c.fillStyle = `rgba(160,150,130,${rr(0.03, 0.1).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, 2, 2); }
    c.strokeStyle = '#4a2e1c'; c.lineCap = 'square'; c.lineWidth = 11;
    const L = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0 * w, y0 * h); c.lineTo(x1 * w, y1 * h); c.stroke(); };
    L(0.02, 0.03, 0.98, 0.03); L(0.02, 0.97, 0.98, 0.97); L(0.02, 0.03, 0.02, 0.97); L(0.98, 0.03, 0.98, 0.97); L(0.5, 0.03, 0.5, 0.97);
    L(0.02, 0.5, 0.15, 0.5); L(0.85, 0.5, 0.98, 0.5);
    for (const x of [0.16, 0.44, 0.56, 0.84]) L(x, 0.03, x, 0.97);
    L(0.02, 0.97, 0.16, 0.6); L(0.98, 0.97, 0.84, 0.6); L(0.02, 0.03, 0.16, 0.4); L(0.98, 0.03, 0.84, 0.4);
    L(0.16, 0.25, 0.44, 0.25); L(0.56, 0.25, 0.84, 0.25); L(0.16, 0.75, 0.44, 0.75); L(0.56, 0.75, 0.84, 0.75);
    for (const x0 of [0.2, 0.6]) {
      c.fillStyle = '#2a3440'; c.fillRect(x0 * w, 0.3 * h, 0.2 * w, 0.4 * h);
      c.fillStyle = '#f3efe4'; c.fillRect((x0 + 0.095) * w, 0.3 * h, 0.01 * w + 2, 0.4 * h); c.fillRect(x0 * w, 0.49 * h, 0.2 * w, 4);
      c.strokeStyle = '#e8e0cc'; c.lineWidth = 5; c.strokeRect(x0 * w, 0.3 * h, 0.2 * w, 0.4 * h);
      c.fillStyle = '#8a2a20'; c.fillRect((x0 - 0.035) * w, 0.3 * h, 0.03 * w, 0.4 * h); c.fillRect((x0 + 0.205) * w, 0.3 * h, 0.03 * w, 0.4 * h);
      c.strokeStyle = '#4a2e1c'; c.lineWidth = 11;
    }
  });
  const stoneTex = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#5a5850'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = rand() * w, y = rand() * h, rx = rr(10, 26), ry = rr(7, 16), v = (110 + rand() * 50) | 0; c.fillStyle = `rgb(${v},${v - 4},${v - 12})`; c.beginPath(); c.ellipse(x, y, rx, ry, rr(-0.4, 0.4), 0, TAU); c.fill(); c.strokeStyle = 'rgba(40,38,34,0.7)'; c.lineWidth = 2; c.stroke(); }
  });
  const grassTex = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rr(8, w - 8), lean = rr(-18, 18), top = rr(10, 60); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - 4, h); c.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); c.lineTo(x + 4, h); c.fill(); } });
  const cloudTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const textBoard = (w, h, bg, draw) => canvasTex(w, h, c => { c.fillStyle = bg; c.fillRect(0, 0, w, h); draw(c, w, h); });
  const woodSign = (lines, ink = '#fff6e0') => textBoard(1024, 256, '#6a4426', (c, w, h) => {
    for (let y = 0; y < h; y += 32) { c.fillStyle = `rgba(40,20,8,${rr(0.1, 0.3).toFixed(2)})`; c.fillRect(0, y, w, 3); }
    c.strokeStyle = '#3a220e'; c.lineWidth = 16; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((t, k) => { c.font = `bold ${k ? 64 : 96}px Georgia, serif`; c.fillText(t, w / 2, h * (lines.length > 1 ? (k ? 0.72 : 0.36) : 0.52)); });
  });

  /* ---------------- wind-swayed materials ---------------- */
  function windy(mat, base, perY) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uTime * 1.1 + ip.x * 0.06 + ip.z * 0.045) * 0.6 + sin(uTime * 2.5 + ip.x * 0.17 - ip.z * 0.11) * 0.25;
        float k = ${base.toFixed(3)} + max(position.y, 0.0) * ${perY.toFixed(3)};
        transformed.x += sw * k; transformed.z += sw * k * 0.55;`);
    };
    mat.customProgramCacheKey = () => 'windy' + base + '_' + perY;
    return mat;
  }

  /* ---------------- terrain ---------------- */
  const cGrass = col('#5c9a38'), cGrass2 = col('#86b046'), cForest = col('#33602a'), cRock = col('#6e6a60'), cVerge = col('#9a9a86'), cTown = col('#6a8a54');
  function paintGround(x, z, y, slope, tmp) {
    const n = 0.5 + 0.5 * noise(x * 2, z * 2);
    tmp.copy(cGrass).lerp(cGrass2, n * 0.6);
    if (inForest(x, z) || y < 30) tmp.lerp(cForest, 0.6);
    if (!inArea(x, z, 20)) tmp.lerp(cForest, 0.45);
    tmp.lerp(cForest, sstep(VA.from, VA.from + 80, z) * 0.6);
    if (inTown(x, z)) tmp.lerp(cTown, 0.3);
    tmp.lerp(cRock, sstep(0.5, 0.8, slope) * 0.8);
    return tmp;
  }
  {
    const SEGS = 300, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS); geo.rotateX(-PI / 2); geo.translate(X0 + SIZE / 2, 0, Z0 + SIZE / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); paintGround(x, z, pos.getY(i), 1 - nrm.getY(i), tmp);
      const r = sampleR(RR, x, z); if (r.i >= 0) tmp.lerp(cVerge, (1 - sstep(hwR[r.i], hwR[r.i] + 3, r.dist)) * 0.7);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m.receiveShadow = true; scene.add(m);
    horizon = extendTerrain(m, { bounds: [X0, Z0, X0 + SIZE, Z0 + SIZE], nx: SEGS, nz: SEGS, height: originalFarH, color: (x, z, y) => paintGround(x, z, y, 0, new THREE.Color()), biome: 'tovar' });
  }

  /* ---------------- road surface: cracked asphalt outside, grey pavers in town ---------------- */
  function stripMesh(rows, mat, vScale) {
    const pos = [], uv = [], idx = [];
    let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.a.distanceTo(rows[i - 1].a); pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.name = 'coastal-road-strip'; m.receiveShadow = true; scene.add(m); return m;
  }
  function runs(keyOf, build) {
    let i0 = 0; while (keyOf(i0) === keyOf((i0 - 1 + NR) % NR) && i0 < NR - 1) i0++;
    let cur = keyOf(i0), list = [];
    for (let n = 0; n <= NR; n++) { const i = (i0 + n) % NR, k = keyOf(i); if (k !== cur) { list.push(i); build(cur, list); cur = k; list = []; } list.push(i); }
    if (list.length > 1) build(cur, list);
  }
  const ROAD = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const PAVE = new THREE.MeshStandardMaterial({ map: paveTex, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const TOWN = { p: 1, m: 1 };
  runs(i => (TOWN[SEG[i]] ? 'pave' : 'road'), (k, list) => stripMesh(list.map(i => ({ a: roadAt(i, -hwL[i], 0.12), b: roadAt(i, hwR[i], 0.12) })), k === 'pave' ? PAVE : ROAD, k === 'pave' ? 5 : 20));
  // the crossing street of shops (not part of the lap)
  {
    const C = MAP.town.cross, a = V3(C.from[0], 0, C.from[1]), b = V3(C.to[0], 0, C.to[1]), dir = b.clone().sub(a).normalize(), n = V3(-dir.z, 0, dir.x), rows = [];
    for (let k = 0; k <= 40; k++) { const p = a.clone().lerp(b, k / 40), y = groundH(p.x, p.z) + 0.1; rows.push({ a: p.clone().addScaledVector(n, -C.half).setY(y), b: p.clone().addScaledVector(n, C.half).setY(y) }); }
    stripMesh(rows, PAVE, 5).name = 'tovar-cross-street';
  }

  /* ---------------- instance buffers ---------------- */
  const _bx = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
  const placeBeam = (a, b, tx, tz) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length(); dir.normalize();
    _bx.crossVectors(dir, UP); if (_bx.lengthSq() < 1e-6) _bx.set(1, 0, 0); _bx.normalize(); _bz.crossVectors(_bx, dir).normalize();
    _bm.makeBasis(_bx, dir, _bz); d.quaternion.setFromRotationMatrix(_bm); d.position.copy(a).addScaledVector(dir, len / 2); d.scale.set(tx, len, tz); d.updateMatrix(); return d.matrix.clone();
  };
  const beams = { yellow: [], iron: [], wood: [], white: [], walk: [], stone: [] };
  const inst = { box: [], timber: [], roof: [], trunk: [], hyd: [], hydLeaf: [], cyl: [], sphere: [], umbrella: [], fruit: [], crowdBody: [], crowdHead: [], grass: [], post: [], reflector: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const yawOf = v => Math.atan2(v.x, v.z);
  const addBox = (p, s, yaw, color, list = inst.box) => push(list, p, qYaw(yaw), S.copy(s), col(color));
  const freeOf = (x, z, m) => { const r = sampleR(RR, x, z); return !(r.i >= 0 && r.dist < hwR[r.i] + m); };
  const taken = [];
  const clearSpot = (x, z, r) => !taken.some(t => Math.hypot(t[0] - x, t[1] - z) < t[2] + r);
  const take = (x, z, r) => taken.push([x, z, r]);
  function tries(n, fn) { for (let i = 0, k = 0; i < n && k < n * 30; k++) if (fn()) i++; }

  /* ---- kerbs, sidewalks, stone walls with iron railings, reflector posts ---- */
  {
    const KERB = { e: 1, p: 1, m: 1, h: 1 };
    for (const side of [-1, 1]) {
      let prev = null, wprev = null, acc = 0, wallOn = false, wk = 0;
      for (let i = 0; i < NR; i += 2) {
        const s = SEG[i], f = roadFrame(i);
        if (!KERB[s]) { prev = null; wprev = null; }
        else {
          const k0 = roadAt(i, side * (lateralHW(i, side) + 0.3), 0.1);
          if (prev && prev.distanceTo(k0) < 3) { beams.yellow.push(placeBeam(prev, k0, 0.6, 0.3)); if (TOWN[s]) beams.walk.push(placeBeam(prev.clone().addScaledVector(f.n, side * 1.6).setY(prev.y + 0.05), k0.clone().addScaledVector(f.n, side * 1.6).setY(k0.y + 0.05), 2.6, 0.22)); }
          prev = k0;
          // stone walls with an iron railing along the hydrangea climb, on alternating stretches
          if (s === 'h' || s === 'e') {
            wk += 2; if (wk > 60) { wk = 0; wallOn = rand() < 0.6; }
            const w0 = roadAt(i, side * (lateralHW(i, side) + 2.2), 0); w0.y = Math.min(w0.y, groundH(w0.x, w0.z));
            if (wallOn && side > 0 === (Math.floor(i / 300) % 2 === 0)) {
              const top = w0.clone().setY(w0.y + 1.3);
              if (wprev && wprev.distanceTo(top) < 3) { beams.stone.push(placeBeam(V3(wprev.x, wprev.y - 0.65, wprev.z), V3(top.x, top.y - 0.65, top.z), 0.7, 2.0)); beams.iron.push(placeBeam(wprev.clone().setY(wprev.y + 1.0), top.clone().setY(top.y + 1.0), 0.06, 0.06)); acc += 2 * STEP; if (acc > 2.4) { acc = 0; beams.iron.push(placeBeam(top.clone().setY(top.y + 0.3), top.clone().setY(top.y + 1.1), 0.05, 0.05)); } }
              wprev = top;
            } else wprev = null;
          }
        }
        // reflector posts on the forest edge: they light up when the fog comes in
        if (s === 'f' && i % 6 === 0) { const p = roadAt(i, side * (lateralHW(i, side) + 0.8), 0); p.y = Math.min(p.y, groundH(p.x, p.z)); push(inst.post, p, qYaw(yawOf(f.t)), S.set(0.16, 1.1, 0.16), col('#f2f2ee')); push(inst.reflector, p.clone().setY(p.y + 0.9).addScaledVector(f.n, -side * 0.09), qYaw(yawOf(f.n)), S.set(0.13, 0.22, 0.04), col(side > 0 ? '#ff6a1a' : '#ffffff')); }
      }
    }
  }

  /* ---------------- trees: library pines, mountain firs and cloud-forest ceibas ---------------- */
  const roadGap = (x, z) => sampleR(RR, x, z).dist;
  // Full tiered mountain pines dominate; a few open pinos caribe break up the stands.
  function pine(x, z, s = 1) { const fir = rand() < 0.75; vegetation.add(fir ? 'fir' : 'pine', x, z, groundH(x, z), (fir ? 1.8 : 1.7) * s, roadGap(x, z)); }
  function cypress(x, z) { vegetation.add('fir', x, z, groundH(x, z), rr(1.1, 1.4), roadGap(x, z)); }
  function cloudTree(x, z, big) { vegetation.add('tree', x, z, groundH(x, z), big ? rr(1.1, 1.35) : rr(0.75, 0.95), roadGap(x, z)); }
  // hydrangeas: a dark leafy mound crowned with round heads in blue, lilac, white and pale pink
  const HYD = ['#6f8fe0', '#7a9cf0', '#a890e0', '#b8a8f0', '#eef0f6', '#f4f4fa', '#e8b8d8', '#f08ac0'].map(col);
  function hydrangea(x, z, s = 1, y0) {
    if (!freeOf(x, z, 0.8)) return;
    const y = y0 ?? groundH(x, z), base = pick(HYD);
    push(inst.hydLeaf, V3(x, y + 0.45 * s, z), qEuler(0, rand() * TAU, 0), S.set(1.3 * s, 0.75 * s, 1.3 * s), col('#2f6a2a').offsetHSL(0, 0, rr(-0.04, 0.04)));
    for (let k = 0; k < 6; k++) { const a = rand() * TAU, r = rr(0.2, 0.95) * s; push(inst.hyd, V3(x + Math.cos(a) * r, y + s * rr(0.75, 1.15), z + Math.sin(a) * r), qEuler(rand(), rand() * TAU, 0), S.set(0.36 * s, 0.32 * s, 0.36 * s), (rand() < 0.75 ? base : pick(HYD)).clone().offsetHSL(0, 0, rr(-0.05, 0.04))); }
  }

  /* ---------------- half-timbered houses ---------------- */
  const PLASTER = ['#f6f2e8', '#f3ead6', '#f6f0e2', '#efe4cc', '#f4ecd8'].map(col);
  const ROOFS = ['#b8402c', '#a83a28', '#c4482e', '#8e3428', '#7a4a2e'].map(col);
  function timberHouse(p, yaw, w, dpt, floors = 2, plain = false) {
    const y = Math.min(groundH(p.x, p.z), groundH(p.x + Math.sin(yaw) * dpt * 0.5, p.z + Math.cos(yaw) * dpt * 0.5)) - 0.3, q = qYaw(yaw);
    const fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), right = V3(Math.cos(yaw), 0, -Math.sin(yaw)), back = p.clone().addScaledVector(fwd, -dpt / 2);
    const plaster = pick(PLASTER), fh = 3.3;
    push(inst.box, back.clone().setY(y + 0.6), q, S.set(w + 0.1, 1.2, dpt + 0.1), col('#7a6e60'));                                   // stone plinth
    for (let k = 0; k < floors; k++) { const grow = k * 0.5; push(plain ? inst.box : inst.timber, back.clone().setY(y + 1.2 + fh * (k + 0.5)), q, S.set(w + grow, fh, dpt + grow), plaster); }
    const topY = y + 1.2 + fh * floors, rw = dpt + floors * 0.5 + 1.0, rh = rw * rr(0.48, 0.6);
    push(inst.roof, back.clone().setY(topY), qYaw(yaw + PI / 2), S.set(rw, rh, w + floors * 0.5 + 1.4), pick(ROOFS));
    // front details: a dark door, flower boxes under the windows, a balcony on some
    push(inst.box, p.clone().addScaledVector(fwd, 0.05).setY(y + 2.3), q, S.set(1.3, 2.2, 0.15), col('#4a2e1c'));
    for (let k = 0; k < floors; k++) for (const o of [-0.2, 0.2]) {
      const fp = p.clone().addScaledVector(fwd, k * 0.25 + 0.28).addScaledVector(right, o * (w + k * 0.5)).setY(y + 1.2 + fh * k + fh * 0.3 - 0.1);
      if (k === 0 && o === 0.2 && rand() < 0.5) continue;
      push(inst.box, fp, q, S.set(0.22 * (w + k * 0.5), 0.3, 0.45), col('#6a3a1e'));
      for (let j = 0; j < 5; j++) push(inst.sphere, fp.clone().addScaledVector(right, (j - 2) * 0.042 * (w + k * 0.5)).setY(fp.y + 0.28), Q, S.set(0.24, 0.2, 0.24), pick([col('#e8303a'), col('#ff5a7a'), col('#ffffff'), col('#ff8a2a'), col('#d82a6a')]));
    }
    if (floors > 1 && rand() < 0.4) { const bp = p.clone().addScaledVector(fwd, 0.9).setY(y + 1.2 + fh + 0.1); push(inst.box, bp, q, S.set(w * 0.6, 0.18, 1.2), col('#4a2e1c')); for (let k = -6; k <= 6; k++) push(inst.box, bp.clone().addScaledVector(right, k * w * 0.048).addScaledVector(fwd, 0.55).setY(bp.y + 0.5), q, S.set(0.08, 1.0, 0.08), col('#4a2e1c')); }
    take(back.x, back.z, Math.max(w, dpt) * 0.6);
  }

  /* ---------------- the town: houses on the main street, the cross street and the slopes; the church; the market ---------------- */
  const CH = MAP.church;
  // The game's finish line sits at 1.5 % of the lap; the carved arch spans it.
  const i0 = Math.round(0.015 * NR);
  {
    take(CH.x, CH.z, 18); take(MAP.plaza.x, MAP.plaza.z, MAP.plaza.r);
    take(MAP.entrance.letters[0], MAP.entrance.letters[1], 18); take(RP[i0].x, RP[i0].z, 16);
    const along = (segs, gapMin, off, filter) => {
      for (const side of [-1, 1]) {
        let acc = 0;
        for (let i = 0; i < NR; i++) {
          if (!segs[SEG[i]]) { acc = 0; continue; }
          acc += STEP; if (acc < gapMin) continue;
          const f = roadFrame(i), w = rr(9, 13), dpt = rr(9, 11), p = roadAt(i, side * (lateralHW(i, side) + off), 0);
          const back = p.clone().addScaledVector(f.n, side * dpt);
          if (!freeOf(p.x, p.z, off - 1) || !freeOf(back.x, back.z, off - 1) || !clearSpot(back.x, back.z, Math.max(w, dpt) * 0.55)) continue;
          if (filter && !filter(i, side, p)) continue;
          let ok = true; for (const o of [-w / 2, w / 2]) { const c = p.clone().addScaledVector(f.t, o); if (!freeOf(c.x, c.z, off - 1.2)) ok = false; } if (!ok) continue;
          acc = gapMin - w - rr(0.5, 2);
          timberHouse(p, yawOf(f.n.clone().multiplyScalar(-side)), w, dpt, rand() < 0.75 ? 2 : 1, rand() < 0.12);
        }
      }
    };
    along({ p: 1, e: 1 }, 12, 5.2, (i, side) => SEG[i] === 'p' || side > 0 || roadY[i] < 60);
    along({ m: 1 }, 12, 13, null);          // houses behind the market stalls
    // the cross street of shops
    const C = MAP.town.cross, a = V3(C.from[0], 0, C.from[1]), b = V3(C.to[0], 0, C.to[1]), dir = b.clone().sub(a).normalize(), n = V3(-dir.z, 0, dir.x), L = a.distanceTo(b);
    for (const s of [-1, 1]) for (let t = 14; t < L - 4; t += rr(11, 13)) { const p = a.clone().addScaledVector(dir, t).addScaledVector(n, s * (C.half + 2.5)); if (!clearSpot(p.x, p.z, 5) || !freeOf(p.x, p.z, 8)) continue; timberHouse(p, yawOf(n.clone().multiplyScalar(-s)), rr(9, 11), rr(9, 10), 2); }
    // houses on the slopes around the town, among gardens and hydrangeas
    tries(MAP.town.houses, () => {
      const x = rr(TZ[0], TZ[1]), z = rr(TZ[2], TZ[3]), w = rr(8, 12), dpt = rr(8, 10); if (!freeOf(x, z, 10) || !clearSpot(x, z, 9)) return false;
      const r = sampleR(RR, x, z), f = roadFrame(Math.max(0, r.i)), toRoad = f.p.clone().sub(V3(x, 0, z)).setY(0).normalize();
      timberHouse(V3(x, 0, z), Math.round(yawOf(toRoad) / (PI / 4)) * (PI / 4), w, dpt, rand() < 0.6 ? 2 : 1, rand() < 0.15);
      for (let k = 0; k < 4; k++) { const a2 = rand() * TAU, rd = rr(6, 10); hydrangea(x + Math.cos(a2) * rd, z + Math.sin(a2) * rd, rr(0.8, 1.2)); }
      return true;
    });
    // iron lamp posts on the main street
    for (const side of [-1, 1]) { let acc = 0; for (let i = 0; i < NR; i++) { if (!TOWN[SEG[i]] && SEG[i] !== 'e') { acc = 0; continue; } acc += STEP; if (acc < 24) continue; acc = 0; const lp = roadAt(i, side * (lateralHW(i, side) + 1.0), 0); lp.y = groundH(lp.x, lp.z) + 0.2; push(inst.cyl, lp, Q, S.set(0.1, 4.2, 0.1), col('#1a1a1a')); push(inst.box, lp.clone().setY(lp.y + 4.5), Q, S.set(0.5, 0.7, 0.5), col('#2a2a2a')); push(inst.sphere, lp.clone().setY(lp.y + 4.5), Q, S.set(0.2, 0.26, 0.2), null); } }
  }
  // the church: white with dark beams, a tall tower with belfry arches and a brown spire
  {
    const g = new THREE.Group(); g.position.set(CH.x, roadY[idxNear(CH.x, CH.z)] - 0.2, CH.z); g.rotation.y = CH.rot; scene.add(g);
    const tm = new THREE.MeshStandardMaterial({ map: timberTex, roughness: 0.85 }), wm = new THREE.MeshStandardMaterial({ color: col('#f4f0e6'), roughness: 0.85 }), rm = new THREE.MeshStandardMaterial({ color: col('#a8322a'), roughness: 0.8 }), bm = new THREE.MeshStandardMaterial({ color: col('#7a5032'), roughness: 0.8, flatShading: true }), dm = new THREE.MeshStandardMaterial({ color: col('#2a1c14') });
    const add = (geo, m, x, y, z) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.castShadow = mm.receiveShadow = true; g.add(mm); return mm; };
    add(new THREE.BoxGeometry(14, 1.2, 26), new THREE.MeshStandardMaterial({ color: col('#7a6e60') }), 0, 0.6, -6);
    add(new THREE.BoxGeometry(13, 7, 24), tm, 0, 4.7, -6);
    { const s = new THREE.Shape(); s.moveTo(-8, 0); s.lineTo(8, 0); s.lineTo(0, 7); s.closePath(); const rg = new THREE.ExtrudeGeometry(s, { depth: 25.5, bevelEnabled: false }); rg.translate(0, 0, -12.75); add(rg, rm, 0, 8.2, -6); }
    add(new THREE.BoxGeometry(5.6, 15, 5.6), tm, 0, 8.7, 7.4);
    add(new THREE.BoxGeometry(6.2, 0.5, 6.2), bm, 0, 16.4, 7.4);
    add(new THREE.BoxGeometry(5.2, 4.2, 5.2), wm, 0, 18.7, 7.4);
    for (const [x, z, ry] of [[0, 2.63, 0], [0, -2.63, 0], [2.63, 0, PI / 2], [-2.63, 0, PI / 2]]) { const s = new THREE.Shape(); s.moveTo(-0.7, 0); s.lineTo(0.7, 0); s.lineTo(0.7, 1.8); s.absarc(0, 1.8, 0.7, 0, PI, false); s.closePath(); const a = add(new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false }), dm, x, 17.2, 7.4 + z); a.rotation.y = ry; }
    const spire = add(new THREE.ConeGeometry(4.0, 10, 4), bm, 0, 25.8, 7.4); spire.rotation.y = PI / 4;
    add(new THREE.BoxGeometry(0.14, 2.2, 0.14), dm, 0, 32, 7.4); add(new THREE.BoxGeometry(1.1, 0.14, 0.14), dm, 0, 32.4, 7.4);
    { const s = new THREE.Shape(); s.moveTo(-1.4, 0); s.lineTo(1.4, 0); s.lineTo(1.4, 2.6); s.absarc(0, 2.6, 1.4, 0, PI, false); s.closePath(); add(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }), dm, 0, 1.2, 10.25); }
    add(new THREE.CircleGeometry(1.2, 24), new THREE.MeshStandardMaterial({ color: col('#f8f4ea') }), 0, 13, 10.22);
    // the arch of iron over the path to the door
    const arch = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.12, 6, 32, PI), new THREE.MeshStandardMaterial({ color: col('#2a2a2a'), metalness: 0.5 })); arch.position.set(0, 1.4, 16); g.add(arch);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.2, 1.4, 0.2), dm, s * 4.2, 0.7, 16);
  }
  // the little plaza with a stone fountain
  const waterMats = [];
  {
    const PZ = MAP.plaza, y = PADS[0].y + 0.05;
    const pave = new THREE.Mesh(new THREE.CylinderGeometry(PZ.r, PZ.r, 0.3, 40), PAVE); pave.position.set(PZ.x, y - 0.1, PZ.z); pave.receiveShadow = true; scene.add(pave);
    const stone = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.9 });
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.6, 0.9, 28, 1, true), stone); basin.position.set(PZ.x, y + 0.45, PZ.z); basin.castShadow = true; scene.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.22, 8, 32), stone); rim.rotation.x = PI / 2; rim.position.set(PZ.x, y + 0.9, PZ.z); scene.add(rim);
    const col2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 2.2, 12), stone); col2.position.set(PZ.x, y + 1.1, PZ.z); scene.add(col2);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.4, 0.4, 20), stone); bowl.position.set(PZ.x, y + 2.3, PZ.z); scene.add(bowl);
    const wm = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 } }]),
      vertexShader: `varying vec2 vP;
        #include <fog_pars_vertex>
        void main(){ vP = position.xy; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; varying vec2 vP;
        #include <fog_pars_fragment>
        void main(){ float r = length(vP); float w = sin(r * 9.0 - uT * 5.0) * 0.5 + 0.5; vec3 c = mix(vec3(0.22, 0.42, 0.52), vec3(0.75, 0.9, 0.95), w * 0.35 + 0.1);
          gl_FragColor = vec4(c, 0.88);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`, transparent: true, fog: true });
    waterMats.push(wm);
    const wd = new THREE.Mesh(new THREE.CircleGeometry(3.3, 32), wm); wd.rotation.x = -PI / 2; wd.position.set(PZ.x, y + 0.75, PZ.z); scene.add(wd);
    const wd2 = new THREE.Mesh(new THREE.CircleGeometry(1.1, 20), wm); wd2.rotation.x = -PI / 2; wd2.position.set(PZ.x, y + 2.52, PZ.z); scene.add(wd2);
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; hydrangea(PZ.x + Math.cos(a) * (PZ.r - 2), PZ.z + Math.sin(a) * (PZ.r - 2), 1.1, y); }
  }
  // the strawberry market: red umbrellas over stalls with pink cloths, fruit and sweets, crates stacked by the kerb, people behind
  {
    const FR = ['#e82a2a', '#c81e2a', '#ff3a3a', '#ff8a1a', '#ffd21f', '#8ac03a', '#a83ab0', '#f4e0a0'].map(col);
    const SH = ['#e8462e', '#ffd21f', '#3d7bf2', '#2a9b5a', '#ffffff', '#f08ab0', '#8a3ac8', '#3a3a3a'].map(col);
    for (const side of [-1, 1]) {
      let acc = 0;
      for (let i = 0; i < NR; i++) {
        if (SEG[i] !== MAP.market.seg && !(SEG[i] === 'p' && roadFrame(i).t.z < -0.7)) { acc = 0; continue; }
        acc += STEP; if (acc < MAP.market.stallEvery) continue; acc = 0;
        const f = roadFrame(i), yaw = yawOf(f.n.clone().multiplyScalar(-side)), c = roadAt(i, side * (lateralHW(i, side) + 3.2), 0); c.y = groundH(c.x, c.z);
        if (!clearSpot(c.x, c.z, 2.5) || !freeOf(c.x, c.z, 2.4)) continue; take(c.x, c.z, 3);
        const q = qYaw(yaw);
        push(inst.box, c.clone().setY(c.y + 0.5), q, S.set(3.4, 1.0, 1.4), col(pick(['#f0a8c0', '#f4b8cc', '#e898b8'])));                       // the pink cloth
        for (let k = 0; k < 14; k++) push(inst.fruit, c.clone().addScaledVector(f.t, rr(-1.5, 1.5)).addScaledVector(f.n, side * rr(-0.5, 0.5)).setY(c.y + 1.08 + rr(0, 0.12)), Q, S.set(0.14, 0.14, 0.14).multiplyScalar(rr(0.8, 1.4)), pick(FR));
        for (let k = 0; k < 4; k++) push(inst.box, c.clone().addScaledVector(f.t, -1.2 + k * 0.8).addScaledVector(f.n, -side * 0.6).setY(c.y + 1.05), q, S.set(0.6, 0.12, 0.4), col('#d82030'));  // strawberry trays
        push(inst.cyl, c.clone().addScaledVector(f.n, side * 0.5), Q, S.set(0.05, 3.2, 0.05), col('#d8d8d8'));
        push(inst.umbrella, c.clone().addScaledVector(f.n, side * 0.5).setY(c.y + 3.3), qYaw(rand() * TAU), S.set(2.7, 0.9, 2.7), col(pick(['#e8303a', '#d42a30', '#ff4a4a', '#ffffff'])));
        // crates of strawberries stacked by the kerb
        if (rand() < 0.7) { const kp = roadAt(i, side * (lateralHW(i, side) + 1.2), 0); kp.y = groundH(kp.x, kp.z); for (let k = 0; k < 4; k++) { push(inst.box, kp.clone().addScaledVector(f.t, (k % 2) * 0.7).setY(kp.y + 0.2 + Math.floor(k / 2) * 0.36), q, S.set(0.6, 0.34, 0.45), col('#c89a5a')); push(inst.box, kp.clone().addScaledVector(f.t, (k % 2) * 0.7).setY(kp.y + 0.38 + Math.floor(k / 2) * 0.36), q, S.set(0.54, 0.05, 0.4), col('#e02a30')); } }
        // two or three shoppers behind the stall
        for (let k = 0; k < 3; k++) { if (rand() < 0.3) continue; const pp = c.clone().addScaledVector(f.n, side * rr(1.6, 2.6)).addScaledVector(f.t, rr(-1.6, 1.6)); const s = rr(0.9, 1.15); push(inst.crowdBody, pp.clone().setY(c.y + 0.8 * s), q, S.set(0.5 * s, 0.75 * s, 0.45 * s), pick(SH)); push(inst.crowdHead, pp.clone().setY(c.y + 1.72 * s), q, S.set(0.3 * s, 0.28 * s, 0.42 * s), col('#9a6a3e')); }
      }
    }
  }

  /* ---- the entrance: the big letters under the pines and the carved wooden arch over the start ---- */
  const WOODM = () => new THREE.MeshStandardMaterial({ color: col('#6a4a2e'), roughness: 0.9 });
  {
    const [lx, lz, lyaw] = MAP.entrance.letters, ly = groundH(lx, lz) + 0.2;
    const lettersTex = canvasTex(1024, 192, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.textBaseline = 'middle'; c.font = 'bold 100px sans-serif';
      const parts = [['Yo ', '#ffffff'], ['<3', '#e01e2e'], [' Colonia Tovar', '#ffffff']]; let x = 30;
      for (const [t, cc] of parts) { c.fillStyle = cc; if (t === '<3') { c.save(); c.translate(x + 50, h / 2); c.beginPath(); c.moveTo(0, 40); c.bezierCurveTo(-70, -10, -40, -70, 0, -30); c.bezierCurveTo(40, -70, 70, -10, 0, 40); c.fill(); c.restore(); x += 100; } else { c.fillText(t, x, h / 2); x += c.measureText(t).width; } }
    });
    const g = new THREE.Group(); g.position.set(lx, ly, lz); g.rotation.y = lyaw; scene.add(g);
    for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 3.4), new THREE.MeshStandardMaterial({ map: lettersTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, color: col(k ? '#c8c8c8' : '#ffffff') })); m.position.set(0, 2.6, -k * 0.12); m.castShadow = true; g.add(m); }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(20, 0.6, 5), WOODM()); deck.position.set(0, 0.3, 0); deck.receiveShadow = true; g.add(deck);
    const postM = WOODM();
    for (let k = -9; k <= 9; k += 1.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1, 0.16), postM); p.position.set(k, 1.1, 2.4); g.add(p); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(19, 0.14, 0.14), postM); rail.position.set(0, 1.6, 2.4); g.add(rail);
    for (let k = 0; k < 5; k++) { const a = lyaw + PI + rr(-1.2, 1.2), r = rr(10, 18), x = lx + Math.sin(a) * r, z = lz + Math.cos(a) * r; if (freeOf(x, z, 6)) pine(x, z, rr(0.9, 1.2)); }
    // the carved wooden arch spanning the road at the finish: beer mug, strawberry and the town name
    const f = roadFrame(i0), q0 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.n, UP, f.t.clone().negate()));
    const span = Math.max(hwL[i0], hwR[i0]) + 1.4;
    const archTex = canvasTex(1024, 300, (c, w, h) => {
      c.clearRect(0, 0, w, h); c.fillStyle = '#7a4a26';
      c.beginPath(); c.moveTo(20, h - 40); c.lineTo(20, 90); c.quadraticCurveTo(w / 2, -20, w - 20, 90); c.lineTo(w - 20, h - 40); c.quadraticCurveTo(w / 2, h - 80, 20, h - 40); c.fill();
      c.strokeStyle = '#3a220e'; c.lineWidth = 10; c.stroke();
      for (let y = 60; y < h; y += 26) { c.strokeStyle = 'rgba(40,20,8,0.25)'; c.lineWidth = 3; c.beginPath(); c.moveTo(30, y); c.lineTo(w - 30, y); c.stroke(); }
      c.font = 'bold 104px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#2a1608'; c.fillText('Colonia Tovar', w / 2 + 4, h / 2 + 14); c.fillStyle = '#fff6e6'; c.fillText('Colonia Tovar', w / 2, h / 2 + 10);
      c.font = 'bold 40px sans-serif'; c.fillStyle = '#ffd21f'; c.fillText('BIENVENIDOS', w / 2, h - 70);
      c.fillStyle = '#e8a82a'; c.fillRect(70, 110, 70, 90); c.fillStyle = '#fff8e8'; c.beginPath(); c.arc(80, 110, 18, 0, TAU); c.arc(105, 104, 20, 0, TAU); c.arc(132, 110, 18, 0, TAU); c.fill(); c.strokeStyle = '#e8a82a'; c.lineWidth = 12; c.beginPath(); c.arc(148, 155, 22, -PI / 2, PI / 2); c.stroke();
      c.fillStyle = '#e0202a'; c.beginPath(); c.moveTo(w - 110, 220); c.bezierCurveTo(w - 170, 160, w - 150, 110, w - 110, 115); c.bezierCurveTo(w - 70, 110, w - 50, 160, w - 110, 220); c.fill();
      c.fillStyle = '#ffe080'; for (let k = 0; k < 10; k++) c.fillRect(w - 135 + (k % 4) * 14, 135 + Math.floor(k / 4) * 22, 3, 5); c.fillStyle = '#3a8a2a'; c.beginPath(); c.ellipse(w - 110, 112, 26, 9, 0, 0, TAU); c.fill();
    });
    const am = new THREE.MeshStandardMaterial({ map: archTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(span * 2 + 1, (span * 2 + 1) * 5 / 17), am); board.position.copy(roadAt(i0, 0, 8.6)); board.quaternion.copy(q0); board.castShadow = true; scene.add(board);
    for (const s of [-1, 1]) { const b = roadAt(i0, s * span, 0); b.y = Math.min(b.y, groundH(b.x, b.z)); beams.wood.push(placeBeam(b.clone().setY(b.y - 0.5), b.clone().setY(b.y + 9.6), 0.6, 0.6)); }
  }

  /* ---- the yellow A-frame house on a hortensias corner ---- */
  {
    const [ax, az] = MAP.aframe.at, i = idxNear(ax, az), f = roadFrame(i), side = MAP.aframe.side, p = roadAt(i, side * (lateralHW(i, side) + 11), 0); p.y = groundH(p.x, p.z) - 0.3;
    const yaw = yawOf(f.n.clone().multiplyScalar(-side)), g = new THREE.Group(); g.position.copy(p); g.rotation.y = yaw; scene.add(g);
    const yel = new THREE.MeshStandardMaterial({ color: col('#f2c83a'), roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: col('#2e2a26'), roughness: 0.8 }), brown = new THREE.MeshStandardMaterial({ color: col('#6a4426') });
    const s = new THREE.Shape(); s.moveTo(-4.5, 0); s.lineTo(4.5, 0); s.lineTo(0, 8.5); s.closePath();
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 9, bevelEnabled: false }), yel); body.position.z = -9; body.castShadow = true; g.add(body);
    for (const sx of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.3, 10.4, 10), dark); r.position.set(sx * 2.4, 4.4, -4.5); r.rotation.z = sx * Math.atan2(4.7, 8.6); r.castShadow = true; g.add(r); }
    for (const [x, y, w, h] of [[-1.4, 1.2, 1.2, 2.4], [1.4, 1.2, 1.2, 2.4], [0, 4.6, 1.4, 1.6]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.15), brown); m.position.set(x, y + h / 2, 0.05); g.add(m); }
    take(p.x, p.z, 8);
    for (let k = 0; k < 10; k++) hydrangea(p.x + rr(-8, 8), p.z + rr(-8, 8), rr(0.9, 1.2));
  }

  /* ---- the hanging bridge of the Casita del Árbol, over a forest hairpin ---- */
  {
    const HB = MAP.hangingBridge, i = idxNear(HB.at[0], HB.at[1]), f = roadFrame(i), y = roadY[i] + HB.height, half = HB.span / 2;
    const ends = [-1, 1].map(s => roadAt(i, s * half, 0).setY(y));
    for (const e of ends) {
      const gy = groundH(e.x, e.z);
      push(inst.trunk, V3(e.x, gy - 0.3, e.z), Q, S.set(0.9, y - gy + 6, 0.9), col('#6a5040'));
      push(inst.box, e.clone().setY(y - 0.2), qYaw(yawOf(f.t)), S.set(5, 0.4, 5), col('#7a5232'));
      // the library ceiba shading each platform
      const out = e.clone().sub(f.p).setY(0).normalize(), tx = e.x + out.x * 4, tz = e.z + out.z * 4;
      if (freeOf(tx, tz, 5)) cloudTree(tx, tz, true);
      take(e.x, e.z, 5);
    }
    // the little tree house on one platform
    { const e = ends[1]; push(inst.box, e.clone().setY(y + 1.4), qYaw(yawOf(f.t)), S.set(3.4, 2.8, 3.4), col('#9a6a44')); push(inst.roof, e.clone().setY(y + 2.8), qYaw(yawOf(f.t)), S.set(4.2, 2.2, 4.2), col('#b8402c')); }
    // planks with a sag, rope rails and green safety net
    const dir = ends[1].clone().sub(ends[0]), L = dir.length(); dir.normalize();
    const sagAt = t => -1.2 * 4 * t * (1 - t);
    const ropes = [];
    for (let k = 1; k < 40; k++) { const t = k / 40, p = ends[0].clone().addScaledVector(dir, L * t); p.y += sagAt(t); push(inst.box, p, qYaw(yawOf(dir) + PI / 2), S.set(1.6, 0.08, 0.36), col('#9a7a50')); }
    for (const o of [-0.85, 0.85]) for (const h of [0.05, 1.15]) for (let k = 0; k < 24; k++) { const t0 = k / 24, t1 = (k + 1) / 24, side = V3(-dir.z, 0, dir.x).multiplyScalar(o); const a = ends[0].clone().addScaledVector(dir, L * t0).add(side); a.y += sagAt(t0) + h; const b = ends[0].clone().addScaledVector(dir, L * t1).add(side); b.y += sagAt(t1) + h; ropes.push(a, b); }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ropes), new THREE.LineBasicMaterial({ color: col('#d8d0b8') })));
    const netTex = canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#3ac08a'; c.lineWidth = 3; for (let k = 0; k <= 64; k += 16) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k, h); c.stroke(); c.beginPath(); c.moveTo(0, k); c.lineTo(w, k); c.stroke(); } });
    netTex.repeat.set(L / 1.2, 1);
    const netM = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide });
    for (const o of [-0.85, 0.85]) {
      const pos = [], uv = [], idx = [], side = V3(-dir.z, 0, dir.x).multiplyScalar(o);
      for (let k = 0; k <= 24; k++) { const t = k / 24, a = ends[0].clone().addScaledVector(dir, L * t).add(side); a.y += sagAt(t); pos.push(a.x, a.y, a.z, a.x, a.y + 1.15, a.z); uv.push(t, 0, t, 1); if (k) { const q = (k - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
      scene.add(new THREE.Mesh(g, netM));
    }
  }

  /* ---- the mirador: terrace, arrow signpost, picnic tables, a tiled kiosk, cypresses ---- */
  {
    const MR = MAP.mirador, y = PADS[1].y;
    const terr = new THREE.Mesh(new THREE.CylinderGeometry(MR.r, MR.r + 2, 1.2, 40), new THREE.MeshStandardMaterial({ color: col('#9a9a90'), roughness: 0.95 })); terr.position.set(MR.x, y - 0.5, MR.z); terr.receiveShadow = true; scene.add(terr);
    // a low stone wall round the valley side
    for (let k = 0; k < 48; k++) { const a0 = -0.15 * PI + k / 48 * 1.3 * PI, a1 = a0 + 1.3 * PI / 48; const p0 = V3(MR.x + Math.cos(a0) * (MR.r - 1), y + 0.5, MR.z + Math.sin(a0) * (MR.r - 1)), p1 = V3(MR.x + Math.cos(a1) * (MR.r - 1), y + 0.5, MR.z + Math.sin(a1) * (MR.r - 1)); if (p0.z < MR.z - 6 || !freeOf(p0.x, p0.z, 1)) continue; beams.stone.push(placeBeam(p0, p1, 0.8, 1.1)); }
    // the signpost
    const sp = V3(MR.x - 12, y, MR.z + 4); beams.wood.push(placeBeam(sp.clone().setY(y - 0.2), sp.clone().setY(y + 5.4), 0.24, 0.24));
    const labels = ['Mirador', 'Chocolate', 'Fresas con crema', 'Columpio', 'Parapentes', 'Altitud 2000 m'], AC = ['#ffd21f', '#e8462e', '#2a9b5a', '#3d7bf2', '#e8462e', '#2a9b5a'];
    labels.forEach((t, k) => {
      const tex = canvasTex(512, 96, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#5a3a1e'; c.beginPath(); c.moveTo(0, 8); c.lineTo(w - 60, 8); c.lineTo(w - 4, h / 2); c.lineTo(w - 60, h - 8); c.lineTo(0, h - 8); c.closePath(); c.fill(); c.fillStyle = AC[k]; c.beginPath(); c.moveTo(w - 54, 18); c.lineTo(w - 14, h / 2); c.lineTo(w - 54, h - 18); c.fill(); c.fillStyle = '#ffe9a0'; c.font = 'bold 46px Georgia, serif'; c.textBaseline = 'middle'; c.fillText(t, 18, h / 2 + 2); });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.52), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
      m.position.set(sp.x, y + 4.9 - k * 0.62, sp.z); m.rotation.y = (k % 2 ? 0.6 : -0.4) + PI; m.translateX(-1.3); scene.add(m);
    });
    // picnic tables
    for (let k = 0; k < 6; k++) { const tx = MR.x - 6 + (k % 3) * 7, tz = MR.z + 6 + Math.floor(k / 3) * 7, yaw = rr(-0.2, 0.2); if (!freeOf(tx, tz, 2)) continue; addBox(V3(tx, y + 0.78, tz), V3(2.4, 0.1, 0.9), yaw, '#8a5a32'); for (const s of [-1, 1]) { addBox(V3(tx + Math.sin(yaw) * s * 0.85, y + 0.45, tz + Math.cos(yaw) * s * 0.85), V3(2.4, 0.08, 0.35), yaw, '#8a5a32'); addBox(V3(tx + Math.cos(yaw) * s * 0.9, y + 0.38, tz - Math.sin(yaw) * s * 0.9), V3(0.12, 0.76, 1.8), yaw, '#6a4426'); } }
    // the kiosk with red roof tiles
    const kx = MR.x + 16, kz = MR.z + 6;
    if (freeOf(kx, kz, 3)) {
      addBox(V3(kx, y + 1.4, kz), V3(3.4, 2.8, 2.6), -0.3, '#7a5232'); addBox(V3(kx, y + 1.3, kz + 1.32), V3(2.8, 1.6, 0.1), -0.3, '#3a2a1e');
      for (let k = 0; k < 8; k++) push(inst.sphere, V3(kx - 1.0 + (k % 4) * 0.66, y + 1.0 + Math.floor(k / 4) * 0.5, kz + 1.3), Q, S.set(0.14, 0.2, 0.14), col('#f4f0e6'));
      push(inst.roof, V3(kx, y + 2.8, kz), qYaw(-0.3 + PI / 2), S.set(3.8, 1.5, 4.4), col('#c4482e'));
    }
    for (const [x, z] of [[MR.x - 20, MR.z + 10], [MR.x + 6, MR.z + 20], [MR.x + 24, MR.z + 16]]) if (freeOf(x, z, 4)) cypress(x, z);
    take(MR.x, MR.z, MR.r + 2);
  }

  /* ---------------- vegetation over the mountains ---------------- */
  {
    const Z = MAP.zones, AX1 = X0 + SIZE, AZ1 = Z0 + SIZE;
    // hydrangea banks along the climb and the entrance, thick on both sides
    for (const side of [-1, 1]) for (let i = 0; i < NR; i += 3) {
      const s = SEG[i]; if (s !== 'h' && s !== 'e' && !(s === 'l' && side < 0)) continue;
      if (rand() < 0.25) continue;
      const p = roadAt(i, side * (lateralHW(i, side) + rr(1.6, 5.5)), 0); if (!freeOf(p.x, p.z, 1.2) || !clearSpot(p.x, p.z, 1)) continue;
      hydrangea(p.x, p.z, rr(0.9, 1.4));
    }
    tries(Z.hydrangeas, () => { const x = rr(X0 + 10, AX1 - 10), z = rr(Z0 + 10, VA.from); if (!freeOf(x, z, 2) || !clearSpot(x, z, 1.5) || inForest(x, z) && rand() < 0.7) return false; hydrangea(x, z, rr(0.8, 1.3)); return true; });
    // pines and cloud forest: thick in the forest zone and on the mountains, thinner round the town
    tries(Z.pines, () => {
      const x = rr(X0 + 4, AX1 - 4), z = rr(Z0 + 4, AZ1 - 4); if (!freeOf(x, z, 8) || !clearSpot(x, z, 3)) return false;
      if (inTown(x, z) && rand() < 0.85) return false;
      { const r = sampleR(RR, x, z); if (r.i >= 0 && (SEG[r.i] === 'h' || SEG[r.i] === 'e') && r.dist < 28) return false; }
      pine(x, z, rr(0.8, 1.25)); return true;
    });
    tries(Z.cloudTrees, () => {
      const x = rr(X0 + 4, AX1 - 4), z = rr(Z0 + 4, AZ1 - 4); if (!freeOf(x, z, 9) || !clearSpot(x, z, 3)) return false;
      if (!inForest(x, z) && z < VA.from && rand() < 0.65) return false; if (inTown(x, z)) return false;
      cloudTree(x, z, rand() < 0.5); return true;
    });
    // the forest hairpins: trees right up to the edge
    for (let i = 0; i < NR; i += 5) { if (SEG[i] !== 'f') continue; for (const side of [-1, 1]) { if (rand() < 0.35) continue; const p = roadAt(i, side * (lateralHW(i, side) + rr(5.5, 11)), 0); if (!freeOf(p.x, p.z, 5) || !clearSpot(p.x, p.z, 2)) continue; rand() < 0.6 ? pine(p.x, p.z, rr(0.8, 1.1)) : cloudTree(p.x, p.z, rand() < 0.3); } }
    // the far mountains: library conifers and ceibas on the continued landscape
    tries(Z.far, () => {
      const x = rr(-1200, 1200), z = rr(-1200, 1200); if (inArea(x, z, 10)) return false;
      if (z > 300 && z < 900 && rand() < 0.5) return false;
      const y = groundH(x, z); if (!Number.isFinite(y)) return false;
      vegetation.add(rand() < 0.6 ? 'fir' : 'tree', x, z, y, rr(1.1, 1.5), 100); return true;
    });
    tries(9000, () => { const x = rr(X0 + 4, AX1 - 4), z = rr(Z0 + 4, AZ1 - 4); if (!freeOf(x, z, 1.2)) return false; const y = terrainH(x, z), s = rr(0.6, 1.2); push(inst.grass, V3(x, y - 0.05, z), qYaw(rand() * TAU), S.set(s * 1.4, s, s * 1.4), col('#7ab84a').offsetHSL(rr(-0.03, 0.03), rr(-0.1, 0.05), rr(-0.08, 0.06))); return true; });
  }

  /* ---------------- signs ---------------- */
  for (const sg of MAP.signs) {
    const i = idxNear(sg.at[0], sg.at[1]), f = roadFrame(i), p0 = roadAt(i, sg.side * (lateralHW(i, sg.side) + 2.4)); p0.y = groundH(p0.x, p0.z);
    const tex = woodSign(sg.lines), m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), wood = WOODM();
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 0.12), [wood, wood, wood, wood, m, wood]); board.position.copy(p0).setY(p0.y + 2.6); board.lookAt(board.position.clone().addScaledVector(f.t, -1)); board.castShadow = true; scene.add(board);
    for (const o of [-1.9, 1.9]) { const q = p0.clone().addScaledVector(f.t, o); beams.wood.push(placeBeam(q.clone().setY(p0.y - 0.2), q.clone().setY(p0.y + 2.1), 0.14, 0.14)); }
  }

  /* ---------------- paragliders circling over the valley ---------------- */
  const gliders = MAP.paragliders.map((P, k) => {
    const g = new THREE.Group();
    const wing = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 2.6, 24, 1, true, -1.1, 2.2), new THREE.MeshStandardMaterial({ color: col(['#e8462e', '#ffd21f', '#3d7bf2', '#f08ab0'][k % 4]), side: THREE.DoubleSide, roughness: 0.7 }));
    wing.rotation.z = PI / 2; wing.rotation.y = PI / 2; wing.position.y = 1.5; g.add(wing);
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshStandardMaterial({ color: col('#2a2a2a') })); pilot.position.y = -5; g.add(pilot);
    const lines = []; for (const s of [-1, 1]) for (const z of [-0.9, 0.9]) { lines.push(V3(0, -5, 0), V3(s * 4.6, 2.0, z)); } g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: col('#333333') })));
    scene.add(g); return { g, ...P, ph: k * 1.7 };
  });

  /* ---------------- fog: banks that sit low in the hollows and roll in and out on the race clock ---------------- */
  const FOG = MAP.fog, fogSprites = [];
  const fPh = [PI / 2, 0.4];
  const roll = t => clamp(0.55 + 0.35 * Math.sin(t * TAU / FOG.roll.periods[0] + fPh[0]) + 0.2 * Math.sin(t * TAU / FOG.roll.periods[1] + fPh[1]), FOG.roll.min, 1);
  {
    const mat = () => new THREE.SpriteMaterial({ map: cloudTex, color: col('#f2f4f5'), transparent: true, opacity: 0, depthWrite: false, fog: false });
    const strong = FOG.patches.filter(q => q[3] >= 0.5);
    for (let k = 0; k < FOG.sprites; k++) {
      const P = pick(strong), a = rand() * TAU, r = Math.sqrt(rand()) * P[2] * 0.85, x = P[0] + Math.cos(a) * r, z = P[1] + Math.sin(a) * r;
      const s = new THREE.Sprite(mat()); s.position.set(x, groundH(x, z) + rr(3, 16), z); const sc = rr(28, 60); s.scale.set(sc / scale, sc * 0.5, 1); s.userData = { k: P[3] * Math.exp(-(r * r) / (P[2] * P[2]) * 1.2), ph: rand() * TAU, y0: s.position.y, x0: x };
      scene.add(s); fogSprites.push(s);
    }
    // a sea of cloud far below the mirador
    for (let k = 0; k < 40; k++) { const s = new THREE.Sprite(mat()); s.position.set(rr(-900, 900), rr(-200, -150), rr(420, 1000)); const sc = rr(160, 320); s.scale.set(sc / scale, sc * 0.35, 1); s.userData = { k: 0.9, ph: rand() * TAU, y0: s.position.y, x0: s.position.x, sea: true }; scene.add(s); fogSprites.push(s); }
  }

  /* ---------------- flush instances ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; scene.add(im); return im;
  }
  { const g = new THREE.CylinderGeometry(0.55, 1, 1, 7, 2); g.translate(0, 0.5, 0); flush(inst.trunk, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true })); }
  flush(inst.hydLeaf, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }));
  flush(inst.hyd, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, emissive: col('#202040'), emissiveIntensity: 0.25 }), false);
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }));
  flush(inst.timber, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: timberTex, roughness: 0.85 }));
  { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); flush(inst.roof, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, side: THREE.DoubleSide })); }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, metalness: 0.3 })); }
  flush(inst.sphere, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7, emissive: col('#ffe8b0'), emissiveIntensity: 0.15 }), false);
  { const g = new THREE.ConeGeometry(1, 1, 12, 1, true); flush(inst.umbrella, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.75, side: THREE.DoubleSide })); }
  flush(inst.fruit, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.5 }), false);
  flush(inst.crowdBody, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false);
  flush(inst.crowdHead, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false);
  { const g = new THREE.PlaneGeometry(1, 1, 1, 2); g.translate(0, 0.5, 0); const g2 = g.clone(); g2.rotateY(PI / 2); flush(inst.grass, mergeGeometries([g, g2]), windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0, 0.18), false); }
  flush(inst.post, (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; })(), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 }));
  const REFL = new THREE.MeshStandardMaterial({ color: col('#ffffff'), emissive: col('#ffffff'), emissiveIntensity: 0.2, roughness: 0.3 });
  REFL.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\n totalEmissiveRadiance *= vColor;\n#endif'); };
  flush(inst.reflector, new THREE.BoxGeometry(1, 1, 1), REFL, false);
  {
    const mats = { yellow: new THREE.MeshStandardMaterial({ color: col('#f2c41e'), roughness: 0.7 }), iron: new THREE.MeshStandardMaterial({ color: col('#1e1e20'), metalness: 0.5, roughness: 0.5 }), wood: new THREE.MeshStandardMaterial({ color: col('#5a3e26'), roughness: 0.9 }), white: new THREE.MeshStandardMaterial({ color: col('#eeeeea') }), walk: new THREE.MeshStandardMaterial({ color: col('#8a8a86'), roughness: 0.95 }), stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 }) };
    const bg = new THREE.BoxGeometry(1, 1, 1);
    for (const [k, list] of Object.entries(beams)) if (list.length) { const im = new THREE.InstancedMesh(bg, mats[k], list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = k !== 'walk'; im.receiveShadow = true; scene.add(im); }
  }

  /* ---------------- per-frame updates: wind, fountain, fog banks, paragliders ---------------- */
  function update(t) {
    uTime.value = t;
    waterMats.forEach(m => (m.uniforms.uT.value = t));
    const R = roll(t);
    // Reflectors glow brighter as the fog rolls in.
    REFL.emissiveIntensity = 0.25 + 2.4 * sstep(0.45, 1, R);
    fogSprites.forEach(s => { const u = s.userData; s.material.opacity = clamp(u.k * (u.sea ? 0.8 : R) * 0.42, 0, 0.5); s.position.y = u.y0 + Math.sin(t * 0.2 + u.ph) * 1.5; s.position.x = u.x0 + Math.sin(t * 0.05 + u.ph) * 6; });
    gliders.forEach(G => { const a = t / G.period * TAU + G.ph, x = G.c[0] + Math.cos(a) * G.r, z = G.c[1] + Math.sin(a) * G.r; G.g.position.set(x, G.h + Math.sin(t * 0.3 + G.ph) * 8, z); G.g.rotation.set(0, -a, 0.25); });
  }

  const ownedMaterials = new Set(), ownedTextures = new Set();
  scene.traverse(o => {
    for (const material of [].concat(o.material || [])) {
      ownedMaterials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) ownedTextures.add(value);
      for (const uniform of Object.values(material.uniforms || {})) if (uniform.value?.isTexture) ownedTextures.add(uniform.value);
    }
  });
  vegetation.flush();
  scene.userData.dispose = () => { ownedTextures.forEach(t => t.dispose()); ownedMaterials.forEach(m => m.dispose()); };
  return { group: scene, groundAt: groundH, update };
}
