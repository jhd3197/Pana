// Waits and tweens on game time, so ?speed, the pause menu and the suites'
// fastForward all move the board's async turn flow together. step(dt) is
// called once per frame with the paced dt; nothing here reads a wall clock.

export const ease = (k) => k * k * (3 - 2 * k);

export function createGameTime() {
  let jobs = [];
  return {
    // Resolves after s seconds of game time.
    wait: (s) => new Promise((resolve, reject) => jobs.push({ t: s, resolve, reject })),
    // Calls fn(k) with k going 0→1 over dur seconds, then resolves.
    tween: (dur, fn) => new Promise((resolve, reject) => jobs.push({ t: dur, dur, fn, resolve, reject })),
    step(dt) {
      const done = [];
      for (const j of jobs) {
        j.t -= dt;
        if (j.fn) j.fn(Math.min(1, 1 - j.t / j.dur));
        if (j.t <= 0) done.push(j);
      }
      if (done.length) {
        jobs = jobs.filter((j) => !done.includes(j));
        for (const j of done) j.resolve();
      }
    },
    // Rejects every pending wait and tween with reason (a host change ends the turn flow).
    cancel(reason) {
      const pending = jobs; jobs = [];
      for (const j of pending) j.reject(reason);
    },
  };
}
