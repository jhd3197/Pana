// ¡Stop!: pure rules, plain data in and out (no DOM, no Three.js), so the
// host, the screen and Node tests all share them. A round: the turn pana
// stops the letter wheel, everyone fills a secret sheet, the first one done
// yells ¡STOP! (3 s for the rest), then the table reviews one category at a
// time and votes on the answers the game doesn't know. Sheets never travel in
// snapshots before the review: each client keeps its own and sends it at
// pencils-down.
import { draw } from '/engine/random.js';
import { findEntry, wordsFor, letterOf, soundKey, isCrude } from '/engine/play/saber-match.js';
import { defaultOptions, roomOptions } from './options.js';
import { CLASICAS, CRIOLLAS, VARIADAS, CEP, REMEMBERED, CUSTOM_MAX, CUSTOM_LENGTH, packOf, kindOf, freePrompt, customId, labelText, arrange } from './categories.js';
import { loc, locKey } from '../../../engine/i18n.js';
export { CLASICAS, CRIOLLAS, VARIADAS };

export const SEATS = 8;
export const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split(''); // i18n-ignore: letters
// Letter levels by how many words the categories have for them: easy letters
// fill every box, medium ones leave a few blank, hard ones leave most empty.
export const EASY = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'L', 'M', 'N', 'P', 'R', 'S', 'T'];
export const HARD = ['Ñ', 'Q', 'W', 'X', 'Y', 'Z'];
export const MEDIUM = ALPHABET.filter(l => !EASY.includes(l) && !HARD.includes(l));
// ¡Basta! gives the rest 5 s: at 3 s panas mid-word lost answers they were typing.
// A vote gets 10 s, plus 1.5 s per extra word on the table (free prompts put
// every answer to a vote), at most 18 s.
export const TIMES = { letter: 2.8, basta: 5, collect: 6, show: 3.4, vote: 10, voteEach: 1.5, voteMax: 18, result: 3, tally: 5.5, spinAuto: 9, rapido: 30 };
export const POINTS = { unique: 100, shared: 50, creative: 50 };
export const MAX_ANSWER = 32;
export const BOT_NAMES = ['Coco', 'Lola', 'Cheo', 'Nena', 'Toño', 'Mari', 'Pepe', 'Cuqui']; // i18n-ignore: names
// Two bots from the reel: the rules guy and the troll.
export const PERSONALITY = ['normal', 'normal', 'estricto', 'normal', 'normal', 'creativo', 'normal', 'normal'];
export const PERSONALITY_TEXT = { estricto: locKey('El estricto'), creativo: locKey('El pana creativo'), normal: '' };

// What the host says travels as Spanish source text plus its variables
// ({ text, vars }); every client shows it in its own language. `cat` is a
// category id, shown as its name (an own category as typed).
const line = (text, vars) => vars ? { text, vars } : { text };
const OREO = locKey('¡{word}: 200 puntos!');
export function lineText(said) {
  if (!said) return '';
  if (typeof said === 'string') return loc(said);
  const vars = said.vars && (said.vars.cat !== undefined ? { ...said.vars, category: labelText(said.vars.cat) } : said.vars);
  return loc(said.text, vars);
}
// The host is still saying "200 puntos" about an Oreo.
export const oreoShown = (state) => state.hostLine?.text === OREO;
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
// faciles: easy only; normales: easy and medium; todas: every letter. Rooms
// saved before the levels carry `hard` instead.
export function lettersFor(options) {
  const level = options.letters || (options.hard ? 'todas' : 'normales');
  return ALPHABET.filter(l => level === 'todas' || EASY.includes(l) || (level === 'normales' && MEDIUM.includes(l)));
}

// This game's categories: the host's own first, then the pack's list, then
// its fill, as `arrange` deals them.
export function pickCategories(state, options) {
  const shuffle = (list) => { const out = [...list]; for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(draw(state) * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; };
  const count = options.mode === 'rapido' ? 3 : options.count, pack = packOf(options.set);
  let order;
  if (pack.id === 'mezcla') {
    const sets = [shuffle(CLASICAS), shuffle(CRIOLLAS), shuffle(VARIADAS)]; order = [];
    while (sets.some(x => x.length)) for (const x of sets) if (x.length) order.push(x.shift());
  } else if (pack.id === 'azar') order = shuffle([...CLASICAS, ...CRIOLLAS, ...VARIADAS]);
  else order = [...(pack.fixed && options.mode !== 'rapido' ? pack.deal : shuffle(pack.deal)), ...shuffle(pack.fill)];
  return arrange([...(state.custom || []).map(customId), ...order], options).slice(0, count);
}

// The host's own categories: at most CUSTOM_MAX short, clean, different
// names; crude ones only with Más criollo. null when it isn't a list.
export function cleanCustom(list, { criollo = false } = {}) {
  if (!Array.isArray(list) || list.length > CUSTOM_MAX * 2) return null;
  const out = [], seen = new Set();
  for (const raw of list) {
    const text = [...cleanAnswer(raw)].slice(0, CUSTOM_LENGTH).join('').trim(), key = soundKey(text);
    if (!text || tooShort(text) || seen.has(key) || (isCrude(text) && !criollo)) continue;
    seen.add(key); out.push(text);
  }
  return out.slice(0, CUSTOM_MAX);
}

// Words tables voted in, kept in the browser so the next game counts them
// on its own (judge's "mesa"). Only clean entries for real categories; the
// newest MESA_LIMIT stay.
export const MESA_LIMIT = 300;
export function rememberWords(dictionary, saved) {
  const out = [], seen = new Set();
  for (const d of [...(Array.isArray(dictionary) ? dictionary : []), ...(Array.isArray(saved) ? saved : [])]) {
    const word = cleanAnswer(d?.word), key = `${d?.category}:${soundKey(word)}`;
    if (!REMEMBERED.includes(d?.category) || tooShort(word) || seen.has(key)) continue;
    seen.add(key); out.push({ category: d.category, word });
  }
  return out.slice(-MESA_LIMIT);
}

const LEAD_WORD = ['nombre', 'apellido', 'color'];

// How the game reads one box. status: green (counts), red (doesn't), yellow
// (the table votes). reason: empty, short, letter, crude, known, typo, mesa,
// doubtful, close, unknown, libre. key: what makes two answers "the same".
// Free prompts and the host's own categories have no right answers: every
// clean one goes to a vote unless this table already accepted it.
export function judge(answer, category, letter, { criollo = false, dictionary = [] } = {}) {
  const text = cleanAnswer(answer);
  if (!text) return { status: 'red', reason: 'empty', key: '' };
  const first = letterOf(text), own = `${category}:${soundKey(text)}`, kind = kindOf(category);
  if (tooShort(text)) return { status: 'red', reason: 'short', key: own };
  if (first !== letter) return { status: 'red', reason: 'letter', first, key: own };
  const mesa = dictionary.length ? findEntry(category, text, { extra: dictionary, base: false }) : null;
  if (kind === 'libre' || kind === 'propia') {
    if (isCrude(text) && !criollo) return { status: 'red', reason: 'crude', key: own };
    return mesa ? { status: 'green', reason: 'mesa', word: mesa.entry.word, explain: '', key: `${category}:${soundKey(mesa.entry.word)}` } : { status: 'yellow', reason: 'libre', key: own };
  }
  // Ciudad, estado o país: the closest match in its three categories, so the
  // state Carabobo beats the city Calabozo one typo away.
  const lookup = (word) => kind === 'cep' ? CEP.parts.map(part => findEntry(part, word)).filter(Boolean).sort((a, b) => a.distance - b.distance)[0] || null : findEntry(category, word);
  // A name with its surname (Pedro Pérez) or a colour with its shade (Verde
  // manzana) is the known first word plus more: it counts as that word.
  const found = mesa || lookup(text) || (LEAD_WORD.includes(category) && text.includes(' ') ? lookup(text.split(' ')[0]) : null);
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
    this.dictionary = []; this.hostLine = line(locKey('¡Bienvenidos a la mesa de ¡Stop!!')); this.barks = []; this.barkId = 0;
    this.winner = null; this.titles = null; this.games = 0;
    this.custom = []; this.history = []; this.notes = { best: null, debate: null };
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
    // `used` carries over: the next game starts with the letters this room hasn't played.
    Object.assign(this, { round: 0, winner: null, titles: null, review: null, stopper: null, letter: null, history: [] });
    this.spinFrom = Math.floor(draw(this) * SEATS); this.games++;
    this.nextRound();
  }

  nextRound() {
    const turn = seated(this).length ? seated(this) : this.players;
    this.round++; this.spinner = turn[(this.spinFrom + this.round - 1) % turn.length].seat;
    for (const p of this.players) Object.assign(p, { round: 0, filled: 0, submitted: false, sheet: null });
    Object.assign(this, { phase: 'spin', phaseTime: 0, timeLeft: 0, letter: null, stopper: null, review: null, notes: { best: null, debate: null } });
    this.plans = []; this.plans[this.spinner] = { spinAt: between(this, [1.2, 2.6]) };
    this.hostLine = line(locKey('Ronda {round} de {rounds}: {name} gira la rueda. ¡Grítale «¡Para!»!'), { round: this.round, rounds: this.rounds, name: this.players[this.spinner].name });
    this.revision++;
  }

  // ¡Para!: the wheel lands on a letter this room hasn't played yet; once
  // every letter came out, the bag refills.
  para(p) {
    if (this.phase !== 'spin' || (p && p.seat !== this.spinner)) return false;
    const all = lettersFor(this.options); let pool = all.filter(l => !this.used.includes(l));
    if (!pool.length) { this.used = []; pool = all; }
    this.letter = pick(this, pool); this.used.push(this.letter);
    this.phase = 'letter'; this.phaseTime = 0;
    this.hostLine = line(locKey('¡Para! Salió la {letter}.'), { letter: this.letter });
    this.bark(this.spinner, locKey('¡Para!')); this.revision++; return true;
  }

  startWrite() {
    Object.assign(this, { phase: 'write', phaseTime: 0, writeTime: 0, timeLeft: this.limit, stopper: null });
    this.hostLine = line(locKey('Todo con {letter}. ¡A escribir!'), { letter: this.letter });
    this.plans = []; this.planWriting(false); this.revision++;
  }

  // What each bot writes and when, decided on the host and never published.
  planWriting(resume) { for (const p of seated(this)) if (p.id === null) this.planBot(p, resume); }
  planBot(p, resume) {
    const level = LEVEL[this.options.bots] || LEVEL.normales, creative = PERSONALITY[p.seat] === 'creativo';
    const answers = this.categories.map(cat => {
      if (draw(this) > level.fill) return '';
      // Bots leave the host's own categories blank and answer free prompts from their pool.
      const kind = kindOf(cat);
      if (kind === 'propia') return '';
      if (kind === 'libre') { const words = freePrompt(cat).words.filter(w => letterOf(w) === this.letter); return words.length ? pick(this, words) : ''; }
      const parts = kind === 'cep' ? CEP.parts : [cat];
      const jokes = creative ? parts.flatMap(c => wordsFor(c, this.letter, { doubtful: true })) : [];
      if (jokes.length && draw(this) < .35) return pick(this, jokes).form;
      const words = parts.flatMap(c => wordsFor(c, this.letter));
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
    this.hostLine = line(locKey('¡Basta! 5 segundos…'));
    this.bark(p.seat, locKey('¡STOP!'));
    const caught = seated(this).filter(o => o.seat !== p.seat && o.filled < this.count).slice(0, 2);
    caught.forEach(o => this.bark(o.seat, locKey('¡Me agarró fuera de base!')));
    this.revision++; return true;
  }

  pencilsDown() {
    this.phase = 'collect'; this.phaseTime = 0; this.timeLeft = 0;
    if (this.stopper === null) this.hostLine = line(locKey('¡Se acabó el tiempo! Lápices abajo.'));
    else this.hostLine = line(locKey('¡Lápices abajo! {name} gritó ¡STOP!'), { name: this.players[this.stopper].name });
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
    const voteTime = Math.min(TIMES.voteMax, TIMES.vote + TIMES.voteEach * Math.max(0, groups.length - 1));
    this.review = { index, category: cat, items, groups, stage: groups.length ? 'vote' : 'show', voteTime };
    this.phaseTime = 0; this.timeLeft = groups.length ? voteTime : 0;
    const wrong = items.find(i => i.reason === 'letter'), crude = items.find(i => i.reason === 'crude');
    if (groups.length) {
      const oreo = groups.find(g => g.joke === 'oreo'), movie = groups.find(g => /pel[ií]cula|Disney|Pok/.test(g.explain));
      const open = ['libre', 'propia'].includes(kindOf(cat));
      this.hostLine = oreo ? line(OREO, { word: oreo.word }) : movie ? line(locKey('¡Ya te estás abusando! ¿Eso cuenta?'))
        : open ? line(locKey('{category}: ¿cuáles cuentan?'), { cat }) : line(locKey('¿Eso cuenta?'));
      this.planVotes();
    } else {
      this.score();
      this.hostLine = wrong ? line(locKey('¡{answer} se escribe con {letter}!'), { answer: wrong.answer, letter: wrong.first })
        : crude ? line(locKey('Eso no se dice en esta mesa.')) : line(locKey('{category} con {letter}.'), { cat, letter: this.letter });
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
        const kind = PERSONALITY[p.seat], odds = { doubtful: .5, close: .6, unknown: .35, libre: .7 }[g.reason] ?? .5;
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
      if (voter !== undefined) this.bark(voter, g.creative ? locKey('¡Pedazo de loco!') : g.accepted ? locKey('Bueno, pasa…') : g.joke === 'oreo' ? locKey('¡Ni lo sueñes!') : locKey('¡Ya te estás abusando!'));
    }
    this.score(); this.note(r);
    const best = r.groups.find(g => g.creative), out = r.groups.find(g => !g.accepted);
    this.hostLine = r.groups.some(g => g.joke === 'oreo' && !g.creative) ? line(locKey('¡Ni lo sueñes!'))
      : best ? line(locKey('¡Pedazo de loco! «{word}» cuenta y suma Creatividad.'), { word: best.word })
      : out ? line(locKey('«{word}» no cuenta.'), { word: out.word }) : line(locKey('La mesa lo aceptó.'));
    r.stage = 'result'; this.phaseTime = 0; this.timeLeft = 0; this.plans = []; this.revision++;
  }

  // The round's recap: the best-voted creative answer and the closest vote.
  note(r) {
    const notes = this.notes ||= { best: null, debate: null };
    for (const g of r.groups) {
      const votes = Object.values(g.votes), yes = votes.filter(Boolean).length, no = votes.length - yes;
      const line = { word: g.word, category: r.category, seat: g.authors[0] ?? null, yes, no, accepted: g.accepted };
      if (g.creative && (!notes.best || yes > notes.best.yes)) notes.best = line;
      const old = notes.debate, gap = Math.abs(yes - no), oldGap = old && Math.abs(old.yes - old.no);
      if (votes.length >= 2 && (!old || gap < oldGap || (gap === oldGap && votes.length > old.yes + old.no))) notes.debate = line;
    }
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
    (this.history ||= []).push({ round: this.round, letter: this.letter, top: { seat: best.seat, points: best.round }, best: this.notes?.best || null, debate: this.notes?.debate || null });
    this.hostLine = line(locKey('Ronda {round}: {name} sacó {points} puntos.'), { round: this.round, name: best.name, points: best.round });
    this.revision++;
  }

  finish() {
    const order = ranking(this);
    this.winner = order[0].seat; this.phase = 'finished'; this.titles = titles(this);
    this.hostLine = line(locKey('¡{name} es el cuarto bate! Calabaza, calabaza, cada quien para su casa.'), { name: order[0].name });
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
      if (this.phase === 'write' && this.timeLeft <= 10 && shown > 10) this.hostLine = line(locKey('¡Quedan diez segundos!'));
      if (this.timeLeft <= 0) this.pencilsDown();
    } else if (this.phase === 'collect') {
      if (this.phaseTime >= TIMES.collect) {
        for (const p of seated(this)) if (!p.submitted) Object.assign(p, { sheet: cleanSheet([], this.count), submitted: true });
        this.startReview();
      }
    } else if (this.phase === 'review') {
      const r = this.review;
      if (r.stage === 'vote') {
        this.timeLeft = Math.max(0, (r.voteTime || TIMES.vote) - this.phaseTime);
        for (const p of this.players) for (const v of (p.id === null && this.plans[p.seat]) || []) if (!v.done && this.phaseTime >= v.at) { v.done = true; this.vote(p, v.group, v.yes); if (this.review.stage !== 'vote') break; }
        if (r.stage === 'vote' && r.groups.some(g => g.joke === 'oreo') && this.phaseTime >= 1.4 && oreoShown(this)) { this.hostLine = line(locKey('¡Ni lo sueñes! Cuenta como cualquier otra. ¿Eso cuenta?')); this.revision++; }
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
    if (data.action === 'custom' && id === hostId && this.phase === 'lobby') {
      const next = cleanCustom(data.list, { criollo: this.options.criollo }); if (!next) return false;
      this.custom = next; this.revision++; return true;
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
  give(ranking(state)[0].seat, locKey('Cuarto bate'));
  give(most('stops'), locKey('El más rápido'));
  give(most('creative'), locKey('Pana creativo'));
  give(most('rejected'), locKey('El abusador'));
  give(most('thumbsDown'), locKey('El estricto'));
  give(most('empty'), locKey('Monte y culebra'));
  return out;
}

// Titles travel in state as these Spanish names; the screen passes both through loc().
export const TITLE_TEXT = {
  'Cuarto bate': locKey('El ganador'),
  'El más rápido': locKey('Gritó ¡STOP! más veces'),
  'Pana creativo': locKey('Más bonos de Creatividad'),
  'El abusador': locKey('Más respuestas rechazadas'),
  'El estricto': locKey('Votó en contra más veces'),
  'Monte y culebra': locKey('Más casillas en blanco'),
};

// What the card says under an answer in the review, in the player's language
// (each client builds it from the shared review).
export function verdictText(item, group) {
  if (item.reason === 'empty') return loc('En blanco');
  if (item.reason === 'short') return loc('Eso no es una palabra');
  if (item.reason === 'letter') return loc('Se escribe con {letter}', { letter: item.first });
  if (item.reason === 'crude') return loc('Eso no se dice en esta mesa');
  if (item.reason === 'mesa') return loc('La aceptó esta mesa');
  if (item.reason === 'typo') return loc('Se acepta como {word}', { word: item.word });
  if (item.status === 'yellow') {
    if (group?.accepted === true) return group.creative ? loc('¡Pedazo de loco! +50 Creatividad') : loc('La mesa la aceptó');
    if (group?.accepted === false) return group.joke === 'oreo' ? loc('¡Ni lo sueñes!') : loc('¡Ya te estás abusando!');
    return item.reason === 'close' ? loc('¿{word}?', { word: item.word }) : loc('¿Eso cuenta?');
  }
  return loc('Vale');
}
