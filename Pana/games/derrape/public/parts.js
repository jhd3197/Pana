// Derrape's taller parts: plain data and math shared by the garage, the
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
