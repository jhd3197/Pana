import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENAS, BODY_GAP, EDGE_LIMIT, crowdSpot, edge, arenaOf } from '../public/fight-rules.js';
import { marginOf, ringside, stepRingside } from '../public/ringside.js';
import { Trifulca, cleanInput } from '../public/rules.js';
import { rng } from '/engine/random.js';

const DT = 1 / 60;
const assertOnBand = (arena, at, bodies, label) => {
  assert.ok(edge(arena, at.x, at.z).out >= marginOf(arena) - 1e-6, `${label}: inside the band, ${edge(arena, at.x, at.z).out}`);
  for (const b of bodies) assert.ok(Math.hypot(at.x - b.x, at.z - b.z) >= BODY_GAP - 1e-6, `${label}: touches a fighter`);
};

test('a spot by the ring stays outside it and clear of every fighter, on every arena', () => {
  for (const [id, arena] of Object.entries(ARENAS)) {
    const r = rng(7), limit = arena.shape === 'square' ? arena.half : arena.r + EDGE_LIMIT;
    for (let i = 0; i < 2000; i++) {
      const bodies = Array.from({ length: 1 + Math.floor(r() * 4) }, () => {
        const a = r() * Math.PI * 2, d = r() * limit;
        return { x: Math.sin(a) * d, z: Math.cos(a) * d };
      });
      assertOnBand(arena, ringside(arena, crowdSpot(arena, r() * Math.PI * 2), bodies), bodies, id);
    }
  }
});

test('a fighter flung past the crowd pushes the spot out, never in', () => {
  const arena = arenaOf('calle');
  // A body at the limit, right outside the crowd's spot: the old push went inward.
  const fighter = { x: 0, z: arena.r + EDGE_LIMIT }, spot = crowdSpot(arena, 0), at = ringside(arena, spot, [fighter]);
  assert.ok(Math.hypot(at.x, at.z) >= Math.hypot(spot.x, spot.z), 'not pushed toward the middle');
  assertOnBand(arena, at, [fighter], 'flung');
});

test('walking to the far side goes around the ring, never across it', () => {
  for (const [id, arena] of Object.entries(ARENAS)) {
    const r = rng(11);
    for (let run = 0; run < 60; run++) {
      const from = r() * Math.PI * 2, bodies = [{ x: -1.2 + r(), z: r() - .5 }, { x: .4 + r(), z: r() - .5 }];
      const pos = ringside(arena, crowdSpot(arena, from), bodies), goal = ringside(arena, crowdSpot(arena, from + Math.PI - .01), bodies);
      for (let t = 0; t < 600; t++) { stepRingside(pos, goal, arena, bodies, DT, { rate: 3, speed: 4 }); assertOnBand(arena, pos, bodies, `${id} tick ${t}`); }
      assert.ok(Math.hypot(pos.x - goal.x, pos.z - goal.z) < .1, `${id}: reached the goal`);
    }
  }
});

test('someone left inside the ring walks straight out and then stays out', () => {
  const arena = arenaOf('calle'), pos = { x: 1, z: 0 }, goal = crowdSpot(arena, Math.PI);
  let out = false;
  for (let t = 0; t < 400; t++) {
    const before = Math.hypot(pos.x, pos.z);
    stepRingside(pos, goal, arena, [], DT);
    assert.ok(out ? edge(arena, pos.x, pos.z).out >= marginOf(arena) - 1e-6 : Math.hypot(pos.x, pos.z) >= before, `tick ${t}`);
    out ||= edge(arena, pos.x, pos.z).out >= marginOf(arena) - 1e-6;
  }
  assert.ok(out);
});

test('over many seeded nights the bots in the crowd never touch a fighter', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const modo = ['queda', 'libre', 'parejas', 'torneo'][seed % 4];
    const game = new Trifulca(seed); game.configure({ modo, arena: 'calle', rivales: 5 });
    game.addPlayer(1, 'Ana'); game.start();
    let crowdTicks = 0;
    for (let t = 0; t < 1200 && game.phase !== 'finished' && game.phase !== 'lobby'; t++) {
      // Fighters are held at the edge, where the old bots came over and shoved them.
      if (t % 40 === 0 && game.phase === 'fight' && game.arena.r) for (const b of game.bodies) {
        if (b.bench || b.out) continue;
        const a = Math.atan2(b.x, b.z) || 1, r = game.arena.r + .3;
        b.x = Math.sin(a) * r; b.z = Math.cos(a) * r;
      }
      const seen = game.eventSeq;
      game.update(.05, new Map([[1, cleanInput({})]]));
      for (const e of game.events) if (e.n > seen) {
        assert.ok(!['empujon', 'empuja-aire'].includes(e.type), `seed ${seed}: a bot shoved (${e.type})`);
      }
      const crowd = game.players.filter(p => p.bot && !game.fighting(p.id));
      crowdTicks += crowd.length;
      for (const p of crowd) assertOnBand(game.arena, ringside(game.arena, crowdSpot(game.arena, p.angle), game.bodies), game.bodies, `seed ${seed} tick ${t}`);
    }
    assert.ok(crowdTicks > 0, `seed ${seed}: bots stood in the crowd`);
  }
});

function edgeFight(players, rivales) {
  const game = new Trifulca(5); game.configure({ arena: 'calle', rivales });
  players.forEach(([id, name]) => game.addPlayer(id, name));
  game.start();
  Object.assign(game, { phase: 'fight', time: 60 });
  const watcher = game.players.find(p => !game.fighting(p.id)), fighter = game.bodies[0];
  const a = Math.atan2(fighter.x, fighter.z);
  Object.assign(fighter, { x: Math.sin(a) * game.arena.r, z: Math.cos(a) * game.arena.r, vx: 0, vz: 0 });
  watcher.angle = a; watcher.cd = 0;
  return { game, watcher, fighter };
}

test('a bot in the crowd pressing the shove button leaves the fighter exactly where it was', () => {
  const { game, watcher, fighter } = edgeFight([[1, 'Ana'], [2, 'Bruno']], 2);
  assert.ok(watcher.bot, 'the one watching is a bot');
  const before = { ...fighter };
  game.crowdStep(watcher, cleanInput({ gp: 1 }), { gp: 1 }, .05, game.arena);
  for (const key of ['x', 'z', 'vx', 'vz', 'act']) assert.equal(fighter[key], before[key], key);
});

test('a pana in the crowd can still shove', () => {
  const { game, watcher, fighter } = edgeFight([[1, 'Ana'], [2, 'Bruno'], [3, 'Cata']], 0);
  assert.ok(!watcher.bot);
  game.crowdStep(watcher, cleanInput({ gp: 1 }), { gp: 1 }, .05, game.arena);
  assert.ok(Math.hypot(fighter.vx, fighter.vz) > 0);
});

test('stepping back over the ring line does not stun', () => {
  const game = new Trifulca(5); game.configure({ arena: 'calle', rivales: 0 });
  game.addPlayer(1, 'Ana'); game.addPlayer(2, 'Bruno'); game.start();
  Object.assign(game, { phase: 'fight', time: 60 });
  const b = game.bodies[0]; Object.assign(b, { x: game.arena.r + .5, z: 0, act: 'idle', outside: .6 });
  game.ringEdge(game.arena, .05);
  assert.equal(b.act, 'idle');
  assert.ok(b.vx < 0, 'sent back in');
});
