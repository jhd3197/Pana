import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOAT_DEFINITIONS, AIR_DEFINITIONS, VESSEL_SLOTS, VESSEL_PARTS,
  vesselById, vesselPartById, cleanVesselParts, vesselPartsProfile, vesselTune, kitTunes, vesselNivel,
} from '../public/parts.js';
import { CAR_DEFINITIONS } from '../public/car-definitions.js';
import { wheelById } from '../public/wheel-definitions.js';
import { bandOf } from '../public/parts.js';

const KINDS = { boat: BOAT_DEFINITIONS, air: AIR_DEFINITIONS };

test('every vessel body has a sane tune and the first one is free', () => {
  for (const [kind, defs] of Object.entries(KINDS)) {
    assert.equal(defs[0].cost, 0, `${kind} stock is free`);
    for (const def of defs) {
      for (const field of ['top', 'accel', 'turn', 'mass', 'grip']) assert.ok(Number.isFinite(def.tune[field]), `${def.id}.${field}`);
      assert.ok(def.name && def.blurb, `${def.id} has name and blurb`);
    }
  }
});

test('no part is a free improvement: every profile trades something', () => {
  for (const [kind, slots] of Object.entries(VESSEL_SLOTS)) {
    for (const { id: slot } of slots) {
      for (const part of VESSEL_PARTS[kind][slot]) {
        const entries = Object.entries(part.profile);
        if (part.id === 'fabrica') { assert.equal(entries.length, 0); continue; }
        assert.ok(part.cost > 0, `${slot}:${part.id} costs`);
        const gains = entries.filter(([f, v]) => f !== 'mass' && v > 1).length;
        const losses = entries.filter(([f, v]) => (f === 'mass' ? v > 1 : v < 1)).length;
        assert.ok(gains > 0, `${slot}:${part.id} improves something`);
        assert.ok(losses > 0, `${slot}:${part.id} gives something up`);
        for (const [f, v] of entries) assert.ok(Math.abs(v - 1) <= 0.1, `${slot}:${part.id}.${f} within ±10%`);
      }
    }
  }
});

test('cleanVesselParts drops unknown slots, ids and stock', () => {
  assert.deepEqual(cleanVesselParts('boat', { casco: 'fibra', helice: 'fabrica', motor: 'turbo', casco2: 'x' }), { casco: 'fibra' });
  assert.deepEqual(cleanVesselParts('air', { alas: 'largas' }), { alas: 'largas' });
  assert.deepEqual(cleanVesselParts('boat', 'not json'), {});
  assert.deepEqual(cleanVesselParts('boat', null), {});
});

test('vesselTune composes body and parts; unknown ids fall back to stock', () => {
  const stock = vesselTune('boat', 'penero');
  const tuned = vesselTune('boat', 'penero', { fueraborda: 'cuarenta' });
  assert.ok(tuned.top > stock.top && tuned.mass > stock.mass);
  assert.equal(vesselById('boat', 'nope').id, 'penero');
  assert.equal(vesselPartById('air', 'aspas', 'nope'), null);
  assert.equal(vesselTune('air', 'nope').top, vesselTune('air', 'zamuro').top);
});

test('kitTunes carries the three pieces and they differ by build', () => {
  const tunes = kitTunes({ boat: 'rayo', air: 'turpial', parts: {} }, CAR_DEFINITIONS[0], wheelById('calle'));
  assert.ok(tunes.boat.top > tunes.car.top === false || tunes.boat.top !== tunes.car.top);
  assert.ok(tunes.plane.turn > tunes.car.turn, 'turpial turns tighter than the stock car');
  assert.notEqual(tunes.car.top, tunes.boat.top);
});

test('vessel nivels land inside the bands and parts raise them', () => {
  for (const kind of ['boat', 'air']) {
    for (const def of KINDS[kind]) {
      const pi = vesselNivel(kind, def.id);
      assert.ok(pi >= 100 && pi <= 788, `${def.id} nivel ${pi} in range`);
      assert.ok(['D', 'C', 'B', 'A', 'S'].includes(bandOf(pi).letter));
    }
  }
  assert.ok(vesselNivel('boat', 'penero', { fueraborda: 'cuarenta' }) > vesselNivel('boat', 'penero'));
});
