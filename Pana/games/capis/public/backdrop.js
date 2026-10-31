// The world behind and below the playing field: Llanos sky, the river the
// banks fall into, savanna and far hills that slide by with the camera
// (real perspective parallax), moriche palms, and the player's own pana
// cheering from a dock on the left bank.
import * as THREE from 'three';
import { moriche } from '/engine/models/vegetation/moriche.js';
import { reeds } from '/engine/models/vegetation/reeds.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { fbm2 } from '/engine/random.js';

const SKY_TOP = '#5fb2ea', SKY_LOW = '#ffe2b0', RIVER = '#3f8fb0', RIVER_DEEP = '#235f7d', SAVANNA = '#9cbc58', HILLS = '#86a9a0';

// A long ridge silhouette standing at depth z: noise along its top.
function ridge(width, base, height, z, color, seed) {
  const shape = new THREE.Shape(), x0 = -width / 2;
  shape.moveTo(x0, base);
  for (let i = 0; i <= 80; i++) { const x = x0 + width * i / 80; shape.lineTo(x, base + height * (.35 + .65 * fbm2(i * .09, seed))); }
  shape.lineTo(-x0, base); shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color }));
  mesh.position.z = z; return mesh;
}

export function createBackdrop(scene, map) {
  const group = new THREE.Group(), mid = map.width / 2; scene.add(group);
  scene.background = new THREE.Color(SKY_LOW);
  scene.fog = new THREE.Fog(SKY_LOW, 90, 260);
  // Sky: a vertical gradient far behind everything.
  const sky = new THREE.PlaneGeometry(900, 260, 1, 8), colors = [], top = new THREE.Color(SKY_TOP), low = new THREE.Color(SKY_LOW);
  for (let i = 0; i < sky.attributes.position.count; i++) { const k = THREE.MathUtils.clamp((sky.attributes.position.getY(i) + 40) / 150, 0, 1); const c = low.clone().lerp(top, k); colors.push(c.r, c.g, c.b); }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const skyMesh = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false }));
  skyMesh.position.set(mid, 80, -200); group.add(skyMesh);
  // The river: a wide sheet at the water line, and its deep face in front.
  const river = new THREE.Mesh(new THREE.PlaneGeometry(600, 120), new THREE.MeshStandardMaterial({ color: RIVER, roughness: .25, metalness: .15, transparent: true, opacity: .9 }));
  river.rotation.x = -Math.PI / 2; river.position.set(mid, map.water, -30); group.add(river);
  const deep = new THREE.Mesh(new THREE.PlaneGeometry(600, 30), new THREE.MeshBasicMaterial({ color: RIVER_DEEP, transparent: true, opacity: .55, depthWrite: false }));
  deep.position.set(mid, map.water - 15, 3.2); group.add(deep);
  // Savanna beyond the river, then two ranges of hills.
  const savanna = new THREE.Mesh(new THREE.PlaneGeometry(600, 120), new THREE.MeshLambertMaterial({ color: SAVANNA }));
  savanna.rotation.x = -Math.PI / 2; savanna.position.set(mid, map.water + 1.2, -85); group.add(savanna);
  group.add(ridge(420, map.water, 16, -110, '#8fb35a', 3), ridge(520, map.water, 34, -170, HILLS, 9));
  group.children.at(-2).position.x = mid; group.children.at(-1).position.x = mid;
  // Moriche palms on the far bank and reeds at the water's edge.
  const palms = [];
  [[-14, -26, 12, 3], [8, -34, 14, 5], [30, -40, 11, 8], [52, -30, 13, 11], [74, -38, 15, 14], [96, -28, 12, 17], [118, -36, 14, 19]].forEach(([x, z, h, seed]) => {
    const palm = moriche({ seed, h }); palm.position.set(x, map.water + 1.2, z); group.add(palm); palms.push(palm);
  });
  for (const [x, z, s] of [[-3, -3, 1.3], [1, -6, 1], [map.width + 3, -3, 1.2], [map.width - 1, -7, 1.1]]) { const r = reeds({ seed: x | 0 }); r.scale.setScalar(s); r.position.set(x, map.water - .2, z); group.add(r); }
  // The player's pana on a dock by the left bank.
  const dock = new THREE.Mesh(new THREE.BoxGeometry(3.2, .3, 2.4), new THREE.MeshLambertMaterial({ color: '#8a5a34' }));
  dock.position.set(-3.5, map.water + .4, -2.5); group.add(dock);
  for (const [dx, dz] of [[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 3), dock.material); post.position.set(-3.5 + dx, map.water - 1, -2.5 + dz); group.add(post);
  }
  const pana = buildCharacter(loadAvatar());
  pana.group.position.set(-3.5, map.water + .55, -2.5); pana.group.rotation.y = .5; pana.group.scale.setScalar(1.5); group.add(pana.group);
  let mood = 'idle', cheer = 0, time = 0;
  return {
    pana,
    // 'cheer' (a good shot), 'ouch' (our capi was hit), 'win', 'lose'.
    react(kind) {
      if (kind === 'cheer') { pana.bounce(1.2); cheer = 1.2; }
      else if (kind === 'ouch') pana.stagger(.8, 0);
      else mood = kind;
    },
    update(dt) {
      time += dt; cheer = Math.max(0, cheer - dt);
      if (mood === 'win' && Math.sin(time * 5) > .95) pana.bounce(.8);
      pana.update(dt, { dizzy: mood === 'lose' });
      for (const palm of palms) palm.userData.tick?.(time);
      river.material.opacity = .86 + Math.sin(time * 1.3) * .04;
    },
    dispose() { pana.dispose(); group.traverse(o => { o.geometry?.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m?.dispose?.()); }); group.removeFromParent(); },
  };
}
