// Hook for extra circuits. The public game ships four (estadio, llanos, delta,
// galipan) and one cup; a private build replaces this file with its own
// premium-tracks.js that exports real data (the pana.sh image overlays it).
// Keep the shapes in step with that file:
//   PREMIUM_TRACKS: track metadata like track-definitions.js, constructors in tracks/<id>.js
//   PREMIUM_CUPS:   { id, name, stages: [{ track, laps, estimatedSeconds }] } (four stages each)
//   PREMIUM_MODES:  menu-flow.js MODES entries: id -> [title, subtitle, art track id]
//   PREMIUM_MUSIC:  { songs: engine song entries, styles: synth groove per track, remap: fallback song per track }
// A store circuit that joins no cup is a PREMIUM_TRACKS entry with `premium: true` and
// `music: { style, song }` (a public groove and recorded song it borrows).
// The consumers load this file with import() and a catch, so it may be absent, and
// the first load stays within its module cap.
export const PREMIUM_TRACKS = [];
export const PREMIUM_IDS = PREMIUM_TRACKS.map(t => t.id);
export const PREMIUM_CUPS = [];
export const PREMIUM_MODES = {};
export const PREMIUM_MUSIC = { songs: {}, styles: {}, remap: {} };
