// La Rueda de Tambor: pure rules, plain data in and out (no DOM, no Three.js),
// so the host, the screen and Node tests share them.
//
// Every client plays the music on its own computer and judges its own hits
// against it (judge.js); the host only hears results. Inputs carry running
// counters for the current song (drum hits, claps) plus the latest call
// results, so a dropped packet loses nothing. The host owns the clock (`now`,
// server milliseconds, set before each step), the roles, the Sabor and Bulla
// meters, the MCP's calls and who gets thrown out of the rueda.
import { draw, clamp } from '/engine/random.js';
import { defaultOptions, roomOptions } from './options.js';
import {
  STATIONS, songFor, secondsPerBeat, songBeats, notesBetween, isDuelo, phraseOf, playable, isGolpeBeat,
  golpePattern, INTRO_BARS, BEATS_PER_BAR, COUNT_IN,
} from './songs.js';
import { loc, locKey, formatList } from '../../../engine/i18n.js';

export const BOT_SEAT = 1000, RUEDA_SIZE = 8, GOLPE_SIZE = 4, DRUMS = 4, BREAK = 7, SWEATY = 48;
export const BOT_NAMES = ['Don Pancho', 'Lola', 'Cheo', 'Nena', 'Tito', 'Mari', 'Toño', 'Cuqui']; // i18n-ignore: names
export const BOT_SKILL = { facil: .7, normal: .84, duro: .93 };
export const GRADES = ['perfect', 'good', 'miss'];
// What each call asks for. `len` is how many beats the move lasts after its hit.
// The calls are what the MCP sings and stay Spanish; the hints are locKey().
export const MOVES = {
  cadera: { name: '¡Cadera!', len: 0, hint: locKey('← o → en el golpe') }, // i18n-ignore: call
  vuelta: { name: '¡Vuelta!', len: 0, hint: locKey('La flecha y luego Espacio') }, // i18n-ignore: call
  panuelo: { name: '¡Pañuelo!', len: 2, hint: locKey('Mantén Espacio dos tiempos') }, // i18n-ignore: call
  pegate: { name: '¡Pégate!', len: 1, hint: locKey('↑ una sola vez') }, // i18n-ignore: call
  abajo: { name: '¡Abajo!', len: 2, hint: locKey('Mantén ↓ dos tiempos') }, // i18n-ignore: call
  golpe: { name: '¡Golpe!', len: 1, hint: locKey('Espacio y quieto') }, // i18n-ignore: call
};
export const MOVE_IDS = Object.keys(MOVES);
// Dichos, the MCP's barks and the dicho titles stay Spanish in every language.
export const DICHOS = ['¡Palo!', '¡Golpe!', 'Más aburrido que mocho en piñata', '¡Pedazo de loco!']; // i18n-ignore: dichos
export const TITLES = {
  rey: locKey('Rey o Reina de la rueda'), mano: locKey('Mano de oro'), suda: 'Suda más que un maracucho encerrado', // i18n-ignore: dicho
  plomo: locKey('Pies de plomo'), mocho: 'Más aburrido que mocho en piñata', palo: '¡Palo!', // i18n-ignore: dichos
};
const MISS_LINES = ['¡Me agarró fuera de base!', '¡Más cadera, chamo!', '¡Despierta, pana!']; // i18n-ignore: barks

// A var is a value, a list of names or { key } (Spanish text). Spoken keeps
// Spanish for the MCP's voice; shown translates for this screen.
function eventVars(vars, shown) {
  if (!vars) return vars;
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, Array.isArray(v) ? shown ? formatList(v) : v.join(' y ')
    : v && typeof v === 'object' ? shown ? loc(v.key) : v.key : v]));
}
export const eventSpoken = e => e.text.replace(/\{(\w+)\}/g, (m, k) => eventVars(e.vars, false)?.[k] ?? m);
export const eventShown = e => loc(e.text, eventVars(e.vars, true));

// What a member may send each tick (see the header).
const count = (v) => Number.isSafeInteger(v) && v >= 0 ? Math.min(v, 1e6) : 0;
export function cleanInput(raw) {
  const drum = raw?.drum || {}, clap = raw?.clap || {};
  const calls = (Array.isArray(raw?.calls) ? raw.calls : []).slice(-8)
    .filter(c => Array.isArray(c) && Number.isSafeInteger(c[0]) && GRADES.includes(c[1])).map(([id, grade]) => [id, grade]);
  const golpe = Number.isSafeInteger(raw?.golpe?.round) ? { round: raw.golpe.round, ok: raw.golpe.ok === true } : null;
  return { song: count(raw?.song), drum: { p: count(drum.p), g: count(drum.g), m: count(drum.m), s: count(drum.s) },
    clap: { on: count(clap.on), off: count(clap.off) }, calls, golpe };
}

// The call window in seconds: a steady beat (Sabor) and a loud crowd (Bulla) give more time.
export const callWindow = (sabor, bulla) => Math.round((.11 + .07 * clamp(sabor) + .06 * clamp(bulla)) * 1000) / 1000;
// How far ahead calls are announced and how often they come: a wobbly beat rushes them.
export const callPace = (sabor) => sabor >= .7 ? { lead: 4, every: 8 } : sabor >= .45 ? { lead: 3, every: 6 } : { lead: 2, every: 4 };
const freshStats = () => ({ danceBeats: 0, longest: 0, fastestKick: null, perfect: 0, hits: 0, missed: 0, drum: 0, notes: 0, struck: 0,
  wait: 0, claps: 0, danced: 0, drummed: 0, rounds: 0 });

export class Rueda {
  constructor(seed = Date.now()) {
    this.seed = (seed >>> 0) || 1;
    this.options = defaultOptions();
    this.players = []; this.phase = 'lobby'; this.round = 0; this.now = 0;
    this.song = null; this.songIndex = 0; this.cursor = 0; this.breakLeft = 0;
    this.sabor = .75; this.bulla = 0; this.saborSum = 0; this.saborBeats = 0;
    this.slots = []; this.line = []; this.entering = []; this.calls = []; this.nextCallId = 1; this.nextCall = 0; this.callCount = 0; this.dueloPhrase = -1;
    this.events = []; this.nextEvent = 1; this.golpe = null; this.titles = []; this.winner = null; this.team = 0;
  }

  snapshot() { return JSON.parse(JSON.stringify(this)); }
  configure(patch) { const next = this.phase === 'lobby' && roomOptions(this.options, patch); if (!next) return false; this.options = next; return true; }

  // A new host continues from the last snapshot without the panas who left.
  static restore(state, members) {
    const game = Object.assign(new Rueda(), JSON.parse(JSON.stringify(state)));
    for (const p of game.players.filter(p => !p.bot && !members.has(p.id))) game.removePlayer(p.id);
    return game;
  }

  get mode() { return this.options.mode; }
  get track() { return songFor(this.song?.track ?? 0); }
  player(id) { return this.players.find(p => p.id === id); }
  beatNow() { return this.song ? (this.now - this.song.startAt) / 1000 / secondsPerBeat(this.track) : 0; }
  // text is the Spanish source (locKey) and vars its values: the MCP speaks it
  // in Spanish (eventSpoken) and each screen shows it translated (eventShown).
  event(kind, text, extra = {}, vars) {
    this.events.push({ n: this.nextEvent++, kind, text, ...extra, ...(vars ? { vars } : {}) });
    if (this.events.length > 12) this.events.shift();
  }

  addPlayer(id, name, avatar = {}, bot = false, skill = .84) {
    const known = this.player(id);
    if (known) return Object.assign(known, { name, avatar });
    const player = { id, name, avatar, bot, skill, order: this.players.length, role: 'crowd', station: null, slot: null, score: 0,
      misses: 0, streak: 0, turnStart: 0, used: false, benched: false, sweaty: false, dancedSong: false, dicho: null,
      seen: { drum: { p: 0, g: 0, m: 0, s: 0 }, clap: { on: 0, off: 0 } }, stats: freshStats() };
    this.players.push(player);
    if (this.phase === 'song' && this.mode !== 'golpe') this.line.push(id);
    else if (this.phase === 'song') player.role = 'out';
    return player;
  }

  removePlayer(id) {
    const p = this.player(id);
    if (!p) return;
    if (p.role === 'dancer') this.vacate(p, this.beatNow(), null);
    this.line = this.line.filter(x => x !== id);
    this.entering = this.entering.filter(e => e.id !== id);
    this.players = this.players.filter(x => x.id !== id);
    if (this.golpe) this.golpe.alive = this.golpe.alive.filter(x => x !== id);
  }

  start() {
    this.players = this.players.filter(p => !p.bot);
    const size = this.mode === 'golpe' ? GOLPE_SIZE : RUEDA_SIZE, skill = BOT_SKILL[this.options.bots] ?? .84;
    for (let i = 0; this.players.length < size; i++) this.addPlayer(BOT_SEAT + i, BOT_NAMES[i], {}, true, clamp(skill + ((i % 3) - 1) * .04, .5, .97));
    this.players.forEach((p, i) => Object.assign(p, { order: i, score: 0, stats: freshStats(), sweaty: false, dicho: null }));
    Object.assign(this, { round: this.round + 1, songIndex: 0, titles: [], winner: null, team: 0, golpe: null });
    this.startSong(0);
  }

  // Songs 1–3 go slow, medium, fast; later songs alternate medium and fast.
  startSong(index) {
    const track = this.mode === 'golpe' ? 'golpe' : index < 3 ? index : 1 + (index - 3) % 2, song = songFor(track);
    const lead = (COUNT_IN * secondsPerBeat(song) + .8) * 1000;
    Object.assign(this, { phase: 'song', songIndex: index, song: { n: index + 1, track, startAt: Math.round(this.now + lead), bpm: song.bpm },
      cursor: -COUNT_IN, sabor: .75, bulla: 0, saborSum: 0, saborBeats: 0, calls: [], entering: [], callCount: 0, dueloPhrase: -1,
      nextCall: INTRO_BARS * BEATS_PER_BAR + 4 });
    for (const p of this.players) Object.assign(p, { misses: 0, streak: 0, used: false, benched: false, sweaty: false, dancedSong: false,
      seen: { drum: { p: 0, g: 0, m: 0, s: 0 }, clap: { on: 0, off: 0 } } });
    this.assignRoles(index);
    if (this.mode === 'golpe') this.golpe = { round: 0, start: 8, len: 0, notes: null, results: {}, alive: this.players.map(p => p.id) };
    this.event('song', locKey('{song} · {tempo}'), {}, { song: song.name, tempo: { key: song.tempo } });
  }

  // Who dances, who drums, who waits. Panas who danced the least go first,
  // people before bots. The drums go to whoever drummed the least; a pana who
  // just drummed waits in the crowd next (bots take the extra drums), so
  // people really swap between the drums and the crowd.
  assignRoles(index) {
    const last = { dancer: 'danced', drum: 'drummed' };
    const again = (p, key) => last[p.lastRole] === key;
    const by = (list, key) => [...list].sort((a, b) => a.stats[key] - b.stats[key] || again(a, key) - again(b, key)
      || (again(a, key) ? b.bot - a.bot : a.bot - b.bot) || a.order - b.order);
    for (const p of this.players) Object.assign(p, { lastRole: index ? p.role : null, role: 'crowd', station: null, slot: null });
    this.line = []; this.slots = [];
    if (this.mode === 'golpe') { this.players.forEach(p => { p.role = 'drum'; p.station = 'mano'; }); return; }
    let drummers, dancers;
    if (this.mode === 'toque') {
      const people = this.players.filter(p => !p.bot), bots = this.players.filter(p => p.bot);
      drummers = [...people, ...bots.splice(0, Math.max(0, DRUMS - people.length))];
      dancers = bots.splice(0, 2);
    } else {
      dancers = by(this.players, 'danced').slice(0, this.mode === 'relevo' ? 1 : 2);
      drummers = by(this.players.filter(p => !dancers.includes(p)), 'drummed').slice(0, DRUMS);
    }
    drummers.forEach((p, k) => { p.role = 'drum'; p.station = STATIONS[(k + index) % STATIONS.length]; });
    dancers.forEach((p, s) => this.seat(p, s, 0));
    this.line = by(this.players.filter(p => p.role === 'crowd'), 'danced').map(p => p.id);
  }

  seat(p, slot, beat) {
    Object.assign(p, { role: 'dancer', slot, misses: 0, streak: 0, turnStart: Math.max(beat, INTRO_BARS * BEATS_PER_BAR), dancedSong: true });
    this.slots[slot] = p.id;
  }

  // A dancer leaves the center (kicked, relieved or gone): the next pana in line comes in.
  vacate(p, beat, replace = true) {
    const slot = p.slot, turn = Math.max(0, beat - p.turnStart);
    p.stats.longest = Math.max(p.stats.longest, turn);
    Object.assign(p, { role: 'crowd', slot: null });
    this.slots[slot] = null;
    this.calls = this.calls.filter(c => c.res || c.to !== p.id);
    if (replace !== false) this.callIn(slot, beat + 2, replace === true ? null : replace);
    return turn;
  }

  callIn(slot, beat, id = null) {
    if (this.entering.some(e => e.slot === slot)) return;
    const ok = (x) => !this.player(x)?.benched && !this.entering.some(e => e.id === x);
    const next = id ?? this.line.find(ok);
    if (next == null) return;
    this.line = this.line.filter(x => x !== next);
    this.entering.push({ slot, id: next, beat });
  }

  kick(p, beat) {
    const slot = p.slot, turn = this.vacate(p, beat, false);
    if (p.stats.fastestKick == null || turn < p.stats.fastestKick) p.stats.fastestKick = turn;
    this.line.push(p.id);
    this.event('kick', locKey('¡Sal de la rueda, {name}!'), { id: p.id }, { name: p.name });
    this.callIn(slot, beat + 2);
  }

  // ---------- actions ----------
  dicho(id, i) {
    const p = this.player(id);
    if (!p || this.phase === 'lobby' || !Number.isInteger(i) || i < 0 || i >= DICHOS.length) return false;
    if (p.dicho && this.now - p.dicho.at < 1500) return false;
    p.dicho = { i, n: this.nextEvent, at: this.now };
    this.event('dicho', DICHOS[i], { id });
    return true;
  }

  // ¡Quiero entrar!: once per song, a pana in the crowd cuts to the front of the line.
  wantIn(id) {
    const p = this.player(id);
    if (!p || this.phase !== 'song' || p.role !== 'crowd' || p.used || p.benched || !['rueda', 'relevo'].includes(this.mode)) return false;
    if (!this.line.includes(id)) return false;
    p.used = true; this.line = [id, ...this.line.filter(x => x !== id)];
    this.event('entrar', locKey('¡{name} quiere entrar!'), { id }, { name: p.name });
    return true;
  }

  // Relevo: jump into the center on a "¡Golpe!" beat (judged on the jumper's
  // own music). Off the beat, the jumper is the one thrown out.
  jump(id, beat, ok) {
    const p = this.player(id), now = this.beatNow();
    if (!p || this.mode !== 'relevo' || this.phase !== 'song' || p.role !== 'crowd' || p.benched) return false;
    if (this.entering.some(e => e.id === id)) return false;
    if (!ok || !isGolpeBeat(this.track, beat) || Math.abs(now - beat) > 2) {
      p.benched = true; this.line = this.line.filter(x => x !== id);
      this.event('kick', locKey('¡Fuera de tiempo! ¡Sal de la rueda, {name}!'), { id }, { name: p.name });
      return true;
    }
    const current = this.player(this.slots[0]);
    this.line = this.line.filter(x => x !== id);
    if (current) {
      this.vacate(current, now, false); this.line.push(current.id);
      this.event('relevo', locKey('¡Relevo! {name} entra por {other}'), { id }, { name: p.name, other: current.name });
    } else this.event('enter', locKey('¡Entra, {name}!'), { id }, { name: p.name });
    this.entering = this.entering.filter(e => e.slot !== 0);
    this.seat(p, 0, now);
    return true;
  }

  // ---------- the host's step ----------
  update(dt, inputs = new Map()) {
    if (this.phase === 'break') {
      this.breakLeft -= dt;
      if (this.breakLeft <= 0) this.startSong(this.songIndex + 1);
      return;
    }
    if (this.phase !== 'song') return;
    const song = this.track, beat = this.beatNow();
    for (const p of this.players) if (!p.bot) { const input = inputs.get(p.id); if (input?.song === this.song.n) this.take(p, input); }
    if (beat > this.cursor) { this.advance(this.cursor, beat); this.cursor = beat; }
    this.bulla = clamp(this.bulla - dt * .06);
    if (this.mode === 'golpe') return this.golpeStep(beat);
    for (const e of this.entering.filter(e => beat >= e.beat)) {
      const p = this.player(e.id);
      this.entering = this.entering.filter(x => x !== e);
      if (!p || this.slots[e.slot] != null) { if (p) this.line.unshift(p.id); continue; }
      this.seat(p, e.slot, beat);
      this.event('enter', locKey('¡Entra, {name}!'), { id: p.id }, { name: p.name });
    }
    this.issueCalls(beat);
    this.resolveCalls(beat);
    if (beat >= songBeats(song)) this.endSong();
  }

  // Counters only grow within a song; the host takes the difference.
  take(p, input) {
    const grown = (key, part) => { const d = Math.max(0, input[part][key] - p.seen[part][key]); p.seen[part][key] += d; return d; };
    const [dp, dg, dm, ds] = ['p', 'g', 'm', 's'].map(k => grown(k, 'drum'));
    const [on, off] = ['on', 'off'].map(k => grown(k, 'clap'));
    if (p.role === 'drum' && this.mode !== 'golpe') this.drummed(p, dp, dg, dm, ds);
    if (p.role !== 'drum' && p.role !== 'dancer') this.clapped(p, on, off);
    for (const [id, grade] of input.calls) {
      const call = this.calls.find(c => c.id === id && c.to === p.id && !c.res);
      if (call) this.resolve(call, grade, this.beatNow());
    }
    const g = this.golpe;
    if (input.golpe && g?.notes && input.golpe.round === g.round && g.alive.includes(p.id) && !(p.id in g.results)) g.results[p.id] = input.golpe.ok;
  }

  drummed(p, perfect, good, miss, stray = 0) {
    const points = perfect * 3 + good * 2;
    Object.assign(p.stats, { drum: p.stats.drum + points, notes: p.stats.notes + perfect + good + miss, struck: p.stats.struck + perfect + good });
    p.score += points;
    // Sabor follows the rueda's recent accuracy: every note pulls it toward its grade.
    const feel = (v, n) => { for (let i = 0; i < n; i++) this.sabor += (v - this.sabor) * .04; };
    feel(1, perfect); feel(.8, good); feel(0, miss); feel(.35, stray);
    this.sabor = clamp(this.sabor);
  }

  clapped(p, on, off) {
    if (!on && !off) return;
    this.bulla = clamp(this.bulla + on * .05 - off * .02);
    const points = Math.min(on, Math.max(0, 40 - p.stats.claps));
    p.stats.claps += on; p.score += points;
  }

  // Beats from → to: bots play their part and time is counted.
  advance(from, to) {
    const song = this.track, span = Math.max(0, Math.min(to, songBeats(song)) - Math.max(from, INTRO_BARS * BEATS_PER_BAR));
    for (const p of this.players) {
      if (p.role === 'dancer') { p.stats.danceBeats += span; p.score += span * .5; if (to - p.turnStart >= SWEATY) p.sweaty = true; }
      if (p.role === 'crowd' && this.mode !== 'golpe') p.stats.wait += span;
    }
    for (let b = Math.floor(from) + 1; b <= to; b++) {
      if (!playable(song, b)) continue;
      this.saborSum += this.sabor; this.saborBeats++;
      for (const p of this.players.filter(p => p.bot && p.role === 'crowd')) {
        if (draw(this) < .3 * p.skill) this.clapped(p, 1, 0);
        if (draw(this) < .006) this.dicho(p.id, Math.floor(draw(this) * DICHOS.length));
      }
      if (this.mode === 'relevo' && isGolpeBeat(song, b)) this.botJump(b);
    }
    if (this.mode === 'golpe') return;
    for (const p of this.players.filter(p => p.bot && p.role === 'drum')) {
      for (let n = notesBetween(song, p.station, from, to).length; n > 0; n--) {
        const roll = draw(this);
        if (roll < p.skill - .3) this.drummed(p, 1, 0, 0);
        else if (roll < p.skill + .06) this.drummed(p, 0, 1, 0);
        else this.drummed(p, 0, 0, 1);
      }
    }
  }

  botJump(beat) {
    const ready = this.players.filter(p => p.bot && p.role === 'crowd' && !p.benched && !this.entering.some(e => e.id === p.id));
    if (!ready.length || draw(this) > .14) return;
    const p = ready[Math.floor(draw(this) * ready.length)];
    this.jump(p.id, beat, draw(this) < p.skill * .85);
  }

  // The MCP's calls, announced `lead` beats before the hit. Everyone in the
  // center gets one at the same time: the same move, or different ones in a duelo.
  issueCalls(beat) {
    const song = this.track, end = songBeats(song) - BEATS_PER_BAR;
    for (let guard = 0; guard < 8; guard++) {
      const { lead, every } = callPace(this.sabor);
      if (this.nextCall - lead > beat) return;
      const target = this.nextCall;
      this.nextCall += every;
      if (!playable(song, target)) continue;
      const messy = this.sabor < .45 && draw(this) < .5 ? .5 : 0;
      const w = callWindow(this.sabor, this.bulla), duelo = this.slots.length > 1 && isDuelo(song, target);
      if (duelo && this.dueloPhrase !== phraseOf(song, target)) { this.dueloPhrase = phraseOf(song, target); this.event('duelo', locKey('¡Duelo! Cada quien con lo suyo')); }
      let first = null, dir = draw(this) < .5 ? 'left' : 'right';
      this.slots.forEach((id, slot) => {
        if (id == null) return;
        let move = this.callCount < 2 ? 'cadera' : MOVE_IDS[Math.floor(draw(this) * MOVE_IDS.length)];
        if (duelo && first) { while (move === first) move = MOVE_IDS[Math.floor(draw(this) * MOVE_IDS.length)]; dir = dir === 'left' ? 'right' : 'left'; } else if (first) move = first;
        first ??= move;
        const at = target + messy, len = MOVES[move].len;
        if (at + len >= end) return;
        this.calls.push({ id: this.nextCallId++, to: id, slot, move, dir, beat: at, len, w, duelo, res: null, said: beat });
      });
      this.callCount++;
    }
  }

  resolveCalls(beat) {
    const spb = secondsPerBeat(this.track);
    for (const c of this.calls.filter(c => !c.res)) {
      const p = this.player(c.to);
      if (!p) { c.res = 'miss'; continue; }
      if (p.bot && beat >= c.beat + c.w / spb) {
        const chance = clamp(p.skill * (.8 + .28 * this.sabor) + .08 * this.bulla, .3, .97);
        const roll = draw(this);
        this.resolve(c, roll < chance ? (roll < chance * (p.skill - .25) ? 'perfect' : 'good') : 'miss', beat);
      } else if (!p.bot && beat > c.beat + c.len + (c.w + 2) / spb) this.resolve(c, 'miss', beat);
    }
    this.calls = this.calls.filter(c => !c.res || beat - c.beat < 6);
  }

  resolve(call, grade, beat) {
    call.res = grade;
    const p = this.player(call.to);
    if (!p || p.role !== 'dancer' || p.slot !== call.slot) return;
    if (grade !== 'miss') {
      p.score += grade === 'perfect' ? 15 : 10; p.stats.hits++; p.streak++;
      if (grade === 'perfect') p.stats.perfect++;
      if (p.streak % 4 === 0) this.event('mcp', '¡Eso es!', { id: p.id }); // i18n-ignore: bark
      return;
    }
    p.misses++; p.streak = 0; p.stats.missed++;
    if (this.mode === 'toque') return;
    if (p.misses >= this.options.misses) this.kick(p, beat);
    else this.event('miss', call.move === 'cadera' ? MISS_LINES[1] : MISS_LINES[(call.id + p.misses) % MISS_LINES.length], { id: p.id });
  }

  // ¡Golpe!: the MCP plays a pattern, everyone repeats it, whoever misses is out.
  golpeStep(beat) {
    const g = this.golpe;
    if (!g.notes) {
      if (beat < g.start - 4) return;
      g.round++; Object.assign(g, golpePattern(g.round, () => draw(this)), { results: {} });
      this.event('golpe', locKey('Ronda {n}: escucha al MCP y repite'), {}, { n: g.round });
      return;
    }
    const judged = g.start + g.len * 2 + 1, spb = secondsPerBeat(this.track);
    if (beat < judged) return;
    const notes = g.notes.length;
    for (const id of g.alive) {
      const p = this.player(id);
      if (id in g.results || !p) continue;
      if (p.bot) g.results[id] = draw(this) < p.skill ** (notes / 2.6) + .04;
      else if (beat > judged + 2 / spb) g.results[id] = false;
    }
    if (g.alive.some(id => !(id in g.results))) return;
    const out = g.alive.filter(id => !g.results[id]);
    if (out.length === g.alive.length) this.event('golpe', locKey('¡Nadie lo sacó! Otra vez'));
    else {
      for (const id of out) { const p = this.player(id); p.role = 'out'; p.stats.rounds = g.round - 1; }
      g.alive = g.alive.filter(id => g.results[id]);
      for (const id of g.alive) { const p = this.player(id); p.score += 10; p.stats.rounds = g.round; }
      if (out.length) this.event('kick', locKey('¡Sal de la rueda, {name}!'), { id: out[0] }, { name: out.map(id => this.player(id).name) });
    }
    if (g.alive.length <= 1) return this.finish();
    Object.assign(g, { notes: null, start: Math.ceil((beat + 2) / BEATS_PER_BAR) * BEATS_PER_BAR + 4 });
  }

  endSong() {
    const beat = songBeats(this.track), sabor = this.saborBeats ? this.saborSum / this.saborBeats : this.sabor;
    for (const p of this.players) {
      if (p.role === 'dancer') p.stats.longest = Math.max(p.stats.longest, beat - p.turnStart);
      if (p.dancedSong) p.stats.danced++;
      if (p.role === 'drum') { p.stats.drummed++; const bonus = Math.round(sabor * 40); p.score += bonus; p.stats.drum += bonus; }
    }
    this.calls = []; this.entering = [];
    this.event('end', locKey('¡Eso es! Sabor de la rueda: {n} %'), {}, { n: Math.round(sabor * 100) });
    if (this.songIndex + 1 < this.options.songs) { this.phase = 'break'; this.breakLeft = BREAK; } else this.finish();
  }

  finish() {
    this.phase = 'finished'; this.calls = []; this.entering = [];
    for (const p of this.players) p.score = Math.round(p.score);
    this.team = this.players.reduce((sum, p) => sum + p.score, 0);
    const ranked = this.ranking();
    this.winner = this.mode === 'golpe' ? this.golpe.alive[0] ?? ranked[0]?.id ?? null : ranked[0]?.id ?? null;
    this.titles = this.mode === 'golpe' ? [] : awardTitles(this.players);
    const winner = this.player(this.winner)?.name;
    if (this.mode === 'toque') this.event('final', locKey('¡La rueda sonó! {n} puntos entre todos'), {}, { n: this.team });
    else if (winner != null) this.event('final', locKey('¡{name} se la llevó!'), {}, { name: winner });
    else this.event('final', locKey('¡Nadie se la llevó!'));
  }

  ranking() { return rankPlayers(this.players, this.mode); }
}

// Relevo ranks by time in the center, ¡Golpe! by rounds survived, the rest by points.
export function rankPlayers(players, mode) {
  const key = mode === 'relevo' ? (p) => p.stats.danceBeats : mode === 'golpe' ? (p) => p.stats.rounds * 1000 + p.score : (p) => p.score;
  return [...players].sort((a, b) => key(b) - key(a) || b.score - a.score || a.order - b.order);
}

// End-of-game titles: each goes to the one pana who earned it most.
export function awardTitles(players) {
  const best = (score, min = 1e-9) => {
    let top = null;
    for (const p of players) { const s = score(p); if (s != null && s >= min && (!top || s > top.s)) top = { p, s }; }
    return top?.p;
  };
  const titles = [];
  const give = (key, p, detail) => { if (p) titles.push({ key, id: p.id, title: TITLES[key], detail }); };
  give('rey', best(p => p.stats.danceBeats), locKey('más tiempo bailando en el centro'));
  give('mano', best(p => p.stats.drum), locKey('el mejor tambor de la rueda'));
  give('suda', best(p => p.stats.longest, SWEATY / 2), locKey('el turno más largo sin salir'));
  give('plomo', best(p => p.stats.fastestKick == null ? null : 1000 - p.stats.fastestKick), locKey('lo sacaron más rápido que a nadie'));
  give('mocho', best(p => p.stats.wait), locKey('el que más esperó en la gente'));
  give('palo', best(p => p.stats.perfect), locKey('más llamados perfectos'));
  return titles;
}
