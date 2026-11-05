// The rank-up ceremony: a riser while the XP bar crawls full, then a white flash, a
// pillar of light with climbing rings, the title slamming down, stats counting up
// tick by tick and whatever the rank unlocks. Click-through; it clears itself.
//
//   playLevelUp({ title: 'Buzo', stats: [{ label: 'XP', from: 18, to: 58 }], unlocks: ['traje:franja'] });
import { calm, fxLayer, jolt, useCss } from './feel.js';
import { createScreenFx, preloadFx } from './pixelfx-bridge.js';
import { loc } from '../i18n.js';
useCss(new URL('level-up.css', import.meta.url));

// Matches how long the chip's bar takes through its last sliver (progress-ui.js).
export const RISE_MS = 1200;
const AT = { slam: 120, stats: 620, unlocks: 1500, out: 3600, gone: 4100 };
const TICK_MS = 55, MAX_TICKS = 14;

// The values a stat shows as it counts: a few whole steps that end on the real total.
export function countSteps(from, to, max = MAX_TICKS) {
  const span = to - from;
  if (span <= 0) return [to];
  const n = Math.min(span, max);
  return Array.from({ length: n }, (_, i) => Math.round(from + span * (i + 1) / n));
}
// 'traje:franja' -> 'Traje Franja': the data only has ids, and those are already Spanish.
export const unlockName = (id) => String(id).split(':').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const part = (tag, className, text = '') => Object.assign(document.createElement(tag), { className, textContent: text });
const SLAM = [
  { transform: 'scale(5)', opacity: 0, offset: 0 },
  { transform: 'scale(.9)', opacity: 1, offset: .55, easing: 'ease-out' },
  { transform: 'scale(1.08)', opacity: 1, offset: .78 },
  { transform: 'scale(1)', opacity: 1, offset: 1 },
];

// Sound loads with the ceremony, not with whatever imports this.
const audio = (use) => { import('../sfx.js').then(({ sfx }) => use(sfx)).catch(console.warn); };

let running = null;
export function playLevelUp({ title = '', stats = [], unlocks = [], rise = RISE_MS } = {}) {
  if (typeof document === 'undefined') return null;
  running?.stop();
  const quiet = calm(), timers = new Set(), root = part('div', 'pk-lu');
  const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, quiet ? Math.min(ms, 0) : ms); timers.add(id); };
  const phase = (name) => { root.dataset.phase = name; };
  const pillar = createScreenFx({ max: 3 });
  let frame = 0, last = 0;
  const loop = (now) => {
    pillar.tick(Math.min((now - last) / 1000, .1)); last = now;
    frame = pillar.live ? requestAnimationFrame(loop) : 0;
  };
  const spin = () => { if (!frame) { last = performance.now(); frame = requestAnimationFrame(loop); } };

  const flash = part('i', 'pk-lu-flash'), word = part('b', 'pk-lu-word', loc('¡SUBISTE DE NIVEL!'));
  const rank = part('span', 'pk-chip pk-chip--yellow pk-lu-rank', title), lines = part('div', 'pk-lu-stats'), prizes = part('div', 'pk-lu-prizes');
  word.hidden = rank.hidden = true;
  root.append(flash, word, rank, lines, prizes);
  fxLayer().append(root);
  phase('rise');
  if (!quiet) { audio((sfx) => sfx.riser(rise / 1000)); preloadFx('level-up', 'confetti').catch(console.warn); }

  const fill = () => {
    for (const { label, from = 0, to = 0 } of stats) {
      const line = part('div', 'pk-lu-stat'), value = part('b', '', String(from));
      line.append(part('span', '', label), value); lines.append(line);
      const steps = countSteps(from, to);
      if (quiet) { value.textContent = String(to); continue; }
      steps.forEach((n, i) => later(i * TICK_MS, () => {
        value.textContent = String(n); audio((sfx) => sfx.countTick(i / steps.length));
        value.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 90 });
      }));
    }
  };
  const showPrizes = () => unlocks.forEach((id, i) => {
    const chip = part('span', 'pk-chip pk-lu-prize', unlockName(id)); chip.translate = false; prizes.append(chip);
    if (!quiet) chip.animate([{ transform: 'translateY(14px) scale(.6)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .7 }, { transform: 'none', opacity: 1 }], { duration: 260, delay: i * 110, easing: 'ease-out', fill: 'backwards' });
  });

  later(rise, () => {
    phase('flash');
    word.hidden = rank.hidden = false;
    if (quiet) { fill(); showPrizes(); return; }
    flash.animate([{ opacity: 0 }, { opacity: .96, offset: .12 }, { opacity: 0 }], { duration: 620, easing: 'ease-out' });
    const { innerWidth: w, innerHeight: h } = window, scale = Math.max(2, Math.min(6, Math.floor(Math.min(w / 176, h / 138) * .9)));
    pillar.play('level-up', w / 2, h * .9, { scale, text: '', actorless: true });
    if (pillar.live) spin();
    audio((sfx) => sfx.levelUp());
  });
  later(rise + AT.slam, () => {
    if (quiet) return;
    phase('slam');
    word.animate(SLAM, { duration: 340, fill: 'backwards' });
    jolt(root, 2.4);
    rank.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 200, delay: 260, fill: 'backwards' });
  });
  later(rise + AT.stats, () => { if (!quiet) { phase('stats'); fill(); } });
  later(rise + AT.unlocks, () => {
    if (quiet) return;
    phase('unlocks'); showPrizes();
    const { innerWidth: w, innerHeight: h } = window;
    pillar.play('confetti', w * .18, h * .92, { scale: 3 });
    pillar.play('confetti', w * .82, h * .92, { scale: 3, flip: true });
    if (pillar.live) spin();
  });
  const stop = () => {
    for (const id of timers) clearTimeout(id);
    timers.clear(); cancelAnimationFrame(frame); frame = 0;
    pillar.clear(); root.remove();
    if (running === handle) running = null;
  };
  const after = quiet ? 2600 : rise + AT.gone;
  later(rise + AT.out, () => { if (!quiet) root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: AT.gone - AT.out, fill: 'forwards' }); });
  const end = setTimeout(stop, after);
  const handle = { stop: () => { clearTimeout(end); stop(); } };
  running = handle;
  return handle;
}
