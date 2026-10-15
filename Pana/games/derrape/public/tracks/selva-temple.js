// An invented jungle ruin with stepped masonry and a corbelled stone passage.
// The tunnel follows the racing curve; its facade is not a flat backdrop.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '/engine/props.js';
import { bake } from '/engine/flora.js';
import { placeOnTrack } from '../track-kit.js';
import { TUNNEL } from './selva-layout.js';

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

function vine(group,x,y,z,length,seed) {
  const points=Array.from({length:9},(_,i)=>new THREE.Vector3(x+Math.sin(i*0.8+seed)*0.3,y-length*i/8,z+Math.sin(i*0.7)*0.15));
  group.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,0.075,5,false),MOSS));
  for(let i=1;i<8;i++)for(const sign of [-1,1]) {
    const leaf=mesh(new THREE.SphereGeometry(1,5,3),MOSS,points[i].x+sign*0.23,points[i].y,points[i].z-0.04);
    leaf.scale.set(0.32,0.12,0.14);leaf.rotation.z=sign*0.5;group.add(leaf);
  }
}

function portal(seed) {
  const root=new THREE.Group(),r=rng(seed);
  // Courses recede like the front of a stepped temple. The centre stays open.
  for(let row=0;row<12;row++) {
    const y=row*1.55+0.775,outer=36-Math.floor(row/3)*4.5;
    const inner=row<5?12.6:Math.max(3.6,12.6-(row-4)*1.5);
    for(const sign of [-1,1]) {
      const count=Math.ceil((outer-inner)/3.6),width=(outer-inner)/count;
      for(let col=0;col<count;col++) {
        root.add(box(width-0.09,1.45,8-Math.floor(row/3)*0.8,STONE[Math.floor(r()*4)],
          sign*(inner+(col+0.5)*width),y,1.2+Math.floor(row/3)*0.4));
      }
    }
  }
  root.add(box(32,1.7,6,STONE[1],0,18.8,2.1));
  // Wide cornice, geometric fretwork and a central jaguar-like stone relief.
  for(const y of [19.7,24.1])root.add(box(32,0.7,5.6,STONE[1],0,y,2.3));
  root.add(box(29,3.7,4.5,STONE[2],0,21.9,2.5));
  for(const sign of [-1,1])for(let i=0;i<3;i++) {
    const x=sign*(6.5+i*3.3);
    root.add(box(2.4,0.45,0.3,JADE,x,22.6,0.08));
    root.add(box(0.45,1.7,0.3,JADE,x-sign*0.96,22,0.08));
    root.add(box(1.4,0.45,0.3,JADE,x-sign*0.5,21.2,0.08));
  }
  root.add(box(5.8,4.6,1.2,STONE[1],0,21.9,-0.4));
  for(const sign of [-1,1]) {
    root.add(box(2.3,0.75,0.8,DARK,sign*1.4,22.8,-1.12));
    root.add(box(0.8,0.45,0.9,JADE,sign*1.3,22.45,-1.22));
    const cheek=mesh(new THREE.IcosahedronGeometry(1,1),STONE[0],sign*1.4,20.7,-1.15);cheek.scale.set(1.3,0.8,0.9);root.add(cheek);
    const fang=mesh(new THREE.ConeGeometry(0.35,1.05,4),STONE[1],sign*1.02,19.85,-1.4);fang.rotation.z=Math.PI;root.add(fang);
    root.add(box(2.1,1.6,1.1,STONE[2],sign*2.6,23.8,-0.2));
    // Side stairs frame the opening without entering any driving lane.
    for(let step=0;step<9;step++)root.add(box(7.2,0.85*(step+1),1.7,STONE[step%4],sign*23,0.425*(step+1),-14+step*1.6));
    root.add(box(8.5,0.6,17,STONE[2],sign*23,0,-7));
    for(let i=0;i<3;i++)vine(root,sign*(15+i*5),15-i*2,-2.9,3.5+r()*3,seed+i);
    for(let i=0;i<7;i++)root.add(box(1.6+r()*2,0.15,1.2+r(),MOSS,sign*(14+r()*16),3.12*(1+i%4),-2));
  }
  const snout=mesh(new THREE.IcosahedronGeometry(1,1),DARK,0,21.55,-1.25);snout.scale.set(0.75,0.5,0.55);root.add(snout);
  root.add(box(18,1.4,5,STONE[0],0,25.2,2.7));
  root.add(box(12,1.0,4.6,STONE[2],0,26.35,2.8));
  return root;
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
    const p=placeOnTrack(T,s),gate=portal(seed);gate.position.set(p.x,p.y,p.z);gate.rotation.y=p.h+rotation;details.add(gate);
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
