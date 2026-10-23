# Sound effects (engine/fx.js)

Field notes for the shared SFX bus (`sound` in `Pana/engine/fx.js`). Songs
live in `music.md`.

## Voice budget

One-shot effects share a budget of `sound.maxVoices` (12) concurrent voices.
Every one-shot helper (`tone`, `sweep`, `bonk`, `boing`, `skid`, `explode`,
`thunder`, and the composed jingles built on them) admits through the same
ledger, right after the `!ctx || muted` guard:

- Under the cap, everything plays as before.
- At the cap, a new voice plays only if its priority strictly beats the
  lowest-priority live voice, which is faded out early (~15 ms). Otherwise
  the new voice never starts.
- Priority is a trailing optional argument (default 1); composed sounds
  thread one priority into their inner tones so a jingle counts its voices
  individually but shares one importance.

Ledger entries expire lazily on the next admission from their scheduled end
time — no timers, no `onended` bookkeeping beyond that. Voices scheduled
into the future (jingle tails) count only once they sound.

Why: busy moments (an eight-player pile-up, a finish-line horn fest) used to
stack unlimited oscillators into mush. Important cues — a bell, a knockout —
must survive; ambient ticks must yield.

Observability: `sound.voices` (live ledger), `sound.liveVoices()` (swept
count), `sound.dropped` (voices refused or bumped). The fx browser suite
(`engine/tests/fx.browser.js`) hammers 40 low-priority ticks and asserts the
cap holds while a priority voice still plays.

Music (`musicOut()`) and the engine loop never touch the budget.

## Notes for agents

Give fight-defining cues (bells, knockdowns, wins) priority 2+; leave ambient
chatter at the default. Don't raise `maxVoices` to fix a mix problem — fix
priorities instead.
