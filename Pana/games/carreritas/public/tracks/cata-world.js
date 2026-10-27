// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import { extendTerrain } from '/engine/worlds/coastal/world-horizon.js';
import * as THREE from 'three';
import { disposeOwned } from './reference-world.js';
import { canvasTexture } from '/engine/models/core/primitives.js';
import { coastalVegetation } from '/engine/worlds/coastal/coastal-vegetation.js';
import { MAP } from './cata-layout.js';
export function createWorld(scene, layout, roadDistance) {
  const vegetation = coastalVegetation(scene, 1.6, roadDistance);
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

  const SUN_DIR = new THREE.Vector3(-0.62, 0.3, 0.52).normalize();
  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => canvasTexture(w, h, draw, { srgb });
  const asphaltTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#9a9a9c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(40,40,44,${rr(0.05, 0.18).toFixed(2)})` : `rgba(255,255,250,${rr(0.04, 0.14).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(30,30,34,0.12)'; c.fillRect(rr(20, w - 80), rr(0, h), rr(30, 70), rr(20, 60)); }
    c.fillStyle = 'rgba(250,248,236,0.9)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#f3c63a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const plankTex = canvasTex(256, 256, (c, w, h) => {
    for (let y = 0; y < h; y += 16) {
      c.fillStyle = `hsl(${rr(26, 34).toFixed(0)}, ${rr(30, 42).toFixed(0)}%, ${rr(42, 54).toFixed(0)}%)`; c.fillRect(0, y, w, 16);
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
  const flagTex = canvasTex(192, 128, (c, w, h) => {
    c.fillStyle = '#ffcc00'; c.fillRect(0, 0, w, h / 3); c.fillStyle = '#00247d'; c.fillRect(0, h / 3, w, h / 3); c.fillStyle = '#cf142b'; c.fillRect(0, h * 2 / 3, w, h / 3);
    c.fillStyle = '#ffffff';
    for (let k = 0; k < 8; k++) { const a = PI * (0.85 - k * 0.1), cx = w / 2 + Math.cos(a) * 30, cy = h * 0.62 - Math.sin(a) * 22; c.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 2 : 5, b = -PI / 2 + j * PI / 5; c.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r); } c.fill(); }
  });
  // the towers: rows of balconies and dark windows on a sand-coloured slab
  const facadeTex = canvasTex(512, 1024, (c, w, h) => {
    c.fillStyle = '#d9c8a4'; c.fillRect(0, 0, w, h);
    const floors = 24, fh = h / floors, bays = 12, bw = w / bays;
    for (let f = 0; f < floors; f++) {
      const y = f * fh;
      for (let b = 0; b < bays; b++) {
        const lit = rand() < 0.18;
        c.fillStyle = lit ? '#e8c890' : `hsl(${rr(200, 215).toFixed(0)}, 18%, ${rr(18, 30).toFixed(0)}%)`;
        c.fillRect(b * bw + 4, y + fh * 0.28, bw - 8, fh * 0.52);
        if (rand() < 0.12) { c.fillStyle = pick(['#2f8ae0', '#ff8a1f', '#f2efe6']); c.fillRect(b * bw + 6, y + fh * 0.5, bw - 12, fh * 0.28); }
      }
      c.fillStyle = '#f2ebdc'; c.fillRect(0, y + fh * 0.8, w, fh * 0.2);
      c.fillStyle = 'rgba(80,60,40,0.25)'; c.fillRect(0, y + fh * 0.78, w, 2);
    }
    for (let b = 0; b <= bays; b += 3) { c.fillStyle = 'rgba(240,232,214,0.9)'; c.fillRect(b * bw - 3, 0, 6, h); }
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
  const { SIZE, CELL, GR, HALF, shoreCurve, NSH, SHP, SHR, farShoreZ, B, MT, CTRL, roadCurve, ROAD_LEN, NR, RP, ctrlAt, SEG, RV, riverCurve, NV, VP, RR, VR, MOUNT, riverY, hwL, hwR, roadY, bank, elev, splash, roadFrame, roadAt, lateralHW, farH: originalFarH, groundH: originalGroundH, raster, sampleR, shoreD, landFromD, base, natural, terrainH } = layout;


  const farH = (x,z) => horizon?.heightAt(x,z) ?? originalFarH(x,z);
  const groundH = (x,z) => horizon?.heightAt(x,z) ?? originalGroundH(x,z);

  /* ---------------- terrain ---------------- */
  const cGrass = col('#4f9a2a'), cGrass2 = col('#7bb83a'), cDark = col('#2c6a22'), cRock = col('#8a7e6c'), cSand = col('#ead19a'), cWetSand = col('#cfae76'), cGrove = col('#8a9a4a'), cVerge = col('#d8c494'), cMud = col('#7a6440');
  function paintGround(x, z, y, slope, tmp) {
    const n1 = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.sin(z * 0.05) * 3) * Math.cos(z * 0.08 - x * 0.03);
    tmp.copy(cGrass).lerp(cGrass2, n1 * 0.7).lerp(cDark, sstep(0.55, 0.95, 0.5 + 0.5 * Math.sin(x * 0.023 - z * 0.031)) * 0.5);
    tmp.lerp(cRock, sstep(0.5, 0.85, slope) * 0.7);
    const dd = shoreD(x, z);
    tmp.lerp(cGrove, (1 - sstep(MAP.zones.grove.dMin, MAP.zones.grove.dMax, dd)) * 0.5);
    if (dd >= 0) tmp.lerp(cSand, 1 - sstep(B.width * 0.65, B.width + 2, dd));
    else tmp.lerp(cSand, sstep(2.6, 1.6, y));   // island beach and sandbar
    if (y < 0.5) tmp.lerp(cWetSand, sstep(0.5, -0.1, y));
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
      const r = sampleR(RR, x, z), v = sampleR(VR, x, z);
      if (r.i >= 0 && !splash[r.i]) tmp.lerp(cVerge, (1 - sstep(hwR[r.i] - 0.5, hwR[r.i] + 2.5, r.dist)) * 0.6);
      if (v.i >= 0) tmp.lerp(cMud, 1 - sstep(RV.half - 1, RV.half + 2.5, v.dist));
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true; scene.add(m);
    horizon = extendTerrain(m,{bounds:[-350,-350,350,350],nx:350,nz:350,height:originalFarH,color:(x,z,y)=>paintGround(x,z,y,0,new THREE.Color()),biome:'cata'});
  }


  /* ---------------- the sea: turquoise over sand, deep blue further out ---------------- */
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
        vec3 shallow = vec3(0.24, 0.86, 0.8), mid = vec3(0.03, 0.62, 0.7), deep = vec3(0.02, 0.26, 0.5);
        vec3 c = mix(shallow, mid, smoothstep(0.0, 0.3, depth)); c = mix(c, deep, smoothstep(0.35, 1.0, depth));
        c += (a * 0.5 + b * 0.5) * 0.03;
        vec3 V = normalize(cameraPosition - vW), N = normalize(vec3(a * 0.06, 1.0, b * 0.06));
        float spec = pow(max(dot(reflect(-uSun, N), V), 0.0), 120.0);
        c += vec3(1.0, 0.82, 0.55) * spec * 1.6;
        float fres = pow(1.0 - max(V.y, 0.0), 4.0); c = mix(c, vec3(1.0, 0.8, 0.62), fres * 0.35);
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

  /* ---------------- road surface and plank bridge ---------------- */
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
  const ROAD = new THREE.MeshStandardMaterial({ map: asphaltTex, vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const PLANKS = new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85, side: THREE.DoubleSide });
  const WOOD = new THREE.MeshStandardMaterial({ color: col('#7a5232'), roughness: 0.9 });
  {
    // asphalt everywhere; packed sand (light, sandy tint) on the bar and the island
    const rows = [], colors = [], asph = col('#6c6d72'), sand = col('#f0dcae');
    const tint = new Float32Array(NR); for (let i = 0; i < NR; i++) tint[i] = SEG[i] === 's' || SEG[i] === 'i' ? 1 : 0;
    for (let i = 0; i < NR; i++) {
      let t = 0; for (let j = -12; j <= 12; j++) t += tint[(i + j + NR) % NR]; t /= 25;
      rows.push({ a: roadAt(i, -hwL[i], 0.12), b: roadAt(i, hwR[i], 0.12) });
      colors.push(asph.clone().lerp(sand, t * 0.92));
    }
    stripMesh(rows, ROAD, 20, true, colors);
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
  const beams = { steel: [], white: [], wood: [], concrete: [] };
  {
    const step = Math.round(4 / (ROAD_LEN / NR));
    for (const side of [-1, 1]) {
      let prev = null;
      for (let i = 0; i < NR; i += step) {
        const s = SEG[i], bridge = elev[i] || elev[(i + 3) % NR];
        const kind = bridge ? 'wood' : MOUNT[s] ? 'steel' : s === 'i' ? 'wood' : null;
        if (!kind) { prev = null; continue; }
        const lat = side * (lateralHW(i, side) + (bridge ? 0.4 : 1.2)), base0 = roadAt(i, lat, bridge ? 0.2 : 0);
        if (!bridge) base0.y = Math.min(base0.y, terrainH(base0.x, base0.z) + 0.1);
        const h = kind === 'steel' ? 0.85 : 1.1, top = base0.clone().setY(base0.y + h);
        if (bridge) { const g = natural(base0.x, base0.z) - 1; beams.wood.push(placeBeam(base0.clone().setY(g), top, 0.32, 0.32)); }
        else beams[kind].push(placeBeam(base0.clone().setY(base0.y - 0.3), top, kind === 'steel' ? 0.16 : 0.16, 0.16));
        if (prev && prev.distanceTo(top) < 9) {
          if (kind === 'steel') beams.steel.push(placeBeam(prev.clone().setY(prev.y - 0.12), top.clone().setY(top.y - 0.12), 0.08, 0.34));
          else { beams.wood.push(placeBeam(prev, top, 0.12, 0.16)); if (bridge) beams.wood.push(placeBeam(prev.clone().setY(prev.y - 0.55), top.clone().setY(top.y - 0.55), 0.1, 0.14)); }
        }
        prev = top;
      }
    }
  }
  {
    const chevTex = canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = '#ffd21f'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1c1c';
      for (let k = 0; k < 4; k++) { const x = 30 + k * 56; c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 26, h / 2); c.lineTo(x, h - 8); c.lineTo(x + 14, h - 8); c.lineTo(x + 40, h / 2); c.lineTo(x + 14, 8); c.fill(); }
    });
    const signMat = new THREE.MeshStandardMaterial({ map: chevTex, roughness: 0.6 });
    for (let i = 0; i < NR; i += 6) {
      if (!MOUNT[SEG[i]]) continue;
      const a = roadFrame(i - 30).t, b = roadFrame(i + 30).t, turn = a.x * b.z - a.z * b.x;
      if (Math.abs(turn) < 0.75) continue;
      const side = turn > 0 ? -1 : 1, f = roadFrame(i);
      const p0 = roadAt(i, side * (lateralHW(i, side) + 4)); p0.y = terrainH(p0.x, p0.z);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 0.18), signMat);
      sign.position.copy(p0).setY(p0.y + 1.7); sign.lookAt(p0.clone().addScaledVector(f.n, -side).setY(p0.y + 1.7)); sign.castShadow = true; scene.add(sign);
      for (const o of [-1.6, 1.6]) beams.steel.push(placeBeam(p0.clone().addScaledVector(f.t, o).setY(p0.y - 0.3), p0.clone().addScaledVector(f.t, o).setY(p0.y + 1.2), 0.12, 0.12));
      i += 160;
    }
  }
  const roadSign = (i, side, lines, arrow, opts = {}) => {
    const tex = textBoard(512, 256, opts.bg || '#1d4fa8', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 10; c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#ffffff'; c.font = `bold ${opts.size || 54}px sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
      lines.forEach((t, k) => c.fillText(t, 40, h / 2 + (k - (lines.length - 1) / 2) * 66));
      if (arrow) { c.save(); c.translate(w - 80, h / 2); c.rotate({ left: PI, right: 0, up: -PI / 2 }[arrow]); c.beginPath(); c.moveTo(-36, -12); c.lineTo(8, -12); c.lineTo(8, -34); c.lineTo(46, 0); c.lineTo(8, 34); c.lineTo(8, 12); c.lineTo(-36, 12); c.closePath(); c.fill(); c.restore(); }
    });
    const f = roadFrame(i), p0 = roadAt(i, side * (lateralHW(i, side) + 3)); p0.y = terrainH(p0.x, p0.z);
    const W = opts.w || 4, Y = opts.y || 3;
    const board = new THREE.Mesh(new THREE.BoxGeometry(W, opts.h || 2, 0.12), [WOOD, WOOD, WOOD, WOOD, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), WOOD]);
    board.position.copy(p0).setY(p0.y + Y); board.lookAt(board.position.clone().addScaledVector(f.t, -1)); board.castShadow = true; scene.add(board);
    const n2 = V3(-f.t.z, 0, f.t.x);
    for (const o of [-W / 2 + 0.3, W / 2 - 0.3]) beams.steel.push(placeBeam(p0.clone().addScaledVector(n2, o).setY(p0.y - 0.3), p0.clone().addScaledVector(n2, o).setY(p0.y + Y - 0.2), 0.14, 0.14));
  };
  const idxNear = (x, z, from = 0, to = NR) => { let b = from, bd = 1e9; for (let i = from; i < to; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };

  /* ---------------- the quebrada ---------------- */
  function waterMaterial(speed, alpha = 0.85) {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSpeed: { value: speed }, uSun: { value: SUN_DIR }, uA: { value: alpha } }]),
      vertexShader: `attribute float foam; varying vec2 vUv; varying float vFoam; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vFoam = foam; vW = (modelMatrix * vec4(position,1.0)).xyz; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uT; uniform float uSpeed; uniform vec3 uSun; uniform float uA; varying vec2 vUv; varying float vFoam; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          float flow = vUv.y - uT * uSpeed * (1.0 + vFoam * 2.5);
          float a = sin(vUv.x * 14.0 + sin(vUv.y * 0.35 + uT) * 2.0 + flow * 1.3), b = sin(vUv.x * 5.0 - flow * 2.0 + sin(vUv.y * 0.2) * 3.0);
          float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
          vec3 c = mix(vec3(0.04, 0.2, 0.18), vec3(0.18, 0.5, 0.42), 0.45 + 0.3 * a) + smoothstep(0.6, 1.0, a * 0.5 + b * 0.5) * 0.12;
          vec3 V = normalize(cameraPosition - vW), Nn = normalize(vec3(a * 0.08, 1.0, b * 0.08));
          c += vec3(1.0, 0.9, 0.7) * pow(max(dot(reflect(-uSun, Nn), V), 0.0), 90.0) * 1.4;
          c = mix(c, vec3(0.97, 0.98, 0.95), clamp(vFoam * (0.7 + 0.3 * b), 0.0, 1.0));
          gl_FragColor = vec4(c, uA * (0.55 + 0.45 * edge));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    waterMats.push(m); return m;
  }
  {
    const pos = [], uv = [], foam = [], idx = [];
    let dist = 0;
    for (let i = 0; i <= NV; i++) {
      const p = VP[i], t = VP[Math.min(NV, i + 1)].clone().sub(VP[Math.max(0, i - 1)]).normalize(), side = V3(-t.z, 0, t.x);
      if (i) dist += p.distanceTo(VP[i - 1]);
      for (const s of [-1, 1]) { const v = p.clone().setY(riverY[i] + 0.1).addScaledVector(side, s * (RV.half + 0.8)); pos.push(v.x, v.y, v.z); uv.push((s + 1) / 2, dist * 0.22); foam.push(p.z < 0 ? 0.35 : 0.1); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('foam', new THREE.Float32BufferAttribute(foam, 1)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, waterMaterial(1.2)); m.renderOrder = 2; scene.add(m);
  }

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
  const inst = { blob: [], bushBlob: [], trunk: [], frond: [], grass: [], rock: [], flower: [], box: [], roof: [], cone: [], cyl: [], tri: [], thatch: [] };
  const push = (list, pos, quat, scale, color) => { if ((list === inst.rock || list === inst.bushBlob) && sampleR(RR,pos.x,pos.z).dist < 10 + Math.max(scale.x,scale.z)) return; d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const yawOf = v => Math.atan2(v.x, v.z);
  const BARK_C = col('#7d5c40'), PALM_C = col('#9a8466');
  const GREENS = ['#2f8a22', '#3a9c26', '#4aae2f', '#24701d', '#58b83a', '#1f7a2a', '#3d8f1f'].map(col);
  const FLOWER_TREE = ['#ffd21f', '#ff8fc2', '#ff6a3a'].map(col);
  const FLOWERS = ['#ff2e45', '#ff7a1a', '#ff3d8b', '#ffd23a', '#ffffff', '#b45cff'].map(col);
  function tree(x, z, big) {
    vegetation.add('tree', x, z, groundH(x,z), big ? 1.6 : 1, sampleR(RR,x,z).dist);
  }
  // cocotero: curved ringed trunk, leaning toward the light or the sea
  function palm(x, z, leanTo, tall = 1) {
    vegetation.add('palm', x, z, groundH(x,z), 1, sampleR(RR,x,z).dist);
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
  const addBox = (p, s, yaw, color) => push(inst.box, p, qYaw(yaw), S.copy(s), col(color));
  const rock = (x, z, s, y) => push(inst.rock, V3(x, (y ?? groundH(x, z)) + s * 0.15, z), qEuler(rand(), rand() * TAU, rand()), S.set(s * 1.3, s * 0.8, s), col('#7d776a').offsetHSL(0, 0, rr(-0.1, 0.06)));

  /* ---------------- start arch with bunting ---------------- */
  const i0 = idxNear(MAP.startAt[0], MAP.startAt[1]);
  const muralAt = MAP.mural;
  const BUNT = ['#ff4b4b', '#ffc629', '#2ad1b2', '#3d7bf2', '#ffffff', '#f15bb5', '#5fc93a'].map(col);
  const bunting = (a, b, sag = 1.2) => {
    const n = Math.max(4, Math.round(a.distanceTo(b) / 0.8)), dir = b.clone().sub(a).setY(0).normalize();
    for (let k = 0; k <= n; k++) { const t = k / n, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); push(inst.tri, p, qYaw(yawOf(dir) + PI / 2), S.set(0.42, 0.55, 1), BUNT[k % BUNT.length]); }
  };
  // Carreritas's shared startLine owns the finish stripe and gantry.


  /* ---------------- Las torres ---------------- */
  {
    const fm = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.7 }), endM = new THREE.MeshStandardMaterial({ color: col('#f2ebdc'), roughness: 0.7 }), roofM = new THREE.MeshStandardMaterial({ color: col('#cfc6b4'), roughness: 0.9 });
    for (const T of MAP.towers) {
      const y = groundH(T.x, T.z) - 0.5, g = new THREE.Group(); g.position.set(T.x, y, T.z); g.rotation.y = T.rot; scene.add(g);
      const body = new THREE.Mesh(new THREE.BoxGeometry(T.w, T.h, T.d), [endM, endM, roofM, roofM, fm, fm]); body.position.y = T.h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
      for (const s of [-1, 1]) { const fin = new THREE.Mesh(new THREE.BoxGeometry(2.2, T.h + 1, T.d + 1.6), endM); fin.position.set(s * (T.w / 2 - 0.4), (T.h + 1) / 2, 0); fin.castShadow = true; g.add(fin); }
      const base2 = new THREE.Mesh(new THREE.BoxGeometry(T.w + 8, 5, T.d + 10), endM); base2.position.y = 2.5; base2.castShadow = true; base2.receiveShadow = true; g.add(base2);
      for (const [x, w, h] of [[-12, 8, 4], [6, 10, 5], [16, 5, 3]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, h, 7), endM); r.position.set(x, T.h + h / 2, 0); r.castShadow = true; g.add(r); }
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2, 12), new THREE.MeshStandardMaterial({ color: col('#2f62c8') })); tank.position.set(-4, T.h + 1, 2); g.add(tank);
      // pool deck and planters in front, toward the sea
      const pool = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 7), new THREE.MeshStandardMaterial({ color: col('#43c4d8'), roughness: 0.15 })); pool.position.set(0, 0.7, T.d / 2 + 11); g.add(pool);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(T.w, 0.6, 16), new THREE.MeshStandardMaterial({ color: col('#9a4a36'), roughness: 0.9 })); deck.position.set(0, 0.3, T.d / 2 + 10); deck.receiveShadow = true; g.add(deck);
    }
  }

  /* ---------------- the beach: kiosks, caneyes, umbrellas, flags, peñeros ---------------- */
  const KIOSK = ['#ff4b4b', '#ffc629', '#2ad1b2', '#3d7bf2', '#f15bb5', '#ff8a1f', '#5fc93a', '#8e4de8'].map(col);
  const flags = [];
  const FLAG_GEO = new THREE.PlaneGeometry(1.8, 1.2, 10, 3); FLAG_GEO.translate(0.9, 0, 0);
  const FLAG_BASE = FLAG_GEO.attributes.position.array.slice();
  const FLAG_MAT = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 });
  const addFlag = (p, h = 4.5) => { beams.steel.push(placeBeam(p.clone().setY(p.y - 0.3), p.clone().setY(p.y + h), 0.07, 0.07)); const m = new THREE.Mesh(FLAG_GEO, FLAG_MAT); m.position.copy(p).setY(p.y + h - 0.7); m.rotation.y = rr(-0.4, 0.4) + PI * 0.15; scene.add(m); flags.push(m); };
  const caney = (x, z, s = 1) => {
    const y = groundH(x, z);
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, px = x + Math.cos(a) * 3.6 * s, pz = z + Math.sin(a) * 3.6 * s; beams.wood.push(placeBeam(V3(px, groundH(px, pz) - 0.3, pz), V3(px, y + 2.6 * s, pz), 0.22, 0.22)); }
    push(inst.thatch, V3(x, y + 2.5 * s, z), qYaw(rand() * TAU), S.set(5.2 * s, 2.8 * s, 5.2 * s), col('#c9a45a').offsetHSL(0, 0, rr(-0.06, 0.04)));
    for (let k = 0; k < 2; k++) { const a = rand() * TAU, p = V3(x + Math.cos(a) * 1.2, y + 1.1, z + Math.sin(a) * 1.2); push(inst.bushBlob, p, qYaw(a), S.set(1.5, 0.22, 0.45), pick(KIOSK)); }
  };
  const peneroGeo = (() => {
    const N = 16, pos = [], idx = [], cl = [], L = 7.2, white = col('#f4f1ea'), bottom = col('#c43a2a');
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
  {
    const pIdx = []; for (let i = 0; i < NR; i++) if (SEG[i] === 'p') pIdx.push(i);
    const UMB = ['#ffd21f', '#2f8ae0', '#ff4b4b', '#ffffff', '#2ad1b2'].map(col);
    const seaSide = i => { const f = roadFrame(i), a = roadAt(i, 10), b = roadAt(i, -10); return shoreD(a.x, a.z) < shoreD(b.x, b.z) ? 1 : -1; };
    for (let k = 0; k < pIdx.length; k += MAP.umbrellas.every) {
      const i = pIdx[k], s = seaSide(i);
      for (let row = 0; row < MAP.umbrellas.rows; row++) {
        if (rand() < 0.3) continue;
        const p = roadAt(i, s * (lateralHW(i, s) + 7 + row * 6 + rr(-1, 1))); p.y = groundH(p.x, p.z);
        if (p.y < 0.6) continue;
        push(inst.cone, p.clone().setY(p.y + 2.6), Q, S.set(2.1, 0.7, 2.1), pick(UMB));
        push(inst.cyl, p.clone().setY(p.y - 0.1), Q, S.set(0.05, 2.7, 0.05), col('#e8e4dc'));
        for (const o of [-1, 1]) addBox(p.clone().add(roadFrame(i).t.clone().multiplyScalar(o * 1.1)).setY(p.y + 0.45), V3(0.55, 0.9, 0.55), rand() * TAU, pick(['#ffffff', '#2f62c8', '#d83a2c']));
      }
      if (k % (MAP.umbrellas.every * 4) === 0) { const p = roadAt(i, s * (lateralHW(i, s) + 4)); p.y = groundH(p.x, p.z); addFlag(p); }
    }
    const K = MAP.kiosks;
    for (let k = 0; k < pIdx.length; k += K.every) {
      const i = pIdx[k], s = -seaSide(i); if (Math.abs(i - i0) < 14) continue;
      const f = roadFrame(i), p = roadAt(i, s * (lateralHW(i, s) + K.offset)); p.y = groundH(p.x, p.z);
      const yaw = yawOf(f.n.clone().multiplyScalar(-s)), c = KIOSK[(k / K.every) % KIOSK.length | 0], fw = f.n.clone().multiplyScalar(-s);
      addBox(p.clone().setY(p.y + 1.3), V3(4.2, 2.8, 3.4), yaw, '#' + c.getHexString());
      addBox(p.clone().addScaledVector(fw, 1.75).setY(p.y + 0.55), V3(4.2, 1.1, 0.25), yaw, '#f3e9d7');
      push(inst.roof, p.clone().setY(p.y + 2.7), qYaw(yaw + PI / 2), S.set(5.0, 0.9, 4.4), col(pick(['#d8d0c0', '#c2593a', '#f3e9d7'])));
      addBox(p.clone().addScaledVector(fw, 2.3).setY(p.y + 2.5), V3(4.4, 0.08, 1.2), yaw, pick(['#ffffff', '#ffd21f', '#2f8ae0']));
    }
    for (const [x, z] of MAP.caneyes) caney(x, z, rr(0.9, 1.15));
    const placeBoats = (list, spread) => { for (const [x, z, n] of list) for (let k = 0; k < n; k++) { const px = x + (k - n / 2) * spread + rr(-1, 1), pz = z + rr(-2, 2), dd = shoreD(px, pz); const yaw = PI + rr(-0.25, 0.25); addPenero(V3(px, groundH(px, pz) - 0.05, pz), yaw, rr(-0.08, 0.08)); void dd; } };
    placeBoats(MAP.peneros.beach, 3.2); placeBoats(MAP.peneros.catica, 3.4); placeBoats(MAP.peneros.island, 3.4);
    // CATA mural wall by the start
    {
      const i = idxNear(muralAt[0], muralAt[1]), f = roadFrame(i), s = -seaSide(i), p = roadAt(i, s * (lateralHW(i, s) + 3.5)); p.y = groundH(p.x, p.z);
      const mural = canvasTex(1024, 160, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#2ad1b2'); g.addColorStop(0.5, '#3d7bf2'); g.addColorStop(1, '#ff8a1f'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = '#ffd21f'; c.beginPath(); c.arc(880, 70, 44, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = 0; x < w; x += 60) { c.beginPath(); c.arc(x, h + 10, 40, PI, TAU); c.fill(); }
        const L = 'BAHÍA DE CATA'.split(''), cols = ['#ff4b4b', '#ffd21f', '#ffffff', '#ff8a1f', '#f15bb5'];
        c.font = 'bold 92px sans-serif'; c.textBaseline = 'middle';
        L.forEach((ch, k) => { c.fillStyle = '#1b1b2a'; c.fillText(ch, 40 + k * 62 + 4, 92); c.fillStyle = cols[k % cols.length]; c.fillText(ch, 40 + k * 62, 86); });
      });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 0.6), [PAINT, PAINT, PAINT, PAINT, new THREE.MeshStandardMaterial({ map: mural, roughness: 0.8 }), PAINT]);
      wall.position.copy(p).setY(p.y + 1.4); wall.rotation.y = yawOf(f.n.clone().multiplyScalar(-s)); wall.castShadow = true; scene.add(wall);
    }
  }

  /* ---------------- Isla de Cata: lookout, rocks ---------------- */
  {
    const L = MAP.lookout, y = groundH(L.x, L.z);
    for (const [dx, dz] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) beams.wood.push(placeBeam(V3(L.x + dx, y - 0.5, L.z + dz), V3(L.x + dx * 0.8, y + 6, L.z + dz * 0.8), 0.3, 0.3));
    addBox(V3(L.x, y + 6.1, L.z), V3(3.6, 0.3, 3.6), 0.3, '#7a5232');
    for (const s of [-1, 1]) { addBox(V3(L.x + s * 1.7, y + 6.8, L.z), V3(0.12, 1.1, 3.6), 0, '#7a5232'); addBox(V3(L.x, y + 6.8, L.z + s * 1.7), V3(3.6, 1.1, 0.12), 0, '#7a5232'); }
    push(inst.thatch, V3(L.x, y + 7.6, L.z), Q, S.set(3.4, 2, 3.4), col('#c9a45a'));
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.4, px = L.x + Math.cos(a) * 1.8, pz = L.z + Math.sin(a) * 1.8; addBox(V3(px, y + 1 + k * 0.85, pz), V3(1.4, 0.15, 0.6), -a, '#8a6040'); }
    const f = MAP.features.find(q => q.type === 'island');
    for (let k = 0; k < 50; k++) { const a = rand() * TAU, r = f.r * rr(0.82, 1.08), x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r; if (sampleR(RR, x, z).dist < 9) continue; rock(x, z, rr(0.8, 3.2)); }
  }

  /* ---------------- vegetation, from the zones ---------------- */
  const Z = MAP.zones;
  const free = (x, z, roadM) => {
    if (Math.abs(x) > 342 || Math.abs(z) > 342) return false;
    if (sampleR(RR, x, z).dist < 6.5 + roadM) return false;
    if (sampleR(VR, x, z).dist < RV.half + 2) return false;
    for (const T of MAP.towers) if (Math.hypot(x - T.x, z - T.z) < T.w * 0.62) return false;
    for (const [cx, cz] of MAP.caneyes) if (Math.hypot(x - cx, z - cz) < 5) return false;
    return true;
  };
  const tries = (n, fn) => { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; };
  const island = MAP.features.find(q => q.type === 'island');
  const onIsland = (x, z) => Math.hypot(x - island.x, z - island.z) < island.r + 2;
  // the coconut grove behind the beach: rows, a little jittered
  tries(Z.grove.density, () => {
    const x = rr(Z.grove.xMin, Z.grove.xMax), z = rr(40, 170), dd = shoreD(x, z);
    if (dd < Z.grove.dMin || dd > Z.grove.dMax || !free(x, z, 3)) return false;
    palm(x, z, dd < 30 ? V3(0, 0, 1) : null, dd < 30 ? 0.9 : 1.05); return true;
  });
  // palms along the sand edge, leaning out to sea
  tries(120, () => { const x = rr(-200, 200), z = rr(100, 190), dd = shoreD(x, z); if (dd < 7 || dd > 18 || !free(x, z, 2)) return false; palm(x, z, V3(0, 0, 1), 0.85); return true; });
  // forest over the mountains and headlands
  tries(Z.forest.density, () => {
    const x = rr(-342, 342), z = rr(-342, 300), dd = shoreD(x, z);
    if (onIsland(x, z) || !free(x, z, 9)) return false;
    const y = terrainH(x, z); if (y < 3 || (dd < Z.forest.dMin && y < 12)) return false;
    tree(x, z, rand() < 0.35); return true;
  });
  tries(Z.islandPalms, () => { const a = rand() * TAU, r = Math.sqrt(rand()) * island.r * 0.85, x = island.x + Math.cos(a) * r, z = island.z + Math.sin(a) * r; if (!free(x, z, 2)) return false; palm(x, z, V3(Math.cos(a), 0, Math.sin(a)), 0.8); return true; });
  tries(Z.caticaPalms, () => { const x = rr(-342, -275), z = rr(110, 170), dd = shoreD(x, z); if (dd < 4 || dd > 40 || !free(x, z, 2)) return false; palm(x, z, V3(0.3, 0, 1)); return true; });
  tries(2200, () => { const x = rr(-342, 342), z = rr(-342, 300); if (!free(x, z, 2.5) || terrainH(x, z) < 2.6) return false; const dd = shoreD(x, z); if (dd < 20 && !onIsland(x, z)) return false; rand() < 0.5 ? fern(x, z, rr(0.8, 1.5)) : bush(x, z, rr(0.7, 1.4)); return true; });
  tries(12000, () => {
    const x = rr(-342, 342), z = rr(-342, 300); if (!free(x, z, 1.2)) return false;
    const y = terrainH(x, z); if (y < 1) return false;
    const s = rr(0.8, 1.6), dd = shoreD(x, z);
    push(inst.grass, V3(x, y - 0.05, z), qYaw(rand() * TAU), S.set(s * 1.4, s, s * 1.4), col(dd < 40 ? '#c8c070' : '#7fc84a').offsetHSL(rr(-0.03, 0.03), rr(-0.1, 0.05), rr(-0.08, 0.06)));
    return true;
  });
  // forest on the far mountains beyond the map
  tries(1800, () => {
    const x = rr(-1200, 1200), z = rr(-1300, 420); if (Math.abs(x) < 345 && Math.abs(z) < 345) return false;
    const y = farH(x, z); if (y < 3) return false;
    vegetation.add('tree', x, z, y, 1.2, 100); return true;
  });
  // rocks at the foot of the headlands
  for (let i = 0; i < NSH; i += 2) { const p = SHP[i]; if (Math.abs(p.x + 225) > 40 && Math.abs(p.x - 228) > 40 && p.x > -270) continue; if (rand() < 0.5) rock(p.x + rr(-4, 4), p.z + rr(-4, 4), rr(1, 3.5), -0.6); }

  /* ---------------- clouds, spray on the sandbar ---------------- */
  const clouds = [], spray = [];
  {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, color: col('#fff1e2'), transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    for (let k = 0; k < 50; k++) { const a = rr(PI * 0.9, PI * 2.1), r = rr(800, 1400), s = new THREE.Sprite(mat); s.position.set(Math.cos(a) * r, rr(160, 300), Math.sin(a) * r * 0.8 - 300); const sc = rr(160, 320); s.scale.set(sc, sc * 0.45, 1); scene.add(s); clouds.push(s); }
    const low = new THREE.SpriteMaterial({ map: cloudTex, color: col('#f4f2ee'), transparent: true, opacity: 0.3, depthWrite: false, fog: true });
    for (let k = 0; k < 40; k++) { const x = rr(-340, 340), z = rr(-340, -120), s = new THREE.Sprite(low); s.position.set(x, base(x, z) + rr(10, 26), z); const sc = rr(50, 100); s.scale.set(sc, sc * 0.4, 1); scene.add(s); clouds.push(s); }
    const sm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < NR; i += 9) {
      if (!splash[i]) continue;
      for (const side of [-1, 1]) { const p = roadAt(i, side * (lateralHW(i, side) + rr(1.5, 4))); const s = new THREE.Sprite(sm); s.position.set(p.x, 0.3, p.z); s.scale.set(1.5, 1.5, 1); s.userData = { y0: 0.1, ph: rand() * TAU, sp: rr(1.5, 3) }; scene.add(s); spray.push(s); }
    }
  }

  /* ---------------- signs ---------------- */
  for (const sg of MAP.signs) roadSign(idxNear(sg.at[0], sg.at[1]), sg.side, sg.lines, sg.arrow);

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
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), PAINT);
  {
    const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5);
    flush(inst.roof, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85, side: THREE.DoubleSide }));
  }
  { const g = new THREE.ConeGeometry(1, 1, 10, 1, true); flush(inst.cone, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7, side: THREE.DoubleSide })); }
  { const g = new THREE.ConeGeometry(1, 1, 14, 3); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + 0.05 * Math.sin(i * 7))); p.setY(i, y + 0.03 * Math.sin(i * 3)); } g.computeVertexNormals(); flush(inst.thatch, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true })); }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 })); }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3)); g.computeVertexNormals(); flush(inst.tri, g, windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), side: THREE.DoubleSide, roughness: 0.7 }), 0.08, 0.0), false); }
  {
    const mats = { steel: new THREE.MeshStandardMaterial({ color: col('#b9bcc0'), metalness: 0.5, roughness: 0.4 }), white: new THREE.MeshStandardMaterial({ color: col('#f4f1ea'), roughness: 0.6 }), wood: WOOD, concrete: new THREE.MeshStandardMaterial({ color: col('#bdb6a8'), roughness: 0.9 }) };
    const bg = new THREE.BoxGeometry(1, 1, 1);
    for (const [k, list] of Object.entries(beams)) if (list.length) { const im = new THREE.InstancedMesh(bg, mats[k], list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  }
  flush(boats.hull, peneroGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
  flush(boats.band, bandGeo, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 }));

  /* ---------------- peñeros out on the bay, pelicans overhead ---------------- */
  const movers = [];
  for (let k = 0; k < MAP.peneros.bay; k++) {
    const g = new THREE.Group();
    const h = new THREE.Mesh(peneroGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })); h.castShadow = true; g.add(h);
    const b = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ color: PENEROS[k % 4] })); b.scale.x = 1.08; g.add(b);
    scene.add(g); movers.push({ g, c: V3(rr(-80, 120), 0, rr(210, 300)), r: rr(30, 70), sp: rr(0.03, 0.06) * (k % 2 ? 1 : -1), ph: rand() * TAU });
  }
  const birds = [];
  {
    const mBody = new THREE.MeshStandardMaterial({ color: col('#8a8278'), roughness: 0.8, flatShading: true }), mWing = new THREE.MeshStandardMaterial({ color: col('#6f675f'), roughness: 0.8, flatShading: true, side: THREE.DoubleSide });
    for (let k = 0; k < 12; k++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mBody); body.scale.set(0.4, 0.4, 1.1); b.add(body);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.1, 6), new THREE.MeshStandardMaterial({ color: col('#d8b46a') })); beak.position.set(0, 0.05, 1.5); beak.rotation.x = PI / 2; b.add(beak);
      const wings = [];
      for (const s of [-1, 1]) { const pivot = new THREE.Group(); pivot.position.set(s * 0.3, 0.1, 0.1); b.add(pivot); const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.8), mWing); w.position.set(s * 1.3, 0, 0); pivot.add(w); wings.push({ pivot, s }); }
      b.scale.setScalar(1.2); scene.add(b);
      birds.push({ g: b, wings, c: V3(rr(-150, 160), rr(16, 40), rr(150, 260)), r: rr(30, 90), sp: rr(0.1, 0.18) * (rand() < 0.5 ? -1 : 1), ph: rand() * TAU, fl: rr(2, 3.2) });
    }
  }

  function update(t, dt) {
    uTime.value = t;
    waterMats.forEach(m => (m.uniforms.uT.value = t));
    movers.forEach(m => { const a = m.ph + t * m.sp, p = V3(m.c.x + Math.cos(a) * m.r, 0.05 + Math.sin(t * 1.3 + m.ph) * 0.08, m.c.z + Math.sin(a) * m.r); m.g.position.copy(p); m.g.rotation.set(Math.sin(t * 1.1 + m.ph) * 0.03, -a - (m.sp > 0 ? 0 : PI), Math.sin(t * 0.9 + m.ph) * 0.04); });
    birds.forEach(b => {
      const a = b.ph + t * b.sp, p = V3(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(t * 0.5 + b.ph) * 3, b.c.z + Math.sin(a) * b.r);
      const ahead = V3(b.c.x + Math.cos(a + 0.05 * Math.sign(b.sp)) * b.r, p.y, b.c.z + Math.sin(a + 0.05 * Math.sign(b.sp)) * b.r);
      b.g.position.copy(p); b.g.lookAt(ahead); b.g.rotateZ(-0.3 * Math.sign(b.sp));
      const flap = Math.max(0, Math.sin(t * b.fl + b.ph)) * 0.5 - 0.1; b.wings.forEach(w => (w.pivot.rotation.z = w.s * flap));
    });
    { const p = FLAG_GEO.attributes.position; for (let i = 0; i < p.count; i++) { const x = FLAG_BASE[i * 3]; p.setZ(i, Math.sin(t * 5 + x * 3.2) * 0.12 * x); } p.needsUpdate = true; }
    spray.forEach(s => { const k = (t * s.userData.sp * 0.5 + s.userData.ph) % 1; s.position.y = s.userData.y0 + 0.3 + k * 1.4; s.material.opacity = 0.5 * (1 - k); });
  }

  disposeOwned(scene);
  vegetation.flush();
  return { group: scene, groundAt: groundH, update };
}
