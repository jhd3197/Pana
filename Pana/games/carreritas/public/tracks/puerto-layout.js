// Fictional La Guaira: harbor at +Z, mountain and San Carlos at -Z.
// XYZ is stored as [x,z,height]; the race measures horizontal arc length.
export const FORT = { x:-50, z:-800, y:142, radius:340, court:96, wall:48, scale:4, heightScale:3 };
export const CASA = { x:115, z:-120, y:6, scale:2.8 };
const DESCENT=[[-385,-400,107],[-270,-370,90],[-245,-285,64],[-330,-225,44],[-430,-180,29],[-470,-90,12],[-560,-65,4.2]];
export const ROUTE = [
  [-560,15,4.2],[-560,70,-12],[-560,115,-14],[-610,170,-14],[-665,205,-14],[-665,265,-14],[-620,305,-10],[-560,320,0],[-505,320,4.2],[-420,320,4.2],[-300,320,4.2],[-165,320,4.2],
  [-80,275,4.2],[-85,145,4.2],[-100,50,4.2],[20,0,4.2],[240,0,4.2],
  [420,-65,10],[460,-190,25],[365,-290,44],[400,-385,66],
  [475,-450,88],[515,-540,108],[455,-655,125],[350,-690,135],[340,-545,142],
  [340,-465,142],[305,-425,142],[235,-435,142],[50,-435,142],[-50,-465,142.2],[-50,-536,142.2],[-50,-592,142.2],[-50,-704,142.2],
  // The demo's courtyard approach, rising viaduct and circuit of the bastions.
  ...[[0,12,0],[8,2,0],[15,-6,0],[16,-13,1],[10,-17,3],[0,-17,8],[-16,-17,16],[-24,-17,16],
    [-34,-19,16],[-39,-25,16],[-39,-33,16],[-33,-39,16],[-24,-40,16],[0,-40,16],
    [22,-40,16],[33,-39,16],[39,-33,16],[40,-22,16],[40,0,16],[40,22,16],[39,33,16],[33,39,16],
    [22,40,16],[0,40,16],[-22,40,16],[-33,39,16],[-39,33,16],[-40,22,16],[-40,0,16],
    [-43,-17,16],[-53,-35,16],[-63,-52,16],[-74,-69,16]]
    .map(([x,z,y])=>[FORT.x+x*4,FORT.z+z*4,FORT.y+y*3+.2]),
  [-420,-1148,190.2],[-465,-1190,184],[-515,-1210,173],[-560,-1170,169],[-580,-1085,164],[-550,-950,158],[-550,-800,148],[-510,-620,140],[-465,-490,130],
  ...DESCENT,
];
export const DOCK = { x0:-630,x1:-60,z0:25,z1:365,top:4.2 };
export const CRANES = [-430,-335,-240].map(x=>({x,z:320,scale:1.7}));
export const PIERS = [{x:42,z:134,w:32,d:190},{x:180,z:121,w:32,d:165}];
export const CIVIC_PLAZA={x:-175,z:-130,radius:32};
export const TOWN_LANDMARKS = [[-285,-150,25],[-218,-212,18],[CASA.x,CASA.z,80],[CIVIC_PLAZA.x,CIVIC_PLAZA.z,CIVIC_PLAZA.radius]];
// Real closed urban blocks. Side-fronting lots turn the corners; the network
// stays below the fort's embankment instead of climbing its retaining face.
export const CITY_BLOCKS=[
  ...[-225,-110,5,120].flatMap((x,i)=>[[-385,-280],[-280,-195]].map(([z0,z1],j)=>({x0:x,x1:x+115,z0:z0+(i%2)*3,z1:z1+(i%2)*3,name:`barrio-${i}-${j}`}))),
  {x0:-450,x1:-365,z0:-250,z1:-170,name:'mercado-oeste'},
  {x0:-365,x1:-255,z0:-250,z1:-170,name:'iglesia-sur'},
  {x0:-450,x1:-365,z0:-170,z1:-75,name:'muelle-viejo'},
  {x0:-365,x1:-255,z0:-170,z1:-75,name:'plaza-iglesia'},
];
export const TOWN_STREETS=[
  ...CITY_BLOCKS.map(b=>[[b.x0,b.z0],[b.x1,b.z0],[b.x1,b.z1],[b.x0,b.z1],[b.x0,b.z0]]),
  [[-450,-75],[-265,-75],[-225,-110],[-225,-195]],
  [[-225,-195],[-225,-110],[-190,-75],[-65,-50],[20,-50],[290,-50],[290,-195],[235,-195]],
  [[5,-195],[20,-205],[290,-205]],
  [[235,-280],[290,-280],[290,-195]],
];
const streetSegments=TOWN_STREETS.flatMap(path=>path.slice(1).map((b,i)=>({a:path[i],b})));
export function townStreetDistance(x,z){
  let distance=Infinity;
  for(const {a,b}of streetSegments){const dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));distance=Math.min(distance,Math.hypot(x-a[0]-u*dx,z-a[1]-u*dz));}
  return distance;
}
export const smooth=(v,a,b)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export function roadHeight(x,z){
  // A broad western shoulder brings the town up to the descending race road.
  // Without it, carving that road into the old low plain made its adjoining
  // streets climb a 20–30 m bank within a few metres of their junctions.
  const plain=v=>4.2+138*smooth(-v,110,620);let distance=Infinity,lift=0;
  for(let i=1;i<DESCENT.length;i++){
    const a=DESCENT[i-1],b=DESCENT[i],dx=b[0]-a[0],dz=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))),
      px=a[0]+u*dx,pz=a[1]+u*dz,d=Math.hypot(x-px,z-pz);
    if(d<distance){distance=d;lift=a[2]+u*(b[2]-a[2])-plain(pz);}
  }
  return plain(z)+lift*(1-smooth(distance,30,140));
}
export function townSites(T){
  const lots=[];
  for(const block of CITY_BLOCKS){
    const {x0,x1,z0,z1}=block;
    for(let x=x0+32;x<=x1-28;x+=23){lots.push([x,z0+18,Math.PI,block.name],[x,z1-18,0,block.name]);}
    for(let z=z0+42;z<=z1-38;z+=23){lots.push([x0+18,z,-Math.PI/2,block.name],[x1-18,z,Math.PI/2,block.name]);}
  }
  for(const z of [-171,-143,-115,-87])lots.push([270,z,Math.PI/2,'costanera']);
  return lots.filter(([x,z])=>Math.abs(T.offsetOf(x,z))>T.HW+23&&!TOWN_LANDMARKS.some(([a,b,r])=>Math.hypot(x-a,z-b)<r+13))
    .map(([x,z,rot,block])=>({x,z,rot,block,y:roadHeight(x+Math.sin(rot)*18,z+Math.cos(rot)*18)-.25}));
}
export function townTerraces(x,z,h,sites,roadOffset=Infinity){
  if(roadOffset>16.5)for(const s of sites){const d=Math.max(Math.abs(x-s.x)-12,Math.abs(z-s.z)-12);if(d<8)h=mix(h,s.y,1-smooth(d,0,8));}
  // Grade the streets after the lots. A house terrace must never push its
  // flat pad into a sloping street and turn the road into repeated steps.
  if(x>-470&&x<310&&z>-395&&z<-40){const d=townStreetDistance(x,z);if(d<11)h=mix(h,roadHeight(x,z)-.65,(1-smooth(d,7,11))*smooth(roadOffset,11.5,21.5));}
  return h;
}
export function coast(x){return 39+12*Math.sin(x*.007)+6*Math.cos(x*.019);}
const boxField=(x,z,x0,z0,x1,z1)=>Math.max(x0-x,x-x1,z0-z,z-z1);
export function harborLand(x,z){return boxField(x,z,DOCK.x0,DOCK.z0,DOCK.x1,DOCK.z1)<=0||PIERS.some(p=>boxField(x,z,p.x-p.w/2,35,p.x+p.w/2,p.z+p.d/2)<=0)||boxField(x,z,394,20,425,457)<=0||boxField(x,z,-20,435,425,463)<=0;}
export function baseHeight(x,z){
  if(harborLand(x,z))return 3.65;
  const inland=1-smooth(z,coast(x)-15,coast(x)+10);
  let h=roadHeight(x,z)-.65+smooth(-z,820,1300)*(90+48*Math.sin(x*.006+z*.004)**2);
  h=mix(h,FORT.y-.65,1-smooth(Math.max(Math.abs(x-FORT.x),Math.abs(z-FORT.z)),340,380));
  h=mix(h,CASA.y-.35,1-smooth(Math.max(Math.abs(x-CASA.x)/80,Math.abs(z-CASA.z)/58),1,1.25));
  return mix(-9,h,inland);
}
// Long, physically distinct sections. These predicates also drive road color.
export const isMountain=(x,z)=>x>45&&z<-300;
export const isFort=(x,z)=>Math.abs(x-FORT.x)<340&&Math.abs(z-FORT.z)<340;
export function roadStyle(x,z){return isFort(x,z)?'stone':isMountain(x,z)?'mud':'asphalt';}
