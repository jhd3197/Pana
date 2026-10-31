import { loc, locn } from '/engine/i18n.js';
import { icon } from '/engine/icons.js';
import { kitStats, MARKERS } from './armory-data.js';
import { TARGET } from './rules.js';
import { race, pepas, lowAmmo, hitAngle, clock, KILL_LINES } from './hud-model.js';

// Pepazo's Banderín HUD: the race to the goal, your aguante and pepas, the reload
// prompt, your streak and the arrow that points at whoever painted you. game.js hands
// it the room state each render; hud-model.js holds the arithmetic, hud-banderin.css the look.
export function createCombatHud(doc = document) {
  const $ = id => doc.getElementById(id), body = doc.body;
  const set = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const pulse = name => { body.classList.remove(name); void body.offsetWidth; body.classList.add(name); };
  const team = t => t ? loc('Turquesa') : loc('Naranja');
  const side = (kind, label, color, translate) => { set($(`${kind}-label`), label); $(`${kind}-label`).translate = translate; $(`${kind}-dot`).style.setProperty('--c', color || 'var(--pk-text)'); };
  let balls = 0;

  return {
    // Fed every render, in the lobby too (the HUD is hidden there).
    render(state, me, id) {
      const r = race(state, id, TARGET);
      if (r.teams) { side('me', team(r.me.team), r.me.team ? 'var(--pk-teal)' : 'var(--pk-game)', true); side('rival', team(r.rival.team), r.rival.team ? 'var(--pk-teal)' : 'var(--pk-game)', true); }
      else { side('me', loc('Tú'), r.me.color, true); side('rival', r.rival?.name || '', r.rival?.color, false); }
      set($('score'), String(r.me.score)); set($('rival-score'), r.rival ? String(r.rival.score) : '–');
      const goal = r.flag ? loc('Primero a {n} banderas', { n: r.goal }) : loc('Primero a {n}', { n: r.goal });
      set($('position'), r.teams ? goal : `${goal} · ${loc('{rank} de {n} panas', { rank: r.rank, n: r.n })}`);
      set($('timer'), clock(state.time)); $('clock').classList.toggle('low', state.time <= 30);

      const stats = kitStats(me?.kit, state.options), ammo = me?.ammo ?? stats.magazine;
      $('hud').style.setProperty('--pepa', me?.color || 'var(--pk-yellow)');
      set($('me-name'), me?.name || '');
      const lit = pepas(ammo, stats.magazine);
      if (balls !== lit.total) { balls = lit.total; $('pepas').replaceChildren(...Array.from({ length: balls }, () => doc.createElement('i'))); }
      [...$('pepas').children].forEach((ball, i) => ball.classList.toggle('out', i >= lit.on));
      // Rocket markers carry spare rockets beyond the one loaded: shown as "+n".
      set($('ammo-n'), String(ammo)); set($('ammo-max'), `/ ${stats.magazine}${stats.reserve != null ? ` +${me?.reserve ?? stats.reserve}` : ''}`); set($('pepas-label'), loc('Pepas'));
      $('hop').classList.toggle('low', lowAmmo(ammo, stats.magazine));
      const lives = Math.max(0, (state.options?.lives || 0) - (me?.hits || 0));
      set($('ammo'), [MARKERS.find(m => m.id === me?.weapon)?.name || MARKERS[0].name, state.options?.lives && locn(lives, '{n} vida', '{n} vidas')].filter(Boolean).join(' · '));

      const reloading = me?.reload > 0, empty = !!me && ammo <= 0 && !reloading && !me.respawn && !me.eliminated;
      $('reload-prompt').hidden = !(reloading || empty); $('reload-prompt').classList.toggle('empty', empty);
      set($('reload-text'), reloading ? loc('Recargando {n} s', { n: me.reload.toFixed(1) }) : empty ? loc('Sin pepas · R para recargar') : '');

      const gear = $('gear'), ready = !!me?.grenadeReady;
      if (gear.dataset.ready !== String(ready)) { gear.dataset.ready = String(ready); gear.replaceChildren(icon('kitGrenade'), doc.createTextNode(` ${ready ? loc('Granada') : loc('Sin granada')}`)); }
    },
    // The kill lines already sit in the killfeed; the bottom pill skips them.
    duplicate: message => KILL_LINES.has(message),
    // Your knockout streak: shown from the second.
    streak(n) {
      $('streak').hidden = n < 2; if (n < 2) return;
      set($('streak-label'), loc('racha de {n}', { n }));
      $('streak-pips').replaceChildren(...Array.from({ length: Math.min(n, 5) }, () => doc.createElement('i')));
    },
    // Something hit you: point at where from.
    hit(e, state, id, forward) {
      const angle = hitAngle(state.players.find(p => p.id === id), state.players.find(p => p.id === e.owner), forward);
      if (angle === null) return;
      $('hit-dir').style.setProperty('--ang', `${angle.toFixed(3)}rad`); pulse('dir-hit');
    },
    reset() { this.streak(0); body.classList.remove('dir-hit'); },
  };
}
