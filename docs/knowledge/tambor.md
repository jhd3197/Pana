# La Rueda de Tambor

A tambor party for up to eight panas (bots fill the drums and the crowd).
Each song is one rueda: four drummers keep the beat, two dancers follow the
MCP's calls in the middle, la gente claps and waits in line. Three missed
calls (room option: 2, 3 or 5) and the MCP throws you out: "¡Sal de la
rueda!", and the next pana in line jumps in. Roles rotate every song. The hub
card shows `tileName` ("TAMBOR").

Modes (room option `mode`): **La Rueda** (the main game), **Relevo** (one
dancer; a pana in the crowd may jump in only on the "¡Golpe!" that opens each
two bars, and off the beat they are the one thrown out; most time in the
center wins), **Toque libre** (everyone drums, nobody is thrown out, a team
score) and **¡Golpe!** (the MCP plays a pattern, everyone repeats it, misses
are out until one pana is left).

Built on the shared live room (`engine/live-room.js`) with its own beach stage
(sky, sea and lights in `public/place.js`), not the plaza: a rueda is a beach
or malecón thing.

## Files

- `public/songs.js`: the three songs (96, 112, 128 bpm) and every station's
  chart, built from bar patterns; the ¡Golpe! patterns. Pure.
- `public/rules.js`: the host's game (`Rueda`): roles, the MCP's calls, Sabor,
  Bulla, kick-outs, bots, titles. Pure, tested by `tests/rules.test.js`.
- `public/judge.js`: the local judge each client runs against its own music.
  Pure, tested in the same file.
- `public/beat.js`: the WebAudio tambor (culo e' puya, the long drum's sticks,
  charrasca, caracol, maracas, the pujao groove) scheduled on the song clock,
  and the MCP's voice through `speechSynthesis` when the browser has one.
- `public/network.js`: the room; `clock()` is the server clock.
- `public/rueda-set.js`: the drums, charrasca, maracas, caracol, pañuelo,
  violín cloud, pink shack, string lights, mural, shell ring and name tags,
  registered in Pana Studio (`web/studio/catalog/tambor.js`).
- `public/place.js`: the two places. `public/scene.js`: the rueda, the panas
  and their animation. `public/hud.js`, `public/lane.js` (the drum lane, a
  Canvas 2D overlay), `public/calibrate.js` (the "toca cuando suene el golpe"
  screen). `public/game.js`: wiring.
- `tests/browser.mjs`: two real clients (`npm run test:browser -- tambor`).

## Timing: everyone plays against their own music

- The host sets `song.startAt` in server milliseconds (`link.now()`), about a
  count-in plus 0.8 s ahead. Every client computes its song time from the same
  clock, schedules its own audio against it (re-anchoring the AudioContext
  when the estimate drifts more than 45 ms) and judges its own presses, minus
  its calibrated latency.
- Inputs carry running counters for the current song (`drum`, `clap`) plus the
  last eight call results. The host takes the growth since the last value it
  saw, so a dropped or repeated input never double-counts. Counters reset per
  song (`song` must match `state.song.n`).
- A human's call with no result 2 s after its window counts as a miss on the
  host, so a frozen tab can't stall the rueda. Bots roll on the host with
  `draw(this)`, so a new host continues the same stream.
- A paused solo game slides `song.startAt` forward by the pause.
- The station you play is left out of your music: you hear it when you hit.

## Tuning

- Sabor is an EMA over every drum note: perfect pulls toward 1, good 0.8,
  miss 0, a stray hit 0.35, at 0.04 per note. Calls: window
  `0.11 + 0.07·Sabor + 0.06·Bulla` seconds; pace 4-beat lead every 8 beats at
  Sabor ≥ 0.7, 3 every 6 at ≥ 0.45, else 2 every 4 with half the calls on the
  offbeat. Low Sabor also makes the other stations wobble (up to ±50 ms) and
  drop notes in everyone's music.
- Bulla: +0.05 per on-beat clap (±120 ms), −0.02 off-beat, decays 0.06/s.
- Every third phrase (8 bars) is a duelo: the two dancers get different moves.
- Rotation: dancers are whoever danced least (people first); drums go to
  whoever drummed least, and a pana who just drummed waits in the crowd next
  while bots take the extra drums. A solo pana dances, drums, then waits.
- A dancer who reaches 48 beats in one turn gets the violín cloud until the
  next song starts.

## Notes for agents

- In headless suites the scene runs at 2–4 fps. Panas walk on real elapsed
  time (`performance.now()` in `scene.frame`), not the clamped frame `dt`, or
  they lag far behind their spots. The suite drives the judge directly
  (`judge.press(key, exactTime)`) instead of real key timing.
- `place.js` disposes owners collected before disposing: `disposeModel`
  removes a group from its parent, which breaks a live `traverse`.
