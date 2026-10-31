// When a walking pana's feet land: a step every `stride` metres (a longer one
// sprinting, so speed sets the cadence), alternating feet, plus the take-off
// and landing of a jump. Pure: it only calls the `sink` you give it, which is
// the engine's `sfx` (step, jump, land), so a game adds sound in one line:
//   const feet = createFootsteps();
//   feet.update(dt, { speed: Math.hypot(p.vx, p.vz), height: p.jumpHeight, sprint, surface: 'wood' }, sfx);
// `surface` is any key of sfx's SURFACES; give it per frame to switch floors.
export function createFootsteps({ stride = 2.2, sprintStride = 2.7, minSpeed = .6, maxJump = .9 } = {}) {
  let dist = 0, foot = 0, air = false, peak = 0;
  return {
    update(dt, { speed = 0, height = 0, sprint = false, surface = 'concrete', volume = 1 } = {}, sink) {
      const length = sprint ? sprintStride : stride, flying = height > .02;
      if (flying) {
        if (!air) { air = true; peak = 0; sink?.jump?.(surface, { volume }); }
        peak = Math.max(peak, height); return;
      }
      if (air) { air = false; dist = 0; sink?.land?.(surface, { power: Math.min(1, .35 + peak / maxJump * .65), volume }); }
      if (speed <= minSpeed) { dist = Math.max(dist, length * .6); return; }
      dist += speed * dt;
      for (let n = 0; dist >= length && n < 3; n++) { dist -= length; foot ^= 1; sink?.step?.(surface, { sprint, foot, volume }); }
      if (dist > length) dist = 0;
    },
    reset() { dist = foot = peak = 0; air = false; },
  };
}
