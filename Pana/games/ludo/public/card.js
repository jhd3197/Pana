import * as THREE from 'three';
import { createLudoBoard, createLudoPawn, boardPoint } from './board-model.js';
import { mountCard } from '/engine/card.js';
export function mount(canvas){
  const camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(6,10,9);camera.lookAt(0,0,0);
  return mountCard(canvas,{camera,toneMapping:true,build(scene){
    scene.add(new THREE.HemisphereLight('#fff6df','#60745f',3));const sun=new THREE.DirectionalLight('#ffffff',3);sun.position.set(-3,9,5);scene.add(sun);
    scene.add(createLudoBoard());
    for(let seat=0;seat<4;seat++)for(let piece=0;piece<4;piece++){
      const pawn=createLudoPawn({seat,number:piece+1}),[x,z]=boardPoint(seat,piece===0?seat*4:-1,piece);pawn.position.set(x,.21,z);scene.add(pawn);
    }
  }});
}
