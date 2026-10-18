import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENAS, ARENA_SPAWNS, arenaLayout, createHuntLayout, outsideTable } from '../arena-layouts.js';
import { propDefinition } from '../models/props/plaza-definitions.js';
import { HuntRound } from '../../games/escondidas/public/rules.js';
import { Arena, blocked, RADIUS } from '../../games/pintura/public/rules.js';
import { createGame, acceptAction, snapshot } from '../../games/billar/public/rules.js';
import { CaidaGame } from '../../games/caida/public/rules.js';

for (const { id } of ARENAS.filter(m => m.id !== 'plaza')) {
  test(`${id}: spawns and every disguise have reachable space; navigation cannot cut cover`, () => {
    const layout = createHuntLayout(id), from = ARENA_SPAWNS[0];
    for (const p of ARENA_SPAWNS) {
      assert.equal(blocked(p.x, p.z, RADIUS, id), false);
      assert.equal(layout.blocked(p.x, p.z, .65), false);
      assert.ok(layout.route(from, p).length > 0, `Disconnected spawn ${JSON.stringify(p)}`);
    }
    for (const prop of layout.props) {
      const radius = propDefinition(prop.type).radius, spot = layout.safeSpot(prop.x + 1.9, prop.z + 1.5, radius);
      assert.equal(layout.blocked(spot.x, spot.z, radius), false);
      const path = layout.route(from, spot); assert.ok(path.length > 0, prop.id);
      for (let i = 1; i < path.length; i++) for (let t = 0; t <= 1; t += .1) {
        assert.equal(layout.blocked(path[i - 1].x + (path[i].x - path[i - 1].x) * t, path[i - 1].z + (path[i].z - path[i - 1].z) * t, .6), false);
      }
    }
    const o = layout.cover[0], p = { x: o.x - o.w / 2 - 2, z: o.z };
    layout.move(p, o.w + 4, 0); assert.ok(p.x < o.x - o.w / 2);
    assert.equal(layout.clearSight({ x: o.x - o.w, z: o.z }, { x: o.x + o.w, z: o.z }), false);
  });

  test(`${id}: both games start safely, retain maps, and reject mid-round map changes`, () => {
    const hunt = new HuntRound(); hunt.addPlayer(1, 'Uno', {}); hunt.addPlayer(2, 'Dos', {});
    assert.equal(hunt.selectMap(id), true); hunt.addPlayer(3, 'Tarde', {});
    for (const p of hunt.players) assert.equal(hunt.layout.blocked(p.x, p.z, .5), false, 'Joining a selected map stays outside its cover');
    hunt.start(1);
    for (const p of hunt.players) assert.equal(hunt.layout.blocked(p.x, p.z, propDefinition(p.prop)?.radius || .5), false);
    assert.equal(hunt.snapshot().mapId, id); assert.equal(hunt.selectMap('plaza'), false);
    hunt.finish('hiders', 'Done'); hunt.start(1); assert.equal(hunt.snapshot().mapId, id);
    const paint = new Arena(); assert.equal(paint.selectMap(id), true);
    for (let i = 0; i < 8; i++) paint.add(i, { name: `Pana ${i}`, bot: i > 0 });
    paint.start(); assert.equal(paint.selectMap('plaza'), false);
    for (let i = 0; i < 600; i++) paint.step(.05);
    for (const p of paint.players) assert.equal(blocked(p.x, p.z, RADIUS, id), false);
    assert.equal(paint.view().mapId, id);
  });

  test(`${id}: selected cover stops paint, including a long segment across a thin wall`, () => {
    const game = new Arena(id), o = arenaLayout(id).cover[0];
    game.add(1, { name: 'Uno' }); game.add(2, { name: 'Dos' }); game.start();
    Object.assign(game.players[0], { x: o.x - o.w / 2 - 2, z: o.z, shield: 0 });
    Object.assign(game.players[1], { x: o.x + o.w / 2 + 2, z: o.z, shield: 0 });
    game.balls.push({ id: 1, owner: 1, x: game.players[0].x, z: o.z, vx: 300, vz: 0, life: 2 });
    game.step(.05); assert.equal(game.balls.length, 0); assert.equal(game.players[1].hits, 0);
    assert.ok(game.splats[0].x < o.x);
  });
}

test('independent room map selection never mutates a different simulation', () => {
  const a = new HuntRound('puerto'), b = new HuntRound('hato');
  a.selectMap('ruinas'); assert.equal(b.mapId, 'hato');
  assert.notDeepEqual(a.layout.cover, b.layout.cover);
  const paint = new Arena('hato'); new Arena('puerto').selectMap('ruinas'); assert.equal(paint.mapId, 'hato');
  for (const id of ['bad', '__proto__', null, {}, 1]) { assert.equal(a.selectMap(id), false); assert.equal(paint.selectMap(id), false); }
});

test('table layouts reserve the entire central footprint', () => {
  assert.equal(outsideTable({ x: 11, z: 0, w: 4, d: 2 }), false);
  assert.equal(outsideTable({ x: 15, z: 0, r: 1 }), true);
  for (const id of ['puerto', 'hato', 'ruinas']) assert.ok(arenaLayout(id).props.some(p => outsideTable({ ...p, r: propDefinition(p.type).radius })));
});

test('table map actions require the host and survive snapshot, start and rematch', () => {
  const pool = createGame(); pool.players[0].id = 1; pool.players[1].id = 2;
  const action = (id, action, mapId) => acceptAction(pool, id, { action, mapId, revision: pool.revision }, 1);
  assert.equal(action(2, 'map', 'puerto'), false); assert.equal(action(1, 'map', 'invalid'), false);
  assert.equal(action(1, 'map', 'puerto'), true); assert.equal(action(1, 'start'), true);
  assert.equal(action(1, 'map', 'hato'), false); assert.equal(snapshot(pool).mapId, 'puerto');
  pool.phase = 'finished'; action(1, 'start'); assert.equal(pool.mapId, 'puerto');
  const caida = new CaidaGame(); caida.addPlayer(1, 'Uno'); caida.addPlayer(2, 'Dos');
  for (const options of [null, 'hato', 1, []]) assert.equal(caida.configure(options), false);
  const configure = (id, mapId, seq) => caida.accept(id, { action: 'configure', options: { mapId }, revision: caida.revision, seq }, 1);
  assert.equal(configure(2, 'hato', 1), false); assert.equal(configure(1, 'invalid', 1), false);
  assert.equal(configure(1, 'hato', 2), true);
  assert.equal(CaidaGame.restore(caida.snapshot(), new Map()).mapId, 'hato');
  caida.accept(1, { action: 'start', revision: caida.revision, seq: 3 }, 1);
  assert.equal(caida.mapId, 'hato'); assert.equal(configure(1, 'ruinas', 4), false);
});
