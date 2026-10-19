import * as THREE from 'three';
import {createSky} from '/engine/worlds/sky.js';
import {M,box,tube} from '/engine/models/core/primitives.js';
import {bake,instancePlacements} from '/engine/models/core/static-batch.js';
import {sign} from '/engine/models/core/architecture-kit.js';
import {llaneroRanchHouse,horseStable,corralGate,ranchFence,hayBale,feedingTrough,waterWindmill,ranchWaterTower,oldTractor} from '/engine/models/props/ranch.js';
import {hatoCow} from '/engine/models/fauna/farm/hato-cow.js';
import {scarletIbis} from '/engine/models/fauna/birds/scarlet-ibis.js';
import {orbitBird} from '/engine/models/animation/orbit-bird.js';
import {waterSurface,waterAnimator} from '/engine/models/effects/water-surface.js';
import {at,nearest,LENGTH,HALF_WIDTH,WATER_Y,groundAt,JUMPS,courseRoute,DAYLIGHT} from './course.js';
import {raceJumps, origin} from './options.js';
import {addLandscape} from './landscape.js';
import {placeIguanas} from '/engine/placement/iguanas.js';
import { shadowSize } from '/engine/settings.js';

// Static model prototypes are batched into instances; animated fauna/water stay live.
function plantInstances(parent,source,placements,name,id){
  instancePlacements(parent,source,placements,{name,cellSize:40,castShadow:false});
  if(id)parent.userData.assetCounts[id]=(parent.userData.assetCounts[id]||0)+placements.length;
}
export function createCourse(){
  const group=new THREE.Group();group.name='Hato Pana · Galope';
  const moving=[],reserved=[],assetCounts={};
  group.userData.assetCounts=assetCounts;group.userData.placements=[];
  const positions=[],colors=[],indices=[],depths=[],distances=[],N=144,extent=180;
  const sand=new THREE.Color(0xc6ab6e),green=new THREE.Color(0x64a63b),wet=new THREE.Color(0x3b8b52),gold=new THREE.Color(0xb8aa49);
  for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){
    const x=-extent+i*extent*2/N,z=-extent+j*extent*2/N,y=groundAt(x,z),r=nearest(x,z);
    positions.push(x,y,z);depths.push(WATER_Y-y);distances.push(r.distance);
    const c=green.clone().lerp(sand,THREE.MathUtils.smoothstep(HALF_WIDTH+3-r.distance,0,4));
    c.lerp(gold,THREE.MathUtils.smoothstep(-z,-5,75)*.32);
    if(y<1.05)c.lerp(wet,.65*(1-THREE.MathUtils.smoothstep(y,.3,1.05)));
    c.multiplyScalar(.96+.045*Math.sin(x*.14+Math.cos(z*.1))*Math.cos(z*.13)+.025*Math.sin(x*.41)*Math.cos(z*.35));colors.push(c.r,c.g,c.b);
  }
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i;indices.push(a,a+N+1,a+1,a+1,a+N+1,a+N+2);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const land=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));land.name='Wadeable savanna';land.receiveShadow=true;group.add(land);
  // Clip the trail against the actual terrain triangles. A smooth analytic
  // ribbon can cut through the coarser bank mesh and flicker at riding height.
  const path=[];
  for(let i=0;i<indices.length;i+=3){
    const polygon=indices.slice(i,i+3).map(k=>[positions[k*3],positions[k*3+1],positions[k*3+2],distances[k]]),clipped=[];
    for(let j=0;j<3;j++){
      const a=polygon[j],b=polygon[(j+1)%3],inside=a[3]<=HALF_WIDTH,nextInside=b[3]<=HALF_WIDTH;
      if(inside)clipped.push(a);
      if(inside!==nextInside){const t=(HALF_WIDTH-a[3])/(b[3]-a[3]);clipped.push(a.map((v,k)=>v+(b[k]-v)*t));}
    }
    for(let j=1;j<clipped.length-1;j++)for(const p of [clipped[0],clipped[j],clipped[j+1]])path.push(p[0],p[1]+.018,p[2]);
  }
  const trailGeo=new THREE.BufferGeometry();trailGeo.setAttribute('position',new THREE.Float32BufferAttribute(path,3));trailGeo.computeVertexNormals();
  const trail=new THREE.Mesh(trailGeo,M(0xc5a573,{roughness:1,side:THREE.DoubleSide}));trail.receiveShadow=true;trail.name='Horse trail';group.add(trail);
  // Share terrain cells and signed depth with the shader to avoid hard pond edges.
  const waterGeo=new THREE.BufferGeometry(),wp=positions.slice(),wi=[];
  for(let i=1;i<wp.length;i+=3)wp[i]=WATER_Y;
  for(let i=0;i<indices.length;i+=3){const tri=indices.slice(i,i+3);if(tri.some(k=>depths[k]>0))wi.push(...tri);}
  waterGeo.setAttribute('position',new THREE.Float32BufferAttribute(wp,3));waterGeo.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));waterGeo.setIndex(wi);waterGeo.computeVertexNormals();
  const water=waterSurface(waterGeo,{kind:'pond',color:0x289c9b,amplitude:.018,opacity:.96});water.material.uniforms.foamStrength.value=.025;water.material.uniforms.sky.value.set(0x9fdcec);water.name='Laguna and winding caño';group.add(water);
  const add=(id,model,x,z,rotation=0,scale=1,radius=4,animate=false)=>{
    if(nearest(x,z).distance<9+radius)throw Error(`Scenery in horse corridor: ${id}`);
    model.position.set(x,groundAt(x,z),z);model.rotation.y=rotation;model.scale.setScalar(scale);group.add(model);
    model.userData.assetId=id;reserved.push({x,z,r:radius+2});group.userData.placements.push({id,x,z,radius});assetCounts[id]=(assetCounts[id]||0)+1;if(animate)moving.push(model);return model;
  };
  add('ranch-house',llaneroRanchHouse(),-17,27,0,1.6,8);
  add('horse-stable',horseStable(),-42,29,.3,1.3,7);
  add('water-windmill',waterWindmill({height:13}),-3,25,0,1,3,true);
  add('ranch-water-tower',ranchWaterTower(),-33,19,0,1.3,3);
  add('old-tractor',oldTractor(),-13,13,1.2,1.2,3);
  add('feeding-trough',feedingTrough(),-28,15,.3,1.2,2);
  for(let i=0;i<5;i++)add('hay-bale',hayBale(),-45+i*2.2,17,i*.4,1,1.1);
  for(const [i,x,z]of [[0,0,-12],[1,-9,-20],[2,3,-20]])add('hato-cow',hatoCow({seed:i+7}),x,z,i*2,1.2,2,true);
  // Course-side rails leave a full nine-metre recovery corridor.
  const rails=new THREE.Group();
  for(const [a,b,off]of [[.015,.12,-11],[.48,.61,11],[.86,.96,-11]])for(let s=a*LENGTH;s<b*LENGTH;s+=7){const q=at(s,off),f=ranchFence({span:6.8});f.position.set(q.x,groundAt(q.x,q.z),q.z);f.rotation.y=q.h+Math.PI/2;rails.add(f);}
  // Two iguanas sun on fence posts beside the course (a post every 2.27 m, 1.65 m tall).
  const posts=[rails.children[3],rails.children[Math.floor(rails.children.length*.55)]].map((f,i)=>{
    f.updateMatrixWorld(true);const top=f.localToWorld(new THREE.Vector3(i?1.13:-1.13,1.66,0)),along=new THREE.Vector3(1,0,0).transformDirection(f.matrixWorld);
    return {x:top.x,y:top.y,z:top.z,up:[0,1,0],fwd:along.toArray(),pose:'perch'};
  });
  moving.push(placeIguanas(group,posts,{seed:12,scale:1.1}));assetCounts.iguana=posts.length;
  const batched=bake(rails);const oldGeo=new Set();rails.traverse(o=>{if(o.geometry)oldGeo.add(o.geometry);});oldGeo.forEach(g=>g.dispose());group.add(batched);assetCounts['ranch-fence']=rails.children.length;
  const start=at(0),gate=corralGate({span:12,open:1});gate.position.set(start.x,groundAt(start.x,start.z),start.z);gate.rotation.y=start.h;group.add(gate);assetCounts['corral-gate']=1;
  const arch=new THREE.Group();arch.position.copy(gate.position);arch.rotation.y=start.h;
  for(const s of [-1,1])arch.add(box(.25,5,.25,M(0x624a32),s*6,2.5,0));
  const title=sign(['GALOPE','HATO PANA · SALIDA / META'],10,1.1,{background:'#355a43'});title.position.set(0,4.65,0);arch.add(title);group.add(arch);
  const startTiles=[];
  for(let i=0;i<16;i++){const q=at(0,-4.5+i*.6),tile=box(.6,.035,.75,M(i%2?0xf5e7c4:0x4f5f43),q.x,groundAt(q.x,q.z)+.055,q.z);tile.rotation.y=q.h;group.add(tile);startTiles.push(tile);}
  const jumpModels=[];
  for(const jump of raceJumps({obstacles:'many'})){const q=at(jump.s),log=new THREE.Group();log.name='Jump log';log.visible=jump.id<3;log.userData.jumpId=jump.id;jumpModels.push(log);log.position.set(q.x,groundAt(q.x,q.z),q.z);log.rotation.y=q.h;
    log.add(tube([-4.6,.27,0],[4.6,.27,0],.27,M(0x735237)));
    for(const s of [-1,1]){log.add(box(.13,1.5,.13,M(0x705940),s*5.4,.75,0));const flag=new THREE.Mesh(new THREE.PlaneGeometry(.65,.43),M(s<0?0xf6e6bb:0xc96f49,{side:THREE.DoubleSide}));flag.position.set(s*5.1,1.35,0);log.add(flag);}group.add(log);
  }
  const markers=new THREE.Group();
  for(let s=15;s<LENGTH;s+=15)for(const side of [-1,1]){
    const q=at(s,side*5.8);markers.add(box(.09,.95,.09,M(0xf1dec0),q.x,groundAt(q.x,q.z)+.48,q.z));
    const cap=box(.12,.2,.12,M(side<0?0xe5ae50:0xc86646),q.x,groundAt(q.x,q.z)+1,q.z);markers.add(cap);
  }
  const markerBatch=bake(markers);markers.traverse(o=>o.geometry?.dispose());group.add(markerBatch);
  addLandscape({group,add,plantInstances,reserved});
  for(let i=0;i<3;i++){const bird=orbitBird(scarletIbis({seed:i+21}),{cx:58,cz:42,cy:13+i*3,r:23+i*4,speed:.13,phase:i*2});group.add(bird);moving.push(bird);}
  const animateWater=waterAnimator(group);group.userData.assetCounts=assetCounts;
  let disposed=false;
  return {group,groundAt,route:courseRoute,setOptions(options){const jumps=raceJumps(options);for(const log of jumpModels){const j=jumps.find(j=>j.id===log.userData.jumpId);log.visible=!!j;log.scale.y=options.jumps==='crazy'?1.9:1;}const q=at(origin(options));arch.position.set(q.x,groundAt(q.x,q.z),q.z);arch.rotation.y=q.h;gate.position.copy(arch.position);gate.rotation.y=q.h;startTiles.forEach((tile,i)=>{const t=at(origin(options),-4.5+i*.6);tile.position.set(t.x,groundAt(t.x,t.z)+.055,t.z);tile.rotation.y=t.h;});},update(t){animateWater(t);moving.forEach(o=>o.userData.tick?.(t));},
    dispose(){if(disposed)return;disposed=true;const ds=[],gs=new Set(),ms=new Set(),ts=new Set();group.traverse(o=>{if(o.userData.dispose)ds.push(o.userData.dispose);if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});ds.forEach(f=>f());gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());group.removeFromParent();}
  };
}

export function createRaceScene(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setClearColor(DAYLIGHT.horizon);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(DAYLIGHT.horizon,...DAYLIGHT.fog);
  const sky=createSky(DAYLIGHT);scene.add(sky.mesh);
  scene.add(new THREE.HemisphereLight(DAYLIGHT.hemiSky,DAYLIGHT.hemiGround,DAYLIGHT.hemiInt));
  const sun=new THREE.DirectionalLight(DAYLIGHT.sun,DAYLIGHT.sunInt);sun.position.set(-50,70,35);sun.castShadow=true;sun.shadow.mapSize.setScalar(shadowSize(1024));sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.camera.far=180;sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;scene.add(sun,sun.target);
  const course=createCourse();scene.add(course.group);
  const camera=new THREE.PerspectiveCamera(52,1,.1,450);
  return {renderer,scene,camera,sun,course,sky};
}
