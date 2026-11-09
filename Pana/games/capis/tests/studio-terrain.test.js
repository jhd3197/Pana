// Reference hashes from the original studio's embedded modules, before porting.
// Source SHA-256: 2f6b1ed84d0e75d02058c7ca0acf81d6c0036d2938f9b630a84d955408d6bdcd
// Regenerate only when the author explicitly supplies revised map designs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { generateTepuyMap, tepuyFigure, TEPUY_FIGURES } from '../public/tepuy-maps.js';

const references = JSON.parse(readFileSync(new URL('./studio-terrain.json', import.meta.url), 'utf8'));
const hash = cells => createHash('sha256').update(cells).digest('hex');

test('all 29 authored studio presets retain their terrain and hollows at every size', () => {
  assert.equal(TEPUY_FIGURES.length, 29);
  assert.equal(references.length, 87);
  for (const ref of references) {
    const f = tepuyFigure(ref.id);
    assert.ok(f, ref.id);
    const { mask } = generateTepuyMap(f.seed, ref.size, f.style, { ...f.shape, ...(f.ruins ? { ruins: f.ruins } : {}) });
    assert.equal(hash(mask.solid), ref.solid, `${ref.id}/${ref.size}: authored solid cells changed`);
    assert.equal(hash(mask.hollow), ref.hollow, `${ref.id}/${ref.size}: authored hollow cells changed`);
  }
});
