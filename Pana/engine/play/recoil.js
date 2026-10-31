// Gun feel in numbers: a kick that snaps and recovers, a camera climb that
// settles back, and a short shake for shots, hits and nearby explosions. Pure
// (no Three.js, no Math.random): the shake is a sum of sines, so Node tests and
// two frames with the same inputs agree. The game applies the offsets.
//
//   const feel = createRecoil();
//   feel.fire({ cam: 2, shake: .3 });                 // when your shot leaves
//   feel.shake(shakeAt(distance, 1));                 // an explosion nearby
//   const { kick, pitch, yaw, roll } = feel.update(dt, { decay: 6 });
//   camera.rotation.set(basePitch + pitch, baseYaw + yaw, roll);

// How hard an explosion `distance` m away shakes the view: full at the blast, nothing past `reach`.
export function shakeAt(distance, power = 1, reach = 16) {
  const k = 1 - Math.max(0, distance) / reach;
  return k > 0 ? power * k * k : 0;
}

// cam: radians ×0.045 the view climbs per shot (it settles back at `recover`/s);
// shake: 0..1.5 of trembling added per shot.
export function createRecoil({ recover = 5, maxClimb = .2 } = {}) {
  let kick = 0, climb = 0, shake = 0, time = 0;
  return {
    fire({ cam = 1, shake: tremble = 0 } = {}) {
      kick = 1; climb = Math.min(maxClimb, climb + cam * .045); shake = Math.max(shake, Math.min(1.5, tremble));
    },
    shake(amount = 0) { shake = Math.max(shake, Math.min(1.5, amount)); },
    // decay: how fast the kick (1 → 0) runs out per second; a heavy weapon recovers slower.
    update(dt, { decay = 6 } = {}) {
      time += dt; kick = Math.max(0, kick - dt * decay); climb = Math.max(0, climb - dt * recover * climb - dt * .01);
      shake = Math.max(0, shake - dt * 3);
      const jolt = shake * shake * .05;
      return {
        kick, shake,
        pitch: climb * (.4 + .6 * kick) + Math.sin(time * 47.3) * Math.cos(time * 13.1) * jolt,
        yaw: Math.sin(time * 39.7 + 1.3) * Math.cos(time * 9.4) * jolt,
        roll: Math.sin(time * 31.1 + 2.1) * jolt * .6,
      };
    },
    reset() { kick = climb = shake = 0; },
  };
}
