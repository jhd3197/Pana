import { ratingBadge } from '/engine/kit-rating.js';
import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { createPaintKit, createPaintVest } from '/engine/models/props/paintball-kit.js';
import { MARKERS, ATTACHMENTS, ARMOR, GRENADES, FINISHES, CHARMS, PATTERNS, cleanKit, kitStats, kitRating } from './armory-data.js';
import { Arena } from './rules.js';
import { ICONS } from '/engine/icons.js';
import { pixelRatio } from '/engine/settings.js';
import { loc, locn, locKey } from '/engine/i18n.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
export function createArmory({room,onPick}) {
 let kit=cleanKit();try{kit=cleanKit(JSON.parse(localStorage.getItem('pintura:kit')));}catch{}
 room.kit=kit;onPick(kit.weapon);
 const dialog=document.getElementById('armory'),choices=document.getElementById('armory-choices');
 const rating=document.createElement('span');rating.id='armory-rating';document.getElementById('armory-name').after(rating);
 const back=document.createElement('button');back.id='armory-parts-back';back.type='button';back.className='pk-btn';back.textContent=loc('‹ Atrás');choices.before(back);back.onclick=()=>dialog.classList.remove('choosing');
 const icons={weapon:'kitBarrel',attachments:'plus',armor:'kitVest',grenade:'kitGrenade',finish:'kitPaint',charm:'wardrobe-cuello',pattern:'kitPaint'};
 for(const b of document.querySelectorAll('#armory-slots button')){const icon=document.createElement('i');icon.innerHTML=ICONS[icons[b.dataset.slot]];b.insertBefore(icon,b.querySelector('b'));}
 let ratedOptions='',category='weapon',renderer=null,scene,camera,model,avatar,vest,target,range=null,acc=0; const balls=new Map();
 const catalog={weapon:MARKERS,attachments:ATTACHMENTS,armor:ARMOR,grenade:GRENADES,finish:FINISHES,charm:CHARMS,pattern:PATTERNS};
 function paintStats(value=kit){
  ratedOptions=JSON.stringify(room.state.options);
  rating.innerHTML=ratingBadge(kitRating(value,room.state.options));
  const current=kitStats(kit,room.state.options),next=kitStats(value,room.state.options);
  // Precision is the aimed spread (La Lejana through its scope); damage counts pepazos per hit, a direct rocket knocks out.
  const aimed=s=>s.aimSpread??s.spread;
  const rows=[[loc('Alcance'),s=>s.speed*s.life,s=>`${Math.round(s.speed*s.life)} m`,60,false],[loc('Daño'),s=>s.direct?3:s.damage,s=>s.direct?loc('K.O. directo'):locn(s.damage,'{n} pepazo','{n} pepazos'),3,false],[loc('Precisión'),s=>Math.max(0,1-aimed(s)/.3),s=>`${(aimed(s)*180/Math.PI).toFixed(1)}°${s.scope?` · ${s.scope}×`:''}`,1,false],[loc('Cadencia'),s=>1/s.cadence,s=>`${(1/s.cadence).toFixed(1)}/s`,8,false],[loc('Capacidad'),s=>s.magazine,s=>`${s.magazine}${s.reserve!=null?' + '+s.reserve:''}`,26,false],[loc('Recarga'),s=>s.reload,s=>`${s.reload.toFixed(1)} s`,4,true],[loc('Movilidad'),s=>s.mobility,s=>`${Math.round(s.mobility*100)}%`,1.15,false],[loc('Aguante'),s=>s.toughness,s=>locn(s.toughness,'{n} pepazo','{n} pepazos'),6,false]];
  document.getElementById('armory-stats').innerHTML=rows.map(([name,get,text,max,inverse])=>{const a=Math.round(Math.min(1,get(current)/max)*10),b=Math.round(Math.min(1,get(next)/max)*10),gain=inverse?b<a:b>a;return `<div><dt>${name}</dt><dd><span class="armory-bars">${Array.from({length:10},(_,i)=>`<i class="${i<Math.min(a,b)?'on':i<Math.max(a,b)?gain?'gain':'loss':''}"></i>`).join('')}</span><b>${text(next)}</b></dd></div>`;}).join('');
 }
 function paint() {
  document.getElementById('armory-name').textContent=loc(MARKERS.find(m=>m.id===kit.weapon).name);paintStats();
  for(const b of document.querySelectorAll('#armory-slots button')) {
   const field=b.dataset.slot;b.setAttribute('aria-pressed',String(category===field));
   const value=field==='attachments' ? ATTACHMENTS.find(a=>a.id===kit.attachments[Number(b.dataset.index)])?.name || locKey('Sin accesorio') : catalog[field].find(x=>x.id===kit[field]).name;
   // Generic part names are locKey() in armory-data.js; proper names pass through unchanged.
   b.querySelector('b').textContent=loc(value);
  }
  choices.replaceChildren(...catalog[category].map(item=>{
   const b=document.createElement('button');b.type='button';b.className='armory-choice';b.dataset.id=item.id;
   const selected=category==='attachments'?kit.attachments.includes(item.id):kit[category]===item.id;
   b.setAttribute('aria-pressed',String(selected));b.disabled=category==='attachments' && kit.attachments.length===2 && !selected;
   b.innerHTML=`<b>${esc(loc(item.name))}</b><span>${esc(item.blurb?loc(item.blurb):loc('Solo cambia el estilo.'))}</span>`;
   const preview=()=>cleanKit({...kit,[category]:category==='attachments'?(selected?kit.attachments.filter(id=>id!==item.id):[...kit.attachments,item.id]):item.id});
   for(const event of ['pointerenter','focus'])b.addEventListener(event,()=>{paintStats(preview());rebuild(preview());});
   for(const event of ['pointerleave','blur'])b.addEventListener(event,()=>{paintStats();rebuild();});
   b.onclick=()=>{if(category==='attachments') kit.attachments=selected?kit.attachments.filter(id=>id!==item.id):[...kit.attachments,item.id];else kit[category]=item.id;kit=cleanKit(kit);save();paint();rebuild();};return b;
  }));
 }
 function save(){try{localStorage.setItem('pintura:kit',JSON.stringify(kit));}catch{}room.selectKit(kit);onPick(kit.weapon);}
 function rebuild(look=kit){
  if(!renderer)return;model?.removeFromParent();model?.userData.dispose();
  model=createPaintKit({...look,color:FINISHES.find(f=>f.id===look.finish).color||'#f28b42'});model.position.set(.5,1.3,0);model.rotation.y=-.6;model.scale.setScalar(1.7);scene.add(model);
  vest.visible=look.armor==='padded';
 }
 function init(){
  if(renderer)return;renderer=new THREE.WebGLRenderer({canvas:document.getElementById('armory-view'),antialias:true,alpha:true});renderer.setPixelRatio(pixelRatio(1.5));
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,50);camera.position.set(4,2.7,5);camera.lookAt(0,1.2,0);
  scene.add(new THREE.HemisphereLight(0xfff5df,0x444466,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,4);scene.add(light);
  avatar=buildCharacter(loadAvatar());avatar.group.position.set(-2.2,0,-.7);avatar.group.rotation.y=.5;scene.add(avatar.group);vest=createPaintVest();avatar.group.add(vest);target=buildCharacter({...loadAvatar(),outfitColor:'#29c5cd'});target.group.position.set(1.8,0,-2);target.group.visible=false;scene.add(target.group);rebuild();
 }
 for(const b of document.querySelectorAll('#armory-slots button')) b.onclick=()=>{category=b.dataset.slot;dialog.classList.add('choosing');paint();};
 const open=()=>{if(room.state.phase==='playing')return;dialog.classList.remove('choosing');dialog.showModal();init();paint();};
 document.getElementById('open-armory').onclick=open;document.getElementById('armory-close').onclick=()=>dialog.close();
 document.getElementById('armory-go').onclick=()=>{save();dialog.close();if(room.isHost)room.start();};
 document.getElementById('armory-range').onclick=()=>{
  target.group.visible=true;
  range=new Arena('plaza');range.add(1,{name:loc('Tú')});range.add(2,{name:loc('Blanco')});range.selectKit(1,kit);range.start();range.go();
  Object.assign(range.players[0],{x:-22,z:-22,shield:0});Object.assign(range.players[1],{x:-22,z:-15,shield:0});
  document.getElementById('range-controls').hidden=false;document.getElementById('range-status').textContent=loc('Apunta al blanco: el kit usa sus reglas reales.');
 };
 let fire=false,grenade=false;
 document.getElementById('range-fire').onclick=()=>{fire=true;};document.getElementById('range-grenade').onclick=()=>{grenade=true;};
 dialog.addEventListener('close',()=>{range=null;if(target)target.group.visible=false;document.getElementById('range-controls').hidden=true;document.getElementById('open-armory').focus();});
 return {get kit(){return kit;}, open, update(dt){
  if(!dialog.open||!renderer)return;if(ratedOptions!==JSON.stringify(room.state.options))paintStats();const c=renderer.domElement,w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  model.rotation.y+=dt*.18;avatar.update(dt,{walk:false});
  if(range){acc+=dt;while(acc>=.05){range.step(.05,new Map([[1,{ax:0,az:1,fire,grenade}]]));fire=grenade=false;acc-=.05;}const p=range.players[0],dummy=range.players[1];document.getElementById('range-status').textContent=`Blanco: ${dummy.paint} pepazos · ${dummy.hits} fuera · Carga: ${p.ammo} · ${p.reload>0?'Recargando':p.grenadeReady?'Granada lista':'Sin granada'}`;target.group.rotation.z=dummy.paint*.08;target.update(dt,{walk:false});if(dummy.respawn){dummy.respawn=0;Object.assign(dummy,{x:-22,z:-15,paint:0,shield:0});} }
  if(range) {
   for(const ball of range.balls){let o=balls.get(ball.id);if(!o){o=new THREE.Mesh(new THREE.SphereGeometry(ball.rocket?.12:.04,8,6),new THREE.MeshBasicMaterial({color:ball.color}));balls.set(ball.id,o);scene.add(o);}const t=(ball.z+22)/7;o.position.set(.1+1.7*t,1.1,-2*t);}
  }
  for(const [id,o] of balls)if(!range?.balls.some(b=>b.id===id)){o.removeFromParent();o.geometry.dispose();o.material.dispose();balls.delete(id);}
  renderer.render(scene,camera);
 },dispose(){model?.userData.dispose();vest?.userData.dispose();avatar?.dispose();target?.dispose();balls.forEach(o=>{o.geometry.dispose();o.material.dispose();});renderer?.dispose();}};
}
