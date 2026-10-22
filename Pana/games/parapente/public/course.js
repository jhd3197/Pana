// The Galipán course, pure: no Three.js, so rules, bots and Node tests share it.
// Points are authored in the Galipán layout's own units (the map Carreritas
// races on) and scaled to the world like Carreritas does (GALIPAN_SCALE on x
// and z). Heights come from the ground function the caller passes in.
import { clamp } from '../../../engine/random.js';

export const SCALE = 1.2;
// The glide line's closest pass over the ground, in metres.
// The glide line rings sit on: a trim glide (about 11:1) from the deck, never
// closer than `floor` to the ground. Riding the bar drops below it.
export const REFERENCE = Object.freeze({ glide: 11, floor: 22 });

// Launch on the crest of El Ávila, north of the pueblito, facing south.
const LAUNCH = [-80, -410];
// Turnpoints in order. A beacon counts once you fly inside its cylinder at any height.
const BEACONS = [
  { name: 'La Cresta', at: [-60, -320] },
  { name: 'El Pueblito', at: [-110, -205] },
  { name: 'El Mirador', at: [290, -165] },
  { name: 'El Bosque', at: [200, -30] },
  { name: 'Los Girasoles', at: [-90, 235] },
];
// The diana sits on Boca de Tigre's plaza.
const LANDING = { name: 'Boca de Tigre', at: [50, 74] };
// Rising air over sunny slopes; each column is marked in the scene. The
// course glides home without them at trim; they buy height for the speed bar.
const THERMALS = [
  { name: 'la térmica del pueblito', at: [70, -215] },
  { name: 'la térmica del mirador', at: [245, -110] },
  { name: 'la térmica del bosque', at: [125, 45] },
  { name: 'la térmica de los girasoles', at: [-140, 245] },
];
export const SIZES = Object.freeze({ beacon: 30, landing: 24, ring: 7.5, thermal: 30, lift: 6, top: 380, ceiling: 400, slots: 8, slotGap: 5, margin: 220 });

const world = ([x, z]) => ({ x: x * SCALE, z: z * SCALE });
const heading = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const flat = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

export function buildCourse(groundAt, { thermals = 'normal' } = {}) {
  const launch = world(LAUNCH);
  launch.h = 0;
  const lift = SIZES.lift * (thermals === 'strong' ? 1.35 : thermals === 'weak' ? .7 : 1);
  // Everyone leaves the deck at the same height: just above the highest slot.
  const slots = Array.from({ length: SIZES.slots }, (_, i) => ({ x: launch.x + (i - (SIZES.slots - 1) / 2) * SIZES.slotGap, z: launch.z }));
  launch.y = Math.max(...slots.map(s => groundAt(s.x, s.z))) + 7;
  const beacons = BEACONS.map(b => ({ name: b.name, r: SIZES.beacon, ...world(b.at) }));
  const landing = { name: LANDING.name, r: SIZES.landing, ...world(LANDING.at) };
  landing.y = groundAt(landing.x, landing.z);
  const columns = THERMALS.map(t => ({ name: t.name, r: SIZES.thermal, lift, top: SIZES.top, ...world(t.at) }));
  for (const b of beacons) b.ground = groundAt(b.x, b.z);
  for (const t of columns) t.ground = groundAt(t.x, t.z);

  // Rings and relaunch heights sit on the glide line (REFERENCE).
  const legs = [launch, ...beacons, landing], rings = [];
  const length = legs.slice(1).reduce((sum, b, i) => sum + flat(legs[i], b), 0);
  const line = (x, z, along) => Math.max(launch.y - along / REFERENCE.glide, groundAt(x, z) + REFERENCE.floor);
  let along = 0;
  for (let i = 0; i < legs.length - 1; i++) {
    const a = legs[i], b = legs[i + 1], leg = flat(a, b), h = heading(a, b);
    for (const f of i > 0 ? [.4, .72] : []) {
      const x = a.x + Math.sin(h) * leg * f, z = a.z + Math.cos(h) * leg * f;
      rings.push({ id: rings.length, leg: i, x, z, y: line(x, z, along + leg * f), h, r: SIZES.ring });
    }
    along += leg; b.ref = line(b.x, b.z, along) + 25;
  }
  // Farther than SIZES.margin from every point of the course is out of bounds.
  const xs = legs.map(p => p.x), zs = legs.map(p => p.z), m = SIZES.margin;
  const bounds = { minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minZ: Math.min(...zs) - m, maxZ: Math.max(...zs) + m };
  return { launch, slots, beacons, landing, thermals: columns, rings, ceiling: SIZES.ceiling, groundAt, length, bounds };
}

// The next place a pilot is flying to: the next beacon, then the diana.
export function targetOf(course, beacon) { return course.beacons[beacon] || course.landing; }

// Vertical air at a point: thermal cores lift, their edges sink a little.
export function airAt(course, x, y, z) {
  let w = 0;
  for (const t of course.thermals) {
    const d = Math.hypot(t.x - x, t.z - z) / t.r;
    if (d > 3) continue;
    const fade = clamp((t.top - y) / 40, 0, 1);
    w += t.lift * Math.exp(-d * d) * fade - .9 * Math.exp(-((d - 1.9) ** 2) / .3);
  }
  return w;
}

export function outside(course, p) {
  const b = course.bounds;
  return p.x < b.minX || p.x > b.maxX || p.z < b.minZ || p.z > b.maxZ;
}

// Metres still to fly: to the next target, then each leg after it.
export function remaining(course, p) {
  const legs = [...course.beacons.slice(p.beacon), course.landing];
  let sum = flat(p, legs[0]);
  for (let i = 1; i < legs.length; i++) sum += flat(legs[i - 1], legs[i]);
  return sum;
}
