import test from 'node:test';
import assert from 'node:assert/strict';
import { addFeed, createCrackle, createEmberPool, fireQuality, flameLayout, flicker, FIRE_TUNING, LAYER, lightState, stepFeed } from '../fx/fire-sim.js';

test('flicker stays in 0..1, is the same for the same time and differs per fire', () => {
  let lo = 1, hi = 0, apart = 0;
  for (let t = 0; t < 40; t += .017) {
    const a = flicker(t, 1.2), b = flicker(t, 4.4);
    assert.equal(a, flicker(t, 1.2));
    assert.ok(a >= 0 && a <= 1, `flicker(${t}) = ${a}`);
    lo = Math.min(lo, a); hi = Math.max(hi, a); apart = Math.max(apart, Math.abs(a - b));
  }
  assert.ok(hi - lo > .5, `it really moves: ${lo}..${hi}`);
  assert.ok(apart > .3, 'two fires do not breathe together');
});

test('a fire is uneven: the flicker does not repeat on one simple beat', () => {
  const sample = phase => Array.from({ length: 30 }, (_, i) => flicker(i * .23, phase));
  const a = sample(.7), sign = a.slice(1).map((v, i) => Math.sign(v - a[i]));
  assert.ok(new Set(a.map(v => v.toFixed(2))).size > 15);
  assert.ok(sign.some(s => s > 0) && sign.some(s => s < 0));
});

test('the light wanders around where it hangs, and a flare-up spikes it', () => {
  const { depth, jitter, lift } = FIRE_TUNING.light, out = {};
  let moved = 0;
  for (let t = 0; t < 20; t += .03) {
    assert.equal(lightState(t, 2, 0, false, out), out, 'the object passed in is reused');
    assert.ok(out.intensity >= 1 - depth - 1e-9 && out.intensity <= 1 + depth + 1e-9, `intensity ${out.intensity}`);
    assert.ok(Math.abs(out.x) <= jitter + 1e-9 && Math.abs(out.z) <= jitter + 1e-9 && Math.abs(out.y) <= lift + 1e-9);
    assert.ok(out.warmth >= 0 && out.warmth <= 1);
    moved = Math.max(moved, Math.hypot(out.x, out.z));
  }
  assert.ok(moved > jitter * .4, 'the shadows dance');
  const still = lightState(3, 2, 0), hot = lightState(3, 2, 1, false, {});
  assert.ok(hot.intensity > still.intensity + .9, 'a full feed spikes it');
});

test('reduced motion shrinks the wandering, not the flicker', () => {
  const a = lightState(5.3, 1, 0, false, {}), b = lightState(5.3, 1, 0, true, {});
  assert.equal(a.intensity, b.intensity);
  assert.ok(Math.abs(b.x) < Math.abs(a.x) && Math.abs(b.y) < Math.abs(a.y));
});

test('a feed adds up to its cap and dies away', () => {
  assert.equal(addFeed(0, 1), 1);
  assert.equal(addFeed(1.4, 1), FIRE_TUNING.feed.cap);
  assert.equal(addFeed(.5, -3), .5, 'a negative feed takes nothing away');
  let flare = 1; const seen = [];
  for (let t = 0; t < 4; t += .05) { flare = stepFeed(flare, .05); seen.push(flare); }
  assert.ok(seen.every((v, i) => !i || v <= seen[i - 1]), 'never grows on its own');
  assert.ok(seen[9] < .55 && seen[9] > .25, `half a second in: ${seen[9]}`);
  assert.equal(stepFeed(.001, .05), 0, 'gone, not lingering forever');
  const half = stepFeed(1, 1), steps = stepFeed(stepFeed(1, .5), .5);
  assert.ok(Math.abs(half - steps) < 1e-9, 'the same however the frames fall');
});

test('the ember pool never passes its cap, and every ember rises and dies', () => {
  const pool = createEmberPool({ cap: 10, seed: 3, height: 1 });
  assert.equal(pool.spawn(50), 10, 'a burst stops at the cap');
  assert.equal(pool.alive, 10);
  assert.equal(pool.spawn(1), 0);
  const y0 = pool.positions[1];
  for (let i = 0; i < 6; i++) pool.step(.05, i * .05);
  assert.ok(pool.positions[1] > y0, 'it rises');
  for (let i = 0; i < 80; i++) pool.step(.05, i * .05);
  assert.equal(pool.alive, 0, 'all burnt out');
  assert.ok(pool.lives.every(l => l === 0));
  assert.equal(pool.spawn(3), 3, 'and the slots come back');
});

test('embers fade: an ember\'s life only falls', () => {
  const pool = createEmberPool({ cap: 4, seed: 9 }); pool.spawn(1);
  let last = pool.lives[0];
  for (let i = 0; i < 40 && pool.lives[0] > 0; i++) { pool.step(.03, i * .03); assert.ok(pool.lives[0] < last); last = pool.lives[0]; }
});

test('the steady flow keeps the pool busy without passing the cap, frame rate aside', () => {
  const count = dt => { const pool = createEmberPool({ cap: 12, seed: 1 }); let peak = 0; for (let t = 0; t < 6; t += dt) { pool.step(dt, t, 10); peak = Math.max(peak, pool.alive); assert.ok(pool.alive <= 12); } return peak; };
  assert.ok(count(1 / 60) >= 6); assert.ok(count(1 / 15) >= 6);
});

test('a lower quality puts out what no longer fits', () => {
  const pool = createEmberPool({ cap: 20 }); pool.spawn(20);
  pool.setCap(5); assert.equal(pool.cap, 5); assert.equal(pool.alive, 5);
  assert.equal(pool.spawn(9), 0);
  pool.setCap(99); assert.equal(pool.cap, 20, 'never past what it was built with');
});

test('the same seed gives the same embers: nothing global in it', () => {
  const run = () => { const pool = createEmberPool({ cap: 8, seed: 42 }); pool.spawn(8); for (let i = 0; i < 20; i++) pool.step(.05, i * .05); return [...pool.positions]; };
  assert.deepEqual(run(), run());
});

test('crackles come at a seeded, uneven pace, sooner in a flare-up', () => {
  const pace = (flare, seed = 5) => { const c = createCrackle({ seed }), at = []; for (let t = 0; t < 60; t += .05) { const pops = c.step(.05, flare); if (pops) { at.push(t); assert.ok(pops >= FIRE_TUNING.crackle.pops[0] && pops <= FIRE_TUNING.crackle.pops[1]); } } return at; };
  assert.deepEqual(pace(0), pace(0));
  const quiet = pace(0), lively = pace(1);
  assert.ok(quiet.length >= 20 && quiet.length <= 200, `${quiet.length} in a minute`);
  assert.ok(lively.length > quiet.length * 1.5);
  const gaps = quiet.slice(1).map((t, i) => t - quiet[i]);
  assert.ok(Math.max(...gaps) > Math.min(...gaps) * 1.5, 'not a metronome');
});

test('flame layers: low quality is three cards and no halo, every quality has its core', () => {
  for (const quality of ['alta', 'media', 'baja']) {
    const cards = flameLayout({ quality, height: 1, radius: .3, seed: 2 }), want = FIRE_TUNING.layers[quality];
    assert.equal(cards.length, want.halo + want.outer + want.mid + want.core);
    assert.ok(cards.some(c => c.layer === LAYER.core) && cards.some(c => c.layer === LAYER.outer));
    assert.deepEqual(cards, flameLayout({ quality, height: 1, radius: .3, seed: 2 }));
    const heights = layer => cards.filter(c => c.layer === layer).map(c => c.height);
    assert.ok(Math.max(...heights(LAYER.core)) < Math.min(...heights(LAYER.outer)), 'the core sits inside the outer tongues');
    assert.equal(new Set(cards.map(c => c.phase)).size, cards.length, 'no two lick together');
  }
  assert.equal(flameLayout({ quality: 'baja' }).length, 3);
  assert.equal(flameLayout({ quality: 'baja' }).filter(c => c.layer === LAYER.halo).length, 0);
  assert.equal(fireQuality('nope'), 'media');
  const small = flameLayout({ quality: 'alta', height: 1, seed: 2 }), big = flameLayout({ quality: 'alta', height: 3, seed: 2 });
  assert.ok(big.every((c, i) => Math.abs(c.height - small[i].height * 3) < 1e-9), 'it scales with the fire');
});
