// The fullscreen Taller follows the prototype's slots and Garaje drawer.
// Hover previews the model and stats without spending; click buys/equips.
// game.js owns the 3D car and camera.
import { CATALOG, PAINTS, kitEntries, quoteBuild, paintOf, owns, unlocked, unlockText, buy } from './shop.js';
import { PART_SLOTS, STATS, partsProfile, renderConfig, statPoints, statPills, badge, nivelOf, bandOf, VESSEL_STAT_LABELS, VESSEL_DEFS, VESSEL_SLOTS, vesselTune, vesselById, trackPieces, kitNivel, carNivel, vesselNivel } from './parts.js';
import { composeTune, wheelById } from './wheel-definitions.js';
import { ICONS } from '/engine/icons.js';
import { loc, locn } from '/engine/i18n.js';

const TABS = [
  { id: 'carro', label: loc('Carro'), kinds: ['car'] },
  { id: 'ruedas', label: loc('Ruedas'), kinds: ['wheel'] },
  { id: 'motor', label: loc('Motor'), kinds: ['motor'] },
  { id: 'aleron', label: loc('Alerón'), kinds: ['aleron'] },
  { id: 'extras', label: loc('Extras'), kinds: ['frente', 'techo', 'jaula'] },
  { id: 'pintura', label: loc('Pintura y estilo'), kinds: ['paint', 'acento', 'rin', 'acabado', 'calcomania', 'franjas', 'flame'] },
  { id: 'sonido', label: loc('Corneta'), kinds: ['horn'] },
];
const TITLES = { car: loc('Carrocería'), wheel: loc('Ruedas'), paint: loc('Pintura'), horn: loc('Corneta'), flame: loc('Llama del turbo'), ...Object.fromEntries(PART_SLOTS.map(s => [s.id, s.name])) };
const PART_KINDS = new Set(PART_SLOTS.map(s => s.id));
const SWATCHES = new Set(['paint', 'acento', 'rin', 'flame']);
const VISUAL = new Set(['paint', 'wheel', ...PART_KINDS]);
const esc = (text) => String(text).replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
const MANGO = `<span class="mango-symbol" aria-hidden="true">${ICONS.mango}</span>`;
export const mangos = (n) => locn(n, '{n} mango', '{n} mangos');

// The full-screen Taller follows the menu page, without hidden open/close buttons.
export function dockTaller({ $, taller, sound, resize, onClosed }) {
  const open = () => {
    sound.unlock(); taller.open(); $('shop').hidden = false;
    document.body.classList.add('shop-open'); resize();
  };
  for (const el of document.querySelectorAll('.mango-symbol')) el.innerHTML = ICONS.mango;
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

export function createTaller({ $, wallet, cars, getIndex, selectCar, getWheel, setWheel, trophies, save, refreshCar, onHorn, onTab, sound, carThumbnail, previewVessel = () => {}, getTrack = () => null, previewCar = () => {} }) {
  let vehicle = 'car', drawer = false, lastBand=null, wishlist=null;try{wishlist=JSON.parse(localStorage.getItem('carreritas:wishlist'));}catch{}
  let tab = 'carro', hover = null;
  const optionPages = createOptionPages($('loadout-drawer'));
  const vesselSlot = kind => (VESSEL_SLOTS[vehicle] ?? []).some(s => s.id === kind);
  const vesselParts = () => ({ ...(wallet[vehicle + 'Parts']?.[current(vehicle)] ?? {}) });
  const tabs = () => vehicle === 'car' ? TABS : [{ id: 'carro', label: loc('Garaje'), kinds: [vehicle] }, ...VESSEL_SLOTS[vehicle].map(s => ({ id: s.id, label: s.name, kinds: [s.id] })), ...TABS.slice(-2)];
  const def = () => cars[getIndex()];
  const equippedParts = (car = def()) => ({ ...(wallet.parts[car.id] ?? {}) });
  const equipped = (kind, car = def()) => vesselSlot(kind) ? wallet[vehicle + 'Parts']?.[wallet[vehicle]]?.[kind] ?? 'fabrica' : kind === 'paint' ? wallet.paint[car.id] ?? 'fabrica'
    : kind === 'wheel' ? getWheel() : kind === 'car' ? car.id
      : PART_KINDS.has(kind) ? equippedParts(car)[kind] ?? 'fabrica' : wallet[kind];
  const current = (kind) => equipped(kind);
  const partsWith = (extra = {}) => {
    const parts = equippedParts();
    for (const [kind, id] of Object.entries(extra)) if (PART_KINDS.has(kind)) parts[kind] = id;
    return parts;
  };
  const tuneFor = (car, wheel, parts) => composeTune(car.tune, wheelById(wheel).profile, partsProfile(parts));
  const baseTune = () => vehicle !== 'car' ? vesselTune(vehicle, current(vehicle), vesselParts()) : tuneFor(def(), current('wheel'), partsWith());
  // the tune with one item swapped in, for previews and pills
  const tuneWith = (kind, id) => vehicle !== 'car' ? vesselTune(vehicle, kind === vehicle ? id : current(vehicle), { ...vesselParts(), ...(vesselSlot(kind) ? { [kind]: id } : {}) }) : kind === 'car' ? tuneFor(cars.find(c => c.id === id), current('wheel'), equippedParts())
    : kind === 'wheel' ? tuneFor(def(), id, partsWith())
      : PART_KINDS.has(kind) ? tuneFor(def(), current('wheel'), partsWith({ [kind]: id })) : null;

  // The turntable previews hovered parts without changing the equipped kit.
  function look(car) {
    if (car.id !== def().id) {   // a thumbnail of another car: only what it wears
      const parts = equippedParts();
      return { paint: paintOf({paint:equipped('paint'),paintColor:wallet.copiedPaint}), parts, cfg: renderConfig(parts), wheel: getWheel() };
    }
    const parts = partsWith(hover && PART_KINDS.has(hover[0]) ? { [hover[0]]:hover[1] } : {});
    return { paint: paintOf({paint:hover?.[0]==='paint'?hover[1]:current('paint'),paintColor:hover?.[0]==='paint'?null:wallet.copiedPaint}), parts, cfg: renderConfig(parts), wheel: hover?.[0]==='wheel'?hover[1]:current('wheel') };
  }

  function renderStats() {
    const preview = hover ? tuneWith(...hover) : null;
    renderStatBars($('shop-stats'), baseTune(), preview, VESSEL_STAT_LABELS[vehicle]);
    $('shop-title').textContent = {car:loc('Tu carro'),boat:loc('Tu lancha'),air:loc('Tu avioneta')}[vehicle];
    $('loadout-name').textContent = vehicle === 'car' ? def().name : vesselById(vehicle,current(vehicle)).name;
    $('loadout-count').textContent = vehicle === 'car' ? cars.length : VESSEL_DEFS[vehicle].length;
    $('shop-level').innerHTML = badge(nivelOf(baseTune())) + (preview ? ' → ' + badge(nivelOf(preview)) : '');
    const nextBand=bandOf(nivelOf(baseTune())).letter;if(lastBand&&nextBand!==lastBand)$('shop-level').animate([{transform:'scale(1)'},{transform:'scale(1.2)'},{transform:'scale(1)'}],{duration:350});lastBand=nextBand;
  }

  function equip(kind, id) {
    const car = def();
    if (vesselSlot(kind)) {
      const key = vehicle + 'Parts'; wallet[key] ??= {};
      wallet[key][current(vehicle)] = { ...(wallet[key][current(vehicle)] ?? {}), [kind]: id };
    } else if (kind === 'paint') { wallet.paint[car.id] = id; wallet.copiedPaint = null; }
    else if (kind === 'wheel') setWheel(id);
    else if (PART_KINDS.has(kind)) {
      const parts = wallet.parts[car.id] ?? {};
      if (id === 'fabrica') delete parts[kind]; else parts[kind] = id;
      if (Object.keys(parts).length) wallet.parts[car.id] = parts; else delete wallet.parts[car.id];
    } else wallet[kind] = id;
  }

  function selectBody(index) {
    const from = def(), next = cars[(index + cars.length) % cars.length];
    // An explicit factory paint also marks a visited, intentionally stock car.
    wallet.paint[from.id] ??= 'fabrica';
    if (!Object.hasOwn(wallet.paint, next.id) && !Object.hasOwn(wallet.parts, next.id)) {
      wallet.parts[next.id] = { ...equippedParts() };
      wallet.paint[next.id] = wallet.paint[from.id];
    }
    selectCar(cars.indexOf(next)); save();
  }
  function pick(kind, item) {
    hover = null;
    if (kind === 'car') { selectBody(cars.indexOf(item)); render(); return; }
    if (!buy(wallet,kind,item.id,trophies())) { $('loadout-message').textContent = loc('Te faltan {mangos}', { mangos: mangos(Math.max(0,item.cost-wallet.coins)) }); return; }
    equip(kind,item.id); save(); sound.pickup(); $('loadout-message').textContent='';
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
    b.disabled = !open;
    const tag = !open ? `<small>${esc(unlockText(item))}</small>`
      : isEquipped ? `<em class="tag">${isCar ? loc('Tu carro') : loc('Equipado')}</em>` : have ? (isCar ? '' : '<em class="tag">Tuyo</em>')
        : `<em class="price" aria-label="${mangos(item.cost)}">${MANGO}${item.cost}</em>`;
    const color = kind === 'paint' ? item.color ?? def().color : kind === 'flame' ? `linear-gradient(90deg,${item.colors.map(c=>'#'+c.toString(16).padStart(6,'0')).join(',')})`
      : kind === 'acento' || kind === 'rin' ? item.color ?? '#8a8496' : isCar ? item.color : null;
    const after = tuneWith(kind, item.id);
    // pills compare against what this slot holds now, so a downgrade reads as one
    const pills = !isCar && after && !isEquipped ? statPills(tuneWith(kind, equipped(kind)), after).map(p => `<span class="pill ${p.label === loc('Peso') ? 'peso' : p.delta > 0 ? 'up' : 'down'}">${p.delta > 0 ? '+' : ''}${p.delta} ${p.label}</span>`).join('') : '';
    const blurb = isCar || SWATCHES.has(kind) ? '' : item.blurb;
    b.innerHTML = `${color ? `<span class="swatch" style="--swatch:${color}"></span>` : ''}<span class="shop-text"><b>${isCar ? `${item.num} · ` : ''}${esc(item.name)}</b>${blurb ? `<small>${esc(blurb)}</small>` : ''}${pills ? `<span class="pills">${pills}</span>` : ''}${tag}</span>`;
    if(isCar) { const thumb=carThumbnail(cars.indexOf(item)); if(thumb) b.prepend(thumb); const chip=document.createElement('span');chip.innerHTML=badge(carNivel(item,current('wheel'),equippedParts())); b.append(chip); }
    if (SWATCHES.has(kind)) b.title = item.name;
    const enter = () => { hover = [kind,item.id]; renderStats(); if(kind==='car') previewCar(cars.indexOf(item)); else if(vehicle!=='car') showVessel(); else if(VISUAL.has(kind)) refreshCar(); };
    const leave = () => { if (hover?.[0] === kind && hover[1] === item.id) { hover = null; renderStats(); refreshCar(); showVessel(); } };
    b.addEventListener('pointerenter', enter); b.addEventListener('focus', enter);
    b.addEventListener('pointerleave', leave); b.addEventListener('blur', leave);
    b.onclick = () => pick(kind, item);
    return b;
  }

  function render() {
    $('shop-coins').textContent = wallet.coins;
    $('shop').classList.toggle('has-wishlist',!!wishlist);$('loadout-message').textContent=wishlist?loc('Kit de {name}: las piezas marcadas te faltan en el taller.', { name: wishlist.name }):'';
    renderSlots();
    const use=trackPieces(getTrack());
    for(const b of $('loadout-vehicles').querySelectorAll('button')) { b.classList.toggle('unused',!use.includes(b.dataset.vehicle)); b.title=use.includes(b.dataset.vehicle)?loc('Se usa en esta pista'):loc('No se usa en esta pista'); }
    $('shop').classList.toggle('focus',drawer); document.body.classList.toggle('loadout-focus',drawer);
    $('loadout-drawer-title').textContent = tabs().find(t=>t.id===tab)?.label || loc('Garaje');
    $('shop').classList.toggle('drawer-open', drawer);
    for (const b of $('shop-tabs').querySelectorAll('button')) b.setAttribute('aria-selected', String(drawer && b.dataset.tab === tab));
    const body = $('shop-body');
    body.replaceChildren(...tabs().find(t => t.id === tab).kinds.map(kind => {
      const group = document.createElement('section');
      group.className = 'shop-group'; group.dataset.kind = kind;
      const h = document.createElement('h3'); h.textContent = TITLES[kind] ?? VESSEL_SLOTS[vehicle]?.find(s => s.id === kind)?.name ?? (vehicle === 'boat' ? loc('Lanchas') : loc('Avionetas'));
      const grid = document.createElement('div');
      grid.className = SWATCHES.has(kind) ? 'shop-grid shop-swatches' : 'shop-grid'; grid.id = `shop-${kind}`;
      grid.append(...items(kind).map(item => card(kind, item)));
      group.append(h, grid);
      return group;
    }));
    renderStats();
    optionPages.update(`${vehicle}:${tab}`);
  }

  function showVessel() { previewVessel(vehicle, hover?.[0]===vehicle?hover[1]:current(vehicle), paintOf({paint:hover?.[0]==='paint'?hover[1]:current('paint'),paintColor:hover?.[0]==='paint'?null:wallet.copiedPaint},def().color)); }
  function setTab(id) { tab=id;drawer=true;hover=null;render();if(!$('loadout-drawer').open)$('loadout-drawer').showModal();$('shop-body').scrollTop=0;onTab(vehicle==='car'?tab:'carro');showVessel(); }
  function renderSlots() {
    const iconFor={motor:'kitMotor',ruedas:'kitWheel',aleron:'kitSpoiler',extras:'plus',pintura:'kitPaint',sonido:'kitHorn',casco:'kitHull',fueraborda:'kitMotor',helice:'kitProp',alas:'kitWing',aspas:'kitProp'};
    const list=tabs().filter(t=>t.id!=='carro'); if(vehicle==='car') [list[0],list[1]]=[list[1],list[0]];
    const make=t=>{
      const b=document.createElement('button');b.type='button';b.className='tl-slot sk';b.setAttribute('role','tab');b.dataset.tab=t.id;
      b.setAttribute('aria-expanded',String(drawer && t.id===tab));
      const names=[...new Set(t.kinds.map(k=>(items(k)??[]).find(i=>i.id===current(k))?.name).filter(Boolean))].filter(n=>n!==loc('De fábrica'));
      const empty=!names.length && ['aleron','extras'].includes(t.id),label=t.id==='ruedas'&&current('wheel')==='calle'?loc('De fábrica'):t.id==='sonido'&&current('horn')==='propio'?loc('Pito normal'):empty?(t.id==='aleron'?loc('Sin alerón'):loc('Ninguno')):names.join(' · ')||loc('De fábrica');
      b.classList.toggle('empty',empty);b.innerHTML=`<small>${esc(t.label)}</small><span class="ic">${ICONS[empty?'plus':iconFor[t.id]]||ICONS.plus}</span><b>${esc(label)}</b>`;
      b.onclick=()=>setTab(t.id);return b;
    };
    const divider=document.createElement('span');divider.className='tl-div';const style=document.createElement('div');style.className='tl-sty';style.append(...list.slice(-2).map(make));
    $('shop-tabs').replaceChildren(...list.slice(0,-2).map(make),divider,style);
    const footer=document.querySelector('.menu-footer');
    if(footer) { let summary=$('loadout-kit');if(!summary){summary=document.createElement('div');summary.id='loadout-kit';footer.insertBefore(summary,$('play'));}
      const pieces={car:carNivel(def(),getWheel(),equippedParts()),boat:vesselNivel('boat',wallet.boat,wallet.boatParts?.[wallet.boat]),air:vesselNivel('air',wallet.air,wallet.airParts?.[wallet.air])};
      summary.innerHTML=loc('Tu kit para esta carrera')+' '+badge(kitNivel(pieces,trackPieces(getTrack())));
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
    vehicle = b.dataset.vehicle; tab = 'carro'; drawer = false;
    for (const other of $('loadout-vehicles').querySelectorAll('button')) other.setAttribute('aria-pressed', String(other === b));
    render(); refreshCar(); showVessel(); onTab('carro');
  };
  const quoteKit = (c, kind = null) => quoteBuild(wallet, c, kind);
  return {
    look, render, renderStats, quoteKit, get balance() { return wallet.coins; },
    recommend(c,kind=null){wishlist={name:c.name,scope:kind,entries:kitEntries(c,kind)};try{localStorage.setItem('carreritas:wishlist',JSON.stringify(wishlist));}catch{}return quoteKit(c,kind);},
    copyColors(c){const id=c.cosmetics?.paint??'fabrica';if(!buy(wallet,'paint',id,trophies()))return false;wallet.copiedPaint=paintOf(c.cosmetics,c.def.color);for(const car of cars)wallet.paint[car.id]=id;save();return true;},
    get tab() { return tab; },
    open(kind) { if (kind) setTab(tabs().find(t => t.kinds.includes(kind))?.id ?? tab); else { drawer = false; render(); showVessel(); } },
    close() { if($('loadout-drawer').open)$('loadout-drawer').close(); hover = null; vehicle = 'car'; tab = 'carro'; drawer = false; for(const b of $('loadout-vehicles').querySelectorAll('button')) b.setAttribute('aria-pressed',String(b.dataset.vehicle==='car')); previewVessel('car'); },
  };
}

// Keep every choice reachable without a horizontal strip or nested scrollbar.
function createOptionPages(dialog) {
  const body = dialog.querySelector('.shop-body');
  const categories = document.createElement('nav');
  categories.className = 'option-categories';
  categories.setAttribute('aria-label', loc('Categorías de piezas'));
  body.before(categories);
  const pager = document.createElement('nav');
  pager.className = 'option-pages';
  pager.setAttribute('aria-label', loc('Páginas de opciones'));
  const previous = document.createElement('button'), next = document.createElement('button'), status = document.createElement('span');
  previous.type = next.type = 'button';
  previous.textContent = loc('Anterior'); next.textContent = loc('Siguiente');
  previous.dataset.page = 'previous'; next.dataset.page = 'next';
  status.setAttribute('aria-live', 'polite');
  pager.append(previous, status, next); body.after(pager);
  let key = '', kind = '', page = 0;
  function layout() {
    const groups = [...body.children];
    const active = groups.find(group => group.dataset.kind === kind) || groups[0];
    if (!active) return;
    kind = active.dataset.kind;
    const width = dialog.clientWidth || innerWidth - 48;
    const columns = Math.max(1, Math.min(6, Math.floor((width - 32) / 210)));
    const rows = kind === 'car' || active.querySelector('.shop-swatches') ? 1 : innerHeight >= 850 ? 2 : 1;
    const size = columns * rows;
    const cards = [...active.querySelectorAll('.shop-item')];
    const pages = Math.ceil(cards.length / size);
    page = Math.max(0, Math.min(page, pages - 1));
    for (const group of groups) group.hidden = group !== active;
    for (const [index, card] of cards.entries()) card.hidden = Math.floor(index / size) !== page;
    active.querySelector('.shop-grid').style.setProperty('--option-columns', Math.min(columns, cards.length));
    for (const button of categories.children) button.setAttribute('aria-pressed', String(button.dataset.kind === kind));
    status.textContent = `${page + 1} / ${pages}`;
    previous.disabled = page === 0; next.disabled = page === pages - 1;
    pager.hidden = pages <= 1;
  }
  function turn(delta) {
    // A hovered/focused model must not survive after its card leaves the page.
    const active = body.querySelector('.shop-group:not([hidden])');
    active?.querySelectorAll('.shop-item:not([hidden])').forEach(card => card.dispatchEvent(new Event('pointerleave')));
    page += delta; layout();
  }
  previous.onclick = () => turn(-1); next.onclick = () => turn(1);
  new ResizeObserver(layout).observe(dialog);
  return {
    update(nextKey) {
      if (key !== nextKey) { key = nextKey; kind = ''; page = 0; }
      categories.replaceChildren(...[...body.children].map(group => {
        const button = document.createElement('button'); button.type = 'button';
        button.textContent = group.querySelector('h3').textContent; button.dataset.kind = group.dataset.kind;
        button.onclick = () => { kind = group.dataset.kind; page = 0; layout(); };
        return button;
      }));
      categories.hidden = body.children.length <= 1;
      layout();
    },
  };
}
