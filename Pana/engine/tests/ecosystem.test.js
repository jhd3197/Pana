// The food chain: eating, starving, breeding with mutation, caps, cover, noise,
// costly vision, and that a run is plain data that replays exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { addCreature, advanceEcosystem, coverAt, coverOf, createEcosystem, dimmed, ecoWorld, meanTrait, metabolism, removeCreature, traitsFor } from '../ai/ecosystem.js';

const traits = { sight: [1, 12], hear: [4, 22], pace: [.7, 1.3] };
const grazer = { eats: 'pests', cap: 40, life: 900, mature: 10, breedAt: 55, birthCost: 14, cool: 14, mutate: .15, hungry: 45, full: 85, base: .35, gain: 200, bite: .03, torpor: .5, smell: 30, roam: .15, speed: 6, nest: 'roost', rest: 'roost', traits };
const hunter = { eats: ['grazer'], cap: 8, life: 900, mature: 50, breedAt: 68, birthCost: 22, cool: 45, mutate: .1, hungry: 50, full: 50, base: .06, gain: 70, catch: .5, ambush: 20, smell: 32, roam: .05, speed: 2, follow: true, traits };
const species = { grazer, hunter };
const patch = (x, z, extra = {}) => ({ x, z, r: 2, kind: 'patch', plant: true, cover: .7, hides: true, light: 1, ...extra });
const roost = (x, z, extra = {}) => ({ x, z, r: 2, kind: 'roost', cover: .9, light: .1, ...extra });
const map = () => [patch(0, 0), patch(16, 0), patch(0, 16), patch(16, 16), roost(8, 8), roost(24, 8), { x: 8, z: 24, r: 2, kind: 'lair', cover: .2, light: 0 }];
const founders = (grazers, hunters = 0) => [...Array.from({ length: grazers }, (_, i) => ({ sp: 'grazer', at: 4 + i % 2 })), ...Array.from({ length: hunters }, () => ({ sp: 'hunter', at: 6 }))];
const run = (eco, world, seconds, hooks) => { for (let t = 0; t < seconds; t++) advanceEcosystem(eco, world, 1, hooks); };

test('fed creatures live and breed; with nothing to eat they starve', () => {
  const world = ecoWorld(map(), { species }), fed = createEcosystem(world, { seed: 3, founders: founders(8), pests: .4 });
  let births = 0; run(fed, world, 200, { on: kind => { if (kind === 'birth') births++; } });
  assert.ok(births > 3, `births: ${births}`); assert.ok(fed.counts.grazer > 4, `alive: ${fed.counts.grazer}`);
  const bare = ecoWorld(map().map(s => ({ ...s, plant: false })), { species }), hungry = createEcosystem(bare, { seed: 3, founders: founders(8) });
  let starved = 0, extinct = 0; run(hungry, bare, 400, { on: kind => { if (kind === 'starve') starved++; if (kind === 'extinct') extinct++; } });
  assert.equal(hungry.counts.grazer, 0); assert.ok(starved >= 8); assert.equal(extinct, 1, 'extinction is said once');
});

test('a child takes after its parents, a little changed, inside what the species allows', () => {
  const world = ecoWorld([roost(0, 0)], { species }), eco = createEcosystem(world, { seed: 9 }), kids = [];
  for (let i = 0; i < 30; i++) {
    const a = addCreature(eco, 'grazer', 0, { sight: 8, hear: 10, pace: 1 }, { e: 90, age: 30 }), b = addCreature(eco, 'grazer', 0, { sight: 8, hear: 10, pace: 1 }, { e: 90, age: 30 });
    advanceEcosystem(eco, world, 1, { on: (kind, c, more) => { if (kind === 'birth') kids.push({ c, more }); } });
    for (const q of [a, b]) q.cool = 0;
    eco.pop = eco.pop.filter(q => q.id > b.id); eco.counts.grazer = eco.pop.length;
  }
  assert.ok(kids.length >= 20, `kids: ${kids.length}`);
  assert.ok(kids.every(({ c }) => c.gen === 1 && c.sight >= 8 * .85 - .1 && c.sight <= 8 * 1.15 + .1));
  assert.ok(new Set(kids.map(({ c }) => c.sight)).size > 3, 'not clones');
  // Traits never leave the species' range.
  const edge = createEcosystem(world, { seed: 1 }); addCreature(edge, 'grazer', 0, { sight: 12, hear: 22, pace: 1.3 }, { e: 90, age: 30 }); addCreature(edge, 'grazer', 0, { sight: 12, hear: 22, pace: 1.3 }, { e: 90, age: 30 });
  run(edge, world, 2); assert.ok(edge.pop.every(c => c.sight <= 12 && c.hear <= 22 && c.pace <= 1.3));
});

test('populations stay under their caps', () => {
  const capped = { grazer: { ...grazer, cap: 7, life: 2000 }, hunter }, world = ecoWorld(map(), { species: capped }), eco = createEcosystem(world, { seed: 5, founders: founders(6), pests: .9 });
  let most = 0; for (let t = 0; t < 800; t++) { advanceEcosystem(eco, world, 1); most = Math.max(most, eco.counts.grazer); }
  assert.ok(most <= 7, `most: ${most}`); assert.equal(eco.counts.grazer, eco.pop.length);
});

test('a run is plain data: same seed same run, and a copy goes on exactly the same', () => {
  const world = ecoWorld(map(), { species }), a = createEcosystem(world, { seed: 77, founders: founders(10, 3) }), b = createEcosystem(world, { seed: 77, founders: founders(10, 3) });
  run(a, world, 120); run(b, world, 120); assert.deepEqual(a, b);
  const copy = JSON.parse(JSON.stringify(a)); assert.deepEqual(copy, a);
  run(a, world, 120); run(copy, world, 120); assert.deepEqual(copy, a, 'a new host carries on where the old one stopped');
  const other = createEcosystem(world, { seed: 78, founders: founders(10, 3) }); run(other, world, 240); assert.notDeepEqual(other.pop, a.pop);
});

test('half steps add up to whole seconds', () => {
  const world = ecoWorld(map(), { species }), eco = createEcosystem(world, { seed: 7, founders: founders(4) });
  let ran = 0; for (let i = 0; i < 40; i++) ran += advanceEcosystem(eco, world, .05);
  assert.equal(ran, 2); assert.equal(eco.t, 2);
});

test('cover shields what is inside: a stripped patch hides nothing', () => {
  const world = ecoWorld(map(), { species }), eco = createEcosystem(world, { seed: 1 });
  assert.equal(coverAt(eco, world, 0, 0), 0, 'a healthy patch hides you');
  assert.equal(coverAt(eco, world, 8, 8), -1, 'a roost hides creatures, not players');
  assert.equal(coverAt(eco, world, 9, 0), -1, 'outside it does not');
  eco.food[0] = .05; assert.ok(coverOf(eco, world, 0) < .1); assert.equal(coverAt(eco, world, 0, 0), -1);
  const roots = ecoWorld([{ x: 0, z: 0, r: 2, kind: 'roots', cover: .6, hides: true }], { species }), rooted = createEcosystem(roots, { seed: 1 });
  assert.equal(coverAt(rooted, roots, 1, 1), 0, 'roots never wilt');
  assert.equal(coverAt(rooted, roots, 1, 1, { floor: 2 }), -1, 'nor reach another floor');
});

test('cover keeps prey alive through the same hunters', () => {
  const eaten = cover => {
    const sites = [{ x: 0, z: 0, r: 2, kind: 'lair', cover, light: 0 }], world = ecoWorld(sites, { species: { grazer: { ...grazer, base: 0, nest: 'none' }, hunter: { ...hunter, hungry: 100, full: 100, base: 0, ambush: 1e9 } } });
    let total = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const eco = createEcosystem(world, { seed });
      for (let i = 0; i < 12; i++) addCreature(eco, 'grazer', 0, { sight: 1, hear: 4, pace: 1 }, { e: 90 });
      addCreature(eco, 'hunter', 0, { sight: 1, hear: 4, pace: 1 }, { e: 1 });
      run(eco, world, 8, { on: kind => { if (kind === 'eaten') total++; } });
    }
    return total;
  };
  assert.ok(eaten(.8) < eaten(0) * .5, `${eaten(.8)} vs ${eaten(0)}`);
});

test('noise pulls whoever hears it, and only within its ears', () => {
  const sites = [roost(0, 0), roost(12, 0), roost(40, 0)], world = ecoWorld(sites, { species }), eco = createEcosystem(world, { seed: 1 });
  const near = addCreature(eco, 'hunter', 0, { sight: 1, hear: 15, pace: 1 }, { e: 90 }), deaf = addCreature(eco, 'hunter', 0, { sight: 1, hear: 5, pace: 1 }, { e: 90 });
  advanceEcosystem(eco, world, 1, { noises: [{ x: 12, z: 0, radius: 20, site: 1 }] });
  assert.equal(near.to, 1, 'heard'); assert.equal(deaf.to, -1, 'too far for its ears');
  const faint = addCreature(eco, 'hunter', 0, { sight: 1, hear: 15, pace: 1 }, { e: 90 });
  advanceEcosystem(eco, world, 1, { noises: [{ x: 12, z: 0, radius: 6, site: 1 }] });
  assert.equal(faint.to, -1, 'a noise only carries so far');
});

test('seeing costs energy, and in the dark the lineages that see less win', () => {
  assert.ok(metabolism(grazer, { sight: 12, hear: 8, pace: 1 }) > metabolism(grazer, { sight: 2, hear: 8, pace: 1 }) * 1.5);
  const deep = traitsFor(grazer, 7), shallow = traitsFor(grazer, 1);
  assert.ok(deep.sight < shallow.sight / 5 && deep.hear > shallow.hear, 'founders down deep are nearly blind and hear well');
  const after = light => {
    let sum = 0, n = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const sites = map().map(s => ({ ...s, light: light * (s.light ?? 1), plant: s.plant && true })), world = ecoWorld(sites, { species: { grazer: { ...grazer, life: 260, cap: 30 } } });
      const eco = createEcosystem(world, { seed, founders: founders(10), pests: .5 });
      for (const c of eco.pop) c.sight = 8;
      run(eco, world, 1500);
      if (eco.pop.length) { sum += meanTrait(eco, 'grazer', 'sight'); n++; }
    }
    assert.ok(n >= 5, `lineages alive: ${n}`);
    return sum / n;
  };
  const dark = after(0); assert.ok(dark < 7.3, `sight fell from 8 to ${dark}`);
});

test('take the hunters away and the prey booms; take the prey away and the pests strip the plant', () => {
  const sites = map(), world = ecoWorld(sites, { species: { grazer, hunter: { ...hunter, hungry: 90, full: 90, gain: 30, catch: 1, ambush: 1e6 } } });
  let withHunters = 0, without = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const a = createEcosystem(world, { seed, founders: founders(10, 5) }), b = createEcosystem(world, { seed, founders: founders(10) });
    run(a, world, 300); run(b, world, 300); withHunters += a.counts.grazer; without += b.counts.grazer;
  }
  assert.ok(without > withHunters * 1.2, `${without} vs ${withHunters}`);
  const bare = createEcosystem(world, { seed: 2, founders: founders(6) });
  assert.equal(dimmed(bare, world), 0);
  for (const c of bare.pop.slice()) removeCreature(bare, c);
  run(bare, world, 240);
  assert.ok(dimmed(bare, world) >= .75, `stripped: ${dimmed(bare, world)}`);
  assert.ok(bare.pests[0] > .3);
});

test('a hundred creatures cost next to nothing', () => {
  const big = Array.from({ length: 24 }, (_, i) => i % 3 ? patch(i * 3, (i % 5) * 7) : roost(i * 3, (i % 5) * 7)), world = ecoWorld(big, { species: { grazer: { ...grazer, cap: 100 }, hunter: { ...hunter, cap: 20 } } });
  const eco = createEcosystem(world, { seed: 4, founders: Array.from({ length: 100 }, (_, i) => ({ sp: i % 8 ? 'grazer' : 'hunter', at: 3 * (i % 8) })), pests: .8 });
  const t0 = performance.now(); run(eco, world, 200); const ms = (performance.now() - t0) / 200;
  assert.ok(ms < 2, `${ms.toFixed(3)} ms a step`);
});
