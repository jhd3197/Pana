import * as THREE from 'three';
import { rng } from '/engine/random.js';
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { mountainPine } from '/engine/models/vegetation/mountain-pine.js';
import { forestZone, prepareForestModel, denseForest } from '/engine/worlds/coastal/forest-detail.js';

// Dense silhouettes belong in natural surroundings, not inside towns, caves,
// salt pans or the desert. Near-road vegetation remains authored per map.
const HABITATS = { chichi: 800, selva: 650, paramo: 240, llanos: 260, bululu: 260, delta: 500, salto: 450 };
export function backgroundForest(T) {
  // A map with its own recipe plants dense zoned library forest instead
  // (library-forest.js, imported by the map's lazily loaded module).
  if (T.def.forest) return T.def.forest.plant(T, T.def.forest);
  const group = new THREE.Group(); group.name = 'background-forest';
  const count = HABITATS[T.id];
  if (!count) return group;
  const random = rng(7429), placements = [];
  for (let attempt = 0; attempt < count * 12 && placements.length < count; attempt++) {
    const x = (random() * 2 - 1) * (T.bounds.x + 50), z = (random() * 2 - 1) * (T.bounds.z + 50);
    const distance = T.roadDistance(x,z), y = T.terrainAt(x,z);
    if (distance < 85 || distance > 210 || y < 2 || !Number.isFinite(y)) continue;
    if (T.def.waterAt?.(x,z,0,T) > .01) continue;
    if (Math.abs(T.terrainAt(x+3,z)-T.terrainAt(x-3,z)) > 7) continue;
    // Reject isolated landmarks and steep water/terrain edges.
    if (Math.abs(T.terrainAt(x,z+3)-T.terrainAt(x,z-3)) > 7) continue;
    if (placements.some(p => Math.hypot(x-p.x,z-p.z) < 7)) continue;
    placements.push({x,z,y:y-.1,rot:random()*Math.PI*2,scale:.9+random()*.6,zone:forestZone(distance)});
  }
  const pine=T.id==='paramo', fronds=['bululu','delta','llanos'].includes(T.id), zones={near:0,middle:0,far:0};
  const dense=denseForest(placements);
  for(const zone of ['middle','far']) for(const crowded of zone==='far'&&!pine&&!fronds?[true,false]:[false]) {
    const points=placements.filter(p=>p.zone===zone&&(zone!=='far'||pine||fronds||dense.has(p)===crowded));zones[zone]+=points.length;
    if(!points.length)continue;
    const source = pine ? mountainPine({seed:17,h:8})
      : fronds ? palm({seed:17,detail:'far',fruit:false})
      : mangoTree({seed:17,h:6,detail:'far',fruit:false});
    prepareForestModel(source,zone,{pine,fronds,dense:crowded});
    instancePlacements(group,source,points,{name:`mountain-canopy-${zone}`,cellSize:180,castShadow:false});
  }
  group.userData.treeCount = placements.length;
  group.userData.forestZones = zones;
  return group;
}
