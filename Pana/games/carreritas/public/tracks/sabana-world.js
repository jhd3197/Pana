import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import * as THREE from 'three';
import { disposeOwned } from './reference-world.js';
import { canvasTexture } from '/engine/models/core/primitives.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { coastalVegetation } from '/engine/worlds/coastal/coastal-vegetation.js';
import { MAP, noise } from './sabana-layout.js';

// Gran Sabana: the open plateau under the tepuyes. Moriche streams, the red
// jasper ford, Salto Kama's gorge, Kumarakapay and the afternoon storm.
export function createWorld(scene, layout, roadDistance) {
  const vegetation = coastalVegetation(scene, 1, roadDistance);
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const rand = rng(MAP.seed);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const d = new THREE.Object3D();
  const uTime = { value: 0 };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const SUN_DIR = new THREE.Vector3(-0.48, 0.72, 0.5).normalize();

  const { SIZE, X0, Z0, NR, STEP, RP, RR, hwL, hwR, roadY, elev, ford, roadFrame, roadAt, lateralHW, idxNear, sampleR, inArea,
    TEP, plain, rivers, LAG, PADS, terrainH, groundH, nearRiver } = layout;

  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => canvasTexture(w, h, draw, { srgb });
  // red dirt road with two wheel tracks, gravel and ruts
  const dirtTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#c47a4a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rand(); c.fillStyle = v < 0.4 ? `rgba(120,60,30,${rr(0.1, 0.3).toFixed(2)})` : v < 0.8 ? `rgba(235,190,140,${rr(0.1, 0.25).toFixed(2)})` : `rgba(60,40,30,${rr(0.2, 0.5).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 4), rr(1, 4)); }
    for (const x of [0.28, 0.72]) { const g = c.createLinearGradient(w * x - 24, 0, w * x + 24, 0); g.addColorStop(0, 'rgba(240,200,160,0)'); g.addColorStop(0.5, 'rgba(240,200,160,0.35)'); g.addColorStop(1, 'rgba(240,200,160,0)'); c.fillStyle = g; c.fillRect(w * x - 24, 0, 48, h); }
    for (let k = 0; k < 10; k++) { c.strokeStyle = 'rgba(110,55,25,0.45)'; c.lineWidth = rr(2, 4); let x = rr(10, w - 10), y = rr(0, h); c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 6; j++) { x += rr(-8, 8); y += rr(10, 24); c.lineTo(x, y); } c.stroke(); }
  });
  const plankTex = canvasTex(256, 256, (c, w, h) => { for (let y = 0; y < h; y += 16) { c.fillStyle = `hsl(${rr(24, 32).toFixed(0)}, ${rr(26, 38).toFixed(0)}%, ${rr(30, 42).toFixed(0)}%)`; c.fillRect(0, y, w, 16); c.fillStyle = 'rgba(40,24,10,0.5)'; c.fillRect(0, y + 14, w, 2); } });
  const grassTex = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 34; i++) { const x = rr(8, w - 8), lean = rr(-20, 20), top = rr(6, 50); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - 3, h); c.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); c.lineTo(x + 3, h); c.fill(); } });
  const cloudTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const rainTex = canvasTex(128, 512, (c, w, h) => { c.clearRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const x = rand() * w, y = rand() * h, l = rr(20, 70); c.strokeStyle = `rgba(255,255,255,${rr(0.15, 0.5).toFixed(2)})`; c.lineWidth = rr(1, 2); c.beginPath(); c.moveTo(x, y); c.lineTo(x - l * 0.08, y + l); c.stroke(); } });
  const jasperTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#b8382a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) { c.fillStyle = pick(['#e0603a', '#8a2216', '#f08a50', '#5a1a14', '#c84a30', '#d8a080']); c.beginPath(); c.ellipse(rand() * w, rand() * h, rr(4, 26), rr(3, 14), rand() * PI, 0, TAU); c.fill(); }
    for (let i = 0; i < 40; i++) { c.strokeStyle = 'rgba(40,10,6,0.5)'; c.lineWidth = rr(1, 3); c.beginPath(); let x = rand() * w, y = rand() * h; c.moveTo(x, y); for (let j = 0; j < 4; j++) { x += rr(-20, 20); y += rr(-20, 20); c.lineTo(x, y); } c.stroke(); }
  });
  const textBoard = (w, h, bg, draw) => canvasTex(w, h, c => { c.fillStyle = bg; c.fillRect(0, 0, w, h); draw(c, w, h); });

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
        float sw = sin(uTime * 1.6 + ip.x * 0.05 + ip.z * 0.035) * 0.6 + sin(uTime * 3.1 + ip.x * 0.17 - ip.z * 0.11) * 0.25;
        float k = ${base.toFixed(3)} + max(position.y, 0.0) * ${perY.toFixed(3)};
        transformed.x += sw * k; transformed.z += sw * k * 0.5;`);
    };
    mat.customProgramCacheKey = () => 'sabana-windy' + base + '_' + perY;
    return mat;
  }

  /* ---------------- terrain ---------------- */
  const cGold = col('#a8983e'), cGreen = col('#6a8a2e'), cDry = col('#b8a050'), cRock = col('#3a3632'), cJasper = col('#b4402c'), cDark = col('#4a6a2a'), cVerge = col('#c87a4a');
  const groundMats = [];
  // The far plain samples every 96 m: fine noise there would only alias into
  // speckles, so it takes the broad tone of the near grass.
  function paintGround(x, z, y, slope, tmp, coarse = false) {
    const n = coarse ? 0.5 + 0.25 * noise(x * 0.2, z * 0.2) : 0.5 + 0.5 * noise(x * 1.6, z * 1.6), n2 = coarse ? 0.82 : 0.5 + 0.5 * noise(x * 4 + 30, z * 4);
    tmp.copy(cGreen).lerp(cGold, n * 0.75).lerp(cDry, sstep(0.7, 0.95, n2) * 0.5);
    tmp.lerp(cRock, sstep(0.55, 0.8, slope) * 0.85);
    if (!inArea(x, z)) return tmp;
    for (const rv of rivers) { const v = sampleR(rv.ras, x, z); if (v.i < 0) continue; const hw = rv.R.gorge || rv.R.half; if (rv.R.kind === 'jaspe') tmp.lerp(cJasper, 1 - sstep(hw - 1, hw + 3, v.dist)); else if (rv.R.gorge) { tmp.lerp(cRock, 1 - sstep(hw - 1, hw + 1.5, v.dist)); tmp.lerp(cDark, (1 - sstep(hw + 1, hw + 14, v.dist)) * 0.6); } else tmp.lerp(cDark, (1 - sstep(hw + 2, hw + 16, v.dist)) * 0.7); }
    return tmp;
  }
  const addTerrain = (x0, z0, w, dpt, step, fn, road) => {
    const geo = new THREE.PlaneGeometry(w, dpt, Math.round(w / step), Math.round(dpt / step)); geo.rotateX(-PI / 2); geo.translate(x0 + w / 2, 0, z0 + dpt / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, fn(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i); paintGround(x, z, pos.getY(i), 1 - nrm.getY(i), tmp, !road);
      if (road) { const r = sampleR(RR, x, z); if (r.i >= 0) tmp.lerp(cVerge, (1 - sstep(hwR[r.i], hwR[r.i] + 3.5, r.dist)) * 0.85); }
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }); groundMats.push(mat);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
  };
  addTerrain(X0, Z0, SIZE, SIZE, 3, terrainH, true);
  // The far plain's vertices land exactly on the play area's edges, so the
  // two meshes share their boundary instead of leaving a trench between them.
  {
    const step = 96, n = 116, fx0 = X0 - step * n, fz0 = Z0 - step * n, span = SIZE + 2 * step * n;
    addTerrain(fx0, fz0, span, span, step, (x, z) => (inArea(x, z, 1) ? -60 : plain(x, z) - 0.3), false);
  }

  /* ---------------- the tepuyes: sheer pink-orange walls with a flat dark top, clouds sitting on them ---------------- */
  const tepClouds = [];
  for (const T of TEP) {
    const shape = new THREE.Shape(T.pts.map(p => new THREE.Vector2(p.x, -p.y)));
    const base = T.talus * 0.85, geo = new THREE.ExtrudeGeometry(shape, { depth: T.h, steps: 10, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-PI / 2); geo.translate(0, base, 0);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
    const wallA = col('#e8906a'), wallB = col('#7a4436'), wallC = col('#ffb88a'), topC = col('#3e5232');
    // a ragged top edge and walls that lean in a little
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), u = (y - base) / T.h; const k = 1 - 0.04 * u; pos.setXYZ(i, T.c[0] + (x - T.c[0]) * k, y + (u > 0.999 ? (25 * Math.sin(x * 0.004) + 18 * Math.sin(z * 0.009 + x * 0.002)) * MAP.tepuyScale : 0), T.c[1] + (z - T.c[1]) * k); }
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), u = Math.min(1, (y - base) / T.h), a = Math.atan2(z - T.c[1], x - T.c[0]);
      const streak = Math.pow(0.5 + 0.5 * Math.sin(a * 140 + Math.sin(a * 37) * 3), 2), band = 0.5 + 0.5 * Math.sin(u * 22 + a * 3);
      c.copy(wallB).lerp(wallA, (0.25 + 0.75 * streak) * sstep(0.1, 0.6, u)).lerp(wallC, sstep(0.7, 1, u) * 0.7 * streak).multiplyScalar(0.8 + 0.2 * band);
      if (u > 0.999) c.copy(topC);
      if (u < 0.12) c.lerp(col('#5a6a3a'), (1 - u / 0.12) * 0.7);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    m.name = `tepuy-${T.name}`; scene.add(m);
    const cm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.85, depthWrite: false });
    for (let k = 0; k < 18; k++) { const p = pick(T.pts), s = new THREE.Sprite(cm); s.position.set(lerp(T.c[0], p.x, rr(0.1, 0.85)), base + T.h + rr(12, 60), lerp(T.c[1], p.y, rr(0.1, 0.85))); const sc = rr(170, 380); s.scale.set(sc, sc * 0.35, 1); s.userData = { x0: s.position.x, ph: rand() * TAU }; scene.add(s); tepClouds.push(s); }
  }
  // big white clouds over the savanna
  const skyClouds = [], skyCloudMat = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  for (let k = 0; k < 50; k++) { const a = rand() * TAU, r = rr(1200, 4200), s = new THREE.Sprite(skyCloudMat); s.position.set(Math.cos(a) * r, rr(420, 820), Math.sin(a) * r); const sc = rr(320, 720); s.scale.set(sc, sc * 0.5, 1); s.userData = { x0: s.position.x }; scene.add(s); skyClouds.push(s); }

  /* ---------------- water: tea-coloured streams, the clear sheet over the jasper, the Salto Kama ---------------- */
  const waterMats = [];
  function waterMaterial(speed, alpha = 0.85, fall = 0, clear = 0) {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSpeed: { value: speed }, uSun: { value: SUN_DIR }, uA: { value: alpha }, uFall: { value: fall }, uClear: { value: clear }, uDark: { value: 0 } }]),
      vertexShader: `attribute float foam; varying vec2 vUv; varying float vFoam; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vFoam = foam; vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform float uSpeed; uniform vec3 uSun; uniform float uA; uniform float uFall; uniform float uClear; uniform float uDark; varying vec2 vUv; varying float vFoam; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          float flow = vUv.y - uT * uSpeed * (1.0 + vFoam * 2.5);
          float a = sin(vUv.x * 14.0 + sin(vUv.y * 0.35 + uT) * 2.0 + flow * 1.3), b = sin(vUv.x * 5.0 - flow * 2.0 + sin(vUv.y * 0.2) * 3.0);
          float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
          vec3 c = mix(vec3(0.08, 0.035, 0.015), vec3(0.32, 0.15, 0.05), 0.45 + 0.3 * a);
          c = mix(c, vec3(0.75, 0.82, 0.8), uClear * 0.35);
          c += smoothstep(0.6, 1.0, a * 0.5 + b * 0.5) * 0.08;
          vec3 V = normalize(cameraPosition - vW), Nn = normalize(vec3(a * 0.08, 1.0, b * 0.08));
          c += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-uSun, Nn), V), 0.0), 90.0) * 1.4 * (1.0 - uDark);
          float fres = pow(1.0 - max(V.y, 0.0), 3.0); c = mix(c, vec3(0.55, 0.72, 0.92) * (1.0 - 0.5 * uDark), fres * 0.55);
          c = mix(c, vec3(0.97, 0.96, 0.92), clamp(vFoam * (0.6 + 0.4 * b), 0.0, 1.0));
          float alpha = uA * (0.55 + 0.45 * edge);
          if (uFall > 0.5) {
            float y = vUv.y * 1.6 - uT * 2.4;
            float s1 = sin(vUv.x * 60.0 + sin(vUv.x * 13.0) * 4.0), s2 = sin(vUv.x * 23.0 + y * 0.35) * sin(y * 1.7 + vUv.x * 9.0);
            float st = smoothstep(0.2, 0.95, s1 * 0.55 + s2 * 0.45);
            c = mix(vec3(0.82, 0.78, 0.7), vec3(1.0), 0.4 + 0.6 * st);
            alpha = uA * (0.6 + 0.4 * st) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          }
          gl_FragColor = vec4(c, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    waterMats.push(m); return m;
  }
  function ribbon(rows, mat) {
    const pos = [], uv = [], foam = [], idx = [];
    let dist = 0;
    rows.forEach((r, i) => {
      if (i) dist += r.c.distanceTo(rows[i - 1].c);
      for (const s of [-1, 1]) { const v = r.c.clone().addScaledVector(r.side, s * r.w); pos.push(v.x, v.y, v.z); uv.push((s + 1) / 2, dist * 0.22); foam.push(r.foam || 0); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('foam', new THREE.Float32BufferAttribute(foam, 1)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; m.raycast = () => {}; scene.add(m); return m;
  }
  const TEA = waterMaterial(0.8, 0.9), CLEAR = waterMaterial(1.4, 0.62, 0, 1);
  for (const rv of rivers) {
    const rows = [], jas = rv.R.kind === 'jaspe';
    for (let i = 0; i <= rv.N; i++) {
      const p = rv.P[i], t = rv.P[Math.min(rv.N, i + 1)].clone().sub(rv.P[Math.max(0, i - 1)]).normalize();
      let y = rv.Y[i] + (jas ? 0.32 : 0.15);
      // Over the ford the clear sheet runs a few centimetres above the road.
      if (jas) { const r = sampleR(RR, p.x, p.z); if (r.i >= 0 && r.dist < hwR[r.i] + 6) y = Math.max(y, roadY[r.i] + 0.17); }
      rows.push({ c: p.clone().setY(y), side: V3(-t.z, 0, t.x), w: rv.R.half + 0.6, foam: jas ? 0.25 + 0.25 * Math.sin(i * 0.9) : rv.R.gorge && i < 8 ? 0.5 - i * 0.06 : 0.02 });
    }
    ribbon(rows, jas ? CLEAR : TEA);
  }
  if (LAG) { const m = new THREE.Mesh(new THREE.CircleGeometry(LAG[2], 40), TEA); m.rotation.x = -PI / 2; m.position.set(LAG[0], rivers[0].Y[rivers[0].N] + 0.15, LAG[1]); m.renderOrder = 2; scene.add(m); }
  // the jasper: steps of red stone across the stream bed
  {
    const J = rivers.find(rv => rv.R.kind === 'jaspe'), jm = new THREE.MeshStandardMaterial({ map: jasperTex, roughness: 0.35 });
    const list = [];
    for (let i = 2; i < J.N; i += 3) { const p = J.P[i], t = J.P[Math.min(J.N, i + 1)].clone().sub(p).normalize(); const r = sampleR(RR, p.x, p.z); if (r.i >= 0 && r.dist < hwR[r.i] + 3) continue; d.position.set(p.x, J.Y[i] + 0.08, p.z); d.quaternion.setFromAxisAngle(UP, Math.atan2(t.x, t.z)); d.scale.set(J.R.half * 2.2, 0.35, rr(0.6, 1.6)); d.updateMatrix(); list.push(d.matrix.clone()); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), jm, list.length); list.forEach((m, k) => im.setMatrixAt(k, m)); im.receiveShadow = true; scene.add(im);
    const bed = []; for (let i = 0; i <= J.N; i++) { const p = J.P[i], t = J.P[Math.min(J.N, i + 1)].clone().sub(J.P[Math.max(0, i - 1)]).normalize(), s = V3(-t.z, 0, t.x); bed.push({ a: p.clone().addScaledVector(s, -J.R.half - 0.8).setY(J.Y[i] - 0.05), b: p.clone().addScaledVector(s, J.R.half + 0.8).setY(J.Y[i] - 0.05) }); }
    stripMesh(bed, new THREE.MeshStandardMaterial({ map: jasperTex, roughness: 0.4, side: THREE.DoubleSide }), 6);
  }
  // Salto Kama: a flat rock lip, a wide curtain into the gorge, spray and a rainbow
  const spray = [];
  let rainbow = null;
  {
    const F = MAP.fall, kama = rivers.find(rv => rv.R.name === 'Río Kama'), gorge = rivers.find(rv => rv.R.gorge);
    const top = V3(F.lip[0], kama.Y[kama.N] + 0.15, F.lip[1]), bot = V3(F.base[0], gorge.Y[0] + 0.2, F.base[1]);
    const dir = bot.clone().sub(top).setY(0).normalize(), side = V3(-dir.z, 0, dir.x), rows = [];
    for (let k = 0; k <= 30; k++) { const t = k / 30; rows.push({ c: top.clone().lerp(bot, Math.sqrt(t) * 0.8).setY(lerp(top.y, bot.y, t * t)), side, w: F.width * (0.55 + t * 0.25), foam: 1 }); }
    ribbon(rows, waterMaterial(2.6, 0.95, 1));
    const lip = new THREE.Mesh(new THREE.BoxGeometry(F.width * 2.6, 3, 8), new THREE.MeshStandardMaterial({ color: col('#4a3a30'), roughness: 0.9 })); lip.position.copy(top).setY(top.y - 1.6).addScaledVector(dir, -3); lip.rotation.y = Math.atan2(dir.x, dir.z); lip.castShadow = true; scene.add(lip);
    const sm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.5, depthWrite: false });
    for (let k = 0; k < 26; k++) { const s = new THREE.Sprite(sm); s.position.copy(bot).add(V3(rr(-14, 14), rr(1, 12), rr(-8, 10))); const sc = rr(8, 18); s.scale.set(sc, sc * 0.7, 1); s.userData = { y0: s.position.y, ph: rand() * TAU }; scene.add(s); spray.push(s); }
    const rb = canvasTex(256, 128, (c, w, h) => { c.clearRect(0, 0, w, h); ['#ff3030', '#ff9a20', '#ffe030', '#40d040', '#3080ff', '#8040e0'].forEach((cc, k) => { c.strokeStyle = cc; c.globalAlpha = 0.45; c.lineWidth = 6; c.beginPath(); c.arc(w / 2, h, h - 8 - k * 6, PI, TAU); c.stroke(); }); });
    rainbow = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshBasicMaterial({ map: rb, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    rainbow.position.copy(bot).add(V3(0, 6, 10)); rainbow.lookAt(V3(...MAP.lookout.view)); rainbow.raycast = () => {}; scene.add(rainbow);
  }

  /* ---------------- road surface and the plank bridge ---------------- */
  function stripMesh(rows, mat, vScale) {
    const pos = [], uv = [], idx = [];
    let dist = 0;
    rows.forEach((r, i) => { if (i) dist += r.a.distanceTo(rows[i - 1].a); pos.push(r.a.x, r.a.y, r.a.z, r.b.x, r.b.y, r.b.z); uv.push(0, dist / vScale, 1, dist / vScale); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; scene.add(m); return m;
  }
  function runs(keyOf, build) {
    let i0 = 0; while (keyOf(i0) === keyOf((i0 - 1 + NR) % NR) && i0 < NR - 1) i0++;
    let cur = keyOf(i0), list = [];
    for (let n = 0; n <= NR; n++) { const i = (i0 + n) % NR, k = keyOf(i); if (k !== cur) { list.push(i); build(cur, list); cur = k; list = []; } list.push(i); }
    if (list.length > 1) build(cur, list);
  }
  const ROAD = new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const PLANKS = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85, side: THREE.DoubleSide });
  runs(i => (elev[i] ? 'p' : 'd'), (k, list) => {
    const rows = list.map(i => ({ a: roadAt(i, -hwL[i] - (k === 'p' ? 0.4 : 0), 0.12), b: roadAt(i, hwR[i] + (k === 'p' ? 0.4 : 0), 0.12) }));
    stripMesh(rows, k === 'p' ? PLANKS : ROAD, k === 'p' ? 5 : 20);
    if (k === 'p') { stripMesh(rows.map(r => ({ a: r.a, b: r.a.clone().setY(r.a.y - 0.8) })), PLANKS, 5); stripMesh(rows.map(r => ({ a: r.b, b: r.b.clone().setY(r.b.y - 0.8) })), PLANKS, 5); }
  });

  /* ---------------- instance buffers ---------------- */
  const _bx = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
  const placeBeam = (a, b, tx, tz) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length(); dir.normalize();
    _bx.crossVectors(dir, UP); if (_bx.lengthSq() < 1e-6) _bx.set(1, 0, 0); _bx.normalize(); _bz.crossVectors(_bx, dir).normalize();
    _bm.makeBasis(_bx, dir, _bz); d.quaternion.setFromRotationMatrix(_bm); d.position.copy(a).addScaledVector(dir, len / 2); d.scale.set(tx, len, tz); d.updateMatrix(); return d.matrix.clone();
  };
  const beams = { wood: [] };
  const inst = { box: [], grass: [], rock: [], termite: [], thatch: [], wall: [], crowdBody: [], crowdHead: [] };
  const push = (list, pos, quat, scale, color) => { d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const freeOf = (x, z, m) => { const r = sampleR(RR, x, z); return !(r.i >= 0 && r.dist < hwR[r.i] + m); };
  const taken = [];
  const clearSpot = (x, z, r) => !taken.some(t => Math.hypot(t[0] - x, t[1] - z) < t[2] + r);
  const take = (x, z, r) => taken.push([x, z, r]);
  function tries(n, fn) { for (let i = 0, k = 0; i < n && k < n * 30; k++) if (fn()) i++; }

  /* ---- bridge rails, the gorge lookout, the start banner ---- */
  {
    for (const side of [-1, 1]) { let prev = null; for (let i = 0; i < NR; i += 3) { if (!elev[i]) { prev = null; continue; } const top = roadAt(i, side * (lateralHW(i, side) + 0.6), 1.0); beams.wood.push(placeBeam(top.clone().setY(top.y - 2.6), top, 0.18, 0.18)); if (prev) beams.wood.push(placeBeam(prev, top, 0.1, 0.16)); prev = top; } }
    // the lookout: a timber deck on the rim with a rail
    const [lx, lz] = MAP.lookout.at, ly = groundH(lx, lz);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 7), PLANKS); deck.position.set(lx + 4, ly + 0.3, lz); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
    for (let k = -3.5; k <= 3.5; k += 1) { const p = V3(lx + 9, ly + 0.5, lz + k); beams.wood.push(placeBeam(p, p.clone().setY(p.y + 1.1), 0.12, 0.12)); }
    beams.wood.push(placeBeam(V3(lx + 9, ly + 1.6, lz - 3.5), V3(lx + 9, ly + 1.6, lz + 3.5), 0.1, 0.14));
    for (const s of [-1, 1]) beams.wood.push(placeBeam(V3(lx - 1, ly + 1.6, lz + s * 3.5), V3(lx + 9, ly + 1.6, lz + s * 3.5), 0.1, 0.14));
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 0.1), new THREE.MeshStandardMaterial({ map: textBoard(512, 128, '#6a4426', (c, w, h) => { c.fillStyle = '#fff4dc'; c.font = 'bold 66px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Salto Kama', w / 2, h / 2 + 2); }) }));
    sign.position.set(lx - 1, ly + 2.4, lz - 4.2); sign.rotation.y = -PI / 2; scene.add(sign);
    beams.wood.push(placeBeam(V3(lx - 1, ly - 0.2, lz - 4.2), V3(lx - 1, ly + 2, lz - 4.2), 0.14, 0.14));
    take(lx + 4, lz, 7);
    // Two timber posts with a woven banner a little past the race's own start gantry.
    const ib = Math.round(36 / STEP), fb = roadFrame(ib), qb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fb.n, UP, fb.t.clone().negate()));
    const span = hwR[ib] + 1.6;
    const bannerTex = canvasTex(1024, 160, (c, w, h) => { c.fillStyle = '#c8a050'; c.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 20) { c.fillStyle = 'rgba(90,60,20,0.25)'; c.fillRect(x, 0, 8, h); } c.fillStyle = '#7a2a1a'; for (let x = 0; x < w; x += 60) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 30, 22); c.lineTo(x + 60, 0); c.fill(); c.beginPath(); c.moveTo(x, h); c.lineTo(x + 30, h - 22); c.lineTo(x + 60, h); c.fill(); } c.font = 'bold 80px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#3a1a0a'; c.fillText('PANA GRAN SABANA', w / 2, h / 2 + 4); });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(span * 2, 2.6), new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide })); banner.position.copy(roadAt(ib, 0, 7.2)); banner.quaternion.copy(qb); scene.add(banner);
    for (const s of [-1, 1]) { const b = roadAt(ib, s * span, 0); b.y = groundH(b.x, b.z); beams.wood.push(placeBeam(b.clone().setY(b.y - 0.3), b.clone().setY(b.y + 8.6), 0.45, 0.45)); }
  }

  /* ---------------- vegetation: moriche palms on the streams, gallery forest, lone trees, grass, termite mounds, black rocks ---------------- */
  // Every tree is a library model: moriches on the streams, ceibas and mangos
  // in the gallery forest, lone mangos out on the savanna.
  const roadGap = (x, z) => sampleR(RR, x, z).dist;
  const moriche = (x, z, y0) => vegetation.add('moriche', x, z, y0 ?? groundH(x, z), rr(1.2, 1.8), roadGap(x, z));
  const tree = (x, z, big) => vegetation.add(big ? 'tree' : 'mango', x, z, groundH(x, z), big ? rr(0.85, 1.1) : rr(0.7, 0.95), roadGap(x, z));
  {
    const Z = MAP.zones;
    for (const rv of rivers) {
      if (!rv.R.palms) continue;
      for (let i = 0; i < rv.N; i += 3) { const p = rv.P[i], t = rv.P[Math.min(rv.N, i + 1)].clone().sub(p).normalize(); for (const s of [-1, 1]) { if (rand() < 0.3) continue; const o = rv.R.half + rr(2, 7), x = p.x - t.z * s * o, z = p.z + t.x * s * o; if (!inArea(x, z, 2) || !freeOf(x, z, 4) || !clearSpot(x, z, 2)) continue; moriche(x, z); } }
    }
    if (LAG) for (let k = 0; k < 18; k++) { const a = rand() * TAU, x = LAG[0] + Math.cos(a) * LAG[2] * rr(1.1, 1.4), z = LAG[1] + Math.sin(a) * LAG[2] * rr(1.1, 1.4); if (freeOf(x, z, 3)) moriche(x, z); }
    // gallery forest: thick along the jaspe and both rims of the gorge
    tries(Z.gallery, () => {
      const rv = rand() < 0.45 ? rivers.find(r => r.R.kind === 'jaspe') : rivers.find(r => r.R.gorge || r.R.name === 'Río Kama'), i = Math.floor(rand() * rv.N), p = rv.P[i], t = rv.P[Math.min(rv.N, i + 1)].clone().sub(p).normalize();
      const s = rand() < 0.5 ? -1 : 1, o = (rv.R.gorge || rv.R.half) + rr(rv.R.kind === 'jaspe' ? 7 : 2, 26), x = p.x - t.z * s * o, z = p.z + t.x * s * o;
      if (!inArea(x, z, 5) || !freeOf(x, z, 3.5) || !clearSpot(x, z, 2) || nearRiver(x, z, 1)) return false;
      if (Math.hypot(x - MAP.lookout.at[0] - 4, z - MAP.lookout.at[1]) < 12) return false;
      tree(x, z, rand() < 0.4); return true;
    });
    tries(Z.loneTrees, () => { const x = rr(X0 + 10, X0 + SIZE - 10), z = rr(Z0 + 10, Z0 + SIZE - 10); if (!freeOf(x, z, 10) || !clearSpot(x, z, 6) || nearRiver(x, z, 8)) return false; tree(x, z, rand() < 0.6); return true; });
    tries(Z.termites, () => { const x = rr(X0 + 10, X0 + SIZE - 10), z = rr(Z0 + 10, Z0 + SIZE - 10); if (!freeOf(x, z, 3) || nearRiver(x, z, 4)) return false; const s = rr(0.6, 1.4); push(inst.termite, V3(x, groundH(x, z) - 0.1, z), qYaw(rand() * TAU), S.set(s * 0.9, s * rr(1.2, 2), s * 0.9), col('#b8683e').offsetHSL(0, 0, rr(-0.06, 0.04))); return true; });
    tries(Z.rocks, () => { const x = rr(X0 + 10, X0 + SIZE - 10), z = rr(Z0 + 10, Z0 + SIZE - 10); if (!freeOf(x, z, 4) || nearRiver(x, z, 2) || !clearSpot(x, z, 3)) return false; const y = groundH(x, z); for (let k = 0; k < 4; k++) { const s = rr(0.8, 3.2), rx = x + rr(-3, 3), rz = z + rr(-3, 3); if (!freeOf(rx, rz, 1 + s * 1.4)) continue; push(inst.rock, V3(rx, y + s * 0.1, rz), qEuler(rr(-0.3, 0.3), rand() * TAU, rr(-0.3, 0.3)), S.set(s * 1.4, s * 0.55, s), col('#2a2826').offsetHSL(0, 0, rr(-0.03, 0.05))); } return true; });
    // rocks along the gorge rim
    const G = rivers.find(r => r.R.gorge); for (let i = 0; i < G.N; i += 2) { const p = G.P[i], t = G.P[Math.min(G.N, i + 1)].clone().sub(p).normalize(); for (const s of [-1, 1]) { const o = G.R.gorge + rr(-0.5, 2), x = p.x - t.z * s * o, z = p.z + t.x * s * o; if (!inArea(x, z, 2) || !freeOf(x, z, 4)) continue; const sz = rr(1, 2.6); push(inst.rock, V3(x, groundH(x, z) - 0.3, z), qEuler(rr(-0.2, 0.2), rand() * TAU, 0), S.set(sz * 1.6, sz * 0.6, sz), col('#3a3430')); } }
    tries(Z.grass, () => {
      const x = rr(X0 + 4, X0 + SIZE - 4), z = rr(Z0 + 4, Z0 + SIZE - 4); if (!freeOf(x, z, 1.2) || nearRiver(x, z, 0.5)) return false;
      const y = terrainH(x, z), s = rr(0.7, 1.5);
      push(inst.grass, V3(x, y - 0.05, z), qYaw(rand() * TAU), S.set(s * 1.6, s, s * 1.6), col(pick(['#d8c060', '#b8b850', '#e8cc78', '#9ab848'])).offsetHSL(rr(-0.02, 0.02), rr(-0.1, 0.05), rr(-0.06, 0.06)));
      return true;
    });
    // clumps of morichal and trees out on the far plain
    tries(Z.farTrees, () => { const a = rand() * TAU, r = rr(600, 3000), x = Math.cos(a) * r, z = Math.sin(a) * r; if (inArea(x, z, 10)) return false; vegetation.add('tree', x, z, plain(x, z), rr(1, 1.5), 100); return true; });
  }

  /* ---------------- Kumarakapay: round houses with conical palm roofs around a red dirt square, a small church, kids ---------------- */
  {
    const [vx, vz, vr] = MAP.village.square, vy = PADS[0].y;
    const sq = new THREE.Mesh(new THREE.CylinderGeometry(vr, vr + 2, 0.4, 40), new THREE.MeshStandardMaterial({ color: col('#c8683e'), roughness: 1 })); sq.position.set(vx, vy - 0.05, vz); sq.receiveShadow = true; scene.add(sq);
    take(vx, vz, vr);
    const house = (x, z, r) => {
      const y = groundH(x, z) - 0.2, wh = rr(2.2, 2.8);
      push(inst.wall, V3(x, y + wh / 2, z), qYaw(rand() * TAU), S.set(r, wh, r), col(pick(['#d8784a', '#e8d8b8', '#c8603a', '#f2eade'])));
      push(inst.thatch, V3(x, y + wh, z), qYaw(rand() * TAU), S.set(r + 0.9, r * rr(1.5, 1.9), r + 0.9), col(pick(['#b8984e', '#a88a4a', '#c8a85a'])));
      push(inst.box, V3(x, y + wh + r * 1.8, z), Q, S.set(0.12, 0.8, 0.12), col('#5a4030'));
      take(x, z, r + 2);
    };
    let n = 0;
    for (let k = 0; k < 200 && n < MAP.village.houses; k++) {
      const a = rand() * TAU, rad = rr(vr + 18, vr + 70), x = vx + Math.cos(a) * rad, z = vz + Math.sin(a) * rad, r = rr(3.2, 5.2);
      if (!freeOf(x, z, r + 2) || !clearSpot(x, z, r + 1) || nearRiver(x, z, 6)) continue;
      house(x, z, r); n++;
    }
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + 0.4, x = vx + Math.cos(a) * (vr - 6), z = vz + Math.sin(a) * (vr - 6), r = rr(3.6, 4.6); if (freeOf(x, z, r + 2)) house(x, z, r); }
    // the little church: white, a tin roof, a bell gable
    const [cx, cz] = MAP.village.church, cy = groundH(cx, cz) - 0.2, g = new THREE.Group(); g.position.set(cx, cy, cz); g.rotation.y = -PI / 2; scene.add(g);
    const wm = new THREE.MeshStandardMaterial({ color: col('#f2eee4'), roughness: 0.85 }), tin = new THREE.MeshStandardMaterial({ color: col('#b06a4a'), roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), dark = new THREE.MeshStandardMaterial({ color: col('#2a2018') });
    const add = (geo, m, x, y, z) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.castShadow = mm.receiveShadow = true; g.add(mm); return mm; };
    add(new THREE.BoxGeometry(8, 4.5, 14), wm, 0, 2.25, 0);
    { const s = new THREE.Shape(); s.moveTo(-5, 0); s.lineTo(5, 0); s.lineTo(0, 3); s.closePath(); const rg = new THREE.ExtrudeGeometry(s, { depth: 15, bevelEnabled: false }); rg.translate(0, 0, -7.5); add(rg, tin, 0, 4.5, 0); }
    add(new THREE.BoxGeometry(3, 3.5, 0.6), wm, 0, 8.6, 7.2); add(new THREE.BoxGeometry(1.2, 1.4, 0.7), dark, 0, 8.8, 7.2);
    add(new THREE.BoxGeometry(0.12, 1.4, 0.12), dark, 0, 11, 7.2); add(new THREE.BoxGeometry(0.7, 0.12, 0.12), dark, 0, 11.2, 7.2);
    add(new THREE.BoxGeometry(1.8, 2.8, 0.2), new THREE.MeshStandardMaterial({ color: col('#4a7ab0') }), 0, 1.4, 7.05);
    take(cx, cz, 9);
    // kids watching from the edge of the square
    const SH = ['#e8462e', '#ffd21f', '#3d7bf2', '#2a9b5a', '#ffffff', '#f08ab0'].map(col);
    for (let k = 0; k < MAP.village.kids; k++) {
      const a = rand() * TAU, x = vx + Math.cos(a) * (vr - rr(1, 4)), z = vz + Math.sin(a) * (vr - rr(1, 4)); if (!freeOf(x, z, 2)) continue;
      const s = rr(0.6, 0.85), yaw = Math.atan2(vx - x, vz - z) + PI + rr(-0.6, 0.6), y = groundH(x, z);
      push(inst.crowdBody, V3(x, y + 0.75 * s, z), qYaw(yaw), S.set(0.5 * s, 0.75 * s, 0.45 * s), pick(SH));
      push(inst.crowdHead, V3(x, y + 1.7 * s, z), qYaw(yaw), S.set(0.32 * s, 0.3 * s, 0.42 * s), col('#9a6a3e'));
    }
    for (let k = 0; k < 6; k++) { const a = rand() * TAU, x = vx + Math.cos(a) * rr(vr + 8, vr + 40), z = vz + Math.sin(a) * rr(vr + 8, vr + 40); if (freeOf(x, z, 4) && clearSpot(x, z, 3)) tree(x, z, true); }
  }

  /* ---------------- signs (wooden, painted by hand) ---------------- */
  const signWood = new THREE.MeshStandardMaterial({ color: col('#5a3a20') });
  for (const [x, z, side, text] of MAP.signs) {
    const i = idxNear(x, z), f = roadFrame(i), p0 = roadAt(i, side * (lateralHW(i, side) + 2.6)); p0.y = groundH(p0.x, p0.z);
    const tex = textBoard(1024, 256, '#6a4426', (c, w, h) => { c.strokeStyle = '#3a220e'; c.lineWidth = 14; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#fff4dc'; c.font = 'bold 100px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 4); });
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.05, 0.12), [signWood, signWood, signWood, signWood, new THREE.MeshStandardMaterial({ map: tex }), signWood]); board.position.copy(p0).setY(p0.y + 2.4); board.lookAt(board.position.clone().addScaledVector(f.t, -1)); board.castShadow = true; scene.add(board);
    for (const o of [-1.8, 1.8]) beams.wood.push(placeBeam(p0.clone().addScaledVector(f.n, o).setY(p0.y - 0.2), p0.clone().addScaledVector(f.n, o).setY(p0.y + 1.9), 0.14, 0.14));
  }

  /* ---------------- flush instances ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; scene.add(im); return im;
  }
  { const g = new THREE.PlaneGeometry(1, 1, 1, 2); g.translate(0, 0.5, 0); const g2 = g.clone(); g2.rotateY(PI / 2); flush(inst.grass, mergeGeometries([g, g2]), windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0, 0.22), false); }
  flush(inst.rock, new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, flatShading: true }));
  flush(inst.termite, new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true }));
  flush(inst.wall, new THREE.CylinderGeometry(1, 1, 1, 18), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.95 }));
  { const g = new THREE.ConeGeometry(1, 1, 18, 1); g.translate(0, 0.5, 0); flush(inst.thatch, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true })); }
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }));
  flush(inst.crowdBody, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false);
  flush(inst.crowdHead, new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 }), false);
  {
    const wood = new THREE.MeshStandardMaterial({ color: col('#6a4a2e'), roughness: 0.9 });
    if (beams.wood.length) { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), wood, beams.wood.length); beams.wood.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  }

  /* ---------------- the storm: dark clouds from the east, a curtain of rain sweeping west, a wet shiny road after ---------------- */
  // Everything follows the race clock, so every screen and replay agrees.
  // The race's own grip, light and weather are untouched: this is scenery.
  const ST = MAP.storm;
  const stormAt = t => {
    const T = ((t + ST.offset) % ST.period + ST.period) % ST.period, [s0, s1] = ST.sweep;
    const front = lerp(ST.from, ST.to, clamp((T - s0) / (s1 - s0), 0, 1)), active = T > s0 - 4 && T < s1 + ST.trail / Math.abs((ST.to - ST.from) / (s1 - s0));
    const dark = sstep(ST.darkFrom, s0 + 10, T) * (1 - sstep(s1 + 8, s1 + 30, T));
    const speed = (ST.to - ST.from) / (s1 - s0), tIn = s0 + (100 - ST.from) / speed, tOut = tIn + ST.trail / Math.abs(speed);
    const wet = T < tIn ? 0 : T < tOut ? sstep(tIn, tIn + 6, T) : 1 - sstep(tOut, ST.dryBy, T);
    return { front, active, dark, wet };
  };
  const curtains = [], stormClouds = [];
  rainTex.repeat.set(6, 1.4);
  const curtainMat = new THREE.MeshBasicMaterial({ map: rainTex, color: col('#b8c0c8'), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false });
  for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 520), curtainMat); m.rotation.y = PI / 2; m.position.set(0, 240, (k - 4) * 650); m.visible = false; m.raycast = () => {}; scene.add(m); curtains.push(m); }
  const stormCloudMat = new THREE.SpriteMaterial({ map: cloudTex, color: col('#4a4e56'), transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  for (let k = 0; k < 70; k++) { const s = new THREE.Sprite(stormCloudMat); s.userData = { dx: rr(-100, 1200), z: rr(-3000, 3000), y: rr(420, 620) }; const sc = rr(600, 1100); s.scale.set(sc, sc * 0.45, 1); s.visible = false; scene.add(s); stormClouds.push(s); }
  // Falling rain is drawn around whichever camera renders it, in the shader,
  // so split screen shows each player their own shower.
  const RAIN_N = 2200, rainSeeds = new Float32Array(RAIN_N * 6), rainTop = new Float32Array(RAIN_N * 2);
  for (let k = 0; k < RAIN_N; k++) { const x = rr(-60, 60), y = rr(0, 50), z = rr(-60, 60); rainSeeds.set([x, y, z, x, y, z], k * 6); rainTop.set([0, 1], k * 2); }
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainSeeds, 3)); rainGeo.setAttribute('top', new THREE.BufferAttribute(rainTop, 1));
  const rainUniforms = { uT: { value: 0 }, uFront: { value: 1e9 }, uTrail: { value: ST.trail }, uOn: { value: 0 } };
  const rainMat = new THREE.ShaderMaterial({
    uniforms: rainUniforms, transparent: true, depthWrite: false,
    vertexShader: `attribute float top; uniform float uT; uniform float uFront; uniform float uTrail; uniform float uOn; varying float vA;
      void main(){
        float y = mod(position.y - uT * 22.0, 50.0);
        vec3 p = vec3(cameraPosition.x + position.x - top * 0.15, cameraPosition.y - 10.0 + y + top * 1.4, cameraPosition.z + position.z);
        // Only cameras inside the moving band of rain see it falling.
        vA = uOn * step(uFront, cameraPosition.x) * step(cameraPosition.x, uFront + uTrail);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `varying float vA; void main(){ if (vA < 0.5) discard; gl_FragColor = vec4(0.8, 0.84, 0.9, 0.5); }`,
  });
  const rainLines = new THREE.LineSegments(rainGeo, rainMat); rainLines.frustumCulled = false; rainLines.visible = false; rainLines.raycast = () => {}; scene.add(rainLines);

  /* ---------------- per-frame updates ---------------- */
  const roadBase = col('#ffffff'), roadWet = col('#8a7a72'), dry = col('#ffffff'), wetGround = col('#8a8478');
  function update(t) {
    uTime.value = t;
    const W = stormAt(t);
    waterMats.forEach(m => { m.uniforms.uT.value = t; m.uniforms.uDark.value = W.dark; });
    ROAD.roughness = lerp(0.92, 0.22, W.wet); ROAD.color.copy(roadBase).lerp(roadWet, W.wet * 0.8); ROAD.metalness = 0.15 * W.wet;
    PLANKS.roughness = lerp(0.85, 0.3, W.wet);
    groundMats.forEach(m => m.color.copy(dry).lerp(wetGround, W.wet * 0.35 + W.dark * 0.25));
    curtains.forEach(c => { c.visible = W.active; c.position.x = W.front + 200; });
    rainTex.offset.y = (t * 2.2) % 1;
    curtainMat.opacity = 0.55 * sstep(0, 0.2, W.dark);
    stormCloudMat.opacity = 0.9 * W.dark;
    stormClouds.forEach(s => { s.visible = W.dark > 0.02; s.position.set(W.front + s.userData.dx, s.userData.y, s.userData.z); });
    rainLines.visible = W.active;
    rainUniforms.uT.value = t; rainUniforms.uFront.value = W.front; rainUniforms.uOn.value = W.active ? 1 : 0;
    skyClouds.forEach(s => { s.position.x = s.userData.x0 + ((t * 6) % 2000) - 1000; });
    skyCloudMat.color.setScalar(1 - 0.55 * W.dark);
    tepClouds.forEach(s => { s.position.x = s.userData.x0 + Math.sin(t * 0.03 + s.userData.ph) * 45; });
    spray.forEach(s => { s.position.y = s.userData.y0 + Math.sin(t * 0.8 + s.userData.ph) * 1.5; });
    if (rainbow) rainbow.material.opacity = 0.8 * (1 - W.dark);
  }

  disposeOwned(scene);
  vegetation.flush();
  return { group: scene, groundAt: groundH, update };
}
