// Each circuit's song; the player itself is shared in /engine/music.js.
// Recorded songs are `derrape-<track>`; TRACK_STYLE is the synth groove a
// circuit falls back to while its recording loads or if it is missing.
export { STYLES, SONGS, noteFor, createMusic } from '/engine/music.js';
export const TRACK_STYLE = { estadio: 'estadio', desierto: 'tambor', llanos: 'joropo', chichi: 'calipso', selva: 'tambor', paramo: 'andina', plaza: 'gaita', bululu: 'calipso', salto:'tambor',delta:'calipso',cuevas:'andina',salinas:'gaita',puerto:'calipso' };
export const GARAGE_SONG = 'derrape-garaje', RESULTS_SONG = 'derrape-podio';
export const songFor = (trackId, mode) => mode === 'battle' ? 'derrape-batalla' : `derrape-${trackId}`;
// The jingle over the results: a fanfare for first, a friendly one otherwise.
export const finishSting = (won) => won ? 'derrape-gana' : 'derrape-meta';
