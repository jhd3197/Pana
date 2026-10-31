// The pure half of the vehicle motor: engine profiles and the gearbox/rev model.
// No audio and no Three, so it is unit-tested in Node (see vehicle-audio.js).
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// cyl: cylinders (a 4-stroke fires cyl/2 times a revolution); idle/red: rpm range;
// gears; body: low sine weight; rasp: upper-harmonic buzz; intake: air noise;
// rumble: exhaust rumble; grit: waveshaper drive; lope: idle wobble; pops: overrun crackle;
// turbo: whine and blow-off; pitch: overall tuning of the firing note.
export const PROFILES = {
  compact: { cyl: 4, idle: 950,  red: 7000, gears: 5, body: .45, rasp: .5,  intake: .5,  rumble: .3,  grit: 2.2, lope: .2, pops: 0,   turbo: 0, pitch: 1 },
  sport:   { cyl: 4, idle: 1000, red: 8200, gears: 6, body: .35, rasp: .75, intake: .7,  rumble: .25, grit: 2.8, lope: .1, pops: .6,  turbo: 1, pitch: 1 },
  muscle:  { cyl: 8, idle: 750,  red: 5600, gears: 4, body: .9,  rasp: .45, intake: .45, rumble: .8,  grit: 3.2, lope: 1,  pops: .9,  turbo: 0, pitch: .92 },
  truck:   { cyl: 6, idle: 700,  red: 4600, gears: 5, body: .85, rasp: .3,  intake: .4,  rumble: .85, grit: 2.4, lope: .8, pops: 0,   turbo: 1, pitch: .9 },
  beetle:  { cyl: 4, idle: 850,  red: 5600, gears: 4, body: .3,  rasp: .85, intake: .35, rumble: .15, grit: 1.8, lope: .5, pops: .3,  turbo: 0, pitch: 1.12 },
  bus:     { cyl: 6, idle: 600,  red: 3800, gears: 5, body: 1,   rasp: .25, intake: .35, rumble: 1,   grit: 2,   lope: 1,  pops: 0,   turbo: 1, pitch: .85 },
  boat:    { cyl: 2, idle: 1300, red: 6200, gears: 2, body: .3,  rasp: .9,  intake: .8,  rumble: .2,  grit: 2.6, lope: .3, pops: 0,   turbo: 0, pitch: 1.2 },
};

// The gearbox and rev model, pure so it can be tested without any audio.
// state: { gear, rpm, cut }. Returns the same object after dt.
export function stepRevs(state, dt, { speed, throttle, topSpeed, profile }) {
  const P = typeof profile === 'string' ? PROFILES[profile] || PROFILES.compact : profile;
  const sp = Math.abs(speed), top = Math.max(1, topSpeed);
  state.cut = Math.max(0, (state.cut || 0) - dt);
  let u = sp / (top * state.gear / P.gears);
  if (u > .93 && state.gear < P.gears && state.cut <= 0) { state.gear++; state.cut = .14; state.shifted = 1; u = sp / (top * state.gear / P.gears); }
  else if (u < .4 && state.gear > 1) { state.gear--; u = sp / (top * state.gear / P.gears); }
  const thr = state.cut > 0 ? 0 : throttle;
  const standing = sp < 2.5 ? thr * .55 : 0;
  const target = P.idle + (P.red - P.idle) * clamp(Math.max(u, standing), 0, 1.04);
  state.rpm += (target - state.rpm) * (1 - Math.exp(-dt * (target > state.rpm ? 12 : 5)));
  state.rpmN = clamp((state.rpm - P.idle) / (P.red - P.idle), 0, 1.05);
  state.load = thr * (.4 + .6 * (1 - .3 * state.rpmN));
  return state;
}
