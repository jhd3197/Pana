// The world around the island, so it isn't floating in the middle of
// nowhere: neighbor islands (one with a village, one a smoking volcano), a
// mountain range on the horizon, a lighthouse, boats, and drifting clouds.

import * as THREE from 'three';
import { M, mesh, rng, palm } from '/engine/props.js';
import { casita, bake } from './flora.js';
import { SEA } from './island.js';

// A low-poly mound of an island with a sandy rim.
function isle(r, h, { seed = 1, color = 0x4f9d4a, sand = true } = {}) {
  const rand = rng(seed);
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.85 + rand() * 0.3;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * (h / r), p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  g.add(mesh(geo, M(color, { roughness: 1 }), 0, SEA - 0.4, 0));
  if (sand) {
    const rim = mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.15, 1.2, 18), M(0xecd096, { roughness: 1 }), 0, SEA - 0.3, 0);
    g.add(rim);
  }
  return g;
}

function lighthouse() {
  const g = new THREE.Group();
  const white = M(0xf3efe6, { roughness: 0.7 });
  const red = M(0xd8382f, { roughness: 0.7 });
  for (let i = 0; i < 4; i++) {
    g.add(mesh(new THREE.CylinderGeometry(1.5 - i * 0.18, 1.68 - i * 0.18, 3, 12), i % 2 ? red : white, 0, 1.5 + i * 3, 0));
  }
  g.add(mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 12), M(0x2b2d42), 0, 12.2, 0));
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe08a, emissiveIntensity: 2 }));
  lamp.position.y = 13;
  g.add(lamp);
  g.add(mesh(new THREE.ConeGeometry(1.2, 1.2, 10), red, 0, 14.3, 0));
  // the sweeping beam
  const beam = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 16, 1, true), new THREE.MeshBasicMaterial({
    color: 0xfff1b0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  beam.rotation.z = Math.PI / 2;
  beam.position.x = 30;
  const pivot = new THREE.Group();
  pivot.position.y = 13;
  pivot.add(beam);
  g.add(pivot);
  g.userData.pivot = pivot;
  return g;
}

function sailboat(color = '#ff4b4b') {
  const g = new THREE.Group();
  const hull = mesh(new THREE.BoxGeometry(1.6, 0.8, 4.4), M(0x8a5a33, { roughness: 0.9 }), 0, 0.2, 0);
  g.add(hull);
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 5), M(0x5c3a20), 0, 3, 0));
  const sail = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.2, 3), M(color, { roughness: 0.8 }));
  sail.scale.set(0.15, 1, 1);
  sail.position.set(0, 3, -0.6);
  g.add(sail);
  return g;
}

function cloud(seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf3eefa, emissive: 0x2a2244, roughness: 1, flatShading: true });
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + r() * 3, 1), mat);
    s.position.set((i - n / 2) * 4 + r() * 2, r() * 2, (r() - 0.5) * 4);
    s.scale.y = 0.6;
    g.add(s);
  }
  return g;
}

export function buildScenery(scene) {
  const rand = rng(91);
  const statics = new THREE.Group();
  const anim = [];

  // neighbor islands, some with palms, one with a village
  const isles = [
    { x: -190, z: -120, r: 34, h: 16, palms: 7 },
    { x: 210, z: -90, r: 40, h: 22, palms: 6, village: true },
    { x: 240, z: 90, r: 22, h: 9, palms: 5 },
    { x: -230, z: 110, r: 28, h: 12, palms: 6, village: true },
    { x: 60, z: 230, r: 18, h: 6, palms: 4 },
    { x: -90, z: -260, r: 30, h: 26, palms: 3 },
  ];
  for (const [k, d] of isles.entries()) {
    const g = isle(d.r, d.h, { seed: k + 5 });
    g.position.set(d.x, 0, d.z);
    statics.add(g);
    for (let i = 0; i < d.palms; i++) {
      const a = rand() * Math.PI * 2, rr = d.r * (0.55 + rand() * 0.4);
      const p = palm({ h: 6 + rand() * 4, seed: 300 + k * 10 + i });
      const y = SEA - 0.4 + d.h * Math.sqrt(Math.max(0, 1 - (rr / d.r) ** 2)) * 0.9;
      p.position.set(d.x + Math.cos(a) * rr, y - 0.5, d.z + Math.sin(a) * rr);
      p.scale.setScalar(1.3);
      statics.add(p);
    }
    if (d.village) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 1.2 + 2.2, rr = d.r * 0.75;
        const h = casita({ seed: k * 20 + i });
        const y = SEA - 0.4 + d.h * Math.sqrt(Math.max(0, 1 - (rr / d.r) ** 2)) * 0.85;
        h.position.set(d.x + Math.cos(a) * rr, y - 0.4, d.z + Math.sin(a) * rr);
        h.rotation.y = -a + Math.PI / 2;
        h.scale.setScalar(1.6);
        statics.add(h);
      }
    }
  }

  // a volcano island with a lazy plume of smoke
  const volcano = new THREE.Group();
  volcano.position.set(150, 0, -260);
  const cone = mesh(new THREE.CylinderGeometry(9, 55, 60, 14, 1, true), M(0x5a4a5e, { roughness: 1 }), 0, SEA + 28, 0);
  volcano.add(cone);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(9, 14), new THREE.MeshBasicMaterial({ color: 0xff6a2a }));
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = SEA + 57.5;
  volcano.add(lava);
  statics.add(volcano);
  const smoke = [];
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0x9a90a8, roughness: 1, transparent: true, opacity: 0.7, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(6, 1), smokeMat);
    s.userData.k = i / 9;
    scene.add(s);
    smoke.push(s);
  }

  // mountain ranges on the horizon: the mainland, far away
  const far = M(0x3d3560, { roughness: 1 });
  const farer = M(0x2f2a50, { roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rand() * 0.1;
    const d = 560 + rand() * 60;
    const h = 60 + rand() * 90;
    const m = mesh(new THREE.ConeGeometry(70 + rand() * 50, h, 6), i % 2 ? far : farer, Math.cos(a) * d, SEA + h / 2 - 4, Math.sin(a) * d);
    m.castShadow = false;
    m.receiveShadow = false;
    statics.add(m);
  }

  // the lighthouse on its rock, just off the right shore
  const rockIsle = isle(9, 5, { seed: 77, color: 0x7d7488, sand: false });
  rockIsle.position.set(112, 0, 44);
  statics.add(rockIsle);
  const light = lighthouse();
  light.position.set(112, SEA + 3.2, 44);
  scene.add(light);
  anim.push((t) => (light.userData.pivot.rotation.y = t * 0.6));

  // boats bobbing about
  const boats = [];
  for (const [k, [x, z, c]] of [[90, 95, '#ff4b4b'], [-120, 70, '#ffc629'], [140, -20, '#2ad1b2'], [-60, 130, '#3d7bf2']].entries()) {
    const b = sailboat(c);
    b.position.set(x, SEA, z);
    b.rotation.y = rand() * 6;
    b.userData = { x, z, k };
    scene.add(b);
    boats.push(b);
  }

  // clouds drifting high up
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const c = cloud(i + 1);
    const a = rand() * Math.PI * 2, d = 90 + rand() * 280;
    c.position.set(Math.cos(a) * d, 55 + rand() * 45, Math.sin(a) * d);
    c.scale.setScalar(1 + rand() * 1.4);
    c.userData = { speed: 1 + rand() * 2 };
    scene.add(c);
    clouds.push(c);
  }

  scene.add(bake(statics));

  return {
    update(t, dt) {
      for (const f of anim) f(t);
      for (const s of smoke) {
        const k = (s.userData.k + t * 0.03) % 1;
        s.position.set(150 + k * 30, SEA + 60 + k * 70, -260 + Math.sin(k * 6) * 6);
        s.scale.setScalar(0.6 + k * 2.4);
      }
      smokeMat.opacity = 0.55;
      for (const b of boats) {
        const u = b.userData;
        b.position.y = SEA - 0.1 + Math.sin(t * 1.3 + u.k) * 0.25;
        b.rotation.z = Math.sin(t * 1.1 + u.k) * 0.06;
      }
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt;
        if (c.position.x > 400) c.position.x = -400;
      }
    },
  };
}
