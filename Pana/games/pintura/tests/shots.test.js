import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKERS, kitStats, cleanKit } from '../public/armory-data.js';
import { Arena, DURATION } from '../public/rules.js';

const marker = id => MARKERS.find(m => m.id === id);

test('paintballs are near-hitscan, with the same reach the slow ones had', () => {
  const reach = { pistol: 51, scatter: 17, rapid: 37.4 };
  for (const id of ['pistol', 'scatter', 'rapid']) {
    const m = marker(id);
    assert.ok(m.speed >= 80, `${id} flies ${m.speed} m/s`);
    assert.ok(Math.abs(m.speed * m.life - reach[id]) < .5, `${id} reaches ${m.speed * m.life} m`);
  }
  assert.equal(marker('rocket').speed, 18, 'the rocket stays a visible lob');
  assert.ok(marker('pistol').cadence <= .2, 'the pistol fires five times a second');
});

test('a fast ball still cannot cross cover in one step', () => {
  const g = new Arena('plaza', 'normal', { lives: 0 }); g.add(1, { name: 'A', avatar: {} }); g.add(2, { name: 'B', avatar: {} }); g.start(); g.go();
  const [a, b] = g.players, speed = kitStats(cleanKit(), g.options).speed;
  Object.assign(a, { x: 0, z: -14, shield: 0 }); Object.assign(b, { x: 40, z: -14, shield: 0 });
  g.step(.05, new Map([[1, { ax: 1, az: 0, fire: true }]]));
  const ball = g.balls[0]; assert.ok(ball && Math.hypot(ball.vx, ball.vz) > 80 && Math.hypot(ball.vx, ball.vz) <= speed + 1e-6);
  assert.equal(g.players[1].hits, 0);
});

test('bots stay as deadly as before the faster paintballs, and sharper bots still hit more', () => {
  function perMinute(difficulty) {
    const g = new Arena('plaza', difficulty, { lives: 0 }); for (let i = 0; i < 4; i++) g.add(i + 1, { name: `B${i}`, avatar: {}, bot: true });
    g.start(); g.go();
    for (let n = 0; n < DURATION / .05 && g.phase === 'playing'; n++) g.step(.05, new Map());
    return g.players.reduce((sum, p) => sum + p.score, 0) / 4 / ((DURATION - g.time) / 60);
  }
  const facil = perMinute('facil'), experto = perMinute('experto');
  assert.ok(facil > 1.5 && facil < 6, `facil ${facil}`);
  assert.ok(experto > 2.5 && experto < 7, `experto ${experto}`);
});