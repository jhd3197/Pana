import { THREE, terrain, put, finish, instances, scatter, clear, foundation } from './world-kit.js';
import { waterGrid } from './water-world-kit.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { baseHeight, PONDS, WATER_Y, channelSample, pondField, CAVE, CAVE_PROFILE } from './salinas-layout.js';
import { saltCave, caveMountain, caveColor, caveFog } from './salt-cave.js';
import { pondAt } from './water-world-math.js';
import { saltPile, sluiceGate } from '/engine/models/props/saltworks.js';
import { landingShelter } from '/engine/models/props/delta.js';
import { fishCrates } from '/engine/models/props/coastal.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { agave } from '/engine/models/vegetation/agave.js';
import { saltHarvester } from '/engine/models/props/salt-harvester.js';
import { saltBoardwalk } from '/engine/models/props/salt-boardwalk.js';
import { waterPumpStation } from '/engine/models/props/water-pump-station.js';
import { cargoHandcart } from '/engine/models/props/cargo-handcart.js';
import { flamingo } from '/engine/models/fauna/birds/flamingo.js';
export function salinasWorld(T) {
  const group=new THREE.Group(),world=terrain(T,{bounds:[-640,-450,620,960],base:caveMountain(T,CAVE,CAVE_PROFILE,baseHeight),step:5,
    cut:(x,z,h)=>channelSample(x,z).distance<3?Math.min(h,-.4):h,
    color:caveColor(T,CAVE,CAVE_PROFILE,(x,z,y)=>y<.8?0xc5bfae:0xdedbce)});
  group.add(world.land);
  const mine=saltCave(T,CAVE,CAVE_PROFILE,{groundAt:world.groundAt,name:'salinas-mine'});
  group.add(mine.group);caveFog(T,CAVE,world.land);
  for(const [i,p]of PONDS.entries())group.add(waterGrid(T,world,{
    bounds:[p.x-p.rx*1.1,p.z-p.rz*1.1,p.x+p.rx*1.1,p.z+p.rz*1.1],step:3,
    sample:(x,z)=>({height:WATER_Y,visible:pondAt(p,x,z)<1.04,along:z}),color:p.color,name:`salt-pond-${i}`,
  }));
  group.add(waterGrid(T,world,{bounds:[-240,-170,590,460],step:3,sample:(x,z)=>({height:WATER_Y,along:channelSample(x,z).along,
    visible:pondField(x,z)>1.015&&channelSample(x,z).distance<8}),color:0x65bcb9,name:'salinas-sluice-channels'}));
  const works=new THREE.Group();let piles=0,gates=0,shelters=0,harvesters=0;
  for(const [x,z]of [[-205,-125],[-180,-130],[-150,-145],[-280,270],[-250,280],[-220,290],[-30,330],[0,350],[35,360]])if(clear(T,x,z,10)){
    put(works,saltPile({seed:590+piles,radius:6+(piles%3),height:3.5+(piles%2)}),x,z,world.groundAt(x,z));piles++;
  }
  for(const [x,z,h]of [[25,-100,Math.PI/2],[180,28,0],[320,150,Math.PI/2]])if(clear(T,x,z,6)){
    put(works,sluiceGate({width:7,height:3}),x,z,-.4,h);gates++;
  }
  for(const [x,z,h]of [[-235,-100,.3],[-200,280,-.6],[-150,290,-.3],[-15,345,0]])if(clear(T,x,z,14)){
    if(x===-235||x===-15) {
      const station=foundation(group,saltHarvester(),x,z,world.groundAt,{rotation:h,scale:1.45,radius:13,color:0xccbea0});
      station.userData.footprintRadius=13;station.userData.support='salt-yard';
      harvesters++;
    } else {
      put(works,landingShelter({width:10,depth:10,deck:.25,height:4,color:0xa27c65}),x,z,world.groundAt(x,z),h);
      for(let i=0;i<3;i++)put(works,fishCrates(),x-3+i*2.3,z+2,world.groundAt(x,z)+.4,h);shelters++;
    }
  }
  const boardwalk=foundation(group,saltBoardwalk(),-115,148,world.groundAt,{rotation:0.1,scale:1.35,radius:8,color:0xccbea0});
  boardwalk.userData.footprintRadius=8;boardwalk.userData.support='pond-dike';
  const pump=foundation(group,waterPumpStation(),-140,-172,world.groundAt,{rotation:0.3,scale:1.35,radius:6,color:0xccbea0});
  pump.userData.footprintRadius=6;pump.userData.support='sluice-bank';
  const handcart=foundation(group,cargoHandcart(),15,312,world.groundAt,{rotation:-0.4,scale:1.5,radius:3,color:0xccbea0});
  handcart.userData.footprintRadius=3;handcart.userData.support='salt-yard';
  group.add(finish(works));
  // Feet follow the real bank triangles. Pick shallow water close enough to
  // the circuit to see, and keep each bird clear of roads and sluice channels.
  const colony=new THREE.Group(),poses=[[],[]];colony.name='salinas-flamingos';colony.userData.detailLevel=1;
  for(const index of [0,2,4]) {
    const p=PONDS[index],candidates=[],chosen=[];
    for(let i=0;i<120;i++)for(const radial of [.94,.98,1.02]) {
      const a=i*Math.PI/60,r=radial*(1+.045*Math.sin(a*5+p.x)),x=p.x+Math.cos(a)*p.rx*r,z=p.z+Math.sin(a)*p.rz*r;
      const y=world.groundAt(x,z),depth=WATER_Y-y,distance=Math.abs(T.offsetOf(x,z));
      if(depth<.08||depth>.5||distance>110||!clear(T,x,z,3)||channelSample(x,z).distance<13)continue;
      candidates.push({x,z,y,rot:-a+Math.PI/2,scale:1.65,distance});
    }
    candidates.sort((a,b)=>a.distance-b.distance);
    for(const p of candidates) {
      if(chosen.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<3.4))continue;
      chosen.push(p);poses[chosen.length%2].push(p);if(chosen.length===8)break;
    }
  }
  for(let i=0;i<2;i++)instances(colony,flamingo({pose:i?'feed':'stand',seed:i+1}),poses[i],`salt-flamingo-${i}`,Infinity);
  colony.userData.placements=poses.flat();colony.userData.assetId='flamingo';group.add(colony);
  instances(group,palm({seed:59,h:9}),scatter(T,world.groundAt,{seed:591,count:35,bounds:[-480,-330,480,390],margin:12,
    accept:(x,z)=>pondField(x,z)>1.3&&channelSample(x,z).distance>18}),'salinas-coastal-palms',190);
  instances(group,agave({seed:4}),scatter(T,world.groundAt,{seed:592,count:65,bounds:[-480,-330,480,390],margin:5,
    accept:(x,z)=>pondField(x,z)>1.3&&channelSample(x,z).distance>12}),'salinas-dry-banks',190);
  group.userData.assetCounts={saltPile:piles,sluiceGate:gates,landingShelter:shelters,saltHarvester:harvesters,flamingo:poses.flat().length};
  group.userData.assetCounts.mine=mine.group.userData.assetCounts;
  const water=waterAnimator(group);
  return {group,groundAt:world.groundAt,update:(t,dt)=>{water(t);mine.update(t,dt);}};
}
