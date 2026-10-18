// The taller (garage shop) UI: tabs of cards for paint, parts, horns and
// flames; hovering a card previews its stats on the garage bars; clicking an
// item you don't own puts it on the turntable car to try ("Probando …")
// until you buy it or take it off. Plain DOM; game.js owns the 3D car.
import { CATALOG, PAINTS, FLAMES, owns, unlocked, unlockText, trialCost, buyTrial } from './shop.js';
import { PART_SLOTS, partById, partPills, partsProfile, renderConfig } from './parts.js';
import { composeTune } from './wheel-definitions.js';

const TABS = [
  { id: 'rendimiento', label: 'Rendimiento', kinds: ['motor', 'aleron', 'techo'] },
  { id: 'estilo', label: 'Estilo', kinds: ['paint', 'acabado', 'rin', 'calcomania', 'franjas'] },
  { id: 'sonido', label: 'Corneta y turbo', kinds: ['horn', 'flame'] },
];
const TITLES = { paint: 'Pintura', horn: 'Corneta', flame: 'Llama del turbo', ...Object.fromEntries(PART_SLOTS.map(s => [s.id, s.name])) };
const PART_KINDS = new Set(PART_SLOTS.map(s => s.id));
const esc = (text) => String(text).replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Bars sit on the range the roster actually spans, so a 2–6% part shows.
export const STAT_BARS = [
  ['Velocidad', t => (t.top - 31) / 10],
  ['Aceleración', t => (t.accel - 14) / 17],
  ['Manejo', t => (Math.sqrt(t.turn * t.grip) - 2.4) / 2.6],
  ['Peso', t => (t.mass - 0.5) / 1.2],
];
const bar = v => Math.max(0.04, Math.min(1, v));

// Paint the #stats bars for a tune, with an optional preview tune: gains show
// as a green extension, losses as a red outline over what you'd give up.
export function renderStatBars(root, tune, preview = null) {
  root.innerHTML = STAT_BARS.map(([name, f]) => {
    const a = bar(f(tune)), b = preview ? bar(f(preview)) : a, lo = Math.min(a, b), d = Math.abs(b - a);
    const delta = d > 0.004 ? `<s class="${b > a ? 'gain' : 'loss'}" style="left:${(lo * 100).toFixed(1)}%;width:${(d * 100).toFixed(1)}%"></s>` : '';
    return `<div><dt>${name}</dt><dd><i style="width:${Math.round(lo * 100)}%"></i>${delta}</dd></div>`;
  }).join('');
}

export function createTaller({ $, wallet, getDef, wheelProfile, trophies, save, refreshCar, onHorn, sound }) {
  let tab = 'rendimiento', trial = {}, hover = null, trialCar = null;
  const def = () => getDef();
  const equippedParts = (car = def()) => ({ ...(wallet.parts[car.id] ?? {}) });
  const equipped = (kind, car = def()) => kind === 'paint' ? wallet.paint[car.id] ?? 'fabrica'
    : PART_KINDS.has(kind) ? equippedParts(car)[kind] ?? 'fabrica' : wallet[kind];
  const current = (kind) => trial[kind] ?? equipped(kind);
  const partsWith = (extra = {}) => {
    const parts = equippedParts();
    for (const [kind, id] of Object.entries({ ...trial, ...extra })) if (PART_KINDS.has(kind)) parts[kind] = id;
    return parts;
  };
  const tuneFor = (parts) => composeTune(def().tune, wheelProfile(), partsProfile(parts));

  // What the turntable shows for a car: equipped plus anything being tried.
  // Trials belong to the selected car; picking another car drops them.
  const sync = () => { if (trialCar !== def().id) { trial = {}; hover = null; trialCar = def().id; } };
  function look(car) {
    sync();
    if (car.id !== def().id) {   // a thumbnail of another car: only what it wears
      const parts = equippedParts(car);
      return { paint: PAINTS.find(p => p.id === equipped('paint', car))?.color ?? null, parts, cfg: renderConfig(parts) };
    }
    const parts = partsWith();
    return {
      paint: PAINTS.find(p => p.id === current('paint'))?.color ?? null,
      parts, cfg: renderConfig(parts),
    };
  }

  function renderStats() {
    sync();
    const base = tuneFor(partsWith());
    const preview = hover && PART_KINDS.has(hover[0]) ? tuneFor(partsWith({ [hover[0]]: hover[1] })) : null;
    renderStatBars($('stats'), base, preview);
  }

  function equip(kind, id) {
    const car = def();
    if (kind === 'paint') wallet.paint[car.id] = id;
    else if (PART_KINDS.has(kind)) {
      const parts = wallet.parts[car.id] ?? {};
      if (id === 'fabrica') delete parts[kind]; else parts[kind] = id;
      if (Object.keys(parts).length) wallet.parts[car.id] = parts; else delete wallet.parts[car.id];
    } else wallet[kind] = id;
  }

  function pick(kind, item) {
    const visual = kind === 'paint' || PART_KINDS.has(kind);
    if (owns(wallet, kind, item.id)) {
      equip(kind, item.id);
      delete trial[kind];
      save();
      sound.pickup();
    } else if (trial[kind] === item.id) delete trial[kind];
    else trial[kind] = item.id;
    hover = null;
    render();
    if (visual) refreshCar();
    if (kind === 'horn') onHorn(current('horn'));
  }

  function card(kind, item) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'shop-item';
    b.dataset.kind = kind; b.dataset.id = item.id;
    const have = owns(wallet, kind, item.id), open = unlocked(item, trophies()), on = current(kind) === item.id;
    const isEquipped = equipped(kind) === item.id;
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('trying', on && !have);
    b.disabled = !open;
    const tag = !open ? `<small>${esc(unlockText(item))}</small>`
      : isEquipped ? '<em class="tag">Equipado</em>' : have ? '<em class="tag">Tuyo</em>'
        : `<em class="price">${item.cost} monedas</em>`;
    const swatch = kind === 'paint' ? item.color ?? def().color : kind === 'flame' ? '#' + item.colors[0].toString(16).padStart(6, '0') : null;
    const pills = PART_KINDS.has(kind) ? partPills(item).map(p => `<span class="pill ${p.label === 'Peso' ? 'peso' : p.pct > 0 ? 'up' : 'down'}">${p.pct > 0 ? '+' : ''}${p.pct}% ${p.label}</span>`).join('') : '';
    b.innerHTML = `${swatch ? `<span class="swatch" style="--swatch:${swatch}"></span>` : ''}<span class="shop-text"><b>${esc(item.name)}</b>${item.blurb ? `<small>${esc(item.blurb)}</small>` : ''}${pills ? `<span class="pills">${pills}</span>` : ''}${tag}</span>`;
    const enter = () => { hover = [kind, item.id]; renderStats(); };
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
    const names = missing.map(([kind, id]) => (kind === 'paint' || !PART_KINDS.has(kind) ? CATALOG[kind].find(i => i.id === id) : partById(kind, id))?.name).join(', ');
    $('shop-try-text').innerHTML = `Probando <b>${esc(names)}</b>`;
    const buy = $('shop-buy');
    buy.disabled = short > 0;
    buy.textContent = short > 0 ? `Te faltan ${short} monedas` : `Comprar · ${cost} monedas`;
  }

  function render() {
    const car = def();
    $('shop-title').textContent = `Personaliza ${car.name}`;
    $('shop-coins').textContent = wallet.coins;
    for (const b of $('shop-tabs').children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    const body = $('shop-body'), scroll = $('shop').scrollTop;
    body.replaceChildren(...TABS.find(t => t.id === tab).kinds.map(kind => {
      const group = document.createElement('section');
      group.className = 'shop-group';
      const h = document.createElement('h3'); h.textContent = TITLES[kind];
      const grid = document.createElement('div');
      grid.className = 'shop-grid'; grid.id = `shop-${kind}`;
      grid.append(...CATALOG[kind].map(item => card(kind, item)));
      group.append(h, grid);
      return group;
    }));
    renderTry();
    renderStats();
    $('shop').scrollTop = scroll;
  }

  $('shop-tabs').replaceChildren(...TABS.map(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = t.id; b.textContent = t.label;
    b.onclick = () => { tab = t.id; hover = null; render(); };
    return b;
  }));
  $('shop-buy').onclick = () => {
    const list = Object.entries(trial);
    if (!buyTrial(wallet, list, trophies())) return;
    for (const [kind, id] of list) equip(kind, id);
    trial = {};
    save();
    sound.pickup();
    render();
    refreshCar();
  };
  $('shop-untry').onclick = () => { trial = {}; render(); refreshCar(); };

  return {
    look, render, renderStats,
    open(kind) { if (kind) tab = TABS.find(t => t.kinds.includes(kind))?.id ?? tab; render(); },
    // Leaving the taller takes off whatever was only being tried.
    close() { const had = Object.keys(trial).length; trial = {}; hover = null; if (had) refreshCar(); },
    flameColors: (id) => FLAMES.find(f => f.id === id)?.colors ?? FLAMES[0].colors,
  };
}
