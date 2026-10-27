// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { rng, clamp, lerp, pick as pickRandom } from '/engine/random.js';
import { extendTerrain } from '/engine/worlds/coastal/world-horizon.js';
import * as THREE from 'three';
import { disposeOwned } from './reference-world.js';
import { canvasTexture } from '/engine/models/core/primitives.js';
import { coastalVegetation } from '/engine/worlds/coastal/coastal-vegetation.js';

export function createWorld(scene, layout, roadDistance) {
  const vegetation = coastalVegetation(scene, 1.3, roadDistance);
  let horizon = null;
  const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
  const rand = rng(4321);
  const rr = (a, b) => a + rand() * (b - a);
  const pick = arr => pickRandom(arr, rand);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const col = hex => new THREE.Color(hex);
  const d = new THREE.Object3D();
  const uTime = { value: 0 };
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  const SUN_DIR = new THREE.Vector3(-0.6, 0.33, 0.5).normalize();
  /* ---------------- textures ---------------- */
  const canvasTex = (w, h, draw, srgb = true) => canvasTexture(w, h, draw, { srgb });
  const asphaltTex = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#9a9a9c'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(40,40,44,${rr(0.05, 0.18).toFixed(2)})` : `rgba(255,255,250,${rr(0.04, 0.14).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(1, 3)); }
    for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(30,30,34,0.12)'; c.fillRect(rr(20, w - 80), rr(0, h), rr(30, 70), rr(20, 60)); }
    c.strokeStyle = 'rgba(40,40,44,0.35)'; c.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { c.beginPath(); let x = rr(30, w - 30), y = rr(0, h); c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += rr(-12, 12); y += rr(8, 22); c.lineTo(x, y); } c.stroke(); }
    c.fillStyle = 'rgba(250,248,236,0.9)'; c.fillRect(w * 0.045, 0, 7, h); c.fillRect(w * 0.955 - 7, 0, 7, h);
    c.fillStyle = '#f3c63a'; for (let y = 0; y < h; y += 64) c.fillRect(w / 2 - 4, y, 8, 34);
  });
  const plankTex = canvasTex(256, 256, (c, w, h) => {
    for (let y = 0; y < h; y += 16) {
      c.fillStyle = `hsl(${rr(26, 34).toFixed(0)}, ${rr(30, 42).toFixed(0)}%, ${rr(48, 58).toFixed(0)}%)`; c.fillRect(0, y, w, 16);
      c.fillStyle = 'rgba(40,24,10,0.5)'; c.fillRect(0, y + 14, w, 2);
    }
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
  // white wooden window grille with its frame (alpha cutout)
  const grilleTex = canvasTex(64, 96, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, 6); c.fillRect(0, h - 8, w, 8); c.fillRect(0, 0, 5, h); c.fillRect(w - 5, 0, 5, h);
    for (let x = 12; x < w - 6; x += 9) c.fillRect(x, 0, 3, h);
    c.fillRect(0, h * 0.5, w, 3);
    c.fillRect(w / 2 - 14, 6, 28, 5);
  });
  // the Venezuelan tricolour with its arc of eight stars
  const flagTex = canvasTex(192, 128, (c, w, h) => {
    c.fillStyle = '#ffcc00'; c.fillRect(0, 0, w, h / 3); c.fillStyle = '#00247d'; c.fillRect(0, h / 3, w, h / 3); c.fillStyle = '#cf142b'; c.fillRect(0, h * 2 / 3, w, h / 3);
    c.fillStyle = '#ffffff';
    for (let k = 0; k < 8; k++) {
      const a = PI * (0.85 - k * 0.1), cx = w / 2 + Math.cos(a) * 30, cy = h * 0.62 - Math.sin(a) * 22;
      c.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 2 : 5, b = -PI / 2 + j * PI / 5; c.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r); } c.fill();
    }
  });
  const textBoard = (w, h, bg, draw) => canvasTex(w, h, (c) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); draw(c, w, h); });

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

  /* ---------------- the land ---------------- */
  // Coast to the south (+z), mountains to the north. The town sits on the plain
  // west of the river, Playa Grande east of it, the climb in the east, Chuao across the cove.
  const { bay, plain, zFoot, kM, CRISTO, CTRL, roadCurve, riverCurve, streamCurve, ROAD_LEN, NR, RP, SEG, NV, VP, NS, SP, MOUNT, SIZE, CELL, GR, HALF, RR, VR, SR, RYT, ryAt, riverY, riverHW, BATEA, FORD_S, FORD_R, streamY, streamHW, iFordS, sStep, iFall0, iFall1, hwL, hwR, roadY, bank, fordW, roadFrame, roadAt, base, raster, sampleR, natural, terrainH } = layout;

  const originalFarH = (x, z) => { let h = base(x, z); if (z < -340) h += (-340 - z) * 0.25 + 30 * sstep(-340, -600, z) * (0.6 + 0.4 * Math.sin(x * 0.006)); return h; };
  const originalGroundH = (x, z) => (Math.abs(x) < 345 && Math.abs(z) < 345 ? terrainH(x, z) : originalFarH(x, z));
  const farH = (x,z) => horizon?.heightAt(x,z) ?? originalFarH(x,z);
  const groundH = (x,z) => horizon?.heightAt(x,z) ?? originalGroundH(x,z);

  /* ---------------- terrain ---------------- */
  const cGrass = col('#4f9a2a'), cGrass2 = col('#7bb83a'), cDark = col('#2c6a22'), cCloud = col('#3c6a48'), cRock = col('#8a7e6c'), cSand = col('#e3c690'), cWetSand = col('#c9a46e'), cMud = col('#6a5638'), cVerge = col('#c8b88a'), cBed = col('#9a7a48');
  function paintGround(x, z, y, slope, tmp) {
    const n1 = 0.5 + 0.5 * Math.sin(x * 0.09 + Math.sin(z * 0.05) * 3) * Math.cos(z * 0.08 - x * 0.03);
    tmp.copy(cGrass).lerp(cGrass2, n1 * 0.7).lerp(cDark, sstep(0.55, 0.95, 0.5 + 0.5 * Math.sin(x * 0.023 - z * 0.031)) * 0.5);
    tmp.lerp(cCloud, sstep(40, 75, y) * 0.75);
    tmp.lerp(cRock, sstep(0.45, 0.8, slope) * 0.75);
    if (y < 3.4 && z > 118) tmp.lerp(cSand, sstep(118, 132, z) * (1 - sstep(2.6, 3.4, y)));
    if (y < 0.6 && z > 140) tmp.lerp(cWetSand, sstep(0.6, -0.2, y));
    return tmp;
  }
  {
    const SEGS = 350, geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
    geo.rotateX(-PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainH(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), slope = 1 - nrm.getY(i);
      paintGround(x, z, y, slope, tmp);
      const r = sampleR(RR, x, z), v = sampleR(VR, x, z), s = sampleR(SR, x, z);
      if (r.i >= 0) { const hw = Math.max(hwL[r.i], hwR[r.i]); tmp.lerp(cVerge, (1 - sstep(hw - 0.5, hw + 2.5, r.dist)) * 0.7); }
      if (v.i >= 0) { const hw = riverHW[v.i]; tmp.lerp(v.i < NV * 0.45 ? cRock : cSand, (1 - sstep(hw, hw + 6, v.dist)) * 0.55); tmp.lerp(cBed, 1 - sstep(hw - 2, hw + 0.5, v.dist)); }
      if (s.i >= 0) tmp.lerp(cMud, (1 - sstep(streamHW, streamHW + 3, s.dist)) * 0.8);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    m.receiveShadow = true;
    scene.add(m);
    horizon = extendTerrain(m,{bounds:[-350,-350,350,350],nx:350,nz:350,height:originalFarH,color:(x,z,y)=>paintGround(x,z,y,0,new THREE.Color()),biome:'choroni'});
  }
  // the far land: mountains to the north and the Chuao headland, the same shape at lower resolution



  /* ---------------- the sea: turquoise over sand, deep blue further out, foam at the shore ---------------- */
  const waterMats = [];
  const HT = { x0: -500, z0: -360, size: 1500, res: 300 };
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
        vec3 shallow = vec3(0.18, 0.82, 0.78), mid = vec3(0.03, 0.55, 0.66), deep = vec3(0.02, 0.24, 0.46);
        vec3 c = mix(shallow, mid, smoothstep(0.0, 0.35, depth)); c = mix(c, deep, smoothstep(0.35, 1.0, depth));
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
  SEA.uniforms.uH.value = heightTex;
  waterMats.push(SEA);
  { const g = new THREE.PlaneGeometry(9000, 9000, 1, 1); g.rotateX(-PI / 2); const m = new THREE.Mesh(g, SEA); m.position.set(0, 0, 0); m.renderOrder = 1; scene.add(m); }

  /* ---------------- road surface ---------------- */
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
  {
    const rows = [], colors = [], asph = col('#6c6d72'), conc = col('#e2ded4'), wet = col('#4c4840');
    const tint = new Float32Array(NR); for (let i = 0; i < NR; i++) tint[i] = SEG[i] === 'p' ? 1 : 0;
    for (let i = 0; i < NR; i++) {
      let t = 0; for (let j = -12; j <= 12; j++) t += tint[(i + j + NR) % NR]; t /= 25;
      rows.push({ a: roadAt(i, -hwL[i], 0.12), b: roadAt(i, hwR[i], 0.12) });
      colors.push(asph.clone().lerp(conc, t).lerp(wet, fordW[i] * 0.8));
    }
    stripMesh(rows, ROAD, 20, true, colors);
  }

  /* ---------------- rails and posts (instanced boxes) ---------------- */
  const placeBeam = (a, b, tx, tz) => {
    const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
    d.position.copy(a).addScaledVector(dir, 0.5); d.quaternion.setFromUnitVectors(UP, dir.normalize()); d.scale.set(tx, len, tz); d.updateMatrix();
    return d.matrix.clone();
  };
  const beams = { steel: [], white: [], green: [], wood: [], concrete: [] };
  const lateralHW = (i, side) => (side > 0 ? hwR[i] : hwL[i]);
  {
    const step = Math.round(4 / (ROAD_LEN / NR));
    for (const side of [-1, 1]) {
      let prev = null;
      for (let i = 0; i < NR; i += step) {
        const s = SEG[i], mount = MOUNT[s];
        const mirador = s === 'm' && side > 0;
        const p = RP[i], v = sampleR(VR, p.x, p.z);
        const river = (s === 'h' || s === 'l' || s === 'v') && v.i >= 0 && v.dist < riverHW[v.i] + 16 && fordW[i] < 0.02;
        const lat = side * (lateralHW(i, side) + 1.2), base0 = roadAt(i, lat, 0);
        const towardRiver = river && sampleR(VR, base0.x, base0.z).dist < v.dist;
        const kind = mirador ? 'white' : mount ? 'steel' : towardRiver ? 'green' : null;
        if (!kind || fordW[i] > 0.02 || (s === 'n' && Math.abs(i - bay) < 26 && side > 0)) { prev = null; continue; }
        base0.y = Math.min(base0.y, terrainH(base0.x, base0.z) + 0.1);
        const h = kind === 'steel' ? 0.85 : 1.1, top = base0.clone().setY(base0.y + h);
        beams[kind].push(placeBeam(base0.clone().setY(base0.y - 0.3), top, kind === 'steel' ? 0.16 : 0.12, kind === 'steel' ? 0.16 : 0.12));
        if (prev && prev.distanceTo(top) < 9) {
          if (kind === 'steel') beams.steel.push(placeBeam(prev.clone().setY(prev.y - 0.12), top.clone().setY(top.y - 0.12), 0.08, 0.34));
          else { beams[kind].push(placeBeam(prev, top, 0.09, 0.09)); beams[kind].push(placeBeam(prev.clone().setY(prev.y - 0.5), top.clone().setY(top.y - 0.5), 0.06, 0.06)); }
        }
        prev = top;
      }
    }
  }
  // chevron signs on the outside of the tight bends
  const WOOD = new THREE.MeshStandardMaterial({ color: col('#7a5232'), roughness: 0.9 });
  {
    const chevTex = canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = '#ffd21f'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1c1c';
      for (let k = 0; k < 4; k++) { const x = 30 + k * 56; c.beginPath(); c.moveTo(x, 8); c.lineTo(x + 26, h / 2); c.lineTo(x, h - 8); c.lineTo(x + 14, h - 8); c.lineTo(x + 40, h / 2); c.lineTo(x + 14, 8); c.fill(); }
    });
    const signMat = new THREE.MeshStandardMaterial({ map: chevTex, roughness: 0.6 });
    for (let i = 0; i < NR; i += 6) {
      if (!MOUNT[SEG[i]]) continue;
      const a = roadFrame(i - 30).t, b = roadFrame(i + 30).t, turn = a.x * b.z - a.z * b.x;
      if (Math.abs(turn) < 0.75 || fordW[i] > 0.05) continue;
      const side = turn > 0 ? -1 : 1, f = roadFrame(i);
      const p0 = roadAt(i, side * (lateralHW(i, side) + 4)); p0.y = terrainH(p0.x, p0.z);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.2, 0.18), signMat);
      sign.position.copy(p0).setY(p0.y + 1.7);
      sign.lookAt(p0.clone().addScaledVector(f.n, -side).setY(p0.y + 1.7));
      sign.castShadow = true; scene.add(sign);
      for (const o of [-1.6, 1.6]) beams.steel.push(placeBeam(p0.clone().addScaledVector(f.t, o).setY(p0.y - 0.3), p0.clone().addScaledVector(f.t, o).setY(p0.y + 1.2), 0.12, 0.12));
      i += 160;
    }
  }
  // blue road signs with a white arrow, the hand-painted La Batea welcome sign
  const roadSign = (i, side, lines, arrow, opts = {}) => {
    const tex = textBoard(512, 256, opts.bg || '#1d4fa8', (c, w, h) => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 10; c.strokeRect(10, 10, w - 20, h - 20);
      c.fillStyle = '#ffffff'; c.font = `bold ${opts.size || 54}px ${opts.font || 'sans-serif'}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      lines.forEach((t, k) => c.fillText(t, 40, h / 2 + (k - (lines.length - 1) / 2) * 66));
      if (arrow) {
        c.save(); c.translate(w - 80, h / 2); c.rotate({ left: PI, right: 0, up: -PI / 2 }[arrow]);
        c.beginPath(); c.moveTo(-36, -12); c.lineTo(8, -12); c.lineTo(8, -34); c.lineTo(46, 0); c.lineTo(8, 34); c.lineTo(8, 12); c.lineTo(-36, 12); c.closePath(); c.fill(); c.restore();
      }
    });
    const f = roadFrame(i), p0 = roadAt(i, side * (lateralHW(i, side) + 3)); p0.y = terrainH(p0.x, p0.z);
    const board = new THREE.Mesh(new THREE.BoxGeometry(opts.w || 4, opts.h || 2, 0.12), [WOOD, WOOD, WOOD, WOOD, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), WOOD]);
    board.position.copy(p0).setY(p0.y + (opts.y || 3));
    board.lookAt(board.position.clone().addScaledVector(f.t, -1));
    board.castShadow = true; scene.add(board);
    for (const o of [-1.4, 1.4]) { const q = p0.clone().addScaledVector(f.n, o * 0.0).addScaledVector(V3(f.t.z, 0, -f.t.x), 0).add(V3(0, 0, 0)); void q; }
    const leg = side * 0; void leg;
    const n2 = V3(-f.t.z, 0, f.t.x);
    for (const o of [-(opts.w || 4) / 2 + 0.3, (opts.w || 4) / 2 - 0.3]) (opts.wood ? beams.wood : beams.steel).push(placeBeam(p0.clone().addScaledVector(n2, o).setY(p0.y - 0.3), p0.clone().addScaledVector(n2, o).setY(p0.y + (opts.y || 3) - 0.2), 0.14, 0.14));
    return board;
  };
  const idxNear = (x, z, from = 0, to = NR) => { let b = from, bd = 1e9; for (let i = from; i < to; i++) { const dd = (RP[i].x - x) ** 2 + (RP[i].z - z) ** 2; if (dd < bd) { bd = dd; b = i; } } return b; };

  /* ---------------- water: the amber river, the stream and its little waterfall ---------------- */
  function waterMaterial(speed, alpha = 0.85, fall = 0, deep = [0.05, 0.03, 0.008], shallow = [0.3, 0.17, 0.05], edge = [0.42, 0.3, 0.14]) {
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uSpeed: { value: speed }, uSun: { value: SUN_DIR }, uA: { value: alpha }, uFall: { value: fall }, uDeep: { value: new THREE.Vector3(...deep) }, uShallow: { value: new THREE.Vector3(...shallow) }, uEdge: { value: new THREE.Vector3(...edge) } }]),
      vertexShader: `
        attribute float foam;
        varying vec2 vUv; varying float vFoam; varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){
          vUv = uv; vFoam = foam; vW = (modelMatrix * vec4(position,1.0)).xyz;
          vec4 mvPosition = modelViewMatrix * vec4(position,1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uT; uniform float uSpeed; uniform vec3 uSun; uniform float uA; uniform float uFall; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uEdge;
        varying vec2 vUv; varying float vFoam; varying vec3 vW;
        #include <fog_pars_fragment>
        void main(){
          float flow = vUv.y - uT * uSpeed * (1.0 + vFoam * 2.5);
          float a = sin(vUv.x * 14.0 + sin(vUv.y * 0.35 + uT) * 2.0 + flow * 1.3);
          float b = sin(vUv.x * 5.0 - flow * 2.0 + sin(vUv.y * 0.2) * 3.0);
          float streak = smoothstep(0.6, 1.0, a * 0.5 + b * 0.5);
          float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
          vec3 c = mix(uDeep, uShallow, 0.45 + 0.3 * a) + streak * 0.08;
          vec3 V = normalize(cameraPosition - vW);
          vec3 Nn = normalize(vec3(a * 0.08, 1.0, b * 0.08));
          float spec = pow(max(dot(reflect(-uSun, Nn), V), 0.0), 90.0);
          c += vec3(1.0, 0.9, 0.7) * spec * 1.4;
          c = mix(uEdge, c, 0.35 + 0.65 * edge);
          c = mix(c, vec3(0.97, 0.98, 0.95), clamp(vFoam * (0.7 + 0.3 * b), 0.0, 1.0));
          float alpha = uA * (0.55 + 0.45 * edge);
          if (uFall > 0.5) {
            float y = vUv.y * 1.6 - uT * 2.2;
            float s1 = sin(vUv.x * 70.0 + sin(vUv.x * 13.0) * 4.0);
            float s2 = sin(vUv.x * 23.0 + y * 0.35) * sin(y * 1.7 + vUv.x * 9.0);
            float st = smoothstep(0.2, 0.95, s1 * 0.55 + s2 * 0.45);
            c = mix(vec3(0.8, 0.72, 0.5), vec3(1.0), 0.45 + 0.55 * st);
            alpha = uA * (0.55 + 0.45 * st) * smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
          }
          gl_FragColor = vec4(c, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    });
    waterMats.push(m);
    return m;
  }
  function ribbon(rows, mat) {
    const pos = [], uv = [], foam = [], idx = [];
    let dist = 0;
    rows.forEach((r, i) => {
      if (i) dist += r.c.distanceTo(rows[i - 1].c);
      for (const s of [-1, 1]) { const v = r.c.clone().addScaledVector(r.side, s * r.w); const road = sampleR(RR,v.x,v.z); if(road.i>=0 && road.dist<9){ const f=roadFrame(road.i),lat=(v.x-f.p.x)*f.n.x+(v.z-f.p.z)*f.n.z; v.y=Math.min(v.y,roadY[road.i]+bank[road.i]*lat+.08); } pos.push(v.x, v.y, v.z); uv.push((s + 1) / 2, dist * 0.22); foam.push(r.foam || 0); }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('foam', new THREE.Float32BufferAttribute(foam, 1));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 2; scene.add(m);
    return m;
  }
  {
    const RIVER = waterMaterial(0.8);
    const rows = [];
    for (let i = 0; i <= NV; i++) {
      const p = VP[i], q = VP[Math.min(NV, i + 1)], pp = VP[Math.max(0, i - 1)], t = new THREE.Vector3().subVectors(q, pp).normalize();
      const rapids = p.z < -70 ? 0.35 + 0.25 * Math.sin(i * 0.4) : 0, ford = (1 - sstep(3, 9, Math.hypot(p.x - FORD_R.x, p.z - FORD_R.y))) * 0.3;
      rows.push({ c: p.clone().setY(riverY[i]), side: V3(-t.z, 0, t.x), w: riverHW[i] + 1.5, foam: Math.max(rapids, ford) });
    }
    ribbon(rows, RIVER);
    const STREAM = waterMaterial(1.5, 0.85);
    const srows = [];
    for (let i = 0; i <= NS; i++) {
      if (i > iFall0 && i < iFall1) continue;
      const p = SP[i], q = SP[Math.min(NS, i + 1)], pp = SP[Math.max(0, i - 1)], t = new THREE.Vector3().subVectors(q, pp).normalize();
      srows.push({ c: p.clone().setY(streamY[i]), side: V3(-t.z, 0, t.x), w: streamHW + 0.8, foam: i > iFall1 ? 0.45 : i > iFordS - 8 ? 0.3 : 0.12 });
      if (i === iFall0) { ribbon(srows.splice(0), STREAM); srows.push({ c: SP[iFall1].clone().setY(streamY[iFall1]), side: V3(-t.z, 0, t.x), w: streamHW + 0.8, foam: 0.9 }); }
    }
    ribbon(srows, STREAM);
    // the little waterfall right below the ford
    const FALL = waterMaterial(2.4, 0.95, 1);
    const a = SP[iFall0], b = SP[iFall1], dir = b.clone().sub(a).setY(0).normalize(), side = V3(-dir.z, 0, dir.x);
    const frows = [];
    for (let k = 0; k <= 14; k++) { const t = k / 14; frows.push({ c: a.clone().addScaledVector(dir, Math.sqrt(t) * a.distanceTo(b)).setY(lerp(streamY[iFall0], streamY[iFall1], t * t)), side, w: streamHW + 0.6 + t * 0.6, foam: 1 }); }
    ribbon(frows, FALL);
    scene.userData.fall = { a: a.clone().setY(streamY[iFall0]), b: b.clone().setY(streamY[iFall1]) };
  }

  /* ---------------- materials and instance buffers ---------------- */
  const BARK = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true });
  const CANOPY = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.9, flatShading: true }), 0.05, 0.03);
  const FROND = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: frondTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 }), 0.0, 0.06);
  const GRASS = windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 }), 0.0, 0.18);
  const BAMBOO = windy(new THREE.MeshStandardMaterial({ color: col('#9cc23e'), roughness: 0.7 }), 0.0, 0.025);
  const ROCK = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 1, flatShading: true });
  const SMOOTH = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.75 });
  const PAINT = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.75 });

  const blobGeo = new THREE.IcosahedronGeometry(1, 1);
  const trunkGeo = new THREE.CylinderGeometry(0.55, 1, 1, 8, 3); trunkGeo.translate(0, 0.5, 0);
  { const p = trunkGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + 0.12 * Math.sin(y * 9 + i))); } trunkGeo.computeVertexNormals(); }
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

  const inst = { blob: [], bushBlob: [], trunk: [], frond: [], grass: [], bamboo: [], rock: [], boulder: [], flower: [], box: [], roof: [], grille: [], cone: [], cyl: [], tri: [] };
  const push = (list, pos, quat, scale, color) => { if ((list === inst.rock || list === inst.bushBlob) && sampleR(RR,pos.x,pos.z).dist < 10 + Math.max(scale.x,scale.z)) return; d.position.copy(pos); d.quaternion.copy(quat); d.scale.copy(scale); d.updateMatrix(); list.push({ m: d.matrix.clone(), c: color }); };
  const Q = new THREE.Quaternion(), S = new THREE.Vector3();
  const qYaw = a => new THREE.Quaternion().setFromAxisAngle(UP, a);
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  const BARK_C = col('#7d5c40'), MOSS_C = col('#5f7344'), PALM_C = col('#9a8466');

  const GREENS = ['#2f8a22', '#3a9c26', '#4aae2f', '#24701d', '#58b83a', '#1f7a2a', '#3d8f1f'].map(col);
  const CLOUD_GREENS = ['#2f5f38', '#3b6c3e', '#2a5634', '#4a7a46', '#355f3c'].map(col);
  const FLOWER_TREE = ['#ffd21f', '#ff8fc2', '#ff6a3a'].map(col);
  const FLOWERS = ['#ff2e45', '#ff7a1a', '#ff3d8b', '#ffd23a', '#ffffff', '#b45cff'].map(col);

  function tree(x, z, big, cloud) {
    vegetation.add('tree', x, z, groundH(x,z), big ? 1.6 : 1, sampleR(RR,x,z).dist);
  }
  function bigTree(x, z) {
    const y = groundH(x, z), h = rr(14, 19), r = rr(1.3, 1.7);
    push(inst.trunk, V3(x, y - 0.5, z), qYaw(rand() * TAU), S.set(r, h, r), BARK_C);
    for (let k = 0; k < 4; k++) {
      const a = k / 4 * TAU + rr(-0.3, 0.3), L = rr(6, 10), from = V3(x, y + h - 2, z), to = V3(x + Math.cos(a) * L, y + h + rr(2, 4), z + Math.sin(a) * L), dir = to.clone().sub(from);
      push(inst.trunk, from, new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()), S.set(0.45, dir.length(), 0.45), BARK_C);
    }
    const basec = pick(GREENS);
    for (let k = 0; k < 9; k++) { const a = rand() * TAU, rad = k < 2 ? rr(0, 3) : rr(4, 10), s = rr(4, 6); push(inst.blob, V3(x + Math.cos(a) * rad, y + h + rr(2, 4.5) - rad * 0.1, z + Math.sin(a) * rad), qEuler(rand() * 0.3, rand() * TAU, 0), S.set(s, s * rr(0.45, 0.6), s), basec.clone().offsetHSL(rr(-0.02, 0.02), 0, rr(-0.06, 0.05))); }
  }
  // cocotero: curved ringed trunk, leaning toward the light or the water
  function palm(x, z, leanTo) {
    vegetation.add('palm', x, z, groundH(x,z), 1, sampleR(RR,x,z).dist);
  }
  function fern(x, z, s = 1, colr) {
    const y = groundH(x, z), gc = colr || col('#4fa83a').offsetHSL(rr(-0.03, 0.04), 0, rr(-0.08, 0.05));
    for (let k = 0; k < 7; k++) push(inst.frond, V3(x, y, z), qEuler(rr(-0.6, -0.2), k / 7 * TAU + rr(-0.2, 0.2), 0), S.set(s * rr(0.7, 0.9), s * rr(1.4, 2.2), s * rr(1.4, 2.2)), gc);
  }
  // helecho arborescente: a thin dark trunk with a crown of arching fronds
  function treeFern(x, z) {
    vegetation.add('fern', x, z, groundH(x,z), 1, sampleR(RR,x,z).dist);
  }
  function bush(x, z, s = 1, flowers = true) {
    const y = groundH(x, z), basec = pick(GREENS);
    for (let k = 0; k < 3; k++) { const a = rand() * TAU, r = rr(0, 1.2) * s, sc = s * rr(1.1, 1.7); push(inst.bushBlob, V3(x + Math.cos(a) * r, y + sc * 0.45, z + Math.sin(a) * r), qEuler(rand(), rand() * TAU, 0), S.set(sc, sc * 0.75, sc), basec.clone().offsetHSL(0, 0, rr(-0.05, 0.05))); }
    if (flowers && rand() < 0.5) { const fc = pick(FLOWERS); for (let k = 0; k < 6; k++) { const a = rand() * TAU, r = rr(0.6, 1.6) * s; push(inst.flower, V3(x + Math.cos(a) * r, y + s * rr(0.9, 1.6), z + Math.sin(a) * r), Q, S.set(0.28, 0.28, 0.28), fc); } }
  }
  function bambooClump(x, z) {
    const y = groundH(x, z);
    for (let k = 0; k < 11; k++) {
      const a = rand() * TAU, r = rr(0, 2.2), h = rr(9, 15), tx = rr(-0.14, 0.14), tz = rr(-0.14, 0.14);
      const b = V3(x + Math.cos(a) * r, y - 0.2, z + Math.sin(a) * r);
      push(inst.bamboo, b, qEuler(tx, 0, tz), S.set(0.16, h, 0.16), null);
      const top = b.clone().add(V3(Math.sin(tz) * -h, h, Math.sin(tx) * h));
      for (let l = 0; l < 4; l++) push(inst.frond, top.clone().setY(top.y - rr(0, 3)), qEuler(rr(0.2, 0.9), rand() * TAU, 0), S.set(rr(0.7, 1), rr(2, 3), rr(2, 3)), col('#7cbf3a'));
    }
  }
  const cactus = (x, z) => {
    const y = groundH(x, z), h = rr(1.6, 3.2), c = col('#5e8a3a');
    push(inst.cyl, V3(x, y - 0.1, z), Q, S.set(0.22, h, 0.22), c);
    for (const s of [-1, 1]) if (rand() < 0.7) { const hh = rr(0.6, 1.2); push(inst.cyl, V3(x + s * 0.4, y + h * rr(0.35, 0.6), z), Q, S.set(0.15, hh, 0.15), c); push(inst.cyl, V3(x + s * 0.2, y + h * 0.4, z), qEuler(0, 0, s * PI / 2), S.set(0.14, 0.45, 0.14), c); }
  };

  /* ---------------- landmarks and set dressing ---------------- */
  const solid = (geo, color, opts = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.8, ...opts })); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; };
  const addBox = (p, s, yaw, color) => push(inst.box, p, qYaw(yaw), S.copy(s), col(color));
  const yawOf = v => Math.atan2(v.x, v.z);
  const i0 = idxNear(48, 141, 0, 200);   // start / finish

  // start arch with bunting and the CHORONÍ banner
  // Carreritas's shared startLine owns the finish stripe and gantry.

  // bunting: little coloured flags strung between two points
  const BUNT = ['#ff4b4b', '#ffc629', '#2ad1b2', '#3d7bf2', '#ffffff', '#f15bb5', '#5fc93a'].map(col);
  const bunting = (a, b, sag = 1.2) => {
    const n = Math.max(4, Math.round(a.distanceTo(b) / 0.8)), dir = b.clone().sub(a).setY(0).normalize();
    for (let k = 0; k <= n; k++) { const t = k / n, p = a.clone().lerp(b, t); p.y -= sag * 4 * t * (1 - t); push(inst.tri, p, qYaw(yawOf(dir) + PI / 2), S.set(0.42, 0.55, 1), BUNT[k % BUNT.length]); }
    beams.white.push(placeBeam(a, a.clone().lerp(b, 0.5).setY(Math.min(a.y, b.y) - sag), 0.02, 0.02), placeBeam(a.clone().lerp(b, 0.5).setY(Math.min(a.y, b.y) - sag), b, 0.02, 0.02));
  };
  for (const off of [-7, 7]) { const i = (i0 + Math.round(off / (ROAD_LEN / NR)) + NR) % NR; bunting(roadAt(i0, -9, 8.6), roadAt(i, 9, 8.6), 1.4); }

  // peñeros: white hull with a painted band and interior (stand-ins with the right footprint)
  const penero = (() => {
    const N = 16, ringPts = (t, inner) => {
      const w = 0.95 * Math.pow(Math.sin(PI * (0.5 + 0.5 * t)), 0.6) * (inner ? 0.88 : 1), top = 0.78 + 0.35 * t * t - (inner ? 0.04 : 0), bot = 0.05 + 0.28 * t * t * t + (inner ? 0.14 : 0);
      return [[-w, top], [-w * 0.82, 0.32 + bot * 0.6], [0, bot], [w * 0.82, 0.32 + bot * 0.6], [w, top]];
    };
    const build = (inner, band) => {
      const pos = [], idx = [], cl = [], L = 7.2, white = col('#f4f1ea'), bottom = col('#c43a2a');
      for (let j = 0; j <= N; j++) {
        const t = j / N, ring = ringPts(t, inner), zz = -L / 2 + t * L;
        ring.forEach(([x, y]) => {
          let yy = y, xx = x;
          if (band) { yy = y; xx = x * 1.01; }
          pos.push(xx, yy, zz); const c = inner || band ? white : (y < 0.36 ? bottom : white); cl.push(c.r, c.g, c.b);
        });
        if (j) for (let k = 0; k < 4; k++) { const a = (j - 1) * 5 + k, b = a + 5; inner ? idx.push(a, a + 1, b, a + 1, b + 1, b) : idx.push(a, b, a + 1, a + 1, b, b + 1); }
      }
      // transom
      const t0 = 0; void t0;
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    };
    const hull = build(false, false);
    const inside = build(true, false);
    // the painted strip under the gunwale
    const strip = (() => {
      const pos = [], idx = [], L = 7.2;
      for (const s of [-1, 1]) {
        const o = pos.length / 3;
        for (let j = 0; j <= N; j++) { const t = j / N, w = 0.95 * Math.pow(Math.sin(PI * (0.5 + 0.5 * t)), 0.6) + 0.01, top = 0.78 + 0.35 * t * t, zz = -L / 2 + t * L; pos.push(s * w, top, zz, s * w * 0.97, top - 0.22, zz); if (j) { const a = o + (j - 1) * 2; s > 0 ? idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) : idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
    })();
    const transom = new THREE.BoxGeometry(1.86, 0.7, 0.08); transom.translate(0, 0.45, -3.6);
    const motor = new THREE.BoxGeometry(0.4, 0.9, 0.45); motor.translate(0, 0.9, -3.85);
    const seat = new THREE.BoxGeometry(1.6, 0.06, 0.3); seat.translate(0, 0.62, 0.4);
    return { hull, inside, strip, transom, motor, seat };
  })();
  const PENEROS = ['#d83a2c', '#2f62c8', '#1f9a6a', '#e8b321', '#d83a2c', '#2f62c8'].map(col);
  const boats = { hull: [], band: [], dark: [] };
  const addPenero = (p, yaw, roll = 0, colr) => {
    const q = qEuler(0, yaw, roll), c = colr || pick(PENEROS);
    push(boats.hull, p, q, S.set(1, 1, 1), null);
    push(boats.band, p, q, S.set(1, 1, 1), c);
    push(boats.dark, p, q, S.set(1, 1, 1), col('#2a2b30'));
  };
  const NAMES = ['LA NEGRA', 'MI PANA', 'DOÑA CARMEN', 'EL CHORONIERO', 'LA PERLA', 'SAN JUAN', 'LA GUAYABITA', 'EL TURPIAL'];
  const nameMat = name => new THREE.MeshStandardMaterial({ map: canvasTex(256, 48, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#1b2a6a'; c.font = 'bold italic 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name, w / 2, h / 2); }), transparent: true, polygonOffset: true, polygonOffsetFactor: -2 });
  const boatMesh = (colr, name) => {
    const g = new THREE.Group();
    const vm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
    for (const [geo, m] of [[penero.hull, vm], [penero.inside, new THREE.MeshStandardMaterial({ color: colr, roughness: 0.6, side: THREE.DoubleSide })], [penero.strip, new THREE.MeshStandardMaterial({ color: colr, roughness: 0.6 })], [penero.transom, new THREE.MeshStandardMaterial({ color: colr })], [penero.motor, new THREE.MeshStandardMaterial({ color: col('#2a2b30') })], [penero.seat, WOOD]]) { const mm = new THREE.Mesh(geo, m); mm.castShadow = true; g.add(mm); }
    if (name) for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.48), nameMat(name)); pl.position.set(s * 0.99, 0.66, 1.4); pl.rotation.y = s * PI / 2; pl.rotation.z = 0; g.add(pl); }
    scene.add(g); return g;
  };

  // umbrellas, chairs, flags, kiosks, the mural wall and the surfboard sign at Playa Grande
  const flags = [];
  const FLAG_GEO = new THREE.PlaneGeometry(1.8, 1.2, 10, 3); FLAG_GEO.translate(0.9, 0, 0);
  const FLAG_BASE = FLAG_GEO.attributes.position.array.slice();
  const FLAG_MAT = new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 });
  const addFlag = (p, h = 4.5) => {
    beams.steel.push(placeBeam(p.clone().setY(p.y - 0.3), p.clone().setY(p.y + h), 0.07, 0.07));
    const m = new THREE.Mesh(FLAG_GEO, FLAG_MAT); m.position.copy(p).setY(p.y + h - 0.7); m.rotation.y = rr(-0.4, 0.4) + PI * 0.15; m.castShadow = true; scene.add(m); flags.push(m);
  };
  {
    const beachIdx = []; for (let i = 0; i < NR; i++) if (SEG[i] === 'b' && RP[i].x > 0 && RP[i].x < 215) beachIdx.push(i);
    const UMB = ['#ffd21f', '#2f8ae0', '#ff4b4b', '#ffd21f', '#2ad1b2'].map(col);
    for (let k = 0; k < beachIdx.length; k += 9) {
      const i = beachIdx[k], f = roadFrame(i);
      // sand side (south): umbrellas and plastic chairs
      for (let row = 0; row < 2; row++) {
        if (rand() < 0.25) continue;
        const p = roadAt(i, hwR[i] + 9 + row * 6 + rr(-1, 1)); p.y = groundH(p.x, p.z);
        if (p.y < 0.5) continue;
        const uc = pick(UMB);
        push(inst.cone, p.clone().setY(p.y + 2.6), Q, S.set(2.1, 0.7, 2.1), uc);
        push(inst.cyl, p.clone().setY(p.y - 0.1), Q, S.set(0.05, 2.7, 0.05), col('#e8e4dc'));
        for (const s of [-1, 1]) addBox(p.clone().add(f.t.clone().multiplyScalar(s * 1.1)).setY(p.y + 0.45), V3(0.55, 0.9, 0.55), yawOf(f.n) + rr(-0.4, 0.4), pick(['#ffffff', '#2f62c8', '#d83a2c', '#2ad1b2']));
      }
      if (k % 27 === 0) { const p = roadAt(i, hwR[i] + 5.5); p.y = groundH(p.x, p.z); addFlag(p); }
    }
    // peñeros pulled up on the sand, bows toward the land
    for (let k = 0; k < 11; k++) {
      const i = beachIdx[Math.floor((k + 0.5) / 11 * beachIdx.length)], f = roadFrame(i);
      const p = roadAt(i, hwR[i] + 26 + rr(-2, 3)); p.y = groundH(p.x, p.z) - 0.05;
      if (p.y < -0.2) continue;
      addPenero(p, yawOf(f.n.clone().negate()) + rr(-0.25, 0.25), rr(-0.08, 0.08));
    }
    // kiosks on the land side, every colour
    const KIOSK = ['#ff4b4b', '#ffc629', '#2ad1b2', '#3d7bf2', '#f15bb5', '#ff8a1f', '#5fc93a', '#8e4de8'].map(col);
    for (let k = 0; k < 12; k++) {
      const i = beachIdx[Math.floor((k + 0.5) / 12 * beachIdx.length * 0.82) + Math.floor(beachIdx.length * 0.14)], f = roadFrame(i);
      if (Math.abs(i - i0) < 12) continue;
      const p = roadAt(i, -hwL[i] - 6.5); p.y = groundH(p.x, p.z);
      const yaw = yawOf(f.n), c = KIOSK[k % KIOSK.length];
      addBox(p.clone().setY(p.y + 1.3), V3(4.2, 2.8, 3.4), yaw, '#' + c.getHexString());
      addBox(p.clone().addScaledVector(f.n, 1.9).setY(p.y + 1.0), V3(4.0, 0.12, 0.6), yaw, '#f3e9d7');
      addBox(p.clone().addScaledVector(f.n, 1.75).setY(p.y + 0.55), V3(4.2, 1.1, 0.25), yaw, '#f3e9d7');
      push(inst.roof, p.clone().setY(p.y + 2.7), qYaw(yaw), S.set(5.0, 0.9, 4.4), col(pick(['#d8d0c0', '#c2593a', '#f3e9d7'])));
      addBox(p.clone().addScaledVector(f.n, 2.3).setY(p.y + 2.5), V3(4.4, 0.08, 1.2), yaw, pick(['#ffffff', '#ffd21f', '#2f8ae0']));
    }
    // a low beach wall with the painted CHORONÍ mural
    {
      const i = beachIdx[Math.floor(beachIdx.length * 0.06)], f = roadFrame(i), p = roadAt(i, -hwL[i] - 4); p.y = groundH(p.x, p.z);
      const mural = canvasTex(1024, 160, (c, w, h) => {
        const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#2ad1b2'); g.addColorStop(0.5, '#3d7bf2'); g.addColorStop(1, '#8e4de8'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.fillStyle = '#ffd21f'; c.beginPath(); c.arc(860, 70, 46, 0, TAU); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; for (let x = 0; x < w; x += 60) { c.beginPath(); c.arc(x, h + 10, 40, PI, TAU); c.fill(); }
        const L = 'CHORONÍ'.split(''), cols = ['#ff4b4b', '#ffd21f', '#ffffff', '#ff8a1f', '#f15bb5', '#ffd21f', '#ffffff'];
        c.font = 'bold 120px sans-serif'; c.textBaseline = 'middle';
        L.forEach((ch, k) => { c.fillStyle = '#1b1b2a'; c.fillText(ch, 74 + k * 104 + 5, 92); c.fillStyle = cols[k]; c.fillText(ch, 74 + k * 104, 86); });
      });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 0.6), [PAINT, PAINT, PAINT, PAINT, new THREE.MeshStandardMaterial({ map: mural, roughness: 0.8 }), PAINT]);
      wall.position.copy(p).setY(p.y + 1.4); wall.rotation.y = yawOf(f.n); wall.castShadow = true; wall.receiveShadow = true; scene.add(wall);
    }
    // the painted surfboard sign
    {
      const i = beachIdx[Math.floor(beachIdx.length * 0.3)], p = roadAt(i, hwR[i] + 4); p.y = groundH(p.x, p.z);
      const board = canvasTex(128, 512, (c, w, h) => {
        c.fillStyle = '#1d4fa8'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffcc00'; c.fillRect(0, 0, 18, h); c.fillStyle = '#cf142b'; c.fillRect(w - 18, 0, 18, h);
        c.fillStyle = '#ffffff'; for (let k = 0; k < 7; k++) { const cx = w / 2, cy = 300 + k * 28; c.beginPath(); for (let j = 0; j < 10; j++) { const r = j % 2 ? 4 : 9, b = -PI / 2 + j * PI / 5; c.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r); } c.fill(); }
        c.save(); c.translate(w / 2, 150); c.rotate(-PI / 2); c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PLAYA GRANDE', 0, 0); c.restore();
      });
      const g = new THREE.CylinderGeometry(0.6, 0.6, 3.6, 24, 1); g.scale(1, 1, 0.12);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: board, roughness: 0.5 })); m.position.copy(p).setY(p.y + 1.5); m.rotation.y = yawOf(roadFrame(i).n) + PI / 2; m.castShadow = true; scene.add(m);
    }
  }

  // the climb: the passing bay with a parked old bus
  {
    const i = bay, f = roadFrame(i), p = roadAt(i, hwR[i] - 2.6, 0);
    const g = new THREE.Group(); g.position.copy(p); g.rotation.y = yawOf(f.t); scene.add(g);
    const part = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.6 })); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    part(new THREE.BoxGeometry(2.5, 1.3, 9), '#e8e2d2', 0, 1.25, 0);
    part(new THREE.BoxGeometry(2.52, 0.35, 9.02), '#2f62c8', 0, 1.0, 0);
    part(new THREE.BoxGeometry(2.52, 0.12, 9.02), '#d83a2c', 0, 1.3, 0);
    part(new THREE.BoxGeometry(2.4, 1.0, 8.4), '#2b3a45', 0, 2.35, -0.2);
    part(new THREE.BoxGeometry(2.5, 0.18, 8.8), '#e8e2d2', 0, 2.92, -0.2);
    part(new THREE.BoxGeometry(2.3, 1.0, 1.4), '#e8e2d2', 0, 1.1, 5.0);
    part(new THREE.BoxGeometry(1.8, 0.2, 7), '#5a4a3a', 0, 3.1, -0.6);
    for (const z of [3.4, -3.0]) for (const s of [-1, 1]) { const w = part(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), '#1d1d20', s * 1.15, 0.5, z); w.rotation.z = PI / 2; }
    for (const s of [-1, 1]) part(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12), '#fff3c0', s * 0.8, 1.2, 5.72).rotation.x = PI / 2;
  }

  // Mirador El Cristo: a white Christ with open arms on the spur, white railings, cactus
  {
    const top = V3(CRISTO.x, groundH(CRISTO.x, CRISTO.z), CRISTO.z);
    const W = { color: col('#f4f1ea'), roughness: 0.7 };
    const ped = solid(new THREE.BoxGeometry(4, 3, 4), '#ece8de'); ped.position.copy(top).setY(top.y + 1.2);
    const ped2 = solid(new THREE.BoxGeometry(2.6, 1.6, 2.6), '#f4f1ea'); ped2.position.copy(top).setY(top.y + 3.4);
    const g = new THREE.Group(); g.position.copy(top).setY(top.y + 4.2); scene.add(g);
    const m = new THREE.MeshStandardMaterial(W);
    const add = (geo, x, y, z, rz = 0) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.rotation.z = rz; mm.castShadow = true; g.add(mm); };
    add(new THREE.CylinderGeometry(0.75, 1.15, 5.2, 14), 0, 2.6, 0);
    add(new THREE.CylinderGeometry(0.55, 0.75, 1.6, 14), 0, 5.8, 0);
    add(new THREE.SphereGeometry(0.55, 16, 12), 0, 7.1, 0);
    add(new THREE.CylinderGeometry(0.28, 0.24, 3.4, 10), -1.95, 6.15, 0, PI / 2 - 0.12);
    add(new THREE.CylinderGeometry(0.28, 0.24, 3.4, 10), 1.95, 6.15, 0, -PI / 2 + 0.12);
    g.lookAt(V3(CRISTO.x, g.position.y, CRISTO.z + 100));
    for (let k = 0; k < 14; k++) { const a = rand() * TAU, r = rr(5, 16); cactus(top.x + Math.cos(a) * r, top.z + Math.sin(a) * r); }
    // a little white stair from the road up to the statue
    const iM = idxNear(CRISTO.x, CRISTO.z, 0, NR), from = roadAt(iM, hwR[iM] + 1.5, 0);
    for (let k = 0; k <= 16; k++) { const t = k / 16, p = from.clone().lerp(top, t); p.y = groundH(p.x, p.z); addBox(p.setY(p.y + 0.1), V3(2.2, 0.25, 1.4), yawOf(top.clone().sub(from)), '#efece4'); }
    scene.userData.cristo = top;
  }

  // the town: one-storey houses in saturated colours, tile roofs, white grilles, a plaza with a white church
  const HOUSE = ['#ffcf2e', '#ff5a3c', '#ff7ab6', '#2ad1b2', '#4aa3ff', '#ffb02e', '#e8463a', '#9ed15b', '#ffe066', '#ff8fa3'].map(col);
  const TRIM = ['#2a9b5a', '#2f62c8', '#ffffff', '#f3c63a', '#e8463a'].map(col);
  const PLAZA = V3(-146, 0, 72); PLAZA.y = groundH(PLAZA.x, PLAZA.z);
  const houses = [];
  const house = (p, yaw, w, dpt, h, c) => {
    const y = Math.min(groundH(p.x, p.z), groundH(p.x + Math.sin(yaw) * dpt * 0.5, p.z + Math.cos(yaw) * dpt * 0.5)) - 0.2;
    const q = qYaw(yaw), fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), right = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    push(inst.box, V3(p.x, y + h / 2, p.z), q, S.set(w, h + 0.4, dpt), c);
    push(inst.roof, V3(p.x, y + h + 0.2, p.z), q, S.set(w + 0.9, rr(1.3, 1.8), dpt + 1.2), col('#b5583a').offsetHSL(rr(-0.02, 0.02), 0, rr(-0.06, 0.04)));
    const front = V3(p.x, y, p.z).addScaledVector(fwd, dpt / 2 + 0.03), trim = pick(TRIM);
    push(inst.box, front.clone().setY(y + 0.45), q, S.set(w, 0.7, 0.08), trim);
    const nWin = w > 7 ? 2 : 1;
    for (let k = 0; k < nWin; k++) { const off = nWin === 1 ? w * 0.25 : (k ? 0.3 : -0.3) * w; push(inst.grille, front.clone().addScaledVector(right, off).setY(y + 1.75), q, S.set(1.05, 1.6, 1), null); push(inst.box, front.clone().addScaledVector(right, off).setY(y + 1.75).addScaledVector(fwd, -0.02), q, S.set(1.05, 1.6, 0.04), col('#3a2a22')); }
    const dx = nWin === 1 ? -w * 0.2 : 0;
    push(inst.box, front.clone().addScaledVector(right, dx).setY(y + 1.25), q, S.set(1.1, 2.3, 0.1), pick([col('#2f8ae0'), col('#7a5232'), col('#2a9b5a'), col('#e8e2d2')]));
    houses.push({ p: front.clone().setY(y + h), right, w });
  };
  const freeOf = (x, z, roadM, riverM) => {
    if (sampleR(RR, x, z).dist < 6.5 + roadM) return false;
    const v = sampleR(VR, x, z); if (v.i >= 0 && v.dist < riverHW[v.i] + riverM) return false;
    if (sampleR(SR, x, z).dist < streamHW + riverM) return false;
    return true;
  };
  {
    // houses lining both sides of the streets through town
    for (let i = 0; i < NR; i += 1) {
      const s = SEG[i];
      if (!(s === 'p' || (s === 'h' && RP[i].z > 104 && RP[i].x < -66))) continue;
      for (const side of [-1, 1]) {
        if (rand() < 0.12) continue;
        const f = roadFrame(i), w = rr(6.5, 9.5), dpt = rr(6.5, 8), p = roadAt(i, side * (lateralHW(i, side) + 2.2 + dpt / 2));
        if (Math.hypot(p.x - PLAZA.x, p.z - PLAZA.z) < 20) continue;
        if (!freeOf(p.x, p.z, -1, 3)) continue;
        house(p, yawOf(f.n.clone().multiplyScalar(-side)), w, dpt, rr(3.4, 4.2), pick(HOUSE));
      }
      i += Math.round(9 / (ROAD_LEN / NR));
    }
    // the blocks behind the streets
    let n = 0;
    for (let k = 0; k < 3000 && n < 130; k++) {
      const x = rr(-205, -72), z = rr(-6, 122);
      if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 22) continue;
      const r = sampleR(RR, x, z); if (r.i < 0 || r.dist < 14 || r.dist > 44) continue;
      if (!freeOf(x, z, 7, 4) || houses.some(hh => Math.hypot(hh.p.x - x, hh.p.z - z) < 10.5)) continue;
      const f = roadFrame(r.i), toRoad = f.p.clone().sub(V3(x, 0, z)).setY(0).normalize();
      const yaw = Math.round(yawOf(toRoad) / (PI / 2)) * (PI / 2) + Math.round(Math.atan2(f.t.x, f.t.z) / (PI / 2)) * 0 + 0.0;
      const ya = Math.abs(f.t.dot(V3(Math.sin(yaw), 0, Math.cos(yaw)))) > 0.7 ? yaw + PI / 2 : yaw;
      house(V3(x, 0, z), yawOf(toRoad) * 0.5 + ya * 0.5, rr(6.5, 9), rr(6.5, 8), rr(3.3, 4.1), pick(HOUSE)); n++;
    }
    // plaza: paving, trees, benches, the white church facing it
    const pave = solid(new THREE.CylinderGeometry(15, 15, 0.5, 40), '#d8cfbf'); pave.position.copy(PLAZA).setY(PLAZA.y + 0.05); pave.receiveShadow = true;
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; tree(PLAZA.x + Math.cos(a) * 9, PLAZA.z + Math.sin(a) * 9, false, false); addBox(V3(PLAZA.x + Math.cos(a + 0.5) * 11, PLAZA.y + 0.5, PLAZA.z + Math.sin(a + 0.5) * 11), V3(2, 0.5, 0.6), -a, '#2a9b5a'); }
    const cz = PLAZA.clone().add(V3(-24, 0, 0)), cy = groundH(cz.x, cz.z) - 0.3;
    const church = new THREE.Group(); church.position.set(cz.x, cy, cz.z); church.rotation.y = PI / 2; scene.add(church);
    const wm = new THREE.MeshStandardMaterial({ color: col('#f6f3ec'), roughness: 0.8 }), rm = new THREE.MeshStandardMaterial({ color: col('#b5583a'), roughness: 0.8 }), dm = new THREE.MeshStandardMaterial({ color: col('#6a4428') });
    const cp = (geo, m, x, y, z) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.castShadow = true; mm.receiveShadow = true; church.add(mm); return mm; };
    cp(new THREE.BoxGeometry(10, 7, 18), wm, 0, 3.5, -2);
    const roofG = new THREE.CylinderGeometry(6.2, 6.2, 18.6, 3, 1); roofG.rotateX(PI / 2); roofG.rotateZ(PI); roofG.scale(1, 0.45, 1); cp(roofG, rm, 0, 7.6, -2);
    cp(new THREE.BoxGeometry(10.4, 9.5, 1), wm, 0, 4.75, 7.2);
    const pediment = new THREE.CylinderGeometry(5.6, 5.6, 1, 3, 1); pediment.rotateX(PI / 2); pediment.rotateZ(PI); pediment.scale(1, 0.4, 1); cp(pediment, wm, 0, 10.2, 7.2);
    cp(new THREE.BoxGeometry(2.6, 4.2, 0.3), dm, 0, 2.1, 7.75);
    cp(new THREE.BoxGeometry(3.6, 13, 3.6), wm, 4.2, 6.5, 6.4);
    cp(new THREE.BoxGeometry(3.9, 0.4, 3.9), wm, 4.2, 13.2, 6.4);
    cp(new THREE.ConeGeometry(2.4, 3, 4), rm, 4.2, 14.9, 6.4).rotation.y = PI / 4;
    for (const s of [-1, 1]) cp(new THREE.BoxGeometry(0.9, 1.6, 0.2), dm, 4.2 + s * 0.0, 11.4, 8.25);
    cp(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), dm, 0, 11.9, 7.2); cp(new THREE.BoxGeometry(0.9, 0.12, 0.12), dm, 0, 12.2, 7.2);
    // power lines along and across the streets, bunting over the main street
    const pIdx = []; for (let i = 0; i < NR; i++) if (SEG[i] === 'p') pIdx.push(i);
    const poles = [];
    for (let k = 0; k < pIdx.length; k += Math.round(26 / (ROAD_LEN / NR))) { const i = pIdx[k], side = (k / 30 | 0) % 2 ? 1 : -1, p = roadAt(i, side * (lateralHW(i, side) + 1.1)); p.y = groundH(p.x, p.z); push(inst.cyl, p, Q, S.set(0.16, 8.2, 0.16), col('#8a8478')); poles.push(p.clone().setY(p.y + 7.8)); addBox(p.clone().setY(p.y + 7.6), V3(1.6, 0.12, 0.12), yawOf(roadFrame(i).n), '#5a5048'); }
    const linePts = [];
    for (let k = 1; k < poles.length; k++) { const a = poles[k - 1], b = poles[k]; for (const off of [-0.6, 0, 0.6]) { const n = 10; for (let j = 0; j < n; j++) { const t0 = j / n, t1 = (j + 1) / n, p0 = a.clone().lerp(b, t0), p1 = a.clone().lerp(b, t1); p0.y += off * 0.1 - 1.1 * 4 * t0 * (1 - t0); p1.y += off * 0.1 - 1.1 * 4 * t1 * (1 - t1); linePts.push(p0, p1); } } }
    for (let k = 0; k < houses.length; k += 5) { const hh = houses[k], r = sampleR(RR, hh.p.x, hh.p.z); if (r.i < 0 || r.dist > 12) continue; const other = roadAt(r.i, -Math.sign((hh.p.x - RP[r.i].x) * roadFrame(r.i).n.x + (hh.p.z - RP[r.i].z) * roadFrame(r.i).n.z) * 8.5, 5.5); const a = hh.p.clone().setY(hh.p.y + 0.6); for (let j = 0; j < 8; j++) { const t0 = j / 8, t1 = (j + 1) / 8, p0 = a.clone().lerp(other, t0), p1 = a.clone().lerp(other, t1); p0.y -= 0.9 * 4 * t0 * (1 - t0); p1.y -= 0.9 * 4 * t1 * (1 - t1); linePts.push(p0, p1); } }
    const lg = new THREE.BufferGeometry().setFromPoints(linePts); scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: col('#2a2622') })));
    for (let k = 10; k < pIdx.length - 10; k += Math.round(34 / (ROAD_LEN / NR))) { const i = pIdx[k]; bunting(roadAt(i, -lateralHW(i, -1) - 2, 5.2), roadAt(i + 6, lateralHW(i, 1) + 2, 5.2), 0.9); }
    // motos parked along the curbs
    for (let k = 0; k < pIdx.length; k += 37) { const i = pIdx[k], side = k % 2 ? 1 : -1, p = roadAt(i, side * (lateralHW(i, side) - 0.6), 0); const yaw = yawOf(roadFrame(i).t) + rr(-0.4, 0.4); const c = pick(['#d83a2c', '#1d1d20', '#2f62c8', '#e8e2d2']); addBox(p.clone().setY(p.y + 0.7), V3(0.35, 0.45, 1.5), yaw, c); for (const o of [-0.62, 0.62]) push(inst.cyl, p.clone().add(V3(Math.sin(yaw) * o, 0.32, Math.cos(yaw) * o)), qEuler(0, yaw, PI / 2), S.set(0.32, 0.12, 0.32), col('#1d1d20')); }
  }

  // the river harbour: peñeros moored at both banks, leaning coconut palms, the long footbridge
  {
    for (let i = Math.round(NV * 0.6); i < NV - 6; i += 3) {
      const p = VP[i], t = VP[i + 1].clone().sub(p).normalize(), n = V3(-t.z, 0, t.x);
      for (const s of [-1, 1]) {
        if (rand() < 0.5) continue;
        const o = s * (riverHW[i] - rr(1.2, 2.6)), q = p.clone().addScaledVector(n, o).setY(riverY[i] - 0.18);
        addPenero(q, yawOf(t) + (rand() < 0.5 ? 0 : PI) + rr(-0.12, 0.12), rr(-0.04, 0.04));
      }
    }
    for (let i = Math.round(NV * 0.52); i < NV * 0.86; i += 9) {
      const p = VP[i], t = VP[i + 1].clone().sub(p).normalize(), n = V3(-t.z, 0, t.x);
      for (const s of [-1, 1]) { if (rand() < 0.4) continue; const x = p.x + n.x * s * (riverHW[i] + rr(1.5, 3.5)), z = p.z + n.z * s * (riverHW[i] + rr(1.5, 3.5)); if (sampleR(RR, x, z).dist < 8) continue; palm(x, z, n.clone().multiplyScalar(-s)); }
    }
    // footbridge: plank deck on concrete pillars, green rails, stairs at both ends
    const FZ = 98, x0 = -98, x1 = 10, deckY = 10.2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.35, 2.6), [new THREE.MeshStandardMaterial({ color: col('#9a8a74') }), new THREE.MeshStandardMaterial({ color: col('#9a8a74') }), new THREE.MeshStandardMaterial({ map: plankTex }), new THREE.MeshStandardMaterial({ color: col('#7a6a54') }), new THREE.MeshStandardMaterial({ color: col('#9a8a74') }), new THREE.MeshStandardMaterial({ color: col('#9a8a74') })]);
    deck.position.set((x0 + x1) / 2, deckY, FZ); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
    for (const x of [-90, -73, -52.5, -40, -25.5, -1, 9]) { const gy = Math.min(groundH(x, FZ), x > -51 && x < -29 ? 0 : 99) - 1; beams.concrete.push(placeBeam(V3(x, gy, FZ), V3(x, deckY - 0.2, FZ), 0.7, 1.6)); }
    for (let x = x0; x <= x1; x += 2.2) for (const s of [-1, 1]) beams.green.push(placeBeam(V3(x, deckY, FZ + s * 1.25), V3(x, deckY + 1.15, FZ + s * 1.25), 0.07, 0.07));
    for (const s of [-1, 1]) { beams.green.push(placeBeam(V3(x0, deckY + 1.15, FZ + s * 1.25), V3(x1, deckY + 1.15, FZ + s * 1.25), 0.07, 0.07)); beams.green.push(placeBeam(V3(x0, deckY + 0.6, FZ + s * 1.25), V3(x1, deckY + 0.6, FZ + s * 1.25), 0.05, 0.05)); }
    for (const [xs, dir] of [[x0, -1], [x1, 1]]) {
      const len = 18, gy = groundH(xs + dir * len, FZ);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 2.4), new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.8 }));
      ramp.position.set(xs + dir * len / 2, (deckY + gy) / 2, FZ); ramp.rotation.z = Math.atan2(deckY - gy, len) * -dir; ramp.castShadow = true; scene.add(ramp);
      for (const t of [0.33, 0.66]) { const x = xs + dir * len * t, y = lerp(deckY, gy, t); beams.concrete.push(placeBeam(V3(x, groundH(x, FZ) - 1, FZ), V3(x, y - 0.2, FZ), 0.5, 1.2)); }
    }
    // a malecón promenade with railing along the west river bank near the mouth
    scene.userData.footbridge = V3((x0 + x1) / 2, deckY, FZ);
  }

  // La Batea: amber pool under big trees, round boulders, capybara swimmers, the welcome sign
  const swimmers = [];
  {
    for (let k = 0; k < 46; k++) {
      const a = rand() * TAU, r = rr(0.55, 1.25), x = BATEA.x + Math.cos(a) * r * 18, z = BATEA.z + Math.sin(a) * r * 14;
      if (Math.hypot(x - FORD_R.x, z - FORD_R.y) < 9) continue;
      const s = rr(1.2, 3.6), v = sampleR(VR, x, z), wy = v.i >= 0 ? riverY[v.i] : BATEA.y;
      push(inst.boulder, V3(x, Math.min(groundH(x, z), wy) + s * 0.25, z), qEuler(rand() * 0.4, rand() * TAU, rand() * 0.4), S.set(s * 1.3, s * 0.75, s), col('#d8c2a0').offsetHSL(rr(-0.02, 0.02), rr(-0.1, 0), rr(-0.12, 0.05)));
    }
    for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + rr(-0.3, 0.3), x = BATEA.x + Math.cos(a) * rr(28, 40), z = BATEA.z + Math.sin(a) * rr(24, 34); if (freeOf(x, z, 4, 3)) bigTree(x, z); }
    const capy = () => {
      const g = new THREE.Group(), fur = new THREE.MeshStandardMaterial({ color: col('#b5773e'), roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: col('#6a3a1c') });
      const add = (geo, m, x, y, z, sx, sy, sz) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.scale.set(sx, sy, sz); mm.castShadow = true; g.add(mm); };
      const sph = new THREE.SphereGeometry(1, 14, 10);
      add(sph, fur, 0, 0.42, 0, 0.32, 0.3, 0.5); add(sph, fur, 0, 0.6, 0.45, 0.22, 0.2, 0.24); add(sph, dark, 0, 0.58, 0.64, 0.15, 0.12, 0.09);
      for (const s of [-1, 1]) add(sph, dark, s * 0.13, 0.78, 0.38, 0.05, 0.05, 0.03);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.12, 8, 18), new THREE.MeshStandardMaterial({ color: col(pick(['#ff4b4b', '#ffc629', '#2ad1b2', '#f15bb5'])) })); ring.rotation.x = PI / 2; ring.position.y = 0.35; g.add(ring);
      g.scale.setScalar(1.6); scene.add(g); return g;
    };
    for (let k = 0; k < 9; k++) {
      const a = rand() * TAU, inWater = k < 5, r = inWater ? rr(0.15, 0.6) : rr(0.75, 1.0);
      const x = BATEA.x + Math.cos(a) * r * 15, z = BATEA.z + Math.sin(a) * r * 11, g = capy();
      g.position.set(x, inWater ? BATEA.y - 0.45 : groundH(x, z) + 0.6, z); g.rotation.y = rand() * TAU; g.children[g.children.length - 1].visible = inWater;
      swimmers.push({ g, y0: g.position.y, ph: rand() * TAU, water: inWater });
    }
    const iB = idxNear(-70, -18, 0, NR);
    const welcome = roadSign(iB, -1, ['Bienvenido', 'a La Batea'], null, { bg: '#2a9b5a', font: 'cursive, sans-serif', size: 58, wood: true, w: 4.4, h: 2.2, y: 2.4 });
    void welcome;
  }
  // road signs in the blue-with-white-arrow style
  roadSign(idxNear(200, 134, 0, NR), -1, ['Mirador', 'El Cristo'], 'left');
  roadSign(idxNear(40, -183, 0, NR), 1, ['Choroní'], 'right');
  roadSign(idxNear(-118, -15, 0, NR), -1, ['Choroní', 'Centro'], 'up');
  roadSign(idxNear(-70, 109, 0, NR), 1, ['Malecón'], 'left');
  roadSign(idxNear(-16, 60, 0, NR), 1, ['Playa', 'Grande'], 'up');

  // Chuao across the water: a tiny yellow church and a few houses on the shore
  {
    let p = null;
    for (let x = 300; x < 420 && !p; x += 2) { const h = farH(x, 150); if (h > 2.5) p = V3(x + 14, 0, 150); }
    if (p) {
      p.y = farH(p.x, p.z) - 0.3;
      const g = new THREE.Group(); g.position.copy(p); g.rotation.y = -PI / 2; scene.add(g);
      const ym = new THREE.MeshStandardMaterial({ color: col('#ffd23a'), roughness: 0.8 }), wm = new THREE.MeshStandardMaterial({ color: col('#f6f3ec') }), rm = new THREE.MeshStandardMaterial({ color: col('#b5583a') });
      const cp = (geo, m, x, y, z) => { const mm = new THREE.Mesh(geo, m); mm.position.set(x, y, z); mm.castShadow = true; g.add(mm); return mm; };
      cp(new THREE.BoxGeometry(6, 5, 11), ym, 0, 2.5, 0); cp(new THREE.BoxGeometry(6.4, 7, 0.8), ym, 0, 3.5, 5.6); cp(new THREE.BoxGeometry(2.4, 9, 2.4), wm, 2.6, 4.5, 5.0); cp(new THREE.ConeGeometry(1.8, 2.2, 4), rm, 2.6, 10.1, 5.0);
      const roofG = new THREE.CylinderGeometry(3.8, 3.8, 11.2, 3, 1); roofG.rotateX(PI / 2); roofG.rotateZ(PI); roofG.scale(1, 0.45, 1); cp(roofG, rm, 0, 5.3, 0);
      for (let k = 0; k < 8; k++) { const q = p.clone().add(V3(rr(4, 40), 0, rr(-30, 30))); house(q, rr(-0.4, 0.4) - PI / 2, rr(6, 8), 7, 3.6, pick(HOUSE)); }
      scene.userData.chuao = p.clone();
    }
  }

  /* ---------------- vegetation placement ---------------- */
  const cloudZone = (x, z, y) => y > 40 && z < 60;
  const nearStart = (x, z) => { const s = roadAt(i0, 0); return Math.hypot(x - s.x, z - s.z) < 20; };
  const nearTown = (x, z) => x > -215 && x < -66 && z > -8 && z < 128;
  const nearPlaza = (x, z) => Math.hypot(x - PLAZA.x, z - PLAZA.z) < 34;
  const nearBatea = (x, z) => Math.hypot((x - BATEA.x) / 26, (z - BATEA.z) / 22) < 1;
  const nearCristo = (x, z) => Math.hypot(x - CRISTO.x, z - CRISTO.z) < 22;
  const ok = (x, z, rm, vm) => {
    if (Math.abs(x) > 340 || Math.abs(z) > 340) return false;
    if (!freeOf(x, z, rm, vm) || nearStart(x, z) || nearCristo(x, z) || nearPlaza(x, z)) return false;
    const y = terrainH(x, z); if (y < 0.6) return false;
    return true;
  };
  const tries = (n, fn) => { for (let i = 0, k = 0; i < n && k < n * 25; k++) if (fn()) i++; };
  // the jungle on the hills, denser and mossier up in the cloud forest
  tries(2700, () => {
    const x = rr(-340, 340), z = rr(-340, 120); if (!ok(x, z, 10, 6) || nearTown(x, z) || nearBatea(x, z)) return false;
    const y = terrainH(x, z); if (z > 100 && y < 4) return false;
    tree(x, z, rand() < 0.35, cloudZone(x, z, y)); return true;
  });
  tries(700, () => {
    const x = rr(-340, 340), z = rr(-340, 90), y = terrainH(x, z); if (!cloudZone(x, z, y) || !ok(x, z, 5, 4)) return false;
    rand() < 0.65 ? treeFern(x, z) : bambooClump(x, z); return true;
  });
  // cloud-forest roadside: tree ferns and bamboo crowd the edges
  for (let i = 0; i < NR; i += 5) {
    if (!MOUNT[SEG[i]] || roadY[i] < 40 || SEG[i] === 'm') continue;
    for (const s of [-1, 1]) { if (rand() < 0.4) continue; const p = roadAt(i, s * (lateralHW(i, s) + rr(3.5, 8))); if (!ok(p.x, p.z, 3, 3)) continue; const k = rand(); k < 0.45 ? treeFern(p.x, p.z) : k < 0.6 ? bambooClump(p.x, p.z) : fern(p.x, p.z, rr(0.8, 1.4), col('#4f9a52')); }
  }
  // coconut palms along the beach, the town and the return road
  tries(150, () => { const x = rr(-210, 230), z = rr(108, 136); if (!ok(x, z, 4, 3)) return false; palm(x, z, V3(0, 0, 1)); return true; });
  tries(70, () => { const x = rr(-205, -70), z = rr(-6, 124); if (!ok(x, z, 3, 3) || houses.some(hh => Math.hypot(hh.p.x - x, hh.p.z - z) < 6)) return false; rand() < 0.6 ? palm(x, z) : tree(x, z, false, false); return true; });
  for (let i = 0; i < NR; i += 9) { if (SEG[i] !== 'v' && SEG[i] !== 'b') continue; for (const s of [-1, 1]) { if (rand() < 0.45) continue; const p = roadAt(i, s * (lateralHW(i, s) + rr(3, 6))); if (ok(p.x, p.z, 2.5, 2) && !(SEG[i] === 'b' && s > 0)) palm(p.x, p.z); } }
  tries(240, () => { const x = rr(-60, 260), z = rr(-40, 110); if (!ok(x, z, 4, 4)) return false; rand() < 0.5 ? palm(x, z) : tree(x, z, rand() < 0.3, false); return true; });
  tries(2600, () => { const x = rr(-340, 340), z = rr(-340, 130); if (!ok(x, z, 2.5, 2) || nearTown(x, z)) return false; const y = terrainH(x, z); rand() < 0.5 ? fern(x, z, rr(0.8, 1.6), cloudZone(x, z, y) ? col('#4f9a52') : null) : bush(x, z, rr(0.7, 1.4), !cloudZone(x, z, y)); return true; });
  tries(14000, () => {
    const x = rr(-340, 340), z = rr(-340, 140);
    if (!ok(x, z, 1.2, 1.5)) return false;
    const y = terrainH(x, z), s = rr(0.8, 1.6);
    push(inst.grass, V3(x, y - 0.05, z), qYaw(rand() * TAU), S.set(s * 1.4, s, s * 1.4), col(z > 116 && y < 3.4 ? '#c8c070' : '#7fc84a').offsetHSL(rr(-0.03, 0.03), rr(-0.1, 0.05), rr(-0.08, 0.06)));
    return true;
  });
  // river rocks
  for (let i = 0; i < NV * 0.55; i += 2) {
    const p = VP[i], t = VP[Math.min(NV, i + 1)].clone().sub(p).normalize();
    if (Math.hypot(p.x - FORD_R.x, p.z - FORD_R.y) < 16 || nearBatea(p.x, p.z)) continue;
    if (rand() < 0.45) { const o = rr(-1, 1) * (riverHW[i] + 2), s = rr(0.8, 2.4); push(inst.boulder, V3(p.x - t.z * o, riverY[i] - 0.3, p.z + t.x * o), qEuler(rand(), rand() * TAU, rand()), S.set(s * 1.2, s * 0.7, s), col('#c9b494').offsetHSL(0, 0, rr(-0.1, 0.05))); }
  }
  for (let i = 0; i < NS; i += 3) { const p = SP[i]; if (Math.hypot(p.x - FORD_S.x, p.z - FORD_S.y) < 10 || rand() < 0.5) continue; const s = rr(0.6, 1.6); push(inst.boulder, V3(p.x + rr(-4, 4), streamY[i] - 0.2, p.z + rr(-4, 4)), qEuler(rand(), rand() * TAU, rand()), S.set(s * 1.2, s * 0.7, s), col('#9a9284').offsetHSL(0, 0, rr(-0.1, 0.05))); }
  // forest far away on the backdrop mountains and on Chuao
  tries(1600, () => {
    const x = rr(-1100, 1500), z = rr(-1200, 420); if (Math.abs(x) < 345 && Math.abs(z) < 345) return false;
    const y = farH(x, z); if (y < 3) return false;
    vegetation.add('tree', x, z, y, 1.2, 100); return true;
  });

  /* ---------------- clouds and the fog band of the cloud forest ---------------- */
  const clouds = [], mist = [];
  {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, color: col('#fff1e2'), transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    for (let k = 0; k < 50; k++) {
      const a = rr(PI * 0.9, PI * 2.1), r = rr(800, 1400), s = new THREE.Sprite(mat);
      s.position.set(Math.cos(a) * r, rr(160, 300), Math.sin(a) * r * 0.8 - 300); const sc = rr(160, 320); s.scale.set(sc, sc * 0.45, 1); scene.add(s); clouds.push(s);
    }
    const fogMat = new THREE.SpriteMaterial({ map: cloudTex, color: col('#e8eef0'), transparent: true, opacity: 0.3, depthWrite: false, fog: true });
    for (let k = 0; k < 150; k++) {
      const x = rr(-260, 290), z = rr(-330, 40), y = rr(48, 88);
      if (base(x, z) > y + 12) continue;
      const s = new THREE.Sprite(fogMat); s.position.set(x, y, z); const sc = rr(34, 70); s.scale.set(sc, sc * 0.6, 1); scene.add(s); mist.push({ s, y0: y, ph: rand() * TAU });
    }
  }
  // splash spray at the two fords
  const spray = [];
  {
    const sm = new THREE.SpriteMaterial({ map: cloudTex, color: col('#ffffff'), transparent: true, opacity: 0.55, depthWrite: false });
    for (const [c, yy, n] of [[FORD_R, ryAt(-47), 20], [FORD_S, streamY[iFordS], 10]]) for (let k = 0; k < n; k++) { const s = new THREE.Sprite(sm); s.position.set(c.x + rr(-8, 8), yy + 0.4, c.y + rr(-5, 5)); s.scale.set(1.2, 1.2, 1); s.userData = { y0: yy, ph: rand() * TAU, sp: rr(1.5, 3) }; scene.add(s); spray.push(s); }
    const F = scene.userData.fall;
    for (let k = 0; k < 10; k++) { const s = new THREE.Sprite(sm); s.position.copy(F.b).add(V3(rr(-3, 3), rr(0.5, 2), rr(-3, 3))); const sc = rr(2, 4); s.scale.set(sc, sc, 1); s.userData = { y0: F.b.y, ph: rand() * TAU, sp: rr(0.6, 1.2) }; scene.add(s); spray.push(s); }
  }

  /* ---------------- flush instances ---------------- */
  function flush(list, geo, mat, cast = true) {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => { im.setMatrixAt(i, it.m); if (it.c) im.setColorAt(i, it.c); });
    if (list.some(it => it.c) && !list.every(it => it.c)) for (let i = 0; i < list.length; i++) if (!list[i].c) im.setColorAt(i, col('#ffffff'));
    im.castShadow = cast; im.receiveShadow = true; scene.add(im);
    return im;
  }
  flush(inst.trunk, trunkGeo, BARK);
  flush(inst.blob, blobGeo, CANOPY);
  flush(inst.bushBlob, new THREE.IcosahedronGeometry(1, 0), CANOPY);
  flush(inst.frond, frondGeo, FROND);
  flush(inst.grass, grassGeo, GRASS, false);
  { const bg = new THREE.CylinderGeometry(1, 1, 1, 6, 6); bg.translate(0, 0.5, 0); flush(inst.bamboo, bg, BAMBOO); }
  flush(inst.boulder, new THREE.SphereGeometry(1, 14, 10), SMOOTH);
  flush(inst.flower, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, emissive: col('#330808'), emissiveIntensity: 0.4, flatShading: true }), false);
  flush(inst.box, new THREE.BoxGeometry(1, 1, 1), PAINT);
  {
    // gable roof prism with an overhang; ridge along the local x axis
    const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5);
    const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setX(i, z); p.setZ(i, x); } g.computeVertexNormals();
    flush(inst.roof, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.85, side: THREE.DoubleSide }));
  }
  flush(inst.grille, new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: grilleTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }));
  { const g = new THREE.ConeGeometry(1, 1, 10, 1, true); flush(inst.cone, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.7, side: THREE.DoubleSide })); }
  { const g = new THREE.CylinderGeometry(1, 1, 1, 8); g.translate(0, 0.5, 0); flush(inst.cyl, g, new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.8 })); }
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3)); g.computeVertexNormals(); flush(inst.tri, g, windy(new THREE.MeshStandardMaterial({ color: col('#ffffff'), side: THREE.DoubleSide, roughness: 0.7 }), 0.08, 0.0), false); }
  {
    const mats = { steel: new THREE.MeshStandardMaterial({ color: col('#b9bcc0'), metalness: 0.5, roughness: 0.4 }), white: new THREE.MeshStandardMaterial({ color: col('#f4f1ea'), roughness: 0.6 }), green: new THREE.MeshStandardMaterial({ color: col('#5f8f6a'), roughness: 0.6, metalness: 0.2 }), wood: WOOD, concrete: new THREE.MeshStandardMaterial({ color: col('#bdb6a8'), roughness: 0.9 }) };
    const bg = new THREE.BoxGeometry(1, 1, 1);
    for (const [k, list] of Object.entries(beams)) if (list.length) { const im = new THREE.InstancedMesh(bg, mats[k], list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.castShadow = true; im.receiveShadow = true; scene.add(im); }
  }
  {
    const vm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide });
    const bandM = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6, side: THREE.DoubleSide });
    const darkM = new THREE.MeshStandardMaterial({ color: col('#ffffff'), roughness: 0.6 });
    const mergeGeos = list => { const out = []; for (const g of list) { const n = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); out.push(n); } let count = 0; out.forEach(g => (count += g.attributes.position.count)); const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3); let o = 0; out.forEach(g => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }); const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return m; };
    flush(boats.hull, penero.hull, vm);
    flush(boats.band, mergeGeos([penero.inside, penero.strip, penero.transom]), bandM);
    flush(boats.dark, mergeGeos([penero.motor, penero.seat]), darkM);
  }

  /* ---------------- peñeros out on the bay, pelicans overhead ---------------- */
  const movers = [];
  NAMES.slice(0, 5).forEach((nm, k) => { const g = boatMesh(PENEROS[k], nm); movers.push({ g, c: V3(rr(-120, 220), 0, rr(230, 330)), r: rr(30, 70), sp: rr(0.03, 0.06) * (k % 2 ? 1 : -1), ph: rand() * TAU }); });
  // a couple of named boats on the sand by the start
  for (let k = 0; k < 3; k++) { const i = (i0 + 30 + k * 28) % NR, f = roadFrame(i), p = roadAt(i, hwR[i] + 30); p.y = groundH(p.x, p.z); if (p.y < 0) continue; const g = boatMesh(PENEROS[k + 2], NAMES[5 + k]); g.position.copy(p); g.rotation.y = yawOf(f.n.clone().negate()) + rr(-0.2, 0.2); }
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
      birds.push({ g: b, wings, c: V3(rr(-150, 220), rr(18, 42), rr(150, 260)), r: rr(30, 90), sp: rr(0.1, 0.18) * (rand() < 0.5 ? -1 : 1), ph: rand() * TAU, fl: rr(2, 3.2) });
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
    mist.forEach(m => { m.s.position.y = m.y0 + Math.sin(t * 0.25 + m.ph) * 2; m.s.material.rotation = t * 0.01; });
    spray.forEach(s => { const k = (t * s.userData.sp * 0.5 + s.userData.ph) % 1; s.position.y = s.userData.y0 + 0.3 + k * 1.6; s.material.opacity = 0.5 * (1 - k); });
    swimmers.forEach(s => { if (s.water) { s.g.position.y = s.y0 + Math.sin(t * 1.6 + s.ph) * 0.08; s.g.rotation.y += dt * 0.15; } });
  }

  disposeOwned(scene);
  vegetation.flush();
  return { group: scene, groundAt: groundH, update };
}
