// Pure inventory rules shared by the player, bots and combat.
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

// The caller freezes the order at release: nearest rival first, leader last.
// One schedule is relayed, so changing places cannot duplicate or dodge a wave.
export const RAIN_LEAD_IN = 0.75;
export const RAIN_INTERVAL = 1.8;
export function rainWave(order, caller, time = 3.5, battle = false) {
  const at = order.indexOf(caller);
  if (at < 0) return [];
  const ahead = (battle ? order.filter(c => c !== caller) : order.slice(0, at))
    .filter(c => !c.done && !c.dns && !c.retired).reverse();
  return ahead.map((target, i) => ({ target, delay: RAIN_LEAD_IN + i * RAIN_INTERVAL,
    time: Math.min(8, time + i * 0.4) }));
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
