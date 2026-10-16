import { capybaraForm, hedgeBlob } from '/engine/models/fauna/capybara/shape.js';
// Pana signature landmarks: the recognizable monuments every game can share.
// Every factory is grounded at y = 0, faces +Z and returns a static, baked
// group. Animated parts (flags, water droplets/ripples) stay outside the bake and are
// driven by userData.tick(t, dt).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addWaterMotion } from '/engine/models/effects/water-details.js';
import { M, mesh, box, tube, canvasMat, rng } from '/engine/models/core/primitives.js';
import { rock } from '/engine/models/props/rock.js';
import { makeMango } from '/engine/models/props/mango.js';
import { flagPole } from '/engine/models/props/flags.js';
import { bush } from '/engine/models/vegetation/bush.js';
import { bake } from '/engine/models/core/static-batch.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';

// PANA brand guide colors (see avatar.js PALETTE).
const BRAND = { purple: '#1a1336', yellow: '#ffc629', coral: '#ff4b4b', teal: '#2ad1b2', cream: '#f3e9d7', cocoa: '#8b5e3c' };
const smooth = (color, extra = {}) => M(color, { flatShading: false, ...extra });
const gold = () => smooth(0xffc629, { metalness: 0.78, roughness: 0.3, emissive: 0x6b4200, emissiveIntensity: 0.12 });
const marble = () => smooth(0xf1e7d6, { roughness: 0.55 });
const marbleDark = () => smooth(0xd8c8ae, { roughness: 0.7 });

// Bake static detail and release the temporary per-part geometry.
function finish(group) {
  const out = bake(group);
  group.traverse(o => o.geometry?.dispose());
  // Include textured details attached after batching (the souvenir flag).
  out.userData.dispose=()=>{
    const textures=new Set();out.traverse(o=>{if(o.material?.map?.isCanvasTexture)textures.add(o.material.map);});
    textures.forEach(t=>t.dispose());
  };
  return out;
}

function ellipsoid(mat, [x, y, z], [sx, sy, sz], rx = 0, w = 18, h = 12) {
  const m = mesh(new THREE.SphereGeometry(1, w, h), mat, x, y, z);
  m.scale.set(sx, sy, sz); m.rotation.x = rx;
  return m;
}

// Text panel for plaques and signs. Canvas materials stay unbatched.
function plaque(lines, w, h, { bg = BRAND.purple, fg = BRAND.yellow, sub = BRAND.cream, border = true } = {}) {
  const cw = 512, ch = Math.round(512 * h / w);
  return mesh(new THREE.PlaneGeometry(w, h), canvasMat(cw, ch, ctx => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
    if (border) { ctx.strokeStyle = fg; ctx.lineWidth = Math.max(4, ch * 0.05); ctx.strokeRect(ch * 0.07, ch * 0.07, cw - ch * 0.14, ch - ch * 0.14); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const list = Array.isArray(lines) ? lines : [lines];
    list.forEach((line, i) => {
      const size = (list.length > 1 ? (i ? 0.24 : 0.42) : 0.56) * ch;
      const y = list.length > 1 ? ch * (i ? 0.72 : 0.38) : ch * 0.54;
      ctx.font = `${size}px "Luckiest Guy", system-ui, sans-serif`;
      ctx.lineWidth = size * 0.14; ctx.strokeStyle = '#120d26';
      ctx.fillStyle = i ? sub : fg;
      ctx.strokeText(line, cw / 2, y, cw * 0.86); ctx.fillText(line, cw / 2, y, cw * 0.86);
    });
  }));
}

// Stacked plinth tiers: [[width, height, sides]] from the ground up.
function plinth(group, tiers, mats) {
  let y = 0;
  tiers.forEach(([w, h, sides = 4], i) => {
    const mat = mats[i % mats.length];
    const geo = sides === 4 ? new RoundedBoxGeometry(w, h, w, 2, Math.min(0.06, h * 0.25)) : new THREE.CylinderGeometry(w / 2, w / 2, h, sides);
    const tier = mesh(geo, mat, 0, y + h / 2, 0);
    if (sides === 8) tier.rotation.y = Math.PI / 8;
    group.add(tier); y += h;
  });
  return y;
}

// ---------- 001 · Giant capybara statue ----------
// The approved player sculpt cast in bronze on a stepped plinth, waving.
export function capybaraStatue({ scale = 3, finish: surface = 'bronze' } = {}) {
  const g = new THREE.Group();
  const top = plinth(g, [[4.6, 0.4], [3.9, 0.45], [3.2, 1.3]], [marbleDark(), marble(), marble()]);
  g.add(box(3.36, 0.16, 3.36, marbleDark(), 0, top - 0.25, 0));
  const sign = plaque(['PANA', 'el pana original'], 2.4, 0.95); sign.position.set(0, 1.5, 1.605); g.add(sign);

  const capy = buildCharacter({ fur: '#cf7d22', hat: 'none', glasses: 'sol', outfit: 'franela', face: 'feliz' });
  capy.armR.rotation.set(-0.15, 0, -2.45); capy.armL.rotation.set(0.1, 0, 0.32);
  const cast = new THREE.Group(); capy.group.scale.setScalar(scale); capy.group.position.y = top; cast.add(capy.group);
  const statue = bake(cast); capy.dispose();
  const metal = surface === 'stone' ? marble() : smooth(0xffffff, { vertexColors: true, metalness: 0.7, roughness: 0.43 });
  statue.traverse(o => {
    if (!o.isMesh) return;
    if (surface !== 'stone') {
      const p = o.geometry.attributes.position, n = o.geometry.attributes.normal, colors = [];
      const bronze = new THREE.Color(0xb58248), patina = new THREE.Color(0x496d59);
      for (let i = 0; i < p.count; i++) {
        const sheltered = Math.max(0, -n.getY(i)) * 0.32;
        const mottled = Math.sin(p.getX(i) * 8 + p.getZ(i) * 13) * Math.sin(p.getY(i) * 11) * 0.06;
        colors.push(...bronze.clone().lerp(patina, THREE.MathUtils.clamp(sheltered + mottled, 0, 0.45)).toArray());
      }
      o.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    o.material = metal;
  });
  for (const x of [-1.4, 1.4]) for (const z of [-1.4, 1.4]) g.add(box(0.07, 0.9, 0.07, gold(), x, 1.43, z));
  g.add(statue);
  return finish(g);
}

// ---------- 002 · Golden mango statue ----------
export function goldenMangoStatue() {
  const g = new THREE.Group();
  const top = plinth(g, [[4.2, 0.35, 8], [3.5, 0.35, 8], [2.4, 1.15, 8]], [marbleDark(), marble(), smooth(0x2c8f80)]);
  g.add(mesh(new THREE.CylinderGeometry(1.35, 1.3, 0.2, 24), gold(), 0, top + 0.1, 0));
  const fruit = makeMango({ gold: true });
  fruit.scale.setScalar(1.5 * 2.5); fruit.position.set(0, top + 2.0, 0); fruit.rotation.set(0, -0.5, 0.12);
  g.add(fruit);
  // Ordinary mangoes rest at the base, so the golden one reads as giant.
  for (let i = 0; i < 4; i++) {
    const m = makeMango(), a = Math.PI / 4 + i * Math.PI / 2;
    m.scale.setScalar(0.5); m.position.set(Math.cos(a) * 1.42, 0.92, Math.sin(a) * 1.42); m.rotation.set(0, a, 1.2);
    g.add(m);
  }
  const sign = plaque(['MANGO DE ORO', 'Plaza Pana'], 1.6, 0.62); sign.position.set(0, 1.2, 1.115); g.add(sign);
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12;
    g.add(tube([Math.sin(a) * 1.12, 0.83, Math.cos(a) * 1.12], [Math.sin(a) * 1.12, 1.7, Math.cos(a) * 1.12], 0.025, gold()));
  }
  return finish(g);
}

// ---------- 004 · Pana welcome arch ----------
export function welcomeArch({ seed = 4 } = {}) {
  const g = new THREE.Group();
  const plaster = smooth(0xe8775f, { roughness: 0.9 }), cream = smooth(0xf3e9d7, { roughness: 0.85 });
  const teal = smooth(0x2aa596, { roughness: 0.75 }), stone = smooth(0xb8ab8b, { roughness: 1 });
  for (const s of [-1, 1]) {
    const x = s * 4.3;
    g.add(mesh(new RoundedBoxGeometry(1.5, 0.6, 1.5, 2, 0.06), stone, x, 0.3, 0));
    g.add(mesh(new RoundedBoxGeometry(1.1, 5.0, 1.1, 2, 0.08), plaster, x, 3.1, 0));
    for (const y of [1.1, 2.2, 3.3, 4.4]) g.add(box(1.16, 0.08, 1.16, cream, x, y, 0));
    g.add(mesh(new RoundedBoxGeometry(1.45, 0.32, 1.45, 2, 0.06), cream, x, 5.74, 0));
    const finial = makeMango({ gold: true }); finial.scale.setScalar(0.62); finial.position.set(x, 6.42, 0); g.add(finial);
    const shrub = bush({ seed: seed + s, flowers: true }); shrub.scale.setScalar(0.75); shrub.position.set(x + s * 0.45, 0, 0.65); g.add(shrub);
    // Bracket-mounted lanterns give the gate a welcoming, inhabited scale.
    g.add(tube([x, 3.6, 0.5], [x, 3.6, 0.95], 0.045, teal));
    g.add(box(0.38, 0.55, 0.32, smooth(0xffdf97, { emissive: 0xffc15c, emissiveIntensity: 0.22 }), x, 3.24, 0.95));
    for (const y of [2.94, 3.54]) g.add(box(0.48, 0.08, 0.42, teal, x, y, 0.95));
    for (const dx of [-0.19, 0.19]) g.add(box(0.045, 0.55, 0.36, teal, x + dx, 3.24, 0.95));
  }
  // A flattened half-ring spans the pillars above the crossbeam.
  const band = new THREE.Shape();
  band.absarc(0, 0, 4.85, 0, Math.PI, false); band.lineTo(-3.85, 0); band.absarc(0, 0, 3.85, Math.PI, 0, true); band.closePath();
  const arcGeo = new THREE.ExtrudeGeometry(band, { depth: 0.8, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1, curveSegments: 28 });
  arcGeo.translate(0, 0, -0.4); arcGeo.scale(1, 0.42, 1);
  g.add(mesh(arcGeo, teal, 0, 5.55, 0));
  g.add(box(9.6, 0.42, 0.95, cream, 0, 5.45, 0));
  for (let i = 0; i < 9; i++) {
    const a = (i + 0.5) / 9 * Math.PI;
    g.add(mesh(new THREE.SphereGeometry(0.13, 8, 6), smooth(0xffe08a, { emissive: 0xffb03b, emissiveIntensity: 0.4 }), Math.cos(a) * 4.35, 5.55 + Math.sin(a) * 4.35 * 0.42, 0.44));
  }
  const crest = mesh(new RoundedBoxGeometry(3.3, 1.2, 1.05, 2, 0.12), cream, 0, 7.15, 0); g.add(crest);
  const name = plaque('PANA', 3.0, 0.95, { border: false }); name.position.set(0, 7.15, 0.535); g.add(name);
  const back = plaque('PANA', 3.0, 0.95, { border: false }); back.position.set(0, 7.15, -0.535); back.rotation.y = Math.PI; g.add(back);
  // The welcome board hangs from the crossbeam, high enough for cars.
  for (const x of [-2.4, 2.4]) g.add(tube([x, 5.24, 0.1], [x, 4.85, 0.1], 0.03, M(0x3b3a40)));
  g.add(box(5.8, 0.95, 0.16, cream, 0, 4.4, 0.1));
  const hello = plaque('¡BIENVENIDOS, PANAS!', 5.5, 0.8, { bg: BRAND.coral, fg: BRAND.cream }); hello.position.set(0, 4.4, 0.19); g.add(hello);
  const helloBack = plaque('¡VUELVAN PRONTO!', 5.5, 0.8, { bg: BRAND.coral, fg: BRAND.cream }); helloBack.position.set(0, 4.4, 0.01); helloBack.rotation.y = Math.PI; g.add(helloBack);
  // Pennants below the beam.
  const pennants = [BRAND.yellow, BRAND.teal, BRAND.coral, BRAND.cream].map(c => M(c, { side: THREE.DoubleSide }));
  for (let i = 0; i < 16; i++) {
    const x = -3.6 + i * 0.48, sag = 5.15 - Math.sin((i + 0.5) / 16 * Math.PI) * 0.25;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.2, 0, 0, 0.2, 0, 0, 0, -0.42, 0], 3)); geo.computeVertexNormals();
    g.add(mesh(geo, pennants[i % 4], x, sag, 0.5));
  }
  return finish(g);
}

// ---------- 006 · Capybara-shaped topiary ----------
export function capybaraTopiary({ seed = 6 } = {}) {
  const g = new THREE.Group();
  const brick = smooth(0xc9714f, { roughness: 0.95 }), cap = smooth(0xf1dfbf, { roughness: 0.9 });
  g.add(mesh(new RoundedBoxGeometry(2.6, 0.55, 3.8, 2, 0.05), brick, 0, 0.275, 0));
  for (const x of [-1.31, 1.31]) g.add(box(0.13, 0.12, 3.95, cap, x, 0.6, 0));
  for (const z of [-1.91, 1.91]) g.add(box(2.5, 0.12, 0.13, cap, 0, 0.6, z));
  g.add(box(2.4, 0.04, 3.6, smooth(0x4c3627, { roughness: 1 }), 0, 0.62, 0));
  const hedge = capybaraForm(null, { leafy: true, seed, eyes: smooth(0x1b1712, { roughness: 0.4 }) });
  hedge.scale.setScalar(1.2); hedge.position.set(0, 0.64, -0.2); g.add(hedge);
  // Clipped boxwood balls at the corners.
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
    g.add(hedgeBlob([sx * 0.98, 0.92, sz * 1.6], [0.32, 0.32, 0.32], seed + 20 + i, 0x6aa84d));
  });
  const sign = plaque('PANA', 0.9, 0.34); sign.position.set(0, 0.3, 1.905); g.add(sign);
  for (const z of [-1.904, 1.904]) for (const x of [-0.92, 0.92]) g.add(box(0.05, 0.36, 0.025, cap, x, 0.28, z));
  return finish(g);
}

// ---------- 007 · Pana flagpole ----------
export function panaFlagpole({ h = 10 } = {}) {
  const g = new THREE.Group(), base = new THREE.Group();
  const top = plinth(base, [[2.2, 0.3, 8], [1.5, 0.35, 8], [0.8, 0.3, 8]], [marbleDark(), marble(), smooth(0x1a1336)]);
  const sign = plaque('PANA', 0.9, 0.3); sign.position.set(0, 0.47, 0.75); base.add(sign);
  const finial = makeMango({ gold: true }); finial.scale.setScalar(0.32); finial.position.y = top + h + 0.18; base.add(finial);
  g.add(finish(base));
  const pole = flagPole({ h, flag: 'pana' }); pole.position.y = top; g.add(pole);
  g.userData.tick = (t, dt) => pole.userData.tick(t, dt);
  return g;
}

// ---------- 008 · Pana trophy monument ----------
export function trophyMonument() {
  const g = new THREE.Group(), metal = gold();
  let top = plinth(g, [[4.0, 0.35], [3.3, 0.35], [2.6, 0.35]], [marbleDark(), marble(), marbleDark()]);
  g.add(mesh(new RoundedBoxGeometry(1.9, 1.5, 1.9, 2, 0.06), smooth(0x1a1336, { roughness: 0.5 }), 0, top + 0.75, 0));
  for (const y of [top + 0.06, top + 1.44]) g.add(box(2.0, 0.12, 2.0, metal, 0, y, 0));
  const sign = plaque(['COPA PANA', 'campeones de verdad'], 1.6, 0.66); sign.position.set(0, top + 0.75, 0.955); g.add(sign);
  top += 1.5;
  const profile = [[0, 0], [0.95, 0], [0.95, 0.14], [0.6, 0.24], [0.28, 0.42], [0.2, 0.85], [0.42, 0.98], [0.42, 1.08], [0.22, 1.2],
    [0.36, 1.4], [0.9, 1.7], [1.18, 2.3], [1.3, 2.95], [1.38, 3.05], [1.3, 3.1], [1.2, 3.0], [0, 2.85]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(mesh(new THREE.LatheGeometry(profile, 36), metal, 0, top, 0));
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([[s * 1.26, top + 2.9, 0], [s * 1.9, top + 3.0, 0], [s * 1.95, top + 2.4, 0], [s * 1.48, top + 1.7, 0], [s * 0.82, top + 1.65, 0]].map(p => new THREE.Vector3(...p)));
    g.add(mesh(new THREE.TubeGeometry(curve, 24, 0.09, 8, false), metal));
    for (let i = 0; i < 7; i++) {
      const a = s * (0.5 + i * 0.16), y = top + 1.93 + i * 0.12;
      const leaf = ellipsoid(metal, [s * (0.48 + Math.sin(i * 0.28) * 0.34), y, 1.12 + i * 0.015], [0.065, 0.14, 0.025], 0, 8, 6);
      leaf.rotation.z = a; g.add(leaf);
    }
  }
  const lid = mesh(new THREE.SphereGeometry(1.24, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal, 0, top + 3.0, 0);
  lid.scale.y = 0.32; g.add(lid);
  const emblem = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24), smooth(0x1a1336), 0, top + 2.25, 1.23);
  emblem.rotation.x = Math.PI / 2 - 0.18; g.add(emblem);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.13 : 0.3; i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const starMesh = mesh(new THREE.ExtrudeGeometry(star, { depth: 0.05, bevelEnabled: false }), metal, 0, top + 2.25, 1.285);
  starMesh.rotation.x = -0.18; g.add(starMesh);
  const finial = capybaraForm(metal, { detail: 0.65 }); finial.scale.setScalar(0.5); finial.position.y = top + 3.33; g.add(finial);
  return finish(g);
}

// ---------- 009 · Capybara fountain ----------
// A stone capybara (with its bird friend) spouts water, joined by two pups.
export function capybaraFountain({ seed = 9 } = {}) {
  const g = new THREE.Group(), stone = smooth(0xd9c6a2, { roughness: 0.9 }), rim = smooth(0xeedcb9, { roughness: 0.8 });
  const wall = [[3.42, 0], [3.42, 0.78], [3.3, 0.9], [3.0, 0.92], [2.85, 0.82], [2.85, 0.2]].map(([x, y]) => new THREE.Vector2(x, y));
  const basin = mesh(new THREE.LatheGeometry(wall, 8), rim); basin.rotation.y = Math.PI / 8; g.add(basin);
  const floor = mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.22, 8), stone, 0, 0.11, 0); floor.rotation.y = Math.PI / 8; g.add(floor);
  const water = mesh(new THREE.CylinderGeometry(2.86, 2.86, 0.05, 8), smooth(0x47bec1, { metalness: 0.15, roughness: 0.2 }), 0, 0.66, 0);
  water.rotation.y = Math.PI / 8; g.add(water);
  const tile = smooth(0x328e86, { roughness: 0.65 });
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24, sector = ((a + Math.PI / 8) % (Math.PI / 4)) - Math.PI / 8;
    const radius = 3.45 * Math.cos(Math.PI / 8) / Math.cos(sector);
    const t = box(0.19, 0.16, 0.035, i % 3 ? tile : rim, Math.sin(a) * radius, 0.48, Math.cos(a) * radius);
    t.rotation.y = a; g.add(t);
  }
  const boulder = rock(1.15, 0xa99c86, seed); boulder.position.y = 0.8; boulder.scale.set(1.15, 0.75, 1.0); g.add(boulder);
  const lift = 1.3;
  const eyes = smooth(0x3a3128, { roughness: 0.5 });
  const big = capybaraForm(stone, { eyes }); big.scale.setScalar(1.25); big.position.set(0, lift, -0.15); g.add(big);
  // The bird that always rides on a capybara.
  const bird = new THREE.Group(); bird.position.set(0, lift + 1.62 * 1.25, -0.15 + 0.85 * 1.25);
  bird.add(ellipsoid(smooth(0xffc629), [0, 0.12, 0], [0.16, 0.13, 0.2]), ellipsoid(smooth(0xffc629), [0, 0.27, 0.1], [0.1, 0.1, 0.1]));
  const beak = mesh(new THREE.ConeGeometry(0.035, 0.1, 6), smooth(0xff8a1f), 0, 0.26, 0.23); beak.rotation.x = Math.PI / 2; bird.add(beak);
  for (const s of [-1, 1]) bird.add(ellipsoid(eyes, [s * 0.06, 0.3, 0.17], [0.018, 0.02, 0.015], 0, 6, 4));
  g.add(bird);
  const pups = [[-2.95, 0.6], [2.95, -0.6]].map(([x, z]) => {
    const pup = capybaraForm(stone, { eyes, detail: 0.65 }); pup.scale.setScalar(0.42);
    pup.position.set(x, 0.9, z); pup.rotation.y = Math.atan2(-x, -z); g.add(pup); return pup;
  });
  // Water arcs: the big snout plus both pups.
  const jet = M(0x91e5e1, { transparent: true, opacity: 0.6, depthWrite: false }), jets = [], impacts = [];
  const spout = (from, to, lift) => {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + lift;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b); jets.push(curve); impacts.push([b.x, b.y + 0.015, b.z, 0.28]);
    g.add(mesh(new THREE.TubeGeometry(curve, 20, 0.035, 6, false), jet));
  };
  spout([0, lift + 1.0 * 1.25, -0.15 + 1.6 * 1.25], [0, 0.68, 2.55], 0.55);
  for (const pup of pups) {
    pup.updateMatrix(); const snout = new THREE.Vector3(0, 1.0, 1.55).applyMatrix4(pup.matrix);
    spout(snout.toArray(), snout.clone().multiplyScalar(0.72).setY(0.68).toArray(), 0.3);
  }
  const plate = plaque('LA FUENTE DE LOS PANAS', 1.9, 0.32); plate.position.set(0, 0.45, 3.3); plate.rotation.x = -0.1; g.add(plate);
  const out = finish(g);
  out.userData.tick = addWaterMotion(out, impacts, jets);
  return out;
}

// ---------- 010 · Pana souvenir kiosk ----------
export function souvenirKiosk({ seed = 10 } = {}) {
  const g = new THREE.Group(), r = rng(seed);
  const wood = smooth(0x96582e, { roughness: 0.9 }), woodLight = smooth(0xb57840, { roughness: 0.9 }), woodDark = smooth(0x694025, { roughness: 0.95 });
  const yellow = smooth(0xffc629, { roughness: 0.7 }), purple = smooth(0x1a1336, { roughness: 0.6 });
  g.add(box(3.8, 0.18, 2.9, woodDark, 0, 0.09, 0));
  // Back wall, side walls and the painted front counter.
  g.add(box(3.4, 2.7, 0.12, wood, 0, 1.53, -1.2));
  for (let i = 0; i < 13; i++) g.add(box(0.012, 2.63, 0.015, woodDark, -1.56 + i * 0.26, 1.53, -1.13));
  for (const s of [-1, 1]) g.add(box(0.12, 1.1, 2.4, wood, s * 1.66, 0.73, 0));
  g.add(box(3.44, 1.0, 0.16, yellow, 0, 0.68, 1.15));
  g.add(box(3.6, 0.1, 0.62, woodLight, 0, 1.23, 1.05));
  const front = plaque('RECUERDOS', 2.6, 0.55); front.position.set(0, 0.7, 1.235); g.add(front);
  for (const x of [-1.66, 1.66]) for (const z of [-1.2, 1.18]) g.add(box(0.13, 3.0, 0.13, woodDark, x, 1.68, z));
  for (const s of [-1, 1]) {
    g.add(tube([s * 1.66, 2.55, 1.18], [s * 1.22, 3.12, 1.18], 0.055, woodLight));
    const shutter = new THREE.Group(); shutter.position.set(s * 1.7, 1.9, 0.1); shutter.rotation.y = -s * 0.28;
    for (let i = 0; i < 8; i++) shutter.add(box(0.07, 0.08, 1.55, woodLight, 0, -0.45 + i * 0.13, 0));
    for (const z of [-0.76, 0.76]) shutter.add(box(0.1, 1.1, 0.08, woodDark, 0, 0, z));
    g.add(shutter);
  }
  // Striped awning and roof sign.
  // One double-sided palette for awning, pennants and postcards keeps draw calls low.
  const [coral, cream, teal, gilt] = [BRAND.coral, BRAND.cream, BRAND.teal, BRAND.yellow].map(c => M(c, { side: THREE.DoubleSide }));
  const fabrics = [coral, cream];
  for (let i = 0; i < 9; i++) {
    const strip = box(0.44, 0.07, 3.0, fabrics[i % 2], -1.76 + i * 0.44, 3.24, 0.18); strip.rotation.x = 0.16; g.add(strip);
    const shape = new THREE.Shape(); shape.moveTo(-0.22, 0.12); shape.lineTo(0.22, 0.12); shape.lineTo(0.22, -0.05); shape.quadraticCurveTo(0, -0.31, -0.22, -0.05); shape.closePath();
    g.add(mesh(new THREE.ShapeGeometry(shape, 8), fabrics[i % 2], -1.76 + i * 0.44, 2.92, 1.68));
  }
  g.add(box(2.7, 0.75, 0.14, purple, 0, 3.75, -0.95));
  const sign = plaque(['PANA', 'hecho con cariño'], 2.5, 0.64, { border: false }); sign.position.set(0, 3.75, -0.875); g.add(sign);
  // Shelves of mini mangoes, capybara plushies and trophies.
  const plush = smooth(0xcf7d22, { roughness: 1 }), button = smooth(0x1b1712);
  for (const [i, y] of [1.45, 2.05].entries()) {
    g.add(box(3.2, 0.06, 0.38, woodLight, 0, y, -1.0));
    for (let k = 0; k < 6; k++) {
      const x = -1.35 + k * 0.54;
      if ((k + i) % 2) { const m = makeMango({ gold: k === 3 }); m.scale.setScalar(0.17); m.position.set(x, y + 0.13, -1.0); m.rotation.z = 0.4; g.add(m); }
      else { const toy = capybaraForm(plush, { eyes: button, detail: 0.5 }); toy.scale.setScalar(0.17); toy.position.set(x, y + 0.03, -1.0); toy.rotation.y = (r() - 0.5) * 0.6; g.add(toy); }
    }
  }
  // Postcard rack on the counter and a basket of mangoes.
  const cards = [teal, coral, gilt, cream];
  g.add(box(0.06, 0.6, 0.06, woodDark, 1.25, 1.58, 1.05));
  for (let i = 0; i < 6; i++) { const card = box(0.2, 0.28, 0.015, cards[i % cards.length], 1.25 + (i % 2 ? 0.12 : -0.12), 1.45 + Math.floor(i / 2) * 0.2, 1.09); card.rotation.y = (i % 2 ? -0.2 : 0.2); g.add(card); }
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.2, 10, 1, true), woodLight, -1.1, 1.38, 1.05));
  for (let i = 0; i < 4; i++) { const m = makeMango(); m.scale.setScalar(0.16); m.position.set(-1.1 + (r() - 0.5) * 0.3, 1.47, 1.05 + (r() - 0.5) * 0.25); m.rotation.set(r(), r() * 3, 1.2); g.add(m); }
  // Pennant string along the awning edge.
  const pennants = [gilt, teal, coral];
  for (let i = 0; i < 10; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3)); geo.computeVertexNormals();
    g.add(mesh(geo, pennants[i % 3], -1.6 + i * 0.355, 2.76, 1.72));
  }
  const out = finish(g);
  const pole = flagPole({ h: 2.4, flag: 'pana' }); pole.scale.setScalar(0.55); pole.position.set(1.5, 3.42, -0.95); out.add(pole);
  out.userData.tick = (t, dt) => pole.userData.tick(t, dt);
  return out;
}
