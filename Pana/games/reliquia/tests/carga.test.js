// Loading the carrito: true-size packing, aiming into the hopper, bounces and
// the rolling wobble. None of it may touch anybody's speed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, interaction } from '../public/rules.js';
import { HOPPER, BULK, packCart, fitsIn, fillOf, overRim, aimInto, overHopper, bounceChance, placeTime, climbTime, throwPower, heftOf, stepWobble } from '../public/carga.js';
import { ITEMS } from '../public/items.js';

function setup() { const g = new Expedition(4242, { place: 'mina' }); g.addPlayer(1, 'Ana'); g.start(4242); for (const r of g.layout.run.rooms) g.woke[r.id] = 1; g.director.duration = 1e6; return g; }
const pieces = (kind, n) => Array.from({ length: n }, () => ({ kind, worth: 1 }));
// Behind the cart, the crosshair `off` metres past its centre on the rim plane.
function aim(g, cart, off = 0, back = 1.6) {
  const p = g.players[0]; Object.assign(p, { x: cart.x + Math.sin(cart.h + Math.PI) * back, z: cart.z + Math.cos(cart.h + Math.PI) * back, h: cart.h, y: 0 });
  p.pitch = -Math.atan2(1.45 - HOPPER.rim, back + off); p.interactCooldown = 0; return p;
}
function hold(g, seconds) { for (let t = 0; t < seconds; t += .05) g.update(.05, new Map([[1, { hold: true, h: g.players[0].h, pitch: g.players[0].pitch }]])); }

test('every loadable piece has its true size and a heft', () => {
  for (const [kind, info] of Object.entries(ITEMS)) if (!info.tool && info.size !== 'big') {
    assert.ok(BULK[kind], `${kind} has a footprint`); assert.ok(heftOf(kind) > 0 && heftOf(kind) < 1, `${kind} has a heft`);
  }
  assert.equal(heftOf('sunDisk'), 1, 'a big treasure is the heaviest there is');
});

test('capacity is about what fits: small coins many, big masks few, a big treasure fills it', () => {
  const count = kind => { const list = []; let n = 0; while (fitsIn({ contents: list, big: null }, kind) && n < 60) { list.push({ kind }); n++; } return n; };
  assert.ok(count('coins') >= 14, `${count('coins')} coin piles (it held 14 before)`);
  assert.ok(count('mask') < count('coins') / 2, `${count('mask')} masks take far more room`);
  assert.equal(fitsIn({ contents: [], big: { kind: 'sunDisk' } }, 'coins'), false);
  assert.equal(fillOf({ contents: [], big: { kind: 'sunDisk' } }), 1);
  assert.equal(fillOf({ contents: [], big: null }), 0);
});

test('the packing is true to the hopper: nothing overlaps, nothing pokes through a wall', () => {
  const mix = [...pieces('coins', 3), ...pieces('mask', 2), ...pieces('cup', 3), ...pieces('emerald', 2)], { slots, top } = packCart(mix);
  assert.equal(slots.length, mix.length); assert.ok(top > 0);
  slots.forEach((s, i) => {
    const [w, d] = BULK[mix[i].kind];
    assert.ok(Math.abs(s.x) + w / 2 <= HOPPER.width / 2 + .13 && Math.abs(s.z) + d / 2 <= HOPPER.length / 2 + .13, `${mix[i].kind} inside the walls`);
    slots.forEach((o, j) => { if (j <= i) return; const [w2, d2, h2] = BULK[mix[j].kind], [, , h1] = BULK[mix[i].kind]; const apart = Math.abs(s.x - o.x) >= (w + w2) / 2 - .13 || Math.abs(s.z - o.z) >= (d + d2) / 2 - .13 || o.y >= s.y + h1 - 1e-6 || s.y >= o.y + h2 - 1e-6; assert.ok(apart, `${i} and ${j} overlap`); });
  });
  assert.deepEqual(packCart(mix), packCart(mix), 'the same contents pack the same on every client');
});

test('a big treasure pushes out what stood above the rim', () => {
  const cart = { contents: pieces('cup', 12), big: null };
  assert.ok(overRim(cart).length > 0);
  assert.equal(overRim({ contents: pieces('cup', 2), big: null }).length, 0);
});

test('you have to aim into the opening', () => {
  const g = setup(), cart = g.carts[0], p = g.players[0]; p.hands[0] = { id: 70, kind: 'coins', pile: ['coins'] };
  aim(g, cart); assert.equal(aimInto(p, cart), 'in'); assert.equal(interaction(g, p).kind, 'cart-load');
  aim(g, cart, HOPPER.length / 2 + .25); assert.equal(aimInto(p, cart), 'rim');
  p.pitch = 0; assert.equal(aimInto(p, cart), 'out', 'looking over it');
  const told = interaction(g, p); assert.equal(told.kind, 'info'); assert.equal(g.action(1, 'interact'), false, 'nothing is thrown blind'); assert.ok(p.hands[0]);
  assert.equal(overHopper({ x: cart.x, z: cart.z }, cart), true); assert.equal(overHopper({ x: cart.x + 3, z: cart.z }, cart), false);
});

test('a careful load always lands; the rim, a heap, a rolling cart and weight do not', () => {
  assert.equal(bounceChance({ heft: .6, aim: 'in', fill: .3 }), 0, 'careful never bounces');
  const rim = bounceChance({ heft: .2, aim: 'rim' }), heavy = bounceChance({ heft: .6, aim: 'rim' });
  assert.ok(rim > 0 && heavy > rim, 'the rim, and heavier is worse');
  assert.ok(bounceChance({ heft: .3, fill: 1 }) > bounceChance({ heft: .3, fill: .6 }), 'an overfilled cart');
  assert.ok(bounceChance({ heft: .3, speed: 4 }) > 0, 'a cart on the move');
  assert.ok(bounceChance({ heft: .3, impact: 12 }) > 0 && bounceChance({ heft: .3, impact: 5 }) === 0, 'only a hard throw');
  assert.ok(bounceChance({ heft: 1, aim: 'rim', fill: 1, speed: 9, wobble: 1, impact: 30 }) <= .95, 'never a sure loss');
});

test('heavier pieces: shorter throws and longer to place; handfuls are a tap', () => {
  assert.equal(placeTime({ kind: 'coins', pile: ['coins'] }), 0);
  assert.ok(placeTime({ kind: 'idol' }) > placeTime({ kind: 'luckyCoin' }));
  assert.ok(throwPower('idol', 10) < throwPower('coins', 10)); assert.ok(throwPower('coins', 10) < 10);
  assert.ok(climbTime('altar') > climbTime('sunDisk'));
});

test('a hand treasure takes a held E and lands in the cart', () => {
  const g = setup(), cart = g.carts[0], p = g.players[0]; p.hands[0] = { id: 70, kind: 'mask', worth: 1 };
  aim(g, cart); const target = interaction(g, p);
  assert.equal(target.kind, 'cart-load'); assert.equal(target.hold, true); assert.equal(g.action(1, 'interact'), false, 'a tap is not enough');
  hold(g, placeTime({ kind: 'mask' }) * .5); assert.equal(cart.contents.length, 0);
  assert.ok(interaction(g, p).progress > 0, 'the bar fills');
  hold(g, placeTime({ kind: 'mask' })); assert.deepEqual(cart.contents.map(c => c.kind), ['mask']); assert.equal(p.hands[0], null);
});

test('letting go starts the placing over', () => {
  const g = setup(), cart = g.carts[0], p = g.players[0]; p.hands[0] = { id: 70, kind: 'mask', worth: 1 };
  aim(g, cart); hold(g, .2); assert.ok(p.placing > 0); g.update(.05); assert.equal(p.placing, 0);
});

test('a bounced piece is loot on the floor, and it does not fall right back in', () => {
  const g = setup(), cart = g.carts[0], items = g.items.length;
  g.spill(cart, 'emerald', .9); assert.equal(g.items.length, items + 1);
  const piece = g.items.at(-1); assert.equal(piece.state, 'air'); assert.equal(piece.spilled, cart.id); assert.equal(piece.worth, .9);
  for (let t = 0; t < 2 && piece.state === 'air'; t += .05) g.update(.05);
  assert.equal(piece.state, 'ground'); assert.equal(cart.contents.length, 0); assert.equal(piece.spilled, undefined);
});

test('the wobble feeds on rough handling of a heap and settles by itself', () => {
  assert.equal(stepWobble(0, { jerk: 8, fill: .2 }), 0, 'a light load does not care');
  const a = stepWobble(0, { jerk: 8, fill: 1 }); assert.ok(a > 0, 'a heap does');
  assert.ok(stepWobble(0, { jerk: 8, fill: 1, big: true }) > a, 'top-heavy is worse');
  assert.ok(stepWobble(0, { bump: true, fill: 1 }) > 0, 'a wall too');
  assert.equal(stepWobble(0, { jerk: 1, fill: 1 }), 0, 'a gentle start does nothing');
  let w = .8; for (let i = 0; i < 40; i++) w = stepWobble(w, { fill: 1 }); assert.equal(w, 0, 'it settles');
});

test('zigzagging a heaped cart loses its top piece; a calm push loses nothing', () => {
  const heaped = () => { const g = setup(), cart = g.carts[0], p = aim(g, g.carts[0]); cart.contents = pieces('cup', 12); cart.pushers = [1]; p.push = cart.id; return { g, cart, p }; };
  const zig = heaped(); let t = 0;
  for (let i = 0; i < 200 && zig.cart.contents.length === 12; i++) { t++; zig.g.update(.05, new Map([[1, { x: t % 6 < 3 ? 1 : -1, z: 0, h: 0 }]])); }
  assert.ok(zig.cart.contents.length < 12, 'a piece fell off'); assert.ok(zig.g.events.some(e => e.kind === 'cart-spill'));
  const calm = heaped(); for (let i = 0; i < 60; i++) calm.g.update(.05, new Map([[1, { x: Math.sin(i / 60), z: .2, h: 0 }]]));
  assert.equal(calm.cart.contents.length, 12);
});

test('no speed changed: a push and a walk are what they always were', () => {
  const g = setup(), cart = g.carts[0], p = aim(g, g.carts[0]); cart.contents = pieces('cup', 10); cart.pushers = [1]; p.push = cart.id;
  const before = { x: cart.x, z: cart.z }; g.update(.05, new Map([[1, { x: 0, z: -1, h: 0 }]]));
  const load = Math.min(.4, cart.contents.length * .02);
  assert.ok(Math.abs(Math.hypot(cart.vx, cart.vz) - 4.4 * (1 - load)) < 1e-9, 'the same push speed as ever'); assert.ok(before);
  const walker = setup(), w = walker.players[0]; w.hands[0] = { id: 1, kind: 'idol', worth: 1 };
  walker.update(.05, new Map([[1, { x: 0, z: 1, h: 0 }]]));
  assert.ok(Math.abs(Math.hypot(w.vx, w.vz) - 4.6) < .01, 'carrying the heaviest piece, still 4.6 m/s');
});

test('host change: cart and placing are plain JSON', () => {
  const g = setup(), cart = g.carts[0], p = g.players[0]; p.hands[0] = { id: 70, kind: 'mask', worth: 1 }; cart.contents = pieces('coins', 2); aim(g, cart); hold(g, .1);
  const snap = g.snapshot(); assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
  const next = new Expedition(snap.seed, snap.options); next.restore(snap, new Map([[1, { id: 1, name: 'Ana', avatar: {} }]]));
  assert.equal(next.carts[0].contents.length, 2); assert.ok(next.players[0].placing > 0);
});
