import * as THREE from 'three';
import { palletBunker, inflatableBunker, tubeBunker, floodlightMast, ledRope, glowTexture } from '/engine/models/props/glow-paintball.js';
import { watchtower } from '/engine/models/props/watchtower.js';
import { splatTexture } from '/engine/models/props/paintball.js';
import { deadTree } from '/engine/models/vegetation/dead-tree.js';
import { bake } from '/engine/models/core/static-batch.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { rng } from '/engine/random.js';
import { NOCHE_SIZE, NOCHE_COVERS, NOCHE_SPAWNS, MASTS } from './noche-layout.js';

// Night light for the scene: almost no sky, a weak violet moon, and the
// floodlights doing the real work. `glow` makes paint shine in the dark.
export const NIGHT = { background: '#0b0716', fog: [26, 100], hemi: ['#5a4691', '#160c14', .55], sun: ['#8d8cff', .4], exposure: 1.15, sky: false, glow: true };
const LAMP = { red: '#ff2a3a', uv: '#9b4dff' };
// Neon bands on the inflatables and the old paint left on every bunker.
const NEON = ['#ff3fa4', '#b6ff3b', '#2ef2ff', '#ff9a2e', '#fff23b'];
const TUBES = ['#2f7dff', '#ff8a2e', '#36c46a'];

// Glow paintball field at night. Collision comes from NOCHE_COVERS[variant];
// every bunker is fitted to its row's box.
export function createNoche(variant = 0) {
  const group = new THREE.Group(), statics = new THREE.Group(), cameraBounds = [], lights = [], r = rng(260119);
  let flicker = null;
  group.name = 'Cancha de Noche'; group.userData.mapId = 'noche'; // i18n-ignore: scene object name
  const size = NOCHE_SIZE, span = size * 2;
  const flat = (w, d, color, x, z, y = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .2, d), new THREE.MeshStandardMaterial({ color, roughness: 1 })); m.position.set(x, y - .1, z); m.receiveShadow = true; statics.add(m); return m; };
  const put = (object, x, z, angle = 0) => { object.position.set(x, 0, z); object.rotation.y = angle; statics.add(object); return object; };

  // Packed dirt, a darker play field and a low black net fence.
  flat(240, 240, '#1e1813', 0, 0, -.02); flat(span + 1, span + 1, '#2b221b', 0, 0);
  const post = new THREE.MeshStandardMaterial({ color: '#22252b', roughness: .6 }), net = new THREE.MeshStandardMaterial({ color: '#0e0f12', transparent: true, opacity: .45, side: THREE.DoubleSide });
  for (const side of [-1, 1]) for (const along of ['x', 'z']) {
    for (let u = -size - 1; u <= size + 1; u += 4.5) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 3.2, 6), post); p.position.set(along === 'x' ? u : side * (size + 1), 1.6, along === 'x' ? side * (size + 1) : u); statics.add(p); }
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(span + 2, 3), net); sheet.position.set(along === 'x' ? 0 : side * (size + 1), 1.5, along === 'x' ? side * (size + 1) : 0); if (along === 'z') sheet.rotation.y = Math.PI / 2; group.add(sheet);
  }

  // LED rope: the field edge in red, and a glowing ring on every spawn pad.
  const inset = size - .4, corner = 2.5;
  statics.add(ledRope({ closed: true, color: '#ff5a6a', radius: .09, points: [[-inset + corner, -inset], [inset - corner, -inset], [inset, -inset + corner], [inset, inset - corner], [inset - corner, inset], [-inset + corner, inset], [-inset, inset - corner], [-inset, -inset + corner]] }));
  NOCHE_SPAWNS.forEach((s, i) => statics.add(ledRope({ closed: true, color: i % 2 ? '#2ef2ff' : '#ff9a2e', radius: .04, points: Array.from({ length: 10 }, (_, k) => [s.x + Math.cos(k * Math.PI / 5) * 1.6, s.z + Math.sin(k * Math.PI / 5) * 1.6]) })));

  // Bunkers, each fitted to its authoritative box.
  const splats = [1, 2, 3, 4].map(splatTexture), stain = (color, n) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .9, map: splats[n % 4], transparent: true, alphaTest: .4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  NOCHE_COVERS[variant].forEach((o, i) => {
    const band = NEON[i % NEON.length];
    if (o.kind === 'pallet') put(palletBunker({ w: o.w, h: o.h, d: o.d, seed: i + 1 }), o.x, o.z);
    else if (o.kind === 'tube') put(tubeBunker({ w: o.w, h: o.h, d: o.d, color: TUBES[i % TUBES.length] }), o.x, o.z);
    else if (o.kind === 'tower') {
      // The lookout tower stands over a pallet base that fills its collision box.
      put(palletBunker({ w: o.w * .8, h: 1.4, d: o.d * .8, seed: 90 }), o.x, o.z);
      put(watchtower({ h: 4.2, roof: 'tiles' }), o.x, o.z);
      const under = new THREE.PointLight(LAMP.red, 60, 16, 1.6); under.position.set(o.x, 1.6, o.z); group.add(under); lights.push(under); flicker = under;
    } else put(inflatableBunker({ shape: o.kind, w: o.w, h: o.h, d: o.d, color: '#f4f1ea', band }), o.x, o.z);
    cameraBounds.push(new THREE.Box3(new THREE.Vector3(o.x - o.w / 2, 0, o.z - o.d / 2), new THREE.Vector3(o.x + o.w / 2, o.h, o.z + o.d / 2)));
    // Paint from earlier games still glows on the boxy bunkers.
    if (o.kind !== 'pallet' && o.kind !== 'brick' && o.kind !== 'tower') return;
    for (let k = 0; k < 2; k++) {
      const face = Math.floor(r() * 4), s = .7 + r() * .7, mark = new THREE.Mesh(new THREE.PlaneGeometry(s, s), stain(NEON[(i + k) % NEON.length], i + k));
      const u = (r() - .5) * .6, v = Math.min(o.h - .3, .5 + r() * .8);
      if (face < 2) mark.position.set(o.x + u * o.w, v, o.z + (face ? 1 : -1) * (o.d / 2 + .03)); else mark.position.set(o.x + (face === 3 ? 1 : -1) * (o.w / 2 + .03), v, o.z + u * o.d);
      mark.rotation.set(0, face === 1 ? 0 : face === 0 ? Math.PI : face === 3 ? Math.PI / 2 : -Math.PI / 2, r() * 6); group.add(mark);
    }
  });

  // Floodlight masts aimed at the middle, each with a real spotlight and a halo.
  const halo = glowTexture(), haloMaterials = new Map();
  const haloFor = color => { if (!haloMaterials.has(color)) haloMaterials.set(color, new THREE.SpriteMaterial({ map: halo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); return haloMaterials.get(color); };
  for (const [x, z, kind] of MASTS) {
    const color = LAMP[kind], mast = put(floodlightMast({ height: 8, color }), x, z, Math.atan2(-x, -z));
    mast.updateMatrixWorld(true);
    const lamp = mast.localToWorld(new THREE.Vector3(0, 7.65, .3)), spot = new THREE.SpotLight(color, kind === 'uv' ? 1100 : 1500, 0, .48, .85, 1.3);
    spot.position.copy(lamp); spot.target.position.set(x * .42, 0, z * .3); group.add(spot, spot.target); lights.push(spot);
    for (const p of mast.userData.lamps) { const sprite = new THREE.Sprite(haloFor(color)); sprite.position.copy(mast.localToWorld(p.clone())); sprite.scale.setScalar(3.2); group.add(sprite); }
  }

  // Bare twisted trees beyond the net, and spare pallet stacks by the gate.
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + r() * .2, d = size + 9 + r() * 10;
    put(deadTree({ seed: 30 + i, height: 6 + r() * 3, detail: 'low' }), Math.cos(a) * d, Math.sin(a) * d, r() * 6);
  }
  for (const [x, z] of [[-36, 6], [-36, 9], [36, -8]]) put(palletBunker({ w: 1.2, h: .9 + r() * .8, d: 1.2, seed: Math.round(z) + 50 }), x, z, r());

  const batch = bake(statics), original = new Set();
  statics.traverse(o => { if (o.geometry) original.add(o.geometry); }); original.forEach(g => g.dispose()); group.add(batch);
  // Canonical factories cache materials: own clones before this map is ever freed.
  const owned = new Map();
  group.traverse(o => { if (o.material && !o.isSprite) { const own = m => { if (!owned.has(m)) owned.set(m, m.clone()); return owned.get(m); }; o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material); } });
  let disposed = false;
  return { id: 'noche', group, cameraBounds, lighting: NIGHT,
    // The bulb under the tower breathes a little, like a cheap generator.
    update(t) { if (flicker) flicker.intensity = 55 + Math.sin(t * 2.3) * 6; },
    dispose() { if (disposed) return; disposed = true; lights.forEach(l => l.dispose()); haloMaterials.forEach(m => m.dispose()); halo.dispose(); splats.forEach(t => t.dispose()); disposeModel(group); },
  };
}
