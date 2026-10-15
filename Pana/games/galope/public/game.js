import * as THREE from 'three';
import {loadAvatar,loadName} from '/engine/avatar.js';
import {sound} from '/engine/fx.js';
import {createGameMenu,toggleMute} from '/engine/ui.js';
import {bindRenderer,pixelRatio} from '/engine/settings.js';
import {RaceRoom} from './network.js';
import {standings} from './rules.js';
import {at,angle,nearest,samples,LENGTH,LAPS,groundAt,WATER_Y,WETLANDS,JUMPS,sector,formatTime} from './course.js';
import {createRaceScene} from './scene.js';
import {createRider} from './rider.js';

const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),avatar=loadAvatar(),name=loadName();
let coat='bay';try{coat=['bay','palomino','grey'].includes(localStorage.getItem('galope:coat'))?localStorage.getItem('galope:coat'):'bay';}catch{}
const code=(params.get('room')||Math.random().toString(36).slice(2,8)).slice(0,24);params.set('room',code);history.replaceState(null,'',`${location.pathname}?${params}`);
const invite=new URL(location.href);invite.searchParams.delete('name');invite.searchParams.delete('debug');invite.searchParams.delete('manual');
const keys=new Set(),touch=new Set(),riders=new Map();let paused=false,state,world,ready=false,lastPhase='',lastCountdown='',lastRace=0,hoofClock=0,drawClock=0,disposed=false;
const room=new RaceRoom({code,name,avatar,coat,onState:s=>{state=s;},onStatus:(message,error=false)=>{$('connection').textContent=message;$('practice').classList.toggle('hidden',!error);if(error)showNotice(message);}});state=room.state;
function clearInput(){keys.clear();touch.clear();document.querySelectorAll('[data-input]').forEach(b=>b.classList.remove('held'));}
const menu=createGameMenu({title:'Galope',sound,note:()=>room.members.size>1?'La carrera sigue mientras abres el menú.':'La carrera está en pausa.',
  controls:[['W / ↑','Avanzar'],['A D / ← →','Girar'],['S / ↓','Frenar'],['Shift','Remate: gasta resistencia'],['Espacio','Saltar troncos'],['R','Volver al camino'],['M','Sonido'],['Esc','Menú']],
  invite:()=>invite.href,actions:[{id:'local-race',label:'Abrir carrera local',run:()=>room.practice()}],onOpen(){paused=true;clearInput();},onClose(){paused=false;}});
$('game-nav').append(menu.createInviteButton({id:'invite',label:'Invitar',className:'game-menu-button'}),menu.createSoundButton({id:'sound',className:'game-menu-button'}),menu.createButton({id:'menu',className:'game-menu-button'}));
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
for(const b of document.querySelectorAll('[data-input]')){
  b.addEventListener('pointerdown',e=>{if(paused)return;e.preventDefault();b.setPointerCapture(e.pointerId);touch.add(b.dataset.input);b.classList.add('held');unlock();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>{touch.delete(b.dataset.input);b.classList.remove('held');});
}
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
const splashGeometry=new THREE.SphereGeometry(.065,5,4),splashMaterial=new THREE.MeshBasicMaterial({color:0xd3eee0,transparent:true,opacity:.65});
const splashes=new THREE.InstancedMesh(splashGeometry,splashMaterial,40);splashes.frustumCulled=false;scene.add(splashes);const dummy=new THREE.Object3D();
const dustGeometry=new THREE.SphereGeometry(.12,5,4),dustMaterial=new THREE.MeshBasicMaterial({color:0xd9c89b,transparent:true,opacity:.22});
const dust=new THREE.InstancedMesh(dustGeometry,dustMaterial,20);dust.frustumCulled=false;scene.add(dust);
const mapCtx=$('map').getContext('2d'),look=new THREE.Vector3(),cameraGoal=new THREE.Vector3();let cameraReady=false;
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
  const c=mapCtx;c.clearRect(0,0,220,190);const xy=(x,z)=>[110+x,97+z];
  c.fillStyle='#699589';for(const w of WETLANDS){c.beginPath();c.ellipse(...xy(w.x,w.z),w.rx,w.rz,0,0,Math.PI*2);c.fill();}
  c.strokeStyle='#c6b68c';c.lineWidth=5;c.lineJoin='round';c.beginPath();samples.forEach((p,i)=>i?c.lineTo(...xy(p.x,p.z)):c.moveTo(...xy(p.x,p.z)));c.closePath();c.stroke();
  for(const j of JUMPS){const p=at(j.s);c.fillStyle='#e3a35d';c.fillRect(...xy(p.x-2,p.z-2),4,4);}
  for(const p of state.players){if(p.spectator)continue;c.fillStyle=p.id===player?.id?'#ffdd8e':'#f7f0da';c.beginPath();c.arc(...xy(p.x,p.z),p.id===player?.id?4.5:2.6,0,Math.PI*2);c.fill();}
  const start=at(0);c.fillStyle='#fff';c.fillRect(...xy(start.x-2,start.z-2),4,4);
}
function updateUI(){
  const lobby=state.phase==='lobby',done=state.phase==='finished',playing=!lobby&&!done;
  document.body.classList.toggle('in-lobby',lobby);$('lobby').classList.toggle('hidden',!lobby);$('hud').classList.toggle('hidden',!playing);$('results').classList.toggle('hidden',!done);
  $('start').disabled=!room.connected||!room.isHost||!ready;$('start').firstChild.textContent=!room.connected?'Conectando… ':room.isHost?'¡A la salida! ':'Esperando al anfitrión… ';
  $('again').disabled=!room.connected||!room.isHost;$('again').firstChild.textContent=room.isHost?'Otra carrera ':'Esperando al anfitrión… ';
  const own=state.players.find(p=>p.id===room.id),ordered=standings(state),place=ordered.findIndex(p=>p.id===room.id)+1;
  $('place').textContent=place||'—';$('field-size').textContent=`/ ${ordered.length}`;
  $('lap').textContent=`${Math.min(LAPS,1+Math.max(0,Math.floor((own?.progress||0)/LENGTH)))} / ${LAPS}`;
  $('timer').textContent=formatTime(own?.finish??state.time);
  $('sector').textContent=own?.spectator?'La carrera ya arrancó · corres en la próxima':sector(own?.s||0);
  $('speed').textContent=Math.round((own?.speed||0)*3.6);$('stamina-fill').style.width=`${own?.stamina??100}%`;$('stamina-label').textContent=`${Math.round(own?.stamina??100)}%`;
  $('gait').textContent=own?.water>.08?'CRUZANDO EL ESTERO':own?.exhausted?'RECUPERANDO':own?.speed>13?'¡AL REMATE!':own?.speed>4?'AL GALOPE':'AL PASO';
  $('riding-tip').textContent=own?.finish!==null&&own?.finish!==undefined?'¡En la meta! Esperando a tus panas.':own?.stun>0?'¡El tronco! Salta un poco antes.':own?.water>.08?'El agua frena. Aquí recuperas fuerzas.':own?.exhausted?'Afloja el remate para recuperar fuerzas.':'Guarda fuerzas para el remate.';
  $('leaderboard').replaceChildren(...ordered.slice(0,6).map((p,i)=>{const li=document.createElement('li');if(p.id===room.id)li.className='me';const b=document.createElement('b');b.textContent=`${i+1}.`;const span=document.createElement('span');span.textContent=p.name+(p.id===room.id?' · tú':'');li.append(b,span);return li;}));
  const count=state.phase==='countdown'?String(Math.max(1,Math.ceil(state.countdown))):state.phase==='racing'&&state.time<.75?'¡ARRE!':'';
  $('countdown').classList.toggle('hidden',!count);$('countdown').textContent=count;
  if(count&&count!==lastCountdown){sound.tone(count==='¡ARRE!'?740:370,0,.12,'triangle',.06);lastCountdown=count;}
  if(state.raceId!==lastRace){lastRace=state.raceId;cameraReady=false;clearInput();}
  if(done&&(lastPhase!==state.phase||$('result-board').childElementCount!==ordered.length)){
    $('result-title').textContent=place===1?'¡Ganaste, pana!':own?.finish!==null?'¡Llegaste, pana!':'¡Se cerró la carrera!';
    $('result-copy').textContent=own?.finish!=null?`${place}.º lugar · ${formatTime(own.finish)} · ${own.hits} tropiezos`:'La próxima salida es tuya. Sigue las estacas y guarda fuerzas.';
    $('result-board').replaceChildren(...ordered.map((p,i)=>{const li=document.createElement('li');if(p.id===room.id)li.className='me';const b=document.createElement('b'),span=document.createElement('span'),time=document.createElement('time');b.textContent=i+1;span.textContent=p.name+(p.bot?' · hato':'');time.textContent=p.finish===null?'Sin terminar':formatTime(p.finish);li.append(b,span,time);return li;}));
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
  splashes.visible=p.water>.04&&p.speed>1&&p.jumpY<.4;dust.visible=p.water<.04&&p.speed>4&&p.jumpY<.4;
  for(const [mesh,count,water]of [[splashes,40,true],[dust,20,false]])if(mesh.visible){for(let i=0;i<count;i++){
    const age=((elapsed*(water?2:1.4)+i/count)%1),side=i%2?1:-1;
    dummy.position.set(q.x-Math.sin(h)*age*2.8+Math.cos(h)*side*(.3+age*.6),water?WATER_Y+Math.sin(age*Math.PI)*.45:q.y+.1+age*.45,q.z-Math.cos(h)*age*2.8-Math.sin(h)*side*(.3+age*.6));dummy.scale.setScalar(water?1-age*.7:1+age*3);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);}mesh.instanceMatrix.needsUpdate=true;}
  if(!frozen&&state.phase==='racing'&&p.speed>3){hoofClock+=dt;if(hoofClock>1/(2+p.speed*.32)){hoofClock=0;sound.tone(p.water>.04?160:90,0,.035,'triangle',p.water>.04?.035:.045);}}
  drawClock+=dt;if(drawClock>.1){updateUI();drawClock=0;}
  renderer.render(scene,camera);requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Network simulation is independent of render cadence; guests send inputs at 20Hz.
let simulationTime=performance.now();
const simulation=setInterval(()=>{const now=performance.now(),dt=(now-simulationTime)/1000;simulationTime=now;if(params.has('manual'))return;room.tick(dt,input(),paused&&room.members.size<=1);},50);
if(params.has('debug'))window.galope={room,get state(){return state;},world,riders,input,
  manual(value){if(value)params.set('manual','');else params.delete('manual');simulationTime=performance.now();},
  step(seconds,controls={}){for(let t=0;t<seconds;t+=.05)room.tick(.05,controls);updateUI();},
  place(id,s,offset=0){const p=room.game.players.find(p=>p.id===id),q=at(s,offset);Object.assign(p,{x:q.x,z:q.z,h:q.h,s:q.s,progress:s,checkpoint:Math.max(0,Math.floor(s/(LENGTH/8))+1),speed:0,jumpY:0,vy:0,stun:0});room.publish();},
  at,LENGTH,JUMPS,groundAt,waterS:nearest(WETLANDS[0].x,WETLANDS[0].z).s,updateUI};
window.addEventListener('pagehide',()=>{disposed=true;clearInterval(simulation);room.dispose();for(const r of riders.values())r.dispose();course.dispose();world.sky.dispose();splashGeometry.dispose();splashMaterial.dispose();dustGeometry.dispose();dustMaterial.dispose();unbind?.();renderer.dispose();},{once:true});
// Back/forward cache restores a disposed WebGL scene; rebuild and rejoin safely.
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
