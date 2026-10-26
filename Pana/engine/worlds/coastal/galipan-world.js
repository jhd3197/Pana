// i18n-ignore-file: world signage and scene object names stay Spanish.
import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import { extendTerrain } from './world-horizon.js';
import * as THREE from 'three';
import { coastalVegetation } from './coastal-vegetation.js';
import { MAP, noise } from './galipan-layout.js';

export const GALIPAN_SCALE = 1.2;

// Galipán at night: chalets and string lights along the pueblito, Boca de
// Tigre, the sunflower terrace, the cable car and Caracas glowing far below.
// Sky, moonlight and fog come from the race palette, not from this builder.
export function createWorld(scene, layout, roadDistance) {
  const vegetation = coastalVegetation(scene, GALIPAN_SCALE, roadDistance);
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

  const { SIZE, X0, Z0, NR, STEP, RP, SEG, RR, hwL, hwR, roadY, roadFrame, roadAt, lateralHW, idxNear, edgeOf, farH: originalFarH, groundH: originalGroundH, terrainH, PADS, inArea, sampleR } = layout;
  const farH = (x, z) => horizon?.heightAt(x, z) ?? originalFarH(x, z);
  const groundH = (x, z) => horizon?.heightAt(x, z) ?? originalGroundH(x, z);
  const CITY = MAP.city, CL = MAP.cliff;

  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const glowTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,255,255,0.75)'); g.addColorStop(0.45, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const poolTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const cloudTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  // cobbles for the strip, concrete blocks for the mountain road; each with a faint emissive twin so the line reads at night
  const cobbles = glow => canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = glow ? '#000' : '#4a4540'; c.fillRect(0, 0, w, h);
    if (!glow) for (let i = 0; i < 260; i++) { const x = rand() * w, y = rand() * h, r = rr(7, 14), v = (110 + rand() * 60) | 0; for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) { c.fillStyle = `rgb(${v},${v - 6},${v - 14})`; c.beginPath(); c.ellipse(x + ox, y + oy, r, r * rr(0.7, 1), rr(0, PI), 0, TAU); c.fill(); } }
    c.fillStyle = glow ? '#8a8070' : 'rgba(245,240,225,0.8)'; c.fillRect(w * 0.03, 0, 6, h); c.fillRect(w * 0.97 - 6, 0, 6, h);
  });
  const blocks = glow => canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = glow ? '#000' : '#8c8a84'; c.fillRect(0, 0, w, h);
    if (!glow) { for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { const v = (132 + rand() * 30) | 0; c.fillStyle = `rgb(${v},${v - 2},${v - 8})`; c.fillRect(x + 2, y + 2, 28, 28); } for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(20,20,20,${rr(0.05, 0.2).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, 2, 2); } }
    c.fillStyle = glow ? '#b8a030' : '#f2c41e'; c.fillRect(w * 0.035, 0, 10, h); c.fillRect(w * 0.965 - 10, 0, 10, h);
  });
  const textBoard = (w, h, bg, draw) => canvasTex(w, h, c => { c.fillStyle = bg; c.fillRect(0, 0, w, h); draw(c, w, h); });
  const letterTex = (text, font, heart) => canvasTex(1024, 192, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.textBaseline = 'middle'; c.textAlign = 'center'; c.font = font;
    const parts = text.split('<3'); const W0 = c.measureText(parts[0]).width, W1 = parts[1] ? c.measureText(parts[1]).width : 0, gap = parts[1] ? 110 : 0, x0 = w / 2 - (W0 + W1 + gap) / 2;
    c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.fillText(parts[0], x0, h / 2 + 6);
    if (parts[1] !== undefined) {
      c.save(); c.translate(x0 + W0 + gap / 2, h / 2); c.fillStyle = heart; c.beginPath(); c.moveTo(0, 40); c.bezierCurveTo(-70, -10, -40, -70, 0, -30); c.bezierCurveTo(40, -70, 70, -10, 0, 40); c.fill(); c.restore();
      c.fillStyle = '#ffffff'; c.fillText(parts[1], x0 + W0 + gap, h / 2 + 6);
    }
  });

  /* ---------------- wind sway and self-lit materials ---------------- */
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
    mat.customProgramCacheKey = () => 'galipan-windy' + base + '_' + perY;
    return mat;
  }
  // Instance colors also glow faintly, so painted chalets and flowers read under moonlight.
  function selfLit(mat, k, key) {
    mat.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR
          totalEmissiveRadiance += vColor.rgb * ${k.toFixed(3)};
        #endif`);
    };
    mat.customProgramCacheKey = () => 'galipan-selfLit-r186-' + key;
    return mat;
  }

  /* ---------------- terrain ---------------- */
  const cForest = col('#2c5a30'), cForest2 = col('#3a6e34'), cGrass = col('#5a8a3c'), cRock = col('#5a554c'), cVerge = col('#6a6a5c'), cDeep = col('#0e160e');
  function paintGround(x, z, y, slope, tmp) {
    const n = 0.5 + 0.5 * noise(x * 2, z * 2);
    tmp.copy(cForest).lerp(cForest2, n * 0.7).lerp(cGrass, sstep(0.6, 0.9, n) * 0.4);
    tmp.lerp(cRock, sstep(0.55, 0.85, slope) * 0.7);
    tmp.lerp(cDeep, sstep(0, -300, y));
    return tmp;
  }
  {
    const SEGS = Math.round(SIZE / 3), geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    geo.rotateX(-PI / 2); geo.translate(X0 + SIZE / 2, 0, Z0 + SIZE / 2);
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
    horizon = extendTerrain(m, { bounds: [X0, Z0, X0 + SIZE, Z0 + SIZE], nx: SEGS, nz: SEGS, height: originalFarH, color: (x, z, y) => paintGround(x, z, y, 0, new THREE.Color()), biome: 'galipan' });
  }

  /* ---------------- Caracas: a carpet of thousands of lights far below, twinkling, with cloud drifting over it ---------------- */
  const cityMat = new THREE.ShaderMaterial({
    uniforms: { uT: uTime },
    vertexShader: `attribute vec3 aCol; attribute float aSize; attribute float aPh; uniform float uT; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float tw = 0.7 + 0.3 * sin(uT * (1.2 + aPh * 3.0) + aPh * 50.0); vC = aCol * tw;
        gl_PointSize = clamp(aSize * 700.0 / -mv.z, 1.6, 9.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC * a * 1.8, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  {
    const N = CITY.lights, pos = new Float32Array(N * 3), cc = new Float32Array(N * 3), sz = new Float32Array(N), ph = new Float32Array(N);
    const C = [col('#fff2d8'), col('#ffb24a'), col('#ffc870'), col('#ffffff'), col('#c8d8ff'), col('#ff9a30')];
    for (let k = 0; k < N; k++) {
      let x, z;
      for (let t2 = 0; t2 < 20; t2++) {
        const a = rand() * TAU, r = Math.sqrt(rand()); x = CITY.center[0] + Math.cos(a) * r * CITY.rx; z = CITY.center[1] + Math.sin(a) * r * CITY.rz;
        if (edgeOf(x, z) > CL.width + 150) break;
      }
      // most lights sit on a street grid, a few on the long avenues
      const G = CITY.grid, u = rand();
      if (u < 0.25) x = Math.round(x / G) * G + rr(-3, 3); else if (u < 0.5) z = Math.round(z / G) * G + rr(-3, 3); else { const cx2 = Math.round(x / 260) * 260, cz2 = Math.round(z / 200) * 200; x = cx2 + (x - cx2) * 0.8 + rr(-20, 20); z = cz2 + (z - cz2) * 0.8 + rr(-20, 20); }
      if (rand() < 0.05) z = CITY.center[1] - 300 + Math.sin(x * 0.0015) * 120 + rr(-3, 3);
      const c = pick(C), b = rr(0.45, 1);
      pos.set([x, CITY.y + rr(0, 8), z], k * 3); cc.set([c.r * b, c.g * b, c.b * b], k * 3); sz[k] = rr(2.5, 6); ph[k] = rand();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(cc, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    const pts = new THREE.Points(g, cityMat); pts.frustumCulled = false; pts.name = 'galipan-caracas'; scene.add(pts);
    // the warm haze over the city floor
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(CITY.rx * 2.4, CITY.rz * 2.4), new THREE.MeshBasicMaterial({ map: poolTex, color: col('#3a200c'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    haze.rotation.x = -PI / 2; haze.position.set(CITY.center[0], CITY.y + 1, CITY.center[1]); scene.add(haze);
  }
  const cityClouds = [];
  {
    const m = new THREE.SpriteMaterial({ map: cloudTex, color: col('#5a5e78'), transparent: true, opacity: 0.28, depthWrite: false, fog: false });
    for (let k = 0; k < CITY.clouds; k++) { const s = new THREE.Sprite(m); s.position.set(CITY.center[0] + rr(-2600, 2600), CITY.y + rr(140, 260), CITY.center[1] + rr(-1100, 500)); const sc = rr(400, 900); s.scale.set(sc, sc * 0.3, 1); s.userData = { x0: s.position.x, sp: rr(4, 9) }; scene.add(s); cityClouds.push(s); }
  }

  /* ---------------- road surface ---------------- */
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
  const COBBLE = new THREE.MeshStandardMaterial({ map: cobbles(false), emissiveMap: cobbles(true), emissive: col('#ffffff'), emissiveIntensity: 0.7, roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const BLOCKS = new THREE.MeshStandardMaterial({ map: blocks(false), emissiveMap: blocks(true), emissive: col('#ffffff'), emissiveIntensity: 0.7, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  // No surface over Caracas ('a'): that stretch is flown.
  runs(i => (SEG[i] === 'a' ? 'a' : SEG[i] === 'p' || SEG[i] === 'q' ? 'c' : 'b'), (k, list) => k !== 'a' && stripMesh(list.map(i => ({ a: roadAt(i, -hwL[i], 0.12), b: roadAt(i, hwR[i], 0.12) })), k === 'c' ? COBBLE : BLOCKS, k === 'c' ? 5 : 8));

  /* ---------------- instance buffers ---------------- */
  const _bx = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
  const placeBeam = (a, b, tx, tz) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length(); dir.normalize();
    _bx.crossVectors(dir, UP); if (_bx.lengthSq() < 1e-6) _bx.set(1, 0, 0); _bx.normalize(); _bz.crossVectors(_bx, dir).normalize();
    _bm.makeBasis(_bx, dir, _bz); d.quaternion.setFromRotationMatrix(_bm); d.position.copy(a).addScaledVector(dir, len / 2); d.scale.set(tx, len, tz); d.updateMatrix(); return d.matrix.clone();
  };
  const beams = { iron: [], wood: [], stone: [] };
  const inst = { box: [], boxLit: [], lamp: [], roof: [], blob: [], fern: [], cyl: [], sphere: [], petal: [], seed: [], crowdBody: [], crowdHead: [], post: [], reflector: [], stem: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const yawOf = v => Math.atan2(v.x, v.z);
  const mat4 = (x, y, z, yaw = 0, s = 1, sy = s) => { d.position.set(x, y, z); d.quaternion.copy(qYaw(yaw)); d.scale.set(s, sy, s); d.updateMatrix(); return d.matrix.clone(); };
  const freeOf = (x, z, m) => { const r = sampleR(RR, x, z); return !(r.i >= 0 && r.dist < hwR[r.i] + m); };
  const taken = [];
  for (const v of Object.values(MAP.views)) taken.push([v.pos[0], v.pos[2], 10]);
  const clearSpot = (x, z, r) => !taken.some(t => Math.hypot(t[0] - x, t[1] - z) < t[2] + r);
  const take = (x, z, r) => taken.push([x, z, r]);
  function tries(n, fn) { for (let i = 0, k = 0; i < n && k < n * 30; k++) if (fn()) i++; }
  // glow points (warm bulbs, string lights) and soft pools of light on the ground
  const glows = [], glowCols = [], pools = [];
  const addGlow = (p, c, k = 1) => { glows.push(p.x, p.y, p.z); const cc = col(c).multiplyScalar(k); glowCols.push(cc.r, cc.g, cc.b); };
  const addPool = (p, r, c = '#ffb060', k = 1) => pools.push({ p, r, c: col(c).multiplyScalar(k * 0.5) });
  const BULBS = ['#ffd890', '#ffe8b8', '#ffc870', '#fff4dc'];
  const stringLights = (a, b, sag, step = 0.8, colors = BULBS, k = 0.7) => { const L = a.distanceTo(b), n = Math.max(2, Math.round(L / step)); for (let j = 1; j < n; j++) { const t = j / n, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); addGlow(p, colors[j % colors.length], k); } };
  // A few warm point lights where the race passes the brightest places; no shadows.
  const lights = [];
  const pointLight = (p, c, i, dist) => { if (lights.length >= 6) return; const l = new THREE.PointLight(col(c), i * 40, dist, 1.5); l.position.copy(p); scene.add(l); lights.push(l); };

  /* ---------------- trees of the cloud forest: native library trees, ferns and bromeliads ---------------- */
  const roadGap = (x, z) => sampleR(RR, x, z).dist;
  function cloudTree(x, z, big) {
    vegetation.add(big ? 'tree' : 'mango', x, z, groundH(x, z), big ? rr(1.1, 1.4) : rr(0.8, 1.05), roadGap(x, z));
  }
  function pine(x, z, s = 1) {
    vegetation.add(rand() < 0.6 ? 'pine' : 'fir', x, z, groundH(x, z), s, roadGap(x, z));
  }
  function fern(x, z, s = 1) { const y = groundH(x, z); for (let k = 0; k < 5; k++) push(inst.fern, V3(x, y, z), qEuler(rr(-0.7, -0.35), k / 5 * TAU + rr(-0.2, 0.2), 0), S.set(0.6 * s, 0.1, 1.6 * s), col('#3a7a2e').offsetHSL(0, 0, rr(-0.04, 0.04))); if (rand() < 0.2) push(inst.sphere, V3(x, y + 0.5 * s, z), Q, S.set(0.18, 0.3, 0.18), col('#e8302a')); }

  /* ---------------- chalets: dark wood, brick base, tile roof, big balconies with flower boxes and string lights ---------------- */
  const WOODS = ['#7a4a2a', '#8a5430', '#6a3e22', '#9a6232'].map(col), TILES = ['#a8382a', '#b84a30', '#963226'].map(col);
  const FLOWER = ['#ff2a3a', '#ff5a8a', '#ffffff', '#ff9a2a', '#e8308a'].map(col);
  function chalet(p, yaw, w, dpt, floors = 2) {
    const y = Math.min(groundH(p.x, p.z), groundH(p.x - Math.sin(yaw) * dpt, p.z - Math.cos(yaw) * dpt)) - 0.4, q = qYaw(yaw);
    const fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), right = V3(Math.cos(yaw), 0, -Math.sin(yaw)), back = p.clone().addScaledVector(fwd, -dpt / 2);
    const wood = pick(WOODS), fh = 3.2;
    push(inst.boxLit, back.clone().setY(y + 0.8), q, S.set(w, 1.6, dpt), col(rand() < 0.5 ? '#a85a3a' : '#8a7e70'));
    for (let k = 0; k < floors; k++) push(inst.boxLit, back.clone().setY(y + 1.6 + fh * (k + 0.5)), q, S.set(w, fh, dpt), wood);
    const top = y + 1.6 + fh * floors;
    push(inst.roof, back.clone().setY(top), qYaw(yaw + PI / 2), S.set(dpt + 2.2, rr(2.2, 3.2), w + 1.6), pick(TILES));
    // warm windows and a lit doorway
    for (let k = 0; k < floors; k++) for (const o of [-0.3, 0.05, 0.32]) { if (rand() < 0.2) continue; push(inst.lamp, p.clone().addScaledVector(right, o * w).addScaledVector(fwd, 0.04).setY(y + 1.6 + fh * k + 1.5), q, S.set(1.2, 1.4, 0.1), col(pick(['#ffcf88', '#ffd8a0', '#ffb860']))); }
    push(inst.lamp, p.clone().addScaledVector(right, -0.3 * w).addScaledVector(fwd, 0.05).setY(y + 2.7), q, S.set(1.3, 2.2, 0.1), col('#ffc070'));
    // the balcony on the upper floor: deck on brackets, railing, flower boxes, string lights along the eave and the rail
    if (floors > 1) {
      const by = y + 1.6 + fh, bp = p.clone().addScaledVector(fwd, 1.0);
      push(inst.box, bp.clone().setY(by), q, S.set(w, 0.25, 2.0), col('#5a3a20'));
      for (let k = -8; k <= 8; k++) push(inst.box, bp.clone().addScaledVector(right, k * w / 17).addScaledVector(fwd, 0.95).setY(by + 0.55), q, S.set(0.08, 1.0, 0.08), col('#5a3a20'));
      push(inst.box, bp.clone().addScaledVector(fwd, 0.95).setY(by + 1.05), q, S.set(w, 0.1, 0.12), col('#5a3a20'));
      push(inst.box, bp.clone().addScaledVector(fwd, 1.1).setY(by + 0.85), q, S.set(w * 0.9, 0.3, 0.35), col('#7a4e26'));
      for (let j = 0; j < 10; j++) push(inst.sphere, bp.clone().addScaledVector(fwd, 1.15).addScaledVector(right, (j / 9 - 0.5) * w * 0.86).setY(by + 1.05), Q, S.set(0.26, 0.22, 0.26), pick(FLOWER));
      stringLights(bp.clone().addScaledVector(fwd, 1.0).addScaledVector(right, -w / 2).setY(by + 1.15), bp.clone().addScaledVector(fwd, 1.0).addScaledVector(right, w / 2).setY(by + 1.15), 0.35, 0.6);
      for (const s of [-1, 1]) push(inst.box, bp.clone().addScaledVector(right, s * (w / 2 - 0.2)).addScaledVector(fwd, 0.9).setY(by - 0.8), q, S.set(0.2, 1.6, 0.2), col('#5a3a20'));
    }
    stringLights(p.clone().addScaledVector(fwd, 1.2).addScaledVector(right, -w / 2 - 0.5).setY(top - 0.2), p.clone().addScaledVector(fwd, 1.2).addScaledVector(right, w / 2 + 0.5).setY(top - 0.2), 0.25, 0.7);
    // hanging baskets of flowers
    for (const s of [-0.4, 0.4]) { const hp = p.clone().addScaledVector(fwd, 0.5).addScaledVector(right, s * w).setY(y + 3.2); push(inst.blob, hp, Q, S.set(0.45, 0.4, 0.45), col('#2a6a24')); for (let j = 0; j < 5; j++) push(inst.sphere, hp.clone().add(V3(rr(-0.4, 0.4), rr(-0.3, 0.2), rr(-0.4, 0.4))), Q, S.set(0.14, 0.14, 0.14), pick(FLOWER)); }
    take(back.x, back.z, Math.max(w, dpt) * 0.6);
    return { front: p.clone().setY(top - 0.2), right, w };
  }

  /* ---------------- El pueblito: chalets up both sides, string lights zigzagging across, the stone wall and the letters ---------------- */
  const puffs = [];
  {
    take(MAP.letters.wall[0], MAP.letters.wall[1], 12);
    for (const side of [-1, 1]) {
      let acc = 6;
      for (let i = 0; i < NR; i++) {
        if (SEG[i] !== 'p') { acc = 6; continue; }
        acc += STEP; if (acc < 13) continue;
        const f = roadFrame(i), w = rr(10, 13), dpt = rr(9, 11), off = lateralHW(i, side) + 2.4, p = roadAt(i, side * off, 0);
        // the low (south, +z) side of the strip is the stone wall with the view; only a few chalets there
        if (side > 0 && rand() < 0.7) continue;
        const back = p.clone().addScaledVector(f.n, side * dpt);
        if (!freeOf(p.x, p.z, 1.4) || !freeOf(back.x, back.z, 1.4) || !clearSpot(back.x, back.z, Math.max(w, dpt) * 0.5)) continue;
        { let ok = true; for (const o of [-w / 2, w / 2]) { const c = p.clone().addScaledVector(f.t, o); if (!freeOf(c.x, c.z, 1.2)) ok = false; } if (!ok) continue; }
        acc = 13 - w - rr(0.5, 1.5);
        chalet(p, yawOf(f.n.clone().multiplyScalar(-side)), w, dpt, rand() < 0.8 ? 2 : 1);
      }
    }
    // string lights zigzag across the street, eave to eave
    let k = 0;
    for (let i = 0; i < NR; i++) {
      if (SEG[i] !== 'p') continue; if (i % Math.round(MAP.strip.stringEvery / STEP)) continue;
      const a = roadAt(i, -(hwL[i] + 2.6), 7.2), b = roadAt(i + Math.round(6 / STEP), hwR[i] + 2.6, 6.8);
      if (k++ % 2) stringLights(a, b, 1.0, 0.7, ['#ffd890', '#ff6a6a', '#8affb0', '#8ab8ff', '#ffe060'], 0.9); else stringLights(b, a, 1.0, 0.7, BULBS, 0.8);
      for (const e of [a, b]) beams.wood.push(placeBeam(e.clone().setY(groundH(e.x, e.z) - 0.2), e.clone().setY(e.y + 0.2), 0.18, 0.18));
    }
    // the stone wall along the low side, people in jackets behind it, iron lamps
    let prev = null;
    for (let i = 0; i < NR; i += 2) {
      if (SEG[i] !== 'p' && SEG[i] !== 'm') { prev = null; continue; }
      const top = roadAt(i, hwR[i] + 1.0, 0.9);
      if (prev && prev.distanceTo(top) < 3) beams.stone.push(placeBeam(V3(prev.x, prev.y - 0.6, prev.z), V3(top.x, top.y - 0.6, top.z), 0.9, 1.4));
      prev = top;
    }
    for (let i = 0; i < NR; i += Math.round(26 / STEP)) {
      if (SEG[i] !== 'p') continue;
      for (const side of [-1, 1]) { const lp = roadAt(i + (side > 0 ? 40 : 0), side * (lateralHW(i, side) + 1.2), 0); lp.y = groundH(lp.x, lp.z); push(inst.cyl, lp, Q, S.set(0.1, 4.0, 0.1), col('#141414')); const head = lp.clone().setY(lp.y + 4.2); push(inst.lamp, head, Q, S.set(0.45, 0.6, 0.45), col('#ffe0a0')); addGlow(head, '#ffc070', 1.3); addPool(lp.clone().setY(lp.y + 0.2), 8, '#ffb060', 0.9); }
    }
    const SH = ['#3a3a40', '#a83a3a', '#2a4a8a', '#e8e0d0', '#8a6a3a', '#2a6a4a', '#c8b8a0'].map(col);
    tries(MAP.zones.crowd, () => {
      const i = Math.floor(rand() * NR); if (SEG[i] !== 'p') return false;
      const pp = roadAt(i, hwR[i] + rr(2.4, 4.5), 0); pp.y = groundH(pp.x, pp.z); const s = rr(0.9, 1.1), yaw = yawOf(roadFrame(i).n.clone().negate()) + rr(-0.6, 0.6);
      push(inst.crowdBody, pp.clone().setY(pp.y + 0.85 * s), qYaw(yaw), S.set(0.55 * s, 0.85 * s, 0.5 * s), pick(SH));
      push(inst.crowdHead, pp.clone().setY(pp.y + 1.85 * s), qYaw(yaw), S.set(0.32 * s, 0.3 * s, 0.44 * s), col('#9a6a3e'));
      if (rand() < 0.6) puffs.push({ p: pp.clone().setY(pp.y + 1.9 * s).add(V3(Math.sin(yaw) * 0.45, 0, Math.cos(yaw) * 0.45)), dir: V3(Math.sin(yaw), 0, Math.cos(yaw)), ph: rand() * 4 });
      return true;
    });
    // YO (heart) GALIPÁN on the stone wall
    const [wx, wz] = MAP.letters.wall, i = idxNear(wx, wz), f = roadFrame(i), base = roadAt(i, hwR[i] + 2.4, 0); base.y = groundH(base.x, base.z);
    const g = new THREE.Group(); g.position.copy(base); g.rotation.y = yawOf(f.n.clone().negate()); scene.add(g);
    const stone = new THREE.Mesh(new THREE.BoxGeometry(14, 1.6, 2.4), new THREE.MeshStandardMaterial({ color: col('#8a847a'), roughness: 0.95 })); stone.position.y = 0.8; stone.castShadow = true; g.add(stone);
    const lt = letterTex(MAP.letters.text, 'bold 120px sans-serif', '#e8304a');
    for (let k2 = 0; k2 < 4; k2++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.4), new THREE.MeshStandardMaterial({ map: lt, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, color: col(k2 ? '#aaaaaa' : '#ffffff'), emissive: col('#ffffff'), emissiveMap: lt, emissiveIntensity: k2 ? 0.05 : 0.6 })); m.position.set(0, 2.8, 0.6 - k2 * 0.1); g.add(m); }
    addGlow(base.clone().addScaledVector(f.n, 1).add(V3(0, 0.3, 0)), '#fff0d0', 1.2);
    pointLight(base.clone().setY(base.y + 5), '#ffcf90', 1.5, 30);
    pointLight(roadAt(idxNear(-60, -204), 0, 7), '#ffbf78', 1.4, 40);
    pointLight(roadAt(idxNear(40, -200), 0, 7), '#ffbf78', 1.4, 40);
    // Carreritas's shared startLine owns the finish stripe and gantry. The
    // reference's light banner hangs over the strip a little further on.
    const ib = Math.round(36 / STEP), fb = roadFrame(ib), qb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fb.n, UP, fb.t.clone().negate()));
    const bA = roadAt(ib, -hwL[ib] - 1.5, 0), bB = roadAt(ib, hwR[ib] + 1.5, 0);
    for (const e of [bA, bB]) { e.y = groundH(e.x, e.z); beams.wood.push(placeBeam(e.clone().setY(e.y - 0.3), e.clone().setY(roadY[ib] + 7.5), 0.35, 0.35)); }
    beams.wood.push(placeBeam(bA.clone().setY(roadY[ib] + 7.4), bB.clone().setY(roadY[ib] + 7.4), 0.3, 0.5));
    const bannerTex = canvasTex(1024, 160, (c, w, h) => { c.fillStyle = '#2a1608'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffc23a'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16); c.font = 'bold 86px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffd25a'; c.fillText('PANA GALIPÁN', w / 2, h / 2 + 4); });
    const bm = new THREE.MeshStandardMaterial({ map: bannerTex, emissiveMap: bannerTex, emissive: col('#ffffff'), emissiveIntensity: 0.9 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(14, 2.2, 0.3), bm); banner.position.copy(roadAt(ib, 0, 6.6)); banner.quaternion.copy(qb); scene.add(banner);
    stringLights(bA.clone().setY(roadY[ib] + 7.6), bB.clone().setY(roadY[ib] + 7.6), 0.2, 0.6, ['#ffd890', '#ff6a6a', '#8affb0', '#8ab8ff', '#ffe060'], 1);
  }

  /* ---------------- El mirador: a low stone wall on the edge, a big native tree, lamps ---------------- */
  {
    let prev = null;
    for (let i = 0; i < NR; i += 2) {
      if (SEG[i] !== 'm' && !(SEG[i] === 'g')) { prev = null; continue; }
      const side = SEG[i] === 'm' ? -1 : 1;
      const lat = side * (lateralHW(i, side) + 0.9), top = roadAt(i, lat, 0.75);
      if (prev && prev.distanceTo(top) < 3) beams.stone.push(placeBeam(V3(prev.x, prev.y - 0.5, prev.z), V3(top.x, top.y - 0.5, top.z), 0.8, 1.0));
      prev = top;
    }
    for (let i = 0; i < NR; i += Math.round(30 / STEP)) { if (SEG[i] !== 'm') continue; const lp = roadAt(i, hwR[i] + 1.4, 0); lp.y = groundH(lp.x, lp.z); push(inst.cyl, lp, Q, S.set(0.1, 4.2, 0.1), col('#141414')); const h = lp.clone().setY(lp.y + 4.3); push(inst.lamp, h, Q, S.set(0.45, 0.6, 0.45), col('#ffe0a0')); addGlow(h, '#ffc070', 1.3); addPool(lp.clone().setY(lp.y + 0.2), 8, '#ffb060', 0.8); }
    // the old tree that frames the view, lanterns hung under its crown
    const [mx, mz] = MAP.mirador.at, my = groundH(mx, mz);
    vegetation.add('tree', mx, mz, my, 1.5, Math.max(roadGap(mx, mz), 23));
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; addGlow(V3(mx + Math.cos(a) * 4, my + 5 + rr(-0.5, 0.8), mz + Math.sin(a) * 4), '#ffcf80', 1.1); }
    take(mx, mz, 8);
    pointLight(V3(mx - 20, my + 5, mz), '#ffbf78', 1.2, 40);
  }

  /* ---------------- Boca de Tigre: the big white letters on an island, the sunflower arch with two tigers, craft stalls ---------------- */
  const sunflower = (p, normal, s = 1) => {
    const q = new THREE.Quaternion().setFromUnitVectors(UP, normal.clone().normalize());
    push(inst.petal, p, q, S.set(0.42 * s, 0.05, 0.42 * s), col('#ffcc1a').offsetHSL(rr(-0.02, 0.01), 0, rr(-0.05, 0.03)));
    push(inst.seed, p.clone().addScaledVector(normal, 0.04), q, S.set(0.18 * s, 0.05, 0.18 * s), col('#4a2a10'));
  };
  const tigerTex = canvasTex(256, 192, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#ff8a3a';
    c.beginPath(); c.ellipse(120, 110, 80, 42, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(205, 76, 38, 34, 0, 0, TAU); c.fill();
    for (const x of [70, 100, 150, 170]) c.fillRect(x - 9, 130, 18, 55);
    c.strokeStyle = '#ff8a3a'; c.lineWidth = 12; c.beginPath(); c.moveTo(45, 100); c.quadraticCurveTo(10, 60, 22, 30); c.stroke();
    c.fillStyle = '#fff2e0'; c.beginPath(); c.ellipse(215, 90, 18, 14, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(120, 140, 50, 10, 0, 0, TAU); c.fill();
    c.fillStyle = '#1a1210'; for (let k = 0; k < 8; k++) { const x = 60 + k * 18; c.beginPath(); c.moveTo(x, 72); c.lineTo(x + 6, 72); c.lineTo(x + 2, 115); c.fill(); }
    for (const [x, y] of [[200, 50], [215, 52], [225, 60]]) c.fillRect(x, y, 4, 14);
    c.beginPath(); c.arc(214, 70, 4, 0, TAU); c.arc(228, 72, 4, 0, TAU); c.fill(); c.fillStyle = '#ff8a3a'; c.beginPath(); c.arc(190, 46, 10, 0, TAU); c.arc(222, 44, 10, 0, TAU); c.fill();
  });
  {
    const B = MAP.bocaDeTigre, [cx, cz] = B.center, y = PADS[0].y;
    // the island inside the loop: grass, trees, and the big white letters
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.6, 40), new THREE.MeshStandardMaterial({ color: col('#3a6a2a'), roughness: 1 })); isl.position.set(cx + 2, y, cz + 4); isl.receiveShadow = true; scene.add(isl);
    const lt = letterTex(B.letters, 'bold 150px sans-serif', '#ffffff');
    const g = new THREE.Group(); g.position.set(cx + 2, y + 0.3, cz + 4); g.rotation.y = 0.5; scene.add(g);
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.4), new THREE.MeshStandardMaterial({ map: lt, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, color: col(k ? '#bdbdbd' : '#ffffff'), emissive: col('#fff4e0'), emissiveMap: lt, emissiveIntensity: k ? 0.05 : 0.5 })); m.position.set(0, 1.9, 0.4 - k * 0.16); m.castShadow = true; g.add(m); }
    const base = new THREE.Mesh(new THREE.BoxGeometry(17, 0.6, 1.6), new THREE.MeshStandardMaterial({ color: col('#c8405a'), roughness: 0.9 })); base.position.y = 0.3; g.add(base);
    for (const s of [-1, 1]) addGlow(V3(cx + 2 + Math.cos(0.5) * s * 4, y + 0.5, cz + 4 - Math.sin(0.5) * s * 4).add(V3(Math.sin(0.5) * 3, 0, Math.cos(0.5) * 3)), '#fff0d0', 2.2);
    pointLight(V3(cx + 6, y + 6, cz + 12), '#ffd8a0', 1.6, 36);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.6; cloudTree(cx + 2 + Math.cos(a) * 9, cz + 4 + Math.sin(a) * 9, false); }
    take(cx, cz, 16);
    // the sunflower arch with a tiger on each side
    const [ax, az] = B.arch, ai = idxNear(ax, az), af = roadFrame(ai), side = 1, ap = roadAt(ai, side * (hwR[ai] + 4), 0); ap.y = groundH(ap.x, ap.z);
    const yaw = yawOf(af.n.clone().multiplyScalar(-side)), right = V3(Math.cos(yaw), 0, -Math.sin(yaw)), fwd = V3(Math.sin(yaw), 0, Math.cos(yaw));
    for (const s of [-1, 1]) beams.wood.push(placeBeam(ap.clone().addScaledVector(right, s * 1.8).setY(ap.y - 0.2), ap.clone().addScaledVector(right, s * 1.8).setY(ap.y + 3.2), 0.3, 0.3));
    beams.wood.push(placeBeam(ap.clone().addScaledVector(right, -2.2).setY(ap.y + 3.2), ap.clone().addScaledVector(right, 2.2).setY(ap.y + 3.2), 0.3, 0.35));
    for (let k = 0; k < 22; k++) { const t = k / 21, p = t < 0.33 ? ap.clone().addScaledVector(right, -1.8).setY(ap.y + t * 3 * 3.2) : t < 0.67 ? ap.clone().addScaledVector(right, -1.8 + (t - 0.33) * 3 * 3.6).setY(ap.y + 3.3) : ap.clone().addScaledVector(right, 1.8).setY(ap.y + (1 - t) * 3 * 3.2); sunflower(p.addScaledVector(fwd, 0.2), fwd, 1.1); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshStandardMaterial({ map: textBoard(512, 128, '#2a1a10', (c, w, h) => { c.fillStyle = '#fff2d0'; c.font = 'bold 60px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Boca de Tigre', w / 2, h / 2); }), emissive: col('#ffffff'), emissiveIntensity: 0.25 }));
    sign.material.emissiveMap = sign.material.map;
    sign.position.copy(ap).setY(ap.y + 2.6).addScaledVector(fwd, 0.2); sign.rotation.y = yaw; scene.add(sign);
    for (const s of [-1, 1]) {
      const tp = ap.clone().addScaledVector(right, s * 3.4);
      const tm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.95), new THREE.MeshStandardMaterial({ map: tigerTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, emissive: col('#ffffff'), emissiveMap: tigerTex, emissiveIntensity: 0.2 }));
      tm.position.copy(tp).setY(tp.y + 1.25); tm.rotation.y = yaw + (s > 0 ? PI / 2 + 0.3 : -PI / 2 - 0.3); tm.castShadow = true; scene.add(tm);
      push(inst.box, tp.clone().setY(tp.y + 0.15), qYaw(yaw), S.set(1.4, 0.3, 1.0), col('#8a847a'));
    }
    addGlow(ap.clone().setY(ap.y + 3.6).addScaledVector(fwd, 0.5), '#fff0c0', 1.8); addPool(ap.clone().setY(ap.y + 0.2).addScaledVector(fwd, 1), 6, '#ffc070', 1);
    take(ap.x, ap.z, 5);
    // craft stalls closing for the night, a lamp each
    let n = 0;
    for (let i = 0; i < NR && n < B.stalls; i += Math.round(12 / STEP)) {
      if (SEG[i] !== 'q') continue;
      const f = roadFrame(i), p = roadAt(i, hwR[i] + 3.2, 0); p.y = groundH(p.x, p.z); if (!clearSpot(p.x, p.z, 2.5) || !freeOf(p.x, p.z, 1.6)) continue; take(p.x, p.z, 3); n++;
      const yw = yawOf(f.n.clone().negate());
      push(inst.box, p.clone().setY(p.y + 0.5), qYaw(yw), S.set(2.6, 1.0, 1.2), col(pick(['#a86a3a', '#8a5430'])));
      for (const sx of [-1.2, 1.2]) for (const sz of [-0.55, 0.55]) push(inst.box, p.clone().add(V3(Math.cos(yw) * sx + Math.sin(yw) * sz, 1.6, -Math.sin(yw) * sx + Math.cos(yw) * sz)), qYaw(yw), S.set(0.08, 2.2, 0.08), col('#5a3a20'));
      push(inst.roof, p.clone().setY(p.y + 2.7), qYaw(yw + PI / 2), S.set(1.8, 0.7, 3.0), col(pick(['#e0402b', '#2a8a4a', '#2a6ad0'])));
      for (let k = 0; k < 6; k++) push(inst.sphere, p.clone().add(V3(rr(-1, 1), 1.1, rr(-0.4, 0.4))), Q, S.set(0.15, 0.15, 0.15), pick([col('#e8462e'), col('#ffd21f'), col('#3d7bf2'), col('#2a9b5a')]));
      const lp = p.clone().setY(p.y + 2.2); push(inst.lamp, lp, Q, S.set(0.25, 0.3, 0.25), col('#ffe0a0')); addGlow(lp, '#ffc070', 1.2); addPool(p.clone().setY(p.y + 0.2), 4, '#ffb060', 1);
    }
  }

  /* ---------------- La casa de los girasoles: a terrace of sunflowers and fairy lights, an arch and a swing on the edge ---------------- */
  let swing = null;
  {
    const SFH = MAP.sunflowerHouse;
    // sunflowers in beds along the outer (drop) side of the terrace road, fairy lights strung along the rail
    for (let i = 0; i < NR; i += 3) {
      if (SEG[i] !== SFH.seg) continue;
      const f = roadFrame(i);
      for (let k = 0; k < 2; k++) {
        const p = roadAt(i, hwR[i] + 1.8 + k * 0.7 + rr(-0.2, 0.2), 0); p.y = groundH(p.x, p.z);
        const h = rr(1.4, 2.2); push(inst.stem, p, Q, S.set(0.04, h, 0.04), col('#3a7a24'));
        sunflower(p.clone().setY(p.y + h), f.n.clone().multiplyScalar(-1).add(V3(0, 0.4, 0)), rr(0.8, 1.1));
      }
      if (i % 9 === 0) { const a = roadAt(i, hwR[i] + 1.1, 1.35), b = roadAt(i + 9, hwR[(i + 9) % NR] + 1.1, 1.35); stringLights(a, b, 0.25, 0.55, ['#fff4d8', '#ffe8a0', '#ffd890'], 0.85); }
      if (i % 120 === 0) { const lp = roadAt(i, -hwL[i] - 1.4, 0); lp.y = groundH(lp.x, lp.z); push(inst.cyl, lp, Q, S.set(0.1, 4, 0.1), col('#141414')); const h = lp.clone().setY(lp.y + 4.1); push(inst.lamp, h, Q, S.set(0.45, 0.6, 0.45), col('#ffe0a0')); addGlow(h, '#ffc070', 1.3); addPool(lp.clone().setY(lp.y + 0.2), 8, '#ffb060', 0.8); }
    }
    // the sunflower house: a little white house with a tile roof, fairy lights on the eaves
    const [hx, hz] = SFH.house, hy = groundH(hx, hz) - 0.3;
    push(inst.boxLit, V3(hx, hy + 2, hz), qYaw(0.3), S.set(8, 4, 6), col('#f4ece0')); push(inst.roof, V3(hx, hy + 4, hz), qYaw(0.3 + PI / 2), S.set(7.2, 2.4, 9), col('#b84a30'));
    push(inst.lamp, V3(hx + Math.sin(0.3) * 3.05, hy + 1.6, hz + Math.cos(0.3) * 3.05), qYaw(0.3), S.set(1.4, 1.4, 0.1), col('#ffcf88'));
    take(hx, hz, 7);
    // the arch and the swing at the very edge
    const [sx, sz] = SFH.swing, sy = groundH(sx, sz);
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 0.5, 30), new THREE.MeshStandardMaterial({ color: col('#9a9a94'), roughness: 0.95 })); deck.position.set(sx, sy, sz); scene.add(deck);
    const arcPts = []; for (let k = 0; k <= 30; k++) { const a = k / 30 * PI; arcPts.push(V3(sx + Math.cos(a) * 2.6, sy + Math.sin(a) * 3.6, sz)); }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts), 30, 0.12, 6), new THREE.MeshStandardMaterial({ color: col('#2a5a2a') })));
    arcPts.forEach((p, k) => { sunflower(p.clone(), V3(0, 0, -1), 1.15); if (k % 3 === 0) addGlow(p.clone().add(V3(0, 0, 0.3)), '#fff0c0', 0.8); });
    swing = new THREE.Group(); swing.position.set(sx, sy + 3.5, sz); scene.add(swing);
    const rope = new THREE.MeshStandardMaterial({ color: col('#d8c8a0') });
    for (const o of [-0.7, 0.7]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 4), rope); r.position.set(o, -1.3, 0); swing.add(r); }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: col('#c8a46a') })); seat.position.y = -2.6; swing.add(seat);
    const petals = new THREE.MeshStandardMaterial({ color: col('#ffcc1a') }), petalGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10);
    for (let k = 0; k < 8; k++) { const fl = new THREE.Mesh(petalGeo, petals); fl.rotation.x = PI / 2; fl.position.set(-0.8 + k * 0.23, -2.5, -0.32); swing.add(fl); }
    pointLight(V3(sx, sy + 4, sz - 4), '#ffd890', 1.3, 26);
    take(sx, sz, 6);
  }

  /* ---------------- the cable car over the ridge: towers, two cables and lit cabins ---------------- */
  const cabins = [];
  const CB = MAP.cable, cA = V3(...CB.from), cB = V3(...CB.to), cDir = cB.clone().sub(cA); cDir.normalize();
  const cSide = V3(-cDir.z, 0, cDir.x).normalize();
  const cableY = (t, off) => { const p = cA.clone().lerp(cB, t).addScaledVector(cSide, off); const seg = CB.towers.concat([1]); let t0 = 0; for (const t1 of seg) { if (t <= t1) { const u = (t - t0) / (t1 - t0); p.y -= 10 * 4 * u * (1 - u); break; } t0 = t1; } return p; };
  const DARK = new THREE.MeshStandardMaterial({ color: col('#1a1a1e'), roughness: 0.6, metalness: 0.4 });
  {
    const pts = [];
    for (const off of [-3, 3]) for (let k = 0; k < 120; k++) pts.push(cableY(k / 120, off), cableY((k + 1) / 120, off));
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col('#8a90a0') })));
    for (const t of [0, ...CB.towers, 1]) {
      const p = cA.clone().lerp(cB, t), g = groundH(p.x, p.z);
      for (const off of [-3.5, 3.5]) beams.iron.push(placeBeam(p.clone().addScaledVector(cSide, off * 0.4).setY(g - 1), p.clone().addScaledVector(cSide, off).setY(p.y + 1), 0.8, 0.8));
      beams.iron.push(placeBeam(p.clone().addScaledVector(cSide, -4.5).setY(p.y + 1), p.clone().addScaledVector(cSide, 4.5).setY(p.y + 1), 0.7, 0.9));
      addGlow(p.clone().setY(p.y + 2.5), '#ff3020', 2);
      if (t === 0 || t === 1) push(inst.boxLit, p.clone().setY(g + 6), qYaw(yawOf(cDir)), S.set(16, 12, 14), col('#6a6a72'));
    }
    const cm = new THREE.MeshStandardMaterial({ color: col('#e03838'), roughness: 0.5 }), wm = new THREE.MeshStandardMaterial({ color: col('#ffe0a0'), emissive: col('#ffd890'), emissiveIntensity: 1.8 });
    const glowMat = new THREE.SpriteMaterial({ map: glowTex, color: col('#ffd890'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
    const bodyGeo = new THREE.BoxGeometry(2.6, 2.4, 2.6), winGeo = new THREE.BoxGeometry(2.7, 0.9, 2.7), armGeo = new THREE.BoxGeometry(0.15, 2.6, 0.15);
    for (let k = 0; k < CB.cabins; k++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(bodyGeo, cm));
      const win = new THREE.Mesh(winGeo, wm); win.position.y = 0.3; g.add(win);
      const arm = new THREE.Mesh(armGeo, DARK); arm.position.y = 2.5; g.add(arm);
      const gl = new THREE.Sprite(glowMat); gl.scale.set(9, 9, 1); g.add(gl);
      scene.add(g); cabins.push({ g, ph: k / CB.cabins, off: k % 2 ? 3 : -3, dir: k % 2 ? -1 : 1 });
    }
  }

  /* ---------------- el cañón: jagged rock walls either side of the cut down to the lip ---------------- */
  {
    const ROCK = ['#6e5a48', '#7d6652', '#5b4a3c', '#86705a'], e = new THREE.Euler();
    for (let i = 0; i < NR; i += 2) {
      if (SEG[i] !== 'c') continue;
      for (const side of [-1, 1]) {
        const p = roadAt(i, side * (lateralHW(i, side) + rr(2.2, 4)), 0), tall = rr(9, 16);
        p.y = roadY[i] - 1 + tall * 0.45;
        push(inst.blob, p, new THREE.Quaternion().setFromEuler(e.set(rr(-0.2, 0.2), rand() * TAU, rr(-0.15, 0.15))), S.set(rr(2.6, 4.2), tall * 0.55, rr(2.6, 4.2)), col(pick(ROCK)));
      }
    }
  }

  /* ---------------- the mountain road: reflector posts and street lamps keep the line readable ---------------- */
  {
    const MTN = { b: 1, s: 1, g: 1, m: 1, q: 1, c: 1 };
    for (const side of [-1, 1]) for (let i = 0; i < NR; i += 6) {
      if (!MTN[SEG[i]]) continue;
      const f = roadFrame(i), p = roadAt(i, side * (lateralHW(i, side) + 0.8), 0); p.y = Math.min(p.y, groundH(p.x, p.z));
      push(inst.post, p, qYaw(yawOf(f.t)), S.set(0.16, 1.1, 0.16), col('#e8e8e4'));
      push(inst.reflector, p.clone().setY(p.y + 0.9).addScaledVector(f.n, -side * 0.09), qYaw(yawOf(f.n)), S.set(0.13, 0.22, 0.04), col(side > 0 ? '#ff6a1a' : '#ffffff'));
    }
    let acc = 0, ls = 1;
    for (let i = 0; i < NR; i++) {
      if (SEG[i] !== 'b' && SEG[i] !== 's') continue; acc += STEP; if (acc < 40) continue; acc = 0; ls = -ls;
      const f = roadFrame(i), b0 = roadAt(i, ls * (lateralHW(i, ls) + 1.4), 0); b0.y = groundH(b0.x, b0.z);
      const top = b0.clone().setY(roadY[i] + 7), arm = top.clone().addScaledVector(f.n, -ls * 2.2);
      beams.iron.push(placeBeam(b0.clone().setY(b0.y - 0.2), top, 0.18, 0.18)); beams.iron.push(placeBeam(top, arm, 0.12, 0.12));
      const lp = arm.clone().setY(arm.y - 0.2); push(inst.lamp, lp, qYaw(yawOf(f.n)), S.set(0.4, 0.15, 0.9), col('#ffe8c0'));
      // A flat pool would lie across the grade; the lamp's glow and the faint road twin carry it.
      addGlow(lp, '#ffd8a0', 1.6);
    }
  }

  /* ---------------- vegetation: cloud forest of ceibas, mangos and pines ---------------- */
  {
    const Z = MAP.zones;
    tries(Z.forest, () => {
      const x = rr(X0 + 4, X0 + SIZE - 4), z = rr(Z0 + 4, Z0 + SIZE - 4); if (!freeOf(x, z, 7) || !clearSpot(x, z, 3)) return false;
      if (edgeOf(x, z) > 30) return false;
      { const r = sampleR(RR, x, z); if (r.i >= 0 && (SEG[r.i] === 'g' || SEG[r.i] === 'm') && r.dist < 30) return false; }
      rand() < 0.3 ? pine(x, z, rr(0.85, 1.15)) : cloudTree(x, z, rand() < 0.5); return true;
    });
    for (let i = 0; i < NR; i += 5) { if (SEG[i] !== 'b' && SEG[i] !== 's') continue; for (const side of [-1, 1]) { if (rand() < 0.4) continue; const p = roadAt(i, side * (lateralHW(i, side) + rr(5, 10)), 0); if (!freeOf(p.x, p.z, 4) || !clearSpot(p.x, p.z, 2)) continue; rand() < 0.3 ? pine(p.x, p.z) : cloudTree(p.x, p.z, rand() < 0.4); } }
    tries(Z.ferns, () => { const x = rr(X0 + 4, X0 + SIZE - 4), z = rr(Z0 + 4, Z0 + SIZE - 4); if (!freeOf(x, z, 1.5) || !clearSpot(x, z, 1) || edgeOf(x, z) > 10) return false; fern(x, z, rr(0.8, 1.5)); return true; });
    for (let i = 0; i < NR; i += 4) { if (SEG[i] !== 'b' && SEG[i] !== 's' && SEG[i] !== 'm') continue; const side = rand() < 0.5 ? -1 : 1, p = roadAt(i, side * (lateralHW(i, side) + rr(1.6, 3.5)), 0); if (freeOf(p.x, p.z, 1.2) && clearSpot(p.x, p.z, 0.8)) fern(p.x, p.z, rr(0.7, 1.2)); }
    // the dark forest on the far mountains, down the drop and along the crest
    tries(2600, () => { const x = rr(-1400, 1400), z = rr(-1400, 1000); if (inArea(x, z, 20)) return false; const y = farH(x, z); if (y < CITY.y + 40) return false; vegetation.add(rand() < 0.3 ? 'fir' : 'tree', x, z, y, rr(1, 1.4), 100); return true; });
  }

  /* ---------------- mist in the cloud forest, breath puffs on the strip ---------------- */
  const mist = [];
  {
    for (let k = 0, guard = 0; k < MAP.zones.mist && guard < 5000; guard++) {
      const i = Math.floor(rand() * NR); if (SEG[i] !== 'b' && SEG[i] !== 's') continue;
      const lat = rr(14, 34) * (rand() < 0.5 ? -1 : 1), p = roadAt(i, lat, rr(3, 12));
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: col('#9aa4c8'), transparent: true, opacity: 0.18, depthWrite: false })); s.position.copy(p); const sc = rr(20, 45); s.scale.set(sc, sc * 0.45, 1); s.userData = { y0: p.y, ph: rand() * TAU }; scene.add(s); mist.push(s); k++;
    }
  }
  const puffSprites = puffs.map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: col('#e8ecf4'), transparent: true, opacity: 0.4, depthWrite: false })); scene.add(s); return s; });

  /* ---------------- flush instances, glows and pools ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; scene.add(im); return im;
  }
  flush(inst.blob, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }), false);
  { const g = new THREE.PlaneGeometry(1, 1, 1, 3); g.rotateX(-PI / 2); g.translate(0, 0, 0.5); flush(inst.fern, g, windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, side: THREE.DoubleSide }), 0.02, 0.1), false); }
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }));
  flush(inst.boxLit, new THREE.BoxGeometry(1, 1, 1), selfLit(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85 }), 0.12, 'chalet'));
  flush(inst.lamp, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), emissive: col('#ffc87a'), emissiveIntensity: 2.2 }), false);
  { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); flush(inst.roof, g, selfLit(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, side: THREE.DoubleSide }), 0.08, 'roof')); }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, metalness: 0.3 })); flush(inst.stem, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false); }
  flush(inst.sphere, new THREE.SphereGeometry(1, 10, 8), selfLit(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7 }), 0.2, 'flowers'), false);
  flush(inst.petal, new THREE.CylinderGeometry(1, 1, 1, 12), selfLit(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7 }), 0.28, 'petal'), false);
  flush(inst.seed, new THREE.CylinderGeometry(1, 1, 1, 10), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9 }), false);
  flush(inst.crowdBody, new THREE.SphereGeometry(1, 10, 8), selfLit(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), 0.15, 'crowd'), false);
  flush(inst.crowdHead, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false);
  flush(inst.post, (() => { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g; })(), selfLit(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 }), 0.15, 'post'));
  {
    const RM = new THREE.MeshStandardMaterial({ color: col('#ffffff'), emissive: col('#ffffff'), emissiveIntensity: 2.4, roughness: 0.3 });
    RM.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance *= vColor.rgb;\n#endif'); };
    RM.customProgramCacheKey = () => 'galipan-reflector-r186';
    flush(inst.reflector, new THREE.BoxGeometry(1, 1, 1), RM, false);
  }
  {
    const mats = { iron: new THREE.MeshStandardMaterial({ color: col('#4a4c52'), metalness: 0.5, roughness: 0.5 }), wood: new THREE.MeshStandardMaterial({ color: col('#6a4428'), roughness: 0.9 }), stone: new THREE.MeshStandardMaterial({ color: col('#8a8478'), roughness: 0.95, emissive: col('#ffb070'), emissiveIntensity: 0.06 }) };
    const bg = new THREE.BoxGeometry(1, 1, 1);
    for (const [k, list] of Object.entries(beams)) if (list.length) { const im = new THREE.InstancedMesh(bg, mats[k], list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  }
  {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(glows, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(glowCols, 3));
    const bulbs = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    bulbs.name = 'galipan-bulbs'; scene.add(bulbs);
    const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-PI / 2);
    const pm = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6 });
    const im = new THREE.InstancedMesh(pg, pm, pools.length); pools.forEach((p, i) => { im.setMatrixAt(i, mat4(p.p.x, p.p.y, p.p.z, 0, p.r * 2, 1)); im.setColorAt(i, p.c); }); im.renderOrder = 3; im.raycast = () => {}; im.name = 'galipan-light-pools'; scene.add(im);
  }

  /* ---------------- per-frame updates ---------------- */
  function update(t) {
    uTime.value = t;
    cityClouds.forEach(s => { s.position.x = s.userData.x0 + ((t * s.userData.sp) % 1200) - 600; });
    mist.forEach(s => { s.position.y = s.userData.y0 + Math.sin(t * 0.25 + s.userData.ph) * 1.5; s.material.opacity = 0.07 + 0.05 * Math.sin(t * 0.15 + s.userData.ph); });
    puffs.forEach((P, k) => { const s = puffSprites[k], u = ((t + P.ph) % 4) / 4; s.position.copy(P.p).addScaledVector(P.dir, u * 0.7).add(V3(0, u * 0.5, 0)); const sc = 0.2 + u * 0.7; s.scale.set(sc, sc, 1); s.material.opacity = u < 0.35 ? 0.4 * (1 - u / 0.35) : 0; });
    if (swing) swing.rotation.x = Math.sin(t * 1.4) * 0.25;
    cabins.forEach(c => { const u = ((t / CB.period * c.dir + c.ph) % 1 + 1) % 1, p = cableY(u, c.off); c.g.position.set(p.x, p.y - 4.8, p.z); c.g.rotation.set(Math.sin(t * 0.8 + c.ph * 9) * 0.03, yawOf(cDir), 0); });
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
