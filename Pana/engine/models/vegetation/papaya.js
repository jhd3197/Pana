import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { leafMaterial, stemMaterial, TAU, finish, stem, leaf, cushion } from '/engine/models/vegetation/plant-kit.js';

function papayaLeaf(length,tint) {
  // Seven deep lobes radiate from a raised center, each with a shallow side tooth.
  const vertices=[0,0.1,0],colors=[],indices=[],color=new THREE.Color(tint);
  for(let i=0;i<7;i++)for(let j=0;j<6;j++) {
    const a=(i+j/6)*TAU/7,reach=[0.28,0.58,0.5,1,0.5,0.58][j]*(i===0?0.8:1);
    vertices.push(Math.cos(a)*reach*length,(0.08-reach*reach*0.14)*length,Math.sin(a)*reach*length);
  }
  for(let i=1;i<=42;i++)indices.push(0,i,i%42+1);
  for(let i=0;i<vertices.length/3;i++) {const c=color.clone().multiplyScalar(i===0?1.1:0.8+(i%6)*0.025);colors.push(c.r,c.g,c.b);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

export function papaya({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),h=3.4+r()*0.5,wood=M(0xa5a075,{roughness:1,flatShading:false});
  stem(g,[[0,0,0],[0.05,h*0.5,0],[-0.08,h,0.03]],0.19,0.1,wood,14);
  for(let i=0;i<13;i++) {
    const scar=mesh(new THREE.TorusGeometry(0.18-i*0.005,0.011,3,9),wood,0.02,i*0.23+0.15,0);
    scar.rotation.set(Math.PI/2,0.06,0);g.add(scar);
  }
  for(let i=0;i<10;i++) {
    const a=i*2.4,reach=1.05+r()*0.55,y=h-0.12+r()*0.8,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[-0.08,h-0.18,0.03],[x*0.55,y+0.12,z*0.55],[x,y,z]],0.035,0.015,stemMaterial);
    const blade=mesh(papayaLeaf(0.65+r()*0.25,i%2?0x50994e:0x6aab4d),leafMaterial,x,y,z);
    blade.rotation.set(Math.sin(a)*0.15,-a,Math.cos(a)*0.15);g.add(blade);
  }
  for(let j=0;j<7;j++)leaf(g,0.18,0.045,[-0.08,h+0.05,0.03],[0,j*TAU/7,0.7],0x7bac51,0.02,3);
  for(let i=0;i<9;i++) {
    const a=i*2.4,y=h-0.55-(i%3)*0.21,x=Math.cos(a)*0.29,z=Math.sin(a)*0.29;
    stem(g,[[0,y+0.23,0],[x,y+0.14,z]],0.02,0.012,stemMaterial,4);
    cushion(g,[x,y-0.07,z],[0.18,0.38+r()*0.06,0.18],i<3?0xefa637:0x85a847,seed+i);
  }
  return finish(g,'papaya');
}
