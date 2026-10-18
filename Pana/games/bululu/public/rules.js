// Bululú's board rules: plain data and pure functions, no Three.js and no DOM.
// game.js plays them out with tokens, dice and toasts; tests/rules.test.js checks them.

export const COLORS = ['#ff4b4b', '#3d7bf2', '#ffc629', '#2fbf4a', '#ad70ec', '#ff8e3d'];
export const RIVALS = ['Don Pancho', 'La Chama', 'El Gocho', 'Tía Carmen', 'El Catire', 'Yoli', 'Chuchú', 'La Nena'];
export const START_COINS = 10;
export const PRICE = 20;            // one Mango de oro at the stand
export const DOUBLES_BONUS = 5;
export const TILE_COINS = { blue: 3, start: 3, red: -3 };
export const TREE = { mango: 0.1, coconut: 0.4 };   // cumulative odds; the rest rains coins
export const TREE_COINS = { coconut: -4, coins: 8 };
export const BRINDIS = 2;           // each pana gives this much on "¡Brindan los panas!"

// Most golden mangos first; coins break ties.
export function standings(players) {
  return [...players].sort((a, b) => b.mangos - a.mangos || b.coins - a.coins);
}

// Place per player index; a full tie (mangos and coins) shares the place.
export function ranks(players) {
  const order = standings(players);
  const out = {};
  order.forEach((p, k) => {
    const prev = order[k - 1];
    out[p.i] = prev && prev.mangos === p.mangos && prev.coins === p.coins ? out[prev.i] : k + 1;
  });
  return out;
}

// Coins never go below zero; returns the change that really happened.
export function addCoins(p, n) {
  const before = p.coins;
  p.coins = Math.max(0, p.coins + n);
  return p.coins - before;
}

export const canBuy = (p) => p.coins >= PRICE;
export function buyMango(p) {
  if (!canBuy(p)) return false;
  p.coins -= PRICE;
  p.mangos += 1;
  return true;
}

// Two dice; doubles pay DOUBLES_BONUS.
export function rollDice(random = Math.random, count = 2) {
  const a = 1 + Math.floor(random() * 6), b = count === 1 ? 0 : 1 + Math.floor(random() * 6);
  return { a, b, n: a + b, doubles: count === 2 && a === b };
}

// Coins for landing on a plain tile; null for tiles with their own effect (tree, event).
export const tileCoins = (kind) => TILE_COINS[kind] ?? null;

// What falls when a pana shakes the mango tree, from a 0–1 roll.
export const treeOutcome = (r) => (r < TREE.mango ? 'mango' : r < TREE.coconut ? 'coconut' : 'coins');

// Steps along the board graph (tiles[i].next) from one tile to another.
export function stepsTo(tiles, from, goal) {
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const t = queue.shift();
    if (t === goal) return seen.get(t);
    for (const n of tiles[t].next) {
      if (!seen.has(n)) { seen.set(n, seen.get(t) + 1); queue.push(n); }
    }
  }
  return Infinity;
}

// A bot at the fork takes the paid hill shortcut when it can afford the toll
// plus a mango and the hill reaches the stand sooner; sometimes just for fun.
export function botTakesHill({ coins, toll, viaHill, viaShore, whim }) {
  return (coins >= PRICE + toll && viaHill < viaShore) || whim < 0.3;
}

// Where the mango stand may move: free tiles the panas reach soon on average,
// but not right under anyone's nose. Falls back to any free tile.
export function standCandidates({ tileCount, standTile, tiles, players, isBad }) {
  const taken = new Set(players.map((o) => o.tile));
  const options = [], fallback = [];
  for (let i = 0; i < tileCount; i++) {
    if (i === standTile || taken.has(i) || isBad(i)) continue;
    const steps = players.map((o) => stepsTo(tiles, o.tile, i));
    const avg = steps.reduce((a, b) => a + b, 0) / steps.length;
    fallback.push(i);
    if (Math.min(...steps) >= 4 && avg >= 8 && avg <= 24) options.push(i);
  }
  return options.length ? options : fallback;
}

// "¡Brindan los panas!": every other pana gives up to BRINDIS coins to p.
export function brindis(players, p) {
  let total = 0;
  for (const o of players) {
    if (o === p) continue;
    const n = Math.min(BRINDIS, o.coins);
    o.coins -= n;
    p.coins += n;
    total += n;
  }
  return total;
}

// Which minigame plays next: every one once per pass, shuffled, and never the
// same one twice in a row across passes. Returns a draw() function.
export function minigameBag(ids, random = Math.random) {
  let bag = [], last = null;
  return () => {
    if (!bag.length) {
      bag = [...ids];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    last = bag.pop();
    return last;
  };
}
