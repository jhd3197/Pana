import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { bark, TAU, finish, stem, leaf } from '/engine/models/vegetation/plant-kit.js';

export function hibiscus({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),gold=M(0xf3c443,{roughness:0.85,flatShading:false});
  stem(g,[[0,0,0],[0.06,0.6,0],[0,1.55,0]],0.09,0.025,bark);
  for(let i=0;i<10;i++) {
    const a=i*2.4,reach=0.6+r()*0.45,y=0.9+r()*1.1,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[0,0.35,0],[x*0.4,y*0.8,z*0.4],[x,y,z]],0.035,0.012,bark);
    for(let j=0;j<10;j++) {
      const t=0.28+j*0.07,pos=[x*t,y*(0.35+t*0.65),z*t];
      leaf(g,0.5+r()*0.18,0.23,pos,[0,-a+(j%2?1.5:-1.5),0.08+(j%3)*0.14],i%2?0x2c6b39:0x43813b,0.09,7);
    }
    if(i>=7)continue;
    const flower=new THREE.Group();flower.position.set(x,y,z);
    flower.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a),0.45,Math.sin(a)).normalize());g.add(flower);
    for(let j=0;j<5;j++)leaf(flower,0.4,0.22,[0,0,0],[0,j*TAU/5,0.12],i%2?0xe85c55:0xd94345,0.11,10);
    stem(flower,[[0,0,0],[0.03,0.21,0],[0.08,0.38,0]],0.021,0.012,gold,6);
    for(let j=0;j<7;j++) {
      const b=j*TAU/7;flower.add(mesh(new THREE.SphereGeometry(0.026,6,4),gold,0.07+Math.cos(b)*0.04,0.32+j%2*0.04,Math.sin(b)*0.04));
    }
  }
  return finish(g,'hibiscus');
}
