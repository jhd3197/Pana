// Plants for the island, plus bake(): merges static scenery into one mesh
// per material, so hundreds of trees cost a handful of draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { M, mesh, makeMango, rng } from '/engine/props.js';

const blob = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);

// Round mango tree: chunky trunk, a cloud of leaves, a few ripe mangos.
export function mangoTree({ seed = 1, h = 3.2, fruit = true } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.45, h, 7), M(0x7a5232, { roughness: 1 }), 0, h / 2, 0));
  const leaf = M(r() < 0.5 ? 0x2f8f3e : 0x3a9a44, { roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + r();
    const rr = 1.2 + r() * 0.6;
    g.add(mesh(blob(rr), leaf, Math.cos(a) * 1.1, h + 0.6 + r() * 0.8, Math.sin(a) * 1.1));
  }
  g.add(mesh(blob(1.7), leaf, 0, h + 1.5, 0));
  if (fruit) {
    for (let i = 0; i < 4; i++) {
      const m = makeMango();
      m.scale.setScalar(0.4);
      const a = r() * Math.PI * 2;
      m.position.set(Math.cos(a) * 1.9, h + 0.1, Math.sin(a) * 1.9);
      g.add(m);
    }
  }
  return g;
}

// Big ceiba: tall trunk with buttress roots and a wide, flat crown.
export function ceiba({ seed = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const bark = M(0x9c8a72, { roughness: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.9, 7, 8), bark, 0, 3.5, 0));
  for (let i = 0; i < 4; i++) {
    const root = mesh(new THREE.BoxGeometry(0.25, 1.6, 1.4), bark, Math.cos(i * 1.57) * 0.8, 0.7, Math.sin(i * 1.57) * 0.8);
    root.rotation.y = -i * 1.57;
    g.add(root);
  }
  const leaf = M(0x2e7d3a, { roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.4;
    const crown = mesh(blob(1.6 + r() * 0.5), leaf, Math.cos(a) * 2.4, 7.3 + r() * 0.5, Math.sin(a) * 2.4);
    crown.scale.y = 0.6;
    g.add(crown);
  }
  const top = mesh(blob(2.2), leaf, 0, 7.8, 0);
  top.scale.y = 0.6;
  g.add(top);
  return g;
}

// Mountain pine: stacked cones.
export function pine({ seed = 1, h = 6 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.28, h * 0.35, 6), M(0x6b4a2a, { roughness: 1 }), 0, h * 0.17, 0));
  const leaf = M(r() < 0.5 ? 0x2f6e44 : 0x3a7d4c, { roughness: 0.9 });
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.26;
    g.add(mesh(new THREE.ConeGeometry(1.6 * s, h * 0.42, 7), leaf, 0, h * (0.36 + i * 0.22), 0));
  }
  return g;
}

// Banana plant: a soft stem with long drooping leaves.
export function banana({ seed = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6), M(0x6f9a3a, { roughness: 1 }), 0, 1.1, 0));
  const leaf = M(0x5fae3e, { roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.5;
    const arm = new THREE.Group();
    arm.position.y = 2.1;
    arm.rotation.set(0, -a, 0);
    const l = mesh(new THREE.PlaneGeometry(0.7, 2.4), leaf, 0, 0.6, 1);
    l.rotation.x = -1 - r() * 0.4;
    arm.add(l);
    g.add(arm);
  }
  return g;
}

// A round bush, sometimes with flowers.
export function bush({ seed = 1, flowers = false } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const leaf = M(r() < 0.5 ? 0x3f9a46 : 0x4fab4c, { roughness: 1 });
  for (let i = 0; i < 3; i++) {
    g.add(mesh(blob(0.6 + r() * 0.35), leaf, (r() - 0.5) * 1.1, 0.45, (r() - 0.5) * 1.1));
  }
  if (flowers) {
    const petal = M(['#ff6fa5', '#ffd23f', '#ff8a1f', '#f3e9d7'][Math.floor(r() * 4)], { roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      g.add(mesh(new THREE.SphereGeometry(0.13, 5, 4), petal, (r() - 0.5) * 1.4, 0.8 + r() * 0.3, (r() - 0.5) * 1.4));
    }
  }
  return g;
}

// A little tropical house: colored walls, tin roof, lit window.
export function casita({ seed = 1 } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const walls = ['#ff8a65', '#ffd54f', '#4fc3f7', '#aed581', '#f48fb1', '#fff3e0'][Math.floor(r() * 6)];
  g.add(mesh(new THREE.BoxGeometry(3.2, 2.4, 2.8), M(walls, { roughness: 0.9 }), 0, 1.2, 0));
  const roof = mesh(new THREE.ConeGeometry(2.7, 1.4, 4), M(r() < 0.5 ? 0xb5462f : 0x8a7a6a, { roughness: 0.8 }), 0, 3.1, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.2, 1, 1.05);
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(0.8, 1.5, 0.08), M(0x6b4226), 0.6, 0.75, 1.42));
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.6, 0.08), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb340, emissiveIntensity: 1.2 }), -0.8, 1.4, 1.42));
  return g;
}

// Merge every static mesh under `root` into one mesh per material.
// Meshes with texture maps keep their own (signs are few); everything else is
// flat-shaded, so only positions (and normals for lighting) matter.
export function bake(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  const keep = [];
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (m.material.map || Array.isArray(m.material) || m.material.transparent) { keep.push(m); return; }
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.applyMatrix4(m.matrixWorld);
    // same look = same bucket, even when two builders made separate materials
    const mt = m.material;
    const key = [mt.type, mt.color?.getHex(), mt.emissive?.getHex(), mt.emissiveIntensity, mt.roughness, mt.metalness, mt.side, mt.flatShading].join('|');
    if (!buckets.has(key)) buckets.set(key, { mat: mt, geos: [] });
    buckets.get(key).geos.push(geo);
  });
  const out = new THREE.Group();
  for (const { mat, geos } of buckets.values()) {
    const merged = new THREE.Mesh(mergeGeometries(geos, false), mat);
    merged.castShadow = true;
    merged.receiveShadow = true;
    out.add(merged);
    for (const g of geos) g.dispose();
  }
  for (const m of keep) {
    m.updateMatrixWorld(true);
    const clone = m.clone();
    m.matrixWorld.decompose(clone.position, clone.quaternion, clone.scale);
    out.add(clone);
  }
  return out;
}
