import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { extendTerrain } from './world-horizon.js';
import { coastalVegetation } from './coastal-vegetation.js';
import { MAP, noise } from './margarita-layout.js';

// Isla Margarita: from the castle of Pampatar over the Santa Rosa hill to
// Playa El Agua, through the mangroves of La Restinga to Juan Griego bay.
export function createWorld(scene, layout, roadDistance, scale = 1) {
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

  const { SIZE, X0, Z0, NR, STEP, SEG, RR, hwL, hwR, roadY, bank, roadFrame, roadAt, lateralHW, idxNear, sampleR, inArea,
    shoreD, lagoonD, channels, CHR, LG, natural, terrainH, farH: originalFarH, groundH: originalGroundH, OPEN } = layout;
  const groundH = (x, z) => horizon?.heightAt(x, z) ?? originalGroundH(x, z);
  const SUN_DIR = new THREE.Vector3(0.3, 0.82, 0.38).normalize();

  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const roadTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#5c5c60'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 7000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(25,25,28,${rr(0.08, 0.22).toFixed(2)})` : `rgba(220,220,225,${rr(0.04, 0.12).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    c.fillStyle = 'rgba(245,245,240,0.95)'; c.fillRect(w * 0.04, 0, 7, h); c.fillRect(w * 0.96 - 7, 0, 7, h);
    c.fillStyle = 'rgba(255,210,40,0.95)'; for (let y = 0; y < h; y += 128) c.fillRect(w / 2 - 4, y, 8, 64);
  });
  const stoneTex = (base, light, dark) => canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    c.strokeStyle = dark; c.lineWidth = 2;
    for (let y = 0; y < h; y += 32) for (let x = -((y / 32) % 2) * 32; x < w; x += 64) { c.fillStyle = rand() < 0.5 ? light : base; c.globalAlpha = rr(0.5, 1); c.fillRect(x + 2, y + 2, 60, 28); c.globalAlpha = 0.6; c.strokeRect(x + 1, y + 1, 62, 30); }
    c.globalAlpha = 1;
    for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(80,50,30,${rr(0.05, 0.2).toFixed(2)})`; c.beginPath(); c.ellipse(rand() * w, rand() * h, rr(6, 30), rr(4, 16), 0, 0, TAU); c.fill(); }
  });
  const grassTex = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rr(8, w - 8), lean = rr(-18, 18), top = rr(10, 60); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - 4, h); c.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); c.lineTo(x + 4, h); c.fill(); } });
  const cloudTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const textBoard = (w, h, bg, draw) => canvasTex(w, h, c => { c.fillStyle = bg; c.fillRect(0, 0, w, h); draw(c, w, h); });
  const windowsTex = canvasTex(128, 256, (c, w, h) => { c.fillStyle = '#f4f2ec'; c.fillRect(0, 0, w, h); for (let y = 6; y < h; y += 16) { c.fillStyle = '#5a7890'; c.fillRect(6, y, w - 12, 8); c.fillStyle = '#e8e4da'; c.fillRect(0, y + 9, w, 3); } });

  // texture coordinates from world position, so long stone walls keep stones of the same size
  function worldTex(mat, size, key) {
    mat.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          mat4 wmx = modelMatrix * instanceMatrix;
        #else
          mat4 wmx = modelMatrix;
        #endif
        vec3 wpos = (wmx * vec4(position, 1.0)).xyz; vec3 wn = normalize(mat3(wmx) * normal);
        vec2 wuv = abs(wn.y) > 0.6 ? wpos.xz : (abs(wn.x) > abs(wn.z) ? wpos.zy : wpos.xy);
        vMapUv = wuv / ${size.toFixed(1)};`);
    };
    mat.customProgramCacheKey = () => 'worldTex' + key;
    return mat;
  }

  /* ---------------- wind sway ---------------- */
  function windy(mat, base, perY) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uTime * 1.4 + ip.x * 0.06 + ip.z * 0.045) * 0.6 + sin(uTime * 2.9 + ip.x * 0.17 - ip.z * 0.11) * 0.25;
        float k = ${base.toFixed(3)} + max(position.y, 0.0) * ${perY.toFixed(3)};
        transformed.x += sw * k; transformed.z += sw * k * 0.55;`);
    };
    mat.customProgramCacheKey = () => 'windy' + base + '_' + perY;
    return mat;
  }

  /* ---------------- terrain ---------------- */
  const cGreen = col('#5e8e30'), cDry = col('#a89a4a'), cScrub = col('#5a7e30'), cRock = col('#8a7a62'), cSand = col('#f6ecd4'), cWet = col('#dccca4'), cMud = col('#4a4430'), cVerge = col('#d8cba8');
  function paintGround(x, z, y, slope, tmp) {
    const n = 0.5 + 0.5 * noise(x * 1.8, z * 1.8);
    tmp.copy(cGreen).lerp(cDry, n * 0.6).lerp(cScrub, sstep(0.6, 0.9, 0.5 + 0.5 * noise(x * 3, z * 3)) * 0.5);
    tmp.lerp(cDry, sstep(25, 70, y) * 0.3); tmp.lerp(col('#4a7a2a'), sstep(40, 110, y) * 0.5);
    tmp.lerp(cRock, sstep(0.45, 0.8, slope) * 0.8);
    const s = shoreD(x, z);
    if (s < 45) tmp.lerp(cSand, (1 - sstep(18, 45, s)) * (lagoonD(x, z) > -6 ? 0 : 1));
    if (y < 0.6 && s > -40) tmp.lerp(cWet, 0.7);
    if (y < -1.5) tmp.lerp(col('#e8dcb8'), 0.6);
    if (lagoonD(x, z) > -8 && y < 1.2) tmp.lerp(cMud, 0.8);
    return tmp;
  }
  {
    const SEGS = 446, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS); geo.rotateX(-PI / 2); geo.translate(X0 + SIZE / 2, 0, Z0 + SIZE / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); paintGround(x, z, pos.getY(i), 1 - nrm.getY(i), tmp);
      const r = sampleR(RR, x, z); if (r.i >= 0 && OPEN.dry(r.i)) tmp.lerp(SEG[r.i] === 'r' ? cRock : cVerge, (1 - sstep(hwR[r.i], hwR[r.i] + 3.5, r.dist)) * 0.8);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m.receiveShadow = true; scene.add(m);
    horizon = extendTerrain(m, { bounds: [X0, Z0, X0 + SIZE, Z0 + SIZE], nx: SEGS, nz: SEGS, height: originalFarH, color: (x, z, y) => paintGround(x, z, y, 0, new THREE.Color()), biome: 'margarita' });
  }
  // other islands on the horizon (Coche, Cubagua, the mainland)
  {
    const im = new THREE.MeshStandardMaterial({ color: col('#a89a5a'), roughness: 1, flatShading: true });
    for (const [x, z, sx, sy, sz] of [[200, 2600, 900, 40, 300], [-1400, 2200, 420, 28, 160], [2400, -1500, 300, 60, 200], [-2600, -900, 700, 90, 260], [1600, 1800, 140, 18, 80]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 10, 0, TAU, 0, PI / 2), im); m.scale.set(sx, sy, sz); m.position.set(x, -2, z); scene.add(m); }
    const rm = new THREE.MeshStandardMaterial({ color: col('#7a6a5a'), roughness: 1, flatShading: true });
    for (const [x, z] of MAP.playa.islets) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rm); m.scale.set(rr(10, 18), rr(8, 14), rr(8, 14)); m.position.set(x, 1, z); m.rotation.y = rand() * TAU; m.castShadow = true; scene.add(m); }
  }

  /* ---------------- the sea: turquoise over white sand, deep blue out, dark green in the mangrove lagoon ---------------- */
  const HT = { x0: -1000, z0: -800, size: 2000, res: 500 };
  const heightTex = (() => {
    const data = new Uint8Array(HT.res * HT.res * 4);
    for (let j = 0; j < HT.res; j++) for (let i = 0; i < HT.res; i++) {
      const x = HT.x0 + (i + 0.5) / HT.res * HT.size, z = HT.z0 + (j + 0.5) / HT.res * HT.size;
      const h = inArea(x, z, 4) ? terrainH(x, z) : -20;
      const v = Math.round(clamp((h + 20) / 30, 0, 1) * 255), k = (j * HT.res + i) * 4;
      data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, HT.res, HT.res, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  })();
  // uBox is rescaled by coastalTrack; the lagoon ellipse is in world metres too.
  const SEA = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR }, uH: { value: null }, uBox: { value: new THREE.Vector3(HT.x0, HT.z0, HT.size) }, uLag: { value: new THREE.Vector4(LG.c[0] * scale, LG.c[1] * scale, LG.rx * scale, LG.rz * scale) } }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT; uniform vec3 uSun; uniform sampler2D uH; uniform vec3 uBox; uniform vec4 uLag; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 uv = (vW.xz - uBox.xy) / uBox.z;
        float hgt = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture2D(uH, uv).r * 30.0 - 20.0 : -20.0;
        if (hgt > 0.05) discard;
        float depth = clamp(-hgt / 10.0, 0.0, 1.0);
        float a = sin(vW.x * 0.11 + uT * 0.9 + sin(vW.z * 0.05) * 2.0), b = sin(vW.z * 0.17 - uT * 1.3 + vW.x * 0.03);
        vec3 shallow = vec3(0.35, 0.92, 0.84), mid = vec3(0.05, 0.72, 0.78), deep = vec3(0.02, 0.32, 0.62);
        vec3 c = mix(shallow, mid, smoothstep(0.0, 0.25, depth)); c = mix(c, deep, smoothstep(0.3, 1.0, depth));
        float lg = 1.0 - smoothstep(0.85, 1.05, length((vW.xz - uLag.xy) / uLag.zw));
        c = mix(c, vec3(0.06, 0.42, 0.34), lg * 0.75);
        c += (a * 0.5 + b * 0.5) * 0.03;
        vec3 V = normalize(cameraPosition - vW), N = normalize(vec3(a * 0.06, 1.0, b * 0.06));
        c += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uSun, N), V), 0.0), 120.0) * 1.5;
        float fres = pow(1.0 - max(V.y, 0.0), 4.0); c = mix(c, vec3(0.85, 0.93, 0.98), fres * 0.3);
        float shore = 1.0 - smoothstep(-0.2, 1.2, -hgt);
        float wave = 0.5 + 0.5 * sin(-hgt * 5.0 + uT * 1.8 + sin(vW.x * 0.08) * 1.5);
        float foam = (shore * smoothstep(0.7, 0.98, wave) * 0.85 + (1.0 - smoothstep(-0.05, 0.25, -hgt)) * 0.6) * (1.0 - lg);
        c = mix(c, vec3(0.98, 1.0, 0.98), clamp(foam, 0.0, 1.0));
        float alpha = mix(0.6, 1.0, smoothstep(0.0, 0.5, depth));
        gl_FragColor = vec4(c, max(alpha, foam));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  SEA.uniforms.uH.value = heightTex;
  { const g = new THREE.PlaneGeometry(14000, 14000, 1, 1); g.rotateX(-PI / 2); const m = new THREE.Mesh(g, SEA); m.name = 'coastal-water'; m.renderOrder = 1; scene.add(m); }

  /* ---------------- road surface ---------------- */
  function stripMesh(rows, mat, vScale, colors) {
    const pos = [], uv = [], idx = [], cl = [];
    let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.a.distanceTo(rows[i - 1].a); pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale); if (colors) { const c = colors[i]; cl.push(c.r, c.g, c.b, c.r, c.g, c.b); } if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.name = 'coastal-road-strip'; m.receiveShadow = true; scene.add(m); return m;
  }
  const ROAD = new THREE.MeshStandardMaterial({ map: roadTex, vertexColors: true, roughness: 0.88, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  {
    // sand blown onto the asphalt along the beach
    const tone = { p: col('#ffffff'), c: col('#f2efe8'), a: col('#f8e8c4'), r: col('#ffffff'), j: col('#ffffff') };
    // The asphalt stops where the slipways go under the lagoon (OPEN).
    let rows = [], colors = [];
    for (let i = 0; i <= NR; i++) {
      const k = i % NR;
      if (!OPEN.dry(k)) { if (rows.length > 1) stripMesh(rows, ROAD, 20, colors); rows = []; colors = []; continue; }
      rows.push({ a: roadAt(k, -hwL[k], 0.12), b: roadAt(k, hwR[k], 0.12) }); const c = new THREE.Color(0, 0, 0); for (let j = -10; j <= 10; j++) c.add(tone[SEG[(k + j + NR) % NR]]); colors.push(c.multiplyScalar(1 / 21));
    }
    if (rows.length > 1) stripMesh(rows, ROAD, 20, colors);
    const sandTex = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(245,232,200,${rr(0.4, 0.9).toFixed(2)})`; c.beginPath(); c.ellipse(rand() * w, rand() * h, rr(6, 30), rr(4, 12), rand() * PI, 0, TAU); c.fill(); } });
    const SAND = new THREE.MeshStandardMaterial({ map: sandTex, transparent: true, opacity: 0.5, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 });
    const srows = []; for (let i = 0; i < NR; i++) if (SEG[i] === 'a') srows.push({ a: roadAt(i, -hwL[i], 0.14), b: roadAt(i, hwR[i], 0.14) });
    stripMesh(srows, SAND, 14).name = 'margarita-sand';
  }

  /* ---------------- instance buffers ---------------- */
  const _bx = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
  // a box from a to b: tx is its horizontal width, tz its other side (vertical for a level beam)
  const placeBeam = (a, b, tx, tz) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length(); dir.normalize();
    _bx.crossVectors(dir, UP); if (_bx.lengthSq() < 1e-6) _bx.set(1, 0, 0); _bx.normalize(); _bz.crossVectors(_bx, dir).normalize();
    _bm.makeBasis(_bx, dir, _bz); d.quaternion.setFromRotationMatrix(_bm); d.position.copy(a).addScaledVector(dir, len / 2); d.scale.set(tx, len, tz); d.updateMatrix(); return d.matrix.clone();
  };
  const beams = { steel: [], yellow: [], white: [], wood: [], rock: [] };
  const inst = { box: [], roof: [], grass: [], rock: [], umbrella: [], cyl: [], body: [], head: [] };
  const push = (list, pos, quat, scl, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scl); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const yawOf = v => Math.atan2(v.x, v.z);
  const mat4 = (x, y, z, yaw = 0, s = 1, sy = s) => { d.position.set(x, y, z); d.quaternion.copy(qYaw(yaw)); d.scale.set(s, sy, s); d.updateMatrix(); return d.matrix.clone(); };
  const freeOf = (x, z, m) => { const r = sampleR(RR, x, z); return !(r.i >= 0 && r.dist < hwR[r.i] + m); };
  const taken = [];
  const clearSpot = (x, z, r) => !taken.some(t => Math.hypot(t[0] - x, t[1] - z) < t[2] + r);
  const take = (x, z, r) => taken.push([x, z, r]);
  function tries(n, fn) { for (let i = 0, k = 0; i < n && k < n * 30; k++) if (fn()) i++; }
  const SHIRTS = ['#e8462e', '#ffd21f', '#3d7bf2', '#2a9b5a', '#ffffff', '#f08ab0', '#1fb8c0'].map(col);
  const person = (x, y, z, yaw, s = 1) => { push(inst.body, V3(x, y + 0.8 * s, z), qYaw(yaw), S.set(0.5 * s, 0.75 * s, 0.45 * s), pick(SHIRTS)); push(inst.head, V3(x, y + 1.72 * s, z), qYaw(yaw), S.set(0.32 * s, 0.3 * s, 0.42 * s), col('#9a6a3e')); };

  /* ---------------- rails along the lap, chevrons on the hairpins, the start banner ---------------- */
  {
    const step = Math.max(1, Math.round(3.5 / STEP));
    for (const side of [-1, 1]) {
      let prev = null;
      for (let i = 0; i < NR; i += step) {
        const s = SEG[i];
        // steel rails on the castle road, yellow rails along the bay at Juan Griego and on the causeway
        const kind = s === 'c' ? 'steel' : (s === 'j' && side > 0) || (s === 'r' && roadY[i] > 0.8) ? 'yellow' : null;
        if (!kind) { prev = null; continue; }
        const b0 = roadAt(i, side * (lateralHW(i, side) + 1.0), 0); b0.y = Math.min(b0.y, terrainH(b0.x, b0.z) + 0.1);
        const top = b0.clone().setY(b0.y + 0.85);
        beams[kind].push(placeBeam(b0.clone().setY(b0.y - 0.3), top, 0.16, 0.16));
        if (prev && prev.distanceTo(top) < 6) beams[kind].push(placeBeam(prev.clone().setY(prev.y - 0.12), top.clone().setY(top.y - 0.12), 0.08, 0.34));
        prev = top;
      }
    }
    const chevTex = canvasTex(256, 64, (c, w, h) => { c.fillStyle = '#ffd21f'; c.fillRect(0, 0, w, h); c.fillStyle = '#1e1e1e'; for (let k = 0; k < 4; k++) { const x = 30 + k * 56; c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 26, h / 2); c.lineTo(x, h - 8); c.lineTo(x + 14, h - 8); c.lineTo(x + 40, h / 2); c.lineTo(x + 14, 8); c.fill(); } });
    const signMat = new THREE.MeshStandardMaterial({ map: chevTex, roughness: 0.6 }), signGeo = new THREE.BoxGeometry(4, 1, 0.14);
    for (let i = 0; i < NR; i += 6) {
      if (SEG[i] !== 'c') continue;
      const a = roadFrame(i - 30).t, b = roadFrame(i + 30).t, turn = a.x * b.z - a.z * b.x;
      if (Math.abs(turn) < 0.8) continue;
      const side = turn > 0 ? -1 : 1, f = roadFrame(i), p0 = roadAt(i, side * (lateralHW(i, side) + 2.5)); p0.y = Math.min(p0.y, terrainH(p0.x, p0.z));
      const sign = new THREE.Mesh(signGeo, signMat); sign.position.copy(p0).setY(p0.y + 1.5); sign.lookAt(p0.clone().addScaledVector(f.n, -side).setY(p0.y + 1.5)); sign.castShadow = true; scene.add(sign);
      for (const o of [-1.5, 1.5]) beams.steel.push(placeBeam(p0.clone().addScaledVector(f.t, o).setY(p0.y - 0.3), p0.clone().addScaledVector(f.t, o).setY(p0.y + 1.1), 0.12, 0.12));
      i += 110;
    }
    // The race's own finish stripe sits at lineU; the banner spans it on two white posts.
    const i0 = Math.round(0.015 * NR), f0 = roadFrame(i0), q0 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f0.n, UP, f0.t.clone().negate()));
    const span = Math.max(hwL[i0], hwR[i0]) + 1.4;
    const bannerTex = canvasTex(1024, 160, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#18a8c8'; c.fillRect(0, 0, w, 22); c.fillRect(0, h - 22, w, 22); c.fillStyle = '#f2c41e'; c.beginPath(); c.arc(90, h / 2, 34, 0, TAU); c.fill(); c.font = 'bold 88px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#0e5a7a'; c.fillText('PANA MARGARITA', w / 2 + 40, h / 2 + 4); });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, 2.5), new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide })); banner.position.copy(roadAt(i0, 0, 7.4)); banner.quaternion.copy(q0); scene.add(banner);
    for (const s of [-1, 1]) { const b = roadAt(i0, s * span, 0); b.y = Math.min(b.y, groundH(b.x, b.z)); beams.white.push(placeBeam(b.clone().setY(b.y - 0.3), b.clone().setY(b.y + 8.8), 0.5, 0.5)); }
    take(RP0(i0).x, RP0(i0).z, 14);
  }
  function RP0(i) { return roadFrame(i).p; }

  /* ---------------- the forts: walls in long stones, round garitas with domes, cannons on the ramparts ---------------- */
  const garitas = [], cannons = [];
  const fortMats = {};
  function fort(F, y0) {
    const c = Math.cos(F.rot), s = Math.sin(F.rot), P = F.outline.map(([x, z]) => V3(F.at[0] + x * c - z * s, 0, F.at[1] + x * s + z * c)), H = F.height;
    const key = F.color; if (!fortMats[key]) fortMats[key] = { list: [], mat: worldTex(new THREE.MeshStandardMaterial({ map: stoneTex(F.color, new THREE.Color(F.color).offsetHSL(0, -0.05, 0.08).getStyle(), new THREE.Color(F.color).multiplyScalar(0.6).getStyle()), roughness: 0.95 }), 6, key) };
    const L = fortMats[key].list, mid = V3(F.at[0], 0, F.at[1]);
    for (let k = 0; k < P.length; k++) {
      const a = P[k], b = P[(k + 1) % P.length];
      L.push(placeBeam(a.clone().setY(y0 + H / 2 - 3), b.clone().setY(y0 + H / 2 - 3), 2.6, H + 6));
      // merlons along the parapet, facing outward
      const n = Math.floor(a.distanceTo(b) / 2.4), out = b.clone().sub(a).normalize(), nrm = V3(out.z, 0, -out.x); if (nrm.dot(a.clone().sub(mid)) < 0) nrm.negate();
      for (let j = 1; j < n; j += 2) { const p = a.clone().lerp(b, j / n).addScaledVector(nrm, 0.9).setY(y0 + H + 0.55); L.push(placeBeam(p.clone().addScaledVector(out, -0.6), p.clone().addScaledVector(out, 0.6), 0.8, 1.1)); }
      if (F.cannons > 0) { const p = a.clone().lerp(b, 0.5).addScaledVector(nrm, -1.6).setY(y0 + H + 0.1); cannons.push({ p, yaw: yawOf(nrm) }); }
    }
    for (const gi of F.garitas) { const p = P[gi], out = p.clone().sub(mid).setY(0).normalize(); garitas.push(p.clone().addScaledVector(out, 0.6).setY(y0 + H - 0.4)); }
    // the courtyard floor at the top of the walls on the hill, or the yard at ground level by the sea
    const shape = new THREE.Shape(P.map(p => new THREE.Vector2(p.x, -p.z)));
    const fl = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: col('#b8a888'), roughness: 1 })); fl.rotation.x = -PI / 2; fl.position.y = y0 + (F === MAP.forts.sanCarlos ? 0.3 : H); fl.receiveShadow = true; scene.add(fl);
    take(F.at[0], F.at[1], 32);
  }
  const SR = MAP.forts.santaRosa;
  fort(MAP.forts.sanCarlos, 2.2);
  fort(SR, SR.y - SR.height + 1.5);
  { const G = MAP.forts.laGalera; fort(G, groundH(G.at[0], G.at[1]) - 0.5); }
  // a low building in the courtyard at Pampatar, a chapel inside Santa Rosa
  { const F = MAP.forts.sanCarlos; push(inst.box, V3(F.at[0], 4, F.at[1] - 2), Q, S.set(18, 4, 10), col('#e8dcc0')); push(inst.roof, V3(F.at[0], 6, F.at[1] - 2), qYaw(PI / 2), S.set(11, 2.4, 19), col('#b85a3a')); }
  { push(inst.box, V3(SR.at[0] - 4, SR.y + 2.5, SR.at[1]), qYaw(SR.rot), S.set(12, 5, 8), col('#e0b080')); push(inst.roof, V3(SR.at[0] - 4, SR.y + 5, SR.at[1]), qYaw(SR.rot + PI / 2), S.set(9, 2.2, 13), col('#b85a3a')); }

  /* ---------------- Pampatar and Juan Griego: low houses with tile roofs, hotels, a two-spired church ---------------- */
  const HOUSES = ['#f4f0e6', '#f6e0b0', '#f0c8a8', '#bfe0e8', '#f4d8e0', '#e8f0d0', '#f8f4ec', '#fff2c8'].map(col), ROOFS = ['#b85a3a', '#c86a44', '#a84a32'].map(col);
  function house(x, z, yaw, w, dd, floors = 1) {
    const y = groundH(x, z) - 0.2, h = 3.2 * floors, q = qYaw(yaw), fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), right = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    push(inst.box, V3(x, y + h / 2, z), q, S.set(w, h + 0.4, dd), pick(HOUSES));
    if (rand() < 0.75) push(inst.roof, V3(x, y + h + 0.2, z), qYaw(yaw + PI / 2), S.set(dd + 1, rr(1.2, 1.8), w + 0.8), pick(ROOFS));
    else push(inst.box, V3(x, y + h + 0.45, z), q, S.set(w + 0.2, 0.5, dd + 0.2), col('#f8f6f0'));
    const front = V3(x, y, z).addScaledVector(fwd, dd / 2 + 0.05);
    push(inst.box, front.clone().addScaledVector(right, -w * 0.2).setY(y + 1.15), q, S.set(1.1, 2.2, 0.1), pick([col('#2a6a9a'), col('#2a8a6a'), col('#8a4a2a')]));
    push(inst.box, front.clone().addScaledVector(right, w * 0.22).setY(y + 1.7), q, S.set(1.2, 1.2, 0.1), col('#3a4a5a'));
    take(x, z, Math.max(w, dd) * 0.6);
  }
  function town(T) {
    const [x0, x1, z0, z1] = T.zone;
    tries(T.houses, () => {
      const x = rr(x0, x1), z = rr(z0, z1), w = rr(7, 11), dd = rr(7, 9); if (!freeOf(x, z, 7) || !clearSpot(x, z, 5) || shoreD(x, z) < 12) return false;
      const r = sampleR(RR, x, z), f = roadFrame(Math.max(0, r.i)), toRoad = f.p.clone().sub(V3(x, 0, z)).setY(0).normalize();
      house(x, z, Math.round(yawOf(toRoad) / (PI / 2)) * (PI / 2), w, dd, rand() < 0.3 ? 2 : 1); return true;
    });
  }
  town(MAP.towns.pampatar); town(MAP.towns.juanGriego);
  {
    const hm = new THREE.MeshStandardMaterial({ map: windowsTex, roughness: 0.6 }), top = new THREE.MeshStandardMaterial({ color: col('#e8e4dc') });
    for (const [x, z, h] of MAP.hotels) { if (!freeOf(x, z, 14)) continue; const y = groundH(x, z) - 0.5, w = rr(18, 26), dd = rr(12, 16); const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), [hm, hm, top, hm, hm, hm]); m.position.set(x, y + h / 2, z); m.rotation.y = rr(-0.3, 0.3); m.castShadow = true; m.receiveShadow = true; scene.add(m); take(x, z, 16); }
    // the church of Juan Griego: white with two tall spires
    const [cx, cz] = MAP.towns.juanGriego.church, cy = groundH(cx, cz) - 0.2, g = new THREE.Group(); g.position.set(cx, cy, cz); g.rotation.y = PI; scene.add(g);
    const wm = new THREE.MeshStandardMaterial({ color: col('#f8f6f0'), roughness: 0.8 });
    const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, wm); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    add(new THREE.BoxGeometry(12, 8, 22), 0, 4, -4);
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(3.4, 14, 3.4), s * 4.5, 7, 7); add(new THREE.ConeGeometry(2.2, 9, 4), s * 4.5, 18.5, 7).rotation.y = PI / 4; }
    add(new THREE.BoxGeometry(6, 4, 1), 0, 10, 7.6);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 4, 0.2), new THREE.MeshStandardMaterial({ color: col('#6a4a2e') })); door.position.set(0, 2, 7.1); g.add(door);
    take(cx, cz, 14);
  }

  /* ---------------- boats: peñeros on the sand, fishing boats with cabins anchored in the bays ---------------- */
  const peneroGeo = (() => {
    const N = 16, pos = [], idx = [], cl = [], L = 7.2, white = col('#f4f1ea'), bottom = col('#2f62c8');
    for (let j = 0; j <= N; j++) {
      const t = j / N, w = 0.95 * Math.pow(Math.sin(PI * (0.5 + 0.5 * t)), 0.6), top = 0.78 + 0.35 * t * t, bot = 0.05 + 0.28 * t * t * t, zz = -L / 2 + t * L;
      [[-w, top], [-w * 0.82, 0.32 + bot * 0.6], [0, bot], [w * 0.82, 0.32 + bot * 0.6], [w, top]].forEach(([x, yy]) => { pos.push(x, yy, zz); const c = yy < 0.36 ? bottom : white; cl.push(c.r, c.g, c.b); });
      if (j) for (let k = 0; k < 4; k++) { const a = (j - 1) * 5 + k, b = a + 5; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const HULL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const BAND = ['#d83a2c', '#2f62c8', '#1f9a6a', '#e8b321', '#e8862c'].map(col);
  const hulls = [], bands = [], anchored = [];
  const bandGeo = new THREE.BoxGeometry(1.7, 0.18, 6.6); bandGeo.translate(0, 0.72, 0.1);
  const addPenero = (x, y, z, yaw, s = 1, roll = 0) => { const q = qEuler(0, yaw, roll); push(hulls, V3(x, y, z), q, S.set(s, s, s), null); push(bands, V3(x, y, z), q, S.set(s * 1.08, s, s), pick(BAND)); };
  for (const T of [MAP.towns.pampatar, MAP.towns.juanGriego]) {
    const [bx0, bx1, bz0, bz1] = T.bay;
    tries(T.beached, () => { const x = rr(bx0, bx1), z = rr(bz0 - 60, bz0 + 10), s = shoreD(x, z); if (s < 2 || s > 12 || !freeOf(x, z, 4) || !clearSpot(x, z, 3)) return false; take(x, z, 3); addPenero(x, groundH(x, z) - 0.05, z, PI + rr(-0.4, 0.4), 1, rr(-0.1, 0.1)); return true; });
    tries(T.boats, () => { const x = rr(bx0, bx1), z = rr(bz0, bz1); if (shoreD(x, z) > -14 || anchored.some(a => Math.hypot(a.x - x, a.z - z) < 14)) return false; anchored.push({ x, z, yaw: rr(-0.5, 0.5) + (rand() < 0.5 ? 0 : PI), big: rand() < 0.6 }); return true; });
  }
  // anchored fishing boats: a big hull with a white cabin, a mast and lines
  for (const A of anchored) {
    if (!A.big) { addPenero(A.x, 0.05, A.z, A.yaw, 1); continue; }
    addPenero(A.x, -0.25, A.z, A.yaw, 2.2);
    const fwd = V3(Math.sin(A.yaw), 0, Math.cos(A.yaw));
    push(inst.box, V3(A.x, 2.6, A.z).addScaledVector(fwd, -1.5), qYaw(A.yaw), S.set(3, 1.8, 6), col('#f8f8f4'));
    push(inst.box, V3(A.x, 3.6, A.z).addScaledVector(fwd, -1.5), qYaw(A.yaw), S.set(3.3, 0.2, 6.6), col('#2a6aa8'));
    push(inst.cyl, V3(A.x, 1.5, A.z).addScaledVector(fwd, 2.5), Q, S.set(0.1, 7, 0.1), col('#d8d0c0'));
  }

  /* ---------------- the ferry and the dock at Punta de Piedras ---------------- */
  const FR = MAP.ferry;
  const ferry = new THREE.Group();
  {
    const white = new THREE.MeshStandardMaterial({ color: col('#f6f6f2'), roughness: 0.5 }), blue = new THREE.MeshStandardMaterial({ color: col('#1e5aa8'), roughness: 0.5 }), dark = new THREE.MeshStandardMaterial({ color: col('#24303c'), roughness: 0.3, metalness: 0.5 }), red = new THREE.MeshStandardMaterial({ color: col('#c8302a') });
    const add = (geo, m, x, y, z) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.castShadow = true; ferry.add(mm); return mm; };
    add(new THREE.BoxGeometry(15, 5, 64), white, 0, 1.5, 0); add(new THREE.BoxGeometry(15.1, 2.2, 64.1), blue, 0, 0.1, 0);
    const bow = add(new THREE.CylinderGeometry(7.5, 7.5, 5, 3, 1, false, 0, PI), white, 0, 1.5, -32); bow.rotation.y = PI; bow.scale.z = 1.4;
    add(new THREE.BoxGeometry(13, 3.4, 40), white, 0, 5.7, 4); add(new THREE.BoxGeometry(13.1, 1.1, 40.1), dark, 0, 6.2, 4);
    add(new THREE.BoxGeometry(11, 3, 26), white, 0, 9, 6); add(new THREE.BoxGeometry(11.1, 1, 26.1), dark, 0, 9.4, 6);
    add(new THREE.BoxGeometry(12, 2.6, 6), white, 0, 11.6, -2); add(new THREE.BoxGeometry(12.1, 0.9, 6.1), dark, 0, 12, -2);
    add(new THREE.CylinderGeometry(1.6, 1.8, 5, 14), white, 0, 13.5, 14); add(new THREE.CylinderGeometry(1.65, 1.65, 1.2, 14), red, 0, 15.6, 14);
    const ramp = add(new THREE.BoxGeometry(9, 0.4, 7), new THREE.MeshStandardMaterial({ color: col('#6a6e74') }), 0, 3, 33); ramp.rotation.x = -0.6;
    ferry.rotation.y = PI; scene.add(ferry);
    // the concrete pier, a terminal shed on the shore
    const [dx, dz] = FR.dock, len = FR.berth[1] - dz + 6;
    const pier = new THREE.Mesh(new THREE.BoxGeometry(12, 3, len), new THREE.MeshStandardMaterial({ color: col('#b8b4aa'), roughness: 0.9 })); pier.position.set(dx, 1, dz + len / 2); pier.castShadow = pier.receiveShadow = true; scene.add(pier);
    for (let k = 0; k < len; k += 8) for (const s of [-1, 1]) beams.white.push(placeBeam(V3(dx + s * 5.5, -6, dz + k), V3(dx + s * 5.5, 0, dz + k), 0.8, 0.8));
    const ty = groundH(dx - 30, dz - 30); push(inst.box, V3(dx - 30, ty + 4, dz - 30), Q, S.set(30, 8, 18), col('#f2f0ea')); push(inst.box, V3(dx - 30, ty + 8.4, dz - 30), Q, S.set(32, 0.8, 20), col('#1e5aa8'));
    take(dx - 30, dz - 30, 20);
  }
  const ferryAt = t => {
    const T = ((t + FR.offset) % FR.period + FR.period) % FR.period, far = V3(FR.far[0], 0, FR.far[1]), berth = V3(FR.berth[0], 0, FR.berth[1]);
    if (T < FR.approach) return far.lerp(berth, sstep(0, 1, T / FR.approach) * 0.6 + (T / FR.approach) * 0.4);
    if (T < FR.approach + FR.stay) return berth;
    if (T < FR.approach + FR.stay + FR.leave) return berth.lerp(far, sstep(0, 1, (T - FR.approach - FR.stay) / FR.leave));
    return far;
  };

  /* ---------------- vegetation: library coconut palms, dry scrub and cardones on the hills, mangroves in the lagoon ---------------- */
  const roadGap = (x, z) => sampleR(RR, x, z).dist;
  const palm = (x, z, tall = 1) => vegetation.add('palm', x, z, groundH(x, z), tall, roadGap(x, z));
  // dry hill scrub: low mangos and the odd big ceiba on the green slopes
  const scrub = (x, z, big) => vegetation.add(big && rand() < 0.3 ? 'tree' : 'mango', x, z, groundH(x, z), big ? rr(0.7, 0.9) : rr(0.45, 0.6), roadGap(x, z));
  const cardon = (x, z) => vegetation.add('cactus', x, z, groundH(x, z), rr(0.9, 1.4), roadGap(x, z));
  // mangroves stand in the shallow water, rooted at the surface
  const mangroveTree = (x, z, s) => vegetation.add('mangrove', x, z, Math.max(groundH(x, z), -0.2), s, roadGap(x, z));
  {
    const Z = MAP.zones;
    // palms along every beach and down both sides of the beach road
    tries(Z.palms, () => { const x = rr(X0 + 10, X0 + SIZE - 10), z = rr(Z0 + 10, Z0 + SIZE - 10), s = shoreD(x, z); if (s < 6 || s > 70 || lagoonD(x, z) > -10 || !freeOf(x, z, 2.5) || !clearSpot(x, z, 2)) return false; palm(x, z, s < 25 ? 0.85 : 1); return true; });
    for (let i = 0; i < NR; i += 4) { if (SEG[i] !== 'a' && SEG[i] !== 'p') continue; for (const side of [-1, 1]) { if (rand() < 0.45) continue; const p = roadAt(i, side * (lateralHW(i, side) + rr(4, 8)), 0); if (!freeOf(p.x, p.z, 3.5) || !clearSpot(p.x, p.z, 1.5) || shoreD(p.x, p.z) < 2) continue; palm(p.x, p.z, rr(0.9, 1.15)); } }
    tries(Z.scrub, () => { const x = rr(X0 + 10, X0 + SIZE - 10), z = rr(Z0 + 10, Z0 + SIZE - 10), s = shoreD(x, z); if (s < 40 || lagoonD(x, z) > -10 || !freeOf(x, z, 4) || !clearSpot(x, z, 3)) return false; scrub(x, z, rand() < 0.4); return true; });
    tries(Z.cacti, () => { const x = rr(X0 + 10, X0 + SIZE - 10), z = rr(Z0 + 10, Z0 + SIZE - 10), s = shoreD(x, z); if (s < 30 || lagoonD(x, z) > -10 || !freeOf(x, z, 3) || !clearSpot(x, z, 2)) return false; cardon(x, z); return true; });
    // mangroves: thick on the lagoon edge and on the islets, leaving the channels open
    tries(Z.mangroves, () => {
      const a = rand() * TAU, r = Math.sqrt(rand()) * 1.15, x = LG.c[0] + Math.cos(a) * LG.rx * r, z = LG.c[1] + Math.sin(a) * LG.rz * r, L = lagoonD(x, z);
      if (L < -6 || sampleR(CHR, x, z).dist < 9 || !freeOf(x, z, 4.5)) return false;
      if (L > 4 && natural(x, z) < 0) return false;
      mangroveTree(x, z, rr(0.8, 1.15)); return true;
    });
    tries(Z.grass, () => { const x = rr(X0 + 4, X0 + SIZE - 4), z = rr(Z0 + 4, Z0 + SIZE - 4), s = shoreD(x, z); if (s < 20 || lagoonD(x, z) > -6 || !freeOf(x, z, 1.2)) return false; const y = terrainH(x, z), sc = rr(0.6, 1.2); push(inst.grass, V3(x, y - 0.05, z), qYaw(rand() * TAU), S.set(sc * 1.4, sc, sc * 1.4), col(pick(['#a8a050', '#8a9a40', '#c0b060'])).offsetHSL(0, rr(-0.1, 0.05), rr(-0.06, 0.06))); return true; });
    // riprap along the causeway, down to the slipways (the draws still run
    // under the lagoon so everything scattered after keeps its place)
    for (let i = 0; i < NR; i += 3) { if (SEG[i] !== 'r') continue; for (const side of [-1, 1]) { const p = roadAt(i, side * (lateralHW(i, side) + rr(2, 4.5)), 0); push(roadY[i] > 0.8 ? inst.rock : [], V3(p.x, Math.min(p.y - 0.4, rr(-0.2, 0.6)), p.z), qEuler(rand(), rand() * TAU, rand()), S.set(rr(0.6, 1.4), rr(0.4, 0.9), rr(0.6, 1.2)), col('#8a8478').offsetHSL(0, 0, rr(-0.06, 0.05))); } }
  }

  /* ---------------- Playa El Agua: umbrellas, loungers, beach huts with tile roofs, vendors with coolers ---------------- */
  {
    const P = MAP.playa;
    let n = 0;
    for (let k = 0; k < 900 && n < P.umbrellas; k++) {
      const i = Math.floor(rand() * NR); if (SEG[i] !== P.seg) continue;
      const f = roadFrame(i), side = f.n.z < 0 ? 1 : -1, p = roadAt(i, side * (lateralHW(i, side) + rr(14, 32)), 0), s = shoreD(p.x, p.z);
      if (s < 4 || s > 34 || !clearSpot(p.x, p.z, 2)) continue; take(p.x, p.z, 2.2); n++;
      const y = groundH(p.x, p.z);
      push(inst.cyl, V3(p.x, y, p.z), Q, S.set(0.05, 2.5, 0.05), col('#f0f0f0'));
      push(inst.umbrella, V3(p.x, y + 2.6, p.z), qYaw(rand() * TAU), S.set(1.6, 0.6, 1.6), pick([col('#ffffff'), col('#ffffff'), col('#e8462e'), col('#1fb8c0'), col('#ffd21f')]));
      for (const o of [-0.8, 0.8]) push(inst.box, V3(p.x + o, y + 0.25, p.z + 0.6), qYaw(rr(-0.2, 0.2)), S.set(0.6, 0.15, 1.8), col('#f8f8f8'));
      if (rand() < 0.5) person(p.x + rr(-1, 1), y, p.z + 1.6, rand() * TAU, 0.9);
    }
    for (let k = 0, guard = 0; k < P.vendors && guard < 2000; guard++) {
      const i = Math.floor(rand() * NR); if (SEG[i] !== P.seg) continue;
      k++;
      const f = roadFrame(i), side = f.n.z < 0 ? 1 : -1, p = roadAt(i, side * (lateralHW(i, side) + rr(8, 30)), 0), y = groundH(p.x, p.z);
      if (shoreD(p.x, p.z) < 2) continue;
      person(p.x, y, p.z, rand() * TAU, 1);
      push(inst.box, V3(p.x + 0.6, y + 0.3, p.z), qYaw(rand()), S.set(0.8, 0.55, 0.5), pick([col('#2a6ad0'), col('#ffffff'), col('#e8462e')]));
    }
    for (let k = 0; k < P.huts; k++) {
      const i = idxNear(140 + k * 40, -298), f = roadFrame(i), side = f.n.z < 0 ? 1 : -1, p = roadAt(i, side * (lateralHW(i, side) + 9), 0), y = groundH(p.x, p.z), yaw = yawOf(f.n.clone().multiplyScalar(side));
      for (const sx of [-2.5, 2.5]) for (const sz of [-2, 2]) push(inst.box, V3(p.x + Math.cos(yaw) * sx + Math.sin(yaw) * sz, y + 1.5, p.z - Math.sin(yaw) * sx + Math.cos(yaw) * sz), qYaw(yaw), S.set(0.25, 3, 0.25), col('#f4f4ee'));
      push(inst.roof, V3(p.x, y + 3, p.z), qYaw(yaw + PI / 2), S.set(5.6, 1.6, 6.6), col('#c86a44'));
      push(inst.box, V3(p.x, y + 0.6, p.z), qYaw(yaw), S.set(4, 1.2, 1), col('#f8f4ec'));
      take(p.x, p.z, 5);
    }
  }
  // people on the Pampatar seafront and a stone parapet over the beach
  {
    let prev = null;
    for (let i = 0; i < NR; i += 2) { if (SEG[i] !== 'p') { prev = null; continue; } const top = roadAt(i, hwR[i] + 3, 0.6); top.y = Math.min(top.y, groundH(top.x, top.z) + 0.6); if (prev && prev.distanceTo(top) < 3) beams.rock.push(placeBeam(prev, top, 0.7, 1.0)); prev = top; }
    for (let k = 0, guard = 0; k < 24 && guard < 2000; guard++) { const i = Math.floor(rand() * NR); if (SEG[i] !== 'p') continue; k++; const p = roadAt(i, hwR[i] + rr(4, 5.5), 0); person(p.x, groundH(p.x, p.z), p.z, rand() * TAU, rr(0.9, 1.05)); }
  }

  /* ---------------- signs ---------------- */
  for (const sg of MAP.signs) {
    const i = idxNear(sg.at[0], sg.at[1]), f = roadFrame(i), p0 = roadAt(i, sg.side * (lateralHW(i, sg.side) + 2.4)); p0.y = Math.min(p0.y, groundH(p0.x, p0.z));
    const tex = textBoard(1024, 256, '#0e6a8a', (c, w, h) => { c.strokeStyle = '#ffffff'; c.lineWidth = 12; c.strokeRect(12, 12, w - 24, h - 24); c.fillStyle = '#ffffff'; c.font = `bold ${sg.lines[0].length > 16 ? 72 : 96}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(sg.lines[0], w / 2, h / 2 + 4); });
    const dm = new THREE.MeshStandardMaterial({ color: col('#4a4c52') });
    const board = new THREE.Mesh(new THREE.BoxGeometry(5, 1.25, 0.12), [dm, dm, dm, dm, new THREE.MeshStandardMaterial({ map: tex }), dm]); board.position.copy(p0).setY(p0.y + 2.8); board.lookAt(board.position.clone().addScaledVector(f.t, -1)); board.castShadow = true; scene.add(board);
    beams.steel.push(placeBeam(p0.clone().setY(p0.y - 0.2), p0.clone().setY(p0.y + 2.3), 0.14, 0.14));
  }

  /* ---------------- flush instances ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; scene.add(im); return im;
  }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 })); }
  { const g = new THREE.PlaneGeometry(1, 1, 1, 2); g.translate(0, 0.5, 0); const g2 = g.clone(); g2.rotateY(PI / 2); flush(inst.grass, mergeGeometries([g, g2]), windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0, 0.18), false); }
  flush(inst.rock, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }));
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }));
  { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); flush(inst.roof, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85, side: THREE.DoubleSide })); }
  flush(inst.umbrella, new THREE.ConeGeometry(1, 1, 12, 1, true), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.75, side: THREE.DoubleSide }));
  flush(inst.body, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false);
  flush(inst.head, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false);
  flush(hulls, peneroGeo, HULL);
  flush(bands, bandGeo, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 }));
  for (const k in fortMats) { const F = fortMats[k], im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), F.mat, F.list.length); F.list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  {
    // garitas: a round sentry box with a dome and a finial
    const gm = new THREE.MeshStandardMaterial({ map: stoneTex('#c8844a', '#d8a070', '#8a5a34'), roughness: 0.95 });
    const parts = [[new THREE.CylinderGeometry(1.3, 1.4, 3.2, 16).translate(0, 1.6, 0), gm], [new THREE.SphereGeometry(1.45, 16, 8, 0, TAU, 0, PI / 2).translate(0, 3.2, 0), gm], [new THREE.CylinderGeometry(1.5, 1.5, 0.25, 16).translate(0, 3.25, 0), gm], [new THREE.ConeGeometry(0.28, 0.8, 8).translate(0, 4.9, 0), gm], [new THREE.SphereGeometry(0.26, 8, 6).translate(0, 5.4, 0), gm], [new THREE.BoxGeometry(0.25, 1.0, 2.84).translate(0, 1.9, 0), new THREE.MeshStandardMaterial({ color: col('#2a1e16') })]];
    const yaws = garitas.map(() => rand() * TAU);
    for (const [g, m] of parts) { const im = new THREE.InstancedMesh(g, m, garitas.length); garitas.forEach((p, i) => im.setMatrixAt(i, mat4(p.x, p.y, p.z, yaws[i]))); im.castShadow = true; scene.add(im); }
    // cannons: black iron barrels on wooden carriages
    const barrel = new THREE.CylinderGeometry(0.22, 0.32, 3.0, 12); barrel.rotateX(PI / 2); barrel.translate(0, 0.75, 0.6);
    const carriage = new THREE.BoxGeometry(1.1, 0.6, 1.8); carriage.translate(0, 0.3, -0.1);
    for (const [g, m] of [[barrel, new THREE.MeshStandardMaterial({ color: col('#1a1a1c'), metalness: 0.6, roughness: 0.45 })], [carriage, new THREE.MeshStandardMaterial({ color: col('#5a3e26') })]]) { const im = new THREE.InstancedMesh(g, m, cannons.length); cannons.forEach((c, i) => im.setMatrixAt(i, mat4(c.p.x, c.p.y, c.p.z, c.yaw))); im.castShadow = true; scene.add(im); }
  }
  {
    const mats = { steel: new THREE.MeshStandardMaterial({ color: col('#b9bcc0'), metalness: 0.5, roughness: 0.4 }), yellow: new THREE.MeshStandardMaterial({ color: col('#f2c41e'), roughness: 0.6 }), white: new THREE.MeshStandardMaterial({ color: col('#e8e6e0') }), wood: new THREE.MeshStandardMaterial({ color: col('#6a4a2e') }), rock: worldTex(new THREE.MeshStandardMaterial({ map: stoneTex('#c8b48a', '#d8c8a0', '#8a7a5a'), roughness: 0.95 }), 4, 'rock') };
    const bg = new THREE.BoxGeometry(1, 1, 1);
    for (const [k, list] of Object.entries(beams)) if (list.length) { const im = new THREE.InstancedMesh(bg, mats[k], list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  }

  /* ---------------- moving things: peñeros racing tourists through the lagoon, a boat in Juan Griego bay, pelicans, a cloud cap ---------------- */
  const racers = [];
  channels.forEach((ch, k) => {
    for (let j = 0; j < LG.racers[k]; j++) {
      const g = new THREE.Group(), hull = new THREE.Mesh(peneroGeo, HULL); hull.scale.set(1.3, 1.1, 1.3); g.add(hull);
      const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ color: BAND[(k * 3 + j) % BAND.length] })); band.scale.set(1.4, 1.1, 1.3); g.add(band);
      const awn = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 4.6), new THREE.MeshStandardMaterial({ color: col(pick(['#1e5ab8', '#e8a040', '#f4f0e6'])), side: THREE.DoubleSide })); awn.position.set(0, 2.6, -0.6); g.add(awn);
      const poleM = new THREE.MeshStandardMaterial({ color: col('#e0e0e0') }), poleG = new THREE.CylinderGeometry(0.04, 0.04, 1.9, 4);
      for (const sx of [-1.1, 1.1]) for (const sz of [-2.6, 1.4]) { const pole = new THREE.Mesh(poleG, poleM); pole.position.set(sx, 1.7, sz); g.add(pole); }
      for (let m = 0; m < 6; m++) { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshStandardMaterial({ color: col(pick(['#9a6a3e', '#e8462e', '#ffd21f', '#3d7bf2'])) })); hd.position.set(m % 2 ? 0.45 : -0.45, 1.3, -2 + Math.floor(m / 2) * 1.2); g.add(hd); }
      const wake = new THREE.Mesh(new THREE.PlaneGeometry(3, 10), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.6, depthWrite: false })); wake.rotation.x = -PI / 2; wake.position.set(0, 0.1, -8); g.add(wake);
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(g); racers.push({ g, ch, ph: j / LG.racers[k] + k * 0.13, speed: rr(12, 15) });
    }
  });
  const drifter = new THREE.Group();
  { const h = new THREE.Mesh(peneroGeo, HULL); h.scale.setScalar(2.2); drifter.add(h); const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 1.8, 6), new THREE.MeshStandardMaterial({ color: col('#f8f8f4') })); cab.position.set(0, 2.4, -1.5); drifter.add(cab); scene.add(drifter); }
  const birds = [];
  {
    const mBody = new THREE.MeshStandardMaterial({ color: col('#8a8278'), roughness: 0.8, flatShading: true }), mWing = new THREE.MeshStandardMaterial({ color: col('#6f675f'), roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    const bodyG = new THREE.SphereGeometry(1, 10, 8), wingG = new THREE.BoxGeometry(2.6, 0.05, 0.8);
    for (let k = 0; k < 10; k++) {
      const b = new THREE.Group(); const body = new THREE.Mesh(bodyG, mBody); body.scale.set(0.4, 0.4, 1.1); b.add(body);
      const wings = []; for (const s of [-1, 1]) { const pivot = new THREE.Group(); pivot.position.set(s * 0.3, 0.1, 0.1); b.add(pivot); const w = new THREE.Mesh(wingG, mWing); w.position.set(s * 1.3, 0, 0); pivot.add(w); wings.push({ pivot, s }); }
      b.scale.setScalar(1.2); scene.add(b);
      const spot = pick([[60, 230], [340, 250], [420, -100], [200, -360]]);
      birds.push({ g: b, wings, c: V3(spot[0] + rr(-40, 40), rr(14, 34), spot[1] + rr(-40, 40)), r: rr(25, 70), sp: rr(0.12, 0.2) * (rand() < 0.5 ? -1 : 1), ph: rand() * TAU, fl: rr(2, 3.2) });
    }
  }
  // a cap of cloud on the central mountain; the race sky draws the rest
  {
    const m = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.85, depthWrite: false, fog: true });
    for (let k = 0; k < 8; k++) { const s = new THREE.Sprite(m); s.position.set(60 + rr(-60, 60), 140 + rr(0, 20), -60 + rr(-50, 50)); const sc = rr(70, 130); s.scale.set(sc / scale, sc * 0.4, 1); s.raycast = () => {}; scene.add(s); }
  }

  /* ---------------- per-frame updates ---------------- */
  function update(t) {
    uTime.value = t;
    SEA.uniforms.uT.value = t;
    const F = ferryAt(t); ferry.position.set(F.x, 0.1 + Math.sin(t * 0.8) * 0.15, F.z); ferry.rotation.z = Math.sin(t * 0.6) * 0.01;
    // the racing peñeros: round their channels, bow up, bouncing
    racers.forEach(R => { const u = ((t * R.speed / R.ch.len + R.ph) % 1 + 1) % 1, p = R.ch.curve.getPointAt(u), q = R.ch.curve.getPointAt((u + 0.003) % 1); R.g.position.set(p.x, 0.1 + Math.abs(Math.sin(t * 6 + R.ph * 20)) * 0.12, p.z); R.g.rotation.set(-0.08, Math.atan2(q.x - p.x, q.z - p.z), Math.sin(t * 3 + R.ph) * 0.04); });
    { const a = t * 0.02, x = 360 + Math.cos(a) * 60, z = 260 + Math.sin(a) * 25; drifter.position.set(x, 0.05 + Math.sin(t * 1.2) * 0.08, z); drifter.rotation.y = Math.atan2(-Math.sin(a) * 60, Math.cos(a) * 25); }
    birds.forEach(b => { const a = b.ph + t * b.sp, p = V3(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(t * 0.5 + b.ph) * 3, b.c.z + Math.sin(a) * b.r), ahead = V3(b.c.x + Math.cos(a + 0.05 * Math.sign(b.sp)) * b.r, p.y, b.c.z + Math.sin(a + 0.05 * Math.sign(b.sp)) * b.r); b.g.position.copy(p); b.g.lookAt(ahead); b.g.rotateZ(-0.3 * Math.sign(b.sp)); const flap = Math.max(0, Math.sin(t * b.fl + b.ph)) * 0.5 - 0.1; b.wings.forEach(w => (w.pivot.rotation.z = w.s * flap)); });
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
  // The tourist peñeros are solid on the open lagoon, and their wakes kick
  // (transform-gates.js); positions in layout metres, coastal-track scales them.
  const obstacles = () => racers.map(R => ({ x: R.g.position.x, z: R.g.position.z, r: 2.4, h: R.g.rotation.y, v: R.speed }));
  return { group: scene, groundAt: groundH, update, obstacles };
}
