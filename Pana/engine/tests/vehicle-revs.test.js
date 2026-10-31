import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILES, stepRevs } from '../vehicle-revs.js';

const run = (profile, speed, throttle, seconds, state = { gear: 1, rpm: PROFILES[profile].idle }) => {
  for (let t = 0; t < seconds; t += 1 / 60) stepRevs(state, 1 / 60, { speed, throttle, topSpeed: 40, profile });
  return state;
};

test('a car at a standstill idles, and revs up in neutral when the throttle is pressed', () => {
  const idle = run('sport', 0, 0, 1);
  assert.ok(Math.abs(idle.rpm - PROFILES.sport.idle) < 5);
  assert.ok(run('sport', 0, 1, 1).rpm > PROFILES.sport.idle + 1500, 'revving while parked');
});

test('the revs climb with speed and drop at an upshift', () => {
  const state = { gear: 1, rpm: PROFILES.compact.idle };
  let peak = 0, dropped = false, last = 0;
  for (let speed = 0; speed <= 38; speed += .25) {
    stepRevs(state, 1 / 30, { speed, throttle: 1, topSpeed: 40, profile: 'compact' });
    if (state.rpm < last - 40) dropped = true;
    peak = Math.max(peak, state.rpm); last = state.rpm;
  }
  assert.ok(state.gear > 3, 'climbed through the gears');
  assert.ok(dropped, 'the revs fell at a shift');
  assert.ok(peak <= PROFILES.compact.red * 1.05 + 1, 'never past the redline');
});

test('lifting off at speed lets the revs fall slowly and the gearbox come back down', () => {
  const state = run('muscle', 38, 1, 2);
  const hot = state.rpm;
  run('muscle', 6, 0, 3, state);
  assert.ok(state.rpm < hot);
  assert.ok(state.gear <= 2);
});

test('every profile is a usable engine', () => {
  for (const [name, p] of Object.entries(PROFILES)) {
    assert.ok(p.cyl >= 2 && p.idle > 300 && p.red > p.idle * 2 && p.gears >= 2, name);
    const f = p.red / 60 * (p.cyl / 2) * p.pitch;
    assert.ok(f > 60 && f < 900, name + ' fires in an audible band');
  }
});
