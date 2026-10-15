// The world around the island, so it isn't floating in the middle of
// nowhere: forested coves, sandstone tepuis, waterfalls, a lighthouse,
// fishing villages and drifting clouds.

import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { casita } from '/engine/models/props/island-house.js';
import { bake } from '/engine/models/core/static-batch.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { SEA } from './island-terrain.js';
import { createIslet, createTepui } from './island-landscape.js';

const dayCloud = new THREE.Color(0xffffff);

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
  g.userData.beam = beam;
  g.userData.lamp = lamp;
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

// Soft, shaded cumulus silhouettes. Four reusable textures replace dozens of
// lit polyhedra; the alpha falloff gives a feathery edge from any camera angle.
function cloudTexture(seed, smoke = false) {
  const r = rng(seed), canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const puff = (x, y, radius) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.68, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.85, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  };
  if (smoke) puff(256, 128, 117);
  else {
    // High central towers and a broad low base, rather than a row of bubbles.
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      puff(70 + t * 365, 157 - Math.sin(t * Math.PI) * (35 + r() * 35), 47 + Math.sin(t * Math.PI) * 28 + r() * 15);
    }
    for (let i = 0; i < 8; i++) puff(90 + i * 46, 171 + r() * 7, 40 + r() * 12);
  }
  // Shade the unified silhouette, so overlapping puffs don't leave dark rings.
  ctx.globalCompositeOperation = 'source-in';
  const shade = ctx.createLinearGradient(0, 40, 0, 218);
  shade.addColorStop(0, '#ffffff');
  shade.addColorStop(0.45, '#f9fcff');
  shade.addColorStop(1, '#bdcfde');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 512, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildScenery(scene) {
  const rand = rng(91);
  const statics = new THREE.Group();
  const anim = [];

  // neighbor islands, some with palms, one with a village
  const isles = [
    { x: -240, z: -110, r: 53, h: 25, palms: 7 },
    { x: 245, z: -35, r: 57, h: 33, palms: 8, village: true },
    { x: 280, z: 150, r: 35, h: 13, palms: 5 },
    { x: -270, z: 160, r: 49, h: 18, palms: 6, village: true },
    { x: 20, z: 300, r: 30, h: 9, palms: 5 },
  ];
  for (const [k, d] of isles.entries()) {
    const island = createIslet({ radius: d.r, height: d.h, seed: k + 5 });
    island.group.position.set(d.x, 0, d.z);
    scene.add(island.group);
    for (let i = 0; i < d.palms; i++) {
      const a = rand() * Math.PI * 2, rr = d.r * (0.55 + rand() * 0.22);
      const p = palm({ h: 6 + rand() * 4, seed: 300 + k * 10 + i });
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.85;
      const y = island.heightAt(x, z);
      p.position.set(d.x + x, y - 0.1, d.z + z);
      p.scale.setScalar(1.3);
      statics.add(p);
    }
    if (d.village) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 0.75 + 0.4, rr = d.r * 0.78;
        const h = casita({ seed: k * 20 + i });
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.85;
        const y = island.heightAt(x, z);
        h.position.set(d.x + x, y, d.z + z);
        h.rotation.y = -a + Math.PI / 2;
        h.scale.setScalar(1.6);
        statics.add(h);
      }
    }
  }

  // A waterfall landmark backed by overlapping mesas and wooded ridgelines.
  const tepuis = [];
  for (const d of [
    { x: 130, z: -310, width: 118, depth: 78, height: 135, seed: 8, waterfall: true },
    { x: -230, z: -415, width: 180, depth: 100, height: 157, seed: 21 },
    { x: 385, z: -445, width: 155, depth: 100, height: 105, seed: 44 },
  ]) {
    const tepui = createTepui(d);
    tepui.group.position.set(d.x, 0, d.z);
    scene.add(tepui.group); tepuis.push(tepui);
  }
  for (const [x, z, radius, height, seed] of [[-480,-250,150,65,52],[530,-140,165,70,53],[-460,230,120,40,54],[430,360,125,45,55]]) {
    const ridge = createIslet({ radius, height, seed });
    ridge.group.position.set(x, 0, z); scene.add(ridge.group);
  }

  // the lighthouse on its rock, just off the right shore
  const rockIsle = createIslet({ radius: 12, height: 5, seed: 77, wooded: false });
  rockIsle.group.position.set(168, 0, 65);
  scene.add(rockIsle.group);
  const light = lighthouse();
  light.position.set(168, rockIsle.heightAt(0, 0), 65);
  scene.add(light);
  anim.push((t) => (light.userData.pivot.rotation.y = t * 0.6));

  // boats bobbing about
  const boats = [];
  for (const [k, [x, z, c]] of [[100, 148, '#ff4b4b'], [-170, 85, '#ffc629'], [180, -20, '#2ad1b2'], [-60, 175, '#3d7bf2']].entries()) {
    const b = sailboat(c);
    b.position.set(x, SEA, z);
    b.rotation.y = rand() * 6;
    b.userData = { x, z, k };
    scene.add(b);
    boats.push(b);
  }

  // clouds drifting high up
  const clouds = [];
  const cloudMats = Array.from({ length: 4 }, (_, i) => new THREE.SpriteMaterial({ map: cloudTexture(i + 20), color: 0xffffff, transparent: true, opacity: 0.94, depthWrite: false }));
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Sprite(cloudMats[i % cloudMats.length]);
    const a = rand() * Math.PI * 2, d = 470 + rand() * 100;
    c.position.set(Math.cos(a) * d, 150 + rand() * 55, Math.sin(a) * d);
    const width = 35 + rand() * 35;
    c.scale.set(width, width * 0.5, 1);
    c.userData = { angle: a, radius: d, speed: 0.0015 + rand() * 0.002 };
    scene.add(c);
    clouds.push(c);
  }

  scene.add(bake(statics));

  return {
    update(t, dt, daylight = 1) {
      for (const f of anim) f(t);
      light.userData.beam.material.opacity = (1 - daylight) * 0.14;
      light.userData.lamp.material.emissiveIntensity = 0.4 + (1 - daylight) * 2;
      for (const mat of cloudMats) mat.color.set(0x7388b1).lerp(dayCloud, daylight);
      for (const tepui of tepuis) tepui.update(t, daylight);
      for (const b of boats) {
        const u = b.userData;
        b.position.y = SEA - 0.1 + Math.sin(t * 1.3 + u.k) * 0.25;
        b.rotation.z = Math.sin(t * 1.1 + u.k) * 0.06;
      }
      for (const c of clouds) {
        c.userData.angle += c.userData.speed * dt;
        c.position.x = Math.cos(c.userData.angle) * c.userData.radius;
        c.position.z = Math.sin(c.userData.angle) * c.userData.radius;
      }
    },
  };
}
