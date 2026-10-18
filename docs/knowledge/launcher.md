# Illustrated launcher and hosting integrations

The hub remains account-free. `Pana/web/hub.js` reads game names, descriptions,
capacity and URLs from `/api/games`; `launcher-art.js` supplies only categories
and illustration URLs. Do not copy sample rules, friend counts, shops or game
names from a visual prototype. Caída is still Caída, Póquer is still Póquer and
Billar is still Billar. Pepazo keeps the `pintura` folder and room type so shared
links and saved game IDs continue to work.

## Art and rendering

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

Cards load images lazily. Only a game without an illustration loads `card.js`;
switching a live hero loses the old WebGL context. The player's 3D editor imports
`pana.js` on opening Mi pana and stops rendering while hidden. Real game scenes
and the shared avatar models are unchanged.

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

## Proof

`npm run test:browser -- launcher` checks illustrations, filters, names, settings,
private rooms, room codes, mobile width and canceled hosting intents.
The private gateway's `gateway/tests/launcher-party.browser.mjs` uses two actual
authenticated browser contexts, live party sockets and real Pana game rooms.
It covers cancel/confirmed/failed exits, modified clicks, guest authorization,
leader launches, portrait bubbles, hidden room buttons and leadership transfer.

Derrape removes `lead` from its address immediately after passing it into
`joinRace`. Verify the original navigation request and actual game host controls,
not the final address bar, when testing party handoffs into that game.
