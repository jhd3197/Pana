// Purple-release slow-mo: a fraction of a second at half speed when a
// max-charge drift pays its turbo. Local presentation only: game.js scales
// the time it feeds the fixed-step loop, never the step itself and never an
// online race (the room's clock stays the room's).
const DURATION = 0.3;   // seconds of dilation
const SCALE = 0.5;      // time factor at the dip
const PUNCH = 7;        // FOV degrees the dip pulls in

export function createSlowMo() {
  let t = 0;
  return {
    trigger() { t = DURATION; },
    update(dt) { t = Math.max(0, t - dt); },
    get active() { return t > 0; },
    // Full dip on release, easing back to full speed over the window.
    get scale() { return t > 0 ? 1 - (1 - SCALE) * (t / DURATION) : 1; },
    get punch() { return t > 0 ? PUNCH * (t / DURATION) : 0; },
  };
}
