// The game's own HUD over the 3D view: whose turn and its clock, the wind,
// both teams with their paint bars, the weapon picker, floating name tags,
// and the results card.
import { loc } from '/engine/i18n.js';
import { fillRoster } from '/engine/results.js';
import { ICONS } from '/engine/icons.js';
import { activeCapy, alive, standings, ammoLeft } from './rules.js';
import { WEAPONS, weaponOf } from './weapons.js';

// The picker's icon for each weapon (engine/icons.js).
const WEAPON_ICONS = { bazooka: 'weaponBazooka', grenade: 'kitGrenade', sniper: 'weaponSniper', drill: 'weaponDrill', scatter: 'weaponScatter' };

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

export function createHud($, { human = 0, pick = () => {} } = {}) {
  const teamNames = [loc('Tus capis'), loc('La máquina')];
  let rows = new Map(), tags = new Map(), shownTime = '', shownWind = null, shownWeapons = '';

  // The weapon picker: one square button per weapon (key, icon, name, shots
  // left), the one in the active capi's paws lit, empty ones greyed out.
  const buttons = new Map();
  for (const [i, w] of WEAPONS.entries()) {
    const button = el('button', 'weapon-btn'), key = el('b', 'weapon-key', String(i + 1)), art = el('span', 'weapon-icon');
    const name = el('span', 'weapon-name', w.name), ammo = el('span', 'weapon-ammo pk-num');
    art.innerHTML = ICONS[WEAPON_ICONS[w.id]]; name.translate = false;
    button.type = 'button'; button.dataset.weapon = w.id; button.setAttribute('role', 'radio');
    button.append(key, art, name, ammo); button.onclick = () => pick(w.id);
    $('weapon-list').append(button); buttons.set(w.id, { button, ammo });
  }
  function weapons(match) {
    const active = activeCapy(match), mine = active?.team === human && match.phase === 'aim' && alive(active);
    const team = active?.team ?? human, held = active?.weapon;
    const shown = `${held}|${mine}|${WEAPONS.map(w => ammoLeft(match, team, w.id)).join(',')}`;
    if (shown === shownWeapons) return; shownWeapons = shown;
    for (const w of WEAPONS) {
      const { button, ammo } = buttons.get(w.id), left = ammoLeft(match, team, w.id), on = w.id === held;
      ammo.textContent = Number.isFinite(left) ? `×${left}` : '';
      button.classList.toggle('is-on', on); button.classList.toggle('is-empty', left <= 0);
      button.disabled = !mine || left <= 0; button.setAttribute('aria-checked', String(on));
      button.title = `${w.name}: ${loc(w.blurb)}${Number.isFinite(left) ? ' ' + loc('Quedan {n}.', { n: left }) : ''}`;
    }
    const w = WEAPONS.find(k => k.id === held);
    $('weapon-note').textContent = w ? loc(w.blurb) : '';
    $('weapons').classList.toggle('is-rival', !!active && active.team !== human);
  }

  function build(match) {
    rows = new Map(); tags = new Map(); $('labels').replaceChildren();
    for (const team of [0, 1]) {
      const list = $(`team-${team}`), title = el('li', 'team-name', teamNames[team]);
      list.replaceChildren(title);
      for (const c of match.capys.filter(k => k.team === team)) {
        const row = el('li'), name = el('b', '', c.name), value = el('span'), bar = el('div', 'pk-bar'), fill = el('i');
        name.translate = false; bar.append(fill); row.append(name, value, bar); list.append(row);
        rows.set(c.id, { row, value, bar, shown: '' });
        const tag = el('span', `team-${team}`, c.name); tag.translate = false; $('labels').append(tag); tags.set(c.id, tag);
      }
    }
  }

  function update(match) {
    const active = activeCapy(match), t = match.turn, mine = active?.team === human;
    const panel = $('turn-who').parentElement;
    $('turn-who').textContent = !active ? '' : mine ? loc('Tu turno · {name}', { name: active.name }) : loc('Turno de la máquina · {name}', { name: active.name });
    const time = match.phase === 'aim' ? String(Math.ceil(t.time)) : match.phase === 'retreat' ? String(Math.ceil(t.retreat)) : '';
    if (time !== shownTime) { $('turn-time').textContent = time; shownTime = time; }
    panel.classList.toggle('is-rival', !mine);
    panel.classList.toggle('is-hurry', match.phase === 'aim' && t.time <= 5);
    const fuse = match.shot?.weapon === 'grenade' ? Math.max(0, Math.ceil(weaponOf('grenade').fuse - match.shot.t)) : null;
    $('turn-note').textContent = match.phase === 'flight' ? (fuse != null ? loc('¡Allá va! Mecha: {n} s', { n: fuse }) : loc('¡Allá va!')) : match.phase === 'retreat' ? loc('¡Corre a cubrirte!')
      : match.phase === 'aim' && !mine ? loc('La máquina está apuntando…') : match.phase === 'aim' && t.time <= 5 ? loc('¡Dispara ya!') : '';
    if (match.wind !== shownWind) {
      shownWind = match.wind;
      const arrow = $('wind-arrow'), calm = Math.abs(match.wind) < .05;
      arrow.style.transform = `scaleX(${match.wind < 0 ? -1 : 1})`;
      arrow.querySelector('.wind-shaft').style.width = `${4 + Math.abs(match.wind) * 36}px`;
      arrow.classList.toggle('is-calm', calm);
      $('wind-value').textContent = String(Math.round(Math.abs(match.wind) * 10));
      $('wind-value').parentElement.setAttribute('aria-label', calm ? loc('Sin viento') : match.wind < 0 ? loc('Viento hacia la izquierda: {n}', { n: Math.round(Math.abs(match.wind) * 10) }) : loc('Viento hacia la derecha: {n}', { n: Math.round(Math.abs(match.wind) * 10) }));
    }
    weapons(match);
    for (const c of match.capys) {
      const r = rows.get(c.id); if (!r) continue;
      const shown = `${c.paint}|${c.out}|${c.id === active?.id}`;
      if (shown === r.shown) continue; r.shown = shown;
      r.value.textContent = c.out === 'water' ? loc('Al río') : c.out ? loc('Pintado') : `${c.paint}%`;
      r.bar.style.setProperty('--pk-value', c.paint / 100);
      r.row.classList.toggle('is-out', !!c.out); r.row.classList.toggle('is-turn', c.id === active?.id && alive(c));
    }
  }

  function labels(list) {
    for (const p of list) {
      const tag = tags.get(p.id); if (!tag) continue;
      tag.hidden = !p.visible;
      if (p.visible) tag.style.transform = `translate(${p.x.toFixed(0)}px, ${p.y.toFixed(0)}px) translate(-50%, -100%)`;
    }
  }

  function results(match) {
    const win = match.winner === human;
    $('result-title').textContent = match.winner === -1 ? loc('¡Empate pintado!') : win ? loc('¡Ganaron tus capis!') : loc('Ganó la máquina');
    $('result-copy').textContent = match.endedBy === 'turns'
      ? (match.winner === -1 ? loc('Se acabaron los turnos y quedaron parejos.') : loc('Se acabaron los turnos: gana el equipo con más capis en pie y menos pintura.'))
      : win ? loc('Ni un capi rival quedó en pie.') : match.winner === -1 ? loc('No quedó ningún capi en pie.') : loc('Tus capis terminaron pintados o en el río.');
    fillRoster($('result-roster'), standings(match).map((c, i) => ({
      rank: i + 1, name: c.name, me: c.team === human, score: false,
      detail: teamNames[c.team], end: c.out === 'water' ? loc('Al río') : c.out ? loc('Pintado') : loc('En pie · {n}%', { n: c.paint }),
    })));
    $('results').hidden = false;
  }

  return { build, update, labels, results, teamNames };
}
