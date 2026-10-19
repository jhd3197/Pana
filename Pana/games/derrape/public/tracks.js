// Track registry: one definition per map plus the runtime that turns a
// definition into driveable geometry (pointAt / paramOf / offsetOf /
// groundAt) and a scenery group. Tracks are data; game.js drives them.
//
// Menus need only names and blurbs (track-definitions.js). A map's own module
// (route, scenery and world, ~100 modules each) loads when it is picked:
// loadTrack(id) fills that map's entry in TRACKS with its full definition.

export { makeTrack } from './track-runtime.js';
import { TRACK_DEFINITIONS } from './track-definitions.js';

export const TRACKS = TRACK_DEFINITIONS.map(t => ({ ...t }));
const loads = new Map(), loaded = new Set();

export function getTrack(id) {
  return TRACKS.find((t) => t.id === (id === 'playa' ? 'bululu' : id)) || TRACKS[0];
}

export const trackLoaded = (id) => loaded.has(getTrack(id).id);

// The full definition of a map, importing tracks/<id>.js the first time.
export function loadTrack(id) {
  const def = getTrack(id);
  if (!loads.has(def.id)) {
    loads.set(def.id, import(`./tracks/${def.id}.js`).then(m => { Object.assign(def, m.default); loaded.add(def.id); return def; })
      .catch(err => { loads.delete(def.id); throw err; }));
  }
  return loads.get(def.id);
}

export const loadTracks = () => Promise.all(TRACKS.map(t => loadTrack(t.id)));
