import { ratingBadge } from '/engine/kit-rating.js';
import * as THREE from 'three';
import { loadAvatar } from '/engine/avatar.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { createPaintKit, wearPaintVest, PAINT_PART_LABELS } from '/engine/models/props/paintball-kit.js';
import { WEAPONS, ARMORY_CLASSES, SLOT_RULES, slotsFor, slotOf, partOf, partDeltas, throwRange, meleeInterval, ARMOR, GRENADES, grenadeDef, FINISHES, CHARMS, PATTERNS, FALLBACK_CAMO, cleanKit, kitStats, kitRating, kitModel, setPart, changeWeapon, shotInterval, dpsOf, gunOf, armorOf, classesFor, allowedIn } from './armory-data.js';
import { ICONS } from '/engine/icons.js';
import { pixelRatio } from '/engine/settings.js';
import { loc, locn, locKey, formatList } from '/engine/i18n.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);
// The empty choice of a gunsmith slot.
const NONE={id:'',name:locKey('Ninguno')};
// Card pictures: each weapon, part and charm drawn once from its real model
// (armory-thumbs.js, loaded with the first card); the icon stands in until then.
let thumbs=null;const thumbsLoad=()=>thumbs??=import('./armory-thumbs.js');
function setPic(el,key,icon,thumb){
 if(el.dataset.key===key)return el;el.dataset.key=key;el.innerHTML=icon?ICONS[icon]:'';
 if(thumb)thumbsLoad().then(thumb).then(src=>{if(!src||el.dataset.key!==key)return;const img=new Image();img.alt='';img.src=src;el.replaceChildren(img);}).catch(()=>{});
 return el;
}
const colorOf=kit=>FINISHES.find(f=>f.id===kit.finish)?.color||'#f28b42';
const classOfMarker=id=>ARMORY_CLASSES.find(c=>c.weapons.includes(id))||ARMORY_CLASSES[0];
// Pepazos with up to two decimals: La China's stones paint half of one.
const pepazos=n=>locn(n,'{n} pepazo','{n} pepazos',{n:String(Math.round(n*100)/100)});
// A gun's sub-menu, after its weapon and typed part slots: Estilo (a page of its own with
// the three looks in STYLE), then Salpicadura. Both guns share them.
const STYLE=[{id:'finish',name:locKey('Acabado')},{id:'camo',name:locKey('Camuflaje')},{id:'charm',name:locKey('Llavero')}];
const LOOKS=[{id:'style',name:locKey('Estilo')},{id:'pattern',name:locKey('Salpicadura')}];
// What a class changes against Balanceado, as icon + number chips (`less`: lower is better).
// A `from` compares against that number instead: the perks every class but one goes without.
const CLASS_CHIPS=[{key:'mobility',icon:'kitBolt',text:d=>`${Math.round(d*100)}%`},{key:'toughness',icon:'kitShield',text:d=>String(d)},{key:'regen',icon:'kitRegen',text:d=>`${Math.round(d*100)}%`},
 {key:'stepNoise',icon:'kitStep',text:d=>`${Math.round(d*100)}%`,less:true},{key:'markerScale',icon:'kitRadar',text:d=>`${Math.round(d*100)}%`,less:true},{key:'grenades',icon:'kitGrenade',text:d=>String(d)},{key:'grenadeRecharge',icon:'whirl',text:d=>`${Math.round(d)} s`,less:true},
 {key:'sprintDrain',from:3,icon:'kitBolt',text:d=>`${Math.round(d)} s`},{key:'sprintRegen',from:5,icon:'kitBolt',text:d=>`${Math.round(d)} s`,less:true},{key:'koWash',from:0,icon:'kitRegen',text:()=>'K.O.'}];
const chip=(d,less,icon,text)=>{const el=document.createElement('small');el.className=`armory-delta ${(d>0)!==!!less?'gain':'loss'}`;el.innerHTML=`${ICONS[icon]}${d>0?'+':'−'}${esc(text(Math.abs(d)))}`;return el;};
export function classChips(c){const out=document.createElement('span');out.className='armory-chips';for(const k of CLASS_CHIPS){const d=c[k.key]-(k.from??ARMOR[0][k.key]);if(Math.abs(d)>1e-6)out.append(chip(d,k.less,k.icon,k.text));}return out;}
// notify: a toast for news that arrives while the armory is closed (mid-round).
// onPick(kit): the kit the next rounds and the number keys play with.
export function createArmory({room,onPick,notify=()=>{}}) {
 let kit=cleanKit();try{kit=cleanKit(JSON.parse(localStorage.getItem('pintura:kit')));}catch{}
 room.kit=kit;onPick(kit);
 const dialog=document.getElementById('armory'),choices=document.getElementById('armory-choices'),note=document.getElementById('armory-note'),gunNav=document.getElementById('armory-gun'),back=document.getElementById('armory-back');
 // Says why a pick changed or did not stick: inline while the armory is open, a toast otherwise.
 const say=text=>{note.textContent=text;if(!dialog.open)notify(text);};
 const weaponName=id=>loc(WEAPONS.find(m=>m.id===id).name);
 const dropNote=(dropped,weapon)=>locn(dropped.length,'{parts} no cabe en {weapon} y salió del kit.','{parts} no caben en {weapon} y salieron del kit.',{parts:formatList(dropped.map(id=>loc(partOf(id).name)),{type:'conjunction'}),weapon:weaponName(weapon)});
 // An unowned camo comes back as a solid one: wear what the room wears (the saved pick stays until the next save).
 room.onKitRejected=({reason,camo}={})=>{
  // Owned here but not vouched for in this room yet (pana.sh could not sign it): a rejoin shows it.
  if(reason==='camo'){const fresh=camoData?.owned?.includes(camo);kit={...kit,camo:FALLBACK_CAMO};room.kit=kit;if(dialog.open){paint();rebuild();}say(fresh?loc('Ya es tuyo, pero la sala lo verá cuando vuelvas a entrar: por ahora llevas uno liso.'):loc('Ese camuflaje todavía no es tuyo: la sala te puso uno liso.'));return;}
  say(reason==='playing'?loc('No se pueden cambiar accesorios en plena ronda.'):loc('La sala no aceptó el kit. Inténtalo otra vez.'));
 };
 const rating=document.createElement('span');rating.id='armory-rating';document.getElementById('armory-name').after(rating);
 const className=document.createElement('small');className.id='armory-class';rating.after(className);
 // The class chips, the first row of the weapon choices; LB / RB step through them (role=tab).
 const tabs=document.createElement('nav');tabs.id='armory-classes';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label',loc('Clases de marcadora'));
 back.prepend(Object.assign(document.createElement('i'),{innerHTML:ICONS.chevronLeft}));back.onclick=()=>stepBack();
 // Levels: the four slots; a gun's sub-menu (`gun` 0 or 1); its Estilo page (`styling`); one slot's choices (`category`).
 let styling=false,shown=null,ratedOptions='',category=null,slot=null,gun=null,hover=0,renderer=null,scene,camera,model,avatar,vest,range=null,pivot,gunBox,padded=false,framed=null,sway=0,opener=null;
 // The gun on show: the open sub-menu's, else the Arma tile last pointed at.
 const hand=()=>gun??hover;
 const catalog={armor:ARMOR,grenade:GRENADES,finish:FINISHES,charm:CHARMS,pattern:PATTERNS};
 const icons={finish:'kitPaint',camo:'kitPaint',charm:'wardrobe-cuello',pattern:'kitPaint'};
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
 const swatch=id=>id?camoLib?.swatch(id)||'#2f3d3c':'linear-gradient(135deg,#f28b42 50%,#2f3d3c 50%)';
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
   b.querySelector('.armory-swatch').style.background=swatch(c.id);
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
  ratedOptions=JSON.stringify(room.state.options);const h=hand();
  rating.innerHTML=ratingBadge(kitRating(gunOf(value,h),room.state.options));
  const current=kitStats(kit,room.state.options,h),next=kitStats(value,room.state.options,h);
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
 // What a part changes against an empty slot (partDeltas), as up to three icon + number
 // chips; a swing or a thrown weapon's return says its word, so a trade reads at a glance.
 const CHIPS={zoom:{icon:'kitScope',text:n=>`${Math.round(n*100)/100}×`},balls:{icon:'kitHopper',text:d=>String(Math.round(d))},reach:{icon:'kitBarrel',text:d=>`${fmtDelta(d)} m`},recall:{icon:'whirl',text:d=>`${fmtDelta(d)} s`,word:locKey('Vuelve')},paint:{icon:'kitPaint',text:d=>fmtDelta(d)},
  swing:{icon:'whirl',text:d=>`${fmtDelta(d)}/s`,word:locKey('Golpes')},reload:{icon:'whirl',text:d=>`${fmtDelta(d)} s`},mobility:{icon:'person',text:d=>`${Math.round(d)}%`}};
 function chips(id){
  const out=document.createElement('span');out.className='armory-chips';
  for(const d of partDeltas(kit,slot,id,room.state.options,hand())){
   const c=CHIPS[d.key],el=document.createElement('small');el.className=`armory-delta ${d.gain?'gain':'loss'}`;
   el.innerHTML=`${ICONS[c.icon]}${c.word?`${esc(loc(c.word))} `:''}${d.plain?'':d.delta>0?'+':'−'}${esc(c.text(d.plain?d.value:Math.abs(d.delta)))}`;out.append(el);
  }
  return out;
 }
 // A tile: its picture and a short label that always shows whole (armory.css wraps it).
 const tile=(field,label,part=null)=>{const b=document.createElement('button');b.type='button';b.dataset.slot=field;if(part)b.dataset.part=part;b.innerHTML=`<i></i><span>${esc(loc(label))}</span>`;b.onclick=()=>choose(field,part);return b;};
 // A gun's sub-menu: its weapon, the typed slots that weapon has, then the shared looks;
 // on its Estilo page, Atrás and the three looks instead.
 let gunKey='';
 function gunTiles(){
  const g=gunOf(kit,gun),key=`${gun}:${styling}:${slotsFor(g.weapon).map(s=>s.id)}`;if(key===gunKey)return;gunKey=key;
  gunNav.setAttribute('aria-label',styling?loc('Estilo'):gun?loc('Arma 2'):loc('Arma 1'));
  gunNav.replaceChildren(back,...styling?STYLE.map(l=>tile(l.id,l.name)):[tile('weapon',locKey('Arma')),...slotsFor(g.weapon).map(s=>tile('part',s.name,s.id)),...LOOKS.map(l=>tile(l.id,l.name))]);
 }
 // Each slot's picture of what it holds now.
 function slotPic(b,field,h=hand()){
  const g=gunOf(kit,h),color=colorOf(kit),pic=b.querySelector('i');
  if(field==='gun'||field==='weapon')return setPic(pic,`w:${g.weapon}:${color}:${kit.camo}:${kit.pattern}`,'kitBarrel',m=>m.weaponThumb({weapon:g.weapon,color,camo:kit.camo,pattern:kit.pattern}));
  if(field==='armor')return setPic(pic,`a:${kit.armor}`,armorOf(kit.armor).icon);
  if(field==='grenade'){const own=grenadeDef(kit.grenade).color;return setPic(pic,`g:${own}`,'kitGrenade',m=>m.grenadeThumb(own));}
  if(field==='part'){const part=g.slots[b.dataset.part];b.classList.toggle('armory-empty',!part);b.dataset.id=part||'';b.title=loc(partOf(part)?.name||NONE.name);return setPic(pic,`p:${g.weapon}:${part}:${color}`,part?partOf(part).icon:slotOf(b.dataset.part).icon,part&&(m=>m.partThumb(g.weapon,part,color)));}
  // Estilo: the finish's colour under the camo worn, cut corner to corner.
  if(field==='style'){pic.dataset.key='';pic.className='armory-swatch armory-style';pic.innerHTML='';pic.style.background=`linear-gradient(135deg,${FINISHES.find(f=>f.id===kit.finish).color||'#f28b42'} 50%,transparent 50%),${kit.camo?swatch(kit.camo):'#2f3d3c'}`;return pic;}
  if(field==='finish'||field==='camo'){pic.dataset.key='';pic.className='armory-swatch';pic.innerHTML='';pic.style.background=field==='finish'?FINISHES.find(f=>f.id===kit.finish).color||swatch(''):swatch(kit.camo);return pic;}
  if(field==='charm')return setPic(pic,`c:${kit.charm}`,kit.charm==='none'?'close':'wardrobe-cuello',kit.charm!=='none'&&(m=>m.charmThumb(kit.charm)));
  if(field==='pattern')return setPic(pic,`s:${g.weapon}:${kit.pattern}:${color}`,'kitPaint',m=>m.weaponThumb({weapon:g.weapon,color,camo:kit.camo,pattern:kit.pattern}));
 }
 function paint() {
  const h=hand(),g=gunOf(kit,h),group=classOfMarker(g.weapon);
  if(gun!==null)gunTiles();
  // A weapon swap can take away the slot being chosen (a melee weapon has no Mira).
  if(category==='part'&&!SLOT_RULES[g.weapon][slot]){category=null;dialog.classList.remove('choosing');}
  dialog.classList.toggle('armory-in-gun',gun!==null);gunNav.hidden=gun===null;back.hidden=gun===null&&!category;
  // Atrás is the sub-menu's first tile, and sits over the choices while one slot is open.
  if(gun!==null&&!category){if(gunNav.firstElementChild!==back)gunNav.prepend(back);}else if(back.parentElement!==dialog)choices.before(back);
  document.getElementById('armory-name').textContent=category==='armor'?loc(armorOf(kit.armor).name):weaponName(g.weapon);
  className.textContent=category==='armor'?'':`${gun===null?`${h?loc('Arma 2'):loc('Arma 1')} · `:''}${loc(group.kind)}`;paintStats();
  for(const b of document.querySelectorAll('#armory-slots button')){
   const field=b.dataset.slot,mine=field==='gun'?Number(b.dataset.hand):null,g2=mine===null?null:gunOf(kit,mine);
   b.setAttribute('aria-pressed',String(field==='gun'?gun===mine:category===field));slotPic(b,field,mine??h);
   b.querySelector('b').textContent=field==='gun'?weaponName(g2.weapon):field==='armor'?loc(armorOf(kit.armor).name):catalog[field].find(x=>x.id===kit[field]).name;
  }
  for(const b of gunNav.children){b.setAttribute('aria-pressed',String((category===b.dataset.slot||b.dataset.slot==='style'&&STYLE.some(l=>l.id===category))&&(b.dataset.slot!=='part'||slot===b.dataset.part)));slotPic(b,b.dataset.slot);if(b.dataset.slot==='weapon')b.querySelector('span').textContent=weaponName(g.weapon);}
  choices.dataset.category=category||'';if(!category)return;
  if(category==='camo'){choices.replaceChildren(...camoChoices());return;}
  const attaching=category==='part',arming=category==='weapon',classes=classesFor(h);
  // Weapons come by class: a tab per class (nickname · kind), then that class's weapons. Arma 2 only shows sidearms.
  if(arming && !classes.includes(shown)) shown=classOfMarker(g.weapon);if(arming&&!classes.includes(shown))shown=classes[0];
  // The same tab buttons stay while the hand's classes do, so LB / RB keep the focus on the tab they pick.
  if(arming&&tabs.dataset.key!==String(h)){tabs.dataset.key=String(h);tabs.replaceChildren(...classes.map(c=>{const t=document.createElement('button');t.type='button';t.className='armory-class';t.setAttribute('role','tab');t.dataset.class=c.id;t.innerHTML=`<b>${esc(loc(c.name))}</b><span>${esc(loc(c.kind))}</span>`;t.onclick=()=>{shown=c;paint();t.focus({preventScroll:true});};return t;}));}
  if(arming)for(const t of tabs.children)t.setAttribute('aria-selected',String(t.dataset.class===shown.id));
  // A slot lists only the parts this weapon takes there (SLOT_RULES), Ninguno first.
  const items=attaching?[NONE,...SLOT_RULES[g.weapon][slot].map(partOf)]:arming?WEAPONS.filter(m=>shown.weapons.includes(m.id)&&allowedIn(h,m.id)):catalog[category];
  const color=colorOf(kit);
  // Every card is a picture and a name; a part or a class adds what it changes as icon chips.
  const picture=item=>{const pic=document.createElement('i');pic.className='armory-pic';const k=`${category}:${item.id}:${g.weapon}:${color}:${kit.camo}:${kit.pattern}`;
   if(arming)return setPic(pic,k,'kitBarrel',m=>m.weaponThumb({weapon:item.id,color,camo:kit.camo,pattern:kit.pattern}));
   if(attaching)return setPic(pic,k,item.id?item.icon:'close',item.id&&(m=>m.partThumb(g.weapon,item.id,color)));
   if(category==='armor')return setPic(pic,k,item.icon);
   if(category==='pattern')return setPic(pic,k,'kitPaint',m=>m.weaponThumb({weapon:g.weapon,color,camo:kit.camo,pattern:item.id}));
   if(category==='charm')return setPic(pic,k,item.id==='none'?'close':'wardrobe-cuello',item.id!=='none'&&(m=>m.charmThumb(item.id)));
   if(category==='grenade')return setPic(pic,`g:${item.id}`,'kitGrenade',m=>m.grenadeThumb(item.color));
   pic.classList.add('armory-swatch');pic.style.background=item.color||swatch('');return pic;};
  choices.replaceChildren(...(arming?[tabs]:[]),...items.map(item=>{
   const b=document.createElement('button');b.type='button';b.className='armory-choice armory-card';b.dataset.id=item.id;
   b.setAttribute('aria-pressed',String(attaching?(g.slots[slot]??'')===item.id:arming?g.weapon===item.id:kit[category]===item.id));
   const label=document.createElement('b');label.textContent=loc(item.name);b.append(picture(item),label);
   // A grenade's one line in its own colour; a class's perk, then what it changes in numbers.
   const line=category==='grenade'?item.blurb:category==='armor'?item.perk:null;
   if(line){const el=document.createElement('span');el.className='armory-perk';el.textContent=loc(line);if(item.color)el.style.setProperty('--line',item.color);b.append(el);}
   if(attaching&&item.id)b.append(chips(item.id));if(category==='armor')b.append(classChips(item));
   // Read the kit when the event fires, not when the button was drawn.
   const pick=()=>attaching?{kit:setPart(kit,slot,item.id||null,h),dropped:[]}:arming?changeWeapon(kit,item.id,h):{kit:cleanKit({...kit,[category]:item.id}),dropped:[]};
   for(const event of ['pointerenter','focus'])b.addEventListener(event,()=>{const next=pick().kit;paintStats(next);rebuild(next);});
   for(const event of ['pointerleave','blur'])b.addEventListener(event,()=>{paintStats();rebuild();});
   b.onclick=()=>{const {kit:next,dropped}=pick();kit=next;note.textContent=dropped.length?dropNote(dropped,gunOf(kit,h).weapon):'';save();paint();rebuild();focus(choices.querySelector(`.armory-card[data-id="${item.id}"]`));};return b;
  }));
 }
 function store(){try{localStorage.setItem('pintura:kit',JSON.stringify(kit));}catch{}}
 function save(){store();room.selectKit(kit);onPick(kit);}
 // Z / X and the pause menu mid-round: the room takes the weapon of the gun in hand from
 // input, so only the lobby sends the kit; the saved kit follows either way.
 function setWeapon(id,h=0){
  const now=gunOf(kit,h).weapon;if(id===now || !allowedIn(h,id))return;
  const {kit:next,dropped}=changeWeapon(kit,id,h);kit=next;
  if(room.state.phase==='playing'){store();room.kit=kit;onPick(kit);}else save();
  if(dropped.length)say(dropNote(dropped,gunOf(kit,h).weapon));
  if(dialog.open){paint();rebuild();}
 }
 // Two views plus the gunsmith: the gun alone, centred and turning on `pivot`; Equipo, the pana
 // alone in the class's look (no gun in front of it), centred and swaying.
 // The gunsmith: choosing a part turns the gun side-on, fills the frame with it and
 // glides the camera toward the part in this slot (the one hovered, else the one fitted). A Mira on top is seen from above, over the hopper.
 // Wide screens keep the stats on the right, so the gun sits a little left of the view's middle.
 let shownLook=kit;const wide=matchMedia('(min-width:801px)'),SMITH_ANGLE=Math.PI/2+.45,smithEye=new THREE.Vector3(0,1.15,4.2),camGoal=new THREE.Vector3(),lookGoal=new THREE.Vector3(),lookNow=new THREE.Vector3(0,1.15,0);
 const view=()=>category==='armor'?'armor':category==='part'?'smith':'gun';
 function frame(){
  const v=view(),body=v==='armor';avatar.group.visible=body;vest.visible=body&&padded;model.visible=v!=='armor';
  if(v==='armor'){avatar.group.position.set(0,0,0);avatar.group.rotation.y=0;camera.position.set(0,1.05,4.4);camera.lookAt(0,.92,0);}
  else{avatar.group.position.set(-2.2,0,-.7);avatar.group.rotation.y=.5;}
  if(v==='gun'){const s=3.1/Math.max(gunBox.size.x,gunBox.size.y,gunBox.size.z,.01);pivot.position.set(0,1.2,0);model.scale.setScalar(s);model.position.copy(gunBox.center).multiplyScalar(-s);camera.position.set(1.6,2.1,5);camera.lookAt(0,1.15,0);}
  else if(v==='smith'){const H=2*4.4*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),s=Math.min(.68*H*camera.aspect/Math.max(gunBox.size.z,.01),.62*H/Math.max(gunBox.size.y,.01));
   pivot.position.set(0,1.2,0);model.scale.setScalar(s);model.position.copy(gunBox.center).multiplyScalar(-s);lookGoal.set(wide.matches?.1*H*camera.aspect:0,1.2,0);
   const part=new THREE.Box3(),name=PAINT_PART_LABELS[partOf(gunOf(shownLook,hand()).slots[slot])?.part];pivot.rotation.y=SMITH_ANGLE;pivot.updateMatrixWorld(true);
   if(name)model.traverse(o=>{if(o.isMesh&&o.name.startsWith(name))part.expandByObject(o);});
   if(!part.isEmpty())lookGoal.lerp(part.getCenter(new THREE.Vector3()),.6);camGoal.copy(lookGoal).addScaledVector(smithEye,part.isEmpty()?1:.74);if(slot==='optic')camGoal.y+=1.1;}
  framed=v;
 }
 function rebuild(look=kit){
  if(!renderer)return;model?.removeFromParent();model?.userData.dispose();
  const h=hand();model=createPaintKit({...look,...kitModel(look,h),weapon:gunOf(look,h).weapon,color:FINISHES.find(f=>f.id===look.finish).color||'#f28b42'});
  // Measured once per model at unit scale, so every weapon (pistol to bazooka) fills the frame alike.
  const box=new THREE.Box3().setFromObject(model);gunBox={center:box.getCenter(new THREE.Vector3()),size:box.getSize(new THREE.Vector3())};
  pivot.add(model);padded=!!armorOf(look.armor).vest;shownLook=look;frame();
 }
 function init(){
  if(renderer)return;renderer=new THREE.WebGLRenderer({canvas:document.getElementById('armory-view'),antialias:true,alpha:true});renderer.setPixelRatio(pixelRatio(1.5));
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(35,1,.1,50);camera.position.set(4,2.7,5);camera.lookAt(0,1.2,0);
  pivot=new THREE.Group();pivot.rotation.y=-.6;scene.add(pivot);
  scene.add(new THREE.HemisphereLight(0xfff5df,0x444466,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(3,6,4);scene.add(light);
  avatar=buildCharacter(loadAvatar());avatar.group.position.set(-2.2,0,-.7);avatar.group.rotation.y=.5;scene.add(avatar.group);vest=wearPaintVest(avatar);rebuild();
 }
 // The focus follows the menu: into a level its first button, back out the button that opened it.
 const focus=el=>el?.focus({preventScroll:true});
 // Opens one slot's choices (a gunsmith slot names which: 'optic', 'hopper'…).
 function choose(field,part=null){
  if(field==='gun')return openGun(Number(part??0));
  if(field==='style')return openStyle();
  opener=document.activeElement;category=field;slot=part;shown=null;note.textContent='';dialog.classList.add('choosing');paint();rebuild();
  focus(choices.querySelector('.armory-choice[aria-pressed=true]')||choices.querySelector('.armory-choice'));
 }
 function openGun(h){gun=hover=h;styling=false;category=null;gunKey='';note.textContent='';dialog.classList.remove('choosing');paint();rebuild();focus(gunNav.querySelector('[data-slot]'));}
 // Estilo: the sub-menu's tiles give way to Atrás and the three looks.
 function openStyle(){styling=true;gunKey='';note.textContent='';paint();focus(gunNav.querySelector('[data-slot]'));}
 // Atrás, B, Esc or Backspace: one level up each time. The choices close back to their level,
 // the Estilo page back to the gun's sub-menu, a gun's sub-menu back to the four slots.
 function stepBack(){
  if(category){const from=opener;category=null;slot=null;dialog.classList.remove('choosing');paint();rebuild();focus(from?.isConnected&&!from.closest('[hidden]')?from:gun!==null?gunNav.querySelector('[data-slot]'):document.querySelector('#armory-slots button'));return true;}
  if(styling){styling=false;gunKey='';note.textContent='';paint();focus(gunNav.querySelector('[data-slot=style]'));return true;}
  if(gun!==null){const h=gun;gun=null;paint();rebuild();focus(document.querySelector(`#armory-slots [data-hand="${h}"]`));return true;}
  return false;
 }
 for(const b of document.querySelectorAll('#armory-slots button')){
  b.onclick=()=>choose(b.dataset.slot,b.dataset.hand);
  // Pointing at Arma 1 or Arma 2 shows that gun.
  if(b.dataset.slot==='gun')for(const event of ['pointerenter','focus'])b.addEventListener(event,()=>{const h=Number(b.dataset.hand);if(gun===null&&!category&&hover!==h){hover=h;paint();rebuild();}});
 }
 // Esc steps back a level before it closes the armory (the range closes itself first).
 dialog.addEventListener('cancel',event=>{if(range)return;if(stepBack())event.preventDefault();});
 // The keyboard: Esc and Backspace step back a level, taken on the key itself: Chrome lets a
 // page hold back only one `cancel` per click, so Esc Esc would close the whole armory.
 // The arrows walk the level's tiles and cards (Enter presses one), sideways along a row
 // of class tabs, which they also pick.
 const DIRS={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 dialog.addEventListener('keydown',event=>{
  if(range||event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.key==='Escape'){if(stepBack())event.preventDefault();return;}
  if(event.target.matches?.('input,textarea,select'))return;
  if(event.key==='Backspace'){if(stepBack())event.preventDefault();return;}
  const dir=DIRS[event.key];if(!dir)return;event.preventDefault();
  const now=document.activeElement,visible=b=>b.getClientRects().length&&!b.disabled&&!b.closest('[hidden]')&&getComputedStyle(b).visibility!=='hidden';
  if(now?.matches('[role=tab]')&&dir[0]){const row=[...now.parentElement.children].filter(visible),next=row[row.indexOf(now)+dir[0]];if(next){next.click();focus(next);}return;}
  const level=category?[back,...choices.querySelectorAll('button')]:gun!==null?[...gunNav.children]:[...document.querySelectorAll('#armory-slots button')];
  const all=level.filter(visible);if(!all.length)return;if(!all.includes(now))return focus(all.find(b=>b.getAttribute('aria-pressed')==='true')||all[0]);
  // The nearest in that direction, a step along the other axis costing double.
  const at=b=>{const r=b.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];},[x,y]=at(now);let best=null,cost=Infinity;
  for(const b of all){if(b===now)continue;const [bx,by]=at(b),along=(bx-x)*dir[0]+(by-y)*dir[1],across=Math.abs((bx-x)*dir[1])+Math.abs((by-y)*dir[0]);if(along<=1)continue;const c=along+across*2;if(c<cost){cost=c;best=b;}}
  focus(best);
 });
 const open=()=>{if(room.state.phase==='playing'){notify(loc('La armería abre entre rondas. En plena ronda: 1 y 2 o Q cambian de arma; Z y X, de modelo.'));return;}note.textContent='';gun=null;styling=false;category=null;hover=0;dialog.classList.remove('choosing');dialog.showModal();init();paint();rebuild();if(camoLib||window.PanaSh)loadCamos(true);};
 document.getElementById('open-armory').onclick=open;document.getElementById('armory-close').onclick=()=>dialog.close();
 document.getElementById('armory-go').onclick=()=>{save();dialog.close();if(room.isHost)room.start();};
 // Probar: the shooting range (range.js), a first-person lane with the gun on show on the real rules.
 // Nothing of it is fetched before the click: a small dark square (a bar, one word) covers the
 // module, its stylesheet, the scene and the shader compile, never less than LOADING_MIN ms.
 const LOADING_MIN=450;let loading=null;
 const endLoading=()=>{loading?.remove();loading=null;};
 document.getElementById('armory-range').onclick=()=>{
  if(range)return;range='loading';const shown=performance.now();
  loading=document.createElement('div');loading.id='range-loading';loading.setAttribute('role','status');loading.innerHTML=`<i class="pk-cover-bar"><i></i></i><b>${esc(loc('Cargando'))}</b>`;dialog.append(loading);
  import('./range.js').then(({openRange})=>{
   if(range!=='loading'||!dialog.open){range=null;endLoading();return;}
   const opened=range=openRange({dialog,kit:gunOf(kit,hand()),options:room.state.options,onExit:()=>{range=null;endLoading();if(dialog.open)document.getElementById('armory-range').focus();}});
   return opened.ready.then(()=>new Promise(done=>setTimeout(done,Math.max(0,LOADING_MIN-(performance.now()-shown))))).then(()=>{if(range===opened)endLoading();});
  }).catch(()=>{if(range==='loading')range=null;endLoading();});
 };
 dialog.addEventListener('close',()=>{if(range?.close)range.close();range=null;endLoading();gun=null;styling=false;category=null;dialog.classList.remove('choosing','armory-in-gun');document.getElementById('open-armory').focus();});
 return {get kit(){return kit;}, get preview(){return model;}, get body(){return avatar?.group;},get camos(){return camoData;}, get range(){return range?.debug??null;}, get ranging(){return !!range;}, get level(){return category?'choices':styling?'style':gun!==null?`gun${gun}`:'top';}, refreshCamos:()=>loadCamos(true), open, setWeapon, back:stepBack, update(dt){
  if(range?.update){range.update(dt);return;}
  if(!dialog.open||!renderer)return;if(ratedOptions!==JSON.stringify(room.state.options))paintStats();const c=renderer.domElement,w=c.clientWidth,h=c.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  if(framed!==view())frame();sway+=dt;if(framed==='smith'){pivot.rotation.y=SMITH_ANGLE+Math.sin(sway*.5)*.1;const k=1-Math.exp(-dt*7);camera.position.lerp(camGoal,k);camera.lookAt(lookNow.lerp(lookGoal,k));}else pivot.rotation.y+=dt*.18;if(framed==='armor')avatar.group.rotation.y=Math.sin(sway*.5)*.7;if(framed==='armor')avatar.update(dt,{walk:false});
  renderer.render(scene,camera);
 },dispose(){if(range?.close)range.close();model?.userData.dispose();vest?.userData.dispose();avatar?.dispose();renderer?.dispose();}};
}
