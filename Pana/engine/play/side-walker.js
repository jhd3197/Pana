// A body that walks on destructible ground seen from the side (terrain-mask.js):
// left and right, small steps up, a jump, falling off ledges, knockback from
// blasts, and sliding down painted slopes. Pure, so rules and tests share it.
//
//   p = { x, y, vx: 0, vy: 0, grounded: false, facing: 1 }   // y is the feet
//   const r = stepSideWalker(p, { x: -1, jump: count }, dt, mask, { water: 4 });
//   if (r.jumped) sfx.jump(); if (r.drowned) out(p);
//   knock(p, 6, 8);                                          // a blast throws it
//
// The jump uses jump.js's press counter (pressJump on the client, jumpCount
// here). stepJump itself is not used: it keeps a height over a flat floor,
// while a side view needs one gravity for jumps, ledges and knockback.
import { jumpCount } from './jump.js';
import { groundBelow, circleHits, surfaceNormal, stainAt, slopeAt } from './terrain-mask.js';

const DEG = Math.PI / 180;
export const SIDE_WALKER = Object.freeze({
  walk: 2.4,            // units/s on flat ground
  jump: 7.2,            // take-off speed up
  jumpForward: 2.8,     // and along the facing
  gravity: 18,
  radius: .7,           // the body disc, standing on the feet
  stepUp: .35,          // the tallest bump walked over
  stepDown: .45,        // the deepest dip followed without falling
  maxClimb: 52 * DEG,   // bare ground steeper than this cannot be walked up
  slipAngle: 12 * DEG,  // painted ground steeper than this slides
  slick: .25,           // paint (0..1) under the feet that makes ground slippery
  slideGrip: .25,       // share of gravity along a painted slope that friction holds back
  water: -Infinity,     // feet below this are in the river
});

const sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;

// Thrown by a blast: off the ground with this velocity.
export function knock(p, vx, vy) { p.vx = vx; p.vy = vy; p.grounded = false; p.slide = 0; }

// Standing still on the ground (a turn may end), or gone into the water.
export const settled = p => p.drowned || (p.grounded && Math.abs(p.slide || 0) < .05);

export function stepSideWalker(p, input = {}, dt, mask, options = {}) {
  const o = { ...SIDE_WALKER, ...options }, cell = mask.cell, out = { jumped: false, landed: false, drowned: false, blocked: false };
  if (p.drowned) return out;
  const count = jumpCount(input, p.jumpPress || 0), pressed = count !== (p.jumpPress || 0); p.jumpPress = count;
  const dir = o.frozen ? 0 : sign(input.x || 0);
  if (dir) p.facing = dir;
  p.slide ||= 0;
  if (p.grounded) {
    // The ground under us may have been blown away.
    const floor = groundBelow(mask, p.x, p.y + cell, o.stepDown + cell);
    if (floor === null) { p.grounded = false; p.vx = p.slide; p.vy = 0; }
    else p.y = floor;
  }
  if (p.grounded && pressed && !o.frozen) {
    p.grounded = false; p.vx = p.facing * o.jumpForward + p.slide * .5; p.vy = o.jump; p.slide = 0; out.jumped = true;
  } else if (p.grounded) {
    const slope = slopeAt(mask, p.x, p.y), angle = Math.atan(Math.abs(slope)), down = -sign(slope);
    const slick = stainAt(mask, p.x, p.y - cell, .3) >= o.slick && angle > o.slipAngle;
    if (slick) p.slide += down * o.gravity * Math.sin(angle) * (1 - o.slideGrip) * dt;
    else p.slide *= Math.exp(-dt * 14);
    if (Math.abs(p.slide) < .01) p.slide = 0;
    // Uphill on paint the feet only paddle.
    const walk = dir * o.walk * (slick && dir === -down ? .25 : 1);
    const distance = (walk + p.slide) * dt;
    const steps = Math.ceil(Math.abs(distance) / (cell * .5)), d = steps ? distance / steps : 0;
    for (let i = 0; i < steps; i++) {
      const nx = p.x + d;
      if (nx < 0 || nx > mask.width) { out.blocked = true; p.slide = 0; break; }
      const wall = circleHits(mask, nx + sign(d) * o.radius * .3, p.y + o.stepUp + o.radius, o.radius * .75);
      const top = groundBelow(mask, nx, p.y + o.stepUp, o.stepUp + o.stepDown);
      const steep = top !== null && top > p.y + cell * .5 && !slick && Math.atan(Math.abs(slopeAt(mask, nx, top))) > o.maxClimb;
      if (wall || steep) { out.blocked = true; p.slide = 0; break; }
      p.x = nx;
      if (top === null) { p.grounded = false; p.vx = walk + p.slide; p.vy = 0; break; }
      p.y = top;
    }
  }
  if (!p.grounded) {
    p.vy -= o.gravity * dt; p.vx *= Math.exp(-dt * .4);
    const dx = p.vx * dt, dy = p.vy * dt, steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cell * .5)));
    for (let i = 0; i < steps; i++) {
      const nx = p.x + dx / steps, ny = p.y + dy / steps;
      if (!circleHits(mask, nx, ny + o.radius, o.radius * .9)) { p.x = nx; p.y = ny; continue; }
      const n = surfaceNormal(mask, nx, ny + o.radius, o.radius * 1.4);
      // Land only with ground under the feet: brushing the side of a rounded
      // lip is a wall to slide off, not a floor (that left bodies perched in the air).
      const floor = n.y > .5 && p.vy <= 0 ? groundBelow(mask, nx, ny + o.radius, o.radius + o.stepDown) : null;
      if (floor !== null) {
        p.x = nx; p.y = floor; p.grounded = true; out.landed = true;
        p.slide = stainAt(mask, p.x, p.y - cell, .3) >= o.slick ? p.vx * .6 : 0; p.vx = p.vy = 0;
        break;
      }
      // A wall or a ceiling: lose the speed into it (keeping a little bounce),
      // step back out along the normal and keep sliding along it.
      const into = p.vx * n.x + p.vy * n.y, falling = p.vy <= 0;
      if (into < 0) { p.vx -= 1.3 * into * n.x; p.vy -= 1.3 * into * n.y; }
      let px = nx, py = ny;
      for (let k = 0; k < 8 && circleHits(mask, px, py + o.radius, o.radius * .9); k++) { px += n.x * cell * .5; py += n.y * cell * .5; }
      if (circleHits(mask, px, py + o.radius, o.radius * .9)) {
        // Wedged in a narrow V (a steep wall and a slope): rest on the floor under the feet.
        const rest = falling ? groundBelow(mask, p.x, p.y + o.radius, o.radius + o.stepDown) : null;
        if (rest !== null) { p.y = rest; p.grounded = true; out.landed = true; p.vx = p.vy = 0; p.slide = 0; }
        break;
      }
      p.x = px; p.y = py;
    }
    if (p.x < -o.radius * 4 || p.x > mask.width + o.radius * 4) p.y = Math.min(p.y, o.water - 1);
  }
  if (p.y < o.water) { p.drowned = true; p.grounded = false; out.drowned = true; }
  return out;
}
