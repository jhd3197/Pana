// The local judge: every pana's hits are judged against the music playing on
// their own computer, so voice chat delay and online lag never ruin anyone's
// timing. It keeps the running counters the host reads from the input
// (rules.js cleanInput). Pure: times in, grades out, no DOM.
import { chart, secondsPerBeat, songFor, isGolpeBeat, STATION_INFO } from './songs.js';
import { loc } from '/engine/i18n.js';

export const PERFECT = .05, GOOD = .13, HOLD_SLACK = .16, CLAP = .12, JUMP = .16, ECHO = .15;
// The key each move listens for (vuelta also needs its arrow first).
const MOVE_KEY = { cadera: ['left', 'right'], vuelta: ['space'], panuelo: ['space'], abajo: ['down'], pegate: ['up'], golpe: ['space'] };
const LANE = { left: 0, right: 1 };

export class Judge {
  constructor() { this.reset(0, null); }

  reset(songN, track) {
    Object.assign(this, { songN, track, drum: { p: 0, g: 0, m: 0, s: 0 }, clap: { on: 0, off: 0 }, sent: [], mine: new Map(),
      done: new Set(), next: 0, holding: null, lastArrow: null, taps: [], tapRound: 0, echo: null, flash: null, combo: 0 });
  }

  // Follow the snapshot: the song, my role and the calls addressed to me.
  sync(state, me) {
    if (!state.song) return;
    if (state.song.n !== this.songN || state.round !== this.round) { this.round = state.round; this.reset(state.song.n, state.song.track); }
    this.state = state; this.me = me;
    const p = state.players.find(x => x.id === me);
    this.role = p?.role ?? 'crowd'; this.station = p?.station ?? null;
    for (const call of state.calls || []) if (call.to === me && !this.mine.has(call.id)) this.mine.set(call.id, { call, press: null, grade: null, done: false });
    // Out of the center: calls still pending for me were dropped by the host.
    if (this.role !== 'dancer') for (const cs of this.mine.values()) cs.done = true;
  }

  get song() { return songFor(this.track ?? 0); }
  get spb() { return secondsPerBeat(this.song); }
  get golpeMode() { return this.state?.options?.mode === 'golpe'; }
  notes() { return this.station && !this.golpeMode ? chart(this.song, this.station) : []; }

  input() {
    return { song: this.songN, drum: { ...this.drum }, clap: { ...this.clap }, calls: this.sent.slice(-8),
      golpe: this.echo ? { round: this.echo.round, ok: this.echo.ok } : null };
  }

  show(kind, grade, text, t) { this.flash = { kind, grade, text, t }; }

  // A key went down at song time t (seconds, latency already removed).
  press(key, t) {
    if (!this.state?.song) return null;
    if (LANE[key] == null && key !== 'space' && key !== 'up' && key !== 'down') return null;
    if (this.golpeMode) return this.role === 'drum' ? this.tap(key, t) : this.clapAt(t);
    if (this.role === 'drum') return this.strike(key, t);
    if (this.role === 'dancer') return this.dance(key, t);
    return key === 'space' ? this.clapAt(t) : null;
  }

  release(key, t) {
    if (this.holding && this.role === 'drum') {
      const { note, grade } = this.holding, end = (note.beat + note.len) * this.spb;
      this.holding = null;
      if (t >= end - HOLD_SLACK) return this.count(grade);
      return this.count('miss', loc('Soltaste antes'));
    }
    if (this.role !== 'dancer') return null;
    for (const cs of this.mine.values()) {
      const { move, beat, len } = cs.call;
      if (cs.done || cs.press == null || (move !== 'panuelo' || key !== 'space') && (move !== 'abajo' || key !== 'down')) continue;
      if (t < (beat + len) * this.spb - HOLD_SLACK) return this.finish(cs, 'miss', loc('Soltaste antes'), t);
    }
    return null;
  }

  // ---------- drums ----------
  strike(key, t) {
    const lanes = STATION_INFO[this.station]?.lanes ?? 1;
    const lane = lanes > 1 ? LANE[key] : 0;
    if (lane == null) return null;
    let best = null;
    for (const note of this.notes()) {
      const at = note.beat * this.spb;
      if (at - t > GOOD) break;
      if (this.done.has(note.i) || note.lane !== lane || Math.abs(at - t) > GOOD) continue;
      if (!best || Math.abs(at - t) < Math.abs(best.beat * this.spb - t)) best = note;
    }
    if (!best) { this.drum.s++; this.combo = 0; this.show('drum', 'stray', '', t); return { kind: 'drum', lane, grade: 'stray' }; }
    this.done.add(best.i);
    const grade = Math.abs(best.beat * this.spb - t) <= PERFECT ? 'perfect' : 'good';
    if (best.len > 0) { this.holding = { note: best, grade }; this.show('drum', 'hold', loc('¡Mantén!'), t); return { kind: 'drum', lane, grade: 'hold', note: best }; }
    this.count(grade);
    return { kind: 'drum', lane, grade, note: best };
  }

  count(grade, text) {
    this.drum[grade === 'perfect' ? 'p' : grade === 'good' ? 'g' : 'm']++;
    this.combo = grade === 'miss' ? 0 : this.combo + 1;
    this.show('drum', grade, text ?? (grade === 'perfect' ? loc('¡Perfecto!') : grade === 'good' ? loc('¡Bien!') : loc('Fallaste')), this.lastT);
    return { kind: 'drum', grade };
  }

  // ---------- dance ----------
  dance(key, t) {
    if (key === 'left' || key === 'right') this.lastArrow = { key, t };
    const spb = this.spb;
    for (const cs of this.mine.values()) {
      if (cs.done || cs.press == null) continue;
      const hit = cs.call.beat * spb;
      if (cs.call.move === 'golpe' && t > cs.press && t <= hit + spb) return this.finish(cs, 'miss', loc('¡Quieto en el golpe!'), t);
      if (cs.call.move === 'pegate' && key === 'up' && t <= hit + spb) return this.finish(cs, 'miss', loc('¡Choque!'), t);
    }
    for (const cs of this.mine.values()) {
      const { move, beat, w, dir } = cs.call, hit = beat * spb;
      if (cs.done || cs.press != null || Math.abs(t - hit) > w || !MOVE_KEY[move].includes(key)) continue;
      if (move === 'vuelta' && (this.lastArrow?.key !== dir || t - this.lastArrow.t > spb * 1.5 + w)) {
        return this.finish(cs, 'miss', dir === 'left' ? loc('Era a la izquierda') : loc('Era a la derecha'), t);
      }
      const grade = Math.abs(t - hit) <= Math.max(PERFECT, w * .35) ? 'perfect' : 'good';
      if (move === 'cadera' || move === 'vuelta') return this.finish(cs, grade, null, t);
      cs.press = t; cs.grade = grade;
      return { kind: 'dance', grade: 'hold', move };
    }
    return null;
  }

  finish(cs, grade, text, t) {
    cs.done = true; cs.grade = grade;
    this.sent.push([cs.call.id, grade]);
    if (this.sent.length > 16) this.sent.shift();
    this.show('dance', grade, text ?? (grade === 'perfect' ? loc('¡Perfecto!') : grade === 'good' ? loc('¡Eso!') : loc('Fallaste')), t);
    return { kind: 'dance', grade, move: cs.call.move, id: cs.call.id };
  }

  // The call I should be watching: the earliest one not done yet.
  current() {
    let best = null;
    for (const cs of this.mine.values()) if (!cs.done && (!best || cs.call.beat < best.call.beat)) best = cs;
    return best;
  }

  // ---------- crowd ----------
  clapAt(t) {
    if (t < 0) return null;
    const beat = t / this.spb, off = Math.abs(beat - Math.round(beat)) * this.spb, on = off <= CLAP;
    this.clap[on ? 'on' : 'off']++;
    this.show('clap', on ? 'good' : 'miss', on ? loc('¡Bulla!') : loc('Fuera de tiempo'), t);
    return { kind: 'clap', grade: on ? 'good' : 'miss' };
  }

  // Relevo: is t on a "¡Golpe!" beat? The host trusts this, like every grade.
  jump(t) {
    const beat = Math.round(t / this.spb / 4) * 4;
    const ok = isGolpeBeat(this.song, beat) && Math.abs(t - beat * this.spb) <= JUMP;
    return { beat, ok };
  }

  // ---------- ¡Golpe! ----------
  tap(key, t) {
    const g = this.state.golpe, lane = LANE[key] ?? (key === 'space' ? 0 : null);
    if (!g?.notes || lane == null) return null;
    if (g.round !== this.tapRound) { this.tapRound = g.round; this.taps = []; }
    const from = (g.start + g.len) * this.spb - ECHO, to = (g.start + g.len * 2) * this.spb;
    if (t < from || t > to) return { kind: 'tap', lane, grade: 'stray' };
    this.taps.push([t, lane]);
    return { kind: 'tap', lane, grade: 'good' };
  }

  // Did my answer match the MCP's pattern? Every note hit in its lane, no extras.
  echoResult(g) {
    const taps = g.round === this.tapRound ? [...this.taps] : [], used = new Set();
    let matched = 0;
    for (const [off, lane] of g.notes) {
      const at = (g.start + g.len + off) * this.spb;
      const k = taps.findIndex(([t, l], i) => !used.has(i) && l === lane && Math.abs(t - at) <= ECHO);
      if (k >= 0) { used.add(k); matched++; }
    }
    return matched === g.notes.length && taps.length === g.notes.length;
  }

  // ---------- time passing ----------
  update(t) {
    if (!this.state?.song) return;
    this.lastT = t;
    const spb = this.spb, notes = this.notes();
    if (this.role === 'drum') {
      if (this.holding && t >= (this.holding.note.beat + this.holding.note.len) * spb) { const { grade } = this.holding; this.holding = null; this.count(grade); }
      while (this.next < notes.length && notes[this.next].beat * spb + GOOD < t) {
        const note = notes[this.next++];
        if (!this.done.has(note.i)) { this.done.add(note.i); this.count('miss'); }
      }
    }
    for (const cs of this.mine.values()) {
      if (cs.done) continue;
      const { beat, w, len } = cs.call, hit = beat * spb;
      if (cs.press == null && t > hit + w) this.finish(cs, 'miss', null, t);
      else if (cs.press != null && t >= (beat + len) * spb) this.finish(cs, cs.grade, null, t);
    }
    const g = this.state.golpe;
    if (this.golpeMode && g?.notes && this.role === 'drum' && this.echo?.round !== g.round && t > (g.start + g.len * 2) * spb + .2) {
      const ok = this.echoResult(g);
      this.echo = { round: g.round, ok };
      this.show('golpe', ok ? 'perfect' : 'miss', ok ? loc('¡Lo sacaste!') : loc('No era así'), t);
    }
  }
}
