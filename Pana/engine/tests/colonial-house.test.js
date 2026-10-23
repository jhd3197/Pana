import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHouseSpec, readHouseSpec, rerollHouse, createHouseBatch, readHouseBatch, saveHouseBatch } from '../models/props/colonial-house-spec.js';
import { HOUSE_FAMILIES } from '../models/props/colonial-house-definitions.js';

test('colonial recipes reproduce across JSON and keep valid facade spacing', () => {
  for (const family of HOUSE_FAMILIES) for (let seed = 0; seed < 60; seed++) {
    const options = { seed, family: family.id, width: family.id === 'casa-larga' ? 9 + seed % 4 : 5.8 + seed % 7, floors: family.floors[seed % family.floors.length] };
    const spec = createHouseSpec(options);
    assert.deepEqual(createHouseSpec(options), spec);
    assert.deepEqual(readHouseSpec(JSON.parse(JSON.stringify(spec))), spec);
    for (const face of spec.faces) for (let floor = 0; floor < spec.floors; floor++) {
      const openings = face.openings.filter(o => o.floor === floor);
      for (let i = 0; i < openings.length; i++) {
        const o = openings[i];
        assert.ok(o.x - o.width / 2 - 0.22 >= -face.span / 2 + 0.23);
        assert.ok(o.x + o.width / 2 + 0.22 <= face.span / 2 - 0.23);
        assert.ok(o.bottom + o.height + 0.2 < spec.base + (floor + 1) * spec.floorHeight);
        if (i) assert.ok(o.x - o.width / 2 - (openings[i - 1].x + openings[i - 1].width / 2) > 0.44);
      }
    }
  }
});

test('plant rerolls and color changes leave the architecture fixed', () => {
  const a = createHouseSpec({ seed: 7, family: 'casa-balcon' });
  const b = createHouseSpec({ ...a.inputs, planting: 'flores', plantSeed: 93, palette: 'crema' });
  assert.deepEqual(a.faces, b.faces); assert.deepEqual(a.footprint, b.footprint);
  const c = rerollHouse(a, 32, { structure: true, palette: true });
  assert.deepEqual(c.faces, a.faces); assert.equal(c.palette, a.palette);
  for (const key of ['roof', 'layout', 'windowStyle']) assert.equal(c[key], a[key]);
  const d = rerollHouse(a, 32, { planting: true });
  assert.equal(d.plantSeed, a.plantSeed); assert.equal(d.planting, a.planting);
});

test('party walls omit openings and supported families validate before rendering', () => {
  const spec = createHouseSpec({ partyWalls: ['right', 'rear', 'right'] });
  assert.deepEqual(spec.partyWalls, ['rear', 'right']);
  assert.ok(spec.faces.filter(f => ['right', 'rear'].includes(f.id)).every(f => !f.openings.length));
  for (const options of [{ seed: -1 }, { seed: 0.5 }, { width: NaN }, { depth: Infinity }, { width: 4 }, { family: 'nope' }, { family: 'casa-balcon', floors: 1 }, { family: 'casa-portal', floors: 2 }, { palette: 'red' }, { planting: 'random' }, { partyWalls: ['front'] }, { plantSeed: -3 }]) assert.throws(() => createHouseSpec(options), RangeError);
  assert.throws(() => readHouseSpec({ ...spec, version: 999 }), RangeError);
  assert.throws(() => readHouseSpec({ ...spec, width: 12 }), RangeError);
});

test('fifty-house batch covers distinct architecture and migrates original recipes', () => {
  const batch = createHouseBatch(103);
  assert.equal(batch.length, 50); assert.deepEqual(batch, createHouseBatch(103));
  assert.equal(new Set(batch.map(s => JSON.stringify([s.family, s.windowStyle, s.roof, s.layout, s.floors, s.width, s.depth]))).size, 50);
  assert.equal(new Set(batch.map(s => s.windowStyle)).size, 6);
  assert.equal(new Set(batch.map(s => s.roof)).size, 3);
  assert.equal(new Set(batch.map(s => JSON.stringify([s.family, s.windowStyle, s.roof, s.layout, s.floors]))).size, 50);
  assert.deepEqual(readHouseBatch(JSON.parse(JSON.stringify(saveHouseBatch(batch)))), batch);
  for (const seed of [-1, 0.1, NaN, 0x100000000]) assert.throws(() => createHouseBatch(seed), RangeError);
  for (const count of [0, 51, 3.1]) assert.throws(() => createHouseBatch(1, count), RangeError);
  for (const input of [{ roof: 'flat' }, { windowStyle: 'glass' }, { layout: 'random' }]) assert.throws(() => createHouseSpec(input), RangeError);
  assert.throws(() => readHouseBatch({ type: 'colonial-house-batch', version: 2, houses: Array(51).fill(batch[0]) }), RangeError);
  assert.throws(() => readHouseBatch({ type: 'colonial-house-batch', version: 2, houses: [{ ...batch[0], width: 100 }] }), RangeError);
  const migrated = readHouseSpec({ version: 1, inputs: { seed: 22, family: 'casa-balcon', width: 7.2, depth: 5.8, floors: 2 } });
  assert.equal(migrated.windowStyle, 'reja'); assert.equal(migrated.roof, 'tejas');
});

test('wall finishes preserve architecture, locks and saved version-two houses', () => {
  const original = JSON.parse(readFileSync(new URL('./fixtures/colonial-house-v2.json', import.meta.url), 'utf8'));
  const migrated = readHouseSpec(original);
  assert.equal(migrated.version, 3); assert.equal(migrated.wallFinish, 'lisa');
  assert.deepEqual(migrated.faces, original.faces); assert.deepEqual(migrated.envelope, original.envelope);
  assert.deepEqual(readHouseBatch({ type: 'colonial-house-batch', version: 2, houses: [original] }), [migrated]);
  assert.throws(() => readHouseSpec({ ...original, width: 100 }), RangeError);
  const painted = createHouseSpec({ ...migrated.inputs, wallFinish: 'ladrillo-visto', finishSeed: 39 });
  assert.deepEqual(painted.faces, migrated.faces); assert.deepEqual(painted.envelope, migrated.envelope);
  assert.deepEqual(painted.entrance, migrated.entrance); assert.equal(painted.plantSeed, migrated.plantSeed);
  assert.deepEqual(readHouseSpec(JSON.parse(JSON.stringify(painted))), painted);
  const locked = rerollHouse(painted, 12, { finish: true });
  assert.equal(locked.wallFinish, painted.wallFinish); assert.equal(locked.finishSeed, painted.finishSeed);
  const unlocked = rerollHouse(painted, 12, { structure: true });
  assert.deepEqual(unlocked.faces, painted.faces); assert.equal(unlocked.finishSeed, 12);
  assert.equal(new Set(createHouseBatch(103).map(s => s.wallFinish)).size, 4);
  for (const options of [{ wallFinish: 'stone' }, { finishSeed: -1 }, { finishSeed: 1.3 }, { finishSeed: 0x100000000 }]) assert.throws(() => createHouseSpec(options), RangeError);
});

// Every street house in every map comes from the one house maker
// (colonial-house.js), so its windows, roofs and wall finishes reach them
// all. A map that hand-builds a house misses every later improvement.
test('street houses build through the colonial house maker', () => {
  const root = new URL('../../', import.meta.url);
  const body = (file, name) => {
    const source = readFileSync(new URL(file, root), 'utf8'), start = source.indexOf(`export function ${name}(`);
    assert.ok(start >= 0, `${file} exports ${name}`);
    const end = source.indexOf('\nexport function', start + 1);
    return source.slice(start, end < 0 ? undefined : end);
  };
  for (const [file, name] of [
    ['engine/models/props/plaza-buildings.js', 'house'],
    ['engine/models/props/pueblo.js', 'colonialHouse'],
    ['games/carreritas/public/tracks/world-landmarks.js', 'canalVilla'],
  ]) {
    const code = body(file, name);
    assert.match(code, /\b(colonialHouse|recipeHouse)\(/, `${file} ${name}() uses the house maker`);
    assert.doesNotMatch(code, /\b(box|shutterWindow|tiledRoof)\(/, `${file} ${name}() builds no walls of its own`);
  }
  // Hand-built windows are for buildings that are not street houses.
  const OTHER_BUILDINGS = new Set(['engine/models/core/architecture-kit.js', 'engine/models/props/mountain.js',
    'engine/models/props/ranch.js', 'engine/models/props/thermal.js']);
  const walk = dir => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? (e.name === 'tests' || e.name === 'node_modules' ? [] : walk(`${dir}${e.name}/`)) : e.name.endsWith('.js') ? [`${dir}${e.name}`] : []);
  const strays = [...walk('engine/'), ...walk('games/')].filter(f => !OTHER_BUILDINGS.has(f)
    && /\bshutterWindow\(/.test(readFileSync(new URL(f, root), 'utf8')));
  assert.deepEqual(strays, [], 'a street house with hand-built shutters: use colonialHouse() instead');
});
