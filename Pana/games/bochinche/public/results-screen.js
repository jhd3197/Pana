// ¡Ganó!: the podium first, then who did what, then three small awards.
// Fills the static #results markup; names always go through textContent.
import { cachedPortrait } from '/engine/portrait-cache.js';
import { loc, locn, locKey } from '/engine/i18n.js';
import { playerCostume, SEAT_COLORS } from './costume.js';
import { fightMangos } from './fight-mangos.js';
import { createMangoWallet } from '/engine/mangos.js';
import { ICONS } from '/engine/icons.js';

const el = (tag, className, parent) => { const n = document.createElement(tag); if (className) n.className = className; parent?.append(n); return n; };
const CROWN = '<svg class="crown" viewBox="0 0 70 46" aria-hidden="true"><path d="M4 42 L8 10 L24 26 L35 4 L46 26 L62 10 L66 42 Z" fill="#ffd23f" stroke="#16161a" stroke-width="4" stroke-linejoin="round"/></svg>';
const HEIGHTS = [0, 300, 230, 175, 130, 105, 90];
function portraitInto(img, avatar) {
  const key = JSON.stringify(avatar); img.dataset.key = key; img.alt = '';
  const hit = cachedPortrait(avatar);
  if (hit) img.src = hit;
  else import('/engine/portrait.js').then(({ portrait }) => portrait(avatar)).then(src => { if (img.dataset.key === key) img.src = src; }).catch(() => {});
}
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// Award winners: highest value, ties to the better place; nobody wins a zero.
function award(rows, key, title, text) {
  const best = rows.filter(r => r[key] > 0).sort((a, b) => b[key] - a[key] || a.rank - b.rank)[0];
  return best && { title, text: text(best), color: best.color, who: best };
}

export function createResultsScreen() {
  const $ = id => document.getElementById(id), reduced = matchMedia('(prefers-reduced-motion: reduce)'), wallet = createMangoWallet();
  let shownKey = '';
  return {
    // receipt names this round in this room, so a reload never pays twice.
    update(state, me, ranked, receipt) {
      const key = state.phase === 'finished' ? `${state.round}:${state.winner}` : '';
      if (key === shownKey) return;
      shownKey = key; if (!key) return;
      const stats = state.stats ?? [], seconds = (state.fight?.frame ?? 0) / 60;
      const rows = ranked.map((p, i) => {
        const slot = state.players.findIndex(q => q.id === p.id), s = stats[slot] ?? { kos: 0, falls: 0, dealt: 0, best: 0 };
        return { ...s, rank: i + 1, slot, name: p.name, me: p.id === me, color: SEAT_COLORS[slot], look: playerCostume(state.players[slot], slot) };
      });
      const win = rows[0]?.rank === 1 && state.winner != null ? rows[0] : null;
      $('results').style.setProperty('--wc', win?.color ?? 'var(--pk-yellow)');
      $('result-title').textContent = win ? loc('¡Ganó {name}!', { name: win.name }) : loc('¡Ganó nadie!');
      $('result-chip').textContent = locn(state.options.stocks, 'Bochinche · {n} vida · {time}', 'Bochinche · {n} vidas · {time}', { time: clock(seconds) });
      // Podium: 4th, 2nd, 1st, 3rd so the winner stands in the middle.
      const podium = $('result-podium'); podium.replaceChildren();
      const top = rows.slice(0, 4), order = [top[3], top[1], top[0], top[2]].filter(Boolean);
      for (const r of order) {
        const pod = el('div', 'res-pod', podium); pod.style.setProperty('--c', r.color); pod.style.setProperty('--h', HEIGHTS[r.rank]); pod.style.setProperty('--d', (4 - r.rank) * 300);
        if (r.rank === 1 && win) pod.insertAdjacentHTML('beforeend', CROWN);
        portraitInto(el('img', 'face', pod), r.look);
        const blk = el('div', 'blk', pod); el('b', '', blk).textContent = r.rank + 'º';
        const n = el('span', '', blk); n.textContent = r.name; n.translate = false;
      }
      // Who did what: the best in each column is teal.
      const best = { kos: Math.max(...rows.map(r => r.kos)), falls: Math.min(...rows.map(r => r.falls)), dealt: Math.max(...rows.map(r => r.dealt)), best: Math.max(...rows.map(r => r.best)) };
      const table = el('table'), head = el('tr', '', el('thead', '', table)), body = el('tbody', '', table);
      for (const h of [loc('Pana'), loc('KOs'), loc('Caídas'), loc('Daño hecho'), loc('Mayor golpe')]) el('th', '', head).textContent = h;
      for (const r of rows) {
        const tr = el('tr', r.me ? 'me' : '', body), who = el('td', '', tr); who.style.setProperty('--c', r.color);
        el('i', '', who); const name = el('span', '', who); name.textContent = `${r.rank}º ${r.name}`; name.translate = false;
        for (const [k, text] of [['kos', r.kos], ['falls', r.falls], ['dealt', r.dealt + '%'], ['best', r.best + '%']]) {
          const td = el('td', r[k] === best[k] && (k !== 'falls' || rows.length > 1) ? 'best' : '', tr); td.textContent = text;
        }
      }
      const awards = [
        award(rows, 'kos', locKey('Rey del bochinche'), r => loc('Más KOs · {name}', { name: r.name })),
        award(rows, 'best', locKey('Pegada de oro'), r => loc('Golpe de {n}% · {name}', { name: r.name, n: r.best })),
        award(rows, 'falls', locKey('Saco de boxeo'), r => locn(r.falls, '{n} caída · {name}', '{n} caídas · {name}', { name: r.name })),
      ].filter(Boolean);
      $('result-awards').replaceChildren(...awards.map(a => {
        const card = el('div', 'res-award'); el('i', '', card).style.setProperty('--c', a.color);
        const text = el('span', '', card); el('b', '', text).textContent = loc(a.title); el('small', '', text).textContent = a.text;
        return card;
      }));
      // Your mangos: each client pays only its own player into the shared wallet.
      const mine = rows.find(r => r.me), panel = [table];
      if (mine) {
        const pay = fightMangos({ rank: mine.rank, kos: mine.kos, awards: awards.filter(a => a.who.me).map(a => a.title) });
        wallet.credit(pay.total, receipt);
        const box = el('div', 'res-mangos'), left = el('span', '', box);
        el('span', '', left).textContent = loc('Tus mangos por esta pelea');
        el('small', '', left).textContent = pay.lines.map(([key, vars, , plural]) => plural ? locn(vars.n, key, plural, vars) : loc(key, vars)).join(' + ');
        const total = el('b', '', box); total.innerHTML = ICONS.mango; total.append('+' + pay.total);
        el('small', 'res-balance', box).textContent = locn(wallet.balance(), 'Ahora tienes {n} mango', 'Ahora tienes {n} mangos');
        panel.push(box);
      }
      $('result-stats').replaceChildren(...panel);
      const confetti = $('result-confetti'); confetti.replaceChildren();
      if (!reduced.matches) for (let i = 0; i < 36; i++) {
        const c = el('i', '', confetti);
        c.style.cssText = `left:${(i * 2.8 + (i % 3) * 7) % 100}%;--cc:${[win?.color ?? '#ffc629', '#ffc629', '#f3e9d7', '#2ad1b2'][i % 4]};--t:${3 + (i % 5) * .7}s;--dl:${-(i % 7) * .6}s`;
      }
    },
  };
}
