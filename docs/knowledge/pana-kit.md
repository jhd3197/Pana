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
| `pk-roster` > `pk-row` (`.is-me`, `pk-row-n`, `pk-row-name` + `<small>`, `pk-row-end`, `pk-row-score`), `pk-avatar` | Standings and player lists; build rows with `fillRoster()` from `engine/results.js` |
| `pk-results` > `pk-modal pk-results-card` | End-of-round screen (see "Results screen" below) |
| `pk-slots` > `pk-slot` (`.is-active`, `pk-slot-n`, `pk-slot-count`) | Inventory |
| `pk-banner(--yellow/--teal)`, `pk-pop` | Tilted shout; `shout(text)` in kit.js |
| `pk-hints` | Bottom-right key reminders (also mark `data-pana-hint`) |
| `pk-lobby`, `pk-lobby-top`, `pk-field`, `pk-lobby-foot`, `pk-lobby-room`, `pk-lobby-cta`, `pk-avatars`, `pk-check` | Game launcher column over the live scene |
| `pk-loading` | Full-screen loading card |
| `pk-touch` (`--go --coral --sm --lg`, `data-icon="left/right/up/down/jump"`), `pk-dpad`, `pk-touch-zone` | On-screen touch controls (engine/touch.js). See "Touch controls" below |

## Table seating

Table games use `createTableSeating(container, onSwap)` from
`engine/table-seating.js` in the lobby. Call `update(players, { teams, enabled,
ownId })`; pairs are the alternating seats 0+2 and 1+3, and individual games
show clockwise seat order. The controls send source/destination array indices;
game rules validate host authority, phase and revision before swapping. Keep
member IDs unchanged. The picker retains focus and avoids rebuilding on
unchanged snapshots. Its styles are the shared `.pk-seating` classes.

## Icons and colours

- **No emoji, no symbol glyphs** (👑 ⚙ ♥ ↗ 🥭) anywhere in the interface, canvas
  signs included: phones draw them as colour emoji in another font. Use the SVGs
  in `/engine/icons.js` (`ICONS.crown`, `gear`, `share`, `mango`, `juice`, `coin`,
  `crate`, `back`, `heart`, `heartEmpty`, `thumbUp`, `thumbDown`) as `innerHTML`, or `icon(name)` for a
  node; `.pk-ico` sizes them to 1em. Plain arrows in copy (← →) are fine.
- **No raw colours in a game's style.css.** Name a game's own colours on its
  `body { --pk-game … }` rule (`--wood: #b5753a;`) and use `var(--wood)`; kit
  colours are `var(--pk-*)`. Only neutrals (`#fff`, `#000`, greys, with alpha) may
  be written raw.
- `npm test` runs `Pana/tests/conventions.test.js`, which checks both rules plus the
  game contract (game.json, card.js, kit link, `--pk-game` = game.json color, back
  link), rooms only for `players > 1`, the shared room kit and the Studio catalog.

## Touch controls

Every game's on-screen buttons are `pk-touch` buttons wired with `holdButton` from
`/engine/touch.js`. Never draw controls with glyphs (◀ ▲ ⤒): several phones turn them
into emoji. Direction and jump buttons use `data-icon` (an SVG from `ICONS`); action
buttons carry one short word (Gas, Freno, ¡Arre!, ¡Voy!). `pk-touch--go` is the main
action (yellow). Wrap the group in `pk-touch-zone` so a long press never selects the
words or opens the copy menu. Four arrows: `<div class="pk-dpad">` with up, left, down,
right in that order.

```js
import { holdButton } from '/engine/touch.js';
const pad = holdButton(button, { down: () => held.add('w'), up: () => held.delete('w'), paused: () => paused });
pad.release();  // on blur / pause: lets go without waiting for the finger
```

Show the controls on any `(pointer: coarse)` screen, not only narrow ones (tablets are
wide and have no keyboard). Put steering under the left thumb and actions under the
right, at the bottom edge, in both orientations.

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
- **Results:** the shared results screen below; do not build one.

## Power bar and difficulty

Aim-and-shoot games (Billar, Bolas Criollas) put their power on the right edge
in a `.pk-power` panel. Power is charged, never picked with a slider: hold the
shot button, Space or Enter and `engine/shot-charge.js#shotPower` rises for one
second, falls for the next and repeats; letting go shoots at that value. The
meter is a `.pk-charge` track (`role="meter"`) with `.pk-charge-fill` and
`.pk-charge-marker`, painted by `paintCharge(meter, power, label)`, and shown only
while charging. Only a real `pointerup` may shoot; lost capture, blur, hidden
tabs, the menu and a changed revision cancel.

Dice are thrown, not clicked: `engine/dice-throw.js#bindDiceThrow` turns a held
button, Space or a flick across the canvas into a 0–1 power (`throwPower`: a
longer shake or faster flick throws harder; a tap on the canvas is still a
click). The rules still pick the number. `createToss` is the pure flight (arc,
shrinking bounces, a tumble that ends exactly on the rolled face: orientation =
rotate(axis, turn) · final). Ludo and Bululú use both, and `engine/roll-off.js`
for the opening throw that decides who starts.
`engine/difficulty.js#createDifficultyPicker` renders the shared Fácil–Experto
choice; `engine/aim-guide.js` draws ground guides as flat strips, never 1 px lines.

## Results screen

Every game ends a round on the same card: a dimmed layer over the scene with one
`pk-modal pk-results-card`. Inside, in this order: a `pk-ribbon` (or `pk-eyebrow`),
the `pk-title`, a `pk-copy` line, then `pk-stats` and/or a `pk-roster` of standings,
the primary button (`Otra vez`, `Siguiente ronda →`…) and a way back to the hub.

```html
<section id="results" class="pk-results hidden" aria-labelledby="result-title">
  <div class="pk-modal pk-results-card">
    <span class="pk-ribbon">Ronda terminada</span>
    <h2 id="result-title" class="pk-title">¡Bien escondidos!</h2>
    <p class="pk-copy">…</p>
    <ol id="result-board" class="pk-roster"></ol>
    <button id="again" class="pk-btn pk-btn--primary pk-btn--block">Otra vez</button>
    <a class="pk-back" href="/">← Todos los juegos</a>
  </div>
</section>
```

```js
import { fillRoster } from '/engine/results.js';
fillRoster($('result-board'), order.map((p, i) => ({
  rank: i + 1, name: p.name, detail: 'A salvo', end: p.score, score: true, me: p.id === room.id,
})));
```

Rows are built from text only, so names never become HTML. Row fields: `rank`,
`lead` (a node before the name, such as a colour chip or a face), `name`, `detail`
(small line under the name), `end` (right side; `score: true` shows it big), `me`,
`className`. A game tunes the layer with `--pk-results-z`, `--pk-results-top` and
`--pk-results-dim` instead of restyling it. A game that already opens its results as
a modal `<dialog>` (Caída, Dominó) keeps the dialog and puts `pk-results-card` on
the card. Derrape (podium) and Bululú (medals and portraits) keep their own layouts
but follow the same order of pieces.
