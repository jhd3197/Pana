# Derrape illustrated menu

`public/menu-flow.js` arranges the existing garage controls into four pages:
Panas, Copa, Taller and Parrilla (internal IDs welcome, track, car, ready).
`game.js` still owns setup, car tuning, saved
profile, race loading and Colyseus authority. The menu never creates a room,
simulates a race or writes setup independently. Back/next changes only the
visible page; returning from a race or cancelling loading opens Ready.

## Artwork

`public/images/menu/sources.json` maps the supplied PNG names to optimized
WebP files. Original PNGs are local in the sibling `pana-photos/generated`
folder; they are not needed to serve the game. These are prepared assets,
not a build step or a new runtime dependency. Circuit thumbnails are 320px;
the selected/loading illustration is 960px. All 29 files total about 3.2 MB,
but thumbnail requests are lazy and touch/reduced-motion devices skip the
four 1600px parallax layers.

The complete street-race image is the initial and failure fallback. The four
layers have the same canvas and cover transform, and replace it only after
all decode successfully. Movement follows mouse position without an animation
loop. Reduced motion immediately restores the complete image. Missing artwork
never gates Play or loading progress. Map illustrations are thematic previews;
the small route canvas still draws actual track geometry.
The initial HTML also shows the complete festival illustration while game
modules load; `createMenuFlow` removes that shared-kit loading screen when the
controls, car/wheel thumbnails and compiled garage shaders are ready. The
`prepared` promise rejects into a visible retry action rather than removing the
loading screen early. It does not invent a startup percentage. Cup cards use
four real stage IDs from `cup-definitions.js`, not duplicated route data.

## Integration traps

- `createMenuFlow` runs after the existing controls and handlers are created;
  it moves the actual elements rather than cloning them. Keep IDs stable.
  Replacing mode-button labels must preserve the trophy and legacy badges that
  the initial `renderSetup` has already restored from the player's profile.
- `refresh` is read-only: calling `renderSetup` from it would recurse through
  `selectTrack`. Refresh after car, route, setup and room changes.
- Cup stage buttons preview individual tracks. Ready shows the cup's first
  stage because a new cup always starts there, regardless of the preview.
- Track browsing uses route metadata and never constructs 3D scenery. The
  garage's WebGL render is skipped while illustrated menu pages cover it.
- Keep Play in the fixed footer. Ready options and the roster scroll separately
  on short phones, while the primary action remains reachable.
  The online welcome page also reserves footer space when revisiting Panas.
- Earlier garage CSS hides `.steps` and positions tools with `bottom` on
  phones. `menu.css` explicitly restores the step navigation and resets that
  bottom offset. Scope menu rules so the race HUD is unaffected.
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
  `wallet.wheel` (migrated once from `derrape:wheels`, still mirrored), and
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
- Entering the Taller step opens the panel docked (`openTaller` in
  `createMenuFlow`, `dockTaller` in taller.js). While `body.shop-open` the
  car strip and `#open-shop` hide and the info card becomes the showroom
  title (eyebrow, car name, `#car-build`); the stats render twice, into
  `#stats` and the panel's `#shop-stats`. Suites that click the strip call
  `hideTaller` from `tests/menu-helpers.js` first.
- Debug pages opened with `?manual` never re-render the garage, so a
  screenshot there shows the first frame; use `?debug` alone to see a change.
