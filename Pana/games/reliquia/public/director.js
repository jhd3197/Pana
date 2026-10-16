export function createDirector() { return { phase: 'rest', time: 0, duration: 12, spawnIn: 3, waves: 0 }; }
export function random(state) { let x = state.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; state.rng = x >>> 0; return state.rng / 4294967296; }
export function updateDirector(state, dt, spawn) {
  const d = state.director, active = state.players.filter(p => !p.downed && !p.spectator);
  if (!active.length) return;
  const pressure = Math.max(...active.map(p => p.intensity)); d.time += dt;
  const enter = (phase, duration = 0) => { d.phase = phase; d.time = 0; d.duration = duration; };
  // The guardian is an authored encounter. Never pile ambient waves onto it.
  if (state.enemies.some(e => e.kind === 'guardian' && e.hp > 0 && e.awake)) { enter('fade'); return; }
  if (d.phase === 'rest' && d.time >= d.duration) enter('build');
  else if (d.phase === 'build' && (pressure > 0.72 || d.time > 28)) enter('peak', 3 + random(state) * 2);
  else if (d.phase === 'peak' && d.time >= d.duration) enter('fade');
  else if (d.phase === 'fade' && pressure < 0.27) enter('rest', 22 + random(state) * 13);
  if (d.phase === 'build' || d.phase === 'peak') {
    d.spawnIn -= dt;
    if (d.spawnIn <= 0) {
      const count = Math.min(5, 1 + Math.ceil(active.length / 2));
      if (spawn(count)) d.waves++;
      d.spawnIn = 9 + random(state) * 7;
    }
  }
}
