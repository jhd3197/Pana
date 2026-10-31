// The Banderín fight HUD: plates (clásico, esquinas or mínimo), the clock,
// slam banners, hit pops, item calls and off-screen bubbles. DOM is built
// once; names go through textContent. Events are consumed once per frame.
import { cachedPortrait } from '/engine/portrait-cache.js';
import { attackTheme } from './artifact-attacks.js';
import { STYLE_NAMES } from './rules.js';
import { panaById } from './panas.js';
import { playerCostume, SEAT_COLORS } from './costume.js';
import { loc, locn, locKey } from '/engine/i18n.js';

export const HUD_LAYOUTS = [['clasico', locKey('Clásico')], ['esquinas', locKey('Esquinas')], ['minimo', locKey('Mínimo')]];
export const damageTier = v => v < 50 ? 'low' : v < 100 ? 'medium' : v < 150 ? 'high' : 'max';
const svg = path => `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
export const STYLE_ICONS = [
  svg('<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'),
  svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>'),
  svg('<path d="M2 9h3v6H2zM19 9h3v6h-3zM5 7h3v10H5zM16 7h3v10h-3zM8 11h8v2H8z" fill="currentColor"/>'),
];
export const STYLE_COLORS = ['#ff9a1f', '#2ad1b2', '#c45bff'];
const ITEM_NAMES = {
  'vitality-fruit': locKey('Fruta de vida'), 'med-kit': locKey('Botiquín'), 'power-orb': locKey('Orbe de fuerza'),
  'wind-boots': locKey('Botas de viento'), 'iron-ward': locKey('Coraza de hierro'), 'nova-star': locKey('Estrella'),
  'plasma-blade': locKey('Espada de plasma'), 'power-bat': locKey('Bate de poder'), 'pulse-blaster': locKey('Pistola de pulsos'),
  'flame-sprayer': locKey('Lanzallamas'), 'blast-core': locKey('Bomba'), 'ricochet-disc': locKey('Disco rebotón'),
  'slick-gel': locKey('Gel resbaloso'), 'proximity-mine': locKey('Mina'), 'rebound-pad': locKey('Trampolín'),
  'snare-trap': locKey('Trampa'), 'shock-seed': locKey('Semilla eléctrica'), 'smoke-bomb': locKey('Bomba de humo'),
  'reflector-charm': locKey('Amuleto reflector'), 'time-dilator': locKey('Reloj lento'),
};
const el = (tag, className, parent) => { const n = document.createElement(tag); if (className) n.className = className; parent?.append(n); return n; };

export function createFightHud({ hud = document.getElementById('hud'), screenOf = () => null } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fx = el('div', 'hud-fx', hud), flash = el('div', 'hud-flash', fx), item = el('div', 'hud-item', fx);
  item.hidden = true;
  const bubbles = [], tags = [];
  const rows = [0, 1, 2, 3, 4, 5].map(i => {
    const root = document.getElementById('fighter-' + i);
    root.style.setProperty('--c', SEAT_COLORS[i]);
    root.innerHTML = '<span class="av"><img class="fighter-portrait" alt=""><em class="bot-tag" hidden>BOT</em><em class="poder"></em></span><span class="pt"><b class="damage">0<small>%</small></b><span class="nm"><span class="fighter-name" translate="no"></span><i class="fighter-style"></i></span><span class="pips"><span class="stocks"></span><span class="shield-track"><span></span></span></span></span>';
    const bubble = el('div', 'hud-bubble', fx); bubble.hidden = true; bubble.innerHTML = '<img alt=""><small></small><i></i>'; bubble.style.setProperty('--c', SEAT_COLORS[i]); bubbles.push(bubble);
    const tag = el('div', 'hud-tag', fx); tag.hidden = true; tag.innerHTML = '<b></b><span></span>'; tag.style.setProperty('--c', SEAT_COLORS[i]); tags.push(tag);
    return { root, portrait: root.querySelector('.fighter-portrait'), portraitKey: null, bot: root.querySelector('.bot-tag'), poder: root.querySelector('.poder'),
      name: root.querySelector('.fighter-name'), style: root.querySelector('.fighter-style'), damage: root.querySelector('.damage'),
      stocks: root.querySelector('.stocks'), shield: root.querySelector('.shield-track span'), percent: 0, styleKey: '' };
  });
  const timerLabel = document.getElementById('timer-label');
  let round = -1, frame = -1, count = 0, lastMinute = false, state = null, itemTimer = 0;
  const restart = node => { node.classList.remove('is-on'); void node.offsetWidth; node.classList.add('is-on'); };
  function banner(main, sub = '', color = '', { big = false, ms = 1500 } = {}) {
    fx.querySelectorAll('.hud-banner').forEach(n => n.remove());
    const b = el('div', 'hud-banner' + (big ? ' is-count' : ''), fx);
    if (color) b.style.setProperty('--bc', color);
    el('b', 'm', b).textContent = main;
    if (sub) { const s = el('span', 's', b); s.textContent = sub; s.translate = false; }
    setTimeout(() => b.remove(), reduced.matches ? Math.min(ms, 900) : ms);
  }
  function pop(slot, damage, poder) {
    const at = screenOf(slot); if (!at?.inside) return;
    const p = el('div', 'hud-pop', fx); p.style.left = at.x + 'px'; p.style.top = at.y + 'px';
    p.dataset.danger = damageTier(state.fight.fighters[slot]?.percent ?? 0);
    if (poder) { const n = el('small', '', p); n.textContent = loc('¡{move}!', { move: loc(poder.name) }); n.style.color = poder.color; }
    el('b', '', p).textContent = '+' + Math.round(damage) + '%';
    setTimeout(() => p.remove(), 950);
  }
  function itemCall(kind) {
    item.replaceChildren(); item.hidden = false;
    const icon = el('img', '', item); icon.src = new URL(`./assets/items/${kind}.svg`, import.meta.url).href; icon.alt = '';
    const text = el('span', '', item); el('b', '', text).textContent = loc('¡{item}!', { item: loc(ITEM_NAMES[kind] ?? locKey('Objeto')) });
    el('small', '', text).textContent = loc('Cayó en la plataforma');
    restart(item); clearTimeout(itemTimer); itemTimer = setTimeout(() => { item.hidden = true; }, 4000);
  }
  function events(fight) {
    for (const e of fight.events) {
      if (e.frame <= frame) continue;
      const p = state.players[e.slot];
      if (e.type === 'hit' && e.target !== e.slot) {
        const victim = rows[e.target]; if (victim && !reduced.matches) restart(victim.root);
        const theme = attackTheme(fight.fighters[e.slot]?.fighter, e.move);
        pop(e.target, e.damage ?? 0, e.move === 'neutral-special' ? theme : null);
      }
      if (e.type === 'ko' && p) {
        rows[e.slot].root.classList.remove('is-ko'); void rows[e.slot].root.offsetWidth; rows[e.slot].root.classList.add('is-ko');
        if (!reduced.matches) restart(flash);
        banner(loc('¡Fuera!'), p.name, SEAT_COLORS[e.slot]);
      }
      if (e.type === 'match-start') banner(loc('¡Bochinche!'), '', '', { ms: 1300 });
      if (e.type === 'sudden-death') banner(loc('¡Muerte súbita!'), '', '#ff4b4b');
      if (e.type === 'item-spawn') itemCall(e.item);
    }
    frame = fight.frame;
  }
  return {
    update(next) {
      state = next;
      if (state.round !== round) { round = state.round; frame = -1; count = 0; lastMinute = false; fx.querySelectorAll('.hud-banner,.hud-pop').forEach(n => n.remove()); item.hidden = true; }
      const fight = state.fight, stocksMax = state.options.stocks;
      if (timerLabel) timerLabel.textContent = locn(stocksMax, '{n} vida · {min} min', '{n} vidas · {min} min', { min: Math.round(state.options.seconds / 60) });
      rows.forEach((row, i) => { row.root.hidden = !state.players[i]; });
      state.players.forEach((p, i) => {
        const row = rows[i], f = fight?.fighters[i], percent = Math.round(f?.percent ?? 0), stocks = f?.stocks ?? stocksMax, pana = panaById(p.pana);
        const look = playerCostume(p, i), key = JSON.stringify(look);
        if (key !== row.portraitKey) {
          row.portraitKey = key; row.portrait.removeAttribute('src');
          const cached = cachedPortrait(look);
          if (cached) row.portrait.src = cached;
          else import('/engine/portrait.js').then(({ portrait }) => portrait(look)).then(src => { if (row.portraitKey === key) row.portrait.src = src; }).catch(() => {});
        }
        row.name.textContent = p.name; row.bot.hidden = !p.bot;
        row.poder.textContent = loc(pana.poder); row.poder.style.setProperty('--pc', pana.color);
        if (row.styleKey !== String(p.style)) { row.styleKey = String(p.style); row.style.innerHTML = STYLE_ICONS[p.style] ?? ''; row.style.append(loc(STYLE_NAMES[p.style])); row.style.style.color = STYLE_COLORS[p.style]; }
        if (row.percent !== percent) { row.damage.innerHTML = percent + '<small>%</small>'; row.percent = percent; }
        row.root.dataset.danger = damageTier(percent);
        const stockKey = stocks + ':' + stocksMax;
        if (row.stocks.dataset.value !== stockKey) {
          row.stocks.dataset.value = stockKey; row.stocks.replaceChildren();
          row.stocks.setAttribute('aria-label', locn(stocks, '{n} vida', '{n} vidas'));
          for (let life = 0; life < stocksMax; life++) { const pip = el('i', life >= stocks ? 'is-lost' : '', row.stocks); pip.setAttribute('aria-hidden', 'true'); }
        }
        row.root.dataset.out = stocks === 0;
        row.shield.style.transform = `scaleX(${f ? Math.max(0, f.shield / f.maxShield) : 1})`;
        row.root.setAttribute('aria-label', locn(stocks, '{name}: {percent}% de daño, {n} vida', '{name}: {percent}% de daño, {n} vidas', { name: p.name, percent }));
      });
      if (!fight) return;
      if (fight.phase === 'countdown') {
        const n = Math.ceil(fight.countdownFrames / 60);
        if (n !== count && n > 0 && n <= 3) banner(String(n), '', '', { big: true, ms: 800 });
        count = n;
      }
      if (fight.frame > frame) events(fight);
      const left = fight.remainingTimeMs ?? Infinity;
      if (!lastMinute && state.options.seconds > 60 && left <= 60000 && fight.phase === 'playing' && !fight.suddenDeath) { lastMinute = true; banner(loc('¡Último minuto!'), '', '#ff9a1f'); }
      document.getElementById('status')?.classList.toggle('is-low', left <= 60000 && !fight.suddenDeath && state.phase === 'playing');
    },
    // Per drawn frame: off-screen bubbles and, in Mínimo, the tags over each head.
    frame(layout) {
      const fight = state?.fight, minimal = layout === 'minimo';
      rows.forEach((row, i) => {
        const f = fight?.fighters[i], at = f && state.phase === 'playing' && f.stocks > 0 && f.state !== 'ko' ? screenOf(i) : null;
        const bubble = bubbles[i], tag = tags[i], percent = Math.round(f?.percent ?? 0);
        bubble.hidden = !at || at.inside;
        if (!bubble.hidden) {
          const m = 52, x = Math.min(at.width - m, Math.max(m, at.x)), y = Math.min(at.height - m - 90, Math.max(m + 60, at.y));
          bubble.style.transform = `translate(${x}px,${y}px)`;
          bubble.querySelector('i').style.transform = `rotate(${Math.atan2(at.y - y, at.x - x)}rad)`;
          bubble.querySelector('small').textContent = percent + '%';
          bubble.dataset.danger = damageTier(percent);
          const img = bubble.querySelector('img'); if (row.portrait.src && img.src !== row.portrait.src) img.src = row.portrait.src;
        }
        tag.hidden = !minimal || !at?.inside;
        if (!tag.hidden) {
          tag.style.transform = `translate(${at.x}px,${at.y}px)`; tag.dataset.danger = damageTier(percent);
          tag.querySelector('b').textContent = percent + '%';
          const dots = tag.querySelector('span');
          if (dots.childElementCount !== f.stocks) { dots.replaceChildren(); for (let k = 0; k < f.stocks; k++) el('i', '', dots); }
        }
      });
    },
  };
}
