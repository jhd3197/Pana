import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { stemMaterial, TAU, finish, stem, leaf } from '/engine/models/vegetation/plant-kit.js';

export function waterLily({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),padMaterial=M(0x568c59,{roughness:0.8,flatShading:false});
  for(let i=0;i<4;i++) {
    const a=i*2.4,radius=0.55+r()*0.23,x=i?Math.cos(a)*0.92:0,z=i?Math.sin(a)*0.92:0,shape=new THREE.Shape();
    shape.moveTo(0,0);shape.lineTo(Math.cos(0.18)*radius,Math.sin(0.18)*radius);
    shape.absarc(0,0,radius,0.18,TAU-0.18,false);shape.lineTo(0,0);
    const pad=mesh(new THREE.ExtrudeGeometry(shape,{depth:0.025,bevelEnabled:true,bevelSegments:1,bevelSize:0.012,bevelThickness:0.008,steps:1,curveSegments:16}),padMaterial,x,0.04+i*0.012,z);
    pad.rotation.set(-Math.PI/2,0,a);g.add(pad);
    for(let j=0;j<7;j++) {
      const b=a+0.38+j*(TAU-0.76)/6;
      stem(g,[[x,0.08+i*0.012,z],[x+Math.cos(b)*radius*0.48,0.085+i*0.012,z+Math.sin(b)*radius*0.48],[x+Math.cos(b)*radius*0.91,0.08+i*0.012,z+Math.sin(b)*radius*0.91]],0.008,0.003,stemMaterial,4);
    }
  }
  g.add(mesh(new THREE.SphereGeometry(0.09,8,6),stemMaterial,0,0.09,0));
  const flower=new THREE.Group();flower.position.set(0,0.13,0);g.add(flower);
  for(let layer=0;layer<3;layer++)for(let i=0;i<9-layer*2;i++) {
    leaf(flower,0.62-layer*0.1,0.16-layer*0.025,[0,0,0],[0,i*TAU/(9-layer*2)+layer*0.4,0.32+layer*0.34],layer===0?0xe77c9d:0xf0a1be,0.13,9);
  }
  const gold=M(0xf0c34d,{roughness:0.85,flatShading:false});
  flower.add(mesh(new THREE.SphereGeometry(0.095,10,7),gold,0,0.2,0));
  for(let i=0;i<12;i++) {const a=i*TAU/12;stem(flower,[[Math.cos(a)*0.075,0.17,Math.sin(a)*0.075],[Math.cos(a)*0.1,0.3,Math.sin(a)*0.1]],0.012,0.005,gold,3);}
  return finish(g,'waterLily');
}
