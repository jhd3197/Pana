// Bioluminescent cave fungi: a clump of small toadstools for a floor, or
// bracket shelves for a wall. Few segments and shared materials, so a floor's
// worth bakes into a couple of draws. Metres, +Y up. On a wall the origin sits
// on the rock and the shelves grow toward +Z.
// Lights belong to the consumer: userData.glow is where the clump shines from
// and in which colour, for a halo or one of the few real lights it can afford.
import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';

// Deep on purpose: ACES tone mapping bleaches a bright emissive to white.
export const MUSHROOM_GLOW = { blue: 0x1f7dff, purple: 0x9a35ff };

const capMaterial = color => M(color, { emissive: color, emissiveIntensity: 1, roughness: .55, side: THREE.DoubleSide });
const stemMaterial = color => M(new THREE.Color(color).lerp(new THREE.Color(0xe8eeff), .45).getHex(), { emissive: color, emissiveIntensity: .45, roughness: .8 });

export function glowMushrooms({ seed = 1, color, count, wall = false, spread = .55, halo = false } = {}) {
  const r = rng(seed), g = new THREE.Group(), n = count ?? 3 + (r() * 4 | 0);
  const tint = MUSHROOM_GLOW[color] ?? (r() < .5 ? MUSHROOM_GLOW.blue : MUSHROOM_GLOW.purple);
  const cap = capMaterial(tint), stem = stemMaterial(tint);
  for (let i = 0; i < n; i++) {
    const w = .1 + r() * .17, a = r() * Math.PI * 2, d = i ? spread * (.35 + r() * .65) : 0;
    if (wall) {
      // A shelf: half a flattened dome with its straight edge on the rock.
      const shelf = mesh(new THREE.SphereGeometry(1, 7, 3, 0, Math.PI, 0, Math.PI / 2), cap, Math.cos(a) * d, Math.sin(a) * d * 1.3, 0);
      shelf.scale.set(w * 1.25, w * .5, w * 1.05); g.add(shelf);
      continue;
    }
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = .16 + r() * .36;
    g.add(mesh(new THREE.CylinderGeometry(w * .2, w * .28, h, 5, 1, true), stem, x, h / 2, z));
    const dome = mesh(new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), cap, x, h - .015, z);
    dome.scale.set(w, w * .68, w); dome.rotation.set((r() - .5) * .35, 0, (r() - .5) * .35); g.add(dome);
  }
  const out = bake(g); out.name = 'glowMushrooms';
  g.traverse(o => o.geometry?.dispose());
  out.userData.glow = { y: wall ? .05 : .3, z: wall ? .18 : 0, color: tint };
  // A standalone clump (Studio) brings its own halo; a map batches its halos.
  if (halo) {
    const map = glowTexture(), sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: tint, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.scale.setScalar(1.7); sprite.position.set(0, out.userData.glow.y, out.userData.glow.z); out.add(sprite);
    out.userData.dispose = () => { map.dispose(); sprite.material.dispose(); };
  }
  return out;
}

// A thicket to walk into and hide in: taller toadstools around the rim, short
// ones inside, as wide as `radius` and about chest-high. Two draws. The consumer
// sets how alive it is with userData.setGlow(0…1), which also withers it to brown.
export function mushroomThicket({ seed = 1, radius = 1.9, color, tall = 2 } = {}) {
  const r = rng(seed), g = new THREE.Group(), n = Math.round(12 + radius * 8);
  const tint = MUSHROOM_GLOW[color] ?? (r() < .5 ? MUSHROOM_GLOW.blue : MUSHROOM_GLOW.purple);
  const cap = capMaterial(tint), lit = new THREE.Color(tint), dead = new THREE.Color(0x4a3a2a), stemLit = new THREE.Color(tint).lerp(new THREE.Color(0xc8cce0), .22), stemDead = new THREE.Color(0x3a2e24);
  const stem = M(stemLit.getHex(), { emissive: tint, emissiveIntensity: .45, roughness: .85 });
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = radius * Math.sqrt(r()), rim = d / radius, h = rim > .5 ? .8 + r() * (tall - .8) : .3 + r() * .6, w = .14 + h * .17;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    g.add(mesh(new THREE.CylinderGeometry(w * .16, w * .24, h, 5, 1, true), stem, x, h / 2, z));
    const dome = mesh(new THREE.SphereGeometry(1, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), cap, x, h - .015, z);
    dome.scale.set(w, w * .62, w); dome.rotation.set((r() - .5) * .35, 0, (r() - .5) * .35); g.add(dome);
  }
  const out = bake(g); out.name = 'mushroomThicket';
  g.traverse(o => o.geometry?.dispose());
  out.userData.glow = { y: 1.1, z: 0, color: tint };
  // M() shares materials across models: dimming this thicket must dim only this
  // thicket, so it owns copies of both.
  let ownCap = null, ownStem = null;
  out.traverse(o => { if (!o.material) return; const own = o.material.clone(); if (o.material.color.getHex() === lit.getHex()) ownCap = own; else ownStem = own; o.material = own; });
  out.userData.setGlow = v => {
    // Squared: a strong tint in linear colour takes over the hue long before it is bright.
    const k = Math.max(0, Math.min(1, v)) ** 2;
    ownCap.color.copy(dead).lerp(lit, k); ownCap.emissiveIntensity = .02 + k; ownStem.color.copy(stemDead).lerp(stemLit, k); ownStem.emissiveIntensity = .01 + k * .44;
  };
  out.userData.dispose = () => { ownCap.dispose(); ownStem.dispose(); };
  return out;
}

// Every halo of a floor in one draw: the points come as { x, y, z, color }.
export function mushroomHalos(points, map, { size = 2.1, opacity = .6 } = {}) {
  const positions = new Float32Array(points.length * 3), colors = new Float32Array(points.length * 3), c = new THREE.Color();
  points.forEach((p, i) => { positions.set([p.x, p.y, p.z], i * 3); c.set(p.color).toArray(colors, i * 3); });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const halos = new THREE.Points(geometry, new THREE.PointsMaterial({ map, size, vertexColors: true, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  halos.name = 'Mushroom halos'; halos.renderOrder = 2;
  return halos;
}
