import { createQuizChoreography } from './animation-choreography.js';
import { animationPhase, animationRound, animationVariant, quizAnimation } from './animation-events.js';

export function createQuizAnimations(parent, host, slots, onCue) {
  const choreography = createQuizChoreography(parent, host, slots, onCue);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let state = null, elapsed = 0, pending = null, current = null, override = null, disposed = false, dirty = false;
  return {
    update(next) {
      if (disposed) return;
      const changed = !state || animationPhase(next) !== animationPhase(state);
      if (changed) { elapsed = next.phaseTime || 0; pending = null; override = null; }
      if (state && next.phase === 'question' && animationRound(next) === animationRound(state)) {
        for (const p of next.players) {
          if (next.options.mode === 'panas' && p.id === null) continue;
          const before = state.players[p.seat];
          const action = p.locked && !before.locked ? 'lock' : p.half && !before.half ? 'fifty' : null;
          if (action) pending = { action, seat: p.seat, variant: animationVariant(next, p.seat, action), age: 0, duration: 2.2, key: `${animationRound(next)}:${action}:${p.seat}` };
        }
      }
      if (pending && (!next.players[pending.seat]?.locked && pending.action === 'lock' || next.phase !== 'question')) pending = null;
      state = next;
    },
    reset: () => { if (!disposed && dirty) { choreography.reset(); dirty = false; } },
    frame(dt, paused = false) {
      if (disposed || !state || reduced.matches) { current = null; return; }
      if (!paused && !document.hidden) { elapsed += dt; if (pending) pending.age += dt; }
      if (pending?.age >= pending?.duration) pending = null;
      current = override || pending || quizAnimation(state, elapsed);
      if (current) { choreography.render(current, current.age, state, !paused && !document.hidden); dirty = true; }
    },
    // Exposed only through the existing debug world; browser proof uses the
    // same live rigs and choreography, with no standalone demo renderer.
    preview(action, variant, seat, progress = .7) { override = { action, variant, seat, age: progress * 4, duration: 4, key: `preview:${action}:${variant}` }; },
    clearPreview() { override = null; },
    get current() { return current; },
    get root() { return choreography.root; },
    dispose() { if (disposed) return;disposed = true;pending = current = override = null;choreography.dispose(); },
  };
}
