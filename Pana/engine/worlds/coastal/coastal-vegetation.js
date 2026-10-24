import { instancePlacements } from '/engine/models/core/static-batch.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { cacao } from '/engine/models/vegetation/selva-trees.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { treeFern } from '/engine/models/vegetation/selva-palms.js';
import { pine } from '/engine/models/vegetation/pine.js';
import { mountainPine } from '/engine/models/vegetation/mountain-pine.js';
import { moriche } from '/engine/models/vegetation/moriche.js';
import { cactus } from '/engine/models/vegetation/cactus.js';
import { mangrove } from '/engine/models/vegetation/mangrove.js';
import { saman } from '/engine/models/vegetation/saman.js';
import { araguaney } from '/engine/models/vegetation/araguaney.js';
import { frailejon } from '/engine/models/vegetation/frailejon.js';
import { forestZone, prepareForestModel, denseForest, forestQuality } from './forest-detail.js';

// Preserve the reference planting zones, but use Pana's native silhouettes.
// Mountain canopy has neither fruit nor individual leaves; road trees do.
// `whole` lists species whose own far model is used unsimplified (thin cardones
// otherwise cluster away to nothing).
export function coastalVegetation(group, worldScale = 1, roadDistance, { cellSize = 120, whole = [] } = {}) {
  const batches = new Map();
  const factories = { tree: ceiba, mango: mangoTree, cacao, palm, fern: treeFern,
    pine: o => pine({ ...o, h: 9 }), fir: o => mountainPine({ seed: o.seed, h: 8 }), moriche, mangrove, cactus: o => cactus({ seed: o.seed }),
    saman: o => saman({ seed: o.seed, detail: o.detail, flowers: o.fruit }),
    araguaney: o => araguaney({ seed: o.seed, detail: o.detail, flowers: true }),
    frailejon: o => frailejon({ seed: o.seed, h: 2.3 }) };
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
      forestQuality(group, (tier, detail) => {
        for (const [key, positions] of batches) {
          const [species, zone] = key.split(':');
          const fronds=species==='palm'||species==='fern'||species==='moriche'||species==='cactus'||species==='frailejon', conifer=species==='pine'||species==='fir';
          for(const crowded of zone==='far'&&!fronds&&!conifer?[true,false]:[false]) {
            const points=zone==='far'&&!fronds&&!conifer?positions.filter(p=>dense.has(p)===crowded):positions;
            if(!points.length)continue;
            const effective = detail === 0 ? 'far' : detail === 1 && zone === 'near' ? 'middle' : zone;
            const model = factories[species]({ seed: 37, detail: effective === 'near' ? 'game' : 'far', fruit: effective === 'near' });
            // A moriche is a bare pole once its few long fronds are clustered away.
            prepareForestModel(model, species==='moriche'||whole.includes(species)?'near':effective, { fronds,pine:conifer,dense:crowded });
            instancePlacements(tier, model, points, { name: `coastal-${key}`, cellSize: detail === 0 ? Math.max(cellSize,240/worldScale) : cellSize, castShadow: zone === 'near' });
          }
        }
      });
      group.userData.libraryTrees = count;
      group.userData.forestZones = zones;
    },
  };
}
