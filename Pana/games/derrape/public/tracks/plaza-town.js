// A complete pueblo around a temporary street circuit.
import * as THREE from 'three';
import { natureSurface } from '/engine/models/core/nature-surface.js';
import { createPlazaEnvironment } from '/engine/plaza.js';
import { house } from '/engine/models/props/plaza-buildings.js';
import { marketStall, streetLamp, bench } from '/engine/models/props/plaza.js';
import { M, mesh, box, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { palm } from '/engine/models/vegetation/palm.js';
import { mangoTree } from '/engine/models/vegetation/mango-tree.js';
import { ceiba } from '/engine/models/vegetation/ceiba.js';
import { AVENUES, STREETS, BLOCKS, STREET_HALF, townHeight, streetDistance } from './plaza-layout.js';
import { waterfrontHeight,overWater,createWaterfront } from './plaza-waterfront.js';
import { waterAnimator } from '/engine/models/effects/water-surface.js';
import { colonialHouse, busStopShelter } from '/engine/models/props/pueblo.js';
import { extendTerrain } from './world-horizon.js';
import { plazaOutskirts } from './plaza-outskirts.js';
import { plazaBandstand } from '/engine/models/props/plaza-bandstand.js';
import { cafeTerrace } from '/engine/models/props/cafe-terrace.js';
import { ceramicFountain } from '/engine/models/props/ceramic-fountain.js';
import { iceCreamCart } from '/engine/models/props/ice-cream-cart.js';
import { fruitDeliveryTruck } from '/engine/models/props/fruit-delivery-truck.js';
import { laundryCourtyard } from '/engine/models/props/laundry-courtyard.js';
import { streetMural } from '/engine/models/props/street-mural.js';

const COLORS=[0xedaf3f,0x35b4aa,0xeb7658,0x8ab34f,0xf2d38b,0x459fc6];
const PAVING=0xd2bd95, ROAD=0x8b958c;

function surface(x0,z0,x1,z1,height,color,step=5,include=()=>true) {
  const nx=Math.ceil((x1-x0)/step),nz=Math.ceil((z1-z0)/step),verts=[],indices=[];
  for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++) {
    const x=THREE.MathUtils.lerp(x0,x1,ix/nx),z=THREE.MathUtils.lerp(z0,z1,iz/nz);
    verts.push(x,height(x,z),z);
  }
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++) {
    const a=iz*(nx+1)+ix,b=a+1,c=a+nx+1,d=c+1;
    if([a,b,c,d].every(i=>include(verts[i*3],verts[i*3+2])))indices.push(a,c,b,b,c,d);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  return mesh(geo,M(color,{flatShading:false,roughness:1}));
}

export function createTown(T) {
  const group=new THREE.Group(),ground=new THREE.Group(),buildings=new THREE.Group(),plants=new THREE.Group();
  const random=rng(391),placements=[],trees=[],clear=(x,z,r=0)=>Math.abs(T.offsetOf(x,z))>T.HW+r+2;
  // A level cross-section through the hill supports roads, paving and foundations.
  let horizon;
  function groundAt(x,z) {
    if(horizon&&(x<-650||x>850||z<-700||z>600))return horizon.heightAt(x,z)??waterfrontHeight(x,z,townHeight(x,z)-.3);
    const d=Math.abs(T.offsetOf(x,z)),blend=THREE.MathUtils.smoothstep(d,T.HW+8,T.HW+25);
    const land=waterfrontHeight(x,z,townHeight(x,z)-0.3);
    return overWater(x,z)?land:THREE.MathUtils.lerp(T.surfaceAt(x,z)-0.3,land,blend);
  }
  const land=surface(-650,-700,850,600,groundAt,0xffffff,5);
  const p=land.geometry.attributes.position,colors=[],lawn=new THREE.Color(0x6aa746),dry=new THREE.Color(0xb2b76a);
  for(let i=0;i<p.count;i++) {
    const c=lawn.clone().lerp(dry,0.26+0.16*Math.sin(p.getX(i)*0.013)*Math.cos(p.getZ(i)*0.017));colors.push(c.r,c.g,c.b);
  }
  land.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  natureSurface(land.geometry,'grass');
  land.userData.grassGrid={bounds:[-650,-700,850,600],nx:300,nz:260};
  land.material=M(0xffffff,{vertexColors:true,flatShading:false,roughness:1});land.name='plaza-terrain';group.add(land);
  horizon=extendTerrain(land,{bounds:[-650,-700,850,600],nx:300,nz:260,height:groundAt,biome:'plaza',
    color:(x,z)=>lawn.clone().lerp(dry,.26+.16*Math.sin(x*.013)*Math.cos(z*.017))});

  // Streets extend through junctions into the outskirts, independently of the lap.
  for(const x of AVENUES)ground.add(surface(x-STREET_HALF,-355,x+STREET_HALF,x>265?275:325,(x,z)=>groundAt(x,z)+0.2,ROAD,2));
  for(const z of STREETS)ground.add(surface(-355,z-STREET_HALF,465,z+STREET_HALF,(x,z)=>groundAt(x,z)+0.21,ROAD,2));
  // Main avenues keep going beyond the built blocks toward neighboring towns.
  for(const z of [-200,60])for(const [a,b] of [[-590,-355],[465,710]])ground.add(surface(a,z-STREET_HALF,b,z+STREET_HALF,(x,z)=>groundAt(x,z)+0.21,ROAD,2));
  for(const [a,b] of [[-420,-355],[325,430]])ground.add(surface(195-STREET_HALF,a,195+STREET_HALF,b,(x,z)=>groundAt(x,z)+0.2,ROAD,2));
  const outsideLane=(x,z)=>clear(x,z,1.5);
  for(const b of BLOCKS) {
    ground.add(surface(b.x0+11,b.z0+11,b.x1-11,b.z1-11,(x,z)=>groundAt(x,z)+0.3,PAVING,2));
    if(b.kind!=='historic')ground.add(surface(b.x0+27,b.z0+27,b.x1-27,b.z1-27,(x,z)=>groundAt(x,z)+0.5,b.kind==='market'?0xdcb889:0x98b377,2,outsideLane));
  }
  for(const x of AVENUES)for(const z of STREETS)for(const side of [-1,1])for(let k=-3;k<=3;k++) {
    ground.add(surface(x+k*2.3-0.65,z+side*15-1.5,x+k*2.3+0.65,z+side*15+1.5,(x,z)=>groundAt(x,z)+0.24,0xe4dfc9,1));
    ground.add(surface(x+side*15-1.5,z+k*2.3-0.65,x+side*15+1.5,z+k*2.3+0.65,(x,z)=>groundAt(x,z)+0.25,0xe4dfc9,1));
  }
  const prototypes=Array.from({length:12},(_,i)=>i%5===4?colonialHouse({color:COLORS[i%6],seed:11+i}):house({w:7.3+(i%3)*.4,h:i%3===0?5.4:7.1+(i%2)*.8,color:COLORS[(i*5+Math.floor(i/4))%6],seed:i+21,style:['tejas','balcon','tienda','terraza'][i%4]})),occupied=[];
  function landmark(model,x,z,turn=0,scale=1,radius=4,lift=0.35) {
    const samples=[[0,0],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]].map(([dx,dz])=>groundAt(x+dx,z+dz));
    const y=Math.max(...samples)+lift,bottom=Math.min(...samples)-0.15;
    const pad=box(radius*1.85,y-bottom,radius*1.85,M(0xd6c39b),x,(y+bottom)/2,z);
    pad.rotation.y=turn;buildings.add(pad);
    model.position.set(x,y,z);model.rotation.y=turn;model.scale.setScalar(scale);
    model.userData.footprintRadius=radius;model.userData.support='town-plinth';group.add(model);
    occupied.push({x,z});return model;
  }
  landmark(cafeTerrace(),-162,78,0,1.35,4.5,0.35);
  const fountain=landmark(ceramicFountain(),-137.5,80,0,1.45,4.2,0.6);
  landmark(iceCreamCart(),-112,76,-0.3,1.6,2.2,0.35);
  landmark(fruitDeliveryTruck(),148,43,Math.PI/2,1.4,4.2,0.35);
  landmark(laundryCourtyard(),224,-110,0.4,1.35,4.2,0.35);
  landmark(streetMural(),272,-103,Math.PI,1.4,3.8,0.35);
  function building(x,z,turn,seed,scale=1) {
    if(groundAt(x,z)<-0.4||x>270&&z>280)return;
    if(!clear(x,z,10*scale)||streetDistance(x,z)<STREET_HALF+8.5*scale||(Math.abs(x)<68&&z>-57&&z<48)||occupied.some(p=>Math.hypot(x-p.x,z-p.z)<12*scale))return;
    const width=11.6*scale,depth=11*scale;
    const samples=[[0,0],[-width/2,-depth/2],[width/2,-depth/2],[-width/2,depth/2],[width/2,depth/2]].map(([a,b])=>
      groundAt(x+Math.cos(turn)*a+Math.sin(turn)*b,z-Math.sin(turn)*a+Math.cos(turn)*b));
    const y=Math.max(...samples)+0.24,bottom=Math.min(...samples)-0.15;
    const base=box(width,y-bottom,depth,M(0xb6aa8c),x,bottom+(y-bottom)/2,z);base.rotation.y=turn;buildings.add(base);
    const h=prototypes[seed%prototypes.length].clone(true);h.position.set(x,y,z);h.rotation.y=turn;
    h.scale.set(1.24*scale,(1.35+(seed%4)*0.15)*scale,1.75*scale);buildings.add(h);
    placements.push({x,z,y,base:bottom,turn,width,depth});occupied.push({x,z});
  }
  // Four street fronts around each garden. These placements do not follow T.
  for(const b of BLOCKS) {
    if(['historic','park','lookout'].includes(b.kind))continue;
    let n=b.col*43+b.row*71;const margin=b.kind==='market'?28:24;
    for(let x=b.x0+30;x<=b.x1-26;x+=16.5){building(x,b.z0+margin,Math.PI,n++);building(x,b.z1-margin,0,n++);}
    for(let z=b.z0+43;z<=b.z1-38;z+=17){building(b.x0+24,z,-Math.PI/2,n++);building(b.x1-24,z,Math.PI/2,n++);}
  }
  // More homes beyond the grid prevent the city ending at the race boundary.
  for(let x=-280;x<420;x+=30){building(x,-337,0,Math.floor(x+400),0.86);building(x,303,Math.PI,Math.floor(x+500),0.86);}
  for(let z=-290;z<280;z+=31){building(-329,z,Math.PI/2,Math.floor(z+400),0.86);building(434,z,-Math.PI/2,Math.floor(z+500),0.86);}
  function tree(x,z,seed,large=false) {
    if(groundAt(x,z)<-0.4||x>270&&z>280)return;
    if(!clear(x,z,6)||streetDistance(x,z)<15||occupied.some(p=>Math.hypot(x-p.x,z-p.z)<9))return;
    const model=large?ceiba({seed}):seed%3?mangoTree({seed,h:6+seed%3,fruit:false}):palm({seed,h:9+seed%4});
    const lift=x>-300&&x<405&&z>-310&&z<275?0.47:0.03;
    model.position.set(x,groundAt(x,z)+lift,z);plants.add(model);trees.push({x,z});
  }
  for(const b of BLOCKS) {
    const x=(b.x0+b.x1)/2,z=(b.z0+b.z1)/2,seed=b.col*31+b.row*7;
    if(b.kind==='historic')continue;
    if(b.kind==='homes'){tree(x,z,seed);if(b.x1-b.x0>130)tree(x+22,z,seed+1);}
    if(b.kind==='park') {
      for(let i=0;i<9;i++)tree(x+(i%3-1)*22,z+(Math.floor(i/3)-1)*22,seed+i,true);
      ground.add(surface(x-2,b.z0+12,x+2,b.z1-12,(x,z)=>groundAt(x,z)+0.56,0xdfc99e,2,outsideLane));
    }
    if(b.kind==='market') {
      for(let row=0;row<2;row++)for(let i=0;i<5;i++) {
        const px=x-25+i*12,pz=z-12+row*24;if(!clear(px,pz,5))continue;
        const stall=marketStall({seed:8+i+row*5});stall.scale.setScalar(1.5);stall.position.set(px,groundAt(px,pz)+0.24,pz);
        stall.rotation.y=row*Math.PI;buildings.add(stall);
      }
      tree(x-35,z,51);tree(x+35,z,54);
    }
    if(b.kind==='lookout') {
      const levels=Array.from({length:32},(_,i)=>groundAt(x+Math.cos(i*Math.PI/16)*25,z+Math.sin(i*Math.PI/16)*25));
      const y=Math.max(...levels)+0.4,bottom=Math.min(...levels)-0.3;
      buildings.add(mesh(new THREE.CylinderGeometry(24,25,y-bottom,32),M(0xc9b68e),x,(y+bottom)/2,z));
      const pavilion=plazaBandstand();
      pavilion.scale.setScalar(1.5);pavilion.position.set(x,y,z-5);
      pavilion.userData.footprintRadius=14;pavilion.userData.support='lookout-terrace';group.add(pavilion);
      for(let i=0;i<10;i++) {
        const pz=z+15+i*2.4,base=groundAt(x,pz)-0.2,top=THREE.MathUtils.lerp(y,groundAt(x,z+39)+0.3,i/10);
        const h=Math.max(0.25,top-base);buildings.add(box(12,h,2.6,M(0xe3cda5),x,base+h/2,pz));
      }
      for(const side of [-1,1]){const seat=bench();seat.scale.setScalar(1.6);seat.position.set(x+side*14,y,z+7);buildings.add(seat);tree(x+side*32,z-10,89+side,true);}
    }
  }
  for(const x of AVENUES)for(const z of STREETS) {
    const px=x+15,pz=z+15;if(!clear(px,pz,2))continue;
    const lamp=streetLamp();lamp.scale.setScalar(1.7);lamp.position.set(px,groundAt(px,pz)+0.22,pz);buildings.add(lamp);
  }
  for(let i=0;i<80;i++) {
    const x=-480+random()*1120,z=-520+random()*1010;
    if(x>-345&&x<450&&z>-355&&z<325)continue;
    tree(x,z,700+i,i%4===0);
  }
  const plaza=createPlazaEnvironment({town:true,clearance:(x,z,r)=>clear(x*2,z*2,r*2)});
  const stop=busStopShelter(),sx=-171,sz=146;
  if(clear(sx,sz,4)&&streetDistance(sx,sz)>STREET_HALF+4) {
    stop.position.set(sx,groundAt(sx,sz)+.3,sz);stop.rotation.y=Math.PI;
    stop.userData.assetId='bus-stop-shelter';stop.userData.footprintRadius=4;group.add(stop);
  }
  plaza.group.scale.setScalar(2);group.add(plaza.group);
  const outskirts=plazaOutskirts(T,groundAt,building,occupied);group.add(outskirts);group.userData.surroundings=outskirts.userData.surroundings;
  group.add(bake(ground,{cellSize:350}),bake(buildings,{cellSize:350}),bake(plants,{cellSize:350}));
  group.add(createWaterfront(T));
  const privateGeometries=new Set();
  for(const root of [ground,buildings,plants,...prototypes])root.traverse(o=>{if(o.geometry)privateGeometries.add(o.geometry);});
  privateGeometries.forEach(g=>g.dispose());
  group.userData.town={blocks:BLOCKS,buildings:placements,trees,avenues:AVENUES,streets:STREETS};
  const animateWater=waterAnimator(group);
  return {group,groundAt,update(t,dt){plaza.update?.(t,dt);fountain.userData.tick?.(t);animateWater(t);}};
}

export function raceEdges(group,kit,T) {
  const edges=new THREE.Group(),cream=M(0xe4d8b9),red=M(0xb9654e);
  // Low urban kerbs replace the enclosing stacks of tyres.
  for(let s=0;s<T.TOTAL;s+=4)for(const side of [-1,1]) {
    const p=kit.placeOnTrack(T,s,side*(T.HW+0.5));
    kit.at(edges,box(0.65,0.45,4.15,Math.floor(s/16)%2?cream:red),{...p,y:p.y+0.225},p.h);
  }
  // Temporary barriers close side streets for the race while preserving views.
  for(const x of AVENUES)for(const z of STREETS)for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const px=x+dx*24,pz=z+dz*24,d=Math.abs(T.offsetOf(px,pz));if(d<T.HW+7||d>T.HW+23)continue;
    const gate=new THREE.Group();gate.add(box(12,0.7,0.35,cream,0,1.05,0));
    for(const sx of [-4.7,4.7])gate.add(box(0.28,1.4,0.6,red,sx,0.7,0));
    for(let i=-5;i<=5;i+=2)gate.add(box(0.65,0.72,0.39,red,i,1.05,0));
    kit.at(edges,gate,{x:px,z:pz,y:T.terrainAt(px,pz)+0.15},dx?Math.PI/2:0);
  }
  group.add(bake(edges,{cellSize:200}));edges.traverse(o=>o.geometry?.dispose());
}
