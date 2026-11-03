import { ratingBadge } from '/engine/kit-rating.js';
import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { createPaintKit, wearPaintVest, PAINT_PART_LABELS } from '/engine/models/props/paintball-kit.js';
import { MARKERS, WEAPONS, ARMORY_CLASSES, ATTACHMENTS, throwRange, meleeInterval, OPTICS, ARMOR, GRENADES, FINISHES, CHARMS, PATTERNS, FALLBACK_CAMO, cleanKit, kitStats, kitRating, canAttach, setSlot, changeWeapon, opticOf, shotInterval, dpsOf } from './armory-data.js';
import { Arena } from './rules.js';
import { ICONS } from '/engine/icons.js';
import { pixelRatio } from '/engine/settings.js';
import { loc, locn, locKey, formatList } from '/engine/i18n.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
// The empty choice of an attachment slot.
const NONE={id:'',name:locKey('Ninguno')};
// Card pictures: each weapon, part and charm drawn once from its real model
// (armory-thumbs.js, loaded with the first card); the icon stands in until then.
let thumbs=null;const thumbsLoad=()=>thumbs??=import('./armory-thumbs.js');
function setPic(el,key,icon,thumb){
 if(el.dataset.key===key)return el;el.dataset.key=key;el.innerHTML=icon?ICONS[icon]:'';
 if(thumb)thumbsLoad().then(thumb).then(src=>{if(!src||el.dataset.key!==key)return;const img=new Image();img.alt='';img.src=src;el.replaceChildren(img);}).catch(()=>{});
 return el;
}
const PART_ICONS={barrel:'kitBarrel',hopper:'kitHopper',stock:'kitStock',optic:'kitOptic'};
const colorOf=kit=>FINISHES.find(f=>f.id===kit.finish)?.color||'#f28b42';
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
 room.onKitRejected=({reason,camo}={})=>{
  // Owned here but not vouched for in this room yet (pana.sh could not sign it): a rejoin shows it.
  if(reason==='camo'){const fresh=camoData?.owned?.includes(camo);kit={...kit,camo:FALLBACK_CAMO};room.kit=kit;if(dialog.open){paint();rebuild();}say(fresh?loc('Ya es tuyo, pero la sala lo verá cuando vuelvas a entrar: por ahora llevas uno liso.'):loc('Ese camuflaje todavía no es tuyo: la sala te puso uno liso.'));return;}
  say(reason==='playing'?loc('No se pueden cambiar accesorios en plena ronda.'):loc('La sala no aceptó el kit. Inténtalo otra vez.'));
 };
 const rating=document.createElement('span');rating.id='armory-rating';document.getElementById('armory-name').after(rating);
 const className=document.createElement('small');className.id='armory-class';rating.after(className);
 // The class chips, the first row of the marker choices.
 const tabs=document.createElement('nav');tabs.id='armory-classes';tabs.setAttribute('aria-label',loc('Clases de marcadora'));
 const back=document.createElement('button');back.id='armory-parts-back';back.type='button';back.className='pk-btn';back.textContent=loc('‹ Atrás');choices.before(back);back.onclick=()=>dialog.classList.remove('choosing');
 const icons={weapon:'kitBarrel',attachments:'plus',armor:'kitVest',grenade:'kitGrenade',finish:'kitPaint',camo:'kitPaint',charm:'wardrobe-cuello',pattern:'kitPaint'};
 for(const b of document.querySelectorAll('#armory-slots button')){const icon=document.createElement('i');icon.innerHTML=ICONS[icons[b.dataset.slot]];b.insertBefore(icon,b.querySelector('b'));}
 let shown=null,ratedOptions='',category='weapon',slot=0,renderer=null,scene,camera,model,avatar,vest,target,range=null,acc=0,pivot,gunBox,padded=false,framed=null,sway=0; const balls=new Map();
 const catalog={weapon:WEAPONS,attachments:ATTACHMENTS,armor:ARMOR,grenade:GRENADES,finish:FINISHES,charm:CHARMS,pattern:PATTERNS};
 // Camuflajes: camos.js and camo-store.js load with the first look at the tab (at once on
 // pana.sh, whose bridge says what this pana owns). Without the bridge only the solid ones are yours.
 let camoLib=null,camoData=null,camoLoad=null;
 const camoName=id=>!id?loc('De fábrica'):camoLib?loc(camoLib.camoById(id)?.name||id):'…';
 function loadCamos(fresh=false){
  camoLoad??=Promise.all([import('./camos.js'),import('./camo-store.js')]).then(([lib,{createCamoStore}])=>{camoLib={...lib,store:createCamoStore()};});
  return camoLoad.then(()=>camoLib.store.load({fresh})).then(data=>{camoData=data;room.setCamos?.(data.owned,signer());if(dialog.open)paint();return data;});
 }
 // The room learns camos got mid-session only through pana.sh's signature (camo-store signed).
 const signer=()=>camoLib?.store.canSign?nonce=>camoLib.store.signed(nonce):null;
 if(window.PanaSh)loadCamos();
 // One card per camo: a swatch from its palette, its state, a Comprar for mango ones.
 // Every card previews on the 3D marker; only owned ones are picked.
 function camoChoices(){
  if(!camoLib){loadCamos();const wait=document.createElement('p');wait.className='armory-camo-note';wait.textContent=loc('Cargando camuflajes…');return [wait];}
  const data=camoData||camoLib.store.data,head=document.createElement('p');head.className='armory-camo-note';
  if(data.online)head.innerHTML=`<i class="armory-mango">${ICONS.mango}</i>${esc(data.balance)}`;
  return [...(data.online?[head]:[]),...[{id:'',name:locKey('De fábrica')},...camoLib.CAMOS].map(c=>{
   const st=c.id?camoLib.camoState(c.id,data):{state:'owned',text:loc('El color de fábrica de la marcadora')},card=document.createElement('div');
   card.className='armory-camo';card.dataset.id=c.id;card.dataset.state=st.state;
   const b=document.createElement('button');b.type='button';b.className='armory-choice';b.dataset.id=c.id;b.setAttribute('aria-pressed',String((kit.camo??'')===c.id));
   if(st.state!=='owned')b.setAttribute('aria-disabled','true');
   b.title=st.text;b.innerHTML=`<i class="armory-swatch"></i><b>${esc(loc(c.name))}</b>${st.state==='owned'?'':`<i class="armory-lock">${ICONS.lock}</i>`}`;
   b.querySelector('.armory-swatch').style.background=c.id?camoLib.swatch(c.id):'linear-gradient(135deg,#f28b42 50%,#2f3d3c 50%)';
   const look=()=>({...kit,camo:c.id||null});
   for(const event of ['pointerenter','focus'])b.addEventListener(event,()=>rebuild(look()));
   for(const event of ['pointerleave','blur'])b.addEventListener(event,()=>rebuild());
   b.onclick=()=>{if(st.state!=='owned'){note.textContent=st.text;return;}kit=cleanKit(look());note.textContent='';save();paint();rebuild();};
   card.append(b);
   if(st.state==='buyable'||st.state==='cantAfford'){
    const buy=document.createElement('button');buy.type='button';buy.className='pk-btn armory-buy';buy.innerHTML=`<i class="armory-mango">${ICONS.mango}</i>${esc(st.price)}`;buy.setAttribute('aria-label',loc('Comprar · {n} mangos',{n:st.price}));buy.disabled=st.state!=='buyable';
    buy.onclick=async()=>{buy.disabled=true;note.textContent=loc('Comprando…');const r=await camoLib.store.buy(c.id);
     if(r.ok){camoData=r.data;await room.setCamos?.(r.data.owned,signer());if(camoLib.camoState(c.id,r.data).state==='owned'){kit=cleanKit(look());save();note.textContent=loc('¡{name} ya es tuyo!',{name:loc(c.name)});}}
     else note.textContent=r.error||loc('No se pudo comprar. Inténtalo otra vez.');
     paint();rebuild();};
    card.append(buy);
   }
   return card;
  })];
 }
 // A change on the stats panel as a short number: whole from 10 up, else one decimal (two under 0.1).
 const fmtDelta=n=>n>=10?String(Math.round(n)):n>=.095?String(Math.round(n*10)/10):String(Math.round(n*100)/100);
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
  const rows=next.melee?melee:[[loc('Alcance'),s=>s.speed*s.life,s=>`${Math.round(s.speed*s.life)} m`,80,false],[loc('Daño'),s=>s.direct?3:s.damage*s.pellets,s=>s.direct?loc('K.O. directo'):s.falloff?`${s.falloff.min}–${pepazos(s.falloff.close)}`:s.pellets>1?`${s.pellets} × ${pepazos(s.damage)}`:pepazos(s.damage),3,false],[loc('Pintura/s'),dpsOf,s=>dpsOf(s).toFixed(1),10,false],[loc('Precisión'),s=>Math.max(0,1-aimed(s)/.3),s=>!aimed(s) && !s.aims?`${loc('Recta')} · ${Math.round(s.speed)} m/s`:`${(aimed(s)*180/Math.PI).toFixed(1)}°${s.aims?` · ${Math.round(s.zoom*100)/100}×`:''}`,1,false],[loc('Cadencia'),s=>1/shotInterval(s.cadence),s=>`${(1/shotInterval(s.cadence)).toFixed(1)}/s`,20,false],[loc('Capacidad'),s=>s.magazine,s=>`${s.magazine}${s.reserve!=null?' + '+s.reserve:''}`,60,false],[loc('Recarga'),s=>s.reload,s=>`${s.reload.toFixed(1)} s`,4,true],[loc('Movilidad'),s=>s.mobility,s=>`${Math.round(s.mobility*100)}%`,1.15,false],[loc('Aguante'),s=>s.toughness,s=>locn(s.toughness,'{n} pepazo','{n} pepazos'),6,false]];
  document.getElementById('armory-stats').innerHTML=rows.map(([name,get,text,max,inverse])=>{const a=Math.round(Math.min(1,get(current)/max)*10),b=Math.round(Math.min(1,get(next)/max)*10),gain=inverse?b<a:b>a;const d=parseFloat(text(next))-parseFloat(text(current)),up=inverse?get(next)<get(current):get(next)>get(current);
   const delta=Number.isFinite(d)&&Math.abs(d)>1e-6?`<small class="armory-delta ${up?'gain':'loss'}">${d>0?'+':'−'}${fmtDelta(Math.abs(d))}</small>`:'';
   return `<div><dt>${name}${delta}</dt><dd><span class="armory-bars">${Array.from({length:10},(_,i)=>`<i class="${i<Math.min(a,b)?'on':i<Math.max(a,b)?gain?'gain':'loss':''}"></i>`).join('')}</span><b>${text(next)}</b></dd></div>`;}).join('');
 }
 function paint() {
  const group=classOfMarker(kit.weapon);
  document.getElementById('armory-name').textContent=weaponName(kit.weapon);className.textContent=`${loc(group.name)} · ${loc(group.kind)}`;paintStats();
  for(const b of document.querySelectorAll('#armory-slots button')) {
   const field=b.dataset.slot;b.setAttribute('aria-pressed',String(category===field && (field!=='attachments' || slot===Number(b.dataset.index))));
   if(field==='camo'){b.querySelector('b').textContent=camoName(kit.camo);continue;}
   const color=colorOf(kit),part=field==='attachments'?kit.attachments[Number(b.dataset.index)]:null;
   if(field==='weapon')setPic(b.querySelector('i'),`${kit.weapon}:${color}:${kit.camo}:${kit.pattern}`,'kitBarrel',m=>m.weaponThumb({weapon:kit.weapon,color,camo:kit.camo,pattern:kit.pattern}));
   if(field==='attachments')setPic(b.querySelector('i'),`${kit.weapon}:${part}:${color}`,PART_ICONS[part]||'plus',part&&(m=>m.partThumb(kit.weapon,part,color)));
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
  // A melee weapon lists its own three parts, a marker the ones its model has mounts for.
  const melee=WEAPONS.find(w=>w.id===kit.weapon)?.melee,color=colorOf(kit);
  const items=attaching?[NONE,...ATTACHMENTS.filter(a=>!!a.melee===!!melee&&canAttach(kit.weapon,a.id))]:arming?WEAPONS.filter(m=>shown.weapons.includes(m.id)):catalog[category];
  // Every card is a picture and a name; what it changes shows on the stats panel.
  const picture=item=>{const pic=document.createElement('i');pic.className='armory-pic';const k=`${category}:${item.id}:${kit.weapon}:${color}:${kit.camo}:${kit.pattern}`;
   if(arming)return setPic(pic,k,'kitBarrel',m=>m.weaponThumb({weapon:item.id,color,camo:kit.camo,pattern:kit.pattern}));
   if(attaching)return setPic(pic,k,item.id?PART_ICONS[item.id]||'plus':'close',item.id&&(m=>m.partThumb(kit.weapon,item.id,color)));
   if(category==='pattern')return setPic(pic,k,'kitPaint',m=>m.weaponThumb({weapon:kit.weapon,color,camo:kit.camo,pattern:item.id}));
   if(category==='charm')return setPic(pic,k,item.id==='none'?'close':'wardrobe-cuello',item.id!=='none'&&(m=>m.charmThumb(item.id)));
   if(category==='grenade')return setPic(pic,k,'kitGrenade',m=>m.grenadeThumb(color));
   if(category==='finish'){pic.classList.add('armory-swatch');pic.style.background=item.color||'linear-gradient(135deg,#f28b42 50%,#2f3d3c 50%)';return pic;}
   return setPic(pic,k,icons[category]);};
  choices.replaceChildren(...(arming?[tabs]:[]),...items.map(item=>{
   const b=document.createElement('button');b.type='button';b.className='armory-choice armory-card';b.dataset.id=item.id;
   const at=attaching && item.id ? kit.attachments.indexOf(item.id) : -1, elsewhere=at>=0 && at!==slot;
   b.setAttribute('aria-pressed',String(attaching?(kit.attachments[slot]??'')===item.id:kit[category]===item.id));
   // The Mira goes by the kind this marker takes; a part in another slot wears that slot's number.
   const name=item.id==='optic' && opticOf(kit.weapon) ? OPTICS[opticOf(kit.weapon)].name : item.name;
   const label=document.createElement('b');label.textContent=loc(name);b.append(picture(item),label);
   if(elsewhere){const n=document.createElement('small');n.className='armory-badge';n.textContent=String(at+1);b.append(n);}
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
 // Three views: the gun alone, centred and turning on `pivot`; the armor tab, the pana
 // alone wearing the vest (no gun in front of it), centred and swaying; the test range,
 // pana and gun side by side.
 // The gunsmith: choosing a part turns the gun side-on, fills the frame with it and
 // glides the camera toward the part in this slot (the one hovered, else the one fitted).
 // Wide screens keep the stats on the right, so the gun sits a little left of the view's middle.
 let shownLook=kit;const wide=matchMedia('(min-width:801px)'),SMITH_ANGLE=Math.PI/2+.45,smithEye=new THREE.Vector3(0,1.15,4.2),camGoal=new THREE.Vector3(),lookGoal=new THREE.Vector3(),lookNow=new THREE.Vector3(0,1.15,0);
 const view=()=>range?'range':!dialog.classList.contains('choosing')?'gun':category==='armor'?'armor':category==='attachments'?'smith':'gun';
 function frame(){
  const v=view(),body=v==='armor'||v==='range';avatar.group.visible=body;vest.visible=body&&padded;model.visible=v!=='armor';
  if(v==='armor'){avatar.group.position.set(0,0,0);avatar.group.rotation.y=0;camera.position.set(0,1.05,4.4);camera.lookAt(0,.92,0);}
  else{avatar.group.position.set(-2.2,0,-.7);avatar.group.rotation.y=.5;}
  if(v==='range'){pivot.position.set(.5,1.3,0);model.position.set(0,0,0);model.scale.setScalar(1.7);camera.position.set(4,2.7,5);camera.lookAt(0,1.2,0);}
  else if(v==='gun'){const s=3.1/Math.max(gunBox.size.x,gunBox.size.y,gunBox.size.z,.01);pivot.position.set(0,1.2,0);model.scale.setScalar(s);model.position.copy(gunBox.center).multiplyScalar(-s);camera.position.set(1.6,2.1,5);camera.lookAt(0,1.15,0);}
  else if(v==='smith'){const H=2*4.4*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),s=Math.min(.68*H*camera.aspect/Math.max(gunBox.size.z,.01),.62*H/Math.max(gunBox.size.y,.01));
   pivot.position.set(0,1.2,0);model.scale.setScalar(s);model.position.copy(gunBox.center).multiplyScalar(-s);lookGoal.set(wide.matches?.1*H*camera.aspect:0,1.2,0);
   const part=new THREE.Box3(),name=PAINT_PART_LABELS[shownLook.attachments?.[slot]];pivot.rotation.y=SMITH_ANGLE;pivot.updateMatrixWorld(true);
   if(name)model.traverse(o=>{if(o.isMesh&&o.name.startsWith(name))part.expandByObject(o);});
   if(!part.isEmpty())lookGoal.lerp(part.getCenter(new THREE.Vector3()),.6);camGoal.copy(lookGoal).addScaledVector(smithEye,part.isEmpty()?1:.74);}
  framed=v;
 }
 function rebuild(look=kit){
  if(!renderer)return;model?.removeFromParent();model?.userData.dispose();
  model=createPaintKit({...look,color:FINISHES.find(f=>f.id===look.finish).color||'#f28b42'});
  // Measured once per model at unit scale, so every weapon (pistol to bazooka) fills the frame alike.
  const box=new THREE.Box3().setFromObject(model);gunBox={center:box.getCenter(new THREE.Vector3()),size:box.getSize(new THREE.Vector3())};
  pivot.add(model);padded=look.armor==='padded';shownLook=look;frame();
 }
 function init(){
  if(renderer)return;renderer=new THREE.WebGLRenderer({canvas:document.getElementById('armory-view'),antialias:true,alpha:true});renderer.setPixelRatio(pixelRatio(1.5));
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,50);camera.position.set(4,2.7,5);camera.lookAt(0,1.2,0);
  pivot=new THREE.Group();pivot.rotation.y=-.6;scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xfff5df,0x444466,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,4);scene.add(light);
  avatar=buildCharacter(loadAvatar());avatar.group.position.set(-2.2,0,-.7);avatar.group.rotation.y=.5;scene.add(avatar.group);vest=wearPaintVest(avatar);target=buildCharacter({...loadAvatar(),outfitColor:'#29c5cd'});target.group.position.set(1.8,0,-2);target.group.visible=false;scene.add(target.group);rebuild();
 }
 for(const b of document.querySelectorAll('#armory-slots button')) b.onclick=()=>{category=b.dataset.slot;slot=Number(b.dataset.index)||0;shown=null;note.textContent='';dialog.classList.add('choosing');paint();};
 const open=()=>{if(room.state.phase==='playing'){notify(loc('La armería abre entre rondas. En plena ronda cambias de marcadora con 1 a 9, Z y X.'));return;}note.textContent='';dialog.classList.remove('choosing');dialog.showModal();init();paint();if(camoLib||window.PanaSh)loadCamos(true);};
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
  if(framed!==view())frame();sway+=dt;if(framed==='smith'){pivot.rotation.y=SMITH_ANGLE+Math.sin(sway*.5)*.1;const k=1-Math.exp(-dt*7);camera.position.lerp(camGoal,k);camera.lookAt(lookNow.lerp(lookGoal,k));}else pivot.rotation.y+=dt*.18;if(framed==='armor')avatar.group.rotation.y=Math.sin(sway*.5)*.7;if(framed==='armor'||framed==='range')avatar.update(dt,{walk:false});
  if(range){acc+=dt;while(acc>=.05){range.step(.05,new Map([[1,{ax:0,az:1,fire,...(grenade||{})}]]));fire=grenade=false;acc-=.05;}const p=range.players[0],dummy=range.players[1];document.getElementById('range-status').textContent=`Blanco: ${dummy.paint} pepazos · ${dummy.hits} fuera · Carga: ${p.ammo} · ${p.reload>0?'Recargando':p.grenadeReady?'Granada lista':'Sin granada'}`;target.group.rotation.z=dummy.paint*.08;target.update(dt,{walk:false});if(dummy.respawn){dummy.respawn=0;Object.assign(dummy,{x:-22,z:-15,paint:0,shield:0});} }
  if(range) {
   for(const ball of range.balls){let o=balls.get(ball.id);if(!o){o=new THREE.Mesh(new THREE.SphereGeometry(ball.rocket?.12:.04,8,6),new THREE.MeshBasicMaterial({color:ball.color}));balls.set(ball.id,o);scene.add(o);}const t=(ball.z+22)/7;o.position.set(.1+1.7*t,1.1,-2*t);}
  }
  for(const [id,o] of balls)if(!range?.balls.some(b=>b.id===id)){o.removeFromParent();o.geometry.dispose();o.material.dispose();balls.delete(id);}
  renderer.render(scene,camera);
 },dispose(){model?.userData.dispose();vest?.userData.dispose();avatar?.dispose();target?.dispose();balls.forEach(o=>{o.geometry.dispose();o.material.dispose();});renderer?.dispose();}};
}
