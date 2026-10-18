import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { createTableWorld } from '/engine/table-world.js';
import { createGameTable, createGameChair, disposeModel } from '/engine/models/props/game-table.js';
import { createLudoBoard, createLudoPawn, createLudoDie, boardPoint } from './board-model.js';
import { COLORS, HOME, legalMoves } from './rules.js';

export function createLudoScene(canvas, { onPiece } = {}) {
  // The shared plaza stage (perspective camera, sky, sun) like Billar and Póquer.
  const stage=createTableWorld(canvas),{renderer,scene,camera}=stage,own=new THREE.Group();scene.add(own);
  // Reuse the shared table and chairs; the board sits above the felt.
  const table=createGameTable({feltColor:'#334f49',caption:''});own.add(table);
  const board=createLudoBoard();board.position.y=1.46;own.add(board);
  const chairs=[],characters=[],keys=[];
  for(let seat=0;seat<4;seat++){
    const angle=-Math.PI/4+seat*Math.PI/2;
    const chair=createGameChair();chair.position.set(Math.sin(angle)*4.6,0,Math.cos(angle)*4.6);chair.rotation.y=angle+Math.PI;own.add(chair);chairs.push(chair);
  }
  const pawns=[];
  for(let seat=0;seat<4;seat++)for(let piece=0;piece<4;piece++){
    const model=createLudoPawn({seat,number:piece+1});model.userData.piece=piece;model.userData.seat=seat;own.add(model);
    pawns.push({model,seat,piece,target:new THREE.Vector3(),initialized:false,playable:false});
  }
  const diePivot=new THREE.Group(),die=createLudoDie();die.position.y=-.215;diePivot.add(die);diePivot.position.set(3.08,1.675,0);own.add(diePivot);
  const ray=new THREE.Raycaster(),cursor=new THREE.Vector2();let current=null,time=0,rollTime=0,dieTarget=new THREE.Euler(),lastRoll='',disposed=false;
  function pick(event){
    const r=canvas.getBoundingClientRect();cursor.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);ray.setFromCamera(cursor,camera);
    const hit=ray.intersectObjects(pawns.filter(p=>p.playable).map(p=>p.model),true)[0];
    if(!hit)return null;let node=hit.object;while(node && node.userData.piece===undefined)node=node.parent;return node?.userData.piece ?? null;
  }
  function click(e){const piece=pick(e);if(piece!==null)onPiece?.(piece);}
  function hover(e){canvas.style.cursor=pick(e)===null?'default':'pointer';}
  canvas.addEventListener('click',click);canvas.addEventListener('pointermove',hover);
  function update(state,ownSeat){
    current=state;
    for(const p of state.players){
      const avatar=normalizeAvatar(p.id===null?{outfitColor:COLORS[p.seat],hat:'none',face:'feliz'}:p.avatar),key=JSON.stringify(avatar);
      if(keys[p.seat]!==key){
        characters[p.seat]?.dispose();const character=buildCharacter(avatar,{seated:true});
        character.group.position.copy(chairs[p.seat].position);character.group.position.y=.76;character.group.rotation.y=chairs[p.seat].rotation.y;
        own.add(character.group);characters[p.seat]=character;keys[p.seat]=key;
      }
    }
    const legal=legalMoves(state,ownSeat), occupancy=new Map();
    for(const p of pawns){
      const progress=state.players[p.seat].pieces[p.piece];let [x,z]=boardPoint(p.seat,progress,p.piece);
      const key=`${x},${z}`, stack=occupancy.get(key)||0;occupancy.set(key,stack+1);
      p.target.set(x,1.67+stack*.13,z);p.playable=p.seat===ownSeat&&legal.includes(p.piece);
      p.model.userData.halo.visible=p.playable;
      if(progress===HOME){p.target.x+=(p.piece%2-.5)*.2;p.target.z+=(Math.floor(p.piece/2)-.5)*.2;}
      if(!p.initialized){p.model.position.copy(p.target);p.initialized=true;}
    }
    const key=`${state.round}:${state.rng}`;
    if(key!==lastRoll && state.lastDie){rollTime=.55;const turns={1:[0,0,0],2:[-Math.PI/2,0,0],3:[0,0,Math.PI/2],4:[0,0,-Math.PI/2],5:[Math.PI/2,0,0],6:[Math.PI,0,0]};dieTarget.set(...turns[state.lastDie]);}
    lastRoll=key;
  }
  // The table, chairs and seated panas, framed inside the canvas between the HUD bars.
  const bounds=new THREE.Box3(new THREE.Vector3(-5.2,0,-5.2),new THREE.Vector3(5.2,2.6,5.2));
  let top=false;
  function frame(dt){
    if(disposed)return;time+=dt;
    const {w,h}=stage.resize(),margin=Math.min(24,w*.04);
    stage.frameCamera(bounds,top?[0,6,.35]:[0,1.15,1],{x:margin,y:margin,width:Math.max(160,w-margin*2),height:Math.max(120,h-margin*2)});
    for(const p of pawns){
      const distance=p.model.position.distanceTo(p.target);p.model.position.lerp(p.target,1-Math.exp(-dt*9));
      p.model.scale.setScalar(p.playable?1.05+Math.sin(time*4)*.05:1);
      p.model.children[0].position.y=.035+Math.min(.12,distance*.1);
    }
    characters.forEach((c,seat)=>{c.update(dt,{});const won=current?.winner===seat;
      c.arms.forEach((arm,j)=>arm.rotation.set(won?-1.8+Math.sin(time*5+j)*.2:-.55,0,(j?-1:1)*.15));
      c.neck.rotation.x=.12;c.neck.rotation.y=Math.sin(time*.6+seat)*.08;
    });
    if(rollTime>0){rollTime-=dt;diePivot.rotation.x+=dt*18;diePivot.rotation.z+=dt*12;diePivot.position.y=1.675+Math.sin(Math.max(0,rollTime)/.55*Math.PI)*.45;}
    else {diePivot.rotation.copy(dieTarget);diePivot.position.y=1.675;}
    stage.draw(dt);
  }
  function setView(value){top=!!value;}
  function projectPiece(seat,piece){const p=pawns.find(p=>p.seat===seat&&p.piece===piece),v=p.model.position.clone();v.y+=.2;v.project(camera);const r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
  function dispose(){disposed=true;canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',hover);characters.forEach(c=>c.dispose());disposeModel(own);stage.dispose();}
  return {update,frame,setView,dispose,characters,pawns,projectPiece,renderer,scene,camera};
}
