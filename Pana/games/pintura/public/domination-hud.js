import * as THREE from 'three';
import { loc, locKey } from '/engine/i18n.js';
import { burst, pitch } from '/engine/sfx.js';

// Domination on screen: three square zone chips under the race bar (the race bar
// already shows both team scores and the clock), each painted its owner's colour
// with a bar for the capture in progress; a banner while you stand in a zone; a
// marker over each zone in the world with its letter, progress and distance; and
// the zone sounds (effects only). The rules live in domination.js; game.js feeds
// the room state on every render and calls frame() every animation frame.
import { zoneColor, zoneCue, zoneOf, zoneStatus } from './domination.js';

// Short synth cues on the shared primitives: a rising call when your team takes a
// zone, a falling one when you lose it, an alarm when a rival steps into yours, a
// soft tick while you turn a zone, and an end sting for the round.
export const zoneSounds = {
  captured() { burst({ dur: .18, f0: 1100, q: .7, vol: .1, priority: 3 }); [587, 784, 988].forEach((f, i) => pitch({ dur: .14, f0: f, type: 'triangle', vol: .09, delay: .04 + i * .08, priority: 3 })); },
  lost() { [494, 392, 294].forEach((f, i) => pitch({ dur: .16, f0: f, f1: f * .94, type: 'triangle', vol: .09, delay: i * .1, priority: 3 })); },
  neutral() { pitch({ dur: .22, f0: 700, f1: 420, type: 'square', vol: .045, priority: 3 }); },
  contested() { for (let i = 0; i < 2; i++) pitch({ dur: .08, f0: 990, f1: 880, type: 'square', vol: .04, delay: i * .12, priority: 2 }); },
  tick() { pitch({ dur: .04, f0: 1500, type: 'triangle', vol: .035, priority: 1 }); },
  end(win) { (win ? [523, 659, 784, 1047] : win === false ? [392, 349, 311, 262] : [523, 523, 523]).forEach((f, i) => pitch({ dur: .2, f0: f, type: 'triangle', vol: .1, delay: i * .12, priority: 3 })); },
};

// The banner's line for zoneStatus kinds.
const BANNER = { contested: locKey('¡Zona {zone} en disputa!'), held: locKey('Defiendes la zona {zone}'), neutralizing: locKey('Neutralizando {zone} · {n}%'), capturing: locKey('Capturando {zone} · {n}%') };

export function createDomHud(doc = document) {
  const make = (tag, className, parent) => { const el = doc.createElement(tag); if (className) el.className = className; parent?.append(el); return el; };
  const set = (el, text) => { if (el.textContent !== text) el.textContent = text; };
  const race = doc.getElementById('race'), hud = doc.getElementById('hud');
  const strip = make('div', 'dom-zones', race); strip.hidden = true; strip.setAttribute('aria-label', loc('Zonas'));
  const chips = ['A', 'B', 'C'].map(id => { const chip = make('span', 'dom-chip', strip); chip.dataset.zone = id; make('b', '', chip).textContent = id; make('i', 'dom-bar', chip); return chip; });
  const banner = make('p', 'dom-banner', hud); banner.hidden = true; banner.setAttribute('aria-live', 'polite');
  const markers = ['A', 'B', 'C'].map(id => { const m = make('span', 'dom-mark', hud); m.hidden = true; make('b', 'dom-letter', m).textContent = id; make('small', '', m); make('i', 'dom-bar', m); return m; });
  const point = new THREE.Vector3();
  let lastEvent = null, round = 0, view = null, lastTick = -1, lastPhase = '';

  // A chip or marker: owner colour, the claimer's colour on the progress bar.
  const paint = (el, z) => {
    el.style.setProperty('--c', zoneColor(z.owner)); el.style.setProperty('--claim', zoneColor(z.claim));
    el.style.setProperty('--p', z.owner !== null && z.claim === z.owner ? '1' : z.progress.toFixed(3));
    el.dataset.owner = z.owner === null ? 'none' : String(z.owner); el.classList.toggle('contested', !!z.contested);
  };
  return {
    // Every render: chips, banner and the event sounds.
    render(state, me) {
      const dom = state.options?.mode === 'dom', on = dom && state.phase === 'playing' && (state.zones || []).length === 3;
      if (dom && state.phase === 'finished' && lastPhase === 'playing' && state.outcome) zoneSounds.end(state.outcome.winner === null ? null : state.outcome.winner === me?.team);
      lastPhase = state.phase;
      strip.hidden = !on; view = on ? state : null;
      if (!on) { banner.hidden = true; markers.forEach(m => { m.hidden = true; }); lastEvent = null; doc.body.classList.remove('dom-in-zone'); return; }
      state.zones.forEach((z, i) => { paint(chips[i], z); chips[i].classList.toggle('mine', z.owner === me?.team); chips[i].title = z.owner === null ? loc('Zona {zone} · libre', { zone: z.id }) : loc('Zona {zone} · {team}', { zone: z.id, team: z.owner ? loc('Turquesa') : loc('Naranja') }); });
      const here = zoneOf(state.zones, me), say = zoneStatus(here, me?.team);
      banner.hidden = !say; if (say) { banner.dataset.kind = say.kind; set(banner, loc(BANNER[say.kind], say)); }
      doc.body.classList.toggle('dom-in-zone', !!here);
      // A soft tick every 20% while you turn a zone.
      const step = say && (say.kind === 'capturing' || say.kind === 'neutralizing') ? Math.floor(here.progress * 5) : -1;
      if (step >= 0 && lastTick >= 0 && step !== lastTick) zoneSounds.tick(); lastTick = step;
      // Sounds for events newer than the last seen (none for the backlog on join or a new round).
      const events = state.zoneEvents || [];
      if (round !== state.round || lastEvent === null) { round = state.round; lastEvent = Math.max(0, ...events.map(e => e.n)); }
      for (const e of events) if (e.n > lastEvent) {
        lastEvent = e.n; const cue = zoneCue(e, me?.team);
        // A contest only rings for zones you own or stand in.
        if (cue === 'contested' && e.team !== me?.team && here?.id !== e.zone) continue;
        if (cue) zoneSounds[cue]();
      }
    },
    // Every frame: a marker over each zone (the one you stand in hides), clamped to the screen edges.
    frame(camera, me) {
      if (!view || !me) { markers.forEach(m => { m.hidden = true; }); return; }
      const here = zoneOf(view.zones, me), w = innerWidth, h = innerHeight;
      view.zones.forEach((z, i) => {
        const m = markers[i]; m.hidden = here === z; if (m.hidden) return;
        point.set(z.x, 3.2, z.z).project(camera);
        const behind = point.z > 1; let x = point.x, y = point.y;
        if (behind) { x = -x; y = -1; }
        const edge = Math.max(Math.abs(x), Math.abs(y)); if (edge > .92) { x *= .92 / edge; y *= .92 / edge; }
        paint(m, z);
        m.style.transform = `translate(${((x + 1) / 2 * w).toFixed(1)}px, ${((1 - y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
        set(m.children[1], `${Math.round(Math.hypot(z.x - me.x, z.z - me.z))} m`);
      });
    },
  };
}
