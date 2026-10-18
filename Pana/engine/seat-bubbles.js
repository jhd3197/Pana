// Speech bubbles over the seated panas of a table game (barks from
// engine/frases.js, quick chat). One DOM bubble per seat; the scene calls
// tick() once a frame and place() with the screen point of the seat's name
// chip. Styles are .pk-bubble in kit.css.
export function createSeatBubbles(container, count) {
  let time = 0;
  const bubbles = Array.from({ length: count }, () => {
    const el = document.createElement('div'); el.className = 'pk-bubble'; el.hidden = true; container.append(el);
    return { el, until: 0 };
  });
  return {
    say(seat, text, duration = 1.6) {
      const bubble = bubbles[seat]; if (!bubble || !text) return;
      bubble.el.textContent = text; bubble.until = time + duration; bubble.el.hidden = false;
      bubble.el.classList.remove('pop'); void bubble.el.offsetWidth; bubble.el.classList.add('pop');
    },
    tick(dt) { time += dt; for (const b of bubbles) if (!b.el.hidden && time > b.until) b.el.hidden = true; },
    // Above the chip; a seat near the top edge gets its bubble below instead.
    place(seat, x, y, gap = 34) {
      const bubble = bubbles[seat]; if (!bubble || bubble.el.hidden) return;
      const below = y - gap - bubble.el.offsetHeight < 8, half = bubble.el.offsetWidth / 2;
      bubble.el.classList.toggle('below', below);
      bubble.el.style.left = `${Math.min(Math.max(x, half + 8), innerWidth - half - 8)}px`;
      bubble.el.style.top = `${below ? y + gap : y - gap}px`;
    },
    hide(seat) { if (bubbles[seat]) bubbles[seat].el.hidden = true; },
    dispose() { bubbles.forEach(b => b.el.remove()); },
  };
}
