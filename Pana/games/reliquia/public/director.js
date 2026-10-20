// The Director paces danger: build, peak, fade, rest. La codicia shortens
// the rests and swells the waves; the guardian and the vault jaguar are
// authored encounters, so no ambient wave piles onto them.
export function createDirector() { return { phase: 'rest', time: 0, duration: 22, spawnIn: 3, waves: 0 }; }
export function random(state) { let x = state.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; state.rng = x >>> 0; return state.rng / 4294967296; }
const SIZE = 220;
export function updateDirector(state, dt, spawn) {
  const d = state.director, below = state.players.filter(p => !p.downed && !p.spectator && Math.round(p.x / SIZE) > 0);
  if (!below.length) return;
  const deepest = Math.max(...below.map(p => Math.round(p.x / SIZE)));
  const tier = Math.min(4, Math.floor(state.codicia / 25)), pressure = Math.max(...below.map(p => 1 - p.hp / 100));
  d.time += dt;
  const enter = (phase, duration = 0) => { d.phase = phase; d.time = 0; d.duration = duration; };
  if (state.enemies.some(e => (e.kind === 'guardian' || e.kind === 'jaguar') && e.hp > 0 && e.awake)) { if (d.phase !== 'fade') enter('fade'); return; }
  if (d.phase === 'rest' && d.time >= d.duration) enter('build');
  else if (d.phase === 'build' && (pressure > .6 || d.time > (deepest === 1 ? 16 : 26) - tier * 3)) enter('peak', 3 + random(state) * 2);
  else if (d.phase === 'peak' && d.time >= d.duration) enter('fade');
  else if (d.phase === 'fade' && (pressure < .35 || d.time > 12)) enter('rest', (22 + random(state) * 13) * (1 - .15 * tier) * (deepest === 1 ? 1.4 : 1));
  if (d.phase === 'build' || d.phase === 'peak') {
    d.spawnIn -= dt;
    if (d.spawnIn <= 0) {
      const target = below[Math.floor(random(state) * below.length)], floor = Math.round(target.x / SIZE);
      const here = below.filter(p => Math.round(p.x / SIZE) === floor).length;
      // Floor 1 is the outskirts: small waves; deeper floors bring more.
      if (spawn(floor, Math.min(6, Math.max(1, Math.ceil(here * (.35 + .15 * floor))) + Math.floor(tier / 2)))) d.waves++;
      d.spawnIn = (9 + random(state) * 7) * (1 - .12 * tier);
    }
  }
}
