import { THREE,M,box,smooth,mix,sign,put,finish,boat,clear } from './world-kit.js';
import { maracaiboBridge,canalVilla } from './world-landmarks.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { waterSurface } from '/engine/models/effects/water-surface.js';

const FINGERS=[325,405,485,565];
export function waterfrontHeight(x,z,land){
  const water=smooth(x,250,280)*smooth(z,275,300);
  let h=mix(land,-5,water);
  for(const cx of FINGERS){
    const edge=Math.max(Math.abs(x-cx)-20,z-350,285-z);
    h=mix(h,2.2,1-smooth(edge,-2,5));
  }
  return h;
}
export const overWater=(x,z)=>x>270&&x<590&&z>365;

export function createWaterfront(T){
  const group=new THREE.Group(),fixed=new THREE.Group(),houses=new THREE.Group();group.name='plaza-waterfront';
  const waterGeo=new THREE.PlaneGeometry(630,440,64,44);waterGeo.rotateX(-Math.PI/2);
  const water=waterSurface(waterGeo,{kind:'canal',color:0x5e9f9b,depth:5,amplitude:.035});water.position.set(585,0,515);water.name='canal-water';group.add(water);
  const bridge=maracaiboBridge();bridge.position.set(420,0,405);group.add(bridge);
  const colors=[0xddc492,0x92b8b0,0xe2a38d,0xb4c2a5,0x7ca3ba];let count=0;
  for(const [f,cx] of FINGERS.entries()){
    // Quays and a promenade join the narrow residential peninsulas to town.
    fixed.add(box(43,7,70,M(0xb2a68a),cx,-1.4,320),box(40,.25,68,M(0xdcc9a4),cx,2.25,320));
    fixed.add(box(5,.08,64,M(0xc2b699),cx,2.42,318));
    for(let row=0;row<3;row++)for(const side of [-1,1]){
      const x=cx+side*12,z=296+row*22;if(!clear(T,x,z,11))continue;
      const house=canalVilla({seed:f*10+row,color:colors[(f+row)%5]});
      put(houses,house,x,z,2.4,side*Math.PI/2,1.4);count++;
      const dockX=cx+side*28;fixed.add(box(13,.3,2.3,M(0x8a7558),dockX,1,z+5));
      for(const dx of [-5,5])fixed.add(box(.25,4,.25,M(0x695f4b),dockX+dx,-.7,z+5));
      put(fixed,boat(0xe5e2ce,{cabin:row%2===0}),dockX,z-2,.1,Math.PI/2,1.2);
    }
    put(fixed,palm({seed:f+40,h:10}),cx,350,2.4);
  }
  const name=sign('CASAS BOTES · PLAZA PANA',23,2,{background:'#296b73'});put(group,name,450,266,6,Math.PI);
  // Keep unique sign ownership from house factories when batching their geometry.
  group.add(finish(fixed,Infinity),finish(houses,Infinity));group.userData.waterfront={houses:count,bridgeLength:300,fingers:FINGERS.length};
  return group;
}
