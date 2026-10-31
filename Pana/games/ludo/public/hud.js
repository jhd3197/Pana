import { COLORS, COLOR_NAMES, trackOf } from './rules.js';
import { moveHint } from './hud-model.js';
import { icon } from '/engine/icons.js';
import { loc } from '/engine/i18n.js';

const $=id=>document.getElementById(id);
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};

export function createLudoHud({buttons,canInspect=()=>true}) {
  let state=null,seat=-1,ownId=null,eventText='',shownDie=-1,rolling=false,held=false,latched=false;
  // A plate per possible seat; seats beyond the table's count stay hidden.
  const cards=COLORS.map((_,i)=>{
    const card=document.createElement('li');card.className='score';card.style.setProperty('--seat-color',COLORS[i]);
    card.innerHTML=`<div class="score-head"><i></i><b translate="no"></b><small></small></div><ol class="race-tracks"></ol><div class="score-foot"><span>${loc('En meta')} <b></b></span><span>${loc('Se comió')} <b></b></span></div>`;
    const tracks=Array.from({length:4},(_,piece)=>{
      const track=document.createElement('li');track.className='race-track';
      const number=document.createElement('span');number.textContent=piece+1;
      const line=document.createElement('span');line.className='race-line';line.innerHTML='<i></i><b></b>';
      const end=document.createElement('span');end.className='race-end';end.append(icon('crown'));
      track.append(number,line,end);card.querySelector('ol').append(track);return track;
    });
    $('scoreboard').append(card);return {card,tracks};
  });
  function showDetails(){
    const show=!!state&&state.phase!=='lobby'&&(held||latched)&&canInspect();
    $('scoreboard').hidden=!show;$('details').setAttribute('aria-expanded',String(show));
  }
  function keydown(e){if(e.key==='Shift'&&!e.target.closest?.('input,textarea,select,[contenteditable]')){held=true;showDetails();}}
  function keyup(e){if(e.key==='Shift'){held=e.shiftKey;showDetails();}}
  function clear(){held=latched=false;showDetails();}
  function visibility(){if(document.hidden)clear();}
  function toggle(){latched=!latched;showDetails();}
  addEventListener('keydown',keydown);addEventListener('keyup',keyup);addEventListener('blur',clear);
  document.addEventListener('visibilitychange',visibility);$('details').addEventListener('click',toggle);
  function die(value){
    if(shownDie===value)return;shownDie=value;$('die').replaceChildren();
    for(let i=0;i<9;i++){const pip=document.createElement('i');pip.className=PIPS[value]?.includes(i)?'pip on':'pip';$('die').append(pip);}
    if(!value){const unknown=document.createElement('span');unknown.className='die-unknown';unknown.textContent=rolling?'…':'—';$('die').append(unknown);}
    $('die').classList.toggle('six',value===6);$('die').setAttribute('aria-label',value?loc('Último dado: {n}',{n:value}):rolling?loc('Dado en el aire'):loc('Todavía no se ha tirado'));
  }
  function paint(){
    if(!state)return;
    const mine=state.phase==='playing'&&state.turn===seat&&!state.turnPause,player=state.players[state.turn];
    $('turn').textContent=state.phase==='finished'?loc('¡Partida terminada!'):state.phase==='starter'?loc('¿Quién empieza?'):rolling?loc('¡Ahí va el dado!'):state.turnPause?state.turnPause.kind==='move'?loc('{name} mueve su ficha',{name:player.name}):`${player.name}: ${state.lastDie}`:mine?state.die?state.autoMove?state.die===6?loc('¡Seis!'):loc('Salió {n}',{n:state.die}):loc('Elige una ficha'):loc('¡Te toca tirar!'):loc('Turno de {name}',{name:player.name});
    $('event').textContent=rolling?loc('Espera a que caiga…'):eventText;
    $('roll-label').textContent=rolling?loc('Rodando…'):mine?loc('Agita y suelta'):loc('Juega {name}',{name:player.name});
    $('die').classList.toggle('rolling',rolling);die(rolling?0:state.lastDie);
    buttons.forEach((button,i)=>{
      const hint=moveHint(state,seat,i),value=state.players[seat]?.pieces[i],{home}=trackOf(state);
      button.disabled=rolling||!hint.legal;
      button.style.setProperty('--seat-color',COLORS[seat]||COLORS[0]);button.dataset.kind=hint.kind;
      button.classList.toggle('recommended',!rolling&&hint.recommended);
      const head=document.createElement('span');head.className='piece-title';
      const dot=document.createElement('i'),name=document.createElement('b');name.textContent=loc('Ficha {n}',{n:i+1});head.append(dot,name);
      const key=document.createElement('kbd');key.textContent=i+1;head.append(key);
      const label=document.createElement('small');label.textContent=rolling?(value<0?loc('En el patio'):value===home?loc('En casa'):loc('Espera el dado')):hint.label;
      button.replaceChildren(head,label);button.setAttribute('aria-label',hint.recommended&&!rolling?loc('Ficha {n}: {state} · recomendada',{n:i+1,state:label.textContent}):loc('Ficha {n}: {state}',{n:i+1,state:label.textContent}));
    });
  }
  function update(next,ownSeat,id,text){
    state=next;seat=ownSeat;ownId=id;eventText=text;
    const {home}=trackOf(state);$('scoreboard').dataset.seats=state.players.length;
    cards.forEach(({card,tracks},i)=>{
      const p=state.players[i];card.hidden=!p;if(!p)return;
      card.classList.toggle('active',state.phase==='playing'&&state.turn===i);
      card.querySelector('.score-head b').textContent=p.name;
      card.querySelector('.score-head small').textContent=(p.id===ownId?loc('{color} · tú',{color:loc(COLOR_NAMES[i])}):p.id===null?loc('{color} · bot',{color:loc(COLOR_NAMES[i])}):loc('{color} · pana',{color:loc(COLOR_NAMES[i])}));
      tracks.forEach((track,j)=>{
        const progress=p.pieces[j];track.style.setProperty('--progress',`${Math.max(0,progress+1)/(home+1)*100}%`);
        track.classList.toggle('yard',progress<0);track.classList.toggle('home',progress===home);
        track.setAttribute('aria-label',progress<0?loc('Ficha {n}: en el patio',{n:j+1}):progress===home?loc('Ficha {n}: en casa',{n:j+1}):loc('Ficha {n}: {left} para llegar',{n:j+1,left:home-progress}));
      });
      const totals=card.querySelectorAll('.score-foot b');totals[0].textContent=`${p.pieces.filter(v=>v===home).length}/4`;totals[1].textContent=state.captures?.[i]||0;
    });
    if(state.phase==='lobby')clear();showDetails();paint();
  }
  function frame(tossing,shaking,power){
    const next=tossing||shaking;
    if(next!==rolling){rolling=next;shownDie=-1;paint();}
    if(state)$('roll').disabled=tossing||!!state.turnPause||state.phase!=='playing'||state.turn!==seat||!!state.die;
    $('roll').style.setProperty('--charge',`${Math.round(power*100)}%`);
    if(!canInspect()&&(held||latched))clear();
  }
  function dispose(){removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);$('details').removeEventListener('click',toggle);}
  return {update,frame,dispose};
}
