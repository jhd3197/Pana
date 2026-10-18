// Derrape's taller parts: plain data and math shared by the garage, the
// race and the room (no Three.js, no DOM). Every part belongs to a slot,
// costs coins once, and carries two separate things:
// - profile: small multipliers that composeTune() folds into the car's tune
//   (top, accel, turn, grip, mass), so a part really changes the physics;
// - cfg: a patch for the render config that car-parts.js dresses the car
//   with. One part may patch several fields (camuflaje also darkens rims).
// 'fabrica' keeps the car's own stock part and is always free.

export const PART_SLOTS = [
  { id: 'motor', name: 'Motor', group: 'rendimiento' },
  { id: 'aleron', name: 'Alerón', group: 'rendimiento' },
  { id: 'techo', name: 'Techo', group: 'rendimiento' },
  { id: 'acabado', name: 'Acabado', group: 'estilo' },
  { id: 'rin', name: 'Color de rines', group: 'estilo' },
  { id: 'calcomania', name: 'Calcomanía', group: 'estilo' },
  { id: 'franjas', name: 'Franjas', group: 'estilo' },
];

const stockPart = (blurb) => ({ id: 'fabrica', name: 'De fábrica', blurb, cost: 0, profile: {}, cfg: {} });

export const PARTS = {
  motor: [
    stockPart('El motor de siempre. Cumple, sin lujos.'),
    { id: 'afinado', name: 'Afinado', blurb: 'Bujías nuevas y escape doble: arranca un 4% más rápido y gana un pelín de punta.', cost: 40, profile: { top: 1.01, accel: 1.04 }, cfg: { motor: 'afinado' } },
    { id: 'turbo', name: 'Turbo', blurb: 'Toma de aire en el capó y soplido extra. Más punta y arranque, pero pesa un poquito más.', cost: 90, profile: { top: 1.02, accel: 1.06, mass: 1.04 }, cfg: { motor: 'turbo' } },
  ],
  aleron: [
    stockPart('El que trae el carro, o ninguno.'),
    { id: 'ninguno', name: 'Sin alerón', blurb: 'Limpio y simple.', cost: 0, profile: {}, cfg: { aleron: 'ninguno' } },
    { id: 'pato', name: 'Cola de pato', blurb: 'Un toquecito de agarre en las curvas.', cost: 20, profile: { grip: 1.03 }, cfg: { aleron: 'pato' } },
    { id: 'gt', name: 'Ala GT', blurb: 'Pega la cola en las curvas; frena un pelo en las rectas.', cost: 45, profile: { grip: 1.05, turn: 1.02, top: 0.99 }, cfg: { aleron: 'gt' } },
    { id: 'rally', name: 'Ala rally', blurb: 'Doble ala para doblar cerrado y caer derecho de los saltos.', cost: 60, profile: { grip: 1.04, turn: 1.04, top: 0.985, mass: 1.02 }, cfg: { aleron: 'rally' } },
  ],
  techo: [
    stockPart('Lo que el carro lleva arriba de fábrica.'),
    { id: 'nada', name: 'Techo limpio', blurb: 'Nada arriba. Nada que se caiga.', cost: 0, profile: {}, cfg: { techo: 'nada' } },
    { id: 'barra', name: 'Barra de luces', blurb: 'Cuatro faros pa’ correr de noche. Pura pinta.', cost: 15, profile: {}, cfg: { techo: 'barra' } },
    { id: 'cava', name: 'Cava', blurb: 'Hielo pa’ la playa. Pesa más: aguantas mejor los empujones.', cost: 15, profile: { mass: 1.04, accel: 0.99 }, cfg: { techo: 'cava' } },
    { id: 'maletas', name: 'Maletas y olla', blurb: 'Rumbo a la costa con todo. Más peso, arranque más lento.', cost: 15, profile: { mass: 1.06, accel: 0.98 }, cfg: { techo: 'maletas' } },
    { id: 'cornetas', name: 'Cornetas', blurb: 'Pura rumba, cero ventaja.', cost: 25, profile: {}, cfg: { techo: 'cornetas' } },
  ],
  acabado: [
    stockPart('La pintura como salió de la fábrica.'),
    { id: 'brillante', name: 'Brillante', blurb: 'Recién encerado.', cost: 0, profile: {}, cfg: { acabado: 'brillante' } },
    { id: 'mate', name: 'Mate', blurb: 'Sin brillo, bien serio.', cost: 20, profile: {}, cfg: { acabado: 'mate' } },
    { id: 'metalico', name: 'Metálico', blurb: 'Brilla como tapa de olla.', cost: 30, profile: {}, cfg: { acabado: 'metalico' } },
    { id: 'camuflaje', name: 'Camuflaje', blurb: 'Manchas en el color de tu pintura y rines negros.', cost: 40, profile: {}, cfg: { acabado: 'camuflaje', rin: 'negro' } },
  ],
  rin: [
    stockPart('Los rines de siempre.'),
    { id: 'plata', name: 'Plateados', blurb: 'Clásicos.', cost: 10, profile: {}, cfg: { rin: 'plata' } },
    { id: 'negro', name: 'Negros', blurb: 'Pa’ los serios.', cost: 10, profile: {}, cfg: { rin: 'negro' } },
    { id: 'blanco', name: 'Blancos', blurb: 'Como de rally.', cost: 15, profile: {}, cfg: { rin: 'blanco' } },
    { id: 'dorado', name: 'Dorados', blurb: 'Pa’ que te vean llegar.', cost: 25, profile: {}, cfg: { rin: 'dorado' } },
  ],
  calcomania: [
    stockPart('La calcomanía que trae el carro.'),
    { id: 'ninguna', name: 'Ninguna', blurb: 'Puertas limpias.', cost: 0, profile: {}, cfg: { calcomania: 'ninguna' } },
    { id: 'numero', name: 'Número', blurb: 'Tu número en las puertas.', cost: 10, profile: {}, cfg: { calcomania: 'numero' } },
    { id: 'flor', name: 'Flor', blurb: 'Una flor grandota, pura paz.', cost: 10, profile: {}, cfg: { calcomania: 'flor' } },
    { id: 'rayo', name: 'Rayo', blurb: 'Un rayo de punta a punta.', cost: 20, profile: {}, cfg: { calcomania: 'rayo' } },
  ],
  franjas: [
    stockPart('Las franjas que trae el carro.'),
    { id: 'sin', name: 'Sin franjas', blurb: 'Un solo color.', cost: 0, profile: {}, cfg: { franjas: 'sin' } },
    { id: 'carrera', name: 'De carrera', blurb: 'Dos franjas del capó a la cola.', cost: 15, profile: {}, cfg: { franjas: 'carrera' } },
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

// Card pills: what a part does to the bars, as whole percentages.
export function partPills(part) {
  const p = part?.profile ?? {}, pills = [];
  const add = (label, factor) => {
    const pct = Math.round((factor - 1) * 100);
    if (pct) pills.push({ label, pct });
  };
  add('Vel', p.top ?? 1);
  add('Acel', p.accel ?? 1);
  add('Manejo', Math.sqrt((p.turn ?? 1) * (p.grip ?? 1)));
  add('Peso', p.mass ?? 1);
  return pills;
}
