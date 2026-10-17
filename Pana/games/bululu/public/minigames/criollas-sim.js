import { createPitch, throwBall, stepPitch, moving, closest, botShot, clamp, STEP } from '/engine/bolas-criollas.js';

export function createCriollasMini(humans, random) {
  const pitch = createPitch((random() - .5) * 2, -5.5 - random());
  const players = humans.map((human, i) => ({ human, left: 2, angle: 0, power: .62, cooldown: 0,
    aimSeed: Math.floor(random() * 10000), next: 1 + random() * 2.5, originX: (i - 1.5) * 2.1 }));
  let clock = 0, accumulator = 0;
  function update(dt, inputs) {
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0; clock += dt;
    players.forEach((p, i) => {
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (!p.left || clock >= 30) return;
      const input = inputs[i] || {};
      if (p.human) {
        p.angle = clamp(p.angle + (input.x || 0) * dt * .35, -.65, .65);
        p.power = clamp(p.power + (input.z || 0) * dt * .28, .1, 1);
      }
      const fire = p.human ? input.jump : clock >= p.next;
      if (fire && !p.cooldown) {
        const shot = p.human ? p : botShot(pitch, p.aimSeed + p.left * 11, p.originX);
        if (throwBall(pitch, i, shot, p.originX)) { p.left--; p.cooldown = 2.5; p.next = clock + 5 + random() * 2; }
      }
    });
    accumulator += dt;
    while (accumulator >= STEP) { stepPitch(pitch); accumulator -= STEP; }
  }
  const scores = () => players.map((_, i) => { const d = closest(pitch, i); return Number.isFinite(d) ? Math.max(1, Math.round(1000 - d * 30)) : 0; });
  const winners = () => {
    const distances = players.map((_, i) => closest(pitch, i)), best = Math.min(...distances);
    return Number.isFinite(best) ? distances.flatMap((d, i) => d - best <= .005 ? [i] : []) : [];
  };
  return { pitch, players, update, scores, winners, get clock() { return clock; },
    over: () => !moving(pitch) && (pitch.balls[0].out || clock >= 30 || players.every(p => !p.left)) };
}
