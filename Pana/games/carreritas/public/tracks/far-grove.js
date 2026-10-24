// Map-local, imported by the lazily loaded maps that use it so the impostor
// baker stays out of Carreritas' first load.
import { instancePlacements } from '/engine/models/core/static-batch.js';
import { impostorPlacements, IMPOSTOR_FROM } from '/engine/models/core/impostor.js';

// Trees past `from` metres of the route are baked billboards of the same
// model (impostor.js). `make` builds a fresh prototype for each half.
export function farGrove(T,parent,make,placements,name,cellSize=110,from=IMPOSTOR_FROM) {
  const near=[],far=[];
  for(const p of placements)(T.roadDistance(p.x,p.z)>=from?far:near).push(p);
  if(near.length)instancePlacements(parent,make(),near,{name,cellSize});
  if(far.length)impostorPlacements(parent,make(),far,{name:`${name}-impostor`,cellSize:Math.max(cellSize,240)});
}
