import { meadow } from './festive.js';
import { THREE, terrain, finish, put, instances, scatter, placeOnTrack } from './world-kit.js';
import { mossRock } from '/engine/models/vegetation/moss-rock.js';
import { waterGrid, hollowGallery } from './water-world-kit.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { crossing } from './country-details.js';
import { baseHeight, riverAt, CAVE } from './cuevas-layout.js';
import { caveMountain } from './salt-cave.js';
import { rockArch } from '/engine/models/props/mountain.js';
import { lightShaft } from '/engine/models/effects/atmosphere.js';
import { stalactiteCluster, rootCurtain } from '/engine/models/props/caves.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { fern } from '/engine/models/vegetation/fern.js';
export function cuevasWorld(T) {
  const group=new THREE.Group(),world=terrain(T,{bounds:[-550,-440,540,480],base:caveMountain(T,CAVE,{widthAt:()=>31},baseHeight,{peak:96}),step:5,
    cut:(x,z,h)=>{const r=riverAt(x,z);return r.distance<13?Math.min(h,r.height-4):h;},
    color:(x,z,y)=>z<0?0x9aa27e:meadow(x,z,0x74b65a,{bloom:0xff9fd0})});
  group.add(world.land,waterGrid(T,world,{bounds:[-470,-280,240,480],sample:(x,z)=>({...riverAt(x,z),visible:riverAt(x,z).distance<32}),name:'cuevas-river'}));
  // The mountain closes over the shell (caveMountain) and the roof has no
  // openings: light falls through two small skylights as beams, and library
  // rock arches frame both mouths into the slope.
  group.add(hollowGallery(T,{...CAVE,skylights:[],width:31,height:33,color:0x9c8a70,name:'cuevas-shell'}));
  const beams=CAVE.skylights.map(([a,b])=>{
    const u=(a+b)/2,p=placeOnTrack(T,u*T.TOTAL,0),beam=lightShaft({radius:3.2,height:30,spread:2.8,tilt:0,fresnel:true,sky:0xfff6dc,color:0xffeec8,opacity:.12,dustCount:220,seed:Math.round(u*100)});
    beam.position.set(p.x,p.y-.5,p.z);group.add(beam);return beam;
  });
  for(const [u,flip] of [[CAVE.from,Math.PI],[CAVE.to,0]]){
    const p=placeOnTrack(T,u*T.TOTAL,0),arch=rockArch({span:33,height:40,depth:10,seed:Math.round(u*100),color:0xb39a78});
    arch.position.set(p.x,p.y-1,p.z);arch.rotation.y=p.h+flip;group.add(arch);
  }
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
  instances(group,ceiba({seed:58,detail:'distant'}),scatter(T,world.groundAt,{seed:581,count:170,bounds:[-470,-350,450,430],margin:11,accept:outside}),'cuevas-valley-forest',190);
  instances(group,fern({seed:5}),scatter(T,world.groundAt,{seed:582,count:120,bounds:[-420,-320,420,400],margin:5,accept:outside}),'cuevas-fern-banks',190);
  instances(group,mossRock({seed:58,size:2.2}),scatter(T,world.groundAt,{seed:583,count:95,bounds:[-470,-350,450,430],margin:10,scale:2,
    accept:(x,z)=>outside(x,z)&&riverAt(x,z).distance>35}),'cuevas-outcrops',500);
  group.userData.assetCounts={stalactiteCluster:clusters,rootCurtain:roots};
  const animate=waterAnimator(group);
  return {group,groundAt:world.groundAt,update:t=>{animate(t);beams.forEach(b=>b.userData.tick(t));}};
}
