import * as THREE from 'three';
import { M, box } from '../core/primitives.js';
import { paintFinish } from '../core/architecture-kit.js';
import { HOUSE_PALETTES } from './colonial-house-definitions.js';
import { createHouseSpec, readHouseSpec } from './colonial-house-spec.js';
import { facade, roof, balcony, crest, lantern, timber } from './colonial-house-parts.js';
import { plantHouse } from './house-garden.js';

// The new recipe path is opt-in; pueblo.js retains its established legacy default.
export function colonialHouse({ spec, detail = 'game', ...options } = {}) {
  if (!['game', 'low'].includes(detail)) throw new RangeError('detail: game, low');
  spec = spec ? readHouseSpec(spec) : createHouseSpec(options);
  const group = new THREE.Group(), colors = HOUSE_PALETTES.find(p => p.id === spec.palette);
  const { width: w, depth: d, base, floorHeight: h } = spec;
  group.add(box(w, base, d, M(colors.trim), 0, base / 2, 0));
  for (const face of spec.faces) facade(group, face, spec, colors, detail);
  group.add(box(w - 0.3, 0.08, d - 0.3, M(colors.trim), 0, base + spec.floors * h - 0.04, 0));
  roof(group, spec, colors, detail);
  if (spec.balcony) balcony(group, spec);
  if (spec.crest) crest(group, spec, colors);
  if (spec.porch) {
    for (const x of [-w / 2 + 0.17, w / 2 - 0.17]) {
      group.add(box(0.3, 0.48, 0.3, M(colors.trim), x, base + 0.24, d / 2 - 0.1));
      group.add(box(0.17, h - 0.48, 0.17, timber, x, base + 0.48 + (h - 0.48) / 2, d / 2 - 0.1));
    }
    group.add(box(w, 0.18, 0.21, timber, 0, base + h - 0.13, d / 2 - 0.1));
  }
  const door = spec.openings.find(o => o.face === 'front' && o.floor === 0 && o.kind === 'door');
  group.add(box(1.95, 0.09, 0.64, M(colors.trim), door.x, 0.045, d / 2 + 0.25), box(1.72, 0.09, 0.38, M(colors.trim), door.x, 0.135, d / 2 + 0.12));
  // Use the gap between openings instead of attaching a lamp over a grille.
  const front = spec.faces[0], candidates = front.openings.filter(o => o.floor === 0);
  const lampX = candidates.length > 1 ? (candidates[0].x + candidates[1].x) / 2 : 0;
  lantern(group, lampX, base + h * 0.66, front.position[2] + 0.04);
  if (spec.balcony) lantern(group, 0, base + h * 1.69, d / 2 + 0.04);
  plantHouse(group, spec, detail);
  const out = paintFinish(group, 'colonialHouse');
  out.userData.houseSpec = spec;
  out.userData.footprint = spec.footprint;
  out.userData.entrance = spec.entrance;
  out.userData.detail = detail;
  return out;
}
