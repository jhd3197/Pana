# Derrape driving and drift assistance

The default drift is assisted for every driver and uses the same local physics
online, with keyboard, touch and controllers. Hold the drift button and steer
into a bend; countersteering opens the line, and releasing pays the earned turbo.
The speedometer says `Suelta: turbo` as soon as any charged tier is available;
the touch button says `¡Suelta!`, including landscape layouts with no speedometer.
Players do not need to wait for purple sparks or configure another setting.
Keep the landscape inventory above the pedals and the coin counter clear of
the minimap; the browser proof checks phone widths from 568 to 844 pixels.

## Why the old drift was difficult

The old rule forced 0.45–1.3 steering into the bend, multiplied by another 1.18.
Even full countersteering kept turning inward. A 4.2 m/s hop delayed the start,
then a 300 ms landing window could expire before the driver started steering.
The old browser fixture pinned the car at one point to measure charging; it
could not expose wall collisions. Never use that fixture as driving proof.

## Current control rules

- `drive-rules.js` maps drift input to a gentle 0.15 neutral bias, 0.85 into the
  bend and -0.55 when countersteering (mirrored for the other direction).
- The entry hop is 2.8 m/s. Holding the button and turning after landing starts
  the drift whenever forward speed exceeds 12 m/s; no short landing window.
- `assistDrift` blends toward a useful road heading if the projected path nears
  an edge, or continued steering would rotate the nose past that heading. It
  changes steering, never position. The prediction uses 0.55 seconds of travel
  and 0.3 seconds of anticipated turn; the aim looks 12 + speed × 0.45 m ahead.
- Steering also shifts the requested line by 22% of road half-width, bounded
  within 42% of half-width. This matters: edge correction alone can otherwise
  cancel countersteering and make different player inputs follow the same line.
- Geometry assistance only applies on the main road, facing forward, during
  a grounded drift or its brief exit. It does not steer a jumping, wrong-way,
  off-road or shortcut car, and battle mode has no road guide.
- Sideways grip during a drift is 0.62 of the composed car/tire grip. Release
  has 0.45 seconds of faster steering settling and 1.8× lateral damping, so
  boost does not retain the previous tight steering input. Wet and wooden tire
  differences remain multiplicative; this is not invulnerability or equal grip.
- Charge comes from real turning or a matching road bend ahead. Corrective
  steering during a valid bend still earns charge. A button held on a straight
  is not by itself a charge source. Existing spark thresholds, boost durations,
  car talents and tire multipliers are unchanged.

No pose fields or extra network messages are added. Remote clients continue
to display the owner's position and existing drift/spark flags.

## Start line

Holding the gas before "¡YA!" always gets the car going; `startBoost`
(drive-rules.js) only grades when it went down. Late in "1" (≤1.6) gives the
full turbo, earlier in "1" (≤2) a small one, and from "2" a plain start. From
"3" (>2.85) the engine floods for 0.6 s at `STALL_THROTTLE` (35 %) power. It
used to give zero throttle for 0.9 s, so pre-accelerating felt like the gas
had not registered and players let go and pressed again. While the gas is held
during the countdown, the number shows how the start will go: coral is
flooded, white is plain, teal is a turbo.

## Proof

`drift-assist.browser.js` drives complete corner entries and exits without
pinning positions: all eight cars, all five tires, both directions, broad/tight
Estadio bends and wet Selva bends. It checks countersteering changes the line,
late entry, air/wrong-way eligibility, release boosts, physical keyboard input,
touch holds and the visible desktop/phone hint. `drive.browser.js` and the
car-skill comparison in `feedback.browser.js` also use real moving bends now.

Ignored baseline data lives in `art/derrape-drift/before.json`: all 36 original
fixed-input trials hit a wall (three cars, three tires, four bends). This is a
repeatable novice-input regression, not a claim about every human driving style.
Final metrics, screenshots and check logs live beside it. Keep human playtesting
as the next test of feel, especially correction strength and corner exit timing.

The refined 240-run regression records zero wall contacts and a boost in every
run. Its maximum sampled offset is 2.95 m in Estadio (wall at 6.4 m) and 2.99 m
in Selva (nominal road limit 7.4 m). Countersteering changes the sampled exit by
1.68 m and 3.16 m respectively. These are fixed 1.5-second holds plus a half-second
exit, not automated full-lap steering or human success-rate estimates.
