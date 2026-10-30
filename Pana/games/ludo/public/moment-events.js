import { trackOf, ringIndex } from './rules.js';
import { locKey } from '../../../engine/i18n.js';
export const MOMENTS = ['intro','turn','suspense','safe','block','leap','sprint','nearmiss','nomoves','sleep','podium'];
// Source text, drawn with loc() on the moment's caption.
export const MOMENT_NAMES = [locKey('Inicio de partida'),locKey('Tu turno'),locKey('Dado en suspenso'),locKey('Casilla segura'),locKey('Bloqueo'),locKey('Salto de rana'),locKey('Recta final'),locKey('¡Casi!'),locKey('Sin movimientos'),locKey('A dormir'),locKey('Podio')];
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
  const progress=state.players[seat].pieces[piece],{seats,ring,lap,home,safe}=trackOf(state);
  if (progress<0||progress>=home) return [];
  const index=ringIndex(seat,progress,seats),ahead=(index+1)%ring,events=[];
  if (progress<=lap&&safe.includes(index)) events.push({kind:'safe',seat,piece});
  if (state.players[seat].pieces.filter(v=>v===progress).length>1) events.push({kind:'block',seat,piece});
  if (progress<lap&&!safe.includes(ahead)) {
    const at=p=>p.pieces.findIndex(v=>v>=0&&v<=lap&&ringIndex(p.seat,v,seats)===ahead);
    const rival=state.players.find(p=>p.seat!==seat&&at(p)>=0);
    if(rival)events.push({kind:'nearmiss',seat:rival.seat,piece:at(rival)});
  }
  return events;
}
