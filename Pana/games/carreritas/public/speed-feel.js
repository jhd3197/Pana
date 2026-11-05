// Carreritas' sense of speed: reads engine/fx/speed.js for the camera and adds what
// needs the race: pale wind streaks whipping past at the roadside, the wind loop and a
// whoosh for what you pass. Nothing here touches the car; streaks have no collision.
import * as THREE from 'three';
import { sound } from '/engine/fx.js';
import { createWind, vehicleSfx } from '/engine/vehicle-audio.js';
import { createSpeedFeel } from '/engine/fx/speed.js';

const STREAKS = 12, SHOW_FROM = .55, AHEAD = 45, BEHIND = -14, SIDE = 9, SIDE_SPREAD = 6, WHOOSH_GAP = .45, PROP_NEAR = 8;
const TOP_MARGIN = 1.25;   // a car at its top speed sits below full, so a boost still has room.

const matrix = new THREE.Matrix4(), place = new THREE.Vector3(), turn = new THREE.Quaternion(), size = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

function createStreaks(parent) {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.5, 0).scale(.28, .28, 1), material, STREAKS);
  mesh.name = 'speed-streaks'; mesh.frustumCulled = false; mesh.visible = false; parent.add(mesh);
  const spots = Array.from({ length: STREAKS }, (_, i) => ({ x: 0, y: 0, z: 0, placed: false, side: i % 2 ? 1 : -1, near: false }));
  return {
    // Returns how many streaks went by this frame, for the whoosh.
    update(p, fx, fz, ratio) {
      const on = ratio > SHOW_FROM;
      mesh.visible = on;
      if (!on) { for (const s of spots) s.placed = false; return 0; }
      const length = 2 + ratio * 11, heading = Math.atan2(fx, fz);
      material.opacity = Math.min(.5, (ratio - SHOW_FROM) * 1.6);
      turn.setFromAxisAngle(up, heading);
      let passed = 0;
      spots.forEach((s, i) => {
        const along = (s.x - p.x) * fx + (s.z - p.z) * fz;
        if (s.placed && along < BEHIND) passed++;
        if (!s.placed || along < BEHIND || along > AHEAD * 2) {
          // New ones fan out ahead, not all at one distance, and stay put in the world.
          const dist = s.placed ? AHEAD + (i % 4) * 6 : BEHIND + (i + 1) * (AHEAD - BEHIND) / STREAKS;
          const out = s.side * (SIDE + ((i * 7) % 5) / 5 * SIDE_SPREAD);
          s.x = p.x + fx * dist + fz * out; s.z = p.z + fz * dist - fx * out; s.y = p.y + 1.3 + ((i * 3) % 7) * .55; s.placed = true;
        }
        matrix.compose(place.set(s.x, s.y, s.z), turn, size.set(1, 1, length));
        mesh.setMatrixAt(i, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      return passed;
    },
    dispose() { mesh.removeFromParent(); mesh.geometry.dispose(); material.dispose(); mesh.dispose(); },
  };
}

// The real barrels and crates: true for each one that has just gone past.
function propsPassed(list, p, fx, fz, seen) {
  let count = 0;
  for (const q of list || []) {
    if (q.down > 0 || Math.abs(q.x - p.x) > PROP_NEAR || Math.abs(q.z - p.z) > PROP_NEAR) continue;
    const along = (q.x - p.x) * fx + (q.z - p.z) * fz, was = seen.get(q);
    seen.set(q, along);
    if (was > 0 && along <= 0) count++;
  }
  return count;
}

// One per camera, so split screen keeps two feels; sound and streaks follow player one.
export function createCarFeel(race, { top }) {
  const feel = createSpeedFeel(), seen = new WeakMap();
  let streaks = null, streaksIn = null, wind = null, quiet = 0, gap = 0;
  function sounds(dt, amount, passes, ratio) {
    if (!sound.ctx) return;
    wind ??= createWind(sound);
    wind.update(amount);
    // Whatever stops calling (a pause, the results) lets the wind die down by itself.
    clearTimeout(quiet); quiet = setTimeout(() => wind?.update(0), 250);
    gap = Math.max(0, gap - dt);
    if (passes && !gap && ratio > SHOW_FROM) { vehicleSfx.whoosh(ratio); gap = WHOOSH_GAP; }
  }
  return {
    update(dt, p, T, { lead = true, moving = true, fx = 0, fz = 1 } = {}) {
      const out = feel.update(dt, moving ? p.vf : 0, top(p) * TOP_MARGIN, p.boost > 0);
      if (!lead) return out;
      if (streaksIn !== T) { streaks?.dispose(); streaks = T?.group ? createStreaks(T.group) : null; streaksIn = T; }
      const passes = (streaks?.update(p, fx, fz, out.ratio) || 0) + propsPassed(race.props?.props, p, fx, fz, seen);
      sounds(dt, out.wind, passes, out.ratio);
      race.feelLines = out.lines;
      return out;
    },
    // Comfort camera or a battle arena: wind only, nothing that moves the picture.
    calm(dt, p, lead) {
      feel.reset(); race.feelLines = 0;
      if (streaks) { streaks.dispose(); streaks = null; streaksIn = null; }
      if (lead) sounds(dt, feel.update(dt, p.vf, top(p) * TOP_MARGIN).wind, 0, 0);
    },
    dispose() { clearTimeout(quiet); streaks?.dispose(); wind?.stop(); wind = null; },
  };
}
