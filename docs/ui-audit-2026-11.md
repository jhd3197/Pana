# UI audit, November 2026: one square style

Goal: every screen (hub game list, settings, lobby, HUDs, results, character
editor, Studio) wears the Banderín / `pk-skin` look: square corners, hard
offset shadows, the kit fonts. This records what was out of line before the
change and what stayed round on purpose. Capis (`games/capis/`) was being
restyled elsewhere and is not covered here; it only inherits the shared tokens.

## Rounded corners in stylesheets

Before: 486 `border-radius` declarations in 47 stylesheets, 391 of them non-zero.
Columns: fixed px radii (largest value), pills (`999px` / `99px`), `50%`, and
`var(--pk-r*)` tokens (9–26 px at the time).

| File | px radii | pills | 50% | tokens |
|---|---|---|---|---|
| `engine/banderin.css` | 1 (up to 2px) | 0 | 0 | 0 |
| `engine/game-lobby.css` | 7 (up to 24px) | 0 | 0 | 0 |
| `engine/kit.css` | 19 (up to 22px) | 7 | 6 | 6 |
| `engine/lobby-roster.css` | 4 (up to 20px) | 0 | 0 | 0 |
| `engine/play/quien-empieza.css` | 3 (up to 18px) | 2 | 0 | 0 |
| `engine/room-options.css` | 3 (up to 15px) | 0 | 0 | 0 |
| `engine/sala.css` | 0 | 0 | 1 | 0 |
| `engine/ui.css` | 13 (up to 14px) | 1 | 6 | 0 |
| `games/billar/public/hud-banderin.css` | 1 (up to 4px) | 0 | 0 | 0 |
| `games/billar/public/style.css` | 6 (up to 18px) | 0 | 3 | 0 |
| `games/bochinche/public/hud-banderin.css` | 0 | 0 | 3 | 0 |
| `games/bochinche/public/lightning.css` | 1 (up to 8px) | 0 | 0 | 0 |
| `games/bochinche/public/pana-picker.css` | 1 (up to 3px) | 0 | 0 | 0 |
| `games/bochinche/public/results.css` | 0 | 0 | 2 | 0 |
| `games/bululu/public/style.css` | 13 (up to 14px) | 4 | 8 | 2 |
| `games/caida/public/style.css` | 8 (up to 10px) | 0 | 0 | 8 |
| `games/carreritas/public/loadout.css` | 4 (up to 14px) | 2 | 2 | 0 |
| `games/carreritas/public/menu.css` | 0 | 0 | 2 | 0 |
| `games/carreritas/public/race-screens.css` | 1 (up to 3px) | 0 | 1 | 0 |
| `games/carreritas/public/style.css` | 14 (up to 18px) | 1 | 2 | 0 |
| `games/chapita/public/style.css` | 2 (up to 16px) | 0 | 5 | 2 |
| `games/cocina/public/style.css` | 8 (up to 16px) | 4 | 1 | 0 |
| `games/criollas/public/style.css` | 3 (up to 18px) | 0 | 0 | 0 |
| `games/curiara/public/style.css` | 7 (up to 18px) | 0 | 2 | 0 |
| `games/domino/public/style.css` | 6 (up to 10px) | 1 | 4 | 8 |
| `games/embuste/public/style.css` | 5 (up to 14px) | 1 | 0 | 5 |
| `games/escondidas/public/style.css` | 10 (up to 18px) | 3 | 2 | 0 |
| `games/galope/public/style.css` | 5 (up to 18px) | 0 | 1 | 0 |
| `games/lancha/public/style.css` | 4 (up to 18px) | 0 | 1 | 0 |
| `games/ludo/public/style.css` | 2 (up to 18px) | 0 | 3 | 0 |
| `games/parapente/public/style.css` | 0 | 0 | 1 | 0 |
| `games/pintura/public/armory.css` | 2 (up to 4px) | 0 | 0 | 0 |
| `games/pintura/public/hud-banderin.css` | 0 | 0 | 3 | 0 |
| `games/pintura/public/style.css` | 2 (up to 20px) | 0 | 2 | 0 |
| `games/poquer/public/style.css` | 8 (up to 20px) | 0 | 0 | 0 |
| `games/qqsmp/public/style.css` | 1 (up to 6px) | 1 | 0 | 1 |
| `games/reliquia/public/style.css` | 5 (up to 12px) | 2 | 1 | 0 |
| `games/stop/public/style.css` | 7 (up to 22px) | 1 | 4 | 4 |
| `games/tambor/public/style.css` | 0 | 4 | 3 | 2 |
| `games/trifulca/public/hud-banderin.css` | 1 (up to 4px) | 0 | 0 | 0 |
| `games/trifulca/public/style.css` | 7 (up to 16px) | 0 | 1 | 0 |
| `web/character/editor.css` | 14 (up to 16px) | 3 | 5 | 0 |
| `web/character/studio.css` | 11 (up to 10px) | 0 | 1 | 0 |
| `web/studio/studio.css` | 6 (up to 4px) | 0 | 0 | 0 |
| `web/style.css` | 17 (up to 24px) | 2 | 1 | 1 |

Pills worth naming: the kit's `pk-ribbon`, `pk-chip`, `pk-toast`, `pk-switch`,
`pk-bar`, `pk-combo-badge`, the loading bar; Quién empieza hints and order;
game toasts (Cocina, Escondidas), Tambor role chip and meters, Bululú timer and
progress, Stop votes, Qqsmp answers, Embuste phrase buttons, Carreritas wallet
and shop pills, the hub's "me" and feature tags, the editor's lock and chips.

Not-really-circles at `50%` (made square): switch knobs (`pk-switch`,
`pana-switch`), power-bar slider thumbs, Dominó seat badges, Cocina chef chips,
Stop letter discs, the editor's toggle knob.

## Rounded boxes and old looks in scripts

| File | What |
|---|---|
| `engine/fx.js` | speech bubble over a pana: `roundRect` r=40 |
| `engine/perf.js` | stats overlay `border-radius:4px` |
| `engine/play/scope.js` | scope dot `50%` inline (kept round through the token) |
| `games/embuste/public/game.js` | 3D name label, r=8 |
| `games/trifulca/public/fighters.js` | name tag pill, r=24 |
| `games/tambor/public/rueda-set.js` | name tag pill, r=24 |
| `games/cocina/public/game.js` | chef label, r=18 |
| `games/reliquia/public/view.js` | name tag / bubble, r=22 |
| `games/parapente/public/textures.js` | camera-facing tag, r=40 |
| `games/bululu/public/minigames/criollas.js` | ball/power readout, r=22 |
| `games/qqsmp/public/scene.js` | big-screen question, answers, timer: pill boxes r=8–56 |

## Other old-style patterns

- **Vertical "chunky" drops** (`box-shadow: 0 4px 0 …`) on the kit buttons,
  primary/teal/coral edges, touch buttons, banners, the modal and 51 more in
  game and hub CSS (hub feature and cards, editor, Dominó, Caída, Cocina, Stop,
  Bululú…), with squash-and-bounce presses. The skin uses a diagonal hard
  offset (`4px 4px` in `--pk-skin-shade`).
- **Glossy modal**: `pk-modal` had a radial highlight and a soft 60 px blur
  shadow; every results card inherited it.
- **Other fonts**: Pana Studio (`web/studio/studio.css`) and the character
  reference page (`web/character/studio.css`) used DM Sans and Manrope.
- Gradients left alone: they are scene vignettes and stage lights, not button
  gloss.

## What stays round, and why

Only through `var(--pk-radius-round)`: avatar and portrait discs, status, team
and lives dots, colour swatches, the touch joystick disc and gamepad cursor,
spinners, and things that are round in the game itself (pool balls and the
spin pad, coins, pepas, reticles and crosshairs, rhythm rings, the muzzle
flash, Carreritas' pedestal). Canvas art painted onto 3D meshes or previews
(pool table rails, board tiles, playing cards, wooden track signs, models under
`engine/models/`) is art, not UI, and keeps its shapes.
