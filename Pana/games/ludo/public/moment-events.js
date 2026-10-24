import { HOME, SAFE, ringIndex } from './rules.js';
export const MOMENTS = ['intro','turn','suspense','safe','block','leap','sprint','nearmiss','nomoves','sleep','podium'];
export const MOMENT_NAMES = ['Inicio de partida','Tu turno','Dado en suspenso','Casilla segura','Bloqueo','Salto de rana','Recta final','¡Casi!','Sin movimientos','A dormir','Podio'];
export function transitionMoments(before, after) {
  if (!before) return [];
  if (after.round !== before.round) return after.phase === 'starter' ? [{kind:'intro',seat:after.turn}] : [];
  const events=[];
  if (after.rng!==before.rng && after.lastDie && after.phase==='playing') {
    events.push({kind:'suspense',seat:after.toss.seat});
    if (!after.die) events.push({kind:'nomoves',seat:after.toss.seat});
  }
  if (after.phase==='finished'&&before.phase!=='finished') events.push({kind:'podium',seat:after.winner});
  if (after.phase==='playing' && (before.phase==='starter'||after.turn!==before.turn)) events.push({kind:'turn',seat:after.turn});
  return events;
}
export function landingMoments(state, seat, piece) {
  const progress=state.players[seat].pieces[piece];
  if (progress<0||progress>=HOME) return [];
  const index=ringIndex(seat,progress),events=[];
  if (progress<=50&&SAFE.includes(index)) events.push({kind:'safe',seat,piece});
  if (state.players[seat].pieces.filter(v=>v===progress).length>1) events.push({kind:'block',seat,piece});
  if (progress<50&&!SAFE.includes((index+1)%52)) {
    const rival=state.players.find(p=>p.seat!==seat&&p.pieces.some(v=>v>=0&&v<=50&&ringIndex(p.seat,v)===(index+1)%52));
    if(rival)events.push({kind:'nearmiss',seat:rival.seat,piece:rival.pieces.findIndex(v=>v>=0&&v<=50&&ringIndex(rival.seat,v)===(index+1)%52)});
  }
  return events;
}
