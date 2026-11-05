// What lives down the shaft, on top of engine/ai/ecosystem.js. Moths graze the
// glowing mushrooms, bats eat the moths, cuaimas eat the bats. Every creature
// lives in the simulation; those near a pana also get a body in `g.enemies`, so
// the host's enemy code, snapshots and views keep working as they did. Each
// body's `eco` is its creature's id. Renderer-free: the host runs it.
//
// It matters because the chain is the map's hiding places. Kill the bats and the
// moths strip the mushrooms: less cover, more dark, and no screech left to lure
// El Silbón. Kill the cuaimas and the bats crowd the roosts. A farol's beam
// drives moths off a patch. Mushrooms and roots hide whoever stays quiet in them
// (`p.covered`); predators mostly go by ear and at short range.
import { addCreature, advanceEcosystem, coverAt, coverOf, createEcosystem, dimmed, ecoWorld, lightOf, nearestSite, removeCreature, traitsFor } from '../../../engine/ai/ecosystem.js';
import { hearNoise, noisySince } from '../../../engine/play/noise.js';
import { locKey } from '../../../engine/i18n.js';
import { floorOf } from './deck.js';
import { distance } from './layout.js';

export const SPECIES = {
  bat: { eats: 'pests', cap: 30, life: 420, mature: 15, breedAt: 55, birthCost: 14, cool: 16, mutate: .12, hungry: 45, full: 85, base: .35, gain: 200, bite: .03, torpor: .45, catch: 0, ambush: 0, smell: 30, roam: .15, speed: 6, nest: 'roost', rest: 'roost', follow: false, traits: { sight: [1.5, 9], hear: [6, 22], pace: [.7, 1.25] } },
  snake: { eats: ['bat'], cap: 7, life: 900, mature: 50, breedAt: 68, birthCost: 22, cool: 45, mutate: .1, hungry: 50, full: 50, base: .05, gain: 85, bite: 0, catch: .5, ambush: 20, smell: 32, roam: .05, speed: 1.7, follow: true, traits: { sight: [1.5, 7], hear: [6, 20], pace: [.7, 1.25] } },
};
// Seconds simulated before anyone arrives, so each jornada starts mid-story.
const PREROLL = 150;
// Bodies: how close a pana must be, how far before one goes back to being a number.
export const BODIES = { near: 26, far: 34, bat: 12, snake: 5 };
// A hidden pana is felt within this, heard when noisy; the crowd a roost needs.
export const COVER = { least: .3, feel: 2.6, fresh: .8, crowd: 8, boom: 12, dim: .5, glow: 5, wake: 6, seen: 1.4, look: .25, chase: 6 };

export const ecoWorldFor = L => L.ecoWorld ||= ecoWorld(L.run.ecoSites || [], { species: SPECIES, clear: (a, b) => L.sightClear(a, b, {}) });

// A new jornada's population, from what the deck dealt, already a while alive.
export function startEcology(g) {
  const L = g.layout, W = ecoWorldFor(L); g.eco = null;
  if (!W.sites.length) return null;
  const founders = [], roosts = W.sites.flatMap((s, i) => s.kind === 'roost' ? [i] : []), lairs = W.sites.flatMap((s, i) => s.kind === 'lair' || s.kind === 'roots' ? [i] : []);
  for (const sl of L.run.sleepers) {
    if (sl.kind !== 'bat' && sl.kind !== 'snake') continue;
    const at = nearestSite(W, sl.x, sl.z, sl.floor, s => s.kind === (sl.kind === 'bat' ? 'roost' : 'lair'));
    if (at >= 0) founders.push({ sp: sl.kind, at });
  }
  // Enough of both for a chain, whatever the deck dealt.
  const count = sp => founders.filter(f => f.sp === sp).length;
  const patches = W.sites.filter(s => s.plant).length, keep = (sp, most) => { while (count(sp) > most) founders.splice(founders.findLastIndex(f => f.sp === sp), 1); };
  keep('bat', Math.min(14, patches * 3)); keep('snake', 3);
  for (let i = 0; count('bat') < Math.max(6, patches * 2) && roosts.length; i++) founders.push({ sp: 'bat', at: roosts[i % roosts.length] });
  for (let i = 0; count('snake') < 3 && lairs.length; i++) founders.push({ sp: 'snake', at: lairs[i % lairs.length] });
  g.eco = createEcosystem(W, { seed: (g.seed * 2246822519 + (g.level || 1) * 3266489917) >>> 0, depth: g.level || 1, founders, pests: .25 });
  advanceEcosystem(g.eco, W, PREROLL);
  g.eco.said = {};
  return g.eco;
}

// Is this pana hidden from this hunter? Cover hides whoever is quiet and not
// right next to it. Only the things that really hunt by senses fall for it.
const FOOLED = new Set(['bat', 'snake', 'spider', 'stalker', 'silbon']);
export function hiddenFrom(g, e, p, d = distance(p, e)) {
  return !!p.covered && FOOLED.has(e.kind) && d >= COVER.feel && !noisySince(g.noise, p.id, g.time - COVER.fresh);
}
// Mummies rush in the dark; a healthy patch's glow counts as light.
export function glowNear(g, at) {
  if (!g.eco) return false;
  const W = ecoWorldFor(g.layout), f = floorOf(at.x);
  return W.sites.some((s, i) => s.plant && (s.floor ?? 0) === f && lightOf(g.eco, W, i) > .4 && (s.x - at.x) ** 2 + (s.z - at.z) ** 2 < COVER.glow ** 2);
}

// What an embodied creature notices of the pana it would go for: anyone within
// reach of its body, anyone noisy within its ears, and, with its short eyes,
// anyone it can really see. Null when it should go on with its own life.
export function attention(g, e, target, dt) {
  if (!target) return null;
  const d = distance(target, e);
  e.seenT = Math.max(0, (e.seenT || 0) - dt);
  if (d < COVER.feel || (d < (e.hearing || 0) && noisySince(g.noise, target.id, g.time - COVER.fresh))) { e.seenT = COVER.chase; return target; }
  e.lookT = (e.lookT || 0) - dt;
  if (e.lookT <= 0) {
    e.lookT = COVER.look;
    if (d < (e.sight || 0) && !target.covered && g.layout.sightClear(e, target, g)) e.seenT = COVER.seen;
  }
  return e.seenT > 0 ? target : null;
}

// A body with nobody to bother: to a noise it heard, or about its creature's
// business (the simulation says where). A bat at its roost hangs up again.
export function idleBody(g, e, k, speed, dt, walk) {
  e.windup = 0;
  const heard = hearNoise(g.noise, e, { floor: floorOf(e.x), since: e.heardAt ?? e.born, time: g.time, muffled: n => Math.min(1, (e.hearing || 0) / n.radius) });
  if (heard) { e.heardAt = heard.time; e.goalX = heard.x; e.goalZ = heard.z; e.goalT = 6; g.paths.delete(e.id); }
  e.goalT = Math.max(0, (e.goalT || 0) - dt);
  const investigate = e.goalT > 0, goal = investigate ? { x: e.goalX, z: e.goalZ } : { x: e.siteX ?? e.x, z: e.siteZ ?? e.z }, d = distance(e, goal);
  if (k.flying) { const t = g.time + e.id * 1.7; e.y = 2.2 + Math.sin(t * 3) * .3 + Math.sin(t * 11) * .16; }
  if (d > 1.3) { walk(g, e, goal, speed * (investigate ? .85 : .6), dt); return; }
  if (investigate) { e.goalT = 0; return; }
  if (e.perch && k.flying) { e.hanging = true; return; }
  // Feeding: a bat flits around the patch; a cuaima just waits.
  if (k.flying) { const a = g.time * 1.6 + e.id, r = 1.1; g.layout.moveBody(e, (e.siteX + Math.cos(a) * r - e.x) * dt * 2.4, (e.siteZ + Math.sin(a) * r - e.z) * dt * 2.4, g, .25); e.h = a + Math.PI / 2; }
}

// A body for whoever is near a pana, a number again for whoever is left far
// behind, and every body told where its creature means to be.
function syncBodies(g, W, spawnEnemy) {
  const eco = g.eco, byCreature = new Map();
  for (const e of g.enemies) if (e.eco != null) byCreature.set(e.eco, e);
  // A body gone or dead with its creature still here: a pana got it.
  for (const c of eco.pop.slice()) {
    if (!c.body) continue;
    const e = byCreature.get(c.id);
    if (!e || e.hp <= 0) { c.body = 0; removeCreature(eco, c, (why, q) => { if (why === 'extinct') gone(g, q.sp); }); }
  }
  const crowd = {};
  for (const c of eco.pop) if (c.sp === 'bat' && c.to < 0 && W.sites[c.at].kind === 'roost') crowd[c.at] = (crowd[c.at] || 0) + 1;
  const below = g.players.filter(p => !p.downed && !p.spectator && floorOf(p.x) > 0), used = { bat: 0, snake: 0 };
  for (const c of eco.pop) if (c.body) used[c.sp]++;
  // Nearest first, so the crowd around you is the one with bodies.
  const nearest = c => { const s = W.sites[c.at]; let best = Infinity; for (const p of below) if (floorOf(p.x) === (s.floor ?? 0)) best = Math.min(best, Math.hypot(p.x - s.x, p.z - s.z)); return best; };
  const order = eco.pop.filter(c => !c.body).map(c => [c, nearest(c)]).filter(([, d]) => d < BODIES.near).sort((a, b) => a[1] - b[1]);
  for (const [c] of order) {
    const s = W.sites[c.at];
    if (used[c.sp] >= BODIES[c.sp] || (s.room != null && !g.woke[s.room])) continue;
    const perch = c.sp === 'bat' && c.to < 0 && s.kind === 'roost', a = c.id * 2.4, r = Math.min(s.r, .4 + (c.id % 7) * .32);
    const e = spawnEnemy(g, c.sp, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, { eco: c.id, room: s.room, born: g.time - 1, hanging: perch, sight: c.sight, hearing: c.hear, pace: c.pace, ...(c.hp ? { hp: c.hp } : {}) }) || spawnEnemy(g, c.sp, s.x, s.z, { eco: c.id, room: s.room, born: g.time - 1, hanging: perch, sight: c.sight, hearing: c.hear, pace: c.pace });
    if (e) { c.body = e.id; used[c.sp]++; byCreature.set(c.id, e); }
  }
  for (const c of eco.pop) {
    if (!c.body) continue;
    const e = byCreature.get(c.id), s = W.sites[c.to >= 0 ? c.to : c.at];
    e.siteX = s.x; e.siteZ = s.z; e.perch = c.sp === 'bat' && c.to < 0 && s.kind === 'roost'; e.touchy = (crowd[c.at] || 0) >= COVER.crowd;
    if (c.sp === 'snake') { e.homeX = s.x; e.homeZ = s.z; }
    // Too far from everyone: back to being a number, wounds and all.
    if (!below.some(p => floorOf(p.x) === floorOf(e.x) && distance(p, e) < BODIES.far) && !(e.windup > 0)) { c.hp = e.hp; c.body = 0; g.paths.delete(e.id); g.enemies.splice(g.enemies.indexOf(e), 1); }
  }
}

const GONE = {
  bat: locKey('¡Sin murciélagos! Las polillas se comen los hongos.'),
  snake: locKey('¡Sin cuaimas! Los murciélagos se van a multiplicar.'),
};
function gone(g, sp) { if (GONE[sp]) g.event('eco', GONE[sp], { eco: 'gone', sp }); }

function fromSim(g, W) {
  return (why, c, more) => {
    if (why === 'extinct') { gone(g, c.sp); return; }
    if (why === 'birth') {
      if (nearAnyone(g, W.sites[c.at])) g.event('eco-birth', '', { x: W.sites[c.at].x, z: W.sites[c.at].z, sp: c.sp });
      return;
    }
    const s = W.sites[c.at], body = c.body && g.enemies.find(e => e.id === c.body);
    if (body) { body.hp = 0; c.body = 0; }
    if (!nearAnyone(g, s)) return;
    if (why === 'eaten') g.event('eco-eaten', '', { x: s.x, z: s.z, sp: c.sp, by: more?.by?.sp });
    if (why === 'starve') g.event('eco-starved', '', { x: body ? body.x : s.x, z: body ? body.z : s.z, sp: c.sp });
  };
}
const nearAnyone = (g, s) => g.players.some(p => !p.spectator && floorOf(p.x) === (s.floor ?? 0) && Math.hypot(p.x - s.x, p.z - s.z) < BODIES.far);

// One word per change the whole team should know about, then quiet until it passes.
function tell(g, W) {
  const said = g.eco.said ||= {}, once = (key, on, off, text, extra = {}) => { if (on && !said[key]) { said[key] = 1; g.event('eco', text, { eco: key, ...extra }); } else if (off && said[key]) delete said[key]; };
  const share = dimmed(g.eco, W), bats = g.eco.counts.bat || 0;
  once('dim', share >= COVER.dim, share < COVER.dim * .4, locKey('Las polillas apagan los hongos.'));
  once('boom', bats >= COVER.boom, bats < COVER.boom * .6, locKey('¡Se llenó de murciélagos! No hagan ruido.'));
}

// Two round numbers for the Tab layer, so a client need not know the sites.
function summarize(g, W) {
  let moths = 0, glow = 0, n = 0;
  W.sites.forEach((s, i) => { if (!s.plant) return; n++; moths += g.eco.pests[i]; glow += g.eco.food[i]; });
  g.eco.moths = n ? Math.round(moths / n * 100) : 0; g.eco.glow = n ? Math.round(glow / n * 100) : 0;
}

// Every step of the host: who is hidden now; once a second, the simulation.
export function tickEcology(g, dt, { spawnEnemy, lightOn }) {
  const L = g.layout, W = ecoWorldFor(L);
  if (!g.eco && W.sites.length) startEcology(g);
  if (!g.eco) return;
  for (const p of g.players) {
    const f = floorOf(p.x), i = f > 0 && !p.downed && !p.spectator ? coverAt(g.eco, W, p.x, p.z, { floor: f, least: COVER.least }) : -1;
    p.covered = i >= 0 ? i + 1 : 0;
  }
  const below = g.players.filter(p => !p.downed && !p.spectator && floorOf(p.x) > 0);
  // Nobody down there: the chain waits, and whoever had a body is a number again.
  if (!below.length) { if (g.enemies.some(e => e.eco != null)) syncBodies(g, W, spawnEnemy); return; }
  const noises = [];
  for (const n of g.noise.list) if (n.time >= g.time - dt - .001 && n.kind !== 'screech') { const site = nearestSite(W, n.x, n.z, n.floor); if (site >= 0) noises.push({ x: n.x, z: n.z, radius: n.radius, site }); }
  // Kept on the noise board, the host's ears: never in a snapshot.
  if (noises.length) g.noise.heardByEco = noises;
  const ran = advanceEcosystem(g.eco, W, dt, { noises: g.noise.heardByEco || [], on: fromSim(g, W) });
  if (!ran) return;
  g.noise.heardByEco = null;
  // A farol's beam or a flare drives the moths off a patch.
  W.sites.forEach((s, i) => { if (s.plant && g.eco.pests[i] > .1 && nearAnyone(g, s) && lightOn(g, s) === 'beam') g.eco.pests[i] = Math.round(g.eco.pests[i] * 55) / 100; });
  syncBodies(g, W, spawnEnemy); tell(g, W); summarize(g, W);
}
// Debug and tests: nobody left of a species, as if the panas had hunted it down.
export function wipeSpecies(g, sp) {
  if (!g.eco) return;
  for (const c of g.eco.pop.filter(q => q.sp === sp)) {
    const body = c.body && g.enemies.find(e => e.id === c.body); if (body) body.hp = 0;
    c.body = 0; removeCreature(g.eco, c, (why, q) => { if (why === 'extinct') gone(g, q.sp); });
  }
}
// Debug and shots: a roost full of bats right by this pana.
export function crowdRoost(g, p, n = 24) {
  if (!g.eco) return false;
  const W = ecoWorldFor(g.layout), at = nearestSite(W, p.x, p.z, floorOf(p.x), s => s.kind === 'roost'); if (at < 0) return false;
  const S = SPECIES.bat, have = g.eco.counts.bat || 0;
  for (let i = 0; i < Math.min(n, S.cap - have); i++) addCreature(g.eco, 'bat', at, traitsFor(S, g.level || 1), { e: 80, age: 40 });
  for (const c of g.eco.pop) if (c.sp === 'bat') { c.at = at; c.to = -1; c.left = 0; }
  return true;
}
// A pana just walked into a room: its creatures appear at once.
export function wakeBodies(g, spawnEnemy) { if (g.eco) syncBodies(g, ecoWorldFor(g.layout), spawnEnemy); }

// What a client needs to draw a site, from a snapshot's numbers.
export const siteShine = (eco, W, i) => eco ? lightOf(eco, W, i) : W.sites[i].light || 0;
export const siteCover = (eco, W, i) => eco ? coverOf(eco, W, i) : W.sites[i].cover || 0;
