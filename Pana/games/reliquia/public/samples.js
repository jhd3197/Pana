// Reliquia's recorded sounds (audio/*.mp3, CC0: see audio/SOURCE.md) on the
// shared sample bank (engine/sample-bank.js), on the same graph as the synth in
// sounds.js and ambience.js, so volume, mute and the cave reverb apply. Clips
// load once a run starts and never hold anything up: until a set has loaded
// your steps stay synthesised and the rest is quiet.
//
// Not scares, on in every Sustos mode: footsteps on boards or stone, the
// hiding spots creaking open as you search them, a heap of books shifting,
// a chandelier's chain stirring now and then, the wind and the drips.
// scare() is the only scare layer (whispers behind you, a far door, a far
// fall) and asks engine/eerie.js's scareSound how loud, if at all.
import { sound } from '/engine/fx.js';
import { createSampleBank } from '/engine/sample-bank.js';
import { searchesStarted } from '/engine/play/hiding-spots.js';
import { scareSound } from '/engine/eerie.js';
import { floorOf } from './deck.js';

const takes = (name, n) => Array.from({ length: n }, (_, i) => `${name}${i + 1}`);
const SETS = {
  wood: takes('step_wood_', 4), stone: takes('step_stone_', 5),
  creak: ['door_creak_a'], trunk: ['trunk_open'], page: ['page_turn'],
  thud: ['book_thud_a', 'book_thud_b', 'book_thud_c', 'book_thud_d'],
  drip: takes('drip_', 3), chain: ['chain_clink_a', 'chain_clink_b', 'chain_clink_c'],
  wind: ['wind_loop'], whisper: ['whisper_a', 'whisper_b'],
};
// A search beginning, by spot kind: [set, gain, lowest rate, highest rate].
const OPEN = {
  wardrobe: ['creak', .3, .85, 1.15], ladder: ['creak', .16, 1.15, 1.3], trunk: ['trunk', .3, .95, 1.05], drawer: ['trunk', .24, 1.22, 1.3],
  shelf: ['page', .3, .9, 1.1], sheet: ['page', .22, .8, .92], debris: ['thud', .26, .9, 1.1], lantern: ['chain', .1, 1.05, 1.2],
};
// A search done: a soft settle.
const DONE = { wardrobe: 'thud', trunk: 'thud', drawer: 'thud', ladder: 'thud', shelf: 'page', sheet: 'page', debris: 'page', lantern: 'chain' };
const WIND = { biblioteca: .045, mina: .028, camp: .04, templo: .05, hongos: .018, inundada: .022 };
const between = (a, b) => a + Math.random() * (b - a);

export function createSamples() {
  const bank = createSampleBank(sound, new URL('./audio/', import.meta.url), SETS);
  const wind = bank.bed('wind'), seen = new Set(), ear = { x: 0, z: 0, yaw: 0 }, at = { x: 0, z: 0 };
  let loaded = false, run = null, indexed = null, byId = new Map(), dripIn = between(8, 20), chainIn = between(6, 18), library = false, me = null;

  const spot = id => { if (!run) return null; if (indexed !== run) { byId = new Map(run.spots.map(s => [String(s.id), s])); indexed = run; } return byId.get(String(id)) || null; };
  const placed = (x, z) => { at.x = x; at.z = z; return at; };
  function opened(id) {
    const sp = spot(id), how = sp && OPEN[sp.kind]; if (!how || !me) return;
    const [set, gain, lo, hi] = how, where = placed(sp.x, sp.z);
    bank.play(set, { gain, rate: between(lo, hi), jitter: 0, at: where, listener: ear, range: 16, priority: 1 });
    // A heap of books slides as you dig into it: the thud, then loose pages.
    if (sp.kind === 'debris') bank.play('page', { gain: .2, rate: between(.95, 1.1), delay: .18, at: where, listener: ear, range: 16 });
  }

  // Every frame: the wind bed, sparse drips and chains, and searches starting.
  function update(dt, { state, me: body, heading, paused = false, theme = 'mina', floor = null, run: nextRun = null }) {
    me = body; run = nextRun;
    if (!sound.ctx) return;
    const playing = state.phase === 'playing' && !!body && !paused && !sound.muted;
    if (playing && !loaded) loaded = bank.preload();
    const deep = playing && floorOf(body.x) > 0;
    library = deep && theme === 'biblioteca';
    wind.set(playing ? WIND[deep ? theme : 'camp'] ?? .03 : 0, 3);
    if (!playing) return;
    ear.x = body.x; ear.z = body.z; ear.yaw = heading;
    searchesStarted(state.searching, seen, opened);
    // Water finds its way down: a drop somewhere near, quieter among the books.
    dripIn -= dt;
    if (dripIn <= 0) {
      const a = Math.random() * Math.PI * 2, r = between(3, 10);
      bank.play('drip', { gain: library ? .06 : .12, rate: between(.9, 1.1), jitter: 0, at: placed(body.x + Math.cos(a) * r, body.z + Math.sin(a) * r), listener: ear, range: 18, priority: 0 });
      dripIn = between(8, 20);
    }
    // A chandelier overhead shifts on its chain.
    const lamps = floor?.chandeliers; let near = null, best = 14;
    for (let i = 0; lamps && i < lamps.length; i++) { const c = lamps[i], d = Math.hypot(c.x - body.x, c.z - body.z); if (d < best) { best = d; near = c; } }
    if (near) {
      chainIn -= dt;
      if (chainIn <= 0) { bank.play('chain', { gain: .05, rate: between(.9, 1.15), jitter: 0, at: placed(near.x, near.z), listener: ear, near: 2, range: 14, priority: 0 }); chainIn = between(6, 18); }
    }
  }

  // One footfall, for engine/play/footsteps.js. False if this surface has no
  // clips (or they have not loaded), so the caller's synth step plays instead.
  function step(surface, { sprint = false, foot = 0, volume = 1 } = {}) {
    const set = surface === 'wood' ? 'wood' : surface === 'stone' ? 'stone' : null;
    if (!set || !bank.ready(set)) return false;
    bank.play(set, { gain: (sprint ? .2 : .15) * volume, rate: foot ? .97 : 1.03, jitter: .06, priority: 0 });
    return true;
  }
  const ownSteps = surface => (surface === 'wood' || surface === 'stone') && bank.ready(surface) > 0;

  // A hiding spot searched (the 'search' event): a soft settle where it stands.
  function searched(id) {
    const sp = spot(id), set = sp && DONE[sp.kind]; if (!set || !me) return;
    bank.play(set, { gain: set === 'thud' ? .1 : .14, rate: between(.9, 1.05), at: placed(sp.x, sp.z), listener: ear, range: 16, delay: .1 });
  }

  // A scare's sampled layer (eerie-fx.js), under the player's Sustos setting.
  // Normal: whispers close behind a shoulder; suaves: some of them, far and
  // quieter; apagados: nothing. `e` is the event from engine/eerie.js.
  function scare(e, mode) {
    const how = scareSound(mode, e.roll); if (!how || !me) return;
    const far = how.far, side = e.side || 1, g = how.gain;
    // A point behind and to one side: close for a whisper, across the room when far.
    const back = far ? 11 : 2.2, aside = far ? 5 : 1.6, h = ear.yaw;
    const where = placed(ear.x - Math.sin(h) * back - Math.cos(h) * side * aside, ear.z - Math.cos(h) * back + Math.sin(h) * side * aside);
    if (e.kind === 'whisper') bank.play('whisper', { gain: .16 * g, rate: between(.94, 1.04), jitter: 0, at: where, listener: ear, near: 3, range: 24, curve: 1, priority: 2 });
    else if (e.kind === 'slam') bank.play('creak', { gain: .14 * g, rate: between(.8, .92), jitter: 0, pan: side * .7, priority: 1 });
    else if (e.kind === 'thud' && library) bank.play('thud', { gain: .16 * g, rate: between(.82, .92), jitter: 0, pan: side * .85, priority: 1 });
    else if (e.kind === 'bookLand') bank.play('thud', { gain: .2 * g, rate: between(.95, 1.08), at: placed(e.x, e.z), listener: ear, range: 16, priority: 1 });
  }

  // One clip from a point in the room, heard from where you stand (presence.js).
  function near(set, x, z, { gain = .1, rate = 1, range = 16, priority = 1 } = {}) {
    if (!me) return; bank.play(set, { gain, rate, jitter: 0, at: placed(x, z), listener: ear, near: 2, range, priority });
  }

  return { update, step, ownSteps, searched, scare, near, bank, get wind() { return wind.playing; } };
}
