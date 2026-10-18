import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { bindRenderer } from '/engine/settings.js';
import { createGameTable, createGameChair, disposeModel } from '/engine/models/props/game-table.js';
import { createLudoBoard, createLudoPawn, createLudoDie, boardPoint } from './board-model.js';
import { COLORS, HOME, legalMoves } from './rules.js';

export function createLudoScene(canvas, { onPiece } = {}) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const unbind=bindRenderer(renderer,1.5), scene=new THREE.Scene();scene.background=new THREE.Color('#b6c6b1');
  const camera=new THREE.OrthographicCamera(-6,6,6,-6,.1,80);
  camera.position.set(0,15,10);camera.lookAt(0,1,0);
  scene.add(new THREE.HemisphereLight('#fff1d5','#74866d',2.6));
  const sun=new THREE.DirectionalLight('#ffe4b3',3.2);sun.position.set(-7,13,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
  Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9});sun.shadow.normalBias=.03;scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#94aa89',roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  const rug=new THREE.Mesh(new THREE.CylinderGeometry(6.4,6.4,.04,64),new THREE.MeshStandardMaterial({color:'#dbccb0',roughness:1}));rug.position.y=.025;rug.receiveShadow=true;scene.add(rug);
  // Reuse the shared table and chairs; the board sits above the felt.
  const table=createGameTable({feltColor:'#334f49',caption:''});scene.add(table);
  const board=createLudoBoard();board.position.y=1.46;scene.add(board);
  const chairs=[],characters=[],keys=[];
  for(let seat=0;seat<4;seat++){
    const angle=-Math.PI/4+seat*Math.PI/2;
    const chair=createGameChair();chair.position.set(Math.sin(angle)*4.6,0,Math.cos(angle)*4.6);chair.rotation.y=angle+Math.PI;scene.add(chair);chairs.push(chair);
  }
  const pawns=[];
  for(let seat=0;seat<4;seat++)for(let piece=0;piece<4;piece++){
    const model=createLudoPawn({seat,number:piece+1});model.userData.piece=piece;model.userData.seat=seat;scene.add(model);
    pawns.push({model,seat,piece,target:new THREE.Vector3(),initialized:false,playable:false});
  }
  const diePivot=new THREE.Group(),die=createLudoDie();die.position.y=-.215;diePivot.add(die);diePivot.position.set(3.08,1.675,0);scene.add(diePivot);
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
        scene.add(character.group);characters[p.seat]=character;keys[p.seat]=key;
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
  const size=new THREE.Vector2();
  function frame(dt){
    if(disposed)return;time+=dt;
    // bindRenderer sizes to the window; this game's canvas lives inside a stage.
    canvas.style.width='100%';canvas.style.height='100%';
    const w=canvas.clientWidth,h=canvas.clientHeight;renderer.getSize(size);
    if(w&&h&&(size.x!==w||size.y!==h)){
      renderer.setSize(w,h,false);const aspect=w/h,span=Math.max(h<400&&w>h?4.6:5.4,5.1/aspect);
      camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();
    }
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
    renderer.render(scene,camera);
  }
  function setView(top){camera.position.set(0,top?19:15,top?.01:10);camera.lookAt(0,1,0);}
  function projectPiece(seat,piece){const p=pawns.find(p=>p.seat===seat&&p.piece===piece),v=p.model.position.clone();v.y+=.2;v.project(camera);const r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
  function dispose(){disposed=true;unbind();canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',hover);characters.forEach(c=>c.dispose());disposeModel(scene);renderer.dispose();}
  return {update,frame,setView,dispose,characters,pawns,projectPiece,renderer};
}
