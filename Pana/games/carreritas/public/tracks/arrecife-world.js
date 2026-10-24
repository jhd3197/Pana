import { rng, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { MAP } from './arrecife-layout.js';
import { ownReferenceWorld, referenceDetail } from './reference-world.js';

export function createWorld(scene, layout) {
  const { PI, TAU, UP, clamp, sstep, lerp, col, V3, d, uTime, W0, CX, CZ, SIZE, HALF, SEA, SURF, SB, ih, noise2, fbm2, TRP, trenchQ, natural, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, wrap, roadY, bank, roadFrame, roadAt, idxNear, segRange, i0, GR, CELL, X0, Z0, GN, vIdx, NAT, HGT, DMIN, NEAR, inSquare, gridH, groundH, roadDist, GC, grid, gkey, roadDist3 } = layout;
  const rand = rng(MAP.seed), rr = (a,b) => a + rand() * (b-a);
  const pick = values => pickRandom(values, rand);
  const createdTextures = [];
  const mapDetail = { value: 2 };
  /* ---------------- sky above, sun, fog ---------------- */
  const SUN_DIR = new THREE.Vector3(...MAP.sun.dir).normalize();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vD; void main(){
      vec3 d = normalize(vD); float h = clamp(d.y, -0.3, 1.0);
      vec3 c = mix(vec3(0.78, 0.9, 0.95), vec3(0.42, 0.68, 0.92), smoothstep(0.0, 0.25, h)); c = mix(c, vec3(0.16, 0.42, 0.85), smoothstep(0.25, 0.85, h));
      c = mix(c, vec3(0.1, 0.45, 0.6), smoothstep(0.0, -0.2, h));
      float s = max(dot(d, uSun), 0.0); c += vec3(1.0, 0.95, 0.8) * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.25);
      if (cameraPosition.y < ${SURF.toFixed(1)}) c = mix(vec3(0.015,0.16,0.24), vec3(0.04,0.36,0.44), clamp(d.y * 0.5 + 0.5, 0.0, 1.0));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -9; scene.add(sky);
  const hemi = new THREE.HemisphereLight(col('#cff6ff'), col('#2a6a7a'), MAP.sun.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(col(MAP.sun.color), MAP.sun.intensity);
  sun.target.position.set(CX, 0, CZ); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 900);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  { const h = MAP.sun.shadowHalf; Object.assign(sun.shadow.camera, { left: -h, right: h, top: h, bottom: -h, near: 100, far: 2000 }); }
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.0;
  scene.add(sun, sun.target);

  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); createdTextures.push(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const roadTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#a4a29c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(40,50,60,${rr(0.05, 0.16).toFixed(2)})` : `rgba(255,255,255,${rr(0.04, 0.12).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    c.strokeStyle = 'rgba(40,60,70,0.25)'; c.lineWidth = 2; for (let y = 0; y < h; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = 'rgba(250,248,236,0.9)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#f3c63a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const glowTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const frondTex = canvasTex(128, 512, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineCap = 'round'; c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 6); c.stroke(); for (let y = h - 20; y > 20; y -= 13) { const len = (w / 2 - 6) * Math.sin(PI * (1 - y / h) * 0.95 + 0.15); c.lineWidth = 7; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + s * len * 0.6, y - 10, w / 2 + s * len, y - 26); c.stroke(); } } });
  const kelpTex = canvasTex(64, 512, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff'; for (let y = 0; y < h; y += 2) { const ww = w * (0.32 + 0.12 * Math.sin(y * 0.11) + 0.08 * Math.sin(y * 0.031)); c.fillRect(w / 2 - ww / 2, y, ww, 2); } for (let y = 30; y < h; y += 46) { c.beginPath(); c.ellipse(w * 0.72, y, w * 0.2, 9, 0.4, 0, TAU); c.fill(); c.beginPath(); c.ellipse(w * 0.28, y + 23, w * 0.2, 9, -0.4, 0, TAU); c.fill(); } });
  const fanTex = canvasTex(256, 256, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineWidth = 3; const tree = (x, y, a, len, dpt) => { if (dpt === 0) return; const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke(); tree(x2, y2, a + 0.35, len * 0.78, dpt - 1); tree(x2, y2, a - 0.35, len * 0.78, dpt - 1); }; tree(w / 2, h, PI / 2, 52, 7); c.lineWidth = 1; for (let k = 0; k < 40; k++) { c.beginPath(); c.arc(w / 2, h, 30 + k * 5, PI * 1.08, PI * 1.92); c.stroke(); } });
  const sailTex = canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, w, h); c.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 14; k++) { c.beginPath(); c.ellipse(rr(0, w), rr(0, h), rr(4, 18), rr(4, 14), rand(), 0, TAU); c.fill(); } c.fillRect(0, h * 0.86, w, h); });
  const plankTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#6a4a30'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = `rgba(${(rand() * 40) | 0},${(rand() * 30) | 0},10,0.25)`; c.fillRect(0, y, w, 14); c.fillStyle = 'rgba(20,12,6,0.6)'; c.fillRect(0, y + 14, w, 2); } for (let i = 0; i < 200; i++) { c.fillStyle = `rgba(80,120,90,${rr(0.1, 0.35).toFixed(2)})`; c.beginPath(); c.arc(rand() * w, rand() * h, rr(2, 9), 0, TAU); c.fill(); } });
  // water current sway for anything soft: kelp, fans, anemones, fronds
  const current = (mat, base, perY, amp = 1) => {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float hy = max(position.y, 0.0);
        float sw = sin(uTime * 0.9 + ip.x * 0.05 + ip.z * 0.04 - hy * 0.25) * 0.7 + sin(uTime * 1.7 + ip.z * 0.13 - hy * 0.4) * 0.3;
        float k = (${base.toFixed(3)} + hy * ${perY.toFixed(3)}) * ${amp.toFixed(2)};
        transformed.x += sw * k; transformed.z += sw * k * 0.6;`);
    };
    return mat;
  };
  // sunlight caustics rippling over the seabed and the road, strongest in shallow water
  const CAUSTIC_GLSL = `
    float causticAt(vec3 w, float t){
      if (uMapDetail < 0.5) return 0.0;
      vec2 q = w.xz * 0.34;
      vec2 a = q + vec2(sin(q.y * 1.7 + t * 0.9), cos(q.x * 1.3 - t * 0.7)) * 0.9;
      vec2 b = q * 1.43 + vec2(cos(q.y * 2.1 - t * 1.1), sin(q.x * 1.9 + t * 0.8)) * 0.9;
      float l1 = max(pow(1.0 - abs(sin(a.x * 2.0)), 16.0), pow(1.0 - abs(sin(a.y * 2.0)), 16.0));
      float l2 = max(pow(1.0 - abs(sin(b.x * 2.0 + 1.3)), 16.0), pow(1.0 - abs(sin(b.y * 2.0 + 0.7)), 16.0));
      return (l1 * 0.6 + l2 * 0.4) * smoothstep(-20.0, 4.0, w.y) * step(w.y, ${SURF.toFixed(1)});
    }`;
  const caustics = (mat, strength = 0.55) => {
    const prev = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      if (prev) prev(sh, r);
      sh.uniforms.uTimeC = uTime; sh.uniforms.uMapDetail = mapDetail;
      sh.vertexShader = 'varying vec3 vWorldC;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vec4 wcp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wcp = instanceMatrix * wcp;
        #endif
        vWorldC = (modelMatrix * wcp).xyz;`);
      sh.fragmentShader = 'uniform float uMapDetail; uniform float uTimeC;\nvarying vec3 vWorldC;\n' + CAUSTIC_GLSL + '\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.75, 0.95, 1.0) * causticAt(vWorldC, uTimeC) * ${strength.toFixed(2)} * (0.35 + 0.65 * max(normal.y, 0.0));`);
    };
    return mat;
  };

  /* ---------------- seabed colours ---------------- */
  const C = { sand: col('#e9dcb4'), sand2: col('#d8c89a'), white: col('#e6d4a4'), grass: col('#4f8a46'), grass2: col('#6e9a4a'), rock: col('#6a6a62'), rock2: col('#4c4a48'), deep: col('#2a3a48'), deep2: col('#3a4a58'), verge: col('#bdb6a0'), reef: col('#b89a7a') };
  function paintGround(x, z, y, slope, tmp) {
    const n1 = fbm2(x * 0.02, z * 0.02, 3), n2 = fbm2(x * 0.09 + 3, z * 0.09, 2);
    tmp.copy(C.sand).lerp(C.sand2, n2 * 0.6);
    tmp.lerp(C.grass.clone().lerp(C.grass2, n2), sstep(0.58, 0.68, n1) * 0.85 * (1 - sstep(-6, -14, y)));
    tmp.lerp(C.deep.clone().lerp(C.deep2, n2), sstep(-8, -22, y));
    tmp.lerp(C.rock.clone().lerp(C.rock2, n2), sstep(0.35, 0.7, slope));
    tmp.lerp(C.white, sstep(SURF - 8, SURF - 1, y));
    return tmp;
  }
  const SEABED = caustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, shadowSide: THREE.BackSide }), 0.4);
  {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, GR, GR); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, HGT[vIdx(Math.round((pos.getX(i) - X0) / CELL), Math.round((pos.getZ(i) - Z0) / CELL))]);
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), v = vIdx(Math.round((x - X0) / CELL), Math.round((z - Z0) / CELL)); paintGround(x, z, pos.getY(i), 1 - nrm.getY(i), tmp); if (DMIN[v] < 12) tmp.lerp(C.verge, (1 - sstep(HW0, HW0 + 4, DMIN[v])) * 0.4); colors.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, SEABED); m.castShadow = true; m.receiveShadow = true; m.name = 'arrecife-seabed'; scene.add(m);
  }
  {
    const F = W0.far, geo = new THREE.PlaneGeometry(F.size, F.size, F.segs, F.segs); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, natural(pos.getX(i), pos.getZ(i)) - 0.8);
    geo.computeVertexNormals(); const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { paintGround(pos.getX(i), pos.getZ(i), pos.getY(i), 1 - nrm.getY(i), tmp); colors.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); if (inSquare(x, z, 40)) pos.setY(i, -200); else if (inSquare(x, z, -2)) pos.setY(i, pos.getY(i) - 2); }
    scene.add(new THREE.Mesh(geo, caustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 0.4)));
  }

  /* ---------------- road surface, glowing edges ---------------- */
  function stripMesh(rows, mat, vScale, closed, colors) {
    const pos = [], uv = [], idx = [], cl = []; let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.a.distanceTo(rows[i - 1].a); pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale); if (colors) { const c = colors[i]; cl.push(c.r, c.g, c.b, c.r, c.g, c.b); } if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    if (closed) { const k = (rows.length - 1) * 2; idx.push(k, k + 1, 0, k + 1, 1, 0); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  const blendCol = (table, i, span = 12) => { const c = new THREE.Color(0, 0, 0); for (let j = -span; j <= span; j++) c.add(table[SEG[wrap(i + j)]]); return c.multiplyScalar(1 / (2 * span + 1)); };
  const TINT = Object.fromEntries(Object.entries(MAP.road.tint).map(([k, v]) => [k, col(v)]));
  const GLOW = Object.fromEntries(Object.entries(MAP.road.glow).map(([k, v]) => [k, col(v)]));
  {
    const rows = [], tints = [], glowRows = [[], []], gc = [], skirts = [[], []];
    for (let i = 0; i < NR; i++) {
      const hw = hwA[i]; rows.push({ a: roadAt(i, -hw, 0.12), b: roadAt(i, hw, 0.12) }); tints.push(blendCol(TINT, i)); gc.push(blendCol(GLOW, i, 6).multiplyScalar(1.5));
      [-1, 1].forEach((s, k) => { glowRows[k].push({ a: roadAt(i, s * (hw - 0.1), 0.16), b: roadAt(i, s * (hw + 0.45), 0.16) }); skirts[k].push({ a: roadAt(i, s * (hw + 0.45), 0.15), b: roadAt(i, s * (hw + 0.8), -2.4) }); });
    }
    const road = stripMesh(rows, caustics(new THREE.MeshStandardMaterial({ map: roadTex, vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), 0.2), 20, true, tints);
    road.castShadow = true; road.name = 'arrecife-road';
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    glowRows.forEach(r => stripMesh(r, glowMat, 20, true, gc));
    const sk = new THREE.MeshStandardMaterial({ color: col('#8a8676'), roughness: 0.9, side: THREE.DoubleSide });
    skirts.forEach(r => stripMesh(r, sk, 20, true));
  }

  /* ---------------- the sea surface: turquoise from above, a bright window from below ---------------- */
  const surface = (() => {
    const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-PI / 2);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR } }]),
      vertexShader: `varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uSun; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float a = sin(vW.x * 0.12 + uT * 0.9 + sin(vW.z * 0.09) * 2.0) * sin(vW.z * 0.11 - uT * 0.7) + 0.5 * sin(vW.x * 0.37 - uT * 1.6) * sin(vW.z * 0.31 + uT * 1.2);
          vec3 N = normalize(vec3(a * 0.06, 1.0, a * 0.05));
          vec4 outC;
          if (cameraPosition.y > vW.y) {
            float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
            float dist = length(cameraPosition - vW);
            vec3 sea = mix(vec3(0.0, 0.5, 0.62), vec3(0.02, 0.22, 0.48), smoothstep(700.0, 2600.0, dist));
            vec3 c = mix(sea, vec3(0.55, 0.78, 0.95), fres * 0.6);
            c += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uSun, N), V), 0.0), 220.0) * 3.0;
            outC = vec4(c, clamp(mix(0.66, 0.94, fres) + smoothstep(700.0, 2200.0, dist), 0.0, 1.0));
          } else {
            float up = -V.y;
            float win = smoothstep(0.6, 0.82, up);
            vec3 c = mix(vec3(0.05, 0.42, 0.55), vec3(0.78, 0.96, 1.0), win);
            c += vec3(1.0, 0.97, 0.85) * pow(max(dot(-V, uSun), 0.0), 50.0) * 2.0 * win;
            c *= 0.85 + 0.15 * a;
            outC = vec4(c, 1.0);
          }
          gl_FragColor = outC;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    }));
    m.position.y = SURF; m.renderOrder = 8; m.name = 'arrecife-surface'; scene.add(m); return m;
  })();

  /* ---------------- instance buffers ---------------- */
  const inst = { head: [], branch: [], fan: [], sponge: [], table: [], anemone: [], star: [], urchin: [], kelp: [], rock: [], hoop: [], worm: [], wormTip: [], vent: [], frond: [], trunk: [], sand: [], gold: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const qBasis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const yawOf = v => Math.atan2(v.x, v.z);
  const between = (a, b, r, list, color) => { const dir = b.clone().sub(a), len = dir.length(); push(list, a, new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), S.set(r, len, r), color); };
  const tries = (n, fn) => { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; };
  const rndSq = () => [rr(X0 + 6, X0 + SIZE - 6), rr(Z0 + 6, Z0 + SIZE - 6)];
  const nearRoad = r => { const i = (rand() * NR) | 0, f = roadFrame(i), l = (rand() < 0.5 ? -1 : 1) * (HW0 + 2 + rand() * r); return [f.p.x + f.n.x * l + rr(-3, 3), f.p.z + f.n.z * l + rr(-3, 3), i]; };
  const dryOrDeep = y => y > SURF - 3 || y < -12;
  const CORAL = ['#ff7a5a', '#ff9ad0', '#ffd23a', '#b07aff', '#ff5a7a', '#7ae0c0', '#ffb05a', '#e0e86a', '#5ad0ff'].map(col);

  /* ---------------- the reef ---------------- */
  {
    const RF = MAP.reef;
    const reefSpot = (m) => { for (let k = 0; k < 40; k++) { const [x, z] = rand() < 0.7 ? nearRoad(45) : rndSq(), y = groundH(x, z); if (dryOrDeep(y) || roadDist(x, z) < HW0 + m || Math.hypot(x - SB.cay.at[0], z - SB.cay.at[1]) < SB.cay.r * 0.7) continue; if (z < -150 && x > -230 && x < 210) continue; return [x, z, y]; } return null; };
    tries(RF.heads, () => { const p = reefSpot(3); if (!p) return false; const s = rr(1.2, 3.6); push(inst.head, V3(p[0], p[2] - s * 0.25, p[1]), qEuler(rr(-0.2, 0.2), rand() * TAU, 0), S.set(s * rr(1, 1.4), s * rr(0.7, 1.0), s), pick(CORAL).clone().offsetHSL(0, -0.15, rr(-0.1, 0.05))); return true; });
    tries(RF.staghorn, () => { const p = reefSpot(3); if (!p) return false; const c = pick(CORAL).clone().offsetHSL(0, -0.1, rr(-0.08, 0.05)), base = V3(p[0], p[2], p[1]); for (let k = 0; k < 7; k++) { const tip = base.clone().add(V3(rr(-1.6, 1.6), rr(1.4, 3.2), rr(-1.6, 1.6))); between(base, tip, rr(0.14, 0.22), inst.branch, c); for (let j = 0; j < 2; j++) between(tip, tip.clone().add(V3(rr(-0.8, 0.8), rr(0.5, 1.3), rr(-0.8, 0.8))), 0.11, inst.branch, c); } return true; });
    tries(RF.fans, () => { const p = reefSpot(3); if (!p) return false; const s = rr(1.6, 3.4); push(inst.fan, V3(p[0], p[2] - 0.2, p[1]), qYaw(rand() * TAU), S.set(s, s, 1), col(pick(['#b07aff', '#ff7ab0', '#ffd23a', '#ff5a5a']))); return true; });
    tries(RF.sponges, () => { const p = reefSpot(3); if (!p) return false; const c = col(pick(['#ff8a3a', '#c05aff', '#ffd23a', '#5a8aff'])); for (let k = 0; k < 4; k++) push(inst.sponge, V3(p[0] + rr(-0.8, 0.8), p[2] - 0.2, p[1] + rr(-0.8, 0.8)), qEuler(rr(-0.15, 0.15), 0, rr(-0.15, 0.15)), S.set(rr(0.35, 0.55), rr(1.2, 3.4), rr(0.35, 0.55)), c.clone().offsetHSL(0, 0, rr(-0.06, 0.06))); return true; });
    tries(RF.tables, () => { const p = reefSpot(4); if (!p) return false; const s = rr(1.6, 3.2), c = pick(CORAL).clone().offsetHSL(0, -0.2, -0.05); push(inst.branch, V3(p[0], p[2] - 0.2, p[1]), Q, S.set(0.3, 1.1, 0.3), c); push(inst.table, V3(p[0], p[2] + 0.9, p[1]), qYaw(rand() * TAU), S.set(s, 0.25, s * rr(0.7, 1)), c); return true; });
    tries(RF.anemones, () => { const p = reefSpot(1.5); if (!p) return false; const c = col(pick(['#ff9ad0', '#7affd0', '#ffb05a', '#d0a0ff'])); for (let k = 0; k < 10; k++) push(inst.anemone, V3(p[0], p[2], p[1]), qEuler(rr(-0.5, -0.1), k / 10 * TAU, 0), S.set(0.35, 1.2, rr(0.9, 1.3)), c); return true; });
    tries(RF.starfish, () => { const [x, z] = rndSq(), y = groundH(x, z); if (dryOrDeep(y) || roadDist(x, z) < HW0 + 1) return false; push(inst.star, V3(x, y + 0.08, z), qYaw(rand() * TAU), S.set(rr(0.25, 0.45), 1, rr(0.25, 0.45)), col(pick(['#ff6a3a', '#ff9a2a', '#e0303a', '#ffd0a0', '#7a5aff']))); return true; });
    tries(RF.urchins, () => { const p = reefSpot(1.5); if (!p) return false; const s = rr(0.25, 0.4); push(inst.urchin, V3(p[0], p[2] + s * 0.6, p[1]), qEuler(rand(), rand(), rand()), S.set(s, s, s), col(pick(['#2a1a3a', '#4a1a4a', '#1a1a2a']))); return true; });
    // rocks along the reef and the trench walls
    tries(260, () => { const [x, z] = rndSq(), y = groundH(x, z); if (y > SURF - 3 || roadDist(x, z) < HW0 + 3) return false; const s = rr(1, 4); push(inst.rock, V3(x, y + s * 0.1, z), qEuler(rr(-0.3, 0.3), rand() * TAU, rr(-0.3, 0.3)), S.set(s * rr(1, 1.6), s * rr(0.5, 0.9), s), col('#6e6a60').offsetHSL(0, 0, rr(-0.08, 0.06))); return true; });
  }

  /* ---------------- the kelp forest ---------------- */
  {
    const K = MAP.kelp;
    tries(K.count, () => {
      const x = rr(...K.zone.x), z = rr(...K.zone.z), y = groundH(x, z); if (roadDist(x, z) < HW0 + 2.5 || y > SURF - 10) return false;
      const h = Math.min(rr(...K.height), SURF - y - 2);
      push(inst.kelp, V3(x, y - 0.2, z), qYaw(rand() * TAU), S.set(rr(1.6, 2.6), h, 1), col(pick(['#6a8a2a', '#8a9a3a', '#5a7a2a', '#9aa83a'])).offsetHSL(0, 0, rr(-0.05, 0.05)));
      return true;
    });
  }

  /* ---------------- the trench: vents, tube worms, glowing jellyfish ---------------- */
  const [f0, f1] = segRange('f');
  const jellies = [];
  {
    const T = MAP.trench;
    for (let k = 0; k < T.vents; k++) {
      const p = TRP[1 + (k % (TRP.length - 3))], side = k % 2 ? 1 : -1, nb = TRP[2 + (k % (TRP.length - 3))], dir = V3(nb.x - p.x, 0, nb.z - p.z).normalize(), sd = V3(-dir.z, 0, dir.x);
      const c = V3(p.x, 0, p.z).addScaledVector(sd, side * rr(15, 22)).addScaledVector(dir, rr(-10, 10)); if (roadDist(c.x, c.z) < HW0 + 6) continue;
      c.y = groundH(c.x, c.z); const h = rr(3, 7);
      push(inst.vent, c, Q, S.set(1.2, h, 1.2), col('#3a3230')); push(inst.vent, c.clone().add(V3(0.8, 0, 0.6)), Q, S.set(0.7, h * 0.6, 0.7), col('#4a3a32'));
      for (let j = 0; j < 30; j++) { const a = rand() * TAU, r = rr(1.5, 4.5), q = V3(c.x + Math.cos(a) * r, 0, c.z + Math.sin(a) * r); q.y = groundH(q.x, q.z); const hh = rr(0.6, 1.8); push(inst.worm, q, qEuler(rr(-0.2, 0.2), 0, rr(-0.2, 0.2)), S.set(0.09, hh, 0.09), col('#e8e0d0')); push(inst.wormTip, q.clone().add(V3(0, hh, 0)), Q, S.set(0.16, 0.22, 0.16), col('#ff2a3a')); }
      jellies.push({ vent: c.clone().add(V3(0, h, 0)) });
    }
  }
  const ventTops = jellies.splice(0).map(j => j.vent);
  {
    for (let k = 0, t = 0; k < MAP.trench.jellies && t < 2000; t++) {
      const i = f0 + ((rand() * (f1 - f0 + 120)) | 0), f = roadFrame(i), p = roadAt(i, (rand() < 0.5 ? -1 : 1) * rr(HW0 + 4, 24), rr(3, 22));
      if (roadDist3(p).d < HW0 + 3) continue;
      jellies.push({ p, ph: rand() * TAU, s: rr(0.6, 1.15), c: col(pick(['#ff7ad8', '#7ae8ff', '#b07aff', '#7affb0'])) }); k++;
    }
  }
  const jellyMesh = (() => {
    const bell = new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, PI / 2);
    const tent = new THREE.CylinderGeometry(0.05, 0.01, 1, 4); tent.translate(0, -0.5, 0);
    const geo = new THREE.BufferGeometry();
    const parts = [bell.index ? bell.toNonIndexed() : bell]; for (let k = 0; k < 7; k++) { const t = tent.clone().toNonIndexed(), a = k / 7 * TAU; t.scale(1, 2 + (k % 3) * 0.6, 1); t.translate(Math.cos(a) * 0.6, 0, Math.sin(a) * 0.6); parts.push(t); }
    const pos = [], nrm = []; parts.forEach(p => { pos.push(...p.attributes.position.array); nrm.push(...p.attributes.normal.array); });
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), jellies.length);
    jellies.forEach((j, k) => m.setColorAt(k, j.c.clone().multiplyScalar(1.1))); m.frustumCulled = false; scene.add(m); return m;
  })();

  /* ---------------- the galleon resting on two rocks across the road ---------------- */
  const galleon = (() => {
    const G = MAP.galleon, i = idxNear(...G.road), f = roadFrame(i), c = roadAt(i, 0, 0), g = new THREE.Group();
    const across = f.n.clone(), along = f.t.clone(), wood = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9, side: THREE.DoubleSide });
    plankTex.repeat.set(4, 1);
    // hull: rings across its length, a rounded bottom and straight sides, open at the top
    const L = G.length, B = G.beam, H = G.depth, NL = 28, NK = 14, pos = [], uv = [], idx = [];
    for (let a = 0; a <= NL; a++) {
      const u = a / NL * 2 - 1, wid = B / 2 * Math.pow(1 - Math.pow(Math.abs(u), 3), 0.5), dep = H * (0.55 + 0.45 * Math.pow(1 - Math.pow(Math.abs(u), 4), 0.5)), sheer = 1.2 * u * u;
      for (let k = 0; k <= NK; k++) { const th = PI * k / NK, x = -Math.cos(th) * wid, y = -Math.sin(th) * dep + sheer; pos.push(x, y, u * L / 2); uv.push(k / NK * 2, a / NL * 4); }
      if (a) for (let k = 0; k < NK; k++) { const p0 = (a - 1) * (NK + 1) + k, p1 = a * (NK + 1) + k; idx.push(p0, p1, p0 + 1, p0 + 1, p1, p1 + 1); }
    }
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); hg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); hg.setIndex(idx); hg.computeVertexNormals();
    const hull = new THREE.Mesh(hg, caustics(wood, 0.12)); hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(B * 0.92, 0.3, L * 0.85), wood); deck.position.y = 0.2; g.add(deck);
    const castle = new THREE.Mesh(new THREE.BoxGeometry(B * 0.85, 4, 8), wood); castle.position.set(0, 2.2, -L * 0.38); castle.castShadow = true; g.add(castle);
    for (let k = 0; k < 4; k++) { const w = new THREE.Mesh(new THREE.BoxGeometry(B * 0.87, 0.8, 0.9), new THREE.MeshBasicMaterial({ color: col('#ffcf6a'), toneMapped: false })); w.position.set(0, 2.6, -L * 0.38 - 4.05 + k * 0.001); w.scale.x = 0.2; w.position.x = -B * 0.3 + k * B * 0.2; g.add(w); }
    // masts: one standing with a torn sail and a crow's nest, one snapped
    const m1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 26, 10), wood); m1.position.set(0, 13, L * 0.08); m1.rotation.z = 0.12; m1.castShadow = true; g.add(m1);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 14, 8), wood); yard.rotation.z = PI / 2; yard.position.set(0.8, 9, 0); m1.add(yard);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(13, 9, 8, 6), current(new THREE.MeshStandardMaterial({ map: sailTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1 }), 0.1, 0.02)); sail.position.set(0.8, 4.4, 0.4); m1.add(sail);
    const nest = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.9, 1.2, 10, 1, true), wood); nest.position.y = 10.5; m1.add(nest);
    const m2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 9, 10), wood); m2.position.set(0, 4.5, -L * 0.18); m2.rotation.x = -0.25; g.add(m2);
    const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 14, 8), wood); bow.position.set(0, 3, L / 2 + 5); bow.rotation.x = PI / 2 - 0.4; g.add(bow);
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) { const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 2.2, 10), new THREE.MeshStandardMaterial({ color: col('#2a2a2e'), metalness: 0.6, roughness: 0.5 })); cn.rotation.z = PI / 2; cn.position.set(s * (B / 2 + 0.6), -1.2, -L * 0.25 + k * L * 0.12); g.add(cn); }
    // orient: the keel across the road, high enough to drive under
    const keelY = c.y + G.clearance + H;
    g.position.set(c.x, keelY, c.z); g.quaternion.copy(qBasis(along, UP, across.clone().negate())).multiply(qEuler(G.pitch, 0, G.roll)); scene.add(g);
    // the rocks it rests on, either side of the road, and coral growing on them
    for (const s of [-1, 1]) {
      const base = c.clone().addScaledVector(across, s * (L * 0.36)); base.y = groundH(base.x, base.z);
      const top = keelY - H * 0.6, n = 5;
      for (let k = 0; k < n; k++) { const t = k / (n - 1), sz = lerp(6, 3.6, t); push(inst.rock, V3(base.x + rr(-1, 1), lerp(base.y, top, t), base.z + rr(-1, 1)), qEuler(rand(), rand() * TAU, rand()), S.set(sz * 1.3, sz, sz * 1.1), col('#5e5a52').offsetHSL(0, 0, rr(-0.05, 0.05))); }
      for (let k = 0; k < 12; k++) { const a = rand() * TAU, q = base.clone().add(V3(Math.cos(a) * rr(4, 7), rr(0, top - base.y), Math.sin(a) * rr(4, 7))); push(inst.head, q, qEuler(rand(), rand(), rand()), S.set(rr(0.6, 1.4), rr(0.5, 1.0), rr(0.6, 1.4)), pick(CORAL).clone().offsetHSL(0, -0.15, -0.05)); }
    }
    // a treasure chest spilling gold beside the road
    const chestP = c.clone().addScaledVector(across, -(HW0 + 6)).addScaledVector(along, 8); chestP.y = groundH(chestP.x, chestP.z);
    const chest = new THREE.Group(); const cb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 1.5), wood); cb.position.y = 0.65; chest.add(cb);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.4, 12, 1, false, 0, PI), wood); lid.rotation.z = PI / 2; lid.rotation.x = -1.1; lid.position.set(0, 1.3, -0.6); chest.add(lid);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.3, 1.2), new THREE.MeshBasicMaterial({ color: col('#ffd23a'), toneMapped: false })); glow.position.y = 1.25; chest.add(glow);
    chest.position.copy(chestP); chest.rotation.y = yawOf(along) + 0.4; chest.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(chest);
    for (let k = 0; k < 40; k++) { const a = rand() * TAU, r = rr(0.5, 3.2); push(inst.gold, chestP.clone().add(V3(Math.cos(a) * r, 0.06, Math.sin(a) * r)), qEuler(rr(-0.3, 0.3), rand() * TAU, 0), S.set(0.22, 0.04, 0.22), col('#ffcf3a')); }
    return { g, i };
  })();

  /* ---------------- coral arches over the road ---------------- */
  for (let i = 0; i < NR; i += MAP.hoops.every) {
    if (Math.abs(wrap(i - i0 + NR / 2) - NR / 2) < 40 || Math.abs(wrap(i - galleon.i + NR / 2) - NR / 2) < 40) continue;
    const f = roadFrame(i), c = roadAt(i, 0, 0), hw = hwA[i] + 1.4;
    push(inst.hoop, c, qBasis(f.n, UP, new THREE.Vector3().crossVectors(f.n, UP)).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), bank[i])), S.set(hw, hw * 0.9, hw), GLOW[SEG[i]].clone().multiplyScalar(1.4));
  }
  // start: checkered line and an arch of bubbles' frame in yellow, blue and red
  {
    const f = roadFrame(i0), q = qBasis(f.n, UP, new THREE.Vector3().crossVectors(f.n, UP));
    const lineTex = canvasTex(256, 32, (c, w, h) => { for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { c.fillStyle = ((x + y) / 16) % 2 ? '#151515' : '#f2f2f2'; c.fillRect(x, y, 16, 16); } });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(MAP.road.width, 1.6), new THREE.MeshStandardMaterial({ map: lineTex, polygonOffset: true, polygonOffsetFactor: -5 }));
    line.position.copy(roadAt(i0, 0, 0.17)); line.quaternion.copy(q); line.rotateX(-PI / 2); scene.add(line);
    const arch = new THREE.Group(); arch.position.copy(roadAt(i0, 0, 0)); arch.quaternion.copy(q); scene.add(arch);
    [['#ffd23a', HW0 + 4.2], ['#1f4fd8', HW0 + 3.1], ['#e0263a', HW0 + 2.0]].forEach(([c, r]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.55, 12, 80, PI), new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.4, emissive: col(c), emissiveIntensity: 0.35 })); m.castShadow = true; arch.add(m); });
    const star = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, r = k % 2 ? 0.42 : 1; k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.25, bevelEnabled: false }); sg.translate(0, 0, -0.125);
    for (let k = 0; k < 8; k++) { const a = PI * (0.18 + 0.64 * k / 7), s = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false })); s.position.set(Math.cos(a) * (HW0 + 3.1), Math.sin(a) * (HW0 + 3.1), 0.7); s.scale.setScalar(0.62); arch.add(s); const b = s.clone(); b.position.z = -0.7; arch.add(b); }
  }

  /* ---------------- the cay above the water: sand, palms, a peñero ---------------- */
  {
    const cay = SB.cay;
    for (let k = 0; k < 11; k++) {
      const a = rand() * TAU, r = rr(0, cay.r * 0.16), x = cay.at[0] + Math.cos(a) * r, z = cay.at[1] + Math.sin(a) * r, y = groundH(x, z); if (y < SURF + 0.5) continue;
      const lean = V3(rr(-1, 1), 0, rr(-1, 1)).normalize(), h = rr(9, 14); let p = V3(x, y - 0.2, z);
      for (let j = 0; j < 6; j++) { const q = p.clone().add(V3(lean.x * (j * 0.25), h / 6, lean.z * (j * 0.25))); between(p, q, 0.32 - j * 0.03, inst.trunk, col('#8a7050')); p = q; }
      for (let j = 0; j < 9; j++) push(inst.frond, p, qEuler(rr(0.1, 0.5), j / 9 * TAU, 0), S.set(1.6, 4.6, 4.6), col('#3a8a2a').offsetHSL(0, 0, rr(-0.05, 0.05)));
    }
    const boat = new THREE.Group(), hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 9), new THREE.MeshStandardMaterial({ color: col('#2a6ab0'), roughness: 0.6 })); boat.add(hull);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.25, 9.05), new THREE.MeshStandardMaterial({ color: col('#ffd23a') })); band.position.y = 0.3; boat.add(band);
    const prow = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.6, 4), hull.material); prow.rotation.x = PI / 2; prow.rotation.y = PI / 4; prow.scale.set(1, 1, 0.5); prow.position.z = 5.6; boat.add(prow);
    boat.position.set(140, SURF + 0.2, 330); boat.rotation.y = 0.8; scene.add(boat); scene.userData.boat = boat;
  }

  /* ---------------- flush ---------------- */
  function flush(list, geo, mat, cast = true) { if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); }); im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im; }
  const bumpy = (() => { const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.06 * Math.sin(x * 9 + y * 7) * Math.sin(z * 8 - y * 5); p.setXYZ(i, x * k, Math.max(y, -0.2) * k, z * k); } g.computeVertexNormals(); return g; })();
  const reefMat = () => caustics(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, emissive: col('#1a0a10'), emissiveIntensity: 0.25 }), 0.2);
  flush(inst.head, bumpy, reefMat());
  { const g = new THREE.CylinderGeometry(0.7, 1, 1, 6); g.translate(0, 0.5, 0); flush(inst.branch, g, reefMat()); flush(inst.trunk, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1 })); }
  { const g = new THREE.PlaneGeometry(1, 1, 4, 4); g.translate(0, 0.5, 0); flush(inst.fan, g, current(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: fanTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.12), false); }
  { const g = new THREE.CylinderGeometry(1, 0.8, 1, 10, 1, true); g.translate(0, 0.5, 0); flush(inst.sponge, g, current(caustics(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, side: THREE.DoubleSide }), 0.3), 0, 0.04)); }
  { const g = new THREE.CylinderGeometry(1, 0.9, 1, 14); flush(inst.table, g, reefMat()); }
  {
    const fg = new THREE.PlaneGeometry(1, 1, 1, 6); fg.translate(0, 0.5, 0); const p = fg.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -Math.sin(y * 1.6) * 0.25 + y * y * 0.55); p.setY(i, y * (1 - y * 0.25)); } fg.rotateX(-PI / 2 + 0.25); fg.computeVertexNormals();
    flush(inst.frond, fg, current(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: frondTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), 0, 0.03, 0.4), false);
    const ag = new THREE.CylinderGeometry(0.08, 0.15, 1, 5); ag.translate(0, 0.5, 0); ag.rotateX(0.0);
    flush(inst.anemone, ag, current(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, emissive: col('#3a1030'), emissiveIntensity: 0.4 }), 0, 0.25), false);
  }
  { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, r = k % 2 ? 0.4 : 1; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } const g = new THREE.ExtrudeGeometry(sh, { depth: 0.15, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.08, bevelSegments: 1 }); g.rotateX(-PI / 2); flush(inst.star, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false); }
  { const g = new THREE.IcosahedronGeometry(1, 1), spikes = new THREE.ConeGeometry(0.08, 2.6, 4).toNonIndexed(); const out = [...g.attributes.position.array]; const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7], [0.6, 0.6, 0.6], [-0.6, 0.6, -0.6]];
    dirs.forEach(dd => { const v = V3(...dd).normalize(), q = new THREE.Quaternion().setFromUnitVectors(UP, v), sp = spikes.clone(); sp.applyQuaternion(q); sp.translate(v.x * 1.3, v.y * 1.3, v.z * 1.3); out.push(...sp.attributes.position.array); });
    const ug = new THREE.BufferGeometry(); ug.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); ug.computeVertexNormals(); flush(inst.urchin, ug, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 }), false); }
  { const g = new THREE.PlaneGeometry(1, 1, 1, 14); g.translate(0, 0.5, 0); flush(inst.kelp, g, current(caustics(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: kelpTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, emissive: col('#1a2a08'), emissiveIntensity: 0.3 }), 0.25), 0, 0.09, 1.0), false); }
  flush(inst.rock, new THREE.IcosahedronGeometry(1, 0), caustics(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true }), 0.15));
  { const g = new THREE.TorusGeometry(1, 0.05, 6, 40, PI); flush(inst.hoop, g, new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false }), false); }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0); flush(inst.worm, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false); flush(inst.vent, new THREE.CylinderGeometry(0.6, 1, 1, 8).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1 })); }
  flush(inst.wormTip, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false }), false);
  flush(inst.gold, new THREE.CylinderGeometry(1, 1, 1, 10), new THREE.MeshStandardMaterial({ color: col('#ffffff'), metalness: 0.9, roughness: 0.25, emissive: col('#5a3a00'), emissiveIntensity: 0.6 }), false);

  /* ---------------- light shafts, bubbles, marine snow ---------------- */
  const shafts = [];
  {
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uT: uTime },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vY = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uT; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(vN, vV)), 2.0); float a = 0.09 * f * smoothstep(0.0, 0.5, vY) * (0.75 + 0.25 * sin(uT * 0.6 + vY * 6.0)); gl_FragColor = vec4(vec3(0.85, 1.0, 1.0) * a, a); }` });
    for (let k = 0; k < 16; k++) {
      const [x, z] = nearRoad(60), y = groundH(x, z); if (y < -6) continue;
      const len = SURF - y, r = rr(3, 7), g = new THREE.CylinderGeometry(r, r * 1.6, len, 16, 1, true); g.translate(0, len / 2, 0);
      const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.quaternion.setFromUnitVectors(UP, SUN_DIR); m.renderOrder = 6; scene.add(m); shafts.push(m);
    }
  }
  const pointsOf = (n, place, size, color, opacity) => { const pos = new Float32Array(n * 3), seeds = []; for (let k = 0; k < n; k++) seeds.push(place()); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTex, color: col(color), size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })); m.frustumCulled = false; scene.add(m); return { m, seeds }; };
  const bubbles = pointsOf(MAP.bubbles, () => { const src = rand() < 0.35 && ventTops.length ? pick(ventTops) : (() => { const [x, z] = rndSq(); return V3(x, groundH(x, z), z); })(); return { x: src.x + rr(-1, 1), z: src.z + rr(-1, 1), y0: src.y, sp: rr(1.2, 3), ph: rand() * 100 }; }, 0.5, '#e8fbff', 0.8);
  const snow = pointsOf(MAP.snow, () => ({ x: rr(X0, X0 + SIZE), z: rr(Z0, Z0 + SIZE), y: rr(-30, SURF - 2), ph: rand() * TAU }), 0.3, '#e8f8ff', 0.55);

  /* ---------------- sea life: fish schools, turtles, mantas, the whale ---------------- */
  const fishGeo = (() => { const body = new THREE.OctahedronGeometry(1, 0); body.scale(0.28, 0.42, 1); const tail = new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.9, 0, 0.45, -1.5, 0, -0.45, -1.5], 3)); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...body.attributes.position.array, ...tail.attributes.position.array], 3)); g.computeVertexNormals(); return g; })();
  const schools = MAP.life.schools.map((sc, k) => ({ ...sc, c: V3(...sc.at), fish: Array.from({ length: sc.n }, () => ({ o: V3(rr(-1, 1), rr(-0.4, 0.4), rr(-1, 1)).multiplyScalar(rr(1, 6)), ph: rand() * TAU, s: rr(0.5, 0.9) })), sp: rr(0.12, 0.2) * (k % 2 ? -1 : 1), ph: rand() * TAU }));
  const fishCount = schools.reduce((a, s) => a + s.n, 0);
  const fishMesh = new THREE.InstancedMesh(fishGeo, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }), fishCount);
  { let k = 0; schools.forEach(sc => sc.fish.forEach(() => fishMesh.setColorAt(k++, col(sc.color).offsetHSL(0, 0, rr(-0.08, 0.08))))); }
  fishMesh.frustumCulled = false; scene.add(fishMesh);
  const creature = (build) => { const g = new THREE.Group(); build(g); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g); return g; };
  const turtles = Array.from({ length: MAP.life.turtles }, (_, k) => {
    const flippers = [];
    const g = creature(g => {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: col('#6a5a2a'), roughness: 0.7, flatShading: true })); shell.scale.set(1, 0.35, 1.3); g.add(shell);
      const skin = new THREE.MeshStandardMaterial({ color: col('#a8a070'), roughness: 0.8 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), skin); head.position.set(0, 0.05, 1.45); g.add(head);
      for (const s of [-1, 1]) for (const z of [0.6, -0.8]) { const pv = new THREE.Group(); pv.position.set(s * 0.8, 0, z); g.add(pv); const fl = new THREE.Mesh(new THREE.BoxGeometry(z > 0 ? 1.4 : 0.6, 0.08, 0.45), skin); fl.position.x = s * (z > 0 ? 0.7 : 0.3); pv.add(fl); flippers.push({ pv, s, front: z > 0 }); }
    });
    g.scale.setScalar(1.3);
    return { g, flippers, c: V3(rr(-150, 250), rr(10, 30), rr(0, 260)), r: rr(40, 90), sp: rr(0.04, 0.08) * (k % 2 ? 1 : -1), ph: rand() * TAU };
  });
  const mantas = Array.from({ length: MAP.life.mantas }, (_, k) => {
    const wings = [];
    const g = creature(g => { const m = new THREE.MeshStandardMaterial({ color: col('#2a3440'), roughness: 0.7, side: THREE.DoubleSide }); const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), m); b.scale.set(1.2, 0.3, 1.6); g.add(b); for (const s of [-1, 1]) { const pv = new THREE.Group(); g.add(pv); const w = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 1.4, s * 4.2, 0, -0.6, 0, 0, -1.4], 3)), m); w.geometry.computeVertexNormals(); pv.add(w); wings.push({ pv, s }); } const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 4, 4), m); tail.rotation.x = PI / 2; tail.position.z = -3; g.add(tail); });
    g.scale.setScalar(1.6);
    return { g, wings, c: V3(rr(-50, 200), rr(25, 40), rr(-100, 150)), r: rr(120, 180), sp: 0.035 * (k ? -1 : 1), ph: rand() * TAU };
  });
  const whale = (() => {
    const W = MAP.life.whale, parts = {};
    const g = creature(g => {
      const top = new THREE.MeshStandardMaterial({ color: col('#3a4a5a'), roughness: 0.6 }), belly = new THREE.MeshStandardMaterial({ color: col('#dfe4e8'), roughness: 0.7 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), top); body.scale.set(3.2, 3.0, 10); g.add(body);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), belly); b2.scale.set(2.8, 2.2, 9.2); b2.position.y = -0.9; g.add(b2);
      const tailG = new THREE.Group(); tailG.position.z = -8.5; g.add(tailG); parts.tail = tailG;
      const stock = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), top); stock.scale.set(1.3, 1.2, 5); stock.position.z = -3.5; tailG.add(stock);
      const fluke = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), top); fluke.scale.set(5, 0.25, 1.4); fluke.position.z = -8; tailG.add(fluke);
      for (const s of [-1, 1]) { const fin = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), belly); fin.scale.set(4.5, 0.2, 0.9); fin.position.set(s * 5.5, -1.8, 4); fin.rotation.set(0, s * 0.5, s * -0.45); g.add(fin); }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshStandardMaterial({ color: col('#101010') })); eye.position.set(2.6, 0.2, 6.5); g.add(eye); const e2 = eye.clone(); e2.position.x = -2.6; g.add(e2);
    });
    g.name = 'arrecife-ballena'; g.scale.setScalar(1.6);
    return { g, ...parts, W };
  })();

  /* ---------------- per-frame updates ---------------- */
  const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc3 = new THREE.Vector3(), look = new THREE.Matrix4(), tmpV = new THREE.Vector3(), fogC = new THREE.Color();
  function update(t, dt, racerS = null) {
    uTime.value = t; surface.material.uniforms.uT.value = t;
    // the water around the camera: open sky above, turquoise in the shallows, deep blue in the trench



    // fish schools wander round their centres
    let fk = 0;
    schools.forEach(sc => {
      const a = sc.ph + t * sc.sp, cx = sc.c.x + Math.cos(a) * sc.r, cz = sc.c.z + Math.sin(a) * sc.r, dirx = -Math.sin(a) * Math.sign(sc.sp), dirz = Math.cos(a) * Math.sign(sc.sp);
      sc.fish.forEach(f => { tmpV.set(cx + f.o.x + Math.sin(t * 1.3 + f.ph) * 0.6, sc.c.y + f.o.y + Math.sin(t * 0.9 + f.ph) * 0.5, cz + f.o.z + Math.cos(t * 1.1 + f.ph) * 0.6); look.lookAt(V3(0, 0, 0), V3(-dirx, 0, -dirz), UP); qq.setFromRotationMatrix(look).multiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.sin(t * 9 + f.ph) * 0.15)); m4.compose(tmpV, qq, sc3.set(f.s, f.s, f.s)); fishMesh.setMatrixAt(fk++, m4); });
    });
    fishMesh.instanceMatrix.needsUpdate = true;
    const swim = (o, flap) => { const a = o.ph + t * o.sp, p = V3(o.c.x + Math.cos(a) * o.r, o.c.y + Math.sin(t * 0.3 + o.ph) * 3, o.c.z + Math.sin(a) * o.r), ah = V3(o.c.x + Math.cos(a + 0.05 * Math.sign(o.sp)) * o.r, p.y, o.c.z + Math.sin(a + 0.05 * Math.sign(o.sp)) * o.r); o.g.position.copy(p); o.g.lookAt(ah); flap(); };
    turtles.forEach(o => swim(o, () => o.flippers.forEach(f => (f.pv.rotation.z = f.s * (f.front ? Math.sin(t * 1.6 + o.ph) * 0.5 : Math.sin(t * 1.6 + o.ph + 1) * 0.25)))));
    mantas.forEach(o => swim(o, () => o.wings.forEach(w => (w.pv.rotation.z = w.s * Math.sin(t * 1.1 + o.ph) * 0.45))));
    { const W = whale.W, a = t * W.speed, p = V3(W.center[0] + Math.cos(a) * W.r, W.center[1] + Math.sin(t * 0.2) * 4, W.center[2] + Math.sin(a) * W.r); whale.g.position.copy(p); whale.g.lookAt(V3(W.center[0] + Math.cos(a + 0.05) * W.r, p.y, W.center[2] + Math.sin(a + 0.05) * W.r)); whale.tail.rotation.x = Math.sin(t * 0.8) * 0.25; whale.g.rotation.z = Math.sin(t * 0.4) * 0.05; }
    // jellyfish pulse and drift
    jellies.forEach((j, k) => { const pulse = 1 + 0.18 * Math.sin(t * 2.2 + j.ph); tmpV.copy(j.p).add(V3(Math.sin(t * 0.2 + j.ph) * 2, Math.sin(t * 0.5 + j.ph) * 1.5, Math.cos(t * 0.17 + j.ph) * 2)); m4.compose(tmpV, Q, sc3.set(j.s * pulse, j.s / pulse, j.s * pulse)); jellyMesh.setMatrixAt(k, m4); });
    jellyMesh.instanceMatrix.needsUpdate = true;
    // bubbles rise and pop at the surface; snow drifts down
    { const p = bubbles.m.geometry.attributes.position; bubbles.seeds.forEach((b, k) => { if (k >= bubbles.m.geometry.drawRange.count) return; const y = b.y0 + ((t * b.sp + b.ph) % Math.max(4, SURF - b.y0)); p.setXYZ(k, b.x + Math.sin(t * 2 + b.ph) * 0.3, y, b.z + Math.cos(t * 1.7 + b.ph) * 0.3); }); p.needsUpdate = true; }
    { const p = snow.m.geometry.attributes.position; snow.seeds.forEach((s, k) => { if (k >= snow.m.geometry.drawRange.count) return; const y = SURF - 2 - (((SURF - 2 - s.y) + t * 0.4) % (SURF + 28)); p.setXYZ(k, s.x + Math.sin(t * 0.3 + s.ph) * 1.5, y, s.z + Math.cos(t * 0.25 + s.ph) * 1.5); }); p.needsUpdate = true; }
    scene.userData.boat.position.y = SURF + 0.2 + Math.sin(t * 1.2) * 0.15; scene.userData.boat.rotation.z = Math.sin(t * 0.9) * 0.04;

  }


  return ownReferenceWorld(scene, groundH, referenceDetail(scene, update, mapDetail), createdTextures);
}
