import test from 'node:test';
import assert from 'node:assert/strict';
import { HuntRound, RULES } from '../public/rules.js';
import { blocked, move, clearSight, route, MAP_PROPS, safeSpot } from '../public/layout.js';

function session(preference = 'hide') {
  const game = new HuntRound(); game.addPlayer(1, 'Juan', {}); game.addPlayer(2, 'Ana', {});
  game.start(1, preference); return game;
}
function advance(game, seconds) { for (let t = 0; t < seconds; t += 0.05) game.update(0.05); }

test('three changes, no refill when returning to pana, reset on next round', () => {
  const game = session(), p = game.players[0];
  Object.assign(p, { x: -4, z: 14 });
  for (const type of ['barrel', 'crate', 'cooler']) assert.equal(game.transform(1, type), null);
  assert.equal(p.changes, 0); assert.match(game.transform(1, 'planter'), /No te quedan/);
  assert.equal(p.prop, 'cooler'); assert.equal(game.transform(1, null), null);
  assert.equal(p.changes, 0); assert.match(game.transform(1, 'barrel'), /No te quedan/);
  game.finish('hiders', 'Done'); game.start(1);
  assert.equal(p.changes, RULES.changes); assert.equal(p.prop, null);
});
test('repeated or invalid forms never consume a change; large forms need room', () => {
  const game = session(), p = game.players[0];
  assert.equal(game.transform(1, 'barrel'), null); assert.equal(p.changes, 2);
  assert.match(game.transform(1, 'barrel'), /Ya tienes/); assert.equal(p.changes, 2);
  assert.match(game.transform(1, 'spaceship'), /no existe/); assert.equal(p.changes, 2);
  p.x = 21; p.z = 0;
  assert.match(game.transform(1, 'bench'), /espacio/); assert.equal(p.changes, 2);
});
test('seeker cannot move, inspect or disguise during hiding', () => {
  const game = session('seek'), p = game.players[0], start = { x: p.x, z: p.z };
  game.update(1, new Map([[1, { x: 1, z: 1 }]]));
  assert.equal(p.x, start.x); assert.equal(p.z, start.z);
  assert.equal(game.check(1), false); assert.match(game.transform(1, 'barrel'), /no puedes/);
  advance(game, game.hideSeconds); assert.equal(game.phase, 'hunt');
  game.update(0.5, new Map([[1, { x: 1, z: 0 }]])); assert.ok(p.x > start.x);
});
test('line of sight and distance protect hiders; checks have a cooldown', () => {
  const game = session('seek'), seeker = game.players[0], hider = game.players[1];
  advance(game, game.hideSeconds + 1);
  Object.assign(seeker, { x: -4, z: 14 }); Object.assign(hider, { x: 6, z: 14 });
  assert.equal(game.check(1), false); assert.equal(seeker.cooldown, RULES.checkCooldown);
  hider.x = -2; assert.equal(game.check(1), false); assert.equal(hider.caught, false);
  advance(game, 2); assert.equal(game.check(1), true); assert.equal(hider.caught, true); assert.equal(seeker.score, 1);
  assert.equal(clearSight({ x: -4, z: 0 }, { x: 4, z: 0 }), false);
  assert.equal(clearSight({ x: -4, z: 14 }, { x: -2, z: 14 }), true);
});
test('timeout, scoring, rotating roles, every player seeks and replay resets scores', () => {
  const game = session('seek');
  advance(game, RULES.hideSeconds + RULES.huntSeconds + 1);
  assert.equal(game.phase, 'results'); assert.equal(game.winner, 'hiders');
  assert.equal(game.players[1].score, 3); const bot = game.players.find(p => p.bot), botScore = bot.score;
  game.start(1); assert.equal(game.seeker, 2); assert.equal(game.round, 2);
  assert.equal(game.players.find(p => p.id === bot.id).score, botScore);
  while (game.round < RULES.rounds) { game.finish('hiders', 'Done'); game.start(1); }
  game.finish('hiders', 'Done');
  assert.equal(game.phase, 'finished'); game.start(1, 'seek');
  assert.equal(game.round, 1); assert.ok(game.players.every(p => p.score === 0));
});
test('a full eight-player room has eight seeker turns', () => {
  const game = new HuntRound();
  for (let id = 1; id <= 8; id++) game.addPlayer(id, `Pana ${id}`, {});
  const seekers = new Set();
  for (let i = 0; i < 8; i++) { game.start(1, 'hide'); seekers.add(game.seeker); game.finish('hiders', 'Done'); }
  assert.equal(game.totalRounds, 8); assert.equal(game.phase, 'finished'); assert.equal(seekers.size, 8);
});
test('late joiners spectate until next round; departure cannot strand a round', () => {
  const game = session('seek'); game.addPlayer(9, 'Late', {});
  const late = game.players.find(p => p.id === 9); assert.equal(late.spectator, true);
  assert.match(game.transform(9, 'barrel'), /no puedes/);
  game.removePlayer(1); assert.equal(game.phase, 'results');
  game.start(2); assert.equal(late.spectator, false); assert.equal(late.changes, 3);
});
test('large steps never tunnel through the fountain or map boundary', () => {
  const p = { x: -5, z: 0 }; move(p, 50, 0);
  assert.ok(p.x < -3.5); assert.equal(blocked(p.x, p.z), false);
  const edge = { x: 0, z: 14 }; move(edge, 0, 100); assert.ok(edge.z <= 18.5);
});
test('every market cluster has a reachable, collision-free hiding spot', () => {
  for (const prop of MAP_PROPS) {
    const spot = safeSpot(prop.x + 1.8, prop.z + 1.7, 0.9);
    assert.equal(blocked(spot.x, spot.z, 0.9), false);
    assert.ok(route({ x: 0, z: -10 }, spot).length, `${prop.id} has no navigation route`);
  }
});
test('solo seeker patrols, respects camouflage and catches exposed nearby panas', () => {
  const game = new HuntRound(); game.addPlayer(1, 'Juan', {}); game.start(1, 'hide');
  const seeker = game.players.find(p => p.id === game.seeker), player = game.players[0];
  assert.equal(seeker.bot, true);
  const start = { x: seeker.x, z: seeker.z };
  advance(game, game.hideSeconds + 7); assert.ok(Math.hypot(seeker.x - start.x, seeker.z - start.z) > 2);
  assert.equal(game.layout.blocked(seeker.x, seeker.z), false);
  Object.assign(seeker, { x: -4, z: 14 }); Object.assign(player, { x: 4, z: 14, prop: 'barrel', suspicion: 0 });
  game.update(0.05); assert.equal(player.suspicion, 0); assert.equal(player.caught, false);
  Object.assign(seeker, { x: -4, z: 14 }); Object.assign(player, { x: -2, z: 14, prop: null });
  advance(game, 2); assert.equal(player.caught, true);
});
