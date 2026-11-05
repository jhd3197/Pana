# Conuco

A player's own plot, the one Pana page with no match and no room (`players: 1`). The
mechanics are `engine/plot/` (`docs/SHARED-ENGINE.md`, "Home plot"); this game is the
tables (`public/rules.js`), the page (`public/ui.js`) and the 3D plot (`public/scene.js`).
No visits or stealing: a plot belongs to one browser, like the rest of the progress.

## Files

- `public/rules.js`: crops, house tiers, ranks, decorations and the shelf's numbers.
- `public/scene.js`: draws what `plot.view()` says. It holds no rules.
- `public/ui.js`: one button per bed, placed from the camera, and the one side sheet.
- `public/game.js`: wiring. `?debug` adds `window.conucoDebug`, with `warp(ms)` to move
  this page's clock; the plot only reads time through the `now` it was given.
- `tests/rules.test.js`: the economy. `tests/conuco.browser.mjs`: the page.

## Decisions

- **No lobby.** There is nothing to set up, so the page opens on the plot. It still
  loads through `engine/game-entry.js` with an empty `hidden` `.pk-lobby` (the shell
  hides with it), and sits in `OWN_MENU` in `engine/tests/all-games.browser.js`.
- **The maíz is free and always there**, so a player with no mangos and no seeds can
  always play on. It stays off the shelf.
- **Time is the player's clock.** There is no server to ask, so moving the clock
  forward grows crops faster; a solo plot pays small amounts and that is accepted. A
  clock moved back never gives a negative age. The shelf uses epoch time, not the
  local date, so two players anywhere see the same one.
- **Reading the wallet uses `peek`, never `balance`.** `balance()` adopts a seed once,
  and with no seed it would close the door on the coins an older Carreritas save
  still has to hand over.
- **Receipts come from the plant's own id** (`conuco:b12`), so a harvest whose clearing
  never reached storage pays nothing the second time.

## Performance

- Models and scenery bake with their colours in the vertices (`bake(group, { tint:
  true })`). A crop is built once per kind and stage, and a bed that needs the same
  one clones it, sharing geometry and materials. A full plot with every decoration is
  about 105 draws and 62 k triangles (it was 165 draws before the tinted bake).
- `renderer.shadowMap.autoUpdate` is off: the map redraws when a bed, the house or a
  decoration changes, or while the pana walks. The camera never moves, so the bed
  buttons only move on a resize.
- The scene draws at 30 fps. Nothing on it needs more.

## Tuning

- A plot's beds go in `BED_ORDER`: 3 at the first tier, 9 at the last, and the scene
  has no more places than that (`tests/rules.test.js` checks it).
- A crop grows 5 min to 8 h. The first repair is under an hour of free maíz.
