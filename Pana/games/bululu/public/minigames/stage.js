// Shared bits for minigame scenes: a sunny tropical backdrop, the pana
// players, and small helpers. Each minigame builds its own scene with these.

import * as THREE from 'three';
import { buildCharacter } from '/engine/character.js';
import { makeBubble } from '/engine/fx.js';
import { M, mesh, rng, palm, rock } from '/engine/props.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Daylight sky, sun with shadows, distant green mountains.
export function sunnyStage(scene, { ground = 0xd9a46c, grass = true, sky = 0x7cc6f2, horizon = 0xfde2b0 } = {}) {
  const h = new THREE.Color(horizon);
  scene.background = h;
  scene.fog = new THREE.Fog(h, 60, 200);
  const domeGeo = new THREE.SphereGeometry(240, 20, 10);
  const top = new THREE.Color(sky);
  const dc = [];
  const dp = domeGeo.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const c = h.clone().lerp(top, Math.pow(Math.max(0, dp.getY(i) / 240), 0.5));
    dc.push(c.r, c.g, c.b);
  }
  domeGeo.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
  scene.add(new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 1.8));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.2);
  sun.position.set(-12, 26, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 80 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const r = rng(11);
  if (grass) {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(160, 40), M(0x6cae55, { roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);
  }
  if (ground != null) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(18, 28), M(ground, { roughness: 1 }));
    pad.rotation.x = -Math.PI / 2;
    pad.receiveShadow = true;
    scene.add(pad);
  }
  // mountain backdrop
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + 0.7 * (i / 8)) + (r() - 0.5) * 0.15;
    const m = mesh(new THREE.ConeGeometry(18 + r() * 14, 26 + r() * 26, 6), M(i % 2 ? 0x4c8a5a : 0x3f7a55, { roughness: 1 }));
    m.position.set(Math.cos(a) * 120, 10, -Math.sin(a) * 120);
    m.castShadow = false;
    scene.add(m);
  }
  for (let i = 0; i < 10; i++) {
    const a = Math.PI * (0.1 + 0.8 * r());
    const p = palm({ h: 6 + r() * 4, seed: 70 + i });
    p.position.set(Math.cos(a) * (24 + r() * 10), 0, -Math.sin(a) * (22 + r() * 8) + 2);
    scene.add(p);
  }
  for (let i = 0; i < 6; i++) {
    const rk = rock(0.6 + r() * 1.2, 0x9a93a0, i + 20);
    rk.position.set((r() - 0.5) * 50, 0, -12 - r() * 10);
    scene.add(rk);
  }
  return { sun };
}

// The four panas as minigame actors (no pedestal).
export function makeActors(scene, players) {
  return players.map((p, i) => {
    const pana = buildCharacter(p.avatar);
    scene.add(pana.group);
    const bubble = makeBubble();
    scene.add(bubble.sprite);
    return { i, player: p, pana, bubble, x: 0, y: 0, z: 0, vx: 0, vy: 0, score: 0, stun: 0, t: Math.random() * 5 };
  });
}

// Little walk bounce + arm swing while an actor moves.
export function animateActor(a, dt, { moving = 0, open = false, dizzy = false, armsUp = 0 } = {}) {
  a.t += dt * (4 + moving * 10);
  const bob = Math.abs(Math.sin(a.t)) * 0.12 * Math.min(1, moving);
  a.pana.group.position.set(a.x, a.y + bob, a.z);
  const swing = Math.sin(a.t) * 0.5 * Math.min(1, moving);
  a.pana.armL.rotation.x = -0.55 - armsUp + swing;
  a.pana.armR.rotation.x = -0.55 - armsUp - swing;
  a.pana.update(dt, { open, dizzy, look: 0 });
  a.bubble.sprite.position.set(a.x, a.y + 3.4, a.z);
  a.bubble.update(dt);
}
