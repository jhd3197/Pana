import test from 'node:test';
import assert from 'node:assert/strict';
import { createDriftScoring, SCORE } from '../public/drift-score.js';

// A fake car mid-drift at 30 m/s, moderately sideways; banks are recorded.
function rig() {
  const banked = [];
  const scoring = createDriftScoring({ count: (id, n) => banked.push([id, n]) });
  return { scoring, banked };
}
const car = (over = {}) => ({ isPlayer: true, drift: 1, driftLvl: 1, driftHeld: true, vf: 30, vr: 15, spin: 0, ...over });

// Drive n seconds of steps with the car in the given state.
function drive(scoring, c, seconds, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) scoring.step(c, dt);
}

test('faster, more charged and more sideways drifts score more per second', () => {
  const rate = (over) => {
    const { scoring } = rig();
    const c = car(over);
    drive(scoring, c, 1);
    return scoring.totalOf(c);
  };
  const base = rate({});
  assert.ok(rate({ vf: 15, vr: 15 }) < base, 'slower scores less');
  assert.ok(rate({ vf: 60, vr: 60 }) > base, 'faster scores more at the same sideways ratio');
  assert.ok(rate({ vf: 120, vr: 120 }) <= SCORE.BASE_RATE * SCORE.SPEED_CAP * SCORE.LEVEL_FACTOR[1] * 1 + 1, 'speed factor is capped');
  assert.ok(rate({ driftLvl: 0 }) < rate({ driftLvl: 1 }), 'uncharged < blue');
  assert.ok(rate({ driftLvl: 2 }) > rate({ driftLvl: 1 }), 'orange > blue');
  assert.ok(rate({ driftLvl: 3 }) > rate({ driftLvl: 2 }), 'purple > orange');
  assert.equal(rate({ vr: 0 }), 0, 'a held button on a straight scores nothing');
  assert.ok(rate({ vr: 30 }) > base, 'more sideways scores more');
  // The drive model bleeds vr fast and swings the tail visually: a drifted
  // bend shows up as turning (latAcc = turn × vf), and that scores too.
  assert.ok(rate({ vr: 0, latAcc: 30 * SCORE.TURN_FULL }) > 0, 'a drifted bend with no slip still scores');
  assert.equal(rate({ vr: 0, latAcc: 0 }), 0, 'no slip and no turn scores nothing');
});

test('the exact rate is base × speed × level × angle while drifting', () => {
  const { scoring } = rig();
  const c = car({ vf: SCORE.SPEED_REF, driftLvl: 1, vr: SCORE.SPEED_REF * SCORE.ANGLE_FULL });
  drive(scoring, c, 2);
  // Full angle, reference speed, level 1, ×1 chain: BASE_RATE per second.
  assert.ok(Math.abs(scoring.totalOf(c) - SCORE.BASE_RATE * 2) < 2, `total ${scoring.totalOf(c)}`);
});

test('a drift within the chain window raises the multiplier; a long straight banks and resets it', () => {
  const { scoring, banked } = rig();
  const c = car();
  drive(scoring, c, 1);                       // first drift, ×1
  c.drift = 0; c.driftHeld = false;           // clean release
  drive(scoring, c, SCORE.CHAIN_WINDOW - 1);  // still inside the window
  assert.equal(scoring.live(c).active, true, 'chain stays live during the window');
  c.drift = 1; c.driftHeld = true;
  drive(scoring, c, 1);                       // chained drift, ×2
  assert.equal(scoring.live(c).chain, 2);
  const chained = scoring.totalOf(c);
  c.drift = 0; c.driftHeld = false;
  drive(scoring, c, SCORE.CHAIN_WINDOW + 0.5);
  assert.equal(scoring.live(c).active, false, 'the window expired');
  assert.equal(scoring.live(c).chain, 1, 'multiplier back to ×1');
  assert.equal(scoring.totalOf(c), chained, 'the pot banked into the race total');
  assert.deepEqual(banked, [['derrape.drift-points', chained]], 'one bank, reported once');
  assert.equal(scoring.bestChainOf(c), 2);

  // A fresh drift after banking starts a new chain at ×1.
  c.drift = 1; c.driftHeld = true;
  drive(scoring, c, 0.5);
  assert.equal(scoring.live(c).chain, 1);
});

test('a crash banks immediately and never loses points', () => {
  const { scoring, banked } = rig();
  const c = car();
  drive(scoring, c, 1.5);
  const slid = scoring.totalOf(c);
  c.drift = 0;   // a hard wall hit kills the drift while the button is held
  scoring.step(c, 1 / 60);
  assert.equal(scoring.live(c).active, false, 'no chain window after a crash');
  assert.equal(scoring.totalOf(c), slid, 'crashed points are banked, not lost');
  assert.deepEqual(banked, [['derrape.drift-points', slid]]);

  // A spin-out ends the drift the same way, even if the button was released.
  const spun = rig(), k = car();
  drive(spun.scoring, k, 1);
  k.drift = 0; k.driftHeld = false; k.spin = 0.5;
  spun.scoring.step(k, 1 / 60);
  assert.equal(spun.scoring.live(k).active, false);
  assert.equal(spun.banked.length, 1);
});

test('only the local player feeds the stats pipe; bots still score', () => {
  const { scoring, banked } = rig();
  const bot = car({ isPlayer: false });
  drive(scoring, bot, 1);
  bot.drift = 0; bot.driftHeld = false;
  drive(scoring, bot, SCORE.CHAIN_WINDOW + 0.5);
  assert.ok(scoring.totalOf(bot) > 0, 'the bot has a style total for the results screen');
  assert.deepEqual(banked, [], 'bot points never reach the stats pipe');
});

test('finish banks a live chain and reset starts the next race over', () => {
  const { scoring, banked } = rig();
  const c = car();
  drive(scoring, c, 2);
  const slid = scoring.totalOf(c);
  scoring.finish(c);
  assert.equal(scoring.totalOf(c), slid);
  assert.deepEqual(banked, [['derrape.drift-points', slid]]);
  scoring.reset();
  assert.equal(scoring.totalOf(c), 0);
  assert.equal(scoring.bestChainOf(c), 1);
  assert.equal(scoring.live(c).active, false);
});

test('a decent race lands in the low thousands', () => {
  const { scoring } = rig();
  const c = car({ driftLvl: 2 });   // orange charge, the middle of the road
  // Twenty seconds of drifting in five chained stints, like three laps.
  for (let stint = 0; stint < 5; stint++) {
    c.drift = 1; c.driftHeld = true;
    drive(scoring, c, 4);
    c.drift = 0; c.driftHeld = false;
    drive(scoring, c, 1.5);   // a short straight between bends
  }
  drive(scoring, c, SCORE.CHAIN_WINDOW + 0.5);
  const total = scoring.totalOf(c);
  assert.ok(total > 1000 && total < 10000, `total ${total}`);
});
