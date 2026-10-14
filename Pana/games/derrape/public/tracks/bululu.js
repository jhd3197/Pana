// Bululú geography at racing scale: coast, river crossings and inland turns.
import * as THREE from 'three';
import { buildIsland, baseHeight } from '/engine/island-terrain.js';
import { createIslandEnvironment } from '/engine/island-environment.js';

const LAND = 3.2, HEIGHT = 1.7;
const ROUTE = [[28,94],[0,97],[-35,90],[-72,74],[-99,45],[-102,14],[-86,-12],
  [-63,-32],[-40,-30],[-24,-12],[-45,6],[-66,26],[-51,43],[-23,43],
  [7,23],[29,-4],[35,-27],[65,-20],[89,8],[105,39],[86,68],[58,84]];

export default {
  id: 'bululu', name: 'Isla Bululú',
  blurb: 'Una isla entera: costa larga, curvas del río, selva y regreso por el puerto.',
  points: ROUTE.map(([x,z])=>[x*LAND,z*LAND]),
  rounded: true,
  hw: 9, lineU: 0.035,
  elevation: (x,z) => baseHeight(x/LAND,z/LAND)*HEIGHT + 0.3,
  sectors: [[0,'Playa Cocotero'],[0.2,'Costa del río'],[0.36,'Quebrada del mango'],
    [0.55,'Selva adentro'],[0.73,'Puerto de los panas']],
  items: { boxes: [0.1,0.28,0.46,0.65,0.86], boxLanes: [-6,-2,2,6],
    pads: [{u:0.17,off:0},{u:0.38,off:-4},{u:0.6,off:4},{u:0.8,off:0},{u:0.95,off:-4}] },
  walls: true,
  palette: { horizon:0xb7e2e7,skyTop:0x64bde9,hemiSky:0xe5f5ff,
    hemiGround:0x829b55,hemiInt:1.8,sun:0xffedc2,sunInt:2.6,
    ground:0x63b453,track:0xd9b77a,dune:0,fog:[150,650] },
  environment(T) {
    const group=new THREE.Group();
    // Work in the shared island's coordinates; the road itself stays 18 m wide.
    const island=buildIsland([],[],{road:(x,z)=>({
      d:Math.abs(T.offsetOf(x*LAND,z*LAND))/LAND,
      h:T.surfaceAt(x*LAND,z*LAND)/HEIGHT,width:(T.HW+5)/LAND,shoulder:12/LAND,
    })});
    group.add(island.group);
    const environment=createIslandEnvironment(group,{island,layoutScale:LAND,heightScale:HEIGHT,
      clearance:(x,z,r)=>Math.abs(T.offsetOf(x*LAND,z*LAND))>T.HW+r*LAND+4});
    group.scale.set(LAND,HEIGHT,LAND);
    return {group,groundAt:(x,z)=>island.groundAt(x/LAND,z/LAND)*HEIGHT,update:environment.update};
  },
  scenery(group,kit,T) {
    const trees=new THREE.Group();
    for(const p of kit.scatter(T,{seed:247,count:220,min:T.HW+10,max:T.HW+48})) {
      if(T.terrainAt(p.x,p.z)<0.5) continue;
      kit.at(trees,p.z>190?kit.palm({h:8+p.k*5,seed:Math.floor(p.s)}):
        kit.ceiba({h:9+p.k*5,seed:Math.floor(p.s)}),p,p.rot);
    }
    // Short wooden causeways make the river crossings legible while the
    // continuous road remains the collision surface.
    for (let s=0;s<T.TOTAL;s+=2.6) {
      const p=kit.placeOnTrack(T,s);
      if(p.y-T.terrainAt(p.x,p.z)<0.7) continue;
      kit.flankBridge(trees,T,s,s+2.6);
    }
    group.add(kit.bake(trees, { cellSize: 100 }));
  },
};
