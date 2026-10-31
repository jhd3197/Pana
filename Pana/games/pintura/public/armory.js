import { ratingBadge } from '/engine/kit-rating.js';
import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { createPaintKit, createPaintVest } from '/engine/models/props/paintball-kit.js';
import { MARKERS, WEAPONS, ARMORY_CLASSES, ATTACHMENTS, throwRange, meleeInterval, OPTICS, ARMOR, GRENADES, FINISHES, CHARMS, PATTERNS, FALLBACK_CAMO, cleanKit, kitStats, kitRating, canAttach, setSlot, changeWeapon, opticOf, shotInterval, dpsOf } from './armory-data.js';
import { Arena } from './rules.js';
import { ICONS } from '/engine/icons.js';
import { pixelRatio } from '/engine/settings.js';
import { loc, locn, locKey, formatList } from '/engine/i18n.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
// The empty choice of an attachment slot.
const NONE={id:'',name:locKey('Ninguno'),blurb:locKey('Deja este espacio vacío.')};
const classOfMarker=id=>ARMORY_CLASSES.find(c=>c.weapons.includes(id))||ARMORY_CLASSES[0];
// Pepazos with up to two decimals: La China's stones paint half of one.
const pepazos=n=>locn(n,'{n} pepazo','{n} pepazos',{n:String(Math.round(n*100)/100)});
// notify: a toast for news that arrives while the armory is closed (mid-round).
export function createArmory({room,onPick,notify=()=>{}}) {
 let kit=cleanKit();try{kit=cleanKit(JSON.parse(localStorage.getItem('pintura:kit')));}catch{}
 room.kit=kit;onPick(kit.weapon);
 const dialog=document.getElementById('armory'),choices=document.getElementById('armory-choices'),note=document.getElementById('armory-note');
 // Says why a pick changed or did not stick: inline while the armory is open, a toast otherwise.
 const say=text=>{note.textContent=text;if(!dialog.open)notify(text);};
 const weaponName=id=>loc(WEAPONS.find(m=>m.id===id).name);
 const dropNote=(dropped,weapon)=>locn(dropped.length,'{parts} no cabe en {weapon} y salió del kit.','{parts} no caben en {weapon} y salieron del kit.',{parts:formatList(dropped.map(id=>loc(ATTACHMENTS.find(a=>a.id===id).name)),{type:'conjunction'}),weapon:weaponName(weapon)});
 // An unowned camo comes back as a solid one: wear what the room wears (the saved pick stays until the next save).
 room.onKitRejected=({reason}={})=>{
  if(reason==='camo'){kit={...kit,camo:FALLBACK_CAMO};room.kit=kit;if(dialog.open){paint();rebuild();}say(loc('Ese camuflaje todavía no es tuyo: la sala te puso uno liso.'));return;}
  say(reason==='playing'?loc('No se pueden cambiar accesorios en plena ronda.'):loc('La sala no aceptó el kit. Inténtalo otra vez.'));
 };
 const rating=document.createElement('span');rating.id='armory-rating';document.getElementById('armory-name').after(rating);
 const className=document.createElement('small');className.id='armory-class';rating.after(className);
 // The class chips, the first row of the marker choices.
 const tabs=document.createElement('nav');tabs.id='armory-classes';tabs.setAttribute('aria-label',loc('Clases de marcadora'));
 const back=document.createElement('button');back.id='armory-parts-back';back.type='button';back.className='pk-btn';back.textContent=loc('‹ Atrás');choices.before(back);back.onclick=()=>dialog.classList.remove('choosing');
 const icons={weapon:'kitBarrel',attachments:'plus',armor:'kitVest',grenade:'kitGrenade',finish:'kitPaint',camo:'kitPaint',charm:'wardrobe-cuello',pattern:'kitPaint'};
 for(const b of document.querySelectorAll('#armory-slots button')){const icon=document.createElement('i');icon.innerHTML=ICONS[icons[b.dataset.slot]];b.insertBefore(icon,b.querySelector('b'));}
 let shown=null,ratedOptions='',category='weapon',slot=0,renderer=null,scene,camera,model,avatar,vest,target,range=null,acc=0,pivot,gunBox,padded=false,framed=null; const balls=new Map();
 const catalog={weapon:WEAPONS,attachments:ATTACHMENTS,armor:ARMOR,grenade:GRENADES,finish:FINISHES,charm:CHARMS,pattern:PATTERNS};
 // Camuflajes: camos.js and camo-store.js load with the first look at the tab (at once on
 // pana.sh, whose bridge says what this pana owns). Without the bridge only the solid ones are yours.
 let camoLib=null,camoData=null,camoLoad=null;
 const camoName=id=>!id?loc('De fábrica'):camoLib?loc(camoLib.camoById(id)?.name||id):'…';
 function loadCamos(fresh=false){
  camoLoad??=Promise.all([import('./camos.js'),import('./camo-store.js')]).then(([lib,{createCamoStore}])=>{camoLib={...lib,store:createCamoStore()};});
  return camoLoad.then(()=>camoLib.store.load({fresh})).then(data=>{camoData=data;room.setCamos?.(data.owned);if(dialog.open)paint();return data;});
 }
 if(window.PanaSh)loadCamos();
 // One card per camo: a swatch from its palette, its state, a Comprar for mango ones.
 // Every card previews on the 3D marker; only owned ones are picked.
 function camoChoices(){
  if(!camoLib){loadCamos();const wait=document.createElement('p');wait.className='armory-camo-note';wait.textContent=loc('Cargando camuflajes…');return [wait];}
  const data=camoData||camoLib.store.data,head=document.createElement('p');head.className='armory-camo-note';
  head.textContent=data.online?loc('Tienes {n} mangos. Los camuflajes van en cualquier arma.',{n:data.balance}):loc('Los camuflajes con candado se consiguen en pana.sh.');
  return [head,...[{id:'',name:locKey('De fábrica')},...camoLib.CAMOS].map(c=>{
   const st=c.id?camoLib.camoState(c.id,data):{state:'owned',text:loc('El color de fábrica de la marcadora')},card=document.createElement('div');
   card.className='armory-camo';card.dataset.id=c.id;card.dataset.state=st.state;
   const b=document.createElement('button');b.type='button';b.className='armory-choice';b.dataset.id=c.id;b.setAttribute('aria-pressed',String((kit.camo??'')===c.id));
   if(st.state!=='owned')b.setAttribute('aria-disabled','true');
   b.innerHTML=`<i class="armory-swatch"></i><b>${esc(loc(c.name))}</b><span>${st.state==='owned'?'':`<i class="armory-lock">${ICONS.lock}</i>`}${esc(st.text)}</span>`;
   b.querySelector('.armory-swatch').style.background=c.id?camoLib.swatch(c.id):'linear-gradient(135deg,#f28b42 50%,#2f3d3c 50%)';
   const look=()=>({...kit,camo:c.id||null});
   for(const event of ['pointerenter','focus'])b.addEventListener(event,()=>rebuild(look()));
   for(const event of ['pointerleave','blur'])b.addEventListener(event,()=>rebuild());
   b.onclick=()=>{if(st.state!=='owned'){note.textContent=st.text;return;}kit=cleanKit(look());note.textContent='';save();paint();rebuild();};
   card.append(b);
   if(st.state==='buyable'||st.state==='cantAfford'){
    const buy=document.createElement('button');buy.type='button';buy.className='pk-btn armory-buy';buy.textContent=loc('Comprar · {n} mangos',{n:st.price});buy.disabled=st.state!=='buyable';
    buy.onclick=async()=>{buy.disabled=true;note.textContent=loc('Comprando…');const r=await camoLib.store.buy(c.id);
     if(r.ok){camoData=r.data;room.setCamos?.(r.data.owned);if(camoLib.camoState(c.id,r.data).state==='owned'){kit=cleanKit(look());save();note.textContent=loc('¡{name} ya es tuyo!',{name:loc(c.name)});}}
     else note.textContent=r.error||loc('No se pudo comprar. Inténtalo otra vez.');
     paint();rebuild();};
    card.append(buy);
   }
   return card;
  })];
 }
 function paintStats(value=kit){
  ratedOptions=JSON.stringify(room.state.options);
  rating.innerHTML=ratingBadge(kitRating(value,room.state.options));
  const current=kitStats(kit,room.state.options),next=kitStats(value,room.state.options);
  // Precision is the aimed spread (La Lejana through its scope); a marker that flies straight shows its shot speed, which a barrel raises; damage counts pepazos per hit, a direct rocket knocks out.
  const aimed=s=>s.aimSpread??s.spread;
  // Cadence is the rate the simulation really fires at (whole 50 ms ticks); Pintura/s is pepazos a second with every ball landing.
  // A melee weapon has its own rows: reach (and the throw), pepazos per blow, swings a second, mobility, aguante.
  const melee=[[loc('Alcance'),s=>s.melee?s.reach:s.speed*s.life,s=>s.melee?`${s.reach.toFixed(1)} m${s.throwable?` · ${loc('lanzada')} ${Math.round(throwRange(s.throwable))} m`:''}`:`${Math.round(s.speed*s.life)} m`,3,false],
   [loc('Daño'),s=>s.melee?s.damage:s.damage*s.pellets,s=>s.melee&&s.sweetSpot?`${pepazos(s.damage)} · ${loc('con la punta')} ${s.damage+s.sweetSpot.bonus}`:pepazos(s.damage),4,false],
   [loc('Golpes/s'),s=>s.melee?1/meleeInterval(s):1/shotInterval(s.cadence),s=>`${(s.melee?1/meleeInterval(s):1/shotInterval(s.cadence)).toFixed(1)}/s`,4,false],
   [loc('Pintura/s'),dpsOf,s=>dpsOf(s).toFixed(1),10,false],
   ...(next.throwable?[[loc('Vuelve en'),s=>s.throwable?.recall??0,s=>s.throwable?`${s.throwable.recall.toFixed(1)} s`:'–',3,true]]:[]),
   [loc('Movilidad'),s=>s.mobility,s=>`${Math.round(s.mobility*100)}%`,1.15,false],[loc('Aguante'),s=>s.toughness,s=>locn(s.toughness,'{n} pepazo','{n} pepazos'),6,false]];
  const rows=next.melee?melee:[[loc('Alcance'),s=>s.speed*s.life,s=>`${Math.round(s.speed*s.life)} m`,80,false],[loc('Daño'),s=>s.direct?3:s.damage*s.pellets,s=>s.direct?loc('K.O. directo'):s.pellets>1?`${s.pellets} × ${pepazos(s.damage)}`:pepazos(s.damage),3,false],[loc('Pintura/s'),dpsOf,s=>dpsOf(s).toFixed(1),10,false],[loc('Precisión'),s=>Math.max(0,1-aimed(s)/.3),s=>!aimed(s) && !s.aims?`${loc('Recta')} · ${Math.round(s.speed)} m/s`:`${(aimed(s)*180/Math.PI).toFixed(1)}°${s.aims?` · ${Math.round(s.zoom*100)/100}×`:''}`,1,false],[loc('Cadencia'),s=>1/shotInterval(s.cadence),s=>`${(1/shotInterval(s.cadence)).toFixed(1)}/s`,20,false],[loc('Capacidad'),s=>s.magazine,s=>`${s.magazine}${s.reserve!=null?' + '+s.reserve:''}`,60,false],[loc('Recarga'),s=>s.reload,s=>`${s.reload.toFixed(1)} s`,4,true],[loc('Movilidad'),s=>s.mobility,s=>`${Math.round(s.mobility*100)}%`,1.15,false],[loc('Aguante'),s=>s.toughness,s=>locn(s.toughness,'{n} pepazo','{n} pepazos'),6,false]];
  document.getElementById('armory-stats').innerHTML=rows.map(([name,get,text,max,inverse])=>{const a=Math.round(Math.min(1,get(current)/max)*10),b=Math.round(Math.min(1,get(next)/max)*10),gain=inverse?b<a:b>a;return `<div><dt>${name}</dt><dd><span class="armory-bars">${Array.from({length:10},(_,i)=>`<i class="${i<Math.min(a,b)?'on':i<Math.max(a,b)?gain?'gain':'loss':''}"></i>`).join('')}</span><b>${text(next)}</b></dd></div>`;}).join('');
 }
 function paint() {
  const group=classOfMarker(kit.weapon);
  document.getElementById('armory-name').textContent=weaponName(kit.weapon);className.textContent=`${loc(group.name)} · ${loc(group.kind)}`;paintStats();
  for(const b of document.querySelectorAll('#armory-slots button')) {
   const field=b.dataset.slot;b.setAttribute('aria-pressed',String(category===field && (field!=='attachments' || slot===Number(b.dataset.index))));
   if(field==='camo'){b.querySelector('b').textContent=camoName(kit.camo);continue;}
   const value=field==='attachments' ? ATTACHMENTS.find(a=>a.id===kit.attachments[Number(b.dataset.index)])?.name || locKey('Sin accesorio') : catalog[field].find(x=>x.id===kit[field]).name;
   // Generic part names are locKey() in armory-data.js; proper names pass through unchanged.
   b.querySelector('b').textContent=loc(value);
  }
  if(category==='camo'){back.textContent=loc('‹ Atrás');choices.replaceChildren(...camoChoices());return;}
  const attaching=category==='attachments', arming=category==='weapon';
  back.textContent=attaching?loc('‹ Atrás · Accesorio {n}',{n:slot+1}):loc('‹ Atrás');
  // Markers come by class: a chip per class (nickname · kind), then that class's markers.
  if(arming && !ARMORY_CLASSES.includes(shown)) shown=classOfMarker(kit.weapon);
  if(arming) tabs.replaceChildren(...ARMORY_CLASSES.map(c=>{const t=document.createElement('button');t.type='button';t.className='armory-class';t.dataset.class=c.id;t.setAttribute('aria-pressed',String(c===shown));t.innerHTML=`<b>${esc(loc(c.name))}</b><span>${esc(loc(c.kind))}</span>`;t.onclick=()=>{shown=c;paint();};return t;}));
  // A melee weapon lists its own three parts, a marker its four.
  const melee=WEAPONS.find(w=>w.id===kit.weapon)?.melee;
  const items=attaching?[NONE,...ATTACHMENTS.filter(a=>!!a.melee===!!melee)]:arming?WEAPONS.filter(m=>shown.weapons.includes(m.id)):catalog[category];
  choices.replaceChildren(...(arming?[tabs]:[]),...items.map(item=>{
   const b=document.createElement('button');b.type='button';b.className='armory-choice';b.dataset.id=item.id;
   const at=attaching && item.id ? kit.attachments.indexOf(item.id) : -1, fits=!attaching || !item.id || canAttach(kit.weapon,item.id), elsewhere=at>=0 && at!==slot;
   b.setAttribute('aria-pressed',String(attaching?(kit.attachments[slot]??'')===item.id:kit[category]===item.id));b.disabled=!fits;
   // A Mira says which one this marker takes; a marker card shows its real numbers.
   const sight=item.id==='optic' && opticOf(kit.weapon) ? `${loc(OPTICS[opticOf(kit.weapon)].name)}: ` : '';
   const numbers=arming?(()=>{const s=kitStats({weapon:item.id},room.state.options);return s.melee?` ${pepazos(s.damage)} · ${s.reach.toFixed(1)} m · ${(1/meleeInterval(s)).toFixed(1)} ${loc('golpes/s')}`:` ${dpsOf(s).toFixed(1)} ${loc('pepazos/s')} · ${Math.round(s.speed*s.life)} m · ${s.magazine}${s.reserve!=null?' + '+s.reserve:''}`;})():'';
   const blurb=!fits?loc('No cabe en esta marcadora: no tiene dónde montarlo'):elsewhere?loc('Está en el accesorio {n}; elígelo para moverlo aquí.',{n:at+1}):item.blurb?sight+loc(item.blurb)+numbers:loc('Solo cambia el estilo.');
   b.innerHTML=`<b>${esc(loc(item.name))}</b><span>${esc(blurb)}</span>`;
   // Read the kit when the event fires, not when the button was drawn.
   const pick=()=>attaching?{kit:setSlot(kit,slot,item.id||null),dropped:[]}:category==='weapon'?changeWeapon(kit,item.id):{kit:cleanKit({...kit,[category]:item.id}),dropped:[]};
   for(const event of ['pointerenter','focus'])b.addEventListener(event,()=>{const next=pick().kit;paintStats(next);rebuild(next);});
   for(const event of ['pointerleave','blur'])b.addEventListener(event,()=>{paintStats();rebuild();});
   b.onclick=()=>{const {kit:next,dropped}=pick();kit=next;note.textContent=dropped.length?dropNote(dropped,kit.weapon):'';save();paint();rebuild();};return b;
  }));
 }
 function store(){try{localStorage.setItem('pintura:kit',JSON.stringify(kit));}catch{}}
 function save(){store();room.selectKit(kit);onPick(kit.weapon);}
 // Number keys and the pause menu: the room takes the marker from input mid-round,
 // so only the lobby sends the kit; the saved kit follows either way.
 function setWeapon(id){
  if(id===kit.weapon || !WEAPONS.some(m=>m.id===id))return;
  const {kit:next,dropped}=changeWeapon(kit,id);kit=next;
  if(room.state.phase==='playing'){store();room.kit=kit;onPick(kit.weapon);}else save();
  if(dropped.length)say(dropNote(dropped,kit.weapon));
  if(dialog.open){paint();rebuild();}
 }
 // The preview shows the gun alone, centred and turning on `pivot`. The pana only comes
 // back where the body is the point: the armor tab (wearing the vest) and the test range.
 const withBody=()=>!!range||(category==='armor'&&dialog.classList.contains('choosing'));
 function frame(){
  const body=withBody();avatar.group.visible=body;vest.visible=body&&padded;
  if(body){pivot.position.set(.5,1.3,0);model.position.set(0,0,0);model.scale.setScalar(1.7);camera.position.set(4,2.7,5);camera.lookAt(0,1.2,0);}
  else{const s=3.1/Math.max(gunBox.size.x,gunBox.size.y,gunBox.size.z,.01);pivot.position.set(0,1.2,0);model.scale.setScalar(s);model.position.copy(gunBox.center).multiplyScalar(-s);camera.position.set(1.6,2.1,5);camera.lookAt(0,1.15,0);}
  framed=body;
 }
 function rebuild(look=kit){
  if(!renderer)return;model?.removeFromParent();model?.userData.dispose();
  model=createPaintKit({...look,color:FINISHES.find(f=>f.id===look.finish).color||'#f28b42'});
  // Measured once per model at unit scale, so every weapon (pistol to bazooka) fills the frame alike.
  const box=new THREE.Box3().setFromObject(model);gunBox={center:box.getCenter(new THREE.Vector3()),size:box.getSize(new THREE.Vector3())};
  pivot.add(model);padded=look.armor==='padded';frame();
 }
 function init(){
  if(renderer)return;renderer=new THREE.WebGLRenderer({canvas:document.getElementById('armory-view'),antialias:true,alpha:true});renderer.setPixelRatio(pixelRatio(1.5));
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,50);camera.position.set(4,2.7,5);camera.lookAt(0,1.2,0);
  pivot=new THREE.Group();pivot.rotation.y=-.6;scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xfff5df,0x444466,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,4);scene.add(light);
  avatar=buildCharacter(loadAvatar());avatar.group.position.set(-2.2,0,-.7);avatar.group.rotation.y=.5;scene.add(avatar.group);vest=createPaintVest();avatar.group.add(vest);target=buildCharacter({...loadAvatar(),outfitColor:'#29c5cd'});target.group.position.set(1.8,0,-2);target.group.visible=false;scene.add(target.group);rebuild();
 }
 for(const b of document.querySelectorAll('#armory-slots button')) b.onclick=()=>{category=b.dataset.slot;slot=Number(b.dataset.index)||0;shown=null;note.textContent='';dialog.classList.add('choosing');paint();};
 const open=()=>{if(room.state.phase==='playing'){notify(loc('La armería abre entre rondas. En plena ronda cambias de marcadora con 1 a 9, Z y X.'));return;}note.textContent='';dialog.classList.remove('choosing');dialog.showModal();init();paint();if(camoLib||window.PanaSh)loadCamos();};
 document.getElementById('open-armory').onclick=open;document.getElementById('armory-close').onclick=()=>dialog.close();
 document.getElementById('armory-go').onclick=()=>{save();dialog.close();if(room.isHost)room.start();};
 document.getElementById('armory-range').onclick=()=>{
  target.group.visible=true;
  range=new Arena('plaza');range.add(1,{name:loc('Tú')});range.add(2,{name:loc('Blanco')});range.selectKit(1,kit);range.start();range.go();
  Object.assign(range.players[0],{x:-22,z:-22,shield:0});Object.assign(range.players[1],{x:-22,z:-15,shield:0});
  document.getElementById('range-controls').hidden=false;document.getElementById('range-status').textContent=loc('Apunta al blanco: el kit usa sus reglas reales.');
 };
 let fire=false,grenade=false;
 document.getElementById('range-fire').onclick=()=>{fire=true;};
 // The range lobs its grenade like a bot: the throw solved to blow on the target.
 document.getElementById('range-grenade').onclick=()=>{if(!range)return;const [p,dummy]=range.players,aim=range.aimGrenade(p,dummy.x,dummy.z);grenade=aim?{grenade:true,pitch:aim.pitch,charge:aim.charge}:{grenade:true};};
 dialog.addEventListener('close',()=>{range=null;if(target)target.group.visible=false;document.getElementById('range-controls').hidden=true;document.getElementById('open-armory').focus();});
 return {get kit(){return kit;}, get preview(){return model;}, get body(){return avatar?.group;},get camos(){return camoData;}, refreshCamos:()=>loadCamos(true), open, setWeapon, update(dt){
  if(!dialog.open||!renderer)return;if(ratedOptions!==JSON.stringify(room.state.options))paintStats();const c=renderer.domElement,w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(framed!==withBody())frame();pivot.rotation.y+=dt*.18;if(framed)avatar.update(dt,{walk:false});
  if(range){acc+=dt;while(acc>=.05){range.step(.05,new Map([[1,{ax:0,az:1,fire,...(grenade||{})}]]));fire=grenade=false;acc-=.05;}const p=range.players[0],dummy=range.players[1];document.getElementById('range-status').textContent=`Blanco: ${dummy.paint} pepazos · ${dummy.hits} fuera · Carga: ${p.ammo} · ${p.reload>0?'Recargando':p.grenadeReady?'Granada lista':'Sin granada'}`;target.group.rotation.z=dummy.paint*.08;target.update(dt,{walk:false});if(dummy.respawn){dummy.respawn=0;Object.assign(dummy,{x:-22,z:-15,paint:0,shield:0});} }
  if(range) {
   for(const ball of range.balls){let o=balls.get(ball.id);if(!o){o=new THREE.Mesh(new THREE.SphereGeometry(ball.rocket?.12:.04,8,6),new THREE.MeshBasicMaterial({color:ball.color}));balls.set(ball.id,o);scene.add(o);}const t=(ball.z+22)/7;o.position.set(.1+1.7*t,1.1,-2*t);}
  }
  for(const [id,o] of balls)if(!range?.balls.some(b=>b.id===id)){o.removeFromParent();o.geometry.dispose();o.material.dispose();balls.delete(id);}
  renderer.render(scene,camera);
 },dispose(){model?.userData.dispose();vest?.userData.dispose();avatar?.dispose();target?.dispose();balls.forEach(o=>{o.geometry.dispose();o.material.dispose();});renderer?.dispose();}};
}
