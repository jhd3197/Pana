import { loadName, loadAvatar } from '/engine/avatar.js';
import { prepareScene } from '/engine/game-load.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { sound } from '/engine/fx.js';
import { shout } from '/engine/kit.js';
import { bindDiceThrow } from '/engine/play/dice-throw.js';
import { LudoRoom } from './network.js';
import { HOME, COLORS, COLOR_NAMES, legalMoves, chooseMove, ranking } from './rules.js';
import { createRoomOptions } from '/engine/room-options.js';
import { LUDO_OPTIONS, defaultLudoOptions } from './options.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const code=roomFromUrl()||newRoomCode();
params.set('room',code);history.replaceState(null,'',`${location.pathname}?${params}`);
let world=null,stopped=false,topView=false,lastRevision=-1,lastRound=0;
const room=new LudoRoom({code,name:loadName(),avatar:loadAvatar(),onState:render,
  onStatus(text,failed=false){$('connection').textContent=text;$('practice').hidden=!failed;render(room.state);},
});
const roomOptions=createRoomOptions($('room-options'),{title:'Ludo',fields:LUDO_OPTIONS,
  change:options=>room.action('options',{options}),reset:()=>room.action('options',{options:defaultLudoOptions()})});
const menu=createGameMenu({ pad: { buttons: true, keys: { x: ['Space', 'Agitar el dado; suelta para tirar'], rt: ['Space', 'Agitar el dado; suelta para tirar'] } },title:'Ludo · Pana',sound,orientation:'libre',
  note:()=>room.members.size>1?'La partida continúa mientras estás en el menú.':'La partida está en pausa. Los bots te esperan.',
  controls:[['Mantén Espacio','Agitar el dado; suelta para tirar'],['Arrastra y suelta en la mesa','Lanzar el dado con más fuerza'],['1 2 3 4','Mover una ficha disponible'],['Ratón / toque','Tocar una ficha marcada o su botón'],['M','Activar o silenciar el sonido']],
  tips:[
    'Cada pana tiene cuatro fichas. Gana quien lleva las cuatro hasta el centro.',
    '¿Quién empieza? Todos sacuden el cacho a la vez y lo tapan: sale primero el dado más alto. Si hay empate arriba, solo los empatados sacuden otra vez. El anfitrión puede cambiarlo en Más ajustes.',
    'Agita el dado manteniendo el botón o Espacio y suéltalo, o lánzalo arrastrando sobre la mesa. Cuanto más lo agitas, más fuerte vuela; el número sigue siendo suerte.',
    'El anfitrión elige si sales con seis o con uno y seis. Al salir, la ficha queda en la casilla de salida.',
    'Un seis permite volver a tirar. Si la sala activa la regla, el tercer seis seguido pierde ese lanzamiento y termina el turno; los movimientos anteriores se conservan.',
    'Las casillas con doble borde y un círculo son seguras: aquí no se come. En las demás, caer sobre fichas rivales las devuelve a su patio. La sala puede dar otra tirada al capturar.',
    'Las fichas pueden compartir casilla y no forman barreras. El pasillo de tu color es privado. Debes sacar el número exacto para llegar a casa.',
    'Si no tienes movimiento, el turno pasa automáticamente. Los puestos vacíos juegan con bots; un pana que llega hereda las fichas de un bot.',
  ],invite:()=>room.offline?null:inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({id:'invite',className:'pk-btn'}),menu.createButton({id:'menu',className:'pk-btn'}));
$('lobby-invite-slot').replaceWith(menu.createInviteButton({id:'lobby-invite',className:'pk-btn'}));
$('lobby-room').textContent=`Sala ${code}`;
$('rules').onclick=()=>menu.open('controls');
$('start').onclick=$('again').onclick=()=>{sound.unlock();room.action('start');};
// Shake and throw: hold the button or Space, or flick across the table.
const thrower=bindDiceThrow({button:$('roll'),surface:$('world'),canThrow:canRoll,
  onStart:()=>sound.unlock(),onThrow:power=>{world?.shakeDie(0);act('roll',{power});},onCancel:()=>world?.shakeDie(0)});
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
function canRoll(){return ownTurn()&&!menu.isOpen&&!room.state.die;}
// Eating a ficha: a callout for the panas involved, the plaza for everyone else.
function capture({by,victims}){
  const mine=room.seat,names=victims.map(seat=>room.state.players[seat].name);
  if(by===mine)shout(victims.length>1?`¡Te comiste ${victims.length}!`:'¡Te la comiste!',{tone:'yellow',ms:1500});
  else if(victims.includes(mine))shout(`¡${room.state.players[by].name} te comió!`,{ms:1500});
  else shout(`¡${room.state.players[by].name} se comió a ${names.join(' y ')}!`,{tone:'yellow',ms:1400});
}
function act(action,values={}){if(menu.isOpen||!ownTurn())return;sound.unlock();room.action(action,values);}
function render(state){
  const lobby=state.phase==='lobby',ended=state.phase==='finished',seat=room.seat;
  roomOptions.update(state.options,lobby&&room.isHost);
  if(!lobby&&roomOptions.isOpen)roomOptions.close();
  document.querySelector('.rules-summary').textContent=state.options.entry==='six'?'Saca un seis para salir. Captura a tus rivales y lleva tus cuatro fichas al centro con el número exacto.':'Sal con uno o seis. Captura a tus rivales y lleva tus cuatro fichas al centro con el número exacto.';
  document.body.classList.toggle('in-lobby',lobby);$('welcome').hidden=!lobby;$('hud').hidden=lobby;
  $('start').disabled=!world||!room.connected||!room.isHost;
  $('start').textContent=!world?'Preparando la mesa…':!room.connected?'Conectando…':room.isHost?'¡Jugar!':'Espera al anfitrión';
  $('invite').disabled=$('lobby-invite').disabled=!room.connected||room.offline;
  fillRoster($('lobby-roster'),state.players.map(p=>({rank:p.seat+1,name:p.id===room.id?`${p.name} · tú`:p.name,detail:COLOR_NAMES[p.seat],end:p.id===null?'Bot':'Listo',me:p.id===room.id})));
  state.players.forEach((p,i)=>{
    scores[i].classList.toggle('active',state.phase==='playing'&&state.turn===i);
    scores[i].children[1].textContent=p.id===room.id?`${p.name} · tú`:p.name;
    const rolled=state.starter?.rolls[i],starter=state.phase==='starter';
    scores[i].children[2].textContent=starter?`${COLOR_NAMES[i]} · ${rolled?`sacó ${rolled}`:'sacudiendo'}`:`${COLOR_NAMES[i]} · ${p.pieces.filter(v=>v===HOME).length}/4 en casa`;
  });
  const mine=ownTurn(),moves=legalMoves(state,seat);
  $('turn').textContent=!room.connected?'Reconectando…':ended?'¡Partida terminada!':state.phase==='starter'?'¿Quién empieza?':mine?state.die?'Elige una ficha':'¡Te toca tirar!':`Turno de ${state.players[state.turn].name}`;
  $('event').textContent=state.event;
  $('die').textContent=state.lastDie||'—';$('die').setAttribute('aria-label',state.lastDie?`Último dado: ${state.lastDie}`:'Todavía no se ha tirado');
  $('roll').disabled=!mine||!!state.die;
  if($('roll').disabled)thrower.cancel();
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
    const ranked=ranking(state.players);
    fillRoster($('result-roster'),ranked.map((p,i)=>({rank:i+1,name:p.name,detail:COLOR_NAMES[p.seat],end:`${p.pieces.filter(v=>v===HOME).length}/4`,me:p.id===room.id})));
  }
  if(lastRevision>=0&&state.revision!==lastRevision&&state.round===lastRound&&state.phase==='playing'&&!state.die)sound.tone(380,0,.07,'triangle',.06);
  lastRevision=state.revision;lastRound=state.round;
  world?.update(state,room.connected?seat:-1);
}
addEventListener('keydown',event=>{
  if(menu.isOpen||event.repeat||event.target.closest?.('input,textarea,select,[contenteditable]'))return;
  if(event.key.toLowerCase()==='m')toggleMute();
  if(/^[1-4]$/.test(event.key)){event.preventDefault();act('move',{piece:Number(event.key)-1});}
});
let previous=performance.now();
const timer=setInterval(()=>{const now=performance.now();room.tick(Math.min(.2,(now-previous)/1000),menu.isOpen&&room.members.size<=1);previous=now;},100);
let frameTime=performance.now();
function frame(now){if(stopped)return;if(thrower.shaking)world?.shakeDie(thrower.power);world?.frame(Math.min(.05,(now-frameTime)/1000));frameTime=now;requestAnimationFrame(frame);}
requestAnimationFrame(frame);
render(room.state);room.connect();
export const sceneReady=import('./scene.js').then(async({createLudoScene})=>{
  if(stopped)return;world=createLudoScene($('world'),{onPiece:piece=>act('move',{piece}),onCapture:capture,onStarter:(kind,power)=>{if(!menu.isOpen){sound.unlock();room.action('starter',{cacho:kind,power});}}});await prepareScene(world);render(room.state);$('loading').hidden=true;
}).catch(error=>{console.error(error);$('loading-copy').textContent='No pudimos abrir la mesa. Comprueba tu conexión y WebGL.';const button=document.createElement('button');button.className='pk-btn';button.textContent='Reintentar';button.onclick=()=>location.reload();$('loading').append(button);throw error;});
addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);thrower.dispose();room.dispose();world?.dispose();},{once:true});
if(params.has('debug'))window.ludoDebug={room,menu,chooseMove,legalMoves,thrower,get world(){return world;}};
