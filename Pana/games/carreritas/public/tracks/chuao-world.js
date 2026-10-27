// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import { extendTerrain } from '/engine/worlds/coastal/world-horizon.js';
import * as THREE from 'three';
import { disposeOwned } from './reference-world.js';
import { canvasTexture } from '/engine/models/core/primitives.js';
import { coastalVegetation } from '/engine/worlds/coastal/coastal-vegetation.js';
import { bake } from '/engine/models/core/static-batch.js';
import { MAP } from './chuao-layout.js';
export function createWorld(scene, layout, roadDistance) {
  // Far hills get three-tree groves per card: a fuller jungle for the same cost.
  const vegetation = coastalVegetation(scene, 1, roadDistance, { clump: 3 });
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

  const SUN_DIR = new THREE.Vector3(-0.32, 0.86, 0.4).normalize();
  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => canvasTexture(w, h, draw, { srgb });
  // pale cement road, the way the streets of Chuao are paved
  const roadTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#c9c6bd'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(80,76,66,${rr(0.04, 0.14).toFixed(2)})` : `rgba(255,255,250,${rr(0.04, 0.12).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    c.fillStyle = 'rgba(90,84,72,0.45)'; for (let y = 0; y < h; y += 64) c.fillRect(0, y, w, 2);
    c.fillRect(w / 2 - 1, 0, 2, h);
    c.fillStyle = 'rgba(250,248,236,0.9)'; c.fillRect(w * 0.04, 0, 6, h); c.fillRect(w * 0.96 - 6, 0, 6, h);
    for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(110,96,70,0.12)'; c.fillRect(rr(20, w - 80), rr(0, h), rr(30, 70), rr(20, 60)); }
  });
  const plankTex = canvasTex(256, 256, (c, w, h) => {
    for (let y = 0; y < h; y += 16) {
      c.fillStyle = `hsl(${rr(24, 32).toFixed(0)}, ${rr(30, 42).toFixed(0)}%, ${rr(36, 48).toFixed(0)}%)`; c.fillRect(0, y, w, 16);
      c.fillStyle = 'rgba(40,24,10,0.5)'; c.fillRect(0, y + 14, w, 2);
    }
  });
  const frondTex = canvasTex(128, 512, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#ffffff'; c.lineCap = 'round';
    c.lineWidth = 6; c.beginPath(); c.moveTo(w / 2, h); c.lineTo(w / 2, 6); c.stroke();
    for (let y = h - 20; y > 20; y -= 13) {
      const len = (w / 2 - 6) * Math.sin(PI * (1 - y / h) * 0.95 + 0.15); c.lineWidth = 7;
      for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2, y); c.quadraticCurveTo(w / 2 + s * len * 0.6, y - 10, w / 2 + s * len, y - 26); c.stroke(); }
    }
  });
  const grassTex = canvasTex(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { const x = rr(8, w - 8), lean = rr(-18, 18), top = rr(10, 60); c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x - 4, h); c.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); c.lineTo(x + 4, h); c.fill(); }
  });
  const cloudTex = canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  // a cacao pod drawn in the flat Chuao mural style
  const drawPod = (c, cx, cy, s, body = '#e8a21e', dark = '#b8541e') => {
    c.save(); c.translate(cx, cy); c.rotate(-0.5);
    c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, s * 0.45, s, 0, 0, TAU); c.fill();
    c.strokeStyle = dark; c.lineWidth = s * 0.08; for (const k of [-0.22, 0, 0.22]) { c.beginPath(); c.ellipse(k * s, 0, s * 0.06, s * 0.9, 0, 0, TAU); c.stroke(); }
    c.fillStyle = '#3f7a2a'; c.beginPath(); c.ellipse(0, -s * 1.05, s * 0.12, s * 0.2, 0, 0, TAU); c.fill();
    c.restore();
  };
  const muralBoard = (w, h, bg, lines, opts = {}) => canvasTex(w, h, c => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = opts.band || '#2f7a3a'; c.fillRect(0, h - h * 0.16, w, h * 0.16); c.fillRect(0, 0, w, h * 0.08);
    if (opts.pod) drawPod(c, w - h * 0.4, h * 0.48, h * 0.3);
    c.textBaseline = 'middle'; c.textAlign = opts.pod ? 'left' : 'center';
    lines.forEach((t, k) => {
      const y = h * 0.46 + (k - (lines.length - 1) / 2) * h * 0.3, x = opts.pod ? h * 0.25 : w / 2;
      c.font = `bold ${Math.round(h * (k ? 0.2 : 0.26))}px sans-serif`;
      c.fillStyle = '#26261e'; c.fillText(t, x + 4, y + 4);
      c.fillStyle = opts.ink || '#ffffff'; c.fillText(t, x, y);
    });
  });
  const textBoard = (w, h, bg, draw) => canvasTex(w, h, c => { c.fillStyle = bg; c.fillRect(0, 0, w, h); draw(c, w, h); });

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

  /* ---------------- distance rasters (2 m cells) ---------------- */
  const { SIZE, CELL, GR, HALF, shoreCurve, NSH, SHP, SHR, farShoreZ, VAL, WALL, CTRL, roadCurve, ROAD_LEN, NR, RP, ctrlAt, SEG, RR, rivers, MAIN, POOL, wet, waterY, wetBlend, MOUNT, hwL, hwR, roadY, bank, elev, roadFrame, roadAt, lateralHW, plazaY, farH: originalFarH, groundH: originalGroundH, CZ, inCacao, raster, sampleR, shoreD, valleyAt, base, natural, terrainH } = layout;


  const farH = (x,z) => horizon?.heightAt(x,z) ?? originalFarH(x,z);
  const groundH = (x,z) => horizon?.heightAt(x,z) ?? originalGroundH(x,z);

  /* ---------------- terrain ---------------- */
  const cGrass = col('#4f9a2a'), cGrass2 = col('#7bb83a'), cDark = col('#2c6a22'), cDry = col('#a6a058'), cRock = col('#5a5a44'), cMoss = col('#3d5e2a'), cJungle = col('#2f7a26'), cSand = col('#efdcb0'), cWetSand = col('#cfb27e'), cLitter = col('#7a5a34'), cVerge = col('#d8cfa8'), cBed = col('#8a7a5a');
  function paintGround(x, z, y, slope, tmp) {
    const n1 = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.sin(z * 0.05) * 3) * Math.cos(z * 0.08 - x * 0.03);
    tmp.copy(cGrass).lerp(cGrass2, n1 * 0.7).lerp(cDark, sstep(0.55, 0.95, 0.5 + 0.5 * Math.sin(x * 0.023 - z * 0.031)) * 0.5);
    const v = valleyAt(z), out = Math.abs(x - v.cx) - v.hw;
    tmp.lerp(cDry, sstep(20, 70, y) * WALL.dry * (0.6 + 0.4 * Math.sin(x * 0.02 + z * 0.03)) * (z > -150 ? 1 : 0.3));
    tmp.lerp(cJungle, sstep(0, 40, out) * 0.55);
    tmp.lerp(cRock, sstep(0.45, 0.75, slope) * 0.9);
    tmp.lerp(cMoss, sstep(0.45, 0.75, slope) * (0.5 + 0.5 * Math.sin(x * 0.7 + Math.sin(y * 0.3) * 2)) * 0.55);
    if (inCacao(x, z)) tmp.lerp(cLitter, 0.55 * sstep(CZ.zMin, CZ.zMin + 10, z) * sstep(CZ.zMax, CZ.zMax - 10, z));
    const dd = shoreD(x, z);
    if (y < 3.6 && dd < 30) tmp.lerp(cSand, sstep(3.6, 2.2, y));
    if (y < 0.5) tmp.lerp(cWetSand, sstep(0.5, -0.1, y));
    void out;
    return tmp;
  }
  {
    const SEGS = 350, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    geo.rotateX(-PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i);
      paintGround(x, z, y, 1 - nrm.getY(i), tmp);
      const r = sampleR(RR, x, z);
      if (r.i >= 0 && !wet(r.i)) tmp.lerp(cVerge, (1 - sstep(hwR[r.i] - 0.5, hwR[r.i] + 2.5, r.dist)) * 0.6);
      for (const rv of rivers) { const v = sampleR(rv.ras, x, z); if (v.i >= 0) tmp.lerp(cBed, 1 - sstep(rv.HW[v.i] - 1, rv.HW[v.i] + 2.5, v.dist)); }
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true; scene.add(m);
    horizon = extendTerrain(m,{bounds:[-350,-350,350,350],nx:350,nz:350,height:originalFarH,color:(x,z,y)=>paintGround(x,z,y,0,new THREE.Color()),biome:'chuao'});
  }


  /* ---------------- the sea and the lagoons: turquoise over sand, deep blue further out ---------------- */
  const waterMats = [];
  const HT = { x0: -800, z0: -360, size: 1600, res: 400 };
  const heightTex = (() => {
    const data = new Uint8Array(HT.res * HT.res * 4);
    for (let j = 0; j < HT.res; j++) for (let i = 0; i < HT.res; i++) {
      const x = HT.x0 + (i + 0.5) / HT.res * HT.size, z = HT.z0 + (j + 0.5) / HT.res * HT.size;
      const h = Math.abs(x) < 345 && Math.abs(z) < 345 ? natural(x, z) : farH(x, z);
      const v = Math.round(clamp((h + 20) / 30, 0, 1) * 255), k = (j * HT.res + i) * 4;
      data[k] = v; data[k + 1] = v; data[k + 2] = v; data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, HT.res, HT.res, THREE.RGBAFormat); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  })();
  const SEA = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSun: { value: SUN_DIR }, uH: { value: null }, uBox: { value: new THREE.Vector3(HT.x0, HT.z0, HT.size) } }]),
    vertexShader: `varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uT; uniform vec3 uSun; uniform sampler2D uH; uniform vec3 uBox; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 uv = (vW.xz - uBox.xy) / uBox.z;
        float hgt = (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) ? texture2D(uH, uv).r * 30.0 - 20.0 : -20.0;
        if (hgt > 0.05) discard;
        float depth = clamp(-hgt / 9.0, 0.0, 1.0);
        float a = sin(vW.x * 0.11 + uT * 0.9 + sin(vW.z * 0.05) * 2.0), b = sin(vW.z * 0.17 - uT * 1.3 + vW.x * 0.03);
        vec3 shallow = vec3(0.2, 0.84, 0.76), mid = vec3(0.03, 0.6, 0.66), deep = vec3(0.02, 0.24, 0.5);
        vec3 c = mix(shallow, mid, smoothstep(0.0, 0.3, depth)); c = mix(c, deep, smoothstep(0.35, 1.0, depth));
        c += (a * 0.5 + b * 0.5) * 0.03;
        vec3 V = normalize(cameraPosition - vW), N = normalize(vec3(a * 0.06, 1.0, b * 0.06));
        float spec = pow(max(dot(reflect(-uSun, N), V), 0.0), 120.0);
        c += vec3(1.0, 0.95, 0.85) * spec * 1.5;
        float fres = pow(1.0 - max(V.y, 0.0), 4.0); c = mix(c, vec3(0.85, 0.93, 0.98), fres * 0.3);
        float shore = 1.0 - smoothstep(-0.2, 1.1, -hgt);
        float wave = 0.5 + 0.5 * sin(-hgt * 6.0 + uT * 1.6 + sin(vW.x * 0.08) * 1.5);
        float foam = shore * smoothstep(0.7, 0.98, wave) * 0.8 + (1.0 - smoothstep(-0.05, 0.2, -hgt)) * 0.6;
        c = mix(c, vec3(0.98, 1.0, 0.98), clamp(foam, 0.0, 1.0));
        float alpha = mix(0.55, 0.97, smoothstep(0.0, 0.6, depth));
        gl_FragColor = vec4(c, max(alpha, foam));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    transparent: true, depthWrite: false, fog: true,
  });
  SEA.uniforms.uH.value = heightTex; waterMats.push(SEA);
  { const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-PI / 2); const m = new THREE.Mesh(g, SEA); m.renderOrder = 1; scene.add(m); }

  /* ---------------- rivers and the Chorrerón ---------------- */
  function waterMaterial(speed, alpha = 0.85, fall = 0, tint = 1) {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSpeed: { value: speed }, uSun: { value: SUN_DIR }, uA: { value: alpha }, uFall: { value: fall }, uTint: { value: tint } }]),
      vertexShader: `attribute float foam; varying vec2 vUv; varying float vFoam; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vFoam = foam; vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform float uSpeed; uniform vec3 uSun; uniform float uA; uniform float uFall; uniform float uTint; varying vec2 vUv; varying float vFoam; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          float flow = vUv.y - uT * uSpeed * (1.0 + vFoam * 2.5);
          float a = sin(vUv.x * 14.0 + sin(vUv.y * 0.35 + uT) * 2.0 + flow * 1.3), b = sin(vUv.x * 5.0 - flow * 2.0 + sin(vUv.y * 0.2) * 3.0);
          float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
          vec3 c = mix(vec3(0.08, 0.28, 0.23), vec3(0.32, 0.58, 0.43), 0.45 + 0.3 * a) + smoothstep(0.6, 1.0, a * 0.5 + b * 0.5) * 0.1;
          vec3 V = normalize(cameraPosition - vW), Nn = normalize(vec3(a * 0.08, 1.0, b * 0.08));
          c += vec3(1.0, 0.95, 0.8) * pow(max(dot(reflect(-uSun, Nn), V), 0.0), 90.0) * 1.4;
          c = mix(c, vec3(0.97, 0.98, 0.95), clamp(vFoam * (0.7 + 0.3 * b), 0.0, 1.0));
          float alpha = uA * (0.55 + 0.45 * edge);
          if (uFall > 0.5) {
            float y = vUv.y * 1.6 - uT * 2.2;
            float s1 = sin(vUv.x * 70.0 + sin(vUv.x * 13.0) * 4.0), s2 = sin(vUv.x * 23.0 + y * 0.35) * sin(y * 1.7 + vUv.x * 9.0);
            float st = smoothstep(0.2, 0.95, s1 * 0.55 + s2 * 0.45);
            // Streaks with darker gaps between them read as falling water;
            // ragged sides keep the curtain from ending in a ruled edge.
            float rag = 0.06 + 0.05 * sin(y * 0.9 + vUv.x * 3.0) * sin(y * 0.37);
            c = mix(vec3(0.55, 0.74, 0.76), vec3(1.0), 0.3 + 0.7 * st) * uTint;
            alpha = uA * (0.45 + 0.55 * st) * smoothstep(0.0, rag + 0.04, vUv.x) * smoothstep(1.0, 0.96 - rag, vUv.x);
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
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; scene.add(m); return m;
  }
  {
    const RIV = waterMaterial(1.1);
    for (const rv of rivers) {
      const rows = [];
      for (let i = 0; i <= rv.N; i++) {
        const p = rv.P[i], t = rv.P[Math.min(rv.N, i + 1)].clone().sub(rv.P[Math.max(0, i - 1)]).normalize();
        if (rv.Y[i] < 0.12 && i > rv.N * 0.5) break;
        rows.push({ c: p.clone().setY(rv.Y[i] + 0.1), side: V3(-t.z, 0, t.x), w: rv.HW[i] + 0.8, foam: rv === MAIN ? (i < 14 ? 0.8 - i * 0.05 : 0.25 + 0.15 * Math.sin(i * 0.4)) : 0.1 });
      }
      ribbon(rows, RIV);
    }
    // the Chorrerón: a curved curtain down the cliff into the plunge pool,
    // bulging toward the road and spreading as it falls, over a darker,
    // slower sheet that gives it depth instead of one flat strip
    const F = MAP.fall, topY = base(F.x, F.z - 4) - 0.5, side = V3(1, 0, 0), dir = V3(0, 0, 1), frows = [];
    for (let k = 0; k <= 30; k++) { const t = k / 30; frows.push({ c: V3(F.x, lerp(topY, POOL.y + 0.2, t * t), F.z + Math.sqrt(t) * (POOL.z - F.z) * 0.9), side, w: F.width * (0.6 + t * 0.6), foam: 1 }); }
    const curtain = (rows, mat, bulge, segs = 10) => {
      const pos = [], uv = [], foam = [], idx = [];
      let dist = 0;
      rows.forEach((r, i) => {
        if (i) dist += r.c.distanceTo(rows[i - 1].c);
        for (let j = 0; j <= segs; j++) {
          const u = j / segs * 2 - 1, v = r.c.clone().addScaledVector(r.side, u * r.w).addScaledVector(dir, (1 - u * u) * r.w * bulge);
          pos.push(v.x, v.y, v.z); uv.push((u + 1) / 2, dist * 0.22); foam.push(r.foam || 0);
          if (i && j) { const a = (i - 1) * (segs + 1) + j - 1, b = a + segs + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
        }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('foam', new THREE.Float32BufferAttribute(foam, 1)); geo.setIndex(idx);
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; scene.add(m); return m;
    };
    curtain(frows.map(r => ({ ...r, c: r.c.clone().addScaledVector(dir, -1.4), w: r.w * 1.15 })), waterMaterial(1.5, 0.8, 1, 0.72), 0.22).renderOrder = 1;
    curtain(frows, waterMaterial(2.6, 0.96, 1), 0.32);
    // churning foam where it lands, rolling outward over the pool
    const landing = frows[frows.length - 1].c, FOAM = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uR: { value: F.width * 1.3 } }]),
      vertexShader: `varying vec2 vP;
        #include <fog_pars_vertex>
        void main(){ vP = position.xy; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform float uR; varying vec2 vP;
        #include <fog_pars_fragment>
        void main(){
          float r = length(vP) / uR, a = atan(vP.y, vP.x);
          float churn = 0.5 + 0.5 * sin(r * 26.0 - uT * 3.2 + sin(a * 5.0 + uT) * 1.5) * sin(a * 9.0 - r * 7.0 + uT * 0.7);
          float alpha = smoothstep(1.0, 0.45, r) * (0.35 + 0.65 * smoothstep(0.35, 0.8, churn)) * 0.85;
          gl_FragColor = vec4(vec3(0.96, 0.99, 0.98), alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true,
    });
    waterMats.push(FOAM);
    const foamDisc = new THREE.Mesh(new THREE.CircleGeometry(F.width * 1.3, 40), FOAM);
    foamDisc.rotation.x = -PI / 2; foamDisc.position.set(landing.x, POOL.y + 0.32, landing.z); foamDisc.renderOrder = 3; scene.add(foamDisc);
    scene.userData.fallLanding = landing.clone();
    // the small stream that feeds it, over the top of the cliff
    const up = [];
    for (let k = 0; k <= 20; k++) { const z = F.z - 4 - k * 3; up.push({ c: V3(F.x + Math.sin(k * 0.5) * 3, base(F.x, z) - 0.4, z), side, w: F.width * 0.45, foam: 0.3 }); }
    ribbon(up.reverse(), waterMaterial(1.5));
    scene.userData.fall = { top: V3(F.x, topY, F.z), base: POOL.clone() };
  }

  /* ---------------- road surface and bridges ---------------- */
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
    const m = new THREE.Mesh(geo, mat); m.name = 'coastal-road-strip'; m.receiveShadow = true; scene.add(m);
    return m;
  }
  const ROAD = new THREE.MeshStandardMaterial({ map: roadTex, vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const PLANKS = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85, side: THREE.DoubleSide });
  const WOOD = new THREE.MeshStandardMaterial({ color: col('#7a5232'), roughness: 0.9 });
  {
    // cement in the village, hard sand at the landing and the boca, packed earth in the cacaotal and the valley
    const tone = { b: col('#efdcb0'), r: col('#e6d2a2'), c: col('#b48a5a'), p: col('#ffffff'), q: col('#ffffff'), u: col('#c9a878'), l: col('#b8a084'), w: col('#ffffff'), d: col('#c4a274'), f: col('#b8a084'), s: col('#8a7a5a'), e: col('#c4a274') };
    let rows = [], colors = [];
    const flushRoad = () => {
      if (rows.length > 1) stripMesh(rows, ROAD, 20, false, colors);
      rows = []; colors = [];
    };
    for (let j0 = 0; j0 <= NR; j0++) {
      const i = j0 % NR;
      if (SEG[i] === 's') { flushRoad(); continue; }
      const c = new THREE.Color(0, 0, 0);
      for (let j = -12; j <= 12; j++) c.add(tone[SEG[(i + j + NR) % NR]]);
      rows.push({ a: roadAt(i, -hwL[i], 0.12), b: roadAt(i, hwR[i], 0.12) });
      colors.push(c.multiplyScalar(1 / 25));
    }
    flushRoad();
    let run = [], sL = [], sR = [];
    const flushRun = () => { if (run.length > 2) { stripMesh(run, PLANKS, 6); stripMesh(sL, PLANKS, 6); stripMesh(sR, PLANKS, 6); } run = []; sL = []; sR = []; };
    for (let i = 0; i <= NR; i++) {
      const k = i % NR, on = elev[k] || elev[(k + 4) % NR] || elev[(k - 4 + NR) % NR];
      if (on) { const a = roadAt(k, -hwL[k] - 0.6, 0.2), b = roadAt(k, hwR[k] + 0.6, 0.2); run.push({ a, b }); sL.push({ a, b: a.clone().setY(a.y - 1.0) }); sR.push({ a: b, b: b.clone().setY(b.y - 1.0) }); }
      else flushRun();
    }
    flushRun();
  }

  /* ---------------- rails and posts (instanced boxes) ---------------- */
  const placeBeam = (a, b, tx, tz) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    d.position.copy(a).addScaledVector(dir, 0.5); d.quaternion.setFromUnitVectors(UP, dir.normalize()); d.scale.set(tx, len, tz); d.updateMatrix();
    return d.matrix.clone();
  };
  const beams = { steel: [], white: [], wood: [], concrete: [], yellow: [] };
  {
    const step = Math.round(4 / (ROAD_LEN / NR));
    for (const side of [-1, 1]) {
      let prev = null;
      for (let i = 0; i < NR; i += step) {
        const s = SEG[i], bridge = elev[i] || elev[(i + 3) % NR];
        const kind = wet(i) ? null : bridge || s === 'l' ? 'wood' : null;
        if (!kind) { prev = null; continue; }
        const lat = side * (lateralHW(i, side) + (bridge ? 0.4 : 1.2)), base0 = roadAt(i, lat, bridge ? 0.2 : 0);
        if (!bridge) base0.y = Math.min(base0.y, terrainH(base0.x, base0.z) + 0.1);
        const h = kind === 'steel' ? 0.85 : 1.1, top = base0.clone().setY(base0.y + h);
        if (bridge) { const g = natural(base0.x, base0.z) - 1; beams.wood.push(placeBeam(base0.clone().setY(g), top, 0.32, 0.32)); }
        else beams[kind].push(placeBeam(base0.clone().setY(base0.y - 0.3), top, 0.16, 0.16));
        if (prev && prev.distanceTo(top) < 9) {
          if (kind === 'steel') beams.steel.push(placeBeam(prev.clone().setY(prev.y - 0.12), top.clone().setY(top.y - 0.12), 0.08, 0.34));
          else { beams.wood.push(placeBeam(prev, top, 0.12, 0.16)); beams.wood.push(placeBeam(prev.clone().setY(prev.y - 0.55), top.clone().setY(top.y - 0.55), 0.1, 0.14)); }
        }
        prev = top;
      }
    }
  }
  {
    const chevTex = canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = '#ffd21f'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0392b';
      for (let k = 0; k < 4; k++) { const x = 30 + k * 56; c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 26, h / 2); c.lineTo(x, h - 8); c.lineTo(x + 14, h - 8); c.lineTo(x + 40, h / 2); c.lineTo(x + 14, 8); c.fill(); }
    });
    const signMat = new THREE.MeshStandardMaterial({ map: chevTex, roughness: 0.6 });
    for (let i = 0; i < NR; i += 6) {
      if (!MOUNT[SEG[i]] && SEG[i] !== 'c') continue;
      const a = roadFrame(i - 30).t, b = roadFrame(i + 30).t, turn = a.x * b.z - a.z * b.x;
      if (Math.abs(turn) < 0.75 || elev[i]) continue;
      const side = turn > 0 ? -1 : 1, f = roadFrame(i);
      const p0 = roadAt(i, side * (lateralHW(i, side) + 4)); p0.y = terrainH(p0.x, p0.z);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 0.18), signMat);
      sign.position.copy(p0).setY(p0.y + 1.7); sign.lookAt(p0.clone().addScaledVector(f.n, -side).setY(p0.y + 1.7)); sign.castShadow = true; scene.add(sign);
      for (const o of [-1.6, 1.6]) beams.wood.push(placeBeam(p0.clone().addScaledVector(f.t, o).setY(p0.y - 0.3), p0.clone().addScaledVector(f.t, o).setY(p0.y + 1.2), 0.14, 0.14));
      i += 140;
    }
  }
  // signs in the flat Chuao mural style
  const MURAL = ['#ffd21f', '#e8462e', '#2a9b5a', '#3d7bf2', '#f08a1f'];
  const roadSign = (i, side, lines, arrow, k = 0) => {
    const bg = MURAL[k % MURAL.length], ink = bg === '#ffd21f' ? '#c0392b' : '#ffffff';
    const tex = textBoard(512, 256, bg, (c, w, h) => {
      c.fillStyle = '#2f7a3a'; c.fillRect(0, h - 34, w, 34); drawPod(c, 70, h / 2 - 10, 48);
      c.fillStyle = ink; c.font = 'bold 60px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
      lines.forEach((t, j) => c.fillText(t, 130, h / 2 - 14 + (j - (lines.length - 1) / 2) * 62));
      if (arrow) { c.save(); c.translate(w - 70, h / 2 - 14); c.rotate({ left: PI, right: 0, up: -PI / 2 }[arrow]); c.beginPath(); c.moveTo(-34, -12); c.lineTo(8, -12); c.lineTo(8, -32); c.lineTo(44, 0); c.lineTo(8, 32); c.lineTo(8, 12); c.lineTo(-34, 12); c.closePath(); c.fill(); c.restore(); }
    });
    const f = roadFrame(i), p0 = roadAt(i, side * (lateralHW(i, side) + 3)); p0.y = terrainH(p0.x, p0.z);
    const W = 4.2, Y = 2.8;
    const board = new THREE.Mesh(new THREE.BoxGeometry(W, 2.1, 0.14), [WOOD, WOOD, WOOD, WOOD, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), WOOD]);
    board.position.copy(p0).setY(p0.y + Y); board.lookAt(board.position.clone().addScaledVector(f.t, -1)); board.castShadow = true; scene.add(board);
    const n2 = V3(-f.t.z, 0, f.t.x);
    for (const o of [-W / 2 + 0.3, W / 2 - 0.3]) beams.wood.push(placeBeam(p0.clone().addScaledVector(n2, o).setY(p0.y - 0.3), p0.clone().addScaledVector(n2, o).setY(p0.y + Y - 0.2), 0.16, 0.16));
  };
  const idxNear = (x, z, from = 0, to = NR) => { let b = from, bd = 1e9; for (let i = from; i < to; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };

  /* ---------------- materials and instance buffers ---------------- */
  const BARK = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true });
  const CANOPY = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }), 0.05, 0.03);
  const FROND = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: frondTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), 0.0, 0.06);
  const GRASS = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0.0, 0.18);
  const SMOOTH = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8, flatShading: true });
  const PAINT = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.75 });
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.55, 1, 1, 8, 3); trunkGeo.translate(0, 0.5, 0);
  { const p = trunkGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + 0.12 * Math.sin(y * 9 + i))); } trunkGeo.computeVertexNormals(); }
  const frondGeo = (() => {
    const g = new THREE.PlaneGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, -Math.sin(y * 1.6) * 0.25 + y * y * 0.55); p.setY(i, y * (1 - y * 0.25)); }
    g.rotateX(-PI / 2 + 0.25); g.computeVertexNormals(); return g;
  })();
  const grassGeo = (() => {
    const a = new THREE.PlaneGeometry(1, 1, 1, 2); a.translate(0, 0.5, 0); const b2 = a.clone(); b2.rotateY(PI / 2);
    const g = new THREE.BufferGeometry(), pa = a.attributes.position.array, pb = b2.attributes.position.array;
    g.setAttribute('position', new THREE.Float32BufferAttribute([...pa, ...pb], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([...a.attributes.uv.array, ...b2.attributes.uv.array], 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pa.length + pb.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    const ia = [...a.index.array], off = a.attributes.position.count; g.setIndex([...ia, ...ia.map(v => v + off)]); return g;
  })();
  const inst = { blob: [], bushBlob: [], trunk: [], frond: [], grass: [], rock: [], flower: [], box: [], roof: [], cyl: [], tri: [], pod: [], disc: [] };
  const push = (list, pos, quat, scale, color) => { if ((list === inst.rock || list === inst.bushBlob) && sampleR(RR,pos.x,pos.z).dist < 10 + Math.max(scale.x,scale.z)) return; d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const yawOf = v => Math.atan2(v.x, v.z);
  const BARK_C = col('#7d5c40'), PALM_C = col('#9a8466'), BUC_C = col('#8f8a7a');
  const GREENS = ['#2f8a22', '#3a9c26', '#4aae2f', '#24701d', '#58b83a', '#1f7a2a', '#3d8f1f'].map(col);
  const DRY_GREENS = ['#6f8a3a', '#869a48', '#5e7a32', '#9aa456'].map(col);
  const FLOWERS = ['#ff2e45', '#ff7a1a', '#ff3d8b', '#ffd23a', '#ffffff', '#b45cff'].map(col);
  const addBox = (p, s, yaw, color) => push(inst.box, p, qYaw(yaw), S.copy(s), col(color));
  function tree(x, z, big, dry) {
    vegetation.add('tree', x, z, groundH(x,z), big ? 1.6 : 1, sampleR(RR,x,z).dist);
  }
  // mango: a short thick trunk and one big dark round crown
  function mango(x, z) {
    vegetation.add('mango', x, z, groundH(x,z), 1, sampleR(RR,x,z).dist);
  }
  // bucare: tall shade tree over the cacao, wide light crown, sometimes covered in orange flowers
  function bucare(x, z) {
    vegetation.add('tree', x, z, groundH(x,z), 1.5, sampleR(RR,x,z).dist);
  }
  // cacao: a small tree with dark glossy leaves and the pods growing straight from the trunk
  const PODS = ['#e8c13a', '#d9792a', '#b8332a', '#8a2e4a', '#9ab03a'].map(col);
  function cacaoTree(x, z) {
    vegetation.add('cacao', x, z, groundH(x,z), 1, sampleR(RR,x,z).dist);
  }
  function palm(x, z, leanTo, tall = 1) {
    vegetation.add('palm', x, z, groundH(x,z), 1, sampleR(RR,x,z).dist);
  }
  // uva de playa: low, wide, round-leaved shrubs at the back of the sand
  function seaGrape(x, z) {
    vegetation.add('mango', x, z, groundH(x,z), .55, sampleR(RR,x,z).dist);
  }
  function fern(x, z, s = 1) {
    const y = groundH(x, z), gc = col('#4fa83a').offsetHSL(rr(-0.03, 0.04), 0, rr(-0.08, 0.05));
    for (let k = 0; k < 7; k++) push(inst.frond, V3(x, y, z), qEuler(rr(-0.6, -0.2), k / 7 * TAU + rr(-0.2, 0.2), 0), S.set(s * rr(0.7, 0.9), s * rr(1.4, 2.2), s * rr(1.4, 2.2)), gc);
  }
  function bush(x, z, s = 1) {
    const y = groundH(x, z), basec = pick(GREENS);
    for (let k = 0; k < 3; k++) { const a = rand() * TAU, r = rr(0, 1.2) * s, sc = s * rr(1.1, 1.7); push(inst.bushBlob, V3(x + Math.cos(a) * r, y + sc * 0.45, z + Math.sin(a) * r), qEuler(rand(), rand() * TAU, 0), S.set(sc, sc * 0.75, sc), basec.clone().offsetHSL(0, 0, rr(-0.05, 0.05))); }
    if (rand() < 0.4) { const fc = pick(FLOWERS); for (let k = 0; k < 6; k++) { const a = rand() * TAU, r = rr(0.6, 1.6) * s; push(inst.flower, V3(x + Math.cos(a) * r, y + s * rr(0.9, 1.6), z + Math.sin(a) * r), Q, S.set(0.28, 0.28, 0.28), fc); } }
  }
  const rock = (x, z, s, y) => push(inst.rock, V3(x, (y ?? groundH(x, z)) + s * 0.15, z), qEuler(rand(), rand() * TAU, rand()), S.set(s * 1.3, s * 0.8, s), col('#8a8170').offsetHSL(0, 0, rr(-0.1, 0.06)));

  /* ---------------- the landing: start arch of painted planks, jetty, peñeros ---------------- */
  const i0 = idxNear(MAP.startAt[0], MAP.startAt[1]);
  const BUNT = ['#e8462e', '#ffd21f', '#2a9b5a', '#3d7bf2', '#ffffff', '#f08a1f'].map(col);
  // Carreritas's shared startLine owns the finish stripe and gantry.

  {
    const J = MAP.jetty, y = 1.7;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, J.len), new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85 }));
    deck.position.set(J.x, y, J.z + J.len / 2 - 4); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
    for (let k = 0; k <= J.len; k += 4) for (const s of [-1, 1]) { const z = J.z - 4 + k; beams.wood.push(placeBeam(V3(J.x + s * 1.8, natural(J.x, z) - 1, z), V3(J.x + s * 1.8, y + (k % 8 ? 0 : 0.9), z), 0.3, 0.3)); }
    scene.userData.jetty = V3(J.x, y, J.z + J.len - 4);
  }
  const peneroGeo = (() => {
    const N = 16, pos = [], idx = [], cl = [], L = 7.2, white = col('#f4f1ea'), bottom = col('#2f62c8');
    for (let j = 0; j <= N; j++) {
      const t = j / N, w = 0.95 * Math.pow(Math.sin(PI * (0.5 + 0.5 * t)), 0.6), top = 0.78 + 0.35 * t * t, bot = 0.05 + 0.28 * t * t * t, zz = -L / 2 + t * L;
      [[-w, top], [-w * 0.82, 0.32 + bot * 0.6], [0, bot], [w * 0.82, 0.32 + bot * 0.6], [w, top]].forEach(([x, yy]) => { pos.push(x, yy, zz); const c = yy < 0.36 ? bottom : white; cl.push(c.r, c.g, c.b); });
      if (j) for (let k = 0; k < 4; k++) { const a = (j - 1) * 5 + k, b = a + 5; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  })();
  const PENEROS = ['#d83a2c', '#2f62c8', '#1f9a6a', '#e8b321'].map(col);
  const boats = { hull: [], band: [] };
  const bandGeo = new THREE.BoxGeometry(1.7, 0.18, 6.6); bandGeo.translate(0, 0.72, 0.1);
  const addPenero = (p, yaw, roll = 0) => { const q = qEuler(0, yaw, roll); push(boats.hull, p, q, S.set(1, 1, 1), null); push(boats.band, p, q, S.set(1.08, 1, 1), pick(PENEROS)); };
  for (const [x, z, n] of MAP.peneros.beach) for (let k = 0; k < n; k++) { const px = x + (k - n / 2) * 3.4 + rr(-1, 1), pz = z + rr(-1.5, 1.5); addPenero(V3(px, groundH(px, pz) - 0.05, pz), PI + rr(-0.25, 0.25), rr(-0.08, 0.08)); }

  /* ---------------- the town: yellow colonial houses, the plaza, the church, the cacao shop ---------------- */
  const HOUSE = ['#f2c230', '#f5d04a', '#f2c230', '#efb02a', '#f5d04a', '#f2c230', '#efb02a', '#f3ead6', '#f08a5a'].map(col);
  const TRIM = ['#ffffff', '#2a9b5a', '#3d7bf2', '#c0392b'].map(col);
  const houses = [];
  const PL = MAP.plaza;
  const nearPlaza = (x, z, m = 0) => Math.abs(x - PL.x) < PL.w / 2 + m && Math.abs(z - PL.z) < PL.d / 2 + m;
  const house = (p, yaw, w, dpt, h, c) => {
    const y = Math.min(groundH(p.x, p.z), groundH(p.x + Math.sin(yaw) * dpt * 0.5, p.z + Math.cos(yaw) * dpt * 0.5)) - 0.2;
    const q = qYaw(yaw), fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), right = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    push(inst.box, V3(p.x, y + h / 2, p.z), q, S.set(w, h + 0.4, dpt), c);
    push(inst.roof, V3(p.x, y + h + 0.2, p.z), qYaw(yaw + PI / 2), S.set(dpt + 1.4, rr(1.3, 1.8), w + 1.0), col('#c2593a').offsetHSL(rr(-0.02, 0.02), 0, rr(-0.06, 0.04)));
    const front = V3(p.x, y, p.z).addScaledVector(fwd, dpt / 2 + 0.03), trim = pick(TRIM);
    push(inst.box, front.clone().setY(y + 0.4), q, S.set(w, 0.6, 0.08), col('#e8e2d2'));
    const nWin = w > 7 ? 2 : 1;
    for (let k = 0; k < nWin; k++) { const off = nWin === 1 ? w * 0.25 : (k ? 0.3 : -0.3) * w; push(inst.box, front.clone().addScaledVector(right, off).setY(y + 1.75), q, S.set(1.2, 1.5, 0.08), trim); push(inst.box, front.clone().addScaledVector(right, off).setY(y + 1.75).addScaledVector(fwd, 0.02), q, S.set(0.9, 1.25, 0.06), col('#3a2a22')); }
    push(inst.box, front.clone().addScaledVector(right, nWin === 1 ? -w * 0.2 : 0).setY(y + 1.25), q, S.set(1.1, 2.3, 0.1), pick([col('#7a5232'), col('#2a9b5a'), col('#3d7bf2')]));
    houses.push({ p: front.clone().setY(y + h), x: p.x, z: p.z, right, w });
  };
  const freeOf = (x, z, roadM) => {
    if (sampleR(RR, x, z).dist < 6.5 + roadM) return false;
    for (const rv of rivers) { const v = sampleR(rv.ras, x, z); if (v.i >= 0 && v.dist < rv.HW[v.i] + 3) return false; }
    return true;
  };
  {
    // houses lining the town street and the sides of the plaza
    for (let i = 0; i < NR; i++) {
      const s = SEG[i]; if (s !== 'p' && s !== 'q') continue;
      for (const side of [-1, 1]) {
        if (rand() < 0.12) continue;
        const f = roadFrame(i), w = rr(7, 10), dpt = rr(7, 8.5), p = roadAt(i, side * (lateralHW(i, side) + 2.2 + dpt / 2));
        if (nearPlaza(p.x, p.z, 4) || !freeOf(p.x, p.z, lateralHW(i, side) + 1.7 + dpt / 2 - 6.5) || houses.some(hh => Math.hypot(hh.x - p.x, hh.z - p.z) < 8)) continue;
        house(p, yawOf(f.n.clone().multiplyScalar(-side)), w, dpt, rr(3.6, 4.4), pick(HOUSE));
      }
      i += Math.round(9 / (ROAD_LEN / NR));
    }
    const TZ = MAP.zones.town; let n = 0;
    for (let k = 0; k < 4000 && n < TZ.houses; k++) {
      const x = rr(TZ.xMin, TZ.xMax), z = rr(TZ.zMin, TZ.zMax);
      if (nearPlaza(x, z, 6) || !freeOf(x, z, 8) || houses.some(hh => Math.hypot(hh.x - x, hh.z - z) < 11)) continue;
      const r = sampleR(RR, x, z), f = roadFrame(Math.max(0, r.i)), toRoad = f.p.clone().sub(V3(x, 0, z)).setY(0).normalize();
      house(V3(x, 0, z), Math.round(yawOf(toRoad) / (PI / 2)) * (PI / 2), rr(7, 9.5), rr(7, 8.5), rr(3.4, 4.2), pick(HOUSE)); n++;
    }
    for (let k = 0; k < 40; k++) { const x = rr(TZ.xMin - 10, TZ.xMax + 10), z = rr(TZ.zMin, TZ.zMax + 20); if (nearPlaza(x, z, 2) || !freeOf(x, z, 2) || houses.some(hh => Math.hypot(hh.x - x, hh.z - z) < 7)) continue; mango(x, z); }
    // the cement patio with the cacao drying in red-brown circles. The road's
    // curve cuts the patio's corner, and the flat slab used to show through
    // the sloping road there: the slab, its joints and the cacao stay clear.
    const patioClear = (x, z, m = 0) => freeOf(x, z, m);
    const top = [], quad = (x0, z0, x1, z1) => top.push(x0, 0, z0, x0, 0, z1, x1, 0, z1, x0, 0, z0, x1, 0, z1, x1, 0, z0);
    for (let x = PL.x - PL.w / 2; x < PL.x + PL.w / 2 - 1e-6; x += 1) for (let z = PL.z - PL.d / 2; z < PL.z + PL.d / 2 - 1e-6; z += 1) {
      const corners = [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]].filter(([cx, cz]) => patioClear(cx, cz)).length;
      if (corners === 4) quad(x, z, x + 1, z + 1);
      else if (corners) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const sx = x + i / 4, sz = z + j / 4;
        if (patioClear(sx + 0.125, sz + 0.125)) quad(sx, sz, sx + 0.25, sz + 0.25);
      }
    }
    const patio = new THREE.BufferGeometry(); patio.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); patio.computeVertexNormals();
    const pave = new THREE.Mesh(patio, new THREE.MeshStandardMaterial({ color: col('#dcd6c8'), roughness: 0.95 }));
    pave.position.set(0, plazaY + 0.12, 0); pave.receiveShadow = true; scene.add(pave);
    for (let k = 0; k < 6; k++) { const x = PL.x - PL.w / 2 + (k + 0.5) * PL.w / 6; for (let z = PL.z - PL.d / 2 + 1.5; z < PL.z + PL.d / 2 - 1; z += 1) if (patioClear(x, z, 0.3)) addBox(V3(x, plazaY + 0.13, z), V3(0.12, 0.02, 1), 0, '#b9b2a2'); }
    for (let k = 0; k < 5; k++) { const z = PL.z - PL.d / 2 + (k + 0.5) * PL.d / 5; for (let x = PL.x - PL.w / 2 + 1.5; x < PL.x + PL.w / 2 - 1; x += 1) if (patioClear(x, z, 0.3)) addBox(V3(x, plazaY + 0.13, z), V3(1, 0.02, 0.12), 0, '#b9b2a2'); }
    const cols = 4, rows = Math.ceil(PL.circles / cols);
    for (let k = 0; k < PL.circles; k++) {
      // Every random draw still happens so the rest of the valley keeps its layout.
      const cx = PL.x - PL.w / 2 + (k % cols + 0.5) * PL.w / cols + rr(-1.5, 1.5), cz = PL.z - PL.d / 2 + 8 + (Math.floor(k / cols) + 0.5) * (PL.d - 12) / rows + rr(-1, 1), r = rr(3.4, 4.6);
      const clear = patioClear(cx, cz, r + 0.5);
      const disc = [V3(cx, plazaY + 0.16, cz), qYaw(rand() * TAU), S.set(r, 1, r * rr(0.9, 1.1)).clone(), col('#5a2a1c').offsetHSL(rr(-0.015, 0.015), rr(-0.15, 0), rr(-0.04, 0.05))];
      if (clear) push(inst.disc, ...disc);
      for (let j = 0; j < 4; j++) { const a = rand() * TAU, rd = r * rr(0.2, 0.8), bean = [V3(cx + Math.cos(a) * rd, plazaY + 0.17, cz + Math.sin(a) * rd), qYaw(rand() * TAU), S.set(r * 0.25, 1, r * 0.2).clone(), col('#3e1a12')]; if (clear) push(inst.disc, ...bean); }
    }
    // the yellow church: arched door, pilasters, a curved gable with the bell
    const C = MAP.church, cy = plazaY - 0.3;
    const church = new THREE.Group(); church.position.set(C.x, cy, C.z); church.rotation.y = C.rot; scene.add(church);
    const ym = new THREE.MeshStandardMaterial({ color: col('#efb72a'), roughness: 0.8 }), wm = new THREE.MeshStandardMaterial({ color: col('#f6f2e8'), roughness: 0.8 }), rm = new THREE.MeshStandardMaterial({ color: col('#c2593a'), roughness: 0.8 }), dm = new THREE.MeshStandardMaterial({ color: col('#6a3a22') });
    const cp = (geo, m, x, y, z) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; church.add(mm); return mm; };
    cp(new THREE.BoxGeometry(12, 8, 22), wm, 0, 4, -11);
    const roofG = new THREE.CylinderGeometry(7.4, 7.4, 22.6, 3, 1); roofG.rotateX(PI / 2); roofG.rotateZ(PI); roofG.scale(1, 0.4, 1); cp(roofG, rm, 0, 8.9, -11);
    cp(new THREE.BoxGeometry(14, 11, 1.2), wm, 0, 5.5, 0.4);
    for (const x of [-6.4, -3.3, 3.3, 6.4]) cp(new THREE.BoxGeometry(1.5, 11.2, 1.4), ym, x, 5.6, 0.7);
    cp(new THREE.BoxGeometry(14.4, 0.8, 1.6), ym, 0, 7.4, 0.8); cp(new THREE.BoxGeometry(14.4, 0.6, 1.5), ym, 0, 11.1, 0.8);
    { const s = new THREE.Shape(); s.moveTo(-5, 0); s.lineTo(5, 0); s.lineTo(5, 1.5); s.quadraticCurveTo(4, 4.5, 0, 5); s.quadraticCurveTo(-4, 4.5, -5, 1.5); s.closePath();
      const hole = new THREE.Path(); hole.absarc(0, 2.4, 1, 0, TAU, true); s.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); cp(g, wm, 0, 11.4, 0.4);
      const trim = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false }); trim.scale(1.06, 1.06, 1); trim.translate(0, 0, -0.6); const t = cp(trim, ym, 0, 11.3, 0.3); t.scale.z = 0.9; }
    { const s = new THREE.Shape(); s.moveTo(-1.7, 0); s.lineTo(1.7, 0); s.lineTo(1.7, 3.6); s.absarc(0, 3.6, 1.7, 0, PI, false); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); cp(g, dm, 0, 0, 1.0); }
    cp(new THREE.BoxGeometry(1.2, 1.2, 0.3), dm, 0, 8.8, 1.05);
    const bell = cp(new THREE.CylinderGeometry(0.3, 0.6, 0.9, 12), new THREE.MeshStandardMaterial({ color: col('#b07a3a'), metalness: 0.5, roughness: 0.4 }), 0, 13.6, 0.4); void bell;
    cp(new THREE.BoxGeometry(3.2, 3.2, 3.2), wm, 8.6, 1.6, -3); cp(new THREE.BoxGeometry(3.6, 0.5, 3.6), ym, 8.6, 3.4, -3);
    // the cacao shop under its arcade, crates and a cacao-pod mural
    const SH = MAP.shop, sy = groundH(SH.x, SH.z) - 0.2;
    const shop = new THREE.Group(); shop.position.set(SH.x, sy, SH.z); shop.rotation.y = SH.rot; scene.add(shop);
    const add = (geo, m, x, y, z) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; shop.add(mm); return mm; };
    const mural = muralBoard(1024, 384, '#ffd21f', ['CACAO DE CHUAO', 'Hecho a mano'], { pod: true, ink: '#c0392b', band: '#2a9b5a' });
    const shopM = new THREE.MeshStandardMaterial({ color: col('#f2c230'), roughness: 0.8 });
    add(new THREE.BoxGeometry(18, 6, 8), [shopM, shopM, shopM, shopM, new THREE.MeshStandardMaterial({ map: mural, roughness: 0.8 }), shopM], 0, 3, -2);
    add(new THREE.BoxGeometry(19, 0.5, 5), new THREE.MeshStandardMaterial({ color: col('#c2593a') }), 0, 4.7, 3.6);
    for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(0.28, 0.32, 4.5, 10), wm, -8.4 + k * 3.36, 2.25, 5.6);
    add(new THREE.BoxGeometry(18.5, 0.6, 0.8), wm, 0, 4.6, 5.6);
    for (let k = 0; k < 10; k++) addBox(V3(SH.x + rr(-8, 8) * Math.cos(SH.rot), sy + 0.35 + (k % 3) * 0.6, SH.z - rr(-8, 8) * Math.sin(SH.rot) + 0) , V3(0.9, 0.55, 0.6), SH.rot + rr(-0.2, 0.2), '#a8784a');
    // The church and the shop are 25 solid pieces: merged by look (paints
    // move into vertex colours), the plaza costs a few draws instead.
    for (const group of [church, shop]) {
      scene.remove(group); scene.add(bake(group, { tint: true }));
      group.traverse(o => o.geometry?.dispose());
    }
    scene.userData.plaza = V3(PL.x, plazaY, PL.z);
  }
  // the hanging 'Bienvenido a Chuao' sign over the town street
  {
    const i = idxNear(MAP.welcome[0], MAP.welcome[1]), f = roadFrame(i), y = roadY[i];
    const a = roadAt(i, -hwL[i] - 1.5, 0), b = roadAt(i, hwR[i] + 1.5, 0);
    for (const p of [a, b]) beams.wood.push(placeBeam(p.clone().setY(groundH(p.x, p.z) - 0.4), p.clone().setY(y + 7.5), 0.3, 0.3));
    beams.wood.push(placeBeam(a.clone().setY(y + 7.3), b.clone().setY(y + 7.3), 0.12, 0.12));
    const tex = textBoard(1024, 256, '#3a2a1c', (c, w, h) => {
      c.strokeStyle = '#d9c8a4'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#f6f0e2'; c.font = 'bold 96px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BIENVENIDO A CHUAO', w / 2, h * 0.42);
      c.fillStyle = '#ffd21f'; c.font = 'bold 50px sans-serif'; c.fillText('TIERRA DEL CACAO', w / 2, h * 0.78);
    });
    const tm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 0.15), [WOOD, WOOD, WOOD, WOOD, tm, tm]);
    const mid = a.clone().lerp(b, 0.5); board.position.copy(mid).setY(y + 5.6); board.lookAt(board.position.clone().addScaledVector(f.t, -1)); board.castShadow = true; scene.add(board);
    for (const o of [-3, 3]) { const p = mid.clone().add(V3(-f.t.z * o, 0, f.t.x * o)); beams.wood.push(placeBeam(p.clone().setY(y + 6.6), p.clone().setY(y + 7.3), 0.04, 0.04)); }
    scene.userData.welcome = mid.clone().setY(y + 5.6);
  }
  // power lines along the town street
  {
    const pIdx = []; for (let i = 0; i < NR; i++) if (SEG[i] === 'p') pIdx.push(i);
    const poles = [];
    for (let k = 0; k < pIdx.length; k += Math.round(28 / (ROAD_LEN / NR))) { const i = pIdx[k], p = roadAt(i, -(lateralHW(i, -1) + 1.1)); p.y = groundH(p.x, p.z); push(inst.cyl, p, Q, S.set(0.16, 8.4, 0.16), col('#8a8478')); poles.push(p.clone().setY(p.y + 8)); addBox(p.clone().setY(p.y + 7.8), V3(1.6, 0.12, 0.12), yawOf(roadFrame(i).n), '#5a5048'); }
    const pts = [];
    for (let k = 1; k < poles.length; k++) { const a = poles[k - 1], b = poles[k]; for (const off of [-0.6, 0, 0.6]) for (let j = 0; j < 10; j++) { const t0 = j / 10, t1 = (j + 1) / 10, p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1); p0.y += off * 0.1 - 1.1 * 4 * t0 * (1 - t0); p1.y += off * 0.1 - 1.1 * 4 * t1 * (1 - t1); pts.push(p0, p1); } }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col('#2a2622') })));
  }

  /* ---------------- the cacaotal: shade trees, cacao, crates and drying racks ---------------- */
  {
    tries(CZ.bucare, () => { const x = rr(CZ.xMin, CZ.xMax), z = rr(CZ.zMin, CZ.zMax); if (!freeOf(x, z, 3)) return false; bucare(x, z); return true; });
    tries(CZ.cacao, () => { const x = rr(CZ.xMin, CZ.xMax), z = rr(CZ.zMin, CZ.zMax); if (!freeOf(x, z, 0.8)) return false; cacaoTree(x, z); return true; });
    // crates stacked by the road, a couple of drying racks
    for (let i = 0; i < NR; i += 28) {
      if (SEG[i] !== 'c' || rand() < 0.4) continue;
      const side = rand() < 0.5 ? -1 : 1, f = roadFrame(i), p = roadAt(i, side * (lateralHW(i, side) + 1.8)); p.y = groundH(p.x, p.z);
      const n = 2 + (rand() * 4 | 0);
      for (let k = 0; k < n; k++) addBox(p.clone().addScaledVector(f.t, (k % 2) * 0.95).setY(p.y + 0.3 + Math.floor(k / 2) * 0.58), V3(0.9, 0.55, 0.6), yawOf(f.t) + rr(-0.15, 0.15), '#a8784a');
      if (rand() < 0.3) {
        const q = roadAt(i, side * (lateralHW(i, side) + 6)); q.y = groundH(q.x, q.z);
        for (const o of [-2, 2]) for (const s2 of [-0.9, 0.9]) beams.wood.push(placeBeam(q.clone().addScaledVector(f.t, o).addScaledVector(f.n, s2).setY(q.y - 0.2), q.clone().addScaledVector(f.t, o).addScaledVector(f.n, s2).setY(q.y + 1), 0.1, 0.1));
        addBox(q.clone().setY(q.y + 1.05), V3(2.2, 0.08, 4.4), yawOf(f.t), '#7a5232');
        push(inst.disc, q.clone().setY(q.y + 1.11), qYaw(yawOf(f.t)), S.set(0.95, 1, 1.9), col('#6a2a20'));
      }
    }
  }
  function tries(n, fn) { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; }

  /* ---------------- vegetation over the valley and the beach ---------------- */
  const Z = MAP.zones, TZ = Z.town;
  const inTown = (x, z) => x > TZ.xMin - 8 && x < TZ.xMax + 8 && z > TZ.zMin - 8 && z < TZ.zMax + 8;
  const nearFall = (x, z) => Math.hypot(x - MAP.fall.x, (z - MAP.fall.z) * 1.6) < 18;
  const steep = (x, z) => Math.hypot(base(x + 2, z) - base(x - 2, z), base(x, z + 2) - base(x, z - 2)) / 4 > 1.8;
  const okVeg = (x, z, rm) => !steep(x, z) && Math.abs(x) < 342 && Math.abs(z) < 342 && freeOf(x, z, rm) && !nearPlaza(x, z, 8) && !inCacao(x, z) && !inTown(x, z) && !nearFall(x, z);
  tries(Z.forest, () => {
    const x = rr(-342, 342), z = rr(-342, 230); if (!okVeg(x, z, 12)) return false;
    const y = terrainH(x, z); if (y < 3.5) return false;
    const v = valleyAt(z), wall = Math.abs(x - v.cx) - v.hw, dry = y > 30 && z > -160 && rand() < WALL.dry;
    tree(x, z, rand() < (wall > 0 ? 0.25 : 0.45), dry); return true;
  });
  // Dense jungle on both sides of the existing upper switchbacks.
  tries(360, () => {
    const x = rr(-3, 90), z = rr(-265, -122);
    if (!okVeg(x, z, 4.5)) return false;
    tree(x, z, rand() < 0.55, false); return true;
  });
  tries(540, () => {
    const x = rr(-12, 95), z = rr(-268, -120);
    if (!okVeg(x, z, 1.8)) return false;
    rand() < 0.6 ? fern(x, z, rr(0.9, 1.6)) : bush(x, z, rr(0.8, 1.4)); return true;
  });
  // jungle crowding the river and the gorge under the falls
  for (const rv of [MAIN]) for (let i = 0; i < rv.N; i += 4) { const p = rv.P[i], t = rv.P[Math.min(rv.N, i + 1)].clone().sub(p).normalize(); for (const s of [-1, 1]) { if (rand() < 0.35) continue; const o = rv.HW[i] + rr(3, 9), x = p.x - t.z * s * o, z = p.z + t.x * s * o; if (!okVeg(x, z, 3)) continue; rand() < 0.4 ? fern(x, z, rr(1, 1.8)) : tree(x, z, rand() < 0.5); } }
  tries(Z.beachPalms, () => { const x = rr(-180, 190), z = rr(100, 150), dd = shoreD(x, z); if (dd < 6 || dd > 46 || !okVeg(x, z, 2.5) || Math.hypot(x - MAP.jetty.x, z - 148) < 8) return false; palm(x, z, V3(0, 0, 1), dd < 18 ? 0.85 : 1); return true; });
  // palms leaning over the lagoon at the boca
  for (const f of MAP.features) if (f.type === 'lagoon') for (let k = 0; k < 14; k++) { const a = rand() * TAU, x = f.x + Math.cos(a) * f.rx * rr(1.15, 1.5), z = f.z + Math.sin(a) * f.rz * rr(1.15, 1.5); if (okVeg(x, z, 2)) palm(x, z, V3(f.x - x, 0, f.z - z)); }
  tries(Z.seaGrape, () => { const x = rr(-190, 200), z = rr(110, 152), dd = shoreD(x, z); if (dd < 4 || dd > 22 || !okVeg(x, z, 2) || Math.hypot(x - MAP.jetty.x, z - 150) < 8) return false; seaGrape(x, z); return true; });
  tries(2200, () => { const x = rr(-342, 342), z = rr(-342, 220); if (!okVeg(x, z, 2.5) || terrainH(x, z) < 3) return false; rand() < 0.5 ? fern(x, z, rr(0.8, 1.5)) : bush(x, z, rr(0.7, 1.4)); return true; });
  tries(12000, () => {
    const x = rr(-342, 342), z = rr(-342, 220); if (!freeOf(x, z, 1.2) || nearPlaza(x, z, 3) || steep(x, z)) return false;
    const y = terrainH(x, z); if (y < 2.6) return false;
    const s = rr(0.8, 1.6);
    push(inst.grass, V3(x, y - 0.05, z), qYaw(rand() * TAU), S.set(s * 1.4, s, s * 1.4), col(y > 30 ? '#b8b060' : '#7fc84a').offsetHSL(rr(-0.03, 0.03), rr(-0.1, 0.05), rr(-0.08, 0.06)));
    return true;
  });
  // boulders in the river bed and under the falls, rocks at the headlands
  for (let i = 0; i < MAIN.N; i += 2) { const p = MAIN.P[i], t = MAIN.P[Math.min(MAIN.N, i + 1)].clone().sub(p).normalize(); if (rand() < 0.4) { const o = (rand() < 0.5 ? -1 : 1) * (MAIN.HW[i] + rr(0.5, 2.5)), s = rr(0.8, 2.6); push(inst.rock, V3(p.x - t.z * o, MAIN.Y[i] - 0.3, p.z + t.x * o), qEuler(rand(), rand() * TAU, rand()), S.set(s * 1.2, s * 0.7, s), col('#8a8170').offsetHSL(0, 0, rr(-0.1, 0.05))); } }
  for (let k = 0; k < 26; k++) { const a = rand() * TAU, r = rr(0.6, 1.2) * MAIN.R.pool; const x = POOL.x + Math.cos(a) * r, z = POOL.z + Math.sin(a) * r * 0.7; if (sampleR(RR, x, z).dist > 9) rock(x, z, rr(1.5, 4), POOL.y - 0.4); }
  for (let i = 0; i < NSH; i += 2) { const p = SHP[i]; if (p.x > -185 && p.x < 190) continue; if (rand() < 0.5) rock(p.x + rr(-4, 4), p.z + rr(-4, 4), rr(1, 3.5), -0.6); }
  tries(1800, () => {
    const x = rr(-1200, 1200), z = rr(-1300, -350);
    const y = farH(x, z); if (y < 3) return false;
    vegetation.add('tree', x, z, y, 1.2, 100); return true;
  });

  /* ---------------- signs ---------------- */
  MAP.signs.forEach((sg, k) => roadSign(idxNear(sg.at[0], sg.at[1]), sg.side, sg.lines, sg.arrow, k));

  /* ---------------- clouds, mist at the falls ---------------- */
  const clouds = [], mist = [];
  {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    for (let k = 0; k < 50; k++) { const a = rr(PI * 0.9, PI * 2.1), r = rr(800, 1400), s = new THREE.Sprite(mat); s.position.set(Math.cos(a) * r, rr(160, 300), Math.sin(a) * r * 0.8 - 300); const sc = rr(160, 320); s.scale.set(sc, sc * 0.45, 1); scene.add(s); clouds.push(s); }
    const low = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.35, depthWrite: false, fog: true });
    for (let k = 0; k < 10; k++) { const x = rr(-340, 340), z = rr(-340, -300), s = new THREE.Sprite(low); s.position.set(x, base(x, z) + rr(12, 30), z); const sc = rr(50, 100); s.scale.set(sc, sc * 0.4, 1); scene.add(s); clouds.push(s); }
    // Mist and spray at the falls as one particle cloud animated on the GPU
    // (it was 22 sprites, 22 draws). The 22 slow mist puffs keep their
    // original random draws, so the rest of the valley keeps its layout;
    // the fast spray rising off the landing uses its own seed.
    const puffs = [], spray = rng(4127), landing = scene.userData.fallLanding;
    for (let k = 0; k < 22; k++) { const x = POOL.x + rr(-14, 14), y = POOL.y + rr(1, 9), z = POOL.z + rr(-12, 6), size = rr(6, 14); puffs.push([x, y, z, size, rand() * TAU, 0]); }
    for (let k = 0; k < 140; k++) { const a = spray() * TAU, r = spray() * MAP.fall.width * 1.6; puffs.push([landing.x + Math.cos(a) * r, POOL.y + 0.5, landing.z + Math.sin(a) * r * 0.7, 1.5 + spray() * 3.5, spray(), 1]); }
    const cloud = new THREE.BufferGeometry();
    cloud.setAttribute('position', new THREE.Float32BufferAttribute(puffs.flatMap(p => p.slice(0, 3)), 3));
    cloud.setAttribute('puff', new THREE.Float32BufferAttribute(puffs.flatMap(p => p.slice(3)), 3));
    const mistUniforms = { uT: { value: 0 } };
    const mm = new THREE.PointsMaterial({ map: cloudTex, color: col('#ffffff'), size: 1, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
    mm.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, mistUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 puff; uniform float uT; varying float vFade;')
        .replace('#include <begin_vertex>', `vec3 transformed = position; float grow = puff.x;
          if (puff.z > 0.5) { float life = fract(uT * 0.45 + puff.y); transformed += vec3(sin(puff.y * 40.0) * 2.5 * life, life * 9.0, cos(puff.y * 31.0) * 2.0 * life); grow *= 0.5 + life * 1.6; vFade = sin(life * 3.14159); }
          else { transformed.y += sin(uT * 0.6 + puff.y) * 1.2; vFade = 0.8; }`)
        .replace('gl_PointSize = size;', 'gl_PointSize = size * grow;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vFade;')
        .replace('#include <alphatest_fragment>', 'diffuseColor.a *= vFade;\n#include <alphatest_fragment>');
    };
    const mistCloud = new THREE.Points(cloud, mm); mistCloud.frustumCulled = false; scene.add(mistCloud); mist.push(mistUniforms);
  }

  /* ---------------- flush instances ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c || col('#ffffff')); });
    im.castShadow = cast; im.receiveShadow = true; scene.add(im);
    return im;
  }
  flush(inst.trunk, trunkGeo, BARK);
  flush(inst.blob, blobGeo, CANOPY);
  flush(inst.bushBlob, new THREE.IcosahedronGeometry(1, 0), CANOPY);
  flush(inst.frond, frondGeo, FROND);
  flush(inst.grass, grassGeo, GRASS, false);
  flush(inst.rock, new THREE.DodecahedronGeometry(1, 1), SMOOTH);
  flush(inst.flower, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, emissive: col('#330808'), emissiveIntensity: 0.4, flatShading: true }), false);
  flush(inst.pod, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.5 }), false);
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), PAINT);
  { const g = new THREE.CylinderGeometry(1, 1, 0.06, 20); flush(inst.disc, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, polygonOffset: true, polygonOffsetFactor: -3 }), false); }
  {
    const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5);
    flush(inst.roof, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85, side: THREE.DoubleSide }));
  }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 })); }
  {
    const mats = { steel: new THREE.MeshStandardMaterial({ color: col('#b9bcc0'), metalness: 0.5, roughness: 0.4 }), white: new THREE.MeshStandardMaterial({ color: col('#f4f1ea'), roughness: 0.6 }), wood: WOOD, concrete: new THREE.MeshStandardMaterial({ color: col('#bdb6a8'), roughness: 0.9 }), yellow: new THREE.MeshStandardMaterial({ color: col('#ffd21f') }) };
    const bg = new THREE.BoxGeometry(1, 1, 1);
    for (const [k, list] of Object.entries(beams)) if (list.length) { const im = new THREE.InstancedMesh(bg, mats[k], list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  }
  flush(boats.hull, peneroGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  flush(boats.band, bandGeo, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 }));

  /* ---------------- peñeros coming and going at the landing, pelicans overhead ---------------- */
  const movers = [];
  {
    const J = scene.userData.jetty;
    for (let k = 0; k < MAP.peneros.ferry; k++) {
      const g = new THREE.Group();
      const h = new THREE.Mesh(peneroGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })); h.castShadow = true; g.add(h);
      const b = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ color: PENEROS[k % 4] })); b.scale.x = 1.08; g.add(b);
      // passengers: little round heads in bright hats
      for (let j = 0; j < 6; j++) { const hd = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), new THREE.MeshStandardMaterial({ color: col(pick(['#b5773e', '#8a5a32', '#e8462e', '#ffd21f', '#3d7bf2'])) })); hd.position.set((j % 2 ? 0.4 : -0.4), 1.15, -2 + Math.floor(j / 2) * 1.4); g.add(hd); }
      scene.add(g);
      const far = V3(rr(-200, 240), 0, rr(320, 420));
      movers.push({ g, a: V3(J.x + (k - 1) * 4.5, 0, J.z + 2), b: far, ph: k / MAP.peneros.ferry, period: rr(70, 90) });
    }
  }
  const birds = [];
  {
    const mBody = new THREE.MeshStandardMaterial({ color: col('#8a8278'), roughness: 0.8, flatShading: true }), mWing = new THREE.MeshStandardMaterial({ color: col('#6f675f'), roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    for (let k = 0; k < 10; k++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mBody); body.scale.set(0.4, 0.4, 1.1); b.add(body);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 6), new THREE.MeshStandardMaterial({ color: col('#d8b46a') })); beak.position.set(0, 0.05, 1.5); beak.rotation.x = PI / 2; b.add(beak);
      const wings = [];
      for (const s of [-1, 1]) { const pivot = new THREE.Group(); pivot.position.set(s * 0.3, 0.1, 0.1); b.add(pivot); const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.8), mWing); w.position.set(s * 1.3, 0, 0); pivot.add(w); wings.push({ pivot, s }); }
      b.scale.setScalar(1.2); scene.add(b);
      birds.push({ g: b, wings, c: V3(rr(-150, 160), rr(16, 40), rr(160, 260)), r: rr(30, 90), sp: rr(0.1, 0.18) * (rand() < 0.5 ? -1 : 1), ph: rand() * TAU, fl: rr(2, 3.2) });
    }
  }

  function update(t, dt) {
    uTime.value = t;
    waterMats.forEach(m => (m.uniforms.uT.value = t));
    // each ferry peñero: out in the bay, a run in to the jetty, a stop, and back out
    movers.forEach(m => {
      const u = ((t / m.period) + m.ph) % 1;
      let k, dir;
      if (u < 0.4) { k = sstep(0, 0.4, u); dir = 1; } else if (u < 0.55) { k = 1; dir = 0; } else if (u < 0.95) { k = 1 - sstep(0.55, 0.95, u); dir = -1; } else { k = 0; dir = 0; }
      const p = m.b.clone().lerp(m.a, k);
      m.g.position.set(p.x, 0.05 + Math.sin(t * 1.4 + m.ph * 9) * 0.07, p.z);
      const head = m.a.clone().sub(m.b); if (dir < 0) head.negate(); if (dir === 0) head.copy(m.a.clone().sub(m.b));
      m.g.rotation.set(Math.sin(t * 1.1) * 0.03, Math.atan2(head.x, head.z), Math.sin(t * 0.9 + m.ph) * 0.04);
    });
    birds.forEach(b => {
      const a = b.ph + t * b.sp, p = V3(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(t * 0.5 + b.ph) * 3, b.c.z + Math.sin(a) * b.r);
      const ahead = V3(b.c.x + Math.cos(a + 0.05 * Math.sign(b.sp)) * b.r, p.y, b.c.z + Math.sin(a + 0.05 * Math.sign(b.sp)) * b.r);
      b.g.position.copy(p); b.g.lookAt(ahead); b.g.rotateZ(-0.3 * Math.sign(b.sp));
      const flap = Math.max(0, Math.sin(t * b.fl + b.ph)) * 0.5 - 0.1; b.wings.forEach(w => (w.pivot.rotation.z = w.s * flap));
    });
    mist.forEach(u => { u.uT.value = t; });
  }

  disposeOwned(scene);
  vegetation.flush();
  return { group: scene, groundAt: groundH, update };
}
