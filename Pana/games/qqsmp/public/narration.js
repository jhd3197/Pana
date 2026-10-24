import { onSettings } from '/engine/settings.js';
import { voiceKey, narrationLines, revealLines } from './voice-key.js';

// One local recording at a time. Audio never controls the shared room clock.
export function createNarration(button) {
  const audio = new Audio();
  audio.preload = 'auto';
  let key = '', current = null, muted = false, disposed = false, pending = false;
  let queue = [], index = 0, generation = 0;
  const stop = () => { generation++; pending = false; queue = []; audio.pause(); audio.removeAttribute('src'); audio.load(); };
  const playClip = () => {
    if (!current || muted || disposed || index >= queue.length) return;
    pending = false;
    const requested = ++generation;
    audio.src = `./audio/${voiceKey(queue[index])}.mp3`;
    audio.play().catch(error => {
      if (requested === generation && !disposed && !muted && current && error.name === 'NotAllowedError') pending = true;
    });
  };
  const play = () => {
    stop();
    if (!current || muted || disposed) return;
    queue = current; index = 0; playClip();
  };
  audio.onended = () => { index++; playClip(); };
  const unlock = () => { if (pending) playClip(); };
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
      const mode = !paused && (state.phase === 'question' ? 'question' : state.phase === 'reveal' && state.reveal?.done ? 'answer' : '');
      const next = mode ? `${mode}:${state.round}:${state.index}:${state.question.text}` : '';
      current = mode === 'question' ? narrationLines(state.question) : mode === 'answer' ? revealLines(state.question) : null;
      button.textContent = mode === 'answer' ? 'Escuchar respuesta' : 'Escuchar pregunta';
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
