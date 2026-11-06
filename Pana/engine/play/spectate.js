// Watching the round while you are out: a short look at whoever got you (the
// killcam), then a follow camera behind a living pana (next / previous) or an
// overhead view of the whole court. Pure numbers, no Three.js and no
// allocation per frame: the game fills one reused id list, calls update() every
// frame and copies the camera rig's position and look point onto its camera.
//
//   const watch = createSpectator({ killcam: 1.6 }), rig = createSpectateCamera();
//   targets.length = 0; for (const p of players) if (alive(p)) targets.push(p.id);
//   watch.update(dt, { down, killer, targets });   // 'off' | 'killcam' | 'watch'
//   watch.next(); watch.prev(); watch.toggle();    // keys, buttons, pad
//   followPose(pose, head, aim, { clip });  rig.step(dt, pose);
//   camera.position.set(rig.pos.x, rig.pos.y, rig.pos.z); camera.lookAt(rig.look.x, …);
//
// It only reads what the room already sends everyone (positions and aim); a
// game that hides rivals from the dead passes only teammates as targets.

// The id `step` places after `current` in `ids`, wrapping; the first (or last,
// stepping back) when `current` is not there; null for an empty list.
export function cycleTarget(ids, current, step = 1) {
  const n = ids.length;
  if (!n) return null;
  const i = ids.indexOf(current);
  if (i < 0) return ids[step < 0 ? n - 1 : 0];
  return ids[(((i + Math.sign(step || 1)) % n) + n) % n];
}

// The target to keep when `current` left `targets`: the next one that was after
// it in the previous order, else the first target, else null.
export function nextLiving(previous, targets, current) {
  if (targets.includes(current)) return current;
  const n = previous.length, i = previous.indexOf(current);
  if (i >= 0) for (let k = 1; k < n; k++) { const id = previous[(i + k) % n]; if (targets.includes(id)) return id; }
  return targets.length ? targets[0] : null;
}

export function createSpectator({ killcam = 1.6 } = {}) {
  let mode = 'off', view = 'follow', target = null, killer = null, time = 0;
  const order = [];
  const remember = targets => { order.length = targets.length; for (let i = 0; i < targets.length; i++) order[i] = targets[i]; };
  const watching = () => { if (mode === 'killcam') mode = 'watch'; return mode === 'watch'; };
  const step = by => {
    if (!watching()) return null;
    if (view === 'overhead' && target !== null) { view = 'follow'; if (by > 0 && order.includes(target)) return target; }
    return target = cycleTarget(order, target, by);
  };
  return {
    // down: the player is out (respawning or eliminated). killer: who got
    // them (read once, on the way down). targets: the ids that may be watched.
    update(dt, { down, killer: by = null, targets }) {
      if (!down) { if (mode !== 'off') { mode = 'off'; target = killer = null; time = 0; order.length = 0; } return mode; }
      if (mode === 'off') {
        mode = killcam > 0 ? 'killcam' : 'watch'; time = 0; killer = by;
        target = targets.includes(by) ? by : targets.length ? targets[0] : null;
      } else {
        if (mode === 'killcam' && (time += dt) >= killcam) mode = 'watch';
        target = nextLiving(order, targets, target);
      }
      remember(targets);
      return mode;
    },
    // Next / previous pana. From the overhead it goes back to following.
    next() { return step(1); },
    prev() { return step(-1); },
    // Follow ↔ overhead. The choice stays for the next time you are out.
    toggle() { if (!watching()) return view; return view = view === 'follow' ? 'overhead' : 'follow'; },
    get mode() { return mode; },
    get active() { return mode !== 'off'; },
    // What the camera shows: 'off', 'killcam', 'follow' or 'overhead' (follow
    // with nobody left to follow is overhead).
    get shot() { return mode === 'off' ? 'off' : mode === 'killcam' ? 'killcam' : view === 'follow' && target !== null ? 'follow' : 'overhead'; },
    get view() { return view; },
    get target() { return target; },
    get killer() { return killer; },
    get time() { return time; },
  };
}

const vec = () => ({ x: 0, y: 0, z: 0 });
const set = (v, x, y, z) => { v.x = x; v.y = y; v.z = z; return v; };
export const createPose = () => ({ pos: vec(), look: vec() });

// Behind a pana's shoulder, looking where they aim. head: { x, y, z } (eye
// height); aim: { x, z } (any length). clip(ox, oy, oz, dx, dy, dz, max)
// returns how far the camera may go from the head along the unit direction
// before cover (the game's own camera bounds); the camera stops `margin`
// short of it so it never pokes through a wall.
export function followPose(out, head, aim, { distance = 3.4, height = 1.1, ahead = 4, margin = .3, clip = null } = {}) {
  const length = Math.hypot(aim.x, aim.z) || 1, fx = aim.x / length, fz = aim.z / length;
  const bx = -fx * distance, by = height, bz = -fz * distance, reach = Math.hypot(bx, by, bz);
  let room = reach;
  if (clip) room = Math.max(0, Math.min(reach, clip(head.x, head.y, head.z, bx / reach, by / reach, bz / reach, reach + margin) - margin));
  const k = room / reach;
  set(out.pos, head.x + bx * k, head.y + by * k, head.z + bz * k);
  set(out.look, head.x + fx * ahead, head.y - .35, head.z + fz * ahead);
  return out;
}

// High over the court's centre, the whole court in frame. court: { x, z } are
// half sizes around (cx, cz); fov is the camera's vertical field in degrees.
// tilt leans the view a little so panas read as people, not dots.
// max caps the height (a tall phone screen crops the long sides instead of
// climbing into the fog).
export function overheadPose(out, { cx = 0, cz = 0, x, z }, fov, aspect, { tilt = .3, pad = 1.08, max = Infinity } = {}) {
  const half = Math.tan(fov * Math.PI / 360), h = Math.min(max, Math.max(z, x / Math.max(.1, aspect)) / half * pad);
  set(out.pos, cx, h, cz + h * tilt);
  set(out.look, cx, 0, cz);
  return out;
}

// A camera that eases to each pose: smooth turns toward the killer, between
// targets and between follow and overhead. A long move rises over the court
// (arc) so it passes over walls rather than through them.
export function createSpectateCamera({ rate = 4, look = 5, arc = .35, maxArc = 14 } = {}) {
  const pos = vec(), at = vec();
  let ready = false;
  const ease = (v, to, k) => { v.x += (to.x - v.x) * k; v.y += (to.y - v.y) * k; v.z += (to.z - v.z) * k; };
  return {
    pos, look: at,
    // Where the camera is now (the first-person eye and a point ahead of it).
    start(px, py, pz, lx, ly, lz) { set(pos, px, py, pz); set(at, lx, ly, lz); ready = true; },
    reset() { ready = false; },
    get ready() { return ready; },
    step(dt, pose, { snap = false } = {}) {
      if (!ready || snap) { set(pos, pose.pos.x, pose.pos.y, pose.pos.z); set(at, pose.look.x, pose.look.y, pose.look.z); ready = true; return this; }
      const far = Math.hypot(pose.pos.x - pos.x, pose.pos.z - pos.z), lift = Math.min(maxArc, far * arc);
      const k = 1 - Math.exp(-dt * rate), y = pose.pos.y;
      pose.pos.y = y + lift; ease(pos, pose.pos, k); pose.pos.y = y;
      ease(at, pose.look, 1 - Math.exp(-dt * look));
      return this;
    },
    // How far the camera still is from a pose (tests, settling checks).
    distance(pose) { return Math.hypot(pose.pos.x - pos.x, pose.pos.y - pos.y, pose.pos.z - pos.z); },
  };
}
