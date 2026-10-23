import * as THREE from 'three';
import { coastalTrack } from './coastal-track.js';

// Reference scenes own their GPU resources, but never a renderer or game loop.
export function ownReferenceWorld(group, groundAt, update, createdTextures = []) {
  const materials = new Set(), textures = new Set(createdTextures), lights = [];
  group.traverse(o => {
    if (o.isLight) lights.push(o);
    for (const m of [].concat(o.material || [])) {
      materials.add(m);
      for (const value of Object.values(m)) if (value?.isTexture) textures.add(value);
      for (const u of Object.values(m.uniforms || {})) if (u.value?.isTexture) textures.add(u.value);
    }
  });
  lights.forEach(o => { o.shadow?.dispose(); o.removeFromParent(); });
  group.userData.dispose = () => {
    textures.forEach(t => t.dispose());
    materials.forEach(m => m.dispose());
  };
  return { group, groundAt, update };
}

export function referenceTrack(id, layout, world, options) {
  const { RP, roadY, i0, NR } = layout, scale = options.scale;
  // Reserve a full terrain cell around every lane, including slipway endpoints
  // omitted by the reference's land-only distance raster.
  if (layout.HGT) {
    const { HGT, hwA, CELL, GN, X0, Z0, roadFrame, bank } = layout;
    for (let i = 0; i < NR; i++) {
      const f = roadFrame(i), radius = hwA[i] + CELL * 1.5;
      const cx = Math.round((f.p.x-X0)/CELL), cz = Math.round((f.p.z-Z0)/CELL), cells = Math.ceil(radius/CELL);
      for (let iz = Math.max(0,cz-cells); iz <= Math.min(GN-1,cz+cells); iz++) {
        for (let ix = Math.max(0,cx-cells); ix <= Math.min(GN-1,cx+cells); ix++) {
          const dx = X0+ix*CELL-f.p.x, dz = Z0+iz*CELL-f.p.z;
          if (Math.hypot(dx,dz) > radius) continue;
          const v = iz*GN+ix, off = dx*f.n.x+dz*f.n.z;
          HGT[v] = Math.min(HGT[v], roadY[i]+bank[i]*off-.4);
        }
      }
    }
  }
  const bounds = new THREE.Box3().setFromPoints(RP);
  const def = coastalTrack(id, layout, (group, data, roadDistance) => world(group, data, roadDistance, scale), {
    ...options,
    previewBounds: [[bounds.min.x * scale - 70, bounds.min.y - 30, bounds.min.z * scale - 70],
      [bounds.max.x * scale + 70, bounds.max.y + 100, bounds.max.z * scale + 70]],
    def: { layered: true },
  });
  // Place the actual grid at the reference's starting plaza, by horizontal distance.
  let total = 0, start = 0;
  for (let i = 0; i < NR; i++) {
    if (i === i0) start = total;
    const a = RP[i], b = RP[(i + 1) % NR];
    total += Math.hypot(b.x - a.x, b.z - a.z);
  }
  def.lineU = start / total;
  if (id === 'merida') {
    const lengths = [0];
    for (let i = 1; i < NR; i++) lengths.push(lengths[i-1] + Math.hypot(RP[i].x-RP[i-1].x, RP[i].z-RP[i-1].z));
    def.transformGates = [{ from: lengths[layout.w0] / total, to: lengths[layout.w1] / total }];
  }
  def.referenceLayout = layout;
  // Height hints distinguish the decks of the spirals, including banked edges.
  def.points = RP.filter((_, i) => i % 4 === 0).map((p, j) => [p.x * scale, p.z * scale, roadY[j * 4]]);
  return def;
}
