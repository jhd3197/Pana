import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { finish, stem, leaf } from '/engine/models/vegetation/plant-kit.js';

export function bamboo({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),green=M(0x729d48,{roughness:1,flatShading:false}),joint=M(0xbed08a,{roughness:1,flatShading:false});
  for(let i=0;i<7;i++) {
    const a=i*2.4,spread=i?0.4+r()*0.6:0,x=Math.cos(a)*spread,z=Math.sin(a)*spread,h=3.3+r()*2.9;
    const dx=(r()-0.5)*0.55,dz=(r()-0.5)*0.55,radius=0.11+r()*0.035;
    const culm=new THREE.Group();culm.position.set(x,0,z);g.add(culm);
    stem(culm,[[0,0,0],[dx*0.4,h*0.5,dz*0.4],[dx,h,dz]],radius,radius*0.72,green,10);
    for(let y=0.12;y<h;y+=0.65) {
      const t=y/h,band=mesh(new THREE.TorusGeometry(radius*(1-t*0.28)+0.006,0.018,4,9),joint,dx*t,y,dz*t);
      band.rotation.x=Math.PI/2;culm.add(band);
    }
    for(let j=0;j<3;j++) {
      const y=h*(0.57+j*0.18),angle=a+j*2.2,branch=new THREE.Group();branch.position.set(dx*y/h,y,dz*y/h);branch.rotation.y=angle;
      stem(branch,[[0,0,0],[0.45,0.18,0],[1.05,0.3,0]],0.024,0.006,green,6);
      for(let k=1;k<=5;k++)for(const side of [-1,1])leaf(branch,0.55+(5-k)*0.055,0.075,[k*0.18,k*0.052,0],[0,side*(0.7+k*0.05),0.18-k*0.07],k%2?0x709d4c:0x4b823f,0.08,4);
      culm.add(branch);
    }
  }
  return finish(g,'bamboo');
}
