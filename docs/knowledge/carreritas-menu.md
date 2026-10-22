# Carreritas illustrated menu

Carreritas starts in the shared lobby (`engine/game-entry.js`, `#room-lobby`),
like every game. `public/menu-flow.js` moves the race options and Carreritas's
room panel into it, then arranges the garage into two pages, Copa and Taller
(internal IDs track and car). The Taller footer's `#play` reads ¡Vámonos!
and races. `game.js` still owns setup, car tuning, saved profile, race loading
and Colyseus authority. The menu never creates a room, simulates a race or
writes setup independently.

- The host's ¡Arrancar! (`#start`) sends `garage` to the room. The room's
  `garage` flag takes everyone to Copa: the host picks there, and guests see
  the choice read-only. Atrás on Copa (host only) and "Sala" after a race
  send it back. Alone, without a room, the flag is local.
- Lobby settings are choice rows of one kind: Dificultad, Vueltas (hidden
  online, where the map sets the laps), Parrilla (online), En esta pantalla
  and Pista. The old `#split`, `#mirror` and `#lobby-bots` controls stay for
  game.js but are hidden, and the rows press them.
- "En esta pantalla: 1 pana / 2 panas" is split screen, up to two panas on one
  screen. It shows only while you are alone in the room; then ¡Vámonos! runs a
  local split race even inside a room, because room races have one pana per
  screen. There is no "Un jugador" choice: alone in the room is playing solo.

## Artwork

`public/images/menu/sources.json` maps the supplied PNG names to optimized
WebP files. Original PNGs are local in the sibling `pana-photos/generated`
folder; they are not needed to serve the game. These are prepared assets,
not a build step or a new runtime dependency. Circuit thumbnails are 320px;
the selected/loading illustration is 960px. Circuit thumbnails load lazily.
The complete street-race image remains the startup fallback. The unused
parallax renderer and its four layer images have been removed; `sources.json`
only lists served artwork. Missing optional map illustrations never gates Play.
The small route canvas still draws actual track geometry.

The initial HTML shows the festival illustration while modules load.
`createMenuFlow` removes it after the car thumbnail source and compiled garage
shaders are ready. The `prepared` promise rejects into a visible retry action
rather than removing the loading screen early; there is no invented percentage.
Cup cards use
four real stage IDs from `cup-definitions.js`, not duplicated route data.

## Integration traps

- `createMenuFlow` runs after the existing controls and handlers are created;
  it moves the actual elements rather than cloning them. Keep IDs stable.
  Replacing mode-button labels must preserve the trophy and legacy badges that
  the initial `renderSetup` has already restored from the player's profile.
- `refresh` is read-only: calling `renderSetup` from it would recurse through
  `selectTrack`. Refresh after car, route, setup and room changes.
- Each cup card lists its four stops; the stage buttons stay hidden on the cup
  page. Ready shows the cup's first stage because a new cup always starts
  there.
- Track browsing uses route metadata and never constructs 3D scenery. The
  garage's WebGL render is skipped while illustrated menu pages cover it.
- Keep Play in the fixed footer. Ready options and the roster scroll separately
  on short phones, while the primary action remains reachable.
- Browser suites use `tests/menu-helpers.js` to navigate visible step buttons.
  Do not force clicks on hidden controls or add a debug-only alternate menu.

Proof: `tests/menu-flow.browser.js` covers artwork, local/split play, all maps
and cups, customization, keyboard, phone layouts, reduced motion, failed image
requests, loading retry and two actual clients with host/guest restrictions.
Existing loading, modes, cup and online suites retain their gameplay assertions.

## The 16 cars, the Taller and the car kit

- Sixteen cars: the eight classics in `engine/models/vehicles/cars.js` keep
  their chunky low-poly bodies; the eight Taller bodies in `taller-cars.js`
  (escarabajo, sedan, buseta, pickup, jeep, hatch, rustico, malibu, numbers
  9–16) are data on the filleted kit. Their profiles are kept at 1:1 and
  stretched to toy proportions on build (length ×1.12, body height ×1.3,
  cabin height ×1.9 above the belt, wheels ×1.36), because the pana driver
  needs a tall greenhouse and arches must stay under the belt line.
- `car-kit.js` v2: `roundedPath` fillets a side profile, arches are cut from
  `axle`/`archR`/`sill`, `shellBody` builds two tapered side slabs and a tub
  (a pickup's bed is a lower tub) and returns a fit (`noseZ`, `tailZ`,
  `topOf`, `halfW`). `profileFit` gives the classics the same fit from their
  `profile()` points. Extrusion bevels grow the outline, so the fit adds the
  tub's bevel; a decal on the raw profile ends up buried under the paint.
- `car-parts.js` dresses any fitted car: spoilers (pato, techo, gt, rally,
  cisne; on the roof when the cabin reaches the tail), roof cargo (barra,
  cava, maletas, repuesto, cornetas; a bed or open deck via `fit.cargo`),
  front bars (defensa, faros, winche), a roll cage, engine dress-up (pipes,
  scoop, chrome blower), decals and stripes in the accent colour and the
  paint finish. Builders skip a stock part when its slot asks for another.
- Wheels are lathe tires with tread blocks and six rim faces sharing one
  metal look, so `batchRacer` merges a wheel into 2–3 draws. Batched race
  bodies are 25–40 meshes for all 16 cars against a 133-mesh, 137k-triangle
  driver. A bigger wheel or a wheel `lift` raises the body through `rig`'s
  `lift` group, because `chassis.position.y` is the suspension.
- `parts.js` is shared by garage, race and room. Parts change the tune only
  through `composeTune(tune, wheelProfile, partsProfile(parts))`, at most 10%
  per part. Bar points (`statPoints`) are about 1 m/s of punta, 1.5 of
  arranque, 0.1 of giro, 0.5 of agarre or 0.1 of peso, which is what the
  "+2 Vel" pills count. Mass comes from the composed tune in contacts.
- Equipped parts live per car in `wallet.parts`; the cauchos in
  `wallet.wheel` (migrated once from `carreritas:wheels`, still mirrored), and
  the three Taller wheels cost coins. `cleanCosmetics` adds `parts` only when
  some are set, so the cup ledger and older rooms see the same cosmetics.
- The showroom: a PMREM studio room, violet/cyan rims, clearcoat paint on the
  turntable car only, and bloom (`garage-bloom.js`) unless quality is `baja`,
  which browser suites force. Each Taller tab stops the turntable and frames
  its part (`TAB_FRAMES` in game.js).
- Money: races pay **coins** (the trail pickups, the HUD counter) because
  mangos are the thrown item; the finish exchanges them 1:1 for **mangos**,
  the Taller's currency (`exchangeText` in taller.js). The wallet field is
  still `wallet.coins` so saves, cup receipts and rooms stay compatible;
  only player-facing Taller text says mangos.
- Entering the Taller page opens the fullscreen loadout. The only build stats
  are `#shop-stats`. `garageCards` owns an image source for the visible Garaje
  drawer; no hidden car/wheel strips, duplicate stats, or wheel renderer are
  constructed. Hovering parts previews without spending; selecting buys/equips.
  Tests select through Garaje or the visible slot and return with Atrás.
- Debug pages opened with `?manual` never re-render the garage, so a
  screenshot there shows the first frame; use `?debug` alone to see a change.

## Full-screen Taller

Cabin fitting preserves the shared character's neutral head/neck scale. Use
one nominal uniform driver scale (0.82), reducing the entire character only
for actual roof/width clearance, and position the muzzle above the dashboard.
Measure visible head meshes before parenting to the chassis: `Box3` over the
whole head includes unequipped hidden hats, while world-space fitting after
parenting also includes wheel lift. Both used to shrink just the head and
leave the sculpt's separate visible neck/body unchanged. Roof clearance is
sampled at the driver's seat, not the lowest point anywhere on the roof.
`driver-fit.browser.js` checks every car with three headwear choices and
stock/lifted wheels, plus garage animation and rigid race batching.

Copa retains its navigation; Taller has only the prototype loadout controls. The circuit summary beside
¡Vámonos! returns to Copa; gameplay settings remain in the shared lobby/menu.
The nameplate, Garaje and G open the body drawer. Q/E select car, boat or plane.
A native dialog supplies Escape and focus containment for part choices.
`menu-helpers.js` follows this same visible navigation in browser suites.

The full build remains visible across six slots on cars (four performance,
two style), five on boats and four on planes. Hovering previews the real model
and composed stats without spending. Clicking buys/equips immediately; a short
wallet leaves the equipped part untouched. Car body changes transfer the
current parts and paint. Copied rival builds mark matching cards in the taller.

## Starting grid

After the race scene compiles and renders its first frame, hide both `#loading`
and `#garage` before showing La Parrilla. Otherwise the old Copa/Taller bar,
settings and car strip leak through its translucent backdrop. The actual 3D
starting grid remains behind the roster. La Parrilla owns controller focus
through `data-pad-menu`, with ¡Listo! initially selected.

The kit review timer is distinct from the race countdown. Choosing ¡Listo!
keeps the grid visible with a waiting status while the multiplayer load barrier
settles; only the synchronized race countdown replaces it. A loading error
closes the grid and restores the loading screen's retry/back controls.

## Retired UI and compatibility

The visible result classification owns finish presentation; the hidden portrait
podium and its renderer are removed. Cash-in remains a real `cash-scene.js`
WebGL scene, without CSS coin stacks, mango flights or a painted wooden box.
Live Taller card/stat styling lives in `loadout.css`; old side-panel positioning,
welcome-page styling and hidden garage widgets are removed. Loading tips use
device-neutral actions, and the circuit count comes from the track registry.

Keep `derrape`/old Carreritas profile and ghost migrations, the Playa track alias,
and old network payload readers. Those preserve saves and reconnects rather than
present an obsolete interface. Art loaded dynamically by track ID and the hub's
lazy game card are not unused assets.
