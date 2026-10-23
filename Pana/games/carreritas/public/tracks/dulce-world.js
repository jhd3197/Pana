import { rng, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { MAP } from './dulce-layout.js';
import { ownReferenceWorld } from './reference-world.js';

export function createWorld(scene, layout) {
  const { PI, TAU, UP, clamp, sstep, lerp, col, V3, d, uTime, W0, CX, CZ, SIZE, HALF, LD, QS, PD, ih, noise2, fbm2, RV, riverPts, riverQuery, pondE, quesilloD, baseNat, natural, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, segRange, isBridge, i0, GR, CELL, X0, Z0, GN, vIdx, NAT, HGT, DMIN, NEAR, inSquare, gridH, groundH, roadDist } = layout;
  const rand = rng(MAP.seed), rr = (a,b) => a + rand() * (b-a);
  const pick = values => pickRandom(values, rand);
  const createdTextures = [];
  /* ---------------- pastel sky, sun, cotton-candy fog ---------------- */
  const SUN_DIR = new THREE.Vector3(...MAP.sun.dir).normalize();
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: SUN_DIR } },
      vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vD; void main(){
        vec3 d = normalize(vD); float h = clamp(d.y, -0.3, 1.0);
        vec3 c = mix(vec3(1.0, 0.78, 0.88), vec3(0.62, 0.72, 1.0), smoothstep(0.0, 0.3, h)); c = mix(c, vec3(0.26, 0.55, 0.98), smoothstep(0.3, 0.9, h));
        c = mix(c, vec3(1.0, 0.86, 0.92), smoothstep(0.0, -0.25, h));
        float s = max(dot(d, uSun), 0.0); c += vec3(1.0, 0.92, 0.8) * (pow(s, 900.0) * 3.0 + pow(s, 20.0) * 0.25);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }));
    sky.frustumCulled = false; sky.renderOrder = -9; scene.add(sky);
  }
  const hemi = new THREE.HemisphereLight(col('#fff0fa'), col('#a8d8b8'), MAP.sun.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(col(MAP.sun.color), MAP.sun.intensity);
  sun.target.position.set(CX, 10, CZ); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 900);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  { const h = MAP.sun.shadowHalf; Object.assign(sun.shadow.camera, { left: -h, right: h, top: h, bottom: -h, near: 100, far: 2000 }); }
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.0;
  scene.add(sun, sun.target);

  /* ---------------- canvas textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); createdTextures.push(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const roadTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#a09ca0'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(50,40,50,${rr(0.05, 0.16).toFixed(2)})` : `rgba(255,255,255,${rr(0.04, 0.12).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    c.fillStyle = 'rgba(255,250,252,0.95)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#ffd23a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const swirlTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h);
    const cols = ['#ff3d7a', '#ffffff', '#ffd23a', '#ffffff', '#3ab8ff', '#ffffff', '#7ae07a', '#ffffff'];
    for (let k = 0; k < 8; k++) { c.fillStyle = cols[k]; c.beginPath(); c.moveTo(w / 2, h / 2); for (let a = 0; a <= 1.001; a += 0.02) { const ang = (k / 8) * TAU + a * 5.5, r = a * w * 0.5; c.lineTo(w / 2 + Math.cos(ang) * r, h / 2 + Math.sin(ang) * r); } for (let a = 1; a >= 0; a -= 0.02) { const ang = ((k + 1) / 8) * TAU + a * 5.5, r = a * w * 0.5; c.lineTo(w / 2 + Math.cos(ang) * r, h / 2 + Math.sin(ang) * r); } c.fill(); }
  });
  const stripeTex = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#e0263a'; for (let y = -h; y < h * 2; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 26); c.lineTo(w, y + 40); c.lineTo(0, y + 14); c.fill(); } });
  const grillTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#f0d49a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${170 + (rand() * 40) | 0},${120 + (rand() * 30) | 0},60,${rr(0.1, 0.35).toFixed(2)})`; c.beginPath(); c.arc(rand() * w, rand() * h, rr(2, 9), 0, TAU); c.fill(); } c.strokeStyle = 'rgba(110,60,20,0.55)'; c.lineWidth = 9; for (let k = -2; k < 7; k++) { c.beginPath(); c.moveTo(k * 46, 0); c.lineTo(k * 46 + 120, h); c.stroke(); } });
  const doughTex = canvasTex(256, 128, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f6c870'); g.addColorStop(0.5, '#e8a848'); g.addColorStop(1, '#f6c870'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(150,80,20,0.45)'; c.lineWidth = 6; for (let k = -4; k < 12; k++) { c.beginPath(); c.moveTo(k * 32, 0); c.bezierCurveTo(k * 32 + 20, h * 0.3, k * 32 + 30, h * 0.7, k * 32 + 56, h); c.stroke(); } for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(255,240,200,${rr(0.1, 0.3).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, 2, 2); } });
  const leafTex = canvasTex(128, 512, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(w / 2, h); c.quadraticCurveTo(w * 0.98, h * 0.45, w / 2, 4); c.quadraticCurveTo(w * 0.02, h * 0.45, w / 2, h); c.fill(); });
  const cloudTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const sway = (mat, base, perY) => { mat.onBeforeCompile = sh => { sh.uniforms.uTime = uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sw = sin(uTime * 1.4 + ip.x * 0.07 + ip.z * 0.05) * 0.6 + sin(uTime * 2.7 + ip.z * 0.13) * 0.25;
      float k = ${base.toFixed(3)} + max(position.y, 0.0) * ${perY.toFixed(3)};
      transformed.x += sw * k; transformed.z += sw * k * 0.55;`); }; return mat; };

  /* ---------------- ground colours: mint and strawberry sugar, flan and caramel ---------------- */
  const C = { mint: col('#22955a'), mint2: col('#3aac6c'), pink: col('#d84a88'), pink2: col('#e8679c'), flan: col('#e8a820'), flan2: col('#d8961a'), caramel: col('#7a300c'), caramel2: col('#943f14'), choc: col('#4a2410'), verge: col('#f2e2ea'), cream: col('#e8c8a8') };
  function paintGround(x, z, y, slope, tmp) {
    const n1 = fbm2(x * 0.012, z * 0.012, 3), n2 = fbm2(x * 0.07 + 3, z * 0.07, 2);
    tmp.copy(C.mint).lerp(C.mint2, n2 * 0.7).lerp(C.pink.clone().lerp(C.pink2, n2), sstep(0.54, 0.6, n1));
    const dq = quesilloD(x, z);
    if (dq < QS.baseR + 4) {
      const a = Math.atan2(z - QS.at[1], x - QS.at[0]), drip = 0.5 + 0.5 * Math.sin(a * 23) * Math.sin(a * 7 + 1);
      const topness = sstep(QS.top - 3 - drip * 9, QS.top - 0.5, y);
      tmp.copy(C.flan).lerp(C.flan2, n2);
      if (fbm2(x * 0.25, z * 0.25, 2) > 0.66) tmp.multiplyScalar(0.88); // the little holes in a quesillo
      tmp.lerp(C.caramel.clone().lerp(C.caramel2, n2), topness);
      tmp.lerp(C.caramel, (1 - sstep(QS.baseR - 6, QS.baseR + 4, dq)) * sstep(QS.baseR - 14, QS.baseR, dq) * 0.8);
    }
    if (pondE(x, z) < 1.1) tmp.lerp(C.choc, sstep(1.1, 0.95, pondE(x, z)));
    tmp.lerp(C.cream, sstep(40, 140, y) * 0.8);
    return tmp;
  }
  {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, GR, GR); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, HGT[vIdx(Math.round((pos.getX(i) - X0) / CELL), Math.round((pos.getZ(i) - Z0) / CELL))]);
    geo.computeVertexNormals(); const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), v = vIdx(Math.round((x - X0) / CELL), Math.round((z - Z0) / CELL)); paintGround(x, z, pos.getY(i), 1 - nrm.getY(i), tmp); if (DMIN[v] < 12) tmp.lerp(C.verge, (1 - sstep(HW0, HW0 + 3.5, DMIN[v])) * 0.6); colors.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, shadowSide: THREE.BackSide })); m.castShadow = true; m.receiveShadow = true; m.name = 'dulce-terrain'; scene.add(m);
  }
  {
    const F = W0.far, geo = new THREE.PlaneGeometry(F.size, F.size, F.segs, F.segs); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, baseNat(pos.getX(i), pos.getZ(i)) - 0.8);
    geo.computeVertexNormals(); const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { paintGround(pos.getX(i), pos.getZ(i), pos.getY(i), 1 - nrm.getY(i), tmp); colors.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); if (inSquare(x, z, 40)) pos.setY(i, -200); else if (inSquare(x, z, -2)) pos.setY(i, pos.getY(i) - 2); }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })); m.receiveShadow = true; scene.add(m);
  }

  /* ---------------- road, icing edges ---------------- */
  function stripMesh(rows, mat, vScale, closed, colors) {
    const pos = [], uv = [], idx = [], cl = []; let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.a.distanceTo(rows[i - 1].a); pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale); if (colors) { const c = colors[i]; cl.push(c.r, c.g, c.b, c.r, c.g, c.b); } if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    if (closed) { const k = (rows.length - 1) * 2; idx.push(k, k + 1, 0, k + 1, 1, 0); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  const TINT = Object.fromEntries(Object.entries(MAP.road.tint).map(([k, v]) => [k, col(v)]));
  {
    const rows = [], tints = [], icing = [[], []], skirts = [[], []];
    for (let i = 0; i < NR; i++) {
      const hw = hwA[i], c = new THREE.Color(0, 0, 0); for (let j = -10; j <= 10; j++) c.add(TINT[SEG[wrap(i + j)]]); tints.push(c.multiplyScalar(1 / 21));
      rows.push({ a: roadAt(i, -hw, 0.12), b: roadAt(i, hw, 0.12) });
      [-1, 1].forEach((s, k) => { const wob = 0.25 * Math.sin(i * 0.7 + s) + 0.15 * Math.sin(i * 1.9); icing[k].push({ a: roadAt(i, s * (hw - 0.05), 0.2), b: roadAt(i, s * (hw + 0.9 + wob), 0.3) }); skirts[k].push({ a: roadAt(i, s * (hw + 0.9), 0.25), b: roadAt(i, s * (hw + 1.1), isBridge[i] ? -1 : -2.4) }); });
    }
    const road = stripMesh(rows, new THREE.MeshStandardMaterial({ map: roadTex, vertexColors: true, roughness: 0.75, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), 20, true, tints);
    road.castShadow = true; road.name = 'dulce-road';
    const icingMat = new THREE.MeshStandardMaterial({ color: col('#fff6fa'), roughness: 0.35, emissive: col('#ffe8f2'), emissiveIntensity: 0.2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    icing.forEach(r => stripMesh(r, icingMat, 20, true));
    const sk = new THREE.MeshStandardMaterial({ color: col('#e8c890'), roughness: 0.8, side: THREE.DoubleSide });
    skirts.forEach(r => stripMesh(r, sk, 20, true));
  }

  /* ---------------- chocolate: the pond, the river, the waterfall ---------------- */
  const flowMats = [];
  const chocolate = (opts = {}) => {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR } }]),
      vertexShader: `attribute float steep; varying vec2 vUv; varying float vSteep; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vSteep = steep; vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uSun; varying vec2 vUv; varying float vSteep; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          float flow = vUv.y - uT * (0.5 + vSteep * 2.0);
          float a = sin(vUv.x * 9.0 + sin(vUv.y * 0.3 + uT * 0.6) * 2.0 + flow * 1.1) * 0.6 + sin(vW.x * 0.4 + vW.z * 0.3 + uT) * 0.4;
          vec3 N = normalize(vec3(a * 0.12, 1.0, cos(flow * 1.3) * 0.08));
          if (vSteep > 0.5) N = normalize(vec3(a * 0.2, 0.3, 1.0));
          vec3 V = normalize(cameraPosition - vW);
          vec3 c = mix(vec3(0.18, 0.08, 0.03), vec3(0.36, 0.17, 0.07), 0.5 + 0.5 * a);
          c += vec3(1.0, 0.9, 0.8) * pow(max(dot(reflect(-uSun, N), V), 0.0), 40.0) * 0.9;
          c += vec3(0.5, 0.35, 0.25) * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.4;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      fog: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3,
    });
    flowMats.push(m); return m;
  };
  function ribbon(rows, mat, vScale = 0.22) {
    const pos = [], uv = [], st = [], idx = []; let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.c.distanceTo(rows[i - 1].c); for (const s of [-1, 1]) { const v = r.c.clone().addScaledVector(r.side, s * r.w); pos.push(v.x, v.y, v.z); uv.push((s + 1) / 2, dist * vScale); st.push(r.steep || 0); } if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('steep', new THREE.Float32BufferAttribute(st, 1)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; scene.add(m); return m;
  }
  const CHOC = chocolate();
  {
    const g = new THREE.CircleGeometry(1, 64); g.rotateX(-PI / 2);
    const pond = new THREE.Mesh(g, CHOC); pond.scale.set(PD.rx * 1.08, 1, PD.rz * 1.08); pond.position.set(PD.at[0], PD.level, PD.at[1]); scene.add(pond);
    const rows = []; riverPts.forEach((p, k) => { const q = riverPts[Math.min(riverPts.length - 1, k + 1)], r0 = riverPts[Math.max(0, k - 1)], t = V3(q.x - r0.x, 0, q.z - r0.z).normalize(); rows.push({ c: V3(p.x, p.y + 0.2, p.z), side: V3(-t.z, 0, t.x), w: RV.width / 2 + 0.8 }); });
    ribbon(rows, CHOC).name = 'dulce-rio';
    const WF = MAP.waterfall, a = V3(WF.from[0], 0, WF.from[1]), b = V3(WF.to[0], 0, WF.to[1]), dir = b.clone().sub(a).normalize(), side = V3(-dir.z, 0, dir.x), fr = [];
    let prev = null; const n = Math.ceil(a.distanceTo(b) / 0.6);
    for (let k = 0; k <= n; k++) { const p = a.clone().lerp(b, k / n), y = Math.max(groundH(p.x, p.z) + 0.3, PD.level + 0.15), steep = prev === null ? 0 : clamp(Math.abs(prev - y) / 0.6 / 2, 0, 1); fr.push({ c: V3(p.x + dir.x * steep * 1.6, y + steep * 0.3, p.z + dir.z * steep * 1.6), side, w: WF.width / 2 * (steep > 0.5 ? 1.2 : 1), steep }); prev = y; }
    ribbon(fr, CHOC).name = 'dulce-cascada';
  }

  /* ---------------- instance buffers ---------------- */
  const inst = { stick: [], disc: [], cane: [], blob: [], pop: [], trunk: [], gummy: [], sprinkle: [], leaf: [], box: [], cone: [], cyl: [], sphere: [], flag: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const qBasis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const yawOf = v => Math.atan2(v.x, v.z);
  const between = (a, b, r, list, color) => { const dir = b.clone().sub(a), len = dir.length(); push(list, a, new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), S.set(r, len, r), color); };
  const tries = (n, fn) => { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; };
  const rndSq = () => [rr(X0 + 6, X0 + SIZE - 6), rr(Z0 + 6, Z0 + SIZE - 6)];
  const nearRoad = r => { const i = (rand() * NR) | 0, f = roadFrame(i), l = (rand() < 0.5 ? -1 : 1) * (HW0 + 3 + rand() * r); return [f.p.x + f.n.x * l + rr(-3, 3), f.p.z + f.n.z * l + rr(-3, 3)]; };
  const wet = (x, z) => pondE(x, z) < 1.15 || riverQuery(x, z).d < RV.width / 2 + 3;
  const blocked = [];   // footprints of landmarks, so props keep clear
  const free = (x, z, m) => roadDist(x, z) > HW0 + m && !wet(x, z) && !blocked.some(b => Math.hypot(b[0] - x, b[1] - z) < b[2]);
  const PASTEL = ['#ff6ab0', '#ffd23a', '#7ad0ff', '#7ae0a0', '#b07aff', '#ff8a5a', '#ff4f6a'].map(col);

  /* ---------------- landmarks: golfeados, arepas, papelón, stalls ---------------- */
  // golfeado: a fat spiral roll with a shiny papelón glaze and grated cheese on top
  const golfeado = (x, z, R) => {
    const y = groundH(x, z), pts = []; for (let k = 0; k <= 160; k++) { const a = k / 160 * TAU * 2.6, r = R * (0.18 + 0.82 * k / 160); pts.push(V3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 320, R * 0.2, 12), new THREE.MeshStandardMaterial({ color: col('#b8682a'), roughness: 0.3, metalness: 0.05, emissive: col('#3a1404'), emissiveIntensity: 0.2 }));
    tube.scale.y = 0.75; tube.position.set(x, y + R * 0.14, z); tube.castShadow = true; tube.receiveShadow = true; scene.add(tube);
    for (let k = 0; k < 60; k++) { const a = rand() * TAU, r = Math.sqrt(rand()) * R * 0.95; push(inst.box, V3(x + Math.cos(a) * r, y + R * 0.3, z + Math.sin(a) * r), qEuler(rand(), rand() * TAU, rand()), S.set(0.5, 0.18, 0.18).multiplyScalar(R / 7), col('#fff8e0')); }
    blocked.push([x, z, R + 4]);
  };
  MAP.plaza.golfeados.forEach(([x, z, r]) => golfeado(x, z, r));
  // arepa: a toasted disc with grill marks; an open one shows its filling
  const arepaMat = new THREE.MeshStandardMaterial({ map: grillTex, roughness: 0.85 }), arepaSide = new THREE.MeshStandardMaterial({ color: col('#e8c078'), roughness: 0.9 });
  for (const a of MAP.arepas) {
    const [x, z] = a.at, y = groundH(x, z), h = a.r * 0.32, g = new THREE.Group();
    const half = (yy, flip) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(a.r, a.r * 0.96, h * (a.open ? 0.5 : 1), 48), [arepaSide, arepaMat, arepaMat]); m.position.y = yy; if (flip) m.rotation.x = flip; m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    if (!a.open) half(h / 2);
    else {
      half(h * 0.25);
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(a.r * 0.9, a.r * 0.9, h * 0.35, 40), new THREE.MeshStandardMaterial({ color: col('#7ac85a'), roughness: 0.7 })); fill.position.y = h * 0.62; g.add(fill);
      for (let k = 0; k < 30; k++) { const an = rand() * TAU, r = Math.sqrt(rand()) * a.r * 0.85; push(inst.sphere, V3(x + Math.cos(an) * r, y + h * 0.82, z + Math.sin(an) * r), Q, S.set(1, 0.6, 1).multiplyScalar(a.r * 0.08), col(pick(['#fff4c0', '#2a1a14', '#e0263a']))); }
      const lid = half(h * 1.2, 0.35); lid.position.z = -a.r * 0.25;
    }
    g.position.set(x, y - 0.3, z); g.rotation.y = rand() * TAU; scene.add(g); blocked.push([x, z, a.r + 4]);
  }
  // papelón: cone-shaped blocks of raw cane sugar
  for (const [x, z] of MAP.papelon) { const y = groundH(x, z), m = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 16, 12), new THREE.MeshStandardMaterial({ color: col('#8a4a1c'), roughness: 0.6, flatShading: true })); m.position.set(x, y + 7.5, z); m.rotation.y = rand(); m.castShadow = true; scene.add(m); blocked.push([x, z, 12]); }
  // raspado stalls round the plaza, with striped umbrellas and syrup bottles; bunting over the street
  for (const [x, z] of MAP.plaza.stalls) {
    const y = groundH(x, z), c = pick(PASTEL);
    push(inst.box, V3(x, y + 0.6, z), Q, S.set(3.4, 1.2, 2), col('#ffffff')); push(inst.box, V3(x, y + 0.6, z + 1.02), Q, S.set(3.4, 1.2, 0.05), c);
    push(inst.cyl, V3(x, y, z), Q, S.set(0.08, 3.6, 0.08), col('#e8e8e8')); push(inst.cone, V3(x, y + 3.9, z), Q, S.set(2.6, 0.9, 2.6), c);
    for (let k = 0; k < 5; k++) push(inst.cyl, V3(x - 1.2 + k * 0.6, y + 1.2, z), Q, S.set(0.12, 0.6, 0.12), pick(PASTEL));
    blocked.push([x, z, 4]);
  }
  {
    const flagG = new THREE.BufferGeometry(); flagG.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -0.9, 0], 3)); flagG.computeVertexNormals();
    for (let k = -2; k <= 2; k++) { const x = k * 45; for (let j = 0; j <= 14; j++) { const z = MAP.road.start[1] - 12 + j * 24 / 14, sag = 1.2 * Math.sin(Math.PI * j / 14); push(inst.flag, V3(x, 8.5 - sag, z), qYaw(PI / 2), S.set(1, 1, 1), PASTEL[(j + k + 7) % PASTEL.length]); } for (const s of [-1, 1]) push(inst.cyl, V3(x, groundH(x, MAP.road.start[1] + s * 12), MAP.road.start[1] + s * 12), Q, S.set(0.12, 9, 0.12), col('#ffffff')); }
    scene.userData.flagGeo = flagG;
  }

  /* ---------------- the marquesa bridge: biscuit and chocolate layers ---------------- */
  {
    const ids = []; for (let i = 0; i < NR; i++) if (isBridge[i]) ids.push(i);
    if (ids.length) {
      const mid = ids[(ids.length / 2) | 0], f = roadFrame(mid), len = RP[ids[0]].distanceTo(RP[ids.at(-1)]) + 4, top = roadY[mid] - 0.1, bot = Math.min(...ids.map(i => groundH(RP[i].x, RP[i].z))) - 1;
      const g = new THREE.Group(); g.position.copy(RP[mid]).setY(0); g.rotation.y = yawOf(f.t); scene.add(g);
      const layers = Math.ceil((top - bot) / 0.9);
      for (let k = 0; k < layers; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(MAP.road.width + 3, 0.9, len * (k === layers - 1 ? 1 : 0.6)), new THREE.MeshStandardMaterial({ color: col(k % 2 ? '#4a2412' : '#f2d8a0'), roughness: 0.8 })); m.position.y = top - 0.45 - (layers - 1 - k) * 0.9; m.castShadow = true; m.receiveShadow = true; g.add(m); }
      for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, len), new THREE.MeshStandardMaterial({ color: col('#fff6fa'), roughness: 0.4 })); rail.position.set(s * (MAP.road.width / 2 + 1.1), top + 0.5, 0); g.add(rail); }
      const powder = new THREE.Mesh(new THREE.BoxGeometry(MAP.road.width + 3.2, 0.3, len * 1.02), new THREE.MeshStandardMaterial({ color: col('#6a3418'), roughness: 1 })); powder.position.y = top - 0.05; g.add(powder);
    }
  }

  /* ---------------- the tequeño: a giant cheese stick in a twisted dough the road runs through ---------------- */
  const [t0, t1] = segRange('t');
  {
    const pts = []; for (let i = t0 - 4; i <= t1 + 4; i += 3) pts.push(roadAt(i, 0, 4));
    const curve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(curve, 80, 11, 32, false);
    doughTex.repeat.set(8, 1);
    const m = new THREE.Mesh(tube, new THREE.MeshStandardMaterial({ map: doughTex, roughness: 0.7, side: THREE.DoubleSide, emissive: col('#4a2408'), emissiveIntensity: 0.35 }));
    m.castShadow = true; m.receiveShadow = true; m.name = 'dulce-tequeno'; scene.add(m);
    // melted cheese oozing from both ends
    const cheese = new THREE.MeshStandardMaterial({ color: col('#fff4c4'), roughness: 0.35, emissive: col('#4a3a10'), emissiveIntensity: 0.2 });
    for (const u of [0, 1]) {
      const c = curve.getPointAt(u), t = curve.getTangentAt(u).multiplyScalar(u ? 1 : -1);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 1.6, 12, 40), cheese); ring.position.copy(c); ring.quaternion.setFromUnitVectors(V3(0, 0, 1), t); ring.castShadow = true; scene.add(ring);
      for (let k = 0; k < 14; k++) { const a = PI * (0.1 + 0.8 * k / 13), q = c.clone().add(V3(0, Math.sin(a) * 11, 0)).addScaledVector(V3(-t.z, 0, t.x).normalize(), Math.cos(a) * 11).addScaledVector(t, 0.8), len = rr(1.5, 5); push(inst.cyl, q.clone().add(V3(0, -len, 0)), Q, S.set(rr(0.3, 0.6), len, rr(0.3, 0.6)), col('#fff4c4')); push(inst.sphere, q.clone().add(V3(0, -len, 0)), Q, S.set(0.6, 0.7, 0.6), col('#fff4c4')); }
    }
    for (let i = t0; i <= t1; i += 2) { const q = RP[i]; blocked.push([q.x, q.z, 13]); }
  }

  /* ---------------- vegetation of sweets ---------------- */
  const VG = MAP.vegetation;
  const lolly = (x, z, s) => { const y = groundH(x, z), h = rr(4, 9) * s; push(inst.stick, V3(x, y, z), qEuler(rr(-0.05, 0.05), 0, rr(-0.05, 0.05)), S.set(0.18 * s, h, 0.18 * s), col('#fffaf0')); push(inst.disc, V3(x, y + h + 1.8 * s, z), qEuler(rr(-0.15, 0.15), rand() * TAU, 0), S.set(2.2 * s, 2.2 * s, 0.45 * s), pick(PASTEL).clone().lerp(col('#ffffff'), 0.3)); };
  const cane = (x, z, s) => { const y = groundH(x, z), h = rr(5, 9) * s; push(inst.cane, V3(x, y, z), qYaw(rand() * TAU), S.set(s, h, s), col('#ffffff')); };
  const cotufaTree = (x, z) => { const y = groundH(x, z), h = rr(4, 7); push(inst.trunk, V3(x, y, z), qYaw(rand() * TAU), S.set(0.4, h, 0.4), col('#c8a070')); for (let k = 0; k < 26; k++) { const a = rand() * TAU, e = rr(-0.6, 1), r = rr(0.6, 3); push(inst.pop, V3(x + Math.cos(a) * r, y + h + 1 + e * 2, z + Math.sin(a) * r), qEuler(rand() * 3, rand() * 3, 0), S.set(rr(0.5, 0.8), rr(0.45, 0.7), rr(0.5, 0.8)), col(rand() < 0.75 ? '#fff6e0' : '#ffe08a')); } };
  const gummy = (x, z) => { const y = groundH(x, z), s = rr(0.8, 1.6), c = pick(PASTEL); push(inst.gummy, V3(x, y + 0.9 * s, z), qYaw(rand() * TAU), S.set(s, s * 1.3, s * 0.8), c); };
  const zone = (x, z) => (x < -200 && z < 40 ? 'l' : x > -60 && x < 160 && z > 150 ? 'p' : 'o');
  tries(VG.lollipops, () => { const [x, z] = rand() < 0.65 ? [rr(-430, -180), rr(-330, 40)] : rndSq(); if (!free(x, z, 4)) return false; lolly(x, z, zone(x, z) === 'l' ? rr(1.0, 1.7) : rr(0.6, 1.1)); return true; });
  tries(VG.canes, () => { const [x, z] = rand() < 0.5 ? nearRoad(20) : rndSq(); if (!free(x, z, 3) || quesilloD(x, z) < QS.baseR + 4) return false; cane(x, z, rr(0.7, 1.3)); return true; });
  tries(VG.cotufas, () => { const [x, z] = rand() < 0.5 ? [rr(-200, 240), rr(160, 420)] : rndSq(); if (!free(x, z, 4) || quesilloD(x, z) < QS.baseR + 4) return false; cotufaTree(x, z); return true; });
  tries(VG.gummies, () => { const [x, z] = rand() < 0.6 ? nearRoad(40) : rndSq(); if (!free(x, z, 1.5)) return false; gummy(x, z); return true; });
  tries(VG.mint, () => { const [x, z] = rndSq(); if (!free(x, z, 1.5) || quesilloD(x, z) < QS.baseR) return false; const y = groundH(x, z), c = col(pick(['#5ad08a', '#7ae0a0', '#3ab86a'])); for (let k = 0; k < 6; k++) push(inst.leaf, V3(x, y, z), qEuler(rr(-0.9, -0.4), k / 6 * TAU, 0), S.set(0.7, 1, rr(1.4, 2)), c); return true; });
  tries(VG.sprinkles, () => { const [x, z] = rand() < 0.5 ? nearRoad(30) : rndSq(); if (!free(x, z, 0.6) || quesilloD(x, z) < QS.baseR + 2) return false; push(inst.sprinkle, V3(x, groundH(x, z) + 0.08, z), qEuler(PI / 2, rand() * TAU, 0), S.set(0.12, 0.6, 0.12), pick(PASTEL)); return true; });
  // candy-cane arches over the road
  const hoops = [];
  for (let i = 0; i < NR; i += 75) { if (Math.abs(wrap(i - i0 + NR / 2) - NR / 2) < 40 || (i > t0 - 30 && i < t1 + 30) || isBridge[i]) continue; const f = roadFrame(i); hoops.push({ c: roadAt(i, 0, 0), q: qBasis(f.n, UP, new THREE.Vector3().crossVectors(f.n, UP)).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), bank[i])), hw: hwA[i] + 1.6 }); }

  /* ---------------- the start: checkered line and a flag arch ---------------- */
  {
    const f = roadFrame(i0), q = qBasis(f.n, UP, new THREE.Vector3().crossVectors(f.n, UP));
    const lineTex = canvasTex(256, 32, (c, w, h) => { for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { c.fillStyle = ((x + y) / 16) % 2 ? '#151515' : '#f2f2f2'; c.fillRect(x, y, 16, 16); } });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(MAP.road.width, 1.6), new THREE.MeshStandardMaterial({ map: lineTex, polygonOffset: true, polygonOffsetFactor: -5 })); line.position.copy(roadAt(i0, 0, 0.17)); line.quaternion.copy(q); line.rotateX(-PI / 2); scene.add(line);
    const arch = new THREE.Group(); arch.position.copy(roadAt(i0, 0, 0)); arch.quaternion.copy(q); scene.add(arch);
    [['#ffd23a', HW0 + 4.2], ['#1f4fd8', HW0 + 3.1], ['#e0263a', HW0 + 2.0]].forEach(([c, r]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.55, 12, 80, PI), new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.3, emissive: col(c), emissiveIntensity: 0.25 })); m.castShadow = true; arch.add(m); });
    const star = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, r = k % 2 ? 0.42 : 1; k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.25, bevelEnabled: false }); sg.translate(0, 0, -0.125);
    for (let k = 0; k < 8; k++) { const a = PI * (0.18 + 0.64 * k / 7), s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false })); s.position.set(Math.cos(a) * (HW0 + 3.1), Math.sin(a) * (HW0 + 3.1), 0.7); s.scale.setScalar(0.62); arch.add(s); const b = s.clone(); b.position.z = -0.7; arch.add(b); }
  }

  /* ---------------- flush ---------------- */
  function flush(list, geo, mat, cast = true) { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); }); im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; }
  const GLOSS = () => new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.3, metalness: 0.05 });
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.stick, g, GLOSS()); flush(inst.trunk, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9 })); flush(inst.cyl, g, GLOSS()); }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 32); g.rotateX(PI / 2); const discMat = new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: swirlTex, roughness: 0.25 }); flush(inst.disc, g, discMat); }
  {
    // candy cane: a straight stick with a hook, striped
    const path = new THREE.CurvePath(); path.add(new THREE.LineCurve3(V3(0, 0, 0), V3(0, 0.85, 0))); const hook = new THREE.CatmullRomCurve3([V3(0, 0.85, 0), V3(0, 0.95, 0), V3(0.08, 1.02, 0), V3(0.18, 0.98, 0), V3(0.22, 0.88, 0)]); path.add(hook);
    const g = new THREE.TubeGeometry(path, 40, 0.035, 10); g.scale(5, 1, 5); stripeTex.repeat.set(1, 6);
    flush(inst.cane, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: stripeTex, roughness: 0.3 }));
  }
  flush(inst.pop, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }));
  flush(inst.gummy, new THREE.CapsuleGeometry(0.45, 0.6, 4, 10), new THREE.MeshPhysicalMaterial({ color: col('#ffffff'), roughness: 0.2, transmission: 0, clearcoat: 1, emissive: col('#301020'), emissiveIntensity: 0.2 }));
  flush(inst.sprinkle, new THREE.CapsuleGeometry(1, 1, 2, 6), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.4 }), false);
  { const g = new THREE.PlaneGeometry(1, 1, 1, 4); g.translate(0, 0.5, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, y * y * 0.35); } g.rotateX(-PI / 2 + 0.2); g.computeVertexNormals(); flush(inst.leaf, g, sway(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: leafTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 }), 0, 0.05), false); }
  { const g = new THREE.BoxGeometry(1, 1, 1); flush(inst.box, g, GLOSS()); }
  flush(inst.cone, new THREE.ConeGeometry(1, 1, 12), GLOSS());
  flush(inst.sphere, new THREE.SphereGeometry(1, 10, 8), GLOSS(), false);
  flush(inst.flag, scene.userData.flagGeo, sway(new THREE.MeshStandardMaterial({ color: col('#ffffff'), side: THREE.DoubleSide, roughness: 0.8 }), 0.12, 0), false);
  {
    const g = new THREE.TorusGeometry(1, 0.06, 10, 48, PI); stripeTex.repeat.set(1, 6);
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: stripeTex, roughness: 0.3 }), Math.max(1, hoops.length));
    hoops.forEach((h, k) => { d.position.copy(h.c); d.quaternion.copy(h.q); d.scale.set(h.hw, h.hw * 0.9, h.hw); d.updateMatrix(); m.setMatrixAt(k, d.matrix); }); m.count = hoops.length; m.castShadow = true; m.frustumCulled = false; scene.add(m);
  }

  /* ---------------- cotton-candy clouds ---------------- */
  const clouds = [];
  {
    const mats = ['#ffc0dc', '#c0e0ff', '#fff0f8', '#e0c8ff'].map(c => new THREE.SpriteMaterial({ map: cloudTex, color: col(c), transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
    for (let k = 0; k < 70; k++) { const a = rand() * TAU, r = rr(1700, 3400), s = new THREE.Sprite(pick(mats)); s.position.set(CX + Math.cos(a) * r, rr(160, 460), CZ + Math.sin(a) * r); const sc = rr(220, 480); s.scale.set(sc, sc * 0.55, 1); scene.add(s); clouds.push({ s, x0: s.position.x, ph: rand() * TAU }); }
    const near = ['#ffd0e6', '#d0e8ff'].map(c => new THREE.SpriteMaterial({ map: cloudTex, color: col(c), transparent: true, opacity: 0.55, depthWrite: false, fog: true }));
    for (let k = 0; k < 24; k++) { const a = rand() * TAU, r = rr(520, 900), x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r, s = new THREE.Sprite(pick(near)); s.position.set(x, rr(60, 120), z); const sc = rr(60, 120); s.scale.set(sc, sc * 0.5, 1); scene.add(s); clouds.push({ s, x0: x, ph: rand() * TAU }); }
  }

  /* ---------------- per-frame updates ---------------- */
  function update(t, dt, racerS = null) {
    uTime.value = t; flowMats.forEach(m => (m.uniforms.uT.value = t));
    clouds.forEach(c => { c.s.position.x = c.x0 + Math.sin(t * 0.02 + c.ph) * 40; });

  }


  return ownReferenceWorld(scene, groundH, update, createdTextures);
}
