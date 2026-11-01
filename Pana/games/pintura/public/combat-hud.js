import { loc, locn } from '/engine/i18n.js';
import { icon } from '/engine/icons.js';
import { kitStats, WEAPONS, MARKERS, ARMORY_CLASSES, ATTACHMENTS, OPTICS } from './armory-data.js';
import { TARGET } from './rules.js';
import { livesOf } from './options.js';
import { race, pepas, lowAmmo, hitAngle, clock, KILL_LINES } from './hud-model.js';

// Pepazo's Banderín HUD: the race to the goal, your aguante and pepas, the reload
// prompt, your streak and the arrow that points at whoever painted you. game.js hands
// it the room state each render; hud-model.js holds the arithmetic, hud-banderin.css the look.
// Under the pepas: the marker's name and class, and an icon per fitted part.
const PART_ICON = { barrel: 'kitBarrel', hopper: 'kitHopper', stock: 'kitStock', optic: 'kitOptic', tape: 'plus', drip: 'kitPaint', strap: 'plus' };
export function createCombatHud(doc = document) {
  const $ = id => doc.getElementById(id), body = doc.body;
  const set = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const pulse = name => { body.classList.remove(name); void body.offsetWidth; body.classList.add(name); };
  const team = t => t ? loc('Turquesa') : loc('Naranja');
  const side = (kind, label, color, translate) => { set($(`${kind}-label`), label); $(`${kind}-label`).translate = translate; $(`${kind}-dot`).style.setProperty('--c', color || 'var(--pk-text)'); };
  let balls = 0, parts = '';

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

      const stats = kitStats(me?.kit, state.options), ammo = me?.ammo ?? stats.magazine, melee = !!stats.melee;
      $('hud').style.setProperty('--pepa', me?.color || 'var(--pk-yellow)');
      set($('me-name'), me?.name || '');
      // A melee weapon has no pepas: the plate shows its pepazos per blow over a swing bar (--cd).
      $('hop').classList.toggle('melee', melee);
      const lit = melee ? { total: 0, on: 0 } : pepas(ammo, stats.magazine);
      if (balls !== lit.total) { balls = lit.total; $('pepas').replaceChildren(...Array.from({ length: balls }, () => doc.createElement('i'))); }
      [...$('pepas').children].forEach((ball, i) => ball.classList.toggle('out', i >= lit.on));
      // Rocket markers carry spare rockets beyond the one loaded: shown as "+n".
      if (melee) { set($('ammo-n'), String(stats.damage)); set($('ammo-max'), loc('por golpe')); set($('pepas-label'), loc('Pepazos')); }
      else { set($('ammo-n'), String(ammo)); set($('ammo-max'), `/ ${stats.magazine}${stats.reserve != null ? ` +${me?.reserve ?? stats.reserve}` : ''}`); set($('pepas-label'), loc('Pepas')); }
      $('hop').classList.toggle('low', !melee && lowAmmo(ammo, stats.magazine));
      const lives = Math.max(0, livesOf(state.options) - (me?.hits || 0));
      const marker = WEAPONS.find(m => m.id === me?.weapon) || MARKERS[0], group = ARMORY_CLASSES.find(c => c.id === marker.class);
      set($('ammo'), [marker.name, group && loc(group.kind), livesOf(state.options) && locn(lives, '{n} vida', '{n} vidas')].filter(Boolean).join(' · '));
      const fitted = (me?.kit?.attachments || []).filter(Boolean);
      if (parts !== fitted.join()) {
        parts = fitted.join();
        $('wpn-kit').replaceChildren(...fitted.map(id => { const el = doc.createElement('i'); el.append(icon(PART_ICON[id])); el.title = id === 'optic' && stats.optic ? loc(OPTICS[stats.optic].name) : loc(ATTACHMENTS.find(a => a.id === id)?.name || ''); return el; }));
      }

      // A thrown chancla is away: the same bar fills until it is back in the hand.
      const away = melee && me?.melee?.phase === 'away' && !me.respawn, reloading = !melee && me?.reload > 0, empty = !melee && !!me && ammo <= 0 && !reloading && !me.respawn && !me.eliminated;
      $('reload-prompt').hidden = !(reloading || empty || away); $('reload-prompt').classList.toggle('empty', empty);
      set($('reload-text'), away ? loc('La chancla vuelve en {n} s', { n: Math.max(0, me.melee.t).toFixed(1) }) : reloading ? loc('Recargando {n} s', { n: me.reload.toFixed(1) }) : empty ? loc('Sin pepas · R para recargar') : '');

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
