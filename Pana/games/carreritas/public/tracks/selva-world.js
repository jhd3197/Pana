import * as THREE from 'three';
import { natureSurface } from '/engine/models/core/nature-surface.js';
import { wildCapybara } from '/engine/models/fauna/capybara/wild-capybara.js';
import { scarletMacaw } from '/engine/models/fauna/birds/scarlet-macaw.js';
import { orbitBird } from '/engine/models/animation/orbit-bird.js';
import { M, mesh, box, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import * as kit from '../track-kit.js';
import { jungleHeight, jungleRidgeHeight, riverDistance, RIVER, TUNNEL, tunnelContains, jaguarCaveContains, JAGUAR_CAVE, JAGUAR_PROFILE, LEDGE, STREAM, POND, FORD, legacyU } from './selva-layout.js';
import { caveMountain, caveFog } from './salt-cave.js';
import { jaguarCave } from './selva-cave.js';
import { mossRock } from '/engine/models/vegetation/moss-rock.js';
import { timberTrestle } from '/engine/models/props/mountain.js';
import { riverSurface } from '/engine/models/effects/water-surface.js';
import { waterfall as fallingWater } from '/engine/models/effects/waterfall.js';
import { templeTunnel } from './selva-temple.js';
import { jungleFlora } from './selva-flora.js';
import { jungleDriving } from './selva-driving.js';
import { stoneTotem, hollowLog, vineArch } from '/engine/models/props/jungle.js';
import { extendTerrain } from '/engine/worlds/coastal/world-horizon.js';

const smooth=THREE.MathUtils.smoothstep;
const mix=THREE.MathUtils.lerp;

// Free intermediate buffers after merging; never dispose cached materials.
function finish(source,cellSize=85) {
  const result=bake(source,{cellSize}),geometries=new Set();
  source.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());return result;
}

// The valley plus the northern plateau, ledge canyon and cave mountain.
const CAVE_FLOOR=new THREE.Color(0xd9b77a);
const GRID={x0:-390,z0:-465,width:960,depth:1104,nx:240,nz:276},GRID_BOUNDS=[GRID.x0,GRID.z0,GRID.x0+GRID.width,GRID.z0+GRID.depth];
function groundMesh(height,floorAt=()=>0) {
  const geo=new THREE.PlaneGeometry(GRID.width,GRID.depth,GRID.nx,GRID.nz);geo.rotateX(-Math.PI/2);geo.translate(GRID.x0+GRID.width/2,0,GRID.z0+GRID.depth/2);
  const p=geo.attributes.position,colors=[],dark=new THREE.Color(0x246440),light=new THREE.Color(0x599739),sand=new THREE.Color(0xb3a469);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i),y=height(x,z);p.setY(i,y);
    const t=0.46+0.22*Math.sin(x*0.026)*Math.cos(z*0.021)+0.08*Math.sin(x*0.1+z*0.08);
    // Cave floors are packed ochre earth, not grass (no tufts either).
    const c=dark.clone().lerp(light,t).lerp(sand,(1-smooth(riverDistance(x,z),11,22))*0.66).lerp(CAVE_FLOOR,floorAt(x,z));colors.push(c.r,c.g,c.b);
  }
  geo.computeVertexNormals();
  const stone=new THREE.Color(0x7b8270),normal=geo.attributes.normal;
  for(let i=0;i<p.count;i++) {
    // Ridges and the new cliffs (plateau lip, ledge canyon) show bare rock.
    const ridge=jungleRidgeHeight(p.getX(i),p.getZ(i)),steep=1-smooth(normal.getY(i),0.52,0.88);
    const exposed=Math.max(smooth(ridge,5,19)*steep,p.getZ(i)>90?steep*0.85:0);
    const c=new THREE.Color().fromArray(colors,i*3).lerp(stone,exposed*0.9);c.toArray(colors,i*3);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const land=mesh(natureSurface(geo,'grass'),M(0xffffff,{vertexColors:true,roughness:1,flatShading:false}));land.name='selva-terrain';
  land.userData.grassGrid={bounds:GRID_BOUNDS,nx:GRID.nx,nz:GRID.nz};return land;
}

function meshHeight(land,fallback) {
  // Match PlaneGeometry's two triangles per four-unit cell. Sampling only the
  // analytic riverbank leaves small plants floating above its coarser mesh.
  const p=land.geometry.attributes.position;
  const cell=GRID.width/GRID.nx,row=GRID.nx+1;
  return (x,z)=>{
    const gx=(x-GRID.x0)/cell,gz=(z-GRID.z0)/cell;
    if(gx<0||gx>=GRID.nx||gz<0||gz>=GRID.nz)return land.children.find(o=>o.userData.worldContinuation)?.heightAt(x,z)??fallback(x,z);
    const ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz,a=iz*row+ix;
    const ha=p.getY(a),hb=p.getY(a+row),hc=p.getY(a+row+1),hd=p.getY(a+1);
    return tx+tz<=1?ha*(1-tx-tz)+hb*tz+hd*tx:hc*(tx+tz-1)+hb*(1-tx)+hd*(1-tz);
  };
}

function pyramid() {
  const g=new THREE.Group(),stone=M(0x929578,{roughness:1}),trim=M(0xb0ac8b,{roughness:1});
  for(let tier=0;tier<6;tier++) {
    const size=38-tier*4.7;
    g.add(box(size,2.1,size,stone,0,tier*2.3+1.05,0));
    g.add(box(size+0.6,0.25,size+0.6,trim,0,tier*2.3+2.15,0));
  }
  for(let i=0;i<25;i++)g.add(box(5.4,0.52,0.85,trim,0,0.26+i*0.52,24-i*0.82));
  g.add(box(9,5,7.5,stone,0,16,0));g.add(box(3,4,0.1,M(0x293c30),0,15.5,3.82));
  g.add(box(11,0.9,9,trim,0,19,0));g.add(box(7,1.8,4,stone,0,20.3,0));
  for(const side of [-1,1])for(let row=0;row<3;row++)g.add(box(0.5,0.7,0.2,M(0x438779),side*3,15+row,3.85));
  return g;
}

const streamDistance=(()=>{const pts=STREAM;return(x,z)=>{let best=Infinity;for(let i=1;i<pts.length;i++){
  const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));}return best;};})();

export function createJungle(T) {
  const group=new THREE.Group(),statics=new THREE.Group(),animated=[],r=rng(5721);
  const ledge=u=>smooth(u,LEDGE.from,LEDGE.from+.02)*(1-smooth(u,LEDGE.to-.03,LEDGE.to));
  // The northern additions: the outer side of the ledge falls into a canyon
  // while its inner side rises as a cliff; the stream cuts its own bed.
  function northern(x,z,h) {
    const n=T.nearest(x,z),off=n.d*n.side,w=ledge(n.s/T.TOTAL);
    if(w>0)h+=w*(off>0?-26*smooth(off,T.HW-1,T.HW+8)*(1-smooth(off,T.HW+70,T.HW+120)):20*smooth(-off,T.HW+5,T.HW+24));
    const st=streamDistance(x,z);if(st<18&&n.d>T.HW+2)h=mix(h-2.4,h,smooth(st,6,14));
    if(Math.hypot(x-POND.x,z-POND.z)<POND.r+6)h=mix(h-1.8,h,smooth(Math.hypot(x-POND.x,z-POND.z),POND.r-2,POND.r+5));
    return h;
  }
  const groundAt=caveMountain(T,JAGUAR_CAVE,JAGUAR_PROFILE,(x,z)=>northern(x,z,valleyGround(x,z)),{peak:96});
  function valleyGround(x,z) {
    const d=Math.abs(T.offsetOf(x,z)),river=riverDistance(x,z);
    let land=jungleHeight(x,z)+jungleRidgeHeight(x,z)+4*Math.sin(x*0.018)*Math.cos(z*0.022);
    // Tall enclosing ridges read as a valley rather than isolated boulders.
    for(const [cx,cz,rx,rz,h] of [[-225,-120,85,160,65],[170,-300,165,75,70],[355,-140,85,180,65],[25,160,220,70,48]]) {
      land+=h*Math.exp(-(((x-cx)/rx)**2)-((z-cz)/rz)**2);
    }
    land=mix(-1.7,land,smooth(river,8,22));
    const bank=mix(T.surfaceAt(x,z)-0.32,land,smooth(d,T.HW+7,T.HW+31));
    // A broad earth terrace supports the ruin instead of a tall rectangular
    // foundation. Its rotated footprint includes a terrain-grid safety margin.
    const dx=x-190,dz=z+82,lx=Math.cos(0.4)*dx-Math.sin(0.4)*dz,lz=Math.sin(0.4)*dx+Math.cos(0.4)*dz;
    const terrace=(1-smooth(Math.max(Math.abs(lx)/25,Math.abs(lz)/29),1,1.65))*smooth(d,T.HW+7,T.HW+16);
    // Excavate beneath the raised bridge deck too, so the river continues below it.
    return mix(-1.7,mix(bank,24,terrace),smooth(river,8,13));
  }
  const terrain=groundMesh(groundAt,(x,z)=>jaguarCaveContains(T,x,z,4)?1:0),plantGround=meshHeight(terrain,groundAt);group.add(terrain);
  extendTerrain(terrain,{bounds:GRID_BOUNDS,nx:GRID.nx,nz:GRID.nz,height:groundAt,
    color:(x,z)=>new THREE.Color(0x246440).lerp(new THREE.Color(0x599739),.46+.22*Math.sin(x*.026)*Math.cos(z*.021)),biome:'selva'});
  const river=kit.waterRibbon([...RIVER].reverse(),18,{color:0x529b8b,y:0.3});river.name='selva-river';group.add(river);animated.push(river);
  const tunnel=templeTunnel(T);group.add(tunnel);
  const cave=jaguarCave(T,JAGUAR_CAVE,JAGUAR_PROFILE);group.add(cave.group);
  caveFog(T,JAGUAR_CAVE,terrain,{color:0x8cc7a6,near:30,far:340});
  // The plateau stream: a waterfall off the lip, a foaming run down the
  // valley, a ford across the road and a pond inside the loop.
  {
    const base=groundAt(STREAM[0][0],STREAM[0][1]),top=groundAt(STREAM[0][0],436),fall=fallingWater({width:12,height:Math.max(8,top-base+1),run:46,seed:61});
    fall.position.set(STREAM[0][0],base-.2,STREAM[0][1]);fall.rotation.y=Math.PI;fall.name='selva-plateau-falls';group.add(fall);animated.push(fall);
    const fordS=FORD*T.TOTAL;
    // Level across the stream: the water sits just under the carved bed's banks.
    const centre=(x,z)=>{let best=null,d=Infinity;for(let i=1;i<STREAM.length;i++){const a=STREAM[i-1],b=STREAM[i],dx=b[0]-a[0],dz=b[1]-a[1],
      t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1),px=a[0]+dx*t,pz=a[1]+dz*t,e=Math.hypot(x-px,z-pz);if(e<d){d=e;best=[px,pz];}}return best;};
    const height=(x,z)=>{
      const n=T.nearest(x,z),[cx,cz]=centre(x,z),water=plantGround(cx,cz)+.25;
      return n.d<T.HW+3&&Math.abs(n.s-fordS)<30?Math.max(water,T.heightAtS(n.s)+0.2):water;
    };
    const stream=riverSurface(STREAM,8,height,{color:0x3fbfb0,foam:true});stream.name='selva-stream';group.add(stream);animated.push(stream);
    const pond=kit.waterPond(POND.r,POND.r*.8,{color:0x47b6a6});pond.position.set(POND.x,groundAt(POND.x,POND.z)+1.2,POND.z);group.add(pond);animated.push(...pond.children);
    const footPool=kit.waterPond(9,7,{color:0x47b6a6});footPool.position.set(STREAM[0][0],base+.5,STREAM[0][1]-3);group.add(footPool);animated.push(...footPool.children);
    // Stepping stones mark the ford's edges.
    for(const side of [-1,1])for(let k=0;k<4;k++){const p=kit.placeOnTrack(T,fordS-6+k*4,side*(T.HW+1.6)),stone=mossRock({seed:k+side*7,size:.9});stone.position.set(p.x,p.y-.3,p.z);statics.add(stone);}
  }
  // Trestles (library bents) hold the road's outer edge over the canyon.
  for(let s=LEDGE.from*T.TOTAL;s<LEDGE.to*T.TOTAL;s+=7){
    const p=kit.placeOnTrack(T,s,T.HW+.6),ground=groundAt(p.x,p.z),drop=p.y-ground;
    if(drop<1.2)continue;
    const bent=timberTrestle({height:drop,width:1.6});bent.position.set(p.x,ground,p.z);bent.rotation.y=p.h+Math.PI/2;statics.add(bent);
  }
  const foundation=[];
  for(const x of [-21,0,21])for(const z of [-25,0,25])foundation.push(groundAt(190+Math.cos(0.4)*x+Math.sin(0.4)*z,-82-Math.sin(0.4)*x+Math.cos(0.4)*z));
  const top=Math.max(...foundation)+0.1,bottom=Math.min(...foundation)-0.4;
  const footing=box(41,top-bottom,49,M(0x7e876e,{roughness:1}),190,(top+bottom)/2,-82);footing.rotation.y=0.4;statics.add(footing);
  const temple=pyramid();temple.position.set(190,top,-82);temple.rotation.y=0.4;statics.add(temple);
  const reservations=[{x:190,z:-82,r:31},{x:-48,z:-187,r:24},{x:POND.x,z:POND.z,r:POND.r+3},{x:STREAM[0][0],z:STREAM[0][1],r:14},
    // The temple hall's pyramid and cenote are solid for cars too.
    ...[[-(T.HW+21),14],[T.HW+17,10.5]].map(([off,r])=>{const p=kit.placeOnTrack(T,JAGUAR_CAVE.halls[0].u*T.TOTAL,off);return {x:p.x,z:p.z,r};}),
    ...STREAM.slice(1).flatMap(([x,z],i)=>{const [px,pz]=STREAM[i];return [0,.5].map(t=>({x:px+(x-px)*t,z:pz+(z-pz)*t,r:8}));})];
  const clear=(x,z,rad=0)=>Math.abs(T.offsetOf(x,z))>T.HW+rad+3&&riverDistance(x,z)>12+rad
    &&!tunnelContains(T,x,z,rad+7)&&!jaguarCaveContains(T,x,z,rad+8)&&!reservations.some(a=>Math.hypot(x-a.x,z-a.z)<a.r+rad);
  const plantReservations=[...reservations];
  const ruins=new THREE.Group();ruins.name='selva-library-ruins';
  for(const [id,factory,u,side,radius] of [['stone-totem',stoneTotem,legacyU(.34),1,3],['vine-arch',vineArch,legacyU(.38),1,6],['hollow-log',hollowLog,legacyU(.76),-1,6]]) {
    for(let step=0;step<12;step++) {
      const p=kit.placeOnTrack(T,(u+step*.0014)*T.TOTAL,side*(T.HW+radius+12));
      if(!clear(p.x,p.z,radius)||plantReservations.some(a=>Math.hypot(p.x-a.x,p.z-a.z)<a.r+radius))continue;
      const object=factory();object.position.set(p.x,plantGround(p.x,p.z),p.z);object.rotation.y=p.h;
      object.userData.assetId=id;object.userData.footprintRadius=radius;ruins.add(object);plantReservations.push({x:p.x,z:p.z,r:radius+2});break;
    }
  }
  group.add(ruins);
  const forest=jungleFlora(T,plantGround,plantReservations);group.add(forest.group);
  for(const p of forest.placements.filter(p=>p.zone==='dry-ruins')) {
    const x=p.x+1.6,z=p.z-0.7;if(!clear(x,z,1.5))continue;
    const stone=kit.rock(1.1,0x969579,Math.floor(p.x));stone.scale.set(1.6,0.4,1.3);
    stone.position.set(x,plantGround(x,z)-0.05,z);statics.add(stone);
  }
  // Waterfall source: a broken rock escarpment feeds the long river below.
  for(let i=0;i<6;i++) {
    const x=-62+i*5,z=-192+(i%2)*2,y=groundAt(x,z);
    const rock=kit.rock(1,0x788270,47+i);rock.scale.set(5.6,14+(i%3)*2,6);rock.position.set(x,y+5,z);statics.add(rock);
  }
  const falls=kit.waterfall(7,22);falls.position.set(-43,0.4,-183);group.add(falls);animated.push(falls);
  const pool=kit.waterPond(13,11,{color:0x529b8b});pool.position.set(-43,0.29,-178);group.add(pool);animated.push(...pool.children);
  // Flat river stones, mossy ruin fragments and roots replace red tire walls.
  for(let i=0;i<110;i++) {
    const p=kit.placeOnTrack(T,r()*T.TOTAL,(r()<0.5?-1:1)*(T.HW+3+r()*5));
    if(!clear(p.x,p.z,1))continue;
    const rock=kit.rock(0.8+r()*1.2,i%3?0x64775a:0x969579,i+30);rock.scale.y=0.55;
    rock.position.set(p.x,groundAt(p.x,p.z),p.z);statics.add(rock);
  }
  group.add(finish(statics));
  group.userData.jungle={plants:forest.placements,tunnel:tunnel.userData.tunnel,river:RIVER};
  const driving=jungleDriving(T,plantGround,forest.placements,reservations);
  group.userData.jungle.colliders=driving.colliders;
  return {group,groundAt:plantGround,constrainMotion:driving.constrainMotion,update(t,dt){animated.forEach(o=>o.userData.tick?.(t,dt));cave.update(t,dt);}};
}

export function jungleScenery(group,kit,T) {
  const edges=new THREE.Group(),wood=M(0x735338,{roughness:1}),rope=M(0xc9bb84,{roughness:1});
  // Low route markers are spaced out; the road edge and flora do most of the work.
  for(let s=0;s<T.TOTAL;s+=15)for(const side of [-1,1]) {
    if(s>TUNNEL.from*T.TOTAL-12&&s<TUNNEL.to*T.TOTAL+12)continue;
    const p=kit.placeOnTrack(T,s,side*(T.HW+0.65));
    edges.add(box(0.34,1.05,0.34,wood,p.x,p.y+0.52,p.z));
    edges.add(box(0.38,0.16,0.38,rope,p.x,p.y+0.88,p.z));
  }
  group.add(finish(edges,100));
  const cross=T.paramOf(-108,-9);kit.flankBridge(group,T,cross-18,cross+18);
  const deck=new THREE.Group();
  for(let s=cross-18;s<cross+18;s+=0.9) {
    // Warp each plank to the road ribbon, including the small bend and grade.
    const vertices=[];
    for(const at of [s,s+0.84])for(const side of [1,-1]) {
      const p=kit.placeOnTrack(T,at,side*T.HW);vertices.push(p.x,p.y+0.19,p.z);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setIndex([0,2,1,1,2,3]);geo.computeVertexNormals();deck.add(mesh(geo,M(0x98764d,{roughness:1})));
  }
  for(let s=cross-15;s<=cross+15;s+=10)for(const side of [-1,1]) {
    const p=kit.placeOnTrack(T,s,side*(T.HW+0.5));deck.add(box(0.65,p.y+1,0.65,wood,p.x,(p.y-1)/2,p.z));
  }
  group.add(finish(deck));
  const sign=kit.mapSign(['Pana','Selva']),p=kit.placeOnTrack(T,T.LINE-18,T.HW+7);
  kit.at(group,sign,{...p,y:T.terrainAt(p.x,p.z)},p.h+Math.PI/2);
  kit.at(group,kit.flagPole({h:9}),kit.placeOnTrack(T,T.LINE-28,T.HW+6));
  kit.at(group,kit.rowboat({color:0x9c663e}),{x:-20,z:-72,y:0.6},1.1);
  kit.at(group,wildCapybara({seed:5}),{x:-27,z:-83,y:T.terrainAt(-27,-83)},2.2);
  group.add(orbitBird(scarletMacaw({seed:5}),{cx:-20,cz:-100,cy:24,r:24,speed:0.4,phase:1}));
}
