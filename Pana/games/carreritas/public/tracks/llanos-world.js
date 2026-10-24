import { festive, meadow } from './festive.js';
import { groundPaint } from './ground-paint.js';
import { THREE,M,mesh,box,tube,terrain,put,foundation,scatter,instances,clear,finish,smooth,placeOnTrack } from './world-kit.js';
import { impostorLOD } from '/engine/models/core/impostor.js';
import { llaneroRanchHouse, corralGate, hayBale, waterWindmill, horseStable, feedingTrough, ranchFence, oldTractor, mudPuddle, ranchWaterTower } from '/engine/models/props/ranch.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { saman } from '/engine/models/vegetation/saman.js';
import { araguaney } from '/engine/models/vegetation/araguaney.js';
import { reeds } from '/engine/models/vegetation/reeds.js';
import { waterLily } from '/engine/models/vegetation/water-lily.js';
import { wildCapybara } from '/engine/models/fauna/capybara/wild-capybara.js';
import { scarletIbis } from '/engine/models/fauna/birds/scarlet-ibis.js';
import { orbitBird } from '/engine/models/animation/orbit-bird.js';
import { streetFoodKiosk, cornerBodega, parkBench } from '/engine/models/props/pueblo.js';
import { waterSurface, waterAnimator } from '/engine/models/effects/water-surface.js';
import { llaneroHorse } from '/engine/models/fauna/farm/llanero-horse.js';
import { yardChicken } from '/engine/models/fauna/farm/yard-chicken.js';
import { hatoCow } from '/engine/models/fauna/farm/hato-cow.js';
import { baseHeight,riverDistance,ESTEROS,WATER_Y,wetlandDistance } from './llanos-layout.js';
import { grassTuft,entrance,crossing,vergePosts,dirtVerge } from './country-details.js';
import { llanosLandscape } from './llanos-landscape.js';
import { fruitDeliveryTruck } from '/engine/models/props/fruit-delivery-truck.js';
import { waterPumpStation } from '/engine/models/props/water-pump-station.js';

export function llanosEnvironment(T){
  const group=new THREE.Group(),counts={},occupied=[],moving=[];
  const world=terrain(T,{bounds:[-650,-530,650,510],base:baseHeight,step:5,
    paint:groundPaint({tone:.11,dry:.3,dryColor:0xc4b55a,verge:.3,keep:(x,z,y)=>y<.8}),
    cut:(x,z,h)=>Math.min(h,-1.8+8*smooth(riverDistance(x,z),9,22)),
    color:(x,z,y)=>{
      const wet=Math.min(smooth(wetlandDistance(x,z),1,1.55),smooth(riverDistance(x,z),12,50));
      const c=new THREE.Color(0x368650).lerp(new THREE.Color(0x73a83e),wet);
      c.lerp(new THREE.Color(0xb8a947),(.5+.5*Math.sin(x*.018)*Math.cos(z*.025))*wet*.4);
      return wet>.5?meadow(x,z,c.getHex(),{warm:0xa9c94a,deep:0x3f9450,bloom:0xffd23f}):c.getHex();
    }});group.add(world.land);world.land.name='llanos-savanna-terrain';
  const add=(parent,id,factory,x,z,{rotation=0,scale=1,radius=5,animate=false}={})=>{
    if(!clear(T,x,z,radius))throw Error(`Llanos landmark ${id} overlaps road at ${x}, ${z}`);
    counts[id]=(counts[id]||0)+1;occupied.push([x,z,radius+5]);
    const model=['ranch-house','horse-stable'].includes(id)
      ?foundation(parent,factory(),x,z,world.groundAt,{rotation,scale,radius,color:0x9a936d})
      :put(parent,factory(),x,z,world.groundAt(x,z)+.02,rotation,scale);
    if(animate)moving.push(model);return model;
  };
  // Animals beyond 45 m of the camera are baked cards (impostor.js); their
  // grazing only runs while the real model shows.
  const herd=animal=>impostorLOD(animal,45);
  const ranch=new THREE.Group();
  add(ranch,'ranch-house',llaneroRanchHouse,-240,137,{scale:1.35,radius:6});
  add(ranch,'horse-stable',horseStable,-190,106,{rotation:-.5,scale:1.5,radius:7});
  add(ranch,'ranch-water-tower',ranchWaterTower,-211,132,{scale:1.65,radius:3});
  add(group,'water-windmill',()=>waterWindmill({height:13}),-279,122,{radius:2,animate:true});
  add(ranch,'old-tractor',oldTractor,-210,153,{rotation:.5,scale:1.2,radius:3});
  add(ranch,'feeding-trough',feedingTrough,-243,94,{rotation:Math.PI/2,scale:1.4,radius:3});
  for(const [x,z,rotation]of [[-181,122,.6],[-176,125,.6],[-178,128,.6],[-260,134,0]])add(ranch,'hay-bale',hayBale,x,z,{rotation,scale:1.3,radius:1.2});
  // The corral is an enclosure in the ranch yard, not a fence around the circuit.
  for(let x=-264;x<-216;x+=8)for(const z of [75,115]){
    if(z===115&&x>=-248&&x<-232)continue;
    const fence=ranchFence({span:8});put(ranch,fence,x+4,z,world.groundAt(x+4,z));counts['ranch-fence']=(counts['ranch-fence']||0)+1;
  }
  for(let z=79;z<115;z+=8)for(const x of [-264,-216]){put(ranch,ranchFence({span:8}),x,z,world.groundAt(x,z),Math.PI/2);counts['ranch-fence']++;}
  add(ranch,'corral-gate',()=>corralGate({span:16,open:.72}),-240,115,{radius:8});
  // Bake the posed gate only after its leaves have reached their authored angle.
  const ranchBatch=finish(ranch);ranchBatch.name='hacienda-pana-yard';group.add(ranchBatch);
  occupied.push([-240,94,36],[-193,108,20]);
  group.add(entrance(T,T.LINE-18,'HATO PANA · LOS LLANOS',{color:'#536c45'}));

  const pasture=new THREE.Group();
  add(pasture,'ranch-house',llaneroRanchHouse,242,-235,{rotation:Math.PI*.65,scale:1.3,radius:6});
  add(pasture,'horse-stable',horseStable,267,-224,{rotation:Math.PI,scale:1.25,radius:6});
  add(group,'water-windmill',()=>waterWindmill({height:11}),222,-224,{radius:2,animate:true});
  add(pasture,'feeding-trough',feedingTrough,237,-210,{scale:1.3,radius:2});
  for(let i=0;i<5;i++)add(pasture,'hay-bale',hayBale,276+i%3*2.7,-238-Math.floor(i/3)*2.8,{radius:1,rotation:i*.7,scale:1.2});
  const pastureBatch=finish(pasture);pastureBatch.name='eastern-cattle-hato';group.add(pastureBatch);
  // Long paddock rails are outside the racing corridor and follow the soil.
  const fenceLine=new THREE.Group();
  for(const [start,end,off]of [[.12,.2,17],[.57,.64,-18],[.82,.89,18]])for(let s=start*T.TOTAL;s<end*T.TOTAL;s+=8){
    const p=placeOnTrack(T,s,off);if(!clear(T,p.x,p.z,2))continue;
    put(fenceLine,ranchFence({span:7.8}),p.x,p.z,world.groundAt(p.x,p.z),p.h+Math.PI/2);counts['ranch-fence']++;
  }group.add(finish(fenceLine));
  // All cattle share the same native sculpt and rig as their Studio entry.
  const fauna=new THREE.Group();fauna.name='llanos-farm-animals';group.add(fauna);
  for(const [i,x,z]of [[0,-253,92],[1,-230,83],[2,-239,105],[3,240,-204],[4,258,-210],[5,216,-188],[6,-80,125],[7,-108,117]]){
    const animal=add(fauna,'hato-cow',()=>hatoCow({seed:41+i,coat:i%3?'pinto':'brown'}),x,z,{rotation:i*.9,scale:1.2,radius:3,animate:true});
    animal.userData.footprintRadius=3;herd(animal);
  }
  for(const [seed,x,z,rotation,coat] of [[7,-198,116,-.6,'bay'],[11,-224,99,1.9,'palomino'],[19,263,-213,2.7,'grey']]){
    const animal=add(fauna,'llanero-horse',()=>llaneroHorse({seed,coat}),x,z,{rotation,scale:1.25,radius:3,animate:true});
    animal.userData.footprintRadius=3;herd(animal);
  }
  for(const [i,x,z] of [[0,-234,129],[1,-231,127],[2,-228,130],[3,-233,124],[4,-226,126],[5,246,-227],[6,250,-226],[7,248,-224]]){
    const animal=add(fauna,'yard-chicken',()=>yardChicken({seed:31+i,coat:i%3?'red':'cream'}),x,z,{rotation:i*1.7,scale:1.2,radius:1,animate:true});
    animal.userData.footprintRadius=1;herd(animal);
  }
  // One surface shares the terrain's grid and triangle split. Signed bed depth
  // clips the shader at the actual bank, including under both elevated bridges.
  // Overlapping pond/river meshes would leave seams and coplanar flickering.
  const vertices=[],depths=[],indices=[],nx=100,nz=400;
  // Continue to the rounded ends of the caño instead of chopping the water at
  // the old rectangle. groundAt also interpolates the real outer bank triangles.
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=-140+i*5,z=-1000+j*5,bed=world.groundAt(x,z);
    vertices.push(x,WATER_Y,z);depths.push(WATER_Y-bed);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i;
    for(const tri of [[a,a+nx+1,a+1],[a+1,a+nx+1,a+nx+2]])if(tri.some(k=>depths[k]>.015))indices.push(...tri);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));geometry.setIndex(indices);geometry.computeVertexNormals();
  const river=waterSurface(geometry,{kind:'river',color:0x289a97,amplitude:.025});river.name='llanos-cano';river.material.uniforms.foamStrength.value=.09;
  const wetlands=new THREE.Group();wetlands.name='llanos-connected-wetlands';wetlands.add(river);group.add(wetlands);
  const banks=new THREE.Group(),lilies=[],reedSpots=[],palms=[];
  for(const [j,p]of ESTEROS.entries())for(let i=0;i<20;i++){
    const a=i*Math.PI/10+j,x=p.x+Math.cos(a)*p.rx*1.12,z=p.z+Math.sin(a)*p.rz*1.12;
    if(clear(T,x,z,4))reedSpots.push({x,z,y:world.groundAt(x,z),rot:a,scale:1.5});
    if(i%3===0&&clear(T,x+5,z+5,6))palms.push({x:x+5,z:z+5,y:world.groundAt(x+5,z+5),rot:a,scale:1+i%3*.12});
    if(i%3===0){const lx=p.x+Math.cos(a)*p.rx*.67,lz=p.z+Math.sin(a)*p.rz*.67;lilies.push({x:lx,z:lz,y:WATER_Y+.04,rot:a,scale:1.7});}
  }
  for(let i=0;i<54;i++){
    const x=145+Math.sin(i*2.4)*45,z=-125+i*5.4,y=world.groundAt(x,z);
    if(y>WATER_Y+.5&&clear(T,x,z,7)&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r))palms.push({x,z,y,rot:i*2.4,scale:1.1+i%4*.13});
  }
  instances(group,reeds({seed:32}),reedSpots,'estero-reeds',180);
  instances(group,waterLily({seed:34}),lilies,'estero-water-lilies',180);
  instances(group,palm({seed:41,h:10}),palms,'morichal-palms',180);
  // A fisherman's landing and grazing capybaras make the wetland readable.
  banks.add(box(3.2,.25,15,M(0x998360),-30,1.2,-67));
  for(const x of [-31.4,-28.6])for(const z of [-73,-68,-62])banks.add(box(.2,3,.2,M(0x6c6047),x,-.2,z));
  for(const [i,[x,z,rot]]of [[-40,-80,.7],[16,-112,2],[137,85,-1]].entries())if(clear(T,x,z,3)){
    const capy=put(group,wildCapybara({seed:10+i}),x,z,world.groundAt(x,z),rot,1.15);moving.push(capy);
  }
  const banksBatch=finish(banks);banksBatch.name='estero-wildlife-landing';group.add(banksBatch);
  for(const [i,x,z]of [[0,-207,145],[1,260,-208],[2,-188,-131]])add(group,'mud-puddle',()=>mudPuddle({rx:3.1,rz:1.7,seed:49+i}),x,z,{radius:4});

  const stop=new THREE.Group();
  for(const [factory,x,z,rotation,scale,radius]of [[cornerBodega,-203,-132,.7,1.2,6],[streetFoodKiosk,-185,-122,2,1.4,4],[parkBench,-191,-137,0,1.4,2]]){
    if(clear(T,x,z,radius))foundation(stop,factory(),x,z,world.groundAt,{rotation,scale,radius});occupied.push([x,z,radius+6]);
  }
  const stopBatch=finish(stop);stopBatch.name='llanos-roadside-arepera';group.add(stopBatch);
  const truck=foundation(group,fruitDeliveryTruck(),-172,-112,world.groundAt,{rotation:2.1,scale:1.35,radius:5,color:0x9a936d});
  truck.userData.footprintRadius=5;truck.userData.support='llanos-arepera';counts['fruit-delivery-truck']=1;occupied.push([-172,-112,12]);
  const pump=foundation(group,waterPumpStation(),-52,-62,world.groundAt,{rotation:0.5,scale:1.25,radius:6,color:0x9a936d});
  pump.userData.footprintRadius=6;pump.userData.support='estero-bank';counts['water-pump-station']=1;occupied.push([-52,-62,12]);
  const dry=(x,z)=>riverDistance(x,z)>34&&wetlandDistance(x,z)>1.35&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
  instances(group,grassTuft(0x7f9f3c),scatter(T,world.groundAt,{seed:415,count:2200,bounds:[-440,-365,440,290],margin:2,minY:1,scale:1.5,accept:dry}),'savanna-grasses',180);
  instances(group,mangoTree({seed:14,h:7,fruit:false}),scatter(T,world.groundAt,{seed:416,count:18,bounds:[-350,-280,-110,200],margin:9,scale:1.35,accept:dry}),'hato-shade-trees',180);
  // A few wide samanes, the llano's shade tree, stand apart in the pastures.
  instances(group,saman({seed:15}),scatter(T,world.groundAt,{seed:419,count:6,bounds:[-350,-280,-110,200],margin:16,accept:dry}),'hato-samanes',180);
  instances(group,araguaney({seed:11}),scatter(T,world.groundAt,{seed:417,count:9,bounds:[-300,-240,290,200],margin:10,scale:1.4,accept:dry}),'savanna-araguaneyes',180);
  instances(group,palm({seed:17,h:9}),scatter(T,world.groundAt,{seed:418,count:20,bounds:[-150,-340,360,280],margin:9,scale:1.1,accept:dry}),'savanna-palms',180);
  const landscape=llanosLandscape(T,world,occupied);group.add(landscape);group.userData.surroundings=landscape.userData.surroundings;
  group.userData.assetCounts=counts;const water=waterAnimator(group);
  return {group,groundAt:world.groundAt,update:t=>{water(t);moving.forEach(o=>{if(o.visible)o.userData.tick?.(t);});}};
}

export function llanosScenery(group,kit,T){
  const onBridgeS=s=>{const p=T.pointAt(s);return riverDistance(p.x,p.y)<30;};
  const onBridge=s=>{const p=T.pointAt(s);return riverDistance(p.x,p.y)<26;};
  group.add(crossing(T,p=>riverDistance(p.x,p.z)<26,{name:'estero-road-bridges',wood:true,color:0x9e9172}));
  group.add(vergePosts(T,{skip:onBridge,step:18}),dirtVerge(T,{shoulder:0xb3a776,skip:onBridge}));
  const boat=kit.rowboat({color:0x9b5140});kit.at(group,boat,{x:-28,z:-66,y:WATER_Y},.4);
  for(let i=0;i<4;i++)group.add(orbitBird(scarletIbis({seed:20+i}),{cx:85,cz:80,cy:17+i*3,r:42+i*10,speed:.18+i*.015,phase:i*1.4}));
  // Fiesta llanera: araguaneyes in bloom, joropo bunting, ibis and macaw flocks.
  festive(group,T,{seed:19,minY:WATER_Y+.35,skip:onBridgeS,stands:300,banners:420,bunting:220,balloons:160,flags:220,butterflies:40,
    trees:[['araguaney',24,[2,24]],['apamate',14,[2,24]],['bucare',8,[4,24]]],
    plants:[['hibiscus',30],['heliconia',20],['bromeliad',30,[0,6]]],
    birds:[{kind:'ibis',flocks:3,size:6,height:[12,22]},{kind:'macaw',flocks:2,size:4}],
    vista:{shape:'peak',hills:30,height:[140,260],colors:[0x8aa7d8,0x9a9ad8,0x7fb0d0],balloons:5}});
}
