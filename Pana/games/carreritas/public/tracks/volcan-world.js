import { rng, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { MAP } from './volcan-layout.js';
import { ownReferenceWorld, referenceDetail } from './reference-world.js';

export function createWorld(scene, layout) {
  const { PI, TAU, UP, DEG, clamp, sstep, lerp, col, V3, d, uTime, hash1, W0, CX, CZ, SIZE, HALF, VO, VX, VZ, ih, noise2, fbm2, NOISE_GLSL, RV, riverPts, riverQuery, LL, lakeE, volR, baseNat, natural, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, segRange, isBridge, i0, GR, CELL, X0, Z0, GN, vIdx, NAT, HGT, DMIN, NEAR, inSquare, gridH, groundH, roadDist } = layout;
  const rand = rng(MAP.seed), rr = (a,b) => a + rand() * (b-a);
  const pick = values => pickRandom(values, rand);
  const createdTextures = [];
  const mapDetail = { value: 2 };
  /* ---------------- dusk sky glowing red, moonlight, smoky haze ---------------- */
  const SUN_DIR = new THREE.Vector3(...MAP.sun.dir).normalize();
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: SUN_DIR } },
      vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vD; ${NOISE_GLSL}
        void main(){
          vec3 d = normalize(vD); float h = clamp(d.y, -0.3, 1.0);
          vec3 c = mix(vec3(0.42, 0.12, 0.06), vec3(0.18, 0.06, 0.1), smoothstep(0.0, 0.2, h)); c = mix(c, vec3(0.03, 0.03, 0.08), smoothstep(0.2, 0.8, h));
          c = mix(c, vec3(0.3, 0.1, 0.06), smoothstep(0.0, -0.2, h));
          float smoke = fbm(d.xz / max(d.y, 0.08) * 1.5 + 3.0);
          c = mix(c, vec3(0.14, 0.07, 0.07), smoothstep(0.45, 0.8, smoke) * smoothstep(0.03, 0.3, h) * 0.8);
          float st = step(0.996, h2(floor(d.xy * 700.0) + floor(d.z * 300.0))) * smoothstep(0.25, 0.6, h);
          c += vec3(0.9, 0.9, 1.0) * st * 0.7;
          float m = max(dot(d, uSun), 0.0); c += vec3(0.85, 0.88, 1.0) * (pow(m, 2500.0) * 3.0 + pow(m, 60.0) * 0.08);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    sky.frustumCulled = false; sky.renderOrder = -9; scene.add(sky);
  }
  const hemi = new THREE.HemisphereLight(col('#ff9a6a'), col('#2a1010'), MAP.sun.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(col(MAP.sun.color), MAP.sun.intensity);
  sun.target.position.set(CX, 20, CZ); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 1100);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  { const h = MAP.sun.shadowHalf; Object.assign(sun.shadow.camera, { left: -h, right: h, top: h, bottom: -h, near: 100, far: 2400 }); }
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.0;
  scene.add(sun, sun.target);
  const craterLight = new THREE.PointLight(col('#ff6a1a'), 4, 700, 1); craterLight.position.set(VX, VO.lake.y + 25, VZ); scene.add(craterLight);
  const lakeLight = new THREE.PointLight(col('#ff7a2a'), 2.2, 260, 1); lakeLight.position.set(MAP.lavaLake.at[0], 14, MAP.lavaLake.at[1]); scene.add(lakeLight);
  const riverLight = new THREE.PointLight(col('#ff7a2a'), 2.2, 200, 1); riverLight.position.set(318, 12, 96); scene.add(riverLight);

  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); createdTextures.push(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const asphaltTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#8a8684'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(30,24,24,${rr(0.05, 0.2).toFixed(2)})` : `rgba(255,240,230,${rr(0.04, 0.12).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    c.fillStyle = 'rgba(250,240,230,0.9)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#ffb020'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const crackTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#2a2220'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2000; i++) { c.fillStyle = `rgba(${60 + (rand() * 40) | 0},${40 + (rand() * 30) | 0},${36 + (rand() * 20) | 0},0.5)`; c.fillRect(rand() * w, rand() * h, rr(2, 6), rr(2, 6)); }
  });
  const glowCrackTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ff7a1a'; c.lineCap = 'round';
    for (let k = 0; k < 18; k++) { let x = rand() * w, y = rand() * h; c.lineWidth = rr(1.5, 4); c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 8; j++) { x += rr(-30, 30); y += rr(-30, 30); c.lineTo(x, y); } c.stroke(); }
  });
  const smokeTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });

  /* ---------------- lava: cracked crust drifting over molten rock ---------------- */
  const lavaMats = [];
  const lavaMaterial = (opts = {}) => {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uFlow: { value: opts.flow ?? 0.25 }, uScale: { value: opts.scale ?? 0.09 } }]),
      vertexShader: `varying vec2 vUv; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform float uFlow; uniform float uScale; varying vec2 vUv; varying vec3 vW; ${NOISE_GLSL}
        #include <fog_pars_fragment>
        void main(){
          vec2 p = ${opts.ribbon ? 'vec2(vUv.x * 2.2, vUv.y * 0.12 - uT * uFlow)' : 'vW.xz * uScale + vec2(uT * 0.03, uT * 0.017)'};
          vec2 cl = cellular(p * 2.0 + vec2(fbm(p * 1.5 + uT * 0.05)) * 0.6);
          float crack = 1.0 - smoothstep(0.02, 0.16, cl.y - cl.x);
          float heat = fbm(p * 1.3 - uT * 0.04);
          vec3 crust = mix(vec3(0.08, 0.04, 0.035), vec3(0.22, 0.08, 0.05), heat);
          vec3 hot = mix(vec3(1.6, 0.35, 0.04), vec3(2.6, 1.3, 0.3), smoothstep(0.5, 0.9, heat));
          float molten = clamp(crack + smoothstep(0.62, 0.8, heat) * 0.8, 0.0, 1.0);
          vec3 c = mix(crust, hot, molten);
          gl_FragColor = vec4(c, 1.0);
          #include <fog_fragment>
        }`,
      fog: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, toneMapped: false,
    });
    lavaMats.push(m); return m;
  };

  /* ---------------- ground colours, with glowing fissures ---------------- */
  const C = { sand: col('#2a2626'), sand2: col('#3a3432'), ash: col('#3e3836'), rust: col('#5a2c20'), rust2: col('#7a3a24'), rock: col('#36302e'), sulfur: col('#c8b040'), verge: col('#6a6260'), scorch: col('#140c0a') };
  const fumaroles = []; for (let k = 0, t = 0; k < MAP.fumaroles && t < 400; t++) { const a = rand() * TAU, r = rr(110, 300), x = VX + Math.cos(a) * r, z = VZ + Math.sin(a) * r; if (roadDist(x, z) < 22) continue; fumaroles.push([x, z]); k++; }
  function paint(x, z, y, slope, tmp) {
    const n1 = fbm2(x * 0.012, z * 0.012, 3), n2 = fbm2(x * 0.08 + 3, z * 0.08, 2), r = volR(x, z);
    tmp.copy(C.sand).lerp(C.sand2, n2 * 0.7);
    if (r < VO.base + 20) { const t = clamp((r - VO.rim) / (VO.base - VO.rim), 0, 1); tmp.lerp(C.ash.clone().lerp(C.rust, sstep(0.5, 0.7, n1)), (1 - t) * 0.75); tmp.lerp(C.rust2, sstep(0.66, 0.8, fbm2(x * 0.03 + 5, z * 0.03, 2)) * 0.6 * (1 - t)); }
    if (r < VO.rim) tmp.copy(C.rust).lerp(C.scorch, sstep(VO.rim - 8, VO.lake.r, r));
    tmp.lerp(C.rock, sstep(0.45, 0.8, slope) * 0.6);
    for (const [fx, fz] of fumaroles) { const dd = Math.hypot(x - fx, z - fz); if (dd < 14) tmp.lerp(C.sulfur, (1 - sstep(4, 14, dd)) * 0.75); }
    const q = riverQuery(x, z); if (q.d < RV.width / 2 + RV.bank + 6) tmp.lerp(C.scorch, 1 - sstep(RV.width / 2, RV.width / 2 + RV.bank + 6, q.d));
    if (lakeE(x, z) < 1.5) tmp.lerp(C.scorch, sstep(1.5, 1.0, lakeE(x, z)));
    return tmp;
  }
  // how much a point of ground glows: thin fissures on the plain and the flanks, the banks of the lava, the crater wall
  function glowAt(x, z, roadD) {
    const r = volR(x, z), ridged = 1 - Math.abs(fbm2(x * 0.018 + 11, z * 0.018, 3) * 2 - 1);
    let g = sstep(0.965, 0.995, ridged) * sstep(0.5, 0.7, fbm2(x * 0.006 + 2, z * 0.006, 3)) * (0.6 + 0.4 * fbm2(x * 0.05, z * 0.05, 2));
    const q = riverQuery(x, z); g = Math.max(g, (1 - sstep(RV.width / 2, RV.width / 2 + 5, q.d)) * 0.9);
    g = Math.max(g, (1 - sstep(1.0, 1.25, lakeE(x, z))) * 0.9);
    if (r < VO.rim - 6) g = Math.max(g, sstep(VO.lake.r + 22, VO.lake.r, r) * 0.9 + sstep(0.9, 0.97, ridged) * 0.7);
    return g * sstep(HW0 + 2, HW0 + 10, roadD);
  }
  const glowGround = mat => { mat.onBeforeCompile = sh => { sh.uniforms.uT = uTime; sh.vertexShader = 'attribute float glow;\nvarying float vGlow;\nvarying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow; vWp = (modelMatrix * vec4(position, 1.0)).xyz;'); sh.fragmentShader = 'uniform float uT;\nvarying float vGlow;\nvarying vec3 vWp;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(1.6, 0.42, 0.06) * vGlow * (0.75 + 0.25 * sin(uT * 1.7 + vWp.x * 0.13 + vWp.z * 0.11));'); }; return mat; };
  {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, GR, GR); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), glow = new Float32Array(pos.count), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, HGT[vIdx(Math.round((pos.getX(i) - X0) / CELL), Math.round((pos.getZ(i) - Z0) / CELL))]);
    geo.computeVertexNormals(); const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), v = vIdx(Math.round((x - X0) / CELL), Math.round((z - Z0) / CELL)); paint(x, z, pos.getY(i), 1 - nrm.getY(i), tmp); if (DMIN[v] < 12) tmp.lerp(C.verge, (1 - sstep(HW0, HW0 + 4, DMIN[v])) * 0.5); colors.set([tmp.r, tmp.g, tmp.b], i * 3); glow[i] = glowAt(x, z, DMIN[v]); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    const m = new THREE.Mesh(geo, glowGround(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, shadowSide: THREE.BackSide }))); m.castShadow = true; m.receiveShadow = true; m.name = 'volcan-terrain'; scene.add(m);
  }
  {
    const F = W0.far, geo = new THREE.PlaneGeometry(F.size, F.size, F.segs, F.segs); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), glow = new Float32Array(pos.count), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, baseNat(pos.getX(i), pos.getZ(i)) - 0.8);
    geo.computeVertexNormals(); const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); paint(x, z, pos.getY(i), 1 - nrm.getY(i), tmp); colors.set([tmp.r, tmp.g, tmp.b], i * 3); glow[i] = 0; for (const [fx, fz, fh, fr] of MAP.farVolcanoes) if (Math.hypot(x - fx, z - fz) < fr * 0.35) glow[i] = 1; }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); if (inSquare(x, z, 40)) pos.setY(i, -200); else if (inSquare(x, z, -2)) pos.setY(i, pos.getY(i) - 2); }
    scene.add(new THREE.Mesh(geo, glowGround(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }))));
  }

  /* ---------------- road ---------------- */
  function stripMesh(rows, mat, vScale, closed, colors) {
    const pos = [], uv = [], idx = [], cl = []; let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.a.distanceTo(rows[i - 1].a); pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale); if (colors) { const c = colors[i]; cl.push(c.r, c.g, c.b, c.r, c.g, c.b); } if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    if (closed) { const k = (rows.length - 1) * 2; idx.push(k, k + 1, 0, k + 1, 1, 0); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  const TINT = Object.fromEntries(Object.entries(MAP.road.tint).map(([k, v]) => [k, col(v)]));
  {
    const rows = [], tints = [], sk = [[], []];
    for (let i = 0; i < NR; i++) {
      const hw = hwA[i], c = new THREE.Color(0, 0, 0); for (let j = -10; j <= 10; j++) c.add(TINT[SEG[wrap(i + j)]]); tints.push(c.multiplyScalar(1 / 21));
      rows.push({ a: roadAt(i, -hw, 0.12), b: roadAt(i, hw, 0.12) });
      [-1, 1].forEach((s, k) => sk[k].push({ a: roadAt(i, s * hw, 0.11), b: roadAt(i, s * (hw + 0.6), isBridge[i] ? -1.2 : -2.6) }));
    }
    const road = stripMesh(rows, new THREE.MeshStandardMaterial({ map: asphaltTex, vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), 20, true, tints);
    road.castShadow = true; road.name = 'volcan-road';
    const skirt = new THREE.MeshStandardMaterial({ color: col('#3a3230'), roughness: 0.9, side: THREE.DoubleSide }); sk.forEach(r => stripMesh(r, skirt, 20, true));
  }

  /* ---------------- lava: the river, the lake inside the loop, the crater lake ---------------- */
  {
    const rows = []; riverPts.forEach((p, k) => { const q = riverPts[Math.min(riverPts.length - 1, k + 1)], r0 = riverPts[Math.max(0, k - 1)], t = V3(q.x - r0.x, 0, q.z - r0.z).normalize(); rows.push({ c: V3(p.x, -0.6, p.z), side: V3(-t.z, 0, t.x), w: RV.width / 2 + 1.2 }); });
    const pos = [], uv = [], idx = []; let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.c.distanceTo(rows[i - 1].c); for (const s of [-1, 1]) { const v = r.c.clone().addScaledVector(r.side, s * r.w); pos.push(v.x, v.y, v.z); uv.push((s + 1) / 2, dist); } if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, lavaMaterial({ ribbon: true, flow: 0.35 })); m.name = 'volcan-rio-de-lava'; scene.add(m);
    const disc = new THREE.CircleGeometry(1, 64); disc.rotateX(-PI / 2);
    const lake = new THREE.Mesh(disc, lavaMaterial({ scale: 0.08 })); lake.scale.set(LL.rx * 1.1, 1, LL.rz * 1.1); lake.position.set(LL.at[0], -0.5, LL.at[1]); lake.name = 'volcan-lago'; scene.add(lake);
    const crater = new THREE.Mesh(disc, lavaMaterial({ scale: 0.06 })); crater.scale.set(VO.lake.r + 6, 1, VO.lake.r + 6); crater.position.set(VX, VO.lake.y, VZ); crater.name = 'volcan-crater'; scene.add(crater);
  }

  /* ---------------- instance buffers ---------------- */
  const inst = { column: [], rock: [], post: [], lamp: [], tent: [], box: [], cyl: [], cone: [], shrub: [], spike: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const qBasis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const yawOf = v => Math.atan2(v.x, v.z);
  const tries = (n, fn) => { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; };
  const rndSq = () => [rr(X0 + 6, X0 + SIZE - 6), rr(Z0 + 6, Z0 + SIZE - 6)];
  const hot = (x, z) => riverQuery(x, z).d < RV.width / 2 + 4 || lakeE(x, z) < 1.15 || volR(x, z) < VO.rim - 2;
  const blocked = [];
  const free = (x, z, m) => roadDist(x, z) > HW0 + m && !hot(x, z) && !blocked.some(b => Math.hypot(b[0] - x, b[1] - z) < b[2]);

  // basalt columns: hexagonal prisms crowding both sides of the canyon, flat tops at stepped heights
  {
    const [c0, c1] = segRange('c'), [s0] = segRange('s');
    const span = []; for (let i = c0 - 40; i <= s0 + 60; i++) span.push(wrap(i));
    tries(MAP.columns.count, () => {
      const i = pick(span), f = roadFrame(i), side = rand() < 0.5 ? -1 : 1, lat = side * (HW0 + rr(...MAP.columns.band)), p = f.p.clone().addScaledVector(f.n, lat), y = groundH(p.x, p.z);
      if (roadDist(p.x, p.z) < HW0 + 6 || hot(p.x, p.z)) return false;
      const h = rr(3, 7) + (Math.abs(lat) - HW0) * rr(0.25, 0.5), w = rr(1.4, 2.2);
      for (let k = 0; k < 3; k++) { const a = rand() * TAU, q = p.clone().add(V3(Math.cos(a) * w * 1.8, 0, Math.sin(a) * w * 1.8)); push(inst.column, q.setY(y - 1), qYaw(Math.round(rand() * 6) * PI / 3), S.set(w, h + rr(-1.5, 1.5), w), col('#2e2a2c').offsetHSL(0, 0, rr(-0.03, 0.04))); }
      return true;
    });
  }
  // rocks and lava bombs littering the slopes; dry thorny shrubs on the plain
  tries(700, () => { const [x, z] = rndSq(); if (!free(x, z, 3)) return false; const s = rr(0.6, 3.4), y = groundH(x, z); push(inst.rock, V3(x, y + s * 0.15, z), qEuler(rr(-0.3, 0.3), rand() * TAU, rr(-0.3, 0.3)), S.set(s * rr(1, 1.5), s * rr(0.6, 0.9), s), col(pick(['#2a2424', '#3a302c', '#4a3028', '#1e1a1a'])).offsetHSL(0, 0, rr(-0.03, 0.03))); return true; });
  tries(220, () => { const [x, z] = rndSq(); if (!free(x, z, 3) || volR(x, z) < VO.base - 40) return false; const y = groundH(x, z), c = col(pick(['#4a3a2a', '#5a4a30', '#3a4a2a'])); for (let k = 0; k < 7; k++) { const a = rand() * TAU; push(inst.spike, V3(x, y, z), qEuler(rr(0.3, 0.9) * (rand() < 0.5 ? -1 : 1), a, 0), S.set(0.06, rr(1, 2.4), 0.06), c); } return true; });
  // roadside reflector posts on the drop side of the spiral, the rim and the hairpins
  for (let i = 0; i < NR; i += 18) {
    if (SEG[i] === 'b' || isBridge[i]) continue;
    for (const s of [-1, 1]) { const q = roadAt(i, s * (HW0 + 1.2), 0), out = roadAt(i, s * (HW0 + 6), 0); if (q.y - groundH(out.x, out.z) < 2.5 && SEG[i] !== 'k') continue; push(inst.post, q.clone().add(V3(0, -0.2, 0)), Q, S.set(0.14, 1.2, 0.14), col('#e8e2dc')); push(inst.lamp, q.clone().add(V3(0, 1.05, 0)), Q, S.set(0.13, 0.18, 0.13), col('#ff8a1a')); }
  }

  /* ---------------- the basalt bridge over the lava river ---------------- */
  {
    const ids = []; for (let i = 0; i < NR; i++) if (isBridge[i]) ids.push(i);
    if (ids.length) {
      const mid = ids[(ids.length / 2) | 0], f = roadFrame(mid), len = RP[ids[0]].distanceTo(RP[ids.at(-1)]) + 6, top = roadY[mid] - 0.1;
      const g = new THREE.Group(); g.position.copy(RP[mid]).setY(0); g.rotation.y = yawOf(f.t); scene.add(g);
      const stone = new THREE.MeshStandardMaterial({ map: crackTex, roughness: 0.9, emissive: col('#ff5a10'), emissiveMap: glowCrackTex, emissiveIntensity: 0.8 });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(MAP.road.width + 2.4, 2.0, len), stone); deck.position.y = top - 1.0; deck.castShadow = true; deck.receiveShadow = true; g.add(deck);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(len * 0.38, 2.2, 8, 24, PI), stone); arch.rotation.y = PI / 2; arch.scale.set(1, (top + 2) / (len * 0.38), 1); arch.position.y = -2; for (const s of [-1, 1]) { const a2 = arch.clone(); a2.position.x = s * (MAP.road.width / 2 - 0.5); g.add(a2); }
      for (const s of [-1, 1]) for (let k = 0; k < Math.floor(len / 2.4); k++) { const blk = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 1.1, 6), stone); blk.position.set(s * (MAP.road.width / 2 + 0.7), top + 0.5, -len / 2 + 1.2 + k * 2.4); g.add(blk); }
    }
  }

  /* ---------------- the lava tube: a rocky shell over the road with collapsed skylights ---------------- */
  const [t0, t1] = segRange('t');
  {
    const pts = []; for (let i = t0 - 6; i <= t1 + 6; i += 3) pts.push(roadAt(i, 0, 3));
    const curve = new THREE.CatmullRomCurve3(pts), segs = 90, radial = 28, tube = new THREE.TubeGeometry(curve, segs, 11, radial, false);
    // knock out a few holes in the roof
    const holes = [0.28, 0.55, 0.8], idx = tube.index.array, kept = [];
    for (let t = 0; t < idx.length; t += 3) { const v = idx[t], ring = Math.floor(v / (radial + 1)) / segs, k = (v % (radial + 1)) / radial, roof = Math.abs(k - 0.25) < 0.12 || Math.abs(k - 0.25 - 1) < 0.12; if (roof && holes.some(h => Math.abs(ring - h) < 0.035)) continue; kept.push(idx[t], idx[t + 1], idx[t + 2]); }
    tube.setIndex(kept);
    const p = tube.attributes.position; for (let i = 0; i < p.count; i++) { const n = fbm2(p.getX(i) * 0.15, p.getZ(i) * 0.15 + p.getY(i) * 0.2, 2) - 0.5; p.setXYZ(i, p.getX(i) + n * 1.6, p.getY(i) + n * 1.2, p.getZ(i) + n * 1.6); }
    tube.computeVertexNormals(); crackTex.repeat.set(10, 2); glowCrackTex.repeat.set(10, 2);
    const m = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ map: crackTex, roughness: 0.92, side: THREE.DoubleSide, emissive: col('#ff6a14'), emissiveMap: glowCrackTex, emissiveIntensity: 1.3, flatShading: true }));
    m.castShadow = true; m.receiveShadow = true; m.name = 'volcan-tubo'; scene.add(m);
    for (let i = t0; i <= t1; i += 2) blocked.push([RP[i].x, RP[i].z, 15]);
    scene.userData.tubeLights = [0.2, 0.5, 0.8].map(u => { const l = new THREE.PointLight(col('#ff6a1a'), 1.6, 45, 1.2); l.position.copy(curve.getPointAt(u)).add(V3(0, 4, 0)); scene.add(l); return l; });
  }

  /* ---------------- the camp at the start ---------------- */
  {
    const CP = MAP.camp, tentCols = ['#ff8a1a', '#e0263a', '#ffd23a', '#3a8aff', '#3ac85a', '#f2f2f2'];
    for (const [x, z] of CP.tents) { const y = groundH(x, z), c = col(pick(tentCols)); push(inst.tent, V3(x, y, z), qYaw(rand() * TAU), S.set(4, 3.2, 5), c); blocked.push([x, z, 5]); }
    for (let k = 0; k < 10; k++) { const x = rr(-100, 100), z = rr(232, 245) * (rand() < 0.5 ? 1 : 1) + (rand() < 0.5 ? 0 : 70); if (!free(x, z, 2)) continue; const y = groundH(x, z); push(inst.box, V3(x, y + 0.5, z), qYaw(rand()), S.set(1.2, 1, 1.2), col(pick(['#7a5a34', '#3a5a3a', '#8a7a5a']))); }
    for (let k = 0; k < CP.lamps; k++) { const x = -165 + k * 30, z = 280 + (k % 2 ? -10 : 10); const y = groundH(x, z); push(inst.cyl, V3(x, y, z), Q, S.set(0.1, 4.2, 0.1), col('#3a3a3a')); push(inst.lamp, V3(x, y + 4.3, z), Q, S.set(0.4, 0.4, 0.4), col('#ffd28a')); }
    // a little observatory dome for the volcanologists
    const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 12, 0, TAU, 0, PI / 2), new THREE.MeshStandardMaterial({ color: col('#e8e6e2'), roughness: 0.5, metalness: 0.2 })); const dy = groundH(0, 318); dome.position.set(0, dy, 318); dome.castShadow = true; scene.add(dome);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 7.2, 4), new THREE.MeshBasicMaterial({ color: col('#ffcf8a'), toneMapped: false })); slit.position.set(0, dy + 3.2, 312); scene.add(slit); blocked.push([0, 318, 10]);
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 8), new THREE.MeshBasicMaterial({ color: col('#ffa030'), toneMapped: false })); fire.position.set(-20, groundH(-20, 252) + 0.9, 252); scene.add(fire); scene.userData.campfire = fire;
    const fl = new THREE.PointLight(col('#ff8a2a'), 1.4, 40, 1.2); fl.position.set(-20, groundH(-20, 252) + 2, 252); scene.add(fl); scene.userData.campLight = fl;
  }

  /* ---------------- the start: checkered line and the flag arch ---------------- */
  {
    const f = roadFrame(i0), q = qBasis(f.n, UP, new THREE.Vector3().crossVectors(f.n, UP));
    const lineTex = canvasTex(256, 32, (c, w, h) => { for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { c.fillStyle = ((x + y) / 16) % 2 ? '#151515' : '#f2f2f2'; c.fillRect(x, y, 16, 16); } });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(MAP.road.width, 1.6), new THREE.MeshStandardMaterial({ map: lineTex, polygonOffset: true, polygonOffsetFactor: -5 })); line.position.copy(roadAt(i0, 0, 0.17)); line.quaternion.copy(q); line.rotateX(-PI / 2); scene.add(line);
    const arch = new THREE.Group(); arch.position.copy(roadAt(i0, 0, 0)); arch.quaternion.copy(q); scene.add(arch);
    [['#ffd23a', HW0 + 4.2], ['#1f4fd8', HW0 + 3.1], ['#e0263a', HW0 + 2.0]].forEach(([c, r]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.55, 12, 80, PI), new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.4, emissive: col(c), emissiveIntensity: 0.35 })); m.castShadow = true; arch.add(m); });
    const star = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, r = k % 2 ? 0.42 : 1; k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.25, bevelEnabled: false }); sg.translate(0, 0, -0.125);
    for (let k = 0; k < 8; k++) { const a = PI * (0.18 + 0.64 * k / 7), s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false })); s.position.set(Math.cos(a) * (HW0 + 3.1), Math.sin(a) * (HW0 + 3.1), 0.7); s.scale.setScalar(0.62); arch.add(s); const b = s.clone(); b.position.z = -0.7; arch.add(b); }
  }

  /* ---------------- flush ---------------- */
  function flush(list, geo, mat, cast = true) { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); }); im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0); flush(inst.column, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85, flatShading: true })); }
  flush(inst.rock, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.95, flatShading: true }));
  { const g = new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0); flush(inst.post, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 })); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 })); }
  flush(inst.lamp, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false }), false);
  { const g = new THREE.ConeGeometry(0.6, 1, 4); g.rotateY(PI / 4); g.translate(0, 0.5, 0); flush(inst.tent, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7, flatShading: true })); }
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }));
  { const g = new THREE.CylinderGeometry(0.5, 1, 1, 4); g.translate(0, 0.5, 0); flush(inst.spike, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9 }), false); }

  /* ---------------- smoke plume, fumarole steam, embers, ash ---------------- */
  const smoke = [], steam = [];
  {
    const sm = ['#3a2c2a', '#4a3a36', '#2a2222'].map(c => new THREE.SpriteMaterial({ map: smokeTex, color: col(c), transparent: true, opacity: 0.7, depthWrite: false }));
    for (let k = 0; k < 60; k++) { const s = new THREE.Sprite(pick(sm)); scene.add(s); smoke.push({ s, ph: k / 60, a: rand() * TAU, sp: rr(0.8, 1.2) }); }
    const st = new THREE.SpriteMaterial({ map: smokeTex, color: col('#e8e2dc'), transparent: true, opacity: 0.4, depthWrite: false });
    for (const [x, z] of fumaroles) for (let k = 0; k < 4; k++) { const s = new THREE.Sprite(st); scene.add(s); steam.push({ s, x, z, y: groundH(x, z), ph: k / 4 + rand() * 0.2 }); }
    for (const [fx, fz, fh] of MAP.farVolcanoes) for (let k = 0; k < 8; k++) { const s = new THREE.Sprite(pick(sm)); s.material = s.material.clone(); s.material.fog = false; s.material.opacity = 0.55; scene.add(s); smoke.push({ s, ph: k / 8, a: rand() * TAU, sp: 0.6, far: [fx, fh, fz] }); }
  }
  const pointsOf = (n, place, size, color, opacity, blending = THREE.AdditiveBlending) => { const pos = new Float32Array(n * 3), seeds = []; for (let k = 0; k < n; k++) seeds.push(place()); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ map: smokeTex, color: col(color), size, transparent: true, opacity, depthWrite: false, blending, toneMapped: false })); m.frustumCulled = false; scene.add(m); return { m, seeds }; };
  const embers = pointsOf(MAP.embers, () => { const r = rand(); let x, z, y; if (r < 0.4) { const p = pick(riverPts); x = p.x; z = p.z; y = 0; } else if (r < 0.6) { const a = rand() * TAU; x = LL.at[0] + Math.cos(a) * LL.rx * rand(); z = LL.at[1] + Math.sin(a) * LL.rz * rand(); y = 0; } else { const a = rand() * TAU, rd = Math.sqrt(rand()) * VO.lake.r; x = VX + Math.cos(a) * rd; z = VZ + Math.sin(a) * rd; y = VO.lake.y; } return { x, z, y, sp: rr(1.5, 4), ph: rand() * 30, h: rr(10, 40) }; }, 0.9, '#ff9a3a', 0.9);
  const ash = pointsOf(MAP.ash, () => ({ x: rr(X0, X0 + SIZE), z: rr(Z0, Z0 + SIZE), y: rr(0, 160), ph: rand() * TAU }), 0.6, '#6a5a58', 0.6, THREE.NormalBlending);

  /* ---------------- the eruption: lava bombs on the race clock, landing well clear of the road ---------------- */
  const ER = MAP.eruption, landings = [];
  for (let k = 0, t = 0; k < ER.landings && t < 2000; t++) { const a = rand() * TAU, r = rr(120, 380), x = VX + Math.cos(a) * r, z = VZ + Math.sin(a) * r; if (RP.some(q => Math.hypot(q.x - x, q.z - z) < 40) || hot(x, z)) continue; landings.push(V3(x, groundH(x, z), z)); k++; }
  const bombs = Array.from({ length: ER.bombs }, () => {
    const g = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), new THREE.MeshBasicMaterial({ color: col('#ff8a2a'), toneMapped: false })); g.frustumCulled = false; scene.add(g);
    const trail = Array.from({ length: 8 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: col('#ff6a1a'), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); scene.add(s); return s; });
    const splat = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: col('#ff6a1a'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); scene.add(splat);
    return { g, trail, splat };
  });
  const bombAt = (slot, t) => {
    const land = landings[(hash1(slot) * landings.length) | 0], start = V3(VX + (hash1(slot + 3) - 0.5) * 30, VO.lake.y + 4, VZ + (hash1(slot + 7) - 0.5) * 30), u = (t - slot * ER.every) / ER.flight;
    const p = start.clone().lerp(land, u); p.y = lerp(start.y, land.y, u) + 4 * ER.height * u * (1 - u) * (0.7 + 0.5 * hash1(slot + 11)); return { p, u, land };
  };

  /* ---------------- per-frame updates ---------------- */
  function update(t, dt, racerS = null) {
    uTime.value = t; lavaMats.forEach(m => (m.uniforms.uT.value = t));
    craterLight.intensity = 4 + Math.sin(t * 2.1) * 0.6 + Math.sin(t * 5.3) * 0.3;
    scene.userData.campfire.scale.y = 1 + 0.2 * Math.sin(t * 9); scene.userData.campLight.intensity = 1.4 + 0.3 * Math.sin(t * 7);
    smoke.forEach(s => {
      const u = (t * 0.03 * s.sp + s.ph) % 1;
      if (s.far) { s.s.position.set(s.far[0] + Math.sin(s.a + u * 3) * 60 * u, s.far[1] + u * 600, s.far[2] + u * 200); const sc = 120 + u * 500; s.s.scale.set(sc, sc, 1); s.s.material.opacity = 0.5 * (1 - u); return; }
      s.s.position.set(VX + Math.sin(s.a + u * 4) * (10 + u * 60) + u * 120, VO.lake.y + 10 + u * 420, VZ + Math.cos(s.a + u * 3) * (10 + u * 50) - u * 60);
      const sc = 30 + u * 240; s.s.scale.set(sc, sc, 1); s.s.material.color.setRGB(lerp(0.75, 0.2, Math.min(1, u * 4)), lerp(0.3, 0.16, Math.min(1, u * 4)), lerp(0.15, 0.15, u)); s.s.material.opacity = 0.75 * (1 - u) * Math.min(1, u * 10);
    });
    steam.forEach(s => { const u = (t * 0.12 + s.ph) % 1; s.s.position.set(s.x + u * 4, s.y + 1 + u * 22, s.z); const sc = 3 + u * 14; s.s.scale.set(sc, sc, 1); s.s.material.opacity = 0.4 * (1 - u); });
    { const p = embers.m.geometry.attributes.position; embers.seeds.forEach((e, k) => { if (k >= embers.m.geometry.drawRange.count) return; const u = ((t * e.sp + e.ph) % e.h); p.setXYZ(k, e.x + Math.sin(t + k) * u * 0.15, e.y + u, e.z + Math.cos(t * 0.8 + k) * u * 0.15); }); p.needsUpdate = true; }
    { const p = ash.m.geometry.attributes.position; ash.seeds.forEach((a, k) => { if (k >= ash.m.geometry.drawRange.count) return; const y = 160 - ((160 - a.y + t * 2.5) % 160); p.setXYZ(k, a.x + Math.sin(t * 0.3 + a.ph) * 3 + t * 1.2 % 40, y, a.z + Math.cos(t * 0.25 + a.ph) * 3); }); p.needsUpdate = true; }
    // lava bombs: each slot of the clock launches one, so every screen sees the same eruption
    const base = Math.floor(t / ER.every);
    bombs.forEach((b, k) => {
      const slot = base - k, { p, u, land } = bombAt(slot, t), flying = u >= 0 && u <= 1, after = t - (slot * ER.every + ER.flight);
      b.g.visible = flying && slot >= 0; if (b.g.visible) { b.g.position.copy(p); b.g.rotation.set(t * 3, t * 2, 0); }
      b.trail.forEach((s, j) => { const uu = u - (j + 1) * 0.025; s.visible = b.g.visible && uu > 0; if (s.visible) { const q = bombAt(slot, slot * ER.every + uu * ER.flight).p; s.position.copy(q); const sc = 4 + j * 1.2; s.scale.set(sc, sc, 1); s.material.opacity = 0.6 * (1 - j / 8); } });
      const sp = after > 0 && after < 3 && slot >= 0; b.splat.visible = sp; if (sp) { b.splat.position.copy(land).add(V3(0, 0.3, 0)); const sc = 6 + after * 4; b.splat.scale.set(sc, 1, sc); b.splat.material.opacity = 0.9 * (1 - after / 3); }
    });

  }


  return ownReferenceWorld(scene, groundH, referenceDetail(scene, update, mapDetail), createdTextures);
}
