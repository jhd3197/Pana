import { locKey } from '/engine/i18n.js';
// The rueda's songs and their charts: pure data and functions (no DOM), so the
// host, every client's local music and the Node tests read the same notes.
// Times are in beats from the song's first beat (4/4 bars); a song plays two
// bars of groove, then 8-bar phrases, then one closing bar. Station charts are
// built from bar patterns, so every client computes the same notes.

export const BEATS_PER_BAR = 4, INTRO_BARS = 2, PHRASE_BARS = 8;
export const COUNT_IN = 4; // beats of sticks before beat 0

// Station order is also the order a new drummer is offered: Palo is the
// easiest, so a pana's first turn on the drums starts there.
export const STATIONS = ['palo', 'mano', 'charrasca', 'caracol'];
// Station names show through stationName() (hud.js); `what`, `hint` and the
// tempo are locKey() and shown with loc(). Song titles stay Spanish.
export const STATION_INFO = {
  palo: { name: 'Palo', what: locKey('el tambor largo con palos'), lanes: 1, hint: locKey('Espacio en el contratiempo') },
  mano: { name: 'Mano', what: locKey('el culo e\' puya'), lanes: 2, hint: locKey('← y → (o F y J), cada mano su cuero') },
  charrasca: { name: 'Charrasca', what: locKey('la charrasca de metal'), lanes: 1, hint: locKey('Mantén Espacio y suelta en el golpe') },
  caracol: { name: 'Caracol', what: locKey('el caracol'), lanes: 1, hint: locKey('Mantén Espacio en los momentos grandes') },
};

export const SONGS = [
  { id: 'brisa', name: 'Brisa de Choroní', tempo: locKey('Lento'), bpm: 96, bars: 26, level: 0 }, // i18n-ignore: song title
  { id: 'casita', name: 'Tambor de la casita rosada', tempo: locKey('Medio'), bpm: 112, bars: 34, level: 1 }, // i18n-ignore: song title
  { id: 'candela', name: 'Candela en la arena', tempo: locKey('Rápido'), bpm: 128, bars: 42, level: 2 }, // i18n-ignore: song title
];
// The ¡Golpe! mode has no chart: a steady groove under the MCP's patterns.
export const GOLPE_SONG = { id: 'golpe', name: '¡Golpe!', tempo: locKey('Medio'), bpm: 100, bars: 1024, level: 1 }; // i18n-ignore: the call

export const songFor = (track) => track === 'golpe' ? GOLPE_SONG : SONGS[((track % SONGS.length) + SONGS.length) % SONGS.length];
export const secondsPerBeat = (song) => 60 / song.bpm;
export const songBeats = (song) => song.bars * BEATS_PER_BAR;
// Phrase index of a beat (-1 in the intro): calls, duelos and caracol hits follow phrases.
export const phraseOf = (song, beat) => beat < INTRO_BARS * BEATS_PER_BAR ? -1 : Math.floor((beat / BEATS_PER_BAR - INTRO_BARS) / PHRASE_BARS);
// Every third phrase is a duelo: the two dancers get different calls.
export const isDuelo = (song, beat) => phraseOf(song, beat) % 3 === 2;
// Beats with music to play: after the intro, before the closing bar.
export const playable = (song, beat) => beat >= INTRO_BARS * BEATS_PER_BAR && beat < songBeats(song) - BEATS_PER_BAR;
// Relevo: a pana may jump into the center only on the "¡Golpe!" that opens each two bars.
export const GOLPE_EVERY = 8;
export const isGolpeBeat = (song, beat) => playable(song, beat) && Number.isInteger(beat) && (beat - INTRO_BARS * BEATS_PER_BAR) % GOLPE_EVERY === 0;

// Bar patterns per level: [beat in bar, lane] for Mano; beats for the rest.
const MANO = [
  [[[0, 0], [1, 1], [2, 0], [3, 1]], [[0, 0], [1, 1], [2, 0], [2.5, 0], [3, 1]], [[0, 0], [2, 1], [3, 0], [3.5, 1]]],
  [[[0, 0], [.5, 1], [1.5, 0], [2, 1], [3, 0], [3.5, 1]], [[0, 0], [1, 1], [1.5, 1], [2.5, 0], [3, 1]], [[0, 1], [.5, 0], [1, 1], [2, 0], [2.5, 1], [3.5, 0]]],
  [[[0, 0], [.5, 1], [1, 0], [1.5, 1], [2.5, 0], [3, 1], [3.5, 0]], [[0, 0], [.5, 0], [1, 1], [2, 0], [2.5, 1], [3, 0], [3.5, 1]], [[0, 1], [.5, 0], [1.5, 1], [2, 0], [2.5, 1], [3, 1], [3.5, 0]]],
];
const PALO = [[.5, 2.5], [.5, 1.5, 2.5, 3.5], [.5, 1.5, 2.5, 3, 3.5]];
// Charrasca holds: [start, length] in beats.
const CHARRASCA = [[[0, 1.5], [2, 1.5]], [[0, 1], [2, 1]], [[0, .5], [1, .5], [2, .5], [3, .5]]];

const charts = new Map();
// A station's notes for a song: [{ i, beat, lane, len }], sorted by beat.
export function chart(song, station) {
  const key = `${song.id}:${station}`;
  if (charts.has(key)) return charts.get(key);
  const notes = [], level = song.level, first = INTRO_BARS, last = song.bars - 1;
  for (let bar = first; bar < last && song.id !== 'golpe'; bar++) {
    const at = bar * BEATS_PER_BAR, inPhrase = (bar - first) % PHRASE_BARS, phrase = Math.floor((bar - first) / PHRASE_BARS);
    // The bar before each new phrase breathes: only the caracol and a palo pickup.
    const breath = inPhrase === PHRASE_BARS - 1;
    if (station === 'mano' && !breath) {
      const set = MANO[level], pattern = set[(inPhrase + phrase) % 4 === 3 ? 2 : inPhrase % 2];
      for (const [b, lane] of pattern) notes.push({ beat: at + b, lane, len: 0 });
    }
    if (station === 'palo') for (const b of breath ? [2.5, 3.5] : PALO[level]) notes.push({ beat: at + b, lane: 0, len: 0 });
    if (station === 'charrasca' && !breath) for (const [b, len] of CHARRASCA[level]) notes.push({ beat: at + b, lane: 0, len });
    if (station === 'caracol') {
      if (inPhrase === 0) notes.push({ beat: at, lane: 0, len: 4 });
      if (level === 2 && inPhrase === 4) notes.push({ beat: at, lane: 0, len: 2 });
      if (breath && phrase % 2 === 1) notes.push({ beat: at + 2, lane: 0, len: 1.5 });
    }
  }
  if (station === 'caracol' && song.id !== 'golpe') notes.push({ beat: last * BEATS_PER_BAR, lane: 0, len: 3 });
  notes.sort((a, b) => a.beat - b.beat || a.lane - b.lane).forEach((n, i) => { n.i = i; });
  charts.set(key, notes);
  return notes;
}

// Notes in (from, to] beats, for bots and the local music.
export function notesBetween(song, station, from, to) {
  return chart(song, station).filter(n => n.beat > from && n.beat <= to);
}

// The shaker groove and the low drum that always play, so the rueda never
// stops even when every station misses: [beat in bar, voice].
export const GROOVE = [[0, 'pujao'], [1.5, 'pujao'], [2, 'pujao'], [3.5, 'cruzao']];

// ¡Golpe! patterns: the MCP plays `notes` ([beat offset, lane]) over `len`
// beats and the panas answer over the next `len`. Longer each round.
export function golpePattern(round, random) {
  const count = Math.min(10, 2 + round), len = count <= 5 ? 4 : 8, slots = [];
  for (let b = 0; b < len; b += .5) slots.push(b);
  const picked = new Set([0]);
  while (picked.size < count) picked.add(slots[1 + Math.floor(random() * (slots.length - 1))]);
  return { len, notes: [...picked].sort((a, b) => a - b).map(b => [b, random() < .5 ? 0 : 1]) };
}
