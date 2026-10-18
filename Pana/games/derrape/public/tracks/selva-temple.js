// An invented jungle ruin with stepped masonry and a corbelled stone passage,
// fronted by the library's overgrown Maya portal at both ends.
// The tunnel follows the racing curve; its facade is not a flat backdrop.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/models/core/primitives.js';
import { bake } from '/engine/models/core/static-batch.js';
import { placeOnTrack } from '../track-kit.js';
import { TUNNEL } from './selva-layout.js';
import { mayaPortal } from '/engine/models/props/maya-temple.js';

const STONE=[0x8d9278,0xa3a186,0x7e876e,0x94977d].map(c=>M(c,{roughness:1}));
const DARK=M(0x505f51,{roughness:1}),MOSS=M(0x4b783e,{roughness:1});
const JADE=M(0x3b9784,{roughness:0.7,emissive:0x174f40,emissiveIntensity:0.4});
const OUTER_PROFILE=[[-40,-1],[-32,6],[-25,15],[-16,22],[0,26],[16,22],[25,15],[32,6],[40,-1]];

export function tunnelRoofHeight(offset) {
  for(let i=1;i<OUTER_PROFILE.length;i++) {
    const a=OUTER_PROFILE[i-1],b=OUTER_PROFILE[i];
    if(offset<=b[0])return THREE.MathUtils.lerp(a[1],b[1],THREE.MathUtils.clamp((offset-a[0])/(b[0]-a[0]),0,1));
  }
  return -1;
}

function sweep(T,from,to,profile,material,name,step=2) {
  const count=Math.ceil((to-from)/step),positions=[],indices=[];
  for(let i=0;i<=count;i++) {
    const p=placeOnTrack(T,THREE.MathUtils.lerp(from,to,i/count));
    for(const [x,y] of profile)positions.push(p.x+Math.cos(p.h)*x,p.y+y,p.z-Math.sin(p.h)*x);
  }
  const width=profile.length;
  for(let i=0;i<count;i++)for(let j=0;j<width-1;j++) {
    const a=i*width+j,b=a+width;indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
  const object=mesh(geo,material);object.name=name;return object;
}

export function templeTunnel(T) {
  const root=new THREE.Group(),details=new THREE.Group(),from=TUNNEL.from*T.TOTAL,to=TUNNEL.to*T.TOTAL;
  root.name='selva-temple-tunnel';
  const profile=[[-12.6,-0.5],[-12.6,8.4],[-11.1,10],[-9.6,11.6],[-8.1,13.2],[-6.6,14.8],[-5.1,16.2],
    [5.1,16.2],[6.6,14.8],[8.1,13.2],[9.6,11.6],[11.1,10],[12.6,8.4],[12.6,-0.5]];
  root.add(sweep(T,from,to,profile,M(0x677568,{roughness:1,side:THREE.DoubleSide}),'temple-passage'));
  // A separate outer shell leaves an actual void. No solid terrain spans the road.
  const outer=OUTER_PROFILE;
  const earth=M(0x476b3b,{roughness:1,side:THREE.DoubleSide});
  root.add(sweep(T,from+3,to-3,outer,earth,'temple-overgrowth',4));
  // Close the earth around the portal while leaving the corbel opening hollow.
  // Otherwise the upper stone cornice appears to float from oblique angles.
  const outline=[...outer,...profile.slice().reverse()],shape=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));
  for(const s of [from+3,to-3]) {
    const p=placeOnTrack(T,s),cap=mesh(new THREE.ShapeGeometry(shape),earth,p.x,p.y,p.z);cap.rotation.y=p.h;root.add(cap);
  }
  for(const [s,rotation,seed] of [[from,0,17],[to,Math.PI,23]]) {
    // Library portal: corbel arch, lianas and a small jaguar relief, no stone head.
    const p=placeOnTrack(T,s),gate=mayaPortal({span:13.6,seed});gate.position.set(p.x,p.y,p.z);gate.rotation.y=p.h+rotation;details.add(gate);
  }
  // Repeated corbel ribs, block joints and inset jade wayfinding along the walls.
  for(let s=from+7;s<to-5;s+=11) {
    const p=placeOnTrack(T,s),rib=new THREE.Group();rib.position.set(p.x,p.y,p.z);rib.rotation.y=p.h;
    for(let i=1;i<profile.length;i++) {
      const a=profile[i-1],b=profile[i];rib.add(tube([a[0],a[1],0],[b[0],b[1],0],0.24,STONE[2]));
    }
    for(const sign of [-1,1]) {
      rib.add(box(0.28,3,1.2,DARK,sign*12.35,4.3,0));
      rib.add(box(0.32,1.65,0.5,JADE,sign*12.15,4.7,0));
    }
    details.add(rib);
  }
  for(let s=from+1;s<to-1;s+=3.4) {
    const p=placeOnTrack(T,s),g=new THREE.Group();g.position.set(p.x,p.y,p.z);g.rotation.y=p.h;
    for(const side of [-1,1])for(let row=0;row<5;row++)g.add(box(0.18,1.48,3.25,STONE[(row+Math.floor(s))%4],side*12.53,row*1.6+0.8,0));
    details.add(g);
  }
  const batches=bake(details,{cellSize:100});batches.name='temple-masonry';root.add(batches);
  const geometries=new Set();details.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());
  root.userData.tunnel={...TUNNEL,length:to-from,fromS:from,toS:to};
  return root;
}
