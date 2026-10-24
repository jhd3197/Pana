import { onSettings } from '/engine/settings.js';
import { voiceKey } from './voice-key.js';

// One local recording at a time. Audio never controls the shared room clock.
export function createNarration(button) {
  const audio = new Audio();
  audio.preload = 'auto';
  let key = '', current = null, muted = false, disposed = false, pending = false;
  const stop = () => { pending = false; audio.pause(); audio.removeAttribute('src'); audio.load(); };
  const play = () => {
    if (!current || muted || disposed) return;
    pending = false;
    const requested = key;
    audio.src = `./audio/${voiceKey(current.text)}.mp3`;
    audio.play().catch(error => {
      if (requested === key && !disposed && !muted && current && error.name === 'NotAllowedError') pending = true;
    });
  };
  const unlock = () => { if (pending) play(); };
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
  button.onclick = play;
  const unsubscribe = onSettings(settings => {
    muted = !settings.sound;
    audio.volume = settings.volume;
    button.disabled = muted || !current;
    if (muted) stop();
  });
  return {
    update(state, paused = false) {
      const next = state.phase === 'question' && !paused ? `${state.round}:${state.index}:${state.question.text}` : '';
      current = next ? state.question : null;
      button.hidden = !current;
      button.disabled = muted || !current;
      if (next === key) return;
      key = next; stop();
      if (current) play();
    },
    dispose() {
      disposed = true; stop(); unsubscribe(); button.onclick = null;
      removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock);
    },
  };
}
