// The hiding nook is a real door: walk at it and you are inside, also when you aim a
// little off its middle, and the boss still does not fit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition } from '../public/rules.js';
import { NOOK, NOOK_FUNNEL, nookAt, nookDepth, nookFunnel } from '../public/deck.js';
import { SILBON_BODY } from '../public/silbon.js';

function floor(seed = 3, place = 'templo') {
  const g = new Expedition(seed, { place }); g.addPlayer(1, 'Ana'); g.start(seed);
  const stop = g.layout.run.lifts.find(l => l.floor === 1);
  Object.assign(g, { sucesoIn: 1e9, collapseIn: 1e9, swarmAt: 1e9, deepest: 1 }); g.lift.floor = 1; g.director.duration = 1e9; g.enemies = [];
  for (const r of g.layout.run.rooms) g.woke[r.id] = 1;
  const a = g.players[0]; Object.assign(a, { x: stop.x, z: stop.z - 5, invulnerable: 1e9 });
  return { g, a };
}
// A nook with clear floor in front of it, so a walk can start there.
const openNook = g => g.layout.run.nooks.find(n => n.floor === 1 && [.5, 1, 1.5, 2].every(d => g.layout.walkable(n.mouth.x + n.nx * d, n.mouth.z + n.nz * d, g, .42)) && [-.8, .8].every(s => g.layout.walkable(n.mouth.x + n.nx * 1.2 + n.nz * s, n.mouth.z + n.nz * 1.2 - n.nx * s, g, .42)));
// Stand `out` metres in front of the opening and `side` to one side, then walk
// straight at the wall for `seconds`, with the same input the keys send.
function walkIn(g, a, n, side, seconds = 2, out = 1.2) {
  Object.assign(a, { x: n.mouth.x + n.nx * out + n.nz * side, z: n.mouth.z + n.nz * out - n.nx * side, vx: 0, vz: 0, h: Math.atan2(-n.nx, -n.nz) });
  const held = new Map([[1, { x: -n.nx, z: -n.nz, h: a.h, pitch: 0 }]]);
  for (let t = 0; t < seconds; t += .05) g.update(.05, held);
}

test('walking straight at a nook takes you inside, and it hides you', () => {
  const { g, a } = floor(), n = openNook(g); assert.ok(n, 'a nook to walk into');
  walkIn(g, a, n, 0);
  assert.equal(nookAt(g.layout.run, a.x, a.z)?.id, n.id);
  assert.ok(nookDepth(n, a) > .8, `deep inside: ${nookDepth(n, a)}`);
  assert.equal(a.hidden, n.id);
});

test('aimed at a slab beside the opening, you slide in instead of stopping dead', () => {
  const { g, a } = floor(), n = openNook(g);
  for (const side of [-.8, -.5, -.3, .3, .5, .8]) {
    walkIn(g, a, n, side);
    assert.equal(nookAt(g.layout.run, a.x, a.z)?.id, n.id, `from ${side} m to one side`);
  }
});

test('the slide never pulls you in from further along the wall, or while walking past', () => {
  const { g } = floor(), n = openNook(g), at = (out, side) => ({ x: n.mouth.x + n.nx * out + n.nz * side, z: n.mouth.z + n.nz * out - n.nx * side }), run = g.layout.run;
  const inward = { x: -n.nx * .2, z: -n.nz * .2 }, along = { x: n.nz * .2, z: -n.nx * .2 }, away = { x: n.nx * .2, z: n.nz * .2 };
  const ask = (p, d) => nookFunnel(run, p.x, p.z, d.x, d.z);
  assert.equal(ask(at(.5, NOOK_FUNNEL.width + .3), inward), null, 'too far along the wall');
  assert.equal(ask(at(NOOK_FUNNEL.reach + .3, .5), inward), null, 'too far out');
  assert.equal(ask(at(.5, .5), along), null, 'walking along the wall');
  assert.equal(ask(at(.5, .5), away), null, 'walking away');
  assert.equal(ask(at(.5, 0), inward), null, 'already in the lane');
  const slide = ask(at(.5, .5), inward); assert.ok(slide, 'beside the opening, walking in');
  assert.ok(Math.hypot(slide.x, slide.z) <= .2 + 1e-9, 'never faster than the step');
  const after = { x: at(.5, .5).x + slide.x, z: at(.5, .5).z + slide.z }, side = p => (p.x - n.mouth.x) * n.nz - (p.z - n.mouth.z) * n.nx;
  assert.ok(Math.abs(side(after)) < .5, 'toward the middle');
});

test('the door stays what the Silbón rules expect: too narrow for the boss', () => {
  const { g } = floor(), n = openNook(g), mid = { x: (n.inner[0] + n.inner[2]) / 2, z: (n.inner[1] + n.inner[3]) / 2 };
  assert.equal(g.layout.walkable(mid.x, mid.z, g, SILBON_BODY), false);
  assert.equal(g.layout.walkable(mid.x, mid.z, g, .42), true);
  assert.equal(NOOK.gap, 1.25);
});

test('the same deal, the same slide: nothing random in it', () => {
  const walk = () => { const { g, a } = floor(7), n = openNook(g); walkIn(g, a, n, .55, 1); return [a.x, a.z]; };
  assert.deepEqual(walk(), walk());
});
