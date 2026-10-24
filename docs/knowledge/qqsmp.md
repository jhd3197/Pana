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

- Answers lock once; there is no changing your mind.
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
  the time left when you locked. Points = ladder value + bonus + final delta.
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

## Spanish narration and rematches

- Every prompt has a Kokoro `em_alex` Spanish recording generated into `public/audio/`.
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
  Players download only the current prompt; they do not contact Kokoro.
- `server/audio-pack.js` downloads and verifies the pinned ZIP on the first
  question-audio request, then serves it through the existing QQSMP audio URL.
  Extraction accepts only the manifest's flat MP3 names and publishes a complete
  cache directory atomically. Concurrent requests share one download. Cache:
  `PANA_VOICE_CACHE`, otherwise `DATA_ROOT/pana-voice-packs`, otherwise the system
  temp directory. The source checkout can remain read-only.
  Other routes never wait on the download; a
  failure returns 503 for audio only and a later request retries.
- `narration.js` reads the question (not the answer choices), once per question.
  Escuchar pregunta replays it and provides a gesture if autoplay is blocked.
  Shared sound/volume settings apply; phase changes and teardown stop playback.
  A solo pause stops narration; returning rereads the question. The room clock
  never depends on a client's audio loading, playback, or mute setting.
- Default time is 30 seconds; 45 seconds is available alongside the old presets.
- `questionUses` counts dealt questions in room state, survives rematches and
  host handoff, and follows theme changes. Categories rotate among least-used
  questions so a pack is exhausted before repetition. A new room starts fresh.
  A deck never contains the same question twice, even at a bank-cycle boundary.
