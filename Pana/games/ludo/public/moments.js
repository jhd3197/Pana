import { createMomentVisual } from './moment-visual.js';
import { transitionMoments, landingMoments } from './moment-events.js';
import { COLORS, ranking } from './rules.js';

export function createLudoMoments(root,pawns,audio,board=null) {
  let previous=null,state=null,active=null,queue=[],saved=[],idle=0,slept=false;
  const history=[];
  function restore(){for(const {model,position,rotation,scale} of saved){model.position.copy(position);model.rotation.copy(rotation);model.scale.copy(scale);}saved=[];}
  function clear(){restore();active?.visual.dispose();active=null;queue=[];idle=0;slept=false;}
  function enqueue(event){
    if(event.kind==='podium'){active?.visual.dispose();active=null;queue=[];}
    if(event.kind==='suspense'){queue=queue.filter(e=>e.kind!=='sleep');if(active?.kind==='sleep'){active.visual.dispose();active=null;}}
    queue.push(event);queue=queue.slice(-6);
  }
  function update(next){
    restore();if(previous&&(next.round!==previous.round||next.phase==='lobby'))clear();
    if(!previous||next.revision!==previous.revision){idle=0;slept=false;}
    for(const event of transitionMoments(previous,next))if(event.kind!=='turn')enqueue(event);
    state=next;previous={round:next.round,revision:next.revision,phase:next.phase,turn:next.turn,rng:next.rng};
  }
  function land(p){for(const event of landingMoments(state,p.seat,p.piece))enqueue(event);}
  function frame(dt,tossing){
    if(!state)return;
    if(state.phase==='playing'&&!state.die&&!tossing){idle+=dt;if(idle>18&&!slept){slept=true;enqueue({kind:'sleep',seat:state.turn});}}
    if(!active&&queue.length){
      const index=queue.findIndex(e=>e.kind==='intro'||e.kind==='suspense'||!tossing&&!pawns.some(p=>p.path||p.flight||p.motion));
      if(index>=0){const event=queue.splice(index,1)[0],visual=createMomentVisual(event.kind,COLORS[event.seat]);root.add(visual.root);active={...event,visual,time:0,started:performance.now(),duration:event.kind==='podium'?2.6:event.kind==='sleep'?Infinity:1.15};audio.moment(event.kind);history.push(event.kind);if(history.length>32)history.shift();}
    }
    if(!active)return;
    const a=active;a.time=Math.max(a.time+dt,(performance.now()-a.started)/1000);
    let actors=pawns.filter(p=>!p.path&&!p.flight&&!p.motion&&(a.kind==='intro'||p.seat===a.seat&&(a.piece===undefined||p.piece===a.piece)));
    if(a.kind==='podium')actors=ranking(state.players).slice(0,3).map(p=>pawns.find(q=>q.seat===p.seat&&q.piece===0));
    saved=actors.map(({model})=>({model,position:model.position.clone(),rotation:model.rotation.clone(),scale:model.scale.clone()}));
    if(a.kind==='intro'&&board){
      for(const tile of board.children.slice(2)){
        saved.push({model:tile,position:tile.position.clone(),rotation:tile.rotation.clone(),scale:tile.scale.clone()});
        const reveal=Math.min(1,Math.max(.001,(a.time/1.15-Math.hypot(tile.position.x,tile.position.z)*.06)*4));tile.scale.multiplyScalar(reveal);
      }
    }
    a.visual.sample(a.kind==='sleep'?Math.min(.65,a.time/3.2):Math.min(1,a.time/a.duration),actors.map(p=>p.model),a.time);
    if(a.time>=a.duration){restore();a.visual.dispose();active=null;}
  }
  return {update,land,restore,frame,dispose:clear,history,get progress(){return active?active.time/active.duration:0;},get celebrating(){return active?.kind==='podium'||queue.some(e=>e.kind==='podium');}};
}
