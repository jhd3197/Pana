// The taller (garage shop) UI, laid out like the Taller de Panas showroom:
// tabs of cards for the body, wheels, engine, spoiler, extras, paint and
// horn, priced in mangos (the wallet's coins). Hovering a card previews it on the five
// garage stat bars and its "+2 Vel" pills; clicking something you don't own
// puts it on the turntable car to try ("Probando …") until you buy it or
// take it off. Plain DOM: game.js owns the 3D car and the camera.
import { CATALOG, PAINTS, owns, unlocked, unlockText, trialCost, buyTrial } from './shop.js';
import { PART_SLOTS, STATS, partById, partsProfile, renderConfig, statPoints, statPills } from './parts.js';
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
export function renderStatBars(root, tune, preview = null) {
  if (!root) return;
  const a = statPoints(tune), b = preview ? statPoints(preview) : a;
  root.innerHTML = STATS.map(([name], k) => {
    const segs = Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.min(a[k], b[k]) ? 'on' : b[k] > a[k] && i < b[k] ? 'up' : b[k] < a[k] && i < a[k] ? 'down' : ''}"></i>`).join('');
    return `<div><dt>${name}</dt><dd>${segs}</dd><span class="n${b[k] > a[k] ? ' up' : b[k] < a[k] ? ' down' : ''}">${b[k]}</span></div>`;
  }).join('');
}

export function createTaller({ $, wallet, cars, getIndex, selectCar, getWheel, setWheel, trophies, save, refreshCar, onHorn, onTab, sound }) {
  let tab = 'carro', trial = {}, hover = null, trialCar = null;
  const def = () => cars[getIndex()];
  const equippedParts = (car = def()) => ({ ...(wallet.parts[car.id] ?? {}) });
  const equipped = (kind, car = def()) => kind === 'paint' ? wallet.paint[car.id] ?? 'fabrica'
    : kind === 'wheel' ? getWheel() : kind === 'car' ? car.id
      : PART_KINDS.has(kind) ? equippedParts(car)[kind] ?? 'fabrica' : wallet[kind];
  const current = (kind) => trial[kind] ?? equipped(kind);
  const partsWith = (extra = {}) => {
    const parts = equippedParts();
    for (const [kind, id] of Object.entries({ ...trial, ...extra })) if (PART_KINDS.has(kind)) parts[kind] = id;
    return parts;
  };
  const tuneFor = (car, wheel, parts) => composeTune(car.tune, wheelById(wheel).profile, partsProfile(parts));
  const baseTune = () => tuneFor(def(), current('wheel'), partsWith());
  // the tune with one item swapped in, for previews and pills
  const tuneWith = (kind, id) => kind === 'car' ? tuneFor(cars.find(c => c.id === id), current('wheel'), wallet.parts[id] ?? {})
    : kind === 'wheel' ? tuneFor(def(), id, partsWith())
      : PART_KINDS.has(kind) ? tuneFor(def(), current('wheel'), partsWith({ [kind]: id })) : null;

  // Trials belong to the selected car; picking another car drops them.
  const sync = () => { if (trialCar !== def().id) { trial = {}; hover = null; trialCar = def().id; } };
  // What the turntable shows for a car: equipped plus anything being tried.
  function look(car) {
    sync();
    if (car.id !== def().id) {   // a thumbnail of another car: only what it wears
      const parts = equippedParts(car);
      return { paint: PAINTS.find(p => p.id === equipped('paint', car))?.color ?? null, parts, cfg: renderConfig(parts), wheel: getWheel() };
    }
    const parts = partsWith();
    return { paint: PAINTS.find(p => p.id === current('paint'))?.color ?? null, parts, cfg: renderConfig(parts), wheel: current('wheel') };
  }

  function renderStats() {
    sync();
    const preview = hover ? tuneWith(...hover) : null;
    renderStatBars($('stats'), baseTune(), preview);
    renderStatBars($('shop-stats'), baseTune(), preview);
    renderBuild();
  }

  // The line under the car's name: what it wears (or tries) beyond stock.
  function renderBuild() {
    const build = $('car-build');
    if (!build) return;
    const wheel = current('wheel'), parts = partsWith();
    const names = [wheel !== 'calle' ? wheelById(wheel).name : null,
      ...PART_SLOTS.map(({ id }) => parts[id] && parts[id] !== 'fabrica' ? partById(id, parts[id])?.name : null)].filter(Boolean);
    build.textContent = names.length ? names.join(' · ') : 'De fábrica';
  }

  function equip(kind, id) {
    const car = def();
    if (kind === 'paint') wallet.paint[car.id] = id;
    else if (kind === 'wheel') setWheel(id);
    else if (PART_KINDS.has(kind)) {
      const parts = wallet.parts[car.id] ?? {};
      if (id === 'fabrica') delete parts[kind]; else parts[kind] = id;
      if (Object.keys(parts).length) wallet.parts[car.id] = parts; else delete wallet.parts[car.id];
    } else wallet[kind] = id;
  }

  function pick(kind, item) {
    hover = null;
    if (kind === 'car') { selectCar(cars.indexOf(item)); render(); return; }
    if (owns(wallet, kind, item.id)) {
      delete trial[kind];
      equip(kind, item.id);
      save();
      sound.pickup();
    } else if (trial[kind] === item.id) delete trial[kind];
    else trial[kind] = item.id;
    render();
    if (VISUAL.has(kind)) refreshCar();
    if (kind === 'horn') onHorn(current('horn'));
  }

  const items = (kind) => kind === 'car' ? cars : CATALOG[kind];
  function card(kind, item) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = SWATCHES.has(kind) ? 'shop-item shop-swatch' : 'shop-item';
    b.dataset.kind = kind; b.dataset.id = item.id;
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
    if (SWATCHES.has(kind)) b.title = item.name;
    const enter = () => { if (!after) return; hover = [kind, item.id]; renderStats(); };
    const leave = () => { if (hover?.[0] === kind && hover[1] === item.id) { hover = null; renderStats(); } };
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
    for (const b of $('shop-tabs').children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    const body = $('shop-body'), scroll = body.scrollTop;
    body.replaceChildren(...TABS.find(t => t.id === tab).kinds.map(kind => {
      const group = document.createElement('section');
      group.className = 'shop-group';
      const h = document.createElement('h3'); h.textContent = TITLES[kind];
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

  function setTab(id) { tab = id; hover = null; render(); $('shop-body').scrollTop = 0; onTab(tab); }
  $('shop-tabs').replaceChildren(...TABS.map(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = t.id; b.textContent = t.label;
    b.onclick = () => setTab(t.id);
    return b;
  }));
  $('shop-buy').onclick = () => {
    const list = Object.entries(trial);
    if (!buyTrial(wallet, list, trophies())) return;
    trial = {};
    for (const [kind, id] of list) equip(kind, id);
    save();
    sound.pickup();
    render();
    refreshCar();
  };
  $('shop-untry').onclick = () => { trial = {}; render(); refreshCar(); };

  return {
    look, render, renderStats,
    get tab() { return tab; },
    open(kind) { setTab(kind ? TABS.find(t => t.kinds.includes(kind))?.id ?? tab : tab); },
    // try an item from outside the taller (an unowned caucho in the strip)
    tryItem(kind, id) { sync(); trial[kind] = id; render(); refreshCar(); },
    // Leaving the taller takes off whatever was only being tried.
    close() { const had = Object.keys(trial).length; trial = {}; hover = null; if (had) refreshCar(); },
  };
}
