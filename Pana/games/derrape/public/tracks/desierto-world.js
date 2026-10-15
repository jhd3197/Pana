import { THREE,terrain,put,foundation,scatter,instances,clear,finish,smooth,placeOnTrack,boulder } from './world-kit.js';
import { giantCactus, sandDune, desertRockArch, abandonedGasStation, rustedPickup, roadsideTirePile, canyonSpire, brokenWagon, desertWarningSign, desertWell } from '/engine/models/props/desert.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { agave } from '/engine/models/vegetation/agave.js';
import { soaringVulture } from '/engine/models/fauna/birds/soaring-vulture.js';
import { orbitBird } from '/engine/models/animation/orbit-bird.js';
import { parkBench } from '/engine/models/props/pueblo.js';
import { waterPool, waterAnimator } from '/engine/models/effects/water-surface.js';
import { baseHeight,roadHeight,OASIS } from './desierto-layout.js';
import { grassTuft,entrance,crossing,vergePosts,dirtVerge } from './country-details.js';

export function desertEnvironment(T){
  const group=new THREE.Group(),fixed=new THREE.Group(),counts={},occupied=[];
  const world=terrain(T,{bounds:[-630,-570,620,500],base:baseHeight,step:5,
    color:(x,z,y)=>{
      const oasis=Math.hypot((x-OASIS.x)/OASIS.rx,(z-OASIS.z)/OASIS.rz);
      const canyon=smooth(-z+Math.sin(x*.018)*32,-100,150),rise=y-roadHeight(x,z);
      const c=new THREE.Color(0xcfac73).lerp(new THREE.Color(0xa96f4c),canyon);
      c.lerp(new THREE.Color(0x7f4936),smooth(rise,5,34)*.65);
      c.lerp(new THREE.Color(0xe0b67b),smooth(rise,20,30)*(1-smooth(rise,31,39))*.65);
      return c.lerp(new THREE.Color(0x8b9360),(1-smooth(oasis,1.15,1.65))*.75);
    }});group.add(world.land);world.land.name='desert-eroded-terrain';
  const add=(parent,id,factory,x,z,{rotation=0,scale=1,radius=5}={})=>{
    if(!clear(T,x,z,radius))throw Error(`Desert landmark ${id} overlaps road at ${x}, ${z}`);
    counts[id]=(counts[id]||0)+1;occupied.push([x,z,radius+4]);
    return id==='abandoned-gas-station'
      ?foundation(parent,factory(),x,z,world.groundAt,{rotation,scale,radius,color:0xb99f79})
      :put(parent,factory(),x,z,world.groundAt(x,z),rotation,scale);
  };
  // A complete abandoned service yard beside the opening straight.
  const station=new THREE.Group();station.name='pana-gas-yard';
  add(station,'abandoned-gas-station',abandonedGasStation,-195,171,{scale:1.7,radius:9});
  add(station,'rusted-pickup',rustedPickup,-169,177,{rotation:.45,scale:1.2,radius:3});
  add(station,'roadside-tire-pile',roadsideTirePile,-180,158,{scale:1.4,radius:2});
  add(station,'roadside-tire-pile',roadsideTirePile,-213,171,{scale:1.2,radius:2});
  add(station,'desert-well',desertWell,-225,160,{scale:1.5,radius:3});
  add(station,'broken-wagon',brokenWagon,-237,173,{rotation:-.8,scale:1.3,radius:4});
  const stationBatch=finish(station);stationBatch.name='pana-gas-yard';group.add(stationBatch);
  group.add(entrance(T,T.LINE-14,'PANA DESIERTO',{color:'#986540'}));

  // Sculpted dunes form a loose field, with the race road threading between them.
  const dunes=new THREE.Group();
  for(const [i,x,z,scale]of [[0,-60,150,2.8],[1,40,115,2.6],[2,135,250,2.2],[3,245,230,2.5],[4,245,88,2],[5,-90,275,3],[6,-315,265,2.6],[7,355,185,3]]){
    if(!clear(T,x,z,scale*8))continue;
    const height=3.4+i%3,dune=sandDune({width:22,depth:18,height,seed:62+i}),rotation=i*.37,y=world.groundAt(x,z);
    // The standalone dune has a flat perimeter. Fit its owned vertices to this
    // terrain and blend the skirt into local sand, so no rectangular tile shows.
    dune.traverse(o=>{
      if(!o.geometry)return;const p=o.geometry.attributes.position,c=o.geometry.attributes.color;
      for(let k=0;k<p.count;k++){
        const lx=p.getX(k),lz=p.getZ(k),rise=p.getY(k),wx=x+(lx*Math.cos(rotation)+lz*Math.sin(rotation))*scale,wz=z+(-lx*Math.sin(rotation)+lz*Math.cos(rotation))*scale;
        p.setY(k,rise+(world.groundAt(wx,wz)-y-.06)/scale);
        const tint=new THREE.Color(0xcfac73).lerp(new THREE.Color(0xe7c28d),smooth(rise,0,height)*.65);c.setXYZ(k,tint.r,tint.g,tint.b);
      }o.geometry.computeVertexNormals();
    });
    put(dunes,dune,x,z,y,rotation,scale);counts['sand-dune']=(counts['sand-dune']||0)+1;occupied.push([x,z,scale*9]);
  }
  const duneBatch=finish(dunes);duneBatch.name='wind-carved-dunes';group.add(duneBatch);

  // Two large natural gateways, aligned with the actual racing ribbon.
  for(const [i,u]of [.43,.62].entries()){
    const p=placeOnTrack(T,T.TOTAL*u),arch=desertRockArch({span:25,height:14+i*2,depth:7,seed:630+i});
    put(group,arch,p.x,p.z,p.y-.15,p.h);arch.name=`canyon-gateway-${i+1}`;counts['desert-rock-arch']=(counts['desert-rock-arch']||0)+1;
    occupied.push([p.x,p.z,22]);
  }
  // Needles group around the mesa feet, instead of an even ring of props.
  const spires=[];
  for(const [i,cx,cz]of [[0,75,-95],[1,340,-210],[2,170,-365],[3,-165,-325],[4,-350,-120]])for(let j=0;j<5;j++){
    const a=j*2.4+i,x=cx+Math.cos(a)*(12+j*4),z=cz+Math.sin(a)*(10+j*4);
    if(clear(T,x,z,9)){spires.push({x,z,y:world.groundAt(x,z)-.5,scale:1.1+(j%3)*.42,rot:a});occupied.push([x,z,7]);}
  }
  instances(group,canyonSpire({height:14,seed:67}),spires,'canyon-spires',180);counts['canyon-spire']=spires.length;

  // Wide weathered pillars flank the canyon approach, with road clearance based
  // on the full footprint. Reuse the pack sculpt, enlarged only as geology.
  const buttes=[];
  for(let s=T.TOTAL*.34;s<T.TOTAL*.67;s+=29){
    const side=Math.floor(s/29)%2?1:-1,p=placeOnTrack(T,s,side*32);
    if(clear(T,p.x,p.z,17)&&!occupied.some(([x,z,r])=>Math.hypot(x-p.x,z-p.z)<r+16)){
      buttes.push({x:p.x,z:p.z,y:world.groundAt(p.x,p.z)-1,rot:p.h,scale:1+(buttes.length%3)*.13});
      occupied.push([p.x,p.z,19]);
    }
  }
  const rock=canyonSpire({height:18,seed:69});rock.scale.set(3.3,1.65,2.5);
  instances(group,rock,buttes,'canyon-buttresses',180);counts['canyon-spire']+=buttes.length;

  const oasis=waterPool(OASIS.rx,OASIS.rz,{color:0x529d91,depth:4});oasis.position.set(OASIS.x,OASIS.y,OASIS.z);oasis.name='desert-oasis';group.add(oasis);
  const rest=new THREE.Group();
  add(rest,'desert-well',desertWell,-125,-210,{scale:1.4,radius:3});
  add(rest,'broken-wagon',brokenWagon,-143,-153,{rotation:1.8,scale:1.3,radius:4});
  for(const [x,z]of [[-140,-215],[-150,-225]])if(clear(T,x,z,3))put(rest,parkBench(),x,z,world.groundAt(x,z),-1.1,1.4);
  const restBatch=finish(rest);restBatch.name='oasis-well-stop';group.add(restBatch);
  const palms=[];for(let i=0;i<16;i++){const a=i*Math.PI*2/16,x=OASIS.x+Math.cos(a)*(OASIS.rx+6+i%3*3),z=OASIS.z+Math.sin(a)*(OASIS.rz+7);if(clear(T,x,z,6))palms.push({x,z,y:world.groundAt(x,z),rot:a,scale:.95+i%3*.18});}
  instances(group,palm({h:9,seed:14}),palms,'oasis-palms',180);

  const accept=(x,z)=>Math.hypot((x-OASIS.x)/OASIS.rx,(z-OASIS.z)/OASIS.rz)>1.4&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
  const cardones=scatter(T,world.groundAt,{seed:611,count:58,bounds:[-375,-340,380,285],margin:7,scale:1,accept});
  instances(group,giantCactus({height:6.2,seed:61}),cardones,'desert-cardones',180);counts['giant-cactus']=cardones.length;
  instances(group,agave({seed:9}),scatter(T,world.groundAt,{seed:615,count:65,bounds:[-360,-320,370,270],margin:5,scale:1.2,accept}),'desert-agaves',180);
  instances(group,grassTuft(0xb5a16b),scatter(T,world.groundAt,{seed:616,count:330,bounds:[-360,-330,380,280],margin:3,scale:1.2,accept}),'desert-dry-grass',180);
  const scree=scatter(T,world.groundAt,{seed:619,count:65,bounds:[-380,-350,390,280],margin:6,scale:1,accept});
  scree.forEach(p=>{p.y-=.5*p.scale;});instances(group,boulder(0xac7957),scree,'desert-scree',180);
  for(const u of [.31,.41,.57,.7,.86]){
    const p=placeOnTrack(T,T.TOTAL*u,T.HW+5),m=desertWarningSign();put(fixed,m,p.x,p.z,world.groundAt(p.x,p.z),p.h+Math.PI,1.2);counts['desert-warning-sign']=(counts['desert-warning-sign']||0)+1;
  }
  group.add(finish(fixed));group.userData.assetCounts=counts;const water=waterAnimator(group);
  return {group,groundAt:world.groundAt,update:water};
}

export function desertScenery(group,kit,T){
  const high=s=>{const p=T.pointAt(s);return p.x>220&&p.y<0&&p.y>-210;};
  // Guard the exposed eastern ledge while keeping dune views open.
  group.add(crossing(T,(p,s)=>high(s),{name:'canyon-ledge-viaduct',color:0xb3987e}));
  group.add(vergePosts(T,{skip:high,color:0xe9d0a0,step:18}),dirtVerge(T,{shoulder:0xc9aa77,rut:0xa58d69,skip:high}));
  for(let i=0;i<2;i++)group.add(orbitBird(soaringVulture({seed:30+i}),{cx:70,cz:-110,cy:90+i*8,r:58+i*14,speed:.16,phase:i*3}));
}
