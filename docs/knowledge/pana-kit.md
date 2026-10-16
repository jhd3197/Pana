# Pana Kit: the shared look

`engine/kit.css` is the one visual language for the hub and every game:
the brand palette, the font pair and the HUD/lobby pieces. `engine/kit.js`
adds the few bits that need script. The pause menu (`engine/ui.css`) reads
the same tokens.

## Rules

- **Fonts:** `Luckiest Guy` for display (titles, big numbers, primary
  buttons, shouts) and `Nunito` 600–900 for everything else. Use
  `var(--pk-display)` / `var(--pk-sans)`. No other families: no serif
  accents, no condensed faces. kit.css imports both; pages do not link
  Google Fonts themselves.
- **Palette:** use the `--pk-*` tokens (night `#0e0b24`, purple `#1a1336`,
  yellow `#ffc629`, coral `#ff4b4b`, teal `#2ad1b2`, cream `#f3e9d7`,
  muted `#a49cc8`). A game gets one accent: `body { --pk-game: …; }`,
  matching `color` in its `game.json`.
- **Link order:** `/engine/kit.css`, `/engine/ui.css`, then `style.css`.
  ui.js and kit.js inject kit.css if a page forgot.
- Classes only (`.pk-*`); the kit never styles bare elements.

## Pieces

| Class | Use |
|---|---|
| `pk-logo` | PANA wordmark (yellow, coral drop) |
| `pk-title`, `pk-title--yellow` | Big display title; shadow is `--pk-game` |
| `pk-heading`, `pk-eyebrow`, `pk-copy`, `pk-num`, `pk-place` | Type roles |
| `pk-btn` + `--primary --lg --teal --coral --danger --ghost --sm --block` | Buttons. Primary is yellow with a 3D edge |
| `pk-kbd` | Key cap; inside a primary button it turns ink |
| `pk-panel`, `pk-panel--solid`, `pk-well`, `pk-modal` | Surfaces. `pk-panel` is the HUD card over a 3D scene |
| `pk-stats` > `pk-stat` (`<b>`+`<span>`) | Stat tiles; number uses the game accent |
| `pk-readout` | HUD label over number (VUELTA 2/3) |
| `pk-ribbon`, `pk-chip(--teal/--yellow/--coral)`, `pk-dot` | Pills |
| `pk-seg` | Segmented choice; on = `aria-pressed/aria-checked="true"`, `.is-on`, or a checked radio inside a label |
| `pk-switch` | Toggle (`role="switch" aria-checked`) |
| `pk-bar` (`--pk-value`, `--pk-bar-color`, `--stripes`), `pk-pips` | Progress |
| `pk-roster` > `pk-row` (`.is-me`, `pk-row-n`, `pk-row-end`), `pk-avatar` | Standings and player lists |
| `pk-slots` > `pk-slot` (`.is-active`, `pk-slot-n`, `pk-slot-count`) | Inventory |
| `pk-banner(--yellow/--teal)`, `pk-pop` | Tilted shout; `shout(text)` in kit.js |
| `pk-hints` | Bottom-right key reminders (also mark `data-pana-hint`) |
| `pk-lobby`, `pk-lobby-top`, `pk-field`, `pk-lobby-foot`, `pk-lobby-room`, `pk-lobby-cta`, `pk-avatars`, `pk-check` | Game launcher column over the live scene |
| `pk-loading` | Full-screen loading card |

## Screen layout (from the design flow)

- **Lobby:** left column (`pk-lobby`): back link + PANA, ribbon, title,
  copy, three stat tiles, one option group, then room line and
  `¡JUGAR!` + `Invitar panas ↗` at the bottom. The 3D scene stays visible
  on the right.
- **HUD:** dark `pk-panel` cards in the corners. Place/score top-left, map
  or timer top-right, inventory bottom-left, the contextual action (yellow
  button with a `pk-kbd`) bottom-center, key hints bottom-right. Shouts
  in the upper middle.
- **Pause / settings:** the shared menu; do not build one.
