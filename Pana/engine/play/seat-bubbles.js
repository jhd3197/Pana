// Speech bubbles over the seated panas of a table game (barks from
// engine/play/frases.js, quick chat). One DOM bubble per seat; the scene calls
// tick() once a frame and place() with the screen point of the seat's name
// chip. Styles are .pk-bubble in kit.css. `typer(el, text, seat)` writes the line
// instead of setting it at once (engine/fx/dialogue.js) and returns
// { seconds, stop }: the bubble stays up until the line has been read.
const READ_AFTER = 1.1;   // seconds a written line stays up once it's all there
export function createSeatBubbles(container, count, { typer = null } = {}) {
  let time = 0;
  const bubbles = Array.from({ length: count }, () => {
    const el = document.createElement('div'); el.className = 'pk-bubble'; el.hidden = true; container.append(el);
    return { el, until: 0, line: null };
  });
  return {
    say(seat, text, duration = 1.6) {
      const bubble = bubbles[seat]; if (!bubble || !text) return;
      bubble.line?.stop(); bubble.line = null; bubble.el.hidden = false;
      if (typer) bubble.line = typer(bubble.el, text, seat); else bubble.el.textContent = text;
      bubble.until = time + Math.max(duration, (bubble.line?.seconds ?? 0) + READ_AFTER);
      bubble.el.classList.remove('pop'); void bubble.el.offsetWidth; bubble.el.classList.add('pop');
    },
    tick(dt) { time += dt; for (const b of bubbles) if (!b.el.hidden && time > b.until) { b.line?.stop(); b.line = null; b.el.hidden = true; } },
    // True while this seat's line is still being written.
    talking: (seat) => !!bubbles[seat]?.line?.talking && !bubbles[seat].el.hidden,
    // Above the chip; a seat near the top edge gets its bubble below instead.
    place(seat, x, y, gap = 34) {
      const bubble = bubbles[seat]; if (!bubble || bubble.el.hidden) return;
      const below = y - gap - bubble.el.offsetHeight < 8, half = bubble.el.offsetWidth / 2;
      bubble.el.classList.toggle('below', below);
      bubble.el.style.left = `${Math.min(Math.max(x, half + 8), innerWidth - half - 8)}px`;
      bubble.el.style.top = `${below ? y + gap : y - gap}px`;
    },
    hide(seat) { const b = bubbles[seat]; if (b) { b.line?.stop(); b.line = null; b.el.hidden = true; } },
    dispose() { bubbles.forEach(b => { b.line?.stop(); b.el.remove(); }); },
  };
}
