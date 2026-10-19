// ¿Quién quiere ser mi pana?: pure rules, plain data in and out (no DOM, no
// Three.js), so the host, the screen and Node tests all share them. Everyone
// answers every question at once; answers stay secret in snapshots until the
// reveal, each pana climbs their own ladder of mangos, and a bet on the final
// question decides the Mango de oro.
import { draw, seedOf, clamp } from '/engine/random.js';
import { pickLine } from '/engine/play/frases.js';
import { defaultOptions, roomOptions } from './options.js';
import { CATEGORIES, QUESTIONS, PACKS } from './questions.js';

export const SEATS = 6;
export const LETTERS = ['A', 'B', 'C', 'D'];
// Mangos per step; step 12 is the Mango de oro. Steps 4 and 8 are safe.
export const LADDER = [0, 100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000];
export const TOP = LADDER.length - 1;
export const SAFE = [4, 8];
export const BETS = [0, .25, .5, 1];
export const BET_LABELS = ['Nada', 'Un cuarto', 'La mitad', '¡Todo!'];
export const TIMES = { pause: 2.4, revealStep: .85, result: 4.2, bet: 14, intro: 1.4 };
export const SPEED_BONUS = 100;
export const BOT_NAMES = ['Lola', 'Tito', 'Cheo', 'Nina', 'Toño', 'Mari'];
const SKILL = { normal: .62, genios: .86, gafos: .36 };

const fresh = () => ({ step: 0, bonus: 0, finalDelta: 0, answer: null, copy: null, locked: false, lockedLeft: 0, half: null, doble: false,
  planted: false, crowned: false, bet: null, betLocked: false, outcome: null,
  used: { copy: false, half: false, doble: false, plant: false },
  stats: { right: 0, wrong: 0, fallFrom: 0, copied: 0, betrayed: 0, streak: 0 } });
const bot = (seat) => ({ seat, id: null, name: BOT_NAMES[seat], avatar: {}, ...fresh() });

export const safeFloor = (step) => step >= 8 ? 8 : step >= 4 ? 4 : 0;
export const score = (p) => LADDER[p.step] + p.bonus + p.finalDelta;
export const ranking = (state) => [...state.players].sort((a, b) =>
  (b.seat === state.gold) - (a.seat === state.gold) || score(b) - score(a) || b.step - a.step || a.seat - b.seat);
export const mangos = (n) => n.toLocaleString('es-VE');

// The answer a seat ends up with: their own, or the one they copied (a copy of
// a copy follows the chain; a loop or an empty lock is no answer at all).
export function resolveAnswer(players, seat, seen = new Set()) {
  const p = players[seat];
  if (!p || seen.has(seat)) return null;
  seen.add(seat);
  return p.copy !== null && p.copy !== undefined ? resolveAnswer(players, p.copy, seen) : p.answer;
}

// The order the host calls names in: own answers first, then whoever copied,
// each after the pana they copied.
export function revealOrder(players) {
  const depth = (seat, seen = new Set()) => {
    const p = players[seat]; if (p.copy === null || seen.has(seat)) return 0;
    seen.add(seat); return 1 + depth(p.copy, seen);
  };
  return players.map(p => p.seat).sort((a, b) => depth(a) - depth(b) || a - b);
}

// What the host says as the k-th name is revealed.
export function revealLine(state, k) {
  const p = state.players[state.reveal.order[k]]; if (!p) return '';
  if (p.copy !== null) return `${p.name} se copió de ${state.players[p.copy].name}…`;
  if (p.answer === null) return `${p.name} no marcó nada…`;
  return `${p.name} puso la ${LETTERS[p.answer]}…`;
}

export class QuizGame {
  constructor(seed = Date.now()) {
    this.seed = (seed >>> 0) || 1;
    this.options = defaultOptions();
    this.players = Array.from({ length: SEATS }, (_, seat) => bot(seat));
    this.phase = 'lobby'; this.index = 0; this.total = this.options.questions; this.final = false;
    this.deck = []; this.question = null; this.phaseTime = 0; this.timeLeft = 0;
    this.reveal = null; this.hostLine = '¡Bienvenidos a ¿Quién quiere ser mi pana?!'; this.callouts = [];
    this.gold = null; this.winner = null; this.halfLast = null; this.titles = null; this.round = 0;
    this.revision = 0; this.ledger = {};
    this.plans = [];
  }

  // Secrets stay on the host until the reveal: snapshots carry only the lock.
  snapshot() {
    const { plans, ...data } = this, out = JSON.parse(JSON.stringify(data));
    const hide = ['question', 'pause'].includes(this.phase), hideBets = this.phase === 'bet' || (this.final && hide);
    for (const p of out.players) {
      if (hide) { p.answer = null; p.copy = null; }
      if (hideBets) p.bet = null;
    }
    return out;
  }

  // A new host rebuilds the game from the last snapshot. Hidden answers were
  // never published, so an open question gets a few more seconds to re-lock.
  static restore(state, members) {
    const game = Object.assign(new QuizGame(), JSON.parse(JSON.stringify(state)));
    for (const p of game.players) if (p.id !== null && !members.has(p.id)) Object.assign(p, { id: null, name: BOT_NAMES[p.seat], avatar: {} });
    if (['question', 'pause'].includes(game.phase)) {
      for (const p of game.players) { p.answer = null; p.copy = null; p.locked = false; }
      game.phase = 'question'; game.phaseTime = Math.max(0, game.options.seconds - 6); game.timeLeft = game.options.seconds - game.phaseTime;
    }
    if (game.phase === 'bet') {
      for (const p of game.players) if (!p.planted) { p.bet = null; p.betLocked = false; }
      game.phaseTime = Math.min(game.phaseTime, TIMES.bet - 6);
    }
    game.plan();
    return game;
  }

  // A pana sits in their own podium or takes a bot's; a full stage watches.
  addPlayer(id, name, avatar = {}) {
    const p = this.players.find(p => p.id === id) || this.players.find(p => p.id === null);
    if (!p || (p.id === id && p.name === name && JSON.stringify(p.avatar) === JSON.stringify(avatar))) return false;
    Object.assign(p, { id, name, avatar }); this.revision++; return true;
  }
  // A pana who leaves hands their podium, ladder and all, to a bot.
  removePlayer(id) {
    const p = this.players.find(p => p.id === id);
    if (p) { Object.assign(p, { id: null, name: BOT_NAMES[p.seat], avatar: {} }); this.revision++; }
  }

  start() {
    this.total = this.options.questions;
    for (const p of this.players) Object.assign(p, fresh(), { skill: this.skills(p.seat) });
    Object.assign(this, { index: 0, final: false, gold: null, winner: null, halfLast: null, titles: null, reveal: null, callouts: [] });
    this.deck = this.buildDeck(this.total + 1);
    this.round++; this.ask();
  }

  // Bots know each category a bit differently; the room option sets the base.
  skills(seat) {
    const base = SKILL[this.options.bots] ?? SKILL.normal;
    return Object.fromEntries(Object.keys(CATEGORIES).map(cat =>
      [cat, clamp(base + ((seedOf(`${this.round}:${seat}:${cat}`) % 1000) / 1000 - .5) * .3, .15, .97)]));
  }

  // The pack's categories take turns, questions never repeat inside a game.
  buildDeck(count) {
    const cats = [...(PACKS[this.options.pack] ?? PACKS.venezuela).cats], pools = Object.fromEntries(cats.map(c => [c, QUESTIONS[c].map((_, i) => i)]));
    for (let i = cats.length - 1; i > 0; i--) { const j = Math.floor(draw(this) * (i + 1)); [cats[i], cats[j]] = [cats[j], cats[i]]; }
    const deck = [];
    for (let i = 0; deck.length < count; i++) {
      const cat = cats[i % cats.length], pool = pools[cat]; if (!pool.length) continue;
      deck.push([cat, pool.splice(Math.floor(draw(this) * pool.length), 1)[0]]);
    }
    return deck;
  }

  ask() {
    const [cat, n] = this.deck[this.index], [text, ...answers] = QUESTIONS[cat][n];
    const order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(draw(this) * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    this.question = { cat, category: CATEGORIES[cat], text, answers: order.map(i => answers[i]), correct: order.indexOf(0) };
    for (const p of this.players) Object.assign(p, { answer: null, copy: null, locked: false, lockedLeft: 0, half: null, doble: false, outcome: null });
    this.phase = 'question'; this.phaseTime = 0; this.timeLeft = this.options.seconds; this.reveal = null; this.callouts = [];
    this.hostLine = this.final ? '¡La pregunta del Mango de oro! Vale todo lo que apostaron.' : `Pregunta ${this.index + 1} de ${this.total} · ${CATEGORIES[cat]}`;
    this.plan(); this.revision++;
  }

  // What each bot will do this question, decided up front on the host.
  plan() {
    if (!['question', 'bet'].includes(this.phase) || !this.question) { this.plans = []; return; }
    const leader = ranking(this)[0];
    this.plans = this.players.map(p => {
      const at = this.phase === 'bet' ? 1 + draw(this) * 5 : TIMES.intro + draw(this) * this.options.seconds * .62;
      const r = () => draw(this), left = this.total - this.index;
      return { at, roll: [r(), r(), r(), r(), r(), r()], leader: leader.seat !== p.seat && score(leader) > score(p) ? leader.seat : null, late: left <= 3 };
    });
  }

  bot(p) {
    const plan = this.plans[p.seat]; if (!plan || this.phaseTime < plan.at) return false;
    if (this.phase === 'bet') {
      if (p.betLocked) return false;
      const sure = p.skill?.[this.question?.cat] ?? .6;
      return this.placeBet(p, plan.roll[0] < .15 ? 3 : plan.roll[0] < .5 ? 2 : plan.roll[0] < .5 + sure * .3 ? 1 : 0);
    }
    if (p.locked) return false;
    const [copy, half, doble, plant, know, pick] = plan.roll;
    if (!p.used.plant && !this.final && !p.crowned && plan.late && p.step >= 8 && plant < .3) this.plant(p);
    if (!p.used.copy && plan.leader !== null && copy < .12) return this.copy(p, plan.leader);
    if (!p.used.half && half < .16) this.half(p);
    if (!p.used.doble && !this.final && !p.planted && !p.crowned && doble < .09 && p.step < TOP - 1) this.doble(p);
    const skill = (p.skill?.[this.question.cat] ?? .6) + (p.half ? .25 : 0), correct = this.question.correct;
    const wrong = [0, 1, 2, 3].filter(i => i !== correct && !p.half?.includes(i));
    return this.answer(p, know < skill ? correct : wrong[Math.floor(pick * wrong.length)]);
  }

  answer(p, choice) {
    if (this.phase !== 'question' || p.locked || !Number.isInteger(choice) || choice < 0 || choice > 3 || p.half?.includes(choice)) return false;
    Object.assign(p, { answer: choice, locked: true, lockedLeft: this.timeLeft }); this.revision++; this.maybePause(); return true;
  }
  copy(p, target) {
    if (this.phase !== 'question' || p.locked || p.used.copy || !Number.isInteger(target) || target === p.seat || !this.players[target]) return false;
    Object.assign(p, { copy: target, locked: true, lockedLeft: this.timeLeft }); p.used.copy = true; p.stats.copied++;
    this.revision++; this.maybePause(); return true;
  }
  // Two wrong answers disappear, only on this pana's screen.
  half(p) {
    if (this.phase !== 'question' || p.locked || p.used.half) return false;
    const wrong = [0, 1, 2, 3].filter(i => i !== this.question.correct), keep = wrong[Math.floor(draw(this) * 3)];
    p.half = wrong.filter(i => i !== keep); p.used.half = true; this.revision++; return true;
  }
  doble(p) {
    if (this.phase !== 'question' || this.final || p.locked || p.used.doble || p.planted || p.crowned) return false;
    p.doble = true; p.used.doble = true; this.revision++; return true;
  }
  plant(p) {
    if (this.phase !== 'question' || this.final || p.used.plant || p.crowned || p.doble) return false;
    p.planted = true; p.used.plant = true; this.revision++; return true;
  }
  placeBet(p, choice) {
    if (this.phase !== 'bet' || p.betLocked || !Number.isInteger(choice) || choice < 0 || choice >= BETS.length) return false;
    Object.assign(p, { bet: choice, betLocked: true }); this.revision++;
    if (this.players.every(q => q.betLocked)) this.ask();
    return true;
  }

  maybePause() { if (this.players.every(p => p.locked)) this.pause(); }
  pause() { this.phase = 'pause'; this.phaseTime = 0; this.hostLine = '¿Esa es su respuesta final?'; this.revision++; }

  startReveal() {
    this.reveal = { order: revealOrder(this.players), shown: 1, done: false };
    this.phase = 'reveal'; this.phaseTime = 0; this.hostLine = revealLine(this, 0); this.revision++;
  }

  // The right answer lights up: every ladder moves and the host calls people out.
  settle() {
    const { correct } = this.question, seconds = this.options.seconds, said = [], L = LETTERS[correct];
    const lines = (seat, text) => said.push({ seat, text });
    const before = this.players.map(score);
    for (const p of this.players) {
      const got = resolveAnswer(this.players, p.seat), right = got === correct, from = p.step;
      p.outcome = { answer: got, right, from, to: from, bonus: 0, delta: 0 };
      p.stats[right ? 'right' : 'wrong']++;
      if (this.final) {
        const stake = Math.round(before[p.seat] * BETS[p.bet ?? 0]);
        p.finalDelta = right ? stake : -stake; p.outcome.delta = p.finalDelta;
      } else if (!p.planted && !p.crowned) {
        if (right) {
          const bonus = Math.round(SPEED_BONUS * clamp(p.lockedLeft / seconds) / 10) * 10 * (p.doble ? 2 : 1);
          p.step = Math.min(TOP, p.step + (p.doble ? 2 : 1)); p.bonus += bonus; p.outcome.bonus = bonus;
        } else {
          const floor = safeFloor(p.step);
          p.step = p.doble ? safeFloor(Math.max(0, floor - 1)) : floor;
          if (from - p.step > 0 && from > p.stats.fallFrom) p.stats.fallFrom = from;
        }
        p.outcome.to = p.step;
      }
      if (right && p.stats.streak >= 3) lines(p.seat, `¡${p.name}, no te hagas el Willy Mays!`);
      p.stats.streak = right ? 0 : p.stats.streak + 1;
      if (from - p.step >= 3) lines(p.seat, `${p.name}, te quedaste sin el chivo y sin el mecate.`);
      if (p.step === TOP && this.gold === null) { this.gold = p.seat; p.crowned = true; lines(p.seat, `¡${p.name} se lleva el Mango de oro!`); }
      else if (p.step === TOP) p.crowned = true;
    }
    for (const p of this.players) {
      if (p.copy === null) continue;
      const target = this.players[p.copy], theirs = resolveAnswer(this.players, p.copy);
      if (theirs !== correct) {
        target.stats.betrayed++;
        lines(p.seat, `${p.name} se copió de ${target.name}… ¡y ${target.name} ${theirs === null ? 'no marcó nada' : `puso la ${LETTERS[theirs]}`}!`);
      } else lines(p.seat, `${p.name} se copió de ${target.name} y le salió bien. ¡Sapo!`);
    }
    const rights = this.players.filter(p => p.outcome.right);
    const headline = rights.length === 1 ? `¡Solo ${rights[0].name} se la sabía!`
      : rights.length === 0 ? '¡Me agarró fuera de base! Nadie se la sabía.'
      : rights.length === SEATS ? '¡Palo! Todos se la sabían.'
      : `La correcta era la ${L}. ${pickLine('aplauso', `${this.round}:${this.index}`)}`;
    // The leader doesn't get comfortable: now and then the host roasts them.
    const top = ranking(this)[0];
    if (!this.final && this.index > 1 && top.outcome.right && seedOf(`${this.round}:${this.index}:roast`) % 4 === 0) lines(top.seat, `${top.name} va de cuarto bate… ¡pero cuidado que se cae!`);
    this.callouts = said; this.hostLine = headline;
    this.reveal.done = true; this.phaseTime = 0;
    if (!this.final && this.index === Math.floor(this.total / 2) - 1) this.halfLast = [...ranking(this)].pop().seat;
    this.revision++;
  }

  next() {
    if (this.final) return this.finish();
    this.index++;
    if (this.index < this.total) return this.ask();
    // The final: everyone secretly bets part of their mangos first.
    this.final = true; this.phase = 'bet'; this.phaseTime = 0; this.timeLeft = TIMES.bet; this.callouts = []; this.reveal = null;
    for (const p of this.players) Object.assign(p, { bet: null, betLocked: false, outcome: null, answer: null, copy: null, locked: false });
    for (const p of this.players) if (p.planted || score(p) <= 0) Object.assign(p, { bet: 0, betLocked: true });
    this.hostLine = 'Pregunta final: ¿cuántos mangos te juegas?';
    this.question = { ...this.question, cat: this.deck[this.index][0], category: CATEGORIES[this.deck[this.index][0]] };
    this.revision++; this.plan();
    if (this.players.every(p => p.betLocked)) this.ask();
  }

  finish() {
    const order = ranking(this);
    this.winner = order[0].seat; this.phase = 'finished'; this.titles = titles(this);
    this.hostLine = `¡${order[0].name} es el cuarto bate! Calabaza, calabaza, cada quien para su casa.`;
    this.callouts = []; this.revision++;
  }

  // Host clock. Returns true when something on screen changed.
  tick(dt) {
    if (!['question', 'pause', 'reveal', 'bet'].includes(this.phase)) return false;
    this.phaseTime += dt;
    const shown = Math.ceil(this.timeLeft), rev = this.revision;
    if (this.phase === 'question' || this.phase === 'bet') {
      const limit = this.phase === 'bet' ? TIMES.bet : this.options.seconds;
      this.timeLeft = Math.max(0, limit - this.phaseTime);
      for (const p of this.players) if (p.id === null) this.bot(p);
      if (this.phase === 'question') {
        if (this.timeLeft <= 4 && this.timeLeft > 0 && !this.hostLine.startsWith('Échale')) this.hostLine = 'Échale coco…';
        else if (this.phaseTime > limit * .55 && this.players.filter(p => p.locked).length < SEATS / 2 && !/coco|mocho/.test(this.hostLine)) this.hostLine = 'Más aburrido que mocho en piñata…';
        if (this.timeLeft <= 0) this.pause();
      } else if (this.phase === 'bet' && this.timeLeft <= 0) {
        for (const p of this.players) if (!p.betLocked) Object.assign(p, { bet: 0, betLocked: true });
        this.ask();
      }
    } else if (this.phase === 'pause') {
      if (this.phaseTime >= TIMES.pause) this.startReveal();
    } else if (this.phase === 'reveal') {
      const r = this.reveal;
      if (!r.done) {
        // `shown` names are on screen; one more beat after the last, the answer lights up.
        const k = Math.min(r.order.length + 1, Math.floor(this.phaseTime / TIMES.revealStep) + 1);
        if (k > r.shown) {
          if (k <= r.order.length) { r.shown = k; this.hostLine = revealLine(this, k - 1); this.revision++; } else this.settle();
        }
      } else if (this.phaseTime >= TIMES.result + this.callouts.length * .6) this.next();
    }
    return this.revision !== rev || Math.ceil(this.timeLeft) !== shown;
  }

  // One action from a member: { action, seq, q, … }. Answers carry the question
  // number instead of the revision, so a pana answering while others lock in
  // is never refused for being a tick behind. A repeated seq is refused.
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
    if (!p) return false;
    if (data.action === 'bet') return this.placeBet(p, data.choice);
    if (data.q !== this.index || this.phase !== 'question') return false;
    if (data.action === 'answer') return this.answer(p, data.choice);
    if (data.action === 'copy') return this.copy(p, data.target);
    if (data.action === 'half') return this.half(p);
    if (data.action === 'doble') return this.doble(p);
    if (data.action === 'plant') return this.plant(p);
    return false;
  }
}

// The end-of-game titles on the results card; one pana can earn several.
export function titles(state) {
  const out = Object.fromEntries(state.players.map(p => [p.seat, []]));
  const most = (key, min = 1) => {
    const best = [...state.players].sort((a, b) => b.stats[key] - a.stats[key] || a.seat - b.seat)[0];
    return best && best.stats[key] >= min ? best.seat : null;
  };
  const order = ranking(state), give = (seat, title) => { if (seat !== null && seat !== undefined) out[seat].push(title); };
  give(order[0].seat, 'Cuarto bate');
  give(most('wrong'), 'Gafo');
  give(most('fallFrom'), 'Pavoso');
  give(most('copied'), 'Sapo');
  if (state.halfLast !== null && order.slice(0, 2).some(p => p.seat === state.halfLast)) give(state.halfLast, 'Willy Mays');
  give(most('betrayed'), 'Embustero');
  return out;
}

export const TITLE_TEXT = {
  'Cuarto bate': 'El ganador',
  Gafo: 'Más respuestas malas',
  Pavoso: 'Se cayó desde más alto',
  Sapo: 'Se copió',
  'Willy Mays': 'Último a mitad de juego y terminó arriba',
  Embustero: 'Lo copiaron y estaba mal',
};
