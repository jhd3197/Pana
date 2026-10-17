import { THREE,M,box,put,finish,clear,instances,scatter,foundation,sign } from './world-kit.js';
import { landPath,landPatch } from './landscape-kit.js';
import { colonialHouse } from '/engine/models/props/colonial-house.js';
import { HOUSE_PALETTES } from '/engine/models/props/colonial-house-definitions.js';
import { colonialChurch,cornerBodega } from '/engine/models/props/pueblo.js';
import { streetLamp,bench,marketStall } from '/engine/models/props/plaza.js';
import { cafeTerrace } from '/engine/models/props/cafe-terrace.js';
import { coastalFortress } from '/engine/models/props/coastal-fort.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { FORT,TOWN_LANDMARKS } from './puerto-layout.js';
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
  for(const {x,z,rot} of sites) {
    const scale=1.9, radius=11, levels=[];
    for(const dx of [-radius,0,radius])for(const dz of [-radius,0,radius])levels.push(ground(x+dx,z+dz));
    const y=Math.max(...levels)+.2,low=Math.min(...levels)-.25;
    fixed.add(box(25,y-low,22,stone,x,(y+low)/2,z),box(25.5,.18,22.5,pavement,x,y+.09,z));
    const family=['casa-balcon','casa-baja','casa-esquina','casa-portal','casa-remate','casa-larga'][index%6];
    const house=colonialHouse({seed:710+index,family,palette:HOUSE_PALETTES[index%HOUSE_PALETTES.length].id,planting:index%3===0?'balcon':'entrada',detail:'low'});
    put(fixed,house,x,z,y+.18,rot,scale);
    houses.push({x,z,y:y+.18,base:low,family,radius,rot});occupied.push([x,z,17]);
    // A front path reaches each local street; the broad terrace shoulders remain planted.
    const front=Math.cos(rot),end=z+front*(z===-37?20:18);
    fixed.add(landPath(T,ground,[[x,z+front*12],[x,end]],{width:3,color:0xd7c6a1,margin:0,step:1}));
    index++;
  }
  // Church and plaza are kept small enough to read at street level.
  const church=foundation(group,colonialChurch(),-285,-150,ground,{scale:2.4,radius:16});church.name='puerto-church';occupied.push([-285,-150,25]);
  foundation(group,cornerBodega(),-92,-113,ground,{scale:2,radius:11});occupied.push([-92,-113,18]);
  const cafe=foundation(group,cafeTerrace(),134,-112,ground,{scale:1.4,radius:12});cafe.name='puerto-cafe';occupied.push([134,-112,18]);
  for(const [x,z]of[[-320,-148],[-345,-148]])if(clear(T,x,z,8))foundation(fixed,marketStall({seed:3}),x,z,ground,{scale:1.6,radius:5});
  // Landmark terrace is part of the heightfield, so the fort has no tall box plinth.
  const fort=put(group,coastalFortress(),FORT.x,FORT.z,FORT.y,0,1.8);fort.name='puerto-hilltop-fort';occupied.push([FORT.x,FORT.z,65]);
  const terrace=meshTerrace(FORT.x,FORT.z,FORT.y-.1,42,pavement);fixed.add(terrace);
  const title=sign(['FORTÍN DEL PUERTO','Mirador de la costa'],13,2.2,{background:'#706b50'});title.position.set(FORT.x,FORT.y+2.5,FORT.z+38);group.add(title);
  for(const x of [FORT.x-31,FORT.x+31])put(fixed,bench(),x,FORT.z+29,FORT.y,Math.PI,1.5);
  // Walkway from the coastal promenade toward the fort: stepped outside the lap.
  for(let i=0;i<44;i++) {
    const x=FORT.x+38,z=FORT.z+38+i*2,y=ground(x,z);
    const top=Math.max(y,ground(x,z-1.1))+.2,bottom=Math.min(y,ground(x,z+1.1))-.2;
    if(clear(T,x,z,4))fixed.add(box(5,top-bottom,2.15,pavement,x,(top+bottom)/2,z));
  }
  // Retaining toes on the climb, and lights facing the route through town.
  const lamps=[];
  for(let s=0;s<T.TOTAL;s+=37) {
    const p=T.pointAt(s),q=T.pointAt(s+.5),h=Math.atan2(q.x-p.x,q.y-p.y);
    if(p.y>30)continue;
    for(const side of [-1,1]) {
      const x=p.x-Math.cos(h)*side*(T.HW+5),z=p.y+Math.sin(h)*side*(T.HW+5);
      if(streetDistance(x,z)<8||occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))continue;
      lamps.push({x,z,y:ground(x,z),rot:h,scale:1.4});
    }
  }
  instances(group,streetLamp(),lamps,'puerto-street-lamps',180);
  const accept=(x,z)=>streetDistance(x,z)>13&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r)&&z<25&&Math.hypot(x-FORT.x,z-FORT.z)>51;
  instances(group,palm({seed:71,h:10}),scatter(T,ground,{seed:711,count:100,bounds:[-470,-240,355,29],margin:9,scale:1.4,accept}),'puerto-town-palms',180);
  instances(group,mangoTree({seed:72,fruit:false}),scatter(T,ground,{seed:712,count:65,bounds:[-470,-420,385,-100],margin:15,scale:2.7,accept}),'puerto-hill-groves',200);
  group.add(finish(fixed,160));group.userData.houses=houses;group.userData.occupied=occupied;
  return group;
}

function meshTerrace(x,z,y,r,material) {
  const geo=new THREE.CylinderGeometry(r,r,.4,64),out=new THREE.Mesh(geo,material);out.position.set(x,y-.2,z);out.receiveShadow=true;return out;
}
