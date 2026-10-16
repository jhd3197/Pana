import * as THREE from 'three';
import { M, mesh, tube } from '/engine/models/core/primitives.js';
import { finish } from '/engine/models/core/architecture-kit.js';

const C={black:M(0x243d42),cream:M(0xf3e5c3)};
function oval(rx,ry,rz,mat,x,y,z) {
  const o=mesh(new THREE.SphereGeometry(1,16,10),mat,x,y,z);o.scale.set(rx,ry,rz);return o;
}
export function beachCrab() {
  const g=new THREE.Group(),fixed=new THREE.Group(),shell=M(0xd56b43),light=M(0xec9b61);
  fixed.add(oval(.44,.23,.32,shell,0,.39,0),oval(.35,.055,.24,light,0,.23,0));
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const z=-.24+i*.16,x=.68+Math.sin(i*.9)*.13;
    fixed.add(tube([side*.3,.35,z],[side*x,.29,z-.17],.041,shell));
    fixed.add(tube([side*x,.29,z-.17],[side*(x+.12),.035,z-.29],.028,light));
  }
  for(const side of [-1,1]){
    fixed.add(tube([side*.19,.5,.2],[side*.21,.7,.28],.028,light));
    fixed.add(oval(.066,.075,.063,C.black,side*.21,.73,.28));
    fixed.add(oval(.019,.025,.016,C.cream,side*.205,.75,.332));
  }
  g.add(finish(fixed,'Caparazón y patas'));
  const claws=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group(),claw=new THREE.Group();pivot.position.set(side*.35,.38,.2);
    claw.add(tube([0,0,0],[side*.21,.02,.21],.06,shell));
    claw.add(oval(.16,.13,.22,shell,side*.23,.08,.35));
    for(const edge of [-1,1]){
      const finger=mesh(new THREE.ConeGeometry(.073,.24,8),light,side*.23+edge*.095,.08,.57);
      finger.rotation.x=Math.PI/2;finger.rotation.z=-edge*.2;claw.add(finger);
    }
    pivot.add(finish(claw,'Pinza'));g.add(pivot);claws.push(pivot);
  }
  g.userData.species='crab';
  g.userData.tick=(t=0)=>{if(Number.isFinite(t))claws.forEach((p,i)=>{p.rotation.x=Math.sin(t*1.7+i*2)*.18;p.rotation.y=Math.sin(t*.8+i)*.1;});};
  g.userData.tick(0);g.name='Cangrejo de playa';g.userData.assetId='beach-crab';return g;
}
