import { coverFor, boundsFor } from './rules.js';

// A square, north-up map in the HUD corner centred on your pana, showing about
// MINIMAP_RADIUS metres each way: the court's floor, what stands on it and your
// team. A rival shows only for a moment after an unsilenced shot. Teammates,
// domination zones and flags out of that window sit on its edge, pointing their
// way; rivals out of it are not shown. Holding Tab draws the whole court with the
// same rules into the scoreboard's canvas.
export const MINIMAP_RADIUS = 18;
// How far a shot shows on the map (times the class's `mark`), and for how long.
export const SHOT_REACH = 30, SHOT_REVEAL = 1.6;
const ORANGE = '#f28b42', TEAL = '#29c5cd';
const OFF_COURT = '#0e0b24', FLOOR = '#40395f', SCENERY = '#7d7699', COVER = '#f4e9d2';
// Scenery is drawn this many metres past the court's edge, at this many pixels a metre.
const BAKE_MARGIN = 14, BAKE_SCALE = 4;

// Pixels per metre for a canvas side of px showing radius metres each way from its centre.
export const minimapScale = (px, radius = MINIMAP_RADIUS) => px / (radius * 2);
// The window around (cx, cz): world x runs right and world z down (north up).
export const localView = (cx, cz, px, radius = MINIMAP_RADIUS) => ({ cx, cz, scale: minimapScale(px, radius), w: px, h: px });
// The whole court (bounds' half extents) fitted inside a w x h canvas with a metre to spare.
export const courtView = (bounds, w, h = w) => ({ cx: 0, cz: 0, scale: Math.min(w / (bounds.x * 2 + 2), h / (bounds.z * 2 + 2)), w, h });
// World (x, z) → canvas pixels.
export const project = (view, x, z) => ({ x: view.w / 2 + (x - view.cx) * view.scale, y: view.h / 2 + (z - view.cz) * view.scale });
// A projected point kept inside the w x h box, inset from its edges: points already
// inside stay put; others slide along the line from the centre onto the edge.
// angle is the direction from the centre (canvas radians: 0 right, π/2 down).
export function clampToEdge(point, w, inset = 0, h = w) {
  const cx = w / 2, cy = h / 2, dx = point.x - cx, dy = point.y - cy, far = Math.max(Math.abs(dx) / (cx - inset), Math.abs(dy) / (cy - inset));
  const angle = Math.atan2(dy, dx);
  if (far <= 1) return { x: point.x, y: point.y, inside: true, angle };
  return { x: cx + dx / far, y: cy + dy / far, inside: false, angle };
}

const teamColor = team => team ? TEAL : ORANGE;
// How big and how far a rival shows: the room's `mark` for its class, 1 when absent or hostile.
export const rivalMark = p => Number.isFinite(p?.mark) && p.mark > 0 ? Math.min(2, p.mark) : 1;

// Who fired lately, from each pana's `loud` counter. The first look at a pana only
// takes its count, so joining mid-round reveals nobody. amount() is how strongly
// the dot shows: 1, fading out over the last third.
export function createShotReveal(hold = SHOT_REVEAL) {
  const counts = new Map(), until = new Map();
  return {
    update(players, now) {
      for (const p of players) {
        const n = p.loud || 0, before = counts.get(p.id); counts.set(p.id, n);
        if (before !== undefined && n > before) until.set(p.id, now + hold);
      }
    },
    amount(id, now) { const end = until.get(id); return end > now ? Math.min(1, (end - now) / (hold / 3)) : 0; },
  };
}
// How strongly rival p shows for me: only a recent shot within reach. Sigiloso's mark shortens the reach.
export const rivalShown = (me, p, amount) => amount > 0 && me && Math.hypot(p.x - me.x, p.z - me.z) <= SHOT_REACH * rivalMark(p) ? amount : 0;

// The footprint of what you can see from the court's floor, from the scene's
// triangles (six numbers each, as collectSolids gives them) as [minX, minZ, maxX,
// maxZ]. Not the ground, not what hangs overhead (roofs, canopies, treetops, which
// would hide the floor under them) and not a triangle wide both ways (hills, sky).
export function sceneryBoxes(solids, { ground = .08, overhead = 2.4, wide = 8 } = {}) {
  const out = [];
  for (let i = 0; i + 5 < solids.length; i += 6) {
    if (solids[i + 4] <= ground || solids[i + 1] >= overhead) continue;
    if (solids[i + 3] - solids[i] > wide && solids[i + 5] - solids[i + 2] > wide) continue;
    out.push([solids[i], solids[i + 2], solids[i + 3], solids[i + 5]]);
  }
  return out;
}
// The scenery of a court as a picture, so a frame only copies it.
function bakeScenery(boxes, bounds, mapId, variant) {
  const x = bounds.x + BAKE_MARGIN, z = bounds.z + BAKE_MARGIN, canvas = document.createElement('canvas');
  canvas.width = Math.ceil(x * 2 * BAKE_SCALE); canvas.height = Math.ceil(z * 2 * BAKE_SCALE);
  const g = canvas.getContext('2d'); g.fillStyle = SCENERY;
  // A wall's triangles have no depth from above: at least a pixel, or it would not show.
  for (const [ax, az, bx, bz] of boxes) g.fillRect((ax + x) * BAKE_SCALE, (az + z) * BAKE_SCALE, Math.max(1, (bx - ax) * BAKE_SCALE), Math.max(1, (bz - az) * BAKE_SCALE));
  return { canvas, x, z, mapId, variant };
}

function paint(g, view, state, id, forward, dpr, scenery, reveal, now) {
  const { w, h, scale } = view, at = (x, z) => project(view, x, z), inset = 11 * dpr, clamp = p => clampToEdge(p, w, inset, h);
  const me = state.players.find(p => p.id === id), teams = ['teams', 'ctf', 'dom'].includes(state.options?.mode), cover = coverFor(state.mapId, state.variant || 0);
  // A small arrow on the edge pointing out towards something off the window.
  const edge = (spot, color, s = 6.5 * dpr) => {
    const { x, y, angle: a } = spot;
    g.beginPath(); g.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    g.lineTo(x + Math.cos(a + 2.4) * s, y + Math.sin(a + 2.4) * s); g.lineTo(x + Math.cos(a - 2.4) * s, y + Math.sin(a - 2.4) * s); g.closePath();
    g.fillStyle = color; g.fill(); g.strokeStyle = '#16161a'; g.lineWidth = 1.5 * dpr; g.stroke();
  };
  g.clearRect(0, 0, w, h);
  g.fillStyle = OFF_COURT; g.fillRect(0, 0, w, h);
  // The floor you can walk, then whatever else stands in the scene, then the cover.
  const bounds = boundsFor(state.mapId), floor = at(-bounds.x, -bounds.z);
  g.fillStyle = FLOOR; g.fillRect(floor.x, floor.y, bounds.x * 2 * scale, bounds.z * 2 * scale);
  if (scenery?.mapId === state.mapId && scenery.variant === (state.variant || 0)) { const a = at(-scenery.x, -scenery.z); g.drawImage(scenery.canvas, a.x, a.y, scenery.x * 2 * scale, scenery.z * 2 * scale); }
  g.fillStyle = COVER;
  for (const o of cover) {
    const a = at(o.x - o.w / 2, o.z - o.d / 2), ow = o.w * scale, od = o.d * scale;
    if (a.x > w || a.y > h || a.x + ow < 0 || a.y + od < 0) continue;
    g.fillRect(a.x, a.y, ow, od);
  }
  // Domination zones: a ring in the owner's colour (white while nobody holds it).
  for (const zone of state.options?.mode === 'dom' ? state.zones || [] : []) {
    const color = zone.owner === null ? '#f8f0d2' : teamColor(zone.owner), spot = clamp(at(zone.x, zone.z));
    if (!spot.inside) { edge(spot, color); continue; }
    g.beginPath(); g.arc(spot.x, spot.y, zone.radius * scale, 0, Math.PI * 2); g.strokeStyle = color; g.lineWidth = 2 * dpr; g.stroke();
  }
  for (const flag of state.options?.mode === 'ctf' ? state.flags || [] : []) {
    const spot = clamp(at(flag.x, flag.z));
    if (!spot.inside) { edge(spot, teamColor(flag.team)); continue; }
    g.fillStyle = teamColor(flag.team); g.fillRect(spot.x - 3 * dpr, spot.y - 3 * dpr, 6 * dpr, 6 * dpr);
  }
  for (const p of state.players) {
    if (p.id === id || !p.connected || p.respawn > 0 || p.eliminated) continue;
    const friend = teams && me && p.team === me.team, spot = clamp(at(p.x, p.z));
    if (!spot.inside) { if (friend) edge(spot, p.color, 5.5 * dpr); continue; }
    // A rival shows for a moment after a loud shot. Its class sets the dot (`mark`, from
    // the room): Sigiloso's is small and shows only up close.
    const mark = friend ? 1 : rivalMark(p), shown = friend ? 1 : rivalShown(me, p, reveal.amount(p.id, now));
    if (!shown) continue;
    g.globalAlpha = shown; g.fillStyle = p.color; g.strokeStyle = friend ? '#fff' : '#1b1b1b'; g.lineWidth = dpr;
    g.beginPath(); g.arc(spot.x, spot.y, 3.4 * Math.min(1.3, mark) * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
    g.globalAlpha = 1;
  }
  if (me) {
    // Your pana: an arrow pointing where the crosshair looks.
    const { x, y: z } = at(me.x, me.z), a = Math.atan2(forward.z, forward.x), s = 7 * dpr;
    g.fillStyle = '#ffffff'; g.beginPath();
    g.moveTo(x + Math.cos(a) * s, z + Math.sin(a) * s); g.lineTo(x + Math.cos(a + 2.5) * s * .8, z + Math.sin(a + 2.5) * s * .8); g.lineTo(x + Math.cos(a - 2.5) * s * .8, z + Math.sin(a - 2.5) * s * .8);
    g.closePath(); g.fill(); g.strokeStyle = '#16161a'; g.lineWidth = 1.5 * dpr; g.stroke();
  }
  // A square frame: a dark outline with a white line inside it.
  g.strokeStyle = '#16161a'; g.lineWidth = 5 * dpr; g.strokeRect(2.5 * dpr, 2.5 * dpr, w - 5 * dpr, h - 5 * dpr);
  g.strokeStyle = '#fff'; g.lineWidth = 2.5 * dpr; g.strokeRect(2.5 * dpr, 2.5 * dpr, w - 5 * dpr, h - 5 * dpr);
}

// The canvas's backing store at device pixels; returns its size.
const fit = canvas => { const w = Math.round(canvas.clientWidth * devicePixelRatio), h = Math.round(canvas.clientHeight * devicePixelRatio); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } return [w, h]; };

export function createMinimap(canvas, court) {
  const g = canvas.getContext('2d'), full = court?.getContext('2d'), reveal = createShotReveal();
  let scenery = null;
  return {
    reveal,
    // Reads a court's scenery from its meshes, once per round, behind the loading card.
    async bake(root, mapId, variant = 0) {
      try {
        const { collectSolids } = await import('/engine/play/collision-debug.js');
        scenery = bakeScenery(sceneryBoxes(collectSolids(root)), boundsFor(mapId), mapId, variant);
      } catch { scenery = null; } // the map still shows the floor and the cover
    },
    // full: the scoreboard is open, so its canvas gets the whole court too.
    draw(state, id, forward, showCourt = false) {
      const playing = state.phase === 'playing'; canvas.hidden = !playing; if (!playing) return;
      const me = state.players.find(p => p.id === id), dpr = devicePixelRatio, [px] = fit(canvas), now = performance.now() / 1000;
      reveal.update(state.players, now);
      paint(g, localView(me?.x ?? 0, me?.z ?? 0, px), state, id, forward, dpr, scenery, reveal, now);
      if (!showCourt || !full) return;
      // The court's own shape (El Puerto is long and narrow), a metre of margin around it.
      const bounds = boundsFor(state.mapId), ratio = `${bounds.x + 1} / ${bounds.z + 1}`;
      if (court.style.aspectRatio !== ratio) court.style.aspectRatio = ratio;
      if (court.clientWidth) paint(full, courtView(bounds, ...fit(court)), state, id, forward, dpr, scenery, reveal, now);
    },
  };
}
