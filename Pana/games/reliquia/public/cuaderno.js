// Cuaderno del buzo: what this pana has come across, on engine/logbook.js. Each first
// time pays a little XP. Everything is read from the state and events the game already
// has, and each screen keeps its own book. The pure half (top) runs in the unit tests;
// game.js loads this with import(), since Fosa's first load is at its module cap.
import { createLogbook } from '../../../engine/logbook.js';
import { createLogbookChip, createDiscoveryQueue } from '../../../engine/logbook-ui.js';
import { loc, locKey } from '../../../engine/i18n.js';
import { THEME_NAMES, LIBRARY_NAME, floorOf, themeOf } from './deck.js';
import { ITEMS, ARTIFACTS } from './items.js';

export const CUADERNO_XP = 5;
const SIGHT = 14, CLOSE = 6;   // metres: seen at all; close enough to learn it does not die
const ITEM_KINDS = [...ARTIFACTS, 'stoneHead', 'goldJaguar', 'altar'];
// The black jaguar that hunts you is the same page as the golden one.
const ENEMY_PAGE = { mummy: 'mummy', guardian: 'guardian', jaguar: 'jaguar', stalker: 'jaguar', bat: 'bat', spider: 'spider', snake: 'snake', lector: 'lector', estatua: 'estatua', silbon: 'silbon', mokele: 'mokele' };

const group = (name, pairs) => pairs.map(([id, title]) => ({ id: `${name}:${id}`, group: name, title }));
export const CATALOG = [
  ...group('lugar', [['biblioteca', LIBRARY_NAME], ['mina', locKey('La mina')], ...['inundada', 'hongos', 'templo', 'congo'].map(id => [id, THEME_NAMES[id]])]),
  ...group('bicho', [['mummy', locKey('Las momias')], ['guardian', locKey('El guardián')], ['jaguar', locKey('El jaguar')], ['bat', locKey('Los murciélagos')], ['spider', locKey('Las arañas')], ['snake', locKey('Las cuaimas')],
    ['lector', locKey('El Lector')], ['estatua', locKey('La Estatua')], ['silbon', locKey('El Silbón')], ['mokele', locKey('El Mokele')]]),
  ...group('tesoro', ITEM_KINDS.map(kind => [kind, ITEMS[kind].name])),
  ...group('suceso', [['apagon', locKey('El apagón')], ['murcielagos', locKey('La nube de murciélagos')], ['derrumbe', locKey('El derrumbe')], ['creciente', locKey('La creciente')], ['esporada', locKey('La esporada')],
    ['culebras', locKey('Las culebras de las grietas')], ['boveda', locKey('La bóveda de oro')], ['sala', locKey('La sala escondida')]]),
  ...group('nota', [['despierta', locKey('El Silbón se levanta en su sala')], ['inmortal', locKey('Nada mata a El Silbón')], ['hueco', locKey('El Silbón no cabe en los huecos')],
    ['chillido', locKey('El chillido de los murciélagos atrae a El Silbón')], ['abismo', locKey('El Silbón no mira dónde pisa')]]),
];

const diving = p => !!p && !p.spectator && floorOf(p.x) > 0;
const silbonNear = (state, p) => !!state.enemies?.some(e => e.kind === 'silbon' && floorOf(e.x) === floorOf(p.x));

// What this pana meets just by being down there, as catalog ids. `known` skips what
// is already written; `clear(a, b)` is the walls' line of sight, the one costly part.
export function sightings(state, playerId, { known = new Set(), clear = () => true } = {}) {
  const p = state.players?.find(q => q.id === playerId), out = [];
  if (state.phase !== 'playing' || !diving(p)) return out;
  const add = id => { if (!known.has(id) && !out.includes(id)) out.push(id); };
  add(`lugar:${themeOf(state)}`);
  for (const hand of p.hands || []) if (ITEM_KINDS.includes(hand?.kind)) add(`tesoro:${hand.kind}`);
  const gripped = p.grip != null ? state.items?.find(item => item.id === p.grip)?.kind : null;
  if (ITEM_KINDS.includes(gripped)) add(`tesoro:${gripped}`);
  if (p.hidden && silbonNear(state, p)) add('nota:hueco');
  const ahead = { x: Math.sin(p.h || 0), z: Math.cos(p.h || 0) };
  for (const e of state.enemies || []) {
    const page = ENEMY_PAGE[e.kind];
    if (!page || !e.awake || e.hp <= 0 || floorOf(e.x) !== floorOf(p.x)) continue;
    const wanted = !known.has(`bicho:${page}`) || (page === 'silbon' && !known.has('nota:inmortal'));
    if (!wanted) continue;
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    if (d > SIGHT || dx * ahead.x + dz * ahead.z <= 0 || !clear(p, e)) continue;
    add(`bicho:${page}`);
    if (page === 'silbon' && d <= CLOSE) add('nota:inmortal');
  }
  return out;
}

// What an event teaches whoever is down there when it happens.
export function fromEvent(e, state, playerId) {
  const p = state.players?.find(q => q.id === playerId);
  if (!diving(p)) return [];
  switch (e.kind) {
    case 'suceso': return [`suceso:${e.suceso}`];
    case 'swarm': return e.floor === floorOf(p.x) ? ['suceso:culebras'] : [];
    case 'vault': return ['suceso:boveda'];
    case 'reveal': return ['suceso:sala'];
    case 'boss': return e.boss === 'silbon' ? ['nota:despierta'] : [];
    case 'screech': return silbonNear(state, p) ? ['nota:chillido'] : [];
    case 'silbon-down': return ['nota:abismo'];
    default: return [];
  }
}

// The screens: the chip in the lobby and on the results, and a toast per first time.
// `diver` is createFosaProgress: its `earn` keeps a rank-up for the results screen.
export function createFosaCuaderno({ diver, notify, lobby, end, clear, storage }) {
  const logbook = createLogbook({ game: 'reliquia', entries: CATALOG, ...(storage !== undefined ? { storage } : {}) });
  const known = new Set(logbook.owned()), say = createDiscoveryQueue(notify);
  const text = pct => loc('Cuaderno {pct} %', { pct });
  const chips = [lobby, end].filter(Boolean).map(parent => { const chip = createLogbookChip(logbook, { text }); parent.append(chip.el); return chip; });
  function write(ids) {
    for (const id of ids) {
      if (known.has(id)) continue;
      known.add(id);   // also what another tab wrote first: that tab already paid
      const found = logbook.discover(id);
      if (!found.isNew) continue;
      const { gained } = diver.earn(CUADERNO_XP, `logbook:${id}`);
      say(loc('Cuaderno: {entry} · +{xp} XP', { entry: loc(found.entry.title), xp: gained }));
    }
  }
  return {
    logbook,
    see(state, playerId) { write(sightings(state, playerId, { known, clear: (a, b) => clear(a, b, state) })); },
    heard(e, state, playerId) { write(fromEvent(e, state, playerId)); },
    dispose() { say.dispose(); for (const chip of chips) chip.dispose(); },
  };
}
