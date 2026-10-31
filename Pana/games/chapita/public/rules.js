// Chapita: pure rules, plain data in and out (no DOM, no Three.js), so the
// host, the screen and Node tests all share them. Two teams of four on the
// street (seat % 2 is the team), bots fill every empty seat. The pitcher picks
// a pitch in secret; the batter reads the cap and swings with timing and a
// height; where the chapita lands is the hit, and runners move on their own.
// The host calls advance(dt) for bots and timers; everything else is accept().
import { draw, clamp } from '/engine/random.js';
import { locKey } from '../../../engine/i18n.js';
import { defaultOptions, roomOptions } from './options.js';
import { PITCHES, PITCH_KINDS, CAPS, ROWS, FIELDERS, pitchTarget, arrivalRow, hitVelocity, traceHit } from './field.js';
import { chooseJugada, jugadaSeconds, pitchFlavor, beaned } from './jugadas.js';

export const SEATS = 8;
export const TEAM_SIZE = 4;
export const STRIKES = 3, BALLS = 4, OUTS = 3;
export const DERBY_PITCHES = 10;
export const SWING_WINDOW = .18;     // seconds either side of the arrival
export const CATCH_WINDOW = .16;
export const PITCH_SECONDS = 15;     // a pana's time to pick a pitch
export const BARRIOS = ['23 de Enero', 'Los Frailes', 'Catia', 'Lídice', 'Ruperto Lugo'];   // i18n-ignore: place names
// Barrio apodos for the bots, on the back of their franela.
export const BOT_NAMES = ['El Flaco', 'Chigüire', 'Cabezón', 'Gocho', 'Catire', 'Tripa', 'Pelúo', 'Cachete'];   // i18n-ignore: nicknames
export const ABUELO = 'El Abuelo';   // i18n-ignore: a character's name
export const HOUSE_RULES = {
  carro: locKey('Carro que pasa = tiempo'),
  azotea: locKey('El que la tire a la azotea, sale'),
  ventana: locKey('Ventana = out'),
  zurdos: locKey('Zurdos batean doble'),
};
export const TITLES = [
  ['hr', locKey('Cuarto bate'), locKey('más jonrones')],
  ['k', locKey('Brazo de oro'), locKey('más ponches como pitcher')],
  ['catches', locKey('Manos de seda'), locKey('más atrapadas')],
  ['chapazos', locKey('Tuyuyo'), locKey('más chapazos en la cara')],
  ['shortOuts', locKey('Ni a la acera'), locKey('más outs por batazos cortos')],
  ['comebacks', 'Willy Mays', locKey('la mejor remontada')],
];
const HIT_BASES = { sencillo: 1, wall: 1, car: 2, post: 3, jonron: 4 };
// Text in state is a Spanish source (locKey) plus vars; each screen shows it
// through loc() in its own language.
const STYLE_TEXT = { vieja: locKey('Vieja escuela'), nueva: locKey('Nueva escuela'), abuelo: locKey('Leyenda del barrio') };

const stats = () => ({ hr: 0, hits: 0, runs: 0, k: 0, catches: 0, chapazos: 0, shortOuts: 0, comebacks: 0, strikeouts: 0 });
const bot = (seat) => ({ seat, id: null, name: BOT_NAMES[seat], avatar: {}, team: seat % 2, zurdo: false,
  style: seat % 4 < 2 ? 'vieja' : 'nueva', skill: .55 + (seat % 3) * .08 });
export const teamSeats = (team) => Array.from({ length: TEAM_SIZE }, (_, i) => team + i * 2);
export const styleText = (p) => STYLE_TEXT[p.style] || '';
const pick = (state, list) => list[Math.floor(draw(state) * list.length) % list.length];
const gauss = (state) => (draw(state) + draw(state) + draw(state) - 1.5) / .5;
const valid = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;

export class ChapitaGame {
  constructor(seed = Date.now()) {
    this.seed = (seed >>> 0) || 1;
    this.options = defaultOptions();
    this.players = Array.from({ length: SEATS }, (_, seat) => ({ ...bot(seat), stats: stats(), atBats: [], tuyuyo: false }));
    this.teams = [{ name: BARRIOS[0], runs: 0, hits: 0, line: [] }, { name: BARRIOS[1], runs: 0, hits: 0, line: [] }];
    Object.assign(this, { phase: 'lobby', clock: 0, inning: 1, half: 0, outs: 0, strikes: 0, balls: 0, bases: [null, null, null],
      lineup: [0, 0], batter: null, pitcher: null, fielders: [], pitch: null, swing: null, botSwing: null, hit: null,
      result: null, shown: 0, deadline: 0, holdUntil: 0, hold: null, holdNext: null, rules: [], derby: null, willy: false,
      event: null, winner: null, titles: [], round: 0, pitches: 0, lastRuns: 0, revision: 0, ledger: {} });
  }

  snapshot() { return JSON.parse(JSON.stringify(this)); }

  // A new host rebuilds the game from the last snapshot; seats whose pana has
  // gone are bots again, keeping their stats and their place in the lineup.
  static restore(state, members) {
    const game = Object.assign(new ChapitaGame(), JSON.parse(JSON.stringify(state)));
    for (const p of game.players) if (p.id !== null && !members.has(p.id)) Object.assign(p, bot(p.seat), { zurdo: p.zurdo });
    return game;
  }

  // A pana sits in their own seat or takes a bot's; a full street watches.
  addPlayer(id, name, avatar = {}) {
    const p = this.players.find(p => p.id === id) || this.players.find(p => p.id === null);
    if (!p || (p.id === id && p.name === name && JSON.stringify(p.avatar) === JSON.stringify(avatar))) return false;
    if (p.id !== id) p.zurdo = false;
    Object.assign(p, { id, name: String(name || 'Pana').slice(0, 18), avatar, style: null, skill: .7 }); this.revision++; return true;   // i18n-ignore: a name
  }
  removePlayer(id) {
    const p = this.players.find(p => p.id === id);
    if (p) { Object.assign(p, bot(p.seat), { zurdo: p.zurdo }); this.revision++; }
  }

  // ---------- the game ----------
  start() {
    for (const p of this.players) Object.assign(p, { stats: stats(), atBats: [], tuyuyo: false });
    const [home, away] = this.pickBarrios();
    this.teams = [{ name: away, runs: 0, hits: 0, line: [] }, { name: home, runs: 0, hits: 0, line: [] }];
    // A rare bot is El Abuelo, back after 50 years.
    const bots = this.players.filter(p => p.id === null);
    for (const p of bots) Object.assign(p, bot(p.seat), { zurdo: draw(this) < .25 });
    if (bots.length && draw(this) < .3) Object.assign(pick(this, bots), { name: ABUELO, style: 'abuelo', skill: .93 });
    this.rules = this.options.houseRules === 'ruleta' && this.options.mode === 'caimanera'
      ? Object.keys(HOUSE_RULES).sort(() => draw(this) - .5).slice(0, 2).sort() : [];
    Object.assign(this, { inning: 1, half: 0, outs: 0, strikes: 0, balls: 0, bases: [null, null, null], lineup: [0, 0],
      pitch: null, swing: null, botSwing: null, hit: null, result: null, hold: null, holdNext: null, holdUntil: 0,
      winner: null, titles: [], pitches: 0, derby: null, willy: false });
    this.round++;
    if (this.options.mode === 'derby') {
      const humans = this.players.filter(p => p.id !== null).map(p => p.seat), order = [...humans];
      for (const p of this.players) if (order.length < 2 && !order.includes(p.seat)) order.push(p.seat);
      this.derby = { order, index: 0, left: DERBY_PITCHES };
      this.pitcher = null; this.fielders = [];
      this.newBatter(order[0]);
    } else this.startHalf();
    this.phase = 'pitch'; this.armPitch(); this.revision++;
  }

  pickBarrios() {
    const a = Math.floor(draw(this) * BARRIOS.length), b = (a + 1 + Math.floor(draw(this) * (BARRIOS.length - 1))) % BARRIOS.length;
    return [BARRIOS[a], BARRIOS[b]];
  }

  get battingTeam() { return this.half; }
  get fieldingTeam() { return 1 - this.half; }

  // Pitchers take turns each half; the other three stand on the street.
  startHalf() {
    const field = teamSeats(this.fieldingTeam), pitcherIndex = (this.inning - 1) % TEAM_SIZE;
    this.pitcher = field[pitcherIndex];
    this.fielders = field.filter(s => s !== this.pitcher);
    Object.assign(this, { outs: 0, bases: [null, null, null] });
    if (this.teams[this.half].line.length < this.inning) this.teams[this.half].line[this.inning - 1] = 0;
    this.newBatter(teamSeats(this.battingTeam)[this.lineup[this.battingTeam]]);
  }

  newBatter(seat) {
    Object.assign(this, { batter: seat, strikes: 0, balls: 0 });
    const p = this.players[seat], slot = this.derby ? -1 : this.lineup[this.battingTeam];
    this.willy = !this.derby && p.atBats.length === 2 && p.atBats.every(a => a === 'k');
    const vars = { name: p.name };
    if (this.willy) this.say('willy', locKey('¡No te hagas el Willy Mays, {name}!'), seat, vars);
    else if (slot === 3) this.say('cuarto', locKey('¡Cuarto bate! {name} al palo'), seat, vars);
    else this.say('batter', locKey('Al bate: {name}'), seat, vars);
  }

  // A new pitch: the pitcher's clock, a passing car (house rule) and the
  // señora's pause after a window shot.
  armPitch() {
    this.pitch = null; this.swing = null; this.botSwing = null; this.hit = null; this.result = null;
    const human = this.pitcher !== null && this.players[this.pitcher].id !== null;
    this.deadline = this.clock + (human ? PITCH_SECONDS : this.options.cpuSeconds + draw(this) * .6);
    this.hold = null; this.holdUntil = 0;
    if (this.holdNext) { this.hold = 'senora'; this.holdUntil = this.clock + 5; this.holdNext = null; }
    else if (this.rules.includes('carro') && draw(this) < .14) {
      this.hold = 'carro'; this.holdUntil = this.clock + 3.4; this.say('tiempo', locKey('¡Carro! ¡Tiempo, tiempo!'));
    }
    if (human) this.deadline = Math.max(this.deadline, this.holdUntil + 6);
  }

  capFor(choice) { return this.options.caps === 'libre' ? (CAPS[choice] ? choice : 'plana') : this.options.caps; }

  // The pitch leaves the hand: a control error from the cap and a wobble.
  throw(choice) {
    if (this.phase !== 'pitch' || this.clock < this.holdUntil) return false;
    const cap = this.capFor(choice.cap), c = CAPS[cap];
    const pitch = { id: ++this.pitches, kind: choice.kind, row: choice.row, col: choice.col, side: choice.side === -1 ? -1 : 1, cap,
      miss: [gauss(this) * c.control, gauss(this) * c.control],
      wobble: { a: c.wobble * (.6 + draw(this) * .6), f: 2.2 + draw(this) * 2.6, ph: draw(this) * Math.PI * 2, tilt: draw(this) * Math.PI },
      time: PITCHES[choice.kind].time + (cap === 'doblada' ? (draw(this) - .5) * .1 : 0), at: this.clock };
    pitch.target = pitchTarget(pitch); pitch.arrives = arrivalRow(pitch.target); pitch.flavor = pitchFlavor(pitch, this.strikes);
    this.pitch = pitch; this.phase = 'flight'; this.hold = null;
    if (this.players[this.batter].id === null) this.botSwing = this.botBat();
    this.revision++; return true;
  }

  // How wide the batter's timing window is for this pitch.
  window(seat = this.batter, pitch = this.pitch) {
    const p = this.players[seat], slot = this.derby ? -1 : teamSeats(p.team).indexOf(seat);
    let w = (p.id === null ? .12 : SWING_WINDOW) * (1 - .25 * Math.min(1, Math.abs(pitch.target.x) / .8));
    if (slot === 3) w *= 1.25;
    if (p.tuyuyo) w *= .85;
    if (pitch.kind === 'curva') w *= (pitch.side === (p.zurdo ? 1 : -1)) ? .85 : 1.12;   // breaking in on the hands is harder
    return w;
  }

  // The swing (or none): strike, foul, ball or contact.
  swingAt(swing) {
    if (this.phase !== 'flight') return false;
    const pitch = this.pitch, p = this.players[this.batter];
    this.swing = swing ? { height: swing.height, t: swing.t } : null;
    if (beaned(pitch, p.zurdo)) return this.hitByPitch();
    if (!swing) {
      if (pitch.arrives) return this.strike('looking');
      this.balls++; if (this.balls >= BALLS) return this.walk();
      return this.show('ball', locKey('¡Bola!'), 1, false, this.jugada(pitch.cap === 'doblada' ? 'ball-doblada' : 'ball'));
    }
    const w = this.window(), dt = swing.t - pitch.time, rowGap = pitch.arrives ? Math.abs(ROWS.indexOf(swing.height) - ROWS.indexOf(pitch.arrives)) : 9;
    if (Math.abs(dt) > w || rowGap > 1) return this.strike(pitch.kind === 'cae' && swing.height !== 'bajo' ? 'drop' : 'swinging');
    if (rowGap === 1) return Math.abs(dt) < w * .55 ? this.foul(locKey('¡Foul! La rozó')) : this.strike('swinging');
    const q = 1 - Math.abs(dt) / w, pull = p.zurdo ? 1 : -1;
    const dir = (dt < 0 ? pull : -pull) * (Math.abs(dt) / w) * .62 + (draw(this) - .5) * .18;
    const popup = draw(this) < .1;
    const launch = popup ? 1 + draw(this) * .25 : .2 + draw(this) * .5 + (pitch.arrives === 'bajo' ? .08 : pitch.arrives === 'alto' ? -.06 : 0);
    const speed = 8 + 11.5 * q ** .8 + (this.willy ? 3.5 : 0) + (this.derby ? 1.2 : 0) - (pitch.cap === 'doblada' ? .8 : 0);
    const hit = { id: pitch.id, from: { x: pitch.target.x, y: pitch.target.y, d: .3 }, vel: hitVelocity(speed, launch, dir), q, at: this.clock };
    const fielders = this.derby ? [] : this.fielders.map((seat, i) => ({ ...FIELDERS[i], seat }));
    const trace = traceHit(hit, fielders);
    hit.end = { kind: trace.kind, t: trace.t, point: trace.point };
    hit.chance = trace.chance ? { ...trace.chance, seat: fielders[trace.chance.fielder].seat } : null;
    hit.caught = null; hit.chapazo = false; hit.after = null;
    hit.jugada = q < .25 ? this.jugada('weak-contact') : null;
    if (hit.chance && this.players[hit.chance.seat].id === null) hit.botCatch = this.botCatch(hit.chance);
    this.hit = hit; this.phase = 'hit'; this.say('contact', q > .85 ? locKey('¡Palo!') : locKey('¡Le pegó!'), this.batter);
    this.revision++; return true;
  }

  strike(how) {
    const p = this.players[this.batter];
    this.strikes++;
    const look = how === 'looking' ? 'looking' : 'swinging';
    if (this.strikes < STRIKES) return this.show('strike', how === 'looking' ? locKey('¡Strike mirando!') : how === 'drop' ? locKey('¡Me agarró fuera de base!') : locKey('¡Abanicó! Strike'), 1, false, this.jugada(`strike-${look}`));
    if (this.pitcher !== null) this.players[this.pitcher].stats.k++;
    p.stats.strikeouts++;
    const text = p.id === null && draw(this) < .5 ? locKey('¡Ponchado! No llevas aura. «Le podía pegar, pero no sabía lanzarla»') : locKey('¡Ponchado! No llevas aura.');
    return this.endAtBat('k', 'out', text, 1.9, this.jugada(`strikeout-${look}`));
  }

  foul(text = locKey('¡Foul!'), jugada = null) {
    if (this.strikes < STRIKES - 1) this.strikes++;
    return this.show('foul', text, 1.1, false, jugada);
  }

  // A pitch high and inside: a chapazo to the batter, who walks to first.
  hitByPitch() {
    const p = this.players[this.batter];
    p.tuyuyo = true; p.stats.chapazos++;
    if (this.derby) return this.show('hbp', locKey('¡Chapazo! A {name} le salió un tuyuyo'), 2, false, 'bean', { name: p.name });
    this.moveRunners(0, true);
    return this.endAtBat('walk', 'hbp', locKey('¡Chapazo! A {name} le salió un tuyuyo · camina a primera'), 2, 'bean', { name: p.name });
  }

  // The host's pick for this moment (jugadas.js); null when nothing special happens.
  jugada(situation) { return chooseJugada(this.seed, this.pitches * 4 + this.shown, situation); }

  walk() {
    this.moveRunners(0, true);
    return this.endAtBat('walk', 'walk', locKey('Base por bolas: camina a primera'), 1.6);
  }

  // The batted chapita has finished: a catch, a chapazo or wherever it fell.
  finishPlay() {
    const hit = this.hit, p = this.players[this.batter];
    if (hit.caught) {
      this.players[hit.chance.seat].stats.catches++;
      return this.endAtBat('out', 'caught', locKey('¡Atrapada! {name} con manos de seda'), 2, null, { name: this.players[hit.chance.seat].name });
    }
    if (hit.chapazo) return this.safeHit(1, locKey('¡Chapazo! A {name} le salió un tuyuyo'), 'chapazo', null, { name: this.players[hit.chance.seat].name });
    const kind = hit.end.kind, situation = kind === 'foul' && hit.end.point.y <= .01 ? 'foul-ground' : kind;
    if (this.derby) {
      if (kind === 'jonron') { p.stats.hr++; return this.show('jonron', locKey('¡La sacaste de jonrón!'), 2.4, false, this.jugada('jonron')); }
      return this.show(kind === 'foul' ? 'foul' : 'derby-miss', kind === 'short' ? locKey('¡Ni a la acera llegó!') : kind === 'foul' ? locKey('¡Foul!') : locKey('Se quedó en el campo'), 1.3, false, this.jugada(situation));
    }
    if (kind === 'foul') return this.foul(locKey('¡Foul!'), this.jugada(situation));
    if (kind === 'short') { p.stats.shortOuts++; return this.endAtBat('out', 'short', locKey('¡Ni a la acera llegó!'), 1.9, this.jugada('short')); }
    if (kind === 'window') {
      this.holdNext = 'senora';
      if (this.rules.includes('ventana')) return this.endAtBat('out', 'window', locKey('¡La ventana de la señora! Ventana = out'), 2.4, 'window');
      return this.show('window', locKey('¡La ventana de la señora! Ahí viene gritando…'), 2.4, false, 'window');
    }
    if (kind === 'jonron' && this.rules.includes('azotea')) return this.endAtBat('out', 'azotea', locKey('¡A la azotea! El que la tire a la azotea, sale'), 2.2, this.jugada('azotea'));
    let bases = HIT_BASES[kind];
    if (bases === 1 && p.zurdo && this.rules.includes('zurdos')) bases = 2;
    const text = { sencillo: locKey('Sencillo: pasó la acera'), wall: locKey('Sencillo de pared'), car: locKey('¡Doble! Le dio al carro'),
      post: locKey('¡Triple! ¡Al poste de luz!'), jonron: locKey('¡La sacaste de jonrón!') }[kind];
    return this.safeHit(bases, bases === 2 && kind !== 'car' ? locKey('¡Doble! Los zurdos batean doble') : text, kind, this.jugada(kind));
  }

  safeHit(bases, text, kind, jugada = null, vars = null) {
    const p = this.players[this.batter];
    p.stats.hits++; this.teams[this.battingTeam].hits++;
    if (bases === 4) p.stats.hr++;
    if (p.atBats.filter(a => a === 'k').length >= 2) p.stats.comebacks++;
    if (kind === 'chapazo') { const f = this.players[this.hit.chance.seat]; f.tuyuyo = true; f.stats.chapazos++; }
    this.moveRunners(bases);
    return this.endAtBat('hit', kind, text, bases === 4 ? 3 : 2, jugada, vars);
  }

  // Virtual bases: everyone moves on their own, like a scorecard.
  moveRunners(bases, forced = false) {
    const runs = [], next = [null, null, null], batter = this.batter;
    if (forced) {
      const b = this.bases; next.splice(0, 3, ...b);
      if (b[0] !== null) { if (b[1] !== null) { if (b[2] !== null) runs.push(b[2]); next[2] = b[1]; } next[1] = b[0]; }
      next[0] = batter;
    } else {
      for (let i = 2; i >= 0; i--) if (this.bases[i] !== null) { if (i + bases >= 3) runs.push(this.bases[i]); else next[i + bases] = this.bases[i]; }
      if (bases >= 4) runs.push(batter); else next[bases - 1] = batter;
    }
    this.bases = next;
    for (const seat of runs) this.players[seat].stats.runs++;
    const team = this.teams[this.battingTeam];
    team.runs += runs.length; team.line[this.inning - 1] = (team.line[this.inning - 1] || 0) + runs.length;
    this.lastRuns = runs.length;
  }

  // The at-bat ends: record it, count the out and show the result. The runs
  // that came in travel as a number; each screen words them (hud.js).
  endAtBat(atBat, kind, text, seconds, jugada = null, vars = null) {
    const p = this.players[this.batter];
    if (atBat !== 'walk') p.atBats.push(atBat === 'k' ? 'k' : atBat === 'out' ? 'out' : 'hit');
    if (atBat === 'k' || atBat === 'out') this.outs++;
    if (this.derby) { this.strikes = this.balls = 0; return this.show(kind, text, seconds, false, jugada, vars); }
    this.lineup[this.battingTeam] = (this.lineup[this.battingTeam] + 1) % TEAM_SIZE;
    this.show(kind, text, seconds, true, jugada, vars, this.lastRuns > 0 && atBat !== 'out' ? this.lastRuns : 0);
    this.lastRuns = 0;
    return true;
  }

  // text: a Spanish source whose {placeholders} come from vars; runs > 0
  // adds the runs that came in on screen.
  show(kind, text, seconds, atBatOver = false, jugada = null, vars = null, runs = 0) {
    if (this.derby) { this.derby.left--; atBatOver = this.derby.left <= 0; }
    this.result = { n: ++this.shown, kind, text, vars, runs, until: this.clock + jugadaSeconds(jugada, seconds), over: atBatOver, jugada };
    this.phase = 'result'; this.say(kind, text, this.batter, vars, runs);
    this.revision++; return true;
  }

  say(kind, text, seat = null, vars = null, runs = 0) { this.event = { n: (this.event?.n || 0) + 1, kind, text, vars, runs, seat }; }

  // After a result: the next pitch, the next batter, a new half or the end.
  next() {
    const result = this.result;
    if (this.derby) {
      if (result.over) {
        const d = this.derby; d.index++;
        if (d.index >= d.order.length) return this.finish();
        d.left = DERBY_PITCHES; this.newBatter(d.order[d.index]);
      }
      this.phase = 'pitch'; return this.armPitch();
    }
    if (this.walkOff()) return this.finish();
    if (this.outs >= OUTS) {
      if (result.kind !== 'cambio') {
        const jugada = this.jugada('cambio');
        const text = this.half ? locKey('Fin de la {inning}ª entrada') : locKey('¡Tres outs! Cambio de bando'), vars = { inning: this.inning };
        this.result = { n: ++this.shown, kind: 'cambio', text, vars, runs: 0, until: this.clock + jugadaSeconds(jugada, 2.4), over: true, jugada };
        this.say('cambio', text, null, vars); return;
      }
      if (this.half === 1) for (const p of this.players) p.tuyuyo = false;
      if (this.gameOver()) return this.finish();
      if (this.half === 1) { this.half = 0; this.inning++; } else this.half = 1;
      this.startHalf(); this.phase = 'pitch'; return this.armPitch();
    }
    if (result.over) this.newBatter(teamSeats(this.battingTeam)[this.lineup[this.battingTeam]]);
    this.phase = 'pitch'; this.armPitch();
  }

  walkOff() { return this.half === 1 && this.inning >= this.options.innings && this.teams[1].runs > this.teams[0].runs; }
  gameOver() {
    const [away, home] = this.teams.map(t => t.runs), last = this.inning >= this.options.innings;
    if (this.half === 0) return last && home > away;
    return last && (home !== away || this.inning >= this.options.innings + 2);
  }

  finish() {
    this.phase = 'finished'; this.pitch = null; this.hit = null;
    if (this.derby) {
      const best = Math.max(...this.derby.order.map(s => this.players[s].stats.hr));
      const top = this.derby.order.filter(s => this.players[s].stats.hr === best);
      this.winner = top.length === 1 ? top[0] : null;
    } else {
      const [away, home] = this.teams.map(t => t.runs);
      this.winner = away === home ? null : home > away ? 1 : 0;
    }
    this.titles = [];
    for (const [stat, title, why] of TITLES) {
      const best = Math.max(...this.players.map(p => p.stats[stat]));
      if (best > 0) { const p = this.players.find(p => p.stats[stat] === best); this.titles.push({ stat, title, why, seat: p.seat, value: best }); }
    }
    this.say('final', this.winner === null ? locKey('¡Empate! Se juega otra') : locKey('¡Se acabó la caimanera!'));
    this.revision++;
  }

  // ---------- bots ----------
  botPitch() {
    const p = this.pitcher === null ? { style: 'abuelo', skill: .6 } : this.players[this.pitcher];
    if (this.derby) return { kind: pick(this, ['planea', 'planea', 'cae', 'curva']), row: 1, col: 1, side: draw(this) < .5 ? -1 : 1, cap: 'plana' };
    const r = draw(this), kind = p.style === 'nueva' ? (r < .55 ? 'curva' : r < .8 ? 'cae' : 'planea') : p.style === 'vieja' ? (r < .5 ? 'cae' : r < .75 ? 'planea' : 'curva') : pick(this, PITCH_KINDS);
    const cap = p.style === 'nueva' ? (draw(this) < .6 ? 'doblada' : 'plana') : draw(this) < .3 ? 'doblada' : 'plana';
    // A float aimed high or a drop aimed low leaves the zone: bots mostly know.
    let row = Math.floor(draw(this) * 3);
    if ((kind === 'planea' && row === 0) || (kind === 'cae' && row === 2)) row = draw(this) < .8 ? 1 : row;
    return { kind, row, col: Math.floor(draw(this) * 3), side: draw(this) < .5 ? -1 : 1, cap };
  }

  botBat() {
    const p = this.players[this.batter], pitch = this.pitch, s = p.skill;
    if (!pitch.arrives) return draw(this) < (1 - s) * .6 ? { height: 'medio', t: pitch.time + gauss(this) * .08 } : null;
    if (draw(this) > .93) return null;
    const read = s - (pitch.kind === 'cae' ? .12 : pitch.kind === 'curva' ? .06 : 0) - (pitch.cap === 'doblada' ? .08 : 0);
    const index = ROWS.indexOf(pitch.arrives);
    const height = draw(this) < read ? pitch.arrives : ROWS[clamp(index + (draw(this) < .5 ? -1 : 1), 0, 2)];
    return { height, t: pitch.time + gauss(this) * (.15 * (1 - s) + .035) };
  }

  botCatch(chance) {
    const p = this.players[chance.seat];
    const odds = clamp(.45 + .4 * p.skill - Math.max(0, chance.speed - 12) * .03 - (p.tuyuyo ? .1 : 0), .15, .9);
    return draw(this) < odds ? 'catch' : chance.speed > 11 && draw(this) < .45 ? 'chapazo' : 'miss';
  }

  // The fielder's try: on the timing circle, or a chapazo to the face.
  catchTry(t) {
    const hit = this.hit, chance = hit.chance, miss = t === null ? Infinity : Math.abs(t - chance.t);
    if (miss <= CATCH_WINDOW) hit.caught = true;
    else { hit.caught = false; hit.chapazo = miss < .45 && chance.speed > 11; }
    if (hit.caught || hit.chapazo) hit.end = { kind: hit.caught ? 'caught' : 'chapazo', t: chance.t, point: chance.point };
    hit.after = hit.caught ? 'catch' : hit.chapazo ? 'bean' : null;
    if (hit.chapazo) this.say('chapazo', locKey('¡Chapazo! «¡Te lo dijera el tuerto Nelson!»'), chance.seat);
    this.revision++; return true;
  }

  // Bots and timers; true when something on screen changed.
  advance(dt) {
    if (!['pitch', 'flight', 'hit', 'result'].includes(this.phase)) return false;
    this.clock += dt;
    if (this.phase === 'pitch') {
      if (this.hold && this.clock >= this.holdUntil) { this.hold = null; this.revision++; return true; }
      if (this.clock < Math.max(this.deadline, this.holdUntil)) return false;
      return this.throw(this.botPitch());
    }
    if (this.phase === 'flight') {
      const pitch = this.pitch, human = this.players[this.batter].id !== null;
      if (!human && this.clock >= pitch.at + (this.botSwing ? this.botSwing.t : pitch.time + .3)) return this.swingAt(this.botSwing);
      if (human && this.clock >= pitch.at + pitch.time + 1.1) return this.swingAt(null);
      return false;
    }
    if (this.phase === 'hit') {
      const hit = this.hit, chance = hit.chance;
      if (chance && hit.caught === null) {
        const bot = this.players[chance.seat].id === null;
        if (bot && this.clock >= hit.at + chance.t) {
          if (hit.botCatch === 'catch') return this.catchTry(chance.t);
          if (hit.botCatch === 'chapazo') return this.catchTry(chance.t + .3);
          hit.caught = false; this.revision++; return true;
        }
        if (!bot && this.clock >= hit.at + chance.t + 1) return this.catchTry(null);
        // Do not score a landing while the human catch is still in flight.
        // The client starts its clock on receipt, so retain the full grace.
        return false;
      }
      if (this.clock < hit.at + hit.end.t + .45) return false;
      return this.finishPlay();
    }
    if (this.phase === 'result' && this.clock >= this.result.until) { this.next(); this.revision++; return true; }
    return false;
  }

  // ---------- actions ----------
  // One action from a member: { action, seq, revision }. A repeated seq is
  // refused; table actions also need the current revision, while a throw,
  // a swing or a catch names its pitch, so a join mid-pitch never eats one.
  accept(id, data, hostId) {
    if (!data || !Number.isSafeInteger(data.seq) || data.seq <= (this.ledger[id] || 0)) return false;
    const live = ['throw', 'swing', 'catch'].includes(data.action);
    if (!live && data.revision !== this.revision) return false;
    const seat = this.players.findIndex(p => p.id === id);
    if (data.action === 'options' && id === hostId && this.phase === 'lobby') {
      const next = roomOptions(this.options, data.options); if (!next) return false;
      this.ledger[id] = data.seq; this.options = next; this.revision++; return true;
    }
    if (data.action === 'start') {
      if (id !== hostId || !['lobby', 'finished'].includes(this.phase)) return false;
      this.ledger[id] = data.seq; this.start(); return true;
    }
    if (seat < 0) return false;
    if (data.action === 'hand') {
      if (this.phase === 'flight' && this.batter === seat) return false;
      this.ledger[id] = data.seq; this.players[seat].zurdo = !this.players[seat].zurdo; this.revision++; return true;
    }
    if (data.action === 'switch' && this.phase === 'lobby') {
      const other = this.players.find(p => p.id === null && p.team !== this.players[seat].team);
      if (!other) return false;
      const me = this.players[seat];
      for (const key of ['id', 'name', 'avatar', 'zurdo', 'style', 'skill']) [me[key], other[key]] = [other[key], me[key]];
      Object.assign(me, bot(me.seat));
      this.ledger[id] = data.seq; this.revision++; return true;
    }
    if (data.action === 'throw') {
      const c = data.pitch;
      if (seat !== this.pitcher || !c || !PITCHES[c.kind] || ![0, 1, 2].includes(c.row) || ![0, 1, 2].includes(c.col)) return false;
      if (!this.throw({ kind: c.kind, row: c.row, col: c.col, side: c.side, cap: c.cap })) return false;
      this.ledger[id] = data.seq; return true;
    }
    if (data.action === 'swing') {
      if (this.phase !== 'flight' || seat !== this.batter || data.pitch !== this.pitch.id || !ROWS.includes(data.height) || !valid(data.t, 0, 4)) return false;
      this.ledger[id] = data.seq; return this.swingAt({ height: data.height, t: data.t });
    }
    if (data.action === 'catch') {
      const hit = this.hit;
      if (this.phase !== 'hit' || !hit?.chance || hit.caught !== null || hit.chance.seat !== seat || data.hit !== hit.id || !valid(data.t, 0, 6)) return false;
      this.ledger[id] = data.seq; return this.catchTry(data.t);
    }
    return false;
  }
}

// What the HUD needs to know about a seat's role in the current pitch.
export function roleOf(state, seat) {
  if (seat < 0) return 'fan';
  if (state.batter === seat) return 'batter';
  if (state.pitcher === seat) return 'pitcher';
  if (state.fielders?.includes(seat)) return 'fielder';
  return state.derby ? 'fan' : state.players[seat].team === state.half ? 'bench' : 'fan';
}
