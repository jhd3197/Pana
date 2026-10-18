import { loadName, loadAvatar } from '/engine/avatar.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { sound } from '/engine/fx.js';
import { LudoRoom } from './network.js';
import { HOME, COLORS, COLOR_NAMES, legalMoves, chooseMove } from './rules.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const code=roomFromUrl()||newRoomCode();
params.set('room',code);history.replaceState(null,'',`${location.pathname}?${params}`);
let world=null,stopped=false,topView=false,lastRevision=-1,lastRound=0;
const room=new LudoRoom({code,name:loadName(),avatar:loadAvatar(),onState:render,
  onStatus(text,failed=false){$('connection').textContent=text;$('practice').hidden=!failed;render(room.state);},
});
const menu=createGameMenu({title:'Ludo · Pana',sound,orientation:'libre',
  note:()=>room.members.size>1?'La partida continúa mientras estás en el menú.':'La partida está en pausa. Los bots te esperan.',
  controls:[['Espacio','Tirar el dado'],['1 2 3 4','Mover una ficha disponible'],['Ratón / toque','Tocar una ficha marcada o su botón'],['M','Activar o silenciar el sonido']],
  tips:[
    'Cada pana tiene cuatro fichas. Gana quien lleva las cuatro hasta el centro.',
    'Necesitas un seis para sacar una ficha. Al salir, ese seis se usa completo: la ficha queda en la casilla de salida.',
    'Un seis permite volver a tirar. El tercer seis seguido pierde ese lanzamiento y termina el turno; los movimientos anteriores se conservan.',
    'Las casillas con un círculo son seguras. En las demás, caer sobre fichas rivales las devuelve a su patio. Capturar no da un turno extra.',
    'Las fichas pueden compartir casilla y no forman barreras. El pasillo de tu color es privado. Debes sacar el número exacto para llegar a casa.',
    'Si no tienes movimiento, el turno pasa automáticamente. Los puestos vacíos juegan con bots; un pana que llega hereda las fichas de un bot.',
  ],invite:()=>room.offline?null:inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({id:'invite',className:'pk-btn'}),menu.createButton({id:'menu',className:'pk-btn'}));
$('lobby-invite-slot').replaceWith(menu.createInviteButton({id:'lobby-invite',className:'pk-btn'}));
$('lobby-room').textContent=`Sala ${code}`;
$('rules').onclick=()=>menu.open('controls');
$('start').onclick=$('again').onclick=()=>{sound.unlock();room.action('start');};
$('roll').onclick=()=>act('roll');
$('practice').onclick=()=>room.practice();
$('view').onclick=()=>{topView=!topView;world?.setView(topView);$('view').textContent=topView?'Vista de mesa':'Vista desde arriba';$('view').setAttribute('aria-pressed',String(topView));};
const buttons=Array.from({length:4},(_,piece)=>{
  const button=document.createElement('button');button.className='pk-btn piece-button';button.dataset.piece=piece;
  button.onclick=()=>act('move',{piece});$('pieces').append(button);return button;
});
const scores=Array.from({length:4},(_,seat)=>{
  const li=document.createElement('li');li.className='score';li.style.setProperty('--seat-color',COLORS[seat]);
  li.append(document.createElement('i'),document.createElement('b'),document.createElement('small'));$('scoreboard').append(li);return li;
});
function ownTurn(){return !!world&&room.connected&&room.state.phase==='playing'&&room.seat===room.state.turn;}
function act(action,values={}){if(menu.isOpen||!ownTurn())return;sound.unlock();room.action(action,values);}
function render(state){
  const lobby=state.phase==='lobby',ended=state.phase==='finished',seat=room.seat;
  document.body.classList.toggle('in-lobby',lobby);$('welcome').hidden=!lobby;$('hud').hidden=lobby;
  $('start').disabled=!world||!room.connected||!room.isHost;
  $('start').textContent=!world?'Preparando la mesa…':!room.connected?'Conectando…':room.isHost?'¡Jugar!':'Espera al anfitrión';
  $('invite').disabled=$('lobby-invite').disabled=!room.connected||room.offline;
  fillRoster($('lobby-roster'),state.players.map(p=>({rank:p.seat+1,name:p.id===room.id?`${p.name} · tú`:p.name,detail:COLOR_NAMES[p.seat],end:p.id===null?'Bot':'Listo',me:p.id===room.id})));
  state.players.forEach((p,i)=>{
    scores[i].classList.toggle('active',state.phase==='playing'&&state.turn===i);
    scores[i].children[1].textContent=p.id===room.id?`${p.name} · tú`:p.name;
    scores[i].children[2].textContent=`${COLOR_NAMES[i]} · ${p.pieces.filter(v=>v===HOME).length}/4 en casa`;
  });
  const mine=ownTurn(),moves=legalMoves(state,seat);
  $('turn').textContent=!room.connected?'Reconectando…':ended?'¡Partida terminada!':mine?state.die?'Elige una ficha':'¡Te toca tirar!':`Turno de ${state.players[state.turn].name}`;
  $('event').textContent=state.event;
  $('die').textContent=state.lastDie||'—';$('die').setAttribute('aria-label',state.lastDie?`Último dado: ${state.lastDie}`:'Todavía no se ha tirado');
  $('roll').disabled=!mine||!!state.die;
  buttons.forEach((button,i)=>{
    const value=state.players[seat]?.pieces[i];button.disabled=!mine||!moves.includes(i);
    button.style.setProperty('--seat-color',COLORS[seat]||COLORS[0]);
    const label=value===undefined?'Mirando':value<0?'Patio':value===HOME?'En casa':`${HOME-value} a casa`;
    button.replaceChildren(document.createTextNode(String(i+1)));const small=document.createElement('small');small.textContent=label;button.append(small);
    button.setAttribute('aria-label',`Ficha ${i+1}: ${label}`);
  });
  $('results').hidden=!ended;$('again').disabled=!room.connected||!room.isHost;
  if(ended){
    $('result-title').textContent=`¡Ganó ${state.players[state.winner].name}!`;
    const ranked=[...state.players].sort((a,b)=>b.pieces.filter(v=>v===HOME).length-a.pieces.filter(v=>v===HOME).length||b.pieces.reduce((s,v)=>s+v,0)-a.pieces.reduce((s,v)=>s+v,0));
    fillRoster($('result-roster'),ranked.map((p,i)=>({rank:i+1,name:p.name,detail:COLOR_NAMES[p.seat],end:`${p.pieces.filter(v=>v===HOME).length}/4`,me:p.id===room.id})));
  }
  if(lastRevision>=0&&state.revision!==lastRevision&&state.round===lastRound&&state.phase==='playing')sound.tone(state.die?520:380,0,.07,'triangle',.06);
  lastRevision=state.revision;lastRound=state.round;
  world?.update(state,room.connected?seat:-1);
}
addEventListener('keydown',event=>{
  if(menu.isOpen||event.repeat||event.target.closest?.('input,textarea,select,[contenteditable]'))return;
  if(event.key.toLowerCase()==='m')toggleMute();
  if(event.code==='Space'&&!event.target.closest?.('button,a')){event.preventDefault();act('roll');}
  if(/^[1-4]$/.test(event.key)){event.preventDefault();act('move',{piece:Number(event.key)-1});}
});
let previous=performance.now();
const timer=setInterval(()=>{const now=performance.now();room.tick(Math.min(.2,(now-previous)/1000),menu.isOpen&&room.members.size<=1);previous=now;},100);
let frameTime=performance.now();
function frame(now){if(stopped)return;world?.frame(Math.min(.05,(now-frameTime)/1000));frameTime=now;requestAnimationFrame(frame);}
requestAnimationFrame(frame);
render(room.state);room.connect();
import('./scene.js').then(({createLudoScene})=>{
  if(stopped)return;world=createLudoScene($('world'),{onPiece:piece=>act('move',{piece})});render(room.state);$('loading').hidden=true;
}).catch(error=>{console.error(error);$('loading-copy').textContent='No pudimos abrir la mesa. Comprueba tu conexión y WebGL.';const button=document.createElement('button');button.className='pk-btn';button.textContent='Reintentar';button.onclick=()=>location.reload();$('loading').append(button);});
addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);room.dispose();world?.dispose();},{once:true});
if(params.has('debug'))window.ludoDebug={room,menu,chooseMove,legalMoves,get world(){return world;}};
