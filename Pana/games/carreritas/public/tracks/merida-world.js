import { coastalVegetation } from '/engine/worlds/coastal/coastal-vegetation.js';
import { rng, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { canvasTexture } from '/engine/models/core/primitives.js';
import { MAP } from './merida-layout.js';
import { ownReferenceWorld } from './reference-world.js';

export function createWorld(scene, layout, roadDistance, worldScale) {
  const { PI, TAU, UP, clamp, sstep, lerp, col, V3, d, uTime, W0, CX, CZ, SIZE, HALF, TER, TOP, ih, noise2, fbm2, LK, LCX, LCZ, lakeE, baseNat, RV, riverPts, GR, CELL, X0, Z0, GN, vIdx, riverNear, riverD, riverQuery, natural, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, segRange, w0, w1, isBridge, i0, NAT, HGT, DMIN, NEAR, inSquare, gridH, roadDist, groundH } = layout;
  const rand = rng(MAP.seed), rr = (a,b) => a + rand() * (b-a);
  const pick = values => pickRandom(values, rand);
  const createdTextures = [];
  const vegetation = coastalVegetation(scene, worldScale, roadDistance);
  /* ---------------- sky, fog, sun: a clear Andean morning ---------------- */
  const SUN_DIR = new THREE.Vector3(...MAP.sun.dir).normalize();
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: SUN_DIR } },
      vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vD;
        void main(){
          vec3 d = normalize(vD); float h = clamp(d.y, -0.3, 1.0);
          vec3 top = vec3(0.12, 0.36, 0.78), mid = vec3(0.42, 0.62, 0.88), hor = vec3(0.8, 0.86, 0.92), low = vec3(0.72, 0.78, 0.82);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.2, h)); c = mix(c, top, smoothstep(0.2, 0.8, h)); c = mix(c, low, smoothstep(0.0, -0.25, h));
          float s = max(dot(d, uSun), 0.0);
          c += vec3(1.0, 0.93, 0.78) * (pow(s, 900.0) * 3.0 + pow(s, 22.0) * 0.25);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    sky.frustumCulled = false; sky.renderOrder = -9; scene.add(sky);
  }
  const hemi = new THREE.HemisphereLight(col('#eaf2ff'), col('#4a5a3a'), MAP.sun.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(col(MAP.sun.color), MAP.sun.intensity);
  sun.target.position.set(CX, 30, CZ); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 900);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  { const h = MAP.sun.shadowHalf; Object.assign(sun.shadow.camera, { left: -h, right: h, top: h, bottom: -h, near: 100, far: 2200 }); }
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.0;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(col('#c8d8ff'), 0.3); fill.position.set(-300, 200, -260); scene.add(fill);

  /* ---------------- canvas textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => canvasTexture(w, h, draw, { srgb, owned: createdTextures });
  const asphaltTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#9a9a9c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(40,40,44,${rr(0.05, 0.18).toFixed(2)})` : `rgba(255,255,250,${rr(0.04, 0.14).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(30,30,34,0.12)'; c.fillRect(rr(20, w - 80), rr(0, h), rr(30, 70), rr(20, 60)); }
    c.fillStyle = 'rgba(250,248,236,0.9)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#f3c63a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const leafTex = canvasTex(128, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(w / 2, h); c.quadraticCurveTo(w * 0.98, h * 0.45, w / 2, 4); c.quadraticCurveTo(w * 0.02, h * 0.45, w / 2, h); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 10); c.stroke();
  });
  const frondTex = canvasTex(128, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineCap = 'round';
    c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 6); c.stroke();
    for (let y = h - 20; y > 20; y -= 13) { const len = (w / 2 - 6) * Math.sin(PI * (1 - y / h) * 0.95 + 0.15); c.lineWidth = 7; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + s * len * 0.6, y - 10, w / 2 + s * len, y - 26); c.stroke(); } }
  });
  const grassTex = canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) { const x = rr(8, w - 8), lean = rr(-20, 20), top = rr(6, 50); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - 3, h); c.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); c.lineTo(x + 3, h); c.fill(); }
  });
  const cloudTex = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const windy = (mat, base, perY) => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uTime * 1.3 + ip.x * 0.06 + ip.z * 0.045) * 0.6 + sin(uTime * 2.9 + ip.x * 0.17 - ip.z * 0.11) * 0.25;
        float k = ${base.toFixed(3)} + max(position.y, 0.0) * ${perY.toFixed(3)};
        transformed.x += sw * k; transformed.z += sw * k * 0.55;`);
    };
    return mat;
  };

  /* ---------------- terrain colours ---------------- */
  const TN = MAP.town, ST0 = TN.street;
  const inTown = (x, z) => x > ST0.from - 30 && x < ST0.to + 30 && Math.abs(z - ST0.z) < 58;
  const fields = [];
  for (let k = 0, tries = 0; k < MAP.vegetation.fields && tries < 400; tries++) {
    const x = rr(-420, 420), z = rr(-40, 420), w = rr(30, 60), l = rr(40, 80), rot = rr(0, PI);
    const h = baseNat(x, z); if (h < 4 || h > 45 || inTown(x, z) || roadDist(x, z) < Math.max(w, l) * 0.6 + 8) continue;
    if (fields.some(f => Math.hypot(f.x - x, f.z - z) < 70)) continue;
    fields.push({ x, z, w, l, rot, c: col(pick(['#7a9a3a', '#5a8a2a', '#9aa448', '#8a6a3a', '#6aa04a'])), c2: col(pick(['#5a4a2a', '#4a6a24', '#7a5a34'])) }); k++;
  }
  const fieldAt = (x, z) => { for (const f of fields) { const dx = x - f.x, dz = z - f.z, c = Math.cos(f.rot), s = Math.sin(f.rot), u = dx * c + dz * s, v = -dx * s + dz * c; if (Math.abs(u) < f.w / 2 && Math.abs(v) < f.l / 2) return { f, u, v }; } return null; };
  const C = { valley: col('#4f8a2e'), valley2: col('#6e9a36'), slope: col('#4a7a2c'), paramo: col('#6f7a3c'), paramo2: col('#8e8442'), moss: col('#4e6a2e'), rock: col('#6a645c'), rock2: col('#4a4642'), snow: col('#f4f6fa'), forest: col('#2f5a2a'), mud: col('#6a5a44'), cobble: col('#b0a28a'), plaza: col('#c8b89a'), verge: col('#8a8270'), lakeBed: col('#5a6a5a') };
  function paintGround(x, z, y, slope, tmp) {
    const n1 = fbm2(x * 0.03, z * 0.03, 3), n2 = fbm2(x * 0.11 + 3, z * 0.11, 2);
    const paramo = sstep(38, 62, y), high = sstep(150, 230, y);
    tmp.copy(C.valley).lerp(C.valley2, n1 * 0.6).lerp(C.slope, sstep(8, 30, y) * 0.6);
    tmp.lerp(C.paramo.clone().lerp(C.paramo2, n2).lerp(C.moss, sstep(0.55, 0.75, n1) * 0.6), paramo);
    if (x < -150 && y > 6 && y < 70) tmp.lerp(C.forest, sstep(-150, -230, x) * (1 - sstep(55, 70, y)) * 0.85);
    tmp.lerp(C.rock.clone().lerp(C.rock2, n2), Math.max(high, sstep(0.45, 0.75, slope)));
    tmp.lerp(C.snow, sstep(TER.snowLine - 20, TER.snowLine + 25, y + 30 * (n1 - 0.5)) * (1 - sstep(0.7, 0.95, slope) * 0.6));
    const f = y > 3 && y < 50 ? fieldAt(x, z) : null;
    if (f) { const stripe = 0.5 + 0.5 * Math.sin(f.v * 1.7); tmp.copy(f.f.c).lerp(f.f.c2, stripe * 0.55); }
    if (inTown(x, z)) { const pl = TN.plaza; if (Math.abs(x - pl.at[0]) < pl.size[0] / 2 && Math.abs(z - pl.at[1]) < pl.size[1] / 2) tmp.copy(C.plaza).lerp(C.cobble, (Math.sin(x * 2.1) * Math.sin(z * 2.1) > 0.3) ? 0.4 : 0); else if (Math.abs(z - ST0.z) < 11 || [-66, 62].some(sx => Math.abs(x - sx) < 5)) tmp.copy(C.cobble).multiplyScalar(0.9 + 0.15 * n2); }
    const e = lakeE(x, z); if (e < 1.08) tmp.lerp(C.lakeBed, sstep(1.08, 0.95, e));
    return tmp;
  }
  const terrainMesh = (() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, GR, GR); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const ix = Math.round((pos.getX(i) - X0) / CELL), iz = Math.round((pos.getZ(i) - Z0) / CELL); pos.setY(i, HGT[vIdx(ix, iz)]); }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), ix = Math.round((x - X0) / CELL), iz = Math.round((z - Z0) / CELL), v = vIdx(ix, iz);
      paintGround(x, z, y, 1 - nrm.getY(i), tmp);
      if (DMIN[v] < 12) tmp.lerp(C.verge, (1 - sstep(HW0, HW0 + 4, DMIN[v])) * 0.55);
      if (riverD[v] < RV.width / 2 + RV.bank) tmp.lerp(C.mud, (1 - sstep(RV.width / 2, RV.width / 2 + RV.bank, riverD[v])) * 0.6);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, shadowSide: THREE.BackSide }));
    m.castShadow = true; m.receiveShadow = true; m.name = 'merida-terrain'; scene.add(m); return m;
  })();
  {
    const F = W0.far, geo = new THREE.PlaneGeometry(F.size, F.size, F.segs, F.segs); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, baseNat(pos.getX(i), pos.getZ(i)) - 0.8);
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); paintGround(x, z, pos.getY(i), 1 - nrm.getY(i), tmp); colors.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); if (inSquare(x, z, 40)) pos.setY(i, -200); else if (inSquare(x, z, -2)) pos.setY(i, pos.getY(i) - 2.5); }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m.receiveShadow = true; scene.add(m);
  }

  /* ---------------- road surface, slipways, skirts ---------------- */
  function stripMesh(rows, mat, vScale, closed, colors) {
    const pos = [], uv = [], idx = [], cl = []; let dist = 0;
    rows.forEach((r, i) => {
      if (i) dist += r.a.distanceTo(rows[i - 1].a);
      pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale);
      if (colors) { const c = colors[i]; cl.push(c.r, c.g, c.b, c.r, c.g, c.b); }
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    if (closed) { const k = (rows.length - 1) * 2; idx.push(k, k + 1, 0, k + 1, 1, 0); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  const TINT = Object.fromEntries(Object.entries(MAP.road.tint).map(([k, v]) => [k, col(v)]));
  {
    const rows = [], tints = [], sk = [[], []], STONE = col('#8a8276'), cs = [];
    for (let j = w1 + 1; j <= w0 - 1 + NR; j++) {
      const i = wrap(j), hw = hwA[i], c = new THREE.Color(0, 0, 0);
      for (let k = -10; k <= 10; k++) c.add(TINT[SEG[wrap(i + k)] === 'w' ? SEG[i] : SEG[wrap(i + k)]]); tints.push(c.multiplyScalar(1 / 21));
      rows.push({ a: roadAt(i, -hw, 0.12), b: roadAt(i, hw, 0.12) });
      [-1, 1].forEach((s, k) => sk[k].push({ a: roadAt(i, s * hw, 0.11), b: roadAt(i, s * (hw + 0.6), isBridge[i] ? -1.2 : -2.6) }));
      cs.push(STONE);
    }
    const road = stripMesh(rows, new THREE.MeshStandardMaterial({ map: asphaltTex, vertexColors: true, roughness: 0.82, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), 20, false, tints);
    road.castShadow = true; road.name = 'merida-road';
    const skirt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    sk.forEach(r => stripMesh(r, skirt, 20, false, cs));
    // concrete slipways down into the lake at both shores
    const concrete = new THREE.MeshStandardMaterial({ color: col('#a8a49a'), roughness: 0.85, side: THREE.DoubleSide });
    for (const [from, dir] of [[w0, 1], [w1, -1]]) {
      const rr2 = []; for (let k = -2; k <= 16; k++) { const i = wrap(from + dir * k), hw = hwA[i], dy = -Math.max(0, k) * 0.14; rr2.push({ a: roadAt(i, -hw, 0.08 + dy), b: roadAt(i, hw, 0.08 + dy) }); }
      stripMesh(rr2, concrete, 20, false);
    }
  }

  /* ---------------- water ---------------- */
  const waterMats = [];
  function flowMaterial(opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR }, uA: { value: opts.alpha ?? 0.88 }, uDeep: { value: col(opts.deep || '#2a5a6a') }, uShallow: { value: col(opts.shallow || '#6aa8b0') } }]),
      vertexShader: `attribute float steep; attribute float foam; varying vec2 vUv; varying float vSteep; varying float vFoam; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vSteep = steep; vFoam = foam; vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uSun; uniform float uA; uniform vec3 uDeep; uniform vec3 uShallow; varying vec2 vUv; varying float vSteep; varying float vFoam; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          float flow = vUv.y - uT * (1.1 + vSteep * 2.6);
          float a = sin(vUv.x * 14.0 + sin(vUv.y * 0.35 + uT) * 2.0 + flow * 1.3), b = sin(vUv.x * 5.0 - flow * 2.0 + sin(vUv.y * 0.2) * 3.0);
          float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
          vec3 c = mix(uDeep, uShallow, 0.45 + 0.3 * a);
          vec3 V = normalize(cameraPosition - vW);
          c += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uSun, normalize(vec3(a * 0.08, 1.0, b * 0.08))), V), 0.0), 90.0) * 1.2;
          c = mix(c, vec3(0.97, 0.98, 0.98), clamp(vFoam * (0.6 + 0.4 * b), 0.0, 1.0));
          float alpha = uA * (0.5 + 0.5 * edge);
          float y = vUv.y * 1.4 - uT * 2.4, st = smoothstep(0.15, 0.95, sin(vUv.x * 60.0 + sin(vUv.x * 13.0) * 4.0) * 0.55 + sin(vUv.x * 21.0 + y * 0.35) * sin(y * 1.7 + vUv.x * 9.0) * 0.45);
          c = mix(c, mix(vec3(0.82, 0.88, 0.9), vec3(1.0), 0.4 + 0.6 * st), vSteep); alpha = mix(alpha, uA * (0.5 + 0.5 * st) * edge, vSteep);
          gl_FragColor = vec4(c, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3,
    });
    waterMats.push(m); return m;
  }
  function ribbon(rows, mat, vScale = 0.22) {
    const pos = [], uv = [], st = [], fo = [], idx = []; let dist = 0;
    rows.forEach((r, i) => {
      if (i) dist += r.c.distanceTo(rows[i - 1].c);
      for (const s of [-1, 1]) { const v = r.c.clone().addScaledVector(r.side, s * r.w); pos.push(v.x, v.y, v.z); uv.push((s + 1) / 2, dist * vScale); st.push(r.steep || 0); fo.push(r.foam || 0); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('steep', new THREE.Float32BufferAttribute(st, 1)); geo.setAttribute('foam', new THREE.Float32BufferAttribute(fo, 1)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; scene.add(m); return m;
  }
  // the lake: deep blue in the middle, reflecting the sky toward the shore
  const lake = (() => {
    const g = new THREE.CircleGeometry(1, 96); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR } }]),
      vertexShader: `varying vec3 vW; varying vec2 vL;
        #include <fog_pars_vertex>
        void main(){ vL = position.xz; vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uSun; varying vec3 vW; varying vec2 vL;
        #include <fog_pars_fragment>
        void main(){
          float r = length(vL);
          float a = sin(vW.x * 0.35 + uT * 1.2 + sin(vW.z * 0.21) * 2.0) * sin(vW.z * 0.31 - uT * 0.9) + 0.5 * sin(vW.x * 1.3 - uT * 2.1) * sin(vW.z * 1.1 + uT);
          vec3 N = normalize(vec3(a * 0.05, 1.0, a * 0.04)), V = normalize(cameraPosition - vW);
          vec3 deep = vec3(0.03, 0.15, 0.26), shallow = vec3(0.1, 0.34, 0.4), sky = vec3(0.4, 0.58, 0.82);
          vec3 c = mix(deep, shallow, smoothstep(0.55, 1.0, r));
          float fres = 0.06 + 0.6 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          c = mix(c, sky, fres);
          c += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uSun, N), V), 0.0), 160.0) * 2.0;
          c = mix(c, vec3(0.92, 0.95, 0.95), smoothstep(0.965, 0.995, r) * 0.25);
          gl_FragColor = vec4(c, mix(0.96, 0.75, smoothstep(0.9, 1.0, r)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true,
    }));
    m.scale.set(LK.rx * 1.12, 1, LK.rz * 1.12); m.position.set(LCX, LK.level, LCZ); m.renderOrder = 1; m.name = 'merida-laguna'; scene.add(m);
    waterMats.push(m.material); return m;
  })();
  // the river and its rapids
  {
    const FLOW = flowMaterial({ deep: '#2a5a5a', shallow: '#7ab0b0' }), rows = [];
    let prev = null;
    riverPts.forEach((p, k) => {
      const q = riverPts[Math.min(riverPts.length - 1, k + 1)], r0 = riverPts[Math.max(0, k - 1)], t = V3(q.x - r0.x, 0, q.z - r0.z).normalize(), side = V3(-t.z, 0, t.x);
      const steep = prev === null ? 0 : clamp((prev - p.y) / 2 / 0.35, 0, 1) * 0.6;
      rows.push({ c: V3(p.x, p.y + 0.25, p.z), side, w: RV.width / 2 + 0.6, steep, foam: 0.08 + steep * 0.8 }); prev = p.y;
    });
    const m = ribbon(rows, FLOW); m.name = 'merida-rio';
  }
  // the waterfall over the rock step
  const sprayAt = [];
  {
    const WF = MAP.waterfall, FALL = flowMaterial({ alpha: 0.92 }), rows = [], a = V3(WF.from[0], 0, WF.from[1]), b = V3(WF.to[0], 0, WF.to[1]), dir = b.clone().sub(a).normalize(), side = V3(-dir.z, 0, dir.x);
    let prev = null, was = false; const n = Math.ceil(a.distanceTo(b) / 0.6);
    for (let k = 0; k <= n; k++) {
      const p = a.clone().lerp(b, k / n), y = groundH(p.x, p.z) + 0.25, steep = prev === null ? 0 : clamp(Math.abs(prev - y) / 0.6 / 2.5, 0, 1);
      if (was && steep < 0.3) sprayAt.push(V3(p.x, y + 0.6, p.z)); was = steep > 0.5;
      rows.push({ c: V3(p.x + dir.x * steep * 2.2, y + steep * 0.4, p.z + dir.z * steep * 2.2), side, w: WF.width / 2 * (steep > 0.5 ? 1.25 : 1), steep, foam: steep > 0.5 ? 0.6 : 0.1 }); prev = y;  // falling water stands off the face
    }
    ribbon(rows, FALL);
    const end = rows.at(-1).c, pool = new THREE.Mesh(new THREE.CircleGeometry(7, 32), lake.material); pool.rotation.x = -PI / 2; pool.position.copy(end).add(V3(0, -0.1, 0)); scene.add(pool);
  }

  /* ---------------- instance buffers ---------------- */
  const inst = { trunk: [], blob: [], bush: [], frond: [], leaf: [], grass: [], rock: [], stone: [], flower: [], cyl: [], cone: [], wall: [], roof: [], dark: [], wood: [], buoy: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const yawOf = v => Math.atan2(v.x, v.z);
  const between = (a, b, r, list, color) => { const dir = b.clone().sub(a), len = dir.length(); push(list, a, new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), S.set(r, len, r), color); };
  const freeOf = (x, z, m) => roadDist(x, z) > HW0 + m && riverQuery(x, z).d > RV.width / 2 + 2.5 && lakeE(x, z) > 1.08;
  const tries = (n, fn) => { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; };
  const rndSq = () => [rr(X0 + 6, X0 + SIZE - 6), rr(Z0 + 6, Z0 + SIZE - 6)];

  // frailejón: a woolly trunk wrapped in dry leaves, a silver-green rosette, yellow daisies on tall stalks
  function frailejon(x, z, s = 1) { vegetation.add('frailejon', x, z, groundH(x,z), s, roadDist(x,z)); }
  function pajonal(x, z) { const y = groundH(x, z), s = rr(0.6, 1.2); push(inst.grass, V3(x, y - 0.05, z), qYaw(rand() * TAU), S.set(s * 1.3, s, s * 1.3), col(pick(['#c8b46a', '#b0a45a', '#a8b060', '#d0c080'])).offsetHSL(0, 0, rr(-0.06, 0.04))); }
  function rock(x, z, s) { const y = groundH(x, z); push(inst.rock, V3(x, y + s * 0.15, z), qEuler(rr(-0.3, 0.3), rand() * TAU, rr(-0.3, 0.3)), S.set(s * rr(1, 1.5), s * rr(0.5, 0.8), s), col('#8a8478').offsetHSL(0, 0, rr(-0.08, 0.06))); }
  function cloudTree(x, z, s = 1) { vegetation.add('tree', x, z, groundH(x,z), 1.05, roadDist(x,z)); }
  function treeFern(x, z, s = 1) { vegetation.add('fern', x, z, groundH(x,z), 1, roadDist(x,z)); }
  function fernClump(x, z, s) { const y = groundH(x, z), gc = col('#4fa83a').offsetHSL(rr(-0.03, 0.04), 0, rr(-0.06, 0.05)); for (let k = 0; k < 6; k++) push(inst.frond, V3(x, y, z), qEuler(rr(-0.6, -0.2), k / 6 * TAU + rr(-0.2, 0.2), 0), S.set(s * 0.8, s * 1.8, s * 1.8), gc); }
  function pine(x, z, s = 1) { vegetation.add('pine', x, z, groundH(x,z), 1.4, roadDist(x,z)); }
  function eucalyptus(x, z) {
    const y = groundH(x, z), h = rr(14, 22); push(inst.trunk, V3(x, y - 0.3, z), qYaw(rand() * TAU), S.set(0.4, h, 0.4), col('#c8bca8'));
    for (let k = 0; k < 5; k++) { const s = rr(1.6, 2.8); push(inst.blob, V3(x + rr(-2, 2), y + h * rr(0.6, 1.0), z + rr(-2, 2)), qEuler(rand(), rand() * TAU, 0), S.set(s, s * 1.3, s), col('#6a8a6a').offsetHSL(0, 0, rr(-0.05, 0.05))); }
  }
  function bush(x, z, s, flowerCol) {
    const y = groundH(x, z), base = col(pick(['#3a7a30', '#4a8a3a', '#2f6a2a']));
    for (let k = 0; k < 3; k++) { const a = rand() * TAU, r = rr(0, 1) * s, sc = s * rr(0.9, 1.4); push(inst.bush, V3(x + Math.cos(a) * r, y + sc * 0.45, z + Math.sin(a) * r), qEuler(rand(), rand() * TAU, 0), S.set(sc, sc * 0.75, sc), base.clone().offsetHSL(0, 0, rr(-0.05, 0.05))); }
    if (flowerCol) for (let k = 0; k < 10; k++) { const a = rand() * TAU, r = rr(0.4, 1.4) * s; push(inst.flower, V3(x + Math.cos(a) * r, y + s * rr(0.7, 1.4), z + Math.sin(a) * r), Q, S.set(0.28, 0.28, 0.28), col(flowerCol)); }
  }

  /* ---------------- the town: colonial houses, the plaza, the church, the flag ---------------- */
  const flagPole = (() => {
    const house = (x, z, yaw, w, dpt, h, wallC) => {
      const y = groundH(x, z) - 0.3, f = V3(Math.sin(yaw), 0, Math.cos(yaw)), sd = V3(f.z, 0, -f.x);
      push(inst.wall, V3(x, y, z), qYaw(yaw), S.set(w, h + 0.3, dpt), col(wallC));
      push(inst.roof, V3(x, y + h + 0.3, z), qYaw(yaw), S.set(w + 1.2, rr(1.8, 2.6), dpt + 1.4), col(pick(['#b8502a', '#a8442a', '#c45a30'])));
      const front = V3(x, y, z).addScaledVector(f, dpt / 2 + 0.05), door = rr(-w / 4, w / 4);
      push(inst.wood, front.clone().addScaledVector(sd, door).add(V3(0, 0, 0)), qYaw(yaw), S.set(1.3, 2.4, 0.15), col(pick(['#2a6a9a', '#3a8a4a', '#7a4a2a', '#c0392b'])));
      push(inst.wall, front.clone().addScaledVector(sd, 0).add(V3(0, 0, 0)), qYaw(yaw), S.set(w + 0.05, 0.6, 0.12), col('#3a6a9a'));
      for (let k = -1; k <= 1; k += 2) { const wx = k * w * 0.3; if (Math.abs(wx - door) < 1.6) continue; push(inst.dark, front.clone().addScaledVector(sd, wx).add(V3(0, 1.0, 0)), qYaw(yaw), S.set(1.1, 1.4, 0.14), col('#2a3a4a')); push(inst.wood, front.clone().addScaledVector(sd, wx).add(V3(0, 0.95, 0.05)), qYaw(yaw), S.set(1.4, 0.15, 0.3), col('#6a4a2a')); }
      if (h > 6) push(inst.wood, front.clone().add(V3(0, h * 0.55, 0)).addScaledVector(f, 0.6), qYaw(yaw), S.set(w * 0.6, 0.18, 1.2), col('#5a3a22'));
      if (rand() < 0.5) for (let k = 0; k < 4; k++) push(inst.flower, front.clone().addScaledVector(sd, rr(-w / 2, w / 2)).add(V3(0, rr(1.6, 2.2), 0)).addScaledVector(f, 0.25), Q, S.set(0.25, 0.25, 0.25), col(pick(['#e0263a', '#ff6ab0', '#ffd23a', '#ffffff'])));
    };
    for (const row of TN.rows) for (const side of [-1, 1]) {
      let x = ST0.from + rr(0, 4);
      while (x < ST0.to) {
        const w = rr(8, 13), cx = x + w / 2;
        const blocked = TN.gaps.some(g => cx > g[0] - w / 2 && cx < g[1] + w / 2 && (!g[2] || (g[2] === 'n' && side < 0)));
        if (!blocked) { const dp = rr(...row.depth), z = ST0.z + side * (row.lat + dp / 2), h = rr(4.5, 7.5); if (riverQuery(cx, z).d > dp / 2 + 8) house(cx, z, side < 0 ? 0 : PI, w - 0.4, dp, h, pick(TN.colors)); }
        x += w;
      }
    }
    // plaza: trees, benches, fountain, lamp posts
    const pl = TN.plaza, py = groundH(pl.at[0], pl.at[1]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, x = pl.at[0] + Math.cos(a) * pl.size[0] * 0.38, z = pl.at[1] + Math.sin(a) * pl.size[1] * 0.36; const y = groundH(x, z); push(inst.trunk, V3(x, y, z), Q, S.set(0.3, 3.5, 0.3), col('#6a5440')); push(inst.blob, V3(x, y + 4.5, z), qYaw(rand()), S.set(2.6, 2.2, 2.6), col('#3a8a3a')); push(inst.wood, V3(x + Math.cos(a) * -3, y + 0.45, z + Math.sin(a) * -3), qYaw(-a + PI / 2), S.set(2.2, 0.2, 0.6), col('#6a4a2a')); push(inst.cyl, V3(x + Math.cos(a + 0.4) * -5, y, z + Math.sin(a + 0.4) * -5), Q, S.set(0.08, 4, 0.08), col('#2a2a2a')); push(inst.flower, V3(x + Math.cos(a + 0.4) * -5, y + 4.1, z + Math.sin(a + 0.4) * -5), Q, S.set(0.3, 0.3, 0.3), col('#fff2c0')); }
    push(inst.cyl, V3(pl.at[0], py, pl.at[1]), Q, S.set(4, 0.7, 4), col('#c8c0b0')); push(inst.cyl, V3(pl.at[0], py, pl.at[1]), Q, S.set(0.5, 2.6, 0.5), col('#d8d0c0')); push(inst.cyl, V3(pl.at[0], py + 2, pl.at[1]), Q, S.set(1.4, 0.3, 1.4), col('#d8d0c0'));
    // the church, facing the plaza
    const ch = TN.church, cy = groundH(ch.at[0], ch.at[1]) - 0.3, cxp = ch.at[0], czp = ch.at[1];
    push(inst.wall, V3(cxp, cy, czp - 6), Q, S.set(16, 13, 28), col('#f6f2e8'));
    push(inst.roof, V3(cxp, cy + 13, czp - 6), Q, S.set(17, 4, 29), col('#a8442a'));
    for (const s of [-1, 1]) {
      push(inst.wall, V3(cxp + s * 9, cy, czp + 6), Q, S.set(5, 22, 5), col('#f6f2e8'));
      push(inst.wall, V3(cxp + s * 9, cy + 15, czp + 6), Q, S.set(5.4, 0.6, 5.4), col('#f2c12e'));
      push(inst.dark, V3(cxp + s * 9, cy + 17, czp + 8.55), Q, S.set(1.6, 2.6, 0.15), col('#3a2a20'));
      push(inst.cone, V3(cxp + s * 9, cy + 22, czp + 6), qYaw(PI / 4), S.set(3.6, 5, 3.6), col('#c45a30'));
      push(inst.wall, V3(cxp + s * 9, cy + 26.8, czp + 6), Q, S.set(0.25, 2.2, 0.25), col('#f2c12e')); push(inst.wall, V3(cxp + s * 9, cy + 28, czp + 6), Q, S.set(1.2, 0.25, 0.25), col('#f2c12e'));
    }
    push(inst.wall, V3(cxp, cy, czp + 6.5), Q, S.set(13, 16, 4), col('#f8f4ea'));
    push(inst.roof, V3(cxp, cy + 16, czp + 6.5), qYaw(PI / 2), S.set(4.5, 3.4, 13.4), col('#f6f2e8'));
    push(inst.wall, V3(cxp, cy + 9, czp + 8.6), Q, S.set(13.2, 0.5, 0.2), col('#f2c12e'));
    push(inst.wood, V3(cxp, cy, czp + 8.6), Q, S.set(3.2, 5.2, 0.2), col('#5a3a22'));
    push(inst.dark, V3(cxp, cy + 11, czp + 8.6), Q, S.set(2.2, 2.2, 0.2), col('#2a4a7a'));
    push(inst.wall, V3(cxp, cy, czp + 16), Q, S.set(14, 0.6, 6), col('#c8c0b0'));
    // the flag in the plaza
    const fp = TN.flag.at, fy = groundH(fp[0], fp[1]);
    push(inst.cyl, V3(fp[0], fy, fp[1]), Q, S.set(0.12, 12, 0.12), col('#e8e8e8'));
    const flagTex = canvasTex(256, 168, (c, w, h) => {
      c.fillStyle = '#ffd23a'; c.fillRect(0, 0, w, h / 3); c.fillStyle = '#1f4fd8'; c.fillRect(0, h / 3, w, h / 3); c.fillStyle = '#e0263a'; c.fillRect(0, 2 * h / 3, w, h / 3);
      c.fillStyle = '#ffffff';
      for (let k = 0; k < 8; k++) { const a = PI * (0.82 - 0.64 * k / 7), cx = w / 2 + Math.cos(a) * h * 0.28, cy2 = h * 0.62 - Math.sin(a) * h * 0.28; c.beginPath(); for (let j = 0; j < 10; j++) { const b = -PI / 2 + j * PI / 5, r = j % 2 ? 2.4 : 6; c.lineTo(cx + Math.cos(b) * r, cy2 + Math.sin(b) * r); } c.fill(); }
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8, 16, 4), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.geometry.translate(2.1, 0, 0); flag.position.set(fp[0] + 0.1, fy + 10.4, fp[1]); flag.castShadow = true; scene.add(flag);
    return flag;
  })();

  /* ---------------- the stone bridge ---------------- */
  {
    const ids = []; for (let i = 0; i < NR; i++) if (isBridge[i]) ids.push(i);
    if (ids.length) {
      const STONE_C = col('#a09484');
      // deck slab and parapets
      for (const i of ids) {
        const f = roadFrame(i), hw = hwA[i];
        if (i % 2 === 0) for (const s of [-1, 1]) push(inst.stone, roadAt(i, s * (hw + 0.4), 0.55), qYaw(yawOf(f.t)), S.set(0.5, 0.9, 1.05), STONE_C.clone().offsetHSL(0, 0, rr(-0.05, 0.05)));
      }
      // arches: a pier every 9 m reaching the riverbed, an arch between them
      for (let k = 0; k < ids.length; k += 9) {
        const i = ids[k], f = roadFrame(i), top = roadY[i] - 0.4, bot = groundH(RP[i].x, RP[i].z) - 1;
        push(inst.wall, V3(RP[i].x, bot, RP[i].z), qYaw(yawOf(f.t)), S.set(hwA[i] * 2 + 1.2, top - bot, 2.2), STONE_C);
      }
      const archGeo = new THREE.TorusGeometry(1, 0.22, 8, 20, PI);
      const archMat = new THREE.MeshStandardMaterial({ color: STONE_C, roughness: 0.9 });
      for (let k = 0; k + 9 < ids.length; k += 9) {
        const a = ids[k], b = ids[k + 9], mid = Math.round((a + b) / 2), f = roadFrame(mid), span = RP[a].distanceTo(RP[b]) / 2, top = roadY[mid] - 0.4, bot = groundH(RP[mid].x, RP[mid].z) - 1;
        for (const s of [-1, 1]) {
          const m = new THREE.Mesh(archGeo, archMat); m.scale.set(span, Math.max(1, (top - bot) * 0.8), span * 0.8);
          m.position.copy(RP[mid]).addScaledVector(f.n, s * (hwA[mid] + 0.2)).setY(bot); m.rotation.y = yawOf(f.t) + PI / 2; m.castShadow = true; scene.add(m);
        }
        const deck = new THREE.Mesh(new THREE.BoxGeometry(hwA[mid] * 2 + 1.2, 1.2, span * 2), archMat); deck.position.copy(RP[mid]).setY(top - 0.2); deck.rotation.y = yawOf(f.t); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
      }
    }
  }

  /* ---------------- the teleférico: towers, cables and two cabins ---------------- */
  const tele = (() => {
    const T = MAP.teleferico, A = V3(T.from[0], groundH(...T.from) + T.fromY, T.from[1]), B = V3(T.to[0], groundH(...T.to) + T.toY, T.to[1]);
    const at = u => A.clone().lerp(B, u).add(V3(0, -T.sag * 4 * u * (1 - u), 0));
    const steel = new THREE.MeshStandardMaterial({ color: col('#9aa0aa'), roughness: 0.5, metalness: 0.5 });
    const g = new THREE.Group(); scene.add(g);
    const dir = B.clone().sub(A).setY(0).normalize(), side = V3(-dir.z, 0, dir.x);
    // cables: two lines a few metres apart, as thin tubes
    for (const s of [-2.2, 2.2]) {
      const pts = []; for (let k = 0; k <= 60; k++) pts.push(at(k / 60).addScaledVector(side, s));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.09, 5), new THREE.MeshStandardMaterial({ color: col('#3a3a3a'), roughness: 0.5 })); g.add(tube);
    }
    // stations
    const station = (p, gy) => {
      const h = p.y - gy + 2;
      const s = new THREE.Mesh(new THREE.BoxGeometry(12, h, 12), new THREE.MeshStandardMaterial({ color: col('#e8e4dc'), roughness: 0.7 })); s.position.set(p.x, gy + h / 2 - 1, p.z); s.castShadow = true; s.receiveShadow = true; g.add(s);
      const r = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 14), new THREE.MeshStandardMaterial({ color: col('#c0392b'), roughness: 0.6 })); r.position.set(p.x, gy + h - 0.2, p.z); g.add(r);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.3, 8, 24), steel); wheel.rotation.x = PI / 2; wheel.position.copy(p).add(V3(0, 0.6, 0)); g.add(wheel);
    };
    station(A, groundH(...T.from)); station(B, groundH(...T.to));
    // towers where they do not stand on the road
    for (let u of T.towers) {
      let p = at(u); for (let k = 0; k < 8 && roadDist(p.x, p.z) < HW0 + 10; k++) { u += 0.02; p = at(u); }
      const gy = groundH(p.x, p.z), h = p.y - gy + 1.5;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.6, h, 4), steel); tw.position.set(p.x, gy + h / 2, p.z); tw.rotation.y = yawOf(dir) + PI / 4; tw.castShadow = true; g.add(tw);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 0.8), steel); arm.position.set(p.x, p.y + 0.8, p.z); arm.rotation.y = yawOf(side); g.add(arm);
    }
    // cabins: red boxes with windows, one going up as the other comes down
    const cabins = [];
    for (let k = 0; k < T.cabins; k++) {
      const c = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 4.2), new THREE.MeshStandardMaterial({ color: col('#e0263a'), roughness: 0.4, metalness: 0.2 })); body.position.y = -3.6; body.castShadow = true; c.add(body);
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.25, 1.0, 3.6), new THREE.MeshStandardMaterial({ color: col('#bfe0f0'), roughness: 0.1, metalness: 0.3 })); win.position.y = -3.2; c.add(win);
      const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), steel); hanger.position.y = -1.2; c.add(hanger);
      g.add(c); cabins.push({ c, side: k % 2 ? -2.2 : 2.2, ph: k * 0.5 });
    }
    const update = t => cabins.forEach(cb => { const ph = (t / T.period + cb.ph) % 1, u = 0.03 + 0.94 * (ph < 0.5 ? sstep(0, 0.5, ph) : 1 - sstep(0.5, 1, ph)); cb.c.position.copy(at(u)).addScaledVector(side, cb.side); cb.c.rotation.y = yawOf(dir); });
    return { update, at };
  })();

  /* ---------------- the lake: buoys along the lancha channel, reeds, a dock with boats ---------------- */
  const buoys = [];
  for (let i = w0; i <= w1; i += MAP.lake.buoyEvery) for (const s of [-1, 1]) { const p = roadAt(i, s * (hwA[i] + 0.8), 0); p.y = LK.level; buoys.push({ p, ph: rand() * TAU, c: ((i / MAP.lake.buoyEvery) | 0) % 2 ? col('#ff6a1a') : col('#ffffff') }); }
  const buoyMesh = (() => {
    const g = new THREE.SphereGeometry(0.6, 12, 8); const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.4 }), buoys.length);
    buoys.forEach((b, k) => { m.setColorAt(k, b.c); }); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m;
  })();
  tries(MAP.vegetation.reeds, () => {
    const a = rand() * TAU, e = rr(0.97, 1.06), x = LCX + Math.cos(a) * LK.rx * e, z = LCZ + Math.sin(a) * LK.rz * e;
    if (roadDist(x, z) < 22) return false;
    for (let k = 0; k < 5; k++) push(inst.grass, V3(x + rr(-1, 1), LK.level - 0.3, z + rr(-1, 1)), qYaw(rand() * TAU), S.set(1.2, rr(1.6, 2.4), 1.2), col('#7a9a4a').offsetHSL(0, 0, rr(-0.05, 0.05)));
    return true;
  });
  {
    // a wooden dock on the north shore with two trout boats
    const a = -PI / 2 - 0.5, base = V3(LCX + Math.cos(a) * LK.rx * 0.96, LK.level + 0.5, LCZ + Math.sin(a) * LK.rz * 0.96), out = V3(LCX - base.x, 0, LCZ - base.z).normalize();
    for (let k = 0; k < 8; k++) { const p = base.clone().addScaledVector(out, k * 2); push(inst.wood, p, qYaw(yawOf(out)), S.set(3, 0.25, 2), col('#7a5a3a')); for (const s of [-1, 1]) push(inst.wood, p.clone().add(V3(out.z * s * 1.4, -2.4, -out.x * s * 1.4)), Q, S.set(0.25, 2.6, 0.25), col('#5a4028')); }
    for (const s of [-1, 1]) { const p = base.clone().addScaledVector(out, 10).add(V3(out.z * s * 3.4, -0.5, -out.x * s * 3.4)); push(inst.wood, p, qYaw(yawOf(out)), S.set(1.6, 0.6, 4.4), col(s > 0 ? '#2a6a9a' : '#e0b030')); }
  }

  /* ---------------- vegetation ---------------- */
  const VG = MAP.vegetation;
  const paramoAt = y => y > 44 && y < TER.snowLine - 40;
  const nearRoad = r => { const i = (rand() * NR) | 0, f = roadFrame(i), l = (rand() < 0.5 ? -1 : 1) * (HW0 + 2 + rand() * r); return [f.p.x + f.n.x * l + rr(-3, 3), f.p.z + f.n.z * l + rr(-3, 3)]; };
  tries(VG.frailejones, () => { const [x, z] = rand() < 0.6 ? nearRoad(70) : rndSq(), y = groundH(x, z); if (!paramoAt(y) || !freeOf(x, z, 2)) return false; if (rand() > 0.35 + 0.65 * fbm2(x * 0.02, z * 0.02, 2)) return false; frailejon(x, z, rr(1.0, 1.5)); return true; });
  tries(VG.pajonal, () => { const [x, z] = rndSq(), y = groundH(x, z); if (y < 30 || y > TER.snowLine || !freeOf(x, z, 1.2)) return false; pajonal(x, z); return true; });
  tries(VG.rocks, () => { const [x, z] = rndSq(), y = groundH(x, z); if (y < 40 || !freeOf(x, z, 2.5)) return false; rock(x, z, rr(0.6, 2.4)); return true; });
  const cloudZone = (x, z, y) => x < -150 && y > 8 && y < 68 && !inTown(x, z);
  tries(VG.cloudForest.trees, () => { const [x, z] = rndSq(), y = groundH(x, z); if (!cloudZone(x, z, y) || !freeOf(x, z, 4)) return false; cloudTree(x, z); return true; });
  tries(VG.cloudForest.ferns, () => { const [x, z] = rndSq(), y = groundH(x, z); if (!cloudZone(x, z, y) || !freeOf(x, z, 1.5)) return false; rand() < 0.35 ? treeFern(x, z) : fernClump(x, z, rr(0.9, 1.6)); return true; });
  tries(VG.cloudForest.pines, () => { const [x, z] = rndSq(), y = groundH(x, z); if (y < 10 || y > 50 || x < -150 || fieldAt(x, z) || inTown(x, z) || !freeOf(x, z, 4)) return false; pine(x, z); return true; });
  tries(VG.valley.eucalyptus, () => { const [x, z] = rndSq(), y = groundH(x, z); if (y > 14 || inTown(x, z) || fieldAt(x, z) || !freeOf(x, z, 4)) return false; eucalyptus(x, z); return true; });
  tries(VG.valley.bushes, () => { const [x, z] = rndSq(), y = groundH(x, z); if (y > 40 || inTown(x, z) || fieldAt(x, z) || !freeOf(x, z, 1.5)) return false; bush(x, z, rr(0.8, 1.4), rand() < 0.3 ? pick(['#ffd23a', '#ffffff', '#e0263a']) : null); return true; });
  tries(VG.valley.bougainvillea, () => { const x = rr(ST0.from, ST0.to), z = ST0.z + (rand() < 0.5 ? -1 : 1) * rr(11.5, 13.5); if (!freeOf(x, z, 0.5)) return false; bush(x, z, rr(0.7, 1.1), pick(['#d0207a', '#ff4fa8', '#ff7a2a'])); return true; });
  // stone walls (pircas) round the fields
  for (const f of fields) {
    const c = Math.cos(f.rot), s = Math.sin(f.rot), corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [f.x + (u * f.w / 2) * c - (v * f.l / 2) * s, f.z + (u * f.w / 2) * s + (v * f.l / 2) * c]);
    for (let k = 0; k < 4; k++) { const [ax, az] = corners[k], [bx, bz] = corners[(k + 1) % 4], n = Math.floor(Math.hypot(bx - ax, bz - az) / 0.9); for (let j = 0; j < n; j++) { const x = lerp(ax, bx, j / n), z = lerp(az, bz, j / n); if (!freeOf(x, z, 1)) continue; const sz = rr(0.35, 0.6); push(inst.stone, V3(x, groundH(x, z) + sz * 0.4, z), qEuler(rand(), rand() * TAU, rand()), S.set(sz * 1.3, sz, sz), col('#8a8478').offsetHSL(0, 0, rr(-0.06, 0.06))); } }
  }

  /* ---------------- flush instances ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im;
  }
  const BARK = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true });
  const CANOPY = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }), 0.04, 0.02);
  { const g = new THREE.CylinderGeometry(0.7, 1, 1, 7, 2); g.translate(0, 0.5, 0); flush(inst.trunk, g, BARK); }
  flush(inst.blob, new THREE.IcosahedronGeometry(1, 1), CANOPY);
  flush(inst.bush, new THREE.IcosahedronGeometry(1, 0), CANOPY);
  {
    const g = new THREE.PlaneGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -Math.sin(y * 1.6) * 0.25 + y * y * 0.55); p.setY(i, y * (1 - y * 0.25)); }
    g.rotateX(-PI / 2 + 0.25); g.computeVertexNormals();
    flush(inst.frond, g, windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: frondTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), 0, 0.05), false);
    const l = new THREE.PlaneGeometry(1, 1, 1, 4); l.translate(0, 0.5, 0); const lp = l.attributes.position;
    for (let i = 0; i < lp.count; i++) { const y = lp.getY(i); lp.setZ(i, y * y * 0.35); } l.rotateX(-PI / 2 + 0.2); l.computeVertexNormals();
    flush(inst.leaf, l, windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: leafTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95 }), 0, 0.04), false);
  }
  {
    const a = new THREE.PlaneGeometry(1, 1, 1, 2); a.translate(0, 0.5, 0); const b = a.clone(); b.rotateY(PI / 2);
    const g = new THREE.BufferGeometry(), pa = a.attributes.position.array, pb = b.attributes.position.array;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...pa, ...pb], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([...a.attributes.uv.array, ...b.attributes.uv.array], 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pa.length + pb.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    const ia = [...a.index.array], off = a.attributes.position.count; g.setIndex([...ia, ...ia.map(v => v + off)]);
    flush(inst.grass, g, windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0, 0.15), false);
  }
  flush(inst.rock, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true }));
  flush(inst.stone, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true }));
  flush(inst.flower, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, emissive: col('#331a00'), emissiveIntensity: 0.3, flatShading: true }), false);
  { const g = new THREE.CylinderGeometry(1, 1, 1, 10); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7 })); }
  { const g = new THREE.ConeGeometry(1, 1, 8); flush(inst.cone, g, CANOPY); }
  { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); flush(inst.wall, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85 })); flush(inst.dark, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.3, metalness: 0.2 }), false); flush(inst.wood, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 })); }
  {
    // clay-tile roof: a triangular prism, ridge along z
    const g = new THREE.BufferGeometry(), v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0, 1, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5, 0, 1, 0.5];
    const tri = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 1, 4], [0, 4, 3]], pos = [];
    tri.forEach(t => t.forEach(k => pos.push(v[k * 3], v[k * 3 + 1], v[k * 3 + 2])));
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    flush(inst.roof, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, flatShading: true, side: THREE.DoubleSide }));
  }

  /* ---------------- mist, clouds, spray ---------------- */
  const mist = [], spray = [];
  {
    const mm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#f2f6f8'), transparent: true, opacity: 0.28, depthWrite: false, fog: true });
    for (let k = 0; k < 120; k++) {
      const [x, z] = rndSq(), y = groundH(x, z), cloudy = cloudZone(x, z, y) || paramoAt(y); if (!cloudy && rand() < 0.7) continue;
      const s = new THREE.Sprite(mm); s.position.set(x, y + rr(4, 16), z); const sc = rr(28, 60); s.scale.set(sc, sc * 0.4, 1); scene.add(s); mist.push({ s, x0: x, y0: s.position.y, ph: rand() * TAU });
    }
    const hm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    for (let k = 0; k < 60; k++) { const a = rr(-PI * 0.95, -PI * 0.05), r = rr(900, 2600), s = new THREE.Sprite(hm); s.position.set(CX + Math.cos(a) * r, rr(260, 520), CZ + Math.sin(a) * r); const sc = rr(240, 520); s.scale.set(sc, sc * 0.35, 1); scene.add(s); mist.push({ s, x0: s.position.x, y0: s.position.y, ph: rand() * TAU, far: true }); }
    const sm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.55, depthWrite: false });
    const splash = [...sprayAt, roadAt(w0, 0, 0.6), roadAt(w1, 0, 0.6)];
    for (const p of splash) for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(sm); s.position.copy(p).add(V3(rr(-3, 3), 0, rr(-3, 3))); const sc = rr(1.6, 3.2); s.scale.set(sc, sc, 1); s.userData = { y0: p.y, ph: rand() * TAU, sp: rr(1.2, 2.4) }; scene.add(s); spray.push(s); }
  }

  /* ---------------- condors circling over the peaks ---------------- */
  const condors = [];
  for (let k = 0; k < MAP.life.condors; k++) {
    const g = new THREE.Group(), black = new THREE.MeshStandardMaterial({ color: col('#1a1a1e'), roughness: 0.9, flatShading: true }), white = new THREE.MeshStandardMaterial({ color: col('#f2f2f2'), roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), black); body.scale.set(0.5, 0.45, 1.4); g.add(body);
    const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 6, 12), white); ruff.position.z = 1.1; g.add(ruff);
    const wings = [];
    for (const s of [-1, 1]) { const pv = new THREE.Group(); pv.position.x = s * 0.3; g.add(pv); const w = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1.1), black); w.position.x = s * 1.7; pv.add(w); const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.4), white); tip.position.set(s * 1.4, 0.05, -0.3); pv.add(tip); wings.push({ pv, s }); }
    g.scale.setScalar(1.6); scene.add(g);
    condors.push({ g, wings, c: V3(rr(-200, 250), rr(230, 300), rr(-650, -450)), r: rr(120, 220), sp: rr(0.05, 0.09) * (k % 2 ? -1 : 1), ph: rand() * TAU });
  }

  /* ---------------- per-frame updates ---------------- */
  const m4 = new THREE.Matrix4();
  function update(t, dt, racerS = null) {
    uTime.value = t;
    waterMats.forEach(m => (m.uniforms.uT.value = t));
    buoys.forEach((b, k) => { m4.makeTranslation(b.p.x, b.p.y + 0.15 + Math.sin(t * 2 + b.ph) * 0.12, b.p.z); buoyMesh.setMatrixAt(k, m4); }); buoyMesh.instanceMatrix.needsUpdate = true;
    tele.update(t);
    { const p = flagPole.geometry.attributes.position; if (!flagPole.userData.base) flagPole.userData.base = p.array.slice(); const b0 = flagPole.userData.base; for (let i = 0; i < p.count; i++) { const x = b0[i * 3]; p.setZ(i, Math.sin(t * 4 - x * 1.4) * 0.25 * (x / 4.2)); } p.needsUpdate = true; flagPole.geometry.computeVertexNormals(); }
    condors.forEach(c => { const a = c.ph + t * c.sp, p = V3(c.c.x + Math.cos(a) * c.r, c.c.y + Math.sin(t * 0.3 + c.ph) * 8, c.c.z + Math.sin(a) * c.r), ah = V3(c.c.x + Math.cos(a + 0.05 * Math.sign(c.sp)) * c.r, p.y, c.c.z + Math.sin(a + 0.05 * Math.sign(c.sp)) * c.r); c.g.position.copy(p); c.g.lookAt(ah); c.g.rotateZ(-0.3 * Math.sign(c.sp)); c.wings.forEach(w => (w.pv.rotation.z = w.s * (0.08 + 0.04 * Math.sin(t * 1.5 + c.ph)))); });
    mist.forEach(m => { m.s.position.x = m.x0 + Math.sin(t * (m.far ? 0.01 : 0.04) + m.ph) * (m.far ? 60 : 18); m.s.position.y = m.y0 + Math.sin(t * 0.2 + m.ph) * 1.5; });
    spray.forEach(s => { const k = (t * s.userData.sp * 0.5 + s.userData.ph) % 1; s.position.y = s.userData.y0 + k * 2; s.material.opacity = 0.5 * (1 - k); });

  }


  const world = ownReferenceWorld(scene, groundH, update, createdTextures);
  vegetation.flush(); // Library materials remain shared; collect owned materials first.
  return world;
}
