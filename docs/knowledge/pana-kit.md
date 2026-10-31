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
| `pk-toast` | Milestone toast; `createFeats(el)` in engine/feats.js (opt-in per game) |
| `pk-hints` | Bottom-right key reminders (also mark `data-pana-hint`) |
| `pk-lobby`, `pk-lobby-top`, `pk-field`, `pk-lobby-foot`, `pk-lobby-room`, `pk-lobby-cta`, `pk-avatars`, `pk-check` | Game launcher column over the live scene |
| `pk-loading` | Full-screen loading card |
| `pk-touch` (`--go --coral --sm --lg`, `data-icon="left/right/up/down/jump"`), `pk-dpad`, `pk-touch-zone` | On-screen touch controls (engine/touch.js). See "Touch controls" below |

## Picture settings

Ajustes > Imagen edits shared settings in `engine/settings.js`. **Calidad**
(Nítida, Equilibrada, Rápida) is a preset for three knobs; changing one by
hand shows Personalizada (`quality: 'custom'`):

| Knob | Values | Reaches a game through | Live |
|---|---|---|---|
| `resolution` | 0.75, 1, 1.5, 2 (pixel-ratio cap) | `bindRenderer`, `pixelRatio()` | yes |
| `shadows` | alta, media, baja, off | `shadowSize()`; off through `bindRenderer` | off yes, size on reload |
| `detail` | alta, media, baja | games that read it (Carreritas, ambient life) | per game |
| `fpsCap` | 0, 60, 30 | `bindRenderer` skips screen draws | yes |
| `antialias` | on/off | `rendererOptions()` at creation | on reload |
| `autoScale` | on/off | the frame-rate guard in `settings.js` | yes |
| `perfOverlay` | on/off | `engine/perf.js` overlay | yes |

A game's main renderer is `new THREE.WebGLRenderer(rendererOptions({...}))`
bound with `bindRenderer(renderer, max)`, or comes from `createTableWorld`
(`tests/conventions.test.js` checks it). Menu cards set
`pixelRatio(max)` only. In a game, the Imagen page offers **Recargar
ahora** while smoothing or the shadow size differ from what was loaded.

`bindRenderer` wraps the renderer once. `shadowMap.enabled` reports false
while shadows are off and returns the game's own value afterwards. A
scene's materials are marked for update the first time it draws after the
switch, because three.js compiles shadows into each program. With an FPS
cap, screen draws in between are skipped; render-target draws (bakes,
composer passes) are never skipped. A frame skipped just before the game
stops drawing is painted once the interval has passed, so on-demand scenes
(a table between turns) never stay stale.

**Settings in the address.** `?pana-quality=baja&pana-shadows=off&pana-detail=baja&pana-resolution=1&pana-fps=30&pana-antialias=0&pana-autoscale=0&pana-stats&pana-sound=0`
applies to that page only and is never saved. A value the player then picks
on the page wins, is saved and leaves the address (so a reload keeps it).
Invalid values are dropped. Browser suites, `npm run shots` and both
benchmarks pin `autoScale: false`; with the guard on, a slow headless run
lowers the resolution part-way through a measurement.

**Measuring.** `engine/perf.js` loads on demand (the overlay, or
`await import('/engine/perf.js')`). `snapshot()` reports the real loop: fps of
drawn frames, p50/p95/worst frame, freezes over 50 ms, draws and triangles
per frame, CPU submit, GPU time (`EXT_disjoint_timer_query_webgl2`), the
drawn resolution and the guard's step. `measureFrame(n)` redraws each
renderer's last frame n times, waiting on the GPU, which is the only
number for scenes that draw on demand. `npm run perf -- <game> [--tiers]
[--base ref]` uses both, per variant in the address; a game names its
views in `tests/perf.views.js`. Headless frames are not vsync-paced in a
race (Chuao at Nítida ran 260 fps on an RTX 4090), so compare GPU ms,
draws and triangles. Measured 2026-10-25, 1280×800 at ×2: Dominó's lobby
at Nítida draws 1.3k calls and 1.88 M triangles in 4.7 ms of GPU; shadows
off draws 613 calls, 0.93 M triangles in 2.0 ms. The shadow pass is half
of a table scene, and Equilibrada only saves resolution where a game's cap
is above 1.5. Carreritas Chuao: Nítida 345 draws / 3.74 M triangles / 1.05 ms GPU,
Equilibrada 316 / 1.56 M / 0.50 ms, Rápida 254 / 1.02 M / 0.25 ms.

## Table seating

Table games use `createTableSeating(container, onSwap)` from
`engine/play/table-seating.js` in the lobby. Call `update(players, { teams, enabled,
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
shot button, Space or Enter and `engine/play/shot-charge.js#shotPower` rises for one
second, falls for the next and repeats; letting go shoots at that value. The
meter is a `.pk-charge` track (`role="meter"`) with `.pk-charge-fill` and
`.pk-charge-marker`, painted by `paintCharge(meter, power, label)`, and shown only
while charging. Only a real `pointerup` may shoot; lost capture, blur, hidden
tabs, the menu and a changed revision cancel.

Dice are thrown, not clicked: `engine/play/dice-throw.js#bindDiceThrow` turns a held
button, Space or a flick across the canvas into a 0–1 power (`throwPower`: a
longer shake or faster flick throws harder; a tap on the canvas is still a
click). The rules still pick the number. `createToss` is the pure flight (arc,
shrinking bounces, a tumble that ends exactly on the rolled face: orientation =
rotate(axis, turn) · final). Ludo and Bululú use both, and `engine/play/roll-off.js`
for the opening throw that decides who starts.
`engine/play/difficulty.js#createDifficultyPicker` renders the shared Fácil–Experto
choice; `engine/play/aim-guide.js` draws ground guides as flat strips, never 1 px lines.

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
the card. Carreritas (podium) and Bululú (medals and portraits) keep their own layouts
but follow the same order of pieces.

## Opt-in Banderín presentation

`engine/banderin.css` scopes the common angled panels, flat controls, lobby
finishing and larger results to `body.banderin`. Bochinche, Caída, Billar and
Trifulca opt in and load their own `hud-banderin.css` afterward for game-specific
placement. This is a skin over kit/menu/sala, not a parallel lobby or pause
implementation. The user-supplied HUD packages are design references; live
state supplies all numbers, portraits, button permissions and result data.

On phone layouts the Banderín lobby stacks the start action and local-play
buttons. Keep these rows separate: an overflowing skewed start button can
receive touch events intended for Billar's practice button even when its
bounding box appears to fit the viewport.
