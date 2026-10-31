// Each circuit's song; the player itself is shared in /engine/music.js.
// Recorded songs are `carreritas-<track>`; TRACK_STYLE is the synth groove a
// circuit falls back to while its recording loads or if it is missing.
// Extra circuits bring their own songs, grooves and fallbacks via premium-tracks.js.
import { SONGS } from '/engine/music.js';
const { PREMIUM_MUSIC = { songs: {}, styles: {}, remap: {} }, PREMIUM_TRACKS = [] } = await import('./premium-tracks.js').catch(() => ({}));
// Store circuits without a cup carry `music: { style, song }` and borrow a public groove and song.
const BORROWED = Object.fromEntries(PREMIUM_TRACKS.filter(t => t.music).map(t => [t.id, t.music]));
export { STYLES, SONGS, noteFor, createMusic } from '/engine/music.js';
Object.assign(SONGS, PREMIUM_MUSIC.songs);
export const TRACK_STYLE = { estadio: 'estadio', llanos: 'joropo', delta: 'calipso', galipan: 'andina', ...PREMIUM_MUSIC.styles, ...Object.fromEntries(Object.entries(BORROWED).map(([id, m]) => [id, m.style])) };
export const GARAGE_SONG = 'carreritas-garaje', RESULTS_SONG = 'carreritas-podio';
const SONG_REMAP = { galipan: 'llanos', ...PREMIUM_MUSIC.remap, ...Object.fromEntries(Object.entries(BORROWED).map(([id, m]) => [id, m.song])) };
export const songFor = (trackId, mode) => mode === 'battle' ? 'carreritas-batalla' : `carreritas-${SONG_REMAP[trackId] || trackId}`;
// The jingle over the results: a fanfare for first, a friendly one otherwise.
export const finishSting = (won) => won ? 'carreritas-gana' : 'carreritas-meta';
