// The HUD over the rueda: the song and its meters, the MCP's call for a
// dancer, the drum lane for a drummer, the crowd's buttons, the shouts.
import { MOVES, DICHOS } from './rules.js';
import { STATION_INFO, songFor, songBeats, chart } from './songs.js';
import { createLane } from './lane.js';
import { loc, locn, locKey } from '/engine/i18n.js';

const ROLE = { dancer: loc('Bailando en el centro'), drum: loc('Tambor'), crowd: loc('En la gente'), out: loc('Fuera de la rueda') };
// The stations' interface names; one Spanish word can mean something else elsewhere.
const STATION_NAMES = { palo: loc('Palo', { $ctx: 'tambor' }), mano: loc('Mano', { $ctx: 'tambor' }), charrasca: loc('Charrasca', { $ctx: 'tambor' }), caracol: loc('Caracol', { $ctx: 'tambor' }) };
export const stationName = id => STATION_NAMES[id] ?? '';
// The calls are what the MCP sings: Spanish on every screen. Their hints are translated.
const DIR = { left: 'a la izquierda', right: 'a la derecha' }; // i18n-ignore: part of the call
const KEYS = { left: '←', right: '→' };

export function callName(call) { return call.move === 'vuelta' ? `¡Vuelta ${DIR[call.dir]}!` : MOVES[call.move].name; } // i18n-ignore: the call
export function callHint(call) { return call.move === 'vuelta' ? loc('{key} y luego Espacio', { key: KEYS[call.dir] }) : loc(MOVES[call.move].hint); }

export function createHud($, { onDicho }) {
  const lane = createLane($('lane'));
  DICHOS.forEach((text, i) => {
    const button = document.createElement('button'); button.className = 'pk-btn pk-btn--sm'; button.type = 'button';
    button.innerHTML = `<kbd class="pk-kbd">${i + 1}</kbd> `; button.append(text); button.onclick = () => onDicho(i);
    $('dichos').append(button);
  });
  let shoutTimer = 0, flashSeen = null;

  function shout(text) {
    const el = $('shout'); el.textContent = text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    clearTimeout(shoutTimer); shoutTimer = setTimeout(() => { el.textContent = ''; }, 2600);
  }

  function flash(f) {
    if (!f || f === flashSeen || f.kind === 'drum') return;
    flashSeen = f;
    const el = $('flash'); el.textContent = f.text; el.className = `flash show ${f.grade === 'perfect' ? 'perfect' : f.grade === 'miss' ? 'miss' : 'good'}`;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('show')));
  }

  // t: my song time in seconds (latency removed), null outside a song.
  function render(state, { me, judge, t }) {
    const p = state.players.find(x => x.id === me), playing = state.phase === 'song' || state.phase === 'break';
    if (!playing || !state.song) { $('call').hidden = $('drum').hidden = $('crowd').hidden = true; return; }
    const song = songFor(state.song.track), spb = 60 / song.bpm, golpe = state.options.mode === 'golpe';
    const beat = t == null ? 0 : t / spb;
    $('song-name').textContent = golpe ? loc('¡Golpe! · ronda {round} · quedan {n}', { round: state.golpe?.round || 1, n: state.golpe?.alive.length ?? 0 }) : `${song.name} · ${state.song.n}/${state.options.songs}`;
    $('progress').style.width = golpe ? `${Math.min(100, (state.golpe?.alive.length || 0) / state.players.length * 100)}%`
      : `${Math.max(0, Math.min(100, beat / songBeats(song) * 100))}%`;
    document.querySelector('.meters').hidden = golpe;
    $('sabor').style.width = `${Math.round(state.sabor * 100)}%`; $('sabor').parentElement.classList.toggle('low', state.sabor < .45);
    $('bulla').style.width = `${Math.round(state.bulla * 100)}%`;
    const place = (state.line || []).indexOf(me);
    $('role').textContent = !p ? '' : p.role === 'drum' && !golpe ? `${ROLE.drum} · ${stationName(p.station)}` : p.role === 'crowd' && place >= 0 ? `${ROLE.crowd} · #${place + 1}` : p.benched ? loc('Castigado esta canción') : ROLE[p.role] || '';
    const role = state.phase === 'break' ? 'none' : p?.role;
    // A dancer sees the MCP's call: a ring closes on the moment to hit.
    $('call').hidden = role !== 'dancer';
    if (role === 'dancer') {
      const cs = judge.current(), call = cs?.call;
      $('call-name').textContent = call ? callName(call) : loc('¡Baila!');
      $('call-hint').textContent = call ? callHint(call) : loc('Espera el llamado del MCP');
      const until = call ? call.beat * spb - t : 9, lead = 3 * spb;
      $('call-ring').style.transform = `translate(-50%, -50%) scale(${call ? Math.max(.6, 1 + Math.max(0, until) / lead * 1.4) : 0})`;
      $('call').classList.toggle('now', !!call && Math.abs(until) <= call.w);
      const partner = state.calls.find(c => c.to !== me && call && c.beat === call.beat && c.move !== call.move);
      $('call-partner').textContent = partner ? loc('Duelo: tu pareja tiene {call}', { call: callName(partner) }) : '';
      const limit = state.options.mode === 'toque' ? 0 : state.options.misses;
      const pips = $('misses');
      if (pips.children.length !== limit) pips.replaceChildren(...Array.from({ length: limit }, () => document.createElement('i')));
      [...pips.children].forEach((pip, i) => pip.classList.toggle('out', i < p.misses));
    }
    // A drummer (and every pana in ¡Golpe!) gets the lane.
    $('drum').hidden = role !== 'drum';
    if (role === 'drum') {
      const info = golpe ? { lanes: 2, hint: locKey('← y → (o F y J): repite el golpe del MCP') } : STATION_INFO[p.station];
      $('station-name').textContent = golpe ? loc('Tu tambor: repite lo que toca el MCP') : `${stationName(p.station)}: ${loc(info.what)}`;
      $('combo').textContent = judge.combo >= 4 ? loc('{n} seguidos', { n: judge.combo }) : '';
      $('station-hint').textContent = loc(info.hint);
      lane.draw(laneView(state, judge, t ?? 0, spb, info, golpe));
    }
    $('crowd').hidden = !['crowd', 'out'].includes(role);
    if (!$('crowd').hidden) {
      $('line-place').textContent = p.role === 'out' ? loc('Quedaste fuera. ¡Aplaude a los que siguen!') : p.benched ? loc('Te sacaron por entrar fuera de tiempo. Aplaude.')
        : place >= 0 ? (place === 0 ? loc('¡Eres el próximo en entrar!') : locn(place, 'Te toca después de {n} pana', 'Te toca después de {n} panas')) : loc('Entrando a la rueda…');
      $('want-in').hidden = !['rueda', 'relevo'].includes(state.options.mode) || p.role === 'out';
      $('want-in').disabled = p.used || p.benched || place <= 0;
      $('jump').hidden = state.options.mode !== 'relevo' || p.role === 'out';
      $('jump').disabled = p.benched;
    }
    flash(judge.flash);
  }

  function laneView(state, judge, t, spb, info, golpe) {
    if (golpe) {
      const g = state.golpe, notes = [];
      let banner = loc('Espera la ronda');
      if (g?.notes) {
        const answerAt = (g.start + g.len) * spb;
        banner = t < answerAt ? loc('Escucha al MCP…') : t < (g.start + g.len * 2) * spb ? loc('¡Repite!') : (judge.echo?.round === g.round ? (judge.echo.ok ? loc('¡Lo sacaste!') : loc('No era así')) : '');
        if (!g.alive.includes(judge.me)) banner = loc('Quedaste fuera');
        for (const [off, l] of g.notes) {
          notes.push({ t: (g.start + off) * spb, lane: l, kind: 'mcp' });
          if (g.round <= 2) notes.push({ t: (g.start + g.len + off) * spb, lane: l, kind: 'ghost' });
        }
      }
      return { notes, lanes: 2, t, spb, keys: ['← F', '→ J'], banner };
    }
    const notes = chart(songFor(state.song.track), judge.station || 'palo').map(n => ({ t: n.beat * spb, lane: n.lane, len: n.len * spb, kind: 'note',
      done: judge.done.has(n.i), held: judge.holding?.note.i === n.i }));
    return { notes, lanes: info.lanes, t, spb, keys: info.lanes > 1 ? ['← F', '→ J'] : [loc('Espacio')], flash: judge.flash?.kind === 'drum' ? judge.flash : null };
  }

  return { render, shout };
}
