import { instancePlacements } from '/engine/models/core/static-batch.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { cacao } from '/engine/models/vegetation/selva-trees.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { treeFern } from '/engine/models/vegetation/selva-palms.js';
import { forestZone, prepareForestModel, denseForest } from './forest-detail.js';

// Preserve the reference planting zones, but use Pana's native silhouettes.
// Mountain canopy has neither fruit nor individual leaves; road trees do.
export function coastalVegetation(group, worldScale = 1, roadDistance) {
  const batches = new Map();
  const factories = { tree: ceiba, mango: mangoTree, cacao, palm, fern: treeFern };
  let count = 0;
  const zones = { near: 0, middle: 0, far: 0 };
  return {
    add(species, x, z, y, scale = 1, distance = 100) {
      if (distance < 12 || !Number.isFinite(y)) return;
      // The reference terrain raster caps distance at 44 m. Use the runtime's
      // uncapped route distance for the hills, preserving the near-road band.
      const worldDistance=distance<=22?distance*worldScale:Math.max(distance*worldScale,roadDistance?.(x,z)??0);
      const zone = forestZone(worldDistance,8 * worldScale), key = `${species}:${zone}`;
      zones[zone]++;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push({ x, z, y: y - .12, scale, rot: (x * 17.1 + z * 9.7) % (Math.PI * 2) });
      count++;
    },
    flush() {
      const dense=denseForest([...batches.values()].flat(),20/worldScale);
      for (const [key, positions] of batches) {
        const [species, zone] = key.split(':');
        const fronds=species==='palm'||species==='fern';
        for(const crowded of zone==='far'&&!fronds?[true,false]:[false]) {
          const points=zone==='far'&&!fronds?positions.filter(p=>dense.has(p)===crowded):positions;
          if(!points.length)continue;
          const model = factories[species]({ seed: 37, detail: zone === 'near' ? 'game' : 'far', fruit: zone === 'near' });
          prepareForestModel(model, zone, { fronds,dense:crowded });
          instancePlacements(group, model, points, { name: `coastal-${key}`, cellSize: 120, castShadow: zone === 'near' });
        }
      }
      group.userData.libraryTrees = count;
      group.userData.forestZones = zones;
    },
  };
}
