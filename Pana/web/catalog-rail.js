import { icon } from '/engine/icons.js';
import { loc } from '/engine/i18n.js';

// Mouse controls supplement touch swipes and native keyboard scrolling.
export function catalogRail(row, head, rail) {
  const buttons = [-1, 1].map(direction => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'rail-arrow';
    button.setAttribute('aria-label', direction < 0 ? loc('Anterior') : loc('Siguiente'));
    button.append(icon(direction < 0 ? 'chevronLeft' : 'chevronRight'));
    button.onclick = () => rail.scrollBy({ left: direction * rail.clientWidth * .8,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    head.append(button);
    return button;
  });
  const update = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    row.toggleAttribute('data-overflow', max > 2);
    buttons[0].disabled = rail.scrollLeft <= 2;
    buttons[1].disabled = rail.scrollLeft >= max - 2;
  };
  rail.addEventListener('scroll', update, { passive: true });
  const observer = new ResizeObserver(update);
  observer.observe(rail);
  for (const card of rail.children) observer.observe(card);
  rail.addEventListener('wheel', event => {
    if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const max = rail.scrollWidth - rail.clientWidth;
    if (max <= 2 || (event.deltaY < 0 ? rail.scrollLeft <= 0 : rail.scrollLeft >= max - 1)) return;
    event.preventDefault();
    rail.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? rail.clientWidth : 1);
  }, { passive: false });
  let frame = 0, direction = 0, previous = 0;
  const stop = () => { cancelAnimationFrame(frame); frame = 0; direction = 0; previous = 0; rail.classList.remove('is-edge-scrolling'); };
  const tick = time => {
    const before = rail.scrollLeft;
    rail.scrollLeft += direction * Math.min(32, previous ? time - previous : 16) * .6;
    previous = time;
    if (rail.scrollLeft === before) { stop(); return; }
    frame = requestAnimationFrame(tick);
  };
  rail.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || event.buttons) return stop();
    const rect = rail.getBoundingClientRect();
    direction = event.clientX < rect.left + 32 ? -1 : event.clientX > rect.right - 32 ? 1 : 0;
    if (!direction) stop(); else if (!frame) { rail.classList.add('is-edge-scrolling'); frame = requestAnimationFrame(tick); }
  });
  rail.addEventListener('pointerleave', stop);
  addEventListener('pagehide', () => { stop(); observer.disconnect(); }, { once: true });
}
