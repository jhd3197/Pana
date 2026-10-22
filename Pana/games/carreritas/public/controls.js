// Input and race-reading rules shared by the keyboard, game controllers and
// split screen, plus the wrong-way and lap-split checks. Plain functions only;
// tests/controls.test.js checks them.

import { inputAxis, DEFAULTS } from '../../../engine/settings.js';
const held = (b) => !!b && (b.pressed || b.value > 0.4);
const amount = (b) => b ? Math.max(b.value || 0, b.pressed ? 1 : 0) : 0;

// A "standard" Gamepad (Xbox / PlayStation layout) into Carreritas's controls.
// RT / A gas, LT / B brake, stick or d-pad steer, RB drift, LB / X items,
// Y rescue, Select look back, Start pause, d-pad up swaps the item.
export function padInput(pad, settings=DEFAULTS) {
  if (!pad) return null;
  const b = pad.buttons || [], stick = inputAxis(pad.axes?.[0] || 0,settings);
  const dpad = (held(b[14]) ? 1 : 0) - (held(b[15]) ? 1 : 0);
  return {
    throttle: Math.max(amount(b[7]), held(b[0]) ? 1 : 0) - Math.max(amount(b[6]), held(b[1]) ? 1 : 0),
    steer: Math.max(-1, Math.min(1, dpad || -stick)) + 0,   // + 0 turns -0 into 0
    drift: held(b[5]),
    item: held(b[4]),
    itemBack: held(b[2]),
    rescue: held(b[3]),
    look: held(b[8]) || held(b[10]),
    pause: held(b[9]),
    swap: held(b[12]),
  };
}

// Rising edges: which buttons went down since the last poll.
export function pressed(now, before) {
  const out = {};
  for (const k of ['item', 'itemBack', 'rescue', 'pause', 'swap']) out[k] = !!now?.[k] && !before?.[k];
  return out;
}

// Keys per driver in split screen; alone, either set drives.
export const SPLIT_KEYS = {
  1: { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'], drift: ['ShiftLeft'], item: ['KeyE', 'Space'], back: ['KeyX'], swap: ['KeyQ'], rescue: ['KeyR'], look: ['KeyC'] },
  2: { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'], drift: ['ShiftRight', 'Slash'], item: ['Enter', 'Period'], back: ['Comma'], swap: ['KeyM'], rescue: ['Backspace'], look: ['Quote'] },
};
export function keyInput(codes, map) {
  const any = (list) => list.some(c => codes[c]);
  return {
    throttle: (any(map.up) ? 1 : 0) - (any(map.down) ? 1 : 0),
    steer: (any(map.left) ? 1 : 0) - (any(map.right) ? 1 : 0),
    drift: any(map.drift), look: any(map.look),
  };
}

// Driving the wrong way: heading against the road while moving.
export const wrongWayStep = (t, heading, roadHeading, speed, dt) =>
  Math.cos(heading - roadHeading) < -0.3 && Math.abs(speed) > 4 ? t + dt : Math.max(0, t - dt * 2);
export const WRONG_WAY_TIME = 1;

// Lap splits: the time of the lap just finished and whether it is the best.
export function lapSplit(splits, clock) {
  const start = splits.reduce((a, b) => a + b, 0);
  const lap = clock - start;
  const best = splits.length === 0 || lap < Math.min(...splits);
  splits.push(lap);
  return { lap, best };
}
