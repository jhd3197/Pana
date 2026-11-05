import { loc, locn } from '/engine/i18n.js';
import { icon } from '/engine/icons.js';
import { kitStats, WEAPONS, MARKERS, ARMORY_CLASSES, FINISHES, grenadeDef, partOf, partsOf, gunOf } from './armory-data.js';
import { TARGET } from './rules.js';
import { livesOf } from './options.js';
import { race, pepas, lowAmmo, hitAngle, clock, KILL_LINES } from './hud-model.js';

// Pepazo's Banderín HUD: the race to the goal, your aguante and pepas, the reload
// prompt, your streak and the arrow that points at whoever painted you. game.js hands
// it the room state each render; hud-model.js holds the arithmetic, hud-banderin.css the look.
// The key of a contextual prompt on the device in use ({ keyboard, gamepad,
// touch }), the pad's own button names once engine/gamepad.js is loaded
// (the pause menu loads it), or null on a device with no key for it.
let padFormat = text => text;
if (globalThis.document) import('/engine/gamepad.js').then(m => { padFormat = text => m.formatPadLabel(text); }).catch(() => {});
export function keyFor(keys) {
  const device = globalThis.document?.documentElement.dataset.panaInput || 'keyboard', key = keys?.[device in keys ? device : 'keyboard'];
  return key == null || key === '' ? null : device === 'gamepad' ? padFormat(key) : key;
}
// Under the pepas: the marker's name and class, and an icon per fitted part.
// Out of pepas: the reload key of the device in use (a phone has its Recargar button).
function emptyText() { const key = keyFor({ keyboard: 'R', gamepad: 'X', touch: null }); return key ? loc('Sin pepas · {key} para recargar', { key }) : loc('Sin pepas · toca Recargar'); }
// The two guns' pictures (armory-thumbs.js, loaded with the first round): the icon until they land.
let thumbs = null;
function gunPic(el, key, options) {
  if (!el || el.dataset.key === key) return; el.dataset.key = key; el.replaceChildren(icon('kitBarrel'));
  (thumbs ??= import('./armory-thumbs.js')).then(m => m.weaponThumb(options)).then(src => { if (!src || el.dataset.key !== key) return; const img = new Image(); img.alt = ''; img.src = src; el.replaceChildren(img); }).catch(() => {});
}
export function createCombatHud(doc = document) {
  const $ = id => doc.getElementById(id), body = doc.body;
  const set = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const pulse = name => { body.classList.remove(name); void body.offsetWidth; body.classList.add(name); };
  const team = t => t ? loc('Turquesa') : loc('Naranja');
  const side = (kind, label, color, translate) => { set($(`${kind}-label`), label); $(`${kind}-label`).translate = translate; $(`${kind}-dot`).style.setProperty('--c', color || 'var(--pk-text)'); };
  let balls = 0, parts = '', lastHand = null, damageFx = null;

  return {
    // Fed every render, in the lobby too (the HUD is hidden there).
    render(state, me, id) {
      const r = race(state, id, TARGET);
      if (r.teams) { side('me', team(r.me.team), r.me.team ? 'var(--pk-teal)' : 'var(--pk-game)', true); side('rival', team(r.rival.team), r.rival.team ? 'var(--pk-teal)' : 'var(--pk-game)', true); }
      else { side('me', loc('Tú'), r.me.color, true); side('rival', r.rival?.name || '', r.rival?.color, false); }
      set($('score'), String(r.me.score)); set($('rival-score'), r.rival ? String(r.rival.score) : '–');
      const goal = r.flag ? loc('Primero a {n} banderas', { n: r.goal }) : r.dom ? loc('Primero a {n} puntos', { n: r.goal }) : loc('Primero a {n}', { n: r.goal });
      set($('position'), r.teams ? goal : `${goal} · ${loc('{rank} de {n} panas', { rank: r.rank, n: r.n })}`);
      set($('timer'), clock(state.time)); $('clock').classList.toggle('low', state.time <= 30);

      const stats = kitStats(me?.kit, state.options, me?.hand), ammo = me?.ammo ?? stats.magazine, melee = !!stats.melee;
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
      const fitted = me?.kit ? partsOf(me.kit, me.hand) : [];
      // The gun in hand, the other one small beside it and on the phone's swap button; a swap pops the new one in.
      if (me?.kit) {
        const color = FINISHES.find(f => f.id === me.kit.finish)?.color || '#f28b42', other = gunOf(me.kit, me.hand === 1 ? 0 : 1).weapon, look = w => ({ weapon: w, color, camo: me.kit.camo ?? null, pattern: me.kit.pattern });
        gunPic($('wpn-now'), `${me.weapon}:${color}:${me.kit.camo}`, look(me.weapon)); gunPic($('wpn-other'), `${other}:${color}:${me.kit.camo}`, look(other));
        gunPic($('weapon-hand')?.querySelector('.wpn-pic'), `${other}:${color}:${me.kit.camo}`, look(other));
        if (lastHand !== null && lastHand !== me.hand) pulse('swapped'); lastHand = me.hand ?? 0;
      }
      if (parts !== fitted.join()) {
        parts = fitted.join();
        $('wpn-kit').replaceChildren(...fitted.map(id => { const el = doc.createElement('i'); el.append(icon(partOf(id).icon)); el.title = loc(partOf(id).name); return el; }));
      }

      // A thrown chancla is away: the same bar fills until it is back in the hand.
      const away = melee && me?.melee?.phase === 'away' && !me.respawn, reloading = !melee && me?.reload > 0, empty = !melee && !!me && ammo <= 0 && !reloading && !me.respawn && !me.eliminated;
      $('reload-prompt').hidden = !(reloading || empty || away); $('reload-prompt').classList.toggle('empty', empty);
      set($('reload-text'), away ? loc('La chancla vuelve en {n} s', { n: Math.max(0, me.melee.t).toFixed(1) }) : reloading ? loc('Recargando {n} s', { n: me.reload.toFixed(1) }) : empty ? emptyText() : '');

      const gear = $('gear'), ready = !!me?.grenadeReady, grenade = grenadeDef(me?.kit?.grenade);
      // Your grenade by name and in its colour. Granadero carries two: the count shows once there is more than one.
      const count = me?.grenades ?? 1, gearKey = `${ready}:${count}:${grenade.id}`;
      if (gear.dataset.key !== gearKey) { gear.dataset.ready = String(ready); gear.dataset.key = gearKey; gear.style.setProperty('--grenade', grenade.color); gear.replaceChildren(icon('kitGrenade'), doc.createTextNode(` ${ready ? grenade.name : loc('Sin granada')}${count > 1 ? ` ×${count}` : ''}`)); }
    },
    // The kill lines already sit in the killfeed; the bottom pill skips them.
    duplicate: message => KILL_LINES.has(message),
    // Your knockout streak: shown from the second.
    streak(n) {
      $('streak').hidden = n < 2; if (n < 2) return;
      set($('streak-label'), loc('racha de {n}', { n }));
      $('streak-pips').replaceChildren(...Array.from({ length: Math.min(n, 5) }, () => doc.createElement('i')));
    },
    // A hit you landed: a small number by the crosshair, from the shared damage numbers
    // (fetched with the first one). A knockout's reads bigger; a soaked ball has none.
    landed(amount, kind = 'hit') {
      if (!(amount >= 1) || !Number.isFinite(amount)) return;
      (damageFx ??= import('/engine/fx/damage.js').then(m => m.createDamageNumbers({ max: 6 }))).then(n => n.pop(innerWidth / 2, innerHeight / 2 - 30, amount, { kind })).catch(() => {});
    },
    // Something hit you: point at where from.
    hit(e, state, id, forward) {
      const angle = hitAngle(state.players.find(p => p.id === id), state.players.find(p => p.id === e.owner), forward);
      if (angle === null) return;
      $('hit-dir').style.setProperty('--ang', `${angle.toFixed(3)}rad`); pulse('dir-hit');
    },
    reset() { this.streak(0); body.classList.remove('dir-hit', 'swapped'); lastHand = null; },
  };
}
