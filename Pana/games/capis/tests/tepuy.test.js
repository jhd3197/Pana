import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, spreadSpawns, ffaReach, hiddenFrom, standable, WATER } from '../public/map-rules.js';
import { STUDIO_PRESETS } from '../public/studio-maps.js';
import { tepuyFigure } from '../public/tepuy-maps.js';
import { RULES, walkerOptions } from '../public/rules.js';
import { startingAmmo } from '../public/weapons.js';
import { SIDE_WALKER, stepSideWalker } from '../../../engine/play/side-walker.js';
import { surfaceY } from '../../../engine/play/terrain-mask.js';

const maps = STUDIO_PRESETS.map(id => generateMap(tepuyFigure(id).seed, 'large', { mode: 'ffa' }));
test('studio climbing retains jump height, walk speed and projectile radius', () => {
  assert.equal(SIDE_WALKER.jump, 7.2); assert.equal(SIDE_WALKER.gravity, 18);
  assert.equal(SIDE_WALKER.walk, 2.4); assert.equal(RULES.radius, .7);
  assert.equal(SIDE_WALKER.stepUp, .35, 'ordinary maps keep their old movement');
});
test('La Licuadora is in every side\'s kit from the first turn', () => assert.ok(startingAmmo().drill > 0));
test('each studio preset has legal, connected starts, >=20 spacing and >=80% neighbouring cover', () => {
  for (const { map, mask } of maps) {
    const xs = spreadSpawns(map, mask).sort((a, b) => a - b), ys = xs.map(x => surfaceY(mask, x));
    assert.equal(xs.length, 6);
    assert.ok(xs.every(x => standable(mask, x) !== null), map.figure);
    assert.ok(xs.slice(1).every((x, i) => x - xs[i] >= 20), map.figure);
    assert.ok(xs.at(-1) - xs[0] >= map.width * .55, map.figure);
    assert.ok(ffaReach(map, mask, xs).connected, map.figure);
    const cover = xs.slice(1).filter((x, i) => hiddenFrom(mask, xs[i], ys[i], x, ys[i + 1])).length;
    assert.ok(cover / 5 >= .8, `${map.figure}: ${cover}/5 covered`);
  }
});

// Real input sequences, with unchanged jump/air-control values. Different
// take-off positions are tried because walking blindly into a sima is not a
// proof that a human cannot jump across its mouth. No teleports or terrain edits.
export function walkRoute(map, mask, from, to) {
  const y0 = surfaceY(mask, from), targetY = surfaceY(mask, to), opts = walkerOptions({ map });
  const modes = ['gap.2', 'gap.5', 'gap.8', 'gap1.1', 'gap1.4', 'gap1.7', 'gap2', 'anticipate', 'walk', 'blocked', 'spam'];
  for (const mode of modes) {
    const c = { x: from, y: y0, vx: 0, vy: 0, grounded: true, facing: Math.sign(to - from), slide: 0, paint: 0, jumpPress: 0 };
    let jump = 0, last = c.x, stuck = 0;
    for (let t = 0; t < 60 * 90; t++) {
      const dir = Math.sign(to - c.x), stairs = mask.stairs.some(([a, b]) => c.x >= a && c.x <= b);
      if (mode === 'spam' && c.grounded) jump++;
      if (mode.startsWith('gap') && c.grounded && !stairs && surfaceY(mask, c.x + dir * Number(mode.slice(3))) < c.y - .6) jump++;
      if (mode === 'anticipate' && c.grounded && surfaceY(mask, c.x + dir * .9) < c.y - 1.1) jump++;
      const result = stepSideWalker(c, { x: dir, jump }, 1 / 60, mask, opts);
      if (result.drowned) break;
      if (Math.abs(c.x - to) < .8 && Math.abs(c.y - targetY) < 1.5 && c.grounded) return true;
      if (mode !== 'walk' && result.blocked && c.grounded) jump++;
      if (t > 0 && t % 120 === 0) { if (Math.abs(last - c.x) < .3) { jump++; stuck++; } else stuck = 0; last = c.x; if (stuck > 5) break; }
    }
  }
  return false;
}
test('a capi really crosses all ten neighbour routes on every admitted studio map', () => {
  for (const { map, mask } of maps) {
    const xs = spreadSpawns(map, mask).sort((a, b) => a - b);
    for (let i = 0; i < 5; i++) for (const [a, b] of [[i, i + 1], [i + 1, i]]) {
      assert.ok(walkRoute(map, mask, xs[a], xs[b]), `${map.figure}: ${xs[a]} -> ${xs[b]}`);
    }
  }
});

test('studio presets mark only the flanks\' authored step runs as stairs', async () => {
  const { generateStudioMap, STUDIO_PRESETS } = await import('../public/studio-maps.js');
  const { tepuyFigure: figure } = await import('../public/tepuy-maps.js');
  const { onStairs } = await import('../../../engine/play/stair-footing.js');
  for (const id of STUDIO_PRESETS) {
    const { map, mask } = generateStudioMap(figure(id).seed), runs = mask.stairs;
    assert.ok(runs.length > 12 && runs.every(([a, b]) => b > a && b - a < 8), `${id}: short authored runs`);
    // A top and the valley floors past the flanks are never stairs.
    for (const m of map.plan.mesas) for (const x of [m.cx, m.cx - m.tw + 1, m.cx + m.tw - 1]) assert.equal(onStairs(runs, x), false, `${id}: the top at ${x.toFixed(1)}`);
    for (const v of map.plan.valleys) if (v.kind === 'flat' || v.kind === 'pond') assert.equal(onStairs(runs, v.x), false, `${id}: the valley at ${v.x.toFixed(1)}`);
  }
});
