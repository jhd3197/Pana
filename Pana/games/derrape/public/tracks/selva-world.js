import * as THREE from 'three';
import { wildCapybara,scarletMacaw,orbitBird } from '/engine/wildlife.js';
import { M, mesh, box, rng } from '/engine/props.js';
import { bake } from '/engine/flora.js';
import * as kit from '../track-kit.js';
import { jungleHeight, jungleRidgeHeight, riverDistance, RIVER, TUNNEL, tunnelContains } from './selva-layout.js';
import { templeTunnel } from './selva-temple.js';
import { jungleFlora } from './selva-flora.js';
import { jungleDriving } from './selva-driving.js';
import { stoneTotem,hollowLog,vineArch } from '/engine/jungle-props.js';

const smooth=THREE.MathUtils.smoothstep;
const mix=THREE.MathUtils.lerp;

// Free intermediate buffers after merging; never dispose cached materials.
function finish(source,cellSize=85) {
  const result=bake(source,{cellSize}),geometries=new Set();
  source.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());return result;
}

function groundMesh(height) {
  const geo=new THREE.PlaneGeometry(880,740,220,185);geo.rotateX(-Math.PI/2);geo.translate(50,0,-95);
  const p=geo.attributes.position,colors=[],dark=new THREE.Color(0x31593e),light=new THREE.Color(0x6d8847),sand=new THREE.Color(0x9b9970);
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i),y=height(x,z);p.setY(i,y);
    const t=0.46+0.22*Math.sin(x*0.026)*Math.cos(z*0.021)+0.08*Math.sin(x*0.1+z*0.08);
    const c=dark.clone().lerp(light,t).lerp(sand,(1-smooth(riverDistance(x,z),11,22))*0.66);colors.push(c.r,c.g,c.b);
  }
  geo.computeVertexNormals();
  const stone=new THREE.Color(0x7b8270),normal=geo.attributes.normal;
  for(let i=0;i<p.count;i++) {
    const ridge=jungleRidgeHeight(p.getX(i),p.getZ(i)),exposed=smooth(ridge,5,19)*(1-smooth(normal.getY(i),0.52,0.88));
    const c=new THREE.Color().fromArray(colors,i*3).lerp(stone,exposed*0.9);c.toArray(colors,i*3);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const land=mesh(geo,M(0xffffff,{vertexColors:true,roughness:1,flatShading:false}));land.name='selva-terrain';return land;
}

function meshHeight(land,fallback) {
  // Match PlaneGeometry's two triangles per four-unit cell. Sampling only the
  // analytic riverbank leaves small plants floating above its coarser mesh.
  const p=land.geometry.attributes.position;
  return (x,z)=>{
    const gx=(x+390)/4,gz=(z+465)/4;
    if(gx<0||gx>=220||gz<0||gz>=185)return fallback(x,z);
    const ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz,a=iz*221+ix;
    const ha=p.getY(a),hb=p.getY(a+221),hc=p.getY(a+222),hd=p.getY(a+1);
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

export function createJungle(T) {
  const group=new THREE.Group(),statics=new THREE.Group(),animated=[],r=rng(5721);
  function groundAt(x,z) {
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
  const terrain=groundMesh(groundAt),plantGround=meshHeight(terrain,groundAt);group.add(terrain);
  const river=kit.waterRibbon([...RIVER].reverse(),18,{color:0x529b8b,y:0.3});river.name='selva-river';group.add(river);animated.push(river);
  const tunnel=templeTunnel(T);group.add(tunnel);
  const foundation=[];
  for(const x of [-21,0,21])for(const z of [-25,0,25])foundation.push(groundAt(190+Math.cos(0.4)*x+Math.sin(0.4)*z,-82-Math.sin(0.4)*x+Math.cos(0.4)*z));
  const top=Math.max(...foundation)+0.1,bottom=Math.min(...foundation)-0.4;
  const footing=box(41,top-bottom,49,M(0x7e876e,{roughness:1}),190,(top+bottom)/2,-82);footing.rotation.y=0.4;statics.add(footing);
  const temple=pyramid();temple.position.set(190,top,-82);temple.rotation.y=0.4;statics.add(temple);
  const reservations=[{x:190,z:-82,r:31},{x:-48,z:-187,r:24}];
  const clear=(x,z,rad=0)=>Math.abs(T.offsetOf(x,z))>T.HW+rad+3&&riverDistance(x,z)>12+rad
    &&!tunnelContains(T,x,z,rad+7)&&!reservations.some(a=>Math.hypot(x-a.x,z-a.z)<a.r+rad);
  const plantReservations=[...reservations];
  const ruins=new THREE.Group();ruins.name='selva-library-ruins';
  for(const [id,factory,u,side,radius] of [['stone-totem',stoneTotem,.34,1,3],['vine-arch',vineArch,.38,1,6],['hollow-log',hollowLog,.76,-1,6]]) {
    for(let step=0;step<12;step++) {
      const p=kit.placeOnTrack(T,(u+step*.003)*T.TOTAL,side*(T.HW+radius+12));
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
  return {group,groundAt:plantGround,constrainMotion:driving.constrainMotion,update(t,dt){animated.forEach(o=>o.userData.tick?.(t,dt));}};
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
