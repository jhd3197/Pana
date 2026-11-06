import test from 'node:test';
import assert from 'node:assert/strict';
import { newBody, arenaOf, control, stepBodies, BODY_GAP, SEPARATE, T } from '../public/fight-rules.js';
import { Trifulca } from '../public/rules.js';
import { HEAD_REACH, lungeRoom, punchLength, ARM_GUARD } from '../public/fighter-look.js';

const DT = .05, none = { gp: 0, e: 0, a: 0, t: 0, k: 0, s: 0, v: 0 };
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function pair(ax, bx, arena = arenaOf('calle')) {
  const a = newBody(1, 'red', arena), b = newBody(2, 'blue', arena);
  Object.assign(a, { x: ax, z: 0, h: Math.PI / 2 }); Object.assign(b, { x: bx, z: 0, h: -Math.PI / 2 });
  return { a, b, step: (moves = new Map()) => stepBodies([a, b], arena, DT, moves, () => {}) };
}

test('the gap clears two helmets, the size the panas actually look', () => {
  // HEAD_REACH is checked against the real mesh in tutorial.browser.mjs.
  assert.ok(BODY_GAP >= 2 * HEAD_REACH, `${BODY_GAP} vs ${2 * HEAD_REACH}`);
  assert.ok(lungeRoom(BODY_GAP) <= BODY_GAP - 2 * HEAD_REACH + 1e-9, 'a lunge at the gap stays out of the rival helmet');
  assert.equal(lungeRoom(9), .3, 'the full lunge in open space');
  assert.equal(punchLength(BODY_GAP), ARM_GUARD, 'pressed up close the arm stays bent');
});

test('two panas on the same spot split the same way every time, softly', () => {
  for (let run = 0; run < 2; run++) {
    const { a, b, step } = pair(.3, .3);
    step();
    // One tick moves each body at most SEPARATE * dt: no snap.
    assert.ok(Math.abs(a.x - .3 - -SEPARATE * DT) < 1e-9 && Math.abs(b.x - .3 - SEPARATE * DT) < 1e-9);
    assert.ok(a.x < b.x, 'the first body (red) goes left');
    for (let i = 0; i < 4; i++) step();
    assert.ok(gap(a, b) >= BODY_GAP - 1e-9, `apart after 5 ticks: ${gap(a, b)}`);
    assert.equal(a.z, 0); assert.equal(b.z, 0);
  }
});

test('walking into each other stops at the body gap', () => {
  const { a, b, step } = pair(-1.9, 1.9);
  const moves = new Map([[1, { x: 1, z: 0 }], [2, { x: -1, z: 0 }]]);
  for (let i = 0; i < 60; i++) { step(moves); if (i > 20) assert.ok(gap(a, b) >= BODY_GAP - 1e-9, `tick ${i}: ${gap(a, b)}`); }
});

test('a trompón lunge into a pana walking in still keeps the gap', () => {
  const { a, b, step } = pair(-BODY_GAP / 2, BODY_GAP / 2);
  a.act = 'trompon'; a.at = 0; a.landed = true;
  const moves = new Map([[1, { x: 1, z: 0 }], [2, { x: -1, z: 0 }]]);
  step(moves);
  assert.ok(gap(a, b) >= BODY_GAP - 1e-9, `${gap(a, b)}`);
});

test('knockback still carries a pana away while they overlap', () => {
  const { a, b, step } = pair(-.2, .2);
  b.vx = 6;
  step();
  assert.ok(Math.abs(b.vx - 6 * Math.exp(-DT * 5)) < 1e-9, 'only the usual drag, separation never eats velocity');
  assert.equal(a.vx, 0);
  // From here on b flies exactly as far as a pana with nobody near.
  const alone = pair(-9, b.x), before = b.x;
  alone.b.vx = b.vx;
  for (let i = 0; i < 6; i++) { step(); alone.step(); }
  assert.ok(b.x - before > .7, 'the shove still sends the pana flying');
  assert.ok(Math.abs(b.x - alone.b.x) < 1e-9);
});

test('a jab and a grab still land at the body gap', () => {
  for (const [act, kind] of [['jab', 'hit'], ['grab', 'shove']]) {
    const events = [], { a, b } = pair(-BODY_GAP / 2, BODY_GAP / 2), arena = arenaOf('calle');
    a.act = act; a.at = T[act].active[0] - DT / 2;
    stepBodies([a, b], arena, DT, new Map(), e => events.push(e));
    assert.ok(events.some(e => e.type === kind && e.id === b.id), `${act} lands`);
    assert.ok(b.vx > 0, `${act} pushes back`);
  }
});

test('every blow reaches a body stopped at the gap, with room to spare', () => {
  for (const act of ['jab', 'trompon', 'grab', 'kick', 'sweep', 'toss']) {
    assert.ok(T[act].reach > BODY_GAP + .2, `${act} reach ${T[act].reach}`);
    const { a, b } = pair(-BODY_GAP / 2, BODY_GAP / 2);
    a.act = act; a.at = T[act].active[0] - DT / 2;
    stepBodies([a, b], arenaOf('calle'), DT, new Map(), () => {});
    assert.ok(b.vx > 0 || b.act === 'tumble', `${act} lands`);
  }
});

test('a toss still reaches a guard pressed up at the gap', () => {
  const { a, b, step } = pair(-BODY_GAP / 2, BODY_GAP / 2);
  b.act = 'block';
  control(a, {}, { ...none, v: 1 }, () => {});
  for (let i = 0; i < 20; i++) step();
  assert.equal(b.mareo, T.toss.mareo);
});

test('nobody stands inside a benched or knocked-out pana, and they stay put', () => {
  for (const still of ['bench', 'out']) {
    const { a, b, step } = pair(.2, 0);
    b[still] = true;
    for (let i = 0; i < 5; i++) step();
    assert.equal(b.x, 0, `${still} keeps their spot`);
    assert.ok(gap(a, b) >= BODY_GAP - 1e-9, `${still}: ${gap(a, b)}`);
  }
});

test('a pana pinned on the ropes keeps the gap too', () => {
  const arena = arenaOf('toldo'), a = newBody(1, 'red', arena), b = newBody(2, 'blue', arena);
  Object.assign(a, { x: arena.half - 1.5, z: 0, h: Math.PI / 2 }); Object.assign(b, { x: arena.half - .2, z: 0, h: -Math.PI / 2 });
  const moves = new Map([[1, { x: 1, z: 0 }], [2, { x: 1, z: 0 }]]);
  for (let i = 0; i < 40; i++) {
    stepBodies([a, b], arena, DT, moves, () => {});
    assert.ok(b.x <= arena.half + 1e-9, 'the ropes hold');
    if (i > 20) assert.ok(gap(a, b) >= BODY_GAP - 1e-9, `tick ${i}: ${gap(a, b)}`);
  }
});

test('four panas piling into one spot all end up a body apart', () => {
  const arena = arenaOf('calle'), spots = [[-2, 0], [2, 0], [0, -2], [0, 2]];
  const crowd = spots.map(([x, z], i) => Object.assign(newBody(i + 1, i % 2 ? 'blue' : 'red', arena), { x, z }));
  const moves = new Map(crowd.map(b => [b.id, { x: -Math.sign(b.x), z: -Math.sign(b.z) }]));
  for (let i = 0; i < 80; i++) stepBodies(crowd, arena, DT, moves, () => {});
  for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) assert.ok(gap(crowd[x], crowd[y]) > BODY_GAP * .95, `${x}-${y}: ${gap(crowd[x], crowd[y])}`);
});

test('bots still trade blows from the new distance', () => {
  const game = new Trifulca(3); let landed = 0;
  const events = game.fightEvent.bind(game);
  game.fightEvent = (e) => { if (e.type === 'hit') landed++; return events(e); };
  game.addPlayer('me', 'Ana'); game.start();
  for (let i = 0; i < 3000 && game.phase !== 'finished'; i++) game.update(DT, new Map());
  assert.ok(landed > 5, `${landed} hits`);
});

test('libre and parejas keep every pair apart through a whole night', () => {
  for (const modo of ['libre', 'parejas', 'torneo']) {
    const game = new Trifulca(11);
    game.configure({ modo, peleas: 5, seconds: 45 });
    game.addPlayer('me', 'Ana');
    game.start();
    let closest = Infinity, ticks = 0;
    for (let i = 0; i < 6000 && game.phase !== 'finished'; i++) {
      const before = game.phase;
      game.update(DT, new Map([['me', { x: i % 90 < 45 ? 1 : -1, z: 0, gp: Math.floor(i / 6) % 256, e: 0, a: Math.floor(i / 40) % 256, t: 0, k: Math.floor(i / 50) % 256, s: 0, v: 0 }]]));
      const ring = game.bodies.filter(b => !b.out && !b.bench);
      if (before !== 'fight' || game.phase !== 'fight') continue;
      ticks++;
      for (let x = 0; x < ring.length; x++) for (let y = x + 1; y < ring.length; y++) closest = Math.min(closest, gap(ring[x], ring[y]));
    }
    assert.ok(ticks > 500, `${modo} fought (${ticks} ticks)`);
    assert.ok(closest > BODY_GAP * .9, `${modo}: closest ${closest}`);
  }
});

test('a real fight never leaves two fighters inside each other', () => {
  const game = new Trifulca(7);
  game.addPlayer('me', 'Ana');
  game.start();
  let closest = Infinity;
  for (let i = 0; i < 2400 && game.phase !== 'finished'; i++) {
    const before = game.phase;
    game.update(DT, new Map([['me', { x: 1, z: 0, gp: Math.floor(i / 7) % 256, e: 0, a: 0, t: 0, k: 0, s: 0, v: 0 }]]));
    const ring = game.bodies.filter(b => !b.out && !b.bench);
    if (before === 'fight' && game.phase === 'fight' && ring.length === 2) closest = Math.min(closest, gap(...ring));
  }
  // Only a shove from the edge (its velocity spread over the tick) or the
  // ring's outer clamp may press them a hair inside the gap.
  assert.ok(closest > BODY_GAP * .97, `closest ${closest}`);
});
