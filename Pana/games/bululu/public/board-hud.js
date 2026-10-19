// The board's HUD pieces: score-card icons, the plank and sign over the
// board, the minigame timer and the round toasts (which wait on game time).
import { ICONS as SVG } from '/engine/icons.js';

const MANGO_SVG = '<svg viewBox="0 0 40 40" class="ico"><path d="M8 24c0-10 9-17 18-15 6 1 8 7 7 13-2 9-11 13-18 11-4-1-7-4-7-9z" fill="#ffc629" stroke="#9a6400" stroke-width="3"/><path d="M27 9c1-3 4-5 7-5-1 3-3 5-7 5z" fill="#3a9d3a"/><path d="M14 17c2-3 5-4 8-4" stroke="#fff3b0" stroke-width="3" fill="none" stroke-linecap="round"/></svg>';
export const ICONS = {
  coin: '<i class="ico coin"></i>',
  mango: MANGO_SVG,
  jump: '<i class="ico jump">⤒</i>',
  card: SVG.card.replace('pk-ico', 'ico'),
  relic: SVG.relic.replace('pk-ico', 'ico'),
  bull: SVG.bull.replace('pk-ico', 'ico'),
  car: SVG.car.replace('pk-ico', 'ico'),
  mummy: SVG.mummy.replace('pk-ico', 'ico'),
  canoe: SVG.canoe.replace('pk-ico', 'ico'),
  whirl: SVG.whirl.replace('pk-ico', 'ico'),
  iguana: SVG.iguana.replace('pk-ico', 'ico'),
};

// $: id → element; wait: game-time wait (game-time.js), so toasts pause with the game.
export function createBoardHud($, wait) {
  function setPlank(text) { $('plank').textContent = text; }
  function setSign(text) {
    $('sign').textContent = text || '';
    $('sign').classList.toggle('hidden', !text);
  }
  function setTimer(n) {
    $('timer').classList.toggle('hidden', n == null);
    if (n != null) $('timer-n').textContent = n;
  }

  async function toast(title, sub = '', secs = 1.4, kind = '') {
    const el = $('toast');
    el.className = `toast ${kind}`;
    el.innerHTML = `<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
    await wait(secs);
    el.className = 'toast hidden';
  }

  return { setPlank, setSign, setTimer, toast };
}
