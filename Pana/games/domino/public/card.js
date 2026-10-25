import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { createDominoTable, createDominoChair, createDominoTile } from './table-model.js';
import { pixelRatio } from '/engine/settings.js';

// The hub previews the actual game table, pieces and saved Pana sculpt.
export function mount(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(pixelRatio(1.5)); renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(34,1,.1,40);
  camera.position.set(8,10,12); camera.lookAt(0,.6,0);
  scene.add(new THREE.HemisphereLight('#fff3d1','#557b63',2.5));
  const sun=new THREE.DirectionalLight('#ffe0a4',3);sun.position.set(-3,8,4);scene.add(sun);
  const table=createDominoTable();scene.add(table);
  const chair=createDominoChair();chair.position.set(0,0,-4.05);scene.add(chair);
  const character=buildCharacter(loadAvatar(),{seated:true});character.group.position.set(0,.76,-4.05);scene.add(character.group);
  const pieces=[];
  for(const [i,[a,b]]of [[6,6],[6,3],[3,2],[2,4],[4,5]].entries()){
    const tile=createDominoTile({a,b});tile.position.set((i-2)*.58,1.46,0);tile.rotation.y=Math.PI/2;scene.add(tile);pieces.push(tile);
  }
  let stopped=false,previous=performance.now();
  function frame(now){if(stopped)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();character.update(dt,{});character.arms.forEach((arm,i)=>arm.rotation.set(-.7,0,(i?-1:1)*.12));renderer.render(scene,camera);}
    requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
  addEventListener('pagehide',()=>{stopped=true;character.dispose();table.userData.dispose();chair.userData.dispose();pieces.forEach(p=>p.userData.dispose());renderer.dispose();},{once:true});
}
