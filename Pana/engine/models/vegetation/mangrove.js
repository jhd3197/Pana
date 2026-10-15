import * as THREE from 'three';
import { M, rng } from '/engine/models/core/primitives.js';
import { stemMaterial, TAU, finish, stem, leaf, cushion } from '/engine/models/vegetation/plant-kit.js';

export function mangrove({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),wood=M(0x827563,{roughness:1,flatShading:false}),h=3.5+r()*0.45;
  stem(g,[[0,0,0],[-0.18,1.5,0.12],[0.12,h,0]],0.29,0.09,wood,12);
  for(let i=0;i<8;i++) {
    const a=i*TAU/8+r()*0.15,reach=1.3+r()*0.6,x=Math.cos(a)*reach,z=Math.sin(a)*reach;
    stem(g,[[x,0.02,z],[x*0.86,0.65,z*0.86],[x*0.45,1.55,z*0.45],[0,2.1+r()*0.3,0]],0.075,0.15,wood,12);
    if(i%2===0)stem(g,[[x*1.1,0.01,z-0.35],[x*0.9,0.6,z-0.14],[x*0.65,1.1,z*0.65]],0.04,0.075,wood);
  }
  for(let i=0;i<6;i++) {
    const a=i*TAU/6,reach=1.1+r()*0.55,x=Math.cos(a)*reach,z=Math.sin(a)*reach,y=h+r()*0.55;
    stem(g,[[0,1.9,0],[x*0.5,y-0.55,z*0.5],[x,y,z]],0.14,0.025,wood);
    cushion(g,[x,y,z],[1.04,0.52,0.93],i%2?0x477c45:0x5a8c48,seed+i);
    for(let j=0;j<7;j++) {
      const b=j*TAU/7,pos=[x+Math.cos(b)*0.88,y-0.1,z+Math.sin(b)*0.8];
      if(j%2===0)cushion(g,[pos[0],y+0.06,pos[2]],[0.4,0.3,0.38],0x568947,seed+i+j,true);
      leaf(g,0.46,0.17,pos,[0,-b,-0.18],0x6c9d54,0.1);
      if(j===2||j===5)stem(g,[pos,[pos[0],y-0.52,pos[2]]],0.025,0.008,stemMaterial,4);
    }
  }
  cushion(g,[0,h+0.48,0],[1.35,0.6,1.15],0x568947,seed+20);
  return finish(g,'mangrove');
}
