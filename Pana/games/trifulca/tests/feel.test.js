// How a fight feels: a tap always registers, timing beats mashing, the map
// changes between fights and props can be picked up.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Trifulca, cleanInput, INTRO, AFTER, PROPS, PICKUP } from '../public/rules.js';
import { ARENAS, T, arenaOf, arenaIdOf, control, newBody, stepBodies } from '../public/fight-rules.js';
import { ROTATE, defaultOptions } from '../public/options.js';
import { botInput } from '../public/bot-rules.js';

const DT = .05, none = { gp: 0, e: 0, a: 0, t: 0, k: 0, s: 0, v: 0 };
function duel(distance = 1, arena = arenaOf('toldo')) {
  const a = newBody(1, 'red', arena), b = newBody(2, 'blue', arena), events = [], emit = e => events.push(e);
  Object.assign(a, { x: -distance / 2, z: 0, h: Math.PI / 2 }); Object.assign(b, { x: distance / 2, z: 0, h: -Math.PI / 2 });
  const tick = (press = {}, input = {}) => { control(a, input, { ...none, ...press }, emit); stepBodies([a, b], arena, DT, new Map(), emit); };
  return { a, b, events, emit, tick, hold: () => Object.assign(b, { vx: 0, vz: 0, x: a.x + distance, z: 0 }) };
}
const started = (events, type, extra = {}) => events.filter(e => e.type === type && Object.entries(extra).every(([k, v]) => e[k] === v));

// ---------- 1. A tap registers

for (const [key, move] of [['k', 'kick'], ['s', 'sweep'], ['v', 'toss']]) {
  test(`${move}: tapped during another attack's recovery it still fires`, () => {
    const { a, tick, events } = duel();
    tick({ gp: 1 }); // the jab that keeps the hands busy
    assert.equal(a.act, 'jab');
    while (a.at < T.jab.total - .15) tick();
    assert.equal(a.act, 'jab');
    tick({ [key]: 1 });
    for (let i = 0; i < 12 && a.act !== move; i++) tick();
    assert.equal(a.act, move, 'no need to hold or press again');
    assert.equal(started(events, 'move', { move }).length, 1);
  });
}

test('a tap too early for its buffer is not stored for ever', () => {
  const { a, tick } = duel(3);
  a.act = 'kick'; a.at = 0; a.landed = false;
  tick({ k: 1 }); // pressed during the kick's windup
  for (let i = 0; i < Math.ceil(T.buffer / DT) + 2; i++) tick();
  assert.equal(a.queued, null);
  while (a.act === 'kick') tick();
  tick();
  assert.equal(a.act, 'idle');
});

test('a tap during the active window waits for the end of the attack', () => {
  for (const kind of ['jab', 'trompon', 'kick', 'sweep', 'toss']) {
    const { a, b, tick, events } = duel(3);
    a.act = kind; a.at = T[kind].active[0];
    tick({ gp: 1 }); // nothing in reach: the longest recovery there is
    const budget = (T[kind].total + T[kind].whiff - T[kind].active[0]) / DT + 3;
    for (let i = 0; i < budget && !started(events, 'jab').length; i++) tick();
    assert.equal(started(events, 'jab').length, 1, `${kind}: the tap fired`);
    assert.equal(b.mareo, 0);
  }
});

test('a key still down when the buffer fires is a jab, not a trompón', () => {
  const { a, tick } = duel();
  a.act = 'jab'; a.at = T.jab.total - .02; a.landed = true;
  tick({ gp: 1 }, { g: true });  // pressed on the recovery's last tick...
  tick({}, { g: true });         // ...and the finger takes a tick to lift
  assert.notEqual(a.act, 'wind');
  tick({}, { g: false });
  assert.equal(a.act, 'jab');
});

test('a press held through the recovery becomes the trompón', () => {
  const { a, tick } = duel();
  a.act = 'jab'; a.at = .2; a.landed = true;
  tick({ gp: 1 }, { g: true });
  for (let i = 0; i < 6 && a.act !== 'wind'; i++) tick({}, { g: true });
  assert.equal(a.act, 'wind');
});

test('a jab reaches again after the knockback of the first', () => {
  const { a, b, tick, events } = duel();
  tick({ gp: 1 });
  while (b.mareo === 0) tick();
  while (a.act === 'jab') tick();
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < T.jab.reach, 'still in range after the first hit');
  tick({ gp: 1 });
  for (let i = 0; i < 6; i++) tick();
  assert.equal(started(events, 'hit').length, 2);
});

test('a tap shorter than a tick reaches the fight through the counters', () => {
  const game = new Trifulca(7);
  game.configure({ arena: 'toldo', rivales: 0 });
  game.addPlayer(1, 'Ana'); game.addPlayer(2, 'Bruno'); game.start();
  game.update(INTRO + .05, new Map());
  game.update(DT, new Map([[1, cleanInput({ k: 1 })]]));
  assert.equal(game.body(1).act, 'kick');
});

// ---------- 2. Timing beats mashing

test('a whiff leaves you exposed longer than a hit', () => {
  const miss = duel(3), land = duel(1);
  for (const d of [miss, land]) d.a.act = 'jab';
  let missTicks = 0, landTicks = 0;
  while (miss.a.act === 'jab') { miss.tick(); missTicks++; }
  while (land.a.act === 'jab') { land.tick(); landTicks++; }
  assert.ok(missTicks * DT >= T.jab.total + T.jab.whiff - DT);
  assert.ok(missTicks > landTicks);
});

test('a timed chain lands sooner, hits harder and reaches further', () => {
  const { a, b, tick, events } = duel();
  tick({ gp: 1 });
  while (!a.landed) tick();
  const first = b.mareo;
  assert.equal(first, T.jab.mareo);
  assert.equal(a.chain, 1);
  tick({ gp: 1 }); // one tap, right after contact
  while (b.mareo === first) tick();
  assert.ok(Math.abs(b.mareo - first - T.jab.mareo * T.combo.mareo[1]) < 1e-9, `second hit ${b.mareo - first}`);
  const hits = started(events, 'hit');
  assert.equal(hits[1].chain, 1);
  tick({ gp: 1 });
  const second = b.mareo;
  while (b.mareo === second) tick();
  assert.ok(Math.abs(b.mareo - second - T.jab.mareo * T.combo.mareo[2]) < 1e-9, `third hit ${b.mareo - second}`);
  assert.equal(started(events, 'hit')[2].chain, 2);
  assert.equal(a.chain, 0, 'the third hit ends the chain');
  assert.equal(a.clean, false, 'and leaves the whole recovery to do');
});

test('mashing earns no chain and no shortcut', () => {
  const timed = duel(), mashed = duel();
  const run = (d, tap) => { d.tick({ gp: 1 }); let ticks = 0; while (d.events.filter(e => e.type === 'hit').length < 2 && ticks++ < 60) { tap(d, ticks); d.hold(); } return ticks; };
  const timedTicks = run(timed, (d) => d.tick(d.a.landed && !d.a.tapped ? { gp: 1 } : {}));
  const mashedTicks = run(mashed, (d) => d.tick({ gp: 1 }));
  assert.equal(started(timed.events, 'hit')[1].chain, 1);
  assert.equal(started(mashed.events, 'hit')[1].chain, 0, 'spam: no bonus');
  assert.ok(mashedTicks > timedTicks, `spam is slower: ${mashedTicks} vs ${timedTicks}`);
  assert.ok(mashed.b.mareo < timed.b.mareo);
});

test('a chain dies when the window closes, on a block or when hit', () => {
  const late = duel();
  late.tick({ gp: 1 });
  while (!late.a.landed) late.tick();
  for (let i = 0; i <= T.combo.window / DT + 1; i++) late.tick();
  late.hold(); late.tick({ gp: 1 });
  assert.equal(late.a.combo, 0);
  const blocked = duel(); blocked.b.act = 'block';
  blocked.tick({ gp: 1 });
  while (!blocked.a.landed) blocked.tick();
  assert.equal(blocked.a.chain, 0);
  const struck = duel();
  Object.assign(struck.a, { chain: 1, chainLeft: T.combo.window, clean: true });
  struck.b.act = 'jab'; struck.b.at = T.jab.active[0];
  struck.tick();
  assert.equal(struck.a.chain, 0);
});

test('a guard or a dodge still answers a chain', () => {
  const { a, b, tick, emit } = duel();
  Object.assign(a, { chain: 1, chainLeft: T.combo.window });
  b.act = 'block';
  control(a, {}, { ...none, gp: 1 }, emit);
  while (!a.landed) tick();
  assert.equal(b.mareo, T.chip.jab, 'chip only');
});

// ---------- 3. Maps rotate

const night = (options = {}, players = 2, seed = 5) => {
  const game = new Trifulca(seed);
  game.configure({ rivales: 0, seconds: 45, peleas: 12, ...options });
  for (let i = 1; i <= players; i++) game.addPlayer(i, `P${i}`);
  game.start();
  return game;
};
// Rings the bell and closes the verdict: the next fight's intro (or the end).
function nextFight(game) {
  game.update(INTRO + .05, new Map());
  game.time = .01; game.update(DT, new Map());
  assert.equal(game.phase, 'after');
  game.update(AFTER + .05, new Map());
}

test('Varios is the default, and any arena can still be pinned', () => {
  assert.equal(defaultOptions().arena, ROTATE);
  const game = new Trifulca(1);
  assert.ok(game.configure({ arena: 'mercado' }));
  assert.ok(game.configure({ arena: ROTATE }));
  assert.equal(game.configure({ arena: 'nowhere' }), false);
});

test('at least three maps that really differ are in the cycle', () => {
  const shapes = new Set(Object.values(ARENAS).map(a => `${a.shape}:${a.twist}`));
  assert.ok(Object.keys(ARENAS).length >= 3 && shapes.size === Object.keys(ARENAS).length);
});

test('every fight changes map, and a whole cycle shows them all', () => {
  for (const seed of [1, 2, 3, 4]) {
    const game = night({}, 2, seed), seen = [game.arenaNow];
    assert.ok(game.arenaNow in ARENAS);
    while (seen.length < 12 && game.phase === 'intro') { nextFight(game); if (game.phase === 'intro') seen.push(game.arenaNow); }
    for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], `seed ${seed}: ${seen}`);
    assert.equal(new Set(seen.slice(0, Object.keys(ARENAS).length)).size, Object.keys(ARENAS).length, `seed ${seed}: ${seen}`);
  }
});

test('the map announced during the verdict is the one that comes', () => {
  const game = night();
  for (let i = 0; i < 9; i++) {
    game.update(INTRO + .05, new Map());
    game.time = .01; game.update(DT, new Map());
    const told = game.arenaNext;
    assert.ok(told in ARENAS);
    game.update(AFTER + .05, new Map());
    assert.equal(game.arenaNow, told);
    assert.equal(game.arenaNext, null);
  }
});

test('a pinned arena never changes', () => {
  const game = night({ arena: 'cebra' });
  for (let i = 0; i < 4; i++) { assert.equal(game.arena, ARENAS.cebra); assert.equal(arenaIdOf(game), 'cebra'); nextFight(game); }
});

test('the bodies start in the shape of the new ring', () => {
  const game = night();
  for (let i = 0; i < 8 && game.phase === 'intro'; i++) {
    const start = game.arena.shape === 'square' ? 1.7 : 1.9;
    assert.ok(Math.abs(Math.abs(game.bodies[0].x) - start) < 1e-3, `${game.arenaNow}`);
    nextFight(game);
  }
});

test('the torneo final stays under the tent, and el toldo waits for it', () => {
  const game = night({ modo: 'torneo' }, 4);
  const seen = [];
  while (game.phase === 'intro' && seen.length < 4) { seen.push([game.arenaNow, game.fight.stage, game.arenaNext]); nextFight(game); }
  assert.deepEqual(seen.map(s => s[1]), ['semifinal', 'semifinal', 'final']);
  assert.equal(seen[2][0], 'toldo');
  assert.notEqual(seen[0][0], 'toldo'); assert.notEqual(seen[1][0], 'toldo');
  assert.notEqual(seen[0][0], seen[1][0]);
});

test('a restarted intro keeps its map; a new host carries on with the cycle', () => {
  const game = night({}, 3);
  const before = game.arenaNow, cycle = [...game.arenaCycle], fighter = game.bodies[0].id;
  game.removePlayer(fighter);
  assert.equal(game.phase, 'intro');
  assert.equal(game.arenaNow, before);
  assert.deepEqual(game.arenaCycle, cycle);
  const restored = Trifulca.restore(game.snapshot(), new Map(game.players.map(p => [p.id, {}])));
  assert.deepEqual(restored.arenaCycle, game.arenaCycle);
  assert.equal(restored.arenaNow, game.arenaNow);
});

test('the lobby forgets the rotation, and Varios has a map for the tutorial', () => {
  const game = night({ peleas: 5 });
  for (let i = 0; i < 5; i++) nextFight(game);
  assert.equal(game.phase, 'finished');
  assert.ok(game.toLobby());
  assert.equal(game.arenaNow, null);
  assert.deepEqual(game.arenaCycle, []);
  assert.equal(arenaIdOf(game, 'motos'), 'motos', 'the stage stays on the last map shown');
  assert.equal(arenaIdOf({ options: { arena: 'cebra' } }, 'motos'), 'cebra');
  assert.ok(game.startTutorial(1));
  assert.equal(game.arenaNow, 'calle');
});

test('nothing is dressed after the night\'s last fight', () => {
  const game = night({ peleas: 5 });
  for (let i = 0; i < 4; i++) nextFight(game);
  game.update(INTRO + .05, new Map());
  game.time = .01; game.update(DT, new Map());
  assert.equal(game.arenaNext, null);
});

// ---------- 4. Props can be picked up

function libre() {
  const game = new Trifulca(9);
  game.configure({ modo: 'libre', arena: 'calle', rivales: 0 });
  game.addPlayer(1, 'Ana'); game.addPlayer(2, 'Bruno'); game.start();
  game.update(INTRO + .05, new Map());
  return game;
}
for (const kind of PROPS) {
  test(`${kind}: picked up with one press, swung and thrown like any other`, () => {
    const game = libre(), [a, b] = game.bodies, prop = game.props[0];
    Object.assign(prop, { kind, x: 1.2, z: 0 });
    game.props.slice(1).forEach(p => Object.assign(p, { x: 9, z: 9 }));
    Object.assign(a, { x: 0, z: 0, h: Math.PI / 2 }); Object.assign(b, { x: 2.5, z: 2.5 });
    game.update(DT, new Map([[1, cleanInput({ a: 1 })]]));
    assert.equal(a.prop, prop.id);
    assert.equal(prop.held, a.id);
    assert.ok(game.events.some(e => e.type === 'pickup' && e.kind === kind));
    game.update(DT, new Map([[1, cleanInput({ a: 2 })]]));
    assert.equal(a.prop, null); assert.ok(prop.fly);
  });
}

test('a foe beside you does not stop you picking up what lies at your feet', () => {
  const game = libre(), [a, b] = game.bodies, prop = game.props[0];
  game.props.slice(1).forEach(p => Object.assign(p, { x: 9, z: 9 }));
  Object.assign(a, { x: 0, z: 0 }); Object.assign(b, { x: 1, z: 0 }); Object.assign(prop, { x: -.5, z: 0 });
  game.update(DT, new Map([[1, cleanInput({ a: 1 })]]));
  assert.equal(a.prop, prop.id);
});

test('with the foe nearer than a distant prop, agarrar still grabs', () => {
  const game = libre(), [a, b] = game.bodies, prop = game.props[0];
  game.props.slice(1).forEach(p => Object.assign(p, { x: 9, z: 9 }));
  Object.assign(a, { x: 0, z: 0, h: Math.PI / 2 }); Object.assign(b, { x: 1, z: 0 }); Object.assign(prop, { x: -PICKUP + .1, z: 0 });
  game.update(DT, new Map([[1, cleanInput({ a: 1 })]]));
  assert.equal(a.prop, null);
  assert.equal(a.act, 'grab');
});

test('a libre night spawns the bat among its props', () => {
  const kinds = new Set();
  for (let seed = 1; seed < 20; seed++) {
    const game = new Trifulca(seed);
    game.configure({ modo: 'libre' }); game.addPlayer(1, 'Ana'); game.start();
    for (const p of game.props) kinds.add(p.kind);
  }
  assert.ok(kinds.has('bate'));
});

// ---------- 5. Bots still fight

test('bots keep landing, chaining and finishing fights on every level', () => {
  for (const nivel of [0, 1, 2]) {
    const game = new Trifulca(nivel + 3);
    game.configure({ rivales: 2, nivel, seconds: 45, peleas: 5 });
    game.start();
    let hits = 0, chains = 0;
    for (let i = 0; i < 12000 && game.phase !== 'finished'; i++) {
      const seen = game.eventSeq;
      game.update(DT, new Map());
      for (const e of game.events) if (e.n > seen && (e.type === 'hit' || e.type === 'trompon')) { hits++; if (e.chain) chains++; }
    }
    assert.equal(game.phase, 'finished', `nivel ${nivel} ends`);
    assert.ok(hits > 60, `nivel ${nivel}: ${hits} hits`);
    assert.ok(chains < hits, `nivel ${nivel}: ${chains} of ${hits}`);
  }
  assert.equal(typeof botInput, 'function');
});
