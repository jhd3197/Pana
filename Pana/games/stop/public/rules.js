// ¡Stop!: pure rules, plain data in and out (no DOM, no Three.js), so the
// host, the screen and Node tests all share them. A round: the turn pana
// stops the letter wheel, everyone fills a secret sheet, the first one done
// yells ¡STOP! (3 s for the rest), then the table reviews one category at a
// time and votes on the answers the game doesn't know. Sheets never travel in
// snapshots before the review: each client keeps its own and sends it at
// pencils-down.
import { draw } from '/engine/random.js';
import { findEntry, wordsFor, letterOf, soundKey, isCrude, categoryLabel } from '/engine/play/saber-match.js';
import { defaultOptions, roomOptions } from './options.js';

export const SEATS = 8;
export const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
export const HARD = ['Ñ', 'Q', 'W', 'X', 'Y', 'Z'];
export const CLASICAS = ['nombre', 'apellido', 'pais', 'ciudad', 'animal', 'fruta', 'color', 'cosa'];
export const CRIOLLAS = ['estado', 'comida', 'palabra', 'dicho', 'pelotero', 'musica', 'lugar', 'marca', 'carinoso'];
// ¡Basta! gives the rest 5 s: at 3 s panas mid-word lost answers they were typing.
export const TIMES = { letter: 2.8, basta: 5, collect: 6, show: 3.4, vote: 10, result: 3, tally: 5.5, spinAuto: 9, rapido: 30 };
export const POINTS = { unique: 100, shared: 50, creative: 50 };
export const MAX_ANSWER = 32;
export const BOT_NAMES = ['Coco', 'Lola', 'Cheo', 'Nena', 'Toño', 'Mari', 'Pepe', 'Cuqui'];
// Two bots from the reel: the rules guy and the troll.
export const PERSONALITY = ['normal', 'normal', 'estricto', 'normal', 'normal', 'creativo', 'normal', 'normal'];
export const PERSONALITY_TEXT = { estricto: 'El estricto', creativo: 'El pana creativo', normal: '' };
const LEVEL = { faciles: { fill: .55, finish: [.85, 1.25] }, normales: { fill: .8, finish: [.5, .9] }, dificiles: { fill: .95, finish: [.28, .55] } };
const SECRET = ['spin', 'letter', 'write', 'basta', 'collect'];

const freshStats = () => ({ stops: 0, creative: 0, rejected: 0, thumbsDown: 0, empty: 0 });
const bot = (seat) => ({ seat, id: null, name: BOT_NAMES[seat], avatar: {}, total: 0, round: 0, filled: 0, submitted: false, sheet: null, stats: freshStats() });
const pick = (state, list) => list[Math.floor(draw(state) * list.length)];
const between = (state, [a, b]) => a + draw(state) * (b - a);

// One answer as the host keeps it: text only, no control characters, single
// spaces, at most MAX_ANSWER characters.
export function cleanAnswer(value) {
  if (typeof value !== 'string') return '';
  return [...value.replace(/[\u0000-\u001f\u007f-\u009f<>]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, MAX_ANSWER).join('').trim();
}
// "P", "P." or "Ppp" fills a box without an answer, only to call ¡STOP!
// first: a real answer has at least two different letters.
export function tooShort(answer) {
  return new Set(cleanAnswer(answer).toLowerCase().normalize('NFD').replace(/[^\p{L}]/gu, '')).size < 2;
}
export const cleanSheet = (sheet, count) => Array.from({ length: count }, (_, i) => cleanAnswer(Array.isArray(sheet) ? sheet[i] : ''));

// The letters the wheel can land on for these options.
export const lettersFor = (options) => ALPHABET.filter(l => options.hard || !HARD.includes(l));

// This game's categories: the set's own list first, then the rest.
export function pickCategories(state, options) {
  const shuffle = (list) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(draw(state) * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
  const count = options.mode === 'rapido' ? 3 : options.count;
  let order;
  if (options.set === 'criollas') order = [...shuffle(CRIOLLAS), ...shuffle(CLASICAS)];
  else if (options.set === 'mezcla') {
    const a = shuffle(CLASICAS), b = shuffle(CRIOLLAS); order = [];
    while (a.length || b.length) { if (a.length) order.push(a.shift()); if (b.length) order.push(b.shift()); }
  } else if (options.set === 'azar') order = shuffle([...CLASICAS, ...CRIOLLAS]);
  else order = [...(options.mode === 'rapido' ? shuffle(CLASICAS) : CLASICAS), ...shuffle(CRIOLLAS)];
  return order.slice(0, count);
}

// How the game reads one box. status: green (counts), red (doesn't), yellow
// (the table votes). reason: empty, short, letter, crude, known, typo, mesa,
// doubtful, close, unknown. key: what makes two answers "the same".
export function judge(answer, category, letter, { criollo = false, dictionary = [] } = {}) {
  const text = cleanAnswer(answer);
  if (!text) return { status: 'red', reason: 'empty', key: '' };
  const first = letterOf(text), own = `${category}:${soundKey(text)}`;
  if (tooShort(text)) return { status: 'red', reason: 'short', key: own };
  if (first !== letter) return { status: 'red', reason: 'letter', first, key: own };
  const mesa = dictionary.length ? findEntry(category, text, { extra: dictionary, base: false }) : null;
  const found = mesa || findEntry(category, text);
  if ((isCrude(text) || found?.entry.crude) && !criollo) return { status: 'red', reason: 'crude', key: own };
  if (!found) return { status: 'yellow', reason: 'unknown', key: own };
  const { entry } = found, key = `${category}:${soundKey(entry.word)}`, base = { word: entry.word, explain: entry.explain || '', key };
  if (mesa) return { status: 'green', reason: 'mesa', ...base };
  if (entry.doubtful || entry.crude) return { status: 'yellow', reason: 'doubtful', joke: entry.joke || null, ...base };
  if (letterOf(found.form) !== letter) return { status: 'yellow', reason: 'close', ...base, word: found.form };
  return { status: 'green', reason: found.how === 'typo' ? 'typo' : 'known', ...base };
}

// "Solo panas" leaves empty chairs empty: no bot spins, writes, votes or ranks.
export const seated = (state) => state.players.filter(p => p.id !== null || state.options?.withBots !== false);
export const ranking = (state) => seated(state).sort((a, b) => b.total - a.total || a.seat - b.seat);

export class StopGame {
  constructor(seed = Date.now()) {
    this.seed = (seed >>> 0) || 1;
    this.options = defaultOptions();
    this.players = Array.from({ length: SEATS }, (_, seat) => bot(seat));
    this.phase = 'lobby'; this.round = 0; this.rounds = this.options.rounds; this.categories = [];
    this.letter = null; this.used = []; this.spinner = 0; this.spinFrom = 0; this.limit = this.options.seconds;
    this.phaseTime = 0; this.timeLeft = 0; this.writeTime = 0; this.stopper = null; this.review = null;
    this.dictionary = []; this.hostLine = '¡Bienvenidos a la mesa de ¡Stop!!'; this.barks = []; this.barkId = 0;
    this.winner = null; this.titles = null; this.games = 0;
    this.revision = 0; this.ledger = {};
    this.plans = [];
  }

  // Sheets stay on each pana's screen until the review: before that, a
  // snapshot carries only how many boxes each one filled.
  snapshot() {
    const { plans, ...data } = this, out = JSON.parse(JSON.stringify(data));
    if (SECRET.includes(this.phase)) for (const p of out.players) p.sheet = null;
    return out;
  }

  // A new host rebuilds the game from the last snapshot. Hidden sheets were
  // never published: panas resend theirs at pencils-down and bots plan again.
  static restore(state, members) {
    const game = Object.assign(new StopGame(), JSON.parse(JSON.stringify(state)));
    for (const p of game.players) if (p.id !== null && !members.has(p.id)) Object.assign(p, { id: null, name: BOT_NAMES[p.seat], avatar: {} });
    if (SECRET.includes(game.phase)) for (const p of game.players) Object.assign(p, { sheet: null, submitted: false });
    if (game.options.withBots === false && game.phase === 'review') for (const p of game.players) if (p.id === null) game.leaveEmpty(p);
    game.plans = [];
    if (['write', 'basta', 'collect'].includes(game.phase)) game.planWriting(true);
    if (game.phase === 'collect') game.collectBots();
    if (game.phase === 'review' && game.review.stage === 'vote') game.planVotes();
    return game;
  }

  addPlayer(id, name, avatar = {}) {
    const p = this.players.find(p => p.id === id) || this.players.find(p => p.id === null);
    if (!p || (p.id === id && p.name === name && JSON.stringify(p.avatar) === JSON.stringify(avatar))) return false;
    const was = p.id, empty = was === null && this.options.withBots === false;
    Object.assign(p, { id, name, avatar });
    if (empty) Object.assign(p, { total: 0, round: 0, filled: 0, submitted: false, sheet: null, stats: freshStats() });
    // A pana sitting in a bot's chair mid-round writes their own sheet.
    if (was === null && SECRET.includes(this.phase)) { this.plans[p.seat] = null; p.filled = 0; p.submitted = false; p.sheet = null; }
    this.revision++; return true;
  }
  // A pana who leaves hands their chair, points and all, to a bot.
  removePlayer(id) {
    const p = this.players.find(p => p.id === id); if (!p) return;
    Object.assign(p, { id: null, name: BOT_NAMES[p.seat], avatar: {} });
    if (this.phase === 'spin' && p.seat === this.spinner) this.plans[p.seat] = { spinAt: this.phaseTime + 1.5 };
    if (this.options.withBots === false) this.leaveEmpty(p);
    else if (['write', 'basta'].includes(this.phase)) this.planBot(p, true);
    if (this.phase === 'collect' && !p.submitted) { this.collectBot(p); this.maybeReview(); }
    this.revision++;
  }

  // A chair emptied mid-review stops counting: its answers and pending votes go.
  leaveEmpty(p) {
    if (this.phase === 'collect') { Object.assign(p, { submitted: true }); this.maybeReview(); }
    const r = this.review;
    if (this.phase !== 'review' || !r) return;
    r.items = r.items.filter(i => i.seat !== p.seat);
    if (r.stage === 'vote') {
      for (const g of r.groups) { g.authors = g.authors.filter(s => s !== p.seat); delete g.votes[p.seat]; }
      if (r.groups.every(x => this.voters(x).every(v => v.seat in x.votes))) this.resolveVotes();
    }
  }

  get count() { return this.categories.length; }
  isBot(seat) { return this.players[seat]?.id === null; }

  start() {
    this.rounds = this.options.rounds; this.limit = this.options.mode === 'rapido' ? TIMES.rapido : this.options.seconds;
    this.categories = pickCategories(this, this.options);
    for (const p of this.players) Object.assign(p, { total: 0, round: 0, filled: 0, submitted: false, sheet: null, stats: freshStats() });
    Object.assign(this, { round: 0, used: [], winner: null, titles: null, review: null, stopper: null, letter: null });
    this.spinFrom = Math.floor(draw(this) * SEATS); this.games++;
    this.nextRound();
  }

  nextRound() {
    const turn = seated(this).length ? seated(this) : this.players;
    this.round++; this.spinner = turn[(this.spinFrom + this.round - 1) % turn.length].seat;
    for (const p of this.players) Object.assign(p, { round: 0, filled: 0, submitted: false, sheet: null });
    Object.assign(this, { phase: 'spin', phaseTime: 0, timeLeft: 0, letter: null, stopper: null, review: null });
    this.plans = []; this.plans[this.spinner] = { spinAt: between(this, [1.2, 2.6]) };
    this.hostLine = `Ronda ${this.round} de ${this.rounds}: ${this.players[this.spinner].name} gira la rueda. ¡Grítale «¡Para!»!`;
    this.revision++;
  }

  // ¡Para!: the wheel lands on a letter nobody has played this game.
  para(p) {
    if (this.phase !== 'spin' || (p && p.seat !== this.spinner)) return false;
    const all = lettersFor(this.options); let pool = all.filter(l => !this.used.includes(l));
    if (!pool.length) { this.used = []; pool = all; }
    this.letter = pick(this, pool); this.used.push(this.letter);
    this.phase = 'letter'; this.phaseTime = 0;
    this.hostLine = `¡Para! Salió la ${this.letter}.`;
    this.bark(this.spinner, '¡Para!'); this.revision++; return true;
  }

  startWrite() {
    Object.assign(this, { phase: 'write', phaseTime: 0, writeTime: 0, timeLeft: this.limit, stopper: null });
    this.hostLine = `Todo con ${this.letter}. ¡A escribir!`;
    this.plans = []; this.planWriting(false); this.revision++;
  }

  // What each bot writes and when, decided on the host and never published.
  planWriting(resume) { for (const p of seated(this)) if (p.id === null) this.planBot(p, resume); }
  planBot(p, resume) {
    const level = LEVEL[this.options.bots] || LEVEL.normales, creative = PERSONALITY[p.seat] === 'creativo';
    const answers = this.categories.map(cat => {
      if (draw(this) > level.fill) return '';
      const jokes = creative ? wordsFor(cat, this.letter, { doubtful: true }) : [];
      if (jokes.length && draw(this) < .35) return pick(this, jokes).form;
      const words = wordsFor(cat, this.letter);
      return words.length ? pick(this, words).form : '';
    });
    const finish = this.limit * between(this, level.finish), filled = answers.filter(Boolean).length;
    let times = answers.map(a => a ? this.limit * .08 + draw(this) * (finish - this.limit * .08) : Infinity);
    if (filled) times[times.indexOf(Math.max(...times.filter(Number.isFinite)))] = finish;
    // Resuming after a host handoff: the boxes already counted stay filled.
    if (resume) { const order = times.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]); order.slice(0, p.filled).forEach(([, i]) => { if (Number.isFinite(times[i])) times[i] = 0; }); }
    this.plans[p.seat] = { answers, times, stopAt: filled === this.count && finish < this.limit ? finish : Infinity };
  }
  botSheet(p) {
    const plan = this.plans[p.seat]; if (!plan?.answers) return cleanSheet([], this.count);
    return plan.answers.map((a, i) => plan.times[i] <= this.writeTime ? a : '');
  }

  progress(p, filled) {
    if (!['write', 'basta'].includes(this.phase) || p.submitted || !Number.isInteger(filled) || filled < 0 || filled > this.count || filled === p.filled) return false;
    p.filled = filled; this.revision++; return true;
  }

  // ¡STOP!: only a full sheet of real answers may stop the round; it travels with the call.
  stop(p, sheet) {
    if (this.phase !== 'write') return false;
    const clean = cleanSheet(sheet, this.count);
    if (clean.some(a => !a || tooShort(a))) return false;
    Object.assign(p, { sheet: clean, submitted: true, filled: this.count }); p.stats.stops++;
    this.stopper = p.seat; this.phase = 'basta'; this.phaseTime = 0; this.timeLeft = TIMES.basta;
    this.hostLine = '¡Basta! 5 segundos…';
    this.bark(p.seat, '¡STOP!');
    const caught = seated(this).filter(o => o.seat !== p.seat && o.filled < this.count).slice(0, 2);
    caught.forEach(o => this.bark(o.seat, '¡Me agarró fuera de base!'));
    this.revision++; return true;
  }

  pencilsDown() {
    this.phase = 'collect'; this.phaseTime = 0; this.timeLeft = 0;
    if (this.stopper === null) this.hostLine = '¡Se acabó el tiempo! Lápices abajo.';
    else this.hostLine = `¡Lápices abajo! ${this.players[this.stopper].name} gritó ¡STOP!`;
    this.collectBots(); this.revision++; this.maybeReview();
  }
  collectBots() { for (const p of seated(this)) if (p.id === null && !p.submitted) this.collectBot(p); }
  collectBot(p) { if (!this.plans[p.seat]?.answers) this.planBot(p, true); Object.assign(p, { sheet: this.botSheet(p), submitted: true }); }

  // A pana's sheet at pencils-down (or again, after a host handoff).
  submit(p, sheet) {
    if (this.phase !== 'collect' || p.submitted) return false;
    p.sheet = cleanSheet(sheet, this.count); p.submitted = true; p.filled = p.sheet.filter(Boolean).length;
    this.revision++; this.maybeReview(); return true;
  }
  maybeReview() { if (this.phase === 'collect' && seated(this).every(p => p.submitted)) this.startReview(); }

  startReview() {
    for (const p of this.players) if (!p.sheet) p.sheet = cleanSheet([], this.count);
    this.phase = 'review'; this.showCategory(0);
  }

  // One category on the table: every answer side by side, the doubtful ones
  // grouped by word so the table votes once per word.
  showCategory(index) {
    const cat = this.categories[index], groups = [];
    const items = seated(this).map(p => {
      const answer = p.sheet[index] || '', verdict = judge(answer, cat, this.letter, { criollo: this.options.criollo, dictionary: this.dictionary });
      const item = { seat: p.seat, answer, ...verdict, points: 0, group: null, creative: false };
      if (verdict.status === 'yellow') {
        let g = groups.findIndex(x => x.key === verdict.key);
        if (g < 0) { groups.push({ key: verdict.key, word: answer, reason: verdict.reason, explain: verdict.explain || '', hint: verdict.word || '', joke: verdict.joke || null, authors: [], votes: {}, accepted: null, creative: false }); g = groups.length - 1; }
        groups[g].authors.push(p.seat); item.group = g;
      }
      if (verdict.reason === 'empty') p.stats.empty++;
      return item;
    });
    this.review = { index, category: cat, items, groups, stage: groups.length ? 'vote' : 'show' };
    this.phaseTime = 0; this.timeLeft = groups.length ? TIMES.vote : 0;
    const wrong = items.find(i => i.reason === 'letter'), crude = items.find(i => i.reason === 'crude');
    if (groups.length) {
      const oreo = groups.find(g => g.joke === 'oreo'), movie = groups.find(g => /pel[ií]cula|Disney|Pok/.test(g.explain));
      this.hostLine = oreo ? `¡${oreo.word}: 200 puntos!` : movie ? '¡Ya te estás abusando! ¿Eso cuenta?' : '¿Eso cuenta?';
      this.planVotes();
    } else {
      this.score();
      this.hostLine = wrong ? `¡${wrong.answer} se escribe con ${wrong.first}!` : crude ? 'Eso no se dice en esta mesa.' : `${categoryLabel(cat)} con ${this.letter}.`;
    }
    this.revision++;
  }

  // Who may vote on a word: everyone at the table except its authors.
  voters(group) { return seated(this).filter(p => !group.authors.includes(p.seat)); }
  planVotes() {
    const r = this.review; this.plans = [];
    r.groups.forEach((g, gi) => {
      for (const p of this.voters(g)) {
        if (p.id !== null || p.seat in g.votes) continue;
        const kind = PERSONALITY[p.seat], odds = { doubtful: .5, close: .6, unknown: .35 }[g.reason] ?? .5;
        const yes = kind === 'estricto' ? false : kind === 'creativo' ? true : draw(this) < odds;
        (this.plans[p.seat] ||= []).push({ group: gi, at: between(this, [1.2, 6]), yes });
      }
    });
  }

  vote(p, group, yes) {
    const r = this.review, g = r?.groups[group];
    if (this.phase !== 'review' || r.stage !== 'vote' || !g || g.authors.includes(p.seat) || p.seat in g.votes || typeof yes !== 'boolean') return false;
    g.votes[p.seat] = yes; if (!yes) p.stats.thumbsDown++;
    this.revision++;
    if (r.groups.every(x => this.voters(x).every(v => v.seat in x.votes))) this.resolveVotes();
    return true;
  }

  // A tie favors the author; two thirds of the votes is a creative answer.
  resolveVotes() {
    const r = this.review;
    for (const g of r.groups) {
      const votes = Object.values(g.votes), yes = votes.filter(Boolean).length, no = votes.length - yes;
      g.accepted = yes >= no; g.creative = g.accepted && votes.length > 0 && yes * 3 >= votes.length * 2;
      if (g.accepted && !this.dictionary.some(d => d.category === r.category && soundKey(d.word) === soundKey(g.word))) this.dictionary.push({ category: r.category, word: g.word });
      if (!g.accepted) for (const seat of g.authors) this.players[seat].stats.rejected++;
      const voter = Object.keys(g.votes).map(Number).find(seat => g.votes[seat] === g.accepted);
      if (voter !== undefined) this.bark(voter, g.creative ? '¡Pedazo de loco!' : g.accepted ? 'Bueno, pasa…' : g.joke === 'oreo' ? '¡Ni lo sueñes!' : '¡Ya te estás abusando!');
    }
    this.score();
    const best = r.groups.find(g => g.creative), out = r.groups.find(g => !g.accepted);
    this.hostLine = r.groups.some(g => g.joke === 'oreo' && !g.creative) ? '¡Ni lo sueñes!' : best ? `¡Pedazo de loco! «${best.word}» cuenta y suma Creatividad.` : out ? `«${out.word}» no cuenta.` : 'La mesa lo aceptó.';
    r.stage = 'result'; this.phaseTime = 0; this.timeLeft = 0; this.plans = []; this.revision++;
  }

  // 100 for a valid answer nobody else wrote, 50 when shared, +50 Creatividad.
  score() {
    const r = this.review, valid = r.items.filter(i => i.status === 'green' || (i.status === 'yellow' && r.groups[i.group].accepted));
    const counts = {}; for (const i of valid) counts[i.key] = (counts[i.key] || 0) + 1;
    for (const i of valid) {
      const g = i.group !== null ? r.groups[i.group] : null;
      i.points = counts[i.key] === 1 ? POINTS.unique : POINTS.shared;
      if (g?.creative) { i.creative = true; i.points += POINTS.creative; this.players[i.seat].stats.creative++; }
      this.players[i.seat].round += i.points; this.players[i.seat].total += i.points;
    }
  }

  nextCategory() {
    if (this.review.index + 1 < this.count) return this.showCategory(this.review.index + 1);
    const best = seated(this).sort((a, b) => b.round - a.round || a.seat - b.seat)[0];
    this.phase = 'tally'; this.phaseTime = 0; this.review = { ...this.review, stage: 'done' };
    this.hostLine = `Ronda ${this.round}: ${best.name} sacó ${best.round} puntos.`;
    this.revision++;
  }

  finish() {
    const order = ranking(this);
    this.winner = order[0].seat; this.phase = 'finished'; this.titles = titles(this);
    this.hostLine = `¡${order[0].name} es el cuarto bate! Calabaza, calabaza, cada quien para su casa.`;
    this.revision++;
  }

  bark(seat, text) { this.barks = [...this.barks.slice(-5), { seat, text, id: ++this.barkId }]; }

  // Host clock. Returns true when something on screen changed.
  tick(dt) {
    if (['lobby', 'finished'].includes(this.phase)) return false;
    const rev = this.revision, shown = Math.ceil(this.timeLeft);
    this.phaseTime += dt;
    if (this.phase === 'spin') {
      const plan = this.plans[this.spinner];
      if ((this.isBot(this.spinner) && plan && this.phaseTime >= plan.spinAt) || this.phaseTime >= TIMES.spinAuto) this.para(null);
    } else if (this.phase === 'letter') {
      if (this.phaseTime >= TIMES.letter) this.startWrite();
    } else if (this.phase === 'write' || this.phase === 'basta') {
      this.writeTime += dt;
      this.timeLeft = Math.max(0, (this.phase === 'write' ? this.limit : TIMES.basta) - this.phaseTime);
      for (const p of this.players) {
        const plan = this.plans[p.seat]; if (p.id !== null || !plan) continue;
        const filled = Math.max(p.filled, plan.times.filter(t => t <= this.writeTime).length);
        if (filled !== p.filled) { p.filled = filled; this.revision++; }
        if (this.phase === 'write' && this.writeTime >= plan.stopAt) this.stop(p, plan.answers);
      }
      if (this.phase === 'write' && this.timeLeft <= 10 && shown > 10) this.hostLine = '¡Quedan diez segundos!';
      if (this.timeLeft <= 0) this.pencilsDown();
    } else if (this.phase === 'collect') {
      if (this.phaseTime >= TIMES.collect) {
        for (const p of seated(this)) if (!p.submitted) Object.assign(p, { sheet: cleanSheet([], this.count), submitted: true });
        this.startReview();
      }
    } else if (this.phase === 'review') {
      const r = this.review;
      if (r.stage === 'vote') {
        this.timeLeft = Math.max(0, TIMES.vote - this.phaseTime);
        for (const p of this.players) for (const v of (p.id === null && this.plans[p.seat]) || []) if (!v.done && this.phaseTime >= v.at) { v.done = true; this.vote(p, v.group, v.yes); if (this.review.stage !== 'vote') break; }
        if (r.stage === 'vote' && r.groups.some(g => g.joke === 'oreo') && this.phaseTime >= 1.4 && this.hostLine.includes('200')) { this.hostLine = '¡Ni lo sueñes! Cuenta como cualquier otra. ¿Eso cuenta?'; this.revision++; }
        if (r.stage === 'vote' && this.timeLeft <= 0) this.resolveVotes();
      } else if (this.phaseTime >= (r.stage === 'show' ? TIMES.show : TIMES.result)) this.nextCategory();
    } else if (this.phase === 'tally') {
      if (this.phaseTime >= TIMES.tally) { if (this.round >= this.rounds) this.finish(); else this.nextRound(); }
    }
    return this.revision !== rev || Math.ceil(this.timeLeft) !== shown;
  }

  // One action from a member: { action, seq, round, … }. Round actions carry
  // the round number (votes also the category index) instead of the
  // revision, so a pana typing while bots fill boxes is never a tick behind.
  // A repeated seq is refused.
  accept(id, data, hostId) {
    if (!data || !Number.isSafeInteger(data.seq) || data.seq <= (this.ledger[id] || 0)) return false;
    this.ledger[id] = data.seq;
    if (data.action === 'options' && id === hostId && this.phase === 'lobby') {
      const next = roomOptions(this.options, data.options); if (!next) return false;
      this.options = next; this.revision++; return true;
    }
    if (data.action === 'start') {
      if (id !== hostId || !['lobby', 'finished'].includes(this.phase)) return false;
      this.start(); return true;
    }
    const p = this.players.find(p => p.id === id);
    if (!p || data.round !== this.round) return false;
    if (data.action === 'para') return this.para(p);
    if (data.action === 'progress') return this.progress(p, data.filled);
    if (data.action === 'stop') return this.stop(p, data.sheet);
    if (data.action === 'sheet') return this.submit(p, data.sheet);
    if (data.action === 'vote') return data.index === this.review?.index && this.vote(p, data.group, data.yes);
    return false;
  }
}

// The end-of-game titles on the results card; one pana can earn several.
export function titles(state) {
  const out = Object.fromEntries(state.players.map(p => [p.seat, []]));
  const most = (key) => {
    const best = seated(state).sort((a, b) => b.stats[key] - a.stats[key] || b.total - a.total || a.seat - b.seat)[0];
    return best && best.stats[key] > 0 ? best.seat : null;
  };
  const give = (seat, title) => { if (seat !== null) out[seat].push(title); };
  give(ranking(state)[0].seat, 'Cuarto bate');
  give(most('stops'), 'El más rápido');
  give(most('creative'), 'Pana creativo');
  give(most('rejected'), 'El abusador');
  give(most('thumbsDown'), 'El estricto');
  give(most('empty'), 'Monte y culebra');
  return out;
}

export const TITLE_TEXT = {
  'Cuarto bate': 'El ganador',
  'El más rápido': 'Gritó ¡STOP! más veces',
  'Pana creativo': 'Más bonos de Creatividad',
  'El abusador': 'Más respuestas rechazadas',
  'El estricto': 'Votó en contra más veces',
  'Monte y culebra': 'Más casillas en blanco',
};

// What the card says under an answer in the review.
export function verdictText(item, group) {
  if (item.reason === 'empty') return 'En blanco';
  if (item.reason === 'short') return 'Eso no es una palabra';
  if (item.reason === 'letter') return `Se escribe con ${item.first}`;
  if (item.reason === 'crude') return 'Eso no se dice en esta mesa';
  if (item.reason === 'mesa') return 'La aceptó esta mesa';
  if (item.reason === 'typo') return `Se acepta como ${item.word}`;
  if (item.status === 'yellow') {
    if (group?.accepted === true) return group.creative ? '¡Pedazo de loco! +50 Creatividad' : 'La mesa la aceptó';
    if (group?.accepted === false) return group.joke === 'oreo' ? '¡Ni lo sueñes!' : '¡Ya te estás abusando!';
    return item.reason === 'close' ? `¿${item.word}?` : '¿Eso cuenta?';
  }
  return 'Vale';
}
