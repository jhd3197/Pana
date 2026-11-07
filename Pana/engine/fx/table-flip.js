// A table flip: the table tips over its far edge, the pieces fly and land, then
// everything snaps back. Purely a picture.
//
// It poses each object's matrix for the one render it wraps and gives it back
// straight after, and never writes position, rotation or scale. So nothing can
// be left over, the game keeps moving its pieces underneath (a snapshot that
// lands mid-flip is simply where they return to), and picking stays on the real
// spots.
//
//   const flip = createTableFlip(THREE, { table: () => [table], pieces: () => models, radius: () => 3.5 });
//   flip.start(angleOfSeat, seed);
//   flip.draw(dt, () => stage.draw(dt));   // in place of stage.draw(dt)
import { rng } from '../random.js';
import { FLIP_SECONDS, FLIP_SLAM } from '../play/flip-rules.js';

const RISE = .5, BACK = 1.2, MAX_TILT = 1.75, GRAVITY = 13;
const ease = k => k * k * (3 - 2 * k), clamp01 = k => Math.max(0, Math.min(1, k));

// How far over the table is, 0 to 1: up fast, held, a slam, a small bounce.
export function tiltAt(t) {
  if (t <= 0 || t >= FLIP_SECONDS) return 0;
  if (t < RISE) { const k = 1 - t / RISE; return 1 - k * k * k; }
  if (t < BACK) return 1;
  if (t < FLIP_SLAM) { const k = (t - BACK) / (FLIP_SLAM - BACK); return 1 - k * k * k; }
  return Math.sin((t - FLIP_SLAM) / (FLIP_SECONDS - FLIP_SLAM) * Math.PI) * .025;
}

// One piece's throw, away from the seat that flipped.
export function launchPiece(random, angle) {
  const heading = angle + Math.PI + (random() - .5) * 2.4, speed = 2 + random() * 4.5;
  const axis = [random() - .5, random() - .5, random() - .5], size = Math.hypot(...axis) || 1;
  return { vx: Math.sin(heading) * speed, vz: Math.cos(heading) * speed, vy: 4.5 + random() * 4,
    axis: axis.map(v => v / size), spin: (6 + random() * 12) * (random() < .5 ? -1 : 1),
    delay: random() * .18, back: BACK - .05 + random() * .2 };
}

// Its offset from home at time t: a ballistic arc to the floor, then all of it
// shrinking to exactly nothing by the slam.
export function pieceOffset(f, t, y, floor = .08) {
  const landed = (f.vy + Math.sqrt(f.vy * f.vy + 2 * GRAVITY * Math.max(0, y - floor))) / GRAVITY;
  const time = Math.min(landed, Math.max(0, Math.min(t, f.back) - f.delay));
  const left = 1 - ease(clamp01((t - f.back) / (FLIP_SLAM - f.back)));
  return { x: f.vx * time * left, y: (f.vy * time - GRAVITY / 2 * time * time) * left, z: f.vz * time * left, angle: f.spin * time * left };
}

export function createTableFlip(THREE, { table, pieces, radius = () => 3.5, floor = .08, clock = () => performance.now(), reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches }) {
  const hinge = new THREE.Vector3(), tiltAxis = new THREE.Vector3(), axis = new THREE.Vector3();
  const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), turn = new THREE.Quaternion();
  let run = null;
  const pose = (object, posed) => {
    object.matrix.compose(position, rotation, object.scale);
    object.matrixAutoUpdate = false; object.matrixWorldNeedsUpdate = true; posed.push(object);
  };
  function poseAll(t, posed) {
    const size = reduced() ? .15 : 1, out = run.angle, far = radius(), ox = Math.sin(out), oz = Math.cos(out);
    hinge.set(-ox * far, 0, -oz * far); tiltAxis.set(-oz, 0, ox);
    const tilt = tiltAt(t) * MAX_TILT * size;
    // A static object (matrixAutoUpdate off) keeps a matrix we could not rebuild: it stays out.
    for (const object of table()) {
      if (!object.matrixAutoUpdate) continue;
      position.copy(object.position).sub(hinge).applyAxisAngle(tiltAxis, tilt).add(hinge);
      rotation.setFromAxisAngle(tiltAxis, tilt).multiply(object.quaternion);
      pose(object, posed);
    }
    for (const object of pieces()) {
      if (!object.matrixAutoUpdate) continue;
      let flight = run.flights.get(object);
      if (!flight) run.flights.set(object, flight = launchPiece(run.random, out));
      const off = pieceOffset(flight, t, object.position.y, floor);
      position.set(object.position.x + off.x * size, object.position.y + off.y * size, object.position.z + off.z * size);
      turn.setFromAxisAngle(axis.fromArray(flight.axis), off.angle * size);
      rotation.copy(object.quaternion).multiply(turn);
      pose(object, posed);
    }
  }
  return {
    get active() { return !!run; },
    start(angle, seed = 0) {
      if (run) return false;
      run = { angle, t: 0, started: clock(), random: rng(seed), flights: new Map() };
      return true;
    },
    draw(dt, render) {
      if (run) { run.t = Math.max(run.t + dt, (clock() - run.started) / 1000); if (run.t >= FLIP_SECONDS) run = null; }
      if (!run) return render();
      const posed = [];
      try { poseAll(run.t, posed); render(); } finally {
        for (const object of posed) { object.matrixAutoUpdate = true; object.updateWorldMatrix(false, true); }
      }
    },
  };
}
