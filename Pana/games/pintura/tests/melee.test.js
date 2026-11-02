import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, cleanInput, BOT_ID } from '../public/rules.js';
import { MELEE, WEAPONS, ATTACHMENTS, kitStats, kitRating, cleanKit, canAttach, dpsOf, meleeInterval, throwRange, cycleWeapon, isMelee } from '../public/armory-data.js';

// A plaza round with A at (x, z) facing -z and B straight ahead `gap` metres away, nobody shielded.
function duel(weapon, gap = 1.5, { toughness = 3, third = null, kit = {} } = {}) {
  const g = new Arena('plaza', 'normal', { toughness });
  g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} }); if (third) g.add(3, { name: 'C', avatar: {} });
  g.selectKit(1, { weapon, ...kit }); g.start(); g.go();
  const [a, b, c] = g.players;
  Object.assign(a, { x: -14, z: 22, ax: 0, az: -1, shield: 0 }); Object.assign(b, { x: -14, z: 22 - gap, shield: 0 });
  if (c) Object.assign(c, { x: -14 + third.x, z: 22 + third.z, shield: 0 });
  return { g, a, b, c };
}
const run = (g, steps, input = {}) => { for (let i = 0; i < steps; i++) g.step(.05, new Map([[1, { ax: 0, az: -1, ...input }]])); };

test('cleanInput accepts alt (or throw) only as a real boolean and keeps the pitch finite and clamped', () => {
  assert.equal(cleanInput({ alt: true }).alt, true); assert.equal(cleanInput({ throw: true }).alt, true);
  assert.equal(cleanInput({ alt: 'yes' }).alt, false); assert.equal(cleanInput({ alt: 1 }).alt, false); assert.equal(cleanInput({}).alt, false);
  assert.equal(cleanInput({ pitch: NaN }).pitch, 0); assert.equal(cleanInput({ pitch: 9 }).pitch, .55); assert.equal(cleanInput({ pitch: -9 }).pitch, -.7);
  assert.equal(cleanInput({ weapon: 'sandal' }).weapon, 'sandal'); assert.equal(cleanInput({ weapon: 'chainsaw' }).weapon, null);
});

test('a melee swing hits the one pana in front with the whole stack, no ammo spent', () => {
  const { g, a, b } = duel('bat', 1.6);
  run(g, 1, { fire: true }); assert.equal(a.melee.phase, 'windup'); assert.equal(b.paint, 0, 'nothing lands before the windup ends');
  run(g, 5); assert.equal(b.hits, 1, 'three pepazos at Aguante 3: out'); assert.equal(a.score, 1); assert.equal(a.smacks, 1);
  assert.equal(a.ammo, 0); assert.equal(a.fired, 0); assert.equal(g.balls.length, 0);
  assert.equal(g.events.at(-1).type, 'out'); assert.equal(g.events.at(-1).weapon, 'bat');
});

test('two panas in reach: only the nearest is painted', () => {
  const { g, b, c } = duel('roller', 1.2, { toughness: 6, third: { x: .4, z: -2 } });
  run(g, 1, { fire: true }); run(g, 6);
  assert.equal(b.paint, 2); assert.equal(c.paint, 0);
});

test('a swing misses past the reach, behind the back and through cover, and waits out its cooldown', () => {
  let { g, b } = duel('brush', 3); run(g, 1, { fire: true }); run(g, 6); assert.equal(b.paint, 0, 'out of reach');
  ({ g, b } = duel('brush', -1.4)); run(g, 1, { fire: true }); run(g, 6); assert.equal(b.paint, 0, 'behind');
  // Plaza cover: the 0.8 m deep building corner at z = ±16 (x ±8.7–12.3). A pana on its far side, within reach, is safe.
  const d = duel('bat', 2, { toughness: 6 }); Object.assign(d.a, { x: 10.5, z: 17.2 }); Object.assign(d.b, { x: 10.5, z: 14.8 }); d.a.melee.phase = 'ready';
  d.g.players[1].shield = 0; run(d.g, 1, { fire: true }); run(d.g, 6); assert.equal(d.b.paint, 0, 'cover between');
  // La Brocha: 0.1 s windup + 0.2 s recovery, one pepazo a blow. Holding fire for 1.5 s lands five.
  const e = duel('brush', 1.2, { toughness: 5 }); run(e.g, 30, { fire: true });
  assert.equal(e.a.melee.swings, 5); assert.equal(e.a.smacks, 5); assert.equal(e.b.hits, 1, 'the fifth one at Aguante 5');
});

test('drip paints one more pepazo, tape is faster and shorter, knockback and stun land', () => {
  const plain = kitStats({ weapon: 'brush' }), drip = kitStats({ weapon: 'brush', attachments: ['drip'] }), tape = kitStats({ weapon: 'brush', attachments: ['tape'] });
  assert.equal(drip.damage, plain.damage + 1); assert.ok(drip.recovery > plain.recovery);
  assert.ok(tape.windup < plain.windup && tape.reach < plain.reach);
  const { g, a, b } = duel('maraca', 1.5, { toughness: 6 }); const z = b.z;
  run(g, 1, { fire: true }); run(g, 2); assert.equal(b.paint, 1); assert.ok(b.slow > .8, 'La Maraca slows'); assert.ok(b.z < z, 'pushed back');
  assert.ok(a.melee.phase === 'recover' || a.melee.phase === 'ready');
});

test('La Chancleta: alt throws it on an arc, it leaves the hand, paints a pana 15 m away out and comes back 2.5 s later', () => {
  const { g, a, b } = duel('sandal', 15);
  run(g, 1, { alt: true });
  assert.equal(a.melee.phase, 'away'); assert.equal(g.thrown.length, 1); assert.equal(a.melee.throws, 1);
  let peak = 0; for (let i = 0; i < 20 && g.thrown.length; i++) { peak = Math.max(peak, g.thrown[0].y); run(g, 1); }
  assert.ok(peak > 1.6, 'it arcs up'); assert.equal(g.thrown.length, 0);
  assert.equal(b.hits, 1, 'one throw takes them out'); assert.equal(g.events.at(-1).thrown, true);
  // Holding alt, firing and switching weapon do nothing while it is away.
  run(g, 5, { alt: true, fire: true, weapon: 'bat' }); assert.equal(a.melee.phase, 'away'); assert.equal(a.kit.weapon, 'sandal'); assert.equal(a.melee.swings, 0);
  for (let i = 0; i < 60 && a.melee.phase === 'away'; i++) run(g, 1);
  assert.equal(a.melee.phase, 'ready'); assert.equal(a.recalls, 1); assert.equal(a.melee.throws, 1);
});

test('a thrown chancla stops on cover and still comes back on time', () => {
  const { g, a, b } = duel('sandal', 15);
  // The 2.8 m building corner at x 8.7–12.3 spans z 15.6–16.4: B hides behind it.
  Object.assign(a, { x: 10.5, z: 19.5 }); Object.assign(b, { x: 10.5, z: 9 });
  let steps = 0; run(g, 1, { alt: true }); steps++;
  while (g.thrown.length && steps < 60) { run(g, 1); steps++; }
  assert.equal(b.paint, 0, 'the corner took it'); assert.ok(g.splats.some(s => Math.abs(s.z - 16.375) < .1), 'it splats on the corner face');
  while (a.melee.phase === 'away' && steps < 200) { run(g, 1); steps++; }
  assert.ok(Math.abs(steps * .05 - 2.55) < .06, `back after ${(steps * .05).toFixed(2)} s`);
});

test('respawn puts the chancla back in the hand; a bat cannot be thrown', () => {
  let { g, a } = duel('sandal', 30); run(g, 1, { alt: true }); assert.equal(a.melee.phase, 'away');
  g.respawn(a); assert.equal(a.melee.phase, 'ready'); assert.equal(a.melee.throws, 1, 'counts survive for the clients');
  ({ g, a } = duel('bat', 30)); run(g, 1, { alt: true }); assert.equal(g.thrown.length, 0); assert.equal(a.melee.phase, 'ready');
});

test('a bot with a melee weapon closes in and swings; with the chancla it throws from range', () => {
  for (const weapon of ['bat', 'sandal']) {
    const g = new Arena('plaza', 'experto', { toughness: 3 }); g.add(1, { name: 'A', avatar: {} }); g.add(BOT_ID, { name: 'Bot', avatar: {}, bot: true });
    g.selectKit(BOT_ID, { weapon }); g.start(); g.go();
    const [p, bot] = g.players; Object.assign(p, { x: -14, z: 22, shield: 0 }); Object.assign(bot, { x: -14, z: 12, shield: 0 });
    let thrown = 0; for (let i = 0; i < 200 && !p.hits; i++) { g.step(.05, new Map([[1, {}]])); thrown = Math.max(thrown, g.thrown.length); p.shield = 0; }
    assert.equal(p.hits, 1, `${weapon} bot painted the pana`);
    if (weapon === 'sandal') assert.ok(bot.melee.throws > 0 && thrown > 0, 'the sandal bot threw');
    else assert.ok(bot.melee.swings > 0 && bot.smacks > 0, 'the bat bot swung');
  }
});

test('all six melee weapons have armory numbers, three melee parts and their place in the cycle', () => {
  assert.deepEqual(MELEE.map(m => m.id), ['bat', 'sandal', 'roller', 'brush', 'bucket', 'maraca']);
  for (const m of MELEE) {
    const s = kitStats({ weapon: m.id });
    assert.ok(s.melee && isMelee(m.id) && WEAPONS.includes(m), m.id);
    for (const key of ['reach', 'arc', 'windup', 'recovery', 'damage', 'mobility', 'toughness']) assert.ok(Number.isFinite(s[key]) && s[key] > 0, `${m.id} ${key}`);
    assert.ok(s.mobility >= 1 && s.mobility <= 1.15, `${m.id} is at least as light as La Chispa`);
    assert.equal(s.magazine, 0); assert.equal(s.aims, false); assert.equal(s.sprint, true);
    assert.ok(dpsOf(s) > 2 && dpsOf(s) < 5, `${m.id} ${dpsOf(s)} pepazos/s`);
    assert.ok(meleeInterval(s) >= .3 && meleeInterval(s) <= 1.1);
    const rating = kitRating({ weapon: m.id }); assert.ok(rating >= 100 && rating <= 800, `${m.id} rating ${rating}`);
    for (const a of ATTACHMENTS) assert.equal(canAttach(m.id, a.id), !!a.melee, `${m.id} ${a.id}`);
    assert.deepEqual(cleanKit({ weapon: m.id, attachments: ['barrel', 'tape', 'drip'] }).attachments, [null, 'tape', 'drip']);
  }
  assert.ok(throwRange(kitStats({ weapon: 'sandal' }).throwable) > 15, 'the chancla reaches past 15 m from a level look');
  assert.equal(kitStats({ weapon: 'sandal', attachments: ['strap'] }).throwable.recall, 1.5);
  assert.equal(kitStats({ weapon: 'sandal', attachments: ['drip'] }).throwable.damage, 4, 'a throw paints what a strike does');
  assert.equal(MELEE.filter(m => m.throwable).map(m => m.id).join(), 'sandal');
  assert.equal(cycleWeapon('sprayer', 1), 'bat'); assert.equal(cycleWeapon('maraca', 1), 'pistol');
  assert.equal(kitStats({ weapon: 'sandal' }, { weapons: 'pistol' }).id, 'pistol', 'pistol-only rooms keep La Chispa');
});
