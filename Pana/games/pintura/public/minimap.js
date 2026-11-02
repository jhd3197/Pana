import { coverFor, sizeFor, segmentBox } from './rules.js';

// A round, north-up overview in the HUD corner: cover, your team and only the rivals
// you can actually see, so the larger courts stay readable in first person.
export function createMinimap(canvas) {
  const g = canvas.getContext('2d');
  return {
    draw(state, id, forward) {
      const playing = state.phase === 'playing'; canvas.hidden = !playing; if (!playing) return;
      const px = Math.round(canvas.clientWidth * devicePixelRatio);
      if (canvas.width !== px) canvas.width = canvas.height = px;
      const size = sizeFor(state.mapId), scale = px * 1.2 / (size * 2 + 2), at = v => px / 2 + v * scale;
      const me = state.players.find(p => p.id === id), teams = ['teams', 'ctf', 'dom'].includes(state.options?.mode), cover = coverFor(state.mapId, state.variant || 0);
      g.clearRect(0, 0, px, px);
      const dpr = devicePixelRatio, ring = () => { g.restore(); g.beginPath(); g.arc(px / 2, px / 2, px / 2 - 2.5 * dpr, 0, Math.PI * 2); g.strokeStyle = '#16161a'; g.lineWidth = 5 * dpr; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 2.5 * dpr; g.stroke(); };
      g.save(); g.beginPath(); g.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2); g.clip();
      g.fillStyle = 'rgba(14, 11, 36, .8)'; g.fillRect(0, 0, px, px);
      g.fillStyle = 'rgba(244, 233, 210, .85)';
      for (const o of cover) g.fillRect(at(o.x - o.w / 2), at(o.z - o.d / 2), o.w * scale, o.d * scale);
      // Domination zones: a ring in the owner's colour (white while nobody holds it).
      for (const zone of state.options?.mode === 'dom' ? state.zones || [] : []) { g.beginPath(); g.arc(at(zone.x), at(zone.z), zone.radius * scale, 0, Math.PI * 2); g.strokeStyle = zone.owner === null ? '#f8f0d2' : zone.owner ? '#29c5cd' : '#f28b42'; g.lineWidth = 2 * devicePixelRatio; g.stroke(); }
      for (const flag of state.options?.mode === 'ctf' ? state.flags || [] : []) { g.fillStyle = flag.team ? '#29c5cd' : '#f28b42'; g.fillRect(at(flag.x) - 3 * devicePixelRatio, at(flag.z) - 3 * devicePixelRatio, 6 * devicePixelRatio, 6 * devicePixelRatio); }
      for (const p of state.players) {
        if (p.id === id || !p.connected || p.respawn > 0 || p.eliminated) continue;
        const friend = teams && me && p.team === me.team;
        const seen = friend || (me && !cover.some(o => segmentBox(me.x, me.z, p.x - me.x, p.z - me.z, o) !== null));
        if (!seen) continue;
        g.fillStyle = p.color; g.strokeStyle = friend ? '#fff' : '#1b1b1b'; g.lineWidth = devicePixelRatio;
        g.beginPath(); g.arc(at(p.x), at(p.z), 3.4 * devicePixelRatio, 0, Math.PI * 2); g.fill(); g.stroke();
      }
      if (!me) { ring(); return; }
      // Your pana: an arrow pointing where the crosshair looks.
      const x = at(me.x), z = at(me.z), a = Math.atan2(forward.z, forward.x), s = 6 * devicePixelRatio;
      g.fillStyle = '#ffffff'; g.beginPath();
      g.moveTo(x + Math.cos(a) * s, z + Math.sin(a) * s); g.lineTo(x + Math.cos(a + 2.5) * s * .8, z + Math.sin(a + 2.5) * s * .8); g.lineTo(x + Math.cos(a - 2.5) * s * .8, z + Math.sin(a - 2.5) * s * .8);
      g.closePath(); g.fill(); ring();
    },
  };
}
