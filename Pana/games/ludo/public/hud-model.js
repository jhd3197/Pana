import { trackOf, ringIndex, legalMoves, chooseMove } from './rules.js';
import { loc, formatList } from '../../../engine/i18n.js';

export function moveHint(state,seat,piece) {
  const {seats,lap,home,safe}=trackOf(state),value=state.players[seat]?.pieces[piece],legal=legalMoves(state,seat).includes(piece);
  const result={legal,recommended:legal&&chooseMove(state)===piece,kind:'normal'};
  if(value===undefined)return {...result,label:loc('Mirando la mesa')};
  if(value===home)return {...result,label:loc('En casa'),kind:'home'};
  if(!legal){
    const label=value<0?(state.turn===seat&&state.die?state.options.entry==='one-six'?loc('Necesitas 1 o 6'):loc('Necesitas un 6'):loc('En el patio')):
      state.turn===seat&&state.die&&value+state.die>home?loc('Necesitas el número exacto'):loc('{n} para llegar',{n:home-value});
    return {...result,label};
  }
  if(value<0)return {...result,label:loc('Sale al camino')};
  const next=value+state.die;
  if(next===home)return {...result,label:loc('¡A la meta!'),kind:'home'};
  const index=ringIndex(seat,next,seats);
  if(next<=lap&&!safe.includes(index)){
    const victims=state.players.filter(p=>p.seat!==seat&&p.pieces.some(v=>v>=0&&v<=lap&&ringIndex(p.seat,v,seats)===index));
    if(victims.length)return {...result,label:loc('Se come a {names}',{names:formatList(victims.map(p=>p.name))}),kind:'capture'};
  }
  return {...result,label:next<=lap&&safe.includes(index)?loc('Avanza {n} · segura',{n:state.die}):loc('Avanza {n}',{n:state.die})};
}
