// i18n-ignore-file: track, sector and place names, world signage and shaders stay Spanish.
import { THREE,M,box,mesh,tube,put,finish,clear,instances,scatter,foundation,sign } from './world-kit.js';
import { landPath,landPatch } from './landscape-kit.js';
import { colonialHouse } from '/engine/models/props/colonial-house.js';
import { colonialChurch,cornerBodega,streetFoodKiosk,busStopShelter,parkBench } from '/engine/models/props/pueblo.js';
import { streetLamp,marketStall } from '/engine/models/props/plaza.js';
import { casaGuipuzcoana } from '/engine/models/props/casa-guipuzcoana.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { FORT,CASA,TOWN_LANDMARKS,CITY_BLOCKS,CIVIC_PLAZA } from './puerto-layout.js';
import { puertoStreets } from './puerto-streets.js';

export function puertoTown(T,world,sites) {
  const group=new THREE.Group(),fixed=new THREE.Group(),houses=[],occupied=[...TOWN_LANDMARKS];
  group.name='puerto-colonial-town';
  const pavement=M(0xd7c6a1),stone=M(0xaaa48e);
  const ground=world.groundAt;
  const streets=puertoStreets(T,ground),streetDistance=streets.distance;group.add(streets.group);
  // The promenade, market square and garden beds tie the buildings to the coast.
  fixed.add(landPath(T,ground,[[-48,27],[90,26],[230,17],[290,-7]],{width:9,color:0xd7c6a1,step:2,margin:0}));
  for(const [x,z,rx,rz]of[[-320,-150,40,22],[134,-112,34,18]])fixed.add(landPatch(T,ground,{x,z,rx,rz,color:0xc9b88e,rect:true,margin:3,step:2}));
  let index=0;
  for(const {x,z,rot,block} of sites) {
    const scale=1.9, radius=10.5, levels=[];
    for(const dx of [-radius,0,radius])for(const dz of [-radius,0,radius])levels.push(ground(x+dx,z+dz));
    const y=Math.max(...levels)+.2,low=Math.min(...levels)-.25;
    if(y+.18-ground(x,z)>3.8)continue;
    for(const part of [box(23,y-low,20,stone,x,(y+low)/2,z),box(23.5,.18,20.5,pavement,x,y+.09,z)]){part.rotation.y=rot;fixed.add(part);}
    const family=['casa-balcon','casa-baja','casa-esquina','casa-portal','casa-remate','casa-larga'][index%6];
    const district=Math.floor((x+230)/110),row=Math.floor((-z-240)/80);
    const palette=(z>-240?['crema','coral-crema','cielo']:['crema','turquesa','coral-crema','amarillo','azul'])[(index+Math.abs(district))%(z>-240?3:5)];
    const house=colonialHouse({seed:710+index,family,palette,width:family==='casa-larga'?11.5:9.4+(index%4)*.6,depth:7.8,
      floorHeight:3.6+(index%3)*.4,partyWalls:['left','right'],wallFinish:['ladrillo-visto','cal','ladrillo-pintado','ladrillo-visto','cal'][index%5],
      roof:index%3===0?'azotea':index%5===0?'cuatro-aguas':'tejas',planting:index%5===0?'balcon':'ninguna',detail:'low'});

    const spec=house.userData.houseSpec;
    if(spec.roof==='azotea'){
      const roof=spec.base+spec.floors*spec.floorHeight;
      house.add(mesh(new THREE.CylinderGeometry(.6,.6,1.15,12),M(0x416d86),-2,roof+.65,-1.8),box(1.3,.12,1.3,stone,-2,roof+.06,-1.8));
      house.add(tube([-2,roof+.2,-1.8],[-2,.4,-3.5],.045,M(0xaaa99a)));
    }
    // Small businesses occupy varied ground floors in the connected street wall.
    if(index%5===0){
      const shop=new THREE.Group(),awning=M([0xa95d45,0x376f76,0xc69f52][index%3]);
      shop.add(box(6.8,.16,2.1,awning,0,2.9,4.7));
      for(const dx of [-3.3,3.3])shop.add(box(.12,2.8,.12,M(0x495450),dx,1.4,5.5));
      const title=sign([['PANADERÍA','BODEGA','CAFÉ DEL PUERTO','FERRETERÍA'][Math.floor(index/5)%4]],6.7,.7,{background:'#e4d9bd',color:'#3b4740'});
      title.position.set(0,3.4,4.2);shop.add(title);house.add(shop);
    }
    put(fixed,house,x,z,y+.18,rot,scale);
    houses.push({x,z,y:y+.18,base:low,family,radius,rot,block});occupied.push([x,z,17]);
    // A front path reaches each local street; the broad terrace shoulders remain planted.
    const dx=Math.sin(rot),dz=Math.cos(rot);
    fixed.add(landPath(T,ground,[[x+dx*8,z+dz*8],[x+dx*20,z+dz*20]],{width:3,color:0xd7c6a1,margin:0,step:1}));
    index++;
  }
  // Interior patios replace the empty grass between the street walls. Each
  // block has its own courtyard, service lane, washing line and shared garden.
  let patios=0;const patioTrees=[];
  for(const b of CITY_BLOCKS){
    const x=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2;if(!clear(T,x,cz,18))continue;
    const rx=Math.max(5,(b.x1-b.x0)/2-29),rz=Math.max(5,(b.z1-b.z0)/2-29);
    fixed.add(landPatch(T,ground,{x,z:cz,rx,rz,color:patios%2?0xbda789:0xa7b08b,rect:true,margin:2,step:2}));
    fixed.add(landPatch(T,ground,{x:x+rx*.45,z:cz+rz*.45,rx:6,rz:5,color:0x778d55,margin:2,step:2,raise:.11}));
    patioTrees.push({x:x+rx*.45,z:cz+rz*.45,y:ground(x+rx*.45,cz+rz*.45),rot:patios,scale:1.15});
    if(patios%2===0)foundation(fixed,parkBench(),x-8,cz+rz-2,ground,{scale:1.5,radius:2});
    const y=ground(x,cz);fixed.add(box(.15,4,.15,M(0x726249),x-8,y+2,cz),box(.15,4,.15,M(0x726249),x+8,y+2,cz));
    fixed.add(tube([x-8,y+3.8,cz],[x+8,y+3.8,cz],.025,M(0x493e32)));
    for(let k=0;k<4;k++)fixed.add(box(1.8,1.6,.055,M([0xe9ded0,0xc78e66,0x6c9093,0xb3b07d][k]),x-5+k*3,y+2.9,cz));
    patios++;
  }
  instances(group,mangoTree({seed:73,fruit:false}),patioTrees,'puerto-courtyard-trees',400);
  // Distinct civic and commercial places interrupt the residential blocks.

  const church=foundation(group,colonialChurch(),-285,-150,ground,{scale:2.4,radius:16});church.name='puerto-church';occupied.push([-285,-150,25]);
  foundation(group,cornerBodega(),-218,-212,ground,{scale:2,radius:11});occupied.push([-218,-212,18]);

  for(const [x,z]of[[-320,-148],[-345,-148]])if(clear(T,x,z,8))foundation(fixed,marketStall({seed:3}),x,z,ground,{scale:1.6,radius:5});
  const plaza=CIVIC_PLAZA;
  fixed.add(landPatch(T,ground,{x:plaza.x,z:plaza.z,rx:32,rz:25,color:0xc9b79c,rect:true,margin:3,step:2}));
  fixed.add(landPath(T,ground,[[-225,-130],[plaza.x,-130],[-150,-130],[-150,-75]],{width:7,color:0xc9b79c,margin:3,step:2}));
  for(const [x,z]of[[-195,-145],[-155,-145]])if(clear(T,x,z,9))foundation(group,streetFoodKiosk(),x,z,ground,{scale:1.8,radius:7});
  if(clear(T,-215,-155,9))foundation(group,busStopShelter(),-215,-155,ground,{scale:1.8,radius:7,rotation:Math.PI/2});
  for(const [x,z]of[[-336,-160],[-307,-165],[-192,-115],[-158,-115]])if(clear(T,x,z,5))foundation(fixed,parkBench(),x,z,ground,{scale:1.6,radius:3});
  const casa=put(group,casaGuipuzcoana(),CASA.x,CASA.z,CASA.y,0,CASA.scale);casa.name='puerto-guipuzcoana';occupied.push([CASA.x,CASA.z,83]);
  // Retaining toes on the climb, and lights facing the route through town.
  const lamps=[];
  // Lights belong at built intersections. No road or stairs run up the fort's
  // sheer retaining face; its ascent belongs to the race's mountain route.
  for(const x of [-225,-110,5,120,235])for(const z of [-385,-280,-195])if(clear(T,x+8,z+8,3))lamps.push({x:x+8,z:z+8,y:ground(x+8,z+8),rot:0,scale:1.4});
  for(let s=0;s<T.TOTAL;s+=37) {
    const p=T.pointAt(s),q=T.pointAt(s+.5),h=Math.atan2(q.x-p.x,q.y-p.y);
    if(p.y>30||p.y < -350)continue;
    for(const side of [-1,1]) {
      const x=p.x-Math.cos(h)*side*(T.HW+5),z=p.y+Math.sin(h)*side*(T.HW+5);
      if(!T.clearOfRoad(x,z,3)||Math.abs(ground(x,z)-T.heightAtS(s))>3.5||streetDistance(x,z)<8||occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))continue;
      lamps.push({x,z,y:ground(x,z),rot:h,scale:1.4});
    }
  }
  instances(group,streetLamp(),lamps,'puerto-street-lamps',180);
  group.userData.lamps=lamps;
  const accept=(x,z)=>streetDistance(x,z)>13&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r)&&z<25&&Math.hypot(x-FORT.x,z-FORT.z)>240;
  instances(group,palm({seed:71,h:10}),scatter(T,ground,{seed:711,count:32,bounds:[-470,-240,355,29],margin:9,scale:1.4,accept}),'puerto-town-palms',180);
  instances(group,mangoTree({seed:72,fruit:false}),scatter(T,ground,{seed:712,count:10,bounds:[-470,-420,385,-100],margin:15,scale:2.7,accept}),'puerto-hill-groves',200);
  group.add(finish(fixed,400));group.userData.houses=houses;group.userData.patios=patios;group.userData.shops=Math.ceil(index/5);group.userData.occupied=occupied;
  return group;
}
