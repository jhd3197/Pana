import { rng, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { MAP } from './cosmos-layout.js';
import { ownReferenceWorld, referenceDetail } from './reference-world.js';

export function createWorld(scene, layout) {
  const { PI, TAU, UP, DEG, clamp, sstep, lerp, col, V3, d, uTime, hash1, O, polar, ih, noise3, fbm3, NOISE_GLSL, CTRL, roadCurve, ROAD_LEN, NR, RP, SEG, hwA, HW0, roadY, bank, wrap, roadFrame, roadAt, idxNear, segRange, GC, grid, gkey, roadDist3, i0, startFrame, atBase, MO, MC, MR, PATCH, PH, craters, craterH, sphereTop, moonNatural, GR, CELL, X0, Z0, R2, sampleR, moonH, cMoon, cMare, cRim, cDust, moonColor } = layout;
  const rand = rng(MAP.seed), rr = (a,b) => a + rand() * (b-a);
  const pick = values => pickRandom(values, rand);
  const createdTextures = [];
  const mapDetail = { value: 2 };
  /* ---------------- sky: deep space, the Turpial nebula (orange and black), stars, the sun ---------------- */
  const SUN_DIR = new THREE.Vector3(...MAP.sun.dir).normalize();
  const FOGS = Object.fromEntries(Object.entries(MAP.fog).map(([k, f]) => [k, { color: col(f.color), near: f.near, far: f.far }]));
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uSun: { value: SUN_DIR } },
      vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uSun; varying vec3 vD; ${NOISE_GLSL}
        float starLayer(vec3 d, float scale, float thr){
          vec3 q = d * scale; vec3 c = floor(q); float h = hash3(c);
          vec3 o = vec3(hash3(c + 11.1), hash3(c + 23.7), hash3(c + 37.3)) * 0.7 + 0.15;
          float r = length(fract(q) - o);
          return step(thr, h) * smoothstep(0.16, 0.0, r) * (0.4 + 0.6 * (h - thr) / (1.0 - thr));
        }
        void main(){
          vec3 d = normalize(vD);
          vec3 c = mix(vec3(0.010, 0.011, 0.035), vec3(0.025, 0.02, 0.07), 0.5 + 0.5 * d.y);
          float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.8, -0.5))) / 0.3, 2.0));
          float n = fbm3(d * 3.0);
          c += vec3(0.13, 0.11, 0.25) * band * n * 1.5;
          vec3 nd = normalize(vec3(0.62, 0.22, -0.75));
          float neb = smoothstep(0.62, 0.97, dot(d, nd));
          float cloud = fbm3(d * 4.5 + 7.0);
          float lanes = smoothstep(0.48, 0.72, fbm3(d * 10.0 + 1.3));
          c += neb * (vec3(1.0, 0.42, 0.06) * cloud * 1.2 + vec3(1.0, 0.75, 0.25) * pow(cloud, 4.0) * 2.0) * (1.0 - lanes * 0.9);
          vec3 nd2 = normalize(vec3(-0.7, -0.2, 0.68));
          float neb2 = smoothstep(0.75, 0.99, dot(d, nd2));
          c += neb2 * vec3(0.15, 0.55, 0.75) * fbm3(d * 5.0 + 2.0) * 0.8;
          float st = starLayer(d, 180.0, 0.9) * 2.6 + starLayer(d, 420.0, 0.82) * 1.1 + band * starLayer(d, 700.0, 0.7) * 0.9;
          vec3 tint = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.9, 0.75), hash3(floor(d * 180.0)));
          c += st * tint;
          float s = max(dot(d, uSun), 0.0);
          c += vec3(1.0, 0.86, 0.62) * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.35 + pow(s, 6.0) * 0.06);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    sky.frustumCulled = false; sky.renderOrder = -9;
    scene.add(sky);
  }
  const hemi = new THREE.HemisphereLight(col('#9ab0ff'), col('#2a2030'), MAP.sun.hemi);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(col(MAP.sun.color), MAP.sun.intensity);
  {
    const sc = MAP.sun.shadow;
    sun.target.position.set(...sc.center);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 1700);
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -sc.half, right: sc.half, top: sc.half, bottom: -sc.half, near: 200, far: 3600 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.2;
  }
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(col('#7a6aff'), 0.35); fill.position.set(-400, -120, -500); scene.add(fill);

  /* ---------------- canvas textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); createdTextures.push(t); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  // equirectangular planet maps from 3D noise, so they wrap with no seam
  const planetTex = (w, h, fn) => canvasTex(w, h, (c) => {
    const img = c.createImageData(w, h), px = img.data, tmp = new THREE.Color();
    for (let y = 0; y < h; y++) {
      const lat = PI * (0.5 - (y + 0.5) / h), cl = Math.cos(lat), sl = Math.sin(lat);
      for (let x = 0; x < w; x++) {
        const lon = TAU * (x + 0.5) / w; fn(Math.cos(lon) * cl, sl, Math.sin(lon) * cl, lat, tmp);
        const k = (y * w + x) * 4; px[k] = clamp(tmp.r * 255, 0, 255); px[k + 1] = clamp(tmp.g * 255, 0, 255); px[k + 2] = clamp(tmp.b * 255, 0, 255); px[k + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  });
  const roadTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#9c9ca4'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(40,40,52,${rr(0.05, 0.18).toFixed(2)})` : `rgba(255,255,255,${rr(0.04, 0.12).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    c.strokeStyle = 'rgba(40,40,60,0.28)'; c.lineWidth = 2;
    for (let y = 0; y < h; y += 128) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.beginPath(); c.moveTo(w * 0.27, 0); c.lineTo(w * 0.27, h); c.moveTo(w * 0.73, 0); c.lineTo(w * 0.73, h); c.stroke();
    c.fillStyle = 'rgba(250,248,236,0.9)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#f3c63a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const glowTex = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const frondTex = canvasTex(128, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineCap = 'round';
    c.lineWidth = 10; c.beginPath(); c.moveTo(w / 2, h); c.quadraticCurveTo(w / 2 + 8, h / 2, w / 2, 10); c.stroke();
    for (let y = h - 20; y > 20; y -= 9) { c.lineWidth = 3; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, y); c.lineTo(w / 2 + s * (w * 0.22) * Math.sin(PI * (1 - y / h)), y - 12); c.stroke(); } }
  });

  const moonMesh = (() => {
    const geo = new THREE.PlaneGeometry(PATCH.size, PATCH.size, GR, GR); geo.rotateX(-PI / 2); geo.translate(MC.x, 0, MC.z);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, moonH(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { moonColor(pos.getX(i), pos.getZ(i), pos.getY(i), 1 - nrm.getY(i), tmp); colors.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // trim the square to a disc that sits on the sphere
    const idx = geo.index.array, kept = [];
    const inside = v => Math.hypot(pos.getX(v) - MC.x, pos.getZ(v) - MC.z) < PH - 4;
    for (let t = 0; t < idx.length; t += 3) if (inside(idx[t]) && inside(idx[t + 1]) && inside(idx[t + 2])) kept.push(idx[t], idx[t + 1], idx[t + 2]);
    geo.setIndex(kept);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, shadowSide: THREE.BackSide }));
    m.castShadow = true; m.receiveShadow = true; m.name = 'cosmos-moon-terrain'; scene.add(m);
    return m;
  })();
  {
    const tex = planetTex(1024, 512, (x, y, z, lat, tmp) => {
      const n = fbm3(x * 2.5, y * 2.5, z * 2.5, 4), c = fbm3(x * 14, y * 14, z * 14, 3);
      tmp.copy(cMoon).lerp(cMare, sstep(0.45, 0.68, n) * 0.85).multiplyScalar(0.9 + 0.2 * c);
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(MR - MO.sink - 0.3, 160, 80), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    m.position.copy(MC); m.name = 'cosmos-moon'; scene.add(m);
  }

  /* ---------------- road surface, edge lights, energy rails, underside ---------------- */
  function stripMesh(rows, mat, vScale, closed, colors) {
    const pos = [], uv = [], idx = [], cl = [];
    let dist = 0;
    rows.forEach((r, i) => {
      if (i) dist += r.a.distanceTo(rows[i - 1].a);
      pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale);
      if (colors) { const c = colors[i]; cl.push(c.r, c.g, c.b, c.r, c.g, c.b); }
      if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    });
    if (closed) { const k = (rows.length - 1) * 2; idx.push(k, k + 1, 0, k + 1, 1, 0); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    if (colors) geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m);
    return m;
  }
  const blendCol = (table, i, span = 12) => { const c = new THREE.Color(0, 0, 0); for (let j = -span; j <= span; j++) c.add(table[SEG[wrap(i + j)]]); return c.multiplyScalar(1 / (2 * span + 1)); };
  const TINT = Object.fromEntries(Object.entries(MAP.road.tint).map(([k, v]) => [k, col(v)]));
  const GLOW = Object.fromEntries(Object.entries(MAP.road.glow).map(([k, v]) => [k, col(v)]));
  {
    const rows = [], tints = [], glowRows = [[], []], glowCols = [], railRows = [[], []], under = [], skirts = [[], []];
    for (let i = 0; i < NR; i++) {
      const hw = hwA[i];
      rows.push({ a: roadAt(i, -hw, 0.12), b: roadAt(i, hw, 0.12) }); tints.push(blendCol(TINT, i));
      glowCols.push(blendCol(GLOW, i, 6).multiplyScalar(1.6));
      [-1, 1].forEach((s, k) => {
        glowRows[k].push({ a: roadAt(i, s * (hw - 0.15), 0.16), b: roadAt(i, s * (hw + 0.45), 0.16) });
        railRows[k].push({ a: roadAt(i, s * (hw + 0.45), 0.15), b: roadAt(i, s * (hw + 0.45), 1.15) });
        skirts[k].push({ a: roadAt(i, s * (hw + 0.45), 0.15), b: roadAt(i, s * (hw + 0.2), -1.0) });
      });
      under.push({ a: roadAt(i, -hw - 0.2, -1.0), b: roadAt(i, hw + 0.2, -1.0) });
    }
    const road = stripMesh(rows, new THREE.MeshStandardMaterial({ map: roadTex, vertexColors: true, roughness: 0.78, metalness: 0.1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }), 20, true, tints);
    road.castShadow = true; road.name = 'cosmos-road';
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
    glowRows.forEach(r => stripMesh(r, glowMat, 20, true, glowCols));
    const railMat = new THREE.ShaderMaterial({
      vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uT: uTime },
      vertexShader: `varying vec2 vUv; varying vec3 vC; void main(){ vUv = uv; vC = color; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uT; varying vec2 vUv; varying vec3 vC; void main(){
        float h = vUv.x; float stripes = 0.5 + 0.5 * sin(vUv.y * 60.0 - uT * 6.0);
        float a = (1.0 - h) * (0.18 + 0.22 * stripes) + smoothstep(0.85, 1.0, h) * 0.5;
        gl_FragColor = vec4(vC * a, a); }`,
    });
    railRows.forEach(r => stripMesh(r, railMat, 20, true, glowCols));
    const hull = new THREE.MeshStandardMaterial({ color: col('#3a3f52'), roughness: 0.6, metalness: 0.5, side: THREE.DoubleSide, emissive: col('#10122a'), emissiveIntensity: 0.6 });
    skirts.forEach(r => stripMesh(r, hull, 20, true));
    stripMesh(under, hull, 20, true);
  }

  /* ---------------- instance buffers ---------------- */
  const inst = { rock: [], ice: [], hoop: [], box: [], light: [], sphere: [], dome: [], cyl: [], frond: [], trunk: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const qBasis = (x, y, z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  const yawOf = v => Math.atan2(v.x, v.z);
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
    return im;
  }
  // a lumpy rock shape shared by asteroids and ring ice
  const rockGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.72 + 0.5 * fbm3(x * 1.7 + 3, y * 1.7, z * 1.7, 3); p.setXYZ(i, x * k, y * k * 0.85, z * k); }
    g.computeVertexNormals(); return g;
  })();

  /* ---------------- Araguaney: the golden gas giant in the middle, and its rings ---------------- */
  const AR = MAP.planets.araguaney;
  const atmosphere = (r, color, power = 3, strength = 1.2) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uC: { value: col(color) }, uSun: { value: SUN_DIR } },
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uC; uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){
        vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(vN, V)), ${power.toFixed(1)});
        float lit = 0.25 + 0.75 * smoothstep(-0.3, 0.5, dot(vN, uSun));
        float a = f * lit * ${strength.toFixed(2)}; gl_FragColor = vec4(uC * a, a); }`,
    }));
    return m;
  };
  const araguaney = (() => {
    const pal = ['#f6c431', '#e8a21e', '#fbe7a1', '#d27a1c', '#f3d36b', '#b5651d', '#ffe9b0'].map(col);
    const tex = planetTex(1024, 512, (x, y, z, lat, tmp) => {
      const warp = fbm3(x * 3, y * 3, z * 3, 4) * 2.2, b = (Math.sin(lat * 14 + warp) * 0.5 + 0.5) * (pal.length - 1);
      const k = Math.floor(b); tmp.copy(pal[k]).lerp(pal[Math.min(pal.length - 1, k + 1)], b - k);
      tmp.multiplyScalar(0.9 + 0.18 * fbm3(x * 20, y * 40, z * 20, 2));
      const spot = Math.exp(-(((lat + 0.38) / 0.09) ** 2) - (((Math.atan2(z, x) - 1.1) / 0.22) ** 2));
      tmp.lerp(col('#d4501a'), clamp(spot * 1.4, 0, 0.85));
    });
    const g = new THREE.Group(); g.position.copy(O); scene.add(g);
    const body = new THREE.Mesh(new THREE.SphereGeometry(AR.radius, 96, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, emissive: col('#3a2408'), emissiveIntensity: 0.25 }));
    body.castShadow = true; body.receiveShadow = true; body.name = 'cosmos-araguaney'; g.add(body);
    g.add(atmosphere(AR.radius * 1.035, AR.atmosphere, 3, 1.3));
    // rings: bands with a gap, lit and shadowed by the planet
    const RG = AR.ring, rtex = canvasTex(1024, 4, (c, w) => {
      for (let x = 0; x < w; x++) {
        const f = x / w; let a = 0.55 + 0.25 * Math.sin(f * 90) * Math.sin(f * 23) + 0.15 * Math.sin(f * 211);
        if (f > 0.6 && f < 0.64) a = 0.06; a *= sstep(0, 0.06, f) * sstep(1, 0.92, f);
        const cc = col('#f7e2a8').lerp(col('#b98a4a'), 0.5 + 0.5 * Math.sin(f * 37)).lerp(col('#ffffff'), 0.2 * Math.sin(f * 151));
        c.fillStyle = `rgba(${(cc.r * 255) | 0},${(cc.g * 255) | 0},${(cc.b * 255) | 0},${clamp(a, 0, 1).toFixed(3)})`; c.fillRect(x, 0, 1, 4);
      }
    });
    const rg = new THREE.RingGeometry(RG.inner, RG.outer, 256, 4), up = rg.attributes.uv, pp = rg.attributes.position;
    for (let i = 0; i < pp.count; i++) up.setXY(i, (Math.hypot(pp.getX(i), pp.getY(i)) - RG.inner) / (RG.outer - RG.inner), 0.5);
    rg.rotateX(-PI / 2);
    const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: rtex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.9, emissive: col('#4a3a20'), emissiveIntensity: 0.35 }));
    ring.receiveShadow = true; ring.position.copy(O); ring.renderOrder = 1; ring.name = 'cosmos-araguaney-ring'; scene.add(ring);
    // ice chunks on the ring plane, clear of the road; bigger blocks line the road where it rides the ring
    const iceC = ['#f6f2e6', '#e9dcc0', '#fff8e0', '#d9c69a', '#cfe4f0'].map(col);
    for (let k = 0, tries = 0; k < RG.chunks && tries < RG.chunks * 4; tries++) {
      const a = rand() * TAU, r = lerp(RG.inner + 4, RG.outer - 4, Math.pow(rand(), 0.9)), s = rand() < 0.08 ? rr(2, 5) : rr(0.4, 1.8);
      const p = V3(O.x + Math.cos(a) * r, O.y + rr(-2.5, 2.5) * (s < 2 ? 1 : 0.5), O.z + Math.sin(a) * r);
      if (roadDist3(p).d < HW0 + s + 2.5) continue;
      push(inst.ice, p, qEuler(rand() * 3, rand() * 6, rand() * 3), S.set(s, s * rr(0.6, 1), s * rr(0.8, 1.2)), pick(iceC)); k++;
    }
    const [a0, a1] = segRange('a');
    for (let i = a0; i <= a1; i += 5) {
      if (Math.abs(roadY[i] - O.y) > 3) continue;
      for (const s of [-1, 1]) { const sz = rr(0.9, 1.6); push(inst.ice, roadAt(i, s * (hwA[i] + 1.6 + sz * 0.6), -0.3), qEuler(rand() * 3, rand() * 6, rand() * 3), S.set(sz * 1.3, sz, sz), pick(iceC)); }
    }
    return { g, body, ring };
  })();
  // Cocuy, a little pink moon circling below the road plane
  const cocuy = (() => {
    const C = MAP.planets.cocuy, tex = planetTex(256, 128, (x, y, z, lat, tmp) => { const n = fbm3(x * 4, y * 4, z * 4, 4); tmp.copy(col('#f08a8a')).lerp(col('#a85a7a'), sstep(0.4, 0.7, n)).lerp(col('#ffd0b0'), sstep(0.7, 0.85, fbm3(x * 9 + 2, y * 9, z * 9, 2)) * 0.6); });
    const m = new THREE.Mesh(new THREE.SphereGeometry(C.radius, 48, 24), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    m.castShadow = true; scene.add(m); return { m, C };
  })();

  /* ---------------- the asteroid belt ---------------- */
  const tumblers = [];
  {
    const B = MAP.belt, rc = ['#6a5a4a', '#857060', '#5a5560', '#9a7a5a', '#74675e', '#4e4a52'].map(col);
    const place = (p, s, list) => { if (roadDist3(p).d < HW0 + s * 1.15 + 4) return false; if (p.distanceTo(O) < AR.radius + s + 10) return false; push(list, p, qEuler(rand() * 6, rand() * 6, rand() * 6), S.set(s, s * rr(0.6, 0.9), s * rr(0.7, 1.1)), pick(rc)); return true; };
    for (let k = 0, t = 0; k < B.dense.count && t < B.dense.count * 6; t++) {
      const a = rr(B.dense.from, B.dense.to), r = rr(...B.dense.r), y = rr(...B.dense.y), s = rand() < 0.1 ? rr(6, 13) : rr(1.2, 5);
      if (place(polar(a, r, y), s, inst.rock)) k++;
    }
    for (let k = 0, t = 0; k < B.far.count && t < B.far.count * 4; t++) {
      const a = rand() * 360, r = rr(...B.far.r), y = rr(...B.far.y), s = rr(3, 16), p = polar(a, r, y);
      if (p.distanceTo(MC) < MR + 40) continue;
      if (place(p, s, inst.rock)) k++;
    }
    for (const gnt of B.giants) {
      let s = gnt.size; const p = polar(...gnt.polar);
      while (s > 8 && roadDist3(p).d < HW0 + s * 1.15 + 5) s *= 0.85;
      push(inst.rock, p, qEuler(rand() * 6, rand() * 6, rand() * 6), S.set(s, s * 0.8, s * 0.95), col('#7a6656'));
    }
    // the ones closest to the road slowly tumble
    const near = inst.rock.map((it, k) => { const p = new THREE.Vector3().setFromMatrixPosition(it.m); return { k, d: roadDist3(p).d }; }).sort((a, b) => a.d - b.d).slice(0, B.tumble);
    near.forEach(({ k }) => { const m = inst.rock[k].m, p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); tumblers.push({ k, p, q, s, axis: V3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize(), sp: rr(0.1, 0.45) }); });
  }

  /* ---------------- Catatumbo: the storm planet that never stops flashing ---------------- */
  const CT = MAP.planets.catatumbo, CC = polar(...CT.polar);
  const storm = (() => {
    const tex = planetTex(1024, 512, (x, y, z, lat, tmp) => {
      const w = fbm3(x * 3 + 5, y * 3, z * 3, 4) * 2.5, b = 0.5 + 0.5 * Math.sin(lat * 10 + w);
      tmp.copy(col('#1e0f4a')).lerp(col('#5a2aa8'), b).lerp(col('#c05ae0'), sstep(0.72, 0.92, fbm3(x * 6, y * 6, z * 6, 3)) * 0.55);
    });
    const g = new THREE.Group(); g.position.copy(CC); scene.add(g);
    const body = new THREE.Mesh(new THREE.SphereGeometry(CT.radius, 96, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, emissive: col('#2a1460'), emissiveIntensity: 0.8 }));
    g.add(body);
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(CT.radius * 1.015, 96, 48), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uT: uTime, uSun: { value: SUN_DIR }, uFlash: { value: 0 }, uFlashDir: { value: V3(1, 0, 0) } },
      vertexShader: `varying vec3 vP; varying vec3 vN; void main(){ vP = normalize(position); vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uT; uniform vec3 uSun; uniform float uFlash; uniform vec3 uFlashDir; varying vec3 vP; varying vec3 vN; ${NOISE_GLSL}
        void main(){
          float lat = vP.y; float sw = uT * 0.02 + lat * 2.0;
          vec3 q = vec3(vP.x * cos(sw) - vP.z * sin(sw), vP.y, vP.x * sin(sw) + vP.z * cos(sw));
          float n = fbm3(q * 4.0 + vec3(0.0, uT * 0.01, 0.0));
          float lit = 0.32 + 0.68 * max(dot(vN, uSun), 0.0);
          vec3 c = mix(vec3(0.28, 0.14, 0.55), vec3(0.78, 0.62, 0.98), smoothstep(0.45, 0.85, n)) * lit;
          float f = uFlash * pow(max(dot(vP, uFlashDir), 0.0), 60.0) * (0.6 + 0.8 * n);
          float g = uFlash * pow(max(dot(vP, uFlashDir), 0.0), 8.0) * 0.25;
          c += vec3(0.75, 0.85, 1.0) * (f * 3.0 + g);
          float a = smoothstep(0.5, 0.78, n) * 0.75 + f + g;
          gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    g.add(clouds);
    g.add(atmosphere(CT.radius * 1.04, CT.atmosphere, 3, 1.0));
    // bolts: jagged ribbons drawn over the side that faces the road
    const boltMat = new THREE.MeshBasicMaterial({ color: col('#dfe8ff'), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const bolts = [];
    for (let k = 0; k < CT.bolts; k++) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(16 * 2 * 3), 3)); const idx = []; for (let j = 0; j < 15; j++) idx.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2); geo.setIndex(idx); const m = new THREE.Mesh(geo, boltMat); m.frustumCulled = false; m.visible = false; scene.add(m); bolts.push(m); }
    const light = new THREE.PointLight(col('#bcd0ff'), 0, 1400, 1); scene.add(light);
    const toward = O.clone().sub(CC).setY(0).normalize();
    let slot = -1, flashDir = toward.clone();
    const reseed = sl => {
      let s = sl * 9301 + 49297; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const center = toward.clone().applyAxisAngle(UP, (r() - 0.5) * 1.4).add(V3(0, (r() - 0.5) * 1.0, 0)).normalize();
      flashDir.copy(center);
      bolts.forEach((m, k) => {
        const on = k < 3 + ((r() * 5) | 0); m.visible = on; if (!on) return;
        let dir = center.clone().add(V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.35)).normalize();
        const tan = new THREE.Vector3().crossVectors(dir, V3(r() - 0.5, r() - 0.5, r() - 0.5)).normalize(), p = m.geometry.attributes.position;
        for (let j = 0; j < 16; j++) {
          dir.addScaledVector(tan, 0.035).add(V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.03)).normalize();
          const c = CC.clone().addScaledVector(dir, CT.radius * 1.02 + r() * 3), side = new THREE.Vector3().crossVectors(dir, tan).normalize().multiplyScalar(1.6 * (1 - j / 16) + 0.5);
          p.setXYZ(j * 2, c.x - side.x, c.y - side.y, c.z - side.z); p.setXYZ(j * 2 + 1, c.x + side.x, c.y + side.y, c.z + side.z);
        }
        p.needsUpdate = true;
      });
      light.position.copy(CC).addScaledVector(center, CT.radius + 60);
    };
    const update = t => {
      const sl = Math.floor(t * CT.rate), ph = t * CT.rate - sl, on = hash1(sl) > 0.45;
      if (sl !== slot) { slot = sl; if (on) reseed(sl); else bolts.forEach(b => (b.visible = false)); }
      const k = on ? Math.exp(-ph * 5) * (0.75 + 0.25 * Math.sin(t * 90)) : 0;
      clouds.material.uniforms.uFlash.value = k; clouds.material.uniforms.uFlashDir.value.copy(flashDir).applyQuaternion(g.quaternion.clone().invert());
      boltMat.opacity = k; light.intensity = k * 3.2;
      g.rotation.y = t * CT.spin;
    };
    return { g, update };
  })();

  /* ---------------- Tierra de Gracia, far away; the sun; the station; satellites; a comet ---------------- */
  {
    const TG = MAP.planets.tierraDeGracia;
    const tex = planetTex(1024, 512, (x, y, z, lat, tmp) => {
      const n = fbm3(x * 2.2 + 9, y * 2.2, z * 2.2, 5), cl = fbm3(x * 5 + 1, y * 9, z * 5, 4);
      if (n > 0.53) tmp.copy(col('#3f8a3a')).lerp(col('#c8a860'), sstep(0.6, 0.72, n)).lerp(col('#2a6a2a'), sstep(0.55, 0.5, fbm3(x * 9, y * 9, z * 9, 2)) * 0.5);
      else tmp.copy(col('#0a3a8a')).lerp(col('#1aa0c8'), sstep(0.45, 0.53, n));
      tmp.lerp(col('#f4f8ff'), sstep(0.8, 0.95, Math.abs(y)) + sstep(0.55, 0.75, cl) * 0.75);
    });
    const g = new THREE.Group(); g.position.set(...TG.at); scene.add(g);
    const m = new THREE.Mesh(new THREE.SphereGeometry(TG.radius, 96, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, fog: false }));
    g.add(m); const atm = atmosphere(TG.radius * 1.04, TG.atmosphere, 2.5, 1.6); atm.material.fog = false; g.add(atm);
    scene.userData.tierra = g;
    const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col('#fff4d8'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    core.position.copy(SUN_DIR).multiplyScalar(8000); core.scale.setScalar(900); scene.add(core);
  }
  const station = (() => {
    const ST = MAP.station, g = new THREE.Group(); g.position.set(...ST.at); g.rotation.set(0.5, 0.3, 0.2); scene.add(g);
    const metal = new THREE.MeshStandardMaterial({ color: col('#d8dce8'), roughness: 0.45, metalness: 0.6 });
    const spin = new THREE.Group(); g.add(spin);
    spin.add(new THREE.Mesh(new THREE.TorusGeometry(ST.radius, 9, 12, 96), metal));
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, ST.radius * 2, 8), metal); s.rotation.z = PI / 2; s.rotation.y = k * PI / 6; spin.add(s); }
    spin.add(new THREE.Mesh(new THREE.SphereGeometry(18, 24, 16), metal));
    const lightsMat = new THREE.MeshBasicMaterial({ color: col('#ffd23a'), toneMapped: false });
    for (let k = 0; k < 24; k++) { const a = k / 24 * TAU, l = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), lightsMat); l.position.set(Math.cos(a) * ST.radius, Math.sin(a) * ST.radius, 9.5); spin.add(l); }
    const pan = new THREE.Mesh(new THREE.BoxGeometry(14, 160, 1), new THREE.MeshStandardMaterial({ color: col('#1a2a6a'), roughness: 0.3, metalness: 0.4, emissive: col('#0a1440'), emissiveIntensity: 0.5 }));
    pan.position.z = -30; g.add(pan);
    return { spin, ST };
  })();
  const satellites = [];
  for (let k = 0; k < MAP.satellites; k++) {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 4), new THREE.MeshStandardMaterial({ color: col(pick(['#e8c070', '#d8dce8', '#f2f2f2'])), metalness: 0.6, roughness: 0.4 }));
    g.add(body);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(9, 0.2, 3), new THREE.MeshStandardMaterial({ color: col('#1a3a9a'), metalness: 0.3, roughness: 0.3, emissive: col('#0a1a50'), emissiveIntensity: 0.4 })); w.position.x = s * 6.5; g.add(w); }
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: col('#ff3a3a'), toneMapped: false })); blink.position.y = 2; g.add(blink);
    g.scale.setScalar(rr(1.2, 2)); scene.add(g);
    satellites.push({ g, blink, r: rr(950, 1150), y: rr(150, 280), sp: rr(0.01, 0.025) * (rand() < 0.5 ? -1 : 1), ph: rand() * TAU, tilt: rr(-0.15, 0.15) });
  }
  const comet = (() => {
    const g = new THREE.Group(); scene.add(g);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col('#bfefff'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); head.scale.setScalar(140); g.add(head);
    const tailGeo = new THREE.ConeGeometry(40, 900, 16, 1, true); tailGeo.translate(0, -450, 0);
    const tail = new THREE.Mesh(tailGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: `varying float vY; void main(){ vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vY; void main(){ float a = 0.35 * smoothstep(-900.0, 0.0, vY); gl_FragColor = vec4(vec3(0.6, 0.9, 1.0) * a, a); }` }));
    g.add(tail); g.visible = false;
    return { g, tail };
  })();

  /* ---------------- the wormhole: a glowing tube round the road, portals at both ends ---------------- */
  const [w0, w1] = segRange('g');
  const wormhole = (() => {
    const pos = [], uv = [], idx = [], N = 36; let rows = 0, dist = 0, prev = null;
    for (let i = w0 - 6; i <= w1 + 6; i += 2) {
      const f = roadFrame(i), c = roadAt(i, 0, 5);
      if (prev) dist += c.distanceTo(prev); prev = c;
      for (let k = 0; k <= N; k++) { const a = k / N * TAU, q = c.clone().addScaledVector(f.n, Math.cos(a) * 16).add(V3(0, Math.sin(a) * 13, 0)); pos.push(q.x, q.y, q.z); uv.push(k / N, dist); }
      if (rows) { const a = (rows - 1) * (N + 1), b = rows * (N + 1); for (let k = 0; k < N; k++) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1); }
      rows++;
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const tube = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uT: uTime, uLen: { value: dist } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uT; uniform float uLen; varying vec2 vUv; void main(){
        float a = vUv.x, s = vUv.y;
        float sw = fract(s * 0.025 - uT * 0.9 + a * 2.0);
        float rings = smoothstep(0.0, 0.12, sw) * smoothstep(0.45, 0.12, sw);
        float streak = pow(0.5 + 0.5 * sin(a * 6.2831 * 9.0 + s * 0.06 - uT * 4.0), 8.0);
        vec3 c = mix(vec3(1.0, 0.3, 0.85), vec3(0.25, 0.8, 1.0), 0.5 + 0.5 * sin(s * 0.02 + uT * 0.7));
        c = mix(c, vec3(1.0, 0.82, 0.25), streak * 0.7);
        float floorFade = smoothstep(0.62, 0.78, a) * smoothstep(0.88, 0.78, a);
        float ends = smoothstep(0.0, 30.0, s) * smoothstep(uLen, uLen - 30.0, s);
        float alpha = (0.1 + rings * 0.35 + streak * 0.3) * (1.0 - floorFade * 0.85) * (0.3 + 0.7 * ends);
        gl_FragColor = vec4(c * alpha, alpha); }`,
    }));
    tube.renderOrder = 4; tube.name = 'cosmos-wormhole'; scene.add(tube);
    const portalMat = new THREE.MeshBasicMaterial({ color: col('#ff4fd8'), toneMapped: false });
    const portals = [w0 - 4, w1 + 4].map(i => {
      const f = roadFrame(i), c = roadAt(i, 0, 5), g = new THREE.Group();
      g.position.copy(c); g.quaternion.copy(qBasis(f.n, UP, f.t.clone().negate())); scene.add(g);
      const t1 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 10, 64), portalMat); t1.scale.set(16.5, 13.5, 16); g.add(t1);
      const t2 = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 8, 64), new THREE.MeshBasicMaterial({ color: col('#7ae8ff'), toneMapped: false })); t2.scale.set(18.5, 15.5, 16); g.add(t2);
      return g;
    });
    // light streaks rushing through
    const n = 260, pts = new Float32Array(n * 3), seeds = [];
    for (let k = 0; k < n; k++) seeds.push({ u: rand(), a: rand() * TAU, r: rr(6, 14), sp: rr(0.05, 0.12) });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const motes = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex, color: col('#ffe8ff'), size: 1.4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    motes.frustumCulled = false; scene.add(motes);
    return { tube, portals, motes, seeds };
  })();

  /* ---------------- hoops over the road, the start arch, the base ---------------- */
  {
    const every = MAP.hoops.every;
    for (let i = 0; i < NR; i += every) {
      if (Math.abs(wrap(i - i0 + NR / 2) - NR / 2) < 50) continue;
      if (i > w0 - 20 && i < w1 + 20) continue;
      const f = roadFrame(i), c = roadAt(i, 0, 0), hw = hwA[i] + 1.5;
      const q = qBasis(f.n, UP, new THREE.Vector3().crossVectors(f.n, UP)).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), bank[i]));
      push(inst.hoop, c, q, S.set(hw, hw * 0.9, hw), GLOW[SEG[i]].clone().multiplyScalar(1.5));
    }
  }
  // start: checkered line, and an arch in yellow, blue and red with eight white stars
  {
    const f = startFrame, q = qBasis(f.n, UP, new THREE.Vector3().crossVectors(f.n, UP));
    const lineTex = canvasTex(256, 32, (c, w, h) => { for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { c.fillStyle = ((x + y) / 16) % 2 ? '#151515' : '#f2f2f2'; c.fillRect(x, y, 16, 16); } });
    const line = new THREE.Mesh(new THREE.PlaneGeometry(MAP.road.width, 1.6), new THREE.MeshStandardMaterial({ map: lineTex, polygonOffset: true, polygonOffsetFactor: -5 }));
    line.position.copy(roadAt(i0, 0, 0.17)); line.quaternion.copy(q); line.rotateX(-PI / 2); line.receiveShadow = true; scene.add(line);
    const arch = new THREE.Group(); arch.position.copy(roadAt(i0, 0, 0)); arch.quaternion.copy(q); scene.add(arch);
    [['#ffd23a', HW0 + 4.2], ['#1f4fd8', HW0 + 3.1], ['#e0263a', HW0 + 2.0]].forEach(([c, r]) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.55, 12, 80, PI), new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.4, metalness: 0.2, emissive: col(c), emissiveIntensity: 0.35 }));
      m.castShadow = true; arch.add(m);
      for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 4, 12), m.material); leg.position.set(s * r, -2, 0); arch.add(leg); }
    });
    const star = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = PI / 2 + k * PI / 5, r = k % 2 ? 0.42 : 1; k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const starGeo = new THREE.ExtrudeGeometry(star, { depth: 0.25, bevelEnabled: false }); starGeo.translate(0, 0, -0.125);
    const starMat = new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false });
    for (let k = 0; k < 8; k++) { const a = PI * (0.18 + 0.64 * k / 7), r = HW0 + 3.1, s = new THREE.Mesh(starGeo, starMat); s.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.7); s.scale.setScalar(0.62); arch.add(s); const b = s.clone(); b.position.z = -0.7; arch.add(b); }
  }
  // the moon base, from MAP.base
  const blinkers = [], spinners = [];
  {
    const white = new THREE.MeshStandardMaterial({ color: col('#eef0f6'), roughness: 0.5, metalness: 0.15 });
    const steel = new THREE.MeshStandardMaterial({ color: col('#9aa2b4'), roughness: 0.4, metalness: 0.6 });
    const glass = new THREE.MeshStandardMaterial({ color: col('#bfe8ff'), roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false });
    const ground = (along, lat) => { const p = atBase(along, lat); p.y = moonH(p.x, p.z); return p; };
    const yaw = yawOf(startFrame.t);
    const add = (m, p, s = 1, ry = yaw) => { m.position.copy(p); m.scale.multiplyScalar(s); m.rotation.y = ry; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(m); return m; };
    for (const b of MAP.base) {
      if (b.kind === 'domo') {
        const g = new THREE.Group(), dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, PI / 2), white); g.add(dome);
        const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 48), new THREE.MeshStandardMaterial({ color: col('#1f4fd8'), emissive: col('#1f4fd8'), emissiveIntensity: 0.4 })); band.rotation.x = PI / 2; band.position.y = 0.18; g.add(band);
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.2), new THREE.MeshStandardMaterial({ color: col('#ffd23a'), emissive: col('#ffb020'), emissiveIntensity: 0.6 })); door.position.set(0, 0.16, 0.95); g.add(door);
        const win = new THREE.MeshBasicMaterial({ color: col('#ffe8a0'), toneMapped: false });
        for (let k = 0; k < 6; k++) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.05), win), a = k / 6 * TAU + 0.5; w.position.set(Math.sin(a) * 0.86, 0.45, Math.cos(a) * 0.86); w.rotation.y = a; g.add(w); }
        add(g, ground(...b.at).add(V3(0, -0.4, 0)), b.scale);
      } else if (b.kind === 'tubo') {
        const a = ground(...b.from), c = ground(...b.to), len = a.distanceTo(c), m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, len, 16), white);
        m.position.copy(a).lerp(c, 0.5).add(V3(0, 1.4, 0)); m.quaternion.setFromUnitVectors(UP, c.clone().sub(a).normalize()); m.castShadow = true; m.receiveShadow = true; scene.add(m);
      } else if (b.kind === 'invernadero') {
        const p = ground(...b.at), g = new THREE.Group();
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, TAU, 0, PI / 2), glass); g.add(dome);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 8, 48), steel); ring.rotation.x = PI / 2; g.add(ring);
        for (let k = 0; k < 6; k++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 32, PI), steel); rib.rotation.y = k * PI / 6; g.add(rib); }
        const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 0.97, 0.06, 32), new THREE.MeshStandardMaterial({ color: col('#4a3426'), roughness: 1 })); g.add(soil);
        add(g, p.clone().add(V3(0, -0.2, 0)), b.scale);
        // frailejones: woolly Andean rosettes on stubby trunks, swaying in the greenhouse fans
        for (let k = 0; k < 16; k++) {
          const a = rand() * TAU, r = Math.sqrt(rand()) * b.scale * 0.72, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, y = p.y - 0.1, h = rr(0.8, 2.4) * (1 - r / (b.scale * 1.1));
          push(inst.trunk, V3(x, y, z), qYaw(rand() * TAU), S.set(0.22, h, 0.22), col('#6a5236'));
          for (let j = 0; j < 14; j++) push(inst.frond, V3(x, y + h, z), qEuler(rr(-1.0, -0.3), j / 14 * TAU + rr(-0.2, 0.2), 0), S.set(0.35, rr(0.8, 1.2), rr(0.8, 1.2)), col('#b9c4a0').offsetHSL(0, 0, rr(-0.06, 0.06)));
          if (rand() < 0.6) push(inst.sphere, V3(x + rr(-0.3, 0.3), y + h + rr(0.6, 1.0), z + rr(-0.3, 0.3)), Q, S.set(0.14, 0.14, 0.14), col('#ffd23a'));
        }
      } else if (b.kind === 'plataforma') {
        const p = ground(...b.at), pad = new THREE.Mesh(new THREE.CylinderGeometry(b.scale, b.scale * 1.05, 0.8, 48), steel); add(pad, p.clone().add(V3(0, 0.1, 0)));
        const mark = new THREE.Mesh(new THREE.RingGeometry(b.scale * 0.55, b.scale * 0.68, 48), new THREE.MeshBasicMaterial({ color: col('#ffd23a'), toneMapped: false })); mark.rotation.x = -PI / 2; mark.position.copy(p).add(V3(0, 0.52, 0)); scene.add(mark);
        for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; push(inst.light, p.clone().add(V3(Math.cos(a) * b.scale * 0.95, 0.6, Math.sin(a) * b.scale * 0.95)), Q, S.set(0.3, 0.3, 0.3), col('#7ae8ff')); }
      } else if (b.kind === 'radar') {
        const p = ground(...b.at), g = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8), steel); pole.position.y = 0.6; g.add(pole);
        const head = new THREE.Group(); head.position.y = 1.2; g.add(head);
        const dish = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 12, 0, TAU, 0, PI / 3.5), white); dish.rotation.x = -PI / 2 - 0.5; head.add(dish);
        add(g, p, b.scale); spinners.push({ o: head, sp: 0.4 });
      } else if (b.kind === 'antena') {
        const p = ground(...b.at), g = new THREE.Group();
        for (let k = 0; k < 4; k++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 1, 4), steel), a = k * PI / 2 + PI / 4; leg.position.set(Math.cos(a) * 0.04, 0.5, Math.sin(a) * 0.04); leg.rotation.set(Math.sin(a) * 0.05, 0, -Math.cos(a) * 0.05); g.add(leg); }
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: col('#ff3a3a'), toneMapped: false })); tip.position.y = 1.02; g.add(tip);
        add(g, p, b.scale); blinkers.push({ o: tip, ph: 0 });
      } else if (b.kind === 'paneles') {
        const f = startFrame;
        for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
          const p = ground(b.at[0] + c * 6, b.at[1] + Math.sign(b.at[1]) * r * 5);
          push(inst.box, p.clone().add(V3(0, 1.0, 0)), qYaw(yaw).multiply(qEuler(-0.55, 0, 0)), S.set(5, 0.12, 3.4), col('#1a3a9a'));
          push(inst.box, p.clone().add(V3(0, 0.5, 0)), Q, S.set(0.15, 1.0, 0.15), col('#9aa2b4'));
        }
        void f;
      } else if (b.kind === 'rover') {
        const p = ground(...b.at), g = new THREE.Group(), bodyM = new THREE.MeshStandardMaterial({ color: col('#ffd23a'), roughness: 0.5 });
        const bd = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 3.6), bodyM); bd.position.y = 1.2; g.add(bd);
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.9, 1.6), glass); cab.position.set(0, 2.0, 0.6); g.add(cab);
        for (const sx of [-1.4, 1.4]) for (const sz of [-1.2, 0, 1.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 14), new THREE.MeshStandardMaterial({ color: col('#2a2a30'), roughness: 0.9 })); w.rotation.z = PI / 2; w.position.set(sx, 0.5, sz); g.add(w); }
        add(g, p, 1, yaw + (b.rot || 0));
      } else if (b.kind === 'chiguire') {
        // a capybara astronaut statue on a pedestal, the base's mascot
        const p = ground(...b.at), g = new THREE.Group(), fur = new THREE.MeshStandardMaterial({ color: col('#9a6a42'), roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: col('#3a2618'), roughness: 0.8 });
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.2, 24), steel); ped.position.y = 0.6; g.add(ped);
        const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), fur); body.scale.set(0.75, 0.62, 1.0); body.position.y = 1.75; g.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), fur); head.scale.set(0.42, 0.42, 0.62); head.position.set(0, 2.35, 0.82); g.add(head);
        const snout = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), fur); snout.scale.set(0.34, 0.3, 0.3); snout.position.set(0, 2.25, 1.28); g.add(snout);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dark); nose.position.set(0, 2.33, 1.57); g.add(nose);
        for (const s of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), dark); ear.position.set(s * 0.26, 2.72, 0.62); g.add(ear);
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), dark); eye.position.set(s * 0.25, 2.47, 1.12); g.add(eye);
          for (const z of [-0.5, 0.5]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 10), fur); leg.position.set(s * 0.42, 1.3, z); g.add(leg); }
        }
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.78, 24, 16), glass); helmet.position.set(0, 2.42, 0.95); g.add(helmet);
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.5), white); pack.position.set(0, 2.25, -0.5); g.add(pack);
        add(g, p, b.scale, yaw + PI * 0.75);
      }
    }
  }

  /* ---------------- flush ---------------- */
  const rockMesh = flush(inst.rock, rockGeo, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.95, flatShading: true }));
  flush(inst.ice, rockGeo, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.35, metalness: 0.05, flatShading: true, emissive: col('#2a2418'), emissiveIntensity: 0.4 }));
  { const g = new THREE.TorusGeometry(1, 0.035, 6, 40, PI); flush(inst.hoop, g, new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false }), false); }
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.35, metalness: 0.4 }));
  flush(inst.light, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: col('#ffffff'), toneMapped: false }), false);
  flush(inst.sphere, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, emissive: col('#3a2a00'), emissiveIntensity: 0.4 }), false);
  { const g = new THREE.CylinderGeometry(0.8, 1, 1, 7); g.translate(0, 0.5, 0); flush(inst.trunk, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1 })); }
  {
    const g = new THREE.PlaneGeometry(1, 1, 1, 6); g.translate(0, 0.5, 0);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, y * y * 0.5); }
    g.rotateX(-PI / 2 + 0.3); g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: frondTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 });
    mat.onBeforeCompile = sh => { sh.uniforms.uTime = uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = instanceMatrix[3].xyz; float sw = sin(uTime * 1.6 + ip.x * 0.7 + ip.z * 0.5) * 0.5 + sin(uTime * 3.1 + ip.z) * 0.2;
      float k = max(position.y + position.z, 0.0) * 0.12; transformed.x += sw * k; transformed.z += sw * k * 0.6;`); };
    flush(inst.frond, g, mat, false);
  }

  /* ---------------- per-frame updates ---------------- */
  const fogC = new THREE.Color(), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
  const wormZone = cp => { const r = roadDist3(cp); return r.i >= 0 && SEG[r.i] === 'g' ? 1 - sstep(10, 20, r.d) : 0; };
  let lastComet = -1;
  function update(t, dt, racerS = null) {
    uTime.value = t;
    araguaney.g.rotation.y = t * AR.spin;
    { const C = cocuy.C, a = C.orbit.phase + t * C.orbit.speed; cocuy.m.position.set(O.x + Math.cos(a) * C.orbit.r, C.orbit.y, O.z + Math.sin(a) * C.orbit.r); cocuy.m.rotation.y = t * 0.05; }
    tumblers.forEach(tb => { qq.setFromAxisAngle(tb.axis, t * tb.sp).multiply(tb.q); m4.compose(tb.p, qq, tb.s); rockMesh.setMatrixAt(tb.k, m4); });
    rockMesh.instanceMatrix.needsUpdate = true;
    storm.update(t);
    // wormhole streaks
    { const p = wormhole.motes.geometry.attributes.position, span = w1 - w0; wormhole.seeds.forEach((s, k) => { if (k >= wormhole.motes.geometry.drawRange.count) return; const u = (s.u + t * s.sp) % 1, i = w0 + Math.floor(u * span), f = roadFrame(i), c = roadAt(i, 0, 5); p.setXYZ(k, c.x + f.n.x * Math.cos(s.a + t) * s.r, c.y + Math.sin(s.a + t) * s.r * 0.8, c.z + f.n.z * Math.cos(s.a + t) * s.r); }); p.needsUpdate = true; }
    wormhole.portals.forEach((g, k) => (g.children[1].rotation.z = t * (k ? -0.6 : 0.6)));




    blinkers.forEach(b => (b.o.visible = Math.sin(t * 3 + b.ph) > 0.2));
    spinners.forEach(s => (s.o.rotation.y = t * s.sp));
    station.spin.rotation.z = t * station.ST.spin;
    satellites.forEach(s => { const a = s.ph + t * s.sp; s.g.position.set(O.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r * s.tilt, O.z + Math.sin(a) * s.r); s.g.rotation.y = -a; s.blink.visible = Math.sin(t * 4 + s.ph) > 0.6; });
    // a comet crosses the sky now and then
    {
      const every = MAP.comet.every, k = Math.floor(t / every), ph = (t / every) - k;
      if (k !== lastComet) { lastComet = k; const a = hash1(k) * TAU, e = 0.25 + hash1(k + 7) * 0.4; comet.g.userData = { from: V3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(MAP.comet.distance), dir: V3(Math.cos(a + 1.4), -0.15, Math.sin(a + 1.4)).normalize() }; }
      const u = comet.g.userData; comet.g.visible = ph < 0.35;
      if (comet.g.visible) { comet.g.position.copy(u.from).addScaledVector(u.dir, ph * 4200); comet.tail.quaternion.setFromUnitVectors(UP, u.dir.clone().negate()); }
    }

  }


  return ownReferenceWorld(scene, moonH, referenceDetail(scene, update, mapDetail), createdTextures);
}
