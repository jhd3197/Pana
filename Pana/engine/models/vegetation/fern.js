import * as THREE from 'three';
import { M, rng } from '/engine/models/core/primitives.js';
import { stemMaterial, TAU, finish, stem, leaf } from '/engine/models/vegetation/plant-kit.js';

export function fern({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group();
  for(let i=0;i<9;i++) {
    const frond=new THREE.Group(),length=1.15+r()*0.65,rise=0.6+r()*0.2;
    frond.position.y=0.06;frond.rotation.y=i*TAU/9+r()*0.23;g.add(frond);
    const y=t=>Math.sin(t*Math.PI*0.8)*rise;
    stem(frond,[[0,0,0],[length*0.4,y(0.4),0],[length,y(1),0]],0.021,0.004,stemMaterial,12);
    for(let k=1;k<12;k++) {
      const t=k/12,reach=0.09+Math.sin(t*Math.PI)*0.37;
      for(const side of [-1,1])leaf(frond,reach,reach*0.2,[t*length,y(t),0],[0,side*1.03,0.05],i%2?0x68a84b:0x438b46,0.045,4);
    }
  }
  for(let i=0;i<2;i++) {
    const points=[[i*0.15,0,0],[i*0.15-0.1,0.5,0],[i*0.15,0.95,0],[i*0.15+0.2,0.94,0],[i*0.15+0.2,0.77,0],[i*0.15+0.08,0.78,0]];
    stem(g,points,0.025,0.013,M(0x8baa59,{roughness:1}),22);
  }
  return finish(g,'fern');
}
