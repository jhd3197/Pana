import test from 'node:test';
import assert from 'node:assert/strict';
import { huntLayout, roundProps, nextLayoutSeed, MAP_PROPS } from '../public/layout.js';
import { HuntRound, RULES, HIDE_TIMES } from '../public/rules.js';
import { ARENAS, arenaLayout } from '../../../engine/worlds/arena-layouts.js';
import { propDefinition } from '../../../engine/models/props/plaza-definitions.js';

for (const { id } of ARENAS) test(`${id}: seeded props vary, stay clear and remain reachable`, () => {
  const original = id === 'plaza' ? MAP_PROPS : arenaLayout(id).props, saved = JSON.stringify(original);
  // Escondidas doubles each map's props over its 1.5× larger court.
  const types = [...original, ...original].map(p => p.type).sort(), footprints = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const props = roundProps(id, seed), layout = huntLayout(id, seed);
    assert.deepEqual(props, roundProps(id, seed));
    assert.deepEqual(props.map(p => p.type).sort(), types);
    footprints.add(JSON.stringify(props.map(p => [p.x, p.z, p.h])));
    for (const [i, p] of props.entries()) {
      const r = propDefinition(p.type).radius;
      assert.ok(Math.abs(p.x) + r < layout.bounds.x && Math.abs(p.z) + r < layout.bounds.z);
      assert.equal(layout.blocked(p.x, p.z), true);
      const blocker = layout.blockers.find(b => b.prop === p.id);
      assert.deepEqual([blocker.x, blocker.z, blocker.r], [p.x, p.z, r]);
      for (const b of layout.blockers.filter(b => !b.prop)) {
        const distance = b.r ? Math.hypot(p.x - b.x, p.z - b.z) - b.r
          : Math.hypot(Math.max(0, Math.abs(p.x - b.x) - b.w / 2), Math.max(0, Math.abs(p.z - b.z) - b.d / 2));
        assert.ok(distance >= r + 1.79);
      }
      for (const q of props.slice(i + 1)) assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= r + propDefinition(q.type).radius + 1.79);
      if (seed <= 8) {
        const from = layout.safeSpot(0, -10), to = layout.safeSpot(p.x + r + .9, p.z, .65);
        const path = layout.route(from, to); assert.ok(path.length, `${id}/${seed}/${p.id} unreachable`);
        const points = [from, ...path, to];
        for (let n = 1; n < points.length; n++) {
          const a = points[n - 1], b = points[n], steps = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / .15);
          for (let j = 0; j <= steps; j++) assert.equal(layout.blocked(a.x + (b.x - a.x) * j / (steps || 1), a.z + (b.z - a.z) * j / (steps || 1), .5), false);
        }
      }
    }
  }
  assert.equal(footprints.size, 100); assert.equal(JSON.stringify(original), saved);
  const game = new HuntRound(id, { layoutSeed: 4294967295 });
  for (let i = 1; i <= 8; i++) game.addPlayer(i, `Pana ${i}`, {});
  const before = game.layoutSeed; game.start(1);
  assert.equal(game.layoutSeed, nextLayoutSeed(before));
  for (const p of game.players) assert.equal(game.layout.blocked(p.x, p.z), false);
  const copy = new HuntRound(id, game.snapshot()); assert.deepEqual(copy.layout.props, game.layout.props);
  game.finish('hiders', 'Done'); game.start(1); assert.notEqual(game.layoutSeed, copy.layoutSeed);
  assert.notDeepEqual(game.layout.props, copy.layout.props);
});

test('hiding time defaults to 30 seconds, validates choices and locks after starting', () => {
  assert.equal(RULES.hideSeconds, 30);
  const game = new HuntRound(); assert.equal(game.hideSeconds, 30);
  for (const value of [-1, 0, 16, 31, 999, Infinity, '30', null, {}, []]) {
    assert.equal(game.configure({ hideSeconds: value }), false); assert.equal(game.hideSeconds, 30);
  }
  for (const value of [null, undefined, false, 30]) assert.equal(game.configure(value), false);
  for (const seconds of HIDE_TIMES) {
    const round = new HuntRound('plaza'); assert.equal(round.configure({ hideSeconds: seconds }), true);
    round.addPlayer(1, 'Uno', {}); round.addPlayer(2, 'Dos', {}); round.start(1, 'seek');
    assert.equal(round.remaining, seconds); assert.equal(round.configure({ hideSeconds: 60 }), false);
    const seeker = round.players[0], position = [seeker.x, seeker.z];
    round.update(seconds - .1, new Map([[1, { x: 1 }]]));
    assert.equal(round.phase, 'hide'); assert.deepEqual([seeker.x, seeker.z], position); assert.equal(round.check(1), false);
    round.update(.11); assert.equal(round.phase, 'hunt'); assert.equal(round.remaining, RULES.huntSeconds);
    round.finish('hiders', 'Done'); round.start(1); assert.equal(round.remaining, seconds);
    assert.equal(new HuntRound(round.mapId, round.snapshot()).hideSeconds, seconds);
  }
});
