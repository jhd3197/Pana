// Small HUD pieces that games kept writing for themselves.
//
//   import { createToast } from '/engine/hud.js';
//   const notify = createToast($('toast'), { ms: 3400 });
//   notify('¡Llegó Ana!');          // shows it; a newer message replaces it

// A status toast. The element's markup says how it hides: the `hidden`
// attribute, a `.hidden` class, or else a `.show` class it wears while shown.
// An empty message is ignored. notify.dispose() cancels a pending hide.
export function createToast(el, { ms = 3400 } = {}) {
  const mode = el.hasAttribute('hidden') ? 'attribute' : el.classList.contains('hidden') ? 'hidden' : 'show';
  const set = (on) => {
    if (mode === 'attribute') el.hidden = !on;
    else if (mode === 'hidden') el.classList.toggle('hidden', !on);
    else el.classList.toggle('show', on);
  };
  let timer = 0;
  const notify = (text) => {
    if (!text) return;
    el.textContent = text; set(true);
    clearTimeout(timer); timer = setTimeout(() => set(false), ms);
  };
  notify.dispose = () => clearTimeout(timer);
  return notify;
}
