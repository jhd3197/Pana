// An Andean ascent: lower meadows, glacial lake and the cable-car summit.
import { THREE,terrain,put,foundation,scatter,instances,edges,clear,smooth,boulder } from './world-kit.js';
import { frailejon } from '/engine/models/vegetation/frailejon.js';
import { mountainPine } from '/engine/models/vegetation/mountain-pine.js';
import { mountainCabin, mountainTent, stoneLookout, mountainSignpost, cableCarStation, rockyCliff } from '/engine/models/props/mountain.js';
import { summitTerminal,aerialLift,cableTower } from './world-landmarks.js';
import { ROUTE,roadHeight,baseHeight,LAKE } from './paramo-layout.js';
import { waterPool } from '/engine/models/effects/water-surface.js';

export default {
  id:'paramo',name:'Pana Páramo',
  blurb:'Sube entre frailejones, enlaza las horquillas de la laguna y corona el teleférico.',
  points:ROUTE,rounded:true,hw:8.5,lineU:.04,elevation:roadHeight,
  previewBounds:[[-440,0,-425],[400,240,285]],
  sectors:[[0,'Prado de frailejones'],[.23,'Las herraduras'],[.45,'Laguna del cielo'],[.67,'Estación cumbre'],[.84,'Bajada del cóndor']],
  items:{boxes:[.1,.29,.47,.66,.87],boxLanes:[-6,-2,2,6],pads:[{u:.19,off:0},{u:.42,off:4},{u:.74,off:-4},{u:.94,off:0}]},
  walls:false,chevrons:true,
  palette:{skySeed:17,cloudCover:0.63,horizon:0xc7dae0,skyTop:0x6fa9ce,hemiSky:0xe3eff5,hemiGround:0x899075,hemiInt:1.8,sun:0xffefd0,sunInt:2.6,ground:0x98a278,track:0x777e7c,dune:0,fog:[280,1100]},
  environment(T){
    const group=new THREE.Group(),world=terrain(T,{bounds:[-620,-610,560,410],base:baseHeight,
      color:(x,z,y)=>new THREE.Color(0x7f925f).lerp(new THREE.Color(0x768b84),smooth(y,70,145)).lerp(new THREE.Color(0xdde7e4),smooth(y+Math.sin(x*.05)*7+Math.cos(z*.06)*6,145,175))});
    group.add(world.land);
    const lake=waterPool(LAKE.rx,LAKE.rz,{color:0x6daab1,depth:8});lake.position.set(LAKE.x,LAKE.y,LAKE.z);lake.name='glacial-lake';group.add(lake);
    const occupied=[[-35,-275,30],[40,130,23],[-100,120,17],[125,-145,18]];
    const accept=(x,z,y)=>y<140&&Math.hypot((x-LAKE.x)/LAKE.rx,(z-LAKE.z)/LAKE.rz)>1.3&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
    const heritageSpot=[[-72,145],[-68,165],[-48,170]].find(([x,z])=>clear(T,x,z,8));
    if(heritageSpot)occupied.push([...heritageSpot,12]);
    const cliffSpots=scatter(T,world.groundAt,{seed:541,count:5,bounds:[-250,-230,200,-80],margin:12,minY:50,accept});
    cliffSpots.forEach(p=>occupied.push([p.x,p.z,10]));
    instances(group,frailejon({seed:51,h:2.3}),scatter(T,world.groundAt,{seed:511,count:170,bounds:[-330,-270,270,245],margin:5,scale:1.5,accept}),'paramo-frailejones');
    instances(group,mountainPine({seed:57,h:11}),scatter(T,world.groundAt,{seed:572,count:90,bounds:[-410,-270,340,260],margin:12,scale:1.5,accept:(x,z,y)=>accept(x,z,y)&&y<105}),'paramo-pines');
    instances(group,boulder(),scatter(T,world.groundAt,{seed:540,count:150,bounds:[-370,-320,345,260],margin:7,scale:1.3,accept}),'paramo-rocks');
    const station=foundation(group,summitTerminal(),-35,-275,world.groundAt,{radius:15});station.name='summit-terminal';
    const lower=foundation(group,summitTerminal('VALLE PANA'),40,130,world.groundAt,{radius:15,rotation:Math.PI,scale:.8});
    const cables=[[40,lower.position.y+11,130],[15,85,40],[-10,125,-125],[-35,station.position.y+11,-275]];
    for(const [x,y,z] of cables.slice(1,-1))put(group,cableTower(y-world.groundAt(x,z)),x,z,world.groundAt(x,z));
    const lift=aerialLift(cables);group.add(lift);
    foundation(group,mountainCabin({seed:52}),-100,120,world.groundAt,{scale:1.8,radius:9,rotation:-.4});
    foundation(group,stoneLookout(),125,-145,world.groundAt,{scale:1.4,radius:8,rotation:1.2});
    for(const [x,z] of [[-190,110],[-205,135],[-175,145]])if(clear(T,x,z,8))foundation(group,mountainTent(),x,z,world.groundAt,{scale:1.6,radius:5,rotation:x});
    const details=new THREE.Group();details.name='paramo-library-details';group.add(details);
    let heritage;
    if(heritageSpot) {const [x,z]=heritageSpot;
      heritage=foundation(details,cableCarStation(),x,z,world.groundAt,{radius:8,rotation:Math.PI});
      heritage.userData.assetId='cable-car-station';heritage.userData.footprintRadius=8;
    }
    for(const [i,p]of cliffSpots.entries()) {
      const foot=Math.min(...[-6,0,6].flatMap(dx=>[-2,2].map(dz=>world.groundAt(p.x+Math.cos(p.rot)*dx+Math.sin(p.rot)*dz,p.z-Math.sin(p.rot)*dx+Math.cos(p.rot)*dz))));
      const cliff=put(details,rockyCliff({seed:54+i,width:12,height:7,depth:4}),p.x,p.z,foot-.2,p.rot);
      cliff.userData.assetId='rocky-cliff';cliff.userData.footprintRadius=8;
    }
    return {group,groundAt:world.groundAt,update:t=>{lift.userData.tick(t);lake.userData.tick(t);heritage?.userData.tick(t);}};
  },
  scenery(group,kit,T){
    edges(group,kit,T,{style:'steel',step:6});
    for(const u of [.21,.43,.68,.86]){const p=kit.placeOnTrack(T,u*T.TOTAL,T.HW+5);kit.at(group,mountainSignpost(),p,p.h);}
  },
};
