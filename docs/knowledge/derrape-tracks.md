# Derrape track system

Derrape supports multiple maps. Everything lives in `games/derrape/public/`:

- `tracks.js` — registry (`TRACKS`, `getTrack`, `makeTrack`). Turns a track
  definition into the runtime `T`: `pointAt/paramOf/offsetOf/groundAt`,
  `TOTAL`, `HW`, `LINE`, `ramps`, `animated`, and `T.build()` which returns
  the scenery group. Two geometry backends: `oval: {S, R}` (exact original
  math, used by `estadio`) and `points: [[x, z], ...]` (closed centripetal
  Catmull-Rom sampled into a lookup table).
- `track-kit.js` — shared prop builders (fence, chevrons with auto bend
  detection, tire walls, signs, bridges, water, palms, windmill, birds…).
  Anything with `obj.userData.tick(t, dt)` is collected at build time and
  animated during the race.
- `tracks/<id>.js` — one file per map: geometry, palette, ramps, item
  positions (fractions `u` of the lap, never absolute), and a
  `scenery(group, kit, T)` function.

## Gotchas

- **Positive `off` is the `(-tz, tx)` side** of the direction of travel —
  `placeOnTrack`, `scatter`, items and walls all share this convention.
- Cars are hard-confined to `|off| < HW - 1.6`; keep scenery at
  `|off| >= HW + 3`. Straddling props (gates, arches): pillars at
  `|off| >= 10`, lintel clearance `y >= 5.5`.
- A straddling prop built along local X needs `rotation.y = p.h` (NOT
  `p.h + PI/2`) — `p.h = atan2(tx, tz)` already maps local X perpendicular
  to travel.
- Wall collision works on any curve: the normal is the numeric gradient of
  `offsetOf`. On the oval this is identical to the old capsule math.
- Items are rebuilt per track into `race.trackGroup`, so switching tracks in
  the garage disposes pads/boxes with the group. Only geometries are
  disposed; materials come from shared caches (never dispose those).
- Track choice persists in `localStorage['derrape:track']`; `?track=<id>`
  overrides. New maps also need their import added to `tracks.js`.
- Keep loops gentle: min radius of curvature > 15, lap length 350-450, no
  self-intersections. Verify with a numeric spline check before shipping
  (control-point drafts often hide tight corners between points).
