// Plumbing every game-feel module shares: the reduced-motion check, one full-screen
// overlay layer, a stylesheet loaded once, and a short jolt for a HUD element.
// Nothing here touches a game's state: these effects only ever draw.

// The engine has no motion setting of its own, so this follows the browser's.
export const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useCss(url) {
  if (typeof document === 'undefined') return;
  const href = new URL(url).pathname;
  if (document.querySelector(`link[href="${href}"]`)) return;
  document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
}
useCss(new URL('feel.css', import.meta.url));

let layer = null;
// One overlay for every effect: fixed, click-through, above the HUD.
export function fxLayer() {
  if (!layer || !layer.isConnected) {
    layer = Object.assign(document.createElement('div'), { className: 'pk-fx-layer' });
    layer.setAttribute('aria-hidden', 'true');
    document.body.append(layer);
  }
  return layer;
}

export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));

// A quick tremble on top of whatever transform the element already has.
export function jolt(el, power = 1) {
  if (!el?.animate || calm()) return;
  const d = 3 * power;
  el.animate([
    { transform: `translate(${d}px, ${-d * .6}px)` }, { transform: `translate(${-d}px, ${d * .5}px)` },
    { transform: `translate(${d * .5}px, ${d * .3}px)` }, { transform: 'translate(0, 0)' },
  ], { duration: 170, composite: 'add' });
}
