import test from 'node:test';
import assert from 'node:assert/strict';
import { CRACK_TUNING, crackGlow, crackPaths, crackQuality, crackReveal, createDebris, createShake, hitsCrossed, revealedShare, stagesCrossed, stepPulse } from '../fx/rock-crack-sim.js';

const rule = { speed: [1, 2], size: [.05, .05], life: [.5, .5] };

test('cracks grow with the progress: none at the start, all at the end, never shrinking', () => {
  assert.equal(crackReveal(0), 0); assert.equal(crackReveal(1), 1);
  assert.equal(crackReveal(-1), 0); assert.equal(crackReveal(9), 1);
  let last = -1;
  for (let p = 0; p <= 1; p += .01) { const r = crackReveal(p); assert.ok(r >= last); last = r; }
  assert.ok(crackReveal(.5) > .5, 'the first blows show the most');
});

test('cracks burn brighter as it goes, dark before the first blow', () => {
  assert.equal(crackGlow(0), 0);
  assert.ok(crackGlow(.01) >= CRACK_TUNING.glow.low);
  assert.ok(crackGlow(.9) > crackGlow(.3));
  assert.ok(crackGlow(.5, 1) > crackGlow(.5, 0), 'a hit kicks it');
  let pulse = 1; for (let i = 0; i < 60; i++) pulse = stepPulse(pulse, .03); assert.ok(pulse < .01, 'and the kick fades');
  assert.ok(Math.abs(stepPulse(1, 1) - stepPulse(stepPulse(1, .5), .5)) < 1e-9, 'whatever the frame rate');
});

test('a whole clearing crosses each hit threshold once, in any step size', () => {
  const total = step => { let n = 0, p = 0; while (p < 1) { const q = Math.min(1, p + step); n += hitsCrossed(p, q); p = q; } return n; };
  const want = CRACK_TUNING.hits - 1;
  assert.equal(total(.001), want); assert.equal(total(.017), want); assert.equal(total(.05), want); assert.equal(total(.34), want);
  assert.equal(hitsCrossed(.5, .5), 0); assert.equal(hitsCrossed(.5, .2), 0, 'going back is not a hit');
  assert.equal(hitsCrossed(0, 1, 5), 4, 'the very end is the break, not a hit');
});

test('the crunches come once each, at their stages', () => {
  const [a, b] = CRACK_TUNING.stages;
  assert.equal(stagesCrossed(a - .01, a + .01), 1); assert.equal(stagesCrossed(a + .01, b - .01), 0); assert.equal(stagesCrossed(0, 1), 2);
  assert.equal(stagesCrossed(b + .01, b - .01), 0);
});

test('crack paths: the same for a seed, starting at different moments, unit directions', () => {
  assert.deepEqual(crackPaths({ seed: 4 }), crackPaths({ seed: 4 }));
  assert.notDeepEqual(crackPaths({ seed: 4 }), crackPaths({ seed: 5 }));
  const paths = crackPaths({ seed: 4 }), { count, branches, segments } = CRACK_TUNING.cracks;
  assert.equal(paths.length, count + branches); assert.equal(paths.filter(p => p.branch).length, branches);
  assert.equal(paths[0].points.length, segments + 1);
  for (const { points, start, end } of paths) {
    assert.ok(start >= 0 && end <= 1 && end > start);
    points.forEach((q, k) => {
      assert.ok(Math.abs(Math.hypot(q.x, q.y, q.z) - 1) < 1e-6, 'on the unit sphere');
      assert.ok(q.at >= 0 && q.at <= 1);
      if (k) assert.ok(q.at > points[k - 1].at, 'a crack runs one way');
    });
  }
  assert.ok(new Set(paths.filter(p => !p.branch).map(p => p.start)).size === count, 'they do not all start together');
});

test('cracks can gather on the faces a rock is seen from', () => {
  const paths = crackPaths({ seed: 6, faces: [0, Math.PI] }).filter(p => !p.branch), onAxis = paths.filter(p => Math.abs(p.points[0].x) > Math.abs(p.points[0].z));
  assert.equal(onAxis.length, paths.length, 'every crack starts toward an end');
  assert.ok(paths.some(p => p.points[0].x > 0) && paths.some(p => p.points[0].x < 0), 'both ends get some');
});

test('more progress shows more of the cracks, from nothing to everything', () => {
  const paths = crackPaths({ seed: 2 });
  assert.equal(revealedShare(paths, crackReveal(0)), 0);
  assert.equal(revealedShare(paths, crackReveal(1)), 1);
  let last = 0; for (let p = 0; p <= 1; p += .05) { const s = revealedShare(paths, crackReveal(p)); assert.ok(s >= last); last = s; }
  const half = revealedShare(paths, crackReveal(.5)); assert.ok(half > .3 && half < .9, `half way: ${half}`);
});

test('the debris pool never passes its cap, empties, and gives its slots back', () => {
  const pool = createDebris({ cap: 6, seed: 3 });
  assert.equal(pool.spawn(0, 1, 0, 0, 1, 0, 50, rule), 6); assert.equal(pool.alive, 6);
  assert.equal(pool.spawn(0, 1, 0, 0, 1, 0, 1, rule), 0, 'a full pool drops the rest');
  for (let i = 0; i < 20; i++) pool.step(.05);
  assert.equal(pool.alive, 0); assert.equal(pool.spawn(0, 1, 0, 0, 1, 0, 2, rule), 2);
});

test('chips fly out along the normal, fall, and stop at the floor', () => {
  const pool = createDebris({ cap: 5, seed: 8, ground: 0 });
  pool.spawn(0, 1, 0, 1, 0, 0, 5, { ...rule, life: [3, 3], spread: .1, up: .1 });
  for (let i = 0; i < 6; i++) pool.step(.03);
  for (let i = 0; i < 5; i++) assert.ok(pool.x[i] > 0, 'out along +x');
  for (let i = 0; i < 90; i++) pool.step(.03);
  for (let i = 0; i < 5; i++) assert.ok(pool.y[i] >= 0, 'never through the floor');
});

test('pieces shrink away instead of popping out', () => {
  const pool = createDebris({ cap: 1, seed: 1 }); pool.spawn(0, 1, 0, 0, 1, 0, 1, rule);
  assert.ok(Math.abs(pool.drawnSize(0) - .05) < 1e-6);
  pool.step(.4); assert.ok(pool.drawnSize(0) < .049 && pool.drawnSize(0) > 0);
});

test('a lower quality drops what no longer fits', () => {
  const pool = createDebris({ cap: 10 }); pool.spawn(0, 1, 0, 0, 1, 0, 10, rule);
  pool.setCap(4); assert.equal(pool.alive, 4); assert.equal(pool.cap, 4);
  assert.equal(pool.spawn(0, 1, 0, 0, 1, 0, 3, rule), 0);
});

test('the shake kicks, decays to nothing, stays tiny, and reduced motion stills it', () => {
  const { offset, turn } = CRACK_TUNING.shake, s = createShake(); s.kick(1);
  let peak = 0;
  for (let i = 0; i < 12; i++) { const o = s.step(1 / 60); peak = Math.max(peak, Math.hypot(o.x, o.z)); assert.ok(Math.abs(o.rx) <= turn * 1.2 && Math.abs(o.rz) <= turn * 1.2); }
  assert.ok(peak > 0 && peak <= offset * 1.2 * Math.SQRT2, `peak ${peak}`);
  for (let i = 0; i < 120; i++) s.step(1 / 60);
  assert.equal(s.energy, 0); const rest = s.step(1 / 60); assert.equal(Math.hypot(rest.x, rest.y, rest.z), 0);
  const still = createShake({ motion: 0 }); still.kick(1);
  const o = still.step(1 / 60); assert.equal(Math.hypot(o.x, o.y, o.z, o.rx, o.rz), 0);
});

test('chips, sparks and chunks all stay under one small budget per quality', () => {
  for (const q of ['alta', 'media', 'baja']) { assert.equal(crackQuality(q), q); assert.ok(CRACK_TUNING.chips.cap[q] + CRACK_TUNING.chunks.count[q] + CRACK_TUNING.sparks.cap[q] <= 80); }
  assert.ok(CRACK_TUNING.chips.cap.baja < CRACK_TUNING.chips.cap.alta);
  assert.equal(crackQuality('nope'), 'media');
});
