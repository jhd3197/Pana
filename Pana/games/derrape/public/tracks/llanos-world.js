import { THREE,M,mesh,box,tube,terrain,put,foundation,scatter,instances,clear,finish,smooth,placeOnTrack } from './world-kit.js';
import { llaneroRanchHouse,corralGate,hayBale,waterWindmill,horseStable,feedingTrough,ranchFence,oldTractor,mudPuddle,ranchWaterTower } from '/engine/ranch-props.js';
import { palm,mangoTree,araguaney,reeds,waterLily } from '/engine/flora.js';
import { capybaraForm } from '/engine/landmarks.js';
import { streetFoodKiosk,cornerBodega,parkBench } from '/engine/pueblo-props.js';
import { waterSurface,waterAnimator } from '/engine/water-surface.js';
import { llaneroHorse,yardChicken,hatoCow } from '/engine/farm-animals.js';
import { baseHeight,riverDistance,ESTEROS,WATER_Y,wetlandDistance } from './llanos-layout.js';
import { grassTuft,entrance,crossing,vergePosts,dirtVerge } from './country-details.js';

export function llanosEnvironment(T){
  const group=new THREE.Group(),counts={},occupied=[],moving=[];
  const world=terrain(T,{bounds:[-650,-530,650,510],base:baseHeight,step:5,
    cut:(x,z,h)=>Math.min(h,-1.8+8*smooth(riverDistance(x,z),9,22)),
    color:(x,z,y)=>{
      const wet=Math.min(smooth(wetlandDistance(x,z),1,1.55),smooth(riverDistance(x,z),12,50));
      const c=new THREE.Color(0x4e7752).lerp(new THREE.Color(0x969c55),wet);
      return c.lerp(new THREE.Color(0xb5a36a),(.5+.5*Math.sin(x*.018)*Math.cos(z*.025))*wet*.55);
    }});group.add(world.land);world.land.name='llanos-savanna-terrain';
  const add=(parent,id,factory,x,z,{rotation=0,scale=1,radius=5,animate=false}={})=>{
    if(!clear(T,x,z,radius))throw Error(`Llanos landmark ${id} overlaps road at ${x}, ${z}`);
    counts[id]=(counts[id]||0)+1;occupied.push([x,z,radius+5]);
    const model=['ranch-house','horse-stable'].includes(id)
      ?foundation(parent,factory(),x,z,world.groundAt,{rotation,scale,radius,color:0x9a936d})
      :put(parent,factory(),x,z,world.groundAt(x,z)+.02,rotation,scale);
    if(animate)moving.push(model);return model;
  };
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
    animal.userData.footprintRadius=3;
  }
  for(const [seed,x,z,rotation,coat] of [[7,-198,116,-.6,'bay'],[11,-224,99,1.9,'palomino'],[19,263,-213,2.7,'grey']]){
    const animal=add(fauna,'llanero-horse',()=>llaneroHorse({seed,coat}),x,z,{rotation,scale:1.25,radius:3,animate:true});
    animal.userData.footprintRadius=3;
  }
  for(const [i,x,z] of [[0,-234,129],[1,-231,127],[2,-228,130],[3,-233,124],[4,-226,126],[5,246,-227],[6,250,-226],[7,248,-224]]){
    const animal=add(fauna,'yard-chicken',()=>yardChicken({seed:31+i,coat:i%3?'red':'cream'}),x,z,{rotation:i*1.7,scale:1.2,radius:1,animate:true});
    animal.userData.footprintRadius=1;
  }
  // One surface shares the terrain's grid and triangle split. Signed bed depth
  // clips the shader at the actual bank, including under both elevated bridges.
  // Overlapping pond/river meshes would leave seams and coplanar flickering.
  const vertices=[],depths=[],indices=[],nx=80,nz=208;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=-140+i*5,z=-530+j*5;vertices.push(x,WATER_Y,z);depths.push(WATER_Y-world.groundAt(x,z));
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i;
    for(const tri of [[a,a+nx+1,a+1],[a+1,a+nx+1,a+nx+2]])if(tri.some(k=>depths[k]>.015))indices.push(...tri);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));geometry.setIndex(indices);geometry.computeVertexNormals();
  const river=waterSurface(geometry,{kind:'river',color:0x4b877c,amplitude:.025});river.name='llanos-cano';river.material.uniforms.foamStrength.value=.09;
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
  for(const [x,z,rot]of [[-40,-80,.7],[16,-112,2],[137,85,-1]])if(clear(T,x,z,3))put(banks,capybaraForm(M(0x9b7954)),x,z,world.groundAt(x,z),rot,1.15);
  const banksBatch=finish(banks);banksBatch.name='estero-wildlife-landing';group.add(banksBatch);
  for(const [i,x,z]of [[0,-207,145],[1,260,-208],[2,-188,-131]])add(group,'mud-puddle',()=>mudPuddle({rx:3.1,rz:1.7,seed:49+i}),x,z,{radius:4});

  const stop=new THREE.Group();
  for(const [factory,x,z,rotation,scale,radius]of [[cornerBodega,-203,-132,.7,1.2,6],[streetFoodKiosk,-185,-122,2,1.4,4],[parkBench,-191,-137,0,1.4,2]]){
    if(clear(T,x,z,radius))foundation(stop,factory(),x,z,world.groundAt,{rotation,scale,radius});occupied.push([x,z,radius+6]);
  }
  const stopBatch=finish(stop);stopBatch.name='llanos-roadside-arepera';group.add(stopBatch);
  const dry=(x,z)=>riverDistance(x,z)>34&&wetlandDistance(x,z)>1.35&&!occupied.some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
  instances(group,grassTuft(0x929552),scatter(T,world.groundAt,{seed:415,count:2200,bounds:[-440,-365,440,290],margin:2,minY:1,scale:1.5,accept:dry}),'savanna-grasses',180);
  instances(group,mangoTree({seed:14,h:7,fruit:false}),scatter(T,world.groundAt,{seed:416,count:18,bounds:[-350,-280,-110,200],margin:9,scale:1.35,accept:dry}),'hato-shade-trees',180);
  instances(group,araguaney({seed:11}),scatter(T,world.groundAt,{seed:417,count:9,bounds:[-300,-240,290,200],margin:10,scale:1.4,accept:dry}),'savanna-araguaneyes',180);
  instances(group,palm({seed:17,h:9}),scatter(T,world.groundAt,{seed:418,count:20,bounds:[-150,-340,360,280],margin:9,scale:1.1,accept:dry}),'savanna-palms',180);
  group.userData.assetCounts=counts;const water=waterAnimator(group);
  return {group,groundAt:world.groundAt,update:t=>{water(t);moving.forEach(o=>o.userData.tick?.(t));}};
}

export function llanosScenery(group,kit,T){
  const onBridge=s=>{const p=T.pointAt(s);return riverDistance(p.x,p.y)<26;};
  group.add(crossing(T,p=>riverDistance(p.x,p.z)<26,{name:'estero-road-bridges',wood:true,color:0x9e9172}));
  group.add(vergePosts(T,{skip:onBridge,step:18}),dirtVerge(T,{shoulder:0xb3a776,rut:0x927c54,skip:onBridge}));
  const boat=kit.rowboat({color:0x9b5140});kit.at(group,boat,{x:-28,z:-66,y:WATER_Y},.4);
  const ibis={body:'#dd5039',wing:'#a93829',beak:'#484235',tail:'#6a3228'};
  for(let i=0;i<4;i++)kit.buildBird(ibis).flyCircle(group,{cx:85,cz:80,cy:17+i*3,r:42+i*10,speed:.18+i*.015,phase:i*1.4});
}
