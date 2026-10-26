import { scarletMacaw } from '/engine/models/fauna/birds/scarlet-macaw.js';
import { fern } from '/engine/models/vegetation/fern.js';
import { heliconia } from '/engine/models/vegetation/heliconia.js';
import { treeFern } from '/engine/models/vegetation/selva-palms.js';
import { createAssetPlacement } from './arena-assets.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import * as THREE from 'three';
import { disposeModel } from '/engine/models/props/game-table.js';
export function createArena(parent, renderer, camera) {
const ownedTextures=[];
const placeAsset=createAssetPlacement();
const scene = new THREE.Group(); scene.scale.setScalar(.42); parent.add(scene);
scene.fog = parent.fog;
const small = true;
const STAGE = {
  name: 'Salto Ángel', // i18n-ignore: place name
  seed: 20261029,
  main: { x: [-21, 21], y: 0, depth: 15, ledges: true },
  soft: [
    { id: 'piedra-izq', x: [-16, -6], y: 7.5 },
    { id: 'piedra-der', x: [6, 16], y: 7.5 },
  ],
  // the curiara: a canoe hanging from vines, swinging side to side above the middle
  moving: { id: 'curiara', width: 9, y: 15, swing: 9, period: 11 },
  spawns: [[-12, 0], [12, 0], [-4, 0], [4, 0]],
  respawn: [0, 24],
  blast: { x: [-62, 62], y: [-40, 54] },
  camera: { pos: [0, 9, 60], look: [0, 5.5, 0], fov: 32 },
  falls: { tepui: [20, -780], width: 240, depth: 150, top: 165, bottom: -260, lip: 0.26 },
  tepuis: [[-620, -560, 150, 110, 110], [330, -520, 140, 100, 96], [560, -900, 220, 130, 150], [180, -1300, 280, 160, 190], [-700, -1250, 240, 150, 170]],
  clouds: { y: -70 },
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
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); ownedTextures.push(t); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const softTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });

/* ---------------- light and sky (driven by the time of day) ---------------- */
const sun = new THREE.DirectionalLight('#ffffff', 2.4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 10, far: 260 }); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe8ff', '#6a7a50', 0.8); scene.add(hemi);
const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uTop: { value: col('#3f8fe0') }, uHor: { value: col('#cfe8f4') }, uSunC: { value: col('#fff2d0') }, uSun: { value: V3(0, 1, 0) }, uStars: { value: 0 }, uMoon: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform vec3 uTop, uHor, uSunC, uSun; uniform float uStars, uMoon; varying vec3 vD;
    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    void main(){
      vec3 d = normalize(vD); float h = clamp(d.y, -0.2, 1.0), s = max(dot(d, normalize(uSun)), 0.0);
      vec3 c = mix(uHor, uTop, smoothstep(-0.05, 0.6, h));
      c += uSunC * (pow(s, 8.0) * 0.35 + pow(s, 600.0) * (3.0 - uMoon * 1.5));
      vec3 q = floor(d * 420.0); c += vec3(0.9, 0.92, 1.0) * step(0.9968, hash(q)) * uStars * smoothstep(0.02, 0.3, h) * (0.4 + 0.6 * hash(q + 3.0));
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
const TIMES = {
  manana: { dir: [0.45, 0.62, 0.62], sunC: '#fff2dc', sunI: 2.5, hemiS: '#d4ecff', hemiG: '#6a7a50', hemiI: 0.85, top: '#3f8fe0', hor: '#d2ecf6', fog: '#cfe4ef', cloud: '#ffffff', cloudShade: '#a8c0d8', fall: 1.0, stars: 0, night: 0, exp: 1.0, rainbow: 1 },
  atardecer: { dir: [-0.78, 0.2, 0.45], sunC: '#ffa060', sunI: 2.4, hemiS: '#ffc4a8', hemiG: '#5a4060', hemiI: 0.7, top: '#3a3f8f', hor: '#ff9a62', fog: '#e8a488', cloud: '#ffd2b0', cloudShade: '#a0607a', fall: 0.9, stars: 0.15, night: 0.15, exp: 1.0, rainbow: 0.5 },
  noche: { dir: [0.3, 0.7, 0.55], sunC: '#9ab4ff', sunI: 0.75, hemiS: '#4a5aa0', hemiG: '#141a2a', hemiI: 0.55, top: '#04081c', hor: '#1c2450', fog: '#141a3a', cloud: '#4a5888', cloudShade: '#141a34', fall: 0.55, stars: 1, night: 1, exp: 1.15, rainbow: 0 },
};
const look = {}; const setLook = (t) => { for (const [k, v] of Object.entries(t)) look[k] = typeof v === 'string' ? col(v) : Array.isArray(v) ? V3(...v).normalize() : v; };
setLook(TIMES.manana);
let timeFrom = null, timeTo = null, timeT = 1;
function blendLook(a, b, u) { const o = {}; for (const k of Object.keys(a)) { const x = a[k], y = b[k]; o[k] = x.isColor ? x.clone().lerp(y, u) : x.isVector3 ? x.clone().lerp(y, u).normalize() : lerp(x, y, u); } return o; }
const asLook = t => { const o = {}; for (const [k, v] of Object.entries(t)) o[k] = typeof v === 'string' ? col(v) : Array.isArray(v) ? V3(...v).normalize() : v; return o; };

/* ---------------- the floating island (the main stage) ---------------- */
const stage = new THREE.Group(); stage.name = 'escenario'; scene.add(stage);
const M = STAGE.main, halfW = (M.x[1] - M.x[0]) / 2, halfD = M.depth / 2;
// grass on top, with a worn path along the fighting line
const grassTex = canvasTex(1024, 256, (c, w, h) => {
  c.fillStyle = '#6aa83a'; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { c.fillStyle = rand() < 0.5 ? `rgba(40,90,20,${rr(0.1, 0.3).toFixed(2)})` : `rgba(190,230,110,${rr(0.08, 0.25).toFixed(2)})`; c.fillRect(rand() * w, rand() * h, rr(1, 3), rr(2, 6)); }
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0.3, 'rgba(200,170,110,0)'); g.addColorStop(0.5, 'rgba(200,170,110,0.5)'); g.addColorStop(0.62, 'rgba(200,170,110,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(150,130,90,0.5)'; c.beginPath(); c.ellipse(rand() * w, h * rr(0.42, 0.58), rr(8, 20), rr(4, 8), 0, 0, TAU); c.fill(); }
});
const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true });
{
  // the top: a rounded slab, a little bevel at the lip so the ledge reads clearly
  const shape = new THREE.Shape(), r = 2.2, x0 = -halfW, x1 = halfW, z0 = -halfD, z1 = halfD;
  shape.moveTo(x0 + r, z0); shape.lineTo(x1 - r, z0); shape.quadraticCurveTo(x1, z0, x1, z0 + r); shape.lineTo(x1, z1 - r); shape.quadraticCurveTo(x1, z1, x1 - r, z1); shape.lineTo(x0 + r, z1); shape.quadraticCurveTo(x0, z1, x0, z1 - r); shape.lineTo(x0, z0 + r); shape.quadraticCurveTo(x0, z0, x0 + r, z0);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.4, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 3 }).rotateX(PI / 2), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }));
  grassTex.repeat.set(1 / (halfW * 2), 1 / (halfD * 2)); grassTex.offset.set(0.5, 0.5);
  top.position.y = 0.0; top.receiveShadow = true; top.castShadow = true; stage.add(top);
  // the underside: a rocky cone hanging down to a point, strata of sandstone, grey and red, with mossy patches
  const seg = 48, rings = 22, H = 30, geo = new THREE.CylinderGeometry(1, 0.04, H, seg, rings, true); geo.translate(0, -H / 2 - 1.6, 0);
  const p = geo.attributes.position, cl = new Float32Array(p.count * 3), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), u = clamp((-y - 1.6) / H, 0, 1);
    const n = fbm(a * 3 + 9, y * 0.18, 4), bulge = 1 + 0.35 * (n - 0.5) + 0.12 * Math.sin(y * 1.3 + a * 5) * u;
    const taper = Math.pow(1 - u, 1.25) * 0.92 + 0.08 * (1 - u);
    p.setXYZ(i, x * (halfW + 0.6) * taper * bulge, y - (n - 0.5) * 2.2 * u, z * (halfD + 0.6) * taper * bulge);
    const band = Math.sin(y * 2.2 + n * 3) * 0.5 + 0.5;
    tmp.set('#a8644a').lerp(col('#7a6a62'), band * 0.6).lerp(col('#4a3a34'), sstep(0.5, 1, u) * 0.6);
    if (u < 0.22 && n > 0.48) tmp.lerp(col('#4a7a2a'), sstep(0.48, 0.62, n) * (1 - u / 0.22));
    cl.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.computeVertexNormals();
  const under = new THREE.Mesh(geo, rockMat); under.castShadow = true; under.receiveShadow = true; stage.add(under);
  // a band of stone right under the grass, so the lip has a clean edge
  const lip = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.6, 1.0, halfD * 2 + 0.6), new THREE.MeshStandardMaterial({ color: '#8a5a42', roughness: 0.9 })); lip.position.y = -1.9; lip.castShadow = true; stage.add(lip);
}

/* ---------------- the two stone platforms and the curiara ---------------- */
function slab(x0, x1, y) {
  const g = new THREE.Group(), w = x1 - x0, cx = (x0 + x1) / 2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 4.4), new THREE.MeshStandardMaterial({ map: grassTex.clone(), roughness: 0.95 })); top.material.map.repeat.set(w / 60, 0.5); top.material.map.needsUpdate = true; top.position.set(cx, y - 0.35, 0); top.receiveShadow = true; top.castShadow = true; g.add(top);
  const geo = new THREE.CylinderGeometry(1, 0.1, 5, 16, 6, true); geo.translate(0, -3.2, 0);
  const p = geo.attributes.position, cl = new Float32Array(p.count * 3), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), yy = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), n = fbm(a * 3 + cx, yy * 0.4, 3); p.setXYZ(i, x * (w / 2 + 0.2) * (0.85 + 0.3 * n), yy - n * 0.8, z * 2.4 * (0.85 + 0.3 * n)); tmp.set('#9a5e46').lerp(col('#6a5a52'), n); cl.set([tmp.r, tmp.g, tmp.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.computeVertexNormals();
  const rock = new THREE.Mesh(geo, rockMat); rock.position.set(cx, y, 0); rock.castShadow = true; g.add(rock);
  stage.add(g); return g;
}
const slabs = STAGE.soft.map(s => slab(s.x[0], s.x[1], s.y));
slabs.forEach((g, k) => (g.userData.base = g.position.y));
const curiara = (() => {
  const C = STAGE.moving, g = new THREE.Group(); stage.add(g);
  const wood = new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 0.75 }), dark = new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.8 });
  // a dugout canoe: a hollowed half-cylinder, pointed ends, a painted band
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, C.width, 20, 8, false, PI / 2, PI), wood);
  { const p = hull.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = Math.abs(y) / (C.width / 2), k = 1 - Math.pow(t, 3) * 0.85; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } hull.geometry.computeVertexNormals(); }
  hull.rotation.z = PI / 2; hull.position.y = -0.1; hull.castShadow = true; g.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(C.width - 1.6, 0.18, 1.7), new THREE.MeshStandardMaterial({ color: '#c89a5a', roughness: 0.8 })); deck.position.y = -0.05; deck.receiveShadow = true; deck.castShadow = true; g.add(deck);
  const band = new THREE.Mesh(new THREE.BoxGeometry(C.width - 1.2, 0.18, 2.24), new THREE.MeshStandardMaterial({ color: '#e0263a', roughness: 0.6 })); band.position.y = -0.55; g.add(band);
  for (const s of [-1, 1]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 6), dark); tip.position.set(s * (C.width / 2 + 0.2), 0.2, 0); tip.rotation.z = -s * 1.1; g.add(tip); }
  // the vines it hangs from, up into the clouds above the stage
  const vines = []; const vm = new THREE.MeshStandardMaterial({ color: '#3a6a2a', roughness: 0.9 });
  for (const s of [-1, 1]) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6).translate(0, 0.5, 0), vm); g.add(v); vines.push({ v, s }); }
  // leaves along the vines
  const leaves = [];
  for (const s of [-1, 1]) for (let k = 0; k < 8; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshStandardMaterial({ color: '#4a9a3a', side: THREE.DoubleSide })); g.add(l); leaves.push({ l, s, k }); }
  return { g, vines, leaves };
})();

/* ---------------- dressing on the stage: orchids, bromeliads, rocks, torches, a carved sign ---------------- */
const dummy=new THREE.Object3D();
// Low foreground ferns; taller vegetation stays behind the fighting lane.
for(let k=0;k<18;k++) {
  const x=-19+(k%9)*4.7,z=k<9?-halfD+1:halfD-1;
  const flower=k<9&&k%3===1;
  placeAsset(stage,flower?heliconia({seed:410+k,detail:'low'}):fern({seed:410+k}),
    {at:[x,.05,z],scale:k<9?1.1:.48,yaw:k*2.4,id:flower?'heliconia':'fern'});
}
for(const [x,z,scale] of [[-18,-5,1.05],[17,-5,.9]])
  placeAsset(stage,treeFern({seed:500+x,detail:'game',scale}),{at:[x,0,z],id:'tree-fern'});
// two torches at the back corners, lit at night
const torches = [];
for (const s of [-1, 1]) {
  const x = s * (halfW - 2.2), z = -halfD + 1.4, pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2, 8), new THREE.MeshStandardMaterial({ color: '#5a3a20', roughness: 0.9 })); pole.position.set(x, 1.6, z); pole.castShadow = true; stage.add(pole);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 0.5, 10), new THREE.MeshStandardMaterial({ color: '#3a2a1a' })); bowl.position.set(x, 3.3, z); stage.add(bowl);
  const flame = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshBasicMaterial({ map: softTex, color: col('#ff9a30').multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); flame.position.set(x, 4.0, z); stage.add(flame);
  const light = new THREE.PointLight('#ffa040', 0, 18, 1.6); light.position.set(x, 4.2, z); stage.add(light);
  torches.push({ flame, light, ph: rand() * TAU });
}
// a carved wooden sign at the back: the falls' Pemón name
{
  const t = canvasTex(512, 96, (c, w, h) => { c.fillStyle = '#7a4a28'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 3) { c.fillStyle = `rgba(40,20,8,${(0.05 + 0.08 * Math.abs(Math.sin(y * 0.3))).toFixed(2)})`; c.fillRect(0, y, w, 2); } c.font = '800 52px "Baloo 2", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#3a200c'; c.fillText('KEREPAKUPAI MERÚ', w / 2 + 2, h / 2 + 4); c.fillStyle = '#f2d8a8'; c.fillText('KEREPAKUPAI MERÚ', w / 2, h / 2 + 2); }); // i18n-ignore: signage painted in the world
  const sign = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.2, 0.2), [0, 0, 0, 0].map(() => new THREE.MeshStandardMaterial({ color: '#6a3a1a' })).concat([new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: '#6a3a1a' })]));
  sign.position.set(-7.5, 1.9, -halfD + 1.0); sign.castShadow = true; stage.add(sign);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#5a3a20' })); p.position.set(-7.5 + s * 2.8, 1.2, -halfD + 0.95); stage.add(p); }
}
// roots and vines hanging under the island, swaying
const roots = [];
{
  const rm = new THREE.MeshStandardMaterial({ color: '#5a4a2a', roughness: 1 }), vm = new THREE.MeshStandardMaterial({ color: '#3a7a2a', roughness: 0.9 });
  for (let k = 0; k < 26; k++) {
    const a = rand() * TAU, u = rr(0.0, 0.4), r = (1 - u) * 0.95, x = Math.cos(a) * (halfW + 0.4) * r, z = Math.sin(a) * (halfD + 0.4) * r, y = -2 - u * 30, len = rr(3, 10), green = rand() < 0.55;
    const pts = []; for (let j = 0; j <= 6; j++) pts.push(V3(rr(-0.3, 0.3) * j * 0.2, -j / 6 * len, rr(-0.3, 0.3) * j * 0.2));
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, green ? 0.08 : 0.14, 5), green ? vm : rm); m.position.set(x, y, z); m.castShadow = true; stage.add(m); roots.push({ m, ph: rand() * TAU });
  }
}

/* ---------------- the tepui with the falls, and the tepuis on the horizon ---------------- */
function tepui(cx, cz, w, d, top, bottom, o = {}) {
  const segA = o.seg ?? 96, segY = o.segY ?? 40, H = top - bottom, geo = new THREE.CylinderGeometry(1, 1, H, segA, segY, false); geo.translate(0, bottom + H / 2, 0);
  const p = geo.attributes.position, cl = new Float32Array(p.count * 3), tmp = new THREE.Color(), salt = cx * 0.013;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), cap = Math.abs(y - top) < 1e-3, rr0 = Math.hypot(x, z);
    const n = fbm(a * 4 + salt, y * 0.008, 4), streak = fbm(a * 22 + salt, y * 0.002, 3), terr = Math.floor((y - bottom) / (H / 7));
    let k = 0.86 + 0.22 * n - 0.06 * streak + 0.035 * Math.sin(terr * 2.1 + a * 3);
    if (o.notch) { const da = Math.atan2(Math.sin(a - o.notch), Math.cos(a - o.notch)); k -= 0.07 * Math.exp(-(da * da) / 0.004); }
    k *= 1 + 0.1 * sstep(top - H * 0.08, top, y) * (n - 0.5);   // a ragged rim
    const r = cap ? rr0 * k : k;
    p.setXYZ(i, x / (rr0 || 1) * r * w, cap ? top + (n - 0.5) * 4 : y, z / (rr0 || 1) * r * d);
    // sandstone: pinkish-grey faces, black streaks where water runs, green on the top
    tmp.set('#b08070').lerp(col('#8a7a78'), n * 0.7).lerp(col('#3a3236'), sstep(0.55, 0.75, streak) * 0.75).lerp(col('#6a5a52'), sstep(top - 40, bottom, y) * 0.4);
    if (cap || y > top - 3) tmp.set('#4a7a32').lerp(col('#6a8a3a'), n);
    cl.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cl, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true })); m.position.set(cx, 0, cz); m.receiveShadow = true; scene.add(m);
  // tufts of jungle on top
  const tg = new THREE.IcosahedronGeometry(1, 0), trees = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true }), o.trees ?? 60);
  for (let k = 0; k < trees.count; k++) { const a = rand() * TAU, r = Math.sqrt(rand()) * 0.85, s = rr(4, 9) * (w / 150); dummy.position.set(cx + Math.cos(a) * r * w, top + 1, cz + Math.sin(a) * r * d); dummy.rotation.set(0, rand() * TAU, 0); dummy.scale.set(s, s * 0.7, s); dummy.updateMatrix(); trees.setMatrixAt(k, dummy.matrix); trees.setColorAt(k, col(pick(['#2f6a2a', '#3a7a30', '#24582a', '#4a8a3a']))); }
  scene.add(trees);
  return m;
}
const F = STAGE.falls;
// the falls leave from a notch in the rim that faces the stage
tepui(F.tepui[0], F.tepui[1], F.width, F.depth, F.top, F.bottom, { notch: PI / 2 + F.lip, trees: 120 });
for (const [x, z, w, d, h] of STAGE.tepuis) tepui(x, z, w, d, h - 40, STAGE.clouds.y - 60, { seg: 48, segY: 16, trees: 40 });

/* ---------------- the waterfall ---------------- */
const waterUniforms = { uT: { value: 0 }, uLight: { value: 1 } };
const lipPos = V3(F.tepui[0] + Math.cos(PI / 2 + F.lip) * F.width * 0.8, F.top - 2, F.tepui[1] + F.depth * 0.79);
{
  // a ribbon that falls from the lip, widening and drifting as it drops
  const N = 60, pos = [], uv = [], idx = [], drop = F.top - STAGE.clouds.y + 40;
  for (let k = 0; k <= N; k++) {
    const u = k / N, y = lipPos.y - u * drop, wdt = lerp(16, 70, Math.pow(u, 0.7)), out = Math.sin(u * PI * 0.5) * 30 + u * 10, dx = Math.sin(u * 3.0) * 8;
    for (const s of [-1, 1]) { pos.push(lipPos.x + dx + s * wdt / 2, y, lipPos.z + out + 2); uv.push(s < 0 ? 0 : 1, u); }
    if (k) { const i = (k - 1) * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { ...waterUniforms, ...THREE.UniformsLib.fog }, fog: true,
    vertexShader: 'varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader: `uniform float uT, uLight; varying vec2 vUv;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float x = vUv.x, y = vUv.y;
        float streak = n(vec2(x * 38.0, y * 3.0 - uT * 1.6)) * 0.6 + n(vec2(x * 90.0, y * 8.0 - uT * 2.6)) * 0.4;
        float edge = smoothstep(0.0, 0.18, x) * smoothstep(1.0, 0.82, x);
        float a = edge * (0.55 + 0.45 * streak) * (1.0 - smoothstep(0.75, 1.0, y)) * smoothstep(0.0, 0.02, y);
        a *= mix(1.0, 0.6 + 0.4 * n(vec2(x * 6.0, y * 2.0 - uT * 0.5)), smoothstep(0.2, 0.8, y));   // it turns to mist as it falls
        vec3 c = mix(vec3(0.82, 0.9, 0.95), vec3(1.0), streak) * uLight;
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const fall = new THREE.Mesh(geo, mat); fall.renderOrder = 3; scene.add(fall);
}
// spray and mist: soft sprites along the fall and a big cloud where it meets the sea of clouds
const mists = [];
{
  const mm = new THREE.SpriteMaterial({ map: softTex, color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
  for (let k = 0; k < 70; k++) { const u = rr(0.25, 1), s = new THREE.Sprite(mm); s.position.set(lipPos.x + rr(-40, 40) * u, lerp(lipPos.y, STAGE.clouds.y, u) + rr(-10, 10), lipPos.z + 18 + u * 40 + rr(-12, 12)); const sc = rr(30, 70) * (0.4 + u); s.scale.set(sc, sc * 0.7, 1); scene.add(s); mists.push({ s, y0: s.position.y, ph: rand() * TAU }); }
}
// a rainbow in the spray
const rainbow = (() => {
  const geo = new THREE.RingGeometry(92, 108, 96, 1, 0.12 * PI, 0.76 * PI);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0.3 } },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA; varying vec2 vP;
      vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){ float r = (length(vP) - 92.0) / 16.0, ang = atan(vP.y, vP.x) / 3.14159; float a = sin(r * 3.14159) * uA * smoothstep(0.12, 0.3, ang) * smoothstep(0.88, 0.7, ang); gl_FragColor = vec4(hue(0.82 - r * 0.82), a); }`,
  });
  const m = new THREE.Mesh(geo, mat); m.position.set(lipPos.x + 30, STAGE.clouds.y + 6, lipPos.z + 80); scene.add(m); return m;
})();

/* ---------------- the sea of clouds below, and big clouds drifting ---------------- */
const cloudUniforms = { uT: { value: 0 }, uC: { value: col('#ffffff') }, uS: { value: col('#a8c0d8') }, uSun: { value: V3(0, 1, 0) } };
{
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1).rotateX(-PI / 2), new THREE.ShaderMaterial({
    uniforms: { ...cloudUniforms, ...THREE.UniformsLib.fog }, fog: true,
    vertexShader: 'varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader: `uniform float uT; uniform vec3 uC, uS, uSun; varying vec3 vW;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++){ s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec2 p = vW.xz * 0.006 + vec2(uT * 0.004, 0.0);
        float c = fbm(p), c2 = fbm(p + vec2(0.03 * uSun.x, 0.03 * uSun.z));
        float lit = clamp(0.5 + (c - c2) * 6.0, 0.0, 1.0);
        vec3 col = mix(uS, uC, smoothstep(0.25, 0.75, c) * 0.6 + lit * 0.4);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  sea.position.y = STAGE.clouds.y; scene.add(sea);
}
const puffs = [];
{
  // puffy clouds: clusters of spheres, some below the stage, some far behind
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.12 });
  for (let k = 0; k < 22; k++) {
    const g = new THREE.Group(), n = 5 + ((rand() * 5) | 0), s = rr(4, 11);
    for (let j = 0; j < n; j++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), mat); b.scale.setScalar(s * rr(0.6, 1.1)); b.position.set((j - n / 2) * s * 0.9 + rr(-1, 1) * s * 0.3, rr(-0.2, 0.5) * s, rr(-0.4, 0.4) * s); g.add(b); }
    const far = rand() < 0.55;
    g.position.set(rr(-260, 260), far ? rr(30, 140) : rr(STAGE.clouds.y + 4, -22), far ? rr(-520, -240) : rr(-160, -40));
    scene.add(g); puffs.push({ g, sp: rr(1, 3) * (rand() < 0.5 ? 1 : -1) });
  }
  cloudUniforms.uCloudMat = mat;
}

/* ---------------- guacamayas, morpho butterflies, fireflies ---------------- */
const birds = [];
{
  for (let f = 0; f < 2; f++) {
    const n = 3 + f, flock = { birds: [], c: V3(rr(-80, 80), rr(10, 40), rr(-120, -50)), r: rr(70, 140), sp: rr(0.06, 0.1) * (f % 2 ? 1 : -1), ph: rand() * TAU };
    for (let k = 0; k < n; k++) {
      const g=placeAsset(scene,scarletMacaw({seed:900+f*10+k,detail:'low'}),{scale:1.6,id:'scarlet-macaw'});
      flock.birds.push({ g, off: V3((k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3, rr(-1, 1), -Math.ceil(k / 2) * 2.4), ph: rand() * TAU });
    }
    birds.push(flock);
  }
}
const butterflies = [];
for (let k = 0; k < 6; k++) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: '#2a8aff', emissive: '#1a50c0', emissiveIntensity: 0.6, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.4 });
  const wings = []; for (const s of [-1, 1]) { const pv = new THREE.Group(); g.add(pv); const w = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12).scale(1, 0.75, 1).translate(s * 0.26, 0, 0), m); w.rotation.x = -PI / 2; pv.add(w); wings.push({ pv, s }); }
  scene.add(g); butterflies.push({ g, wings, c: V3(rr(-18, 18), rr(2, 9), rr(-6, -2)), ph: rand() * TAU, sp: rr(0.3, 0.6) });
}
const fireflies = (() => {
  const n = 120, geo = new THREE.BufferGeometry(), p = new Float32Array(n * 3), base = [];
  for (let k = 0; k < n; k++) { const b = V3(rr(-30, 30), rr(-6, 14), rr(-10, 4)); base.push(b); p.set([b.x, b.y, b.z], k * 3); }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTex, color: col('#c8ff7a').multiplyScalar(3), size: 0.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  m.frustumCulled = false; scene.add(m); return { m, base };
})();

/* ---------------- the zones overlay (for building the game) ---------------- */
/* ---------------- moving parts: where the curiara is at time t (also for the game) ---------------- */
const C = STAGE.moving;
const curiaraAt = t => { const a = Math.sin(t / C.period * TAU); return { x: a * C.swing, y: C.y + (1 - Math.cos(a * 0.9)) * 1.6, tilt: -a * 0.12, x0: a * C.swing - C.width / 2, x1: a * C.swing + C.width / 2 }; };

function applyLook(L) {
  sun.position.copy(L.dir).multiplyScalar(120); sun.target.position.set(0, 0, 0); sun.color.copy(L.sunC); sun.intensity = L.sunI;
  hemi.color.copy(L.hemiS); hemi.groundColor.copy(L.hemiG); hemi.intensity = L.hemiI;
  const u = sky.material.uniforms; u.uTop.value.copy(L.top); u.uHor.value.copy(L.hor); u.uSunC.value.copy(L.sunC); u.uSun.value.copy(L.dir); u.uStars.value = L.stars; u.uMoon.value = L.night;
  parent.fog.color.copy(L.fog); cloudUniforms.uC.value.copy(L.cloud); cloudUniforms.uS.value.copy(L.cloudShade); cloudUniforms.uSun.value.copy(L.dir);
  cloudUniforms.uCloudMat.color.copy(L.cloud); cloudUniforms.uCloudMat.emissive.copy(L.cloudShade); cloudUniforms.uCloudMat.emissiveIntensity = 0.35;
  waterUniforms.uLight.value = L.fall; rainbow.material.uniforms.uA.value = 0.32 * L.rainbow; rainbow.visible = L.rainbow > 0.02;
  renderer.toneMappingExposure = L.exp; fireflies.m.material.opacity = L.night;
  torches.forEach(t => { t.flame.visible = L.night > 0.1; t.light.intensity = 40 * L.night; });
  mists.forEach(m => m.s.material.color.copy(L.cloud));
}
applyLook(look);

function step(t, dt) {
  tickWind(t);
  if (timeT < 1) { timeT = Math.min(1, timeT + dt / 2.5); Object.assign(look, blendLook(timeFrom, timeTo, sstep(0, 1, timeT))); applyLook(look); }
  waterUniforms.uT.value = t; cloudUniforms.uT.value = t;
  // the curiara swings; its vines run up out of view
  const cu = curiaraAt(t); curiara.g.position.set(cu.x, cu.y, 0); curiara.g.rotation.z = 0;
  curiara.vines.forEach(({ v, s }) => { const foot = V3(s * (C.width / 2 - 1), 0.1, 0), topW = V3(s * (C.width / 2 - 1) * 0.6, 60, 0); topW.sub(curiara.g.position); const d = topW.clone().sub(foot); v.position.copy(foot); v.scale.set(1, d.length(), 1); v.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); });
  curiara.leaves.forEach(({ l, s, k }) => { const v = curiara.vines[s < 0 ? 0 : 1].v, along = V3(0, 1, 0).applyQuaternion(v.quaternion); l.position.copy(v.position).addScaledVector(along, 1.2 + k * 1.3).add(V3(s * 0.25, 0, 0.1)); l.rotation.set(0.3, 0, s * (0.8 + Math.sin(t * 2 + k) * 0.2)); });



  roots.forEach(r => (r.m.rotation.z = Math.sin(t * 0.7 + r.ph) * 0.06));
  torches.forEach(tr => { const f = 0.85 + 0.15 * Math.sin(t * 13 + tr.ph) + 0.1 * Math.sin(t * 29 + tr.ph); tr.flame.scale.set(f, f * (1 + 0.1 * Math.sin(t * 9)), 1); tr.flame.lookAt(camera.position); tr.light.intensity = 40 * look.night * f; });
  mists.forEach(m => { m.s.position.y = m.y0 + Math.sin(t * 0.3 + m.ph) * 2; m.s.material.rotation = t * 0.02; });
  puffs.forEach(p => { p.g.position.x += p.sp * dt; if (p.g.position.x > 320) p.g.position.x = -320; if (p.g.position.x < -320) p.g.position.x = 320; });
  birds.forEach(f => { const a = f.ph + t * f.sp, c = V3(f.c.x + Math.cos(a) * f.r, f.c.y + Math.sin(t * 0.4 + f.ph) * 5, f.c.z + Math.sin(a) * f.r * 0.5), ah = V3(f.c.x + Math.cos(a + 0.02 * Math.sign(f.sp)) * f.r, c.y, f.c.z + Math.sin(a + 0.02 * Math.sign(f.sp)) * f.r * 0.5), fwd = ah.clone().sub(c).normalize(), side = V3(-fwd.z, 0, fwd.x);
    f.birds.forEach(b => { b.g.position.copy(c).addScaledVector(side, b.off.x).addScaledVector(fwd, b.off.z).add(V3(0, b.off.y, 0)); b.g.lookAt(b.g.position.clone().add(fwd)); b.g.userData.tick(t); }); });
  butterflies.forEach(b => { const p = b.c.clone().add(V3(Math.sin(t * b.sp + b.ph) * 4, Math.sin(t * b.sp * 1.7 + b.ph) * 1.5, Math.cos(t * b.sp * 1.3 + b.ph) * 1.2)), q = b.c.clone().add(V3(Math.sin((t + 0.1) * b.sp + b.ph) * 4, 0, Math.cos((t + 0.1) * b.sp * 1.3 + b.ph) * 1.2)); b.g.position.copy(p); b.g.lookAt(q.setY(p.y)); b.wings.forEach(w => (w.pv.rotation.z = w.s * (0.2 + Math.abs(Math.sin(t * 14 + b.ph)) * 1.1))); });
  { const pa = fireflies.m.geometry.attributes.position; fireflies.base.forEach((b, k) => pa.setXYZ(k, b.x + Math.sin(t * 0.5 + k) * 1.5, b.y + Math.sin(t * 0.7 + k * 1.3) * 1.0, b.z + Math.cos(t * 0.4 + k) * 1.2)); pa.needsUpdate = true; fireflies.m.material.size = 0.45 + 0.2 * Math.sin(t * 3); }

}

return { frame: step, dispose() { scene.traverse(o=>o.shadow?.dispose()); disposeModel(scene); ownedTextures.forEach(t=>t.dispose()); scene.removeFromParent(); } };
}
