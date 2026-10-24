import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedCellLayout } from '../public/piece-layout.js';

test('shared cells fit up to sixteen distinct pawns without overlapping bases', () => {
  assert.deepEqual(sharedCellLayout(1, 0), { x: 0, z: 0, scale: 1 });
  for (let count = 2; count <= 16; count++) {
    const positions = Array.from({ length: count }, (_, i) => sharedCellLayout(count, i));
    for (const [i, p] of positions.entries()) {
      const radius = .155 * p.scale * 1.1; // Includes the playable pulse.
      assert(Math.abs(p.x) + radius < .17 && Math.abs(p.z) + radius < .17, `all ${count} stay in their cell`);
      for (const q of positions.slice(i + 1)) assert(Math.hypot(p.x - q.x, p.z - q.z) > radius * 2, 'pawn bases remain separate');
    }
  }
});
