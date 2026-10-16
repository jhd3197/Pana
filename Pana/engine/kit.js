// Small helpers for the Pana Kit (/engine/kit.css). The kit is mostly CSS;
// this module only covers the pieces that need a little script.
//
//   import { shout } from '/engine/kit.js';
//   shout('¡Vuelta final!');                 // coral, tilted, fades out
//   shout('¡Tronco!', { tone: 'yellow', ms: 1200 });

// From next to this module, so a versioned copy (pana.sh's /_v/<version>/engine/) loads its own kit.
if (!document.querySelector('link[href*="/engine/kit.css"]')) {
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = new URL('kit.css', import.meta.url).pathname;
  document.head.prepend(link);
}

let layer;
// A big tilted callout in the upper middle of the screen. A new shout
// replaces the one on screen.
export function shout(text, { tone = 'coral', ms = 1800 } = {}) {
  layer ??= document.body.appendChild(Object.assign(document.createElement('div'), { className: 'pk-banner-layer' }));
  layer.setAttribute('role', 'status'); layer.setAttribute('aria-live', 'polite');
  const node = document.createElement('div');
  node.className = `pk-banner pk-pop${tone === 'coral' ? '' : ` pk-banner--${tone}`}`;
  node.style.animationDuration = `${ms}ms`;
  node.textContent = text;
  layer.replaceChildren(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
  return node;
}

// Fills a .pk-bar (0–1).
export function setBar(bar, value) { bar.style.setProperty('--pk-value', String(Math.max(0, Math.min(1, value)))); }
