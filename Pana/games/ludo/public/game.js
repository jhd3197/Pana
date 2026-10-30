import { presentedState } from './dice-timing.js';
import { createLudoHud } from './hud.js';
import { loadName, loadAvatar } from '/engine/avatar.js';
import { prepareScene } from '/engine/game-load.js';
import { createGameMenu, toggleMute } from '/engine/ui.js';
import { fillRoster } from '/engine/results.js';
import { inviteUrl, newRoomCode, roomFromUrl } from '/engine/invite.js';
import { sound } from '/engine/fx.js';
import { shout } from '/engine/kit.js';
import { bindDiceThrow } from '/engine/play/dice-throw.js';
import { LudoRoom } from './network.js';
import { COLOR_NAMES, trackOf, legalMoves, chooseMove, ranking, eventText as eventLine } from './rules.js';
import { loc, locn, formatList } from '/engine/i18n.js';
import { createRoomOptions } from '/engine/room-options.js';
import { LUDO_OPTIONS, defaultLudoOptions } from './options.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const code=roomFromUrl()||newRoomCode();
params.set('room',code);history.replaceState(null,'',`${location.pathname}?${params}`);
let world=null,stopped=false,topView=false;
const room=new LudoRoom({code,name:loadName(),avatar:loadAvatar(),onState:render,
  onStatus(text,failed=false){$('connection').textContent=text;$('practice').hidden=!failed;render(room.state);},
});
const roomOptions=createRoomOptions($('room-options'),{title:loc('Ludo'),fields:LUDO_OPTIONS,
  change:options=>room.action('options',{options}),reset:()=>room.action('options',{options:defaultLudoOptions()})});
const menu=createGameMenu({ pad: { buttons: true, keys: { x: ['Space', loc('Agitar el dado; suelta para tirar')], rt: ['Space', loc('Agitar el dado; suelta para tirar')] } },title:loc('Ludo · Pana'),sound,orientation:'libre',
  note:()=>room.members.size>1?loc('La partida continúa mientras estás en el menú.'):loc('La partida está en pausa. Los bots te esperan.'),
  controls:[[loc('Mantén Espacio'),loc('Agitar el dado; suelta para tirar')],[loc('Arrastra y suelta en la mesa'),loc('Lanzar el dado con más fuerza')],['1 2 3 4',loc('Mover una ficha disponible')],[loc('Ratón / toque'),loc('Tocar una ficha marcada o su botón')],['M',loc('Activar o silenciar el sonido')]],
  tips:[
    loc('Cada pana tiene cuatro fichas. Gana quien lleva las cuatro hasta el centro.'),
    loc('¿Quién empieza? Todos sacuden el cacho a la vez y lo tapan: sale primero el dado más alto. Si hay empate arriba, solo los empatados sacuden otra vez. El anfitrión puede cambiarlo en Más ajustes.'),
    loc('Agita el dado manteniendo el botón o Espacio y suéltalo, o lánzalo arrastrando sobre la mesa. Cuanto más lo agitas, más fuerte vuela; la fuerza no cambia el número.'),
    loc('El anfitrión elige si sales con seis o con uno y seis. Al salir, la ficha queda en la casilla de salida.'),
    loc('Salida asistida: si todas tus fichas pendientes están en el patio, tras un límite aleatorio de tres a cinco intentos fallidos sale un seis. Se aplica a todos; la sala puede elegir azar clásico.'),
    loc('Un único movimiento legal se hace solo al caer el dado. Si solo puedes sacar fichas del patio, sale la primera automáticamente.'),
    loc('Un seis permite volver a tirar. Si la sala activa la regla, el tercer seis seguido pierde ese lanzamiento y termina el turno; los movimientos anteriores se conservan.'),
    loc('Las casillas con doble borde y un círculo son seguras: aquí no se come. En las demás, caer sobre fichas rivales las devuelve a su patio. La sala puede dar otra tirada al capturar.'),
    loc('Las fichas pueden compartir casilla y no forman barreras. El pasillo de tu color es privado. Debes sacar el número exacto para llegar a casa.'),
    loc('Si no tienes movimiento, el turno pasa automáticamente. Los puestos vacíos juegan con bots; un pana que llega hereda las fichas de un bot.'),
  ],invite:()=>room.offline?null:inviteUrl(code),
});
$('game-nav').append(menu.createInviteButton({id:'invite',className:'pk-btn'}),menu.createButton({id:'menu',className:'pk-btn'}));
$('lobby-invite-slot').replaceWith(menu.createInviteButton({id:'lobby-invite',className:'pk-btn'}));
$('lobby-room').textContent=loc('Sala {code}',{code});
$('rules').onclick=()=>menu.open('controls');
$('start').onclick=$('again').onclick=()=>{sound.unlock();room.action('start');};
// Shake and throw: hold the button or Space, or flick across the table.
const thrower=bindDiceThrow({button:$('roll'),surface:$('world'),canThrow:canRoll,
  onStart:()=>sound.unlock(),onThrow:power=>{world?.shakeDie(0);act('roll',{power});},onCancel:()=>world?.shakeDie(0)});
$('practice').onclick=()=>room.practice();
$('view').onclick=()=>{topView=!topView;world?.setView(topView);$('view').textContent=topView?loc('Vista de mesa'):loc('Vista desde arriba');$('view').setAttribute('aria-pressed',String(topView));};
const buttons=Array.from({length:4},(_,piece)=>{
  const button=document.createElement('button');button.className='pk-btn piece-button';button.dataset.piece=piece;
  button.onclick=()=>act('move',{piece});$('pieces').append(button);return button;
});
const hud=createLudoHud({buttons,canInspect:()=>!menu.isOpen});
function ownTurn(){return !!world&&room.connected&&room.state.phase==='playing'&&!room.state.turnPause&&!world.moving&&room.seat===room.state.turn;}
function canRoll(){return ownTurn()&&!menu.isOpen&&!room.state.die&&!world?.tossing;}
// Eating a ficha: a callout for the panas involved, the plaza for everyone else.
function capture({by,victims}){
  const mine=room.seat,names=victims.map(seat=>room.state.players[seat].name);
  if(by===mine)shout(victims.length>1?loc('¡Te comiste {n}!',{n:victims.length}):loc('¡Te la comiste!'),{tone:'yellow',ms:1500});
  else if(victims.includes(mine))shout(loc('¡{name} te comió!',{name:room.state.players[by].name}),{ms:1500});
  else shout(loc('¡{name} se comió a {names}!',{name:room.state.players[by].name,names:formatList(names)}),{tone:'yellow',ms:1400});
}
function act(action,values={}){if(menu.isOpen||!ownTurn()||action==='move'&&world?.tossing)return;sound.unlock();room.action(action,values);}
function render(rawState){
  const state=presentedState(rawState);
  const lobby=state.phase==='lobby',ended=state.phase==='finished',seat=room.seat;
  roomOptions.update(state.options,lobby&&room.isHost);
  if(!lobby&&roomOptions.isOpen)roomOptions.close();
  document.querySelector('.rules-summary').textContent=state.options.entry==='six'?loc('Saca un seis para salir. Captura a tus rivales y lleva tus cuatro fichas al centro con el número exacto.'):loc('Sal con uno o seis. Captura a tus rivales y lleva tus cuatro fichas al centro con el número exacto.');
  if(state.options.assistedEntry)document.querySelector('.rules-summary').textContent+=' '+loc('Salida asistida: ayuda tras un límite aleatorio de tres a cinco intentos sin salir.');
  document.body.classList.toggle('in-lobby',lobby);$('welcome').hidden=!lobby;$('hud').hidden=lobby;
  $('start').disabled=!world||!room.connected||!room.isHost;
  $('start').textContent=!world?loc('Preparando la mesa…'):!room.connected?loc('Conectando…'):room.isHost?loc('¡Jugar!'):loc('Espera al anfitrión');
  $('invite').disabled=$('lobby-invite').disabled=!room.connected||room.offline;
  fillRoster($('lobby-roster'),state.players.map(p=>({rank:p.seat+1,name:p.id===room.id?loc('{name} · tú',{name:p.name}):p.name,detail:loc(COLOR_NAMES[p.seat]),end:p.id===null?loc('Bot'):loc('Listo'),me:p.id===room.id})));
  let eventText=eventLine(state.event);
  if(state.options.assistedEntry&&state.phase==='playing'&&!state.die&&state.entryMisses?.[state.turn])eventText+=' '+locn(state.entryMisses[state.turn],'Salida asistida: {n} intentos sin salir.','Salida asistida: {n} intentos sin salir.');
  $('roll').disabled=!ownTurn()||!!state.die;
  if($('roll').disabled)thrower.cancel();
  $('results').hidden=!ended;$('again').disabled=!room.connected||!room.isHost;
  if(ended){
    $('result-title').textContent=loc('¡Ganó {name}!',{name:state.players[state.winner].name});
    const ranked=ranking(state.players);
    fillRoster($('result-roster'),ranked.map((p,i)=>({rank:i+1,name:p.name,detail:loc(COLOR_NAMES[p.seat]),end:`${p.pieces.filter(v=>v===trackOf(state).home).length}/4`,me:p.id===room.id})));
  }
  world?.update(state,room.connected?seat:-1);
  if(ended)$('results').hidden=!!world?.celebrating;
  hud.update(state,room.connected?seat:-1,room.id,eventText);
  hud.frame(!!world?.tossing,thrower.shaking,thrower.power);

}
addEventListener('keydown',event=>{
  if(menu.isOpen||event.repeat||event.target.closest?.('input,textarea,select,[contenteditable]'))return;
  if(event.key.toLowerCase()==='m')toggleMute();
  if(event.key.toLowerCase()==='v'&&!$('hud').hidden)$('view').click();
  if(/^[1-4]$/.test(event.key)){event.preventDefault();act('move',{piece:Number(event.key)-1});}
});
let previous=performance.now();
const timer=setInterval(()=>{const now=performance.now();room.tick(Math.min(.2,(now-previous)/1000),menu.isOpen&&room.members.size<=1);previous=now;},100);
let frameTime=performance.now();
function frame(now){if(stopped)return;if(thrower.shaking)world?.shakeDie(thrower.power);world?.frame(Math.min(.05,(now-frameTime)/1000));hud.frame(!!world?.tossing,thrower.shaking,thrower.power);if(room.state.phase==='finished')$('results').hidden=!!world?.celebrating;frameTime=now;requestAnimationFrame(frame);}
requestAnimationFrame(frame);
render(room.state);room.connect();
export const sceneReady=import('./scene.js').then(async({createLudoScene})=>{
  if(stopped)return;world=createLudoScene($('world'),{onPiece:piece=>act('move',{piece}),onCapture:capture,onStarter:(kind,power)=>{if(!menu.isOpen){sound.unlock();room.action('starter',{cacho:kind,power});}}});await prepareScene(world);render(room.state);$('loading').hidden=true;
}).catch(error=>{console.error(error);$('loading-copy').textContent=loc('No pudimos abrir la mesa. Comprueba tu conexión y WebGL.');const button=document.createElement('button');button.className='pk-btn';button.textContent=loc('Reintentar');button.onclick=()=>location.reload();$('loading').append(button);throw error;});
addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);thrower.dispose();hud.dispose();room.dispose();world?.dispose();},{once:true});
if(params.has('debug'))window.ludoDebug={room,menu,chooseMove,legalMoves,thrower,get world(){return world;}};
