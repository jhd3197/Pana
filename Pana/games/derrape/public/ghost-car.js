// The personal-best ghost: a translucent, non-collidable replica of the
// player's car replaying the stored fastest lap on a loop. Pure playback math
// here (no Three.js, no DOM): game.js builds, presents and disposes the
// replica, and tests/ghost.test.js checks the interpolation in node.
import { FLAG } from './online-rules.js';
import { wrapAngle } from './rules.js';

// The interpolated pose at tMs (milliseconds into the lap) from a stored
// [[tMs, ...pose]] recording: linear on position and speed, shortest arc on
// angles, discrete fields from the newer sample — the same blend
// remote-cars.js applies to an online rival's pose buffer.
export function poseAt(poses, tMs) {
  if (tMs <= poses[0][0]) return poses[0].slice(1);
  const last = poses[poses.length - 1];
  if (tMs >= last[0]) return last.slice(1);
  let lo = 0, hi = poses.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (poses[mid][0] <= tMs) lo = mid; else hi = mid; }
  const a = poses[lo], b = poses[hi], k = (tMs - a[0]) / (b[0] - a[0]);
  const at = (e, i) => e[i + 1];   // entry 0 is the stamp; pose field i sits at i + 1
  const lerp = (i) => at(a, i) + (at(b, i) - at(a, i)) * k;
  const turn = (i) => at(a, i) + wrapAngle(at(b, i) - at(a, i)) * k;
  return [lerp(0), lerp(1), lerp(2), turn(3), turn(4), turn(5), lerp(6), lerp(7), lerp(8), lerp(9),
    at(b, 10), at(b, 11), lerp(12), at(b, 13), at(b, 14)];
}

export function createGhostPlayback(recording) {
  const poses = recording.poses;
  const duration = Math.max(1000, poses[poses.length - 1][0]);
  return {
    lap: recording.lap,
    duration,
    // Looped: the ghost starts with the race clock and comes around again.
    pose(tMs) { return poseAt(poses, ((tMs % duration) + duration) % duration); },
    // Drives a racer record like remote-cars' applyRemote, minus the net
    // delay. Drift and shield flags stay off: the replica sheds no sparks,
    // lays no skid marks and shows no bubble.
    drive(c, tMs, dt = 1 / 60) {
      const p = this.pose(tMs);
      const h0 = c.h ?? 0, vf0 = c.vf ?? 0;
      [c.x, c.y, c.z, c.h, c.pitch, c.roll, c.vf, c.steer, c.spin, c.boost] = p.slice(0, 10);
      const f = p[10];
      c.onGround = !!(f & FLAG.ground);
      c.dizzy = f & FLAG.dizzy ? 1 : 0;
      c.scream = f & FLAG.open ? 0.2 : 0;
      c.drift = 0; c.driftLvl = 0; c.shield = 0;
      c.lap = p[11]; c.prog = p[12]; c.coins = p[14];
      c.vx = Math.sin(c.h) * c.vf; c.vz = Math.cos(c.h) * c.vf;
      if (dt > 0) {
        c.latAcc = wrapAngle(c.h - h0) / dt * c.vf;
        c.longAcc = (c.vf - vf0) / dt;
      }
    },
  };
}

// buildCar() is game.js's: make a racer like the player's, setGhost it, hand
// it over. The ghost never joins race.cars, so collisions, items, hazards and
// placements never see it.
export function spawnGhost({ recording, buildCar }) {
  const car = buildCar();
  const playback = createGhostPlayback(recording);
  const ghost = {
    car, lap: recording.lap,
    update(tMs, dt) { playback.drive(car, tMs, dt); },
  };
  ghost.update(0, 0);   // on the grid pose from the countdown on
  return ghost;
}
