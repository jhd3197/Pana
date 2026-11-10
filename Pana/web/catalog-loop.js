// Recycle offscreen rows, keeping the next row at the exact same screen pixel.
// No duplicated cards, backwards animation, focus jump or growing DOM.
export function catalogLoop(root, hero, paused, changed) {
  let original = [], frame = 0, previous = scrollY, cycling = false;
  function reset() {
    if (!cycling) return;
    for (const row of original) root.append(row);
    cycling = false;
    document.body.classList.remove('catalog-cycling');
    changed();
  }
  function update() {
    frame = 0;
    const down = scrollY > previous;
    previous = scrollY;
    if (paused() || !original.length) return;
    if (scrollY < 100) { reset(); return; }
    if (!down || root.getBoundingClientRect().bottom > innerHeight + 160) return;
    const first = root.firstElementChild, next = first?.nextElementSibling;
    const ceiling = innerWidth > 860 ? hero.getBoundingClientRect().bottom : 0;
    if (!next || first.getBoundingClientRect().bottom > ceiling) return;
    const before = next.getBoundingClientRect().top;
    cycling = true;
    document.body.classList.add('catalog-cycling');
    if (root.moveBefore) root.moveBefore(first, null); else root.append(first);
    const delta = next.getBoundingClientRect().top - before;
    scrollBy({ top: delta, behavior: 'instant' });
    previous = scrollY;
    changed(); // The compensating scroll is not an upward browsing gesture.
    root.dataset.cycles = String(Number(root.dataset.cycles || 0) + 1);
  }
  addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
  return { reset, capture() { original = [...root.children]; previous = scrollY; } };
}
