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
