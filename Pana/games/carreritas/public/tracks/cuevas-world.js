import { meadow } from './festive.js';
import { THREE, terrain, finish, put, instances, scatter, placeOnTrack } from './world-kit.js';
import { mossRock } from '/engine/models/vegetation/moss-rock.js';
import { waterGrid, hollowGallery } from './water-world-kit.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { crossing } from './country-details.js';
import { baseHeight, riverAt, CAVE } from './cuevas-layout.js';
import { caveMountain, caveFormations, tintShell } from './salt-cave.js';
import { riverSurface } from '/engine/models/effects/water-surface.js';
import { mineLanternPost } from '/engine/models/props/mine.js';
import { fireflies } from '/engine/models/effects/drifting-particles.js';
import { wildMushrooms } from '/engine/models/vegetation/wild-mushrooms.js';
import { rockArch } from '/engine/models/props/mountain.js';
import { lightShaft, glowPool } from '/engine/models/effects/atmosphere.js';
import { stalactiteCluster, rootCurtain } from '/engine/models/props/caves.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { fern } from '/engine/models/vegetation/fern.js';
export function cuevasWorld(T) {
  const group=new THREE.Group(),world=terrain(T,{bounds:[-550,-440,540,480],base:caveMountain(T,CAVE,{widthAt:()=>31},baseHeight,{peak:96}),step:5,
    cut:(x,z,h)=>{const r=riverAt(x,z);return r.distance<13?Math.min(h,r.height-4):h;},
    // Under the mountain the floor is warm river stone, not meadow (no grass tufts).
    color:(x,z,y)=>{const n=T.nearest(x,z),u=n.s/T.TOTAL;return u>CAVE.from&&u<CAVE.to&&n.d<34?0x9a8462:z<0?0x9aa27e:meadow(x,z,0x74b65a,{bloom:0xff9fd0});}});
  group.add(world.land,waterGrid(T,world,{bounds:[-470,-280,240,480],sample:(x,z)=>({...riverAt(x,z),visible:riverAt(x,z).distance<32}),color:0x2fbfb4,foam:true,name:'cuevas-river'}));
  // The mountain closes over the shell (caveMountain) and the roof has no
  // openings: light falls through two small skylights as beams, and library
  // rock arches frame both mouths into the slope.
  const shell=hollowGallery(T,{...CAVE,skylights:[],width:31,height:33,color:0x9c8a70,name:'cuevas-shell'});group.add(shell);
  // A lush river cave: mossy green-teal rock warming to amber at the crown,
  // spectrum crystals stuck to the rock, lanterns along the road, fireflies.
  tintShell(shell,{ring:[0x5f8f52,0x4f9a7c,0x3f8e8a,0xb08a5a],emissive:0x16443a,intensity:.55});
  const surface=shell.userData.corridor.surface,profile={widthAt:()=>31};
  // The cave's own stream runs beside the road, foaming down the climb and
  // lit by cyan glow pools; formations keep clear of its banks.
  const streamPts=[],STREAM_OFF=-(T.HW+5.5);
  for(let u=CAVE.from+.004;u<CAVE.to-.004;u+=6/T.TOTAL){const q=placeOnTrack(T,u*T.TOTAL,STREAM_OFF);streamPts.push([q.x,q.z]);}
  const stream=riverSurface(streamPts,6,(x,z)=>T.surfaceAt(x,z)-.35,{color:0x3fe6d8,foam:true});stream.name='cuevas-cave-stream';group.add(stream);
  const nearStream=(x,z)=>{const n=T.nearest(x,z),off=n.d*n.side;return Math.abs(off-STREAM_OFF)<7;};
  for(let u=CAVE.from+.02;u<CAVE.to-.01;u+=38/T.TOTAL){const q=placeOnTrack(T,u*T.TOTAL,STREAM_OFF),pool=glowPool({radius:7,color:0x3fe6d8,intensity:.35});pool.position.set(q.x,q.y-.3,q.z);group.add(pool);}
  const crystals=caveFormations(T,CAVE,profile,shell,{palette:[0x5fe08a,0x3fd6e0,0x9b5cff,0xffb43a],seed:58,glow:1.3,lights:4,giantEvery:130,
    avoid:(x,z)=>riverAt(x,z).distance<16||nearStream(x,z),name:'cuevas-formations'});group.add(crystals);
  const lamps=new THREE.Group(),glow=[];
  for(let u=CAVE.from+.012;u<CAVE.to-.006;u+=36/T.TOTAL)for(const side of [-1,1]){
    const p=placeOnTrack(T,u*T.TOTAL,side*(T.HW+2.2));if(riverAt(p.x,p.z).distance<15)continue;
    put(lamps,mineLanternPost({light:false}),p.x,p.z,p.y-.4,p.h+(side>0?Math.PI:0));glow.push([p.x,p.y,p.z]);
    const m=placeOnTrack(T,u*T.TOTAL+9,side*27);if(riverAt(m.x,m.z).distance>16)put(lamps,wildMushrooms({seed:Math.round(u*999)+side}),m.x,m.z,p.y-.6,u*40,1.4);
  }
  group.add(finish(lamps));
  const bugs=fireflies({count:260,height:6,anchors:glow,color:0xd8f27a,seed:58});bugs.name='cuevas-fireflies';group.add(bugs);
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
    put(details,stalactiteCluster({seed:580+clusters,length:5}),p.x,p.z,p.y+surface(u,(clusters%2?1:-1)*19)+.3,p.h);clusters++;
  }
  // Hanging roots all along the roof, rooted in the rock.
  for(let u=CAVE.from+.01;u<CAVE.to;u+=.022)for(const side of [-1,1]){
    const off=side*(14+(roots%3)*4),p=placeOnTrack(T,u*T.TOTAL,off);
    put(details,rootCurtain({seed:590+roots,length:7+(roots%3)*2,width:8}),p.x,p.z,p.y+surface(u,off)+.3,p.h);roots++;
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
  return {group,groundAt:world.groundAt,update:t=>{animate(t);beams.forEach(b=>b.userData.tick(t));crystals.userData.tick(t);bugs.userData.tick(t);stream.userData.tick(t);}};
}
