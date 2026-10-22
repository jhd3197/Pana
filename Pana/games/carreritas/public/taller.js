// The taller (garage shop) UI, laid out like the Taller de Panas showroom:
// tabs of cards for the body, wheels, engine, spoiler, extras, paint and
// horn, priced in mangos (the wallet's coins). Hovering a card previews it on the five
// garage stat bars and its "+2 Vel" pills; clicking something you don't own
// puts it on the turntable car to try ("Probando …") until you buy it or
// take it off. Plain DOM: game.js owns the 3D car and the camera.
import { CATALOG, PAINTS, owns, unlocked, unlockText, trialCost, buyTrial, buy } from './shop.js';
import { PART_SLOTS, STATS, partById, partsProfile, renderConfig, statPoints, statPills, badge, nivelOf, bandOf, VESSEL_STAT_LABELS, VESSEL_DEFS, VESSEL_SLOTS, vesselTune, vesselById, trackPieces, kitNivel, carNivel, vesselNivel } from './parts.js';
import { composeTune, wheelById } from './wheel-definitions.js';
import { ICONS } from '/engine/icons.js';

const TABS = [
  { id: 'carro', label: 'Carro', kinds: ['car'] },
  { id: 'ruedas', label: 'Ruedas', kinds: ['wheel'] },
  { id: 'motor', label: 'Motor', kinds: ['motor'] },
  { id: 'aleron', label: 'Alerón', kinds: ['aleron'] },
  { id: 'extras', label: 'Extras', kinds: ['frente', 'techo', 'jaula'] },
  { id: 'pintura', label: 'Pintura', kinds: ['paint', 'acento', 'rin', 'acabado', 'calcomania', 'franjas'] },
  { id: 'sonido', label: 'Corneta', kinds: ['horn', 'flame'] },
];
const TITLES = { car: 'Carrocería', wheel: 'Ruedas', paint: 'Pintura', horn: 'Corneta', flame: 'Llama del turbo', ...Object.fromEntries(PART_SLOTS.map(s => [s.id, s.name])) };
const PART_KINDS = new Set(PART_SLOTS.map(s => s.id));
const SWATCHES = new Set(['paint', 'acento', 'rin']);
const VISUAL = new Set(['paint', 'wheel', ...PART_KINDS]);
const esc = (text) => String(text).replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const MANGO = `<span class="mango-symbol" aria-hidden="true">${ICONS.mango}</span>`;
export const mangos = (n) => `${n} ${n === 1 ? 'mango' : 'mangos'}`;

// A race pays in coins; the taller takes mangos, one for one, plus the
// podium (and trophy) prize in mangos.
export function exchangeText(collected, earned, total) {
  const prize = Math.max(0, earned - collected);
  return `${collected} ${collected === 1 ? 'moneda' : 'monedas'} → ${mangos(collected)}${prize ? ` · +${mangos(prize)} de premio` : ''} · tienes ${mangos(total)} pa'l taller`;
}

// The Taller page opens with the panel docked; its close button tucks it
// away to show the car strip, and "Taller" brings it back. Returns open().
export function dockTaller({ $, taller, sound, resize, onClosed }) {
  const open = () => {
    sound.unlock(); taller.open(); $('shop').hidden = false;
    document.body.classList.add('shop-open'); resize();
  };
  $('open-shop').onclick = () => { open(); $('shop-close').focus(); };
  $('shop-close').onclick = () => { $('shop').hidden = true; document.body.classList.remove('shop-open'); $('open-shop').focus(); };
  for (const el of document.querySelectorAll('.mango-symbol')) el.innerHTML = ICONS.mango;
  $('shop-close').innerHTML = ICONS.close;
  new MutationObserver(() => {
    if (!$('shop').hidden) return;
    taller.close(); document.body.classList.remove('shop-open'); onClosed(); resize();
  }).observe($('shop'), { attributes: true, attributeFilter: ['hidden'] });
  return open;
}

// Paint the five 10-segment bars for a tune, with an optional preview tune:
// gained segments light green, lost ones keep a red outline.
export function renderStatBars(root, tune, preview = null, labels = STATS.map(s=>s[0])) {
  if (!root) return;
  const a = statPoints(tune), b = preview ? statPoints(preview) : a;
  root.innerHTML = STATS.map((_, k) => { const name=labels[k];
    const segs = Array.from({ length: 10 }, (_, i) => `<i class="${k===4?'neutral ':''}${i < Math.min(a[k], b[k]) ? 'on' : b[k] > a[k] && i < b[k] ? 'up' : b[k] < a[k] && i < a[k] ? 'down' : ''}"></i>`).join('');
    return `<div><dt>${name}</dt><dd>${segs}</dd><span class="n${b[k] > a[k] ? ' up' : b[k] < a[k] ? ' down' : ''}">${b[k]}</span></div>`;
  }).join('');
}

export function createTaller({ $, wallet, cars, getIndex, selectCar, getWheel, setWheel, trophies, save, refreshCar, onHorn, onTab, sound, previewVessel = () => {}, getTrack = () => null, previewCar = () => {} }) {
  let vehicle = 'car', drawer = false, lastBand=null, wishlist=null;try{wishlist=JSON.parse(localStorage.getItem('carreritas:wishlist'));}catch{}
  let tab = 'carro', trial = {}, hover = null, trialCar = null;
  const vesselSlot = kind => (VESSEL_SLOTS[vehicle] ?? []).some(s => s.id === kind);
  const vesselParts = () => ({ ...(wallet[vehicle + 'Parts']?.[current(vehicle)] ?? {}), ...Object.fromEntries(Object.entries(trial).filter(([k]) => vesselSlot(k))) });
  const tabs = () => vehicle === 'car' ? TABS : [{ id: 'carro', label: 'Garaje', kinds: [vehicle] }, ...VESSEL_SLOTS[vehicle].map(s => ({ id: s.id, label: s.name, kinds: [s.id] })), ...TABS.slice(-2)];
  const def = () => cars[getIndex()];
  const equippedParts = (car = def()) => ({ ...(wallet.parts[car.id] ?? {}) });
  const equipped = (kind, car = def()) => vesselSlot(kind) ? wallet[vehicle + 'Parts']?.[wallet[vehicle]]?.[kind] ?? 'fabrica' : kind === 'paint' ? wallet.paint[car.id] ?? 'fabrica'
    : kind === 'wheel' ? getWheel() : kind === 'car' ? car.id
      : PART_KINDS.has(kind) ? equippedParts(car)[kind] ?? 'fabrica' : wallet[kind];
  const current = (kind) => trial[kind] ?? equipped(kind);
  const partsWith = (extra = {}) => {
    const parts = equippedParts();
    for (const [kind, id] of Object.entries({ ...trial, ...extra })) if (PART_KINDS.has(kind)) parts[kind] = id;
    return parts;
  };
  const tuneFor = (car, wheel, parts) => composeTune(car.tune, wheelById(wheel).profile, partsProfile(parts));
  const baseTune = () => vehicle !== 'car' ? vesselTune(vehicle, current(vehicle), vesselParts()) : tuneFor(def(), current('wheel'), partsWith());
  // the tune with one item swapped in, for previews and pills
  const tuneWith = (kind, id) => vehicle !== 'car' ? vesselTune(vehicle, kind === vehicle ? id : current(vehicle), { ...vesselParts(), ...(vesselSlot(kind) ? { [kind]: id } : {}) }) : kind === 'car' ? tuneFor(cars.find(c => c.id === id), current('wheel'), equippedParts())
    : kind === 'wheel' ? tuneFor(def(), id, partsWith())
      : PART_KINDS.has(kind) ? tuneFor(def(), current('wheel'), partsWith({ [kind]: id })) : null;

  // Trials belong to the selected car; picking another car drops them.
  const sync = () => { if (trialCar !== def().id) { trial = {}; hover = null; trialCar = def().id; } };
  // What the turntable shows for a car: equipped plus anything being tried.
  function look(car) {
    sync();
    if (car.id !== def().id) {   // a thumbnail of another car: only what it wears
      const parts = equippedParts();
      return { paint: PAINTS.find(p => p.id === equipped('paint'))?.color ?? null, parts, cfg: renderConfig(parts), wheel: getWheel() };
    }
    const parts = partsWith(hover && PART_KINDS.has(hover[0]) ? { [hover[0]]:hover[1] } : {});
    return { paint: PAINTS.find(p => p.id === (hover?.[0]==='paint'?hover[1]:current('paint')))?.color ?? null, parts, cfg: renderConfig(parts), wheel: hover?.[0]==='wheel'?hover[1]:current('wheel') };
  }

  function renderStats() {
    sync();
    const preview = hover ? tuneWith(...hover) : null;
    renderStatBars($('stats'), baseTune(), preview, VESSEL_STAT_LABELS[vehicle]);
    renderStatBars($('shop-stats'), baseTune(), preview, VESSEL_STAT_LABELS[vehicle]);
    $('shop-title').textContent = {car:'Tu carro',boat:'Tu lancha',air:'Tu avioneta'}[vehicle];
    $('loadout-name').textContent = vehicle === 'car' ? def().name : vesselById(vehicle,current(vehicle)).name;
    $('loadout-count').textContent = vehicle === 'car' ? cars.length : VESSEL_DEFS[vehicle].length;
    $('shop-level').innerHTML = badge(nivelOf(baseTune())) + (preview ? ' → ' + badge(nivelOf(preview)) : '');
    const nextBand=bandOf(nivelOf(baseTune())).letter;if(lastBand&&nextBand!==lastBand)$('shop-level').animate([{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:350});lastBand=nextBand;
    renderBuild();
  }

  // The line under the car's name: what it wears (or tries) beyond stock.
  function renderBuild() {
    const build = $('car-build');
    if (!build) return;
    const wheel = current('wheel'), parts = partsWith();
    if(vehicle !== 'car') { $('car-name').textContent = vesselById(vehicle,current(vehicle)).name; build.textContent = VESSEL_SLOTS[vehicle].map(s => CATALOG[s.id].find(p=>p.id===current(s.id))?.name).filter(n=>n && n!=='De fábrica').join(' · ') || 'De fábrica'; return; }
    const names = [wheel !== 'calle' ? wheelById(wheel).name : null,
      ...PART_SLOTS.map(({ id }) => parts[id] && parts[id] !== 'fabrica' ? partById(id, parts[id])?.name : null)].filter(Boolean);
    build.textContent = names.length ? names.join(' · ') : 'De fábrica';
  }

  function equip(kind, id) {
    const car = def();
    if (vesselSlot(kind)) {
      const key = vehicle + 'Parts'; wallet[key] ??= {};
      wallet[key][current(vehicle)] = { ...(wallet[key][current(vehicle)] ?? {}), [kind]: id };
    } else if (kind === 'paint') wallet.paint[car.id] = id;
    else if (kind === 'wheel') setWheel(id);
    else if (PART_KINDS.has(kind)) {
      const parts = wallet.parts[car.id] ?? {};
      if (id === 'fabrica') delete parts[kind]; else parts[kind] = id;
      if (Object.keys(parts).length) wallet.parts[car.id] = parts; else delete wallet.parts[car.id];
    } else wallet[kind] = id;
  }

  function selectBody(index){const from=def(),next=cars[(index+cars.length)%cars.length];wallet.parts[next.id]={...equippedParts()};wallet.paint[next.id]=wallet.paint[from.id]??'fabrica';selectCar(cars.indexOf(next));save();}
  function pick(kind, item) {
    hover = null;
    if (kind === 'car') { selectBody(cars.indexOf(item)); render(); return; }
    if (!buy(wallet,kind,item.id,trophies())) { $('loadout-message').textContent = `Te faltan ${mangos(Math.max(0,item.cost-wallet.coins))}`; return; }
    delete trial[kind]; equip(kind,item.id); save(); sound.pickup(); $('loadout-message').textContent='';
    render();
    if (VISUAL.has(kind) || vehicle !== 'car') { refreshCar(); showVessel(); }
    if (kind === 'horn') onHorn(current('horn'));
  }

  const items = (kind) => kind === 'car' ? cars : CATALOG[kind];
  function card(kind, item) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = SWATCHES.has(kind) ? 'shop-item shop-swatch' : 'shop-item';
    b.dataset.kind = kind; b.dataset.id = item.id;b.classList.toggle('recommended',!!wishlist?.entries?.some(([k,id])=>k===kind&&id===item.id));
    const isCar = kind === 'car', have = isCar || owns(wallet, kind, item.id), open = isCar || unlocked(item, trophies());
    const on = current(kind) === item.id, isEquipped = equipped(kind) === item.id;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('trying', on && !have);
    b.disabled = !open;
    const tag = !open ? `<small>${esc(unlockText(item))}</small>`
      : isEquipped ? `<em class="tag">${isCar ? 'Tu carro' : 'Equipado'}</em>` : have ? (isCar ? '' : '<em class="tag">Tuyo</em>')
        : `<em class="price" aria-label="${mangos(item.cost)}">${MANGO}${item.cost}</em>`;
    const color = kind === 'paint' ? item.color ?? def().color : kind === 'flame' ? '#' + item.colors[0].toString(16).padStart(6, '0')
      : kind === 'acento' || kind === 'rin' ? item.color ?? '#8a8496' : isCar ? item.color : null;
    const after = tuneWith(kind, item.id);
    // pills compare against what this slot holds now, so a downgrade reads as one
    const pills = after && !isEquipped ? statPills(tuneWith(kind, equipped(kind)), after).map(p => `<span class="pill ${p.label === 'Peso' ? 'peso' : p.delta > 0 ? 'up' : 'down'}">${p.delta > 0 ? '+' : ''}${p.delta} ${p.label}</span>`).join('') : '';
    const blurb = SWATCHES.has(kind) ? '' : item.blurb;
    b.innerHTML = `${color ? `<span class="swatch" style="--swatch:${color}"></span>` : ''}<span class="shop-text"><b>${isCar ? `${item.num} · ` : ''}${esc(item.name)}</b>${blurb ? `<small>${esc(blurb)}</small>` : ''}${pills ? `<span class="pills">${pills}</span>` : ''}${tag}</span>`;
    if(isCar) { const thumb=$('car-lineup').children[cars.indexOf(item)]?.querySelector('img'); if(thumb) b.prepend(thumb.cloneNode()); const chip=document.createElement('span');chip.innerHTML=badge(carNivel(item,current('wheel'),equippedParts())); b.append(chip); }
    if (SWATCHES.has(kind)) b.title = item.name;
    const enter = () => { hover = [kind,item.id]; renderStats(); if(kind==='car') previewCar(cars.indexOf(item)); else if(vehicle!=='car') showVessel(); else if(VISUAL.has(kind)) refreshCar(); };
    const leave = () => { if (hover?.[0] === kind && hover[1] === item.id) { hover = null; renderStats(); refreshCar(); showVessel(); } };
    b.addEventListener('pointerenter', enter); b.addEventListener('focus', enter);
    b.addEventListener('pointerleave', leave); b.addEventListener('blur', leave);
    b.onclick = () => pick(kind, item);
    return b;
  }

  function renderTry() {
    const bar = $('shop-try'), list = Object.entries(trial);
    const { missing, cost, short } = trialCost(wallet, list, trophies());
    bar.hidden = !missing.length;
    if (!missing.length) return;
    const names = missing.map(([kind, id]) => (PART_KINDS.has(kind) ? partById(kind, id) : CATALOG[kind].find(i => i.id === id))?.name).join(', ');
    $('shop-try-text').innerHTML = `Probando <b>${esc(names)}</b>`;
    const buy = $('shop-buy');
    buy.disabled = short > 0;
    buy.innerHTML = short > 0 ? `Te faltan ${mangos(short)}` : `Comprar ${MANGO}${cost}`;
    buy.setAttribute('aria-label', short > 0 ? `Te faltan ${mangos(short)}` : `Comprar por ${mangos(cost)}`);
  }

  function render() {
    $('shop-coins').textContent = wallet.coins;
    $('shop').classList.toggle('has-wishlist',!!wishlist);$('loadout-message').textContent=wishlist?`Kit de ${wishlist.name}: las piezas marcadas te faltan en el taller.`:'';
    renderSlots();
    const use=trackPieces(getTrack());
    for(const b of $('loadout-vehicles').querySelectorAll('button')) { b.classList.toggle('unused',!use.includes(b.dataset.vehicle)); b.title=use.includes(b.dataset.vehicle)?'Se usa en esta pista':'No se usa en esta pista'; }
    $('shop').classList.toggle('focus',drawer); document.body.classList.toggle('loadout-focus',drawer);
    $('loadout-drawer-title').textContent = tabs().find(t=>t.id===tab)?.label || 'Garaje';
    $('shop').classList.toggle('drawer-open', drawer);
    for (const b of $('shop-tabs').querySelectorAll('button')) b.setAttribute('aria-selected', String(drawer && b.dataset.tab === tab));
    const body = $('shop-body'), scroll = body.scrollTop;
    body.replaceChildren(...tabs().find(t => t.id === tab).kinds.map(kind => {
      const group = document.createElement('section');
      group.className = 'shop-group';
      const h = document.createElement('h3'); h.textContent = TITLES[kind] ?? VESSEL_SLOTS[vehicle]?.find(s => s.id === kind)?.name ?? (vehicle === 'boat' ? 'Lanchas' : 'Avionetas');
      const grid = document.createElement('div');
      grid.className = SWATCHES.has(kind) ? 'shop-grid shop-swatches' : 'shop-grid'; grid.id = `shop-${kind}`;
      grid.append(...items(kind).map(item => card(kind, item)));
      group.append(h, grid);
      return group;
    }));
    renderTry();
    renderStats();
    body.scrollTop = scroll;
  }

  function showVessel() { previewVessel(vehicle, hover?.[0]===vehicle?hover[1]:current(vehicle), PAINTS.find(p => p.id === (hover?.[0]==='paint'?hover[1]:current('paint')))?.color ?? def().color); }
  function setTab(id) { tab=id;drawer=true;hover=null;render();if(!$('loadout-drawer').open)$('loadout-drawer').showModal();$('shop-body').scrollTop=0;onTab(vehicle==='car'?tab:'carro');showVessel(); }
  function renderSlots() {
    const iconFor={motor:'kitMotor',ruedas:'kitWheel',aleron:'kitSpoiler',extras:'plus',pintura:'kitPaint',sonido:'kitHorn',casco:'kitHull',fueraborda:'kitMotor',helice:'kitProp',alas:'kitWing',aspas:'kitProp'};
    const list=tabs().filter(t=>t.id!=='carro'); if(vehicle==='car') [list[0],list[1]]=[list[1],list[0]];
    const make=t=>{
      const b=document.createElement('button');b.type='button';b.className='tl-slot sk';b.setAttribute('role','tab');b.dataset.tab=t.id;
      b.setAttribute('aria-expanded',String(drawer && t.id===tab));
      const names=[...new Set(t.kinds.map(k=>(items(k)??[]).find(i=>i.id===current(k))?.name).filter(Boolean))].filter(n=>n!=='De fábrica');
      const empty=!names.length && ['aleron','extras'].includes(t.id),label=t.id==='ruedas'&&current('wheel')==='calle'?'De fábrica':t.id==='sonido'&&current('horn')==='propio'?'Pito normal':empty?(t.id==='aleron'?'Sin alerón':'Ninguno'):names.join(' · ')||'De fábrica';
      b.classList.toggle('empty',empty);b.innerHTML=`<small>${esc(t.label)}</small><span class="ic">${ICONS[empty?'plus':iconFor[t.id]]||ICONS.plus}</span><b>${esc(label)}</b>`;
      b.onclick=()=>setTab(t.id);return b;
    };
    const divider=document.createElement('span');divider.className='tl-div';const style=document.createElement('div');style.className='tl-sty';style.append(...list.slice(-2).map(make));
    $('shop-tabs').replaceChildren(...list.slice(0,-2).map(make),divider,style);
    const footer=document.querySelector('.menu-footer');
    if(footer) { let summary=$('loadout-kit');if(!summary){summary=document.createElement('div');summary.id='loadout-kit';footer.insertBefore(summary,$('play'));}
      const pieces={car:carNivel(def(),getWheel(),equippedParts()),boat:vesselNivel('boat',wallet.boat,wallet.boatParts?.[wallet.boat]),air:vesselNivel('air',wallet.air,wallet.airParts?.[wallet.air])};
      summary.innerHTML='Tu kit para esta carrera '+badge(kitNivel(pieces,trackPieces(getTrack())));
    }
  }
  const closeDrawer=()=>{drawer=false;hover=null;document.body.classList.remove('loadout-focus');$('shop').classList.remove('focus');if($('shop').hidden)return;render();refreshCar();showVessel();onTab('carro');};
  $('loadout-drawer').addEventListener('close',closeDrawer);
  $('loadout-back').onclick=()=>{$('loadout-drawer').close();};
  $('loadout-name').onclick=$('loadout-garage').onclick=()=>setTab('carro');
  $('loadout-prev').innerHTML=ICONS.chevronLeft;$('loadout-next').innerHTML=ICONS.chevronRight;
  for(const [id,delta] of [['loadout-prev',-1],['loadout-next',1]]) $(id).onclick=()=>{
    if(vehicle==='car')selectBody(getIndex()+delta);else {const defs=VESSEL_DEFS[vehicle],index=defs.findIndex(d=>d.id===wallet[vehicle]);pick(vehicle,defs[(index+delta+defs.length)%defs.length]);}render();showVessel();
  };
  document.addEventListener('keydown',e=>{
    if($('shop').hidden || e.repeat || document.querySelector('dialog[open]') || e.target.closest('input,textarea,select'))return;
    const keys=[...$('loadout-vehicles').querySelectorAll('button')],index=keys.findIndex(b=>b.dataset.vehicle===vehicle);
    if(e.key.toLowerCase()==='q')keys[(index+2)%3].click();else if(e.key.toLowerCase()==='e')keys[(index+1)%3].click();else if(e.key.toLowerCase()==='g')setTab('carro');else return;e.preventDefault();
  });
  for (const b of $('loadout-vehicles').querySelectorAll('button')) b.onclick = () => {
    trial = {}; vehicle = b.dataset.vehicle; tab = 'carro'; drawer = false;
    for (const other of $('loadout-vehicles').querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === b));
    render(); refreshCar(); showVessel(); onTab('carro');
  };
  $('shop-buy').onclick = () => {
    const list = Object.entries(trial);
    if (!buyTrial(wallet, list, trophies())) return;
    trial = {};
    for (const [kind, id] of list) equip(kind, id);
    save();
    sound.pickup();
    render();
    refreshCar(); showVessel();
  };
  $('shop-untry').onclick = () => { trial = {}; render(); refreshCar(); showVessel(); };

  const kitEntries=c=>[['car',c.def.id],['wheel',c.wheel??'calle'],['boat',c.cosmetics?.boat??'penero'],['air',c.cosmetics?.air??'zamuro'],...Object.entries(c.cosmetics?.parts??{}),...Object.entries(c.cosmetics?.boatParts??{}),...Object.entries(c.cosmetics?.airParts??{}),['paint',c.cosmetics?.paint??'fabrica'],['horn',c.cosmetics?.horn??'propio']];
  const quoteKit=c=>kitEntries(c).reduce((sum,[kind,id])=>sum+(kind==='car'||owns(wallet,kind,id)?0:CATALOG[kind]?.find(p=>p.id===id)?.cost??0),0);
  return {
    look, render, renderStats, quoteKit,
    recommend(c){wishlist={name:c.name,entries:kitEntries(c)};try{localStorage.setItem('carreritas:wishlist',JSON.stringify(wishlist));}catch{}return quoteKit(c);},
    copyColors(c){const id=c.cosmetics?.paint??'fabrica';if(!buy(wallet,'paint',id,trophies()))return false;for(const car of cars)wallet.paint[car.id]=id;save();return true;},
    get tab() { return tab; },
    open(kind) { if (kind) setTab(tabs().find(t => t.kinds.includes(kind))?.id ?? tab); else { drawer = false; render(); showVessel(); } },
    // try an item from outside the taller (an unowned caucho in the strip)
    tryItem(kind, id) { sync(); trial[kind] = id; render(); refreshCar(); },
    // Leaving the taller takes off whatever was only being tried.
    close() { if($('loadout-drawer').open)$('loadout-drawer').close(); const had = Object.keys(trial).length; trial = {}; hover = null; vehicle = 'car'; tab = 'carro'; drawer = false; for(const b of $('loadout-vehicles').querySelectorAll('button')) b.setAttribute('aria-pressed',String(b.dataset.vehicle==='car')); previewVessel('car'); if (had) refreshCar(); },
  };
}
