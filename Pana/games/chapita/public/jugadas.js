// i18n-ignore-file: jugada names for the Studio workbench only (the game shows none)
// Jugadas locas: the Studio workbench's twenty plays, tied to real outcomes.
// Pure (no DOM, no Three.js): the host picks one when a result happens and
// stores its id in the state, so every screen plays the same jugada. The pick
// hashes the seed and the pitch count instead of drawing from the game's
// random stream, so adding a jugada never changes how a game plays out.

// Each jugada: its name in Studio and how long the result stays on screen
// while it plays (seconds), so the next pitch never cuts it short.
export const JUGADAS = {
  hit: { label: 'Lanzar y batear', seconds: 0 },
  miss: { label: 'Swing fallido', seconds: 2.3 },
  home: { label: 'Jonrón', seconds: 3.2 },
  pitch: { label: 'Solo lanzar', seconds: 1.3 },
  swing: { label: 'Solo batear', seconds: 0 },
  bean: { label: 'Chapazo', seconds: 2.4 },
  window: { label: 'La ventana', seconds: 2.6 },
  catch: { label: 'Atrapada', seconds: 2.2 },
  broken: { label: 'Palo partido', seconds: 0 },
  argue: { label: 'Discusión', seconds: 2.6 },
  dance: { label: 'Celebración', seconds: 0 },
  car: { label: '¡Carro!', seconds: 3.4 },
  dinner: { label: '¡A comer!', seconds: 4.4 },
  dog: { label: 'El perro', seconds: 2.8 },
  roof: { label: "Pa'l techo", seconds: 2.8 },
  drain: { label: 'Alcantarilla', seconds: 2.6 },
  slip: { label: 'Palo zafado', seconds: 2.2 },
  boomerang: { label: 'Bumerán', seconds: 2.2 },
  pinball: { label: 'Pinball', seconds: 3 },
  grandpa: { label: 'El abuelo', seconds: 2.8 },
  helicopter: { label: 'Helicóptero', seconds: 2.5 },
};
export const JUGADA_IDS = Object.keys(JUGADAS);

// What can happen after each situation: [jugada, chance]; the first whose
// chance is met wins, nothing when none is.
const POOLS = {
  'strikeout-swinging': [['helicopter', .4], ['miss', 1]],
  'strikeout-looking': [['argue', .5], ['pitch', 1]],
  'strike-swinging': [['slip', .1]],
  'strike-looking': [['argue', .22], ['pitch', 1]],
  ball: [],
  'ball-doblada': [['boomerang', .4]],
  foul: [['grandpa', .3]],
  'foul-ground': [['drain', .4], ['grandpa', .2]],
  short: [['drain', .45]],
  sencillo: [['dog', .25]],
  wall: [['roof', .35]],
  azotea: [['roof', 1]],
  post: [['pinball', .55]],
  jonron: [['home', 1]],
  window: [['window', 1]],
  cambio: [['dinner', .22]],
  'weak-contact': [['broken', .3]],
};
const SALT = Object.fromEntries(Object.keys(POOLS).map((k, i) => [k, (i + 1) * 0x9e37]));

// A number in [0, 1) from the game's seed, its pitch count and the situation.
export function roll(seed, n, situation) {
  let h = (seed ^ Math.imul(n + 1, 0x85ebca6b) ^ (SALT[situation] || 0x51ed)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function chooseJugada(seed, n, situation) {
  const r = roll(seed, n, situation);
  for (const [id, chance] of POOLS[situation] || []) if (r < chance) return id;
  return null;
}

// The result stays up at least this long when a jugada plays.
export const jugadaSeconds = (id, seconds) => Math.max(seconds, JUGADAS[id]?.seconds || 0);

// How a pitch looks in the air: a fireball with two strikes, a crazy
// rainbow cap when it is bent, a slow globito for a float.
export function pitchFlavor(pitch, strikes) {
  if (strikes >= 2 && pitch.kind !== 'planea') return 'fuego';
  if (pitch.cap === 'doblada') return 'loca';
  if (pitch.kind === 'planea') return 'globito';
  return null;
}

// A pitch that misses the zone high and inside hits the batter: a chapazo.
// A righty stands on the left of the plate (−x), a zurdo on the right.
export function beaned(pitch, zurdo) {
  const t = pitch.target, inside = zurdo ? t.x > .9 : t.x < -.9;
  return !pitch.arrives && inside && t.y > 1.05 && t.y < 2.2;
}
