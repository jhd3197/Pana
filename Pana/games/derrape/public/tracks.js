// Track registry: one definition per map plus the runtime that turns a
// definition into driveable geometry (pointAt / paramOf / offsetOf /
// groundAt) and a scenery group. Tracks are data; game.js drives them.

export { makeTrack } from './track-runtime.js';
import estadio from './tracks/estadio.js';
import desierto from './tracks/desierto.js';
import llanos from './tracks/llanos.js';
import chichi from './tracks/chichi.js';
import selva from './tracks/selva.js';
import paramo from './tracks/paramo.js';
import plaza from './tracks/plaza.js';
import bululu from './tracks/bululu.js';
import salto from './tracks/salto.js';
import delta from './tracks/delta.js';
import cuevas from './tracks/cuevas.js';
import salinas from './tracks/salinas.js';
import puerto from './tracks/puerto.js';

export const TRACKS = [estadio, desierto, llanos, chichi, selva, paramo, plaza, bululu, salto, delta, cuevas, salinas, puerto];

export function getTrack(id) {
  return TRACKS.find((t) => t.id === (id === 'playa' ? 'bululu' : id)) || TRACKS[0];
}
