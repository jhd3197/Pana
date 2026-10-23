// Crowd life: the ring of panas and the NPC neighbours watch the fight itself
// instead of the centre mark, everyone idles on their own seeded rhythm (so
// every peer sees the same crowd) and the neighbours gasp when a trompón lands
// or someone hits the floor. Pure helpers + one per-frame writer; no engine
// changes.
import { rng, seedOf, clamp } from '/engine/random.js';

const num = (seed) => typeof seed === 'number' ? seed : seedOf(seed);

// A per-individual idle rhythm, deterministic from the seed so clients agree.
export function rhythm(seed) {
  const r = rng(num(seed) + 101);
  return { phase: r() * Math.PI * 2, pace: .7 + r() * .8, shift: r() * Math.PI * 2 };
}

// Heading from (x, z) toward the fight's middle, or the ring centre without one.
export function gazeAt(x, z, mid) {
  return Math.atan2((mid ? mid.x : 0) - x, (mid ? mid.z : 0) - z);
}

// The middle of the fighters still standing in the ring, or null.
export function midOf(bodies = []) {
  const inRing = bodies.filter(b => !b.bench && !b.out);
  if (!inRing.length) return null;
  return { x: inRing.reduce((n, b) => n + b.x, 0) / inRing.length, z: inRing.reduce((n, b) => n + b.z, 0) / inRing.length };
}

// Per-neighbour behavior state: its own damping rate so heads don't snap in unison.
export function npcLife(index) {
  const r = rng(index * 31 + 7);
  return { yaw: 0, rate: 1.5 + r() * 2, gasp: 0, idle: rhythm(index * 17 + 3) };
}

const clampTurn = (a) => clamp(Math.atan2(Math.sin(a), Math.cos(a)), -1, 1);

// After npc.update(): the head follows the fight, a gasp snaps it back and the
// idle rhythm keeps the neighbour swaying off-beat from the rest.
export function animateNpc(npc, dt, time, mid) {
  const life = npc.life;
  if (!life) return;
  const want = mid ? clampTurn(gazeAt(npc.group.position.x, npc.group.position.z, mid) - npc.group.rotation.y) : 0;
  life.yaw += (want - life.yaw) * (1 - Math.exp(-dt * life.rate));
  life.gasp = Math.max(0, life.gasp - dt * 2.4);
  npc.neck.rotation.y = life.yaw;
  npc.neck.rotation.x -= life.gasp * .5;
  npc.neck.rotation.z += Math.sin(time * life.idle.pace + life.idle.phase) * .06;
}
