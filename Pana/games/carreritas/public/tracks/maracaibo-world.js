import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { coastalVegetation } from '/engine/worlds/coastal/coastal-vegetation.js';
import { MAP } from './maracaibo-layout.js';
export function createWorld(scene, layout, roadDistance) {
  const vegetation = coastalVegetation(scene, 1, roadDistance);
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const rand = rng(MAP.seed);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const d = new THREE.Object3D();
  const uTime = { value: 0 }, uFlash = { value: 0 };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const { SIZE, X0, Z0, LAND, inArea, sampleR, NSH, SHP, shoreZ, shoreD, softShore, base, BR, bridgeIndex, NR, STEP, RP, SEG, RR, BRIDGE,
    hwL, hwR, roadY, elev, roadFrame, roadAt, lateralHW, idxNear, PL, inPlaza, terrainH, groundH } = layout;
  const MOON_DIR = new THREE.Vector3(...MAP.moon.dir).normalize();
  const CENTER = V3(190, 0, -65);

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
  const cloudTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const moonTex = canvasTex(256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.36, 'rgba(255,248,230,1)'); g.addColorStop(0.4, 'rgba(200,210,255,0.35)'); g.addColorStop(1, 'rgba(120,140,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { const a = rand() * TAU, r = rand() * 34, x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r; c.fillStyle = 'rgba(190,180,170,0.35)'; c.beginPath(); c.arc(x, y, rr(4, 12), 0, TAU); c.fill(); }
  });
  // asphalt with white lines; the lines are also an emissive map so the lap reads at night
  const drawLines = (c, w, h, bg) => {
    if (bg) { c.fillStyle = '#4a4a50'; c.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(20,20,24,${rr(0.1, 0.3).toFixed(2)})` : `rgba(200,200,210,${rr(0.04, 0.12).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); } }
    else { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); }
    c.fillStyle = bg ? 'rgba(245,245,240,0.92)' : '#9a9690'; c.fillRect(w * 0.04, 0, 7, h); c.fillRect(w * 0.96 - 7, 0, 7, h);
    c.fillStyle = bg ? '#fff4d8' : '#9a9690'; for (const x of [w * 0.278, w * 0.722]) for (let y = 0; y < h; y += 128) c.fillRect(x - 2, y, 4, 70);
    c.fillStyle = bg ? '#ffd43b' : '#a08a30'; for (const x of [w / 2 - 4, w / 2 + 2]) c.fillRect(x, 0, 2, h);
  };
  const roadTex = canvasTex(256, 512, (c, w, h) => drawLines(c, w, h, true));
  const roadGlow = canvasTex(256, 512, (c, w, h) => drawLines(c, w, h, false));
  const tinTex = canvasTex(128, 128, (c, w, h) => {
    for (let x = 0; x < w; x += 8) { const g = c.createLinearGradient(x, 0, x + 8, 0); g.addColorStop(0, '#8a7a6a'); g.addColorStop(0.5, '#c8beb0'); g.addColorStop(1, '#6a5a4a'); c.fillStyle = g; c.fillRect(x, 0, 8, h); }
    for (let i = 0; i < 26; i++) { c.fillStyle = `rgba(${(140 + rand() * 50) | 0},${(60 + rand() * 30) | 0},20,${rr(0.3, 0.6).toFixed(2)})`; c.beginPath(); c.ellipse(rand() * w, rand() * h, rr(6, 26), rr(4, 14), 0, 0, TAU); c.fill(); }
  });
  const pavTex = canvasTex(256, 256, (c, w, h) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? '#b8a07a' : '#d6c8a8'; c.fillRect(x * 32, y * 32, 32, 32); } c.strokeStyle = 'rgba(60,40,30,0.4)'; c.lineWidth = 2; for (let k = 0; k <= 8; k++) { c.beginPath(); c.moveTo(k * 32, 0); c.lineTo(k * 32, h); c.stroke(); c.beginPath(); c.moveTo(0, k * 32); c.lineTo(w, k * 32); c.stroke(); } });
  const textBoard = (w, h, bg, draw) => canvasTex(w, h, c => { c.fillStyle = bg; c.fillRect(0, 0, w, h); draw(c, w, h); });
  const signTex = (lines, bg = '#1e3a8a', ink = '#ffffff', frame = '#ffffff') => textBoard(1024, 256, bg, (c, w, h) => {
    c.strokeStyle = frame; c.lineWidth = 12; c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'middle';
    lines.forEach((t, k) => { c.font = `bold ${k ? 54 : 96}px sans-serif`; c.fillText(t, w / 2, h * (lines.length > 1 ? (k ? 0.76 : 0.4) : 0.52)); });
  });
  // city windows: a facade map and an emissive map with only the lit windows
  const windowTex = (cols, rows, lit) => {
    const baseC = document.createElement('canvas'), glow = document.createElement('canvas'); baseC.width = glow.width = 128; baseC.height = glow.height = 256;
    const b = baseC.getContext('2d'), g = glow.getContext('2d'); b.fillStyle = '#ffffff'; b.fillRect(0, 0, 128, 256); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256);
    const cw = 128 / cols, ch = 256 / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = i * cw + cw * 0.2, y = j * ch + ch * 0.25, ww = cw * 0.6, hh = ch * 0.5, on = rand() < lit;
      b.fillStyle = on ? '#ffe0a0' : '#1a2030'; b.fillRect(x, y, ww, hh);
      if (on) { g.fillStyle = pick(['#ffd28a', '#ffe8b8', '#fff4dc', '#b8d8ff']); g.fillRect(x, y, ww, hh); }
    }
    const mk = cnv => { const t = new THREE.CanvasTexture(cnv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
    return { map: mk(baseC), emissiveMap: mk(glow) };
  };

  /* ---------------- wind-swayed and self-lit materials ---------------- */
  function windy(mat, baseK, perY) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uTime * 1.1 + ip.x * 0.06 + ip.z * 0.045) * 0.6 + sin(uTime * 2.5 + ip.x * 0.17 - ip.z * 0.11) * 0.25;
        float k = ${baseK.toFixed(3)} + max(position.y, 0.0) * ${perY.toFixed(3)};
        transformed.x += sw * k; transformed.z += sw * k * 0.55;`);
    };
    mat.customProgramCacheKey = () => 'maracaibo-windy' + baseK + '_' + perY;
    return mat;
  }
  // facades lit by the street: instance colour feeds a little emissive so the colours read at night
  function selfLit(mat, k, key) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uFlash = uFlash;
      sh.fragmentShader = 'uniform float uFlash;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR
          totalEmissiveRadiance += vColor.rgb * (${k.toFixed(3)} + uFlash * 0.08);
        #endif`);
    };
    mat.customProgramCacheKey = () => 'maracaibo-selfLit-r186-' + key;
    return mat;
  }

  /* ---------------- terrain: the near city at 4 m, the far land at 24 m ---------------- */
  const cCity = col('#4a4a52'), cPark = col('#2c5a2a'), cWall = col('#9a9a98'), cMud = col('#3a3020');
  function paintGround(x, z, y, tmp) {
    const n = 0.5 + 0.5 * Math.sin(x * 0.07 + Math.sin(z * 0.05) * 3) * Math.cos(z * 0.06 - x * 0.03);
    tmp.copy(cCity).lerp(cPark, sstep(0.55, 0.85, n) * 0.8);
    const dd = shoreD(x, z);
    if (dd < 3 && dd > -6) tmp.lerp(softShore(x) ? cMud : cWall, 0.85);
    if (y < -0.5) tmp.copy(cMud);
    return tmp;
  }
  const addTerrain = (x0, z0, w, dpt, step, fn) => {
    const geo = new THREE.PlaneGeometry(w, dpt, Math.round(w / step), Math.round(dpt / step)); geo.rotateX(-PI / 2); geo.translate(x0 + w / 2, 0, z0 + dpt / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const y = fn(pos.getX(i), pos.getZ(i)); pos.setY(i, y); paintGround(pos.getX(i), pos.getZ(i), y, tmp); colors.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m.receiveShadow = true; scene.add(m); return m;
  };
  addTerrain(X0, Z0, SIZE, 700, 4, terrainH);
  addTerrain(-2400, -2600, 4800, 2700, 24, (x, z) => (inArea(x, z, 10) && z < Z0 + 700 - 10 ? -20 : base(x, z) - 0.3));
  { // the far shore of the lake: a low dark strip with scattered lights
    const g = new THREE.PlaneGeometry(9000, 1200, 90, 12); g.rotateX(-PI / 2); g.translate(0, 0, MAP.farShore.z + 600);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, (p.getZ(i) - MAP.farShore.z) * 0.02 + 3 * Math.sin(p.getX(i) * 0.004));
    g.computeVertexNormals(); scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: col('#0e140e'), roughness: 1 })));
  }

  /* ---------------- the lake: dark glossy water with ripples, the moon's path, lit by the lightning ---------------- */
  const LAKE = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uFlash: { value: 0 }, uMoon: { value: MOON_DIR } }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT; uniform float uFlash; uniform vec3 uMoon; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        float a = sin(vW.x * 0.09 + uT * 0.7 + sin(vW.z * 0.05) * 2.0) + sin(vW.z * 0.14 - uT * 0.9 + vW.x * 0.02) * 0.7;
        float b = cos(vW.z * 0.11 + uT * 0.6) + sin(vW.x * 0.2 - uT * 1.3) * 0.5;
        vec3 V = normalize(cameraPosition - vW), N = normalize(vec3(a * 0.05, 1.0, b * 0.05));
        float fres = 0.25 + 0.75 * pow(1.0 - max(V.y, 0.0), 3.0);
        vec3 c = mix(vec3(0.008, 0.02, 0.06), vec3(0.03, 0.06, 0.16), fres);
        float moon = pow(max(dot(reflect(-uMoon, N), V), 0.0), 60.0);
        c += vec3(0.75, 0.8, 1.0) * moon * 1.2;
        c += (a * 0.5 + b * 0.5) * 0.012;
        c += vec3(0.4, 0.36, 0.7) * uFlash * (0.08 + 0.14 * fres);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
  { const g = new THREE.PlaneGeometry(12000, 12000); g.rotateX(-PI / 2); const m = new THREE.Mesh(g, LAKE); m.name = 'coastal-water'; scene.add(m); }

  /* ---------------- glow points, light pools, emissive lamps ---------------- */
  const glows = [], glowCols = [], pools = [];
  const addGlow = (p, c, size = 1) => { glows.push(p.x, p.y, p.z); const cc = col(c).multiplyScalar(size); glowCols.push(cc.r, cc.g, cc.b); };
  const addPool = (p, r, c = '#ffb868', k = 1) => pools.push({ p, r, c: col(c).multiplyScalar(k * 0.45) });
  const LAMP = new THREE.MeshStandardMaterial({ color: col('#fff2d0'), emissive: col('#ffcf88'), emissiveIntensity: 3 });
  const DARK = new THREE.MeshStandardMaterial({ color: col('#1a1a1e'), roughness: 0.6, metalness: 0.4 });

  /* ---------------- road surface, the boardwalk and the bridge deck ---------------- */
  function stripMesh(rows, mat, vScale, colors) {
    const pos = [], uv = [], idx = [], cl = [];
    let dist = 0;
    rows.forEach((r, i) => {
      if (i) dist += r.a.distanceTo(rows[i - 1].a);
      pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale);
      if (colors) { const c = colors[i]; cl.push(c.r, c.g, c.b, c.r, c.g, c.b); }
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.name = 'coastal-road-strip'; m.receiveShadow = true; m.castShadow = mat.userData.cast || false; scene.add(m); return m;
  }
  // walk the lap in runs of the same kind and build one strip per run
  function runs(keyOf, build) {
    let i0 = 0; while (keyOf(i0) === keyOf((i0 - 1 + NR) % NR) && i0 < NR - 1) i0++;
    let cur = keyOf(i0), list = [];
    for (let n = 0; n <= NR; n++) {
      const i = (i0 + n) % NR, k = keyOf(i);
      if (k !== cur) { list.push(i); if (cur !== null) build(cur, list); cur = k; list = []; }
      list.push(i);
    }
    if (cur !== null && list.length > 1) build(cur, list);
  }
  const ROAD = new THREE.MeshStandardMaterial({ map: roadTex, emissiveMap: roadGlow, emissive: col('#ffffff'), emissiveIntensity: 0.7, vertexColors: true, roughness: 0.75, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const CONC = new THREE.MeshStandardMaterial({ color: col('#9c9a96'), roughness: 0.9, side: THREE.DoubleSide });
  CONC.userData.cast = true;
  const WOOD = new THREE.MeshStandardMaterial({ color: col('#5a3e26'), roughness: 0.9 });
  {
    const tone = { v: col('#d8d4cc'), f: col('#bca98a'), k: col('#dcd2c4'), q: col('#e0d0b0'), s: col('#c8c8cc'), u: col('#c8c8cc'), b: col('#c8c8cc') };
    // one closed ribbon with tones blended across the joins
    const list = [...Array(NR + 1).keys()].map(i => i % NR);
    stripMesh(list.map(i => ({ a: roadAt(i, -hwL[i], 0.12), b: roadAt(i, hwR[i], 0.12) })), ROAD, 20, list.map(i => {
      const c = new THREE.Color(0, 0, 0); for (let j = -12; j <= 12; j++) c.add(tone[SEG[(i + j + NR) % NR]]); return c.multiplyScalar(1 / 25);
    }));
    // fascia and underside wherever the road is up in the air (not the boardwalk)
    runs(i => (elev[i] && SEG[i] !== 'f' ? 'e' : null), (k, l) => {
      const L = l.map(i => roadAt(i, -hwL[i] - 0.4, 0.15)), Rr = l.map(i => roadAt(i, hwR[i] + 0.4, 0.15));
      stripMesh(L.map(a => ({ a, b: a.clone().setY(a.y - 1.9) })), CONC, 6); stripMesh(Rr.map(a => ({ a, b: a.clone().setY(a.y - 1.9) })), CONC, 6);
      stripMesh(l.map((_, j) => ({ a: L[j].clone().setY(L[j].y - 1.9), b: Rr[j].clone().setY(Rr[j].y - 1.9) })), CONC, 6);
    });
    // the boardwalk deck under the palafitos road
    runs(i => (SEG[i] === 'f' ? 'f' : null), (k, l) => {
      stripMesh(l.map(i => ({ a: roadAt(i, -hwL[i] - 0.6, -0.2), b: roadAt(i, hwR[i] + 0.6, -0.2) })), WOOD, 6);
    });
  }

  /* ---------------- instanced boxes and beams ---------------- */
  const _bx = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
  const placeBeam = (a, b, tx, tz) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length(); dir.normalize();
    _bx.crossVectors(dir, UP); if (_bx.lengthSq() < 1e-6) _bx.set(1, 0, 0); _bx.normalize(); _bz.crossVectors(_bx, dir).normalize();
    _bm.makeBasis(_bx, dir, _bz); d.quaternion.setFromRotationMatrix(_bm); d.position.copy(a).addScaledVector(dir, len / 2); d.scale.set(tx, len, tz); d.updateMatrix(); return d.matrix.clone();
  };
  const beams = { conc: [], wood: [], iron: [], yellow: [], white: [] };
  const inst = { box: [], boxLit: [], cyl: [], sphere: [], crowdBody: [], crowdHead: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const yawOf = v => Math.atan2(v.x, v.z);
  const addBox = (p, s, yaw, color, lit) => push(lit ? inst.boxLit : inst.box, p, qYaw(yaw), S.copy(s), col(color));
  const mat4 = (x, y, z, yaw = 0, s = 1, sy = s) => { d.position.set(x, y, z); d.quaternion.copy(qYaw(yaw)); d.scale.set(s, sy, s); d.updateMatrix(); return d.matrix.clone(); };
  const freeOf = (x, z, m) => { const r = sampleR(RR, x, z); return !(r.i >= 0 && r.dist < hwR[r.i] + m); };

  /* ---------------- vegetation: library palms and shade trees ---------------- */
  const palm = (x, z, y0, tall = 1) => vegetation.add('palm', x, z, y0 ?? groundH(x, z), tall, sampleR(RR, x, z).dist);
  const tree = (x, z, big) => vegetation.add(big ? 'tree' : 'mango', x, z, groundH(x, z), big ? 0.8 : 0.9, sampleR(RR, x, z).dist);
  function tries(n, fn) { for (let i = 0, k = 0; i < n && k < n * 30; k++) if (fn()) i++; }

  /* ---- parapets, plank posts, piers, lamps along the lap ---- */
  const towerIdx = BR.towers.t.map(bridgeIndex);
  {
    const step = Math.round(4 / STEP);
    for (const side of [-1, 1]) {
      let prev = null;
      for (let i = 0; i < NR; i += step) {
        const s = SEG[i];
        if (s === 'f') { prev = null; const p = roadAt(i, side * (lateralHW(i, side) + 0.4), 0); beams.wood.push(placeBeam(p.clone().setY(-3), p.clone().setY(p.y + 0.9), 0.24, 0.24)); continue; }
        if (!elev[i]) { prev = null; continue; }
        const top = roadAt(i, side * (lateralHW(i, side) + 0.3), 1.0);
        if (prev && prev.distanceTo(top) < 8) beams.conc.push(placeBeam(prev.clone().setY(prev.y - 0.5), top.clone().setY(top.y - 0.5), 0.45, 1.1));
        prev = top;
      }
    }
    // piers: pairs of slim columns under the bridge, single columns under the ramps
    let acc = 0;
    for (let i = 0; i < NR; i++) {
      if (!BRIDGE[SEG[i]]) { acc = 0; continue; }
      acc += STEP; if (acc < BR.pierEvery) continue; acc = 0;
      if (towerIdx.some(t => Math.abs(t - i) * STEP < 9)) continue;
      const f = roadFrame(i), top = roadY[i] - 1.9;
      for (const o of [-9, 9]) { const p = f.p.clone().addScaledVector(f.n, o), g = Math.max(base(p.x, p.z), -3); beams.conc.push(placeBeam(p.clone().setY(g - 1), p.clone().setY(top), 2.0, 2.4)); }
      beams.conc.push(placeBeam(f.p.clone().addScaledVector(f.n, -14).setY(top - 0.9), f.p.clone().addScaledVector(f.n, 14).setY(top - 0.9), 1.8, 2.6));
    }
    for (let i = 0; i < NR; i += Math.round(22 / STEP)) {
      if (!elev[i] || BRIDGE[SEG[i]] || SEG[i] === 'f') continue;
      const p = roadAt(i, 0, -1.9), g = Math.max(base(p.x, p.z), -3); if (p.y - g < 2) continue;
      beams.conc.push(placeBeam(p.clone().setY(g - 1), p, 2.4, 2.4));
    }
    // street lamps: tall arms over the bridge and ramps, globes on the city loop; pools of light on the road
    let lastSide = 1; acc = 0;
    for (let i = 0; i < NR; i++) {
      const s = SEG[i]; acc += STEP;
      const every = BRIDGE[s] ? BR.lampEvery : s === 'v' ? 18 : 30;
      if (acc < every || s === 'f' || s === 'k' || s === 'q') continue;
      acc = 0;
      const sides = BRIDGE[s] || s === 'v' ? [-1, 1] : [lastSide = -lastSide];
      for (const side of sides) {
        const f = roadFrame(i), base0 = roadAt(i, side * (lateralHW(i, side) + (elev[i] ? 0.6 : 1.4)), 0);
        if (!elev[i]) base0.y = groundH(base0.x, base0.z);
        if (s === 'v') {
          // a black iron post with a pair of globes
          const p = side > 0 ? roadAt(i, hwR[i] + 5.5, 0) : base0; if (side > 0) p.y = groundH(p.x, p.z);
          push(inst.cyl, p, Q, S.set(0.12, 4.6, 0.12), col('#141414'));
          for (const o of [-0.6, 0.6]) { const g = p.clone().addScaledVector(f.t, o).setY(p.y + 4.4); push(inst.sphere, g, Q, S.set(0.32, 0.32, 0.32), null); addGlow(g, '#ffc078', 1.1); }
          addPool(roadAt(i, side * (lateralHW(i, side) - 2.5), 0.16), 9, '#ffb060', 0.8);
        } else {
          const H = 10, top = base0.clone().setY(base0.y + H), arm = top.clone().addScaledVector(f.n, -side * 3.2);
          beams.iron.push(placeBeam(base0.clone().setY(base0.y - 0.2), top, 0.22, 0.22)); beams.iron.push(placeBeam(top, arm, 0.14, 0.14));
          const lampP = arm.clone().setY(arm.y - 0.25); push(inst.box, lampP, qYaw(yawOf(f.n)), S.set(0.5, 0.18, 1.1), col('#fff1c8')); inst.box[inst.box.length - 1].lamp = true;
          addGlow(lampP, '#ffb05a', 1.4); addPool(roadAt(i, side * (lateralHW(i, side) - 3), 0.16), 11, '#ff9a40', 0.75);
        }
      }
    }
  }

  /* ---- the six A-frame towers, each lit a different colour, with stays down to the deck ---- */
  const towerMats = [];
  {
    const T = BR.towers, stays = [];
    towerIdx.forEach((i, k) => {
      const f = roadFrame(i), a = f.p.clone().setY(0), r = f.n, dirA = f.t, deck = roadY[i], top = deck + T.height, g = -3;
      const m = new THREE.MeshStandardMaterial({ color: col('#18181c'), emissive: col(T.colors[k]), emissiveIntensity: 0.9, roughness: 0.6 }); towerMats.push(m);
      const legs = [];
      for (const s of [-1, 1]) {
        const b0 = a.clone().addScaledVector(r, s * T.base).setY(g), b1 = a.clone().addScaledVector(r, s * T.top).setY(top);
        legs.push(placeBeam(b0, b1, 2.4, 3.2));
        // the X under the deck, like the real piers
        legs.push(placeBeam(a.clone().addScaledVector(r, s * T.base * 0.9).setY(g), a.clone().addScaledVector(r, -s * 4).setY(deck - 2.2), 1.6, 2.4));
        for (const o of [-1, 1]) for (const z of [0.25, 0.55, 0.85]) {
          const j = (i + o * Math.round(z * 36 / STEP) + NR) % NR;
          stays.push(a.clone().addScaledVector(r, s * T.top).setY(top - 2), roadAt(j, s * 13.6).setY(roadY[j] + 1));
        }
        addGlow(a.clone().addScaledVector(r, s * T.base).setY(1.5), T.colors[k], 7);
        addGlow(a.clone().addScaledVector(r, s * (T.top + 1)).setY(top - 10), T.colors[k], 5);
      }
      legs.push(placeBeam(a.clone().addScaledVector(r, -T.top - 1).setY(top), a.clone().addScaledVector(r, T.top + 1).setY(top), 2.6, 3.4));
      legs.push(placeBeam(a.clone().addScaledVector(r, -T.top - 2.5).setY(top - 14), a.clone().addScaledVector(r, T.top + 2.5).setY(top - 14), 1.6, 2.4));
      legs.push(placeBeam(a.clone().addScaledVector(r, -15).setY(deck - 2.6), a.clone().addScaledVector(r, 15).setY(deck - 2.6), 2.0, 3.0));
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), m, legs.length); legs.forEach((mm, n) => im.setMatrixAt(n, mm)); im.castShadow = true; scene.add(im);
      // red warning lamps on top
      for (const s of [-1, 1]) addGlow(a.clone().addScaledVector(r, s * T.top).setY(top + 2), '#ff3020', 2.2);
      void dirA;
    });
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(stays), new THREE.LineBasicMaterial({ color: col('#c8d0e8'), transparent: true, opacity: 0.7 })));
  }

  /* ---------------- La Vereda del Lago: low wall over the water, palms, the start gantry ---------------- */
  {
    let prev = null;
    for (let k = 0; k <= NSH; k++) {
      const p = SHP[k]; if (p.x < -175 || p.x > 300) { prev = null; continue; }
      const q = p.clone().setY(LAND + 0.55); q.z -= 1.2;
      if (!freeOf(q.x, q.z, 3)) { prev = null; continue; }
      if (prev && prev.distanceTo(q) < 4) beams.white.push(placeBeam(prev, q, 0.5, 1.1));
      if (k % 6 === 0) prev = q; else if (!prev) prev = q;
    }
    for (let x = -150; x < 290; x += 11) { const z = shoreZ(x) - 6 + rr(-1, 1); if (freeOf(x, z, 3)) palm(x, z, undefined, rr(0.85, 1.1)); }
    for (let x = -150; x < 290; x += 9) { const z = rr(-26, -14); if (freeOf(x, z, 3.5)) rand() < 0.5 ? palm(x, z) : tree(x, z, rand() < 0.3); }
    // the start gantry over the line: two posts and a lit banner across the road
    const i0 = Math.round(0.015 * NR), f0 = roadFrame(i0), q0 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f0.n, UP, f0.t.clone().negate()));
    const bannerTex = canvasTex(1024, 160, (c, w, h) => {
      c.fillStyle = '#10163a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffc23a'; c.lineWidth = 8; c.strokeRect(8, 8, w - 16, h - 16);
      c.font = 'bold 88px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffd25a'; c.fillText('PANA MARACAIBO', w / 2, h / 2 + 4);
      for (let x = 30; x < w; x += 46) { c.fillStyle = '#ffe9b0'; c.beginPath(); c.arc(x, 22, 6, 0, TAU); c.arc(x, h - 22, 6, 0, TAU); c.fill(); }
    });
    const bm = new THREE.MeshStandardMaterial({ map: bannerTex, emissiveMap: bannerTex, emissive: col('#ffffff'), emissiveIntensity: 0.9 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(19, 2.6, 0.4), [DARK, DARK, DARK, DARK, bm, bm]); banner.position.copy(roadAt(i0, 0, 8)); banner.quaternion.copy(q0); scene.add(banner);
    for (const s of [-1, 1]) { const b = roadAt(i0, s * 9.6, 0); beams.iron.push(placeBeam(b.clone().setY(b.y - 0.2), b.clone().setY(b.y + 9.4), 0.5, 0.5)); addGlow(b.clone().setY(b.y + 9.6), '#ffe0a0', 2); }
  }

  /* ---------------- Los palafitos: stilt houses over the water, plank walkways, a lamp in each doorway ---------------- */
  const peneroGeo = (() => {
    const N = 16, pos = [], idx = [], cl = [], L = 7.2, white = col('#d8d4cc'), bottom = col('#2f52a8');
    for (let j = 0; j <= N; j++) {
      const t = j / N, w = 0.95 * Math.pow(Math.sin(PI * (0.5 + 0.5 * t)), 0.6), top = 0.78 + 0.35 * t * t, bot = 0.05 + 0.28 * t * t * t, zz = -L / 2 + t * L;
      [[-w, top], [-w * 0.82, 0.32 + bot * 0.6], [0, bot], [w * 0.82, 0.32 + bot * 0.6], [w, top]].forEach(([x, yy]) => { pos.push(x, yy, zz); const c = yy < 0.36 ? bottom : white; cl.push(c.r, c.g, c.b); });
      if (j) for (let k = 0; k < 4; k++) { const a = (j - 1) * 5 + k, b = a + 5; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const HULL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
  const boats = [];
  {
    const P = MAP.palafitos, houses = [], TIN = new THREE.MeshStandardMaterial({ map: tinTex, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide });
    const roofs = [];
    const ok = (x, z, m = 10) => freeOf(x, z, m) && base(x, z) < -0.5 && !houses.some(h => Math.hypot(h[0] - x, h[1] - z) < 11);
    for (let i = 0; i < NR && houses.length < P.houses; i += Math.round(12 / STEP)) {
      if (SEG[i] !== 'f') continue;
      for (const side of [-1, 1]) {
        const f = roadFrame(i), dpt = rr(6, 8), off = lateralHW(i, side) + 3.2 + dpt / 2, c = roadAt(i, side * off, 0); c.y = 0;
        if (!ok(c.x, c.z, dpt / 2 + 2.5) || rand() < 0.15) continue;
        const yaw = yawOf(f.n.clone().multiplyScalar(-side)), w = rr(6.5, 9), fy = 2.0, h = rr(3, 3.6), color = pick(P.colors);
        houses.push([c.x, c.z]);
        const fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), right = V3(Math.cos(yaw), 0, -Math.sin(yaw));
        for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) beams.wood.push(placeBeam(c.clone().addScaledVector(right, sx * w * 0.45).addScaledVector(fwd, sz * dpt * 0.45).setY(-3), c.clone().addScaledVector(right, sx * w * 0.45).addScaledVector(fwd, sz * dpt * 0.45).setY(fy), 0.28, 0.28));
        push(inst.boxLit, c.clone().setY(fy + 0.1), qYaw(yaw), S.set(w + 2, 0.2, dpt + 3), col('#6a4a30'));
        push(inst.boxLit, c.clone().setY(fy + h / 2 + 0.2), qYaw(yaw), S.set(w, h, dpt), col(color).offsetHSL(0, -0.08, -0.05));
        roofs.push(mat4(c.x, fy + h + 0.5, c.z, yaw + PI / 2, 1)); roofs[roofs.length - 1].dims = [dpt + 1.6, w + 1.2];
        // porch towards the boardwalk, an open lit doorway, a window
        const front = c.clone().addScaledVector(fwd, dpt / 2 + 0.05);
        push(inst.box, front.clone().setY(fy + 1.25), qYaw(yaw), S.set(1.1, 2.1, 0.12), col('#ffcf88')); inst.box[inst.box.length - 1].lamp = true;
        push(inst.box, front.clone().addScaledVector(right, w * 0.28).setY(fy + 1.6), qYaw(yaw), S.set(1.2, 0.9, 0.1), col(rand() < 0.6 ? '#ffd890' : '#2a2a30')); if (rand() < 0.6) inst.box[inst.box.length - 1].lamp = true;
        const lampP = front.clone().addScaledVector(fwd, 0.4).setY(fy + 2.6); addGlow(lampP, '#ffb860', 1.6); addPool(front.clone().addScaledVector(fwd, 1.4).setY(fy + 0.25), 4.5, '#ffaa50', 1);
        // planks from the porch towards the boardwalk, stopping at its rail
        const r0 = roadAt(i, side * (lateralHW(i, side) + 0.8), 0), mid = front.clone().lerp(r0, 0.5).setY(fy + 0.15), len = front.distanceTo(r0);
        push(inst.boxLit, mid, qYaw(yaw), S.set(1.6, 0.15, len), col('#6a4a30'));
        if (rand() < 0.6) { const bp = c.clone().addScaledVector(fwd, -dpt / 2 - 3).addScaledVector(right, rr(-2, 2)).setY(0.05); boats.push({ p: bp, yaw: yaw + PI / 2 + rr(-0.3, 0.3) }); }
      }
    }
    // a second row further out on the water
    for (let k = 0; k < 10; k++) { const x = rr(330, 470), z = rr(56, 90); if (!ok(x, z)) continue; houses.push([x, z]); const yaw = PI + rr(-0.2, 0.2), w = rr(6, 8), dpt = rr(6, 7), h = 3.2; for (const sx of [-1, 1]) for (const sz of [-1, 1]) beams.wood.push(placeBeam(V3(x + sx * w * 0.45, -3, z + sz * dpt * 0.45), V3(x + sx * w * 0.45, 2, z + sz * dpt * 0.45), 0.28, 0.28)); push(inst.boxLit, V3(x, 2.1, z), qYaw(yaw), S.set(w + 2, 0.2, dpt + 2), col('#6a4a30')); push(inst.boxLit, V3(x, 2 + h / 2 + 0.2, z), qYaw(yaw), S.set(w, h, dpt), col(pick(P.colors)).offsetHSL(0, -0.08, -0.05)); roofs.push(mat4(x, 2 + h + 0.5, z, yaw + PI / 2, 1)); roofs[roofs.length - 1].dims = [dpt + 1.4, w + 1.2]; addGlow(V3(x, 4.6, z - dpt / 2 - 0.5), '#ffb860', 1.5); push(inst.box, V3(x, 3.2, z - dpt / 2 - 0.05), qYaw(yaw), S.set(1.1, 2.1, 0.12), col('#ffcf88')); inst.box[inst.box.length - 1].lamp = true; }
    // tin roofs: a shallow gable, instanced
    const rs = new THREE.Shape(); rs.moveTo(-0.5, 0); rs.lineTo(0.5, 0); rs.lineTo(0, 0.18); rs.closePath();
    const rg = new THREE.ExtrudeGeometry(rs, { depth: 1, bevelEnabled: false }); rg.translate(0, 0, -0.5);
    if (roofs.length) { const rim = new THREE.InstancedMesh(rg, TIN, roofs.length); roofs.forEach((m, i) => { const [a, b] = m.dims; rim.setMatrixAt(i, m.clone().multiply(new THREE.Matrix4().makeScale(a, a, b))); }); rim.castShadow = true; scene.add(rim); }
    for (const [bx, bzz] of [[300, -14], [320, -20], [470, -24], [500, -2]]) for (let k = 0; k < 4; k++) { const p = V3(bx + rr(-6, 6), 0.05, bzz + 6 + rr(-2, 4)); if (freeOf(p.x, p.z, 4)) boats.push({ p, yaw: rr(0, TAU) }); }
    // mangrove and palms on the shore behind
    tries(70, () => { const x = rr(300, 520), z = rr(-40, -16); if (!freeOf(x, z, 4)) return false; rand() < 0.4 ? palm(x, z) : tree(x, z, false); return true; });
  }

  /* ---------------- El casco: one-storey colonial houses, each a different bright colour, iron lamps, yellow kerbs ---------------- */
  const grilleTex = canvasTex(64, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffcf80'); g.addColorStop(1, '#c87a30'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, 6); c.fillRect(0, h - 6, w, 6); c.fillRect(0, 0, 6, h); c.fillRect(w - 6, 0, 6, h); for (let x = 12; x < w - 6; x += 10) c.fillRect(x, 0, 3, h); for (let y = 30; y < h; y += 34) c.fillRect(0, y, w, 3); });
  const grilleGlow = canvasTex(64, 128, (c, w, h) => { c.fillStyle = '#000'; c.fillRect(0, 0, w, h); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffcf80'); g.addColorStop(1, '#a85a20'); c.fillStyle = g; c.fillRect(6, 6, w - 12, h - 12); c.fillStyle = '#000'; for (let x = 12; x < w - 6; x += 10) c.fillRect(x, 0, 3, h); for (let y = 30; y < h; y += 34) c.fillRect(0, y, w, 3); });
  const GRILLE = new THREE.MeshStandardMaterial({ map: grilleTex, emissiveMap: grilleGlow, emissive: col('#ffffff'), emissiveIntensity: 0.9, roughness: 0.6 });
  const grilles = [], doors = [];
  const CA = MAP.casco;
  const inCasco = (x, z) => x > CA.x0 && x < CA.x1 && z > CA.z0 && z < CA.z1;
  const BAS = MAP.basilica, nearBas = (x, z, m = 0) => Math.abs(x - BAS.x) < 26 + m && z < BAS.z + 8 + m && z > BAS.z - 46 - m;
  function coloniaHouse(p, yaw, w, color) {
    const y = groundH(p.x, p.z) - 0.1, h = rr(5.2, 6.4), dpt = 12, fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), right = V3(Math.cos(yaw), 0, -Math.sin(yaw)), q = qYaw(yaw);
    const back = p.clone().addScaledVector(fwd, -dpt / 2);
    push(inst.boxLit, back.clone().setY(y + h / 2), q, S.set(w, h, dpt), col(color));
    push(inst.boxLit, p.clone().addScaledVector(fwd, 0.1).setY(y + 0.45), q, S.set(w + 0.05, 0.9, 0.3), col(color).offsetHSL(0, 0, -0.15));
    push(inst.boxLit, p.clone().addScaledVector(fwd, 0.15).setY(y + h - 0.35), q, S.set(w + 0.3, 0.7, 0.45), col('#f4f0e6'));
    push(inst.boxLit, p.clone().addScaledVector(fwd, -0.1).setY(y + h + 0.45), q, S.set(w, 0.9, 0.3), col(rand() < 0.5 ? color : '#f4f0e6'));
    for (const s of [-1, 1]) push(inst.boxLit, p.clone().addScaledVector(right, s * (w / 2 - 0.25)).addScaledVector(fwd, 0.12).setY(y + h / 2), q, S.set(0.5, h, 0.3), col('#f4f0e6'));
    const nw = w > 8.5 ? 2 : 1;
    for (let k = 0; k < nw; k++) { const o = nw === 1 ? w * 0.22 : (k ? 0.28 : -0.28) * w; d.position.copy(p.clone().addScaledVector(right, o).addScaledVector(fwd, 0.2).setY(y + 2.5)); d.quaternion.copy(q); d.scale.set(1.5, 2.9, 0.25); d.updateMatrix(); grilles.push(d.matrix.clone()); push(inst.boxLit, p.clone().addScaledVector(right, o).addScaledVector(fwd, 0.3).setY(y + 4.15), q, S.set(1.9, 0.35, 0.5), col('#f4f0e6')); }
    const dx = nw === 1 ? -w * 0.2 : 0;
    d.position.copy(p.clone().addScaledVector(right, dx).addScaledVector(fwd, 0.18).setY(y + 1.5)); d.quaternion.copy(q); d.scale.set(1.4, 3.0, 0.2); d.updateMatrix(); doors.push({ m: d.matrix.clone(), c: pick([col('#6a4a2e'), col('#2a6a3a'), col('#1e3a7a'), col('#8a2a22')]) });
    if (rand() < 0.4) push(inst.sphere, p.clone().addScaledVector(fwd, 0.2).addScaledVector(right, dx).setY(y + 4.1), q, S.set(0.38, 0.38, 0.1), null);
    addPool(p.clone().addScaledVector(fwd, 1.6).setY(y + 0.25), 3, '#ffb860', 0.55);
  }
  {
    const placed = [];
    const freeHouse = (x, z) => !placed.some(q => Math.hypot(q[0] - x, q[1] - z) < 5.8);
    for (const side of [-1, 1]) {
      let acc = 0;
      for (let i = 0; i < NR; i++) {
        const s = SEG[i]; if (s !== 'k' && s !== 'q') { acc = 0; continue; }
        acc += STEP; if (acc < 7.4) continue;
        const f = roadFrame(i), off = lateralHW(i, side) + 2.6, p = roadAt(i, side * off, 0), w = rr(6.6, 9.2);
        if (s === 'q' && (inPlaza(p.x, p.z, 2) || nearBas(p.x, p.z, 4))) continue;
        const back = p.clone().addScaledVector(f.n, side * 12);
        if (!freeOf(p.x, p.z, 1.6) || !freeOf(back.x, back.z, 1.6) || !freeHouse(p.x, p.z) || base(p.x, p.z) < 0.5) continue;
        if ([-w / 2, w / 2].some(o => [0, 6, 12].some(depth => { const c = p.clone().addScaledVector(f.t, o).addScaledVector(f.n, side * depth); return !freeOf(c.x, c.z, 2); }))) continue;
        acc = 7.4 - w; placed.push([p.x, p.z]);
        coloniaHouse(p, yawOf(f.n.clone().multiplyScalar(-side)), w, pick(CA.colors));
      }
    }
    tries(120, () => { const x = rr(CA.x0, CA.x1), z = rr(CA.z0, CA.z1); if (!freeOf(x, z, 10) || !freeHouse(x, z) || base(x, z) < 0.5 || placed.some(q => Math.hypot(q[0] - x, q[1] - z) < 12)) return false; placed.push([x, z]); const yaw = pick([0, PI / 2, PI, -PI / 2]); coloniaHouse(V3(x, 0, z), yaw, rr(7, 9.5), pick(CA.colors)); return true; });
    // yellow kerbs, sidewalks, iron lamp posts
    const kerbs = [], walks = [];
    for (const side of [-1, 1]) {
      let prev = null, acc = 0, n = 0;
      for (let i = 0; i < NR; i += 2) {
        const s = SEG[i]; if (s !== 'k' && s !== 'q') { prev = null; continue; }
        const k0 = roadAt(i, side * (lateralHW(i, side) + 0.15), 0.12);
        if (prev && prev.distanceTo(k0) < 3) { kerbs.push(placeBeam(prev, k0, 0.3, 0.3)); walks.push(placeBeam(prev.clone().addScaledVector(roadFrame(i).n, side * 1.1).setY(prev.y - 0.02), k0.clone().addScaledVector(roadFrame(i).n, side * 1.1).setY(k0.y - 0.02), 2.0, 0.2)); }
        prev = k0; acc += 2 * STEP;
        if (acc > 17 && s === 'k') {
          acc = 0; n++;
          if ((n + (side > 0 ? 1 : 0)) % 2) continue;
          const lp = roadAt(i, side * (lateralHW(i, side) + 0.9), 0); lp.y = groundH(lp.x, lp.z);
          push(inst.cyl, lp, Q, S.set(0.11, 4.2, 0.11), col('#121212'));
          const head = lp.clone().setY(lp.y + 4.4); push(inst.box, head, Q, S.set(0.5, 0.7, 0.5), col('#ffe0a0')); inst.box[inst.box.length - 1].lamp = true;
          addGlow(head, '#ffc070', 1.3); addPool(roadAt(i, side * (lateralHW(i, side) - 2), 0.16), 8, '#ffb060', 0.9);
        }
      }
    }
    const IMk = (list, color) => { if (!list.length) return; const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.7, emissive: col(color), emissiveIntensity: color === '#f2c41e' ? 0.25 : 0.02 }), list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.receiveShadow = true; scene.add(im); };
    IMk(kerbs, '#f2c41e'); IMk(walks, '#8a8680');
  }

  /* ---------------- La plaza y la Basílica ---------------- */
  {
    const y0 = 2.6;
    pavTex.repeat.set(PL.w / 8, PL.d / 8);
    const pave = new THREE.Mesh(new THREE.BoxGeometry(PL.w, 0.4, PL.d), new THREE.MeshStandardMaterial({ map: pavTex, roughness: 0.8 }));
    pave.position.set(PL.x, y0 - 0.22, PL.z); pave.receiveShadow = true; scene.add(pave);
    // the Basílica de la Chinita: yellow and white, a pediment, three arched doors, two domed bell towers with clocks
    const B = BAS, g = new THREE.Group(); g.position.set(B.x, y0, B.z); g.rotation.y = B.rot; scene.add(g);
    const yel = new THREE.MeshStandardMaterial({ color: col('#e8b84a'), emissive: col('#ff9a28'), emissiveIntensity: 0.22, roughness: 0.75 });
    const wht = new THREE.MeshStandardMaterial({ color: col('#f2ead6'), emissive: col('#ffd08a'), emissiveIntensity: 0.18, roughness: 0.7 });
    const drk = new THREE.MeshStandardMaterial({ color: col('#2a1a10'), emissive: col('#ff9a40'), emissiveIntensity: 0.5 });
    const outline = [];
    const add = (geo, m, x, y, z, ry = 0) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.rotation.y = ry; mm.castShadow = true; mm.receiveShadow = true; g.add(mm); return mm; };
    const edge = (a, b, n) => { for (let k = 0; k <= n; k++) outline.push(a.clone().lerp(b, k / n)); };
    const F = 4;
    add(new THREE.BoxGeometry(48, 1.2, 8), wht, 0, 0.6, F + 4);
    add(new THREE.BoxGeometry(46, 0.8, 6), wht, 0, 1.4, F + 3.5);
    add(new THREE.BoxGeometry(24, 18, 40), yel, 0, 9, F - 20);
    add(new THREE.BoxGeometry(24.6, 1.0, 1.2), wht, 0, 12, F + 0.3);
    add(new THREE.BoxGeometry(24.6, 0.8, 1.2), wht, 0, 18, F + 0.3);
    for (const x of [-10.5, -6.5, 6.5, 10.5]) add(new THREE.CylinderGeometry(0.7, 0.75, 11, 16), wht, x, 6.5, F + 1.3);
    for (const x of [-10.5, -6.5, 6.5, 10.5]) add(new THREE.BoxGeometry(1.8, 0.6, 1.8), wht, x, 1.4 + 0.3, F + 1.3);
    { const s = new THREE.Shape(); s.moveTo(-12.5, 0); s.lineTo(12.5, 0); s.lineTo(0, 5.2); s.closePath(); const pg = new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false }); add(pg, wht, 0, 12.5, F - 0.2); edge(V3(-12.5, 12.6, F + 1.5), V3(0, 17.8, F + 1.5), 14); edge(V3(0, 17.8, F + 1.5), V3(12.5, 12.6, F + 1.5), 14); }
    add(new THREE.BoxGeometry(14, 6, 1.6), yel, 0, 21, F - 0.6);
    { const s = new THREE.Shape(); s.moveTo(-7, 0); s.lineTo(7, 0); s.lineTo(7, 1); s.absarc(0, 1, 7, 0, PI, false); s.closePath(); const ag = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false }); add(ag, wht, 0, 23.6, F - 1.2); for (let k = 0; k <= 16; k++) { const a = k / 16 * PI; outline.push(V3(Math.cos(a) * 7, 24.6 + Math.sin(a) * 7, F)); } }
    add(new THREE.BoxGeometry(3.2, 4.4, 0.4), drk, 0, 22.6, F + 0.25);
    const statue = (x, y, z, s = 1) => { add(new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 2.4 * s, 10), wht, x, y + 1.2 * s, z); add(new THREE.SphereGeometry(0.4 * s, 10, 8), wht, x, y + 2.7 * s, z); };
    statue(0, 31.4, F - 0.6, 1.1); statue(-7.5, 18.4, F + 0.2); statue(7.5, 18.4, F + 0.2);
    for (const [x, w, h] of [[-8.6, 2.4, 5], [0, 3.4, 7], [8.6, 2.4, 5]]) {
      const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, PI, false); s.closePath();
      add(new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }), drk, x, 1.8, F + 0.1);
      for (let k = 0; k <= 10; k++) { const a = k / 10 * PI; outline.push(V3(x + Math.cos(a) * (w / 2 + 0.3), 1.8 + h - w / 2 + Math.sin(a) * (w / 2 + 0.3), F + 0.6)); }
    }
    for (const x of [-3.8, 3.8]) add(new THREE.CircleGeometry(1.1, 20), drk, x, 15, F + 0.62);
    const clockM = new THREE.MeshStandardMaterial({ color: col('#fff8e8'), emissive: col('#fff0d0'), emissiveIntensity: 1.1 });
    for (const s of [-1, 1]) {
      const tx = s * 16.5;
      add(new THREE.BoxGeometry(9, 26, 9), yel, tx, 13, F - 4);
      for (const y of [10, 18.5, 26]) add(new THREE.BoxGeometry(10, 0.9, 10), wht, tx, y, F - 4);
      for (const x of [-4.3, 4.3]) add(new THREE.BoxGeometry(0.8, 26, 0.8), wht, tx + x, 13, F + 0.4);
      add(new THREE.BoxGeometry(2.0, 4.6, 0.3), drk, tx, 14, F + 0.55);
      add(new THREE.BoxGeometry(2.4, 4.6, 0.3), drk, tx, 22, F + 0.55);
      add(new THREE.CircleGeometry(1.6, 24), clockM, tx, 29, F + 0.56);
      add(new THREE.BoxGeometry(0.12, 1.2, 0.05), DARK, tx, 29.4, F + 0.6); add(new THREE.BoxGeometry(0.9, 0.12, 0.05), DARK, tx + 0.35, 29, F + 0.6);
      add(new THREE.BoxGeometry(8, 6, 8), yel, tx, 29, F - 4); add(new THREE.BoxGeometry(8.8, 0.8, 8.8), wht, tx, 32.4, F - 4);
      add(new THREE.CylinderGeometry(3.6, 3.6, 2.4, 20), yel, tx, 34, F - 4);
      const dome = add(new THREE.SphereGeometry(3.8, 24, 12, 0, TAU, 0, PI / 2), wht, tx, 35.2, F - 4); dome.scale.y = 1.35;
      add(new THREE.CylinderGeometry(0.7, 0.9, 2.2, 10), wht, tx, 41.4, F - 4); add(new THREE.SphereGeometry(0.6, 10, 8), wht, tx, 43, F - 4); add(new THREE.ConeGeometry(0.25, 2, 6), wht, tx, 44.6, F - 4);
      for (const x of [-4.5, 4.5]) edge(V3(tx + x, 1, F + 0.9), V3(tx + x, 32.4, F + 0.9), 36);
      for (const y of [10, 18.5, 26, 32.4]) edge(V3(tx - 5, y + 0.5, F + 1.1), V3(tx + 5, y + 0.5, F + 1.1), 12);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; for (let j = 0; j <= 6; j++) { const b = j / 6 * PI / 2; outline.push(V3(tx + Math.cos(a) * Math.cos(b) * 3.9, 35.2 + Math.sin(b) * 3.9 * 1.35, F - 4 + Math.sin(a) * Math.cos(b) * 3.9)); } }
    }
    edge(V3(-12, 12.6, F + 1.1), V3(12, 12.6, F + 1.1), 24); edge(V3(-12, 18.5, F + 1.1), V3(12, 18.5, F + 1.1), 24);
    for (const x of [-10.5, -6.5, 6.5, 10.5]) edge(V3(x, 1.8, F + 2.1), V3(x, 12, F + 2.1), 10);
    // the strings of light, as one Points object in world space
    const op = outline.map(v => v.clone().applyAxisAngle(UP, B.rot).add(V3(B.x, y0, B.z)));
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(op), new THREE.PointsMaterial({ color: col('#fff4d8'), size: 0.9, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    for (const x of [-18, 0, 18]) addGlow(V3(B.x + x, y0 + 0.8, B.z + 20), '#ffd080', 2.2);
    // the gaita stage: a platform under a truss, tamboras, coloured lights
    const ST = MAP.stage, sy = y0;
    addBox(V3(ST.x, sy + 0.7, ST.z), V3(ST.w, 1.4, ST.d), 0, '#2a2028', true);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) beams.iron.push(placeBeam(V3(ST.x + sx * ST.w / 2, sy, ST.z + sz * ST.d / 2), V3(ST.x + sx * ST.w / 2, sy + 8, ST.z + sz * ST.d / 2), 0.35, 0.35));
    for (const sz of [-1, 1]) beams.iron.push(placeBeam(V3(ST.x - ST.w / 2, sy + 8, ST.z + sz * ST.d / 2), V3(ST.x + ST.w / 2, sy + 8, ST.z + sz * ST.d / 2), 0.4, 0.4));
    for (const sx of [-1, 1]) beams.iron.push(placeBeam(V3(ST.x + sx * ST.w / 2, sy + 8, ST.z - ST.d / 2), V3(ST.x + sx * ST.w / 2, sy + 8, ST.z + ST.d / 2), 0.4, 0.4));
    addBox(V3(ST.x, sy + 4.6, ST.z + ST.d / 2 - 0.2), V3(ST.w, 6.2, 0.2), 0, '#3a1a48', true);
    const STAGE_C = ['#ff3a5a', '#ffc23a', '#3a8aff', '#2ae08a', '#ff7a2a', '#d03aff'];
    for (let k = 0; k < 12; k++) addGlow(V3(ST.x - ST.w / 2 + 0.8 + k * (ST.w - 1.6) / 11, sy + 7.7, ST.z - ST.d / 2), STAGE_C[k % 6], 1.6);
    for (let k = 0; k < 4; k++) { const x = ST.x - 5 + k * 3.3; push(inst.cyl, V3(x, sy + 1.4, ST.z), Q, S.set(0.45, 0.9, 0.45), col(['#c0392b', '#e8b321', '#2a6ad0', '#c0392b'][k])); }
    // barriers between the crowd and the road
    const bars = [];
    for (let i = 0; i < NR; i += Math.round(2.2 / STEP)) { if (SEG[i] !== 'q') continue; for (const side of [-1, 1]) { const p = roadAt(i, side * (lateralHW(i, side) + 1.2), 0); if (!inPlaza(p.x, p.z, 4) && !nearBas(p.x, p.z, 6)) continue; const f = roadFrame(i); bars.push(mat4(p.x, y0 + 0.55, p.z, yawOf(f.t) + PI / 2)); } }
    if (bars.length) { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(2.1, 1.1, 0.1), new THREE.MeshStandardMaterial({ color: col('#c8ccd4'), metalness: 0.6, roughness: 0.4 }), bars.length); bars.forEach((m, i) => im.setMatrixAt(i, m)); scene.add(im); }
    // the crowd: little round panas in bright shirts, bouncing to the gaita
    const SH = ['#e8462e', '#ffd21f', '#3d7bf2', '#2a9b5a', '#ffffff', '#f08ab0', '#8a3ac8', '#f08a1f'];
    tries(MAP.crowd, () => {
      const x = rr(PL.x - PL.w / 2 + 2, PL.x + PL.w / 2 - 2), z = rr(PL.z - PL.d / 2 + 2, PL.z + PL.d / 2 - 2);
      if (!freeOf(x, z, 2.6) || (Math.abs(x - ST.x) < ST.w / 2 + 2 && Math.abs(z - ST.z) < ST.d / 2 + 3)) return false;
      const s = rr(0.9, 1.15), yaw = yawOf(V3(ST.x - x, 0, ST.z - z)) + rr(-0.3, 0.3);
      push(inst.crowdBody, V3(x, y0 + 0.8 * s, z), qYaw(yaw), S.set(0.55 * s, 0.75 * s, 0.5 * s), col(pick(SH)));
      push(inst.crowdHead, V3(x, y0 + 1.75 * s, z).add(V3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(0.12)), qYaw(yaw), S.set(0.32 * s, 0.3 * s, 0.44 * s), col('#9a6a3e').offsetHSL(0, 0, rr(-0.05, 0.05)));
      return true;
    });
    for (let k = 0; k < 80; k++) { const x = BAS.x + rr(-20, 20), z = BAS.z + rr(9, 12); if (!freeOf(x, z, 2.6)) continue; const yaw = rr(-0.4, 0.4); push(inst.crowdBody, V3(x, y0 + 1.6, z), qYaw(yaw), S.set(0.55, 0.75, 0.5), col(pick(SH))); push(inst.crowdHead, V3(x, y0 + 2.55, z), qYaw(yaw), S.set(0.42, 0.38, 0.55), col('#9a6a3e')); }
    // fairy lights: strings from a centre mast out to poles round the plaza, and flags
    const mast = V3(PL.x, y0 + 16, PL.z + 4); beams.iron.push(placeBeam(mast.clone().setY(y0), mast, 0.4, 0.4));
    const poles = []; for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, p = V3(PL.x + Math.cos(a) * PL.w * 0.4, y0, PL.z + Math.sin(a) * PL.d * 0.4); if (!freeOf(p.x, p.z, 1.5)) continue; poles.push(p); beams.iron.push(placeBeam(p, p.clone().setY(y0 + 8), 0.2, 0.2)); }
    const FC = ['#ff4a4a', '#ffd23a', '#3aa0ff', '#3aff8a', '#ff8ae0', '#ffffff'];
    poles.forEach((p, k) => { const top = p.clone().setY(y0 + 8); for (let j = 1; j < 26; j++) { const t = j / 26, q = top.clone().lerp(mast, t); q.y -= Math.sin(t * PI) * 2.4; addGlow(q, FC[(j + k) % FC.length], 0.6); } const nx = poles[(k + 1) % poles.length].clone().setY(y0 + 8); for (let j = 1; j < 10; j++) { const t = j / 10, q = top.clone().lerp(nx, t); q.y -= Math.sin(t * PI) * 1.2; addGlow(q, FC[(j + k * 2) % FC.length], 0.6); } });
    const flagTex = canvasTex(64, 40, (c, w, h) => { ['#ffd21f', '#1e5ab8', '#d82a2a'].forEach((cc, k) => { c.fillStyle = cc; c.fillRect(0, k * h / 3, w, h / 3); }); });
    const flags = poles.map((p, k) => mat4(p.x, y0 + 7.4, p.z, k * 0.3, 1));
    const fg = new THREE.PlaneGeometry(2.4, 1.5, 6, 1); fg.translate(1.2, 0, 0);
    if (flags.length) { const fl = new THREE.InstancedMesh(fg, windy(new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, emissive: col('#ffffff'), emissiveMap: flagTex, emissiveIntensity: 0.25 }), 0, 0.5), flags.length); flags.forEach((m, i) => fl.setMatrixAt(i, m)); scene.add(fl); }
    for (let k = 0; k < 16; k++) { const a = rand() * TAU; const x = PL.x + Math.cos(a) * PL.w * 0.6, z = PL.z + Math.sin(a) * PL.d * 0.6; if (freeOf(x, z, 3) && !nearBas(x, z, 2)) palm(x, z, y0); }
  }

  /* ---------------- market boulevard: shops and palm gardens ---------------- */
  {
    const colors = ['#d38a55', '#e5ba69', '#6caaa1', '#da826f', '#e3d1a1'];
    for (let x = 0; x <= 140; x += 20) {
      const z = -205;
      if (!freeOf(x, z, 14)) continue;
      addBox(V3(x, LAND + 4, z), V3(15, 8, 13), 0, colors[(x / 20) % colors.length], true);
      addBox(V3(x, LAND + 3.5, z + 8), V3(15, 0.35, 4), 0, '#e7b34c', true);
      for (const dx of [-4, 4]) { addBox(V3(x + dx, LAND + 2, z + 6.6), V3(2.8, 3, 0.2), 0, '#ffe1a0', true); addGlow(V3(x + dx, LAND + 3.2, z + 8), '#ffce80', 0.8); }
    }
    for (let x = -20; x <= 140; x += 20) for (const z of [-120, -85]) {
      if (freeOf(x, z, 9)) { addBox(V3(x, LAND + 0.2, z), V3(12, 0.4, 12), 0, '#354d39', false); palm(x, z, LAND + 0.4); addBox(V3(x + 5, LAND + 0.7, z), V3(1.2, 0.8, 5), 0, '#ccab7d', false); }
    }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(24, 4), new THREE.MeshBasicMaterial({ map: signTex(['Mercado del Lago'], '#31544b', '#ffe5ad', '#bd9b61'), side: THREE.DoubleSide }));
    board.position.set(70, LAND + 9, -198); scene.add(board);
  }

  /* ---------------- city blocks: streets, sidewalks, shops and courtyards ---------------- */
  {
    const low = windowTex(4, 5, 0.35), tall = windowTex(4, 12, 0.28);
    const roofM = new THREE.MeshStandardMaterial({ color: col('#6a6260'), roughness: 0.9 });
    const lowM = new THREE.MeshStandardMaterial({ map: low.map, emissiveMap: low.emissiveMap, emissive: col('#ffe0ad'), emissiveIntensity: 0.55, roughness: 0.85 });
    const tallM = new THREE.MeshStandardMaterial({ map: tall.map, emissiveMap: tall.emissiveMap, emissive: col('#c8d5ee'), emissiveIntensity: 0.45, roughness: 0.85 });
    const lows = [], talls = [];
    const streetXs = [-156, 180, 340, 550], streetZs = [-470, -340];
    const streetNear = (x, z, m) => streetXs.some(xx => Math.abs(xx - x) < m) || streetZs.some(zz => Math.abs(zz - z) < m);
    const clear = (x, z, r) => !(x > -52 - r && x < 60 + r && z > -336 - r && z < -218 + r) && freeOf(x, z, r + 4) && !inPlaza(x, z, r + 5) && !nearBas(x, z, r + 5) && !inCasco(x, z) && !streetNear(x, z, r + 12);
    // Side streets stop at the race road; the racing surface stays uninterrupted.
    for (const z of streetZs) for (let x = -178; x < 570; x += 4) {
      if (!freeOf(x, z, 1) || nearBas(x, z, 10)) continue;
      addBox(V3(x, LAND + 0.08, z), V3(4.1, 0.16, 13), 0, '#414950', true);
      for (const side of [-1, 1]) if (freeOf(x, z + side * 9, 2)) addBox(V3(x, LAND + 0.18, z + side * 9), V3(4.1, 0.36, 4), 0, '#a19681', true);
    }
    for (const x of streetXs) for (let z = -490; z < -205; z += 4) {
      if (!freeOf(x, z, 1) || nearBas(x, z, 16) || inPlaza(x, z, 12) || inCasco(x, z)) continue;
      addBox(V3(x, LAND + 0.09, z), V3(13, 0.18, 4.1), 0, '#414950', true);
      for (const side of [-1, 1]) if (freeOf(x + side * 9, z, 2)) addBox(V3(x + side * 9, LAND + 0.19, z), V3(4, 0.38, 4.1), 0, '#a19681', true);
    }
    for (let z = -440; z <= -230; z += 35) for (let x = -120; x <= 510; x += 35) {
      if (!clear(x, z, 17)) continue;
      const w = rr(18, 25), depth = rr(17, 23), h = rr(7, 17), c = pick(['#d6a183', '#e08268', '#8cc4bd', '#e4c886', '#a49cde', '#f0b0c0']);
      lows.push({ m: mat4(x, LAND + h / 2, z), s: [w, h, depth], c: col(c) });
      addBox(V3(x, LAND + h + 0.3, z), V3(w + 0.7, 0.6, depth + 0.7), 0, '#c6b89c', true);
      addBox(V3(x, LAND + 2.8, z + depth / 2 + 1), V3(w * 0.8, 0.3, 2.8), 0, pick(['#698879', '#b27654', '#baab76']), true);
      addBox(V3(x, LAND + 1.4, z + depth / 2 + 0.12), V3(2.3, 2.8, 0.2), 0, '#efd09a', true);
      if (rand() < 0.55) addBox(V3(x + 3, LAND + h + 1.2, z - 3), V3(3, 1.8, 3), 0, '#7d858a', false);
    }
    for (const [x, z, h] of [[400, -405, 42], [472, -405, 56], [510, -440, 34], [230, -430, 29]]) {
      if (!clear(x, z, 18)) continue;
      talls.push({ m: mat4(x, LAND + h / 2, z), s: [23, h, 23], c: col('#9dadaa') });
      addGlow(V3(x, LAND + h + 1, z), '#ff6550', 0.9);
    }
    const renderBlocks = (list, material) => { if (!list.length) return; const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [material, material, roofM, roofM, material, material], list.length); list.forEach((b, i) => { mesh.setMatrixAt(i, b.m.clone().multiply(new THREE.Matrix4().makeScale(...b.s))); mesh.setColorAt(i, b.c); }); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); };
    renderBlocks(lows, lowM); renderBlocks(talls, tallM);
    const paving = new THREE.MeshStandardMaterial({ color: col('#a19379'), emissive: col('#514936'), emissiveIntensity: 0.35, roughness: 1, side: THREE.DoubleSide });
    runs(i => (SEG[i] === 'v' ? 'sidewalk' : null), (_, list) => {
      for (const side of [-1, 1]) stripMesh(list.map(i => ({ a: roadAt(i, side * 9.3, 0.14), b: roadAt(i, side * 13.5, 0.14) })), paving, 8);
    });
    // a planted civic square enclosed by the city loop
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(96, 112), new THREE.MeshStandardMaterial({ color: col('#4f8a46'), emissive: col('#30492e'), emissiveIntensity: 0.55, roughness: 1 })); lawn.rotation.x = -PI / 2; lawn.position.set(8, LAND + 0.26, -277); scene.add(lawn);
    addBox(V3(8, LAND + 0.12, -277), V3(96, 0.24, 112), 0, '#6d7964', true);
    for (const x of [-24, 40]) for (let z = -318; z <= -238; z += 20) { palm(x, z, LAND + 0.2); addBox(V3(x + 6, LAND + 0.7, z), V3(1.3, 0.8, 5), 0, '#d1b28b', true); }
    addBox(V3(8, LAND + 0.3, -277), V3(7, 0.25, 112), 0, '#c6b38e', true);
    const fountain = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 1, 40), new THREE.MeshStandardMaterial({ color: col('#a5bbb3'), roughness: 0.5 })); fountain.position.set(8, LAND + 0.7, -277); scene.add(fountain);
    const water = new THREE.Mesh(new THREE.CircleGeometry(9.5, 40), new THREE.MeshStandardMaterial({ color: col('#59b6bd'), emissive: col('#237582'), emissiveIntensity: 0.8, roughness: 0.2 })); water.rotation.x = -PI / 2; water.position.set(8, LAND + 1.22, -277); scene.add(water);
    for (const [x, z] of [[-24, -318], [40, -318], [-24, -238], [40, -238]]) { addGlow(V3(x, LAND + 7, z), '#ffe1a3', 1); addPool(V3(x, LAND + 0.45, z), 14, '#ffd890', 0.8); addBox(V3(x, LAND + 3.5, z), V3(0.25, 7, 0.25), 0, '#414a47', false); }
    for (let z = -440; z < -225; z += 24) for (const x of [165, 355, 535]) { if (!freeOf(x, z, 4) || nearBas(x, z, 18) || inPlaza(x, z, 10) || inCasco(x, z)) continue; palm(x, z, LAND); addGlow(V3(x, LAND + 4, z), '#ffd59c', 0.8); }
  }

  /* ---------------- the lake: oil pumps, platforms with red lamps, gas flares far away, boats ---------------- */
  const pumps = [], blinkers = [], flares = [];
  {
    const PUMP = new THREE.MeshStandardMaterial({ color: col('#4a4a46'), roughness: 0.6, metalness: 0.5 }), YEL = new THREE.MeshStandardMaterial({ color: col('#e8b820'), emissive: col('#806010'), emissiveIntensity: 0.3, roughness: 0.6 });
    const deckM = new THREE.MeshStandardMaterial({ color: col('#5a5a58'), roughness: 0.9 });
    for (const [x, z] of MAP.pumps) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rr(0, TAU); scene.add(g);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 8), deckM); deck.position.y = 2.2; g.add(deck);
      for (const sx of [-4, 4]) for (const sz of [-3, 3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5, 6), PUMP); p.position.set(sx, -0.3, sz); g.add(p); }
      for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.4, 0.3), PUMP); leg.position.set(0, 4.9, s * 1.1); leg.rotation.x = -s * 0.2; g.add(leg); }
      const beam = new THREE.Group(); beam.position.set(0, 7.6, 0); g.add(beam);
      beam.add(new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 0.5), YEL));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.2, 0.9), YEL); head.position.set(3.6, -0.6, 0); beam.add(head);
      const cw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 0.8), PUMP); cw.position.set(-3.2, -2.4, 0); g.add(cw);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5, 4), PUMP); rod.position.set(3.9, 4.6, 0); g.add(rod);
      g.traverse(o => { if (o.isMesh) o.castShadow = true; });
      pumps.push({ beam, rod, ph: rand() * TAU, sp: rr(0.7, 1.0) });
      blinkers.push(V3(x, 9.6, z));
    }
    tries(MAP.platforms, () => { const x = rr(-1500, 1300), z = rr(160, 1350); if (!freeOf(x, z, 28) || (x > -150 && x < 380 && z < 430)) return false; const s = rr(0.8, 1.4); addBox(V3(x, 3 * s, z), V3(14 * s, 1.2, 10 * s), rand() * PI, '#3a3a40'); addBox(V3(x, 7 * s, z), V3(2, 8 * s, 2), 0, '#3a3a40'); blinkers.push(V3(x, 11.5 * s, z)); return true; });
    const flameTex = canvasTex(64, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.6, h * 0.5); g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.3, 'rgba(255,170,60,0.9)'); g.addColorStop(1, 'rgba(255,60,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const flameM = new THREE.SpriteMaterial({ map: flameTex, color: col('#ffffff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const [x, z] of MAP.flares) { addBox(V3(x, 20, z), V3(2.5, 40, 2.5), 0, '#2a2a30'); const sp = new THREE.Sprite(flameM); sp.position.set(x, 50, z); sp.scale.set(20, 40, 1); scene.add(sp); flares.push(sp); }
  }
  const blinkPts = new THREE.Points(new THREE.BufferGeometry().setFromPoints(blinkers), new THREE.PointsMaterial({ color: col('#ff2a1a'), size: 3.2, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(blinkPts);
  // lanchas with a lamp, moving slowly on fixed loops
  const lanchas = MAP.lanchas.map((L, k) => {
    const g = new THREE.Group(); const hull = new THREE.Mesh(peneroGeo, HULL); hull.scale.set(1.2, 1, 1.3); g.add(hull);
    const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col(k % 2 ? '#ffd890' : '#ffffff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); lamp.position.set(0, 2.2, 3); lamp.scale.set(5, 5, 1); g.add(lamp);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 4), DARK); pole.position.set(0, 1.4, 3); g.add(pole);
    scene.add(g); return { g, ...L, ph: k / MAP.lanchas.length };
  });
  if (boats.length) { const im = new THREE.InstancedMesh(peneroGeo, HULL, boats.length); boats.forEach((b, i) => im.setMatrixAt(i, mat4(b.p.x, b.p.y, b.p.z, b.yaw, 1))); im.castShadow = true; scene.add(im); }

  /* ---------------- far shore lights, the moon and the stars ---------------- */
  {
    const pts = []; for (let k = 0; k < MAP.farShore.lights; k++) pts.push(V3(rr(-4000, 4000), rr(2, 8), MAP.farShore.z + rr(-20, 120)));
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: col('#ffc890'), size: 7, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    const ms = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, color: col('#ffffff'), transparent: true, depthWrite: false, fog: false })); ms.position.copy(MOON_DIR).multiplyScalar(3400).add(CENTER); ms.scale.set(MAP.moon.size * 2.2, MAP.moon.size * 2.2, 1); scene.add(ms);
    const stars = [];
    for (let k = 0; k < 1400; k++) { const u = rr(0.08, 1), th = rand() * TAU, r = Math.sqrt(1 - u * u); stars.push(V3(r * Math.cos(th), u, r * Math.sin(th)).multiplyScalar(3500).add(CENTER)); }
    scene.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(stars), new THREE.PointsMaterial({ color: col('#dfe6ff'), size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false })));
  }

  /* ---------------- Catatumbo: storm clouds and branching bolts on the horizon, flashes on the race clock ---------------- */
  const LZ = MAP.lightning, bolts = [], boltGeos = [], storm = [];
  {
    const R = rng(MAP.seed * 7 + 11);
    for (let b = 0; b < 30; b++) {
      const pos = [], idx = [];
      const seg = (a, c, w) => { const dx = c.x - a.x, dy = c.y - a.y, L = Math.hypot(dx, dy), nx = -dy / L * w, ny = dx / L * w, o = pos.length / 3; pos.push(a.x - nx, a.y - ny, 0, a.x + nx, a.y + ny, 0, c.x + nx * 0.7, c.y + ny * 0.7, 0, c.x - nx * 0.7, c.y - ny * 0.7, 0); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
      const grow = (p, dir, len, w, depth) => {
        let cur = p.clone();
        while (cur.y > 0 && len > 0) {
          const step = 25 + R() * 45, ang = dir + (R() - 0.5) * 0.9, nxt = new THREE.Vector2(cur.x + Math.sin(ang) * step, cur.y - Math.cos(ang) * step);
          if (nxt.y < 0) nxt.y = 0;
          seg(cur, nxt, w); cur = nxt; len -= step;
          if (depth < 3 && R() < 0.22) grow(cur.clone(), dir + (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.7), len * (0.25 + R() * 0.4), w * 0.55, depth + 1);
        }
      };
      const H = 600 + R() * 500; grow(new THREE.Vector2(0, H), (R() - 0.5) * 0.3, H * 1.6, 7, 0);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); boltGeos.push(g);
    }
    for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(boltGeos[0], new THREE.MeshBasicMaterial({ color: col('#e8e0ff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide, toneMapped: false })); m.visible = false; m.raycast = () => {}; scene.add(m); bolts.push(m); }
    for (let k = 0; k < 40; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: col('#1a1428'), transparent: true, opacity: 0.85, depthWrite: false, fog: false })); s.position.set(rr(LZ.x[0] - 600, LZ.x[1] + 600), rr(500, 1200), rr(LZ.z[0], LZ.z[1] + 500)); const sc = rr(600, 1300); s.scale.set(sc, sc * 0.42, 1); scene.add(s); storm.push(s); }
  }
  // the seeded flash list: start time, duration and bolts with positions
  const FLASHES = [];
  { const R = rng(MAP.seed * 13 + 5); let t = 3; for (let k = 0; k < LZ.count; k++) { const n = LZ.bolts[0] + Math.floor(R() * (LZ.bolts[1] - LZ.bolts[0] + 1)), cx = lerp(LZ.x[0], LZ.x[1], R()), cz = lerp(LZ.z[0], LZ.z[1], R()); const list = []; for (let j = 0; j < n; j++) list.push({ g: Math.floor(R() * 30), x: cx + (R() - 0.5) * 900, z: cz + (R() - 0.5) * 300, s: 0.6 + R() * 0.7, d: R() * 0.12 }); FLASHES.push({ t, dur: lerp(LZ.dur[0], LZ.dur[1], R()), list }); t += lerp(LZ.interval[0], LZ.interval[1], R()); } FLASHES.period = t; }
  const flashAt = t => { const T = ((t % FLASHES.period) + FLASHES.period) % FLASHES.period; let lo = 0, hi = FLASHES.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (FLASHES[m].t <= T) lo = m; else hi = m - 1; } return { f: FLASHES[lo], tau: T - FLASHES[lo].t }; };

  /* ---------------- fireworks over the plaza, on the race clock ---------------- */
  const FW = MAP.fireworks, FIRE = [];
  { const R = rng(MAP.seed * 3 + 1); let t = 2; for (let k = 0; k < FW.count; k++) { FIRE.push({ t, x: FW.at[0] + (R() - 0.5) * 60, z: FW.at[1] + (R() - 0.5) * 40, h: lerp(FW.height[0], FW.height[1], R()), c: ['#ff4a6a', '#ffd23a', '#4ab0ff', '#7aff6a', '#ff8af0', '#ffffff'][Math.floor(R() * 6)], seed: Math.floor(R() * 1e6) }); t += lerp(FW.every[0], FW.every[1], R()); } FIRE.period = t; }
  const fwDirs = (() => { const R = rng(77), a = []; for (let k = 0; k < FW.n; k++) { const u = R() * 2 - 1, th = R() * TAU, r = Math.sqrt(1 - u * u); a.push(V3(r * Math.cos(th), u, r * Math.sin(th)).multiplyScalar(0.8 + R() * 0.4)); } return a; })();
  const fwPool = [0, 1, 2].map(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((FW.n + 1) * 3), 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.6, map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: col('#ffffff') })); p.frustumCulled = false; p.visible = false; scene.add(p); return p; });

  /* ---------------- signs ---------------- */
  for (const sg of MAP.signs) {
    const i = idxNear(sg.at[0], sg.at[1]), f = roadFrame(i), p0 = roadAt(i, sg.side * (lateralHW(i, sg.side) + 2.4)); p0.y = elev[i] ? roadY[i] : groundH(p0.x, p0.z);
    const tex = signTex(sg.lines), m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: col('#ffffff'), emissiveIntensity: 0.6 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(5, 1.25, 0.12), [DARK, DARK, DARK, DARK, m, DARK]); board.position.copy(p0).setY(p0.y + 3); board.lookAt(board.position.clone().addScaledVector(f.t, -1)); scene.add(board);
    beams.iron.push(placeBeam(p0.clone().setY(p0.y - 0.2), p0.clone().setY(p0.y + 2.5), 0.14, 0.14));
  }

  /* ---------------- flush instances, glows and light pools ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; scene.add(im); return im;
  }
  flush(inst.box.filter(b => !b.lamp), new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.75 }));
  flush(inst.box.filter(b => b.lamp), new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), emissive: col('#ffc87a'), emissiveIntensity: 2.2 }), false);
  flush(inst.boxLit, new THREE.BoxGeometry(1, 1, 1), selfLit(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), 0.12, 'house'));
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, metalness: 0.3 })); }
  flush(inst.sphere, new THREE.SphereGeometry(1, 12, 8), LAMP, false);
  {
    const bounce = m => { m.onBeforeCompile = sh => { sh.uniforms.uTime = uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz; transformed.y += abs(sin(uTime * 4.2 + ip.x * 1.7 + ip.z * 1.3)) * 0.35;`); }; m.customProgramCacheKey = () => 'maracaibo-bounce'; return m; };
    const lit = selfLit(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), 0.16, 'crowdB'), litCompile = lit.onBeforeCompile;
    bounce(lit); const bounceCompile = lit.onBeforeCompile; lit.onBeforeCompile = sh => { litCompile(sh); bounceCompile(sh); }; lit.customProgramCacheKey = () => 'maracaibo-crowd';
    flush(inst.crowdBody, new THREE.SphereGeometry(1, 10, 8), lit, false);
    flush(inst.crowdHead, new THREE.SphereGeometry(1, 10, 8), bounce(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 })), false);
  }
  if (grilles.length) { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), GRILLE, grilles.length); grilles.forEach((m, i) => im.setMatrixAt(i, m)); scene.add(im); }
  flush(doors, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7 }));
  {
    const mats = { conc: new THREE.MeshStandardMaterial({ color: col('#a8a6a0'), roughness: 0.9 }), wood: WOOD, iron: new THREE.MeshStandardMaterial({ color: col('#4a4c52'), metalness: 0.5, roughness: 0.5 }), yellow: new THREE.MeshStandardMaterial({ color: col('#f2c41e') }), white: new THREE.MeshStandardMaterial({ color: col('#e8e6e0'), emissive: col('#ffd8a0'), emissiveIntensity: 0.12 }) };
    const bg = new THREE.BoxGeometry(1, 1, 1);
    for (const [k, list] of Object.entries(beams)) if (list.length) { const im = new THREE.InstancedMesh(bg, mats[k], list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  }
  {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(glows, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(glowCols, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 3.4, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    const pg = new THREE.PlaneGeometry(1, 1); pg.rotateX(-PI / 2);
    const pm = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6 });
    const im = new THREE.InstancedMesh(pg, pm, pools.length); pools.forEach((p, i) => { im.setMatrixAt(i, mat4(p.p.x, p.p.y, p.p.z, 0, p.r * 2, 1)); im.setColorAt(i, p.c); }); im.renderOrder = 3; im.raycast = () => {}; scene.add(im);
  }

  /* ---------------- per-frame updates: lightning, fireworks, the lake ---------------- */
  const _look = new THREE.Vector3();
  function update(t) {
    uTime.value = t;
    LAKE.uniforms.uT.value = t;
    let flash = 0;
    bolts.forEach(b => (b.visible = false));
    const { f, tau } = flashAt(t);
    if (tau < f.dur + 0.15) {
      f.list.slice(0, bolts.length).forEach((L, j) => {
        const tt = tau - L.d; if (tt < 0 || tt > f.dur) return;
        const b = bolts[j]; b.geometry = boltGeos[L.g]; b.position.set(L.x, 0, L.z); b.scale.setScalar(L.s); b.lookAt(_look.set(CENTER.x, 0, CENTER.z)); b.visible = true;
        b.material.opacity = (0.55 + 0.45 * Math.sin(tt * 70 + j)) * (1 - tt / f.dur);
      });
      const e = clamp(tau / f.dur, 0, 1); flash = (1 - e) * (0.6 + 0.4 * Math.abs(Math.sin(tau * 45))) * (tau < f.dur ? 1 : 0);
    }
    uFlash.value = flash;
    LAKE.uniforms.uFlash.value = flash;
    storm.forEach(s => s.material.color.setRGB(0.1 + flash * 0.75, 0.08 + flash * 0.38, 0.16 + flash * 0.5));
    // fireworks: the three most recent shells
    {
      const T = ((t % FIRE.period) + FIRE.period) % FIRE.period; let lo = 0; while (lo < FIRE.length - 1 && FIRE[lo + 1].t <= T) lo++;
      fwPool.forEach((p, j) => {
        const F = FIRE[(lo - j + FIRE.length) % FIRE.length], age = T - F.t;
        if (age < 0 || age > 1 + FW.life) { p.visible = false; return; }
        p.visible = true; const a = p.geometry.attributes.position;
        if (age < 1) { const y = 2.6 + (F.h - 2.6) * sstep(0, 1, age); for (let i = 0; i <= FW.n; i++) a.setXYZ(i, F.x, y - i * 0.04, F.z); p.material.color.set('#ffd890'); p.material.opacity = 0.9; p.material.size = 1.6; }
        else { const e = age - 1, k = 26 * (1 - Math.exp(-e * 2.2)); for (let i = 0; i < FW.n; i++) { const v = fwDirs[(i + F.seed) % FW.n]; a.setXYZ(i, F.x + v.x * k, F.h + v.y * k - 4.5 * e * e, F.z + v.z * k); } a.setXYZ(FW.n, F.x, F.h, F.z); p.material.color.set(F.c); p.material.opacity = Math.max(0, 1 - e / FW.life); p.material.size = 3.0; }
        a.needsUpdate = true;
      });
    }
    pumps.forEach(p => { const a = Math.sin(t * p.sp + p.ph) * 0.32; p.beam.rotation.z = a; p.rod.position.y = 4.6 + a * 3.6; });
    blinkPts.material.opacity = 0.35 + 0.65 * (Math.sin(t * 2.4) > 0 ? 1 : 0.2);
    flares.forEach((s, k) => s.scale.set(18 + Math.sin(t * 11 + k) * 3, 36 + Math.sin(t * 7.3 + k * 2) * 7, 1));
    lanchas.forEach(L => { const a = (t / L.period + L.ph) * TAU, x = L.c[0] + Math.cos(a) * L.r[0], z = L.c[1] + Math.sin(a) * L.r[1]; L.g.position.set(x, 0.05 + Math.sin(t * 1.3 + L.ph * 9) * 0.06, z); L.g.rotation.set(Math.sin(t * 1.1) * 0.03, Math.atan2(-Math.sin(a) * L.r[0], Math.cos(a) * L.r[1]), 0); });
    towerMats.forEach((m, k) => (m.emissiveIntensity = 0.85 + 0.12 * Math.sin(t * 0.8 + k) + flash * 0.3));
  }

  // Parapets hold the cars on the bridge, its ramps and the boardwalk.
  const raised = (x, z) => { const r = sampleR(RR, x, z); return r.i >= 0 && (elev[r.i] || SEG[r.i] === 'f') ? r : null; };
  const blocked = (x, z, c, previous) => {
    const r = raised(x, z); if (!r || c.y < roadY[r.i] - 1.5) return false;
    const limit = hwR[r.i] - 0.4, before = sampleR(RR, previous.x, previous.z).dist;
    return r.dist > limit && r.dist > before;
  };
  function constrainMotion(c, previous) {
    if (!blocked(c.x, c.z, c, previous)) return;
    if (!blocked(c.x, previous.z, c, previous)) { c.z = previous.z; c.vz = 0; }
    else if (!blocked(previous.x, c.z, c, previous)) { c.x = previous.x; c.vx = 0; }
    else { c.x = previous.x; c.z = previous.z; c.vx = 0; c.vz = 0; }
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
  return { group: scene, groundAt: groundH, update, constrainMotion };
}
