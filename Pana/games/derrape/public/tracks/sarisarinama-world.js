import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { coastalVegetation } from './coastal-vegetation.js';
import { MAP } from './sarisarinama-layout.js';

// Sarisariñama: a spiral road down the wall of a tepuy sinkhole, the lost
// jungle at its floor, galleries with a lake and rimstone pools under the
// rock, and a switchback climb out of the second sima.
export function createWorld(scene, layout, roadDistance) {
  const vegetation = coastalVegetation(scene, 1, roadDistance);
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const rand = rng(MAP.seed % 2147483646);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const d = new THREE.Object3D();
  const uTime = { value: 0 };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const noRay = o => { o.raycast = () => {}; return o; };

  const { W0, CX, CZ, SIZE, HALF, TOP, HUM, MAR, SPI, HW0, C1, C2, RD, RN, toLocal2, local2, plateauH, spR, spY, spAng,
    poolXZ, natural, E, lowland, mesaE, farH, RMP, LEGS, NL, NR, SEG, CAVE_SEG, isCave, hwL, hwR, roadY, bank, roadFrame,
    c0, c1, g0, GN, gY0, gY1, gLen, roadAt, idxNear, X0, Z0, sampleR, RR, CR, terrainH, cave, caveW, caveH, LAKE, lake0, lake1,
    inLake, groundH, physicalGround, roadSampleAt } = layout;
  const SUN_DIR = new THREE.Vector3(...MAP.sun.dir).normalize();
  const roadDist = (x, z) => sampleR(RR, x, z).dist;

  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const asphaltTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#9a9a9c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(40,40,44,${rr(0.05, 0.18).toFixed(2)})` : `rgba(255,255,250,${rr(0.04, 0.14).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(30,30,34,0.12)'; c.fillRect(rr(20, w - 80), rr(0, h), rr(30, 70), rr(20, 60)); }
    c.strokeStyle = 'rgba(40,40,44,0.35)'; c.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { c.beginPath(); let x = rr(30, w - 30), y = rr(0, h); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rr(-12, 12); y += rr(8, 22); c.lineTo(x, y); } c.stroke(); }
    c.fillStyle = 'rgba(250,248,236,0.9)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#f3c63a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const frondTex = canvasTex(128, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#ffffff'; c.lineCap = 'round';
    c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 6); c.stroke();
    for (let y = h - 20; y > 20; y -= 13) {
      const len = (w / 2 - 6) * Math.sin(PI * (1 - y / h) * 0.95 + 0.15);
      c.lineWidth = 7;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + s * len * 0.6, y - 10, w / 2 + s * len, y - 26); c.stroke(); }
    }
  });
  const grassTex = canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rr(8, w - 8), lean = rr(-18, 18), top = rr(10, 60);
      c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - 4, h); c.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); c.lineTo(x + 4, h); c.fill();
    }
  });
  const cloudTex = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
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
        float sw = sin(uTime * 1.25 + ip.x * 0.06 + ip.z * 0.045) * 0.6 + sin(uTime * 2.9 + ip.x * 0.17 - ip.z * 0.11) * 0.25;
        float k = ${base.toFixed(3)} + max(position.y, 0.0) * ${perY.toFixed(3)};
        transformed.x += sw * k; transformed.z += sw * k * 0.55;`);
    };
    return mat;
  }

  /* ---------------- terrain ---------------- */
  const cTop = col('#3c5a2e'), cTop2 = col('#6a7240'), cBlack = col('#2a2826'), cWet = col('#2e4232');
  const cSand = col('#a87a5a'), cPink = col('#ba8c78'), cStreak = col('#221e1c'), cMoss = col('#3e6a2a');
  const cFloor = col('#2e5c24'), cLitter = col('#5c4a2c'), cVerge = col('#6a6a5a');
  const cLow = col('#2c5a2a'), cLow2 = col('#3f7a32');
  function paintGround(x, z, y, slope, tmp, plateau, coarse) {
    const n1 = coarse ? 0.5 : 0.5 + 0.5 * Math.sin(x * 0.09 + Math.sin(z * 0.05) * 3) * Math.cos(z * 0.08 - x * 0.03);
    const n2 = 0.5 + 0.5 * Math.sin(x * 0.031 + Math.sin(z * 0.023) * 2.1) * Math.sin(z * 0.029 - Math.sin(x * 0.019) * 1.7);
    if (y < -150) tmp.copy(cLow).lerp(cLow2, n1 * 0.7);
    else {
      tmp.copy(cTop).lerp(cTop2, n1 * 0.55).lerp(cBlack, sstep(0.6, 0.85, n2) * (coarse ? 0.45 : 0.8)).lerp(cWet, sstep(0.32, 0.1, n2) * 0.5);
      const depth = sstep(plateau - 12, plateau - 34, y);
      tmp.lerp(cFloor.clone().lerp(cLitter, sstep(0.55, 0.9, n1) * 0.6), depth);
    }
    const cliff = sstep(0.32, 0.68, slope);
    if (cliff > 0) {
      const band = 0.5 + 0.5 * Math.sin(y * 0.33 + Math.sin(x * 0.05 + z * 0.04) * 2);
      const streak = sstep(0.5, 0.92, 0.5 + 0.5 * Math.sin(x * 0.47 + z * 0.39 + Math.sin(y * 0.04) * 1.5) * Math.sin(x * 0.13 - z * 0.17));
      const wall = cSand.clone().lerp(cPink, band * 0.7).lerp(cStreak, streak * 0.85);
      tmp.lerp(wall, cliff);
    } else tmp.lerp(cMoss, sstep(0.18, 0.3, slope) * 0.5);
    return tmp;
  }
  const GRS = Math.round(SIZE / W0.cell);
  const terrainMesh = (() => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, GRS, GRS);
    geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
      paintGround(x, z, y, 1 - nrm.getY(i), tmp, plateauH(x, z));
      const r = sampleR(RR, x, z);
      if (r.i >= 0 && Math.abs(y - roadY[r.i]) < 3) tmp.lerp(cVerge, (1 - sstep(HW0 - 0.5, HW0 + 2.5, r.dist)) * 0.6);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // back faces into the shadow map: walls still shade the floors, flat ground does not shade itself
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, shadowSide: THREE.BackSide }));
    m.castShadow = true; m.receiveShadow = true; m.name = 'sarisarinama-terrain'; scene.add(m);
    return m;
  })();
  // the far land: the rest of the tepuy, its cliffs, the lowland jungle and the other tepuyes
  {
    const F = W0.far, geo = new THREE.PlaneGeometry(F.size, F.size, F.segs, F.segs); geo.rotateX(-PI / 2); geo.translate(CX, 0, CZ);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, farH(pos.getX(i), pos.getZ(i)) - 0.6);
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); paintGround(x, z, pos.getY(i), 1 - nrm.getY(i), tmp, plateauH(x, z), true); colors.set([tmp.r, tmp.g, tmp.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // the part under the detailed square sinks out of sight; a band at its edge stays at plateau height
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), ix = Math.abs(x - CX), iz = Math.abs(z - CZ);
      if (ix < HALF && iz < HALF && Math.min(HALF - ix, HALF - iz) >= 32) pos.setY(i, -300);
      else if (ix < HALF && iz < HALF) pos.setY(i, pos.getY(i) - 1);
    }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true; m.name = 'sarisarinama-far-land'; noRay(m); scene.add(m);
  }

  /* ---------------- road surface and its skirts ---------------- */
  function stripMesh(rows, mat, vScale, closed, colors, cast = false) {
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
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = cast; scene.add(m);
    return m;
  }
  const ROAD = new THREE.MeshStandardMaterial({ map: asphaltTex, vertexColors: true, roughness: 0.82, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  {
    const rows = [], colors = [], tints = Object.fromEntries(Object.entries(MAP.road.tint).map(([k, v]) => [k, col(v)]));
    for (let i = 0; i < NR; i++) {
      const c = new THREE.Color(0, 0, 0); let n = 0;
      for (let j = -12; j <= 12; j++) { c.add(tints[SEG[(i + j + NR) % NR]] || tints.b); n++; }
      c.multiplyScalar(1 / n);
      rows.push({ a: roadAt(i, -hwL[i], 0.12), b: roadAt(i, hwR[i], 0.12) });
      colors.push(c);
    }
    stripMesh(rows, ROAD, 20, true, colors).name = 'sarisarinama-road';
    // skirts: rock under both road edges, a stone causeway across the lake
    const SKIRT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const sr = [], sc = [], out = col('#4a4642'), stone = col('#8a8070');
      for (let i = 0; i < NR; i++) {
        const lakeHere = inLake(i), cv = isCave(i), lat = side * (side > 0 ? hwR[i] : hwL[i]);
        const top = roadAt(i, lat, 0.11), bot = roadAt(i, lat + side * (lakeHere ? 2.6 : 0.7), lakeHere ? -(roadY[i] - LAKE.bed + 0.4) : -2.6);
        sr.push({ a: top, b: bot }); sc.push(cv ? stone : out);
      }
      stripMesh(sr, SKIRT, 20, true, sc);
    }
  }

  /* ---------------- water materials ---------------- */
  const waterMats = [];
  // ribbons of water: flat flow on the ground, falling streaks where the water drops (per-vertex `steep`)
  function flowMaterial(opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR }, uA: { value: opts.alpha ?? 0.85 }, uDeep: { value: col(opts.deep || '#3a2510') }, uShallow: { value: col(opts.shallow || '#a8642a') } }]),
      vertexShader: `
        attribute float steep; attribute float foam; attribute float onroad;
        varying vec2 vUv; varying float vSteep; varying float vFoam; varying float vRoad; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){
          vUv = uv; vSteep = steep; vFoam = foam; vRoad = onroad; vW = (modelMatrix * vec4(position,1.0)).xyz;
          vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uT; uniform vec3 uSun; uniform float uA; uniform vec3 uDeep; uniform vec3 uShallow;
        varying vec2 vUv; varying float vSteep; varying float vFoam; varying float vRoad; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          float flow = vUv.y - uT * (0.9 + vSteep * 2.6);
          float a = sin(vUv.x * 14.0 + sin(vUv.y * 0.35 + uT) * 2.0 + flow * 1.3);
          float b = sin(vUv.x * 5.0 - flow * 2.0 + sin(vUv.y * 0.2) * 3.0);
          float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
          vec3 c = mix(uDeep, uShallow, 0.45 + 0.3 * a) + smoothstep(0.6, 1.0, a * 0.5 + b * 0.5) * 0.1;
          vec3 V = normalize(cameraPosition - vW);
          float spec = pow(max(dot(reflect(-uSun, normalize(vec3(a * 0.08, 1.0, b * 0.08))), V), 0.0), 90.0);
          c += vec3(1.0, 0.95, 0.8) * spec * 1.2;
          c = mix(c, vec3(0.97, 0.98, 0.95), clamp(vFoam * (0.7 + 0.3 * b), 0.0, 1.0));
          float alpha = uA * (0.5 + 0.5 * edge);
          // falling water: fine vertical streaks racing down, white
          float y = vUv.y * 1.4 - uT * 2.4;
          float s1 = sin(vUv.x * 60.0 + sin(vUv.x * 13.0) * 4.0);
          float s2 = sin(vUv.x * 21.0 + y * 0.35) * sin(y * 1.7 + vUv.x * 9.0);
          float st = smoothstep(0.15, 0.95, s1 * 0.55 + s2 * 0.45);
          vec3 fc = mix(vec3(0.82, 0.86, 0.84), vec3(1.0), 0.4 + 0.6 * st);
          float fa = uA * (0.5 + 0.5 * st) * smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
          c = mix(c, fc, vSteep); alpha = mix(alpha, fa, vSteep);
          c = mix(c, vec3(0.78, 0.88, 0.9), vRoad * 0.7); alpha *= mix(1.0, 0.45, vRoad);
          gl_FragColor = vec4(c, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -3,
    });
    waterMats.push(m);
    return m;
  }
  // rows: { c: centre, side: unit vector across, w: half width, steep, foam, onroad }
  function ribbon(rows, mat, vScale = 0.22) {
    const pos = [], uv = [], st = [], fo = [], ro = [], idx = [];
    let dist = 0;
    rows.forEach((r, i) => {
      if (i) dist += r.c.distanceTo(rows[i - 1].c);
      for (const s of [-1, 1]) { const v = r.c.clone().addScaledVector(r.side, s * r.w); pos.push(v.x, v.y, v.z); uv.push((s + 1) / 2, dist * vScale); st.push(r.steep || 0); fo.push(r.foam || 0); ro.push(r.onroad || 0); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('steep', new THREE.Float32BufferAttribute(st, 1));
    geo.setAttribute('foam', new THREE.Float32BufferAttribute(fo, 1));
    geo.setAttribute('onroad', new THREE.Float32BufferAttribute(ro, 1));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; noRay(m); scene.add(m);
    return m;
  }
  // round still pools: deep blue in the middle, turquoise at the rim, a little sparkle
  const poolMat = (deep, rim) => {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR }, uDeep: { value: col(deep) }, uRim: { value: col(rim) } }]),
      vertexShader: `varying vec2 vUv; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uRim; varying vec2 vUv; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          vec3 c = mix(uDeep, uRim, smoothstep(0.25, 1.0, r));
          float a = sin(vW.x * 1.3 + uT * 1.1 + sin(vW.z * 0.9) * 2.0) * sin(vW.z * 1.1 - uT * 0.8);
          vec3 V = normalize(cameraPosition - vW);
          float spec = pow(max(dot(reflect(-uSun, normalize(vec3(a * 0.05, 1.0, a * 0.04))), V), 0.0), 140.0);
          c += vec3(1.0, 0.95, 0.85) * spec * 1.5;
          float fres = pow(1.0 - max(V.y, 0.0), 3.0); c = mix(c, vec3(0.8, 0.9, 0.92), fres * 0.35);
          c = mix(c, vec3(0.95, 1.0, 0.97), smoothstep(0.9, 1.0, r) * 0.6);
          gl_FragColor = vec4(c, mix(0.96, 0.7, smoothstep(0.85, 1.0, r)));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true,
    });
    waterMats.push(m);
    return m;
  };
  const DISC = new THREE.CircleGeometry(1, 40); DISC.rotateX(-PI / 2);
  { const uv = DISC.attributes.uv, p = DISC.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getZ(i) * 0.5 + 0.5); }
  const addPool = (x, y, z, rx, rz, yaw, mat) => { const m = new THREE.Mesh(DISC, mat); m.position.set(x, y, z); m.scale.set(rx, 1, rz); m.rotation.y = yaw; m.renderOrder = 1; noRay(m); scene.add(m); return m; };

  /* ---------------- materials and instance buffers ---------------- */
  const FROND = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: frondTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), 0.0, 0.05);
  const GRASS = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0.0, 0.16);
  const CANOPY = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }), 0.04, 0.025);
  const ROCK = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true });
  const SMOOTH = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.75 });
  const VINE = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9 }), 0.0, 0.0);

  const frondGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -Math.sin(y * 1.6) * 0.25 + y * y * 0.55); p.setY(i, y * (1 - y * 0.25)); }
    g.rotateX(-PI / 2 + 0.25); g.computeVertexNormals();
    return g;
  })();
  const grassGeo = (() => {
    const a = new THREE.PlaneGeometry(1, 1, 1, 2); a.translate(0, 0.5, 0);
    const b = a.clone(); b.rotateY(PI / 2);
    const g = new THREE.BufferGeometry();
    const pa = a.attributes.position.array, pb = b.attributes.position.array;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...pa, ...pb], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([...a.attributes.uv.array, ...b.attributes.uv.array], 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pa.length + pb.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    const ia = [...a.index.array], off = a.attributes.position.count;
    g.setIndex([...ia, ...ia.map(v => v + off)]);
    return g;
  })();

  const inst = { bushBlob: [], frond: [], grass: [], rock: [], boulder: [], flower: [], cyl: [], vine: [], drip: [], mite: [], rim: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const yawOf = v => Math.atan2(v.x, v.z);
  const between = (a, b, r, list, color) => { const dir = b.clone().sub(a), len = dir.length(); push(list, a, new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()), S.set(r, len, r), color); };

  const JUNGLE = ['#2f8a22', '#3a9c26', '#24701d', '#2c7f2a', '#4aa430', '#1f6a2a'].map(col);
  const FLOWERS = ['#ff3d5a', '#ff8a1f', '#ffd23a', '#ffffff', '#c45cff'].map(col);

  // Trees come from the shared library: the low gnarled forest of the top is
  // a small mango-like crown, the lost jungle at the floor ceibas, the giant
  // ferns the library tree fern.
  const plant = (species, x, z, scale) => vegetation.add(species, x, z, groundH(x, z), scale, roadDist(x, z));
  const tepuiTree = (x, z) => plant(rand() < 0.15 ? 'fir' : 'mango', x, z, rr(0.42, 0.62));
  const jungleTree = (x, z, big) => plant(big ? 'tree' : 'mango', x, z, big ? rr(1.1, 1.4) : rr(0.9, 1.2));
  const emergent = (x, z) => plant('tree', x, z, rr(1.6, 1.9));
  const treeFern = (x, z, k = 1) => plant('fern', x, z, k);
  function fern(x, z, s = 1, colr) {
    const y = groundH(x, z), gc = colr || col('#4fa83a').offsetHSL(rr(-0.03, 0.04), 0, rr(-0.08, 0.05));
    for (let k = 0; k < 7; k++) push(inst.frond, V3(x, y, z), qEuler(rr(-0.6, -0.2), k / 7 * TAU + rr(-0.2, 0.2), 0), S.set(s * rr(0.7, 0.9), s * rr(1.4, 2.2), s * rr(1.4, 2.2)), gc);
  }
  function bush(x, z, s = 1, flowers = true) {
    const y = groundH(x, z), basec = pick(JUNGLE);
    for (let k = 0; k < 3; k++) { const a = rand() * TAU, r = rr(0, 1.2) * s, sc = s * rr(1.1, 1.7); push(inst.bushBlob, V3(x + Math.cos(a) * r, y + sc * 0.45, z + Math.sin(a) * r), qEuler(rand(), rand() * TAU, 0), S.set(sc, sc * 0.75, sc), basec.clone().offsetHSL(0, 0, rr(-0.05, 0.05))); }
    if (flowers && rand() < 0.45) { const fc = pick(FLOWERS); for (let k = 0; k < 6; k++) { const a = rand() * TAU, r = rr(0.6, 1.6) * s; push(inst.flower, V3(x + Math.cos(a) * r, y + s * rr(0.9, 1.6), z + Math.sin(a) * r), Q, S.set(0.26, 0.26, 0.26), fc); } }
  }
  // bromelia: a stiff rosette, red in the heart, a flower spike
  function bromeliad(x, z) {
    const y = groundH(x, z), s = rr(0.5, 0.9), gc = col(pick(['#6a8a2a', '#8a7a2a', '#9a5a2a', '#5f8a3a']));
    for (let k = 0; k < 9; k++) push(inst.frond, V3(x, y, z), qEuler(rr(-1.1, -0.65), k / 9 * TAU + rr(-0.2, 0.2), 0), S.set(s * 0.55, s * rr(1.0, 1.4), s * rr(1.0, 1.4)), k % 3 ? gc : col('#c8402a'));
    if (rand() < 0.5) { push(inst.cyl, V3(x, y, z), Q, S.set(0.05, s * 2.2, 0.05), col('#5a6a2a')); push(inst.flower, V3(x, y + s * 2.3, z), Q, S.set(0.2, 0.45, 0.2), col(pick(['#ff3d5a', '#ffb02e']))); }
  }
  // pitcher plants: little tubes in a cluster, red rims
  function pitchers(x, z) {
    const y = groundH(x, z);
    for (let k = 0; k < 5; k++) { const a = rand() * TAU, r = rr(0, 0.5), h = rr(0.35, 0.8); push(inst.cyl, V3(x + Math.cos(a) * r, y - 0.05, z + Math.sin(a) * r), qEuler(rr(-0.15, 0.15), 0, rr(-0.15, 0.15)), S.set(0.1, h, 0.1), col(pick(['#8aa83a', '#a8b84a', '#b8573a']))); }
  }
  // black sandstone: sculpted stacks and loose blocks
  function blackRock(x, z) {
    const y = groundH(x, z), n = 1 + ((rand() * 3) | 0); let yy = y - 0.4;
    for (let k = 0; k < n; k++) { const s = rr(1.0, 2.6) * (1 - k * 0.2); push(inst.rock, V3(x + rr(-0.4, 0.4), yy + s * 0.5, z + rr(-0.4, 0.4)), qEuler(rr(-0.2, 0.2), rand() * TAU, rr(-0.2, 0.2)), S.set(s * rr(1.0, 1.5), s * rr(0.6, 0.9), s), col('#2c2a28').offsetHSL(0, 0, rr(-0.03, 0.05))); yy += s * 0.9; }
  }

  /* ---------------- the cave: shell, floor, lake, gours, formations ---------------- */
  // rings of 9 points (floor edge, wall foot, 5 round the dome, wall foot, floor edge): a closed vault, no sky gaps
  const shellRings = [];
  {
    const pos = [], cl = [], idx = [], NK = 9, tint = new THREE.Color();
    const ringCols = ['#3a332c', '#5a5044', '#74685a', '#8c806e', '#a49884', '#8c806e', '#74685a', '#5a5044', '#3a332c'].map(col);
    let rows = 0;
    for (let i = c0; i <= c1 + 1; i += 2) {
      const ii = Math.min(i, c1 + 1) % NR, f = roadFrame(ii), w = caveW(ii), h = caveH(ii), yB = roadY[ii] - 0.6;
      const yLow = Math.min(yB, inLake(ii) ? LAKE.bed : yB) - 3;
      const ring = [];
      for (let k = 0; k < NK; k++) {
        let l, y;
        if (k === 0) { l = -w; y = yLow; } else if (k === NK - 1) { l = w; y = yLow; } else {
          const a = PI * (k - 1) / 6, ca = Math.cos(a), sa = Math.sin(a);
          l = -Math.sign(ca) * Math.pow(Math.abs(ca), 0.55) * w * (1 + 0.04 * Math.sin(ii * 0.11 + k));
          y = yB + h * Math.pow(sa, 0.7);
          const jit = (k === 1 || k === 7) ? 1.6 : 0.9;
          l += rr(-jit, jit) * (k === 4 ? 0.3 : 1); y += rr(-0.8, 0.8);
        }
        const v = f.p.clone().addScaledVector(f.n, l).setY(y);
        ring.push(v); pos.push(v.x, v.y, v.z);
        tint.copy(ringCols[k]).multiplyScalar(0.85 + 0.25 * rand()); if (rand() < 0.12) tint.multiplyScalar(0.6);
        cl.push(tint.r, tint.g, tint.b);
      }
      shellRings.push({ i: ii, ring, w, h, yB });
      if (rows) { const a = (rows - 1) * NK, b = rows * NK; for (let k = 0; k < NK - 1; k++) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1); }
      rows++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, flatShading: true, side: THREE.DoubleSide, emissive: col('#1c2a2c'), emissiveIntensity: 0.5 }));
    m.castShadow = true; m.receiveShadow = true; m.name = 'sarisarinama-cave-shell'; scene.add(m);
    // the floor of the galleries: lake bed under the water, wet flowstone elsewhere
    const fr = [], fc = [], bed = col('#2c3a3a'), flow = col('#7a6e5c');
    shellRings.forEach(s => { const f = roadFrame(s.i), y = inLake(s.i) ? LAKE.bed : s.yB + 0.05; fr.push({ a: f.p.clone().addScaledVector(f.n, -s.w - 0.5).setY(y), b: f.p.clone().addScaledVector(f.n, s.w + 0.5).setY(y) }); fc.push(inLake(s.i) ? bed : flow); });
    stripMesh(fr, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, emissive: col('#0e2228'), emissiveIntensity: 0.5 }), 20, false, fc).name = 'sarisarinama-cave-floor';
  }
  const shellPoint = (s, kf) => { const k = Math.floor(kf), t = kf - k; return s.ring[k].clone().lerp(s.ring[Math.min(8, k + 1)], t); };

  // the still lake: dark glass tinted electric blue where the lights sit under the water
  {
    const rows = []; for (let i = lake0; i <= lake1; i += 2) { const f = roadFrame(i), w = caveW(i) - 0.4; rows.push([f.p.clone().addScaledVector(f.n, -w), f.p.clone().addScaledVector(f.n, w)]); }
    const pos = [], idx = [];
    rows.forEach(([a, b], k) => { pos.push(a.x, LAKE.level, a.z, b.x, LAKE.level, b.z); if (k) { const q = (k - 1) * 2; idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const lake = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col('#0a4a6a'), emissive: col('#0b6aa0'), emissiveIntensity: 0.6, roughness: 0.05, metalness: 0.6, side: THREE.DoubleSide }));
    lake.name = 'sarisarinama-lake'; lake.renderOrder = 1; noRay(lake); scene.add(lake);
  }
  // cave lights: blue under the lake, warm over the gours
  for (const L of MAP.cave.lights) {
    const i = idxNear(...L.at, c0, c1), p = roadAt(i, L.lat, 0);
    const l = new THREE.PointLight(col(L.color), L.power * 60, 70, 1.5); l.position.set(p.x, (inLake(i) ? LAKE.level : roadY[i]) + 1.2, p.z); scene.add(l);
  }

  // formations: soda straws in the lake hall, stalactites through the galleries, stalagmites and columns
  {
    const hallLake = idxNear(...MAP.cave.halls[0].at, c0, c1);
    shellRings.forEach((s, k) => {
      const lakeHall = Math.abs(s.i - hallLake) < 90;
      const nStraw = lakeHall ? 16 : 2, nBig = lakeHall ? 1 : 1.2;
      for (let j = 0; j < nStraw; j++) { const p = shellPoint(s, rr(2.2, 5.8)); push(inst.drip, p.setY(p.y + 0.3), qYaw(rand() * TAU), S.set(rr(0.06, 0.16), rr(0.8, 4.5), rr(0.06, 0.16)), col('#e6dcc6').offsetHSL(0, 0, rr(-0.08, 0.04))); }
      if (rand() < nBig * 0.7) { const p = shellPoint(s, rr(2.4, 5.6)), r = rr(0.35, 0.9); push(inst.drip, p.setY(p.y + 0.4), qYaw(rand() * TAU), S.set(r, rr(2, 6), r), col('#c9b99a').offsetHSL(0, 0, rr(-0.08, 0.05))); }
      // on the floor beside the road
      if (!inLake(s.i) && rand() < 0.75) for (const side of [-1, 1]) { if (rand() < 0.4 || s.w < HW0 + 3.5) continue; const f = roadFrame(s.i), lat = side * rr(HW0 + 2, s.w - 1.5), p = f.p.clone().addScaledVector(f.n, lat).setY(s.yB); const r = rr(0.35, 0.9); push(inst.mite, p, qYaw(rand() * TAU), S.set(r, rr(1.2, 4.5), r), col('#bcae92').offsetHSL(0, 0, rr(-0.08, 0.05))); }
      // in the lake: tall stalagmites standing in the water, a few columns floor to ceiling
      if (inLake(s.i) && s.w > HW0 + 6 && rand() < 0.22) { const f = roadFrame(s.i), side = rand() < 0.5 ? -1 : 1, lat = side * rr(HW0 + 4, s.w - 2), p = f.p.clone().addScaledVector(f.n, lat).setY(LAKE.bed); const r = rr(0.5, 1.4); push(inst.mite, p, qYaw(rand() * TAU), S.set(r, rr(4, 9), r), col('#d4c6a8').offsetHSL(0, 0, rr(-0.06, 0.05))); }
      if (inLake(s.i) && s.w > HW0 + 8 && k % 9 === 4 && rand() < 0.7) { const f = roadFrame(s.i), side = rand() < 0.5 ? -1 : 1, lat = side * rr(HW0 + 5, s.w - 3), base = f.p.clone().addScaledVector(f.n, lat).setY(LAKE.bed), top = shellPoint(s, side < 0 ? rr(2.6, 3.4) : rr(4.6, 5.4)); top.x = base.x; top.z = base.z; const r = rr(0.9, 1.6); push(inst.cyl, base, Q, S.set(r, top.y - base.y + 0.5, r), col('#cbbd9e')); push(inst.boulder, base.clone().setY(LAKE.level + 0.3), Q, S.set(r * 1.8, 1.2, r * 1.8), col('#c7b898')); }
    });
  }
  // the gours: rimstone pools stepping down beside the road, and a tall stair of them up the hall wall
  const gourSpray = [];
  {
    const RIM_C = col('#e9dcbf'), FALLS = flowMaterial({ alpha: 0.85, deep: '#3a6a6a', shallow: '#6ac0c0' }), POOLM = poolMat('#0f6a7a', '#6ae0d6');
    const gourPool = (cx, cy, cz, rx, rz, yaw, drop, dropDir) => {
      addPool(cx, cy, cz, rx, rz, yaw, POOLM);
      push(inst.rim, V3(cx, cy + 0.02, cz), qYaw(yaw), S.set(rx + 0.15, 2.4, rz + 0.15), RIM_C.clone().offsetHSL(0, 0, rr(-0.05, 0.03)));
      if (drop > 0.2) {
        const fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(dropDir), side = V3(fwd.z, 0, -fwd.x), lip = V3(cx, cy, cz).addScaledVector(fwd, rz + 0.1);
        ribbon([{ c: lip.clone().setY(cy + 0.08), side, w: rx * 0.6, steep: 1, foam: 1 }, { c: lip.clone().addScaledVector(fwd, 0.25).setY(cy - drop), side, w: rx * 0.7, steep: 1, foam: 1 }], FALLS, 0.6);
        gourSpray.push(lip.clone().addScaledVector(fwd, 0.5).setY(cy - drop + 0.2));
      }
    };
    for (let k = 0; k < GN; k++) {
      const a = (k + 0.31) / GN, i = Math.round(g0 + a * gLen), f = roadFrame(i), yS = roadY[i] - 0.2, rz = 0.31 * gLen / GN;
      const drop = (gY0 - gY1) / GN;
      for (const side of [-1, 1]) {
        const w = caveW(i), rx = Math.min(5, (w - HW0 - 1.2) / 2);
        if (rx < 1.5) continue;
        const p = f.p.clone().addScaledVector(f.n, side * (HW0 + 0.8 + rx));
        gourPool(p.x, yS, p.z, rx, rz, yawOf(f.t), k < GN - 1 ? drop : 0.0, 1);
      }
      // spray where the road drops to the next pool
      const j = Math.round(g0 + (k + 0.85) / GN * gLen); if (j < c1) for (const side of [-1, 1]) gourSpray.push(roadAt(j, side * (HW0 + 0.5), 0.4));
    }
    // the stair up the wall of the gours hall
    const ws = MAP.cave.gours.wallStair, ih = idxNear(...ws.at, c0, c1), f = roadFrame(ih), w = caveW(ih);
    for (let j = 0; j < ws.pools; j++) {
      const t = j / (ws.pools - 1), lat = ws.side * lerp(HW0 + 4, w - 3, t), y = roadY[ih] + 0.3 + j * 1.25, along = Math.sin(j * 1.7) * 2.5;
      const p = f.p.clone().addScaledVector(f.n, lat).addScaledVector(f.t, along), rx = lerp(3.6, 2.0, t), rz = lerp(4.8, 2.6, t);
      push(inst.boulder, p.clone().setY(y - 1.2), qYaw(yawOf(f.t)), S.set(rx * 1.1, 1.3 + j * 0.15, rz * 1.1), col('#cdbf9e'));
      gourPool(p.x, y, p.z, rx, rz, yawOf(f.t) + PI / 2, j > 0 ? 1.25 : 0, -ws.side);
    }
  }

  /* ---------------- the mouths: a rock face with the tunnel's shape cut out ---------------- */
  // The heightfield cannot overhang, so the cliff triangles just behind each
  // mouth are removed and a face with the tunnel's profile replaces them.
  const mouthFaces = [];
  {
    const geo = terrainMesh.geometry, p = geo.attributes.position, index = geo.index.array, kept = [];
    const faceMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true, side: THREE.DoubleSide });
    const specs = [{ i: c0, dir: 1 }, { i: (c1 + 1) % NR, dir: -1 }].map(({ i, dir }) => {
      const f = roadFrame(i), w = caveW(i), h = caveH(i), yB = roadY[i] - 0.6, into = f.t.clone().multiplyScalar(dir);
      // height of the cliff top just behind the face
      let topY = 0; for (let k = 4; k <= 16; k += 2) for (const l of [-w, 0, w]) { const q = f.p.clone().addScaledVector(into, k).addScaledVector(f.n, l); topY = Math.max(topY, natural(q.x, q.z)); }
      return { i, dir, f, w, h, yB, into, topY };
    });
    const doomed = new Uint8Array(p.count);
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v);
      for (const s of specs) {
        const dx = x - s.f.p.x, dz = z - s.f.p.z, along = dx * s.into.x + dz * s.into.z, lat = dx * s.f.n.x + dz * s.f.n.z;
        if (along > -5 && along < 16 && Math.abs(lat) < s.w + 3 && y > s.yB + 0.9 && y < s.topY - 1.2) doomed[v] = 1;
      }
    }
    for (let t = 0; t < index.length; t += 3) if (!(doomed[index[t]] || doomed[index[t + 1]] || doomed[index[t + 2]])) kept.push(index[t], index[t + 1], index[t + 2]);
    geo.setIndex(kept);
    for (const s of specs) {
      const W = s.w + 6, top = s.topY - s.yB + 0.3, hw = s.w - 0.6, hh = s.h - 0.8;
      const inHole = (lx, ly) => Math.abs(lx) < hw && (ly < 0 || ly < hh * Math.pow(Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(lx) / hw, 2 / 0.55))), 0.7));
      const nx = Math.ceil(2 * W / 1.5), ny = Math.ceil((top + 8) / 1.5), vp = [], vc = [], ix = [], tmp = new THREE.Color();
      for (let r = 0; r <= ny; r++) for (let c = 0; c <= nx; c++) {
        const lx = -W + 2 * W * c / nx, ly = -8 + (top + 8) * r / ny, edge = c === 0 || c === nx || r === ny;
        const bump = edge ? 0 : (Math.sin(lx * 0.7 + ly * 0.31) * 0.5 + Math.sin(ly * 1.3 - lx * 0.4) * 0.3 + rr(-0.25, 0.25));
        const wp = s.f.p.clone().addScaledVector(s.f.n, lx).addScaledVector(s.into, -bump).setY(s.yB + ly);
        vp.push(wp.x, wp.y, wp.z); paintGround(wp.x, wp.z, wp.y, 1, tmp, TOP); vc.push(tmp.r, tmp.g, tmp.b);
        if (r < ny && c < nx) { const a0 = r * (nx + 1) + c, cxm = -W + 2 * W * (c + 0.5) / nx, cym = -8 + (top + 8) * (r + 0.5) / ny; if (!inHole(cxm, cym)) ix.push(a0, a0 + 1, a0 + nx + 1, a0 + 1, a0 + nx + 2, a0 + nx + 1); }
      }
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3)); fg.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3)); fg.setIndex(ix); fg.computeVertexNormals();
      const face = new THREE.Mesh(fg, faceMat);
      face.castShadow = true; face.receiveShadow = true; face.name = 'sarisarinama-mouth'; scene.add(face);
      mouthFaces.push(s);
      // boulders framing the opening, roots hanging over it, ferns at its feet
      const out = s.into.clone().negate();
      for (let k = 0; k < 16; k++) {
        const a = PI * rr(-0.15, 1.15), ca = Math.cos(a), lat = -Math.sign(ca) * Math.pow(Math.abs(ca), 0.55) * (s.w + rr(0.5, 2.5)), y = s.yB + Math.max(0, (s.h + rr(0, 2)) * Math.pow(Math.max(0, Math.sin(a)), 0.7)) - 1;
        const q = s.f.p.clone().addScaledVector(s.f.n, lat).addScaledVector(out, rr(0.2, 1.6)).setY(y), sc = rr(1.2, 3.2);
        push(inst.rock, q, qEuler(rand(), rand() * TAU, rand()), S.set(sc * 1.2, sc * 0.8, sc), col('#4a3c34').offsetHSL(0, 0, rr(-0.04, 0.06)));
      }
      for (let k = 0; k < 34; k++) {
        const lat = rr(-s.w - 2, s.w + 2), a = Math.acos(clamp(-lat / s.w, -1, 1)), yTop = s.yB + (Math.abs(lat) < s.w ? s.h * Math.pow(Math.sin(a), 0.7) : s.h * 0.4) + rr(0.5, 3);
        const from = s.f.p.clone().addScaledVector(s.f.n, lat).addScaledVector(out, rr(0.4, 1.4)).setY(yTop), L = Math.min(rr(2, 8), yTop - s.yB - 5);
        if (L > 0.5) between(from.clone().setY(yTop - L), from, rr(0.04, 0.09), inst.vine, col(pick(['#5a4a32', '#4a6a2a', '#6a5a3a'])));
      }
      for (let k = 0; k < 10; k++) { const lat = (rand() < 0.5 ? -1 : 1) * rr(HW0 + 2, s.w + 5), q = s.f.p.clone().addScaledVector(s.f.n, lat).addScaledVector(out, rr(1, 6)); fern(q.x, q.z, rr(0.9, 1.6), col('#4f9a52')); }
    }
  }

  /* ---------------- curbs: boulders on the drop side of the spiral, on the rim and on the hairpins ---------------- */
  // The same edges stop the cars (constrainMotion below): no shortcut down a sheer wall.
  const dropSide = new Uint8Array(NR);
  for (let i = 0; i < NR; i++) {
    if (CAVE_SEG[SEG[i]]) continue;
    for (const side of [-1, 1]) {
      const outer = roadAt(i, side * (HW0 + 3.5));
      if (roadY[i] - terrainH(outer.x, outer.z) >= 2.5) dropSide[i] |= side < 0 ? 1 : 2;
    }
  }
  for (let i = 0; i < NR; i += 4) for (const side of [-1, 1]) {
    if (!(dropSide[i] & (side < 0 ? 1 : 2))) continue;
    const q = roadAt(i, side * (HW0 + 0.9)), sc = rr(0.5, 0.95);
    push(inst.boulder, q.setY(roadY[i] - 0.1 + sc * 0.2), qEuler(rand(), rand() * TAU, rand()), S.set(sc * 1.3, sc * 0.7, sc), col('#3a3836').offsetHSL(0, 0, rr(-0.03, 0.06)));
  }

  /* ---------------- waterfalls ---------------- */
  const sprayAt = [];
  {
    const FALL = flowMaterial({ alpha: 0.9 });
    const roadNear = (x, z, y) => { const r = sampleR(RR, x, z); return r.i >= 0 && r.dist < HW0 - 0.2 && Math.abs(roadY[r.i] - y) < 1.5 ? r.i : -1; };
    // big sima: a stream on the top runs to the rim and drapes down the wall, across the shelves and the road
    for (const ph of MAP.waterfalls.humboldt) {
      const a = spAng(ph), dir = V3(Math.cos(a), 0, Math.sin(a)), side = V3(-dir.z, 0, dir.x), rows = [];
      let prevY = null, wasSteep = false;
      for (let r = HUM.radius + 40; r > 8; r -= 0.5) {
        const x = C1.x + dir.x * r, z = C1.z + dir.z * r, nat = natural(x, z);
        if (r < HUM.radius - 10 && nat < HUM.floor + 1.2 && prevY !== null && prevY < HUM.floor + 1.5) { rows.push({ c: V3(x, nat + 0.2, z), side, w: 3.5, steep: 0, foam: 0.3 }); break; }
        let y = terrainH(x, z, nat) + 0.2, onroad = 0;
        const ri = roadNear(x, z, y); if (ri >= 0) { y = roadY[ri] + 0.2; onroad = 1; }
        const steep = prevY === null ? 0 : clamp(Math.abs(prevY - y) / 0.5 / 3, 0, 1);
        const inward = steep * 0.5;
        if (wasSteep && steep < 0.3) sprayAt.push(V3(x, y + 0.5, z));
        wasSteep = steep > 0.5;
        rows.push({ c: V3(x - dir.x * inward, y, z - dir.z * inward), side, w: r > HUM.radius + 2 ? 2.2 : steep > 0.5 ? 3.4 : 3.0, steep, foam: steep > 0.5 ? 0.6 : 0.08, onroad });
        prevY = y;
      }
      ribbon(rows, FALL);
      const end = rows[rows.length - 1].c; addPool(end.x, end.y - 0.1, end.z, 6, 6, 0, poolMat('#0d4a5a', '#5ad0c8')); sprayAt.push(end.clone().setY(end.y + 0.4));
    }
    // small sima: a thin fall down the pit wall with ferns around it
    for (const fw of MAP.waterfalls.martel) {
      const l = Math.hypot(...fw.dir), ds = fw.dir[0] / l, dl = fw.dir[1] / l, rows = [];
      const dir = V3(RD.x * ds + RN.x * dl, 0, RD.z * ds + RN.z * dl), side = V3(-dir.z, 0, dir.x);
      let prevY = null;
      for (let r = MAR.radius + 30; r > MAR.radius - 12; r -= 0.5) {
        const x = C2.x + dir.x * r, z = C2.z + dir.z * r, y = terrainH(x, z) + 0.2, steep = prevY === null ? 0 : clamp(Math.abs(prevY - y) / 0.5 / 3, 0, 1);
        rows.push({ c: V3(x - dir.x * steep * 0.5, y, z - dir.z * steep * 0.5), side, w: r > MAR.radius ? 1.6 : 2.4, steep, foam: steep * 0.5 }); prevY = y;
      }
      ribbon(rows, FALL);
      const end = rows[rows.length - 1].c; addPool(end.x, end.y - 0.1, end.z, 5, 5, 0, poolMat('#0d4a5a', '#5ad0c8')); sprayAt.push(end.clone().setY(end.y + 0.4));
      for (let k = 0; k < 18; k++) { const q = end.clone().addScaledVector(side, rr(-9, 9)).addScaledVector(dir, rr(-2, 6)); if (sampleR(RR, q.x, q.z).dist > HW0 + 1.5) fern(q.x, q.z, rr(1, 1.8), col('#3f9a4a')); }
    }
    // the curtain over the far mouth: the road drives through it into the small sima
    {
      const s = mouthFaces[1], out = s.into.clone().negate(), base = s.f.p.clone().addScaledVector(out, 2.2), w = s.w * MAP.cave.curtain.width, rows = [];
      const topY = s.topY + 0.4, botY = s.yB + 0.6;
      for (let k = 0; k <= 30; k++) { const t = k / 30, y = lerp(topY, botY, t), bow = t * t * 1.2; rows.push({ c: base.clone().addScaledVector(out, bow).setY(y), side: s.f.n.clone(), w: w * (0.85 + 0.15 * t), steep: 1, foam: 1 }); }
      ribbon(rows, FALL, 0.12);
      // the stream on the top that feeds it
      const feed = []; for (let k = 0; k <= 40; k++) { const q = s.f.p.clone().addScaledVector(s.into, 6 + k).addScaledVector(s.f.n, Math.sin(k * 0.21) * 2.5); feed.push({ c: q.setY(natural(q.x, q.z) + 0.2), side: s.f.n.clone(), w: 2.4, steep: 0, foam: 0.05 }); }
      feed.reverse(); ribbon(feed, FALL);
      for (let k = 0; k < 8; k++) sprayAt.push(base.clone().addScaledVector(s.f.n, rr(-w, w)).setY(botY + rr(0, 1.5)));
      // a stream from the curtain's foot to the blue pool
      const footL = base.clone().addScaledVector(s.f.n, -(HW0 + 3)), pts = [footL, V3(lerp(footL.x, poolXZ[0], 0.5) + 6, 0, lerp(footL.z, poolXZ[1], 0.5) + 4), V3(poolXZ[0], 0, poolXZ[1])];
      const c = new THREE.CatmullRomCurve3(pts), sr = [];
      for (let k = 0; k <= 40; k++) { const q = c.getPoint(k / 40), tg = c.getTangent(k / 40); sr.push({ c: q.setY(terrainH(q.x, q.z) + 0.15), side: V3(-tg.z, 0, tg.x).normalize(), w: 1.4, steep: 0, foam: 0.1 }); }
      ribbon(sr, FALL);
    }
    addPool(poolXZ[0], MAR.floor - 0.5, poolXZ[1], MAR.pool.radius + 1, MAR.pool.radius + 1, 0, poolMat('#04317a', '#2ad6d0'));
  }

  /* ---------------- vegetation placement ---------------- */
  // The galleries only reserve ground at their own level, not the plateau above them.
  const freeOf = (x, z, roadM) => {
    if (sampleR(RR, x, z).dist < HW0 + roadM) return false;
    const c = sampleR(CR, x, z);
    return c.i < 0 || c.dist >= caveW(c.i) + roadM || groundH(x, z) > roadY[c.i] + caveH(c.i) + 4;
  };
  const inHum = (x, z) => Math.hypot(x - C1.x, z - C1.z) < HUM.radius + 1;
  const onTop = (x, z) => { const n = natural(x, z); return n > plateauH(x, z) - 1.5 ? n : null; };
  const startP = roadAt(Math.round(MAP.lineU * NR), 0);
  const beamXZ = MAP.vegetation.beam.at;
  const tries = (n, fn) => { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; };
  const VG = MAP.vegetation;
  const inSquare = (x, z, m = 4) => Math.abs(x - CX) < HALF - m && Math.abs(z - CZ) < HALF - m;
  const forestMask = (x, z) => 0.5 + 0.5 * Math.sin(x * 0.021 + Math.sin(z * 0.017) * 2.2) * Math.cos(z * 0.019 - x * 0.007);
  // the top: low dense forest in patches, black rocks, bromeliads, pitcher plants in the wet open ground
  tries(VG.top.trees, () => {
    const x = rr(X0, X0 + SIZE), z = rr(Z0, Z0 + SIZE); if (!inSquare(x, z) || rand() > forestMask(x, z) * 1.3) return false;
    if (onTop(x, z) === null || !freeOf(x, z, 4) || Math.hypot(x - startP.x, z - startP.z) < 16) return false;
    tepuiTree(x, z); return true;
  });
  tries(VG.top.rocks, () => { const x = rr(X0, X0 + SIZE), z = rr(Z0, Z0 + SIZE); if (!inSquare(x, z) || onTop(x, z) === null || !freeOf(x, z, 3)) return false; blackRock(x, z); return true; });
  tries(VG.top.bromeliads, () => { const x = rr(X0, X0 + SIZE), z = rr(Z0, Z0 + SIZE); if (!inSquare(x, z) || onTop(x, z) === null || !freeOf(x, z, 1.5)) return false; bromeliad(x, z); return true; });
  tries(VG.top.pitchers, () => { const x = rr(X0, X0 + SIZE), z = rr(Z0, Z0 + SIZE); if (!inSquare(x, z) || forestMask(x, z) > 0.5 || onTop(x, z) === null || !freeOf(x, z, 1.5)) return false; pitchers(x, z); return true; });
  tries(VG.top.ferns, () => { const x = rr(X0, X0 + SIZE), z = rr(Z0, Z0 + SIZE); if (!inSquare(x, z) || onTop(x, z) === null || !freeOf(x, z, 1.5)) return false; rand() < 0.6 ? fern(x, z, rr(0.6, 1.1), col('#5a7a3a')) : bush(x, z, rr(0.6, 1.0), true); return true; });
  // the rim: plants leaning over the edge of both simas
  for (let k = 0; k < 260; k++) {
    const a = rand() * TAU, big = k < 190, R = big ? HUM.radius : MAR.radius, C = big ? C1 : C2, r = R + rr(0.5, 5), x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r;
    if (!inSquare(x, z) || onTop(x, z) === null || !freeOf(x, z, 1.5)) continue;
    const k2 = rand(); k2 < 0.4 ? fern(x, z, rr(0.9, 1.6), col('#4f8a42')) : k2 < 0.7 ? bromeliad(x, z) : tepuiTree(x, z);
  }
  // the floors: the lost jungle, giant ferns, a clearing where the sunbeam reaches the road
  const onFloor = (x, z) => {
    const n = natural(x, z);
    if (inHum(x, z)) return n < HUM.floor + 2.5 ? n : null;
    const q = toLocal2(x, z); if ((q.r < MAR.radius || (q.s > 0 && q.s < LEGS[0] - 8 && Math.abs(q.l) < RMP.halfWidth))) return n < MAR.floor + 3 && Math.hypot(x - poolXZ[0], z - poolXZ[1]) > MAR.pool.radius + 2 ? n : null;
    return null;
  };
  const clearing = (x, z) => Math.hypot(x - beamXZ[0], z - beamXZ[1]) < VG.beam.clear;
  const rndFloor = () => rand() < 0.78 ? (() => { const a = rand() * TAU, r = Math.sqrt(rand()) * 76; return [C1.x + Math.cos(a) * r, C1.z + Math.sin(a) * r]; })() : (() => { const a = rand() * TAU, r = Math.sqrt(rand()) * 70; return [C2.x + Math.cos(a) * r + RD.x * 30, C2.z + Math.sin(a) * r + RD.z * 30]; })();
  tries(VG.floor.emergents, () => { const [x, z] = rndFloor(); if (onFloor(x, z) === null || !freeOf(x, z, 11) || clearing(x, z)) return false; emergent(x, z); return true; });
  tries(VG.floor.trees, () => { const [x, z] = rndFloor(); if (onFloor(x, z) === null || !freeOf(x, z, 6.5) || clearing(x, z)) return false; jungleTree(x, z, rand() < 0.4); return true; });
  tries(VG.floor.treeFerns, () => { const [x, z] = rndFloor(); if (onFloor(x, z) === null || !freeOf(x, z, 2.5)) return false; treeFern(x, z, rr(1.0, 1.6)); return true; });
  tries(VG.floor.ferns, () => { const [x, z] = rndFloor(); if (onFloor(x, z) === null || !freeOf(x, z, 1.2)) return false; fern(x, z, rr(1.0, 2.2), col('#3f9a42').offsetHSL(rr(-0.02, 0.03), 0, rr(-0.05, 0.05))); return true; });
  tries(VG.floor.bushes, () => { const [x, z] = rndFloor(); if (onFloor(x, z) === null || !freeOf(x, z, 1.5)) return false; bush(x, z, rr(0.8, 1.5), true); return true; });
  // the climb: shrubs and ferns between the switchbacks
  tries(420, () => { const s = rr(30, LEGS[NL - 1] + 10), l = rr(-RMP.halfWidth + 6, RMP.halfWidth - 6), [x, z] = local2(s, l); if (!freeOf(x, z, 2)) return false; rand() < 0.5 ? fern(x, z, rr(0.8, 1.5), col('#4f9a42')) : rand() < 0.6 ? bush(x, z, rr(0.7, 1.2), true) : tepuiTree(x, z); return true; });
  // grass everywhere it can stand
  tries(VG.top.grass + VG.floor.grass, () => {
    const x = rr(X0, X0 + SIZE), z = rr(Z0, Z0 + SIZE); if (!inSquare(x, z)) return false;
    const fl = onFloor(x, z), tp = fl === null ? onTop(x, z) : null; if ((fl === null && tp === null) || !freeOf(x, z, 1.0)) return false;
    const y = terrainH(x, z), s = rr(0.7, 1.4);
    push(inst.grass, V3(x, y - 0.05, z), qYaw(rand() * TAU), S.set(s * 1.4, s, s * 1.4), col(fl !== null ? '#5aa83a' : '#a8a85a').offsetHSL(rr(-0.03, 0.03), rr(-0.1, 0.05), rr(-0.08, 0.06)));
    return true;
  });
  // vines: down the big sima's wall from the rim, off the shelf lips, round the small sima
  {
    const VC = ['#3f6a2a', '#4f7a32', '#5a6a3a', '#35552a'].map(col);
    const hang = (from, len) => { const to = from.clone().setY(from.y - len); between(to, from, rr(0.05, 0.11), inst.vine, pick(VC)); for (let k = 0; k < 3; k++) { const q = from.clone().lerp(to, rr(0.1, 0.95)), s = rr(0.3, 0.7); push(inst.bushBlob, q, qEuler(rand(), rand() * TAU, 0), S.set(s, s * 1.4, s), pick(VC)); } };
    for (let k = 0; k < VG.vines.humboldt; k++) {
      const a = rand() * TAU, x = C1.x + Math.cos(a) * (HUM.radius - 0.6), z = C1.z + Math.sin(a) * (HUM.radius - 0.6);
      const ledge = natural(C1.x + Math.cos(a) * (HUM.radius - SPI.talus - 3), C1.z + Math.sin(a) * (HUM.radius - SPI.talus - 3));
      const room = TOP - ledge - 4; if (room < 4 || sampleR(RR, x, z).dist < HW0 + 2) continue;
      hang(V3(x, TOP + 0.3, z), Math.min(room, rr(6, 34)));
    }
    for (let k = 0; k < VG.vines.lips; k++) {
      const ph = rr(0.2, SPI.end - 1.2), a = spAng(ph), r = spR(ph) - HW0 - SPI.shelf + 0.4, x = C1.x + Math.cos(a) * r, z = C1.z + Math.sin(a) * r;
      const below = natural(C1.x + Math.cos(a) * (r - 6), C1.z + Math.sin(a) * (r - 6)), room = spY(ph) - below - 3; if (room < 3) continue;
      hang(V3(x, spY(ph) - 0.1, z), Math.min(room, rr(4, 22)));
    }
    for (let k = 0; k < VG.vines.martel; k++) {
      const a = rand() * TAU, x = C2.x + Math.cos(a) * (MAR.radius - 0.4), z = C2.z + Math.sin(a) * (MAR.radius - 0.4);
      const q = toLocal2(x, z); if (q.s > -2 && Math.abs(q.l) < RMP.halfWidth) continue;
      const top = natural(C2.x + Math.cos(a) * (MAR.radius + 1), C2.z + Math.sin(a) * (MAR.radius + 1)), fl = natural(C2.x + Math.cos(a) * (MAR.radius - 8), C2.z + Math.sin(a) * (MAR.radius - 8));
      if (top - fl < 10) continue;
      hang(V3(x, top + 0.3, z), Math.min(top - fl - 5, rr(8, 40)));
    }
  }
  // forest on the backdrop: the tepuy top beyond the square, the lowland jungle below
  tries(2600, () => {
    const x = rr(X0 - 380, X0 + SIZE + 380), z = rr(Z0 - 380, Z0 + SIZE + 380); if (inSquare(x, z, -2) || rand() > forestMask(x, z) * 1.3) return false;
    const y = farH(x, z); if (y < TOP - 25) return false;
    vegetation.add('mango', x, z, y, rr(0.5, 0.7), 100); return true;
  });
  tries(1500, () => {
    const x = rr(CX - 2600, CX + 2600), z = rr(CZ - 2600, CZ + 2600); if (inSquare(x, z, -10)) return false;
    const y = farH(x, z), low = y < -150;
    if (!low && rand() > forestMask(x, z)) return false;
    vegetation.add(low ? 'tree' : 'mango', x, z, y, low ? rr(1.6, 2.2) : rr(0.6, 0.8), 100); return true;
  });

  /* ---------------- the start: two black-rock cairns with checkered pennants and a banner ---------------- */
  const banner = (() => {
    const i0 = Math.round(MAP.lineU * NR), f = roadFrame(i0), q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.n, UP, f.t.clone().negate()));
    const flagTex = canvasTex(128, 64, c => { for (let x = 0; x < 128; x += 16) for (let y = 0; y < 64; y += 16) { c.fillStyle = ((x + y) / 16) % 2 ? '#151515' : '#f4f4f4'; c.fillRect(x, y, 16, 16); } });
    flagTex.repeat.set(7, 1);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW0 + 5, 1.8, 16, 1), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }));
    b.position.copy(roadAt(i0, 0, 8.4)); b.quaternion.copy(q); b.castShadow = true; noRay(b); scene.add(b);
    for (const s of [-1, 1]) {
      const p = roadAt(i0, s * (HW0 + 2.5), 0); let yy = Math.min(p.y, terrainH(p.x, p.z)) - 0.3;
      for (let k = 0; k < 4; k++) { const sc = 1.7 - k * 0.25; push(inst.rock, V3(p.x + rr(-0.2, 0.2), yy + sc * 0.45, p.z + rr(-0.2, 0.2)), qEuler(rr(-0.15, 0.15), rand() * TAU, 0), S.set(sc * 1.2, sc * 0.9, sc * 1.1), col('#2a2826')); yy += sc * 0.85; }
      between(V3(p.x, yy - 0.5, p.z), V3(p.x, p.y + 9.6, p.z), 0.12, inst.cyl, col('#6a5a44'));
    }
    return b;
  })();
  banner.userData.base = banner.geometry.attributes.position.array.slice();

  /* ---------------- the sunbeam reaching the floor ---------------- */
  const beam = (() => {
    const bi = idxNear(...beamXZ), base = roadAt(bi, 0, 0), len = 150;
    const geo = new THREE.CylinderGeometry(9, 7, len, 32, 1, true); geo.translate(0, len / 2, 0);
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uLen: { value: len } },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); vY = position.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uT; uniform float uLen; varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ float f = pow(abs(dot(vN, vV)), 1.6); float fade = smoothstep(0.0, 6.0, vY) * smoothstep(uLen, uLen * 0.45, vY);
          float a = 0.3 * f * fade * (0.85 + 0.15 * sin(uT * 0.7 + vY * 0.05));
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.78) * a, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    m.position.copy(base); m.quaternion.setFromUnitVectors(UP, SUN_DIR); m.renderOrder = 5; noRay(m); scene.add(m);
    addPool(base.x, base.y + 0.18, base.z, 7, 7, 0, new THREE.MeshBasicMaterial({ color: col('#fff1c8'), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    // dust in the light
    const n = 160, pts = new Float32Array(n * 3), seeds = [];
    for (let k = 0; k < n; k++) { const h = rr(1, 45), a = rand() * TAU, r = Math.sqrt(rand()) * 6; seeds.push({ h, a, r, sp: rr(0.2, 0.6) }); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const motes = new THREE.Points(pg, new THREE.PointsMaterial({ color: col('#fff4d0'), map: cloudTex, size: 0.35, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    motes.frustumCulled = false; noRay(motes); scene.add(motes);
    return { m, base, motes, seeds };
  })();

  /* ---------------- mist on the top, sea of clouds below the tepuy, spray ---------------- */
  const mist = [], spray = [];
  {
    const fogMat = new THREE.SpriteMaterial({ map: cloudTex, color: col('#eef3f0'), transparent: true, opacity: 0.32, depthWrite: false, fog: true });
    for (let k = 0; k < 100; k++) {
      const x = rr(X0 - 200, X0 + SIZE + 200), z = rr(Z0 - 200, Z0 + SIZE + 200), y = rr(TOP + 4, TOP + 30);
      const s = new THREE.Sprite(fogMat); s.position.set(x, y, z); const sc = rr(40, 90); s.scale.set(sc, sc * 0.45, 1); scene.add(s); mist.push({ s, x0: x, z0: z, y0: y, ph: rand() * TAU });
    }
    const holeMat = new THREE.SpriteMaterial({ map: cloudTex, color: col('#e8f0e8'), transparent: true, opacity: 0.2, depthWrite: false, fog: true });
    for (let k = 0; k < 40; k++) { const big = k < 30, C = big ? C1 : C2, a = rand() * TAU, r = rr(10, big ? 80 : 40), y = rr(big ? 55 : 45, TOP + 6); const s = new THREE.Sprite(holeMat); s.position.set(C.x + Math.cos(a) * r, y, C.z + Math.sin(a) * r); const sc = rr(20, 45); s.scale.set(sc, sc * 0.5, 1); scene.add(s); mist.push({ s, y0: y, ph: rand() * TAU, orbit: { C, r, a } }); }
    const sea = new THREE.SpriteMaterial({ map: cloudTex, color: col('#f4f6f4'), transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    for (let k = 0; k < 70; k++) {
      const a = rand() * TAU, e = rr(1.15, 2.6), x = E.center[0] + Math.cos(a) * E.rx * e, z = E.center[1] + Math.sin(a) * E.rz * e;
      const s = new THREE.Sprite(sea); s.position.set(x, rr(-120, -30), z); const sc = rr(260, 520); s.scale.set(sc, sc * 0.32, 1); scene.add(s);
    }
    const sm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.55, depthWrite: false });
    for (const p of [...sprayAt, ...gourSpray]) for (let k = 0; k < 2; k++) { const s = new THREE.Sprite(sm.clone()); s.position.copy(p).add(V3(rr(-1.5, 1.5), 0, rr(-1.5, 1.5))); const sc = rr(1.2, 2.6); s.scale.set(sc, sc, 1); s.userData = { y0: p.y, ph: rand() * TAU, sp: rr(1.2, 2.4) }; scene.add(s); spray.push(s); }
    // falls off the other tepuyes
    const FAR_FALL = flowMaterial({ alpha: 0.85 });
    for (const m of MAP.landscape.mesas) {
      if (!m.fall) continue;
      const dx = CX - m.at[0], dz = CZ - m.at[1], l = Math.hypot(dx, dz), dir = V3(dx / l, 0, dz / l);
      const p = V3(m.at[0], 0, m.at[1]); for (let k = 0; k < 400 && mesaE(m, p.x, p.z) < 1.0; k++) p.addScaledVector(dir, 6);
      const low = lowland(p.x, p.z), rows = [];
      for (let k = 0; k <= 20; k++) { const t = k / 20; rows.push({ c: p.clone().addScaledVector(dir, 4 + t * t * 18).setY(lerp(m.top, low + 60, t)), side: V3(-dir.z, 0, dir.x), w: 10 + t * 14, steep: 1, foam: 1 }); }
      ribbon(rows, FAR_FALL, 0.02);
    }
  }
  scene.traverse(o => { if (o.isSprite) o.raycast = () => {}; });

  /* ---------------- flush instances ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; im.frustumCulled = false; scene.add(im);
    return im;
  }
  flush(inst.bushBlob, new THREE.IcosahedronGeometry(1, 0), CANOPY);
  flush(inst.frond, frondGeo, FROND);
  flush(inst.grass, grassGeo, GRASS, false);
  flush(inst.rock, new THREE.IcosahedronGeometry(1, 0), ROCK);
  flush(inst.boulder, new THREE.SphereGeometry(1, 12, 8), SMOOTH);
  flush(inst.flower, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, emissive: col('#330808'), emissiveIntensity: 0.4, flatShading: true }), false);
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 })); }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 5); g.translate(0, 0.5, 0); flush(inst.vine, g, VINE, false); }
  { const g = new THREE.ConeGeometry(1, 1, 7); g.rotateX(PI); g.translate(0, -0.5, 0); flush(inst.drip, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.55, emissive: col('#1a3a40'), emissiveIntensity: 0.5 }), false); }
  { const g = new THREE.ConeGeometry(1, 1, 8); g.translate(0, 0.5, 0); flush(inst.mite, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, emissive: col('#14282c'), emissiveIntensity: 0.5 }), false); }
  { const g = new THREE.TorusGeometry(1, 0.1, 6, 36); g.rotateX(PI / 2); const im = flush(inst.rim, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7, emissive: col('#2a2618'), emissiveIntensity: 0.4 }), false); if (im) noRay(im); }

  /* ---------------- birds over the simas: swifts that nest behind the falls, a few guacamayas ---------------- */
  const birds = [];
  {
    const make = (bodyC, wingC, wing2C, scale) => {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col(bodyC), roughness: 0.8, flatShading: true })); body.scale.set(0.35, 0.35, 1.1); b.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.6, 5), new THREE.MeshStandardMaterial({ color: col(wingC), flatShading: true })); tail.rotation.x = -PI / 2; tail.position.z = -1.6; b.add(tail);
      const wings = [];
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(s * 0.25, 0.1, 0.1); b.add(pivot);
        const w = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.7), new THREE.MeshStandardMaterial({ color: col(wingC), roughness: 0.8, flatShading: true })); w.position.set(s * 1.2, 0, 0); pivot.add(w);
        if (wing2C) { const t = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: col(wing2C), flatShading: true })); t.position.set(s * 2.0, 0.01, -0.05); pivot.add(t); }
        wings.push({ pivot, s });
      }
      b.traverse(noRay); b.scale.setScalar(scale); scene.add(b); return { g: b, wings };
    };
    for (let k = 0; k < MAP.life.swifts; k++) {
      const big = k < MAP.life.swifts * 0.7, C = big ? C1 : C2;
      const bird = make('#2a2a30', '#232328', null, 0.32);
      birds.push({ ...bird, c: V3(C.x, rr(big ? 45 : 35, TOP + 25), C.z), r: rr(15, big ? 80 : 45), sp: rr(0.35, 0.6) * (rand() < 0.5 ? -1 : 1), ph: rand() * TAU, fl: rr(9, 13), bob: 6 });
    }
    for (let k = 0; k < MAP.life.macaws; k++) {
      const bird = make('#d8262a', '#d8262a', k % 2 ? '#2a5ad8' : '#f2c21a', 0.75);
      birds.push({ ...bird, c: V3(CX + rr(-100, 100), TOP + rr(25, 45), CZ + rr(-100, 100)), r: rr(140, 260), sp: 0.07 * (k < 2 ? 1 : -1), ph: (k >> 1) * 2.6 + (k % 2) * 0.03, fl: 4.5, bob: 2 });
    }
  }

  /* ---------------- bats: roosting on the lake hall ceiling, they pour out on the race clock ---------------- */
  const bats = (() => {
    const B = MAP.cave.bats, n = B.count;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, -1, 0.08, 0.05, -0.55, 0, -0.1, -0.55, 0, -0.1, -0.2, 0, -0.3, 0, 0, 0.35, 0, 0, 0.35, 0.2, 0, -0.3, 0.55, 0, -0.1, 0.55, 0, -0.1, 1, 0.08, 0.05, 0, 0, 0.35], 3));
    geo.computeVertexNormals();
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: col('#2a2026'), roughness: 1, side: THREE.DoubleSide }), n);
    im.frustumCulled = false; noRay(im); scene.add(im);
    const iRoost = idxNear(...B.roost, c0, c1);
    const roost = [], who = [];
    for (let k = 0; k < n; k++) {
      const s = shellRings[clamp(Math.round((iRoost - c0) / 2 + rr(-22, 22)), 0, shellRings.length - 1)], p = shellPoint(s, rr(3.2, 4.8));
      p.y = shellPoint(s, 4).y - 0.25;
      roost.push(p); who.push({ delay: rr(0, 4.5), sp: rr(22, 28), ph: rand() * TAU, a: rr(-1, 1), b: rr(-1, 1) });
    }
    // flight path: high along the galleries to the far mouth, out into the small sima and up into the sky
    const pts = [roost.reduce((a, p) => a.add(p), V3(0, 0, 0)).multiplyScalar(1 / n)];
    for (let i = iRoost + 30; i < c1; i += 30) pts.push(roadAt(i, 0, Math.max(7, caveH(i) - 4)));
    const M2 = mouthFaces[1], out = M2.into.clone().negate();
    pts.push(M2.f.p.clone().addScaledVector(out, 6).setY(M2.yB + 10));
    const pM2 = pts.length - 1;
    pts.push(V3(C2.x, MAR.floor + 30, C2.z).addScaledVector(out, 10));
    for (let k = 0; k < 5; k++) { const a = k * 1.4; pts.push(V3(C2.x + Math.cos(a) * 26, MAR.floor + 50 + k * 22, C2.z + Math.sin(a) * 26)); }
    pts.push(V3(C2.x - 300, 260, C2.z - 120));
    const path = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), L = path.getLength();
    let acc = 0; for (let k = 1; k <= pM2; k++) acc += pts[k].distanceTo(pts[k - 1]);
    const fM2 = acc / L;
    const state = { t0: -1e9, active: false, lastCycle: null };
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), pp = new THREE.Vector3(), look = new THREE.Matrix4();
    const pose = (k, t) => {
      const w = who[k];
      if (!state.active || t - state.t0 < w.delay) { m4.compose(roost[k], qEuler(PI / 2, w.ph, 0), sc.set(0.55 * 0.35, 0.55, 0.55)); return; }
      const u = (t - state.t0 - w.delay) * w.sp / L;
      if (u >= 1) { m4.compose(roost[k], Q, sc.set(0, 0, 0)); return; }
      const p = path.getPointAt(u), tg = path.getTangentAt(u), side = V3(-tg.z, 0, tg.x).normalize(), spread = lerp(3.2, 28, sstep(fM2, fM2 + 0.2, u)), vs = lerp(1.2, 18, sstep(fM2, fM2 + 0.2, u));
      p.addScaledVector(side, Math.sin(t * 1.7 + w.ph) * spread * w.a).add(V3(0, Math.cos(t * 1.3 + w.ph * 2) * vs * w.b, 0));
      if (u < 0.02) p.lerp(roost[k], 1 - u / 0.02);
      look.lookAt(pp.copy(p).add(tg), p, UP); qq.setFromRotationMatrix(look);
      const flap = 0.55 + 0.45 * Math.sin(t * 24 + w.ph);
      const big = lerp(0.6, 1.1, sstep(fM2, fM2 + 0.15, u)); m4.compose(p, qq, sc.set((0.6 * flap + 0.1) * big, 0.6 * big, 0.6 * big));
    };
    const update = t => {
      const cycle = Math.floor((t - 20) / B.every);
      if (!state.active && state.lastCycle !== null && cycle > state.lastCycle) { state.active = true; state.t0 = t; }
      state.lastCycle = cycle;
      if (state.active && t - state.t0 > 4.5 + L / 22 + 1) state.active = false;
      for (let k = 0; k < n; k++) { pose(k, t); im.setMatrixAt(k, m4); }
      im.instanceMatrix.needsUpdate = true;
    };
    for (let k = 0; k < n; k++) { pose(k, 0); im.setMatrixAt(k, m4); }
    return { update };
  })();

  /* ---------------- fog: closer and green at the bottom of a sima, dark inside the caves ---------------- */
  // Hooked on the terrain, which is always drawn, so it follows whichever camera renders.
  {
    const pitC = col(MAP.fog.pit.color), caveC = col(MAP.fog.cave.color);
    let outside = null, outNear = 0, outFar = 0, written = null;
    terrainMesh.onBeforeRender = (renderer, root, camera) => {
      const fog = root.fog; if (!fog?.isFog) return;
      if (!outside || !fog.color.equals(written)) { outside = fog.color.clone(); outNear = fog.near; outFar = fog.far; }
      const cp = camera.position;
      let cv = 0;
      const c = sampleR(CR, cp.x, cp.z);
      if (c.i >= 0) {
        const yb = roadY[c.i] - 0.6;
        cv = (1 - sstep(caveW(c.i) - 1, caveW(c.i) + 4, c.dist)) * (cp.y < yb + caveH(c.i) + 2 && cp.y > yb - 6 ? 1 : 0);
        for (const s of mouthFaces) if (Math.abs(c.i - s.i) < 25) cv *= sstep(-3, 10, (cp.x - s.f.p.x) * s.into.x + (cp.z - s.f.p.z) * s.into.z);
      }
      const top = plateauH(cp.x, cp.z), pit = (natural(cp.x, cp.z) < top - 10 ? 1 : 0) * sstep(top - 4, top - 30, cp.y) * (1 - cv);
      fog.color.copy(outside).lerp(pitC, pit * 0.6).lerp(caveC, cv); written = fog.color.clone();
      fog.near = lerp(lerp(outNear, MAP.fog.pit.near * 4, pit), MAP.fog.cave.near, cv);
      fog.far = lerp(lerp(outFar, MAP.fog.pit.far * 2, pit), MAP.fog.cave.far, cv);
      if (root.background?.isColor) root.background.copy(fog.color);
    };
  }

  /* ---------------- cars: sheer edges and gallery walls hold them ---------------- */
  // Past a drop the heightfield is the ring below; over the galleries it is
  // the cave floor. Neither may be reached by leaving the road sideways.
  function outside(x, z, y) {
    const r = roadSampleAt(x, z, y); if (!r) return 0;
    if (r.cave) return Math.max(0, r.dist - (caveW(r.i) - 1.5));
    const f = roadFrame(r.i), side = (x - f.p.x) * f.n.x + (z - f.p.z) * f.n.z < 0 ? 1 : 2;
    let over = dropSide[r.i] & side ? Math.max(0, r.dist - (HW0 + 0.6)) : 0;
    const cv = sampleR(CR, x, z);
    if (cv.i >= 0 && cv.dist < caveW(cv.i) + 1 && y > roadY[cv.i] + 8) over = Math.max(over, r.dist - (HW0 + 2));
    return over;
  }
  function constrainMotion(c, previous) {
    const now = outside(c.x, c.z, c.y); if (now <= 0 || now <= outside(previous.x, previous.z, c.y)) return;
    if (outside(c.x, previous.z, c.y) <= 0) { c.z = previous.z; c.vz = 0; }
    else if (outside(previous.x, c.z, c.y) <= 0) { c.x = previous.x; c.vx = 0; }
    else { c.x = previous.x; c.z = previous.z; c.vx = 0; c.vz = 0; }
  }

  /* ---------------- per-frame updates ---------------- */
  function update(t) {
    uTime.value = t;
    waterMats.forEach(m => (m.uniforms.uT.value = t));
    beam.m.material.uniforms.uT.value = t;
    { const p = beam.motes.geometry.attributes.position; beam.seeds.forEach((s, k) => { const h = (s.h + t * s.sp) % 45, q = beam.base.clone().addScaledVector(SUN_DIR, h); p.setXYZ(k, q.x + Math.cos(s.a + t * 0.1) * s.r, q.y, q.z + Math.sin(s.a + t * 0.1) * s.r); }); p.needsUpdate = true; }
    birds.forEach(b => {
      const a = b.ph + t * b.sp, p = V3(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(t * 0.5 + b.ph) * b.bob, b.c.z + Math.sin(a) * b.r);
      const ahead = V3(b.c.x + Math.cos(a + 0.05 * Math.sign(b.sp)) * b.r, p.y, b.c.z + Math.sin(a + 0.05 * Math.sign(b.sp)) * b.r);
      b.g.position.copy(p); b.g.lookAt(ahead); b.g.rotateZ(-0.35 * Math.sign(b.sp));
      const flap = Math.max(0, Math.sin(t * b.fl + b.ph)) * 0.6 - 0.12; b.wings.forEach(w => (w.pivot.rotation.z = w.s * flap));
    });
    bats.update(t);
    mist.forEach(m => {
      if (m.orbit) { const a = m.orbit.a + t * 0.01; m.s.position.set(m.orbit.C.x + Math.cos(a) * m.orbit.r, m.y0 + Math.sin(t * 0.2 + m.ph) * 2, m.orbit.C.z + Math.sin(a) * m.orbit.r); }
      else { m.s.position.x = m.x0 + Math.sin(t * 0.03 + m.ph) * 30; m.s.position.y = m.y0 + Math.sin(t * 0.2 + m.ph) * 2; }
    });
    spray.forEach(s => { const k = (t * s.userData.sp * 0.5 + s.userData.ph) % 1; s.position.y = s.userData.y0 + k * 1.6; s.material.opacity = 0.5 * (1 - k); });
    { const p = banner.geometry.attributes.position, base0 = banner.userData.base; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(t * 3 + base0[i * 3] * 0.6) * 0.18); p.needsUpdate = true; }
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
  return { group: scene, groundAt: physicalGround, update, constrainMotion };
}
