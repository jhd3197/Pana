import { flamingo } from '/engine/models/fauna/birds/flamingo.js';
import { palm as coconutPalm } from '/engine/models/vegetation/palm.js';
import { casita } from '/engine/models/props/island-house.js';
import { fishCrates, fishingNetRack } from '/engine/models/props/coastal.js';
import { createAssetPlacement } from './arena-assets.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import * as THREE from 'three';
import { disposeModel } from '/engine/models/props/game-table.js';
export function createArena(parent, renderer, camera) {
const ownedTextures=[];
const placeAsset=createAssetPlacement();
const scene = new THREE.Group(); scene.scale.setScalar(.42);parent.add(scene);scene.fog=parent.fog;
const small=true;
const STAGE = {
  name: 'Los Roques',
  seed: 20261031,
  solid: [
    { id: 'isla', x: [-34, 4], y: 0, ledges: true },
    { id: 'muelle', x: [12, 36], y: 0, ledges: true },
  ],
  soft: [
    { id: 'faro-balcon', x: [-33, -23], y: 10 },
    { id: 'faro-tope', x: [-31, -25], y: 19 },
    { id: 'terraza', x: [-16, -6], y: 7.5 },
    { id: 'enramada', x: [18, 28], y: 7 },
  ],
  // things that move. Each is a pure function of time t (see platformsAt below), so every player sees the same thing.
  moving: [
    { id: 'balsa', solid: false, width: 6, x: 8, y: 2.2, bob: 0.35, drift: 1.4, period: 7 },        // a raft between the island and the pier
    { id: 'penero', solid: true, width: 12, x: 46, y: 1.3, bob: 0.4, drift: 0, period: 5.5 },        // the fishing boat, its deck is solid
    { id: 'penero-techo', solid: false, width: 5, x: 45.5, y: 5.2, on: 'penero' },                  // the little cabin roof rides with it
  ],
  water: { y: -1.3 },
  spawns: [[-26, 0], [-12, 0], [-2, 0], [16, 0], [24, 0], [32, 0], [-20, 0], [8, 3]],
  respawn: [8, 28],
  blast: { x: [-82, 98], y: [-34, 64] },
  camera: { pos: [10, 12, 96], look: [10, 6.5, 0], fov: 32 },
};

/* ---------------- basics ---------------- */
const PI = Math.PI, TAU = PI * 2, V3 = (x, y, z) => new THREE.Vector3(x, y, z), col = c => new THREE.Color(c);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let seed = STAGE.seed; const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const rr = (a, b) => a + rand() * (b - a), pick = a => a[(rand() * a.length) | 0];
const ih = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const noise2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(ih(xi, yi), ih(xi + 1, yi), u), lerp(ih(xi, yi + 1), ih(xi + 1, yi + 1), u), v); };
const fbm = (x, y, o = 4) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * noise2(x * f, y * f); f *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); };
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c);ownedTextures.push(t); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const softTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });

/* ---------------- light and sky ---------------- */
const sun = new THREE.DirectionalLight('#ffffff', 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 50, bottom: -50, near: 10, far: 400 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
sun.target.position.set(8, 0, 0); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#d8f2ff', '#e8d8b0', 1.2); scene.add(hemi);
const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: col('#2f8fe6') }, uHor: { value: col('#c8eef8') }, uSunC: { value: col('#fff2d0') }, uSun: { value: V3(0, 1, 0) } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 uTop, uHor, uSunC, uSun; varying vec3 vD;
    void main(){
      vec3 d = normalize(vD); float h = clamp(d.y, -0.2, 1.0), s = max(dot(d, normalize(uSun)), 0.0);
      vec3 c = mix(uHor, uTop, smoothstep(-0.02, 0.55, h));
      c += uSunC * (pow(s, 8.0) * 0.3 + pow(s, 700.0) * 3.0);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
const TIMES = {
  dia: { dir: [0.35, 0.82, 0.45], sunC: '#fff6e8', sunI: 3.2, hemiS: '#d8f2ff', hemiG: '#f0e2c0', hemiI: 1.25, top: '#2f8fe6', hor: '#c8eef8', fog: '#bfe6f2', sea: 1.0, glow: 0, exp: 1.0, cloud: '#ffffff' },
  atardecer: { dir: [-0.85, 0.22, 0.4], sunC: '#ffa060', sunI: 2.8, hemiS: '#ffc8a8', hemiG: '#b07a6a', hemiI: 0.95, top: '#4a4aa0', hor: '#ffa070', fog: '#f0a888', sea: 0.75, glow: 1, exp: 1.05, cloud: '#ffd0b0' },
};
const asLook = t => { const o = {}; for (const [k, v] of Object.entries(t)) o[k] = typeof v === 'string' ? col(v) : Array.isArray(v) ? V3(...v).normalize() : v; return o; };
let look = asLook(TIMES.dia), timeFrom = null, timeTo = null, timeT = 1;
const blendLook = (a, b, u) => { const o = {}; for (const k of Object.keys(a)) { const x = a[k], y = b[k]; o[k] = x.isColor ? x.clone().lerp(y, u) : x.isVector3 ? x.clone().lerp(y, u).normalize() : lerp(x, y, u); } return o; };

/* ---------------- the sea: turquoise over sand, deep blue further out (the sea bed is painted once into a map) ---------------- */
const SEA = { size: 900 };
// the islands, as ellipses [x, z, rx, rz]: the stage cay, a few small cays around it
const CAYS = [[-14, -14, 30, 22], [24, -6, 16, 7], [-150, -170, 40, 16], [140, -210, 50, 18], [260, -90, 30, 12], [-280, -60, 36, 14], [40, -330, 60, 20]];
const bedTex = canvasTex(1024, 1024, (c, w, h) => {
  const toPx = x => (x / SEA.size + 0.5) * w;
  c.fillStyle = '#0a4a8a'; c.fillRect(0, 0, w, h);
  for (const [x, z, rx, rz] of CAYS) for (const [k, colr, a] of [[3.4, '#1a7ab8', 0.9], [2.4, '#2ab0c8', 0.9], [1.7, '#4ad8d0', 0.9], [1.25, '#9aeee0', 0.95], [1.05, '#f2ead0', 1]]) {
    const g = c.createRadialGradient(toPx(x), toPx(z), 0, toPx(x), toPx(z), rx * k / SEA.size * w);
    g.addColorStop(0, colr); g.addColorStop(0.7, colr); g.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a; c.fillStyle = g;
    c.save(); c.translate(toPx(x), toPx(z)); c.scale(1, rz / rx); c.translate(-toPx(x), -toPx(z)); c.fillRect(0, 0, w, h); c.restore();
  }
  c.globalAlpha = 1;
  // coral patches and turtle grass, dark spots in the shallows
  for (let k = 0; k < 220; k++) { const x = rr(-180, 180), z = rr(-160, 120); c.fillStyle = `rgba(${rand() < 0.5 ? '40,90,90' : '120,70,90'},${rr(0.15, 0.35).toFixed(2)})`; c.beginPath(); c.ellipse(toPx(x), toPx(z), rr(2, 9), rr(2, 6), rand() * 3, 0, TAU); c.fill(); }
});
bedTex.wrapS = bedTex.wrapT = THREE.ClampToEdgeWrapping;
const seaU = { uT: { value: 0 }, uBed: { value: bedTex }, uSize: { value: SEA.size }, uSun: { value: V3(0, 1, 0) }, uSunC: { value: col('#ffffff') }, uLight: { value: 1 }, uSky: { value: col('#c8eef8') } };
const sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000, 1, 1).rotateX(-PI / 2), new THREE.ShaderMaterial({
  uniforms: { ...seaU, ...THREE.UniformsLib.fog }, fog: true,
  vertexShader: 'varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); vW /= 0.42; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
  fragmentShader: `uniform float uT, uSize, uLight; uniform sampler2D uBed; uniform vec3 uSun, uSunC, uSky; varying vec3 vW;
    #include <fog_pars_fragment>
    void main(){
      vec2 uv = vW.xz / uSize + 0.5;
      float a = sin(vW.x * 0.25 + uT * 1.1 + sin(vW.z * 0.15) * 2.0) * sin(vW.z * 0.3 - uT * 0.8) + 0.5 * sin(vW.x * 0.8 - uT * 1.9) * sin(vW.z * 0.7 + uT * 1.4);
      vec2 wob = vec2(a, -a) * 0.0018;
      vec3 bed = texture2D(uBed, clamp(uv + wob, 0.0, 1.0)).rgb;
      float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      bed = mix(vec3(0.02, 0.2, 0.42), bed, inside);
      // caustics: bright wavy lines on the sand in the shallows
      float shallow = smoothstep(0.35, 0.8, bed.g + bed.r * 0.4);
      float cau = pow(abs(sin(vW.x * 0.9 + sin(vW.z * 0.7 + uT * 1.3) * 1.6) * sin(vW.z * 0.8 + sin(vW.x * 0.6 - uT * 1.1) * 1.6)), 6.0);
      vec3 c = bed + vec3(0.9, 1.0, 0.95) * cau * shallow * 0.18;
      vec3 N = normalize(vec3(a * 0.05, 1.0, a * 0.04)), V = normalize(cameraPosition / 0.42 - vW);
      float fr = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      c = mix(c, uSky, fr * 0.6);
      c += uSunC * pow(max(dot(reflect(-normalize(uSun), N), V), 0.0), 120.0) * 1.5;
      c *= uLight;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
}));
sea.position.y = STAGE.water.y; scene.add(sea);

/* ---------------- the cay: sand, the beach in front, a little dune behind ---------------- */
const stage = new THREE.Group(); stage.name = 'escenario'; scene.add(stage);
const ISLA = STAGE.solid[0], MUELLE = STAGE.solid[1];
const sandTex = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#f2e6c8'; c.fillRect(0, 0, w, h); for (let i = 0; i < 14000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(200,170,120,${rr(0.08, 0.25).toFixed(2)})` : `rgba(255,255,255,${rr(0.1, 0.3).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, 2, 2); } for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(240,200,190,0.8)'; c.beginPath(); c.ellipse(rand() * w, rand() * h, rr(2, 5), rr(1, 3), rand() * 3, 0, TAU); c.fill(); } });
sandTex.repeat.set(30, 30);
{
  // the ground around the playable sand: rises to a dune behind, slopes into the sea in front, drops away at the two ends
  const N = 140, size = 140, geo = new THREE.PlaneGeometry(size, size, N, N).rotateX(-PI / 2); geo.translate(-14, 0, -20);
  const p = geo.attributes.position, cl = new Float32Array(p.count * 3), tmp = new THREE.Color();
  const x0 = ISLA.x[0], x1 = ISLA.x[1];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const inX = sstep(x0 - 9, x0 + 1, x) * sstep(x1 + 6, x1 - 1, x);                     // the island ends where the playable sand ends
    const ex = (x + 14) / 30, ez = (z + 14) / 22, e = Math.hypot(ex, ez);
    let y = lerp(-6, -0.25, sstep(1.25, 0.95, e)) * (1 - inX) + inX * lerp(-0.25, -3.2, sstep(4.5, 20, z));
    if (z < -4) y = Math.max(y, lerp(-6, 0, sstep(1.25, 0.95, e)) + 9 * Math.exp(-((x + 12) ** 2) / 300 - ((z + 22) ** 2) / 110) * sstep(1.2, 0.8, e) + 2.2 * (fbm(x * 0.05, z * 0.05, 3) - 0.5));
    y += 0.25 * (fbm(x * 0.2, z * 0.2, 2) - 0.5);
    p.setY(i, y);
    tmp.set('#f2e6c8').lerp(col('#e2d0a8'), fbm(x * 0.08, z * 0.08, 2) * 0.6).lerp(col('#c8b088'), sstep(-0.4, -1.4, y) * 0.8);
    if (y > 1.5) tmp.lerp(col('#7aa84a'), sstep(1.5, 4, y) * 0.75 * fbm(x * 0.1 + 3, z * 0.1, 3) * 1.6);
    cl.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.computeVertexNormals();
  const g = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: sandTex, vertexColors: true, roughness: 1 })); g.receiveShadow = true; scene.add(g);
  // the playable sand: a clean slab so the ledges read clearly, with a band of coral rock under its ends
  const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 1.2, 10), new THREE.MeshStandardMaterial({ map: sandTex, color: '#fffaf0', roughness: 1 })); slab.position.set((x0 + x1) / 2, -0.6, 0); slab.receiveShadow = true; slab.castShadow = true; stage.add(slab);
  const rockM = new THREE.MeshStandardMaterial({ color: '#b8a088', roughness: 0.95, flatShading: true });
  for (const [x, s] of [[x0, -1], [x1, 1]]) for (let k = 0; k < 7; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rr(1, 2.2), 0), rockM); r.position.set(x + s * rr(-0.6, 0.8), rr(-3, -0.9), rr(-4.5, 4.5)); r.rotation.set(rand() * 3, rand() * 3, 0); r.castShadow = true; stage.add(r); }
}

/* ---------------- the lighthouse (two soft platforms: its balcony and the top gallery) ---------------- */
const lighthouse = (() => {
  const g = new THREE.Group(); stage.add(g);
  const cx = -28, cz = -4.6, H = 23;
  const bands = canvasTex(64, 512, (c, w, h) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? '#e0263a' : '#fafafa'; c.fillRect(0, k * h / 8, w, h / 8); } });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.8, H, 28), new THREE.MeshStandardMaterial({ map: bands, roughness: 0.6 })); tower.position.set(cx, H / 2, cz); tower.castShadow = true; tower.receiveShadow = true; g.add(tower);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshStandardMaterial({ color: '#2a6a9a' })); door.position.set(cx, 1.2, cz + 2.79); g.add(door);
  for (const y of [6, 14]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), new THREE.MeshStandardMaterial({ color: '#2a3a4a' })); win.position.set(cx, y, cz + 2.55 - y * 0.035); g.add(win); }
  const wood = new THREE.MeshStandardMaterial({ color: '#8a6040', roughness: 0.8 }), white = new THREE.MeshStandardMaterial({ color: '#f6f6f2', roughness: 0.5 });
  const deck = (x0, x1, y, depth, zc) => { const d = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.4, depth), wood); d.position.set((x0 + x1) / 2, y - 0.2, zc); d.castShadow = true; d.receiveShadow = true; g.add(d);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.1, 0.1), white); rail.position.set((x0 + x1) / 2, y + 1.0, zc - depth / 2 + 0.1); g.add(rail);
    for (let x = x0 + 0.2; x <= x1; x += 1) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.0, 0.07), white); b.position.set(x, y + 0.5, zc - depth / 2 + 0.1); g.add(b); }
    for (const x of [x0 + 0.4, x1 - 0.4]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3, 0.2), wood); br.position.set(x, y - 1.6, zc - depth / 2 + 0.4); br.rotation.x = 0.5; g.add(br); } };
  const B = STAGE.soft[0], T = STAGE.soft[1];
  deck(B.x[0], B.x[1], B.y, 5.2, -0.9);
  deck(T.x[0], T.x[1], T.y, 5.6, -2.2);
  // the lantern room, with a light that turns
  const room = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.6, 16), new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 })); room.position.set(cx, H + 1.3, cz); g.add(room);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.0, 16), new THREE.MeshStandardMaterial({ color: '#e0263a', roughness: 0.5 })); cap.position.set(cx, H + 3.6, cz); cap.castShadow = true; g.add(cap);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial({ color: col('#fff2c0').multiplyScalar(3), toneMapped: false })); lamp.position.set(cx, H + 1.3, cz); g.add(lamp);
  const beamPivot = new THREE.Group(); beamPivot.position.set(cx, H + 1.3, cz); g.add(beamPivot);
  const beamMat = new THREE.MeshBasicMaterial({ color: col('#fff2c0'), map: softTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  for (const s of [0, PI]) { const b = new THREE.Mesh(new THREE.ConeGeometry(6, 70, 20, 1, true).translate(0, -35, 0).rotateZ(PI / 2), beamMat); b.rotation.y = s; beamPivot.add(b); }
  return { beamPivot, beamMat, lamp };
})();

/* ---------------- the beach bar: a thatched churuata behind, a wooden sun deck in front (soft platform) ---------------- */
const thatchTex = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#c8a058'; c.fillRect(0, 0, w, h); for (let k = 0; k < 900; k++) { c.strokeStyle = pick(['rgba(150,110,50,0.6)', 'rgba(220,190,120,0.6)', 'rgba(120,90,40,0.5)']); c.lineWidth = rr(1, 2.5); const x = rand() * w, y = rand() * h; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rr(-4, 4), y + rr(14, 30)); c.stroke(); } });
{
  const T = STAGE.soft[2], wood = new THREE.MeshStandardMaterial({ color: '#9a6a40', roughness: 0.8 }), plankT = canvasTex(256, 128, (c, w, h) => { for (let x = 0; x < w; x += 16) { c.fillStyle = `rgb(${(170 + rr(-15, 15)) | 0},${(120 + rr(-10, 10)) | 0},${(80 + rr(-8, 8)) | 0})`; c.fillRect(x, 0, 15, h); c.fillStyle = 'rgba(40,20,8,0.6)'; c.fillRect(x + 15, 0, 1, h); } });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(T.x[1] - T.x[0], 0.45, 4.6), new THREE.MeshStandardMaterial({ map: plankT, roughness: 0.8 })); deck.position.set((T.x[0] + T.x[1]) / 2, T.y - 0.22, -0.5); deck.castShadow = true; deck.receiveShadow = true; stage.add(deck);
  for (const x of [T.x[0] + 0.5, T.x[1] - 0.5]) for (const z of [-2.5, 1.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, T.y, 8), wood); p.position.set(x, T.y / 2, z); p.castShadow = true; stage.add(p); }
  // the round thatched hut behind, with a hammock and a bar counter
  const hx = -11, hz = -9;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 6, 18, 1, true), new THREE.MeshStandardMaterial({ map: thatchTex, roughness: 1, side: THREE.DoubleSide })); roof.position.set(hx, 9.5, hz); roof.castShadow = true; stage.add(roof);
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 6.5, 8), wood); p.position.set(hx + Math.cos(a) * 5.6, 3.25, hz + Math.sin(a) * 5.6); p.castShadow = true; stage.add(p); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 1.1, 20, 1, false, 0, PI * 1.2), new THREE.MeshStandardMaterial({ color: '#2a8ad8', roughness: 0.6 })); bar.position.set(hx, 0.55, hz); bar.rotation.y = PI * 0.9; stage.add(bar);
  for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.5, 10), new THREE.MeshStandardMaterial({ color: pick(['#ffd23a', '#ff6a8a', '#7aff8a', '#ff8a2a']), roughness: 0.3 })); c.position.set(hx + Math.cos(k * 0.5) * 2.6, 1.35, hz + Math.sin(k * 0.5) * 2.6); stage.add(c); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.2), new THREE.MeshStandardMaterial({ map: canvasTex(512, 110, (c, w, h) => { c.fillStyle = '#2a8ad8'; c.fillRect(0, 0, w, h); c.font = '800 66px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.fillText('KIOSKO EL PANA', w / 2, h / 2 + 4); }), roughness: 0.6 })); sign.position.set(hx, 6.3, hz + 5.7); stage.add(sign);
}

/* ---------------- the pier, its shade (soft platform), boxes and nets ---------------- */
const plankTex = canvasTex(512, 256, (c, w, h) => { for (let x = 0; x < w; x += 16) { c.fillStyle = `rgb(${(150 + rr(-18, 18)) | 0},${(110 + rr(-12, 12)) | 0},${(76 + rr(-10, 10)) | 0})`; c.fillRect(x, 0, 15, h); c.fillStyle = 'rgba(30,16,6,0.6)'; c.fillRect(x + 15, 0, 1, h); c.fillStyle = '#3a3a3a'; c.fillRect(x + 6, 20, 3, 3); c.fillRect(x + 6, h - 24, 3, 3); } for (let i = 0; i < 300; i++) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(rand() * w, rand() * h, 1, rr(6, 30)); } });
{
  const M = MUELLE, w = M.x[1] - M.x[0], darkWood = new THREE.MeshStandardMaterial({ color: '#6a4a30', roughness: 0.9 });
  plankTex.repeat.set(w / 8, 1);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 7), [darkWood, darkWood, new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85 }), darkWood, darkWood, darkWood]); deck.position.set((M.x[0] + M.x[1]) / 2, -0.25, 0); deck.castShadow = true; deck.receiveShadow = true; stage.add(deck);
  for (let x = M.x[0] + 0.4; x <= M.x[1]; x += 3) for (const z of [-3.2, 3.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 7, 8), darkWood); p.position.set(x, -3.6, z); p.castShadow = true; stage.add(p); }
  // a walkway from the pier back to the cay, behind the play line (scenery)
  const walk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 14), new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85 })); walk.position.set(14, -0.3, -10); walk.rotation.y = -0.6; walk.receiveShadow = true; scene.add(walk);
  // the shade: four posts and a flat frond roof
  const E = STAGE.soft[3];
  const roof = new THREE.Mesh(new THREE.BoxGeometry(E.x[1] - E.x[0], 0.5, 5), new THREE.MeshStandardMaterial({ map: thatchTex, roughness: 1 })); roof.position.set((E.x[0] + E.x[1]) / 2, E.y - 0.25, -0.5); roof.castShadow = true; roof.receiveShadow = true; stage.add(roof);
  for (const x of [E.x[0] + 0.4, E.x[1] - 0.4]) for (const z of [-2.7, 1.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, E.y, 8), darkWood); p.position.set(x, E.y / 2, z); p.castShadow = true; stage.add(p); }
  // fringe of fronds hanging off the shade
  for (let x = E.x[0]; x <= E.x[1]; x += 0.6) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshStandardMaterial({ color: '#b89048', side: THREE.DoubleSide })); f.position.set(x, E.y - 0.9, 2.0); stage.add(f); }
  // crates, a cooler, coiled rope, fish hung to dry, a net over the rail at the back
  for (const [x, c] of [[33.5, '#2a8ad8'], [34.6, '#e0263a']]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.9), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 })); b.position.set(x, 0.45, -2.6); b.castShadow = true; stage.add(b); }
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 8, 20), new THREE.MeshStandardMaterial({ color: '#d8c090', roughness: 0.9 })); rope.rotation.x = PI / 2; rope.position.set(13.5, 0.16, -2.6); stage.add(rope);
  for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshStandardMaterial({ color: '#b8c0c8', metalness: 0.5, roughness: 0.3 })); f.scale.set(0.5, 1.6, 0.4); f.position.set(20 + k * 0.6, E.y - 1.6, -2.7); stage.add(f); }
}

/* ---------------- the moving things: the raft and the peñero ---------------- */
// where every platform is at time t, for the game: [{ id, x0, x1, y, solid }]
function platformsAt(t) {
  const out = [];
  for (const s of STAGE.solid) out.push({ id: s.id, x0: s.x[0], x1: s.x[1], y: s.y, solid: true });
  for (const s of STAGE.soft) out.push({ id: s.id, x0: s.x[0], x1: s.x[1], y: s.y, solid: false });
  const pose = {};
  for (const m of STAGE.moving) {
    let x = m.x, y = m.y, tilt = 0;
    if (m.on) { const b = pose[m.on]; x = b.x + (m.x - STAGE.moving.find(q => q.id === m.on).x); y = b.y + (m.y - STAGE.moving.find(q => q.id === m.on).y); tilt = b.tilt; }
    else { const a = t / m.period * TAU; y = m.y + Math.sin(a) * m.bob; x = m.x + Math.sin(a * 0.5) * m.drift; tilt = Math.sin(a + 0.8) * 0.04; }
    pose[m.id] = { x, y, tilt };
    out.push({ id: m.id, x0: x - m.width / 2, x1: x + m.width / 2, y, solid: m.solid, tilt });
  }
  return out;
}
const raft = (() => {
  const g = new THREE.Group(); scene.add(g);
  const logM = new THREE.MeshStandardMaterial({ color: '#a87a48', roughness: 0.85 });
  for (let k = 0; k < 7; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 3.6, 10), logM); l.rotation.x = PI / 2; l.position.set(-2.6 + k * 0.86, -0.32, 0); l.castShadow = true; l.receiveShadow = true; g.add(l); }
  for (const z of [-1.3, 1.3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: '#c8a870' })); b.position.set(0, 0, z); g.add(b); }
  // a little flag pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), logM); pole.position.set(2.7, 1.2, -1.5); g.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8, 8, 1), new THREE.MeshStandardMaterial({ color: '#ffd23a', side: THREE.DoubleSide })); flag.geometry.translate(0.65, 0, 0); flag.position.set(2.7, 2.3, -1.5); g.add(flag);
  // a rope tying it to the pier, sagging
  const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(), V3()]), new THREE.LineBasicMaterial({ color: '#d8c090' })); scene.add(rope);
  return { g, flag, rope };
})();
const penero = (() => {
  const g = new THREE.Group(); scene.add(g);
  const m = STAGE.moving[1], L = m.width;
  // a long open fishing boat: white hull, a red and blue band, a small cabin in the middle
  const shape = new THREE.Shape(); shape.moveTo(-L / 2 - 0.4, 0.2); shape.quadraticCurveTo(-L / 2 + 0.6, -1.5, -L / 2 + 2.2, -1.7); shape.lineTo(L / 2 - 2.6, -1.7); shape.quadraticCurveTo(L / 2 + 0.2, -1.4, L / 2 + 1.4, 0.6); shape.lineTo(-L / 2 - 0.4, 0.2);
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3.6, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 }).translate(0, 0, -1.8), new THREE.MeshStandardMaterial({ color: '#fafafa', roughness: 0.4 }));
  hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
  for (const [y, c] of [[-0.1, '#e0263a'], [-0.45, '#2a5ad8']]) { const b = new THREE.Mesh(new THREE.BoxGeometry(L + 0.4, 0.22, 4.05), new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })); b.position.y = y; g.add(b); }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L - 1, 0.15, 3.3), new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.8 })); deck.position.y = -0.05; deck.receiveShadow = true; g.add(deck);
  const name = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.6), new THREE.MeshStandardMaterial({ map: canvasTex(512, 72, (c, w, h) => { c.clearRect(0, 0, w, h); c.font = '800 54px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#2a5ad8'; c.fillText('LA PANITA II', w / 2, h / 2 + 3); }), transparent: true })); name.position.set(1.2, -0.95, 2.03); g.add(name);
  // the cabin (its roof is a soft platform that rides with the boat)
  const R = STAGE.moving[2], cx = R.x - m.x;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(R.width - 0.6, 3.4, 2.6), new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.5 })); cab.position.set(cx, 1.6, -0.2); cab.castShadow = true; g.add(cab);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), new THREE.MeshStandardMaterial({ color: '#2a3a4a', roughness: 0.1 })); w.position.set(cx + s * 1.0, 2.2, 1.11); g.add(w); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(R.width, 0.3, 3.2), new THREE.MeshStandardMaterial({ color: '#2a8ad8', roughness: 0.5 })); roof.position.set(cx, R.y - m.y - 0.15, -0.2); roof.castShadow = true; g.add(roof);
  // two outboard motors, a fishing rod, buoys
  const motor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.4 })); motor.position.set(-L / 2 - 0.6, -0.2, 0.6); g.add(motor);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 4.5, 6), new THREE.MeshStandardMaterial({ color: '#3a3a3a' })); rod.position.set(L / 2 - 1, 1.6, -1.4); rod.rotation.z = -0.6; g.add(rod);
  for (const x of [-3, 3]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.4 })); b.position.set(x, -0.1, 2.15); g.add(b); }
  return { g };
})();

/* ---------------- palms, houses of the village behind, other cays, sailboats ---------------- */
let palmSeed=120;
function palm(x,y,z,h=rr(8,13)) {
  placeAsset(scene,coconutPalm({h,seed:palmSeed++,detail:z < -80?'far':'full'}),{at:[x,y,z],yaw:rr(-PI,PI),id:'palm'});
}
// palms on the cay, behind the play line and at the ends
for (const [x, z] of [[-33, -8], [-20, -12], [-4, -9], [-24, -18], [-8, -20], [-16, -24], [0, -15], [3, -5.5], [-35, 3]]) palm(x, -0.2 + (z < -10 ? 1.5 : 0), z);
// Detailed shared casitas sit on the dune, behind the playable silhouette.
for(const [k,x,z] of [[0,-30,-28],[1,-21,-30],[2,-12,-31],[3,-3,-28],[4,-25,-38],[5,-8,-39]]) {
  const y=2+6*Math.exp(-((x+12)**2)/300);
  placeAsset(scene,casita({seed:81+k}),{at:[x,y,z],scale:1.7,yaw:(k%3-1)*.12,id:'casita'});
}
placeAsset(stage,fishCrates(),{at:[30,0,-3.5],scale:1.2,id:'fish-crates'});
placeAsset(stage,fishingNetRack(),{at:[17,0,-4],scale:1.1,id:'fishing-net-rack'});
// the other cays: sand mounds with a few palms
for (const [x, z, rx, rz] of CAYS.slice(2)) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, TAU, 0, PI / 2), new THREE.MeshStandardMaterial({ color: '#f2e6c8', roughness: 1 })); m.scale.set(rx * 0.9, 2.2, rz * 0.9); m.position.set(x, STAGE.water.y - 0.4, z); scene.add(m);
  for (let k = 0; k < 6; k++) palm(x + rr(-rx * 0.5, rx * 0.5), STAGE.water.y + 1.2, z + rr(-rz * 0.4, rz * 0.4), rr(9, 14));
}
// sailboats going by far out
const sails = [];
for (let k = 0; k < 5; k++) {
  const g = new THREE.Group(), hull = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2), new THREE.MeshStandardMaterial({ color: '#fafafa' })); g.add(hull);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10, 6), new THREE.MeshStandardMaterial({ color: '#cccccc' })); mast.position.y = 5.5; g.add(mast);
  const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0, 9); shape.lineTo(4.5, 0.4); shape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: pick(['#ffffff', '#ffd23a', '#e0263a', '#2a8ad8']), side: THREE.DoubleSide })); sail.position.set(0, 1, 0); g.add(sail);
  g.position.set(rr(-400, 400), STAGE.water.y + 0.4, rr(-420, -160)); scene.add(g); sails.push({ g, sp: rr(2, 5) * (rand() < 0.5 ? 1 : -1), ph: rand() * TAU }); g.rotation.y = sails.at(-1).sp > 0 ? 0 : PI;
}

/* ---------------- clouds, gulls, pelicans diving, flamingos on the far sandbar, foam at the shore ---------------- */
const clouds = [];
{
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.25 });
  for (let k = 0; k < 18; k++) { const g = new THREE.Group(), n = 5 + ((rand() * 5) | 0), s = rr(8, 18); for (let j = 0; j < n; j++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), mat); b.scale.set(s * rr(0.7, 1.1), s * rr(0.5, 0.8), s * 0.7); b.position.set((j - n / 2) * s * 0.85, rr(0, 0.4) * s, rr(-0.3, 0.3) * s); g.add(b); } g.position.set(rr(-600, 600), rr(70, 180), rr(-900, -400)); scene.add(g); clouds.push({ g, sp: rr(1, 3) }); }
  clouds.mat = mat;
}
const gulls = [];
for (let k = 0; k < 9; k++) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#f6f6f2', side: THREE.DoubleSide }), body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), m); body.scale.set(0.7, 0.6, 1.6); g.add(body);
  const wings = []; for (const s of [-1, 1]) { const pv = new THREE.Group(); g.add(pv); const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.45).translate(s * 0.7, 0, 0), m); w.rotation.x = -PI / 2; pv.add(w); const tip = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.35).translate(s * 1.3, 0, 0), new THREE.MeshStandardMaterial({ color: '#2a2a2a', side: THREE.DoubleSide })); tip.rotation.x = -PI / 2; pv.add(tip); wings.push({ pv, s }); }
  g.scale.setScalar(1.5); scene.add(g); gulls.push({ g, wings, c: V3(rr(-60, 80), rr(18, 40), rr(-60, -15)), r: rr(20, 60), sp: rr(0.15, 0.3) * (k % 2 ? 1 : -1), ph: rand() * TAU });
}
// Shared wading silhouettes alternate resting and feeding poses.
{
  const [fx,fz]=[CAYS[2][0]+30,CAYS[2][1]+14];
  for(let k=0;k<14;k++)placeAsset(scene,flamingo({seed:k+1,pose:k%3?'stand':'feed'}),
    {at:[fx+rr(-26,26),STAGE.water.y,fz+rr(-6,6)],scale:1.8,yaw:rr(0,TAU),id:'flamingo'});
}
const foam = (() => {
  // a strip of surf just in front of the cay that comes and goes
  const pts = [], x0 = ISLA.x[0] - 2, x1 = ISLA.x[1] + 2;
  const geo = new THREE.PlaneGeometry(x1 - x0, 3, 60, 1).rotateX(-PI / 2); geo.translate((x0 + x1) / 2, STAGE.water.y + 0.06, 13.5);
  const tex = canvasTex(512, 64, (c, w, h) => { c.clearRect(0, 0, w, h); for (let k = 0; k < 400; k++) { c.fillStyle = `rgba(255,255,255,${rr(0.3, 0.9).toFixed(2)})`; c.beginPath(); c.arc(rand() * w, h * (0.3 + 0.4 * rand()), rr(2, 7), 0, TAU); c.fill(); } });
  tex.repeat.set(4, 1);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.8 })); scene.add(m); void pts; return m;
})();

function applyLook(L) {
  sun.position.copy(L.dir).multiplyScalar(200).add(V3(8, 0, 0)); sun.color.copy(L.sunC); sun.intensity = L.sunI;
  hemi.color.copy(L.hemiS); hemi.groundColor.copy(L.hemiG); hemi.intensity = L.hemiI;
  const u = sky.material.uniforms; u.uTop.value.copy(L.top); u.uHor.value.copy(L.hor); u.uSunC.value.copy(L.sunC); u.uSun.value.copy(L.dir);
  scene.fog.color.copy(L.fog); seaU.uSun.value.copy(L.dir); seaU.uSunC.value.copy(L.sunC); seaU.uLight.value = L.sea; seaU.uSky.value.copy(L.hor);
  clouds.mat.color.copy(L.cloud); clouds.mat.emissive.copy(L.cloud);
  lighthouse.beamMat.opacity = 0.22 * L.glow; renderer.toneMappingExposure = L.exp;
}
applyLook(look);function step(t, dt) {
  tickWind(t);
  if (timeT < 1) { timeT = Math.min(1, timeT + dt / 2.5); look = blendLook(timeFrom, timeTo, sstep(0, 1, timeT)); applyLook(look); }
  seaU.uT.value = t;
  // the moving platforms
  const P = platformsAt(t), byId = Object.fromEntries(P.map(p => [p.id, p]));
  const b = byId.balsa; raft.g.position.set((b.x0 + b.x1) / 2, b.y, 0); raft.g.rotation.z = 0; raft.g.rotation.x = 0;
  raft.flag.rotation.y = Math.sin(t * 2.3) * 0.3;
  { const a = V3(MUELLE.x[0] + 0.2, -0.2, -3), c = raft.g.position.clone().add(V3(2.8, -0.2, -1.6)), pts = []; for (let k = 0; k <= 10; k++) { const u = k / 10, p = a.clone().lerp(c, u); p.y -= Math.sin(u * PI) * 0.8; pts.push(p); } raft.rope.geometry.setFromPoints(pts); }
  const pn = byId.penero; penero.g.position.set((pn.x0 + pn.x1) / 2, pn.y, 0); penero.g.rotation.z = 0; penero.g.rotation.x = 0;
  lighthouse.beamPivot.rotation.y = t * 0.8; lighthouse.lamp.material.color.setScalar(2.2 + Math.sin(t * 0.8) * 0.8).multiply(col('#fff2c0'));
  foam.material.opacity = 0.45 + 0.35 * Math.sin(t * 0.9); foam.position.z = Math.sin(t * 0.9) * 1.2; foam.material.map.offset.x = t * 0.01;
  clouds.forEach(c => { c.g.position.x += c.sp * dt; if (c.g.position.x > 700) c.g.position.x = -700; });
  sails.forEach(s => { s.g.position.x += s.sp * dt; s.g.rotation.z = Math.sin(t * 0.7 + s.ph) * 0.06; if (Math.abs(s.g.position.x) > 500) s.g.position.x = -Math.sign(s.sp) * 500; });
  gulls.forEach(gl => { const a = gl.ph + t * gl.sp, p = V3(gl.c.x + Math.cos(a) * gl.r, gl.c.y + Math.sin(t * 0.5 + gl.ph) * 3, gl.c.z + Math.sin(a) * gl.r * 0.4), q = V3(gl.c.x + Math.cos(a + 0.03 * Math.sign(gl.sp)) * gl.r, p.y, gl.c.z + Math.sin(a + 0.03 * Math.sign(gl.sp)) * gl.r * 0.4); gl.g.position.copy(p); gl.g.lookAt(q); gl.g.rotateZ(-0.25 * Math.sign(gl.sp)); const flap = Math.sin(t * 6 + gl.ph) > 0.3 ? Math.sin(t * 12 + gl.ph) * 0.6 : 0.15; gl.wings.forEach(w => (w.pv.rotation.z = w.s * flap)); });

}
return {frame:step,dispose(){scene.traverse(o=>o.shadow?.dispose());disposeModel(scene);ownedTextures.forEach(t=>t.dispose());}};
}
