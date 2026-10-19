import { random } from '../online-rules.js';
// Shared bits for minigame scenes: a sunny tropical backdrop, the pana
// players, and small helpers. Each minigame builds its own scene with these.

import * as THREE from 'three';
import {createSky} from '/engine/sky.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { makeBubble } from '/engine/fx.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { rock } from '/engine/models/props/rock.js';
import { getSettings } from '/engine/settings.js';

export const rand = (a, b) => a + random() * (b - a);
export const pick = (list) => list[Math.floor(random() * list.length)];

// Daylight sky, sun with shadows, distant green mountains. `decor: false` skips
// the nearby palms and rocks (for scenes whose ground scrolls past the camera).
export function sunnyStage(scene, { ground = 0xd9a46c, grass = true, sky = 0x7cc6f2, horizon = 0xfde2b0, decor = true } = {}) {
  const h = new THREE.Color(horizon);
  scene.background = h;
  scene.fog = new THREE.Fog(h, 60, 200);
  const atmosphere=createSky({horizon,skyTop:sky,skySeed:23,cloudCover:.42});scene.add(atmosphere.mesh);
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 1.8));
  const sun = new THREE.DirectionalLight(0xfff0d6, 2.2);
  sun.position.set(-12, 26, 18);
  sun.castShadow = true;
  // Baja quality draws a quarter of the shadow texels: minigames used to ask
  // for 2048² on every device.
  const shadow = getSettings().quality === 'baja' ? 1024 : 2048;
  sun.shadow.mapSize.set(shadow, shadow);
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
  for (let i = 0; decor && i < 10; i++) {
    const a = Math.PI * (0.1 + 0.8 * r());
    const p = palm({ h: 6 + r() * 4, seed: 70 + i });
    p.position.set(Math.cos(a) * (24 + r() * 10), 0, -Math.sin(a) * (22 + r() * 8) + 2);
    scene.add(p);
  }
  for (let i = 0; decor && i < 6; i++) {
    const rk = rock(0.6 + r() * 1.2, 0x9a93a0, i + 20);
    rk.position.set((r() - 0.5) * 50, 0, -12 - r() * 10);
    scene.add(rk);
  }
  return { sun, update: atmosphere.update };
}

// Which seat this screen plays: online the runner says, offline the first human.
export const localIndexOf = (ctx) => ctx.localIndex ?? ctx.players.findIndex((p) => p.human && !ctx.auto);

// You, among six panas who may wear the same outfit: a ring in your colour
// at your feet and a chevron over your head. It rides on the pana's group.
function youMarker(color) {
  const g = new THREE.Group(), c = new THREE.Color(color);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 36), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.renderOrder = 2;
  const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.34, 3), new THREE.MeshBasicMaterial({ color: c }));
  chevron.rotation.x = Math.PI; chevron.position.y = 2.75;
  const edge = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.44, 3), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide }));
  chevron.add(edge);
  g.add(ring, chevron);
  g.userData.chevron = chevron;
  return g;
}

// The panas as minigame actors (no pedestal). With `ctx`, the local pana
// gets the you-marker (actor.marker).
export function makeActors(scene, players, ctx) {
  const local = ctx ? localIndexOf(ctx) : -1;
  return players.map((p, i) => {
    const pana = buildCharacter(p.avatar);
    scene.add(pana.group);
    const marker = i === local ? youMarker(p.color) : null;
    if (marker) pana.group.add(marker);
    const bubble = makeBubble();
    scene.add(bubble.sprite);
    return { i, player: p, pana, bubble, marker, x: 0, y: 0, z: 0, vx: 0, vy: 0, score: 0, stun: 0, t: random() * 5 };
  });
}

// Little walk bounce + arm swing while an actor moves.
export function animateActor(a, dt, { moving = 0, open = false, dizzy = false, armsUp = 0 } = {}) {
  a.t += dt * (4 + moving * 10);
  const bob = Math.abs(Math.sin(a.t)) * 0.12 * Math.min(1, moving);
  a.pana.group.position.set(a.x, a.y + bob, a.z);
  const swing = Math.sin(a.t) * 0.5 * Math.min(1, moving);
  a.pana.update(dt, { open, dizzy, look: 0, walk: moving });
  a.pana.armL.rotation.x = -0.55 - armsUp + swing;
  a.pana.armR.rotation.x = -0.55 - armsUp - swing;
  a.bubble.sprite.position.set(a.x, a.y + 3.4, a.z);
  a.bubble.update(dt);
  if (a.marker) a.marker.userData.chevron.position.y = 2.75 + Math.sin(a.t * 0.7) * 0.08;
}
