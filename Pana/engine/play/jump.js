// One jump for every game where a pana walks: Reliquia and Pepazo. The client
// counts presses (pressJump, wrapping at 256, so a dropped packet cannot lose
// one); the simulation sees a new count and takes off (stepJump). It writes
// only p.jumpHeight / jumpVelocity / jumpPress / jumpPending / jumpWait; the
// game adds p.jumpHeight to the ground height and decides who may jump.
export const JUMP_SPEED = 5, JUMP_GRAVITY = 14;

// The press counter a client sends as input.jump.
export const pressJump = count => (count + 1) & 255;

// The counter from raw input, or `fallback` when the input carries none.
export const jumpCount = (input, fallback = 0) => Number.isInteger(input?.jump) ? input.jump & 255 : fallback;

// Advance p's jump by dt. `blocked` is a state that cannot take off (stunned);
// `gravity` and `speed` are the game's own. `input.jumpDelay` (seconds) holds
// a fresh press back, for a host that catches up a long interval at once.
export function stepJump(p, input, dt, { gravity = JUMP_GRAVITY, speed = JUMP_SPEED, blocked = false } = {}) {
  const count = jumpCount(input, p.jumpPress || 0);
  const pressed = count !== (p.jumpPress || 0); p.jumpPress = count;
  let height = p.jumpHeight || 0, velocity = p.jumpVelocity || 0;
  if (pressed && height <= 0 && !blocked) { p.jumpPending = true; p.jumpWait = Math.max(0, input.jumpDelay || 0); }
  if (p.jumpPending) {
    p.jumpWait -= dt;
    if (p.jumpWait <= 1e-6) { if (height <= 0 && !blocked) velocity = speed; p.jumpPending = false; }
  }
  if (height > 0 || velocity > 0) { height += velocity * dt - .5 * gravity * dt * dt; velocity -= gravity * dt; }
  p.jumpHeight = Math.max(0, height); p.jumpVelocity = height > 0 ? velocity : 0;
}

// Grounded and still: nothing in the air, no press waiting. The counter follows
// the input, so a press made while frozen does not fire when play resumes.
export function resetJump(p, input) {
  p.jumpPress = jumpCount(input, p.jumpPress || 0);
  p.jumpHeight = p.jumpVelocity = 0; p.jumpPending = false;
}