import { HOME, COLORS, COLOR_NAMES } from './rules.js';
import { moveHint } from './hud-model.js';
import { icon } from '/engine/icons.js';

const $=id=>document.getElementById(id);
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]};

export function createLudoHud({buttons,canInspect=()=>true}) {
  let state=null,seat=-1,ownId=null,eventText='',shownDie=-1,rolling=false,held=false,latched=false;
  const cards=Array.from({length:4},(_,i)=>{
    const card=document.createElement('li');card.className='score';card.style.setProperty('--seat-color',COLORS[i]);
    card.innerHTML='<div class="score-head"><i></i><b></b><small></small></div><ol class="race-tracks"></ol><div class="score-foot"><span>En meta <b></b></span><span>Se comió <b></b></span></div>';
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
    $('die').classList.toggle('six',value===6);$('die').setAttribute('aria-label',value?`Último dado: ${value}`:rolling?'Dado en el aire':'Todavía no se ha tirado');
  }
  function paint(){
    if(!state)return;
    const mine=state.phase==='playing'&&state.turn===seat,player=state.players[state.turn];
    $('turn').textContent=state.phase==='finished'?'¡Partida terminada!':state.phase==='starter'?'¿Quién empieza?':rolling?'¡Ahí va el dado!':mine?state.die?state.autoMove?state.die===6?'¡Seis!':`Salió ${state.die}`:'Elige una ficha':'¡Te toca tirar!':`Turno de ${player.name}`;
    $('event').textContent=rolling?'Espera a que caiga…':eventText;
    $('roll-label').textContent=rolling?'Rodando…':mine?'Agita y suelta':`Juega ${player.name}`;
    $('die').classList.toggle('rolling',rolling);die(rolling?0:state.lastDie);
    buttons.forEach((button,i)=>{
      const hint=moveHint(state,seat,i),value=state.players[seat]?.pieces[i];
      button.disabled=rolling||!hint.legal;
      button.style.setProperty('--seat-color',COLORS[seat]||COLORS[0]);button.dataset.kind=hint.kind;
      button.classList.toggle('recommended',!rolling&&hint.recommended);
      const head=document.createElement('span');head.className='piece-title';
      const dot=document.createElement('i'),name=document.createElement('b');name.textContent=`Ficha ${i+1}`;head.append(dot,name);
      const key=document.createElement('kbd');key.textContent=i+1;head.append(key);
      const label=document.createElement('small');label.textContent=rolling?(value<0?'En el patio':value===HOME?'En casa':'Espera el dado'):hint.label;
      button.replaceChildren(head,label);button.setAttribute('aria-label',`Ficha ${i+1}: ${label.textContent}${hint.recommended&&!rolling?' · recomendada':''}`);
    });
  }
  function update(next,ownSeat,id,text){
    state=next;seat=ownSeat;ownId=id;eventText=text;
    cards.forEach(({card,tracks},i)=>{
      const p=state.players[i];card.classList.toggle('active',state.phase==='playing'&&state.turn===i);
      card.querySelector('.score-head b').textContent=p.name;
      card.querySelector('.score-head small').textContent=`${COLOR_NAMES[i]} · ${p.id===ownId?'tú':p.id===null?'bot':'pana'}`;
      tracks.forEach((track,j)=>{
        const progress=p.pieces[j];track.style.setProperty('--progress',`${Math.max(0,progress+1)/57*100}%`);
        track.classList.toggle('yard',progress<0);track.classList.toggle('home',progress===HOME);
        track.setAttribute('aria-label',`Ficha ${j+1}: ${progress<0?'en el patio':progress===HOME?'en casa':`${HOME-progress} para llegar`}`);
      });
      const totals=card.querySelectorAll('.score-foot b');totals[0].textContent=`${p.pieces.filter(v=>v===HOME).length}/4`;totals[1].textContent=state.captures?.[i]||0;
    });
    if(state.phase==='lobby')clear();showDetails();paint();
  }
  function frame(tossing,shaking,power){
    const next=tossing||shaking;
    if(next!==rolling){rolling=next;shownDie=-1;paint();}
    if(state)$('roll').disabled=tossing||state.phase!=='playing'||state.turn!==seat||!!state.die;
    $('roll').style.setProperty('--charge',`${Math.round(power*100)}%`);
    if(!canInspect()&&(held||latched))clear();
  }
  function dispose(){removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);removeEventListener('blur',clear);document.removeEventListener('visibilitychange',visibility);$('details').removeEventListener('click',toggle);}
  return {update,frame,dispose};
}
