# Music

Games play music through `engine/music.js` (`createMusic(sound)`). A name with a
recording in `engine/music-tracks.js` streams that mp3; any other name, or a
recording that fails to load, falls back to the live WebAudio synth styles
(`STYLES`). So a game never goes silent because a file is missing.

## Player

- `play(name, { fallback })`: start a song; `fallback` is the synth style used
  when there is no recording. `preload(name)` fetches and decodes ahead (Derrape
  calls it when the loading screen opens so the countdown starts on the beat).
- Recordings loop with `AudioBufferSourceNode.loopStart/loopEnd`: the intro
  plays once, then `[loop[0], loop[1]]` repeats. Up to 4 decoded songs stay cached
  (a decoded 2-minute song is ~40 MB of floats, so do not raise this lightly).
- `setTempo(t)` maps to playback rate `sqrt(t)`: the final-lap 1.14 becomes ~1.07
  (about +1 semitone). A straight 1.14 rate sounded chipmunk.
- `muffle(on)` sweeps a low-pass to 700 Hz (Derrape: player spinning out).
- `sting(name)` plays a one-shot (a song with `"loop": false`) over the music,
  ducking it to 25 % until the jingle ends.
- Music goes through `sound.musicOut()`, a gain under the master volume, driven
  by the `music` setting ("Música" slider in the shared menu). `sound.muted` is
  a plain flag games flip, so the player re-reads it every 50 ms tick.
- Level: songs are mastered to -20 LUFS and the slider defaults to 50 %. At
  -16 LUFS / 70 % the music buried the synthesized effects.

## Making songs (scripts/music)

Songs are generated locally with ACE-Step 1.5 (MIT licence, trained on
royalty-free material per its authors), cloned next to this repo at
`../ACE-Step-1.5` (`uv sync` there; it downloads models on first run, about
20 GB for the XL model + 1.7B LM).

1. Brief: add or edit an entry in `scripts/music/songs.json` (caption, bpm, key,
   time signature, duration, `out` path, `"loop": false` for jingles).
2. Generate takes: from `../ACE-Step-1.5`,
   `uv run python ../Pana/Pana/scripts/music/generate.py --only <id> --takes 2`.
   Takes land in `../ACE-Step-1.5/output/pana/<id>/take-N.wav`.
3. Pick a take in `scripts/music/picks.json` (`{ "<id>": 2 }`; default 1).
4. Cut the loop: `uv run python ../Pana/Pana/scripts/music/loop.py --only <id>`.
   It beat-tracks the take, picks the loop pair whose surrounding bars match
   best (chroma + MFCC), crossfades one beat, normalises to -20 LUFS, encodes
   128 kb/s mp3 and rewrites `engine/music-tracks.js`. Loop data is kept in
   `scripts/music/loops.json`.

Settings that mattered: `acestep-v15-xl-sft` at 50 steps with the 1.7B LM fits a
24 GB card; `use_cot_caption=False` keeps our caption instead of the LM's
rewrite; captions end with the shared `style` line ("instrumental video game
soundtrack, no vocals ... loopable groove").
