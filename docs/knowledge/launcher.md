# Illustrated launcher and hosting integrations

The hub remains account-free. `Pana/web/hub.js` reads game names, descriptions,
capacity and URLs from `/api/games`; `launcher-art.js` supplies only categories
and illustration URLs. Do not copy sample rules, friend counts, shops or game
names from a visual prototype. Caída is still Caída, Póquer is still Póquer and
Billar is still Billar. Pepazo keeps the `pintura` folder and room type so shared
links and saved game IDs continue to work.

## Rows and controllers

Below the banner the games sit in one row per category (`data-row`), plus
"Seguir jugando" on top once `launch()` has saved recent ids in
`pana:recent`. On a desktop the banner keeps the top of the screen and the
rows scroll under it in a strip (`.games-wrap`): the row a controller or the
keyboard moves into scrolls to the top of that strip. Stepping onto a card
with the pad or the keyboard (`.pana-pad-focus` or `:focus-visible`) features
it, and pressing it then launches. A tap or a click still only features it.
The hub and the Mi pana editor call `padControls({ playing: () => false })`,
so the whole page is a menu for `engine/gamepad.js`. The rail arrows replace
the scrollbar for the mouse: they show only on a row with more games than fit
(`data-overflow`, kept by a ResizeObserver), dim at either end, hide on touch
screens and carry `data-pad-skip`. The rail pads its inside so the focused
card's outline and lift are not clipped by the scrolling box. Tiles below the strip load their art
lazily, so a test scrolls a tile into view before decoding it.

## Art and rendering

Header, content and card rail use `--pk-page-width` / `--pk-page-gutter` from
the kit; hosted social pages use the same values. Do not combine a larger
`max-width` with an inherited smaller `width` on the header. The creator paints
its loading state before importing `pana.js`, then awaits `sceneReady` (compiled
shaders and first render). A failed import leaves a retry control; customization
controls stay inert until ready. Switching views reuses the prepared renderer.

`web/images/launcher/` contains the user's supplied launcher JPGs, already at 1440 × 960,
plus the supplied Embuste camp PNG. The demo's `g-truco`, `g-farol`, `g-bola8`
and `g-pepazo` assets map to `caida`, `poquer`, `billar` and `pintura` respectively.
The source bundle is **Game launcher and UI flow (1) / Pana Launcher.dc.html**.
Its ready-sized artwork is used unchanged, with CSS `object-fit` and transform
transitions rather than generated/upscaled replacement files. Bolas Criollas and
Ludo use the supplied Tropical Capybara Bocce Challenge / Capybara Ludo Fiesta
images as 1440-pixel JPEG backgrounds. Capybara Bocce in the Tropical Sun /
Capybara Ludo Fiesta in the Plaza provide separate 640-pixel card images, also
used by the private social pages. These are resized exports of the supplied PNGs,
not generated replacements. `artUrl(game, true)` selects a card variant when one
exists; the default selects the large hero/lobby illustration.

New art goes in with `npm run launcher-art -- <id> <image> --row <row>`
(`Pana/scripts/launcher-art.js`): it center-crops to 3:2, writes `<id>.jpg`
at 1536 × 1024 and `<id>-card.jpg` at 640 × 427 (under 600 KB) through
Chromium's canvas, never upscaling a small source, registers the entry (and a
new row in `categories`) in `launcher-art.js`, and adds the game to the card
checks and row counts in `web/tests/launcher.browser.js`. `--dry-run` reports
sizes without writing. Only real supplied art goes through it.

Cards load images lazily. Only a game without an illustration loads `card.js`;
switching a live hero loses the old WebGL context. The player's 3D editor imports
`pana.js` on opening Mi pana and stops rendering while hidden. Real game scenes
and the shared avatar models are unchanged.

## Shared game-room lobby

`engine/game-entry.js` owns the illustrated room shell used after choosing a
game. The header has the room code and the shared `#pana-lobby-invite` Copiar
link button, using `inviteUrl()` so personal/debug/host parameters never leak
into an invitation. Existing footer invite controls are hidden in this shell;
in-game invitations remain available through the shared pause menu.

The host keeps the game's original start button and its existing permission
and rule checks. Guests see the shared ready toggle instead of a disabled host
start button. Everyone begins ready, but assets count as loaded only after
`sceneReady`/preparation completes. The shell blocks start clicks and document
Space/Enter shortcuts until every connected member is ready and loaded. A
focused roster/settings button receives its native click without also invoking
the game's start shortcut. Once loaded and ready, the host's redundant ready
button hides; guests can toggle between ready and waiting.

Before revealing the prepared lobby, entry adopts controls marked
`data-room-primary`, `data-room-extra` and `data-room-help` through the shared
room-options component. Primary choices stay in the settings panel; extras and
help move into Más ajustes. That single button is always the final settings
entry. Markup keeps its original IDs/listeners and the game remains responsible
for host authorization, synchronized values and resets.

Game-owned `[data-pana-roster]` containers move to the left roster area, hiding
generic member cards while visible. `[data-room-personal]` controls move there
too. The shared `lobby-roster.js` renderer displays grouped avatar cards;
`table-seating.js` adapts alternating table indices into teams. Its full group,
seat and permission API is documented in `pana-ui.md`. Team selection stays in
these cards rather than a dropdown inside advanced settings.

The original `.pk-lobby-foot` docks into the shared footer, and menu/sound
buttons dock into the header. Comment placeholders remember each control's
home. When the original lobby hides, entry restores docked nodes to those
positions. It only moves a node when its parent/location actually changes:
re-inserting it on every HUD update loses focus and interrupts clicks.

## Hosting boundary

All new launcher actions dispatch a cancelable `pana:launch` event on `document`
before navigating. `detail` is `{ game, url, source }`, with source `play`,
`private` or `join`. A hosting integration calls `preventDefault()` synchronously
and then handles its own server-confirmed navigation. Selection alone emits
`pana:featured` with `{ game }` and never launches a game. Existing IDs
`play-featured`, `create-room`, `join-code` and `hub-actions` remain stable.

The optional `party-launch-note` and `launcher-party-members` slots let a host
show the leader's name and real member portraits. `play-featured.dataset.online`
lets it restore room controls correctly after a party exit. A hosting integration
may add store navigation through the normal navigation/actions slots; there is
no storefront, wallet, account or payment implementation in open-source Pana.

The private **pana.sh** gateway owns party membership, authorization and sockets.
It hides the private-room/code buttons for party members, makes the Mayor launch
the group, and requires a server-confirmed leave before a guest plays separately.
It also guards direct guest game-page requests and strips forged guest `lead`
parameters. These behavior changes require deploying the private gateway too;
updating only this repository changes the launcher but not party authorization.
The hosted gateway also requires a signed-in session for launcher illustrations;
anonymous `/images/launcher/*` requests return 404 even when the files are deployed.

## Proof

`npm run test:browser -- launcher` checks illustrations, filters, names, settings,
private rooms, room codes, mobile width and canceled hosting intents.
The private gateway's `gateway/tests/launcher-party.browser.mjs` uses two actual
authenticated browser contexts, live party sockets and real Pana game rooms.
It covers cancel/confirmed/failed exits, modified clicks, guest authorization,
leader launches, portrait bubbles, hidden room buttons and leadership transfer.

Carreritas removes `lead` from its address immediately after passing it into
`joinRace`. Verify the original navigation request and actual game host controls,
not the final address bar, when testing party handoffs into that game.
