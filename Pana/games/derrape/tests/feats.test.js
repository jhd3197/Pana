import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriftFeats, LONG_DRIFT_M } from '../public/feats.js';

// Just enough element for the toast, recording every text it is asked to show.
// The clock advances with the steps, so the engine cooldown behaves as in a race.
function rig() {
  const shown = [], classes = new Set();
  let text = '', t = 0;
  const el = {
    hidden: false, hasAttribute: () => false,
    classList: { contains: (c) => classes.has(c), toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); } },
    get textContent() { return text; },
    set textContent(v) { text = v; if (v) shown.push(v); },
  };
  const feats = createDriftFeats(el, { now: () => t });
  return { el, feats, shown, step(c, dt) { t += dt * 1000; feats.step(c, dt); } };
}

// A fake player car mid-drift at 30 m/s.
const car = () => ({ drift: 1, driftLvl: 0, vf: 30, boost: 0 });

test('drift distance sums vf·dt and celebrates 500 m, then each kilometre', () => {
  const { feats, shown, step } = rig(), c = car();
  // Short stints with a release in between, so only the distance meter fires.
  for (let stint = 0; stint < 20; stint++) {
    for (let i = 0; i < 50; i++) step(c, 1 / 60);
    c.drift = 0; step(c, 1 / 60); c.drift = 1;
  }
  assert.ok(Math.abs(feats.total - 500) < 5, `total ${feats.total}`);
  assert.deepEqual(shown, ['¡500 metros derrapados!']);
  for (let stint = 0; stint < 20; stint++) {
    for (let i = 0; i < 50; i++) step(c, 1 / 60);
    c.drift = 0; step(c, 1 / 60); c.drift = 1;
  }
  assert.deepEqual(shown, ['¡500 metros derrapados!', '¡1 kilómetro derrapado!']);
  feats.reset();
  assert.equal(feats.total, 0);
});

test('a long single drift fires once per 100 m without releasing', () => {
  const { feats, shown, step } = rig(), c = car();
  for (let i = 0; i < 60 * 3.4; i++) step(c, 1 / 60);   // 102 m
  assert.deepEqual(shown, [`¡Derrapón! ¡${LONG_DRIFT_M} m sin soltar!`]);
  c.drift = 0;
  for (let i = 0; i < 60 * 4; i++) step(c, 1 / 60);   // a straight between bends: the cooldown passes
  c.drift = 1;
  for (let i = 0; i < 60 * 3.4; i++) step(c, 1 / 60);
  assert.equal(shown.filter(t => t.includes('Derrapón')).length, 2);
  assert.equal(feats.current > 100, true);
});

test('a race win counts once until the next race resets', () => {
  const { feats } = rig();
  assert.equal(feats.win(), true);
  assert.equal(feats.win(), false);   // a results re-render must not recount
  feats.reset();
  assert.equal(feats.win(), true);
});

test('releasing a purple drift celebrates; a crashed drift does not', () => {
  const { el, step } = rig(), c = car();
  c.driftLvl = 3;
  for (let i = 0; i < 60; i++) step(c, 1 / 60);
  c.drift = 0; c.boost = 1.45;   // stepCar pays DRIFT_BOOST[3] on a clean release
  step(c, 1 / 60);
  assert.equal(el.textContent, '¡Suelta púrpura! ¡Tremendo derrape!');

  const crashed = rig(), k = car();
  k.driftLvl = 3;
  for (let i = 0; i < 60; i++) crashed.step(k, 1 / 60);
  k.drift = 0;   // a wall killed the drift: no turbo paid
  crashed.step(k, 1 / 60);
  assert.equal(crashed.el.textContent, '');

  const lazy = rig(), d = car();
  d.driftLvl = 2;   // orange, not purple: no celebration even on a clean release
  for (let i = 0; i < 60; i++) lazy.step(d, 1 / 60);
  d.drift = 0; d.boost = 0.95;
  lazy.step(d, 1 / 60);
  assert.equal(lazy.el.textContent, '');
});
