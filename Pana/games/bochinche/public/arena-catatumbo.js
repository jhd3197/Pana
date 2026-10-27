import { fishingBoat, fishCrates, fishingNetRack } from '/engine/models/props/coastal.js';
import { mangrove } from '/engine/models/vegetation/mangrove.js';
import { createAssetPlacement, PI, TAU, V3, col, clamp, lerp, sstep, stageRandom } from './arena-assets.js';
import { tickWind } from '/engine/models/vegetation/plant-kit.js';
import * as THREE from 'three';
import { canvasTexture } from '/engine/models/core/primitives.js';
import { disposeModel } from '/engine/models/props/game-table.js';
export function createArena(parent, renderer, camera) {
const ownedTextures=[];
const placeAsset=createAssetPlacement();
const scene = new THREE.Group(); scene.scale.setScalar(.42); parent.add(scene);
scene.fog = parent.fog;
const small = true, reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const STAGE = {
  name: 'Catatumbo',
  seed: 20261030,
  main: { x: [-23, 23], y: 0, depth: 9, ledges: true },
  soft: [
    { id: 'techo-izq', x: [-18, -8], y: 7.5 },      // the porch roofs of the two stilt houses
    { id: 'techo-der', x: [8, 18], y: 7.5 },
    { id: 'mirador', x: [-4.5, 4.5], y: 14 },       // the lookout on its pole in the middle
  ],
  water: { y: -3.2 },
  // the stage hazard: a lightning strike on the dock. A mark glows for `warn` seconds, then the bolt hits a `width`-wide strip.
  // The strike times and spots are a fixed sequence (a pure function of time), so every player sees the same storm.
  hazard: { every: { calma: 0, normal: 11, tormenta: 5.5 }, warn: 1.6, width: 6, spots: [9, -3, 17, -14, 3, -19, 13, -9, 0, 20, -16, 6], damage: 18, launch: 70 },
  // a fishing lancha that putters past behind the dock now and then (scenery only)
  spawns: [[-12, 0], [12, 0], [-4, 0], [4, 0]],
  respawn: [0, 24],
  blast: { x: [-60, 60], y: [-26, 52] },
  camera: { pos: [0, 8.5, 58], look: [0, 5.5, 0], fov: 32 },
};

/* ---------------- basics ---------------- */
const { rand, rr, pick } = stageRandom(STAGE.seed);
const canvasTex = (w, h, draw) => canvasTexture(w, h, draw, { owned: ownedTextures });
const softTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
const ribbonTex = canvasTex(64, 4, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });

/* ---------------- light: moonlight, the warm lanterns, and the lightning flashes ---------------- */
const moon = new THREE.DirectionalLight('#8a9cff', 0.55); moon.position.set(-30, 60, 40); moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 40, bottom: -30, near: 10, far: 200 }); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.05;
scene.add(moon);
const hemi = new THREE.HemisphereLight('#4a4a9a', '#1a1424', 0.75); scene.add(hemi);
// the flash: a cold light from the storm clouds behind the stage
const flashLight = new THREE.DirectionalLight('#c8b8ff', 0);   // Brightened by every flash.
flashLight.position.set(20,80,-120); scene.add(flashLight);
const strikeLight = new THREE.PointLight('#e0d8ff', 0, 60, 1.4); scene.add(strikeLight);

/* ---------------- sky: night, a violet glow on the horizon, lit from inside by the storm ---------------- */
const skyU = { uFlash: { value: 0 }, uFlashX: { value: 0.3 }, uT: { value: 0 } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(6000, 48, 24), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
  fragmentShader: `uniform float uFlash, uFlashX, uT; varying vec3 vD;
    float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++){ s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
    void main(){
      vec3 d = normalize(vD); float h = clamp(d.y, -0.2, 1.0);
      vec3 c = mix(vec3(0.16, 0.08, 0.2), vec3(0.03, 0.03, 0.1), smoothstep(0.0, 0.5, h));
      c += vec3(0.25, 0.1, 0.3) * exp(-max(h, 0.0) * 10.0) * 0.6;                         // violet haze over the lake
      vec3 q = floor(d * 420.0); c += vec3(0.9, 0.92, 1.0) * step(0.9972, hash(q)) * smoothstep(0.3, 0.6, h) * (0.4 + 0.6 * hash(q + 3.0));
      // the storm: a wall of cloud behind the lake, flickering from inside
      float az = atan(d.x, -d.z), cl = fbm(vec2(az * 3.0, h * 6.0) + vec2(uT * 0.01, 0.0));
      float band = smoothstep(0.0, 0.05, h) * (1.0 - smoothstep(0.18, 0.42, h + cl * 0.15));
      float glow = exp(-pow((az - uFlashX) * 2.2, 2.0)) * uFlash;
      vec3 cloud = mix(vec3(0.07, 0.05, 0.12), vec3(0.85, 0.75, 1.0), clamp(glow * (0.5 + cl), 0.0, 1.0));
      c = mix(c, cloud, band * smoothstep(0.35, 0.65, cl + 0.15));
      c += vec3(0.5, 0.4, 0.8) * glow * 0.12;
      c = pow(c, vec3(2.0));   // the colours above are picked as they look on screen; turn them into light
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

/* ---------------- the lake ---------------- */
const waterU = { uT: { value: 0 }, uFlash: { value: 0 } };
{
  const water = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000, 1, 1).rotateX(-PI / 2), new THREE.ShaderMaterial({
    uniforms: { ...waterU, ...THREE.UniformsLib.fog }, fog: true, transparent: true,
    vertexShader: 'varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vW = (modelMatrix * vec4(position, 1.0)).xyz; vec4 mvPosition = viewMatrix * vec4(vW, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
    fragmentShader: `uniform float uT, uFlash; varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        float a = sin(vW.x * 0.35 + uT * 1.1 + sin(vW.z * 0.2) * 2.0) * sin(vW.z * 0.5 - uT * 0.9) + 0.5 * sin(vW.x * 1.1 - uT * 1.7) * sin(vW.z * 0.9 + uT * 1.3);
        vec3 N = normalize(vec3(a * 0.08, 1.0, a * 0.06)), V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 c = mix(vec3(0.02, 0.03, 0.06), vec3(0.18, 0.12, 0.3), fr);
        c += vec3(0.7, 0.6, 1.0) * uFlash * (0.25 + fr * 0.9);
        // the lanterns' warm streaks on the water under the dock
        float lamp = exp(-pow(vW.z - 2.0, 2.0) * 0.004) * (0.5 + 0.5 * sin(vW.x * 0.6 + a * 3.0)) * smoothstep(40.0, 10.0, abs(vW.x));
        c += vec3(1.0, 0.55, 0.2) * lamp * 0.18 * (0.6 + 0.4 * a);
        c = pow(c, vec3(1.8));
        gl_FragColor = vec4(c, 0.96);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  water.position.y = STAGE.water.y; scene.add(water);
}

/* ---------------- the dock: planks on stilts ---------------- */
const stage = new THREE.Group(); stage.name = 'escenario'; scene.add(stage);
const M = STAGE.main, halfW = (M.x[1] - M.x[0]) / 2, halfD = M.depth / 2;
const plankTex = canvasTex(512, 256, (c, w, h) => {
  for (let y = 0; y < h; y += 16) { c.fillStyle = `rgb(${(128 + rr(-18, 18)) | 0},${(88 + rr(-12, 12)) | 0},${(56 + rr(-10, 10)) | 0})`; c.fillRect(0, y, w, 15); c.fillStyle = 'rgba(20,10,4,0.75)'; c.fillRect(0, y + 15, w, 1); for (let k = 0; k < 5; k++) { c.fillStyle = 'rgba(40,22,10,0.3)'; c.fillRect(rand() * w, y + rr(2, 12), rr(30, 90), 1); } const j = rr(0, w); c.fillStyle = 'rgba(20,10,4,0.7)'; c.fillRect(j, y, 2, 15); c.fillStyle = '#2a2a2a'; c.fillRect(j + 5, y + 6, 3, 3); c.fillRect(j - 8, y + 6, 3, 3); }
});
const woodM = new THREE.MeshStandardMaterial({ color: '#7a5034', roughness: 0.85 }), darkWood = new THREE.MeshStandardMaterial({ color: '#4a3020', roughness: 0.9 });
{
  plankTex.repeat.set(halfW * 2 / 8, 1);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.6, halfD * 2), [darkWood, darkWood, new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85 }), darkWood, darkWood, darkWood]);
  deck.position.y = -0.3; deck.castShadow = true; deck.receiveShadow = true; stage.add(deck);
  // beams under the deck, and stilts down into the water
  for (const z of [-halfD + 0.4, 0, halfD - 0.4]) { const b = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 0.6, 0.6, 0.5), darkWood); b.position.set(0, -0.9, z); b.castShadow = true; stage.add(b); }
  for (let x = -halfW + 0.5; x <= halfW - 0.4; x += 3.3) for (const z of [-halfD + 0.5, halfD - 0.5]) { const h = 9; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, h, 8), darkWood); p.position.set(x + rr(-0.2, 0.2), -h / 2 - 0.3, z); p.rotation.z = rr(-0.04, 0.04); p.castShadow = true; stage.add(p); }
  // diagonal braces
  for (let x = -halfW + 2; x < halfW - 2; x += 6.6) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.6, 0.18), darkWood); br.position.set(x + 1.6, -2.6, halfD - 0.5); br.rotation.z = 0.75; stage.add(br); }
  // posts and a rope rail at the back edge only (the front and the ends stay open for the ledges)
  for (let x = -halfW + 1; x <= halfW - 1; x += 3.3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.4, 6), darkWood); p.position.set(x, 0.7, -halfD + 0.3); stage.add(p); }
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, halfW * 2 - 2, 6), new THREE.MeshStandardMaterial({ color: '#c8a870' })); rope.rotation.z = PI / 2; rope.position.set(0, 1.3, -halfD + 0.3); stage.add(rope);
}

/* ---------------- the two stilt houses behind the dock, their porch roofs are the soft platforms ---------------- */
const lanterns = [];
function palafito(cx, wall, trim) {
  const g = new THREE.Group(); g.position.x = cx; stage.add(g);
  const w = 10, d = 6, h = 6.2, z = -halfD - d / 2 + 1.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: wall, roughness: 0.8 })); body.position.set(0, h / 2, z); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // clapboard lines
  for (let y = 0.5; y < h; y += 0.55) { const l = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.06, 0.04), new THREE.MeshStandardMaterial({ color: col(wall).multiplyScalar(0.7) })); l.position.set(0, y, z + d / 2 + 0.01); g.add(l); }
  // door and windows, lit warm from inside
  const lit = new THREE.MeshBasicMaterial({ color: col('#ffb860').multiplyScalar(1.6), toneMapped: false });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.8), lit); door.position.set(-2.4, 1.4, z + d / 2 + 0.02); g.add(door);
  for (const x of [1.0, 3.4]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.3), lit); win.position.set(x, 3.0, z + d / 2 + 0.02); g.add(win); const sh = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.12), new THREE.MeshStandardMaterial({ color: trim })); sh.position.set(x, 3.75, z + d / 2 + 0.06); g.add(sh); }
  const frame = new THREE.MeshStandardMaterial({ color: trim, roughness: 0.6 });
  for (const [x, y, sx, sy] of [[-2.4, 2.9, 1.8, 0.16], [-3.2, 1.4, 0.16, 2.9], [-1.6, 1.4, 0.16, 2.9]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, 0.1), frame); f.position.set(x, y, z + d / 2 + 0.05); g.add(f); }
  // the house roof, corrugated tin
  const tin = canvasTex(256, 64, (c, w2, h2) => { for (let x = 0; x < w2; x++) { const v = 150 + 50 * Math.sin(x * 0.5); c.fillStyle = `rgb(${v},${v - 6},${v - 14})`; c.fillRect(x, 0, 1, h2); } for (let k = 0; k < 30; k++) { c.fillStyle = 'rgba(140,70,30,0.25)'; c.fillRect(rand() * w2, rand() * h2, rr(4, 14), rr(4, 20)); } });
  const roofM = new THREE.MeshStandardMaterial({ map: tin, roughness: 0.55, metalness: 0.5, side: THREE.DoubleSide });
  for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.PlaneGeometry(w + 1, d / 2 + 0.9), roofM); r.position.set(0, h + 1.1, z + s * (d / 4 + 0.1)); r.rotation.x = -PI / 2 + s * 0.55; r.castShadow = true; g.add(r); }
  const gable = new THREE.Shape(); gable.moveTo(-d / 2, 0); gable.lineTo(d / 2, 0); gable.lineTo(0, 2.2); gable.closePath();
  for (const s of [-1, 1]) { const gm = new THREE.Mesh(new THREE.ShapeGeometry(gable), new THREE.MeshStandardMaterial({ color: wall, side: THREE.DoubleSide })); gm.rotation.y = PI / 2; gm.position.set(s * w / 2, h, z); g.add(gm); }
  // the porch: a flat tin roof on four posts, reaching over the dock; its top is the soft platform (y = 7.5)
  const P = new THREE.Group(); g.add(P);
  const pr = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 4.4), roofM); pr.position.set(0, 7.35, -0.4); pr.castShadow = true; pr.receiveShadow = true; P.add(pr);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(10.1, 0.5, 0.14), frame); fascia.position.set(0, 7.1, 1.85); P.add(fascia);
  for (const x of [-4.6, 4.6]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.2, 0.3), woodM); post.position.set(x, 3.6, -2.2); post.castShadow = true; P.add(post); }
  // a hammock on the porch, and a string of bulbs along the fascia
  const ham = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 4.2, 14, 1, true, PI, PI), new THREE.MeshStandardMaterial({ color: pick(['#e0263a', '#2a8ad8', '#ffd23a']), side: THREE.DoubleSide, roughness: 0.9 })); ham.rotation.z = PI / 2; ham.position.set(0, 3.6, -2.4); ham.castShadow = true; g.add(ham);
  for (let k = 0; k <= 10; k++) { const x = -4.8 + k * 0.96, y = 6.7 - Math.sin(k / 10 * PI) * 0.35; const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: col(pick(['#ffd890', '#ff8a5a', '#8ad8ff', '#ffe0a0'])).multiplyScalar(2.5), toneMapped: false })); b.position.set(x, y, 1.9); g.add(b); lanterns.push({ b, ph: rand() * TAU, base: b.material.color.clone() }); }
  // a lamp in the porch, which lights the fighters a little
  const lamp = new THREE.PointLight('#ffb060', 28, 20, 1.6); lamp.position.set(0, 6.2, 0); g.add(lamp);
  // stilts under the house
  for (const x of [-4.6, 0, 4.6]) for (const zz of [z - d / 2 + 0.3, z + d / 2 - 0.3]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 9, 8), darkWood); p.position.set(x, -4.5, zz); g.add(p); }
  return g;
}
palafito(-13, '#3aa0c8', '#ffd23a');
palafito(13, '#e8607a', '#ffffff');

/* ---------------- the lookout in the middle: a high platform on a pole ---------------- */
{
  const g = new THREE.Group(); stage.add(g);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(9, 0.45, 3.6), new THREE.MeshStandardMaterial({ map: plankTex.clone(), roughness: 0.85 })); plat.material.map.repeat.set(1.2, 0.6); plat.material.map.needsUpdate = true; plat.position.set(0, 13.78, -0.4); plat.castShadow = true; plat.receiveShadow = true; g.add(plat);
  for (const x of [-1.2, 1.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 14, 8), darkWood); p.position.set(x, 6.8, -2.6); p.castShadow = true; g.add(p); }
  for (const s of [-1, 1]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.4, 0.16), darkWood); br.position.set(s * 2.4, 12.2, -2.4); br.rotation.z = s * 0.75; g.add(br); }
  // a big fishing net hung between the poles, and an oil lantern on top
  const net = canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(220,210,180,0.9)'; c.lineWidth = 2; for (let k = 0; k <= 8; k++) { c.beginPath(); c.moveTo(k * 16, 0); c.lineTo(k * 16 + 8, h); c.stroke(); c.beginPath(); c.moveTo(0, k * 16); c.lineTo(w, k * 16 + 4); c.stroke(); } });
  const nm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 9, 4, 8), new THREE.MeshStandardMaterial({ map: net, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }));
  { const p = nm.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 0.7) * 0.25); nm.geometry.computeVertexNormals(); }
  nm.position.set(0, 7.5, -2.6); g.add(nm);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 8), new THREE.MeshBasicMaterial({ color: col('#ffb860').multiplyScalar(3), toneMapped: false })); lamp.position.set(3.8, 14.6, -1.8); g.add(lamp);
  lanterns.push({ b: lamp, ph: 0.5, base: lamp.material.color.clone() });
  const pl = new THREE.PointLight('#ffb060', 22, 16, 1.6); pl.position.set(3.8, 15, -1.2); g.add(pl);
}

/* ---------------- props on the dock: a curiara tied up, buckets, crates, nets, a cat? no, a pelican ---------------- */
{
  placeAsset(stage,fishCrates(),{at:[-20,0,-3.3],id:'fish-crates'});
  placeAsset(stage,fishCrates(),{at:[19.5,0,-3.3],scale:.8,yaw:1.2,id:'fish-crates'});
  placeAsset(stage,fishingNetRack(),{at:[-6,0,-3.9],scale:.85,id:'fishing-net-rack'});
  for (const [x, c] of [[-6, '#e0263a'], [-5.2, '#ffd23a'], [21, '#3ab04a']]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.7, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })); b.position.set(x, 0.35, -3.6); b.castShadow = true; stage.add(b); }
  // the pelican on a post at the right end
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.2, 8), darkWood); post.position.set(22.3, 0.6, 3.6); stage.add(post);
  const pel = new THREE.Group(); pel.position.set(22.3, 1.75, 3.6); pel.rotation.y = -1.2; stage.add(pel);
  const pm = new THREE.MeshStandardMaterial({ color: '#d8d0c4', roughness: 0.8 });
  const pb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), pm); pb.scale.set(0.8, 0.9, 1.3); pb.position.y = 0.4; pel.add(pb);
  const pn = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.7, 8), pm); pn.position.set(0, 0.95, 0.35); pn.rotation.x = -0.2; pel.add(pn);
  const ph = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), pm); ph.position.set(0, 1.3, 0.4); pel.add(ph);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.8, 6), new THREE.MeshStandardMaterial({ color: '#e8a040' })); beak.rotation.x = PI / 2 + 0.3; beak.position.set(0, 1.18, 0.82); pel.add(beak);
  stage.userData.pelican = pel;
  // a curiara tied to the front of the dock, bobbing
  const cur = new THREE.Group(); scene.add(cur); stage.userData.curiara = cur;
  placeAsset(cur,fishingBoat({color:0x377d9a}),{at:[0,0,0],yaw:PI/2,id:'fishing-boat'});
  cur.position.set(-8,STAGE.water.y-.32,halfD+2.6);

}

// Rooted mangrove islets frame the lake without blocking the dock or storm.
for(const [k,x,z] of [[0,-44,-32],[1,-51,-38],[2,47,-35],[3,55,-43]])
  placeAsset(scene,mangrove({seed:710+k,scale:1.7,detail:'game'}),{at:[x,STAGE.water.y-.5,z],yaw:k,id:'mangrove'});

/* ---------------- the lake around: other palafitos, the bridge, gas flares on the oil platforms ---------------- */
const flares = [];
{
  const WALLS = ['#3aa0c8', '#e8607a', '#ffd23a', '#7ac85a', '#f2f2e8', '#c87ad8', '#ff8a3a'];
  for (let k = 0; k < 26; k++) {
    const side = k % 2 ? 1 : -1, x = side * rr(40, 260), z = rr(-260, -30), w = rr(6, 11), h = rr(4, 6);
    const g = new THREE.Group(); g.position.set(x, STAGE.water.y, z); scene.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.7), new THREE.MeshStandardMaterial({ color: pick(WALLS), roughness: 0.85 })); body.position.y = 3.5 + h / 2; g.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 2, 4), new THREE.MeshStandardMaterial({ color: '#8a8a8e', metalness: 0.4, roughness: 0.6 })); roof.rotation.y = PI / 4; roof.scale.z = 0.7; roof.position.y = 3.5 + h + 1; g.add(roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.6, 6), darkWood); p.position.set(sx * w * 0.4, 1.8, sz * w * 0.28); g.add(p); }
    if (rand() < 0.7) { const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.1), new THREE.MeshBasicMaterial({ color: col('#ffb860').multiplyScalar(2), toneMapped: false })); win.position.set(rr(-w / 4, w / 4), 3.5 + h * 0.55, w * 0.35 + 0.02); g.add(win); }
  }
  // the long bridge across the lake far away, its lamps a line of dots
  const bz = -1500, lampsGeo = [];
  for (let x = -2600; x <= 2600; x += 26) { const y = 18 + 70 * Math.exp(-Math.pow(x / 700, 2)); lampsGeo.push(x, y, bz); }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(lampsGeo, 3));
  scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ map: softTex, color: col('#ffd890').multiplyScalar(3), size: 14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  const deckPts = []; for (let x = -2600; x <= 2600; x += 40) { const y = 16 + 70 * Math.exp(-Math.pow(x / 700, 2)); deckPts.push(V3(x, y, bz)); }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(deckPts), new THREE.LineBasicMaterial({ color: '#2a2a40' })));
  for (const px of [-900, -300, 300, 900]) { const p = new THREE.Mesh(new THREE.BoxGeometry(14, 160, 14), new THREE.MeshBasicMaterial({ color: '#141428' })); p.position.set(px, 60, bz); scene.add(p); const r = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: col('#ff3a3a').multiplyScalar(3), toneMapped: false })); r.position.set(px, 144, bz); scene.add(r); flares.push({ m: r, ph: px * 0.01, blink: true }); }
  // oil platforms with gas flares, reflected in the lake
  for (const [x, z] of [[-420, -620], [520, -780], [-900, -1100], [160, -980]]) {
    const g = new THREE.Group(); g.position.set(x, STAGE.water.y, z); scene.add(g);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(40, 6, 30), new THREE.MeshStandardMaterial({ color: '#2a2a34', roughness: 0.7 })); deck.position.y = 16; g.add(deck);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 16, 8), deck.material); l.position.set(sx * 16, 8, sz * 11); g.add(l); }
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1, 2, 40, 6), deck.material); tower.position.set(12, 39, 0); g.add(tower);
    for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 4), new THREE.MeshBasicMaterial({ color: col('#fff2c0').multiplyScalar(2.5), toneMapped: false })); l.position.set(rr(-18, 18), 20, rr(-14, 14)); g.add(l); }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(10, 18), new THREE.MeshBasicMaterial({ map: softTex, color: col('#ff8a2a').multiplyScalar(4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); fl.position.set(12, 66, 0); g.add(fl);
    const refl = new THREE.Mesh(new THREE.PlaneGeometry(14, 90), new THREE.MeshBasicMaterial({ map: ribbonTex, color: col('#ff8a2a').multiplyScalar(0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); refl.rotation.x = -PI / 2; refl.position.set(12, 0.2, 50); g.add(refl);
    flares.push({ m: fl, ph: rand() * TAU });
  }
}

/* ---------------- fireflies, moths round the lamps, fish jumping ---------------- */
const fireflies = (() => {
  const n = 140, geo = new THREE.BufferGeometry(), p = new Float32Array(n * 3), base = [];
  for (let k = 0; k < n; k++) { const b = V3(rr(-40, 40), rr(-2, 16), rr(-14, 8)); base.push(b); p.set([b.x, b.y, b.z], k * 3); }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(geo, new THREE.PointsMaterial({ map: softTex, color: col('#c8ff7a').multiplyScalar(3), size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.frustumCulled = false; scene.add(m); return { m, base };
})();
const splashes = [];
const fishMat = new THREE.MeshStandardMaterial({ color: '#c8c8d8', metalness: 0.6, roughness: 0.3 });
const fish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), fishMat); fish.scale.set(0.5, 0.6, 1.6); fish.visible = false; scene.add(fish);
let fishT = 3, fishFrom = V3(), fishV = V3();

/* ---------------- lightning: bolts in the distant storm, and the strikes on the dock ---------------- */
function jagged(a, b, rough, depth = 6) {
  let pts = [a, b];
  for (let d = 0; d < depth; d++) { const out = [pts[0]]; for (let k = 0; k < pts.length - 1; k++) { const p = pts[k], q = pts[k + 1], m = p.clone().lerp(q, 0.5), len = p.distanceTo(q), n = V3(-(q.y - p.y), q.x - p.x, 0).normalize(); m.addScaledVector(n, rr(-1, 1) * len * rough); m.z += rr(-1, 1) * len * rough * 0.3; out.push(m, q); } pts = out; }
  return pts;
}
function ribbon(pts, width) {
  const pos = [], uv = [], idx = [];
  pts.forEach((p, k) => { const q = pts[Math.min(k + 1, pts.length - 1)], o = pts[Math.max(k - 1, 0)], t = q.clone().sub(o).normalize(), n = V3(-t.y, t.x, 0).multiplyScalar(width / 2); pos.push(p.x - n.x, p.y - n.y, p.z, p.x + n.x, p.y + n.y, p.z); uv.push(0, k, 1, k); if (k) { const i = (k - 1) * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
const bolts = [];
function bolt(a, b, o = {}) {
  const g = new THREE.Group(); scene.add(g);
  const mk = (w, c, k) => { const all = [jagged(a, b, o.rough ?? 0.2, o.depth ?? 7)]; for (let j = 0; j < (o.branches ?? 3); j++) { const s = all[0][(rr(0.15, 0.7) * all[0].length) | 0], dir = b.clone().sub(a).normalize(); all.push(jagged(s, s.clone().add(V3(dir.x + rr(-1.4, 1.4), dir.y * rr(0.3, 0.8), 0).normalize().multiplyScalar(a.distanceTo(b) * rr(0.15, 0.35))), 0.3, 5)); }
    all.forEach((pts, j) => { const m = new THREE.Mesh(ribbon(pts, w * (j ? 0.45 : 1)), new THREE.MeshBasicMaterial({ color: col(c).multiplyScalar(k), map: ribbonTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide })); g.add(m); }); };
  mk(o.width * 3, o.color || '#a890ff', 1.6); mk(o.width, '#ffffff', 5);
  bolts.push({ g, t: 0, life: o.life ?? 0.35 });
}
let flash = 0, flashX = 0.3;
const strikeMarks = [];   // the glowing warnings on the dock
const markMat = () => new THREE.MeshBasicMaterial({ map: softTex, color: col('#b8a0ff').multiplyScalar(2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const scorch = canvasTex(256, 256, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(10,6,4,0.9)'); g.addColorStop(0.5, 'rgba(20,12,6,0.5)'); g.addColorStop(1, 'rgba(20,12,6,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(8,4,2,0.8)'; c.lineWidth = 3; for (let k = 0; k < 9; k++) { let x = w / 2, y = h / 2, a = k / 9 * TAU; c.beginPath(); c.moveTo(x, y); for (let j = 0; j < 6; j++) { a += rr(-0.5, 0.5); x += Math.cos(a) * 16; y += Math.sin(a) * 16; c.lineTo(x, y); } c.stroke(); } });
const scorches = [];
// the strike schedule: a pure function of time, so the game can ask what is coming
let storm = 'normal';
const H = STAGE.hazard;
function strikeAt(t) { const every = H.every[storm]; if (!every) return null; const n = Math.floor(t / every), t0 = n * every, x = H.spots[n % H.spots.length]; return { n, x, warnFrom: t0 + every - H.warn, hitAt: t0 + every, x0: x - H.width / 2, x1: x + H.width / 2 }; }
let lastStrike = -1, distantNext = 1.2;
const sparkGeo = new THREE.BufferGeometry(), SN = 400, sp = new Float32Array(SN * 3), sv = new Float32Array(SN * 3), sl = new Float32Array(SN);
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const sparkPts = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: softTex, color: col('#e8e0ff').multiplyScalar(3), size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); sparkPts.frustumCulled = false; scene.add(sparkPts);
let sparkI = 0;
const sparkBurst = (at, n, sp0) => { for (let k = 0; k < n; k++) { const j = sparkI; sparkI = (sparkI + 1) % SN; sp.set([at.x, at.y, at.z], j * 3); const a = rr(0, TAU), u = rr(0.2, 1); sv.set([Math.cos(a) * sp0 * rr(0.3, 1), u * sp0, Math.sin(a) * sp0 * 0.5], j * 3); sl[j] = rr(0.4, 0.9); } };

let shake = 0;
function step(t, dt) {
  tickWind(t);
  skyU.uT.value = t; waterU.uT.value = t;
  // distant lightning: the Catatumbo never stops
  const rate = { calma: 2.6, normal: 1.6, tormenta: 0.8 }[storm];
  if (t > distantNext) {
    distantNext = t + rr(rate * 0.4, rate * 1.6);
    const az = rr(-0.9, 1.1), r = rr(900, 1600), x = Math.sin(az) * r, z = -Math.cos(az) * r, top = V3(x, rr(220, 380), z), bot = V3(x + rr(-80, 80), rand() < 0.6 ? 0 : rr(60, 160), z);
    bolt(top, bot, { width: rr(4, 9), life: rr(0.18, 0.4), branches: 3, color: pick(['#b090ff', '#ff90d8', '#90b0ff']) });
    flash = Math.max(flash, rr(0.5, 1)); flashX = az;
  }
  // the strike on the dock
  const S = strikeAt(t);
  if (S) {
    if (t >= S.warnFrom && !strikeMarks.find(m => m.n === S.n) && S.n !== lastStrike) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(H.width * 1.4, H.width * 1.4).rotateX(-PI / 2), markMat()); m.position.set(S.x, 0.05, 0); m.renderOrder = 6; scene.add(m);
      const ring = new THREE.Mesh(new THREE.RingGeometry(H.width / 2 - 0.2, H.width / 2, 48).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: col('#d8c8ff').multiplyScalar(2), transparent: true, toneMapped: false, depthWrite: false })); ring.position.set(S.x, 0.07, 0); scene.add(ring);
      strikeMarks.push({ n: S.n, m, ring, x: S.x, from: S.warnFrom, at: S.hitAt });
    }
  }
  // a mark whose time has come gets its bolt (the schedule has already moved on to the next strike by then)
  for (const mk of strikeMarks.slice()) {
    if (t >= mk.at && lastStrike !== mk.n) {
      lastStrike = mk.n;
      bolt(V3(mk.x + rr(-6, 6), 70, -4), V3(mk.x, 0.1, 0), { width: 1.1, life: 0.45, branches: 5, color: '#c0a8ff', rough: 0.18 });
      flash = 1.4; flashX = 0.0; shake = 1.2; strikeLight.position.set(mk.x, 4, 2); strikeLight.intensity = reduced ? 0 : 120;
      sparkBurst(V3(mk.x, 0.3, 0), 160, 14);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(H.width, H.width).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); sc.position.set(mk.x, 0.03, 0); scene.add(sc); scorches.push({ m: sc, t: 0 });
      scene.remove(mk.m); scene.remove(mk.ring); mk.m.geometry.dispose(); mk.m.material.dispose(); mk.ring.geometry.dispose(); mk.ring.material.dispose(); strikeMarks.splice(strikeMarks.indexOf(mk), 1);
    }
  }
  strikeMarks.forEach(m => { const u = clamp((t - m.from) / (m.at - m.from), 0, 1); m.m.material.opacity = (0.35 + 0.65 * u) * (0.75 + 0.25 * Math.sin(t * (10 + u * 30))); m.m.scale.setScalar(lerp(0.6, 1, u)); m.ring.scale.setScalar(lerp(1.6, 1, sstep(0, 1, u))); m.ring.material.opacity = u;
    if (Math.random() < 0.3 + u * 0.6) sparkBurst(V3(m.x + rr(-H.width / 2, H.width / 2), 0.2, rr(-1, 1)), 1, 3 + u * 6); });
  scorches.forEach((s, k) => { s.t += dt; s.m.material.opacity = 1 - sstep(4, 8, s.t); });
  for (let k = scorches.length - 1; k >= 0; k--) if (scorches[k].t > 8) { scene.remove(scorches[k].m); scorches[k].m.geometry.dispose(); scorches[k].m.material.dispose(); scorches.splice(k, 1); }
  for (let k = bolts.length - 1; k >= 0; k--) { const b = bolts[k]; b.t += dt; const f = (1 - sstep(b.life * 0.5, b.life, b.t)) * (Math.random() < 0.3 ? 0.4 : 1); b.g.children.forEach(m => (m.material.opacity = f)); if (b.t > b.life) { scene.remove(b.g); b.g.children.forEach(m => { m.geometry.dispose(); m.material.dispose(); }); bolts.splice(k, 1); } }
  for (let j = 0; j < SN; j++) { if (sl[j] <= 0) { sp[j * 3 + 1] = -999; continue; } sl[j] -= dt; sv[j * 3 + 1] -= 20 * dt; for (let a = 0; a < 3; a++) sp[j * 3 + a] += sv[j * 3 + a] * dt; if (sp[j * 3 + 1] < 0.05 && Math.abs(sp[j * 3]) < halfW) { sp[j * 3 + 1] = 0.05; sv[j * 3 + 1] *= -0.4; } }
  sparkGeo.attributes.position.needsUpdate = true;
  flash = Math.max(0, flash - dt * 3.2); const fl = reduced ? 0 : flash * .45;
  skyU.uFlash.value = fl; skyU.uFlashX.value = flashX; waterU.uFlash.value = fl * 0.6; flashLight.intensity = fl * 2.2; hemi.intensity = 0.75 + fl * 0.6;
  strikeLight.intensity = Math.max(0, strikeLight.intensity - dt * 1600);
  // lanterns flicker; flares breathe; the bridge's red lights blink
  lanterns.forEach(l => l.b.material.color.copy(l.base).multiplyScalar(0.85 + 0.15 * Math.sin(t * 9 + l.ph) * Math.sin(t * 13.7 + l.ph * 2)));
  flares.forEach(f => { if (f.blink) f.m.visible = Math.sin(t * 2.4 + f.ph) > 0; else { f.m.scale.set(1 + 0.12 * Math.sin(t * 7 + f.ph), 1 + 0.2 * Math.sin(t * 5.3 + f.ph), 1); f.m.lookAt(camera.position); } });
  // the stage rocks a hair on the water; the curiara and the pelican bob

  const cur = stage.userData.curiara; cur.position.y = STAGE.water.y - .32 + Math.sin(t * 1.3) * 0.12; cur.rotation.z = Math.sin(t * 1.1) * 0.05; cur.rotation.x = Math.sin(t * 0.9) * 0.04;
  const pel = stage.userData.pelican; pel.rotation.y = -1.2 + Math.sin(t * 0.3) * 0.5 * (Math.sin(t * 0.13) > 0.6 ? 1 : 0.1);
  { const pa = fireflies.m.geometry.attributes.position; fireflies.base.forEach((b, k) => pa.setXYZ(k, b.x + Math.sin(t * 0.5 + k) * 1.5, b.y + Math.sin(t * 0.7 + k * 1.3), b.z + Math.cos(t * 0.4 + k) * 1.2)); pa.needsUpdate = true; fireflies.m.material.opacity = 0.6 + 0.4 * Math.sin(t * 3); }
  // a fish jumps now and then
  fishT -= dt;
  if (fishT <= 0 && !fish.visible) { fish.visible = true; fishFrom.set(rr(-30, 30), STAGE.water.y, rr(6, 16)); fishV.set(rr(-3, 3), rr(7, 9), 0); fish.userData.t = 0; }
  if (fish.visible) { fish.userData.t += dt; const u = fish.userData.t; fish.position.copy(fishFrom).addScaledVector(fishV, u).add(V3(0, -9 * u * u, 0)); fish.lookAt(fish.position.clone().add(V3(fishV.x, fishV.y - 18 * u, 0))); if (fish.position.y < STAGE.water.y && u > 0.2) { fish.visible = false; fishT = rr(3, 7); } }

}

return { frame: step, dispose() { scene.traverse(o=>o.shadow?.dispose()); disposeModel(scene); ownedTextures.forEach(t=>t.dispose()); scene.removeFromParent(); } };
}
