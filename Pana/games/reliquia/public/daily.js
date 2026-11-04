// Fosa's Expedición del día and Racha, on engine/daily.js. The host picks the day's
// dive for the squad: one cave and one set of pacts for everyone on that date, rank
// aside. The pure half (top) also runs in the host's room and the unit tests.
import { dailySeed, dayKey, isDayKey, pickDaily, createStreak } from '../../../engine/daily.js';
import { loc, locn, formatNumber } from '../../../engine/i18n.js';
import { DEFAULT_OPTIONS } from './options.js';
import { PACTOS, pactoKey } from './pactos.js';

export const DAILY_BONUS = .25;   // of what the dive paid, the first daily of the day
export const BEST_KEY = 'pana:reliquia:daily-best';

// Every set of one or two pacts: the day rotates through them.
const SETS = PACTOS.flatMap((a, i) => [[a.id], ...PACTOS.slice(i + 1).map(b => [a.id, b.id])]);
export const dailyPactos = day => pickDaily(SETS, day) ?? [];

// The whole rule set is the day's, or a host's settings would deal another cave
// (`place`) or another fight. Only the phrases stay: they change no rule.
export function dailyPlan(day, options = {}) {
  const pactos = dailyPactos(day);
  return { seed: dailySeed('reliquia', day), pactos, options: { ...DEFAULT_OPTIONS, crude: options.crude === true, ...Object.fromEntries(pactos.map(id => [pactoKey(id), true])) } };
}

// The host's start. The lobby only shows before a room's first dive, so the options
// a daily replaced come back on the next plain dive, or its pacts would stay on with
// no menu to take them off. `plainOptions` travels in snapshots for a new host.
export function startDive(game, day, seed) {
  const plain = game.plainOptions;
  if (isDayKey(day)) {
    const before = plain ?? { ...game.options }, plan = dailyPlan(day, before);
    game.configure(plan.options); game.start(plan.seed);
    game.daily = day; game.plainOptions = before;
    return;
  }
  if (plain) game.configure(plain);
  game.start(seed);
}

// A jornada cleared, or something brought out: an empty extraction at the camp is not a day played.
export const countsForStreak = state => (state.level || 1) > 1 || (state.outcome === 'extracted' && (state.haul || 0) > 0);

// The day's best on this device, nothing older. Tiny on purpose: one key behind one
// call, so shared records can take its place. More jornadas win, then the payout.
const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
export function reportBest(day, result, storage = defaultStorage()) {
  let best = null;
  try { best = JSON.parse(storage?.getItem(BEST_KEY) ?? 'null'); } catch { /* blocked or malformed */ }
  const better = best?.day !== day || !(best.jornadas >= 0 && best.payout >= 0) || result.jornadas > best.jornadas || (result.jornadas === best.jornadas && result.payout > best.payout);
  if (!better) return best;
  const saved = { day, jornadas: result.jornadas, payout: result.payout };
  try { storage?.setItem(BEST_KEY, JSON.stringify(saved)); } catch { /* this screen only */ }
  return saved;
}

export const bestLine = best => locn(best.jornadas, 'Mejor del día: {n} jornada · {money}', 'Mejor del día: {n} jornadas · {money}', { money: `Bs. ${formatNumber(Math.round(best.payout))}` });

// The screens: the button, the shout at the start and the results' line.
export function createFosaDaily({ progress, start, shout, storage, now = () => new Date() }) {
  const streak = createStreak({ game: 'reliquia', now, storage });
  const el = (tag, className, id) => Object.assign(document.createElement(tag), { className, id });
  const shown = (node, on) => { node.style.display = on ? '' : 'none'; };   // kit classes set their own display, over [hidden]
  const button = (id, className, press) => { const b = el('button', className, id); b.type = 'button'; b.textContent = loc('Del día'); b.onclick = () => press(dayKey(now())); return b; };
  // The lobby's goes through #start, so the shared lobby's "everyone ready" barrier holds it too.
  const startButton = document.getElementById('start'); let armed = '';
  const lobbyButton = button('daily-start', 'pk-btn', day => { armed = day; startButton.click(); armed = ''; }), againButton = button('daily-again', 'pk-btn pk-btn--block', start);
  startButton.after(lobbyButton); document.getElementById('again').after(againButton);
  const pactNames = pactos => pactos.map(id => loc(PACTOS.find(p => p.id === id).name)).join(' · ');
  let row = null, chip = null, freezes = null, line = null, diving = false, titled = '';

  // Every render: only the host chooses, and a daily opens by saying its rules.
  function update(state, room) {
    const isDiving = state.phase === 'playing' && !!state.daily;
    if (isDiving && !diving) shout(loc('Del día · {pacts}', { pacts: pactNames(dailyPactos(state.daily)) }), { tone: 'yellow' });
    diving = isDiving;
    if (state.phase === 'playing') return;
    const host = room.connected && room.isHost, day = dayKey(now());
    shown(lobbyButton, host && !state.resumed); shown(againButton, host);
    if (titled !== day) { titled = day; lobbyButton.title = againButton.title = pactNames(dailyPactos(day)); }
  }
  function draw(state, seen) {
    if (!row) {
      row = el('div', 'pk-rank', 'daily-line'); chip = el('span', 'pk-chip pk-chip--teal', 'streak-chip'); freezes = el('span', 'pk-chip', 'streak-freezes'); line = el('span', 'pk-copy', 'daily-best');
      row.append(chip, freezes, line); document.getElementById('titles').before(row);
    }
    chip.textContent = loc('Racha {n}', { n: seen.days }); shown(chip, seen.days);
    freezes.textContent = loc('Comodín {n}', { n: seen.freezesLeft }); shown(freezes, seen.days && (seen.freezesLeft || seen.usedFreeze));
    const best = state.daily ? reportBest(state.daily, { jornadas: Math.max(0, state.level - 1), payout: state.payout || 0 }, storage) : null;
    line.textContent = best ? bestLine(best) : ''; shown(line, best);
    shown(row, seen.days || best);
  }
  // Once per finished dive, for someone who dived: a bonus award and a toast, if any.
  function settled(state, result) {
    const today = dayKey(now());
    const seen = countsForStreak(state) ? streak.record(today) : streak.peek(today);
    draw(state, seen);
    // A reload pays nothing (gained 0) and must not spend the day's receipt.
    const bonus = state.daily && result.gained > 0 ? progress.award(Math.round(result.gained * DAILY_BONUS), `daily:${state.daily}`, { dive: false }) : null;
    return { bonus, toast: seen.milestone ? [`racha:${seen.milestone}`, loc('¡{n} días seguidos!', { n: seen.milestone })] : null };
  }
  return { update, settled, startOptions: () => armed ? { daily: armed } : {} };
}
