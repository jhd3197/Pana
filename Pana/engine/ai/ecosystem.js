// A small living food chain: creatures eat, breed with slightly mutated traits
// and starve; a plant and the pests grazing on it live on the ground. Pure and
// renderer-free, so it runs in a host's simulation and in Node tests. A site is
// a place creatures gather (a patch, a thicket, a roost); between sites they
// only travel, so the cost is creatures x sites and no pathfinding, whatever
// the map looks like. The game turns the creatures near its players into real
// bodies and leaves the rest here.
//
//   const world = ecoWorld(sites, { species, ground, clear: (a, b) => noWallBetween(a, b) });
//   const eco = createEcosystem(world, { seed, depth, founders: [{ sp: 'bat', at: 3 }] });
//   advanceEcosystem(eco, world, dt, { noises, on: (kind, c, more) => ... });
//
// A site: { x, z, r, kind, cover, hides, plant, light, floor }. `cover` (0…1) is
// how well it shields creatures inside; `hides` lets players use it too; a `plant` site's cover and light fade with its
// plant, so the pests that eat a patch also strip the hiding place. A species:
// { eats: 'pests' | ['prey kinds'], cap, life, mature, breedAt, birthCost, cool,
// mutate, hungry, full, base, gain, bite, catch, ambush, smell, roam, speed,
// nest, rest, torpor, follow, traits: { sight: [lo, hi], hear: [lo, hi], pace: [lo, hi] } }.
//
// Why the numbers wave: predators thin the prey, cover keeps some alive, the
// predators then starve and the survivors boom. Vision is the costly sense
// (quadratic in `sight`, and useless without light), so where it is dark the
// lineages that see less outbreed the rest and hunt by ear instead.
//
// The state is plain JSON (safe in a snapshot); `world` is rebuilt from the same
// sites on every machine and never travels.

export const clamp01 = v => Math.max(0, Math.min(1, v));
const round = (v, n = 10) => Math.round(v * n) / n;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const GROUND = { regrow: .012, graze: .024, growth: .1, spread: .012, seed: .012, room: .15, reach: 30, refuge: .05 };
// What a sense costs each second (energy runs from 0 to 100).
export const SENSE_COST = { sight: .012, hear: .01, pace: .2 };

function next(eco) { let x = eco.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; eco.rng = x >>> 0; return eco.rng / 4294967296; }

// Static: the sites, who can reach and see whom. Build it once per map.
export function ecoWorld(sites, { species, ground = {}, clear = () => true, reach = 44 } = {}) {
  const links = sites.map((a, i) => {
    const out = [];
    sites.forEach((b, j) => { if (i === j || (a.floor ?? 0) !== (b.floor ?? 0)) return; const d = dist(a, b); if (d <= reach) out.push({ to: j, d, clear: !!clear(a, b) }); });
    return out;
  });
  return { sites, links, species, ground: { ...GROUND, ...ground } };
}

// Traits for a founder at this depth: the deeper, the less it sees and the more
// it hears. `blindAt` is the depth where only the lowest sight is left.
export function traitsFor(S, depth = 1, blindAt = 7) {
  const t = clamp01((depth - 1) / Math.max(1, blindAt - 1)), { sight, hear, pace } = S.traits;
  return { sight: sight[1] + (sight[0] - sight[1]) * t, hear: hear[0] + (hear[1] - hear[0]) * t, pace: (pace[0] + pace[1]) / 2 };
}

export function createEcosystem(world, { seed = 1, depth = 1, founders = [], food = .9, pests = .08 } = {}) {
  const eco = { t: 0, acc: 0, rng: seed >>> 0 || 1, id: 0, pop: [], food: world.sites.map(s => s.plant ? food : 0), pests: world.sites.map(s => s.plant ? pests : 0), heard: world.sites.map(() => -99), counts: {} };
  for (const k of Object.keys(world.species)) eco.counts[k] = 0;
  for (const f of founders) { const S = world.species[f.sp]; addCreature(eco, f.sp, f.at, traitsFor(S, depth), { e: 55 + next(eco) * 30, age: S.mature * next(eco) * 2 }); }
  return eco;
}

export function addCreature(eco, sp, at, traits, { e = 60, age = 0, gen = 0 } = {}) {
  const c = { id: ++eco.id, sp, at, to: -1, left: 0, e: round(e), age: Math.round(age), sight: round(traits.sight), hear: round(traits.hear), pace: round(traits.pace, 100), gen, cool: 0 };
  eco.pop.push(c); eco.counts[sp] = (eco.counts[sp] || 0) + 1;
  return c;
}

// What being alive costs this creature each second.
export function metabolism(S, c) { return S.base + c.sight * c.sight * SENSE_COST.sight + c.hear * SENSE_COST.hear + c.pace * c.pace * SENSE_COST.pace; }
// How well a site hides what is inside it right now.
export function coverOf(eco, world, i) { const s = world.sites[i]; return s.plant ? (s.cover || 0) * clamp01(eco.food[i] * 1.4) : s.cover || 0; }
// How much a site lights an eye's way, 0…1.
export function lightOf(eco, world, i) { const s = world.sites[i]; return clamp01((s.light || 0) * (s.plant ? eco.food[i] : 1)); }
// The hiding place around a point: the site index, or -1. `least` is the cover
// it must still have, so a stripped patch hides nobody.
export function coverAt(eco, world, x, z, { floor = 0, least = .2 } = {}) {
  let best = -1, most = least;
  for (let i = 0; i < world.sites.length; i++) {
    const s = world.sites[i];
    if ((s.floor ?? 0) !== floor || !s.hides || !s.cover || (s.x - x) ** 2 + (s.z - z) ** 2 > s.r * s.r) continue;
    const c = coverOf(eco, world, i); if (c >= most) { most = c; best = i; }
  }
  return best;
}
// A child: its parents' midpoint, nudged a little, inside what the species allows.
export function inherit(eco, S, a, b) {
  const one = (k, range) => { const mid = (a[k] + b[k]) / 2, nudge = (next(eco) + next(eco) - 1) * S.mutate * mid; return Math.max(range[0], Math.min(range[1], mid + nudge)); };
  return { sight: one('sight', S.traits.sight), hear: one('hear', S.traits.hear), pace: one('pace', S.traits.pace) };
}
export function nearestSite(world, x, z, floor = 0, keep = null) {
  let best = -1, near = Infinity;
  world.sites.forEach((s, i) => { if ((s.floor ?? 0) !== floor || (keep && !keep(s))) return; const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < near) { near = d; best = i; } });
  return best;
}

function go(c, link) { c.to = link.to; c.left = link.d; }
function kill(eco, c, why, on, more) {
  if (c.dead) return;
  c.dead = true; eco.counts[c.sp]--;
  on?.(why, c, more);
  if (eco.counts[c.sp] === 0) on?.('extinct', c);
}
// A creature a game removed itself (a player killed its body).
export function removeCreature(eco, c, on = null) { kill(eco, c, 'killed', on); eco.pop = eco.pop.filter(q => q !== c); }
const pick = (eco, list) => list.length ? list[Math.floor(next(eco) * list.length)] : null;

// The ground: the plant regrows, pests breed on it and spread to their neighbours.
function ground(eco, world) {
  const G = world.ground;
  world.sites.forEach((s, i) => {
    if (!s.plant) return;
    const F = eco.food[i], P = eco.pests[i];
    eco.pests[i] = clamp01(P + G.growth * P * (1 - P / (G.room + F)) + G.seed);
    eco.food[i] = clamp01(F + G.regrow * (1 - F) - G.graze * P);
  });
  world.sites.forEach((s, i) => {
    if (!s.plant || eco.pests[i] < .3) return;
    for (const l of world.links[i]) if (l.d < G.reach && world.sites[l.to].plant) { const flow = G.spread * eco.pests[i]; eco.pests[l.to] = clamp01(eco.pests[l.to] + flow); eco.pests[i] = Math.max(0, eco.pests[i] - flow); }
  });
}

// One creature's choice of where to go next: a link, or null to stay.
function choose(eco, world, c, S, preyAt, matesAt, noise) {
  const links = world.links[c.at];
  if (!links.length) return null;
  // Once at the table it eats its fill, not just until the hunger stops.
  const feeding = S.eats === 'pests' && eco.pests[c.at] > .07, hungry = c.e < (feeding ? S.full : S.hungry), range = c.sight * (.25 + .75 * lightOf(eco, world, c.at));
  // Ears first: a noise within reach pulls whoever follows noise.
  if (S.follow && noise && noise.site !== c.at && dist(world.sites[c.at], noise) < Math.min(noise.radius, c.hear)) { const l = links.find(q => q.to === noise.site); if (l) return l; }
  if (hungry && S.eats === 'pests') {
    // A lit patch is seen from afar; otherwise the pests must be heard close by.
    let best = null, top = eco.pests[c.at] > .07 ? eco.pests[c.at] / 6 : 0;
    for (const l of links) {
      const P = eco.pests[l.to]; if (P < .07) continue;
      if (!(l.d < S.smell + c.hear * .3 || (l.clear && l.d < range + lightOf(eco, world, l.to) * c.sight))) continue;
      const score = P / (l.d + 6); if (score > top) { top = score; best = l; }
    }
    if (best) return best;
    if (top > 0) return null;
  } else if (hungry) {
    let best = null, top = preyAt(c.at) > 0 ? 1 : 0;
    for (const l of links) {
      const n = preyAt(l.to); if (!n) continue;
      const seen = l.clear && l.d < range && coverOf(eco, world, l.to) < .5, heard = l.d < c.hear && eco.t - eco.heard[l.to] < 5;
      if (!seen && !heard && l.d >= S.smell) continue;
      const score = n / (l.d + 5); if (score > top) { top = score; best = l; }
    }
    if (best) return best;
    if (top > 0) return null;
  }
  // Fed: back to where it rests, the busier the better; that is how a roost
  // fills up. Ready to breed and alone: to wherever others of its kind are.
  if (!hungry) {
    const atRest = !S.rest || world.sites[c.at].kind === S.rest, ready = c.age >= S.mature && c.cool <= 0 && c.e >= S.breedAt, lonely = ready && matesAt(c.at) < 2;
    if ((!atRest && next(eco) < .25) || (lonely && next(eco) < .2)) {
      let best = null, top = 0;
      for (const l of links) { if (S.rest && world.sites[l.to].kind !== S.rest) continue; const n = matesAt(l.to); if (!atRest || n) { const score = (n + 1) / (l.d + 10); if (score > top) { top = score; best = l; } } }
      if (best) return best;
    }
  }
  if (hungry && next(eco) < S.roam) return pick(eco, links);
  return null;
}

function stepOnce(eco, world, { noises = [], on = null } = {}) {
  eco.t += 1; ground(eco, world);
  const noise = noises.length ? noises[noises.length - 1] : null;
  // Who is where, once; travellers are nowhere.
  const here = world.sites.map(() => ({}));
  for (const c of eco.pop) if (c.to < 0) (here[c.at][c.sp] ||= []).push(c);
  for (const c of eco.pop.slice()) {
    if (c.dead) continue;
    const S = world.species[c.sp];
    c.age += 1; c.cool = Math.max(0, c.cool - 1);
    // At rest it burns less: what carries a colony through a lean spell.
    c.e -= metabolism(S, c) * (S.rest && c.to < 0 && world.sites[c.at].kind === S.rest ? S.torpor ?? 1 : 1);
    if (c.e <= 0) { kill(eco, c, 'starve', on); continue; }
    if (c.age > S.life) { kill(eco, c, 'age', on); continue; }
    if (c.to >= 0) {
      c.left -= S.speed * c.pace;
      if (c.left > 0) { c.e = round(c.e); c.left = round(c.left); continue; }
      c.at = c.to; c.to = -1; c.left = 0; (here[c.at][c.sp] ||= []).push(c);
    }
    const at = c.at, roster = here[at];
    // Eat.
    if (S.eats === 'pests') {
      // A few pests always get away, so a patch can come back.
      const bite = Math.min(Math.max(0, eco.pests[at] - world.ground.refuge), S.bite);
      if (bite > .005 && c.e < S.full) { eco.pests[at] -= bite; c.e = Math.min(100, c.e + bite * S.gain); eco.heard[at] = eco.t; }
    } else if (Array.isArray(S.eats) && c.e < S.full) {
      const shield = 1 - coverOf(eco, world, at);
      for (const kind of S.eats) {
        const prey = (roster[kind] || []).find(q => !q.dead && q.to < 0); if (!prey) continue;
        if (next(eco) >= S.catch * shield) continue;
        // Good ears get away: a prey that hears it coming flees to a neighbour.
        if (next(eco) < prey.hear / (prey.hear + S.ambush)) { const away = pick(eco, world.links[at]); if (away) { go(prey, away); continue; } }
        kill(eco, prey, 'eaten', on, { by: c }); c.e = Math.min(100, c.e + S.gain); eco.heard[at] = eco.t; break;
      }
    }
    // Breed.
    if (c.age >= S.mature && c.cool <= 0 && c.e >= S.breedAt && eco.counts[c.sp] < S.cap && (!S.nest || world.sites[at].kind === S.nest)) {
      const mate = (roster[c.sp] || []).find(q => q !== c && !q.dead && q.to < 0 && q.age >= S.mature && q.cool <= 0 && q.e >= S.breedAt);
      if (mate) {
        c.e -= S.birthCost; mate.e -= S.birthCost; c.cool = mate.cool = S.cool;
        const child = addCreature(eco, c.sp, at, inherit(eco, S, c, mate), { e: S.birthCost * 1.3, gen: Math.max(c.gen, mate.gen) + 1 });
        roster[c.sp].push(child);
        on?.('birth', child, { parents: [c.id, mate.id] });
      }
    }
    // Move.
    if (c.to < 0) {
      const preyAt = i => Array.isArray(S.eats) ? S.eats.reduce((n, k) => n + (here[i][k]?.filter(q => !q.dead && q.to < 0).length || 0), 0) : 0;
      const matesAt = i => here[i][c.sp]?.filter(q => !q.dead && q.to < 0).length || 0;
      const l = choose(eco, world, c, S, preyAt, matesAt, noise);
      if (l) go(c, l);
    }
    c.e = round(c.e); c.left = round(c.left);
  }
  if (eco.pop.some(c => c.dead)) eco.pop = eco.pop.filter(c => !c.dead);
  for (let i = 0; i < eco.food.length; i++) { eco.food[i] = round(eco.food[i], 100); eco.pests[i] = round(eco.pests[i], 1000); }
}

// Run the simulation forward. It steps whole seconds, so what crosses the wire
// changes once a second at most; returns how many steps ran. A noise is
// { x, z, radius, site }: `site` the site nearest to it.
export function advanceEcosystem(eco, world, dt, hooks = {}) {
  eco.acc += dt; let n = 0;
  while (eco.acc >= 1) { eco.acc -= 1; stepOnce(eco, world, n ? { ...hooks, noises: [] } : hooks); n++; }
  eco.acc = round(eco.acc, 100);
  return n;
}

// How a species looks right now.
export function meanTrait(eco, sp, trait) { const list = eco.pop.filter(c => c.sp === sp); return list.length ? list.reduce((n, c) => n + c[trait], 0) / list.length : 0; }
// How much of the plant is stripped, 0…1.
export function dimmed(eco, world, below = .35) {
  let all = 0, low = 0;
  world.sites.forEach((s, i) => { if (!s.plant) return; all++; if (eco.food[i] < below) low++; });
  return all ? low / all : 0;
}
