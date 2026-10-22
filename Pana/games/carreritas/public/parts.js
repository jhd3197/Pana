// Carreritas's taller parts: plain data and math shared by the garage, the
// race and the room (no Three.js, no DOM). Every part belongs to a slot,
// costs coins once, and carries two separate things:
// - profile: multipliers that composeTune() folds into the car's tune (top,
//   accel, turn, grip, mass), so a part really changes the physics. One stat
//   point on the garage bars is about 1 m/s of punta, 1.5 of arranque, 0.1
//   of giro, 0.5 of agarre or 0.1 of peso;
// - cfg: a patch for the render config that car-parts.js dresses the car
//   with. One part may patch several fields (camuflaje also darkens rims).
// 'fabrica' keeps the car's own stock part and is always free.

export const PART_SLOTS = [
  { id: 'motor', name: 'Motor' },
  { id: 'aleron', name: 'Alerón' },
  { id: 'frente', name: 'Frente' },
  { id: 'techo', name: 'Techo' },
  { id: 'jaula', name: 'Jaula' },
  { id: 'acabado', name: 'Acabado' },
  { id: 'acento', name: 'Color de acento' },
  { id: 'rin', name: 'Color de rines' },
  { id: 'calcomania', name: 'Calcomanía' },
  { id: 'franjas', name: 'Franjas' },
];

const stockPart = (blurb) => ({ id: 'fabrica', name: 'De fábrica', blurb, cost: 0, profile: {}, cfg: {} });
const swatch = (id, name, hex, cost = 5) => ({ id, name, blurb: '', cost, color: hex, profile: {}, cfg: { acento: hex } });

export const PARTS = {
  motor: [
    stockPart('El motor de siempre. Cumple, sin lujos.'),
    { id: 'afinado', name: 'Afinado', blurb: 'Bujías nuevas y escape doble cromado.', cost: 30, profile: { top: 1.015, accel: 1.03 }, cfg: { motor: 'afinado' } },
    { id: 'turbo', name: 'Turbo', blurb: 'Toma de aire en el capó y soplido extra. Pesa un poquito más.', cost: 75, profile: { top: 1.03, accel: 1.06, mass: 1.04 }, cfg: { motor: 'turbo' } },
    { id: 'carreras', name: 'De carreras', blurb: 'Compresor cromado con trompetas. Pa’ valientes: dobla un pelo peor.', cost: 140, profile: { top: 1.045, accel: 1.09, mass: 1.05, turn: 0.975 }, cfg: { motor: 'carreras' } },
  ],
  aleron: [
    stockPart('El que trae el carro, o ninguno.'),
    { id: 'ninguno', name: 'Sin alerón', blurb: 'Limpio y simple.', cost: 0, profile: {}, cfg: { aleron: 'ninguno' } },
    { id: 'pato', name: 'Cola de pato', blurb: 'Un toque de estabilidad.', cost: 15, profile: { turn: 1.025 }, cfg: { aleron: 'pato' } },
    { id: 'techo', name: 'De techo', blurb: 'Pega la cola en las curvas.', cost: 20, profile: { turn: 1.025, grip: 1.03 }, cfg: { aleron: 'techo' } },
    { id: 'gt', name: 'Ala GT', blurb: 'Mucho agarre, un poco de freno al aire.', cost: 45, profile: { top: 0.985, turn: 1.05, grip: 1.03 }, cfg: { aleron: 'gt' } },
    { id: 'rally', name: 'Ala rally', blurb: 'Doble ala para saltar y caer derecho.', cost: 55, profile: { top: 0.985, mass: 1.04, turn: 1.05, grip: 1.06 }, cfg: { aleron: 'rally' } },
    { id: 'cisne', name: 'Cuello de cisne', blurb: 'Agarre sin perder velocidad.', cost: 70, profile: { turn: 1.05, grip: 1.06 }, cfg: { aleron: 'cisne' } },
  ],
  frente: [
    stockPart('El parachoques que trae el carro.'),
    { id: 'defensa', name: 'Defensa', blurb: 'Tubos al frente: empuja más en los choques.', cost: 15, profile: { mass: 1.04 }, cfg: { frente: 'defensa' } },
    { id: 'faros', name: 'Faros rally', blurb: 'Cuatro faros pa’ la lluvia y los túneles.', cost: 20, profile: { grip: 1.03 }, cfg: { frente: 'faros' } },
    { id: 'winche', name: 'Winche', blurb: 'Pa’ salir del barro. Pesa y frena el arranque.', cost: 30, profile: { accel: 0.97, mass: 1.04, grip: 1.03 }, cfg: { frente: 'winche' } },
  ],
  techo: [
    stockPart('Lo que el carro lleva arriba de fábrica.'),
    { id: 'nada', name: 'Techo limpio', blurb: 'Nada arriba, nada que se caiga.', cost: 0, profile: {}, cfg: { techo: 'nada' } },
    { id: 'barra', name: 'Barra de luces', blurb: 'Pa’ correr de noche.', cost: 15, profile: { grip: 1.03 }, cfg: { techo: 'barra' } },
    { id: 'cava', name: 'Cava', blurb: 'Hielo pa’ la playa.', cost: 10, profile: { mass: 1.04 }, cfg: { techo: 'cava' } },
    { id: 'maletas', name: 'Maletas y olla', blurb: 'Rumbo a la costa con todo.', cost: 10, profile: { accel: 0.97, mass: 1.04 }, cfg: { techo: 'maletas' } },
    { id: 'repuesto', name: 'Repuesto', blurb: 'Un caucho de más, por si acaso.', cost: 15, profile: { mass: 1.04, grip: 1.03 }, cfg: { techo: 'repuesto' } },
    { id: 'cornetas', name: 'Cornetas', blurb: 'Pura rumba, cero ventaja.', cost: 20, profile: {}, cfg: { techo: 'cornetas' } },
  ],
  jaula: [
    stockPart('Sin jaula: más espacio adentro.'),
    { id: 'con', name: 'Jaula', blurb: 'Chasis más rígido: dobla mejor y pesa un poco más.', cost: 25, profile: { mass: 1.04, turn: 1.025 }, cfg: { jaula: 'con' } },
  ],
  acabado: [
    stockPart('La pintura como salió de la fábrica.'),
    { id: 'brillante', name: 'Brillante', blurb: 'Recién encerado.', cost: 0, profile: {}, cfg: { acabado: 'brillante' } },
    { id: 'satinado', name: 'Satinado', blurb: 'Un brillo suavecito.', cost: 0, profile: {}, cfg: { acabado: 'satinado' } },
    { id: 'mate', name: 'Mate', blurb: 'Sin brillo, bien serio.', cost: 10, profile: {}, cfg: { acabado: 'mate' } },
    { id: 'metalico', name: 'Metálico', blurb: 'Brilla como tapa de olla.', cost: 20, profile: {}, cfg: { acabado: 'metalico' } },
    { id: 'camuflaje', name: 'Camuflaje', blurb: 'Manchas en el color de tu pintura y rines negros.', cost: 30, profile: {}, cfg: { acabado: 'camuflaje', rin: 'negro' } },
  ],
  acento: [
    { id: 'fabrica', name: 'De fábrica', blurb: '', cost: 0, color: null, profile: {}, cfg: {} },
    swatch('carbon', 'Carbón', '#1f1e24'), swatch('crema', 'Crema', '#f2efe6'), swatch('sol', 'Sol', '#ffd23a'),
    swatch('pasion', 'Pasión', '#e8323c'), swatch('caribe', 'Caribe', '#2f6bff'), swatch('monte', 'Monte', '#3fd06b'),
    swatch('mango', 'Mango', '#ff8a1f'), swatch('orquidea', 'Orquídea', '#b45cff'),
  ],
  rin: [
    stockPart('Los rines de siempre.'),
    { id: 'plata', name: 'Plateados', blurb: 'Clásicos.', cost: 5, color: '#c9ced8', profile: {}, cfg: { rin: 'plata' } },
    { id: 'negro', name: 'Negros', blurb: 'Pa’ los serios.', cost: 5, color: '#2a292f', profile: {}, cfg: { rin: 'negro' } },
    { id: 'blanco', name: 'Blancos', blurb: 'Como de rally.', cost: 10, color: '#f1f0ec', profile: {}, cfg: { rin: 'blanco' } },
    { id: 'dorado', name: 'Dorados', blurb: 'Pa’ que te vean llegar.', cost: 15, color: '#d6a640', profile: {}, cfg: { rin: 'dorado' } },
  ],
  calcomania: [
    stockPart('La calcomanía que trae el carro.'),
    { id: 'ninguna', name: 'Ninguna', blurb: 'Puertas limpias.', cost: 0, profile: {}, cfg: { calcomania: 'ninguna' } },
    { id: 'numero', name: 'Número', blurb: 'Tu número en las puertas.', cost: 5, profile: {}, cfg: { calcomania: 'numero' } },
    { id: 'flor', name: 'Flor', blurb: 'Una flor grandota, pura paz.', cost: 5, profile: {}, cfg: { calcomania: 'flor' } },
    { id: 'rayo', name: 'Rayo', blurb: 'Un rayo de punta a punta, en tu acento.', cost: 10, profile: {}, cfg: { calcomania: 'rayo' } },
  ],
  franjas: [
    stockPart('Las franjas que trae el carro.'),
    { id: 'sin', name: 'Sin franjas', blurb: 'Un solo color.', cost: 0, profile: {}, cfg: { franjas: 'sin' } },
    { id: 'carrera', name: 'De carrera', blurb: 'Dos franjas del capó a la cola, en tu acento.', cost: 10, profile: {}, cfg: { franjas: 'carrera' } },
    { id: 'costado', name: 'De costado', blurb: 'Una franja baja entre las ruedas.', cost: 10, profile: {}, cfg: { franjas: 'costado' } },
  ],
};

export const partById = (slot, id) => PARTS[slot]?.find(p => p.id === id) ?? null;

// Keep only known slots with known, non-stock parts (stock is the default).
export function cleanParts(value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const { id: slot } of PART_SLOTS) {
    const id = value[slot];
    if (typeof id === 'string' && id !== 'fabrica' && partById(slot, id)) out[slot] = id;
  }
  return out;
}

// Multiply every equipped part's physics profile.
const FIELDS = ['top', 'accel', 'turn', 'grip', 'mass'];
export function partsProfile(parts = {}) {
  const out = {};
  for (const { id: slot } of PART_SLOTS) {
    const part = partById(slot, parts[slot] ?? 'fabrica');
    for (const field of FIELDS) if (part?.profile[field] != null) out[field] = (out[field] ?? 1) * part.profile[field];
  }
  return out;
}

// The render config: every slot's cfg patch, applied in slot order.
export function renderConfig(parts = {}) {
  const cfg = {};
  for (const { id: slot } of PART_SLOTS) Object.assign(cfg, partById(slot, parts[slot] ?? 'fabrica')?.cfg);
  return cfg;
}

// The garage's five bars, 0–10 points each, read off a composed tune.
export const STATS = [
  ['Velocidad', 'Vel', t => (t.top - 31) / 1.0],
  ['Aceleración', 'Acel', t => (t.accel - 15) / 1.5],
  ['Manejo', 'Manejo', t => (t.turn - 1.8) / 0.11],
  ['Agarre', 'Agarre', t => (t.grip - 3.4) / 0.5],
  ['Peso', 'Peso', t => (t.mass - 0.55) / 0.1],
];
export const statPoints = (tune) => STATS.map(([, , f]) => Math.max(0, Math.min(10, Math.round(f(tune)))));

// Pills for a card: whole points gained or lost against the current build.
export function statPills(before, after) {
  const a = statPoints(before), b = statPoints(after);
  return STATS.map(([, label], i) => ({ label, delta: b[i] - a[i] })).filter(p => p.delta);
}

/* ---------- nivel: one number (and a D–S letter) for how built a ride is ----
   Shared by the taller, the parrilla, the results table and the matagigantes
   payout. Plain math on the 0–10 stat points above: peso never counts because
   it is a trade-off, not an upgrade. */
import { composeTune, wheelById } from './wheel-definitions.js';

// D under 450, C 450–549, B 550–649, A 650–749, S 750 and up.
import { NIVEL_BANDS, bandOf } from '../../../engine/kit-rating.js';
export { NIVEL_BANDS, bandOf };

// Mangos paid per higher-nivel rival you beat in a race (¡Matagigantes!).
export const MATAGIGANTES_BONUS = 5;

// points: [Velocidad, Aceleración, Manejo, Agarre, Peso] as 0–10 (Peso ignored).
export const nivelFromPoints = ([vel, acel, man, agarre]) =>
  Math.round(100 + 16 * (1.5 * vel + acel + man + 0.8 * agarre));

export const nivelOf = (tune) => nivelFromPoints(statPoints(tune));

// The nivel of one car build: body tune + cauchos + taller parts.
export const carNivel = (car, wheelId, parts = {}) =>
  nivelOf(composeTune(car.tune, wheelById(wheelId).profile, partsProfile(parts)));


// The skewed two-tone chip: the letter on its colour, the number on dark ink.
export const badge = (pi, cls = '') => {
  const band = bandOf(pi);
  return `<span class="nivel-badge ${cls}" style="--nivel:${band.color}"><b>${band.letter}</b><span>${pi}</span></span>`;
};

// A kit's nivel for a race: the average of the pieces the track uses
// (use is a subset of ['car', 'boat', 'air']; missing pieces are skipped).
export function kitNivel(pieces, use) {
  const values = use.map((kind) => pieces[kind]).filter((pi) => Number.isFinite(pi));
  if (!values.length) return NaN;
  return Math.round(values.reduce((sum, pi) => sum + pi, 0) / values.length);
}

// Which kit pieces a track uses: the car always; the lancha where water takes
// the road, the avioneta where the route flies (transform-gates.js).
export const trackPieces = (track) => {
  const def=track?.def??track;
  if(def?.kitPieces)return ['car',...['boat','air'].filter(k=>def.kitPieces.includes(k))];
  return ['car',...(def?.transformGates?.some(g=>!g.fly)?['boat']:[]),...(def?.transformGates?.some(g=>g.fly)?['air']:[])];
};

// Who you beat with a bigger kit: rivals is [{ name, pi }] of everyone you
// finished ahead of. Returns the beaten giants and the mango bonus.
export function matagigantes(myPi, rivals) {
  const giants = rivals.filter((r) => Number.isFinite(r?.pi) && r.pi > myPi);
  return { giants, bonus: giants.length * MATAGIGANTES_BONUS };
}

/* ---------- the kit vessels: your lancha and your avioneta ------------------
// water or a cliff morphs (transform-gates.js); while it rides as a vessel,
// the vessel's own tune drives — so the lancha you built really decides how
// you take the river, and the avioneta the canyon. Plain data and math shared
// by the taller, the race and the room (no Three.js, no DOM), same pattern as
// car-definitions.js + parts.js: bodies with a tune, part slots with
// multiplier profiles (composeTune folds them in), and every part a trade-off.

   Same pattern as the car parts above: bodies with a tune, part slots with
   multiplier profiles, and every part a trade-off. */

export const BOAT_DEFINITIONS = [
  {
    id: 'penero', name: 'Peñero', cost: 0,
    blurb: 'La lancha del pescador. Firme cuando hay olas y responde parejito.',
    tune: { top: 33, accel: 20, turn: 2.2, mass: 1.2, grip: 6, driftCharge: 1.1, driftBoost: 1.1 },
  },
  {
    id: 'curiara', name: 'Curiara', cost: 90,
    blurb: 'Canoa de río: dobla en un centavo y arranca ligero, pero le falta punta y las olas la mecen.',
    tune: { top: 31, accel: 23, turn: 2.7, mass: 0.8, grip: 6.5, driftCharge: 1.15, driftBoost: 1 },
  },
  {
    id: 'rayo', name: 'El Rayo', cost: 140,
    blurb: 'Lancha de carreras. Vuela en recta; en las curvas y las olas pide mano suave.',
    tune: { top: 37, accel: 19, turn: 2.0, mass: 1.0, grip: 5, driftCharge: 0.95, driftBoost: 1.05 },
  },
];

export const AIR_DEFINITIONS = [
  {
    id: 'zamuro', name: 'Zamuro', cost: 0,
    blurb: 'Ala ancha y noble. Planea lejos, baja despacio y perdona los aterrizajes.',
    tune: { top: 34, accel: 21, turn: 2.2, mass: 1.0, grip: 6 },
  },
  {
    id: 'guacamaya', name: 'Guacamaya', cost: 160,
    blurb: 'Rápida y colorida como ella sola. En la bajada vuela; doblar le cuesta un poquito.',
    tune: { top: 38, accel: 23, turn: 2.0, mass: 0.9, grip: 5.5 },
  },
  {
    id: 'turpial', name: 'Turpial', cost: 110,
    blurb: 'Ala chica y nerviosa: cambia de rumbo en el aire como si nada, con menos punta.',
    tune: { top: 32, accel: 25, turn: 2.8, mass: 0.75, grip: 6.5 },
  },
];


export const BOAT_PART_SLOTS = [
  { id: 'casco', name: 'Casco' },
  { id: 'fueraborda', name: 'Motor' },
  { id: 'helice', name: 'Hélice' },
];
export const BOAT_PARTS = {
  casco: [
    stockPart('Madera de siempre, bien calafateada.'),
    { id: 'fibra', name: 'Fibra liviana', blurb: 'Más punta y arranque; se mueve más con las olas.', cost: 50, profile: { top: 1.02, accel: 1.04, mass: 0.96, grip: 0.97 } },
    { id: 'doble', name: 'Casco doble', blurb: 'Ni las olas de Choroní la tumban. Pesa un poquito más.', cost: 60, profile: { grip: 1.06, turn: 1.02, mass: 1.04, accel: 0.98 } },
  ],
  fueraborda: [
    stockPart('El fuera de borda de don Pancho.'),
    { id: 'cuarenta', name: '40 caballos', blurb: 'Ruge como un camión y empuja igual. Pesa.', cost: 70, profile: { top: 1.03, accel: 1.05, mass: 1.04 } },
    { id: 'electrico', name: 'Eléctrico', blurb: 'Silencioso y arranca rapidísimo; cede un pelín de punta.', cost: 85, profile: { accel: 1.09, mass: 0.96, top: 0.99 } },
  ],
  helice: [
    stockPart('Tres palas de fábrica.'),
    { id: 'corta', name: 'Hélice corta', blurb: 'Gira más cerrado: sale de las curvas pegado a la orilla.', cost: 40, profile: { turn: 1.04, accel: 1.03, top: 0.99 } },
    { id: 'cuatro', name: 'Cuatro palas', blurb: 'Agarra más agua en recta y se planta en las olas.', cost: 55, profile: { top: 1.02, grip: 1.04, accel: 0.98 } },
  ],
};

export const AIR_PART_SLOTS = [
  { id: 'alas', name: 'Alas' },
  { id: 'aspas', name: 'Hélice' },
];
export const AIR_PARTS = {
  alas: [
    stockPart('Alas de lona, como siempre.'),
    { id: 'largas', name: 'Alas largas', blurb: 'Planea muchísimo y sube parejo; gira más lento.', cost: 60, profile: { accel: 1.06, grip: 1.03, turn: 0.96 } },
    { id: 'acrobaticas', name: 'Acrobáticas', blurb: 'Pa’ hacer loqueras en el aire: punta y giro, menos ascenso.', cost: 80, profile: { top: 1.02, turn: 1.05, accel: 0.95 } },
  ],
  aspas: [
    stockPart('Dos palas de madera.'),
    { id: 'liviana', name: 'Liviana', blurb: 'Sube más rápido; con viento se siente más.', cost: 35, profile: { accel: 1.05, mass: 0.95, grip: 0.97 } },
    { id: 'triple', name: 'Tres palas', blurb: 'Firme aunque sople el viento. Pesa un poco.', cost: 40, profile: { grip: 1.05, turn: 1.02, mass: 1.04 } },
  ],
};

export const VESSEL_DEFS = { boat: BOAT_DEFINITIONS, air: AIR_DEFINITIONS };
export const VESSEL_SLOTS = { boat: BOAT_PART_SLOTS, air: AIR_PART_SLOTS };
export const VESSEL_PARTS = { boat: BOAT_PARTS, air: AIR_PARTS };

// The stat bars for a vessel read the same composed tune as the car's; the
// labels change (a boat cares about stability, a plane about climb).
export const VESSEL_STAT_LABELS = {
  boat: ['Velocidad', 'Aceleración', 'Manejo', 'Estabilidad', 'Peso'],
  air: ['Velocidad', 'Ascenso', 'Manejo', 'Estabilidad', 'Peso'],
};

export const vesselById = (kind, id) =>
  VESSEL_DEFS[kind].find((v) => v.id === id) ?? VESSEL_DEFS[kind][0];

export const vesselPartById = (kind, slot, id) =>
  VESSEL_PARTS[kind]?.[slot]?.find((p) => p.id === id) ?? null;

// Keep only known slots with known, non-stock parts (stock is the default).
export function cleanVesselParts(kind, value) {
  if (typeof value === 'string') { try { value = JSON.parse(value); } catch { value = null; } }
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const { id: slot } of VESSEL_SLOTS[kind] ?? []) {
    const id = value[slot];
    if (typeof id === 'string' && id !== 'fabrica' && vesselPartById(kind, slot, id)) out[slot] = id;
  }
  return out;
}

// Multiply every equipped part's physics profile.
export function vesselPartsProfile(kind, parts = {}) {
  const out = {};
  for (const { id: slot } of VESSEL_SLOTS[kind] ?? []) {
    const part = vesselPartById(kind, slot, parts[slot] ?? 'fabrica');
    for (const field of FIELDS) if (part?.profile[field] != null) out[field] = (out[field] ?? 1) * part.profile[field];
  }
  return out;
}

// The tune a vessel drives with: its body tune plus its equipped parts.
export const vesselTune = (kind, id, parts = {}) =>
  composeTune(vesselById(kind, id).tune, {}, vesselPartsProfile(kind, parts));

// The three tunes a racer carries; while a transform gate morphs the car,
// c.tune swaps to the active piece (transform-gates.js).
export function kitTunes(cosmetics, carDef, wheel) {
  return {
    car: composeTune(carDef.tune, wheel.profile, partsProfile(cosmetics.parts)),
    boat: vesselTune('boat', cosmetics.boat, cosmetics.boatParts),
    plane: vesselTune('air', cosmetics.air, cosmetics.airParts),
  };
}

// Nivel of one vessel build (parts.js), for the taller, the parrilla and results.
export const vesselNivel = (kind, id, parts = {}) => nivelOf(vesselTune(kind, id, parts));
