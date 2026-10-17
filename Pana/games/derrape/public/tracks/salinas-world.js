import { THREE, terrain, put, finish, instances, scatter, clear } from './world-kit.js';
import { waterGrid } from './water-world-kit.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { baseHeight, PONDS, WATER_Y, channelSample, pondField } from './salinas-layout.js';
import { pondAt } from './water-world-math.js';
import { saltPile, sluiceGate } from '/engine/models/props/saltworks.js';
import { landingShelter } from '/engine/models/props/delta.js';
import { fishCrates } from '/engine/models/props/coastal.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { agave } from '/engine/models/vegetation/agave.js';
export function salinasWorld(T) {
  const group=new THREE.Group(),world=terrain(T,{bounds:[-600,-450,600,500],base:baseHeight,step:4,
    cut:(x,z,h)=>channelSample(x,z).distance<3?Math.min(h,-.4):h,
    color:(x,z,y)=>y<.8?0xc5bfae:0xdedbce});
  group.add(world.land);
  for(const [i,p]of PONDS.entries())group.add(waterGrid(T,world,{
    bounds:[p.x-p.rx*1.1,p.z-p.rz*1.1,p.x+p.rx*1.1,p.z+p.rz*1.1],step:3,
    sample:(x,z)=>({height:WATER_Y,visible:pondAt(p,x,z)<1.04,along:z}),color:p.color,name:`salt-pond-${i}`,
  }));
  group.add(waterGrid(T,world,{bounds:[-240,-170,590,460],step:3,sample:(x,z)=>({height:WATER_Y,along:channelSample(x,z).along,
    visible:pondField(x,z)>1.015&&channelSample(x,z).distance<8}),color:0x65bcb9,name:'salinas-sluice-channels'}));
  const works=new THREE.Group();let piles=0,gates=0,shelters=0;
  for(const [x,z]of [[-205,-125],[-180,-130],[-150,-145],[-280,270],[-250,280],[-220,290],[-30,330],[0,350],[35,360]])if(clear(T,x,z,10)){
    put(works,saltPile({seed:590+piles,radius:6+(piles%3),height:3.5+(piles%2)}),x,z,world.groundAt(x,z));piles++;
  }
  for(const [x,z,h]of [[25,-100,Math.PI/2],[180,28,0],[320,150,Math.PI/2]])if(clear(T,x,z,6)){
    put(works,sluiceGate({width:7,height:3}),x,z,-.4,h);gates++;
  }
  for(const [x,z,h]of [[-235,-100,.3],[-200,280,-.6],[-150,290,-.3],[-15,345,0]])if(clear(T,x,z,14)){
    put(works,landingShelter({width:10,depth:10,deck:.25,height:4,color:0xa27c65}),x,z,world.groundAt(x,z),h);
    for(let i=0;i<3;i++)put(works,fishCrates(),x-3+i*2.3,z+2,world.groundAt(x,z)+.4,h);shelters++;
  }
  group.add(finish(works));
  instances(group,palm({seed:59,h:9}),scatter(T,world.groundAt,{seed:591,count:35,bounds:[-480,-330,480,390],margin:12,
    accept:(x,z)=>pondField(x,z)>1.3&&channelSample(x,z).distance>18}),'salinas-coastal-palms',120);
  instances(group,agave({seed:4}),scatter(T,world.groundAt,{seed:592,count:65,bounds:[-480,-330,480,390],margin:5,
    accept:(x,z)=>pondField(x,z)>1.3&&channelSample(x,z).distance>12}),'salinas-dry-banks',120);
  group.userData.assetCounts={saltPile:piles,sluiceGate:gates,landingShelter:shelters};
  return {group,groundAt:world.groundAt,update:waterAnimator(group)};
}
