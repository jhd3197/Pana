import { coverFor, boundsFor, segmentBox } from './rules.js';

// A square, north-up map in the HUD corner centred on your pana, showing about
// MINIMAP_RADIUS metres each way: cover, your team and only the rivals you can
// actually see. Teammates, domination zones and flags out of that window sit
// on its edge, pointing their way; rivals out of it are not shown. Holding Tab
// draws the whole court with the same rules into the scoreboard's canvas.
export const MINIMAP_RADIUS = 30;
const ORANGE = '#f28b42', TEAL = '#29c5cd';

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

function paint(g, view, state, id, forward, dpr) {
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
  g.fillStyle = 'rgba(14, 11, 36, .8)'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(244, 233, 210, .85)';
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
    const seen = friend || (me && !cover.some(o => segmentBox(me.x, me.z, p.x - me.x, p.z - me.z, o) !== null));
    if (!seen) continue;
    g.fillStyle = p.color; g.strokeStyle = friend ? '#fff' : '#1b1b1b'; g.lineWidth = dpr;
    g.beginPath(); g.arc(spot.x, spot.y, 3.4 * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
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
  const g = canvas.getContext('2d'), full = court?.getContext('2d');
  return {
    // full: the scoreboard is open, so its canvas gets the whole court too.
    draw(state, id, forward, showCourt = false) {
      const playing = state.phase === 'playing'; canvas.hidden = !playing; if (!playing) return;
      const me = state.players.find(p => p.id === id), dpr = devicePixelRatio, [px] = fit(canvas);
      paint(g, localView(me?.x ?? 0, me?.z ?? 0, px), state, id, forward, dpr);
      if (!showCourt || !full) return;
      // The court's own shape (El Puerto is long and narrow), a metre of margin around it.
      const bounds = boundsFor(state.mapId), ratio = `${bounds.x + 1} / ${bounds.z + 1}`;
      if (court.style.aspectRatio !== ratio) court.style.aspectRatio = ratio;
      if (court.clientWidth) paint(full, courtView(bounds, ...fit(court)), state, id, forward, dpr);
    },
  };
}
