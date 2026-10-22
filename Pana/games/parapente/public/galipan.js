// Galipán in the browser: one layout per page, shared by the course every
// client builds (host, guests' prediction) and the scene. Same map and scale
// as Derrape's Galipán circuit.
import { createLayout } from '/engine/worlds/coastal/galipan-layout.js';
import { createWorld } from '/engine/worlds/coastal/galipan-world.js';
import { buildCourse, SCALE } from './course.js';

let layout = null;
const courses = new Map();
const galipan = () => (layout ??= createLayout());
export const groundAt = (x, z) => galipan().groundH(x / SCALE, z / SCALE);

// Thermal strength is the only option that changes the course.
export function galipanCourse(options = {}) {
  const key = options.thermals || 'normal';
  if (!courses.has(key)) courses.set(key, buildCourse(groundAt, { thermals: key }));
  return courses.get(key);
}

// The Galipán world scaled to the course: lit pueblito, Boca de Tigre,
// sunflower terrace, cable car and the Caracas light carpet below.
export function galipanWorld(group) {
  const L = galipan(), world = createWorld(group, L, (x, z) => L.sampleR(L.RR, x, z).dist * SCALE);
  world.group.scale.set(SCALE, 1, SCALE);
  return { ...world, groundAt: (x, z) => world.groundAt(x / SCALE, z / SCALE) };
}
