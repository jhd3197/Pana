// Each circuit's song; the player itself is shared in /engine/music.js.
// Recorded songs are `carreritas-<track>`; TRACK_STYLE is the synth groove a
// circuit falls back to while its recording loads or if it is missing.
// Extra circuits bring their own songs, grooves and fallbacks via premium-tracks.js.
import { SONGS } from '/engine/music.js';
import { PREMIUM_MUSIC } from './premium-tracks.js';
export { STYLES, SONGS, noteFor, createMusic } from '/engine/music.js';
Object.assign(SONGS, PREMIUM_MUSIC.songs);
export const TRACK_STYLE = { estadio: 'estadio', llanos: 'joropo', delta: 'calipso', galipan: 'andina', ...PREMIUM_MUSIC.styles };
export const GARAGE_SONG = 'carreritas-garaje', RESULTS_SONG = 'carreritas-podio';
const SONG_REMAP = { galipan: 'llanos', ...PREMIUM_MUSIC.remap };
export const songFor = (trackId, mode) => mode === 'battle' ? 'carreritas-batalla' : `carreritas-${SONG_REMAP[trackId] || trackId}`;
// The jingle over the results: a fanfare for first, a friendly one otherwise.
export const finishSting = (won) => won ? 'carreritas-gana' : 'carreritas-meta';
