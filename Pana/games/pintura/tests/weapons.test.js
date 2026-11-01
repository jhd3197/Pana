import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKERS, kitStats, cleanKit, rangedDamage } from '../public/armory-data.js';
import { Arena, cleanInput, BOT_ID, EYE, CHEST_Y } from '../public/rules.js';

// Two panas on the open plaza lane at z = -14, the shooter at x = -20 facing +x.
// Past the plaza's 54 m the duel moves to El Terminal's 116 m court with the cover taken away.
function duel(weapon, { gap = 20, toughness, armor } = {}) {
  const g = new Arena(gap > 40 ? 'terminal' : 'plaza', 'normal', { lives: 0, ...(toughness ? { toughness } : {}) });
  if (gap > 40) Object.defineProperty(g, 'cover', { value: [] });
  g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} });
  g.selectKit(1, { weapon }); if (armor) g.selectKit(2, { armor });
  g.start(); g.go();
  const [a, b] = g.players; Object.assign(a, { x: -20, z: -14, shield: 0 }); Object.assign(b, { x: -20 + gap, z: -14, shield: 0 });
  return { g, a, b };
}
const fire = (g, input = {}) => g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true, ...input }]]));
const idle = (g, steps = 1) => { for (let i = 0; i < steps; i++) g.step(.05, new Map([[1, { ax: 1, az: 0 }]])); };

test('the two new markers are pickable everywhere a weapon id is checked', () => {
  for (const id of ['sniper', 'bazooka']) {
    assert.ok(MARKERS.some(m => m.id === id));
    assert.equal(cleanKit({ weapon: id }).weapon, id);
    assert.equal(cleanInput({ weapon: id }).weapon, id);
  }
  assert.equal(cleanInput({ weapon: 'laser' }).weapon, null);
});

// One La Lejana shot at `gap` metres; `pitch` adds a first-person pitch (0 = level, head height).
function snipe(gap, { toughness, armor, pitch } = {}) {
  const d = duel('sniper', { gap, toughness, armor });
  fire(d.g, { aim: true, ...(pitch === undefined ? {} : { pitch }) }); idle(d.g, 12);
  return { ...d, out: d.g.events.find(e => e.type === 'out') };
}

test('La Lejana body hits fade with range: 3 pepazos close, 2 mid, 1 from 50 m', () => {
  const s = kitStats({ weapon: 'sniper' });
  assert.deepEqual([0, 6, 10, 30, 50, 70].map(d => rangedDamage(s, d)), [3, 3, 3, 2, 1, 1]);
  assert.equal(rangedDamage(kitStats({ weapon: 'sixshooter' }), 60), 2, 'markers without falloff keep their damage');
  assert.equal(rangedDamage(kitStats({ weapon: 'pistol' }), 5), 1);
  const near = snipe(6, { toughness: 5 }), far = snipe(60, { toughness: 5 });
  assert.equal(near.b.paint, 3); assert.equal(far.b.paint, 1);
  assert.ok(near.b.paint > far.b.paint);
  assert.equal(snipe(55, { toughness: 5 }).b.paint, 1, 'past 50 m a body hit is one pepazo');
  const mid = snipe(30); assert.equal(mid.b.paint, 2); assert.equal(mid.b.hits, 0);
  assert.equal(mid.b.impact.zone, 'body');
});

test('La Lejana: one close body hit knocks out at aguante 3, two within 9 m at aguante 5', () => {
  assert.equal(snipe(6).b.hits, 1);
  const { g, b } = duel('sniper', { gap: 9, toughness: 5 });
  fire(g, { aim: true }); idle(g, 6);
  assert.equal(b.paint, 3); assert.equal(b.hits, 0);
  idle(g, 26); fire(g, { aim: true }); idle(g, 6);
  assert.equal(b.hits, 1, 'two close body hits knock out');
  assert.equal(snipe(30, { armor: 'wind' }).b.hits, 1, 'Cortaviento (aguante 2) falls to one mid-range shot');
});

test('a La Lejana headshot knocks out in one hit at any range and any aguante', () => {
  for (const gap of [6, 60]) {
    const { b, out } = snipe(gap, { toughness: 5, pitch: 0 });
    assert.equal(b.hits, 1, `headshot at ${gap} m`);
    assert.equal(out.headshot, true); assert.equal(out.direct, false); assert.equal(out.impact.zone, 'head');
  }
  // Aiming at the chest from first person is a body hit; a jumping rival lifts the head band.
  const chest = -Math.atan((EYE - CHEST_Y) / 30);
  assert.equal(snipe(30, { toughness: 5, pitch: chest }).b.paint, 2);
  const hop = duel('sniper', { gap: 20, toughness: 5 }); hop.b.jumpHeight = .5;
  fire(hop.g, { aim: true, pitch: 0 }); idle(hop.g, 6); assert.equal(hop.b.hits, 0, 'level shot under a jumping head');
});

test('shots without a pitch (no first person) are always body hits; other markers ignore it', () => {
  assert.equal(cleanInput({}).look, false); assert.equal(cleanInput({ pitch: null }).look, false); assert.equal(cleanInput({ pitch: .2 }).look, true);
  const { b, out } = snipe(6, { toughness: 5 });
  assert.equal(b.paint, 3); assert.equal(b.impact.zone, 'body'); assert.equal(out, undefined);
  const pistol = duel('pistol', { gap: 10, toughness: 5 }); fire(pistol.g, { pitch: 0 }); idle(pistol.g, 6);
  assert.equal(pistol.b.paint, 1); assert.equal(pistol.b.impact.zone, 'body');
});

test('bots with La Lejana aim at the chest, so their hits are body hits', () => {
  const g = new Arena('plaza', 'experto', { lives: 0, toughness: 5 });
  g.add(1, { name: 'A', avatar: {} }); g.add(BOT_ID, { name: 'Bot', avatar: {}, bot: true });
  g.selectKit(BOT_ID, { weapon: 'sniper' }); g.start(); g.go();
  const [a, bot] = g.players; Object.assign(a, { x: 0, z: -14, shield: 0 }); Object.assign(bot, { x: -20, z: -14, shield: 0, lobAt: Infinity });
  const input = g.bot(bot); assert.ok(input.look && input.pitch < 0);
  assert.ok(Math.abs(EYE + Math.tan(input.pitch) * 20 - CHEST_Y) < 1e-9, 'the ray meets the rival at chest height');
  for (let i = 0; i < 200 && !a.impact; i++) { Object.assign(a, { x: 0, z: -14 }); g.step(.05, new Map()); }
  assert.ok(a.impact, 'the bot landed a shot'); assert.equal(a.impact.zone, 'body'); assert.equal(a.hits, 0);
});

test('La Lejana reaches 70 m and is slow to fire', () => {
  const s = kitStats({ weapon: 'sniper' });
  assert.ok(Math.abs(s.speed * s.life - 70) < 1e-9);
  assert.ok(s.cadence >= 1 && s.magazine <= 5 && s.damage === 2 && s.sprint);
});

test('the scope steadies La Lejana and slows the walk; from the hip it wanders', () => {
  const shot = aim => { const { g } = duel('sniper'); g.players[0].shots = 1; fire(g, { aim }); const ball = g.balls[0]; return Math.abs(Math.atan2(ball.vz, ball.vx)); };
  assert.equal(shot(true), 0);
  assert.ok(shot(false) > .02, 'hip fire is off the line');
  const walk = aim => { const { g, a } = duel('sniper'); a.x = -20; const x0 = a.x; for (let i = 0; i < 10; i++) g.step(.05, new Map([[1, { x: 0, z: -1, ax: 1, az: 0, aim }]])); return Math.abs(a.z + 14); };
  assert.ok(walk(true) < walk(false) * .6);
  const { g, a } = duel('pistol'); fire(g, { aim: true }); assert.equal(a.aim, false, 'only a scoped marker aims');
});

test('La Bazuca: a slow visible rocket whose direct hit knocks out at once', () => {
  const { g, b } = duel('bazooka', { gap: 14 });
  fire(g); const rocket = g.balls[0];
  assert.ok(rocket.rocket && rocket.direct && rocket.kind === 'bazooka');
  assert.ok(Math.hypot(rocket.vx, rocket.vz) <= 15, 'slow enough to see and dodge');
  let steps = 0; while (g.balls.length && steps < 40) { idle(g); steps++; }
  assert.ok(steps > 10, `flew ${steps} ticks`);
  assert.equal(b.hits, 1); assert.ok(b.respawn > 0);
  const out = g.events.find(e => e.type === 'out');
  assert.equal(out.weapon, 'bazooka'); assert.equal(out.direct, true);
  assert.ok(g.view().booms.some(x => x.kind === 'bazooka'), 'the explosion is published for every client');
});

test('La Bazuca barely splashes: one pepazo right beside the burst, nothing two metres out', () => {
  const splash = kitStats({ weapon: 'bazooka' }).splash;
  assert.ok(splash <= 1.5);
  const near = duel('bazooka', { gap: 6 }), wide = duel('bazooka', { gap: 6 });
  near.g.blast({ x: near.b.x + 1, z: near.b.z, owner: 1, color: '#f00', kind: 'bazooka' }, splash);
  wide.g.blast({ x: wide.b.x + 2, z: wide.b.z, owner: 1, color: '#f00', kind: 'bazooka' }, splash);
  assert.equal(near.b.paint, 1); assert.equal(near.b.hits, 0); assert.equal(wide.b.paint, 0);
  // A rocket that flies past a pana a metre and a half to the side does nothing to them.
  const past = duel('bazooka', { gap: 14 }); past.b.z = -14 + 1.5;
  fire(past.g); for (let i = 0; i < 80 && past.g.balls.length; i++) idle(past.g);
  assert.equal(past.b.paint, 0);
});

test('La Bazuca holds one rocket and two more, reloads slowly and cannot sprint', () => {
  const { g, a } = duel('bazooka', { gap: 40 }), s = kitStats({ weapon: 'bazooka' });
  assert.equal(a.ammo, 1); assert.equal(a.reserve, 2); assert.equal(s.sprint, false); assert.ok(s.reload >= 3.5);
  fire(g); assert.equal(a.ammo, 0);
  idle(g, Math.ceil(s.reload / .05) + 2);
  assert.equal(a.ammo, 1); assert.equal(a.reserve, 1);
  const hopper = kitStats({ weapon: 'bazooka', attachments: ['hopper'] }); assert.equal(hopper.reserve, 3);
});
