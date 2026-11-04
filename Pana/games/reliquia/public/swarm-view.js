// The swarm on this screen: bodies simulated here from the host's heads
// (SwarmFollower in swarm.js), drawn in three draw calls however many there are
// (engine/models/fauna/snake-swarm.js). During the telegraph the cracks open and
// spit dust; afterwards a hiss comes from whichever snake is closest to you.
import { createSnakeInstances } from '/engine/models/fauna/snake-swarm.js';
import { SWARM, SwarmFollower, HEAD } from './swarm.js';

// Past the fog's far end nothing shows, so a snake out there writes no instances.
const DRAW_RANGE = 34;

export function createSwarmView({ scene, puffs }) {
  const follower = new SwarmFollower(), instances = createSnakeInstances({ snakes: SWARM.capacity, segments: SWARM.segments, link: SWARM.link });
  scene.add(instances.group);
  let dustIn = 0, hissIn = 1, shown = false, layout = null, onHiss = null;
  const ground = (x, z) => layout.groundAt(x, z);
  function hide() { if (shown) { instances.clear(); shown = false; } }
  function update(dt, state, me, floor, L) {
    const s = state.swarm;
    if (!s || floor !== s.floor || state.phase !== 'playing') { hide(); return; }
    layout = L; shown = true;
    follower.sync(s, L, state); follower.advance(dt, L, s, state);
    // The cracks, opening over the telegraph.
    const open = s.phase === 'hiss' ? Math.min(1, s.t / SWARM.telegraph) : 1;
    s.holes.forEach((hole, i) => instances.crack(i, hole.x, L.groundAt(hole.x, hole.z), hole.z, hole.h, .25 + .75 * open));
    instances.cracks(Math.min(s.holes.length, 4));
    dustIn -= dt;
    if (s.phase === 'hiss' && dustIn <= 0) {
      dustIn = .28;
      for (const hole of s.holes) puffs.spawn({ x: hole.x, y: .2, z: hole.z }, { color: 0xb8a888, count: 5, spread: .5 + open, size: .5, rise: 1.1, life: .9 });
    }
    // Everything within sight, into the instance buffers.
    const { x, y, z, alive, points } = follower.chains, mx = me?.x ?? 0, mz = me?.z ?? 0, far = DRAW_RANGE * DRAW_RANGE;
    let close = Infinity, cx = 0, cz = 0;
    instances.begin();
    for (let c = 0, n = follower.count || 0; c < n; c++) {
      if (!alive[c] || !(follower.flags[c] & HEAD.alive)) continue;
      const k = c * points, dx = x[k] - mx, dz = z[k] - mz, d = dx * dx + dz * dz;
      if (d < close) { close = d; cx = x[k]; cz = z[k]; }
      if (d < far) instances.chain(x, y, z, k, ground);
    }
    instances.end();
    hissIn -= dt;
    if (hissIn <= 0 && close < 196 && onHiss) { const d = Math.sqrt(close); hissIn = .35 + d * .09 + Math.random() * .4; onHiss(cx, cz); }
  }
  return { update, group: instances.group, follower,
    set onHiss(fn) { onHiss = fn; },
    // A swing seen on this screen, from the event alone.
    scatter(e) {
      follower.scatter(e);
      if (shown) puffs.spawn({ x: e.x, y: .3, z: e.z }, { color: 0xb8a888, count: 7, spread: e.r * .7, size: .35, rise: .9, life: .6 });
    },
    stats: () => ({ segments: instances.body.count, snakes: instances.eyes.count, cracks: instances.holes.count }),
    dispose() { instances.dispose(); } };
}
