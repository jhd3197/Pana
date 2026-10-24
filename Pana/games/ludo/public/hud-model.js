import { HOME, SAFE, ringIndex, legalMoves, chooseMove } from './rules.js';

export function moveHint(state,seat,piece) {
  const value=state.players[seat]?.pieces[piece],legal=legalMoves(state,seat).includes(piece);
  const result={legal,recommended:legal&&chooseMove(state)===piece,kind:'normal'};
  if(value===undefined)return {...result,label:'Mirando la mesa'};
  if(value===HOME)return {...result,label:'En casa',kind:'home'};
  if(!legal){
    const label=value<0?(state.turn===seat&&state.die?state.options.entry==='one-six'?'Necesitas 1 o 6':'Necesitas un 6':'En el patio'):
      state.turn===seat&&state.die&&value+state.die>HOME?'Necesitas el número exacto':`${HOME-value} para llegar`;
    return {...result,label};
  }
  if(value<0)return {...result,label:'Sale al camino'};
  const next=value+state.die;
  if(next===HOME)return {...result,label:'¡A la meta!',kind:'home'};
  const index=ringIndex(seat,next);
  if(next<=50&&!SAFE.includes(index)){
    const victims=state.players.filter(p=>p.seat!==seat&&p.pieces.some(v=>v>=0&&v<=50&&ringIndex(p.seat,v)===index));
    if(victims.length)return {...result,label:`Se come a ${victims.map(p=>p.name).join(' y ')}`,kind:'capture'};
  }
  return {...result,label:`Avanza ${state.die}${next<=50&&SAFE.includes(index)?' · segura':''}`};
}
