import test from 'node:test';
import assert from 'node:assert/strict';
import { RIVER } from '../public/river.js';

const R = RIVER;

test('one ~950 m river in three tramos, downhill to the churuata', () => {
  assert.ok(R.LENGTH > 900 && R.LENGTH < 1000, `length ${R.LENGTH}`);
  assert.deepEqual(R.def.sectors.map(s => s[1]), ['Caño de la Selva', 'Raudal del Autana', 'Río Negro', 'La churuata']);
  assert.ok(R.halfWidth(150) * 2 >= 8 && R.halfWidth(150) * 2 <= 12.5, 'the caño is narrow');
  assert.ok(R.halfWidth(700) * 2 >= 30 && R.halfWidth(700) * 2 <= 40, 'the Río Negro is wide');
  assert.ok(R.levelAt(0) > R.levelAt(R.LENGTH) + 3, 'downhill');
  for (let s = 0; s < R.LENGTH; s += 2) {
    const p = R.at(s), w = R.locate(p.x, p.z);
    assert.ok(Math.abs(w.s - s) < .5 || w.channel === 'branch', `projection at ${s}`);
    assert.ok(R.waterDepth(p.x, p.z) > .5, `deep enough at ${s}`);
  }
});

test('reaches of the river never touch each other', () => {
  const S = R.main.samples;
  for (let i = 0; i < S.length; i += 6) for (let j = i + 6; j < S.length; j += 6) {
    if (S[j].s - S[i].s < 70) continue;
    assert.ok(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) > R.halfWidth(S[i].s) + R.halfWidth(S[j].s) + 10, `${S[i].s | 0} vs ${S[j].s | 0}`);
  }
});

test('the igapó is a shorter, slower cut through trunks', () => {
  const b = R.branch;
  assert.ok(b.length < b.mainLength * .85 && b.length > b.mainLength * .65, `${b.length} vs ${b.mainLength}`);
  const mid = b.path.at(b.length / 2), w = R.locate(mid.x, mid.z);
  assert.equal(w.channel, 'branch');
  assert.ok(w.s > b.from && w.s < b.to, 'progress maps onto the main river');
  assert.ok(R.currentAt(mid.x, mid.z).speed < R.currentAt(R.at(w.s).x, R.at(w.s).z).speed);
  assert.ok(R.snags.length >= 6);
});

test('the current runs downstream, faster in the chorro, slack in a remanso', () => {
  for (const s of [80, 420, 700]) {
    const p = R.at(s, R.def.chorro(s)), c = R.currentAt(p.x, p.z);
    assert.ok(c.x * Math.sin(p.h) + c.z * Math.cos(p.h) > 1, `downstream at ${s}`);
  }
  const s = 650, line = R.at(s, R.def.chorro(s)), edge = R.at(s, R.def.chorro(s) > 0 ? -12 : 12);
  assert.ok(R.currentAt(line.x, line.z).speed > R.currentAt(edge.x, edge.z).speed + 1.5, 'the chorro is the racing line');
  const e = R.eddies[0], away = R.at(e.s, -Math.sign(e.offset) * 2);
  const inEddy = R.currentAt(e.x, e.z), open = R.currentAt(away.x, away.z);
  assert.ok(inEddy.eddy > .5 && inEddy.speed < open.speed * .5, 'remansos hold you back');
});

test('raudales drop every lane the same in total, in different steps', () => {
  for (const d of R.drops) {
    assert.equal(d.lanes.length, 3);
    const totals = d.lanes.map(l => l.steps.reduce((a, [, h]) => a + h, 0));
    for (const t of totals) assert.ok(Math.abs(t - totals[0]) < 1e-9);
    assert.equal(d.lanes.filter(l => l.fast).length, 1);
    const fast = d.lanes.find(l => l.fast), mid = (fast.from + fast.to) / 2;
    assert.ok(R.levelAt(d.s - 1, mid) - R.levelAt(d.s + 1, mid) > 1.2, 'the fast lane has the scary drop');
    for (const lane of d.lanes) assert.ok(Math.abs(R.levelAt(d.s - d.span - 1, (lane.from + lane.to) / 2) - R.levelAt(d.s + d.span + 1, (lane.from + lane.to) / 2) - totals[0]) < .1);
  }
});
