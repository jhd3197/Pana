// Pure inventory rules shared by the player, bots and combat.
import { clamp, smoothstep } from '../../../engine/random.js';

export const MAX_COINS = 10;
export const COIN_SPEED = 0.008;
export const SLOT_COUNT = 2;

export const activeItem = c => c.inventory[c.selected];
export const isMango = item => item?.kind === 'mango' || item?.kind === 'mango3';
export const canBlock = c => !c.done && isMango(activeItem(c)) && activeItem(c).rolling <= 0;
export const coinMultiplier = c => 1 + Math.min(MAX_COINS, Math.max(0, c.coins || 0)) * COIN_SPEED;
// A full coin purse (10) powers up the next item: it flies faster, lasts longer.
export const isJuiced = c => (c.coins || 0) >= MAX_COINS;
// Items that come in threes; each use spends one charge.
export const CHARGES = { mango3: 3, jugo3: 3 };
// Items fired at someone (front/back) versus used on yourself or the field.
export const AIMED = new Set(['mango', 'mango3', 'concha', 'trampa', 'cohete']);

// The downpour falls on every rival at once, rippling out from the caller's
// place (nearest first) a beat apart. The caller freezes the order at
// release and one schedule is relayed, so changing places cannot duplicate
// or dodge it.
export const RAIN_LEAD_IN = 0.75;
export const RAIN_STAGGER = 0.15;
export function rainWave(order, caller, time = 5) {
  const at = order.indexOf(caller);
  if (at < 0) return [];
  const rivals = order.filter(c => c !== caller && !c.done && !c.dns && !c.retired)
    .sort((a, b) => Math.abs(order.indexOf(a) - at) - Math.abs(order.indexOf(b) - at));
  return rivals.map((target, i) => ({ target, delay: RAIN_LEAD_IN + i * RAIN_STAGGER, time: Math.min(8, time) }));
}

// Soaked: the held item slips away, every charge of it.
export function dropItem(c) {
  const item = activeItem(c);
  if (!item) return null;
  c.inventory[c.selected] = null;
  const next = c.inventory.findIndex(Boolean);
  if (next >= 0) c.selected = next;
  return item.kind;
}

// Gain on even a boosted leader; a full lap of separation closes in < 9 s.
export function chancletaSpeed(gap, targetSpeed = 0) {
  return Math.max(110, Math.max(0, targetSpeed) + 65, gap / 7 + Math.max(0, targetSpeed));
}

export function addItem(c, kind, rolling = 0.65) {
  const empty = c.inventory.indexOf(null);
  if (empty < 0) return false;
  const wasEmpty = !activeItem(c);
  c.inventory[empty] = { kind, n: CHARGES[kind] || 1, rolling };
  if (wasEmpty) c.selected = empty;
  return true;
}

export function selectItem(c, index) {
  if (c.done || !Number.isInteger(index) || index < 0 || index >= SLOT_COUNT || !c.inventory[index]) return false;
  c.selected = index;
  return true;
}

export function consumeItem(c) {
  const item = activeItem(c);
  if (!item || item.rolling > 0) return false;
  if (--item.n <= 0) {
    c.inventory[c.selected] = null;
    const next = c.inventory.findIndex(Boolean);
    if (next >= 0) c.selected = next;
  }
  return true;
}

// Sweep a moving pickup/projectile against a circle, so turbo cannot skip it.
export function segmentDistanceSq(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, length = dx * dx + dz * dz;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / length)) : 0;
  return (px - ax - t * dx) ** 2 + (pz - az - t * dz) ** 2;
}

// Race balancing is independent of rendering, item art and bot ownership.

const ODDS = {
  mango: [3, 2], mango3: [0, 2], jugo: [1, 5], jugo3: [0, 3],
  concha: [4, 0.5], trampa: [3, 0.5], cohete: [1, 2],
  chancleta: [0, 0.75], totuma: [1.5, 2], aguacero: [0, 0.75],
};
const BATTLE_ODDS = { mango: 3, mango3: 1, concha: 2, trampa: 2, cohete: 2, totuma: 1, jugo: 1 };
export const MAJOR_RECOVERY = 10;
export const MAJOR_OPENING = 12;
export const isMajor = kind => kind === 'chancleta' || kind === 'aguacero';
export const activeRacer = c => !c.done && !c.dns && !c.retired && !c.ghost;
export const raceProgress = (c, length) => (c.lap || 0) * length + (c.prog || 0);

// Fixed reference pace: stopping must not inflate the measured time gap.
// Lap-aware progress also avoids mistaking a nearby lapped car for the leader.
export function itemWeights(c, order, length, { eligible = true, elapsed = 0, battle = false } = {}) {
  if (battle) return { ...BATTLE_ODDS };
  const field = order.filter(activeRacer), place = field.indexOf(c);
  const rank = place > 0 ? place / Math.max(1, field.length - 1) : 0;
  const seconds = field.length ? Math.max(0, raceProgress(field[0], length) - raceProgress(c, length)) / 38 : 0;
  const gap = smoothstep((seconds - 1.5) / 6.5);
  const help = eligible && place > 0 ? 0.25 * rank + 0.75 * gap : 0;
  const weights = Object.fromEntries(Object.entries(ODDS).map(([kind, [lead, last]]) => [kind, lead + (last - lead) * help]));
  // Movement helps the distant racer; major attacks stay scarce in large fields.
  for (const kind of ['chancleta', 'aguacero']) weights[kind] *=
    eligible && place > 0 && seconds >= 3 && elapsed >= MAJOR_OPENING ? Math.min(1, 4 / field.length) : 0;
  return weights;
}

export function drawItem(weights, random) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  let roll = clamp(random(), 0, 1 - Number.EPSILON) * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [kind, weight] of entries) if ((roll -= weight) < 0) return kind;
  return 'mango';
}

// High-water progress cannot be reset by reversing out and driving back in.
// Basic supplies remain available; only comeback odds require forward travel.
export function pickupEligibility(c, length, history, headingForward = true) {
  const progress = raceProgress(c, length), previous = history.get(c);
  const eligible = c.vf > 3 && headingForward && !(c.rescueT > 0) &&
    (previous === undefined || progress >= previous + 35);
  history.set(c, Math.max(previous ?? -Infinity, progress));
  return eligible;
}

// Closest-approach prediction ignores harmless projectiles passing beside or
// away from a bot. A locked chancleta is a threat even before its high dive.
export function incomingThreat(c, f) {
  if (f.dead || f.owner === c) return false;
  const p = f.m.position, dx = c.x - p.x, dz = c.z - p.z;
  if (Math.hypot(dx, dz) > 40) return false;
  if (f.kind === 'chancleta') return f.target === c;
  if (Math.abs((c.y || 0) + 1 - p.y) > 4) return false;
  const vx = Math.sin(f.h) * f.speed - (c.vx || 0), vz = Math.cos(f.h) * f.speed - (c.vz || 0);
  const v2 = vx * vx + vz * vz;
  if (v2 < 0.01) return false;
  const arrival = (dx * vx + dz * vz) / v2;
  return arrival >= 0 && arrival <= 1.2 && Math.hypot(dx - vx * arrival, dz - vz * arrival) < 4;
}

export const reactionDelay = itemDelay => clamp(0.3 * itemDelay, 0.18, 0.6);
export function reactToThreat(state, id, dt, delay) {
  if (!id) { state.id = null; state.time = 0; return false; }
  if (state.id !== id) { state.id = id; state.time = 0; }
  state.time += dt;
  return state.time + 1e-9 >= delay;
}
