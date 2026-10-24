import * as THREE from 'three';
import { createLudoBoard, createLudoPawn, boardPoint } from './board-model.js';
import { createCaminoMotion } from './camino-motion.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { createMomentVisual } from './moment-visual.js';
import { COLORS } from './rules.js';

// Studio and live games sample the same motion code and the same model factories.
export function createLudoMotionPreview({style='umbrella'}={}) {
  const root=new THREE.Group();root.add(createLudoBoard());
  let mover,friend,rival;
  for(let seat=0;seat<4;seat++)for(let piece=0;piece<4;piece++){
    const pawn=createLudoPawn({seat,number:piece+1});const [x,z]=boardPoint(seat,-1,piece);
    pawn.position.set(x,.21,z);root.add(pawn);
    if(seat===0&&piece===0)mover=pawn;
    if(seat===0&&piece===1)friend=pawn;
    if(seat===1&&piece===0)rival=pawn;
  }
  const path=Array.from({length:6},(_,i)=>{const [x,z]=boardPoint(0,(style==='sprint'?50:8)+i);return new THREE.Vector3(x,.21,z);});
  mover.position.copy(path[0]);friend.position.copy(path[2]);friend.position.x-=.35;
  rival.position.copy(path[3]);rival.position.x+=style==='leap'?0:.35;
  const partner=style==='highfive'||style==='piggy'?friend:style==='dodge'||style==='leap'?rival:null;
  const motion=createCaminoMotion(root,mover,path,style,COLORS[0],partner);
  root.userData.tick=time=>motion.sample(Math.min(1,(time%3.2)/2.4),time);
  root.userData.tick(0);root.userData.previewBounds=[[-2.9,0,-2.9],[2.9,2.5,2.9]];
  root.userData.dispose=()=>{motion.dispose();disposeModel(root);};
  return root;
}

export function createLudoMomentPreview({kind='safe'}={}) {
  if(kind==='leap'||kind==='sprint')return createLudoMotionPreview({style:kind});
  const root=new THREE.Group();root.add(createLudoBoard());const pawns=[];
  for(let seat=0;seat<4;seat++)for(let piece=0;piece<4;piece++){
    const pawn=createLudoPawn({seat,number:piece+1}),[x,z]=boardPoint(seat,-1,piece);
    pawn.position.set(x,.21,z);root.add(pawn);pawns.push(pawn);
  }
  const actors=kind==='intro'?pawns:kind==='podium'?[pawns[0],pawns[4],pawns[8]]:pawns.slice(0,kind==='safe'||kind==='nearmiss'?1:4);
  const bases=actors.map(p=>({position:p.position.clone(),rotation:p.rotation.clone(),scale:p.scale.clone()}));
  const visual=createMomentVisual(kind,COLORS[0]);root.add(visual.root);
  root.userData.tick=time=>{actors.forEach((p,i)=>{p.position.copy(bases[i].position);p.rotation.copy(bases[i].rotation);p.scale.copy(bases[i].scale);});visual.sample(Math.min(1,(time%3.6)/2.8),actors,time);};
  root.userData.tick(0);root.userData.previewBounds=[[-2.9,0,-2.9],[2.9,3,2.9]];
  root.userData.dispose=()=>{visual.dispose();disposeModel(root);};return root;
}
