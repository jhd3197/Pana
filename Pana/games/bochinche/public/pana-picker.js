// Elige tu pana: the roster screen opened from the sala. Picks are personal,
// so they go to the room as the 'pana' action and are remembered per viewer.
import { cachedPortrait } from '/engine/portrait-cache.js';
import { loc } from '/engine/i18n.js';
import { PANAS, panaById, poderStats } from './panas.js';
import { costumeAvatar, SEAT_COLORS } from './costume.js';

const SAVED = 'bochinche:pana';
export function savedPana() {
  try { const v = JSON.parse(localStorage.getItem(SAVED)); return PANAS.some(p => p.id === v?.pana) && [0, 1, 2].includes(v.traje) ? v : null; } catch { return null; }
}
const el = (tag, className, parent) => { const n = document.createElement(tag); if (className) n.className = className; parent?.append(n); return n; };
function showPortrait(img, avatar) {
  const key = JSON.stringify(avatar); img.dataset.key = key;
  const hit = cachedPortrait(avatar);
  if (hit) { img.src = hit; return; }
  import('/engine/portrait.js').then(({ portrait }) => portrait(avatar)).then(src => { if (img.dataset.key === key) img.src = src; }).catch(() => {});
}

export function createPanaPicker({ avatar, pick }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const root = el('section', 'boch-pick', document.body);
  root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'boch-pick-title');
  root.innerHTML = `<header class="boch-pick-top"><button type="button" class="boch-chip" data-close>${loc('Volver a la sala')}</button><h2 id="boch-pick-title" class="boch-plate">${loc('Elige tu pana')}</h2></header>
    <article class="boch-prev"><div class="boch-art"><span class="boch-key"></span><img alt=""></div><div class="boch-info"><small translate="no"></small><b></b><p></p>
    <div class="boch-fx"><span>${loc('Lo deja')}</span><em></em></div><div class="boch-stats"></div><div class="boch-trajes"><span>${loc('Traje')}</span></div></div></article>
    <div class="boch-grid" role="listbox" aria-label="${loc('Panas')}"></div>
    <footer class="boch-go"><button type="button" class="boch-chip" data-random>${loc('¡Sorpréndeme!')} <kbd>R</kbd></button><button type="button" class="boch-ok" data-ok>${loc('¡Listo!')} <kbd>Enter</kbd></button></footer>`;
  const $ = s => root.querySelector(s), art = $('.boch-art'), grid = $('.boch-grid'), trajes = $('.boch-trajes');
  const tiles = PANAS.map(p => {
    const b = el('button', 'boch-tile', grid); b.type = 'button'; b.dataset.pana = p.id; b.setAttribute('role', 'option');
    b.style.setProperty('--c', p.color);
    b.innerHTML = `<img alt=""><span class="nm"></span><span class="k">${p.key}</span><span class="tags"></span>`;
    b.querySelector('.nm').textContent = loc(p.poder);
    b.setAttribute('aria-label', loc('{who}, poder {poder}', { who: p.who, poder: loc(p.poder) }));
    return b;
  });
  const swatches = [0, 1, 2].map(i => { const b = el('button', 'boch-swatch', trajes); b.type = 'button'; b.dataset.traje = i; b.setAttribute('aria-label', loc('Traje {n}', { n: i + 1 })); return b; });
  let current = { pana: PANAS[0].id, traje: 0 }, others = [], spinning = 0;

  function render(pop = false) {
    const p = panaById(current.pana), color = p.trajes[current.traje];
    root.style.setProperty('--pc', color);
    $('.boch-key').textContent = p.key;
    showPortrait(art.querySelector('img'), costumeAvatar(avatar(), p.id, current.traje));
    if (pop && !reduced.matches) { art.classList.remove('is-pop'); void art.offsetWidth; art.classList.add('is-pop'); }
    $('.boch-info small').textContent = p.who.toUpperCase();
    $('.boch-info b').textContent = loc(p.poder); $('.boch-info p').textContent = loc(p.desc);
    $('.boch-fx em').textContent = loc(p.fx);
    $('.boch-stats').replaceChildren(...poderStats(p.id).map(([label, value]) => {
      const row = el('span'); el('i', '', row).textContent = loc(label);
      const segs = el('span', 'segs', row); for (let n = 1; n <= 5; n++) el('i', n <= value ? 'on' : '', segs);
      return row;
    }));
    swatches.forEach((b, i) => { b.style.setProperty('--s', p.trajes[i]); b.setAttribute('aria-pressed', String(i === current.traje)); });
    tiles.forEach(b => {
      const mine = b.dataset.pana === current.pana; b.classList.toggle('on', mine); b.setAttribute('aria-selected', String(mine));
      const tags = b.querySelector('.tags'); tags.replaceChildren();
      if (mine) { const t = el('i', 'cur', tags); t.textContent = loc('Tú'); }
      for (const o of others.filter(o => o.pana === b.dataset.pana)) { const t = el('i', '', tags); t.textContent = o.label; t.style.setProperty('--c', o.color); }
    });
  }
  function choose(id, traje = 0, pop = true) { current = { pana: id, traje }; render(pop); }
  function confirm() {
    try { localStorage.setItem(SAVED, JSON.stringify(current)); } catch {}
    pick(current.pana, current.traje); close();
  }
  function random() {
    if (spinning) return;
    let n = 0; const total = reduced.matches ? 1 : 12;
    const step = () => { choose(PANAS[Math.floor(Math.random() * PANAS.length)].id, 0, n + 1 === total); n++; spinning = n < total ? setTimeout(step, 50 + n * 12) : 0; };
    step();
  }
  const keys = e => {
    if (root.hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toUpperCase(), p = PANAS.find(p => p.key === k);
    const tile = e.target.closest?.('.boch-tile');
    if (p) { choose(p.id); tiles.find(b => b.dataset.pana === p.id)?.focus(); }
    else if (k === 'R') random();
    // Enter locks in: the focused tile if there is one, else the current pick.
    else if (e.key === 'Enter' && (tile || !e.target.closest?.('button'))) { if (tile) current = { pana: tile.dataset.pana, traje: tile.dataset.pana === current.pana ? current.traje : 0 }; confirm(); }
    else return;
    e.preventDefault(); e.stopPropagation();
  };
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pana) choose(b.dataset.pana);
    else if (b.dataset.traje) { current.traje = Number(b.dataset.traje); render(); }
    else if (b.hasAttribute('data-random')) random();
    else if (b.hasAttribute('data-ok')) confirm();
    else if (b.hasAttribute('data-close')) close();
  });
  addEventListener('keydown', keys, true);
  let opener = null;
  function open(choice) {
    current = { pana: choice?.pana ?? PANAS[0].id, traje: choice?.traje ?? 0 };
    opener = document.activeElement; root.hidden = false; render(true);
    tiles.forEach(b => showPortrait(b.querySelector('img'), costumeAvatar(avatar(), b.dataset.pana, 0)));
    tiles.find(b => b.dataset.pana === current.pana)?.focus();
  }
  function close() { clearTimeout(spinning); spinning = 0; root.hidden = true; opener?.focus?.(); }
  return {
    open, close, get isOpen() { return !root.hidden; },
    // Other panas in the room: their pick shows as a tag on that tile.
    others(players, myId) {
      others = players.map((p, slot) => ({ pana: p.pana, label: p.bot ? 'BOT' : p.name.slice(0, 8), color: SEAT_COLORS[slot], id: p.id })).filter(o => o.id !== myId);
      if (!root.hidden) render();
    },
    dispose() { removeEventListener('keydown', keys, true); root.remove(); },
  };
}
