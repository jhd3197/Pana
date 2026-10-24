import { rng, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { MAP } from './nubes-layout.js';
import { ownReferenceWorld, referenceDetail } from './reference-world.js';

export function createWorld(scene, layout) {
  const { PI, TAU, UP, DEG, clamp, sstep, lerp, col, V3, d, uTime, ih, noise2, fbm2, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, i0, GC, grid, gkey, roadDist3, roadDistAt } = layout;
  const rand = rng(MAP.seed), rr = (a,b) => a + rand() * (b-a);
  const pick = values => pickRandom(values, rand);
  const createdTextures = [];
  const mapDetail = { value: 2 };
  /* ---------------- sunset sky, sun, warm haze ---------------- */
  const SUN_DIR = new THREE.Vector3(...MAP.sun.dir).normalize();
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: SUN_DIR } },
      vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vD; void main(){
        vec3 d = normalize(vD); float h = clamp(d.y, -0.4, 1.0);
        float sunSide = 0.5 + 0.5 * dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z)));
        vec3 hor = mix(vec3(0.95, 0.5, 0.48), vec3(1.0, 0.62, 0.26), sunSide);
        vec3 c = mix(hor, vec3(0.78, 0.48, 0.66), smoothstep(0.02, 0.25, h)); c = mix(c, vec3(0.22, 0.26, 0.6), smoothstep(0.25, 0.85, h));
        c = mix(c, vec3(0.95, 0.66, 0.62), smoothstep(0.0, -0.3, h));
        float s = max(dot(d, uSun), 0.0); c += vec3(1.0, 0.8, 0.5) * (pow(s, 700.0) * 4.0 + pow(s, 14.0) * 0.45 + pow(s, 3.0) * 0.12);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }));
    sky.frustumCulled = false; sky.renderOrder = -9; scene.add(sky);
  }
  const hemi = new THREE.HemisphereLight(col('#ffe2d0'), col('#8a6a8a'), MAP.sun.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(col(MAP.sun.color), MAP.sun.intensity);
  { const sc = MAP.sun.shadow; sun.target.position.set(...sc.center); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 1200); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); Object.assign(sun.shadow.camera, { left: -sc.half, right: sc.half, top: sc.half, bottom: -sc.half, near: 200, far: 2600 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.0; }
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(col('#a8b8ff'), 0.35); fill.position.set(400, 200, 400); scene.add(fill);

  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); createdTextures.push(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const asphaltTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#9c9a9a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(40,40,44,${rr(0.05, 0.18).toFixed(2)})` : `rgba(255,255,250,${rr(0.04, 0.14).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    c.fillStyle = 'rgba(250,248,236,0.9)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#f3c63a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const plankTex = canvasTex(256, 256, (c, w, h) => {
    for (let y = 0; y < h; y += 16) { const v = (rand() * 30) | 0; c.fillStyle = `rgb(${150 + v},${105 + v},${62 + (v >> 1)})`; c.fillRect(0, y, w, 15); c.fillStyle = 'rgba(40,24,10,0.85)'; c.fillRect(0, y + 14, w, 2); for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(80,50,20,0.25)'; c.fillRect(rand() * w, y + rand() * 12, rr(10, 60), 1); } }
    c.fillStyle = '#f3c63a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 30);
  });
  const rainbowTex = canvasTex(256, 64, (c, w, h) => {
    const cols = ['#e8263a', '#ff8a1a', '#ffd23a', '#3ac85a', '#2a9aff', '#3a4ad8', '#9a3ad8']; const bw = w / cols.length;
    cols.forEach((cc, k) => { c.fillStyle = cc; c.fillRect(k * bw, 0, bw + 1, h); }); c.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 1; k < cols.length; k++) c.fillRect(k * bw - 1, 0, 2, h);
  });
  const stripeTex = (a, b, n = 8) => canvasTex(256, 64, (c, w, h) => { for (let k = 0; k < n; k++) { c.fillStyle = k % 2 ? a : b; c.fillRect(k * w / n, 0, w / n + 1, h); } });
  const cloudTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const grassTex = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = rr(8, w - 8), lean = rr(-18, 18), top = rr(10, 60); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - 4, h); c.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); c.lineTo(x + 4, h); c.fill(); } });
  const sway = (mat, base, perY) => { mat.onBeforeCompile = sh => { sh.uniforms.uTime = uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sw = sin(uTime * 1.3 + ip.x * 0.06 + ip.z * 0.045) * 0.6 + sin(uTime * 2.9 + ip.x * 0.17 - ip.z * 0.11) * 0.25;
      float k = ${base.toFixed(3)} + max(position.y, 0.0) * ${perY.toFixed(3)};
      transformed.x += sw * k; transformed.z += sw * k * 0.55;`); }; return mat; };

  /* ---------------- the islands ---------------- */
  const ISL = MAP.islands.map((s, k) => ({ ...s, cx: s.at[0], cz: s.at[1], ph: k * 1.7 + 0.3 }));
  const islandR = (s, a) => s.r * (1 + 0.07 * Math.sin(3 * a + s.ph) + 0.04 * Math.sin(7 * a + s.ph * 2) + 0.025 * Math.sin(13 * a));
  const islandAt = (x, z, y, margin = 0) => ISL.find(s => { const dx = x - s.cx, dz = z - s.cz, a = Math.atan2(dz, dx); return Math.hypot(dx, dz) < islandR(s, a) - margin && (y === undefined || Math.abs(y - s.top) < 14); });
  // road sample types: on an island, on a rope bridge, on the rainbow, on the needle's ledge
  const TYPE = new Array(NR);
  for (let i = 0; i < NR; i++) { const on = islandAt(RP[i].x, RP[i].z, roadY[i], 4); TYPE[i] = on ? 'land' : SEG[i] === 'a' ? 'rainbow' : SEG[i] === 'e' && Math.hypot(RP[i].x - MAP.spire.at[0], RP[i].z - MAP.spire.at[1]) < MAP.spire.r + 16 ? 'ledge' : 'bridge'; }
  // smooth single-sample flickers
  for (let i = 0; i < NR; i++) if (TYPE[wrap(i - 1)] === TYPE[wrap(i + 1)] && TYPE[i] !== TYPE[wrap(i - 1)]) TYPE[i] = TYPE[wrap(i - 1)];

  const C = { grass: col('#5aa040'), grass2: col('#86b84a'), dry: col('#c8b060'), soil: col('#8a5a3a'), rock: col('#a07a62'), rock2: col('#6a4a44'), rock3: col('#c49a7a'), path: col('#c8b08a'), flowers: col('#e8a0c0') };
  const islandMeshes = [];
  const islandTop = (s, x, z) => s.top + 1.6 * (fbm2(x * 0.02 + s.ph, z * 0.02, 3) - 0.5) * 2 + 0.6 * Math.sin(x * 0.07 + s.ph) * Math.cos(z * 0.06);
  for (const s of ISL) {
    const RINGS = Math.ceil(s.r / 3), SEGS = Math.max(64, Math.round(s.r * 1.4)), DEPTH_R = Math.ceil(s.depth / 6);
    const pos = [], cols = [], idx = [], tmp = new THREE.Color();
    // road samples near this island, for the carve
    const near = []; for (let i = 0; i < NR; i++) if (TYPE[i] === 'land' && Math.hypot(RP[i].x - s.cx, RP[i].z - s.cz) < s.r * 1.2 + 30 && Math.abs(roadY[i] - s.top) < 14) near.push(i);
    const carve = (x, z, h) => {
      let dmin = 1e9, ni = -1; for (const i of near) { const dd = Math.hypot(RP[i].x - x, RP[i].z - z); if (dd < dmin) { dmin = dd; ni = i; } }
      if (ni < 0 || dmin > hwA[ni] + MAP.road.shoulder) return { h, d: dmin };
      let sw = 0, st = 0; for (const i of near) { const dd = Math.hypot(RP[i].x - x, RP[i].z - z); if (dd > dmin + 9) continue; const w = Math.exp(-(((dd - dmin) / 3) ** 2)), f = roadFrame(i), lat = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z; sw += w; st += w * (roadY[i] + bank[i] * clamp(lat, -hwA[i], hwA[i]) - 0.18); }
      return { h: lerp(h, st / sw, 1 - sstep(hwA[ni] + 0.8, hwA[ni] + MAP.road.shoulder, dmin)), d: dmin };
    };
    // top: rings from the centre to a lip that rolls over the edge
    for (let r = 0; r <= RINGS + 2; r++) for (let k = 0; k <= SEGS; k++) {
      const a = k / SEGS * TAU, R = islandR(s, a), f = Math.min(1, r / RINGS), lip = r - RINGS, rad = R * f + (lip > 0 ? lip * 1.2 : 0);
      const x = s.cx + Math.cos(a) * rad, z = s.cz + Math.sin(a) * rad;
      let h = islandTop(s, x, z) - (lip > 0 ? lip * 2.2 : 0) + (f > 0.85 && lip <= 0 ? -1.2 * sstep(0.85, 1, f) : 0);
      const cv = lip > 0 ? { h, d: 1e9 } : carve(x, z, h); h = cv.h;
      pos.push(x, h, z);
      const n = fbm2(x * 0.03, z * 0.03, 2);
      tmp.copy(C.grass).lerp(C.grass2, n * 0.8).lerp(C.dry, sstep(0.66, 0.8, fbm2(x * 0.012 + 9, z * 0.012, 2)) * 0.6);
      if (lip > 0) tmp.copy(C.soil).lerp(C.grass, 0.3);
      if (cv.d < HW0 + 4) tmp.lerp(C.path, (1 - sstep(HW0, HW0 + 4, cv.d)) * 0.7);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    const topRows = RINGS + 3;
    for (let r = 0; r < topRows - 1; r++) for (let k = 0; k < SEGS; k++) { const a = r * (SEGS + 1) + k, b = a + SEGS + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    // underside: a rocky cone with bands of sandstone, hanging into the clouds
    const base = pos.length / 3, lastTop = (topRows - 1) * (SEGS + 1);
    for (let r = 1; r <= DEPTH_R; r++) for (let k = 0; k <= SEGS; k++) {
      const a = k / SEGS * TAU, t = r / DEPTH_R, R = (islandR(s, a) + 3.6) * Math.pow(1 - t, 0.75) * (1 + 0.12 * (fbm2(Math.cos(a) * 3 + s.ph, t * 6, 3) - 0.5)) + 0.5;
      const y = s.top - 4.4 - t * s.depth + 6 * (fbm2(a * 2 + s.ph, t * 3, 2) - 0.5) * (1 - t);
      pos.push(s.cx + Math.cos(a) * R, y, s.cz + Math.sin(a) * R);
      const band = 0.5 + 0.5 * Math.sin(y * 0.35 + Math.sin(a * 3) * 1.5); tmp.copy(C.rock).lerp(C.rock3, band * 0.6).lerp(C.rock2, sstep(0.3, 1, t) * 0.6); cols.push(tmp.r, tmp.g, tmp.b);
    }
    for (let r = 0; r < DEPTH_R; r++) for (let k = 0; k < SEGS; k++) { const a = r === 0 ? lastTop + k : base + (r - 1) * (SEGS + 1) + k, b = base + r * (SEGS + 1) + k; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: false, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; m.name = `nubes-isla-${s.name}`; scene.add(m);
    islandMeshes.push(m);
    s.groundAt = (x, z) => { let h = islandTop(s, x, z); const dd = Math.hypot(x - s.cx, z - s.cz), a = Math.atan2(z - s.cz, x - s.cx), f = dd / islandR(s, a); h += f > 0.85 ? -1.2 * sstep(0.85, 1, f) : 0; return carve(x, z, h).h; };
  }
  const groundH = (x, z, y) => { const s = islandAt(x, z, y); return s ? s.groundAt(x, z) : null; };

  /* ---------------- the stone needle the road spirals down ---------------- */
  {
    const SP = MAP.spire, pos = [], cols = [], idx = [], H = SP.top - SP.bottom, NY = Math.ceil(H / 4), NA = 72, tmp = new THREE.Color();
    for (let j = 0; j <= NY; j++) for (let k = 0; k <= NA; k++) {
      const a = k / NA * TAU, y = SP.bottom + H * j / NY, t = j / NY, R = SP.r * (0.55 + 0.45 * Math.pow(t, 0.35)) * (1 + 0.28 * (fbm2(Math.cos(a) * 2.5 + Math.sin(a) * 1.5 + 3, y * 0.06, 4) - 0.5) + 0.05 * Math.sin(a * 9 + y * 0.2)) - (t > 0.97 ? (t - 0.97) * 400 : 0);
      pos.push(SP.at[0] + Math.cos(a) * Math.max(R, 1), y, SP.at[1] + Math.sin(a) * Math.max(R, 1));
      const band = 0.5 + 0.5 * Math.sin(y * 0.3 + Math.sin(a * 4)); tmp.copy(C.rock).lerp(C.rock3, band * 0.6).lerp(C.rock2, sstep(0, -100, y) * 0.5); if (t > 0.97) tmp.copy(C.grass); cols.push(tmp.r, tmp.g, tmp.b);
      if (j < NY && k < NA) { const p = j * (NA + 1) + k, q = p + NA + 1; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })); m.castShadow = true; m.receiveShadow = true; m.name = 'nubes-aguja'; scene.add(m);
    scene.userData.needle = { pos, NY, NA };
    const cap = new THREE.Mesh(new THREE.CircleGeometry(SP.r * 0.98, 48).rotateX(-PI / 2), new THREE.MeshStandardMaterial({ color: C.grass, roughness: 0.9 })); cap.position.set(SP.at[0], SP.top - 0.6, SP.at[1]); cap.receiveShadow = true; scene.add(cap);
  }

  /* ---------------- road surfaces: asphalt on land, planks on bridges, the rainbow ---------------- */
  function stripMesh(rows, mat, vScale, closed, colors, cast = true) {
    const pos = [], uv = [], idx = [], cl = []; let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.a.distanceTo(rows[i - 1].a); pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale); if (colors) { const c = colors[i]; cl.push(c.r, c.g, c.b, c.r, c.g, c.b); } if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    if (closed) { const k = (rows.length - 1) * 2; idx.push(k, k + 1, 0, k + 1, 1, 0); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = cast; scene.add(m); return m;
  }
  const MATS = {
    land: new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.82, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
    ledge: new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.82, side: THREE.DoubleSide }),
    bridge: new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85, side: THREE.DoubleSide }),
    rainbow: new THREE.MeshStandardMaterial({ map: rainbowTex, roughness: 0.4, side: THREE.DoubleSide, emissive: col('#ffffff'), emissiveMap: rainbowTex, emissiveIntensity: 0.55 }),
  };
  plankTex.repeat.set(1, 1);
  const runs = []; { let start = 0; for (let i = 1; i <= NR; i++) if (i === NR || TYPE[i] !== TYPE[start]) { runs.push([start, i - 1, TYPE[start]]); start = i; } }
  const under = new THREE.MeshStandardMaterial({ color: col('#6a4a34'), roughness: 0.9, side: THREE.DoubleSide });
  const rainbowSide = new THREE.MeshStandardMaterial({ map: rainbowTex, roughness: 0.4, side: THREE.DoubleSide, emissive: col('#ffffff'), emissiveMap: rainbowTex, emissiveIntensity: 0.7, transparent: true, opacity: 0.92 });
  for (const [a, b, type] of runs) {
    const rows = [], sk = [[], []], belly = [];
    for (let j = a - 1; j <= b + 1; j++) {
      const i = wrap(j), hw = hwA[i]; rows.push({ a: roadAt(i, -hw, 0.12), b: roadAt(i, hw, 0.12) });
      if (type === 'bridge') { [-1, 1].forEach((s, k) => sk[k].push({ a: roadAt(i, s * hw, 0.1), b: roadAt(i, s * hw, -0.9) })); belly.push({ a: roadAt(i, -hw, -0.9), b: roadAt(i, hw, -0.9) }); }
      if (type === 'rainbow') { [-1, 1].forEach((s, k) => sk[k].push({ a: roadAt(i, s * (hw + 0.2), 0.3), b: roadAt(i, s * (hw + 0.2), -4.5) })); belly.push({ a: roadAt(i, -hw - 0.2, -4.5), b: roadAt(i, hw + 0.2, -4.5) }); }
      if (type === 'ledge') { const f = roadFrame(i), toC = V3(MAP.spire.at[0] - f.p.x, 0, MAP.spire.at[1] - f.p.z).normalize(), inSide = f.n.dot(toC) > 0 ? 1 : -1; sk[0].push({ a: roadAt(i, -inSide * hw, 0.1), b: roadAt(i, -inSide * hw, -1.2) }); belly.push({ a: roadAt(i, -inSide * hw, -1.2), b: f.p.clone().addScaledVector(toC, 14).setY(roadY[i] - 9) }); }
    }
    const road = stripMesh(rows, MATS[type], type === 'rainbow' ? 1e6 : 20, false); road.name = `nubes-road-${type}`;
    if (type === 'rainbow') { road.geometry.attributes.uv.array.forEach((v, k, arr) => { if (k % 2 === 1) arr[k] = 0.5; }); road.geometry.attributes.uv.needsUpdate = true; }
    const skMat = type === 'rainbow' ? rainbowSide : under;
    sk.forEach(r => { if (r.length) { const m = stripMesh(r, skMat, 20, false); if (type === 'rainbow') { const uv = m.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, k % 2 ? 0.02 : 0.98, 0.5); uv.needsUpdate = true; } } });
    if (belly.length) stripMesh(belly, type === 'rainbow' ? rainbowSide : under, 20, false);
  }

  /* ---------------- instance buffers ---------------- */
  const inst = { post: [], rope: [], trunk: [], blob: [], flower: [], grass: [], rock: [], root: [], wall: [], roof: [], dark: [], wood: [], sphere: [], cone: [], sparkle: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const qBasis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const yawOf = v => Math.atan2(v.x, v.z);
  const between = (a, b, r, list, color) => { const dir = b.clone().sub(a), len = dir.length(); push(list, a, new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), S.set(r, len, r), color); };
  const tries = (n, fn) => { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; };
  const onIsland = (s, m = 6) => { const a = rand() * TAU, rad = Math.sqrt(rand()) * (islandR(s, a) - m); return [s.cx + Math.cos(a) * rad, s.cz + Math.sin(a) * rad]; };
  const blocked = [];
  const freeOn = (s, x, z, m) => { const y = s.groundAt(x, z); return roadDistAt(x, z, y) > HW0 + m && !blocked.some(b => Math.hypot(b[0] - x, b[1] - z) < b[2]); };

  // rope bridges: posts at the edges, two ropes along them, and where a bridge is long, towers and sagging main cables
  {
    const ROPE = col('#d8b880'), POST = col('#6a4a2a');
    for (const [a, b, type] of runs) {
      if (type !== 'bridge') continue;
      const span = b - a; let prevTop = [null, null];
      for (let i = a; i <= b; i += 6) for (const s of [-1, 1]) {
        const k = s < 0 ? 0 : 1, base = roadAt(i, s * (hwA[i] + 0.25), -0.8), top = base.clone().add(V3(0, 2.2, 0));
        push(inst.post, base, Q, S.set(0.14, 2.2, 0.14), POST);
        if (prevTop[k]) { between(prevTop[k], top, 0.05, inst.rope, ROPE); between(prevTop[k].clone().add(V3(0, -1, 0)), top.clone().add(V3(0, -1, 0)), 0.04, inst.rope, ROPE); }
        prevTop[k] = top;
      }
      if (span > 80) {
        const ends = [a + 2, b - 2], tops = ends.map(i => [-1, 1].map(s => roadAt(i, s * (hwA[i] + 0.8), 14)));
        ends.forEach((i, e) => [-1, 1].forEach((s, k) => { const bse = roadAt(i, s * (hwA[i] + 0.8), -1); between(bse, tops[e][k], 0.5, inst.post, POST); }));
        ends.forEach((i, e) => between(tops[e][0], tops[e][1], 0.35, inst.post, POST));
        for (const k of [0, 1]) {
          let prev = null;
          for (let j = 0; j <= 40; j++) { const u = j / 40, i = Math.round(lerp(ends[0], ends[1], u)), s = k ? 1 : -1, sag = 13 * 4 * u * (1 - u), p = roadAt(i, s * (hwA[i] + 0.8), 14 - sag).lerp(tops[0][k].clone().lerp(tops[1][k], u), 0.0); if (prev) between(prev, p, 0.12, inst.rope, ROPE); if (j % 2 === 0 && j > 0 && j < 40) between(roadAt(i, s * (hwA[i] + 0.25), 1.4), p, 0.03, inst.rope, ROPE); prev = p; }
        }
      }
    }
  }
  // the needle: rock outcrops and vines hanging down the stone
  {
    const SP = MAP.spire, nd = scene.userData.needle, P = nd.pos;
    for (let k = 0; k < 260; k++) {
      const j = (rand() * nd.NY * 0.97) | 0, a = (rand() * nd.NA) | 0, v = (j * (nd.NA + 1) + a) * 3, p = V3(P[v], P[v + 1], P[v + 2]);
      if (roadDist3(p).d < HW0 + 3) continue;
      const out = V3(p.x - SP.at[0], 0, p.z - SP.at[1]).normalize(), sz = rr(1.5, 4.5);
      if (rand() < 0.6) push(inst.rock, p.clone().addScaledVector(out, sz * 0.3), qEuler(rand(), rand() * TAU, rand()), S.set(sz * 1.3, sz * 0.8, sz), C.rock.clone().lerp(C.rock3, rand()).offsetHSL(0, 0, rr(-0.06, 0.05)));
      else between(p.clone().addScaledVector(out, 0.6).add(V3(0, -rr(6, 18), 0)), p.clone().addScaledVector(out, 0.6), rr(0.08, 0.14), inst.root, col(pick(['#4a7a2a', '#5a8a32', '#6a5a3a'])));
    }
  }
  // sparkles along the rainbow
  for (const [a, b, type] of runs) if (type === 'rainbow') for (let i = a; i <= b; i += 2) for (let k = 0; k < 2; k++) push(inst.sparkle, roadAt(i, (rand() * 2 - 1) * (hwA[i] + 2), rr(-5, 4)), qEuler(rand(), rand(), rand()), S.set(0.25, 0.25, 0.25), col(pick(['#ffffff', '#fff2a0', '#ffd0f0'])));

  /* ---------------- life on the islands ---------------- */
  const TREE_C = ['#3a8a30', '#4a9a3a', '#2f7a2a', '#5aa840', '#6aa848'].map(col), BLOOM = ['#ff6ab0', '#ffd23a', '#ff8a3a', '#ffffff', '#b07aff'].map(col);
  const tree = (x, z, y) => { const h = rr(4, 9); push(inst.trunk, V3(x, y - 0.3, z), qYaw(rand() * TAU), S.set(0.35, h, 0.35), col('#6a4a30')); const c = pick(TREE_C), blossom = rand() < 0.22 ? pick(BLOOM) : null; for (let k = 0; k < 4; k++) { const a = rand() * TAU, r = k ? rr(1, 2.4) : 0, s = rr(2, 3.2); push(inst.blob, V3(x + Math.cos(a) * r, y + h + rr(-0.6, 1), z + Math.sin(a) * r), qEuler(rand(), rand() * TAU, 0), S.set(s, s * 0.8, s), (blossom || c).clone().offsetHSL(0, 0, rr(-0.05, 0.05))); } };
  for (const s of ISL) {
    const area = s.r * s.r / (135 * 135);
    tries(Math.round(MAP.vegetation.trees * area * 0.6), () => { const [x, z] = onIsland(s, 6); if (!freeOn(s, x, z, 4)) return false; tree(x, z, s.groundAt(x, z)); return true; });
    tries(Math.round(MAP.vegetation.flowers * area), () => { const [x, z] = onIsland(s, 2); if (!freeOn(s, x, z, 1)) return false; push(inst.flower, V3(x, s.groundAt(x, z) + 0.3, z), Q, S.set(0.25, 0.25, 0.25), pick(BLOOM)); return true; });
    tries(Math.round(MAP.vegetation.grass * area), () => { const [x, z] = onIsland(s, 1); if (!freeOn(s, x, z, 1)) return false; const sc = rr(0.6, 1.2); push(inst.grass, V3(x, s.groundAt(x, z) - 0.05, z), qYaw(rand() * TAU), S.set(sc * 1.4, sc, sc * 1.4), col(pick(['#6ab040', '#8ac04a', '#a8c060'])).offsetHSL(0, 0, rr(-0.05, 0.05))); return true; });
    tries(Math.round(MAP.vegetation.rocks * area), () => { const [x, z] = onIsland(s, 3); if (!freeOn(s, x, z, 2)) return false; const sc = rr(0.6, 2); push(inst.rock, V3(x, s.groundAt(x, z) + sc * 0.1, z), qEuler(rand(), rand() * TAU, rand()), S.set(sc * 1.3, sc * 0.7, sc), C.rock3.clone().offsetHSL(0, 0, rr(-0.08, 0.05))); return true; });
    // roots and vines hanging from the rim
    const nRoots = Math.round(MAP.vegetation.roots * s.r / 135 * 0.5);
    for (let k = 0; k < nRoots; k++) { const a = rand() * TAU, R = islandR(s, a) + 1, top = V3(s.cx + Math.cos(a) * R, s.top - 4, s.cz + Math.sin(a) * R), len = rr(5, 26); between(top.clone().add(V3(Math.cos(a) * -rr(0, 4), -len, Math.sin(a) * -rr(0, 4))), top, rr(0.06, 0.14), inst.root, col(pick(['#4a6a2a', '#6a5a3a', '#5a7a32']))); }
  }
  // the village on the big island: whitewashed houses with tiled roofs, a church tower, windmills
  const windmills = [];
  {
    const A = ISL.find(s => s.kind === 'pueblo'), WALLS = ['#f6efe4', '#f6d36a', '#7ab8e0', '#f2a7a0', '#b8e0a8', '#ffffff'];
    tries(MAP.village.houses, () => { const [x, z] = onIsland(A, 18); if (!freeOn(A, x, z, 8)) return false; const y = A.groundAt(x, z) - 0.3, w = rr(7, 11), dp = rr(7, 10), h = rr(4, 6.5), yaw = Math.round(rand() * 4) * PI / 2 + rr(-0.2, 0.2); push(inst.wall, V3(x, y, z), qYaw(yaw), S.set(w, h, dp), col(pick(WALLS))); push(inst.roof, V3(x, y + h, z), qYaw(yaw), S.set(w + 1, rr(1.8, 2.6), dp + 1.2), col(pick(['#b8502a', '#a8442a', '#c45a30']))); const f = V3(Math.sin(yaw), 0, Math.cos(yaw)); push(inst.wood, V3(x, y, z).addScaledVector(f, dp / 2 + 0.05), qYaw(yaw), S.set(1.3, 2.3, 0.15), col(pick(['#2a6a9a', '#3a8a4a', '#7a4a2a']))); blocked.push([x, z, Math.max(w, dp) * 0.75 + 2]); return true; });
    for (const [x, z] of MAP.village.windmills) {
      const y = A.groundAt(x, z), g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.4, 11, 16), new THREE.MeshStandardMaterial({ color: col('#f2ece0'), roughness: 0.8 })); tower.position.y = 5.5; tower.castShadow = true; g.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(3, 3, 16), new THREE.MeshStandardMaterial({ color: col('#b8502a'), roughness: 0.7 })); cap.position.y = 12.5; g.add(cap);
      const hub = new THREE.Group(); hub.position.set(0, 11, 3); g.add(hub);
      for (let k = 0; k < 4; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 0.15), new THREE.MeshStandardMaterial({ color: col('#e8dcc0'), roughness: 0.8, side: THREE.DoubleSide })); bl.position.y = 4.3; const arm = new THREE.Group(); arm.rotation.z = k * PI / 2; arm.add(bl); hub.add(arm); bl.castShadow = true; }
      g.rotation.y = yawOf(V3(SUN_DIR.x, 0, SUN_DIR.z)) + 0.5; windmills.push(hub); blocked.push([x, z, 8]);
    }
  }
  // the waterfall: a stream over island C pouring off the edge into the clouds
  const flowMats = [];
  {
    const WF = MAP.waterfall, s = ISL.find(q => q.name === WF.island);
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 } }]),
      vertexShader: `attribute float steep; attribute float fade; varying vec2 vUv; varying float vSteep; varying float vFade;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vSteep = steep; vFade = fade; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; varying vec2 vUv; varying float vSteep; varying float vFade;
        #include <fog_pars_fragment>
        void main(){
          float flow = vUv.y - uT * (1.0 + vSteep * 2.5);
          float a = sin(vUv.x * 14.0 + sin(vUv.y * 0.35 + uT) * 2.0 + flow * 1.3);
          float st = smoothstep(0.1, 0.95, sin(vUv.x * 50.0 + sin(vUv.x * 11.0) * 4.0) * 0.5 + sin(vUv.x * 19.0 + flow * 0.5) * sin(flow * 1.6) * 0.5);
          vec3 c = mix(mix(vec3(0.3, 0.6, 0.7), vec3(0.7, 0.9, 0.95), 0.5 + 0.4 * a), mix(vec3(0.85, 0.9, 0.95), vec3(1.0), st), vSteep);
          float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
          float alpha = edge * mix(0.85, 0.55 + 0.45 * st, vSteep) * vFade;
          gl_FragColor = vec4(c, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3,
    });
    flowMats.push(m);
    const a = V3(WF.from[0], 0, WF.from[1]), b = V3(WF.to[0], 0, WF.to[1]), dir = b.clone().sub(a).normalize(), side = V3(-dir.z, 0, dir.x), pos = [], uv = [], st = [], fa = [], idx = [];
    let dist = 0, prev = null, rows = 0;
    const addRow = (c, w, steep, fade) => { if (prev) dist += c.distanceTo(prev); prev = c; for (const s2 of [-1, 1]) { const v = c.clone().addScaledVector(side, s2 * w); pos.push(v.x, v.y, v.z); uv.push((s2 + 1) / 2, dist * 0.2); st.push(steep); fa.push(fade); } if (rows) { const q = (rows - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } rows++; };
    const n = Math.ceil(a.distanceTo(b) / 1.5); let lastY = 0;
    for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n), on = islandAt(p.x, p.z, undefined, 1) === s; if (!on) break; lastY = s.groundAt(p.x, p.z) + 0.25; addRow(V3(p.x, lastY, p.z), WF.width / 2, 0, 1); }
    const lip = prev.clone();
    for (let k = 1; k <= 40; k++) { const t = k / 40, c = lip.clone().addScaledVector(dir, 2 + 8 * t * t).add(V3(0, -WF.drop * t, 0)); addRow(c, WF.width / 2 * (1 + t * 1.5), 1, 1 - sstep(0.6, 1, t)); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('steep', new THREE.Float32BufferAttribute(st, 1)); geo.setAttribute('fade', new THREE.Float32BufferAttribute(fa, 1)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = 3; mesh.name = 'nubes-cascada'; scene.add(mesh);
    scene.userData.mistAt = lip.clone().addScaledVector(dir, 10).add(V3(0, -WF.drop * 0.75, 0));
  }
  // kites over the kite island, on long strings that sway in the wind
  const kites = [];
  {
    const s = ISL.find(q => q.kind === 'papagayos'), KC = [['#e0263a', '#ffd23a'], ['#1f4fd8', '#ffffff'], ['#3ac85a', '#ff8a1a'], ['#b07aff', '#ffd23a'], ['#ff6ab0', '#3ab8ff']];
    const kgeo = new THREE.BufferGeometry(); kgeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.4, 0, -1, 0, 0, 0, -1.6, 0, 1, 0, 0], 3)); kgeo.setIndex([0, 1, 2, 0, 2, 3]); kgeo.computeVertexNormals();
    for (let k = 0; k < MAP.kites.count; k++) {
      const [x, z] = onIsland(s, 10); if (!freeOn(s, x, z, 6)) continue;
      const anchor = V3(x, s.groundAt(x, z) + 1, z), cc = pick(KC), g = new THREE.Group(); scene.add(g);
      const body = new THREE.Mesh(kgeo, new THREE.MeshStandardMaterial({ color: col(cc[0]), side: THREE.DoubleSide, roughness: 0.6 })); body.scale.setScalar(1.6); g.add(body);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: col(cc[1]) })); cross.position.y = 0.1; g.add(cross);
      const tail = []; for (let j = 0; j < 6; j++) { const bow = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.05), new THREE.MeshStandardMaterial({ color: col(j % 2 ? cc[1] : cc[0]) })); g.add(bow); tail.push(bow); }
      const strGeo = new THREE.BufferGeometry().setFromPoints([V3(), V3()]), str = new THREE.Line(strGeo, new THREE.LineBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.6 })); str.frustumCulled = false; scene.add(str);
      kites.push({ g, tail, str, anchor, len: rr(35, 60), ph: rand() * TAU, dir: rr(-0.4, 0.4) });
    }
  }
  // hot-air balloons drifting round the high island
  const balloons = [];
  {
    const B = MAP.balloons, s = ISL.find(q => q.name === B.around), pairs = [['#e0263a', '#ffd23a'], ['#1f4fd8', '#ffd23a'], ['#3ac85a', '#ffffff'], ['#ff8a1a', '#b07aff'], ['#ff6ab0', '#ffffff'], ['#e0263a', '#1f4fd8'], ['#ffd23a', '#3ab8ff']];
    for (let k = 0; k < B.count; k++) {
      const [a, b] = pairs[k % pairs.length], tex = stripeTex(a, b, 12), g = new THREE.Group();
      const env = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 16), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })); const ep = env.geometry.attributes.position; for (let i = 0; i < ep.count; i++) { const y = ep.getY(i); if (y < 0) { const sc = 1 + y / 8 * 0.55; ep.setX(i, ep.getX(i) * sc); ep.setZ(i, ep.getZ(i) * sc); } } env.geometry.computeVertexNormals(); env.castShadow = true; g.add(env);
      const basket = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), new THREE.MeshStandardMaterial({ color: col('#8a6a3a'), roughness: 0.9 })); basket.position.y = -12.5; g.add(basket);
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6), new THREE.MeshStandardMaterial({ color: col('#3a2a1a') })); r.position.set(sx * 1.4, -9, sz * 1.4); g.add(r); }
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ color: col('#ffb030'), toneMapped: false })); flame.position.y = -9.5; g.add(flame);
      scene.add(g); balloons.push({ g, flame, c: V3(s.cx, 0, s.cz), r: rr(...B.r), y: rr(...B.y), a: k / B.count * TAU + rr(-0.3, 0.3), sp: rr(0.008, 0.016) * (k % 2 ? 1 : -1), ph: rand() * TAU });
    }
  }
  // little islands with no road, for the view
  {
    for (let k = 0, t = 0; k < MAP.islets && t < 300; t++) {
      const a = rand() * TAU, r = rr(250, 700), x = 40 + Math.cos(a) * r, z = -10 + Math.sin(a) * r, y = rr(-20, 90), R = rr(14, 36);
      if (RP.some(q => Math.hypot(q.x - x, q.z - z) < R + 45) || ISL.some(s => Math.hypot(s.cx - x, s.cz - z) < s.r + R + 30) || Math.hypot(x - MAP.spire.at[0], z - MAP.spire.at[1]) < MAP.spire.r + R + 40) continue;  // keep clear of the road from above and below
      const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.92, 2.5, 20), new THREE.MeshStandardMaterial({ color: C.grass, roughness: 0.9 })); g.add(top);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(R * 0.95, R * 1.6, 20), new THREE.MeshStandardMaterial({ color: C.rock, roughness: 0.95, flatShading: true })); cone.rotation.x = PI; cone.position.y = -R * 0.8 - 1.2; g.add(cone);
      top.castShadow = cone.castShadow = true;
      for (let j = 0; j < 3 + R / 6; j++) { const aa = rand() * TAU, rr2 = rand() * R * 0.75; tree(x + Math.cos(aa) * rr2, z + Math.sin(aa) * rr2, y + 1.2); }
      if (rand() < 0.4) { push(inst.wall, V3(x, y + 1.2, z), qYaw(rand() * TAU), S.set(6, 4.5, 6), col(pick(['#f6efe4', '#f6d36a', '#7ab8e0']))); push(inst.roof, V3(x, y + 5.7, z), qYaw(rand() * TAU), S.set(7, 2.2, 7), col('#b8502a')); }
      k++;
    }
  }

  /* ---------------- the start: checkered line and the flag arch ---------------- */
  {
    const f = roadFrame(i0), q = qBasis(f.n, UP, new THREE.Vector3().crossVectors(f.n, UP));
    const lineTex = canvasTex(256, 32, (c, w, h) => { for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { c.fillStyle = ((x + y) / 16) % 2 ? '#151515' : '#f2f2f2'; c.fillRect(x, y, 16, 16); } });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(MAP.road.width, 1.6), new THREE.MeshStandardMaterial({ map: lineTex, polygonOffset: true, polygonOffsetFactor: -5 })); line.position.copy(roadAt(i0, 0, 0.17)); line.quaternion.copy(q); line.rotateX(-PI / 2); scene.add(line);
    const arch = new THREE.Group(); arch.position.copy(roadAt(i0, 0, 0)); arch.quaternion.copy(q); scene.add(arch);
    [['#ffd23a', HW0 + 4.2], ['#1f4fd8', HW0 + 3.1], ['#e0263a', HW0 + 2.0]].forEach(([c, r]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.55, 12, 80, PI), new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.4, emissive: col(c), emissiveIntensity: 0.25 })); m.castShadow = true; arch.add(m); });
    const star = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, r = k % 2 ? 0.42 : 1; k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.25, bevelEnabled: false }); sg.translate(0, 0, -0.125);
    for (let k = 0; k < 8; k++) { const a = PI * (0.18 + 0.64 * k / 7), s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false })); s.position.set(Math.cos(a) * (HW0 + 3.1), Math.sin(a) * (HW0 + 3.1), 0.7); s.scale.setScalar(0.62); arch.add(s); const b = s.clone(); b.position.z = -0.7; arch.add(b); }
  }

  /* ---------------- flush ---------------- */
  function flush(list, geo, mat, cast = true) { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); }); im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0); flush(inst.post, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9 })); flush(inst.rope, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9 }), false); flush(inst.root, g, sway(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9 }), 0, 0), false); }
  { const g = new THREE.CylinderGeometry(0.7, 1, 1, 7); g.translate(0, 0.5, 0); flush(inst.trunk, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true })); }
  flush(inst.blob, new THREE.IcosahedronGeometry(1, 1), sway(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }), 0.04, 0.02));
  flush(inst.flower, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, flatShading: true }), false);
  {
    const a = new THREE.PlaneGeometry(1, 1, 1, 2); a.translate(0, 0.5, 0); const b = a.clone(); b.rotateY(PI / 2);
    const g = new THREE.BufferGeometry(), pa = a.attributes.position.array, pb = b.attributes.position.array;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...pa, ...pb], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([...a.attributes.uv.array, ...b.attributes.uv.array], 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pa.length + pb.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    const ia = [...a.index.array], off = a.attributes.position.count; g.setIndex([...ia, ...ia.map(v => v + off)]);
    flush(inst.grass, g, sway(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0, 0.16), false);
  }
  flush(inst.rock, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true }));
  { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); flush(inst.wall, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85 })); flush(inst.wood, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 })); }
  { const g = new THREE.BufferGeometry(), v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5], tri = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 1, 4], [0, 4, 3]], pos = []; tri.forEach(t => t.forEach(k => pos.push(v[k * 3], v[k * 3 + 1], v[k * 3 + 2]))); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); flush(inst.roof, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, flatShading: true, side: THREE.DoubleSide })); }
  flush(inst.sparkle, new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false }), false);

  /* ---------------- the sea of clouds ---------------- */
  const cloudSea = (() => {
    const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR } }]),
      vertexShader: `varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uSun; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1,0)), f.x), mix(h(i + vec2(0,1)), h(i + vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ if (uMapDetail < 0.5) return n(p); float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
        #include <fog_pars_fragment>
        void main(){
          vec2 p = vW.xz * 0.006 + vec2(uT * 0.004, uT * 0.002);
          float c = fbm(p), c2 = fbm(p * 2.3 + 4.0);
          float lit = smoothstep(0.35, 0.75, c + c2 * 0.3);
          vec3 shade = mix(vec3(0.52, 0.36, 0.52), vec3(1.0, 0.74, 0.58), lit);
          shade += vec3(1.0, 0.7, 0.4) * pow(lit, 3.0) * 0.25;
          gl_FragColor = vec4(shade, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      fog: true,
    }));
    m.position.y = MAP.clouds.level; m.name = 'nubes-mar'; scene.add(m); return m;
  })();
  const puffs = [];
  {
    const mats = ['#ffd8c8', '#f8b8b0', '#e8c0e0', '#ffcc98'].map(c => new THREE.SpriteMaterial({ map: cloudTex, color: col(c), transparent: true, opacity: 0.85, depthWrite: false }));
    for (let k = 0; k < MAP.clouds.puffs; k++) { const a = rand() * TAU, r = rr(0, 1800), s = new THREE.Sprite(pick(mats)); s.position.set(40 + Math.cos(a) * r, MAP.clouds.level + rr(-4, 24), -10 + Math.sin(a) * r); const sc = rr(60, 180); s.scale.set(sc, sc * 0.45, 1); scene.add(s); puffs.push({ s, x0: s.position.x, ph: rand() * TAU }); }
    const mm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.5, depthWrite: false });
    const mist = scene.userData.mistAt; for (let k = 0; k < 10; k++) { const s = new THREE.Sprite(mm); s.position.copy(mist).add(V3(rr(-14, 14), rr(-30, 20), rr(-14, 14))); const sc = rr(20, 40); s.scale.set(sc, sc, 1); scene.add(s); puffs.push({ s, x0: s.position.x, ph: rand() * TAU }); }
  }

  /* ---------------- macaws ---------------- */
  const macaws = [];
  for (let f = 0; f < MAP.macaws.flocks; f++) {
    const c = V3(rr(-200, 300), rr(70, 110), rr(-250, 250)), r = rr(120, 220), sp = rr(0.05, 0.08) * (f % 2 ? 1 : -1);
    for (let k = 0; k < MAP.macaws.perFlock; k++) {
      const g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: col(f === 1 ? '#2a6ad8' : '#e0263a'), roughness: 0.7, flatShading: true }), wingM = new THREE.MeshStandardMaterial({ color: col(f === 1 ? '#ffd23a' : '#2a6ad8'), flatShading: true });
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), body); b.scale.set(0.35, 0.35, 1); g.add(b);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.8, 4), body); tail.rotation.x = -PI / 2; tail.position.z = -1.6; g.add(tail);
      const wings = []; for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.x = s * 0.25; g.add(pv); const w = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 0.7), wingM); w.position.x = s * 1.1; pv.add(w); wings.push({ pv, s }); }
      g.scale.setScalar(0.8); scene.add(g);
      macaws.push({ g, wings, c, r, sp, ph: f * 2 + k * 0.08, off: V3(rr(-4, 4), rr(-2, 2), rr(-4, 4)) });
    }
  }

  /* ---------------- per-frame updates ---------------- */
  const tmpV = new THREE.Vector3();
  function update(t, dt, racerS = null) {
    uTime.value = t; flowMats.forEach(m => (m.uniforms.uT.value = t)); cloudSea.material.uniforms.uT.value = t;
    puffs.forEach(p => { p.s.position.x = p.x0 + Math.sin(t * 0.02 + p.ph) * 30; });
    windmills.forEach((h, k) => (h.rotation.z = t * (0.6 + k * 0.1)));
    kites.forEach(k => {
      const wind = V3(0.6 + 0.3 * Math.sin(t * 0.2 + k.ph), 0, k.dir).normalize(), sway = Math.sin(t * 0.8 + k.ph) * 4;
      const p = k.anchor.clone().addScaledVector(wind, k.len * 0.55).add(V3(sway * wind.z, k.len * 0.8 + Math.sin(t * 1.3 + k.ph) * 2, -sway * wind.x));
      k.g.position.copy(p); k.g.lookAt(k.anchor.clone().add(V3(0, k.len * 2, 0))); k.g.rotateZ(Math.sin(t * 2 + k.ph) * 0.3);
      k.tail.forEach((b, j) => { b.position.set(Math.sin(t * 4 + j + k.ph) * 0.4 * j, -1.8 - j * 0.9, 0); b.rotation.z = Math.sin(t * 5 + j) * 0.6; });
      const a = k.str.geometry.attributes.position; a.setXYZ(0, k.anchor.x, k.anchor.y, k.anchor.z); a.setXYZ(1, p.x, p.y, p.z); a.needsUpdate = true;
    });
    balloons.forEach(b => { const a = b.a + t * b.sp; b.g.position.set(b.c.x + Math.cos(a) * b.r, b.y + Math.sin(t * 0.3 + b.ph) * 4, b.c.z + Math.sin(a) * b.r); b.g.rotation.y = t * 0.05 + b.ph; b.flame.visible = Math.sin(t * 1.5 + b.ph) > 0.3; });
    macaws.forEach(m => { const a = m.ph + t * m.sp; tmpV.set(m.c.x + Math.cos(a) * m.r, m.c.y + Math.sin(t * 0.5 + m.ph) * 5, m.c.z + Math.sin(a) * m.r).add(m.off); m.g.position.copy(tmpV); m.g.lookAt(m.c.x + Math.cos(a + 0.05 * Math.sign(m.sp)) * m.r + m.off.x, tmpV.y, m.c.z + Math.sin(a + 0.05 * Math.sign(m.sp)) * m.r + m.off.z); m.g.rotateZ(-0.35 * Math.sign(m.sp)); const fl = Math.max(0, Math.sin(t * 9 + m.ph * 7)) * 0.7 - 0.15; m.wings.forEach(w => (w.pv.rotation.z = w.s * fl)); });

  }


  return ownReferenceWorld(scene, (x,z) => groundH(x,z) ?? -300, referenceDetail(scene, update, mapDetail), createdTextures);
}
