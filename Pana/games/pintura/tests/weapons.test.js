import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKERS, kitStats, cleanKit } from '../public/armory-data.js';
import { Arena, cleanInput } from '../public/rules.js';

// Two panas on the open plaza lane at z = -14, the shooter at x = -20 facing +x.
function duel(weapon, { gap = 20, toughness, armor } = {}) {
  const g = new Arena('plaza', 'normal', { lives: 0, ...(toughness ? { toughness } : {}) });
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

test('La Lejana paints two pepazos a hit: two hits knock out, one on a light vest', () => {
  const { g, b } = duel('sniper', { gap: 40 });
  fire(g, { aim: true }); idle(g, 6);
  assert.equal(b.paint, 2); assert.equal(b.hits, 0);
  idle(g, 26); fire(g, { aim: true }); idle(g, 6);
  assert.equal(b.hits, 1, 'second hit knocks out at default aguante 3');
  const light = duel('sniper', { gap: 40, armor: 'wind' });
  fire(light.g, { aim: true }); idle(light.g, 6);
  assert.equal(light.b.hits, 1, 'Cortaviento (aguante 2) falls to one shot');
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
