// The floating tags over the capis: who it is and the health it has left.
// Pure (no DOM): hud.js measures and places them, Node tests check the numbers.

// How a tag shows `hp` out of `max`: the number, and a band for its colour.
export function tagHealth(hp, max = 100) {
  const n = Math.max(0, Math.min(max, Math.round(hp)));
  return { text: String(n), band: n > max * .6 ? 'ok' : n > max * .3 ? 'low' : 'bad' };
}

// Tags that would cover each other are pushed up until they don't, the one
// lowest on screen staying put. `items`: { id, x, y (the anchor: bottom
// centre), w, h }; returns a Map id → the y to draw it at.
export function stackTags(items, gap = 2) {
  const placed = [], out = new Map();
  for (const t of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let y = t.y;
    for (let pass = 0; pass <= placed.length; pass++) {
      const hit = placed.find(p => Math.abs(p.x - t.x) < (p.w + t.w) / 2 + gap && y > p.y - p.h - gap && y - t.h < p.y + gap);
      if (!hit) break;
      y = hit.y - hit.h - gap;
    }
    placed.push({ ...t, y }); out.set(t.id, y);
  }
  return out;
}
