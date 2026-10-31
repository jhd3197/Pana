# Shared sound effects and vehicle audio

One synthesised sound library for every game, on the same WebAudio context and
voice budget as `Pana/engine/fx.js` (`sound`). No audio files. A game asks for a
sound by what it is, never by how it is built.

## Modules

| Module | What it is |
|---|---|
| `engine/sfx.js` | `sfx.step(surface, {sprint, foot, volume})`, `jump`, `land`, `shot(kind)`, `impact(surface)`, `splat`, `hitConfirm`, `hurt`, `reload(kind, seconds)`, `reloaded`, `dry`, `swap`, `swish`, `tick`, `confirm`, `back`, `count(n)`, `go`. Also exports the two primitives `burst` (filtered noise that glides and decays) and `pitch` (a falling or rising thump) for building a new sound. |
| `engine/vehicle-audio.js` | `createMotor(sound, {profile, topSpeed})`, `createTyres(sound)`, `vehicleSfx.skid / boost / crash(power, kind)`. |
| `engine/vehicle-revs.js` | The pure half: `PROFILES` and `stepRevs` (gearbox, shift cut, rev slew). Unit-tested in Node. |

Surfaces for `step`: `concrete stone tile wood metal dirt grass sand water`.
Shots: `pistol scatter rapid rocket pellet zap`. Reloads follow the weapon:
`hopper` (pistol, rapid), `pump` (scatter), `tube` (rocket), `magazine`.
Crash kinds: `wall car bump prop`.

## The motor

`createMotor` runs a sawtooth through a soft clipper and a load-driven low-pass
(the note), a square an octave up (rasp), a sub sine (body), intake and exhaust
noise, a turbo whine and a slow pitch LFO (the uneven idle). The firing note is
`rpm / 60 * cylinders / 2`. `stepRevs` turns speed into revs through the
gearbox: the revs climb in a gear, fall at an upshift (with a short throttle
cut and a click), fall slowly when you lift, and rev in neutral when parked
with the throttle down. Lifting at high revs crackles on profiles with `pops`,
and a boost that ends blows off on profiles with `turbo`.

```js
const motor = createMotor(sound, { profile: 'muscle', topSpeed: 42 });
motor.update(dt, { speed, boost: car.boost > 0 });   // throttle is guessed from the acceleration if omitted
```

Profiles: `compact sport muscle truck beetle bus boat`. Add one by adding a row
to `PROFILES` in `vehicle-revs.js` (the test checks it fires in an audible band).

## Rules

- Use `admit` priorities as the library does: footsteps 0, impacts and reload 1, shots 2, hit/hurt/countdown 3.
- Keep per-game code to the mapping: Carreritas maps a car id to a profile in `drift-audio.js`; Pepazo maps a weapon to a shot kind in `sounds.js`.
- Check a change without a speaker: render with an `OfflineAudioContext`, then look at peak, RMS and the dominant frequency. All sounds peak under 0.35 at a master volume of 0.5.

## Used by

Carreritas (motor, tyres, boost, crash, drift skid), Pepazo (everything on foot and every gun).
