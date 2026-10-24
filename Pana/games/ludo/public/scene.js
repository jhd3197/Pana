import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { createGameTable, createGameChair, disposeModel } from '/engine/models/props/game-table.js';
import { createLudoToss } from './dice-timing.js';
import { createStarterStage } from '/engine/play/quien-empieza.js';
import { sound, Puffs, Shockwaves } from '/engine/fx.js';
import { createLudoBoard, createLudoPawn, createLudoDie, boardPoint } from './board-model.js';
import { createCaminoMotion } from './camino-motion.js';
import { chooseMotion } from './motion-choice.js';
import { createLudoMoments } from './moments.js';
import { createLudoSounds } from './sounds.js';
import { poseFace } from './studio-finish.js';
import { sharedCellLayout } from './piece-layout.js';
import { COLORS, HOME, legalMoves } from './rules.js';

const PAWN_Y = 1.67, DIE_Y = 1.835, HOP = .15, FLIGHT = .95;
// Die orientations with each value facing up (+Y).
const FACE_UP = { 1: [0, 0, 0], 2: [-Math.PI / 2, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 5: [Math.PI / 2, 0, 0], 6: [Math.PI, 0, 0] };
// Follow the board rotation: red near-left, green far-left, yellow far-right, blue near-right.
const seatAngle = seat => -Math.PI / 4 - seat * Math.PI / 2;

export function createLudoScene(canvas, { onPiece, onCapture, onStarter } = {}) {
  // The shared plaza stage (perspective camera, sky, sun) like Billar and Póquer.
  const audio=createLudoSounds(sound,{audible:()=>!document.hidden});
  const stage=createTableWorld(canvas),{renderer,scene,camera}=stage,own=new THREE.Group();scene.add(own);
  // Reuse the shared table and chairs; the board sits above the felt.
  const table=createGameTable({feltColor:'#334f49',caption:''});own.add(table);
  const board=createLudoBoard();board.position.y=1.46;own.add(board);
  const chairs=[],characters=[],keys=[],moods=[0,0,0,0].map(()=>({kind:'',t:0}));
  for(let seat=0;seat<4;seat++){
    const angle=seatAngle(seat);
    const chair=createGameChair();chair.position.set(Math.sin(angle)*4.6,0,Math.cos(angle)*4.6);chair.rotation.y=angle+Math.PI;own.add(chair);chairs.push(chair);
  }
  const puffs=new Puffs(own),waves=new Shockwaves(own);
  const pawns=[];
  for(let seat=0;seat<4;seat++)for(let piece=0;piece<4;piece++){
    const model=createLudoPawn({seat,number:piece+1});model.userData.piece=piece;model.userData.seat=seat;own.add(model);
    pawns.push({model,seat,piece,target:new THREE.Vector3(),initialized:false,playable:false,progress:-1,path:null,flight:null,squash:0});
  }
  const moments=createLudoMoments(own,pawns,audio,board);
  const diePivot=new THREE.Group(),die=createLudoDie();die.position.y=-.215;diePivot.add(die);diePivot.position.set(3.08,1.675,0);own.add(diePivot);
  // ¿Quién empieza?: a cacho on the board's edge in front of each pana.
  const starter=createStarterStage({root:own,camera,canvas,scale:.62,onInput:onStarter,
    spot:seat=>{const a=seatAngle(seat);return{position:[Math.sin(a)*2.95,1.665,Math.cos(a)*2.95],out:[Math.sin(a),Math.cos(a)]};}});
  const ray=new THREE.Raycaster(),cursor=new THREE.Vector2();
  let current=null,time=0,lastRoll='',lastRound=-1,disposed=false,toss=null,shake=0;
  const rest=diePivot.position.clone();
  const final=new THREE.Quaternion(),spin=new THREE.Quaternion(),axis=new THREE.Vector3();
  function pick(event){
    const r=canvas.getBoundingClientRect();cursor.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);ray.setFromCamera(cursor,camera);
    const hit=ray.intersectObjects(pawns.filter(p=>p.playable).map(p=>p.model),true)[0];
    if(!hit)return null;let node=hit.object;while(node && node.userData.piece===undefined)node=node.parent;return node?.userData.piece ?? null;
  }
  function click(e){const piece=pick(e);if(piece!==null)onPiece?.(piece);}
  function hover(e){canvas.style.cursor=pick(e)===null?'default':'pointer';}
  canvas.addEventListener('click',click);canvas.addEventListener('pointermove',hover);
  const cell=(seat,progress,piece)=>{const [x,z]=boardPoint(seat,progress,piece);return new THREE.Vector3(x,PAWN_Y,z);};
  // Where a seat's thrower holds the die: over the board edge in front of their chair.
  const handFor=seat=>{const a=seatAngle(seat);return new THREE.Vector3(Math.sin(a)*3.25,2.35,Math.cos(a)*3.25);};
  function throwDie(state){
    const {seat,power}=state.toss||{seat:state.turn,power:.5},a=seatAngle(seat),from=handFor(seat);
    const seed=state.rng>>>0,side=((seed>>>8&255)/255-.5)*1.1,reach=2.35-power*2.05;
    const to=new THREE.Vector3(Math.sin(a)*reach+Math.cos(a)*side,DIE_Y,Math.cos(a)*reach-Math.sin(a)*side);
    toss={path:createLudoToss({from:from.toArray(),to:to.toArray(),power,seed}),started:performance.now(),t:0,hit:0,power,value:state.lastDie};
    final.setFromEuler(new THREE.Euler(...FACE_UP[state.lastDie])).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(seed&1023)/1023*Math.PI*2));
    audio.throw(power);
  }
  function update(state,ownSeat){
    moments.update(state);current=state;
    for(const p of state.players){
      const avatar=normalizeAvatar(p.id===null?{outfitColor:COLORS[p.seat],hat:'none',face:'feliz'}:p.avatar),key=JSON.stringify(avatar);
      if(keys[p.seat]!==key){
        characters[p.seat]?.dispose();const character=buildCharacter(avatar,{seated:true});
        character.group.position.copy(chairs[p.seat].position);character.group.position.y=.76;character.group.rotation.y=chairs[p.seat].rotation.y;
        own.add(character.group);characters[p.seat]=character;keys[p.seat]=key;
      }
    }
    // Moves since the last state: a pawn hops cell by cell; rivals it lands on fly home.
    const sameRound=state.round===lastRound,legal=legalMoves(state,ownSeat),occupancy=new Map(),hopping=[],eaten=[];
    // Finish interrupted tricks before reading positions for the next action.
    // A partner being captured/moved must never be restored to an old pose later.
    const changed=new Set(pawns.filter(p=>state.players[p.seat].pieces[p.piece]!==p.progress));
    for(const p of pawns)if(p.motion){
      if(!sameRound||changed.size){
        p.motion.sample(1,time,p.displayScale||1);p.motion.dispose();p.motion=null;p.path=null;
      }
    }
    for(const p of pawns){
      const progress=state.players[p.seat].pieces[p.piece],key=boardPoint(p.seat,progress,p.piece).join(',');
      if(!occupancy.has(key))occupancy.set(key,[]);occupancy.get(key).push(p);
    }
    for(const p of pawns){
      const progress=state.players[p.seat].pieces[p.piece],before=p.progress;
      if(progress!==before||!sameRound)p.eats=null;
      if(p.initialized&&sameRound&&progress!==before){
        if(progress>=0&&(before<0||progress>before)){
          p.from=before;
          p.path=(before<0?[0]:Array.from({length:progress-before},(_,i)=>before+1+i)).map(v=>cell(p.seat,v,p.piece));
          p.path.unshift(p.target.clone());p.hop=0;p.cell=undefined;p.flight=null;hopping.push(p);
        } else if(progress<0){p.path=null;eaten.push(p);}
      }
      p.progress=progress;
      let [x,z]=boardPoint(p.seat,progress,p.piece);
      const group=occupancy.get(`${x},${z}`),layout=sharedCellLayout(group.length,group.indexOf(p));
      p.displayScale=progress===HOME?1:layout.scale;
      p.target.set(x+(progress===HOME?0:layout.x),PAWN_Y+(progress===HOME?0:layout.y),z+(progress===HOME?0:layout.z));p.playable=p.seat===ownSeat&&legal.includes(p.piece);
      p.model.userData.halo.visible=p.playable;
      if(progress===HOME){p.target.x+=(p.piece%2-.5)*.2;p.target.z+=(Math.floor(p.piece/2)-.5)*.2;}
      if(!p.initialized||!sameRound){p.model.position.copy(p.target);p.model.rotation.set(0,0,0);p.path=p.flight=null;p.initialized=true;}
    }
    for(const p of pawns)if(p.path)p.path[p.path.length-1].copy(p.target);
    if(eaten.length){
      const mover=hopping[0],delay=mover?(mover.path.length-1)*HOP:0;
      if(mover)mover.eats={victims:eaten.map(p=>p.seat)};
      for(const p of eaten)p.flight={from:p.model.position.clone(),t:-delay,spin:(p.piece%2?1:-1)*(3+p.piece)};
    }
    for(const p of hopping){
      const partners=pawns.filter(q=>q!==p&&!changed.has(q)&&q.progress>=0&&q.progress<HOME&&q.displayScale===1&&!pawns.some(a=>a.motion?.partner===q.model)&&p.path.some(at=>at.distanceTo(q.target)<.55));
      const friend=partners.find(q=>q.seat===p.seat),rival=partners.find(q=>q.seat!==p.seat);
      let style=chooseMotion({rng:state.rng,revision:state.revision,seat:p.seat,piece:p.piece,steps:p.path.length-1,friend:!!friend,rival:!!rival,capture:!!p.eats});
      const crossed=partners.find(q=>p.path.slice(1,-1).some(at=>Math.hypot(at.x-q.target.x,at.z-q.target.z)<.15));
      if(!p.eats&&p.progress>=51)style='sprint';
      else if(!p.eats&&crossed&&(state.rng%3===0||p.path.length<=3))style='leap';
      p.lastMotion=style;
      if(style!=='hop'){
        audio.trick(style);p.motionCell=0;
        const partner=style==='highfive'||style==='piggy'?friend:style==='dodge'?rival:style==='leap'?crossed:null;
        if(partner){partner.path=partner.flight=null;partner.model.position.copy(partner.target);partner.model.scale.setScalar(partner.displayScale);}
        p.motion=createCaminoMotion(own,p.model,p.path,style,COLORS[p.seat],partner?.model);
        p.motionTime=0;p.motionDuration=Math.max(.9,(p.path.length-1)*.22);
      }
    }
    lastRound=state.round;
    starter.update(state.phase==='starter'?state.starter:null,{ownSeat,names:state.players.map(p=>p.name)});
    const key=`${state.round}:${state.rng}`;
    if(key!==lastRoll&&state.lastDie&&lastRoll)throwDie(state);
    else if(key!==lastRoll&&state.lastDie){final.setFromEuler(new THREE.Euler(...FACE_UP[state.lastDie]));diePivot.quaternion.copy(final);}
    lastRoll=key;
  }
  // The capture: a dust ring where the hunter lands, the victim's colour in the
  // air, and both panas at the table react.
  function land(p){
    p.squash=1;audio.land({entry:p.from<0,home:p.progress===HOME,capture:!!p.eats,win:p.progress===HOME&&current?.winner===p.seat});
    moments.land(p);
    if(!p.eats)return;
    const at=p.model.position;
    waves.ring(at,{color:COLORS[p.seat],startRadius:.05,maxRadius:.75,life:.45,yOffset:.02});
    for(const seat of p.eats.victims){puffs.spawn(at,{color:COLORS[seat],count:7,spread:.35,size:.32,rise:1.1,life:.8});moods[seat]={kind:'mad',t:2.2};}
    waves.sparkle(at,{color:0xffc629,count:8,spread:.18,life:.45});
    moods[p.seat]={kind:'cheer',t:2.2};
    onCapture?.({by:p.seat,victims:p.eats.victims});p.eats=null;
  }
  // The table, chairs and seated panas, framed inside the canvas between the HUD bars.
  const bounds=new THREE.Box3(new THREE.Vector3(-3.65,.9,-3.65),new THREE.Vector3(3.65,2.65,3.65));
  const focus=bounds.getCenter(new THREE.Vector3()),nearClearance=bounds.getSize(new THREE.Vector3()).length()/2+.5;
  let top=false;
  const dock=document.querySelector('.action-panel');
  function frame(dt){
    if(disposed)return;moments.restore();time+=dt;
    const {w,h}=stage.resize(),margin=Math.min(24,w*.04);
    const active=current?.phase==='playing'||current?.phase==='finished',rect=active?dock?.getBoundingClientRect():null;
    const landscape=active&&h<540&&w>700,topInset=active?104:margin;
    const bottom=rect&&!landscape?Math.max(margin,h-rect.top+18):margin;
    stage.frameCamera(bounds,top?[0,6,.35]:[0,1.4,1],{x:margin,y:topInset,width:Math.max(160,landscape?rect.left-margin*2:w-margin*2),height:Math.max(120,h-topInset-bottom)});
    // Keep plaza decorations between the camera and the table out of the close view.
    camera.near=Math.max(.1,camera.position.distanceTo(focus)-nearClearance);camera.updateProjectionMatrix();
    for(const p of pawns){
      const m=p.model;
      poseFace(m,time,p.flight?'surprised':p.progress===HOME?'happy':'idle');
      if(p.motion){
        p.motionTime+=dt;
      } else if(p.flight){
        // Knocked off the board: a high spinning arc back to the yard, a bounce, dust.
        const f=p.flight;f.t+=dt;const k=Math.min(1,Math.max(0,f.t/FLIGHT));
        if(f.t>0){
          m.position.lerpVectors(f.from,p.target,k);m.position.y+=Math.sin(k*Math.PI)*2.1;
          m.rotation.set(k*Math.PI*f.spin,0,k*Math.PI*2.2);
          if(k>=1){p.flight=null;m.rotation.set(0,0,0);m.position.copy(p.target);p.squash=1.4;puffs.spawn(p.target,{color:0xe8dcc0,count:4,spread:.25,size:.22,rise:.6,life:.6});audio.returnHome();}
        }
      } else if(p.path){
        p.hop+=dt/HOP;const i=Math.min(p.path.length-2,Math.floor(p.hop)),k=Math.min(1,p.hop-i);
        if(i!==p.cell){if(p.cell!==undefined)audio.step(i);p.cell=i;}
        m.position.lerpVectors(p.path[i],p.path[i+1],k);m.position.y+=Math.sin(k*Math.PI)*(p.path.length>2?.32:.5);
        if(p.hop>=p.path.length-1){m.position.copy(p.target);p.path=null;land(p);}
      } else m.position.lerp(p.target,1-Math.exp(-dt*12));
      p.squash=Math.max(0,p.squash-dt*5);
      const pulse=p.playable?1.05+Math.sin(time*4)*.05:1,squash=Math.sin(p.squash*Math.PI)*.22;
      const size=p.displayScale||1;
      m.scale.set(size*pulse*(1+squash),size*pulse*(1-squash),size*pulse*(1+squash));
    }
    // Sample after all ordinary pawns, so a partner pose cannot be overwritten.
    for(const p of pawns)if(p.motion){
      const t=Math.min(1,p.motionTime/p.motionDuration);p.motion.sample(t,time,p.displayScale||1);
      const motionCell=Math.floor(t*(p.path.length-1));
      if(t<1&&motionCell>p.motionCell){audio.step(motionCell);p.motionCell=motionCell;}
      if(t===1){p.motion.dispose();p.motion=null;p.path=null;p.model.position.copy(p.target);land(p);}
    }
    characters.forEach((c,seat)=>{c.update(dt,{});const won=current?.winner===seat,mood=moods[seat];mood.t=Math.max(0,mood.t-dt);
      const cheer=won||mood.kind==='cheer'&&mood.t>0,mad=mood.kind==='mad'&&mood.t>0;
      c.arms.forEach((arm,j)=>arm.rotation.set(cheer?-1.8+Math.sin(time*(won?5:9)+j)*.25:mad?-1.25+Math.sin(time*14+j*Math.PI)*.45:-.55,0,(j?-1:1)*(mad?.5:.15)));
      c.neck.rotation.x=mad?-.1:.12;c.neck.rotation.y=mad?Math.sin(time*16)*.35:Math.sin(time*.6+seat)*.08;
    });
    if(toss){
      // In flight: the die follows the thrown arc and tumbles onto its face.
      toss.t=Math.max(toss.t+dt,(performance.now()-toss.started)/1000);const s=toss.path.at(toss.t);diePivot.position.fromArray(s.position);
      spin.setFromAxisAngle(axis.fromArray(s.axis),s.turn);diePivot.quaternion.copy(final).premultiply(spin);
      const suspense=Math.max(0,(toss.t/toss.path.duration-.65)/.35);
      if(suspense>0&&suspense<1){const tilt=Math.sin(suspense*Math.PI)*.32;diePivot.rotateX(tilt);diePivot.position.y+=Math.sin(tilt)*.1;}
      while(toss.hit<toss.path.impacts.length&&toss.t>=toss.path.impacts[toss.hit].t){
        const hit=toss.path.impacts[toss.hit++];audio.bounce(hit.strength);
        if(hit.strength===1)puffs.spawn(diePivot.position.clone().setY(1.6),{color:0xf3e9d7,count:3,spread:.2,size:.18,rise:.4,life:.45});
      }
      if(s.done){audio.result(toss.value);toss=null;rest.copy(diePivot.position);}
    } else if(shake>0&&current){
      // Shaken in the hand before the throw: the harder, the wilder.
      const hand=handFor(current.turn),j=.03+shake*.09;
      diePivot.position.set(hand.x+Math.sin(time*47)*j,hand.y+Math.abs(Math.sin(time*31))*j*1.5,hand.z+Math.cos(time*53)*j);
      diePivot.rotation.set(time*(6+shake*14),time*(4+shake*9),time*5);
    }
    puffs.update(dt);waves.update(dt);starter.frame(dt);
    moments.frame(dt,!!toss);stage.draw(dt);
  }
  // The local thrower shaking the die (0 = not shaking; up to 1 = as hard as it gets).
  let nextShakeSound=0;
  function shakeDie(power){
    if(power>0&&!shake){toss=null;}
    const now=performance.now();
    if(power>0&&now>=nextShakeSound){audio.shake(power);nextShakeSound=now+180-power*80;}
    if(!power&&shake&&!toss){diePivot.quaternion.copy(final);diePivot.position.copy(rest);}
    shake=power;
  }
  function setView(value){top=!!value;}
  function projectPiece(seat,piece){const p=pawns.find(p=>p.seat===seat&&p.piece===piece),v=p.model.position.clone();v.y+=.2*p.model.scale.y;v.project(camera);const r=canvas.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};}
  function dispose(){disposed=true;moments.dispose();canvas.removeEventListener('click',click);canvas.removeEventListener('pointermove',hover);starter.dispose();pawns.forEach(p=>p.motion?.dispose());characters.forEach(c=>c.dispose());puffs.clear();waves.clear();disposeModel(own);stage.dispose();}
  return {moments,get celebrating(){return moments.celebrating;},update,frame,setView,shakeDie,dispose,characters,pawns,starter,projectPiece,renderer,scene,camera,get die(){return diePivot;},get tossing(){return !!toss;}};
}
