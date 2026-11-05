// El Mokele: the Congo's Silbón, a long-necked thing the size of a house. Nothing kills
// it (`unkillable` in enemies.js) and it hunts with the Silbón's own code and its own
// numbers (`MOKELE`): lose it, or get it to run straight across the whirlpool that opens
// the seal. What it adds: it comes up out of the water (`emerge`), it keeps coming for you
// (`stalkEvery`) and it surges along a straight channel. Too wide for a nook, as ever, but
// the neck still looks inside one (`PEEK`, the same table).
//
// It is heard first, then seen as a shape in the fog, then seen far too close: `revealStage`
// is that order as a pure function of distance, and `cueFor` what each stage sounds like.
// Each screen works these out for itself, so they never travel. Renderer-free. Not on the
// first load: `loadMokele` in enemies.js brings it when a Congo jornada needs it.
import { locKey } from '../../../engine/i18n.js';
import { SILBON, SILBON_BODY, updateSilbon } from './silbon.js';
import { floorOf } from './deck.js';
import { distance } from './layout.js';

export const MOKELE = { ...SILBON, body: SILBON_BODY, flushText: locKey('¡El Mokele sacó a {name}!'), fallEvent: 'mokele-falling',
  sight: 16, feel: 2, lost: 1.2, searchFor: 10, nooks: 2, nookRange: 16, wander: .7, seek: .85, hunt: 1.05, fall: 2.2, emerge: 3.2,
  // The surge: a burst along a straight run, then it has to get its breath back.
  surge: 1.32, surgeFor: 3, surgeRest: 3.5, surgeFrom: 6 };
// How often, wandering, it turns back toward the nearest pana. Easy gives you room.
export const STALK = { easy: 18, normal: 11, hard: 7 };
export const stalkEvery = difficulty => STALK[difficulty] ?? STALK.normal;

const standing = p => !p.downed && !p.spectator;
export function updateMokele(g, e, k, speed, damage, dt) {
  if (e.mode === 'emerge') {
    e.alert = .3;
    if (e.modeT >= MOKELE.emerge) { e.mode = 'wander'; e.modeT = 0; e.stalkIn = stalkEvery(g.options?.difficulty) * .4; }
    return;
  }
  if (e.mode === 'wander' && !e.stun) stalk(g, e, dt);
  updateSilbon(g, e, k, speed * surgeNow(g, e, dt), damage, dt, MOKELE);
}
// Wandering it heads for wherever the nearest pana is now, and the hunt takes it from there.
// The goal is plain JSON like the rest, so a new host carries straight on.
function stalk(g, e, dt) {
  e.stalkIn = (e.stalkIn ?? stalkEvery(g.options?.difficulty)) - dt;
  if (e.stalkIn > 0) return;
  e.stalkIn = stalkEvery(g.options?.difficulty);
  const f = floorOf(e.x); let best = null, near = Infinity;
  for (const p of g.players) { if (!standing(p) || p.hidden || floorOf(p.x) !== f) continue; const d = distance(p, e); if (d < near) { near = d; best = p; } }
  if (!best) return;
  e.goalX = best.x; e.goalZ = best.z; e.mode = 'hunt'; e.modeT = 0; g.paths.delete(e.id);
}
// `surgeT` above 0: seconds of burst left; below 0: seconds of rest left.
function surgeNow(g, e, dt) {
  const prey = e.mode === 'chase' ? g.players.find(p => p.id === e.prey) : null;
  if ((e.surgeT || 0) > 0) { e.surgeT -= dt; if (e.surgeT <= 0) e.surgeT = -MOKELE.surgeRest; return prey ? MOKELE.surge : 1; }
  if ((e.surgeT || 0) < 0) { e.surgeT = Math.min(0, e.surgeT + dt); return 1; }
  if (prey && distance(e, prey) > MOKELE.surgeFrom) e.surgeT = MOKELE.surgeFor;
  return 1;
}

// ---------- The reveal, worked out on each screen ----------
export const REVEAL = { hear: 58, shape: 27, teeth: 8.5, close: 3.4 };
const HUNTING = new Set(['chase', 'peek']);
// none → heard → shape → teeth. Teeth only when it is after someone: a wandering Mokele
// that drifts past stays a shape, so the close-up always means trouble.
export function revealStage(d, mode) {
  if (mode === 'emerge' || d > REVEAL.hear) return d > REVEAL.hear ? 'none' : 'heard';
  if (d > REVEAL.shape) return 'heard';
  return d <= REVEAL.teeth && HUNTING.has(mode) ? 'teeth' : 'shape';
}
// 0 far off, 1 at arm's length: how far the neck has come down and how wide the jaws are.
export const teethAmount = (d, mode) => HUNTING.has(mode) ? Math.max(0, Math.min(1, (REVEAL.teeth - d) / (REVEAL.teeth - REVEAL.close))) : 0;
// The head is drawn far bigger than it is the closer it gets. Sustos scales the size, not the rules.
const HEAD_GROWTH = { normal: 1.15, suaves: .55, apagados: 0 };
export const headScale = (amount, scares = 'normal') => 1 + amount * (HEAD_GROWTH[scares] ?? HEAD_GROWTH.normal);
// What this screen hears: seconds between footfalls and between pushes of water (0: none),
// how loud on the shared 0…1 presence drone. Closer is faster and louder.
export function cueFor(d, mode, scares = 'normal') {
  if (scares === 'apagados' || d > REVEAL.hear) return { foot: 0, wake: 0, drone: 0, gain: 0 };
  const near = 1 - Math.min(1, d / REVEAL.hear), soft = scares === 'suaves' ? .5 : 1, moving = mode !== 'sniff' && mode !== 'linger' && mode !== 'peek';
  const pace = mode === 'chase' ? .62 : 1;
  return { foot: moving ? (1.9 - near * .9) * pace : 0, wake: moving ? (3.4 - near * 1.8) * pace : 0, drone: near * near * soft, gain: (.35 + near * .65) * soft };
}
