# ¡Stop!

The Venezuelan notebook word game ("Stop" / "Basta") for up to eight panas,
bots in the empty chairs. A round: the turn pana stops the letter wheel with
¡Para!, everyone fills a secret notebook page (one word per category with
that letter), the first full sheet yells ¡STOP! and the rest get 3 s
("¡Basta! 3… 2… 1…"), then the table reviews one category at a time and votes
on the answers the game doesn't know ("¿Eso cuenta?"). Five rounds by
default; the highest total wins. The hub card shows `tileName` ("STOP").

Built on the shared table room (`engine/table-room.js`) and the plaza stage
(`engine/worlds/table-world.js`), with a round table, plastic chairs and the reel's
purple slang wall. Source: the C4B9Vk6L9kK reel (Hormiga as a color, Oreo for
200 points, Nemo as an animal, "monte y culebra").

## Files

- `public/rules.js`: pure rules (`StopGame`, `judge()`, scoring, bots,
  titles), tested by `tests/rules.test.js`.
- `public/options.js`: Partida (Normal / Stop rápido: 3 categories, 30 s),
  Categorías (Clásicas / Criollas / Mezcla / Al azar), and in Más ajustes:
  rounds, how many categories (6–10), writing time, hard letters, Más
  criollo, bot level.
- `public/network.js`: the room. `step(dt)` is the host's clock (`game.tick`).
- `public/sheet.js`: your notebook page (inputs, Enter to the next box, the
  ¡STOP! button). `public/review.js`: the review cards and thumbs.
  `public/hud.js`: board, wheel panel, tally, shouts. `public/seats.js`:
  chair colours and bot looks. `public/game.js`: wiring.
- `public/studio-set.js`: table, letter wheel, notebook, pencil, plastic
  chair and slang wall, registered in Pana Studio (`web/studio/catalog/stop.js`).
  Canvas-painted faces live there because `scene.js` may not use a 2D canvas.
- `public/scene.js`: the table, the panas' moods (write, panic, slam, plead,
  laugh, cross, win, sad), pencils that follow the right hand, the wheel.
- `tests/browser.mjs`: two real clients (`npm run test:browser -- stop`).
- Shared: `engine/play/saber.js` (El Saber, data) and `engine/play/saber-match.js`
  (lookup), tested by `engine/tests/saber.test.js`.

## Secret sheets

- Sheets never travel before the review. Each client keeps its own page in
  `sheet.js`; during writing it sends only `progress` (how many boxes are
  filled). `snapshot()` nulls every `sheet` in spin, letter, write, basta and
  collect, so even the host's own state has no guest words until pencils-down.
- ¡STOP! carries the stopper's full sheet (the host refuses a sheet with an
  empty box). At pencils-down (`collect`) every client sends `sheet`; game.js
  resends every 0.9 s until the snapshot says `submitted`. After 6 s the host
  fills the missing ones with blanks.
- A host handoff in a secret phase sets everyone back to `submitted: false`
  (the hidden sheets were never published) and bots plan again, keeping the
  boxes they had filled. Panas resend at pencils-down; nothing is lost.
- Answers are cleaned on the host: strings only, no control characters or
  angle brackets, single spaces, at most 32 characters (`cleanAnswer`).

## Judging and scoring

- `judge()` order: empty → red; first letter ≠ round letter → red ("¡Iron
  Man se escribe con I!"); crude (a word in `CRUDE_WORDS` or a crude entry)
  without Más criollo → red ("Eso no se dice en esta mesa"); a word this
  table accepted earlier → green; a doubtful or crude entry → yellow; a match
  whose spelling starts with another letter → yellow ("Varinas" in the V
  round is "¿Barinas?"); a known word → green; unknown → yellow.
- Ñ is its own letter (Ñame is not an N word). Accents never matter.
- Yellow answers are grouped by sound, so the table votes once per word and
  every author of it is barred from that vote. 10 s; the vote closes early
  when every eligible voter voted. yes ≥ no accepts (a tie favors the
  author); yes ≥ 2/3 of the votes cast adds +50 Creatividad.
- 100 for a valid answer nobody else wrote, 50 when someone shares it (same
  sound key, so Kabra and Cabra are "the same"), 0 otherwise.
- Accepted words join `state.dictionary` (this room, this session, kept
  across "Otra partida") and are green from then on in that category.
- Oreo (`joke: 'oreo'`): the host line says "200 puntos" for 1.4 s, then a
  "¡Ni lo sueñes!" stamp; it counts like any doubtful word.

## Bots

- Level sets fill rate and finishing time: Tranquilos 55 % (finish at
  85–125 % of the time, so they rarely stop), Normales 80 % (50–90 %), Cuarto
  bate 95 % (28–55 %). A bot with every box filled before the limit yells
  ¡STOP!. A STOP freezes the other bots' sheets where they are.
- Seat 2 is El estricto (always votes no), seat 5 El pana creativo (35 %
  chance per box of a doubtful joke word like Nemo or Hormiga; always votes
  yes). Others vote yes with 50 % (doubtful), 60 % (close spelling) or 35 %
  (unknown). Bots never write crude words.
- The spinner rotates through every seat; a bot stops the wheel after
  1.2–2.6 s, a pana who doesn't press is helped after 9 s.

## El Saber (engine/play/saber.js)

- 1,600+ entries over 17 categories: names and surnames (Venezuelan style),
  countries, Venezuelan and world cities, animals (chigüire, cachicamo,
  cunaguaro…), fruits (lechosa, parchita, mamón…), colors (plomo,
  vinotinto…), things (budare, chinchorro, coroto…), the 23 states plus
  Distrito Capital with capitals, comida criolla, slang with explanations,
  dichos (IDEAS.md §7 included), peloteros (by surname or full name),
  singers and songs, places, brands, kid-friendly cariñoso insults.
- One compact line per entry: `Word/Variant #crude #duda @REEL = explanation`.
  A `?` prefix marks a doubtful entry (the game knows it but the table votes).
- `findEntry()` tries exact, then same sound (`soundKey`: b/v, s/z/c, ll/y,
  silent h, qu/k, doubled letters, spaces), then up to 1 typo (4–7 sound
  letters) or 2 (8+), then the first three words of a long dicho. Words of
  3 sound letters or fewer need the exact sound (Oso is not Osa).
- `wordsFor(category, letter)` gives bots clean, non-doubtful words and the
  spelling that starts with the letter.

## Not built yet

- A server-side global dictionary: today accepted words live only in the
  room's state. The spec's idea is that a word accepted at several different
  tables becomes a candidate, then official, so one table of trolls can't
  make "El coño 'e la madre" a valid place for everyone. That needs a small
  server store (counts per category + word + distinct room codes) and an
  approval rule (N tables, or Juan approves).
- QQSMP does not read El Saber yet. It can build questions from it: the
  explanation is the right answer and other entries of the same category the
  wrong options ("¿Qué significa 'pavoso'?", "¿Cuál es un estado?").
- Parody brands invented in-game, and launcher art.

## Notes for agents

- The kit allows only Luckiest Guy and Nunito, so "handwriting" is Nunito
  italic 800 in graphite (`--stop-pencil`) on the paper colour.
- Software WebGL in the headless suites draws 2–4 fps: click HUD buttons with
  `locator.evaluate(el => el.click())`, type with `input.value` plus an
  `input` event, and wait on state, never time. Screenshots there take
  seconds, long enough for a 3 s review stage to pass; wait on "stage changed
  or index moved", not on one stage.
- The camera measures the visible `[data-scene-avoid]` panel (fixed
  elements have no `offsetParent`, so check `getClientRects()`): the sheet on
  the right pushes the table left, the review at the bottom lets the near
  chairs slide under it.
- `sheet.sync()` runs inside `render()`; the host's own action re-renders at
  once, so progress actions are queued with `queueMicrotask`.
