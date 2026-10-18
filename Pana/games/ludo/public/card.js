import * as THREE from 'three';
import { createLudoBoard, createLudoPawn, boardPoint } from './board-model.js';
import { disposeModel } from '/engine/models/props/game-table.js';
export function mount(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,40);camera.position.set(6,10,9);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight('#fff6df','#60745f',3));const sun=new THREE.DirectionalLight('#ffffff',3);sun.position.set(-3,9,5);scene.add(sun);
  const board=createLudoBoard();scene.add(board);
  for(let seat=0;seat<4;seat++)for(let piece=0;piece<4;piece++){
    const pawn=createLudoPawn({seat,number:piece+1}),[x,z]=boardPoint(seat,piece===0?seat*4:-1,piece);pawn.position.set(x,.21,z);scene.add(pawn);
  }
  let stopped=false;
  function frame(){if(stopped)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);}requestAnimationFrame(frame);}
  requestAnimationFrame(frame);
  const dispose=()=>{stopped=true;disposeModel(scene);renderer.dispose();};addEventListener('pagehide',dispose,{once:true});return dispose;
}
