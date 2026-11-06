// What happens to a jornada on its own, renderer-free: sucesos (a blackout, a
// bat storm, a cave-in, rising water, spores) drawn from the biome's own list, and
// the small hazards that keep ticking: rocks falling from cracked ceilings,
// puffballs, thrown flares, the twin plates of the golden chamber and panas on a
// rope. The host runs all of it; only what a guest must draw is in the state.
// See docs/knowledge/reliquia.md, "Biomes".
import { locKey } from '../../../engine/i18n.js';
import { floorOf } from './deck.js';
import { spawnEnemy, wound } from './enemies.js';
import { random } from './director.js';

const up = p => !p.downed && !p.spectator;
const below = g => g.players.filter(p => up(p) && floorOf(p.x) > 0);
export const SUCESOS = { apagon: { dur: 14 }, murcielagos: { dur: 10 }, derrumbe: { dur: 9 }, creciente: { dur: 18 }, esporada: { dur: 8 } };
// A kind listed twice comes up twice as often in that biome.
export const SUCESO_POOL = {
  biblioteca: ['apagon', 'apagon', 'murcielagos'], mina: ['apagon', 'murcielagos', 'derrumbe'],
  inundada: ['creciente', 'creciente', 'apagon', 'murcielagos'], hongos: ['esporada', 'esporada', 'murcielagos', 'apagon'], templo: ['derrumbe', 'derrumbe', 'apagon', 'murcielagos'],
  // No creciente: the river is opaque, it would drown the loot from sight.
  congo: ['esporada', 'apagon', 'apagon', 'murcielagos'],
};
export const firstSucesoIn = g => 60 + random(g) * 30;
const ROCK = { warning: .9, radius: 1.5, damage: 18, stun: .4, cap: 8 }, SPORES = { trigger: 1.1, reach: 2.6, reversed: 3.5, rearm: 18 }, CRACK = { trigger: 1.1, rearm: 14 };
export const FLARE = { life: 28, freeze: 4.5, glow: 9, speed: 8 };
export const CLIMB = { alone: 2.8, belayed: 1.6, belay: 3.2 };

// A stone comes down in `warning` seconds; the view rings the spot on the floor.
export function dropRock(g, x, z, warning = ROCK.warning) {
  if (g.rocks.length >= ROCK.cap) return null;
  const rock = { id: ++g.shotId, x, z, t: 0, at: warning };
  g.rocks.push(rock); return rock;
}
function tickRocks(g, dt) {
  for (const rock of g.rocks) {
    rock.t += dt; if (rock.t < rock.at) continue;
    rock.done = true; g.noisy('collapse', rock, null, 12);
    const f = floorOf(rock.x);
    for (const p of g.players) if (up(p) && !p.rope && floorOf(p.x) === f && !g.layout.lowAt(p.x, p.z) && Math.hypot(p.x - rock.x, p.z - rock.z) < ROCK.radius) { p.stun = Math.max(p.stun, ROCK.stun); g.damage(p, ROCK.damage, { id: null }); }
    // A rock does not care whose head it finds: walk a mummy under one.
    for (const e of g.enemies) if (e.hp > 0 && !e.hanging && floorOf(e.x) === f && Math.hypot(e.x - rock.x, e.z - rock.z) < ROCK.radius && wound(e, 40) && e.hp <= 0) g.defeated(e, null);
    g.event('rock', '', { x: rock.x, z: rock.z });
  }
  g.rocks = g.rocks.filter(r => !r.done);
}
// A puff of spores: whoever breathes it walks backwards for a moment.
export function sporeCloud(g, x, z) {
  const f = floorOf(x); let hit = 0;
  for (const p of g.players) if (up(p) && floorOf(p.x) === f && Math.hypot(p.x - x, p.z - z) < SPORES.reach) { p.reversed = Math.max(p.reversed, SPORES.reversed); hit++; }
  g.noisy('drop', { x, z }, null, 7);
  g.event('spores', hit ? locKey('¡Esporas! Todo al revés.') : '', { x, z });
}
function tickFloorHazards(g) {
  const { puffs, cracks } = g.layout.run, near = (q, r) => below(g).some(p => !p.rope && floorOf(p.x) === q.floor && !g.layout.lowAt(p.x, p.z) && Math.hypot(p.x - q.x, p.z - q.z) < r);
  for (const q of puffs) if ((g.puffed[q.id] || 0) <= g.time && near(q, SPORES.trigger)) { g.puffed[q.id] = g.time + SPORES.rearm; sporeCloud(g, q.x, q.z); }
  for (const q of cracks) if ((g.cracked[q.id] || 0) <= g.time && near(q, CRACK.trigger)) { g.cracked[q.id] = g.time + CRACK.rearm; dropRock(g, q.x, q.z); g.event('crack', '', { x: q.x, z: q.z }); }
}
// The golden chamber opens to two weights at once: two panas, or one and a carrito.
export const onPlate = (g, q) => [...g.players.filter(up), ...g.carts.filter(c => !c.away)].some(b => Math.hypot(b.x - q.x, b.z - q.z) < 1.15);
function tickTwins(g) {
  for (const t of g.layout.run.twins) {
    if (g.revealed[t.wall]) continue;
    const down = t.plates.filter(q => onPlate(g, q)).length;
    if (down === 2) { g.revealed[t.wall] = 1; g.paths.clear(); g.event('reveal', locKey('¡Las dos losas! Se abrió la cámara dorada.'), { wall: t.wall }); }
    else if (down === 1 && (g.twinHint || 0) <= g.time) { g.twinHint = g.time + 14; g.event('twin', locKey('Una losa bajó. Falta peso en la otra.')); }
  }
}
export function throwFlare(g, p) {
  const speed = FLARE.speed, pitch = p.pitch || 0;
  g.flares.push({ id: ++g.shotId, x: p.x + Math.sin(p.h) * .5, z: p.z + Math.cos(p.h) * .5, y: 1.3 + (p.y || 0), vx: Math.sin(p.h) * speed * Math.cos(pitch), vz: Math.cos(p.h) * speed * Math.cos(pitch), vy: 2.4 + Math.sin(pitch) * speed, life: FLARE.life });
}
function tickFlares(g, dt) {
  for (const s of g.flares) {
    s.life -= dt;
    if (!s.vx && !s.vz && !s.vy) continue;
    s.vy -= 14 * dt;
    const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
    if (g.layout.walkable(nx, nz, g, .08) || g.layout.overPit(nx, nz)) { s.x = nx; s.z = nz; } else { s.vx *= -.25; s.vz *= -.25; }
    s.y += s.vy * dt;
    if (g.layout.overPit(s.x, s.z)) { if (s.y < -6) s.life = 0; continue; }
    const ground = g.layout.groundAt(s.x, s.z);
    if (s.y <= ground + .05) { s.y = ground + .05; s.vx = s.vz = s.vy = 0; }
  }
  g.flares = g.flares.filter(s => s.life > 0);
}
// A pana on a rope: alone it takes a while, with someone at either end holding it far less.
export function startClimb(g, p, rope, down) {
  g.stopDrag(p); p.rope = { id: rope.id, down, t: 0 }; p.vx = p.vz = 0; p.moving = false;
  g.event('rope', '', { player: p.id });
}
export function belayed(g, p, rope) {
  return g.players.some(q => q.id !== p.id && up(q) && !q.rope && floorOf(q.x) === rope.floor && (Math.hypot(q.x - rope.x, q.z - rope.z) < CLIMB.belay && !g.layout.lowAt(q.x, q.z) || Math.hypot(q.x - rope.bx, q.z - rope.bz) < CLIMB.belay && g.layout.lowAt(q.x, q.z)));
}
function tickRopes(g, dt) {
  for (const p of g.players) {
    if (!p.rope) continue;
    const rope = g.layout.run.ropes.find(r => r.id === p.rope.id);
    if (!rope || !up(p)) { endClimb(g, p, rope); continue; }
    p.rope.t = Math.min(1, p.rope.t + dt / (belayed(g, p, rope) ? CLIMB.belayed : CLIMB.alone));
    const t = p.rope.down ? p.rope.t : 1 - p.rope.t;
    p.x = rope.x + (rope.bx - rope.x) * t; p.z = rope.z + (rope.bz - rope.z) * t; p.y = -rope.low * t;
    if (p.rope.t >= 1) p.rope = null;
  }
}
// Knocked off the rope: down at the nearer end.
export function endClimb(g, p, rope = g.layout.run.ropes.find(r => r.id === p.rope?.id)) {
  if (rope && p.rope) { const t = p.rope.down ? p.rope.t : 1 - p.rope.t, low = t > .5; p.x = low ? rope.bx : rope.x; p.z = low ? rope.bz : rope.z; p.y = low ? -rope.low : 0; }
  p.rope = null;
}

const SAY = {
  apagon: locKey('¡Se va la luz! Prendan un farol o una bengala.'), murcielagos: locKey('¡Tormenta de murciélagos!'), derrumbe: locKey('¡La ruina tiembla! Miren al suelo.'),
  creciente: locKey('¡Sube el agua! Las culebras nadan.'), esporada: locKey('¡Esporas en el aire!'),
};
export function startSuceso(g, kind) {
  const live = below(g); if (!live.length || !SUCESOS[kind]) return false;
  g.suceso = { kind, t: 0, dur: SUCESOS[kind].dur, next: 0 }; g.sucesoLast = kind;
  const near = (target, a, b) => { const angle = random(g) * Math.PI * 2, d = a + random(g) * (b - a); return { x: target.x + Math.cos(angle) * d, z: target.z + Math.sin(angle) * d }; };
  if (kind === 'murcielagos') for (let i = 0, n = Math.min(5, 2 + live.length), tries = 0; i < n && tries < 40; tries++) { const q = near(live[Math.floor(random(g) * live.length)], 5, 12); if (spawnEnemy(g, 'bat', q.x, q.z, { born: g.time - 1, hanging: false, y: 2.6 })) i++; }
  if (kind === 'creciente') for (let i = 0, tries = 0; i < 2 && tries < 30; tries++) { const q = near(live[Math.floor(random(g) * live.length)], 6, 11); if (spawnEnemy(g, 'snake', q.x, q.z, { born: g.time - 1 })) i++; }
  if (kind === 'derrumbe') g.caveIn();
  g.event('suceso', SAY[kind], { suceso: kind });
  return true;
}
function tickSuceso(g, dt) {
  const s = g.suceso, live = below(g);
  s.t += dt;
  if (s.kind === 'derrumbe' || s.kind === 'esporada') {
    s.next -= dt;
    if (s.next <= 0 && live.length) {
      const target = live[Math.floor(random(g) * live.length)], angle = random(g) * Math.PI * 2, d = 1 + random(g) * 3.5, x = target.x + Math.cos(angle) * d, z = target.z + Math.sin(angle) * d;
      if (s.kind === 'derrumbe') { s.next = .7; if (g.layout.walkable(x, z, g, .2)) dropRock(g, x, z); }
      else { s.next = 1.8; if (g.layout.walkable(x, z, g, .2)) sporeCloud(g, x, z); }
    }
  }
  if (s.t >= s.dur) { g.event('suceso-end', '', { suceso: s.kind }); g.suceso = null; g.sucesoIn = 55 + random(g) * 50; }
}
export function tickHazards(g, dt) {
  tickRopes(g, dt); tickRocks(g, dt); tickFlares(g, dt); tickFloorHazards(g); tickTwins(g);
  if (g.suceso) return tickSuceso(g, dt);
  if (!below(g).length) return;
  g.sucesoIn -= dt; if (g.sucesoIn > 0) return;
  const pool = SUCESO_POOL[g.layout.run.theme] || SUCESO_POOL.mina, fresh = pool.filter(k => k !== g.sucesoLast);
  startSuceso(g, fresh[Math.floor(random(g) * fresh.length)]);
}
