# ¿Quién quiere ser mi pana?

A TV trivia show for up to six panas (bots fill the podiums). Everyone answers
every question at once; answers stay secret until the host reveals them by
name; each pana climbs their own ladder of mangos; a secret bet on the final
question decides the Mango de oro. The hub card shows `tileName` ("QQSMP") from
`game.json`; the banner keeps the full `name`.

Built on the shared table room (`engine/table-room.js`) and the plaza stage
(`engine/worlds/table-world.js`) lit for night, with a TV set on top.

## Files

- `public/rules.js`: pure rules (`QuizGame`), tested by `tests/rules.test.js`.
- `public/questions.js`: the question bank, one list per category. The first
  answer is the right one; `ask()` shuffles the four. New questions only go here.
  `playable()` in `rules.js` is the gate: a prompt plus exactly four distinct,
  non-empty answers. `buildDeck` skips anything else, so a bank served from
  elsewhere can never put three, five or an ordering list on the board.
  `PACKS` groups the categories for the Tema option: Venezuela (eight
  categories), Cultura general (six) and De todo (all of them).
- `public/network.js`: the room. `step(dt)` is the host's clock (`game.tick`).
- `public/options.js`: Tema, number of questions, seconds per question, bot level.
- `public/studio-set.js`: stage, podium, host desk, big screen and spotlight
  factories, registered in Pana Studio (`web/studio/catalog/qqsmp.js`).
- `public/scene.js`: the studio, the screen and plate painting, the panas.
- `public/game.js`: wiring and the HUD.
- `tests/browser.mjs`: two real clients (`npm run test:browser -- qqsmp`).

## Rules decisions

- **Jugar con** offers **Panas y bots** (default) and **Solo panas**. The latter
  keeps stable seat indices but excludes empty seats from voting, betting,
  scoring, titles, copying and the stage. `participants(state)` is the shared
  filter; never compact the seat array because copy targets are seat IDs.
  Departures leave empty seats; newcomers start with fresh scores.
- Answers can be changed or cancelled while time remains and someone has not
  answered. The final submission (including a copy or a bot) immediately
  settles and shows the result; no more edits are accepted. Repeating the
  same choice is a no-op.
  Cancelling clears the pick and timestamp, but never refunds a used comodín.
- `snapshot()` hides `answer`, `copy` and (during the final) `bet` while the
  question or the pause is open. Each client remembers its own pick locally
  (`picked` in `game.js`) to highlight it. A host handoff mid-question
  unlocks everyone and leaves about 6 s to answer again, since the hidden
  answers were never published.
- Actions carry the question number (`q`) instead of the revision: the clock
  bumps the revision every second, and an exact-revision check would refuse
  answers sent a tick late. The seq ledger still stops repeats.
- A wrong answer drops to the last safe step (4 or 8). With Doble o nada a
  wrong answer drops one safe step further (8 → 4 → 0), so the comodín is a
  real risk. A right Doble o nada climbs two steps.
- Copiarse follows chains (a copy of a copy). A loop or an empty lock counts
  as no answer. The reveal calls names in dependency order, so you always see
  the copied pana's letter before the copier's.
- Speed bonus: up to 100 mangos per right answer (×2 with Doble), scaled by
  the time left at your latest changed answer.
  Points = ladder value + bonus + final delta.
- Reaching step 12 wins the Mango de oro immediately (`gold`); that pana ranks
  first whatever the final does, and the rest play the final for second.
- Planted panas keep answering for the call-outs, but their step is frozen and
  they bet 0 on the final.

## Notes for agents

- In the headless browser suites the game view renders at 2–4 fps (software
  WebGL, plaza included; Dominó is the same). Playwright's stability check
  then never passes on HUD buttons: the suite clicks them with
  `locator.evaluate(el => el.click())`, and uses the 20 s timer so slow
  steps don't miss the question.
- `#hud` holds only fixed-position children, so its own rect is 0 px tall.
  The camera measures `.quiz-panel` to keep the podiums above it.

- The QQSMP lobby roster reserves 20px of horizontal padding for its 6-degree
  card skew, shadow and focus outline. The previous 8px left a horizontal
  scrollbar even at wide desktop sizes. Roster, settings and dialog widths
  include their padding; long start labels and room codes wrap on mobile.

## Spanish narration and rematches

- Every prompt, answer and option label has a Kokoro `em_alex` Spanish recording generated into `public/audio/`.
  `voice-key.js` hashes the prompt's UTF-8 text; changing a question requires
  regenerating its recording. The manifest records text and measured duration.
- Generate with `python Pana/scripts/qqsmp-narrate.py` from the repository root.
  Requires ffmpeg/ffprobe and a Kokoro API: `KOKORO_URL`, default
  `http://127.0.0.1:8880/v1`.
  Recordings use silence trimming and -16 LUFS gain normalization.
  The MP3s are ignored by Git. Run `python Pana/scripts/qqsmp-pack.py` to build
  a deterministic ZIP in ignored `dist/voice-packs/` and update `audio/pack.json`.
  Upload the ZIP to the `voice-packs` GitHub release before pushing the metadata:
  `gh release upload voice-packs dist/voice-packs/<filename>.zip`.
  Keep older ZIPs available for older deployed versions. Do not replace a ZIP
  in place: its filename includes the content hash. Git tracks only the text
  manifest, pinned URL, SHA-256 and byte count, never recordings or ZIPs.
  Players download only the current question and its choice clips;
  they do not contact Kokoro.
- `server/audio-pack.js` downloads and verifies the pinned ZIP on the first
  question-audio request, then serves it through the existing QQSMP audio URL.
  Extraction accepts only the manifest's flat MP3 names and publishes a complete
  cache directory atomically. Concurrent requests share one download. Cache:
  `PANA_VOICE_CACHE`, otherwise `DATA_ROOT/pana-voice-packs`, otherwise the system
  temp directory. The source checkout can remain read-only.
  Other routes never wait on the download; a
  failure returns 503 for audio only and a later request retries.
- `narration.js` queues the question followed by each letter and answer in
  displayed order. Shared label clips avoid recording every permutation.
  Once the result settles, it announces «La respuesta correcta es», the letter
  and the correct answer. Results last at least eight seconds to fit every
  recorded announcement; tests check the measured durations.
  Escuchar pregunta replays it and provides a gesture if autoplay is blocked.
  Shared sound/volume settings apply; phase changes and teardown stop playback.
  A solo pause stops narration; returning rereads the question. The room clock
  never depends on a client's audio loading, playback, or mute setting.
  A clip that 404s or fails to decode skips to the next line (`onerror`);
  before that, one missing clip silenced the rest of the question.
- Default time is 30 seconds; 45 seconds is available alongside the old presets.
- `questionUses` counts dealt questions in room state, survives rematches and
  host handoff, and follows theme changes. Categories rotate among least-used
  questions so a pack is exhausted before repetition. A new room starts fresh.
  A deck never contains the same question twice, even at a bank-cycle boundary.

## Game-show effects

- `animation-catalog.js`, `animation-events.js`, `animations.js` and
  `animation-choreography.js` adapt the supplied quiz workbench: 23 core takes
  and 14 special scenes, using the real player wardrobe and existing stage.
  Variants rotate by round, question and stable seat; no private answer is read.
  Thinking/locking happens while voting; settlement immediately replaces it
  with each active player's reaction within the existing result window.
  Correct/wrong scenes skip their demo suspense lead-in once results are public.
- The 50:50 animation follows its actual use. Copy jokes follow public results;
  the phone and audience scenes are visual jokes, not additional lifelines or
  real audience votes. Winning cycles through the mango, rain, hug, dance and
  faint scenes. Empty seats never join choreography, including mango rain.
- The choreography owns pooled particles and temporary props, never screen
  answers, podium scores or game clocks. Restore poses, podium positions and
  cloned tint materials before the next frame; use the avatar adapter's outer
  scale of 1 (the sculpt already applies 0.6 internally). Props and textures
  dispose with the scene. Reduced motion disables the new choreography, and
  solo pause freezes its clock. The shared sound controller handles accents,
  including narration ducking, mute, visibility and teardown.

- `public/sounds.js` contains original short scores synthesized with bass drums,
  filtered brass, snare rolls and bells. No recordings or external music assets.
  It uses the shared `sound` context, master output and voice admission.
- Snapshot keys trigger each question, countdown beat, reveal and victory once.
  Correct/wrong stings depend on the local outcome only after settlement.
  The last-vote reveal stays immediate: effects never delay game rules.
- Narration signals active playback to duck the effects bus. Mute, zero volume,
  hidden tabs, solo pause and teardown stop scheduled sources; resuming never
  replays old cues. All source nodes disconnect when they end.
