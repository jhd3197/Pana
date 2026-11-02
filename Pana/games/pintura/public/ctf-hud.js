import * as THREE from 'three';
import { loc } from '/engine/i18n.js';
import { burst, pitch } from '/engine/sfx.js';
import { CTF_RULES } from './ctf.js';

// Capture the flag on screen: two square chips under the race bar (each flag at
// home, taken by whom, or on the ground with its return countdown), a banner while
// you carry, a marker over each flag in the world with its distance, and the
// flag sounds (effects only). The rules live in ctf.js; game.js feeds the room
// state on every render and calls frame() every animation frame for the markers.
const TEAM = ['#f28b42', '#29c5cd'];

// Short synth cues on the shared primitives: a rising call for a pickup, an alarm
// when they take yours, a falling drop, a two-note return and a capture fanfare.
export const flagSounds = {
  pickup() { [523, 784].forEach((f, i) => pitch({ dur: .12, f0: f, f1: f * 1.06, type: 'triangle', vol: .09, delay: i * .08, priority: 3 })); },
  stolen() { for (let i = 0; i < 3; i++) pitch({ dur: .1, f0: 880, f1: 660, type: 'square', vol: .045, delay: i * .14, priority: 3 }); },
  drop() { pitch({ dur: .3, f0: 600, f1: 220, type: 'triangle', vol: .08, priority: 3 }); burst({ dur: .08, f0: 300, q: .8, vol: .08, delay: .02, priority: 2 }); },
  returned() { [659, 988].forEach((f, i) => pitch({ dur: .14, f0: f, type: 'sine', vol: .08, delay: i * .1, priority: 3 })); },
  capture(win = true) {
    burst({ dur: .25, f0: 900, q: .6, vol: .14, priority: 3 });
    (win ? [523, 659, 784, 1047] : [392, 349, 330, 262]).forEach((f, i) => pitch({ dur: .16, f0: f, type: 'triangle', vol: .09, delay: .05 + i * .09, priority: 3 }));
  },
};

// Which cue an event is for this pana: their team's point of view.
export function cueFor(e, myTeam) {
  if (e.type === 'capture') return e.team === myTeam ? 'capture' : 'lost';
  if (e.type === 'pickup') return e.team === myTeam ? 'stolen' : 'pickup';
  if (e.type === 'drop') return 'drop';
  if (e.type === 'return') return 'returned';
  return null;
}

export function createCtfHud(doc = document) {
  const make = (tag, className, parent) => { const el = doc.createElement(tag); if (className) el.className = className; parent?.append(el); return el; };
  const set = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const race = doc.getElementById('race'), hud = doc.getElementById('hud');
  const strip = make('div', 'ctf-flags', race); strip.hidden = true; strip.setAttribute('aria-label', loc('Banderas'));
  const chips = [0, 1].map(team => {
    const chip = make('span', 'ctf-chip', strip); chip.style.setProperty('--c', TEAM[team]);
    make('i', 'ctf-icon', chip); const label = make('b', '', chip), state = make('small', '', chip);
    return { chip, label, state };
  });
  const banner = make('p', 'ctf-banner', hud); banner.hidden = true; banner.setAttribute('aria-live', 'polite');
  // One marker per flag, plus your own stand while you carry.
  const markers = [0, 1, 2].map(i => { const m = make('span', 'ctf-mark', hud); m.hidden = true; m.style.setProperty('--c', TEAM[i % 2]); make('i', 'ctf-icon', m); m.append(make('b')); return m; });
  const point = new THREE.Vector3();
  let lastEvent = null, round = 0, view = null;

  function chipText(flag, players) {
    if (flag.state === 'carried') return loc('La lleva {name}', { name: players.find(p => p.id === flag.carrier)?.name || '' });
    if (flag.state === 'dropped') return loc('En el suelo · {n} s', { n: Math.max(0, Math.ceil(CTF_RULES.returnAfter - flag.idle)) });
    return loc('En su base');
  }
  return {
    // Every render: chips, banner and the event sounds.
    render(state, me) {
      const on = state.options?.mode === 'ctf' && state.phase === 'playing' && (state.flags || []).length === 2;
      strip.hidden = !on; view = on ? state : null;
      if (!on) { banner.hidden = true; markers.forEach(m => { m.hidden = true; }); lastEvent = null; return; }
      state.flags.forEach((flag, team) => {
        const c = chips[team]; set(c.label, team ? loc('Turquesa') : loc('Naranja')); set(c.state, chipText(flag, state.players));
        c.chip.dataset.state = flag.state; c.chip.classList.toggle('mine', team === me?.team);
      });
      const carrying = state.flags.find(f => f.state === 'carried' && f.carrier === me?.id), own = me && state.flags[me.team];
      banner.hidden = !carrying && !(own && own.state !== 'home');
      banner.dataset.kind = carrying ? (own.state === 'home' ? 'carry' : 'blocked') : 'alarm';
      set(banner, carrying ? (own.state === 'home' ? loc('¡Llevas la bandera! Corre a tu base') : loc('¡Llevas la bandera! Recupera la tuya para anotar'))
        : own?.state === 'carried' ? loc('¡Se llevan tu bandera!') : loc('Tu bandera está en el suelo: tócala para devolverla'));
      doc.body.classList.toggle('ctf-carrier', !!carrying);
      // Sounds for events newer than the last seen (none for the backlog on join or a new round).
      const events = state.flagEvents || [];
      if (round !== state.round || lastEvent === null) { round = state.round; lastEvent = Math.max(0, ...events.map(e => e.n)); }
      for (const e of events) if (e.n > lastEvent) {
        lastEvent = e.n; const cue = cueFor(e, me?.team);
        if (cue === 'lost') flagSounds.capture(false); else if (cue) flagSounds[cue]();
      }
    },
    // Every frame: put the markers over the flags (and your stand while you carry), clamped to the screen edges.
    frame(camera, me) {
      if (!view || !me) { markers.forEach(m => { m.hidden = true; }); return; }
      const carrying = view.flags.find(f => f.state === 'carried' && f.carrier === me.id);
      const spots = view.flags.map((f, team) => ({ team, x: f.x, z: f.z, y: f.state === 'carried' ? 2.9 : 2.6, text: f.state === 'dropped' ? `${Math.max(0, Math.ceil(CTF_RULES.returnAfter - f.idle))} s` : '', skip: f.carrier === me.id }));
      const own = view.flags[me.team]; spots.push({ team: me.team, x: own.homeX, z: own.homeZ, y: 1.2, text: loc('Base'), skip: !carrying || own.state === 'home' });
      const w = innerWidth, h = innerHeight;
      spots.forEach((s, i) => {
        const m = markers[i]; m.hidden = s.skip; if (s.skip) return;
        point.set(s.x, s.y, s.z).project(camera);
        const behind = point.z > 1; let x = point.x, y = point.y;
        if (behind) { x = -x; y = -1; }
        const edge = Math.max(Math.abs(x), Math.abs(y)); if (edge > .92) { x *= .92 / edge; y *= .92 / edge; }
        m.style.setProperty('--c', TEAM[s.team]); m.dataset.state = view.flags[s.team]?.state || 'home'; m.classList.toggle('ctf-mark--base', i === 2);
        m.style.transform = `translate(${((x + 1) / 2 * w).toFixed(1)}px, ${((1 - y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
        set(m.lastChild, [`${Math.round(Math.hypot(s.x - me.x, s.z - me.z))} m`, s.text].filter(Boolean).join(' · '));
      });
    },
  };
}
