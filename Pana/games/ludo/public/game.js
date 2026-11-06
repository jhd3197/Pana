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
import { createMangoWallet } from '/engine/mangos.js';
import { icon } from '/engine/icons.js';
import { createDieShop, DEFAULT_DIE, MANGO_DIE } from './die-shop.js';
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
  invite:()=>room.offline?null:inviteUrl(code),
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
const wallet=createMangoWallet(undefined,{source:'ludo'}),dieShop=createDieShop({wallet});
function renderDieShop(){
  const {action,cost,missing}=dieShop.offer(MANGO_DIE),label=document.createElement('span');
  label.textContent=action==='buy'?loc('Comprar dado de mango · {n}',{n:cost}):action==='short'?loc('Dado de mango · te faltan {n}',{n:missing}):action==='equip'?loc('Usar dado de mango'):loc('Guardar dado de mango');
  $('die-shop').replaceChildren(icon('mango'),label);$('die-shop').disabled=action==='short';$('die-shop').setAttribute('aria-pressed',String(action==='unequip'));
}
$('die-shop').onclick=()=>{
  sound.unlock();const {action}=dieShop.offer(MANGO_DIE);
  if(action==='buy'&&dieShop.buy(MANGO_DIE))shout(loc('¡Dado de mango en la mesa!'),{tone:'yellow',ms:1500});
  else if(action==='equip')dieShop.equip(MANGO_DIE);
  else if(action==='unequip')dieShop.equip(DEFAULT_DIE);
  world?.setDieLook(dieShop.equipped());renderDieShop();
};
renderDieShop();wallet.ready.then(renderDieShop);const stopWallet=wallet.onChange(renderDieShop);
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
  if(state.options.extraOnOne!==false)document.querySelector('.rules-summary').textContent+=' '+loc('Un 1 que mueve da otra tirada, hasta tres seguidas.');
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
  if(stopped)return;world=createLudoScene($('world'),{onPiece:piece=>act('move',{piece}),onCapture:capture,onStarter:(kind,power)=>{if(!menu.isOpen){sound.unlock();room.action('starter',{cacho:kind,power});}},dieLook:dieShop.equipped()});await prepareScene(world);render(room.state);$('loading').hidden=true;
}).catch(error=>{console.error(error);$('loading-copy').textContent=loc('No pudimos abrir la mesa. Comprueba tu conexión y WebGL.');const button=document.createElement('button');button.className='pk-btn';button.textContent=loc('Reintentar');button.onclick=()=>location.reload();$('loading').append(button);throw error;});
addEventListener('pagehide',()=>{stopped=true;stopWallet();clearInterval(timer);thrower.dispose();hud.dispose();room.dispose();world?.dispose();},{once:true});
if(params.has('debug'))window.ludoDebug={room,menu,chooseMove,legalMoves,thrower,get world(){return world;}};
