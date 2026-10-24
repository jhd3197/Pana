// Game-local world construction: terrain, spatial instances and road furniture.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { bake, instancePlacements } from '/engine/models/core/static-batch.js';
import { terrainMaterial } from '/engine/worlds/terrain-material.js';
import { natureSurface } from '/engine/models/core/nature-surface.js';
import { signBoard } from '/engine/models/props/wood-sign.js';
import { placeOnTrack } from '../track-kit.js';
import { waterSurface, waterDepthMap, riverSurface } from '/engine/models/effects/water-surface.js';
import { extendTerrain, extendWaterPlane } from '/engine/worlds/coastal/world-horizon.js';
export { THREE, M, mesh, box, tube, rng, placeOnTrack };
// Every circuit board is the library's cartoon signBoard; the old flat colour
// becomes a brighter trim around the wooden panel.
export function sign(text,w,h,{background='#285b58'}={}){return signBoard({lines:text,w,h,accent:'#'+new THREE.Color(background).offsetHSL(0,.12,.16).getHexString()});}
export const smooth=THREE.MathUtils.smoothstep, mix=THREE.MathUtils.lerp;
export const hill=(x,z,cx,cz,rx,rz,h)=>h*Math.exp(-(((x-cx)/rx)**2)-((z-cz)/rz)**2);

export function finish(root,cellSize=110) {
  // Solid-colour props share batches through vertex colours (bake's tint).
  const out=bake(root,{cellSize,tint:true}),geos=new Set(),textures=new Set(),materials=new Set(out.userData.tinted);
  root.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of [].concat(o.material||[]))if(m.map?.isCanvasTexture){textures.add(m.map);materials.add(m);}});
  geos.forEach(g=>g.dispose());if(materials.size)out.userData.dispose=()=>{textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());};return out;
}

// Keep prototypes out of the live scene; each spatial cell owns its buffers.
// Shared with Galope and Curiara: engine/models/core/static-batch.js.
export function instances(parent,source,placements,name,cellSize=110) {instancePlacements(parent,source,placements,{name,cellSize});}

// `paint` is ground-paint.js's groundPaint(recipe), passed in by the map's own
// lazily loaded module so the shared kit stays out of the first load.
export function terrain(T,{bounds,base,color,name='world-terrain',step=5,carve=true,cut=(x,z,h)=>h,paint}) {
  const [x0,z0,x1,z1]=bounds,nx=Math.ceil((x1-x0)/step),nz=Math.ceil((z1-z0)/step),dx=(x1-x0)/nx,dz=(z1-z0)/nz;
  const height=(x,z)=>{
    const land=base(x,z);if(!carve)return cut(x,z,land);
    const d=Math.abs(T.offsetOf(x,z));return cut(x,z,mix(T.surfaceAt(x,z)-.65,land,smooth(d,T.HW+9,T.HW+35)));
  };
  const positions=[],colors=[],indices=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=x0+i*dx,z=z0+j*dz,y=height(x,z);positions.push(x,y,z);const c=new THREE.Color(color(x,z,y));colors.push(c.r,c.g,c.b);
    if(i<nx&&j<nz){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
  if(paint)paint.apply(geo,T);
  const land=mesh(natureSurface(geo,'grass'),terrainMaterial());land.name=name;
  land.userData.grassGrid={bounds,nx,nz};
  const horizon=extendTerrain(land,{bounds,nx,nz,height:(x,z)=>cut(x,z,base(x,z)),color:paint?paint.color(color):color,biome:T.def.id});
  // The actual triangular mesh is the placement surface, including steep banks.
  const groundAt=(x,z)=>{
    const gx=(x-x0)/dx,gz=(z-z0)/dz,ix=Math.floor(gx),iz=Math.floor(gz);if(ix<0||iz<0||ix>=nx||iz>=nz)return horizon.heightAt(x,z)??height(x,z);
    const a=iz*(nx+1)+ix,tx=gx-ix,tz=gz-iz,p=geo.attributes.position;
    return tx+tz<=1?p.getY(a)*(1-tx-tz)+p.getY(a+1)*tx+p.getY(a+nx+1)*tz:p.getY(a+nx+2)*(tx+tz-1)+p.getY(a+1)*(1-tz)+p.getY(a+nx+1)*(1-tx);
  };
  return {land,groundAt,height};
}

export function sea(base,{size=2200,y=0,opacity=1}={}) {
  const geo=new THREE.PlaneGeometry(size,size,90,90);geo.rotateX(-Math.PI/2);
  extendWaterPlane(geo,{nx:90,nz:90,bounds:[-6000,-6000,6000,6000]});
  const water=waterSurface(geo,{depthMap:waterDepthMap(base,{size,y}),size,amplitude:.11,opacity});
  water.position.y=y;water.name='coastal-water';return water;
}

export function put(root,obj,x,z,y,rotation=0,scale=1) {obj.position.set(x,y,z);obj.rotation.y=rotation;obj.scale.setScalar(scale);root.add(obj);return obj;}
export function clear(T,x,z,r=0){
  // Keep scenery off the road and off any shortcut planks.
  if(T.shortcuts?.some(sc=>{const dx=sc.b.x-sc.a.x,dz=sc.b.z-sc.a.z,l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-sc.a.x)*dx+(z-sc.a.z)*dz)/(l||1)));
    return Math.hypot(x-sc.a.x-dx*t,z-sc.a.z-dz*t)<sc.w/2+r+3;}))return false;
  return Math.abs(T.offsetOf(x,z))>T.HW+r+5;
}
export function foundation(root,obj,x,z,groundAt,{rotation=0,scale=1,radius=5,color=0x999582}={}) {
  const levels=[];for(const dx of [-radius,0,radius])for(const dz of [-radius,0,radius])levels.push(groundAt(x+dx,z+dz));
  const top=Math.max(...levels)+.15,bottom=Math.min(...levels)-.3;
  root.add(box(radius*2,top-bottom,radius*2,M(color),x,(top+bottom)/2,z));return put(root,obj,x,z,top,rotation,scale);
}
export function scatter(T,groundAt,{seed=1,count,bounds,margin=10,minY=.3,scale=1,accept=()=>true}) {
  const r=rng(seed),out=[];let tries=count*35;
  while(out.length<count&&tries-->0){const x=mix(bounds[0],bounds[2],r()),z=mix(bounds[1],bounds[3],r()),y=groundAt(x,z);
    if(y<minY||!clear(T,x,z,margin)||!accept(x,z,y)||out.some(p=>Math.hypot(p.x-x,p.z-z)<margin*1.2))continue;
    out.push({x,z,y,rot:r()*Math.PI*2,scale:(.85+r()*.3)*scale});
  }return out;
}

export function edges(group,kit,T,{style='steel',step=5,skip=()=>false,cellSize=110,colors=null}={}) {
  const g=new THREE.Group(),steel=M(0xa9b5af,{metalness:.45}),cream=M(0xe8ddc1),red=M(0xbf5947),wood=M(0x8a7353);
  // Optional festive kerbs cycle through a list of paints instead of red/cream,
  // as vertex colours on one material so extra paints cost no extra draws.
  const painted=M(0xffffff,{vertexColors:true,roughness:.45}),paint=(geo,hex)=>{
    const rgb=new THREE.Color(hex).toArray(),n=geo.attributes.position.count;geo.setAttribute('color',new THREE.Float32BufferAttribute(Array.from({length:n*3},(_,i)=>rgb[i%3]),3));return geo;};
  for(let s=0;s<T.TOTAL;s+=step)for(const side of [-1,1]){
    if(skip(s,side))continue;const p=placeOnTrack(T,s,side*(T.HW+.8)),q=placeOnTrack(T,Math.min(s+step,T.TOTAL),side*(T.HW+.8));
    if(T.openAt?.(p.x,p.z,side*(T.HW+1))||T.plankAt?.(p.x,p.z)!=null||T.plankAt?.(q.x,q.z)!=null)continue;
    if(style==='kerb'){
      const kerb=box(.75,.24,step+.1,colors?painted:Math.floor(s/step)%2?cream:red,p.x,p.y+.12,p.z);
      if(colors)paint(kerb.geometry,colors[Math.floor(s/step)%colors.length]);kerb.rotation.y=p.h;g.add(kerb);
    }else{
      g.add(box(.16,1.15,.16,style==='rope'?wood:steel,p.x,p.y+.56,p.z));
      g.add(tube([p.x,p.y+.86,p.z],[q.x,q.y+.86,q.z],style==='rope'?.035:.12,style==='rope'?cream:steel));
      if(Math.floor(s/step)%4===0)g.add(box(.22,.2,.22,cream,p.x,p.y+1.17,p.z));
    }
  }group.add(finish(g,cellSize));
}

export function stream(points,width,height,color=0x438e93){
  return riverSurface(points,width,height,{color});
}
export function pathDistance(points){return(x,z)=>{let best=Infinity;for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],u=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(x-a[0]-dx*u,z-a[1]-dz*u));}return best;};}

export function boat(color=0xe9e2c9,{cabin=false}={}) {
  const g=new THREE.Group(),hull=new THREE.Shape();hull.moveTo(-1.15,-3);hull.lineTo(1.15,-3);hull.quadraticCurveTo(1.6,1.8,0,3.7);hull.quadraticCurveTo(-1.6,1.8,-1.15,-3);
  const geo=new THREE.ExtrudeGeometry(hull,{depth:.7,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:1,steps:1});geo.rotateX(Math.PI/2);geo.translate(0,.65,0);
  g.add(mesh(geo,M(color)),box(1.65,.12,4.5,M(0xdac79d),0,.74,.1));
  for(const z of [-1.7,0,1.5])g.add(box(1.7,.13,.4,M(0xf4e6c9),0,.9,z));
  if(cabin){g.add(box(1.7,1.25,2.3,M(0xe7e5d6),0,1.5,-.4),box(1.55,.65,.04,M(0x417581),0,1.65,.78),box(2,.15,2.5,M(0xf9f0da),0,2.17,-.4));}
  else{g.add(box(.65,.6,.35,M(0x384b50),0,.6,3.1));}
  return g;
}

export function boulder(color=0x8b9386){
  const geo=new THREE.IcosahedronGeometry(1,1),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),k=1+.12*Math.sin(x*7+z*5);p.setXYZ(i,x*3.6*k,(y+1)*1.65,z*2.8*k);}
  geo.computeVertexNormals();return mesh(geo,M(color,{roughness:1}));
}
