import { THREE, terrain, finish, put, instances, scatter, placeOnTrack, boulder } from './world-kit.js';
import { waterGrid, hollowGallery } from './water-world-kit.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { crossing } from './country-details.js';
import { baseHeight, riverAt, CAVE } from './cuevas-layout.js';
import { stalactiteCluster, rootCurtain } from '/engine/models/props/caves.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { fern } from '/engine/models/vegetation/fern.js';
export function cuevasWorld(T) {
  const group=new THREE.Group(),world=terrain(T,{bounds:[-550,-440,540,480],base:baseHeight,step:5,
    cut:(x,z,h)=>{const r=riverAt(x,z);return r.distance<13?Math.min(h,r.height-4):h;},
    color:(x,z,y)=>z<0?0x7f8c7a:0x7e9a62});
  group.add(world.land,waterGrid(T,world,{bounds:[-470,-280,240,480],sample:(x,z)=>({...riverAt(x,z),visible:riverAt(x,z).distance<32}),name:'cuevas-river'}));
  group.add(hollowGallery(T,{...CAVE,width:31,height:33,color:0x798681,name:'cuevas-shell'}));
  group.add(crossing(T,p=>riverAt(p.x,p.z).distance<28,{name:'cuevas-stone-bridge',color:0x8e9386}));
  const details=new THREE.Group();let clusters=0,roots=0;
  for(let u=CAVE.from+.025;u<CAVE.to-.01;u+=.026){
    if(CAVE.skylights.some(([a,b])=>u>a-.01&&u<b+.01))continue;
    const p=placeOnTrack(T,T.TOTAL*u,(clusters%2?1:-1)*19);
    put(details,stalactiteCluster({seed:580+clusters,length:5}),p.x,p.z,p.y+27,p.h);clusters++;
  }
  for(const u of [CAVE.from,.27,.3,.43,.46,CAVE.to])for(const side of [-1,1]){
    const p=placeOnTrack(T,u*T.TOTAL,side*24);
    put(details,rootCurtain({seed:590+roots,length:9,width:9}),p.x,p.z,p.y+22,p.h);roots++;
  }
  group.add(finish(details));
  const outside=(x,z)=>{
    const u=T.paramOf(x,z)/T.TOTAL;return u<CAVE.from-.03||u>CAVE.to+.04;
  };
  instances(group,ceiba({seed:58,detail:'distant'}),scatter(T,world.groundAt,{seed:581,count:170,bounds:[-470,-350,450,430],margin:11,accept:outside}),'cuevas-valley-forest',110);
  instances(group,fern({seed:5}),scatter(T,world.groundAt,{seed:582,count:120,bounds:[-420,-320,420,400],margin:5,accept:outside}),'cuevas-fern-banks',110);
  instances(group,boulder(0x87938b),scatter(T,world.groundAt,{seed:583,count:95,bounds:[-470,-350,450,430],margin:10,scale:2,
    accept:(x,z)=>outside(x,z)&&riverAt(x,z).distance>35}),'cuevas-outcrops',110);
  group.userData.assetCounts={stalactiteCluster:clusters,rootCurtain:roots};
  const animate=waterAnimator(group);
  return {group,groundAt:world.groundAt,update:animate};
}
