import * as THREE from 'three';
import {loadAvatar,loadName} from '/engine/avatar.js';
import {sound} from '/engine/fx.js';
import {createGameMenu,toggleMute} from '/engine/ui.js';
import {holdButton} from '/engine/touch.js';
import {bindRenderer,pixelRatio} from '/engine/settings.js';
import {RaceRoom} from './network.js';
import {standings} from './rules.js';
import {at,angle,wrap,nearest,samples,LENGTH,LAPS,groundAt,waterDepth,WATER_Y,WETLANDS,JUMPS,sector,formatTime} from './course.js';
import {createRaceScene} from './scene.js';
import {createRider} from './rider.js';
import {createHorseWaterFX} from './water-fx.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),avatar=loadAvatar(),name=loadName();
let coat='bay';try{coat=['bay','palomino','grey'].includes(localStorage.getItem('galope:coat'))?localStorage.getItem('galope:coat'):'bay';}catch{}
const code=(params.get('room')||Math.random().toString(36).slice(2,8)).slice(0,24);params.set('room',code);history.replaceState(null,'',`${location.pathname}?${params}`);
const invite=new URL(location.href);invite.searchParams.delete('name');invite.searchParams.delete('debug');invite.searchParams.delete('manual');
const keys=new Set(),touch=new Set(),riders=new Map();let paused=false,state,world,ready=false,lastPhase='',lastCountdown='',lastRace=0,hoofClock=0,drawClock=0,disposed=false;
const room=new RaceRoom({code,name,avatar,coat,onState:s=>{state=s;},onStatus:(message,error=false)=>{$('connection').textContent=message;$('practice').classList.toggle('hidden',!error);if(error)showNotice(message);}});state=room.state;
const touchButtons=[];
function clearInput(){keys.clear();for(const b of touchButtons)b.release();touch.clear();}
const menu=createGameMenu({title:'Galope',sound,orientation:'horizontal',note:()=>room.members.size>1?'La carrera sigue mientras abres el menú.':'La carrera está en pausa.',
  controls:[['W / ↑','Avanzar'],['A D / ← →','Girar'],['S / ↓','Frenar'],['Shift','Remate: gasta resistencia'],['Espacio','Saltar troncos'],['R','Volver al camino'],['M','Sonido'],['Esc','Menú']],
  invite:()=>invite.href,actions:[{id:'local-race',label:'Abrir carrera local',run:()=>room.practice()}],onOpen(){paused=true;clearInput();},onClose(){paused=false;}});
const navButton='pk-btn pk-btn--sm game-menu-button';
$('game-nav').append(menu.createInviteButton({id:'invite',label:'Invitar',className:navButton}),menu.createSoundButton({id:'sound',className:navButton}),menu.createButton({id:'menu',className:navButton}));
$('lobby-cta').append(menu.createInviteButton({id:'lobby-invite',label:'Invitar panas',className:'pk-btn'}));
$('room-code').textContent=code.toUpperCase();
// Horse names for the HUD; the stamina panel is 12 pips, the last 4 kept for the remate.
const COAT_NAMES={bay:'Castaño',palomino:'Dorado',grey:'Tordillo'},PIPS=12,RESERVE=4,coarse=matchMedia('(pointer:coarse)').matches;
$('stamina-pips').replaceChildren(...Array.from({length:PIPS},()=>document.createElement('i')));
$('jump-key').textContent=coarse?'Toca Salto':'Espacio para saltar';
function showNotice(text){$('notice').textContent=text;$('notice').classList.remove('hidden');clearTimeout(showNotice.timer);showNotice.timer=setTimeout(()=>$('notice').classList.add('hidden'),3000);}
function unlock(){try{sound.unlock();}catch{}}
window.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')||paused)return;
  if(e.code==='KeyM'){toggleMute();return;}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyR'].includes(e.code)){
    e.preventDefault();keys.add(e.code);unlock();
  }
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput();});
// Held touch buttons (engine/touch.js): one per input, several fingers at once.
for(const b of document.querySelectorAll('[data-input]'))touchButtons.push(holdButton(b,{paused:()=>paused,
  down:()=>{touch.add(b.dataset.input);unlock();},up:()=>touch.delete(b.dataset.input)}));
function input(){if(paused)return {};return {throttle:keys.has('KeyS')||keys.has('ArrowDown')||touch.has('brake')?-1:keys.has('KeyW')||keys.has('ArrowUp')||touch.has('go')?1:0,
  steer:Number(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left'))-Number(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right')),
  sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')||touch.has('sprint'),jump:keys.has('Space')||touch.has('jump'),reset:keys.has('KeyR')};}
function choose(value){coat=value;for(const b of document.querySelectorAll('[data-coat]'))b.setAttribute('aria-pressed',String(b.dataset.coat===value));try{localStorage.setItem('galope:coat',value);}catch{}room.choose(value);}
for(const b of document.querySelectorAll('[data-coat]'))b.onclick=()=>choose(b.dataset.coat);
choose(coat);
$('start').onclick=$('again').onclick=()=>{unlock();room.start($('bots').checked);};
$('practice').onclick=()=>{room.practice();$('practice').classList.add('hidden');};
// Let the loading state paint before the shared procedural models are constructed.
await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,30)));
world=createRaceScene($('world'));const {renderer,scene,camera,sun,course}=world;
renderer.setPixelRatio(pixelRatio(1.5));const unbind=bindRenderer(renderer,1.5);
const waterFX=createHorseWaterFX({waterY:WATER_Y,depthAt:waterDepth});scene.add(waterFX.group);const dummy=new THREE.Object3D();
const dustGeometry=new THREE.SphereGeometry(.12,5,4),dustMaterial=new THREE.MeshBasicMaterial({color:0xd9c89b,transparent:true,opacity:.22});
const dust=new THREE.InstancedMesh(dustGeometry,dustMaterial,20);dust.frustumCulled=false;scene.add(dust);
$('map-length').textContent=`${(LENGTH*LAPS/1000).toFixed(1).replace('.',',')} KM`;
const mapCtx=$('map').getContext('2d'),look=new THREE.Vector3(),cameraGoal=new THREE.Vector3();let cameraReady=false;
// Cache the real wetland footprint once, including the island and winding creek.
const mapScale=.74,wetlandMap=document.createElement('canvas');wetlandMap.width=220;wetlandMap.height=190;
const wetlandCtx=wetlandMap.getContext('2d');wetlandCtx.fillStyle='#699589';
for(let z=0;z<190;z++)for(let x=0;x<220;x++)if(groundAt((x-110)/mapScale,(z-97)/mapScale)<WATER_Y-.015)wetlandCtx.fillRect(x,z,1,1);
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}resize();window.addEventListener('resize',resize);
function ensureRiders(){
  const people=state.players.length?state.players:[{id:'preview',name,avatar,coat,x:at(-5).x,z:at(-5).z,h:at(-5).h,speed:0,jumpY:0}];
  for(const [id,r]of riders)if(!people.some(p=>p.id===id)){r.dispose();riders.delete(id);}
  for(const p of people){
    const key=JSON.stringify([p.avatar,p.coat]),old=riders.get(p.id);
    if(old?.key===key)continue;
    if(old){old.dispose();riders.delete(p.id);}
    const r=createRider(p.avatar,p.coat,7);r.key=key;r.group.position.set(p.x,groundAt(p.x,p.z),p.z);r.group.rotation.y=p.h;scene.add(r.group);riders.set(p.id,r);
  }
  return people;
}
function drawMap(player){
  const c=mapCtx;c.clearRect(0,0,220,190);const xy=(x,z)=>[110+x*mapScale,97+z*mapScale];
  c.drawImage(wetlandMap,0,0);
  c.strokeStyle='#c6b68c';c.lineWidth=5;c.lineJoin='round';c.beginPath();samples.forEach((p,i)=>i?c.lineTo(...xy(p.x,p.z)):c.moveTo(...xy(p.x,p.z)));c.closePath();c.stroke();
  for(const j of JUMPS){const p=at(j.s);c.fillStyle='#e3a35d';c.fillRect(...xy(p.x-2,p.z-2),4,4);}
  for(const p of state.players){if(p.spectator)continue;c.fillStyle=p.id===player?.id?'#ffc629':'#f3e9d7';c.beginPath();c.arc(...xy(p.x,p.z),p.id===player?.id?4.5:2.6,0,Math.PI*2);c.fill();}
  const start=at(0);c.fillStyle='#fff';c.fillRect(...xy(start.x-2,start.z-2),4,4);
}
function updateUI(){
  const lobby=state.phase==='lobby',done=state.phase==='finished',playing=!lobby&&!done;
  document.body.classList.toggle('in-lobby',lobby);$('lobby').classList.toggle('hidden',!lobby);$('hud').classList.toggle('hidden',!playing);$('results').classList.toggle('hidden',!done);
  $('start').disabled=!room.connected||!room.isHost||!ready;$('start').firstChild.textContent=!room.connected?'Conectando… ':room.isHost?'¡A la salida! ':'Esperando al anfitrión… ';
  $('again').disabled=!room.connected||!room.isHost;$('again').firstChild.textContent=room.isHost?'Otra carrera ':'Esperando al anfitrión… ';
  const own=state.players.find(p=>p.id===room.id),ordered=standings(state),place=ordered.findIndex(p=>p.id===room.id)+1;
  $('place').textContent=place||'—';$('field-size').textContent=`de ${ordered.length}`;
  $('lap').textContent=`${Math.min(LAPS,1+Math.max(0,Math.floor((own?.progress||0)/LENGTH)))} / ${LAPS}`;
  $('timer').textContent=formatTime(own?.finish??state.time);
  $('sector').textContent=own?.spectator?'Corres en la próxima':sector(own?.s||0);
  const stamina=own?.stamina??100,lit=Math.ceil(stamina/100*PIPS-.01);$('speed').textContent=Math.round((own?.speed||0)*3.6);$('stamina-label').textContent=`${Math.round(stamina)}%`;
  [...$('stamina-pips').children].forEach((pip,i)=>pip.className=i>=lit?'':own?.exhausted?'tired':i<RESERVE?'on':'teal');
  $('horse-name').textContent=COAT_NAMES[own?.coat||coat];
  // ¡Tronco! shows while the next log is a few strides ahead.
  const racing=state.phase==='racing'&&state.time>=.75&&own&&!own.spectator&&own.finish==null,ahead=racing?Math.min(...JUMPS.map(j=>wrap(j.s-own.s,LENGTH))):Infinity;
  $('jump-cue').classList.toggle('hidden',!(ahead>2.5&&ahead<18&&!(own.jumpY>.2)));
  $('gait').textContent=own?.water>.08?'CRUZANDO EL ESTERO':own?.exhausted?'RECUPERANDO':own?.speed>13?'¡AL REMATE!':own?.speed>4?'AL GALOPE':'AL PASO';
  $('riding-tip').textContent=own?.finish!==null&&own?.finish!==undefined?'¡En la meta! Esperando a tus panas.':own?.stun>0?'¡El tronco! Salta un poco antes.':own?.water>.08?'El agua frena. Aquí recuperas fuerzas.':own?.exhausted?'Afloja el remate para recuperar fuerzas.':'Guarda fuerzas para el remate.';
  $('leaderboard').replaceChildren(...ordered.slice(0,6).map((p,i)=>{const li=document.createElement('li');li.className=p.id===room.id?'pk-row is-me me':'pk-row';const b=document.createElement('b');b.className='pk-row-n';b.textContent=i+1;const span=document.createElement('span');span.className='row-name';span.textContent=p.name+(p.id===room.id?' · tú':'');const horse=document.createElement('span');horse.className='pk-row-end';horse.textContent=COAT_NAMES[p.coat]||'';li.append(b,span,horse);return li;}));
  const count=state.phase==='countdown'?String(Math.max(1,Math.ceil(state.countdown))):state.phase==='racing'&&state.time<.75?'¡ARRE!':'';
  $('countdown').classList.toggle('hidden',!count);$('countdown').textContent=count;
  if(count&&count!==lastCountdown){sound.tone(count==='¡ARRE!'?740:370,0,.12,'triangle',.06);lastCountdown=count;}
  if(state.raceId!==lastRace){lastRace=state.raceId;cameraReady=false;waterFX.reset();clearInput();}
  if(done&&(lastPhase!==state.phase||$('result-board').childElementCount!==ordered.length)){
    $('result-title').textContent=place===1?'¡Ganaste, pana!':own?.finish!==null?'¡Llegaste, pana!':'¡Se cerró la carrera!';
    $('result-copy').textContent=own?.finish!=null?`${place}.º lugar · ${formatTime(own.finish)} · ${own.hits} tropiezos`:'La próxima salida es tuya. Sigue las estacas y guarda fuerzas.';
    $('result-board').replaceChildren(...ordered.map((p,i)=>{const li=document.createElement('li');li.className=p.id===room.id?'pk-row is-me me':'pk-row';const b=document.createElement('b'),span=document.createElement('span'),time=document.createElement('time');b.className='pk-row-n';span.className='row-name';time.className='pk-row-end';b.textContent=i+1;span.textContent=p.name+(p.bot?' · hato':'');time.textContent=p.finish===null?'Sin terminar':formatTime(p.finish);li.append(b,span,time);return li;}));
    if(lastPhase!==state.phase)sound.tone(660,0,.25,'triangle',.08);
  }
  lastPhase=state.phase;drawMap(own);
}
ensureRiders();ready=true;$('loading').classList.add('hidden');room.connect();updateUI();
const clock=new THREE.Clock();let elapsed=0;
function frame(){
  if(disposed)return;const dt=Math.min(clock.getDelta(),.08),frozen=paused&&room.members.size<=1;if(!frozen)elapsed+=dt;
  const people=ensureRiders();
  for(const p of people){const r=riders.get(p.id),y=groundAt(p.x,p.z)+(p.jumpY||0),blend=1-Math.exp(-dt*18);
    r.group.visible=!p.spectator;r.group.position.lerp(new THREE.Vector3(p.x,y,p.z),blend);r.group.rotation.y+=angle(p.h-r.group.rotation.y)*blend;r.update(frozen?0:dt,p);
  }
  const own=people.find(p=>p.id===room.id),p=own&&!own.spectator?own:standings(state)[0]||people[0],r=riders.get(p.id),q=r.group.position,h=r.group.rotation.y;
  if(state.phase==='lobby'){
    const mobile=innerWidth<700;cameraGoal.set(q.x-7,q.y+3.8,q.z+7);look.set(q.x+(mobile?0:-2.6),q.y+(mobile?.3:1.3),q.z+(mobile?0:-1.8));
    if(mobile)cameraGoal.set(q.x-6,q.y+4,q.z+8);
  }else{cameraGoal.set(q.x-Math.sin(h)*7.7,q.y+3.6,q.z-Math.cos(h)*7.7);look.set(q.x+Math.sin(h)*4.6,q.y+1.2,q.z+Math.cos(h)*4.6);}
  if(!cameraReady){camera.position.copy(cameraGoal);cameraReady=true;}else camera.position.lerp(cameraGoal,1-Math.exp(-dt*5));camera.lookAt(look);
  // Follow the local rider with a bounded shadow frustum.
  sun.position.set(q.x-45,70,q.z+35);sun.target.position.set(q.x,0,q.z);sun.target.updateMatrixWorld();
  course.update(elapsed);world.sky.update(elapsed);
  waterFX.update(elapsed,people,riders,q);
  dust.visible=p.water<.04&&p.speed>4&&p.jumpY<.4;
  if(dust.visible){for(let i=0;i<20;i++){
    const age=(elapsed*1.4+i/20)%1,side=i%2?1:-1;
    dummy.position.set(q.x-Math.sin(h)*age*2.8+Math.cos(h)*side*(.3+age*.6),q.y+.1+age*.45,q.z-Math.cos(h)*age*2.8-Math.sin(h)*side*(.3+age*.6));dummy.scale.setScalar(1+age*3);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);}dust.instanceMatrix.needsUpdate=true;}
  if(!frozen&&state.phase==='racing'&&p.speed>3){hoofClock+=dt;if(hoofClock>1/(2+p.speed*.32)){hoofClock=0;sound.tone(p.water>.04?160:90,0,.035,'triangle',p.water>.04?.035:.045);}}
  drawClock+=dt;if(drawClock>.1){updateUI();drawClock=0;}
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Network simulation is independent of render cadence; guests send inputs at 20Hz.
let simulationTime=performance.now();
const simulation=setInterval(()=>{const now=performance.now(),dt=(now-simulationTime)/1000;simulationTime=now;if(params.has('manual'))return;room.tick(dt,input(),paused&&room.members.size<=1);},50);
if(params.has('debug'))window.galope={room,get state(){return state;},world,riders,waterFX,input,
  manual(value){if(value)params.set('manual','');else params.delete('manual');simulationTime=performance.now();},
  step(seconds,controls={}){for(let t=0;t<seconds;t+=.05)room.tick(.05,controls);updateUI();},
  place(id,s,offset=0){const p=room.game.players.find(p=>p.id===id),q=at(s,offset);Object.assign(p,{x:q.x,z:q.z,h:q.h,s:q.s,progress:s,checkpoint:Math.max(0,Math.floor(s/(LENGTH/8))+1),speed:0,jumpY:0,vy:0,stun:0});room.publish();},
  at,LENGTH,JUMPS,groundAt,waterS:nearest(WETLANDS[0].x,WETLANDS[0].z).s,updateUI};
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(simulation);room.dispose();for(const r of riders.values())r.dispose();course.dispose();world.sky.dispose();waterFX.dispose();dustGeometry.dispose();dustMaterial.dispose();unbind?.();renderer.dispose();},{once:true});
// Back/forward cache restores a disposed WebGL scene; rebuild and rejoin safely.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
