import * as THREE from 'three';
import { boardPoint } from './board-model.js';

// Light the whole local yard, independent of where its pawns have travelled.
export function createTurnSpotlight(scene, audio) {
  const lights=[];
  scene.traverse(node=>{if(node.isLight)lights.push({node,intensity:node.intensity});});
  const spot=new THREE.SpotLight('#fff1d2',0,0,.38,.8,0);
  spot.name='ludo-turn-spotlight';scene.add(spot,spot.target);
  let previous=null,started=null,seat=-1;
  function update(state,ownSeat) {
    const ready=state.phase==='playing'&&!state.turnPause&&state.turn===ownSeat;
    if(previous && ready && (!previous.ready||previous.round!==state.round)) {
      seat=ownSeat;started=performance.now();
      const points=[0,1,2,3].map(piece=>boardPoint(seat,-1,piece,state.players.length));
      const x=points.reduce((sum,p)=>sum+p[0],0)/4,z=points.reduce((sum,p)=>sum+p[1],0)/4;
      spot.position.set(x,8,z);spot.target.position.set(x,1.5,z);
      audio.moment('turn');
    }
    if(!ready)started=null;
    previous={ready,round:state.round};
  }
  function frame() {
    const t=started===null?4:(performance.now()-started)/1000;
    const strength=Math.max(0,Math.min(1,t/.35,(3.2-t)/.65));
    lights.forEach(({node,intensity})=>{node.intensity=intensity*(1-.6*strength);});
    spot.intensity=3*strength;
  }
  function dispose(){lights.forEach(({node,intensity})=>{node.intensity=intensity;});scene.remove(spot,spot.target);spot.dispose();}
  return {update,frame,dispose,get active(){return spot.intensity>0;},get seat(){return seat;},light:spot};
}
